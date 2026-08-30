import assert from "node:assert/strict";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { repoRoot, taskArtifactsRoot } from "../scripts/repo-utils.mjs";

const manifestRelative = ".codex/harness-git-flow.json";
const manifestPath = path.join(repoRoot, manifestRelative);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function git(args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

test("artifact manifest registers only the exact ignored task root", () => {
  const manifestStat = lstatSync(manifestPath);
  assert.equal(manifestStat.isFile(), true);
  assert.equal(manifestStat.isSymbolicLink(), false);
  assert.deepEqual(Object.keys(manifest), ["schema_version", "disposable_roots"]);
  assert.deepEqual(manifest, {
    schema_version: 1,
    disposable_roots: [".task-artifacts"],
  });
  assert.equal(taskArtifactsRoot, path.join(repoRoot, ".task-artifacts"));

  const ignored = git(["check-ignore", "--no-index", "--quiet", ".task-artifacts/sentinel"]);
  assert.equal(ignored.status, 0, ignored.stderr || ignored.stdout);
  const tracked = git(["ls-files", "-z", "--", ".task-artifacts"]);
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.equal(tracked.stdout, "");
});

test("current artifact consumers do not retain the EP-00B generation root", () => {
  for (const relative of [
    ".gitignore",
    "scripts/repo-utils.mjs",
    "scripts/package-smoke.mjs",
    "scripts/sqlite-feasibility.mjs",
  ]) {
    assert.doesNotMatch(readFileSync(path.join(repoRoot, relative), "utf8"), /\.ep00b-tmp/u, relative);
  }
  const sqliteRecord = readFileSync(path.join(repoRoot, "docs/feasibility/sqlite-windows.md"), "utf8");
  assert.match(sqliteRecord, /current procedure uses `\.task-artifacts\/`/u);
  assert.match(sqliteRecord, /historical `\.ep00b-tmp\/` location/u);
  assert.deepEqual(manifest.disposable_roots, [".task-artifacts"]);
});

test("workers keep the shared root while only quiescent fixed-path owners reclaim it", () => {
  const utilities = readFileSync(path.join(repoRoot, "scripts/repo-utils.mjs"), "utf8");
  const workerCleanup = utilities.slice(
    utilities.indexOf("export function removeOwnedGeneration"),
    utilities.indexOf("export function run("),
  );
  assert.doesNotMatch(workerCleanup, /reclaimEmptyTaskArtifactsRoot|rmdirSync\(taskArtifactsRoot\)/u);
  assert.match(utilities, /export function reclaimEmptyTaskArtifactsRoot/u);
  assert.match(utilities, /error\?\.code !== "EEXIST"/u);
  const generationIssue = utilities.slice(
    utilities.indexOf("function issueOwnedGenerationAt"),
    utilities.indexOf("export function artifactRootReclaimTestOptions"),
  );
  assert.ok(
    generationIssue.indexOf("inspectRegularDirectory(issuedPath") <
      generationIssue.indexOf("hooks.afterGenerationIssue"),
    "generation identity must be bound before the post-issue seam",
  );
  assert.match(generationIssue, /sameDirectoryIdentity\(issued, terminal\)/u);

  const runner = readFileSync(path.join(repoRoot, "scripts/test-runner.mjs"), "utf8");
  assert.match(runner, /!baseline\.exists[\s\S]*reclaimEmptyTaskArtifactsRoot/u);
  assert.match(runner, /pathIdentity\(artifactRoot\) === pathIdentity\(taskArtifactsRoot\)/u);
  assert.match(runner, /if \(status !== 0\)[\s\S]*return Object\.freeze/u);

  const packageSmoke = readFileSync(path.join(repoRoot, "scripts/package-smoke.mjs"), "utf8");
  assert.match(packageSmoke, /removeOwnedGeneration\(generation\);\s+reclaimEmptyTaskArtifactsRoot/u);
  assert.match(packageSmoke, /artifactRootReclaimTestOptions\(\)/u);

  const sqlite = readFileSync(path.join(repoRoot, "scripts/sqlite-feasibility.mjs"), "utf8");
  assert.match(sqlite, /removeOwnedGeneration\(generation\);\s+if \(!Object\.hasOwn\(process\.env, "NODE_TEST_CONTEXT"\)\)/u);
  assert.match(sqlite, /if \(!Object\.hasOwn\(process\.env, "NODE_TEST_CONTEXT"\)\) \{\s+reclaimEmptyTaskArtifactsRoot/u);
  assert.match(sqlite, /artifactRootReclaimTestOptions\(\)/u);

  const toolchain = readFileSync(path.join(repoRoot, "docs/reference/toolchain-contract.md"), "utf8");
  assert.match(toolchain, /A worker\s+removes only its owned child and never removes the shared root/u);
  assert.match(toolchain, /SQLite\s+process nested in any native Node test context removes its generation but\s+defers fixed-root contraction/u);
  assert.match(toolchain, /snapshot comparator itself is observation-only/u);
  assert.match(toolchain, /publishes no security or prune receipt/u);
});

test("repository authority grants exact prune while keeping coordinator cleanup separate", () => {
  const agents = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
  const workflow = readFileSync(path.join(repoRoot, "docs/reference/local-agent-git-flow.md"), "utf8");
  const governance = readFileSync(path.join(repoRoot, "docs/reference/repository-governance.md"), "utf8");
  const validation = readFileSync(path.join(repoRoot, "docs/reference/validation-policy.md"), "utf8");

  assert.match(agents, /two\s+narrow standing grants/u);
  assert.match(agents, /including for nonempty\s+`\.task-artifacts` scratch/u);
  assert.match(agents, /Neither grant authorizes coordinator `cleanup`/u);

  assert.match(workflow, /standing authorization for that exact pathless\s+`prune-artifacts` invocation/u);
  assert.match(
    workflow,
    /unlink an inventoried symlink or reparse alias inside that root without\s+traversing or deleting the alias target/u,
  );
  assert.match(workflow, /no receipt does not mean rollback/u);
  assert.match(workflow, /idempotently retries\s+the same frozen-root command/u);
  assert.match(workflow, /does not authorize a caller path[\s\S]*coordinator `cleanup`/u);
  assert.match(workflow, /observation-only hygiene assertion/u);
  assert.match(workflow, /path-based Node APIs do not give it\s+the coordinator's anchored no-follow guarantee/u);
  assert.match(workflow, /publishes no security or prune\s+receipt/u);

  assert.match(governance, /repository's two standing exceptions/u);
  assert.match(governance, /Neither grant authorizes coordinator `cleanup`/u);
  assert.match(
    governance,
    /mid-prune stop may\s+leave part of the exclusive artifact namespace removed without a receipt/u,
  );
  assert.match(validation, /native recursive discovery/u);
  assert.match(validation, /do not promote the wrapper to a security boundary/u);
  assert.match(validation, /coordinator anchored alias unlink/u);

  assert.deepEqual(manifest, {
    schema_version: 1,
    disposable_roots: [".task-artifacts"],
  });
});
