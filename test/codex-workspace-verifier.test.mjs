import assert from "node:assert/strict";
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createCodexWorkspaceVerifier } from "../src/codex-execution-backend.ts";
import { sha256 } from "../src/persistence/values.ts";
import {
  cleanupWorkspaceGitFixture,
  createWorkspaceGitFixture,
  git,
  workspacePaths,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

const INPUT = "bounded Task input";

function semantic(fixture, overrides = {}) {
  return Object.freeze({
    backendKind: "codex-sdk",
    workspaceMode: "owned",
    workspaceContractId: "ato.workspace/v2",
    projectId: "project",
    projectResourceRevision: 1,
    projectConfigRevision: 1,
    taskId: "task",
    taskRevision: 2,
    inputReference: `task-sha256:${sha256(INPUT).toLowerCase()}`,
    executionId: "execution",
    executionRevision: 4,
    attemptNumber: 1,
    fencingToken: 7,
    policyBindingReference: "policy-binding",
    workspaceId: "workspace",
    workspaceGeneration: 1,
    workspaceRevision: 3,
    workspaceRootKey: "workspace-root-key",
    ownershipBindingSha256: fixture.ownershipBindingSha256,
    workspaceHeadObjectId: fixture.baseObjectId,
    ...overrides,
  });
}

function preparedFixture(label) {
  const fixture = createWorkspaceGitFixture(label);
  const reserved = fixture.adapter.reserve(workspaceRequest(fixture, "reserve"));
  assert.equal(reserved.ok, true, reserved.ok ? undefined : reserved.error.code);
  const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
  assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
  const verifier = createCodexWorkspaceVerifier({
    gitExecutable: fixture.configuration.gitExecutable,
    projectBindings: [{ projectId: "project", rootKey: "project-root-key", path: fixture.projectRoot }],
    workspaceRoots: [{ key: "workspace-root-key", path: fixture.workspaceRoot }],
  });
  return { fixture, verifier, workingDirectory: workspacePaths(fixture, workspaceRequest(fixture, "create")).targetDirectory };
}

test("Codex workspace verifier binds the exact direct owned worktree, HEAD, and Task digest", () => {
  const prepared = preparedFixture("codex-workspace-exact");
  try {
    const verified = prepared.verifier.verify(semantic(prepared.fixture), INPUT);
    assert.equal(verified.workingDirectory.toLowerCase(), prepared.workingDirectory.toLowerCase());
    const inspection = prepared.verifier.verify(semantic(prepared.fixture), null);
    assert.equal(inspection.workingDirectory.toLowerCase(), prepared.workingDirectory.toLowerCase());
  } finally {
    cleanupWorkspaceGitFixture(prepared.fixture);
  }
});

test("Codex workspace verifier refuses digest, HEAD, generation, and workspace substitution before SDK use", () => {
  const prepared = preparedFixture("codex-workspace-substitution");
  try {
    assert.throws(() => prepared.verifier.verify(semantic(prepared.fixture), "changed input"));
    assert.throws(() => prepared.verifier.verify(semantic(prepared.fixture, {
      workspaceHeadObjectId: "0".repeat(40),
    }), INPUT));
    assert.throws(() => prepared.verifier.verify(semantic(prepared.fixture, {
      workspaceGeneration: 2,
    }), INPUT));
    assert.throws(() => prepared.verifier.verify(semantic(prepared.fixture, {
      workspaceId: "substituted-workspace",
    }), INPUT));
  } finally {
    cleanupWorkspaceGitFixture(prepared.fixture);
  }
});

test("Codex workspace verifier refuses tracked, untracked, and ignored inventory changes", () => {
  for (const kind of ["tracked", "untracked", "ignored"]) {
    const prepared = preparedFixture(`codex-workspace-dirty-${kind}`);
    try {
      if (kind === "tracked") {
        writeFileSync(path.join(prepared.workingDirectory, "README.txt"), "changed\n");
      } else if (kind === "untracked") {
        writeFileSync(path.join(prepared.workingDirectory, "untracked.txt"), "untracked\n");
      } else {
        writeFileSync(path.join(prepared.workingDirectory, ".gitignore"), "ignored.txt\n");
        writeFileSync(path.join(prepared.workingDirectory, "ignored.txt"), "ignored\n");
      }
      assert.throws(() => prepared.verifier.verify(semantic(prepared.fixture), INPUT));
    } finally {
      cleanupWorkspaceGitFixture(prepared.fixture);
    }
  }
});

test("Codex workspace verifier recomputes the complete ownership manifest and authoritative worktree registration", () => {
  for (const [field, label] of [
    ["adminIdentitySha256", "admin"],
    ["registrationIdentity", "registration"],
    ["repositoryIdentity", "repository"],
    ["targetIdentitySha256", "target"],
  ]) {
    const prepared = preparedFixture(`codex-ws-manifest-${label}`);
    try {
      const manifestPath = workspacePaths(
        prepared.fixture,
        workspaceRequest(prepared.fixture, "inspect"),
      ).manifestPath;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      writeFileSync(manifestPath, JSON.stringify({ ...manifest, [field]: `workspace-evidence:${"a".repeat(64)}` }));
      assert.throws(() => prepared.verifier.verify(semantic(prepared.fixture), INPUT));
    } finally {
      cleanupWorkspaceGitFixture(prepared.fixture);
    }
  }

  const unlocked = preparedFixture("codex-ws-unlocked");
  try {
    git(unlocked.fixture, ["worktree", "unlock", unlocked.workingDirectory]);
    assert.throws(() => unlocked.verifier.verify(semantic(unlocked.fixture), INPUT));
  } finally {
    cleanupWorkspaceGitFixture(unlocked.fixture);
  }
});

test("Codex workspace verifier refuses configured root aliases and reparse points", { skip: process.platform !== "win32" }, () => {
  const fixture = createWorkspaceGitFixture("codex-workspace-root-alias");
  const projectAlias = path.join(fixture.generation, "project-alias");
  const workspaceAlias = path.join(fixture.generation, "workspace-alias");
  try {
    symlinkSync(fixture.projectRoot, projectAlias, "junction");
    assert.throws(() => createCodexWorkspaceVerifier({
      gitExecutable: fixture.configuration.gitExecutable,
      projectBindings: [{ projectId: "project", rootKey: "project-root-key", path: projectAlias }],
      workspaceRoots: [{ key: "workspace-root-key", path: fixture.workspaceRoot }],
    }));
    symlinkSync(fixture.workspaceRoot, workspaceAlias, "junction");
    assert.throws(() => createCodexWorkspaceVerifier({
      gitExecutable: fixture.configuration.gitExecutable,
      projectBindings: [{ projectId: "project", rootKey: "project-root-key", path: fixture.projectRoot }],
      workspaceRoots: [{ key: "workspace-root-key", path: workspaceAlias }],
    }));
  } finally {
    if (existsSync(projectAlias)) unlinkSync(projectAlias);
    if (existsSync(workspaceAlias)) unlinkSync(workspaceAlias);
    cleanupWorkspaceGitFixture(fixture);
  }
});
