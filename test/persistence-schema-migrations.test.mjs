import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  currentSchemaVersion,
  inspectPrimaryIdentity,
  inspectRuntimeDoctor,
  openPersistence,
  recoverInterruptedRestore,
  restoreBackup,
  verifyBackupGeneration,
} from "../src/index.ts";
import { restoreBackupForTesting } from "../src/persistence/backup.ts";
import { normalizeStandaloneDatabase, openPrimaryDatabase } from "../src/persistence/database.ts";
import {
  readApplicationStateForOwner,
  readDomainForOwner,
  lifecycleAuthorizationSha256,
  readVersionFourApplicationState,
} from "../src/persistence/application-repository.ts";
import {
  canonicalizeMigrationSqlForTesting,
  inspectSchemaEvidence,
  loadMigrationRegistry,
  migrateDatabaseWithRegistryForTesting,
} from "../src/persistence/migrations.ts";
import { canonicalJson, sha256 } from "../src/persistence/values.ts";
import {
  authorizeTestLifecycle,
  cleanupPersistenceFixture,
  createPersistenceFixture,
  createVersionFourDatabase,
  createVersionFourLifecycleDatabase,
  createVersionOneDatabase,
  createVersionThreeDatabase,
  createVersionTwoDatabase,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const V3_CONTENT_PROJECTIONS = Object.freeze({
  application_requests: `SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
    target_revision, result, created_at FROM application_requests ORDER BY request_id`,
  authorization_bootstrap: `SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
    runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id, created_at, expires_at
    FROM authorization_bootstrap ORDER BY singleton`,
  authorization_grants: `SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
    scope_resource_revision, scope_config_revision, not_before, expires_at, revoked_at,
    issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
    FROM authorization_grants ORDER BY grant_id`,
  authorization_decisions: `SELECT decision_id, request_id, actor_id, action, result, reason,
    policy_result, grant_id, grant_revision, project_id, resource_revision, created_at
    FROM authorization_decisions ORDER BY decision_id`,
  application_audit: `SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
    correlation_id, target_kind, target_id, target_revision, reason, details_json, created_at
    FROM application_audit ORDER BY audit_id`,
});

function readV3ContentProjection(database) {
  return Object.fromEntries(
    Object.entries(V3_CONTENT_PROJECTIONS).map(([table, sql]) => [table, database.prepare(sql).all()]),
  );
}

const EXPECTED_MIGRATION_IDENTITIES = Object.freeze([
  Object.freeze({
    checksumSha256: "E31C5A3D24E4DB99620635A9CE83F752978C5FD2AF7A15C84CE13BEECAC9C34F",
    lineEnding: "crlf",
  }),
  Object.freeze({
    checksumSha256: "0FC2DEECBC8ABBA31F9E5063A870706320F66C5AEE882E4A05DA0CADCF9CEC7E",
    lineEnding: "crlf",
  }),
  Object.freeze({
    checksumSha256: "58D428B10198B7483ECB6CED2F88D8DA81A97B052CF650ED4CD012D7183F0702",
    lineEnding: "crlf",
  }),
  Object.freeze({
    checksumSha256: "3446455B4A49C2339EC22E6B99FFF5DD43908D0BEB45EFCE099A79D732CF6557",
    lineEnding: "lf",
  }),
  Object.freeze({
    checksumSha256: "27AB1730F5A56A2127479C02570068E6BA1CA3DB565147FB0325AAA412CD5C81",
    lineEnding: "lf",
  }),
  Object.freeze({
    checksumSha256: "5D072BF264E579F011D85FF017EF595B93D9CA6FD18400830AC1E0A1ACCFFD87",
    lineEnding: "lf",
  }),
]);

test("committed migration registry canonicalizes LF and CRLF transport to released bytes", () => {
  const registry = loadMigrationRegistry();
  assert.equal(currentSchemaVersion(), 6);
  assert.deepEqual(
    registry.map(({ version, id, fileName }) => ({ version, id, fileName })),
    [
      { version: 1, id: "persistence-metadata", fileName: "0001-persistence-metadata.sql" },
      { version: 2, id: "phase1-task-storage", fileName: "0002-phase1-task-storage.sql" },
      { version: 3, id: "phase1-application", fileName: "0003-phase1-application.sql" },
      { version: 4, id: "phase1-product-cli", fileName: "0004-phase1-cli.sql" },
      { version: 5, id: "phase2-execution-claim", fileName: "0005-phase2-execution-claim.sql" },
      { version: 6, id: "phase2-manual-execution", fileName: "0006-phase2-manual-execution.sql" },
    ],
  );
  for (const [index, migration] of registry.entries()) {
    const expected = EXPECTED_MIGRATION_IDENTITIES[index];
    assert.ok(expected);
    const raw = readFileSync(path.join(import.meta.dirname, "..", "migrations", migration.fileName), "utf8");
    const lfTransport = raw.replaceAll("\r\n", "\n");
    const crlfTransport = lfTransport.replaceAll("\n", "\r\n");
    const fromLf = canonicalizeMigrationSqlForTesting(migration.version, Buffer.from(lfTransport, "utf8"));
    const fromCrlf = canonicalizeMigrationSqlForTesting(migration.version, Buffer.from(crlfTransport, "utf8"));
    assert.equal(fromLf, fromCrlf);
    assert.equal(migration.sql, fromLf);
    assert.equal(migration.checksumSha256, expected.checksumSha256);
    assert.equal(sha256(migration.sql), expected.checksumSha256);
    assert.equal(migration.sql.includes("\r\n"), expected.lineEnding === "crlf");
    if (expected.lineEnding === "lf") assert.equal(migration.sql.includes("\r"), false);
    assert.equal(Object.isFrozen(migration), true);
  }
});

test("migration source canonicalization rejects noncanonical transport before SQLite mutation", () => {
  const raw = readFileSync(path.join(import.meta.dirname, "..", "migrations", "0004-phase1-cli.sql"), "utf8");
  const lf = raw.replaceAll("\r\n", "\n");
  const firstBreak = lf.indexOf("\n");
  assert.notEqual(firstBreak, -1);
  const invalidSources = [
    Buffer.from("", "utf8"),
    Buffer.from(`\uFEFF${lf}`, "utf8"),
    Buffer.from(lf.slice(0, -1), "utf8"),
    Buffer.from(`${lf.slice(0, firstBreak)}\r${lf.slice(firstBreak + 1)}`, "utf8"),
    Buffer.from(`${lf.slice(0, firstBreak)}\r\n${lf.slice(firstBreak + 1)}`, "utf8"),
    Buffer.from(lf.replace("PRAGMA defer_foreign_keys=ON;", "PRAGMA defer_foreign_keys=OFF;"), "utf8"),
  ];
  for (const source of invalidSources) {
    assert.throws(
      () => canonicalizeMigrationSqlForTesting(4, source),
      (error) => expectPersistenceError(error, "MIGRATION_CHECKSUM_MISMATCH"),
    );
  }
});

test("fresh initialization atomically applies the complete staged schema", async () => {
  const fixture = createPersistenceFixture("migration-fresh");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "fresh" });
    assert.deepEqual(store.migration.appliedVersions, [1, 2, 3, 4, 5, 6]);
    assert.equal(store.migration.migratedFrom, 0);
    assert.equal(store.migration.preUpgradeBackupGeneration, null);
    assert.equal(store.migration.history.length, 6);
    const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    try {
      const tables = database
        .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map((row) => row.name);
      assert.deepEqual(tables, [
        "application_audit",
        "application_lifecycle_authorizations",
        "application_lifecycle_digest_v6",
        "application_requests",
        "authorization_bootstrap",
        "authorization_capability_epochs",
        "authorization_capability_epochs_v6",
        "authorization_decisions",
        "authorization_grants",
        "authorization_grants_v6",
        "authorization_local_identity",
        "execution_attempts",
        "execution_authorization_decisions",
        "execution_finalizations",
        "execution_observations",
        "execution_operation_audit",
        "execution_operation_intents",
        "execution_operation_requests",
        "execution_terminal_states",
        "execution_verified_receipts",
        "manual_backend_operations",
        "manual_backend_turns",
        "manual_completion_decisions",
        "migration_history",
        "project_registry",
        "projects",
        "schema_metadata",
        "task_dependencies",
        "task_execution_sequences",
        "tasks",
      ]);
      assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(
        database.prepare("SELECT count(*) AS count FROM pragma_table_info('authorization_grants') WHERE name='source_grant_id'").get().count,
        1,
      );
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, 6);
    } finally {
      database.close();
    }
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("a nonempty unowned SQLite schema is never reclassified as fresh", async () => {
  const fixture = createPersistenceFixture("migration-unowned-schema");
  try {
    const database = new DatabaseSync(fixture.layout.databasePath);
    database.exec("CREATE VIEW unexpected AS SELECT 1 AS value");
    database.close();
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "refuse" }),
      (error) => expectPersistenceError(error, "MIGRATION_HISTORY_MISMATCH"),
    );
    const inspection = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    assert.equal(
      inspection.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE name='schema_metadata'").get().count,
      0,
    );
    inspection.close();
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("every shipped earlier prefix upgrades only after a verified pre-upgrade backup", async () => {
  const fixture = createPersistenceFixture("migration-upgrade");
  let store;
  try {
    createVersionOneDatabase(fixture.layout);
    store = await openPersistence(fixture.layout, { applicationVersion: "upgrade" });
    assert.deepEqual(store.migration.appliedVersions, [2, 3, 4, 5, 6]);
    assert.equal(store.migration.migratedFrom, 1);
    assert.ok(store.migration.preUpgradeBackupGeneration);
    const generation = verifyBackupGeneration(
      fixture.layout,
      store.migration.preUpgradeBackupGeneration,
    );
    assert.equal(generation.manifest.kind, "pre_upgrade");
    assert.equal(generation.manifest.sourceSchemaVersion, 1);
    assert.equal(store.migration.schemaVersion, 6);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("the released schema-v2 prefix upgrades through v6 without fabricating ProjectRegistry or execution identity", async () => {
  const fixture = createPersistenceFixture("migration-v2-upgrade");
  let store;
  try {
    createVersionTwoDatabase(fixture.layout);
    store = await openPersistence(fixture.layout, { applicationVersion: "upgrade-v3" });
    assert.deepEqual(store.migration.appliedVersions, [3, 4, 5, 6]);
    assert.equal(store.migration.migratedFrom, 2);
    assert.ok(store.migration.preUpgradeBackupGeneration);
    assert.deepEqual(readDomainForOwner(store), { projects: [{ id: "legacy-project", enabled: true }], tasks: [] });
    const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    assert.equal(database.prepare("SELECT count(*) AS count FROM project_registry").get().count, 0);
    database.close();
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("the released schema-v3 prefix upgrades through v6 with byte-semantic application content and no fabricated authority", async () => {
  const fixture = createPersistenceFixture("migration-v3-upgrade");
  let store;
  try {
    createVersionThreeDatabase(fixture.layout);
    const beforeDatabase = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    const before = readV3ContentProjection(beforeDatabase);
    beforeDatabase.close();

    store = await openPersistence(fixture.layout, { applicationVersion: "upgrade-v4" });
    assert.deepEqual(store.migration.appliedVersions, [4, 5, 6]);
    assert.equal(store.migration.migratedFrom, 3);
    assert.ok(store.migration.preUpgradeBackupGeneration);
    const backup = verifyBackupGeneration(fixture.layout, store.migration.preUpgradeBackupGeneration);
    assert.equal(backup.manifest.kind, "pre_upgrade");
    assert.equal(backup.manifest.sourceSchemaVersion, 3);
    const state = readApplicationStateForOwner(store);
    assert.equal(state.bootstrap?.vocabularyVersion, 3);
    assert.equal(state.identity, null);
    assert.deepEqual(state.epochs, []);
    assert.deepEqual(state.lifecycle, []);
    assert.equal(state.grants.length, 15);

    const afterDatabase = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    assert.deepEqual(readV3ContentProjection(afterDatabase), before);
    assert.equal(afterDatabase.prepare("SELECT vocabulary_version FROM authorization_bootstrap").get().vocabulary_version, 3);
    assert.equal(afterDatabase.prepare("SELECT count(*) AS count FROM authorization_grants WHERE capability_epoch_id IS NOT NULL").get().count, 0);
    assert.deepEqual(afterDatabase.prepare("PRAGMA foreign_key_check").all(), []);
    afterDatabase.close();
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("the released schema-v4 prefix upgrades additively through v6 without manufacturing execution authority or attempts", async () => {
  const fixture = createPersistenceFixture("migration-v4-upgrade");
  let store;
  try {
    createVersionFourDatabase(fixture.layout);
    store = await openPersistence(fixture.layout, { applicationVersion: "upgrade-v5" });
    assert.deepEqual(store.migration.appliedVersions, [5, 6]);
    assert.equal(store.migration.migratedFrom, 4);
    assert.ok(store.migration.preUpgradeBackupGeneration);
    const backup = verifyBackupGeneration(fixture.layout, store.migration.preUpgradeBackupGeneration);
    assert.equal(backup.manifest.kind, "pre_upgrade");
    assert.equal(backup.manifest.sourceSchemaVersion, 4);
    assert.equal(backup.manifest.sourceHistory.length, 4);
    const state = readApplicationStateForOwner(store);
    assert.equal(state.bootstrap, null);
    assert.deepEqual(state.executionSequences, []);
    assert.deepEqual(state.executions, []);
    assert.equal(state.grants.some((grant) => grant.action.startsWith("execution.")), false);
    const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    assert.equal(database.prepare("SELECT count(*) AS count FROM task_execution_sequences").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM execution_attempts").get().count, 0);
    assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    database.close();
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("populated schema-v4 lifecycle digests and manual backup provenance remain readable through v6 migration", async () => {
  const fixture = createPersistenceFixture("migration-v4-lifecycle-digest");
  let store;
  try {
    const legacy = createVersionFourLifecycleDatabase(fixture.layout);
    const doctor = inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot);
    assert.equal(doctor.health, "upgrade_required");
    assert.equal(doctor.initialized, true);
    assert.equal(doctor.schemaVersion, 4);

    const sourceDatabase = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    const evidence = inspectSchemaEvidence(sourceDatabase);
    const sourceState = readVersionFourApplicationState(sourceDatabase);
    const independentlyProjectedV4Digest = sha256(canonicalJson({
      audit: sourceState.audit,
      bootstrap: sourceState.bootstrap,
      decisions: sourceState.decisions,
      domain: sourceState.domain,
      epochs: sourceState.epochs,
      grants: sourceState.grants,
      identity: sourceState.identity,
      registry: sourceState.projects,
      requests: sourceState.requests,
    }));
    assert.equal(legacy.authorizedStateSha256, independentlyProjectedV4Digest);
    const authorization = sourceState.lifecycle.find(
      (candidate) => candidate.authorizationId === legacy.authorizationId,
    );
    assert.ok(authorization);
    assert.equal(authorization.authorizedStateSha256, legacy.authorizedStateSha256);
    sourceDatabase.close();

    const generationDirectory = path.join(fixture.layout.backupGenerationsRoot, legacy.generationId);
    mkdirSync(generationDirectory);
    const backupDatabasePath = path.join(generationDirectory, "state.sqlite3");
    copyFileSync(fixture.layout.databasePath, backupDatabasePath);
    normalizeStandaloneDatabase(backupDatabasePath);
    const databaseBytes = readFileSync(backupDatabasePath);
    const manifest = {
      schemaVersion: 2,
      generationId: legacy.generationId,
      kind: "manual",
      databaseFile: "state.sqlite3",
      databaseLength: databaseBytes.byteLength,
      databaseSha256: sha256(databaseBytes),
      sourceSchemaVersion: evidence.schemaVersion,
      sourceRegistryIdentity: evidence.registryIdentity,
      sourceSchemaFingerprint: evidence.schemaFingerprint,
      sourceHistory: evidence.history,
      applicationVersion: "historical-v4",
      createdAt: "2026-01-01T00:00:01.000Z",
      provenanceKind: "application",
      lifecycleAuthorizationId: authorization.authorizationId,
      lifecycleAuthorizationSha256: lifecycleAuthorizationSha256(authorization),
      sourceApplicationStateSha256: legacy.authorizedStateSha256,
    };
    writeFileSync(path.join(generationDirectory, "manifest.json"), canonicalJson(manifest), { encoding: "utf8" });
    const verified = verifyBackupGeneration(fixture.layout, legacy.generationId);
    assert.equal(verified.manifest.sourceSchemaVersion, 4);
    assert.equal(verified.manifest.sourceApplicationStateSha256, legacy.authorizedStateSha256);

    store = await openPersistence(fixture.layout, { applicationVersion: "upgrade-populated-v4" });
    assert.deepEqual(store.migration.appliedVersions, [5, 6]);
    const migrated = readApplicationStateForOwner(store);
    assert.equal(migrated.lifecycle.length, 1);
    assert.equal(migrated.lifecycle[0]?.authorizedStateSha256, legacy.authorizedStateSha256);
    assert.deepEqual(migrated.executionSequences, []);
    assert.deepEqual(migrated.executions, []);
    await store.close();
    store = undefined;
    const migratedDatabase = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    const digestRows = migratedDatabase.prepare(
      "SELECT authorization_id, state_digest_version FROM application_lifecycle_authorizations",
    ).all().map((row) => ({
      authorization_id: row.authorization_id,
      state_digest_version: row.state_digest_version,
    }));
    migratedDatabase.close();
    assert.deepEqual(
      digestRows,
      [{ authorization_id: legacy.authorizationId, state_digest_version: 1 }],
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("migrated schema-v4 lifecycle digest provenance survives current-v6 backup and direct or recovered restore", async () => {
  for (const mode of ["direct", "recover-after-publish"]) {
    const fixture = createPersistenceFixture(`migration-v4-lifecycle-${mode}`);
    let store;
    try {
      const issuedAtMillis = Date.now() - 5_000;
      const legacy = createVersionFourLifecycleDatabase(
        fixture.layout,
        `v4-lifecycle-${mode}`,
        {
          backupAt: new Date(issuedAtMillis).toISOString(),
          authorizationExpiresAt: new Date(issuedAtMillis + 5 * 60 * 1000).toISOString(),
        },
      );
      store = await openPersistence(fixture.layout, { applicationVersion: `upgrade-v4-lifecycle-${mode}` });
      assert.deepEqual(store.migration.appliedVersions, [5, 6]);
      const migrated = readApplicationStateForOwner(store);
      const authorization = migrated.lifecycle.find(
        (candidate) => candidate.authorizationId === legacy.authorizationId,
      );
      assert.ok(authorization);

      const backup = await store.createBackup(authorization);
      assert.equal(backup.generationId, legacy.generationId);
      assert.equal(backup.manifest.sourceSchemaVersion, 6);
      assert.equal(backup.manifest.sourceApplicationStateSha256, legacy.authorizedStateSha256);

      const verified = verifyBackupGeneration(fixture.layout, legacy.generationId);
      assert.equal(verified.manifest.sourceSchemaVersion, 6);
      assert.equal(verified.manifest.sourceApplicationStateSha256, legacy.authorizedStateSha256);

      const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", legacy.generationId);
      await store.close();
      store = undefined;
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
      const request = {
        generationId: legacy.generationId,
        expectedCurrent,
        acknowledgeDataLoss: true,
        applicationVersion: `restore-v4-lifecycle-${mode}`,
        authorization: restoreAuthorization,
      };
      let receipt;
      if (mode === "direct") {
        receipt = await restoreBackup(fixture.layout, request);
      } else {
        let restoreId;
        await assert.rejects(
          restoreBackupForTesting(
            fixture.layout,
            request,
            { afterPublish: () => { throw new Error("interrupt migrated digest restore"); } },
          ),
          (error) => {
            expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED");
            restoreId = error.details.restoreId;
            return true;
          },
        );
        assert.ok(restoreId);
        receipt = await recoverInterruptedRestore(fixture.layout);
        assert.equal(receipt.restoreId, restoreId);
      }
      assert.equal(receipt.backupGenerationId, legacy.generationId);

      store = await openPersistence(fixture.layout, { applicationVersion: `read-v4-lifecycle-${mode}` });
      const restored = readApplicationStateForOwner(store);
      assert.equal(restored.lifecycle.length, 1);
      assert.equal(restored.lifecycle[0]?.authorizationId, legacy.authorizationId);
      assert.equal(restored.lifecycle[0]?.authorizedStateSha256, legacy.authorizedStateSha256);
      assert.deepEqual(restored.executionSequences, []);
      assert.deepEqual(restored.executions, []);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("semantic schema-v3 application corruption is rejected before backup or writable migration", async () => {
  const fixture = createPersistenceFixture("migration-v3-semantic-corruption");
  try {
    createVersionThreeDatabase(
      fixture.layout,
      "corrupt-v3-application",
      { inspectDecisionGrantMismatch: true },
    );
    const primaryBefore = readFileSync(fixture.layout.databasePath);
    const generationsBefore = readdirSync(fixture.layout.backupGenerationsRoot);
    const stagingBefore = readdirSync(fixture.layout.backupStagingRoot);

    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "must-not-migrate-corrupt-v3" }),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );

    assert.deepEqual(readFileSync(fixture.layout.databasePath), primaryBefore);
    assert.deepEqual(readdirSync(fixture.layout.backupGenerationsRoot), generationsBefore);
    assert.deepEqual(readdirSync(fixture.layout.backupStagingRoot), stagingBefore);
    const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    assert.equal(database.prepare("PRAGMA user_version").get().user_version, 3);
    assert.equal(database.prepare("SELECT count(*) AS count FROM migration_history").get().count, 3);
    database.close();
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("schema-v4 identity, epoch, and lifecycle relations have exact mandatory columns and reject every explicit NULL atomically", async () => {
  const fixture = createPersistenceFixture("migration-v4-null-matrix");
  let store;
  try {
    createVersionThreeDatabase(fixture.layout);
    store = await openPersistence(fixture.layout, { applicationVersion: "upgrade-v4-null-matrix" });
    await store.close();
    store = undefined;

    const database = new DatabaseSync(fixture.layout.databasePath);
    database.exec("PRAGMA foreign_keys=ON");
    const relationColumns = Object.freeze({
      authorization_local_identity: Object.freeze([
        ["singleton", "INTEGER", 1, 1],
        ["identity_version", "INTEGER", 1, 0],
        ["actor_id", "TEXT", 1, 0],
        ["principal_sha256", "TEXT", 1, 0],
        ["platform", "TEXT", 1, 0],
        ["runtime_root_key", "TEXT", 1, 0],
        ["bootstrap_request_id", "TEXT", 1, 0],
        ["adoption_request_id", "TEXT", 1, 0],
        ["created_at", "TEXT", 1, 0],
      ]),
      authorization_capability_epochs: Object.freeze([
        ["epoch_id", "TEXT", 1, 1],
        ["epoch_revision", "INTEGER", 1, 0],
        ["actor_id", "TEXT", 1, 0],
        ["runtime_root_key", "TEXT", 1, 0],
        ["vocabulary_version", "INTEGER", 1, 0],
        ["action_set_sha256", "TEXT", 1, 0],
        ["request_id", "TEXT", 1, 0],
        ["created_at", "TEXT", 1, 0],
        ["expires_at", "TEXT", 1, 0],
      ]),
      application_lifecycle_authorizations: Object.freeze([
        ["authorization_id", "TEXT", 1, 1],
        ["operation", "TEXT", 1, 0],
        ["backup_generation_id", "TEXT", 1, 0],
        ["actor_id", "TEXT", 1, 0],
        ["runtime_root_key", "TEXT", 1, 0],
        ["grant_id", "TEXT", 1, 0],
        ["grant_revision", "INTEGER", 1, 0],
        ["request_id", "TEXT", 1, 0],
        ["decision_id", "TEXT", 1, 0],
        ["audit_id", "TEXT", 1, 0],
        ["authorized_state_sha256", "TEXT", 1, 0],
        ["state_digest_version", "INTEGER", 1, 0],
        ["expected_request_count", "INTEGER", 1, 0],
        ["expected_decision_count", "INTEGER", 1, 0],
        ["expected_audit_count", "INTEGER", 1, 0],
        ["issued_at", "TEXT", 1, 0],
        ["expires_at", "TEXT", 1, 0],
      ]),
    });
    for (const [table, expected] of Object.entries(relationColumns)) {
      assert.deepEqual(
        database.prepare(`PRAGMA table_info('${table}')`).all().map((row) => [row.name, row.type, row.notnull, row.pk]),
        expected,
      );
      const tableList = database.prepare("PRAGMA table_list").all().find((row) => row.name === table);
      assert.equal(tableList?.strict, 1);
      assert.equal(tableList?.wr, table === "authorization_local_identity" ? 1 : 0);
      const triggerNames = database.prepare(
        "SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name=? ORDER BY name",
      ).all(table).map((row) => row.name);
      assert.deepEqual(triggerNames, [`${table}_no_delete`, `${table}_no_update`]);
    }

    const bootstrap = database.prepare(
      "SELECT actor_id, runtime_root_key, request_id, created_at FROM authorization_bootstrap",
    ).get();
    const beforeCounts = Object.freeze({
      requests: database.prepare("SELECT count(*) AS count FROM application_requests").get().count,
      decisions: database.prepare("SELECT count(*) AS count FROM authorization_decisions").get().count,
      audit: database.prepare("SELECT count(*) AS count FROM application_audit").get().count,
      grants: database.prepare("SELECT count(*) AS count FROM authorization_grants").get().count,
    });
    const assertNullMatrix = (table, columns, validValues) => {
      const statement = database.prepare(
        `INSERT INTO ${table}(${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      );
      for (let index = 0; index < columns.length; index += 1) {
        const values = [...validValues];
        values[index] = null;
        assert.throws(() => statement.run(...values), { name: "Error" }, `${table}.${columns[index]} accepted NULL`);
        assert.equal(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count, 0);
      }
    };

    const identityColumns = relationColumns.authorization_local_identity.map(([name]) => name);
    const identityValues = [
      1, 1, bootstrap.actor_id, "A".repeat(64), "win32", bootstrap.runtime_root_key,
      bootstrap.request_id, bootstrap.request_id, bootstrap.created_at,
    ];
    assertNullMatrix("authorization_local_identity", identityColumns, identityValues);
    database.prepare(
      `INSERT INTO authorization_local_identity(${identityColumns.join(", ")})
       VALUES (${identityColumns.map(() => "?").join(", ")})`,
    ).run(...identityValues);

    const epochColumns = relationColumns.authorization_capability_epochs.map(([name]) => name);
    assertNullMatrix("authorization_capability_epochs", epochColumns, [
      "v4-null-epoch", 1, bootstrap.actor_id, bootstrap.runtime_root_key, 4,
      "B".repeat(64), bootstrap.request_id, bootstrap.created_at, "2099-01-01T00:00:00.000Z",
    ]);

    const lifecycleColumns = relationColumns.application_lifecycle_authorizations.map(([name]) => name);
    assertNullMatrix("application_lifecycle_authorizations", lifecycleColumns, [
      "v4-null-lifecycle", "runtime.backup", "11111111-1111-4111-8111-111111111111",
      bootstrap.actor_id, bootstrap.runtime_root_key, "v3-grant-01", 1,
      "v3-inspect-request", "v3-inspect-decision", "v3-inspect-audit", "C".repeat(64),
      2, 2, 1, 2, "2026-01-01T00:00:01.000Z", "2026-01-01T00:05:01.000Z",
    ]);

    assert.equal(database.prepare("SELECT count(*) AS count FROM authorization_local_identity").get().count, 1);
    assert.equal(database.prepare("SELECT count(*) AS count FROM authorization_capability_epochs").get().count, 0);
    assert.equal(database.prepare("SELECT count(*) AS count FROM application_lifecycle_authorizations").get().count, 0);
    assert.deepEqual({
      requests: database.prepare("SELECT count(*) AS count FROM application_requests").get().count,
      decisions: database.prepare("SELECT count(*) AS count FROM authorization_decisions").get().count,
      audit: database.prepare("SELECT count(*) AS count FROM application_audit").get().count,
      grants: database.prepare("SELECT count(*) AS count FROM authorization_grants").get().count,
    }, beforeCounts);
    database.close();
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("migration 0004 content assertions roll back a same-count projection rewrite", async () => {
  const fixture = createPersistenceFixture("migration-v4-content-assertion");
  try {
    createVersionThreeDatabase(fixture.layout);
    const database = openPrimaryDatabase(fixture.layout.databasePath);
    try {
      const before = readV3ContentProjection(database);
      const registry = loadMigrationRegistry();
      const shipped = registry[3];
      assert.ok(shipped);
      const originalCopy = `SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
  target_revision, result, created_at
FROM application_requests_v3;`;
      const rewrittenCopy = `SELECT request_id, correlation_id || '-tampered', actor_id, action, target_kind, target_id,
  target_revision, result, created_at
FROM application_requests_v3;`;
      const sql = shipped.sql.replace(originalCopy, rewrittenCopy);
      assert.notEqual(sql, shipped.sql);
      const altered = Object.freeze([
        ...registry.slice(0, 3),
        Object.freeze({ ...shipped, checksumSha256: sha256(sql), sql }),
      ]);
      await assert.rejects(
        migrateDatabaseWithRegistryForTesting(
          database,
          { applicationVersion: "content-assertion", beforeUpgrade: async () => "verified-test-generation" },
          altered,
        ),
        (error) => expectPersistenceError(error, "MIGRATION_FAILED"),
      );
      assert.equal(inspectSchemaEvidence(database).schemaVersion, 3);
      assert.deepEqual(readV3ContentProjection(database), before);
      assert.equal(database.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE name='authorization_local_identity'").get().count, 0);
    } finally {
      database.close();
    }
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("a failed appended migration rolls back atomically and the shipped registry restarts cleanly", async () => {
  const fixture = createPersistenceFixture("migration-failure");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "base" });
    await store.close();
    store = undefined;
    const database = openPrimaryDatabase(fixture.layout.databasePath);
    try {
      const registry = loadMigrationRegistry();
      const sql = "CREATE TABLE should_rollback(value TEXT) STRICT; INSERT INTO missing_table VALUES (1);\n";
      const extended = Object.freeze([
        ...registry,
        Object.freeze({
          version: 7,
          id: "deliberate-test-failure",
          fileName: "test-only-invalid.sql",
          checksumSha256: sha256(sql),
          sql,
        }),
      ]);
      await assert.rejects(
        migrateDatabaseWithRegistryForTesting(
          database,
          { applicationVersion: "failure", beforeUpgrade: async () => "verified-test-generation" },
          extended,
        ),
        (error) => expectPersistenceError(error, "MIGRATION_FAILED"),
      );
      assert.equal(
        database.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE name='should_rollback'").get().count,
        0,
      );
      assert.equal(inspectSchemaEvidence(database).schemaVersion, 6);
    } finally {
      database.close();
    }
    store = await openPersistence(fixture.layout, { applicationVersion: "restart" });
    assert.deepEqual(store.migration.appliedVersions, []);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

const mismatchCases = [
  {
    name: "checksum mismatch",
    code: "MIGRATION_CHECKSUM_MISMATCH",
    mutate(database) {
      database.prepare("UPDATE migration_history SET checksum_sha256=? WHERE version=2").run("0".repeat(64));
    },
  },
  {
    name: "missing history",
    code: "MIGRATION_HISTORY_MISMATCH",
    mutate(database) {
      database.prepare("DELETE FROM migration_history WHERE version=2").run();
    },
  },
  {
    name: "noncanonical history timestamp",
    code: "MIGRATION_HISTORY_MISMATCH",
    mutate(database) {
      database.prepare("UPDATE migration_history SET applied_at='not-utc' WHERE version=2").run();
      database.prepare("UPDATE schema_metadata SET updated_at='not-utc' WHERE singleton=1").run();
    },
  },
  {
    name: "unknown migration identity",
    code: "MIGRATION_HISTORY_MISMATCH",
    mutate(database) {
      database.prepare("UPDATE migration_history SET migration_id='unknown' WHERE version=2").run();
    },
  },
  {
    name: "live schema drift",
    code: "MIGRATION_HISTORY_MISMATCH",
    mutate(database) {
      database.exec("DROP INDEX tasks_project_id_index");
    },
  },
  {
    name: "newer schema",
    code: "SCHEMA_NEWER",
    mutate(database) {
      database.prepare("UPDATE schema_metadata SET schema_version=7 WHERE singleton=1").run();
      database.exec("PRAGMA user_version=6");
    },
  },
];

for (const mismatch of mismatchCases) {
  test(`open refuses ${mismatch.name} before normal persistence access`, async () => {
    const fixture = createPersistenceFixture(`migration-${mismatch.name.replaceAll(" ", "-")}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "seed" });
      await store.close();
      store = undefined;
      const database = new DatabaseSync(fixture.layout.databasePath);
      database.exec("PRAGMA foreign_keys=ON");
      mismatch.mutate(database);
      database.close();
      const corruptedBytes = readFileSync(fixture.layout.databasePath);
      await assert.rejects(
        openPersistence(fixture.layout, { applicationVersion: "refuse" }),
        (error) => expectPersistenceError(error, mismatch.code),
      );
      assert.deepEqual(readFileSync(fixture.layout.databasePath), corruptedBytes);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}
