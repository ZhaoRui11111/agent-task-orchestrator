import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  currentSchemaVersion,
  openPersistence,
  verifyBackupGeneration,
} from "../src/index.ts";
import { openPrimaryDatabase } from "../src/persistence/database.ts";
import {
  inspectSchemaEvidence,
  loadMigrationRegistry,
  migrateDatabaseWithRegistryForTesting,
} from "../src/persistence/migrations.ts";
import { sha256 } from "../src/persistence/values.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  createVersionOneDatabase,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

test("committed migration registry is contiguous and checksums exact source bytes", () => {
  const registry = loadMigrationRegistry();
  assert.equal(currentSchemaVersion(), 2);
  assert.deepEqual(
    registry.map(({ version, id, fileName }) => ({ version, id, fileName })),
    [
      { version: 1, id: "persistence-metadata", fileName: "0001-persistence-metadata.sql" },
      { version: 2, id: "phase1-task-storage", fileName: "0002-phase1-task-storage.sql" },
    ],
  );
  for (const migration of registry) {
    assert.equal(
      migration.checksumSha256,
      sha256(readFileSync(path.join(import.meta.dirname, "..", "migrations", migration.fileName))),
    );
    assert.equal(Object.isFrozen(migration), true);
  }
});

test("fresh initialization atomically applies the complete staged schema", async () => {
  const fixture = createPersistenceFixture("migration-fresh");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "fresh" });
    assert.deepEqual(store.migration.appliedVersions, [1, 2]);
    assert.equal(store.migration.migratedFrom, 0);
    assert.equal(store.migration.preUpgradeBackupGeneration, null);
    assert.equal(store.migration.history.length, 2);
    const database = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    try {
      const tables = database
        .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map((row) => row.name);
      assert.deepEqual(tables, ["migration_history", "projects", "schema_metadata", "task_dependencies", "tasks"]);
      assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, 2);
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
    assert.deepEqual(store.migration.appliedVersions, [2]);
    assert.equal(store.migration.migratedFrom, 1);
    assert.ok(store.migration.preUpgradeBackupGeneration);
    const generation = verifyBackupGeneration(
      fixture.layout,
      store.migration.preUpgradeBackupGeneration,
    );
    assert.equal(generation.manifest.kind, "pre_upgrade");
    assert.equal(generation.manifest.sourceSchemaVersion, 1);
    assert.equal(store.migration.schemaVersion, 2);
  } finally {
    if (store) await store.close();
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
          version: 3,
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
      assert.equal(inspectSchemaEvidence(database).schemaVersion, 2);
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
      database.prepare("UPDATE schema_metadata SET schema_version=3 WHERE singleton=1").run();
      database.exec("PRAGMA user_version=3");
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
