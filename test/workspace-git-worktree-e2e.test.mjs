import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cleanupWorkspaceGitFixture,
  createWorkspaceGitFixture,
  git,
  workspacePaths,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

test("Windows Git adapter creates and authoritatively inspects one exact detached linked worktree", () => {
  const fixture = createWorkspaceGitFixture("workspace-git-e2e");
  try {
    const reserveRequest = workspaceRequest(fixture, "reserve");
    const reserved = fixture.adapter.reserve(reserveRequest);
    assert.equal(reserved.ok, true, reserved.ok ? undefined : reserved.error.code);
    assert.equal(reserved.receipt.code, "reserved");
    assert.equal(reserved.receipt.externalState, "reserved");
    assert.equal(reserved.receipt.ownershipBindingSha256, fixture.ownershipBindingSha256);

    const createRequest = workspaceRequest(fixture, "create");
    const created = fixture.adapter.create(createRequest);
    assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
    assert.equal(created.receipt.code, "created");
    assert.equal(created.receipt.externalState, "complete");
    assert.equal(created.receipt.baseObjectId, fixture.baseObjectId);
    assert.equal(created.receipt.headObjectId, fixture.baseObjectId);
    assert.equal(created.receipt.inventory.trackedCount, 2);
    assert.deepEqual(
      [...readFileSync(created.receipt.canonicalPath + "\\nested\\data.bin")],
      [0, 1, 2, 3, 254, 255],
    );
    assert.equal(readFileSync(created.receipt.canonicalPath + "\\README.txt", "utf8"), "workspace adapter fixture\n");

    const paths = workspacePaths(fixture, createRequest);
    const worktrees = git(fixture, ["worktree", "list", "--porcelain", "-z"]);
    assert.equal(
      worktrees.includes(`worktree ${paths.targetDirectory.replaceAll("\\", "/")}\0`),
      true,
    );
    assert.match(worktrees, new RegExp(`HEAD ${fixture.baseObjectId}`, "u"));
    assert.match(worktrees, /detached\0/u);
    assert.equal(git(fixture, ["-C", paths.targetDirectory, "status", "--porcelain=v1"]), "");

    const inspected = fixture.adapter.inspect(workspaceRequest(fixture, "inspect"));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.code, "inspected_complete");
    assert.equal(inspected.receipt.registrationIdentity, created.receipt.registrationIdentity);

    const repeated = fixture.adapter.create(createRequest);
    assert.equal(repeated.ok, true);
    assert.equal(repeated.receipt.code, "already_created");
    assert.equal(repeated.receipt.registrationIdentity, created.receipt.registrationIdentity);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});
