import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  cleanupWorkspaceGitFixture,
  createWorkspaceGitFixture,
  git,
  workspacePaths,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

const windowsOnly = { skip: process.platform !== "win32" };

function rawCommit(fixture, entries, label) {
  const input = `${entries
    .map(({ mode, objectId, name }) => {
      const type = mode === "160000" ? "commit" : mode === "040000" ? "tree" : "blob";
      return `${mode} ${type} ${objectId}\t${name}\0`;
    })
    .join("")}`;
  const tree = git(fixture, ["mktree", "-z"], { input }).trim();
  return git(fixture, [
    "-c", "user.name=ato-fixture",
    "-c", "user.email=ato-fixture.invalid",
    "commit-tree", tree, "-p", fixture.baseObjectId, "-m", label,
  ]).trim();
}

function reserveAt(fixture, baseReference) {
  return fixture.adapter.reserve(workspaceRequest(fixture, "reserve", { subject: { baseReference } }));
}

test("adapter source keeps closed non-shell Git and worker invocation templates", () => {
  const source = readFileSync(new URL("../src/workspace-git-adapter.ts", import.meta.url), "utf8");
  assert.equal(source.includes("shell: true"), false);
  assert.equal(source.includes("execSync("), false);
  assert.equal(source.includes("execFileSync("), false);
  assert.equal(source.includes('["worktree", "add"'), false);
  assert.equal(source.includes('["checkout"'), false);
  assert.match(source, /shell: false/gu);
  assert.match(source, /GIT_TERMINAL_PROMPT/gu);
  assert.match(source, /GIT_NO_REPLACE_OBJECTS/gu);
  assert.match(source, /core\.hooksPath=NUL/gu);
  assert.match(source, /credential\.helper=/gu);
  assert.match(source, /git version 2\.53\.0\.windows\.1/gu);
  assert.match(source, /EXPECTED_NODE_VERSION = "24\.19\.0"/gu);
  assert.match(source, /segment\.length > MAX_CHILD_NAME_LENGTH/gu);
  assert.match(source, /value\.length <= MAX_CHILD_NAME_LENGTH/gu);
});

test("importing the adapter with worker-like arguments has no worker side effect", () => {
  const moduleUrl = new URL("../src/workspace-git-adapter.ts", import.meta.url).href;
  const script = [
    'process.argv[1] = "unrelated-import-host.mjs";',
    'process.argv[2] = "--ato-workspace-worker";',
    `await import(${JSON.stringify(moduleUrl)});`,
    'process.stdout.write("import-ok");',
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 4096,
    windowsHide: true,
    shell: false,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "import-ok");
});

test("hostile and symbolic base references never reach a Git mutation", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-command-base");
  try {
    for (const baseReference of ["HEAD", "main", `${fixture.baseObjectId};checkout`, fixture.baseObjectId.toUpperCase()]) {
      const result = fixture.adapter.create(workspaceRequest(fixture, "create", {
        subject: { baseReference },
      }));
      assert.equal(result.ok, false);
      assert.equal(result.error.category, "invalid_request");
      assert.equal(result.error.code, "base_object_id_invalid");
    }
    assert.equal(git(fixture, ["worktree", "list", "--porcelain", "-z"]).includes("ato-workspaces"), false);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("repository-controlled checkout extensions and remote configuration are refused", windowsOnly, () => {
  const attributes = createWorkspaceGitFixture("workspace-git-command-attributes");
  try {
    writeFileSync(path.join(attributes.projectRoot, ".gitattributes"), "* filter=hostile\n", { flag: "wx" });
    git(attributes, ["add", "--", ".gitattributes"]);
    git(attributes, [
      "-c", "user.name=ato-fixture",
      "-c", "user.email=ato-fixture.invalid",
      "commit", "--quiet", "-m", "attributes",
    ]);
    const baseObjectId = git(attributes, ["rev-parse", "HEAD"]).trim();
    const result = attributes.adapter.reserve(workspaceRequest(attributes, "reserve", {
      subject: { baseReference: baseObjectId },
    }));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "repository_checkout_extensions_refused");
  } finally {
    cleanupWorkspaceGitFixture(attributes);
  }

  const infoAttributes = createWorkspaceGitFixture("workspace-git-command-info-attributes");
  try {
    writeFileSync(path.join(infoAttributes.projectRoot, ".git", "info", "attributes"), "* filter=hostile\n", {
      flag: "wx",
    });
    const result = infoAttributes.adapter.reserve(workspaceRequest(infoAttributes, "reserve"));
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "permanent_external");
    assert.equal(result.error.code, "repository_checkout_extensions_refused");
  } finally {
    cleanupWorkspaceGitFixture(infoAttributes);
  }

  const remote = createWorkspaceGitFixture("workspace-git-command-remote");
  try {
    git(remote, ["remote", "add", "origin", "https://credential.invalid/repository.git"]);
    const result = remote.adapter.reserve(workspaceRequest(remote, "reserve"));
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "permanent_external");
    assert.equal(result.error.code, "unsupported_repository_config");
  } finally {
    cleanupWorkspaceGitFixture(remote);
  }
});

test("an object-store descendant junction is refused before registration", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-object-junction");
  try {
    const objectDirectory = path.join(fixture.projectRoot, ".git", "objects");
    const outside = path.join(fixture.generation, "object-directory-outside");
    mkdirSync(outside);
    const sentinel = path.join(outside, "sentinel.txt");
    writeFileSync(sentinel, "object directory sentinel\n", { flag: "wx" });
    const fanout = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"))
      .find((name) => !existsSync(path.join(objectDirectory, name)));
    assert.notEqual(fanout, undefined);
    symlinkSync(outside, path.join(objectDirectory, fanout), "junction");
    const request = workspaceRequest(fixture, "reserve");
    const paths = workspacePaths(fixture, request);
    const inventoryBefore = git(fixture, ["worktree", "list", "--porcelain", "-z"]);
    const sentinelBefore = readFileSync(sentinel);
    const result = fixture.adapter.reserve(request);
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "permanent_external");
    assert.equal(result.error.code, "external_object_store_refused");
    assert.deepEqual(readFileSync(sentinel), sentinelBefore);
    assert.equal(existsSync(paths.targetDirectory), false);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(git(fixture, ["worktree", "list", "--porcelain", "-z"]), inventoryBefore);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("alternate object stores are refused before any object resolution", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-command-alternates");
  try {
    const info = path.join(fixture.projectRoot, ".git", "objects", "info");
    mkdirSync(info, { recursive: true });
    writeFileSync(path.join(info, "alternates"), `${fixture.workspaceRoot}\n`, { flag: "wx" });
    const result = reserveAt(fixture, fixture.baseObjectId);
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "permanent_external");
    assert.equal(result.error.code, "alternate_object_store_refused");
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("gitfile, bare, promisor, and replacement-object repository topologies are refused", windowsOnly, () => {
  const cases = [
    {
      label: "gitfile",
      mutate(fixture) {
        const common = path.join(fixture.projectRoot, ".git");
        const displaced = path.join(fixture.projectRoot, ".git-real");
        renameSync(common, displaced);
        writeFileSync(common, "gitdir: .git-real\n", { flag: "wx" });
      },
      category: "conflict",
      code: "unsafe_path_component",
    },
    {
      label: "bare",
      mutate(fixture) {
        git(fixture, ["config", "core.bare", "true"]);
      },
      category: "permanent_external",
      code: "bare_repository_refused",
    },
    {
      label: "promisor",
      mutate(fixture) {
        const packDirectory = path.join(fixture.projectRoot, ".git", "objects", "pack");
        mkdirSync(packDirectory, { recursive: true });
        writeFileSync(path.join(packDirectory, "pack-test.promisor"), "promisor\n", { flag: "wx" });
      },
      category: "permanent_external",
      code: "promisor_object_store_refused",
    },
    {
      label: "replacement",
      mutate(fixture) {
        mkdirSync(path.join(fixture.projectRoot, ".git", "refs", "replace"), { recursive: true });
      },
      category: "permanent_external",
      code: "replacement_objects_refused",
    },
  ];
  for (const candidate of cases) {
    const fixture = createWorkspaceGitFixture(`workspace-git-${candidate.label}`);
    try {
      candidate.mutate(fixture);
      const request = workspaceRequest(fixture, "reserve");
      const paths = workspacePaths(fixture, request);
      const result = fixture.adapter.reserve(request);
      assert.equal(result.ok, false, candidate.label);
      assert.equal(result.error.category, candidate.category, candidate.label);
      assert.equal(result.error.code, candidate.code, candidate.label);
      assert.equal(existsSync(paths.targetDirectory), false, candidate.label);
      assert.equal(existsSync(paths.adminDirectory), false, candidate.label);
    } finally {
      cleanupWorkspaceGitFixture(fixture);
    }
  }
});

test("symlink, gitlink, Windows-unsafe, and case-colliding trees are refused", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-command-tree-kinds");
  try {
    const blob = git(fixture, ["rev-parse", `${fixture.baseObjectId}:README.txt`]).trim();
    const cases = [
      {
        label: "symlink",
        entries: [{ mode: "120000", objectId: blob, name: "link" }],
        code: "unsupported_tree_entry",
      },
      {
        label: "gitlink",
        entries: [{ mode: "160000", objectId: fixture.baseObjectId, name: "submodule" }],
        code: "unsupported_tree_entry",
      },
      {
        label: "reserved-name",
        entries: [{ mode: "100644", objectId: blob, name: "CON.txt" }],
        code: "unsafe_tree_path",
      },
      {
        label: "alternate-data-stream",
        entries: [{ mode: "100644", objectId: blob, name: "file:stream" }],
        code: "unsafe_tree_path",
      },
      {
        label: "overlong-segment",
        entries: [{ mode: "100644", objectId: blob, name: "n".repeat(97) }],
        code: "unsafe_tree_path",
      },
      {
        label: "case-collision",
        entries: [
          { mode: "100644", objectId: blob, name: "Case.txt" },
          { mode: "100644", objectId: blob, name: "case.txt" },
        ],
        code: "case_colliding_tree",
      },
    ];
    for (const candidate of cases) {
      const commit = rawCommit(fixture, candidate.entries, candidate.label);
      const result = reserveAt(fixture, commit);
      assert.equal(result.ok, false, candidate.label);
      assert.equal(result.error.category, "permanent_external", candidate.label);
      assert.equal(result.error.code, candidate.code, candidate.label);
    }
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("directory-only case collisions are refused before any workspace registration mutation", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-command-directory-case");
  try {
    const blob = git(fixture, ["rev-parse", `${fixture.baseObjectId}:README.txt`]).trim();
    const upperTree = git(fixture, ["mktree", "-z"], {
      input: `100644 blob ${blob}\ta.txt\0`,
    }).trim();
    const lowerTree = git(fixture, ["mktree", "-z"], {
      input: `100644 blob ${blob}\tb.txt\0`,
    }).trim();
    const commit = rawCommit(fixture, [
      { mode: "040000", objectId: upperTree, name: "Dir" },
      { mode: "040000", objectId: lowerTree, name: "dir" },
    ], "directory-case-collision");
    const request = workspaceRequest(fixture, "create", { subject: { baseReference: commit } });
    const paths = workspacePaths(fixture, request);
    const before = readFileSync(path.join(fixture.projectRoot, ".git", "config"));
    const inventoryBefore = git(fixture, ["worktree", "list", "--porcelain", "-z"]);

    const result = fixture.adapter.create(request);
    assert.equal(result.ok, false);
    assert.equal(result.error.category, "permanent_external");
    assert.equal(result.error.code, "case_colliding_tree");
    assert.equal(existsSync(paths.targetDirectory), false);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(existsSync(path.dirname(paths.adminDirectory)), false);
    assert.equal(git(fixture, ["worktree", "list", "--porcelain", "-z"]), inventoryBefore);
    assert.deepEqual(readFileSync(path.join(fixture.projectRoot, ".git", "config")), before);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("tree entry and byte limits fail closed before registration", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-command-tree-limits");
  try {
    const blob = git(fixture, ["rev-parse", `${fixture.baseObjectId}:README.txt`]).trim();
    const manyEntries = Array.from({ length: 257 }, (_, index) => ({
      mode: "100644",
      objectId: blob,
      name: `entry-${String(index).padStart(3, "0")}.txt`,
    }));
    const manyCommit = rawCommit(fixture, manyEntries, "too-many-entries");
    const many = reserveAt(fixture, manyCommit);
    assert.equal(many.ok, false);
    assert.equal(many.error.category, "resource_exhausted");
    assert.equal(many.error.code, "tree_entry_limit");

    const oversizedBlob = git(fixture, ["hash-object", "-w", "--stdin"], {
      input: Buffer.alloc(8 * 1024 * 1024 + 1, 0x41),
    }).trim();
    const oversizedCommit = rawCommit(fixture, [
      { mode: "100644", objectId: oversizedBlob, name: "oversized.bin" },
    ], "oversized-tree");
    const oversized = reserveAt(fixture, oversizedCommit);
    assert.equal(oversized.ok, false);
    assert.equal(oversized.error.category, "resource_exhausted");
    assert.equal(oversized.error.code, "tree_byte_limit");
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});
