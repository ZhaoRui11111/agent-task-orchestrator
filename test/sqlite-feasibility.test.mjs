import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { repoRoot } from "../scripts/repo-utils.mjs";

test("real Windows SQLite feasibility matrix passes without surviving artifacts", { timeout: 30_000 }, () => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "sqlite-feasibility.mjs"), "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 25_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const evidence = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
  assert.equal(evidence.status, "passed");
  assert.equal(evidence.environment.platform, "win32");
  assert.deepEqual(evidence.checks.connectionPolicy, {
    status: "passed",
    foreignKeys: true,
    journalMode: "wal",
    synchronous: "FULL",
    readUncommitted: false,
    busyTimeoutMs: 200,
  });
  assert.equal(evidence.checks.boundedBusyWriter.status, "passed");
  assert(evidence.checks.boundedBusyWriter.elapsedMs >= 120);
  assert(evidence.checks.boundedBusyWriter.elapsedMs < 2_000);
  assert.equal(evidence.checks.preBarrierFailureBounded.status, "passed");
  assert(evidence.checks.preBarrierFailureBounded.elapsedMs < 4_000);
  assert.equal(evidence.checks.atomicClaim.winners, 1);
  assert.equal(evidence.checks.privateOnlineBackup.inventoryMembers, 2);
  assert.equal(evidence.checks.publicationCasReadback.expectedPriorIdentity, null);
  assert.deepEqual(
    evidence.checks.publicationCasReadback.observedPublicationIdentity,
    evidence.checks.publicationCasReadback.newPublicationIdentity,
  );
  assert.equal(evidence.checks.publicationCasReadback.quickCheck, "ok");
  assert.equal(evidence.checks.publicationCasReadback.journalMode, "delete");
  assert.equal(evidence.checks.extraMemberStageRefusal, "passed");
  assert.equal(evidence.checks.reparseStageRefusal, "passed");
  assert.equal(evidence.checks.corruptPrivateStageRefusal, "passed");
  assert.equal(evidence.checks.restartAmbiguousNoReplay, "passed");
  assert.equal(evidence.artifacts.survivingGenerationMembers, 0);
});
