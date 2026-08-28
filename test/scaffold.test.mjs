import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getScaffoldStatus } from "../src/index.ts";
import { gitInventory, repoRoot } from "../scripts/repo-utils.mjs";

test("package status exposes Domain Core without overstating the product runtime", () => {
  assert.deepEqual(getScaffoldStatus(), {
    packageName: "agent-task-orchestrator",
    phase: "domain-core",
    domainCoreImplemented: true,
    productRuntimeImplemented: false,
    supportedAdapters: [],
  });
  assert.equal(Object.isFrozen(getScaffoldStatus()), true);
  assert.equal(Object.isFrozen(getScaffoldStatus().supportedAdapters), true);
});

test("source console entry emits the same truthful status", () => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "src", "cli.ts")], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), getScaffoldStatus());
});

test("package metadata exposes only the normal export and console boundary", () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, "module");
  assert.deepEqual(Object.keys(packageJson.exports), ["."]);
  assert.deepEqual(Object.keys(packageJson.bin), ["ato"]);
  assert.equal(packageJson.dependencies, undefined);
  assert.deepEqual(gitInventory().filter((item) => item.startsWith("src/")), [
    "src/cli.ts",
    "src/domain.ts",
    "src/index.ts",
  ]);
});
