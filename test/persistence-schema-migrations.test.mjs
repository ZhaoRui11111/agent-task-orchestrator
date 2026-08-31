import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  currentSchemaVersion,
  openPersistence,
} from "../src/index.ts";
import {
  canonicalizeMigrationSqlForTesting,
  inspectSchemaEvidence,
  liveSchemaFingerprint,
  loadMigrationRegistry,
  migrateDatabaseWithRegistryForTesting,
  migrationRegistryIdentity,
} from "../src/persistence/migrations.ts";
import { sha256 } from "../src/persistence/values.ts";
import {
  cleanupPersistenceFixture,
  createCurrentDatabase,
  createIncompatibleDatabase,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const BASELINE_CHECKSUM = "EF756403D6D03EF73208326B0234991CBC4189372121474E6AD97C11BA70F6BD";

const CURRENT_TABLES = Object.freeze([
  "application_audit",
  "application_lifecycle_authorizations",
  "application_requests",
  "authorization_bootstrap",
  "authorization_capability_epochs",
  "authorization_decisions",
  "authorization_grants",
  "authorization_local_identity",
  "dispatcher_audit",
  "dispatcher_authorization_decisions",
  "dispatcher_member_denial_audit",
  "dispatcher_member_denial_decisions",
  "dispatcher_member_denial_requests",
  "dispatcher_members",
  "dispatcher_memberships",
  "dispatcher_reconciliation_items",
  "dispatcher_reconciliation_summaries",
  "dispatcher_run_summaries",
  "dispatcher_runs",
  "dispatcher_trigger_requests",
  "execution_attempts",
  "execution_authorization_decisions",
  "execution_finalizations",
  "execution_intent_authorization_bindings",
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

const CURRENT_INDEXES = Object.freeze([
  "authorization_grants_actor_action_index",
  "authorization_grants_project_index",
  "dispatcher_authorization_decisions_request_index",
  "dispatcher_runs_status_lease_index",
  "execution_attempts_one_active_per_task",
  "execution_attempts_task_order",
  "execution_intents_confirmation_once",
  "execution_intents_execution_order",
  "execution_intents_recovery",
  "manual_backend_operations_turn_order",
  "task_dependencies_dependency_index",
  "tasks_parent_id_index",
  "tasks_project_id_index",
  "tasks_supersedes_task_id_index",
]);

const CURRENT_TRIGGERS = Object.freeze([
  "application_audit_no_delete",
  "application_audit_no_update",
  "application_lifecycle_authorizations_no_delete",
  "application_lifecycle_authorizations_no_update",
  "application_requests_no_delete",
  "application_requests_no_update",
  "authorization_bootstrap_no_delete",
  "authorization_bootstrap_no_update",
  "authorization_capability_epochs_no_delete",
  "authorization_capability_epochs_no_update",
  "authorization_decisions_no_delete",
  "authorization_decisions_no_update",
  "authorization_grants_no_delete",
  "authorization_grants_revoke_only",
  "authorization_local_identity_no_delete",
  "authorization_local_identity_no_update",
  "dispatcher_audit_no_delete",
  "dispatcher_audit_no_update",
  "dispatcher_authorization_decisions_no_delete",
  "dispatcher_authorization_decisions_no_update",
  "dispatcher_member_denial_audit_no_delete",
  "dispatcher_member_denial_audit_no_update",
  "dispatcher_member_denial_decisions_no_delete",
  "dispatcher_member_denial_decisions_no_update",
  "dispatcher_member_denial_requests_no_delete",
  "dispatcher_member_denial_requests_no_update",
  "dispatcher_members_no_delete",
  "dispatcher_members_terminal_guard",
  "dispatcher_memberships_insert_guard",
  "dispatcher_memberships_no_delete",
  "dispatcher_memberships_no_update",
  "dispatcher_reconciliation_items_no_delete",
  "dispatcher_reconciliation_items_no_update",
  "dispatcher_reconciliation_summaries_insert_guard",
  "dispatcher_reconciliation_summaries_no_delete",
  "dispatcher_reconciliation_summaries_no_update",
  "dispatcher_run_summaries_insert_guard",
  "dispatcher_run_summaries_no_delete",
  "dispatcher_run_summaries_no_update",
  "dispatcher_runs_no_delete",
  "dispatcher_runs_update_guard",
  "dispatcher_trigger_requests_no_delete",
  "dispatcher_trigger_requests_no_update",
  "execution_attempts_no_delete",
  "execution_attempts_update_guard",
  "execution_authorization_decisions_no_delete",
  "execution_authorization_decisions_no_update",
  "execution_finalizations_no_delete",
  "execution_finalizations_no_update",
  "execution_intent_authorization_bindings_no_delete",
  "execution_intent_authorization_bindings_no_update",
  "execution_observations_no_delete",
  "execution_observations_no_update",
  "execution_operation_audit_no_delete",
  "execution_operation_audit_no_update",
  "execution_operation_intents_no_delete",
  "execution_operation_intents_transition_guard",
  "execution_operation_requests_no_delete",
  "execution_operation_requests_no_update",
  "execution_terminal_states_no_delete",
  "execution_terminal_states_no_update",
  "execution_verified_receipts_no_delete",
  "execution_verified_receipts_no_update",
  "manual_backend_operations_no_delete",
  "manual_backend_operations_no_update",
  "manual_backend_turns_no_delete",
  "manual_backend_turns_update_guard",
  "manual_completion_decisions_no_delete",
  "manual_completion_decisions_no_update",
  "project_registry_no_delete",
  "task_execution_sequences_increment_only",
  "task_execution_sequences_no_delete",
]);

function userSchemaNames(database, type = null) {
  const where = type === null ? "" : "AND type=?";
  const statement = database.prepare(
    `SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ${where} ORDER BY name`,
  );
  const rows = type === null ? statement.all() : statement.all(type);
  return rows.map((row) => row.name);
}

function mutateDatabase(databasePath, callback) {
  const database = new DatabaseSync(databasePath);
  try {
    callback(database);
  } finally {
    database.close();
  }
}

test("the committed migration registry is one immutable current baseline", () => {
  const registry = loadMigrationRegistry();
  assert.equal(currentSchemaVersion(), 1);
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(registry.length, 1);
  assert.deepEqual(
    registry.map(({ version, id, fileName, checksumSha256 }) => ({
      version,
      id,
      fileName,
      checksumSha256,
    })),
    [{
      version: 1,
      id: "current-baseline",
      fileName: "0001-current-baseline.sql",
      checksumSha256: BASELINE_CHECKSUM,
    }],
  );
  assert.equal(Object.isFrozen(registry[0]), true);
  assert.equal(sha256(registry[0].sql), BASELINE_CHECKSUM);
  assert.equal(registry[0].sql.includes("\r"), false);
  assert.match(migrationRegistryIdentity(registry), /^[0-9A-F]{64}$/u);

  const raw = readFileSync(path.join(import.meta.dirname, "..", "migrations", registry[0].fileName), "utf8");
  const lfTransport = raw.replaceAll("\r\n", "\n");
  const crlfTransport = lfTransport.replaceAll("\n", "\r\n");
  assert.equal(canonicalizeMigrationSqlForTesting(1, Buffer.from(lfTransport)), registry[0].sql);
  assert.equal(canonicalizeMigrationSqlForTesting(1, Buffer.from(crlfTransport)), registry[0].sql);
});

test("baseline source canonicalization rejects noncanonical or changed bytes", () => {
  const raw = readFileSync(
    path.join(import.meta.dirname, "..", "migrations", "0001-current-baseline.sql"),
    "utf8",
  );
  const firstBreak = raw.indexOf("\n");
  assert.notEqual(firstBreak, -1);
  const invalidSources = [
    Buffer.from(""),
    Buffer.from(`\uFEFF${raw}`),
    Buffer.from(raw.slice(0, -1)),
    Buffer.from(`${raw.slice(0, firstBreak)}\r${raw.slice(firstBreak + 1)}`),
    Buffer.from(`${raw.slice(0, firstBreak)}\r\n${raw.slice(firstBreak + 1).replace("\n", "\r\n")}`),
    Buffer.from(raw.replace("CREATE TABLE schema_metadata", "CREATE TABLE changed_schema_metadata")),
  ];
  for (const source of invalidSources) {
    assert.throws(
      () => canonicalizeMigrationSqlForTesting(1, source),
      (error) => expectPersistenceError(error, "MIGRATION_CHECKSUM_MISMATCH"),
    );
  }
  assert.throws(
    () => canonicalizeMigrationSqlForTesting(2, Buffer.from(raw)),
    (error) => expectPersistenceError(error, "INVALID_INPUT"),
  );
});

test("fresh initialization atomically creates the exact current schema", async () => {
  const fixture = createPersistenceFixture("migration-fresh-current");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "fresh-current" });
    const migration = store.migration;
    assert.equal(migration.createdFresh, true);
    assert.deepEqual(migration.appliedVersions, [1]);
    assert.equal(migration.schemaVersion, 1);
    assert.equal(migration.history.length, 1);
    assert.equal(migration.history[0].version, 1);
    assert.equal(migration.history[0].migrationId, "current-baseline");
    assert.equal(migration.history[0].checksumSha256, BASELINE_CHECKSUM);
    await store.close();
    store = undefined;

    const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    try {
      assert.deepEqual(userSchemaNames(database, "table"), CURRENT_TABLES);
      assert.deepEqual(userSchemaNames(database, "index"), CURRENT_INDEXES);
      assert.deepEqual(userSchemaNames(database, "trigger"), CURRENT_TRIGGERS);
      const allNames = userSchemaNames(database);
      assert.deepEqual(
        allNames.filter((name) => /(?:_v[1-7](?:_|$)|legacy|authorization_grant_epoch)/iu.test(name)),
        [],
      );
      assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, 1);
      const metadata = database
        .prepare("SELECT schema_version, domain_initialized, registry_identity, schema_fingerprint FROM schema_metadata WHERE singleton=1")
        .get();
      assert.deepEqual({ ...metadata }, {
        schema_version: 1,
        domain_initialized: 0,
        registry_identity: migrationRegistryIdentity(loadMigrationRegistry()),
        schema_fingerprint: liveSchemaFingerprint(database),
      });
      assert.match(
        database.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='application_lifecycle_authorizations'").get().sql,
        /state_digest_version\s*=\s*4/u,
      );
    } finally {
      database.close();
    }
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("a current database reopens without migration or identity drift", async () => {
  const fixture = createPersistenceFixture("migration-current-reopen");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "create" });
    const initialIdentity = store.migration.registryIdentity;
    const initialFingerprint = store.migration.schemaFingerprint;
    await store.close();
    store = await openPersistence(fixture.layout, { applicationVersion: "reopen" });
    assert.equal(store.migration.createdFresh, false);
    assert.deepEqual(store.migration.appliedVersions, []);
    assert.equal(store.migration.schemaVersion, 1);
    assert.equal(store.migration.registryIdentity, initialIdentity);
    assert.equal(store.migration.schemaFingerprint, initialFingerprint);
    assert.equal(store.migration.history.length, 1);
    assert.equal(store.migration.history[0].applicationVersion, "create");
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("a nonempty incompatible database is refused before mutation or backup", async () => {
  const fixture = createPersistenceFixture("migration-incompatible");
  try {
    createIncompatibleDatabase(fixture.layout);
    const beforeBytes = readFileSync(fixture.layout.databasePath);
    const beforeRoot = readdirSync(fixture.layout.root).sort();
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "must-refuse" }),
      (error) => expectPersistenceError(error, "MIGRATION_HISTORY_MISMATCH"),
    );
    assert.deepEqual(readFileSync(fixture.layout.databasePath), beforeBytes);
    assert.deepEqual(readdirSync(fixture.layout.root).sort(), beforeRoot);
    assert.deepEqual(readdirSync(fixture.layout.backupGenerationsRoot), []);
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("a pre-existing zero-length primary is refused and preserved", async () => {
  const fixture = createPersistenceFixture("migration-empty-primary");
  try {
    writeFileSync(fixture.layout.databasePath, Buffer.alloc(0));
    const beforeRoot = readdirSync(fixture.layout.root).sort();
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "must-refuse-empty" }),
      (error) => expectPersistenceError(error, "MIGRATION_HISTORY_MISMATCH"),
    );
    assert.equal(readFileSync(fixture.layout.databasePath).byteLength, 0);
    assert.deepEqual(readdirSync(fixture.layout.root).sort(), beforeRoot);
    assert.deepEqual(readdirSync(fixture.layout.backupGenerationsRoot), []);
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("current schema identity, history, and live-schema drift are refused without repair", async (context) => {
  const cases = [
    {
      name: "history checksum",
      code: "MIGRATION_CHECKSUM_MISMATCH",
      mutate(database) {
        database.prepare("UPDATE migration_history SET checksum_sha256=? WHERE version=1").run("B".repeat(64));
      },
    },
    {
      name: "history identity",
      code: "MIGRATION_HISTORY_MISMATCH",
      mutate(database) {
        database.prepare("UPDATE migration_history SET migration_id='historical-prefix' WHERE version=1").run();
      },
    },
    {
      name: "registry identity",
      code: "MIGRATION_HISTORY_MISMATCH",
      mutate(database) {
        database.prepare("UPDATE schema_metadata SET registry_identity=? WHERE singleton=1").run("C".repeat(64));
      },
    },
    {
      name: "stored fingerprint",
      code: "MIGRATION_HISTORY_MISMATCH",
      mutate(database) {
        database.prepare("UPDATE schema_metadata SET schema_fingerprint=? WHERE singleton=1").run("D".repeat(64));
      },
    },
    {
      name: "live schema",
      code: "MIGRATION_HISTORY_MISMATCH",
      mutate(database) {
        database.exec("CREATE TABLE unregistered_schema_drift(value TEXT NOT NULL)");
      },
    },
    {
      name: "newer schema",
      code: "SCHEMA_NEWER",
      mutate(database) {
        database.exec("UPDATE schema_metadata SET schema_version=2 WHERE singleton=1; PRAGMA user_version=2;");
      },
    },
  ];

  for (const candidate of cases) {
    await context.test(candidate.name, async () => {
      const fixture = createPersistenceFixture(`migration-drift-${candidate.name}`);
      try {
        createCurrentDatabase(fixture.layout);
        mutateDatabase(fixture.layout.databasePath, candidate.mutate);
        const beforeBytes = readFileSync(fixture.layout.databasePath);
        await assert.rejects(
          openPersistence(fixture.layout, { applicationVersion: "must-refuse-drift" }),
          (error) => expectPersistenceError(error, candidate.code),
        );
        assert.deepEqual(readFileSync(fixture.layout.databasePath), beforeBytes);
        assert.deepEqual(readdirSync(fixture.layout.backupGenerationsRoot), []);
      } finally {
        cleanupPersistenceFixture(fixture);
      }
    });
  }
});

test("a failed baseline rolls back completely and the shipped baseline can retry", async () => {
  const shippedRegistry = loadMigrationRegistry();
  const shipped = shippedRegistry[0];
  const failingSql = `${shipped.sql}INSERT INTO table_that_does_not_exist(value) VALUES ('fail');\n`;
  const failingRegistry = Object.freeze([
    Object.freeze({
      version: 1,
      id: "failing-current-baseline",
      fileName: "0001-failing-current-baseline.sql",
      checksumSha256: sha256(failingSql),
      sql: failingSql,
    }),
  ]);
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("PRAGMA foreign_keys=ON");
    await assert.rejects(
      migrateDatabaseWithRegistryForTesting(
        database,
        { applicationVersion: "failing" },
        failingRegistry,
      ),
      (error) => expectPersistenceError(error, "MIGRATION_FAILED"),
    );
    assert.deepEqual(userSchemaNames(database), []);
    assert.equal(database.prepare("PRAGMA user_version").get().user_version, 0);
    assert.deepEqual(inspectSchemaEvidence(database), {
      schemaVersion: 0,
      registryIdentity: "",
      schemaFingerprint: "",
      history: [],
    });

    const migration = await migrateDatabaseWithRegistryForTesting(
      database,
      { applicationVersion: "retry" },
      shippedRegistry,
    );
    assert.equal(migration.createdFresh, true);
    assert.deepEqual(migration.appliedVersions, [1]);
    assert.equal(migration.schemaVersion, 1);
    assert.equal(migration.history.length, 1);
    assert.deepEqual(userSchemaNames(database, "table"), CURRENT_TABLES);
  } finally {
    database.close();
  }
});
