import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createOwnedGeneration,
  createOwnedGenerationAt,
  inventoryTree,
  isForbiddenRepositoryPath,
  removeOwnedGeneration,
  repositoryInventoryFailures,
  tempRoot,
} from "../scripts/repo-utils.mjs";

function assertNoOwnedPrefix(prefix) {
  if (!existsSync(tempRoot)) return;
  assert.equal(readdirSync(tempRoot).some((name) => name.startsWith(`${prefix}-`)), false);
}

test("owned cleanup unlinks an internal Windows junction without following it", { skip: process.platform !== "win32" }, () => {
  const generation = createOwnedGeneration("cleanup-internal");
  const target = path.join(generation, "target");
  const junction = path.join(generation, "junction");
  mkdirSync(target);
  symlinkSync(target, junction, "junction");
  assert.equal(realpathSync(junction), realpathSync(target));
  assert(inventoryTree(generation).includes(junction));
  removeOwnedGeneration(generation);
  assert.equal(existsSync(generation), false);
  assertNoOwnedPrefix("cleanup-internal");
});

test("owned cleanup refuses a junction into another generation", { skip: process.platform !== "win32" }, () => {
  const targetGeneration = createOwnedGeneration("cleanup-target");
  const generation = createOwnedGeneration("cleanup-external");
  const target = path.join(targetGeneration, "target");
  const junction = path.join(generation, "junction");
  mkdirSync(target);
  symlinkSync(target, junction, "junction");
  assert.throws(() => removeOwnedGeneration(generation), /outside owned generation/u);
  assert.equal(existsSync(generation), true);
  assert.equal(existsSync(target), true);
  unlinkSync(junction);
  removeOwnedGeneration(generation);
  removeOwnedGeneration(targetGeneration);
  assertNoOwnedPrefix("cleanup-external");
  assertNoOwnedPrefix("cleanup-target");
});

test("repository inventory policy rejects runtime, secret, coverage, and reparse shapes", { skip: process.platform !== "win32" }, () => {
  for (const relative of [
    "primary.sqlite3-wal",
    "primary.sqlite3-shm",
    "backups/current.bin",
    "runtime/state.bin",
    "logs/trace.txt",
    "secrets/token.txt",
    ".env.production",
    "coverage/lcov.info",
  ]) {
    assert.equal(isForbiddenRepositoryPath(relative), true, relative);
  }
  assert.equal(isForbiddenRepositoryPath("docs/feasibility/toolchain.md"), false);

  const generation = createOwnedGeneration("inventory-reparse");
  const target = path.join(generation, "target");
  const junction = path.join(generation, "junction");
  mkdirSync(target);
  symlinkSync(target, junction, "junction");
  assert.match(repositoryInventoryFailures(["junction/member.txt"], generation).join("\n"), /reparse\/symlink/u);
  removeOwnedGeneration(generation);
});

test("generation creation refuses a pre-existing temp-root junction before target mutation", { skip: process.platform !== "win32" }, () => {
  const generation = createOwnedGeneration("temp-root-guard");
  const target = path.join(generation, "target");
  const junction = path.join(generation, "temp-root-junction");
  mkdirSync(target);
  symlinkSync(target, junction, "junction");
  assert.deepEqual(readdirSync(target), []);
  assert.throws(() => createOwnedGenerationAt(junction, "escaped"), /temp root is a reparse point/u);
  assert.deepEqual(readdirSync(target), []);
  removeOwnedGeneration(generation);
});
