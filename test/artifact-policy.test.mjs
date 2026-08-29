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
