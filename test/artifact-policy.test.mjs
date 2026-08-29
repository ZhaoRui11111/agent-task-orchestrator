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
