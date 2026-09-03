import assert from "node:assert/strict";
import test from "node:test";
import {
  WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  parseWorkspaceBackendResult,
} from "../src/index.ts";
import {
  cleanupWorkspaceGitFixture,
  createWorkspaceGitFixture,
  workspaceCleanupRequest,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

const windowsOnly = { skip: process.platform !== "win32" };

test("Windows Git adapter exposes only its frozen narrow description", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-contract-description");
  try {
    assert.deepEqual(fixture.adapter.description, {
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
      contractId: "ato.workspace/v2",
      projectRootCount: 1,
      workspaceRootCount: 1,
    });
    assert.equal(Object.isFrozen(fixture.adapter), true);
    assert.equal(Object.isFrozen(fixture.adapter.description), true);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("every direct operation returns the exact shared result grammar", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-contract-operations");
  try {
    const reserve = fixture.adapter.reserve(workspaceRequest(fixture, "reserve"));
    assert.deepEqual(parseWorkspaceBackendResult(reserve), reserve);

    const create = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(create.ok, true, create.ok ? undefined : create.error.code);
    assert.deepEqual(parseWorkspaceBackendResult(create), create);

    const inspect = fixture.adapter.inspect(workspaceRequest(fixture, "inspect"));
    const recover = fixture.adapter.recover(workspaceRequest(fixture, "recover"));
    const cleanupRequest = workspaceCleanupRequest(fixture, create.receipt);
    const cleanup = fixture.adapter.cleanup(cleanupRequest);
    for (const result of [inspect, recover, cleanup]) {
      assert.deepEqual(parseWorkspaceBackendResult(result), result);
    }
    assert.equal(cleanup.ok, true, cleanup.ok ? undefined : cleanup.error.code);
    assert.equal(cleanup.receipt.code, "removed");
    assert.equal(cleanup.receipt.cleanupAttestationSha256, cleanupRequest.cleanupAttestation.attestationSha256);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("old, lowercase, incompatible, and operation-confused requests are rejected", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-contract-rejections");
  try {
    const valid = workspaceRequest(fixture, "reserve");
    const { ownershipBindingSha256: _binding, ...oldSubject } = valid.subject;
    const cases = [
      { ...valid, subject: oldSubject },
      { ...valid, subject: { ...valid.subject, ownershipBindingSha256: valid.subject.ownershipBindingSha256.toLowerCase() } },
      ...[0, -1, 1.5, "01", "+1", "1"].map((generation) => ({
        ...valid,
        subject: { ...valid.subject, generation },
      })),
      { ...valid, adapterVersion: "0.9.0" },
      { ...valid, contractId: "ato.workspace/v0" },
    ];
    for (const candidate of cases) {
      const result = fixture.adapter.reserve(candidate);
      assert.equal(result.ok, false);
      assert.equal(result.error.category, "invalid_request");
      assert.equal(result.error.code, "request_shape_invalid");
      assert.equal(result.error.evidenceReference, null);
    }
    const confused = fixture.adapter.create(valid);
    assert.equal(confused.ok, false);
    assert.equal(confused.error.code, "request_shape_invalid");
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});
