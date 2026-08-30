import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statfsSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { isMainThread, parentPort, workerData, Worker } from "node:worker_threads";
import {
  artifactRootReclaimTestOptions,
  createOwnedGeneration,
  invariant,
  reclaimEmptyTaskArtifactsRoot,
  removeOwnedGeneration,
} from "./repo-utils.mjs";

const BUSY_TIMEOUT_MS = 200;
const CLAIM_READY_TIMEOUT_MS = 3_000;
const CLAIM_RESULT_TIMEOUT_MS = 5_000;

function pragmaValue(database, name) {
  const row = database.prepare(`PRAGMA ${name}`).get();
  return Object.values(row)[0];
}

function configureWritable(database, busyTimeout = BUSY_TIMEOUT_MS) {
  database.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=FULL;
    PRAGMA read_uncommitted=OFF;
    PRAGMA busy_timeout=${busyTimeout};
  `);
  invariant(pragmaValue(database, "foreign_keys") === 1, "foreign keys were not enabled");
  invariant(String(pragmaValue(database, "journal_mode")).toLowerCase() === "wal", "WAL was not enabled");
  invariant(pragmaValue(database, "synchronous") === 2, "synchronous=FULL was not retained");
  invariant(pragmaValue(database, "read_uncommitted") === 0, "read_uncommitted was enabled");
  invariant(pragmaValue(database, "busy_timeout") === busyTimeout, "busy timeout drifted");
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function openReadOnly(file) {
  return new DatabaseSync(file, { readOnly: true });
}

function verifyDatabase(file, expectedSha256) {
  invariant(sha256(file) === expectedSha256, "published database identity mismatch");
  const database = openReadOnly(file);
  try {
    const quick = pragmaValue(database, "quick_check");
    const journalMode = String(pragmaValue(database, "journal_mode")).toLowerCase();
    const foreignKeyFailures = database.prepare("PRAGMA foreign_key_check").all();
    const task = database.prepare("SELECT revision, claimed_by FROM tasks WHERE task_id='task-claim'").get();
    invariant(quick === "ok", "quick_check did not pass");
    invariant(journalMode === "delete", "standalone backup journal mode drifted");
    invariant(foreignKeyFailures.length === 0, "foreign_key_check found a violation");
    invariant(task?.revision === 2 && typeof task.claimed_by === "string", "backup data readback failed");
    return { quickCheck: quick, journalMode, foreignKeyFailures: 0, taskRevision: task.revision };
  } finally {
    database.close();
  }
}

function validatePrivateStage(stageRoot) {
  let stageStat;
  let inventory;
  try {
    stageStat = lstatSync(stageRoot);
    if (!stageStat.isDirectory() || stageStat.isSymbolicLink()) {
      return { valid: false, reason: "stage_reparse_or_non_directory" };
    }
    inventory = readdirSync(stageRoot).sort();
  } catch {
    return { valid: false, reason: "stage_missing_or_unreadable" };
  }
  if (JSON.stringify(inventory) !== JSON.stringify(["backup.sqlite3", "manifest.json"])) {
    return { valid: false, reason: "inventory_mismatch" };
  }
  const manifestPath = path.join(stageRoot, "manifest.json");
  const databasePath = path.join(stageRoot, "backup.sqlite3");
  const manifestStat = lstatSync(manifestPath);
  const databaseStat = lstatSync(databasePath);
  if (
    manifestStat.isSymbolicLink() ||
    !manifestStat.isFile() ||
    databaseStat.isSymbolicLink() ||
    !databaseStat.isFile()
  ) {
    return { valid: false, reason: "inventory_mismatch" };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { valid: false, reason: "manifest_invalid" };
  }
  const keys = Object.keys(manifest).sort();
  const expectedKeys = ["byteLength", "database", "generation", "journalMode", "schemaVersion", "sha256"].sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
    manifest.schemaVersion !== 1 ||
    manifest.generation !== path.basename(stageRoot) ||
    manifest.database !== "backup.sqlite3" ||
    manifest.journalMode !== "delete" ||
    !Number.isSafeInteger(manifest.byteLength) ||
    manifest.byteLength <= 0 ||
    !/^[a-f0-9]{64}$/u.test(manifest.sha256)
  ) {
    return { valid: false, reason: "manifest_invalid" };
  }
  if (databaseStat.size !== manifest.byteLength || sha256(databasePath) !== manifest.sha256) {
    return { valid: false, reason: "inventory_mismatch" };
  }
  try {
    const readback = verifyDatabase(databasePath, manifest.sha256);
    if (JSON.stringify(readdirSync(stageRoot).sort()) !== JSON.stringify(inventory)) {
      return { valid: false, reason: "readback_created_unmanifested_member" };
    }
    return {
      valid: true,
      manifest,
      manifestPath,
      manifestSha256: sha256(manifestPath),
      databasePath,
      inventory,
      readback,
    };
  } catch {
    return { valid: false, reason: "database_verification_failed" };
  }
}

function pointerIdentity(pointerBytes, pointer) {
  return {
    pointerSha256: sha256Text(pointerBytes),
    generation: pointer.generation,
    manifestSha256: pointer.manifestSha256,
    databaseSha256: pointer.databaseSha256,
  };
}

function readPublicationPointer(pointerPath) {
  const stat = lstatSync(pointerPath);
  invariant(stat.isFile() && !stat.isSymbolicLink(), "publication pointer is not a regular no-follow file");
  const bytes = readFileSync(pointerPath, "utf8");
  const pointer = JSON.parse(bytes);
  invariant(
    JSON.stringify(Object.keys(pointer).sort()) ===
      JSON.stringify(["databaseSha256", "generation", "manifest", "manifestSha256", "schemaVersion"]),
    "publication pointer field inventory drifted",
  );
  invariant(
    pointer.schemaVersion === 1 &&
      typeof pointer.generation === "string" &&
      /^[a-f0-9]{64}$/u.test(pointer.manifestSha256) &&
      /^[a-f0-9]{64}$/u.test(pointer.databaseSha256),
    "publication pointer schema drifted",
  );
  return { bytes, pointer, identity: pointerIdentity(bytes, pointer) };
}

function createPointerCandidate(generationRoot, validation, pointerStageName) {
  const pointerStagingRoot = path.join(generationRoot, "publication-staging");
  mkdirSync(pointerStagingRoot, { recursive: true });
  const pointer = {
    schemaVersion: 1,
    generation: path.basename(path.dirname(validation.manifestPath)),
    manifest: path.relative(generationRoot, validation.manifestPath).replaceAll("\\", "/"),
    manifestSha256: validation.manifestSha256,
    databaseSha256: validation.manifest.sha256,
  };
  const pointerStage = path.join(pointerStagingRoot, pointerStageName);
  const pointerBytes = `${JSON.stringify(pointer)}\n`;
  writeFileSync(pointerStage, pointerBytes, { encoding: "utf8", flag: "wx" });
  const stat = lstatSync(pointerStage);
  invariant(stat.isFile() && !stat.isSymbolicLink(), "pointer candidate is not a regular no-follow file");
  return { pointerStage, pointerBytes, identity: pointerIdentity(pointerBytes, pointer) };
}

function publishPointerCas(generationRoot, stageRoot, pointerStageName, expectedPriorIdentity = null) {
  invariant(expectedPriorIdentity === null, "this feasibility CAS supports only create-if-absent publication");
  const publicationRoot = path.join(generationRoot, "publication");
  mkdirSync(publicationRoot, { recursive: true });
  const validation = validatePrivateStage(stageRoot);
  invariant(validation.valid, `private stage refused: ${validation.reason}`);
  const candidate = createPointerCandidate(generationRoot, validation, pointerStageName);
  const currentPointer = path.join(publicationRoot, "current.json");
  try {
    linkSync(candidate.pointerStage, currentPointer);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const observed = readPublicationPointer(currentPointer);
    return {
      status: "conflict",
      expectedPriorIdentity,
      newPublicationIdentity: candidate.identity,
      observedPriorIdentity: observed.identity,
      currentPointer,
      pointerBytes: observed.bytes,
    };
  }
  const observed = readPublicationPointer(currentPointer);
  invariant(
    JSON.stringify(observed.identity) === JSON.stringify(candidate.identity),
    "published pointer identity differs from the candidate",
  );
  return {
    status: "published",
    expectedPriorIdentity,
    newPublicationIdentity: candidate.identity,
    observedPublicationIdentity: observed.identity,
    currentPointer,
    pointerBytes: observed.bytes,
  };
}

function reopenPublication(generationRoot, currentPointer, expectedPublicationIdentity) {
  invariant(path.resolve(currentPointer) === path.resolve(generationRoot, "publication", "current.json"), "unexpected publication path");
  const observed = readPublicationPointer(currentPointer);
  const { pointer } = observed;
  invariant(
    JSON.stringify(observed.identity) === JSON.stringify(expectedPublicationIdentity),
    "publication readback identity drifted",
  );
  invariant(pointer.manifest === `stages/${pointer.generation}/manifest.json`, "publication pointer manifest identity drifted");
  const manifestPath = path.resolve(generationRoot, pointer.manifest);
  invariant(
    manifestPath.startsWith(`${path.resolve(generationRoot)}${path.sep}`),
    "publication pointer escaped the generation",
  );
  const stageRoot = path.dirname(manifestPath);
  invariant(path.basename(stageRoot) === pointer.generation, "publication generation identity drifted");
  const validation = validatePrivateStage(stageRoot);
  invariant(validation.valid, `published generation failed readback: ${validation.reason}`);
  invariant(validation.manifestSha256 === pointer.manifestSha256, "published manifest identity mismatch");
  invariant(validation.manifest.sha256 === pointer.databaseSha256, "published database identity mismatch");
  return { ...validation.readback, observedPublicationIdentity: observed.identity };
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function startClaimWorker(file, workerId, releaseBarrier, failBeforeReady = false) {
  const worker = new Worker(new URL(import.meta.url), {
    workerData: { kind: "claim", file, workerId, releaseBarrier, failBeforeReady },
  });
  let readyResolve;
  let readyReject;
  let resultResolve;
  let resultReject;
  let readySettled = false;
  let resultSettled = false;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const result = new Promise((resolve, reject) => {
    resultResolve = resolve;
    resultReject = reject;
  });
  const fail = (error) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    if (!readySettled) {
      readySettled = true;
      readyReject(normalized);
    }
    if (!resultSettled) {
      resultSettled = true;
      resultReject(normalized);
    }
  };
  worker.on("message", (message) => {
    if (message?.kind === "ready" && !readySettled) {
      readySettled = true;
      readyResolve(message);
    } else if (message?.kind === "result" && !resultSettled) {
      resultSettled = true;
      resultResolve(message.result);
    } else if (message?.kind === "failure") {
      fail(new Error(`claim worker ${workerId} failed: ${message.reason}`));
    }
  });
  worker.once("error", fail);
  const exit = new Promise((resolve) => {
    worker.once("exit", (code) => {
      if (code !== 0) fail(new Error(`claim worker ${workerId} exited ${code}`));
      if (code === 0 && !resultSettled) fail(new Error(`claim worker ${workerId} exited before a result`));
      resolve(code);
    });
  });
  return { worker, ready, result, exit };
}

async function runClaimPair(file, workerIds, faultWorkerId = null) {
  const releaseBarrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const releaseView = new Int32Array(releaseBarrier);
  const handles = workerIds.map((workerId) =>
    startClaimWorker(file, workerId, releaseBarrier, workerId === faultWorkerId),
  );
  const ready = Promise.all(handles.map((handle) => handle.ready));
  const results = Promise.all(handles.map((handle) => handle.result));
  results.catch(() => undefined);
  try {
    await withTimeout(ready, CLAIM_READY_TIMEOUT_MS, "claim worker readiness");
    Atomics.store(releaseView, 0, 1);
    Atomics.notify(releaseView, 0, handles.length);
    const claimResults = await withTimeout(results, CLAIM_RESULT_TIMEOUT_MS, "claim worker results");
    const exitCodes = await withTimeout(
      Promise.all(handles.map((handle) => handle.exit)),
      CLAIM_RESULT_TIMEOUT_MS,
      "claim worker exits",
    );
    invariant(exitCodes.every((code) => code === 0), "claim worker did not exit cleanly");
    return claimResults;
  } catch (error) {
    await Promise.allSettled(handles.map((handle) => handle.worker.terminate()));
    await Promise.allSettled([ready, results, ...handles.map((handle) => handle.exit)]);
    throw error;
  }
}

function runClaimWorker() {
  const releaseBarrier = new Int32Array(workerData.releaseBarrier);
  let database;
  try {
    if (workerData.failBeforeReady) throw new Error("injected pre-readiness failure");
    database = new DatabaseSync(workerData.file, { timeout: 2_000 });
    database.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2000;");
    parentPort.postMessage({ kind: "ready", workerId: workerData.workerId });
    const releaseDeadline = Date.now() + CLAIM_READY_TIMEOUT_MS;
    while (Atomics.load(releaseBarrier, 0) === 0) {
      const remaining = releaseDeadline - Date.now();
      if (remaining <= 0) throw new Error("claim worker release deadline exceeded");
      Atomics.wait(releaseBarrier, 0, 0, Math.min(remaining, 250));
    }
    database.exec("BEGIN IMMEDIATE");
    const update = database
      .prepare("UPDATE tasks SET revision=revision+1, claimed_by=? WHERE task_id='task-claim' AND revision=1 AND claimed_by IS NULL")
      .run(workerData.workerId);
    if (update.changes === 1) {
      database
        .prepare("INSERT INTO claims(task_id, expected_revision, owner) VALUES('task-claim', 1, ?)")
        .run(workerData.workerId);
      database.exec("COMMIT");
      parentPort.postMessage({ kind: "result", result: { workerId: workerData.workerId, outcome: "claimed" } });
    } else {
      database.exec("ROLLBACK");
      parentPort.postMessage({ kind: "result", result: { workerId: workerData.workerId, outcome: "stale_revision" } });
    }
  } catch (error) {
    if (database?.isTransaction) {
      database.exec("ROLLBACK");
    }
    parentPort.postMessage({ kind: "failure", reason: error.message });
    process.exitCode = 1;
  } finally {
    if (database?.isOpen) database.close();
  }
}

function resumeAmbiguous(file) {
  const database = openReadOnly(file);
  try {
    const intent = database.prepare("SELECT state FROM operation_intents WHERE intent_id='intent-1'").get();
    const effects = database.prepare("SELECT COUNT(*) AS count FROM effects WHERE intent_id='intent-1'").get().count;
    const receipts = database.prepare("SELECT COUNT(*) AS count FROM receipts WHERE intent_id='intent-1'").get().count;
    const classification = intent?.state === "executing" && effects === 1 && receipts === 0 ? "ambiguous" : "invalid";
    console.log(JSON.stringify({ classification, replayAllowed: false, effects, receipts }));
    process.exitCode = classification === "ambiguous" ? 0 : 1;
  } finally {
    database.close();
  }
}

async function createPrivateBackup(source, stageRoot) {
  mkdirSync(stageRoot, { recursive: true });
  const databasePath = path.join(stageRoot, "backup.sqlite3");
  await backup(source, databasePath);
  const standalone = new DatabaseSync(databasePath);
  try {
    const journalMode = String(standalone.prepare("PRAGMA journal_mode=DELETE").get().journal_mode).toLowerCase();
    invariant(journalMode === "delete", "private backup could not become a standalone DELETE-mode database");
    standalone.exec("PRAGMA synchronous=FULL;");
  } finally {
    standalone.close();
  }
  invariant(
    JSON.stringify(readdirSync(stageRoot).sort()) === JSON.stringify(["backup.sqlite3"]),
    "backup normalization left an unmanifested sidecar",
  );
  const manifest = {
    schemaVersion: 1,
    generation: path.basename(stageRoot),
    database: "backup.sqlite3",
    journalMode: "delete",
    byteLength: statSync(databasePath).size,
    sha256: sha256(databasePath),
  };
  writeFileSync(path.join(stageRoot, "manifest.json"), `${JSON.stringify(manifest)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const validation = validatePrivateStage(stageRoot);
  invariant(validation.valid, `created private backup is invalid: ${validation.reason}`);
  return validation;
}

async function runSpike() {
  invariant(process.platform === "win32", "real Windows evidence requires process.platform=win32");
  const generation = createOwnedGeneration("sqlite");
  const filesystemType = String(statfsSync(generation).type);
  const primaryPath = path.join(generation, "primary.sqlite3");
  let primary;
  let reader;
  let contender;
  try {
    primary = new DatabaseSync(primaryPath, { timeout: BUSY_TIMEOUT_MS });
    configureWritable(primary);
    primary.exec(`
      CREATE TABLE parents(parent_id TEXT PRIMARY KEY);
      CREATE TABLE children(child_id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parents(parent_id));
      CREATE TABLE items(item_id TEXT PRIMARY KEY, value INTEGER NOT NULL);
      CREATE TABLE tasks(task_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, claimed_by TEXT);
      CREATE TABLE claims(task_id TEXT PRIMARY KEY REFERENCES tasks(task_id), expected_revision INTEGER NOT NULL, owner TEXT NOT NULL);
      INSERT INTO parents(parent_id) VALUES('parent-1');
      INSERT INTO children(child_id, parent_id) VALUES('child-1', 'parent-1');
      INSERT INTO items(item_id, value) VALUES('item-1', 0);
      INSERT INTO tasks(task_id, revision, claimed_by) VALUES('task-claim', 1, NULL);
    `);

    let foreignKeyRejected = false;
    try {
      primary.prepare("INSERT INTO children(child_id, parent_id) VALUES('bad-child', 'missing')").run();
    } catch {
      foreignKeyRejected = true;
    }
    invariant(foreignKeyRejected, "foreign-key violation was accepted");
    invariant(primary.prepare("SELECT COUNT(*) AS count FROM children WHERE child_id='bad-child'").get().count === 0, "failed FK write persisted");

    reader = new DatabaseSync(primaryPath, { timeout: BUSY_TIMEOUT_MS });
    contender = new DatabaseSync(primaryPath, { timeout: BUSY_TIMEOUT_MS });
    configureWritable(reader);
    configureWritable(contender);

    reader.exec("BEGIN");
    const snapshotBefore = reader.prepare("SELECT value FROM items WHERE item_id='item-1'").get().value;
    primary.exec("BEGIN IMMEDIATE; UPDATE items SET value=1 WHERE item_id='item-1'; COMMIT;");
    const snapshotDuring = reader.prepare("SELECT value FROM items WHERE item_id='item-1'").get().value;
    reader.exec("COMMIT");
    const snapshotAfter = reader.prepare("SELECT value FROM items WHERE item_id='item-1'").get().value;
    invariant(snapshotBefore === 0 && snapshotDuring === 0 && snapshotAfter === 1, "WAL reader snapshot was not isolated");

    primary.exec("BEGIN IMMEDIATE; UPDATE items SET value=2 WHERE item_id='item-1'");
    const busyStarted = performance.now();
    let busyError;
    try {
      contender.exec("BEGIN IMMEDIATE");
    } catch (error) {
      busyError = error;
    }
    const busyElapsedMs = performance.now() - busyStarted;
    primary.exec("ROLLBACK");
    invariant(busyError && /busy|locked/iu.test(busyError.message), "competing writer did not report SQLite busy/locked");
    invariant(busyElapsedMs >= BUSY_TIMEOUT_MS * 0.6 && busyElapsedMs < 2_000, "busy handling was not bounded near the configured timeout");

    reader.close();
    reader = undefined;
    contender.close();
    contender = undefined;

    const preBarrierStarted = performance.now();
    let preBarrierFailure;
    try {
      await runClaimPair(primaryPath, ["fault-worker", "waiting-worker"], "fault-worker");
    } catch (error) {
      preBarrierFailure = error;
    }
    const preBarrierElapsedMs = performance.now() - preBarrierStarted;
    invariant(preBarrierFailure && /pre-readiness|exited 1/iu.test(preBarrierFailure.message), "pre-barrier worker fault was not observed");
    invariant(preBarrierElapsedMs < CLAIM_READY_TIMEOUT_MS + 1_000, "pre-barrier worker fault was not bounded");
    invariant(primary.prepare("SELECT revision FROM tasks WHERE task_id='task-claim'").get().revision === 1, "fault probe mutated the claim target");
    invariant(primary.prepare("SELECT COUNT(*) AS count FROM claims").get().count === 0, "fault probe created a claim");

    const claimResults = await runClaimPair(primaryPath, ["worker-a", "worker-b"]);
    invariant(claimResults.filter((item) => item.outcome === "claimed").length === 1, "atomic claim did not have exactly one winner");
    invariant(claimResults.filter((item) => item.outcome === "stale_revision").length === 1, "loser did not observe stale revision");
    invariant(primary.prepare("SELECT COUNT(*) AS count FROM claims").get().count === 1, "claim table contains the wrong winner count");

    const stagesRoot = path.join(generation, "stages");
    const stageA = path.join(stagesRoot, "generation-a");
    const backupA = await createPrivateBackup(primary, stageA);
    const publication = publishPointerCas(generation, stageA, "pointer-a.json");
    invariant(publication.status === "published" && publication.expectedPriorIdentity === null, "initial publication was not create-if-absent");
    const publishedReadback = reopenPublication(generation, publication.currentPointer, publication.newPublicationIdentity);

    const incompleteStage = path.join(stagesRoot, "incomplete");
    mkdirSync(incompleteStage, { recursive: true });
    writeFileSync(path.join(incompleteStage, "backup.sqlite3"), "incomplete", { flag: "wx" });
    invariant(validatePrivateStage(incompleteStage).reason === "inventory_mismatch", "incomplete private stage was accepted");

    const extraMemberStage = path.join(stagesRoot, "extra-member");
    await createPrivateBackup(primary, extraMemberStage);
    writeFileSync(path.join(extraMemberStage, "unexpected.bin"), "unexpected", { flag: "wx" });
    invariant(validatePrivateStage(extraMemberStage).reason === "inventory_mismatch", "extra private-stage member was accepted");

    const stageAlias = path.join(stagesRoot, "reparse-alias");
    symlinkSync(stageA, stageAlias, "junction");
    invariant(
      validatePrivateStage(stageAlias).reason === "stage_reparse_or_non_directory",
      "reparse-backed private stage was accepted",
    );

    const stageB = path.join(stagesRoot, "generation-b");
    await createPrivateBackup(primary, stageB);
    const publicationConflict = publishPointerCas(generation, stageB, "pointer-b.json");
    invariant(publicationConflict.status === "conflict", "publication CAS did not reject an existing winner");
    invariant(publicationConflict.expectedPriorIdentity === null, "stale CAS expectation drifted");
    invariant(
      JSON.stringify(publicationConflict.observedPriorIdentity) === JSON.stringify(publication.newPublicationIdentity),
      "publication conflict did not retain the observed winner identity",
    );
    invariant(publicationConflict.pointerBytes === publication.pointerBytes, "publication winner changed after conflict");
    invariant(
      reopenPublication(generation, publication.currentPointer, publication.newPublicationIdentity).taskRevision === 2,
      "winner failed after publication conflict",
    );

    const corruptPath = path.join(generation, "corrupt.sqlite3");
    writeFileSync(corruptPath, Buffer.from("not-a-sqlite-database", "utf8"), { flag: "wx" });
    let corruptionRejected = false;
    let corruptDatabase;
    try {
      corruptDatabase = openReadOnly(corruptPath);
      corruptDatabase.prepare("PRAGMA quick_check").all();
    } catch {
      corruptionRejected = true;
    } finally {
      if (corruptDatabase?.isOpen) {
        corruptDatabase.close();
      }
    }
    invariant(corruptionRejected, "corrupt SQLite input was accepted");

    const corruptStage = path.join(stagesRoot, "corrupt-generation");
    mkdirSync(corruptStage, { recursive: true });
    const corruptStageDatabase = path.join(corruptStage, "backup.sqlite3");
    writeFileSync(corruptStageDatabase, Buffer.from("self-consistent-but-corrupt", "utf8"), { flag: "wx" });
    writeFileSync(
      path.join(corruptStage, "manifest.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        generation: path.basename(corruptStage),
        database: "backup.sqlite3",
        journalMode: "delete",
        byteLength: statSync(corruptStageDatabase).size,
        sha256: sha256(corruptStageDatabase),
      })}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    invariant(
      validatePrivateStage(corruptStage).reason === "database_verification_failed",
      "self-consistent corrupt private stage was accepted",
    );

    const ambiguousPath = path.join(generation, "ambiguous.sqlite3");
    const ambiguous = new DatabaseSync(ambiguousPath);
    ambiguous.exec(`
      CREATE TABLE operation_intents(intent_id TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE effects(effect_id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES operation_intents(intent_id));
      CREATE TABLE receipts(receipt_id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES operation_intents(intent_id));
      PRAGMA foreign_keys=ON;
      BEGIN IMMEDIATE;
      INSERT INTO operation_intents(intent_id, state) VALUES('intent-1', 'executing');
      INSERT INTO effects(effect_id, intent_id) VALUES('effect-1', 'intent-1');
      COMMIT;
    `);
    ambiguous.close();
    const resumed = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--resume", ambiguousPath], {
      encoding: "utf8",
      windowsHide: true,
    });
    invariant(resumed.status === 0, `restart resume failed: ${resumed.stderr || resumed.stdout}`);
    const resumeResult = JSON.parse(resumed.stdout.trim().split(/\r?\n/u).at(-1));
    invariant(resumeResult.classification === "ambiguous" && resumeResult.replayAllowed === false, "restart did not fail closed");
    const ambiguousReadback = openReadOnly(ambiguousPath);
    invariant(ambiguousReadback.prepare("SELECT COUNT(*) AS count FROM effects").get().count === 1, "ambiguous effect was replayed");
    ambiguousReadback.close();

    const result = {
      schemaVersion: 1,
      status: "passed",
      environment: {
        platform: process.platform,
        osRelease: os.release(),
        architecture: process.arch,
        filesystemType,
        node: process.versions.node,
        sqlite: process.versions.sqlite,
      },
      checks: {
        connectionPolicy: {
          status: "passed",
          foreignKeys: true,
          journalMode: "wal",
          synchronous: "FULL",
          readUncommitted: false,
          busyTimeoutMs: BUSY_TIMEOUT_MS,
        },
        foreignKeys: "passed",
        walSnapshotReaderWriter: "passed",
        boundedBusyWriter: { status: "passed", elapsedMs: Number(busyElapsedMs.toFixed(3)) },
        preBarrierFailureBounded: { status: "passed", elapsedMs: Number(preBarrierElapsedMs.toFixed(3)) },
        atomicClaim: { status: "passed", winners: 1, staleLosers: 1 },
        privateOnlineBackup: { status: "passed", byteLength: backupA.manifest.byteLength, inventoryMembers: 2 },
        publicationCasReadback: {
          status: "passed",
          expectedPriorIdentity: publication.expectedPriorIdentity,
          newPublicationIdentity: publication.newPublicationIdentity,
          ...publishedReadback,
        },
        incompleteStageRefusal: "passed",
        extraMemberStageRefusal: "passed",
        reparseStageRefusal: "passed",
        publicationConflictWinnerRetention: "passed",
        corruptionRefusal: "passed",
        corruptPrivateStageRefusal: "passed",
        restartAmbiguousNoReplay: "passed",
      },
      artifacts: { survivingGenerationMembers: 0 },
    };
    return result;
  } finally {
    if (contender?.isOpen) contender.close();
    if (reader?.isOpen) reader.close();
    if (primary?.isOpen) primary.close();
    removeOwnedGeneration(generation);
    if (!Object.hasOwn(process.env, "NODE_TEST_CONTEXT")) {
      reclaimEmptyTaskArtifactsRoot(artifactRootReclaimTestOptions());
    }
  }
}

if (!isMainThread) {
  runClaimWorker();
} else if (process.argv[2] === "--resume") {
  resumeAmbiguous(process.argv[3]);
} else {
  runSpike()
    .then((result) => {
      assert.equal(result.status, "passed");
      console.log(process.argv.includes("--json") ? JSON.stringify(result) : JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.stack ?? error.message);
      process.exitCode = 1;
    });
}
