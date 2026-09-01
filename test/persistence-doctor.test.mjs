import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  createApplicationService,
  currentSchemaVersion,
  inspectPrimaryIdentity,
  inspectRuntimeDoctor,
  openPersistence,
  restoreBackup,
} from "../src/index.ts";
import { restoreBackupForTesting } from "../src/persistence/backup.ts";
import { canonicalJson } from "../src/persistence/values.ts";
import {
  authorizeTestLifecycle,
  cleanupPersistenceFixture,
  createAuthorizedTestBackup,
  createCurrentDatabase,
  createIncompatibleDatabase,
  createPersistenceFixture,
} from "./persistence-test-helpers.mjs";

const TEST_PRINCIPAL_SHA256 = "A".repeat(64);
const CURRENT_SCHEMA_VERSION = currentSchemaVersion();

function initialize(store) {
  const service = createApplicationService(store, {
    currentActor: () => ({ actorId: "doctor-owner", principal: TEST_PRINCIPAL_SHA256 }),
    now: () => new Date().toISOString(),
    nextId: () => randomUUID(),
    confirmHighRisk: () => true,
  });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = service.bootstrap({ kind: "authorization.bootstrap", expiresAt });
  assert.equal(result.ok, true);
  return service;
}

function doctor(fixture) {
  return inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot);
}

function snapshotTree(root) {
  const entries = [];
  const visit = (current) => {
    const stat = lstatSync(current, { bigint: true });
    const relative = path.relative(root, current).split(path.sep).join("/");
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      const names = readdirSync(current).sort();
      entries.push({ relative, kind: "directory", mtimeNs: stat.mtimeNs.toString(), names });
      for (const name of names) visit(path.join(current, name));
      return;
    }
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true);
    entries.push({
      relative,
      kind: "file",
      mtimeNs: stat.mtimeNs.toString(),
      bytes: readFileSync(current).toString("base64"),
    });
  };
  visit(root);
  return entries;
}

test("doctor classifies absent, partial, and unsafe runtime topology without creating anything", () => {
  const fixture = createPersistenceFixture("doctor-topology");
  try {
    const absentRoot = path.join(fixture.generation, "absent-runtime");
    assert.deepEqual(inspectRuntimeDoctor(absentRoot, fixture.sourceCheckoutRoot), {
      health: "not_initialized",
      initialized: false,
      schemaVersion: null,
      activeUse: false,
      backupInventory: "empty",
      restoreState: "none",
    });
    assert.equal(readdirSync(fixture.generation).includes("absent-runtime"), false);

    const partialRoot = path.join(fixture.generation, "partial-runtime");
    mkdirSync(partialRoot);
    assert.deepEqual(inspectRuntimeDoctor(partialRoot, fixture.sourceCheckoutRoot), {
      health: "partial_runtime",
      initialized: null,
      schemaVersion: null,
      activeUse: null,
      backupInventory: "not_checked",
      restoreState: "not_checked",
    });

    const unsafeRoot = path.join(fixture.generation, "unsafe-runtime");
    writeFileSync(unsafeRoot, "not a directory", { flag: "wx" });
    assert.deepEqual(inspectRuntimeDoctor(unsafeRoot, fixture.sourceCheckoutRoot), {
      health: "runtime_unsafe",
      initialized: null,
      schemaVersion: null,
      activeUse: null,
      backupInventory: "not_checked",
      restoreState: "not_checked",
    });
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("doctor distinguishes current uninitialized, active, and healthy state without mutation", async () => {
  const fixture = createPersistenceFixture("doctor-current-state");
  let store;
  try {
    createCurrentDatabase(fixture.layout, "doctor-current");
    const before = snapshotTree(fixture.layout.root);
    assert.deepEqual(doctor(fixture), {
      health: "not_initialized", initialized: false, schemaVersion: CURRENT_SCHEMA_VERSION, activeUse: false,
      backupInventory: "empty", restoreState: "none",
    });
    assert.deepEqual(snapshotTree(fixture.layout.root), before);

    store = await openPersistence(fixture.layout, { applicationVersion: "doctor-current-open" });
    initialize(store);
    assert.deepEqual(doctor(fixture), {
      health: "runtime_active", initialized: null, schemaVersion: null, activeUse: true,
      backupInventory: "empty", restoreState: "none",
    });
    await store.close();
    store = undefined;
    assert.deepEqual(doctor(fixture), {
      health: "healthy", initialized: true, schemaVersion: CURRENT_SCHEMA_VERSION, activeUse: false,
      backupInventory: "empty", restoreState: "none",
    });
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("doctor refuses a noncurrent nonempty database without changing its inventory", () => {
  const fixture = createPersistenceFixture("doctor-incompatible-database");
  try {
    createIncompatibleDatabase(fixture.layout);
    const before = snapshotTree(fixture.layout.root);
    assert.deepEqual(doctor(fixture), {
      health: "migration_invalid", initialized: null, schemaVersion: null, activeUse: false,
      backupInventory: "empty", restoreState: "none",
    });
    assert.deepEqual(snapshotTree(fixture.layout.root), before);
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("doctor rejects partial current application relations as corrupt", () => {
  const fixture = createPersistenceFixture("doctor-current-partial-application");
  try {
    createCurrentDatabase(fixture.layout);
    const database = new DatabaseSync(fixture.layout.databasePath);
    database.prepare(
      `INSERT INTO application_requests(
        request_id, correlation_id, actor_id, action, target_kind, target_id,
        target_revision, result, created_at
      ) VALUES ('partial-request', 'partial-correlation', 'partial-actor',
        'authorization.grant.issue', 'runtime', 'runtime', NULL, 'bootstrap', '2026-01-01T00:00:00.000Z')`,
    ).run();
    database.close();
    assert.equal(doctor(fixture).health, "state_corrupt");
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("doctor precedence distinguishes newer schema, migration drift, and corrupt relational state", async () => {
  const newer = createPersistenceFixture("doctor-schema-newer");
  const migration = createPersistenceFixture("doctor-migration-invalid");
  const corrupt = createPersistenceFixture("doctor-state-corrupt");
  let store;
  try {
    for (const fixture of [newer, migration, corrupt]) {
      store = await openPersistence(fixture.layout, { applicationVersion: "doctor-corruption" });
      initialize(store);
      await store.close();
      store = undefined;
    }
    let database = new DatabaseSync(newer.layout.databasePath);
    database.prepare("UPDATE schema_metadata SET schema_version=8 WHERE singleton=1").run();
    database.exec("PRAGMA user_version=8");
    database.close();
    assert.deepEqual(doctor(newer), {
      health: "schema_newer", initialized: null, schemaVersion: 8, activeUse: false,
      backupInventory: "empty", restoreState: "none",
    });

    database = new DatabaseSync(migration.layout.databasePath);
    database.prepare("UPDATE migration_history SET checksum_sha256=? WHERE version=1").run("0".repeat(64));
    database.close();
    assert.equal(doctor(migration).health, "migration_invalid");

    database = new DatabaseSync(corrupt.layout.databasePath);
    database.exec("PRAGMA foreign_keys=OFF");
    database.prepare("INSERT INTO task_dependencies(task_id, dependency_id) VALUES ('missing-a', 'missing-b')").run();
    database.close();
    assert.equal(doctor(corrupt).health, "state_corrupt");
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(newer);
    cleanupPersistenceFixture(migration);
    cleanupPersistenceFixture(corrupt);
  }
});

test("doctor reports backup staging residue and invalid generations without deleting or completing them", async () => {
  const stagingFixture = createPersistenceFixture("doctor-backup-staging");
  const corruptFixture = createPersistenceFixture("doctor-backup-corrupt");
  let store;
  try {
    store = await openPersistence(stagingFixture.layout, { applicationVersion: "doctor-staging" });
    initialize(store);
    await store.close();
    store = undefined;
    const stage = path.join(stagingFixture.layout.backupStagingRoot, "11111111-1111-4111-8111-111111111111");
    mkdirSync(stage);
    writeFileSync(path.join(stage, "state.sqlite3"), "partial", { flag: "wx" });
    const stagingBefore = snapshotTree(stagingFixture.layout.root);
    assert.equal(doctor(stagingFixture).health, "backup_invalid");
    assert.deepEqual(snapshotTree(stagingFixture.layout.root), stagingBefore);
    store = await openPersistence(stagingFixture.layout, { applicationVersion: "doctor-staging-open" });
    await store.close();
    store = undefined;

    store = await openPersistence(corruptFixture.layout, { applicationVersion: "doctor-backup-corrupt" });
    const generation = await createAuthorizedTestBackup(store);
    await store.close();
    store = undefined;
    const manifestPath = path.join(corruptFixture.layout.backupGenerationsRoot, generation.generationId, "manifest.json");
    const unsupportedManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    unsupportedManifest.schemaVersion = 2;
    writeFileSync(manifestPath, canonicalJson(unsupportedManifest));
    const corruptBefore = snapshotTree(corruptFixture.layout.root);
    assert.equal(doctor(corruptFixture).health, "backup_invalid");
    assert.deepEqual(snapshotTree(corruptFixture.layout.root), corruptBefore);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(stagingFixture);
    cleanupPersistenceFixture(corruptFixture);
  }
});

test("doctor recursively rejects unsafe staging identity and inactive SQLite sidecars without mutation", async () => {
  const stagingFixture = createPersistenceFixture("doctor-staging-unsafe");
  const sidecarFixture = createPersistenceFixture("doctor-sidecar-unsafe");
  let store;
  try {
    store = await openPersistence(stagingFixture.layout, { applicationVersion: "doctor-staging-unsafe" });
    initialize(store);
    await store.close();
    store = undefined;
    const stage = path.join(stagingFixture.layout.backupStagingRoot, "22222222-2222-4222-8222-222222222222");
    const target = path.join(stagingFixture.generation, "stage-link-target");
    mkdirSync(stage);
    mkdirSync(target);
    symlinkSync(target, path.join(stage, "nested-link"), process.platform === "win32" ? "junction" : "dir");
    assert.equal(doctor(stagingFixture).health, "runtime_unsafe");
    assert.equal(lstatSync(path.join(stage, "nested-link")).isSymbolicLink(), true);

    store = await openPersistence(sidecarFixture.layout, { applicationVersion: "doctor-sidecar-unsafe" });
    initialize(store);
    await store.close();
    store = undefined;
    const sidecarPath = `${sidecarFixture.layout.databasePath}-wal`;
    writeFileSync(sidecarPath, "inactive-sidecar", { flag: "wx" });
    const sidecarBefore = readFileSync(sidecarPath);
    assert.equal(doctor(sidecarFixture).health, "runtime_unsafe");
    assert.deepEqual(readFileSync(sidecarPath), sidecarBefore);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(stagingFixture);
    cleanupPersistenceFixture(sidecarFixture);
  }
});

test("doctor reports ambiguous and pending restore state with restore precedence and no recovery write", async () => {
  const ambiguous = createPersistenceFixture("doctor-restore-ambiguous");
  const pending = createPersistenceFixture("doctor-restore-pending");
  let store;
  try {
    store = await openPersistence(ambiguous.layout, { applicationVersion: "doctor-ambiguous" });
    initialize(store);
    await store.close();
    store = undefined;
    writeFileSync(path.join(ambiguous.layout.restoreStagingRoot, "unknown-stage"), "residue", { flag: "wx" });
    const ambiguousBefore = snapshotTree(ambiguous.layout.root);
    assert.deepEqual(doctor(ambiguous), {
      health: "restore_ambiguous", initialized: null, schemaVersion: null, activeUse: false,
      backupInventory: "empty", restoreState: "ambiguous",
    });
    assert.deepEqual(snapshotTree(ambiguous.layout.root), ambiguousBefore);

    store = await openPersistence(pending.layout, { applicationVersion: "doctor-pending" });
    const generation = await createAuthorizedTestBackup(store);
    const authorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
    await store.close();
    store = undefined;
    const expectedCurrent = await inspectPrimaryIdentity(pending.layout);
    await assert.rejects(
      restoreBackupForTesting(pending.layout, {
        generationId: generation.generationId,
        expectedCurrent,
        acknowledgeDataLoss: true,
        applicationVersion: "doctor-pending",
        authorization,
      }, { afterIntent: () => { throw new Error("retain pending doctor fixture"); } }),
      (error) => error?.code === "RESTORE_RECOVERY_REQUIRED",
    );
    const pendingBefore = snapshotTree(pending.layout.root);
    assert.deepEqual(doctor(pending), {
      health: "restore_pending", initialized: null, schemaVersion: null, activeUse: false,
      backupInventory: "valid", restoreState: "pending",
    });
    assert.deepEqual(snapshotTree(pending.layout.root), pendingBefore);
    const unsupportedIntent = JSON.parse(readFileSync(pending.layout.restoreIntentPath, "utf8"));
    unsupportedIntent.schemaVersion = 2;
    writeFileSync(pending.layout.restoreIntentPath, canonicalJson(unsupportedIntent));
    const unsupportedBefore = snapshotTree(pending.layout.root);
    assert.deepEqual(doctor(pending), {
      health: "restore_ambiguous", initialized: null, schemaVersion: null, activeUse: false,
      backupInventory: "valid", restoreState: "ambiguous",
    });
    assert.deepEqual(snapshotTree(pending.layout.root), unsupportedBefore);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(ambiguous);
    cleanupPersistenceFixture(pending);
  }
});

test("doctor leaves an unsupported-version completed restore receipt ambiguous and unchanged", async () => {
  const fixture = createPersistenceFixture("doctor-unsupported-receipt");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "doctor-unsupported-receipt" });
    const generation = await createAuthorizedTestBackup(store);
    const authorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
    await store.close();
    store = undefined;
    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    const receipt = await restoreBackup(fixture.layout, {
      generationId: generation.generationId,
      expectedCurrent,
      acknowledgeDataLoss: true,
      applicationVersion: "doctor-unsupported-receipt",
      authorization,
    });
    const receiptPath = path.join(fixture.layout.restoreReceiptsRoot, `${receipt.restoreId}.json`);
    const unsupportedReceipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    unsupportedReceipt.schemaVersion = 2;
    writeFileSync(receiptPath, canonicalJson(unsupportedReceipt));
    const before = snapshotTree(fixture.layout.root);
    assert.deepEqual(doctor(fixture), {
      health: "restore_ambiguous", initialized: null, schemaVersion: null, activeUse: false,
      backupInventory: "valid", restoreState: "ambiguous",
    });
    assert.deepEqual(snapshotTree(fixture.layout.root), before);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("healthy doctor is byte-, timestamp-, inventory-, and receipt-preserving", async () => {
  const fixture = createPersistenceFixture("doctor-read-only");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "doctor-read-only" });
    initialize(store);
    await createAuthorizedTestBackup(store);
    await store.close();
    store = undefined;
    const before = snapshotTree(fixture.layout.root);
    const first = doctor(fixture);
    const second = doctor(fixture);
    assert.equal(first.health, "healthy");
    assert.deepEqual(second, first);
    assert.deepEqual(snapshotTree(fixture.layout.root), before);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});
