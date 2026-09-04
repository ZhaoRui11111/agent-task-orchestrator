import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  EXPECTED_MIGRATION_FILES,
  EXPECTED_PRODUCTION_SOURCE_FILES,
  gitInventory,
  productionBoundaryFailures,
  repoRoot,
} from "../scripts/repo-utils.mjs";

test("source console entry exposes the versioned CLI through the operational package surface", () => {
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

test("package metadata and tracked inventory expose only the normal package boundary", () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, "module");
  assert.deepEqual(Object.keys(packageJson.exports), ["."]);
  assert.deepEqual(Object.keys(packageJson.bin), ["ato"]);
  assert.deepEqual(packageJson.dependencies, { "@openai/codex-sdk": "0.153.2" });
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
