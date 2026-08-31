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

test("package status exposes only the local explicit-Manual Phase 2 product runtime", () => {
  assert.deepEqual(getScaffoldStatus(), {
    packageName: "agent-task-orchestrator",
    phase: "phase2-local-manual-product",
    domainCoreImplemented: true,
    persistenceFoundationImplemented: true,
    projectRegistryImplemented: true,
    runtimeAuthorizationImplemented: true,
    applicationServiceImplemented: true,
    localPhase1ProductCliImplemented: true,
    localPhase2ProductCliImplemented: true,
    backupRestoreDoctorImplemented: true,
    durableExecutionClaimFoundationImplemented: true,
    reliableManualExecutionLoopImplemented: true,
    reconcileFirstManualDispatcherImplemented: true,
    productRuntimeImplemented: true,
    executionRuntimeImplemented: true,
    supportedAdapters: ["manual-local"],
  });
  assert.equal(Object.isFrozen(getScaffoldStatus()), true);
  assert.equal(Object.isFrozen(getScaffoldStatus().supportedAdapters), true);
});

test("source console entry exposes the versioned CLI instead of the legacy status dump", () => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "src", "cli.ts")], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    'ERROR unknown code="CLI_INVALID_INPUT" message="The command input is invalid."\n',
  );
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
      inventory.filter((item) => item !== EXPECTED_MIGRATION_FILES[0]),
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
