import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import { createWindowsGitWorkspaceBackend } from "../src/index.ts";
import {
  TEST_GIT_EXECUTABLE,
  cleanupWorkspaceGitFixture,
  createWorkspaceGitFixture,
  exactLengthChildPath,
  fixtureScopeDigest,
  git,
  workspacePaths,
  workspaceCapabilityProbePaths,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

const windowsOnly = { skip: process.platform !== "win32" };

function createComplete(label) {
  const fixture = createWorkspaceGitFixture(label);
  const request = workspaceRequest(fixture, "create");
  const result = fixture.adapter.create(request);
  assert.equal(result.ok, true, result.ok ? undefined : result.error.code);
  return { fixture, request, result, paths: workspacePaths(fixture, request) };
}

function emptyCommit(fixture, label) {
  const tree = git(fixture, ["mktree"], { input: "" }).trim();
  return git(fixture, [
    "-c", "user.name=ato-fixture",
    "-c", "user.email=ato-fixture.invalid",
    "commit-tree", tree, "-p", fixture.baseObjectId, "-m", label,
  ]).trim();
}

function configuredAdapter(fixture) {
  return createWindowsGitWorkspaceBackend({
    gitExecutable: TEST_GIT_EXECUTABLE,
    projectRoots: [{ rootKey: "project-root-key", path: fixture.projectRoot }],
    workspaceRoots: [{ rootKey: "workspace-root-key", path: fixture.workspaceRoot }],
  });
}

async function assertCwdAnchorPreventsRename(directory) {
  const child = spawn(process.execPath, [
    "--input-type=module",
    "--eval",
    'process.stdout.write("ready\\n"); setInterval(() => {}, 1_000);',
  ], {
    cwd: directory,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });
  const displaced = `${directory}-rename-probe`;
  let renameError = null;
  try {
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("cwd anchor did not become ready")), 10_000);
      child.stdout.once("data", (chunk) => {
        clearTimeout(timer);
        resolve(String(chunk));
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    assert.equal(ready, "ready\n");
    renameSync(directory, displaced);
  } catch (error) {
    renameError = error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
  if (renameError === null) {
    renameSync(displaced, directory);
    assert.fail(`cwd anchor permitted rename: ${directory}`);
  }
  assert.equal(["EBUSY", "EPERM"].includes(renameError.code), true, renameError.code);
  assert.equal(existsSync(directory), true);
  assert.equal(existsSync(displaced), false);
}

test("overlapping trusted roots are rejected before adapter construction", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-path-overlap");
  try {
    const nested = path.join(fixture.projectRoot, "workspace-root");
    mkdirSync(nested);
    assert.throws(() => createWindowsGitWorkspaceBackend({
      gitExecutable: TEST_GIT_EXECUTABLE,
      projectRoots: [{ rootKey: "project", path: fixture.projectRoot }],
      workspaceRoots: [{ rootKey: "workspace", path: nested }],
    }), /must be disjoint/u);
    const nestedProject = path.join(fixture.workspaceRoot, "project-root");
    mkdirSync(nestedProject);
    assert.throws(() => createWindowsGitWorkspaceBackend({
      gitExecutable: TEST_GIT_EXECUTABLE,
      projectRoots: [{ rootKey: "project", path: nestedProject }],
      workspaceRoots: [{ rootKey: "workspace", path: fixture.workspaceRoot }],
    }), /must be disjoint/u);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("invalid root, relative, share, device, noncanonical, decomposed, and overlong paths are rejected", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-invalid-roots");
  try {
    const candidates = [
      "",
      ".",
      path.parse(fixture.projectRoot).root,
      path.relative(process.cwd(), fixture.projectRoot),
      "\\\\server\\share\\project",
      `\\\\?\\${fixture.projectRoot}`,
      `${fixture.projectRoot}\\.`,
      fixture.projectRoot.normalize("NFD"),
      `D:\\${"x".repeat(239)}`,
    ];
    for (const candidate of candidates) {
      assert.throws(() => createWindowsGitWorkspaceBackend({
        gitExecutable: TEST_GIT_EXECUTABLE,
        projectRoots: [{ rootKey: "project", path: candidate }],
        workspaceRoots: [{ rootKey: "workspace", path: fixture.workspaceRoot }],
      }), undefined, candidate);
    }
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("junction roots and aliased root components are refused", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-path-junction");
  try {
    const alias = path.join(fixture.generation, "workspace-junction");
    symlinkSync(fixture.workspaceRoot, alias, "junction");
    assert.throws(() => createWindowsGitWorkspaceBackend({
      gitExecutable: TEST_GIT_EXECUTABLE,
      projectRoots: [{ rootKey: "project", path: fixture.projectRoot }],
      workspaceRoots: [{ rootKey: "workspace", path: alias }],
    }), /unsafe_path_component/u);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("existing junctions in Git and target mutation namespaces are refused without traversal", windowsOnly, () => {
  for (const namespace of ["worktrees", "target-parent"]) {
    const fixture = createWorkspaceGitFixture(`workspace-git-path-${namespace}`);
    try {
      const outside = path.join(fixture.generation, `${namespace}-outside`);
      mkdirSync(outside);
      const sentinel = path.join(outside, "sentinel.txt");
      writeFileSync(sentinel, "outside sentinel\n", { flag: "wx" });
      const link = namespace === "worktrees"
        ? path.join(fixture.projectRoot, ".git", "worktrees")
        : path.join(fixture.workspaceRoot, "ato-workspaces");
      symlinkSync(outside, link, "junction");

      const result = fixture.adapter.create(workspaceRequest(fixture, "create"));
      assert.equal(result.ok, false, namespace);
      assert.equal(result.error.category, "conflict", namespace);
      assert.equal(result.error.code, "unsafe_path_component", namespace);
      assert.equal(readFileSync(sentinel, "utf8"), "outside sentinel\n");
      assert.deepEqual(readdirSync(outside), ["sentinel.txt"]);
    } finally {
      cleanupWorkspaceGitFixture(fixture);
    }
  }
});

test("the observed Windows cwd capability anchors every adapter mutation namespace", windowsOnly, async () => {
  const fixture = createWorkspaceGitFixture("workspace-git-cwd-anchors");
  try {
    const paths = workspacePaths(fixture, workspaceRequest(fixture, "create"));
    const worktrees = path.dirname(paths.adminDirectory);
    mkdirSync(worktrees, { recursive: true });
    mkdirSync(paths.adminDirectory);
    mkdirSync(path.dirname(paths.targetDirectory), { recursive: true });
    mkdirSync(paths.targetDirectory);
    const treeDirectory = path.join(paths.targetDirectory, "nested");
    mkdirSync(treeDirectory);
    for (const directory of [
      fixture.projectRoot,
      path.join(fixture.projectRoot, ".git"),
      path.join(fixture.projectRoot, ".git", "objects"),
      worktrees,
      paths.adminDirectory,
      fixture.workspaceRoot,
      paths.targetDirectory,
      treeDirectory,
    ]) {
      await assertCwdAnchorPreventsRename(directory);
    }
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("the production capability probe fails closed before target, admin, or registration mutation", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-cap-refusal");
  try {
    const request = workspaceRequest(fixture, "create");
    const paths = workspacePaths(fixture, request);
    const worktrees = path.dirname(paths.adminDirectory);
    mkdirSync(worktrees);
    const probe = workspaceCapabilityProbePaths(worktrees, request);
    mkdirSync(probe.destination);
    const before = fixtureScopeDigest(fixture);
    const inventoryBefore = git(fixture, ["worktree", "list", "--porcelain", "-z"]);

    const result = fixture.adapter.create(request);
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "conflict");
    assert.equal(result.error.code, "capability_probe_conflict");
    assert.equal(existsSync(paths.targetDirectory), false);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(existsSync(probe.source), false);
    assert.equal(existsSync(probe.destination), true);
    assert.equal(git(fixture, ["worktree", "list", "--porcelain", "-z"]), inventoryBefore);
    assert.equal(fixtureScopeDigest(fixture), before);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("an upstream namespace effect is never discarded after a later capability refusal", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-effect-propagation");
  try {
    const request = workspaceRequest(fixture, "create");
    const paths = workspacePaths(fixture, request);
    const workspaceParent = path.dirname(paths.targetDirectory);
    mkdirSync(workspaceParent);
    const probe = workspaceCapabilityProbePaths(workspaceParent, request);
    mkdirSync(probe.destination);
    const inventoryBefore = git(fixture, ["worktree", "list", "--porcelain", "-z"]);

    const result = fixture.adapter.create(request);
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "ambiguous_external_state");
    assert.equal(result.error.code, "capability_probe_conflict");
    assert.equal(existsSync(path.dirname(paths.adminDirectory)), true);
    assert.deepEqual(readdirSync(path.dirname(paths.adminDirectory)), []);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(existsSync(paths.targetDirectory), false);
    assert.equal(existsSync(probe.source), false);
    assert.equal(existsSync(probe.destination), true);
    assert.equal(git(fixture, ["worktree", "list", "--porcelain", "-z"]), inventoryBefore);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("workspace target paths accept 239 and 240 UTF-16 code units and refuse 241 before mutation", windowsOnly, () => {
  for (const [delta, generation, binding] of [[-1, 7, "A"], [0, 10, "B"], [1, 11, "C"]]) {
    const fixture = createWorkspaceGitFixture(`workspace-git-target-bound-${delta + 1}`);
    try {
      const baseReference = emptyCommit(fixture, `target-bound-${delta + 1}`);
      const template = workspaceRequest(fixture, "create", {
        subject: { baseReference, generation, ownershipBindingSha256: binding.repeat(64) },
      });
      const suffixLength = workspacePaths(fixture, template).targetDirectory.length - fixture.workspaceRoot.length;
      const workspaceRoot = exactLengthChildPath(
        fixture.generation,
        240 + delta - suffixLength,
        `target-root-${delta + 1}-`,
      );
      mkdirSync(workspaceRoot);
      const scoped = { ...fixture, workspaceRoot };
      const adapter = configuredAdapter(scoped);
      const request = workspaceRequest(scoped, "create", {
        subject: { baseReference, generation, ownershipBindingSha256: binding.repeat(64) },
      });
      const paths = workspacePaths(scoped, request);
      assert.equal(paths.targetDirectory.length, 240 + delta);
      assert.match(paths.targetDirectory, new RegExp(`-g${generation}$`, "u"));
      const before = fixtureScopeDigest(fixture);
      const inventoryBefore = git(fixture, ["worktree", "list", "--porcelain", "-z"]);
      const result = adapter.create(request);
      if (delta <= 0) {
        assert.equal(result.ok, true, result.ok ? undefined : result.error.code);
        assert.equal(result.receipt.canonicalPath, paths.targetDirectory);
        assert.equal(result.receipt.inventory.trackedCount, 0);
      } else {
        assert.equal(result.ok, false);
        assert.equal(result.error.category, "permanent_external");
        assert.equal(result.error.code, "workspace_target_too_long");
        assert.equal(existsSync(paths.targetDirectory), false);
        assert.equal(existsSync(paths.adminDirectory), false);
        assert.equal(git(fixture, ["worktree", "list", "--porcelain", "-z"]), inventoryBefore);
        assert.equal(fixtureScopeDigest(fixture), before);
      }
    } finally {
      cleanupWorkspaceGitFixture(fixture);
    }
  }
});

test("linked-admin paths accept 239 and 240 UTF-16 code units and refuse 241 before mutation", windowsOnly, () => {
  for (const [delta, binding] of [[-1, "D"], [0, "E"], [1, "F"]]) {
    const fixture = createWorkspaceGitFixture(`workspace-git-admin-bound-${delta + 1}`);
    try {
      const baseReference = emptyCommit(fixture, `admin-bound-${delta + 1}`);
      const template = workspaceRequest(fixture, "create", {
        subject: { baseReference, ownershipBindingSha256: binding.repeat(64) },
      });
      const suffixLength = workspacePaths(fixture, template).adminDirectory.length - fixture.projectRoot.length;
      const projectRoot = exactLengthChildPath(
        fixture.generation,
        240 + delta - suffixLength,
        `project-root-${delta + 1}-`,
      );
      renameSync(fixture.projectRoot, projectRoot);
      const scoped = { ...fixture, projectRoot };
      const adapter = configuredAdapter(scoped);
      const request = workspaceRequest(scoped, "create", {
        subject: { baseReference, ownershipBindingSha256: binding.repeat(64) },
      });
      const paths = workspacePaths(scoped, request);
      assert.equal(paths.adminDirectory.length, 240 + delta);
      const before = fixtureScopeDigest(fixture);
      const inventoryBefore = git(scoped, ["worktree", "list", "--porcelain", "-z"]);
      const result = adapter.create(request);
      if (delta <= 0) {
        assert.equal(result.ok, true, result.ok ? undefined : result.error.code);
        assert.equal(result.receipt.canonicalPath, paths.targetDirectory);
        assert.equal(result.receipt.inventory.trackedCount, 0);
      } else {
        assert.equal(result.ok, false);
        assert.equal(result.error.category, "permanent_external");
        assert.equal(result.error.code, "workspace_admin_too_long");
        assert.equal(existsSync(paths.targetDirectory), false);
        assert.equal(existsSync(paths.adminDirectory), false);
        assert.equal(git(scoped, ["worktree", "list", "--porcelain", "-z"]), inventoryBefore);
        assert.equal(fixtureScopeDigest(fixture), before);
      }
    } finally {
      cleanupWorkspaceGitFixture(fixture);
    }
  }
});

test("unknown exact root mappings fail before repository access", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-path-root-key");
  try {
    for (const subject of [
      { projectRootKey: "unknown-project" },
      { workspaceRootKey: "unknown-workspace" },
    ]) {
      const result = fixture.adapter.reserve(workspaceRequest(fixture, "reserve", { subject }));
      assert.equal(result.ok, false);
      assert.equal(result.error.category, "not_found");
      assert.equal(result.error.code, "trusted_root_key_unknown");
    }
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("a pre-existing foreign target is classified without adoption or overwrite", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-path-foreign-target");
  try {
    const request = workspaceRequest(fixture, "create");
    const paths = workspacePaths(fixture, request);
    mkdirSync(path.dirname(paths.targetDirectory));
    mkdirSync(paths.targetDirectory);
    const sentinel = path.join(paths.targetDirectory, "foreign.txt");
    writeFileSync(sentinel, "foreign sentinel\n", { flag: "wx" });

    const before = readFileSync(sentinel, "utf8");
    const created = fixture.adapter.create(request);
    assert.equal(created.ok, false);
    assert.equal(created.error.category, "ambiguous_external_state");
    assert.equal(created.error.code, "workspace_state_unprovable");
    assert.equal(readFileSync(sentinel, "utf8"), before);

    const inspected = fixture.adapter.inspect(workspaceRequest(fixture, "inspect"));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.code, "inspected_partial");
    assert.equal(inspected.receipt.ownershipMatch, null);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("a pre-existing linked administration leaf is never adopted or overwritten", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-path-foreign-admin");
  try {
    const request = workspaceRequest(fixture, "create");
    const paths = workspacePaths(fixture, request);
    mkdirSync(path.dirname(paths.adminDirectory), { recursive: true });
    mkdirSync(paths.adminDirectory);
    const sentinel = path.join(paths.adminDirectory, "foreign.txt");
    writeFileSync(sentinel, "foreign admin sentinel\n", { flag: "wx" });

    const result = fixture.adapter.create(request);
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "ambiguous_external_state");
    assert.equal(result.error.code, "workspace_state_unprovable");
    assert.equal(readFileSync(sentinel, "utf8"), "foreign admin sentinel\n");
    assert.deepEqual(readdirSync(paths.adminDirectory), ["foreign.txt"]);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("physical manifest is canonical, bounded, and bound to the durable ownership digest", windowsOnly, () => {
  const context = createComplete("workspace-git-ownership-manifest");
  try {
    const bytes = readFileSync(context.paths.manifestPath, "utf8");
    assert.equal(bytes.endsWith("\n"), true);
    assert.equal(bytes.length < 16 * 1024, true);
    const manifest = JSON.parse(bytes);
    assert.deepEqual(Object.keys(manifest), [...Object.keys(manifest)].sort());
    assert.equal(manifest.schema, "ato.workspace-ownership/v1");
    assert.equal(manifest.ownershipBindingSha256, context.fixture.ownershipBindingSha256);
    assert.equal(manifest.registrationIdentity, context.result.receipt.registrationIdentity);
    assert.equal(manifest.baseObjectId, context.fixture.baseObjectId);
    assert.match(manifest.workspaceRootIdentitySha256, /^sha256:[0-9A-F]{64}$/u);
    assert.equal(bytes.includes("private"), false);
    assert.equal(bytes.includes("credential"), false);
  } finally {
    cleanupWorkspaceGitFixture(context.fixture);
  }
});

test("a substituted durable binding cannot adopt an existing generation", windowsOnly, () => {
  const context = createComplete("workspace-git-ownership-binding");
  try {
    const substituted = "F".repeat(64);
    assert.notEqual(substituted, context.fixture.ownershipBindingSha256);
    const inspected = context.fixture.adapter.inspect(workspaceRequest(context.fixture, "inspect", {
      subject: { ownershipBindingSha256: substituted },
    }));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.code, "inspected_partial");
    assert.equal(inspected.receipt.ownershipMatch, null);
  } finally {
    cleanupWorkspaceGitFixture(context.fixture);
  }
});

for (const corruption of ["truncated", "extra-field", "hardlink"]) {
  test(`a ${corruption} final manifest remains partial and is never repaired`, windowsOnly, () => {
    const context = createComplete(corruption === "hardlink" ? "workspace-git-manifest-link" : `workspace-git-ownership-${corruption}`);
    try {
      const original = readFileSync(context.paths.manifestPath);
      if (corruption === "truncated") {
        writeFileSync(context.paths.manifestPath, original.subarray(0, Math.max(1, original.length - 8)));
      } else if (corruption === "hardlink") {
        const displaced = path.join(context.fixture.generation, "displaced-manifest.json");
        renameSync(context.paths.manifestPath, displaced);
        linkSync(displaced, context.paths.manifestPath);
      } else {
        const value = JSON.parse(original.toString("utf8"));
        writeFileSync(context.paths.manifestPath, `${JSON.stringify({ ...value, unexpected: true })}\n`);
      }
      const corrupted = readFileSync(context.paths.manifestPath);
      const recovered = context.fixture.adapter.recover(workspaceRequest(context.fixture, "recover"));
      assert.equal(recovered.ok, true);
      assert.equal(recovered.receipt.code, "partial");
      assert.deepEqual(readFileSync(context.paths.manifestPath), corrupted);
      const retried = context.fixture.adapter.create(context.request);
      assert.equal(retried.ok, false);
      assert.equal(retried.error.category, "ambiguous_external_state");
      assert.deepEqual(readFileSync(context.paths.manifestPath), corrupted);
    } finally {
      cleanupWorkspaceGitFixture(context.fixture);
    }
  });
}

test("same-path registration rebuilt around a new target identity is never accepted", windowsOnly, () => {
  const context = createComplete("workspace-git-ownership-rebuilt");
  try {
    const displaced = `${context.paths.targetDirectory}-displaced`;
    renameSync(context.paths.targetDirectory, displaced);
    mkdirSync(context.paths.targetDirectory);
    writeFileSync(
      path.join(context.paths.targetDirectory, ".git"),
      `gitdir: ${context.paths.adminDirectory.replaceAll("\\", "/")}\n`,
      { flag: "wx" },
    );
    const inspected = context.fixture.adapter.inspect(workspaceRequest(context.fixture, "inspect"));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.code, "inspected_partial");
    assert.equal(inspected.receipt.registrationIdentity, null);
  } finally {
    cleanupWorkspaceGitFixture(context.fixture);
  }
});

for (const corruption of ["tracked-file-hardlink", "tracked-directory-junction"]) {
  test(`${corruption} replacement remains partial even when bytes are unchanged`, windowsOnly, () => {
    const context = createComplete(
      corruption === "tracked-file-hardlink" ? "workspace-git-file-link" : "workspace-git-dir-junction",
    );
    try {
      let sentinel;
      let expected;
      if (corruption === "tracked-file-hardlink") {
        const tracked = path.join(context.paths.targetDirectory, "README.txt");
        sentinel = path.join(context.fixture.generation, "displaced-readme.txt");
        renameSync(tracked, sentinel);
        expected = readFileSync(sentinel);
        linkSync(sentinel, tracked);
      } else {
        const tracked = path.join(context.paths.targetDirectory, "nested");
        const displaced = path.join(context.fixture.generation, "displaced-nested");
        renameSync(tracked, displaced);
        sentinel = path.join(displaced, "data.bin");
        expected = readFileSync(sentinel);
        symlinkSync(displaced, tracked, "junction");
      }
      const inspected = context.fixture.adapter.inspect(workspaceRequest(context.fixture, "inspect"));
      assert.equal(inspected.ok, true);
      assert.equal(inspected.receipt.code, "inspected_partial");
      assert.equal(inspected.receipt.registrationIdentity, null);
      assert.deepEqual(readFileSync(sentinel), expected);
    } finally {
      cleanupWorkspaceGitFixture(context.fixture);
    }
  });
}

test("an unchanged-byte hardlinked linked-admin index is inspected as partial without mutation", windowsOnly, () => {
  const context = createComplete("workspace-git-index-hardlink");
  try {
    const index = path.join(context.paths.adminDirectory, "index");
    const displaced = path.join(context.fixture.generation, "displaced-index");
    renameSync(index, displaced);
    const expected = readFileSync(displaced);
    linkSync(displaced, index);
    const before = fixtureScopeDigest(context.fixture);

    const inspected = context.fixture.adapter.inspect(workspaceRequest(context.fixture, "inspect"));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.code, "inspected_partial");
    assert.equal(inspected.receipt.registrationIdentity, null);
    assert.deepEqual(readFileSync(index), expected);
    assert.deepEqual(readFileSync(displaced), expected);
    assert.equal(fixtureScopeDigest(context.fixture), before);
  } finally {
    cleanupWorkspaceGitFixture(context.fixture);
  }
});

test("every dynamically acquired directory guard carries and verifies the parent-observed identity", () => {
  const source = readFileSync(new URL("../src/workspace-git-adapter.ts", import.meta.url), "utf8");
  assert.match(source, /function assertPayloadGuard/gu);
  assert.match(source, /guardIdentity: worktrees\.identity/gu);
  assert.match(source, /guardIdentity: admin\.identity/gu);
  assert.match(source, /guardIdentity: next\.identity/gu);
  assert.match(source, /guardIdentity: targetIdentity/gu);
  assert.equal((source.match(/assertPayloadGuard\(/gu) ?? []).length >= 5, true);
});
