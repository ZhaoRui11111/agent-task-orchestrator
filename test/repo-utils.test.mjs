import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createOwnedGeneration,
  createOwnedGenerationAt,
  inventoryTree,
  isForbiddenRepositoryPath,
  removeOwnedGeneration,
  repositoryInventoryFailures,
  taskArtifactsRoot,
} from "../scripts/repo-utils.mjs";

function assertNoOwnedPrefix(prefix) {
  if (!existsSync(taskArtifactsRoot)) return;
  assert.equal(readdirSync(taskArtifactsRoot).some((name) => name.startsWith(`${prefix}-`)), false);
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

test("generation creation refuses a pre-existing artifact-root junction before target mutation", { skip: process.platform !== "win32" }, () => {
  const generation = createOwnedGeneration("artifact-root-guard");
  const target = path.join(generation, "target");
  const junction = path.join(generation, "artifact-root-junction");
  mkdirSync(target);
  symlinkSync(target, junction, "junction");
  assert.deepEqual(readdirSync(target), []);
  assert.throws(() => createOwnedGenerationAt(junction, "escaped"), /artifact root is a reparse point/u);
  assert.deepEqual(readdirSync(target), []);
  removeOwnedGeneration(generation);
});

test("owned cleanup refuses a direct child without a creator receipt", () => {
  const owner = createOwnedGeneration("receipt-owner");
  const unowned = path.join(taskArtifactsRoot, "unowned-direct-child");
  mkdirSync(unowned);
  assert.throws(() => removeOwnedGeneration(unowned), /no creator receipt/u);
  assert.equal(existsSync(unowned), true);
  rmdirSync(unowned);
  removeOwnedGeneration(owner);
  assertNoOwnedPrefix("receipt-owner");
});

test("owned cleanup refuses a post-inventory generation swap without deleting replacement bytes", () => {
  const generation = createOwnedGeneration("identity-swap");
  const displaced = `${generation}-displaced`;
  const ownedMarker = path.join(generation, "owned.txt");
  const replacementMarker = path.join(generation, "replacement.txt");
  writeFileSync(ownedMarker, "owned-generation", { encoding: "utf8", flag: "wx" });
  try {
    assert.throws(
      () =>
        removeOwnedGeneration(generation, {
          afterInventory() {
            renameSync(generation, displaced);
            mkdirSync(generation);
            writeFileSync(replacementMarker, "replacement-must-survive", { encoding: "utf8", flag: "wx" });
          },
        }),
      /owned generation (?:real path|identity) changed/u,
    );
    assert.equal(readFileSync(replacementMarker, "utf8"), "replacement-must-survive");
    assert.equal(readFileSync(path.join(displaced, "owned.txt"), "utf8"), "owned-generation");
  } finally {
    if (existsSync(replacementMarker)) unlinkSync(replacementMarker);
    if (existsSync(generation)) rmdirSync(generation);
    if (existsSync(displaced)) renameSync(displaced, generation);
    if (existsSync(generation)) removeOwnedGeneration(generation);
  }
  assertNoOwnedPrefix("identity-swap");
});

test("owned cleanup refuses a quarantined-generation swap without deleting replacement bytes", () => {
  const generation = createOwnedGeneration("quarantine-swap");
  const ownedMarker = path.join(generation, "owned.txt");
  let quarantine;
  let displaced;
  let replacementMarker;
  writeFileSync(ownedMarker, "owned-generation", { encoding: "utf8", flag: "wx" });
  try {
    assert.throws(
      () =>
        removeOwnedGeneration(generation, {
          afterQuarantine(context) {
            quarantine = context.quarantine;
            displaced = `${quarantine}-displaced`;
            replacementMarker = path.join(quarantine, "replacement.txt");
            renameSync(quarantine, displaced);
            mkdirSync(quarantine);
            writeFileSync(replacementMarker, "quarantine-replacement-must-survive", {
              encoding: "utf8",
              flag: "wx",
            });
          },
        }),
      /owned generation identity changed/u,
    );
    assert.equal(readFileSync(replacementMarker, "utf8"), "quarantine-replacement-must-survive");
    assert.equal(readFileSync(path.join(displaced, "owned.txt"), "utf8"), "owned-generation");
  } finally {
    if (replacementMarker && existsSync(replacementMarker)) unlinkSync(replacementMarker);
    if (quarantine && existsSync(quarantine)) rmdirSync(quarantine);
    if (displaced && existsSync(displaced)) renameSync(displaced, generation);
    if (existsSync(generation)) removeOwnedGeneration(generation);
  }
  assertNoOwnedPrefix("quarantine-swap");
});

test("owned cleanup revalidates each member before removal", () => {
  const generation = createOwnedGeneration("member-swap");
  const victim = path.join(generation, "victim.txt");
  writeFileSync(victim, "owned-member", { encoding: "utf8", flag: "wx" });
  let quarantine;
  try {
    assert.throws(
      () =>
        removeOwnedGeneration(generation, {
          afterQuarantine(context) {
            quarantine = context.quarantine;
          },
          beforeMemberRemoval(entry) {
            if (entry.relative !== "victim.txt") return;
            const liveVictim = path.join(quarantine, entry.relative);
            renameSync(liveVictim, `${liveVictim}.displaced`);
            writeFileSync(liveVictim, "replacement-member", { encoding: "utf8", flag: "wx" });
          },
        }),
      /inventory entry identity changed/u,
    );
    assert.equal(readFileSync(path.join(generation, "victim.txt"), "utf8"), "replacement-member");
    assert.equal(readFileSync(path.join(generation, "victim.txt.displaced"), "utf8"), "owned-member");
  } finally {
    const replacement = path.join(generation, "victim.txt");
    const displaced = path.join(generation, "victim.txt.displaced");
    if (existsSync(replacement)) unlinkSync(replacement);
    if (existsSync(displaced)) renameSync(displaced, replacement);
    if (existsSync(generation)) removeOwnedGeneration(generation);
  }
  assertNoOwnedPrefix("member-swap");
});
