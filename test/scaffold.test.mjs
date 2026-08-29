import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getScaffoldStatus } from "../src/index.ts";
import {
  EXPECTED_MIGRATION_FILES,
  EXPECTED_PRODUCTION_SOURCE_FILES,
  gitInventory,
  productionBoundaryFailures,
  repoRoot,
} from "../scripts/repo-utils.mjs";

test("package status exposes the persistence foundation without overstating the product runtime", () => {
  assert.deepEqual(getScaffoldStatus(), {
    packageName: "agent-task-orchestrator",
    phase: "persistence-foundation",
    domainCoreImplemented: true,
    persistenceFoundationImplemented: true,
    applicationServiceImplemented: false,
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
  const inventory = gitInventory();
  assert.deepEqual(inventory.filter((item) => item.startsWith("src/")), EXPECTED_PRODUCTION_SOURCE_FILES);
  assert.deepEqual(inventory.filter((item) => item.startsWith("migrations/")), EXPECTED_MIGRATION_FILES);
  assert.deepEqual(
    productionBoundaryFailures(inventory, (relative) => readFileSync(path.join(repoRoot, relative), "utf8")),
    [],
  );
  assert.match(
    productionBoundaryFailures(
      inventory.filter((item) => item !== EXPECTED_MIGRATION_FILES[1]),
      (relative) => readFileSync(path.join(repoRoot, relative), "utf8"),
    ).join("\n"),
    /migration inventory drifted/u,
  );
  assert.match(
    productionBoundaryFailures(inventory, (relative) =>
      relative === "src/domain.ts" ? 'import "node:fs";\n' : readFileSync(path.join(repoRoot, relative), "utf8"),
    ).join("\n"),
    /built-in escaped the persistence owner boundary/u,
  );
});
