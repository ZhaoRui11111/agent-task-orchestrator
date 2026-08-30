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
  inspectPrimaryIdentity,
  inspectRuntimeDoctor,
  openPersistence,
} from "../src/index.ts";
import { restoreBackupForTesting } from "../src/persistence/backup.ts";
import {
  authorizeTestLifecycle,
  cleanupPersistenceFixture,
  createAuthorizedTestBackup,
  createPersistenceFixture,
  createVersionOneDatabase,
  createVersionThreeDatabase,
  createVersionThreeDomainDatabase,
  createVersionTwoDatabase,
} from "./persistence-test-helpers.mjs";

const TEST_PRINCIPAL_SHA256 = "A".repeat(64);

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

test("doctor reports every shipped schema prefix and preserves exact v3 historical bytes", () => {
  const cases = [
    ["v1", createVersionOneDatabase, false, 1],
    ["v2", createVersionTwoDatabase, false, 2],
    ["v3-domain", (layout) => createVersionThreeDomainDatabase(layout, "doctor-v3-domain", "legacy-project"), false, 3],
    ["v3-application", createVersionThreeDatabase, true, 3],
  ];
  for (const [label, create, initialized, version] of cases) {
    const fixture = createPersistenceFixture(`doctor-${label}`);
    try {
      create(fixture.layout);
      const before = snapshotTree(fixture.layout.root);
      assert.deepEqual(doctor(fixture), {
        health: "upgrade_required",
        initialized,
        schemaVersion: version,
        activeUse: false,
        backupInventory: "empty",
        restoreState: "none",
      });
      assert.deepEqual(snapshotTree(fixture.layout.root), before);
      const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, version);
      database.close();
    } finally {
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("doctor distinguishes schema-v4 Domain-only, pre-adoption, healthy, and active states", async () => {
  const domainFixture = createPersistenceFixture("doctor-v4-domain");
  const adoptionFixture = createPersistenceFixture("doctor-v4-preadoption");
  const healthyFixture = createPersistenceFixture("doctor-v4-healthy");
  let domainStore;
  let adoptionStore;
  let healthyStore;
  try {
    createVersionThreeDomainDatabase(domainFixture.layout, "doctor-v4-domain", "legacy-project");
    domainStore = await openPersistence(domainFixture.layout, { applicationVersion: "doctor-v4-domain" });
    await domainStore.close();
    domainStore = undefined;
    assert.deepEqual(doctor(domainFixture), {
      health: "not_initialized", initialized: false, schemaVersion: 4, activeUse: false,
      backupInventory: "valid", restoreState: "none",
    });

    createVersionThreeDatabase(adoptionFixture.layout);
    adoptionStore = await openPersistence(adoptionFixture.layout, { applicationVersion: "doctor-v4-preadoption" });
    await adoptionStore.close();
    adoptionStore = undefined;
    assert.deepEqual(doctor(adoptionFixture), {
      health: "upgrade_required", initialized: true, schemaVersion: 4, activeUse: false,
      backupInventory: "valid", restoreState: "none",
    });

    healthyStore = await openPersistence(healthyFixture.layout, { applicationVersion: "doctor-v4-healthy" });
    initialize(healthyStore);
    assert.deepEqual(doctor(healthyFixture), {
      health: "runtime_active", initialized: null, schemaVersion: null, activeUse: true,
      backupInventory: "empty", restoreState: "none",
    });
    await healthyStore.close();
    healthyStore = undefined;
    assert.deepEqual(doctor(healthyFixture), {
      health: "healthy", initialized: true, schemaVersion: 4, activeUse: false,
      backupInventory: "empty", restoreState: "none",
    });
  } finally {
    if (domainStore) await domainStore.close();
    if (adoptionStore) await adoptionStore.close();
    if (healthyStore) await healthyStore.close();
    cleanupPersistenceFixture(domainFixture);
    cleanupPersistenceFixture(adoptionFixture);
    cleanupPersistenceFixture(healthyFixture);
  }
});

test("doctor rejects partial schema-v3 application relations as corrupt", () => {
  const fixture = createPersistenceFixture("doctor-v3-partial-application");
  try {
    createVersionThreeDomainDatabase(fixture.layout);
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

test("doctor uses the shared schema-v3 application decoder and never classifies semantic corruption as upgradeable", () => {
  const fixture = createPersistenceFixture("doctor-v3-semantic-corruption");
  try {
    createVersionThreeDatabase(
      fixture.layout,
      "doctor-corrupt-v3-application",
      { inspectDecisionGrantMismatch: true },
    );
    const before = snapshotTree(fixture.layout.root);
    assert.deepEqual(doctor(fixture), {
      health: "state_corrupt",
      initialized: null,
      schemaVersion: 3,
      activeUse: false,
      backupInventory: "empty",
      restoreState: "none",
    });
    assert.deepEqual(snapshotTree(fixture.layout.root), before);
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
    database.prepare("UPDATE schema_metadata SET schema_version=5 WHERE singleton=1").run();
    database.exec("PRAGMA user_version=5");
    database.close();
    assert.deepEqual(doctor(newer), {
      health: "schema_newer", initialized: null, schemaVersion: 5, activeUse: false,
      backupInventory: "empty", restoreState: "none",
    });

    database = new DatabaseSync(migration.layout.databasePath);
    database.prepare("UPDATE migration_history SET checksum_sha256=? WHERE version=2").run("0".repeat(64));
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
    writeFileSync(manifestPath, "{}\n");
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
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(ambiguous);
    cleanupPersistenceFixture(pending);
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
