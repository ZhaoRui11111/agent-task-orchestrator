import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { prepareRuntimeLayout } from "../src/index.ts";
import {
  liveSchemaFingerprint,
  loadMigrationRegistry,
  migrationRegistryIdentity,
} from "../src/persistence/migrations.ts";
import { createOwnedGeneration, removeOwnedGeneration } from "../scripts/repo-utils.mjs";

export function createPersistenceFixture(prefix) {
  const safePrefix = prefix.toLowerCase().replaceAll(/[^a-z0-9-]/gu, "-").slice(0, 40);
  const generation = createOwnedGeneration(safePrefix);
  const sourceCheckoutRoot = path.join(generation, "source");
  const projectRoot = path.join(generation, "project");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(projectRoot);
  const layout = prepareRuntimeLayout({
    runtimeRoot: path.join(generation, "runtime"),
    sourceCheckoutRoot,
    projectRoots: [projectRoot],
  });
  return Object.freeze({ generation, layout, projectRoot, sourceCheckoutRoot });
}

export function cleanupPersistenceFixture(fixture) {
  removeOwnedGeneration(fixture.generation);
}

export function expectPersistenceError(error, code) {
  assert.equal(error?.name, "PersistenceError");
  assert.equal(error?.code, code);
  return true;
}

export function createVersionOneDatabase(layout, applicationVersion = "test-v1") {
  const registry = loadMigrationRegistry();
  const migration = registry[0];
  assert.ok(migration);
  const database = new DatabaseSync(layout.databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("BEGIN IMMEDIATE");
  database.exec(migration.sql);
  const appliedAt = new Date().toISOString();
  database
    .prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
    )
    .run(1, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
  database
    .prepare(
      "INSERT INTO schema_metadata(singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at) VALUES (1, 1, 0, ?, ?, ?)",
    )
    .run(migrationRegistryIdentity(registry, 1), liveSchemaFingerprint(database), appliedAt);
  database.exec("PRAGMA user_version=1");
  database.exec("COMMIT");
  database.close();
}

export function createVersionTwoDatabase(layout, applicationVersion = "test-v2", projectId = "legacy-project") {
  const registry = loadMigrationRegistry();
  const database = new DatabaseSync(layout.databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("BEGIN IMMEDIATE");
  for (const migration of registry.slice(0, 2)) database.exec(migration.sql);
  const appliedAt = new Date().toISOString();
  for (const migration of registry.slice(0, 2)) {
    database
      .prepare(
        "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
      )
      .run(migration.version, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
  }
  database
    .prepare(
      "INSERT INTO schema_metadata(singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at) VALUES (1, 2, 1, ?, ?, ?)",
    )
    .run(migrationRegistryIdentity(registry, 2), liveSchemaFingerprint(database), appliedAt);
  database.prepare("INSERT INTO projects(project_id, enabled) VALUES (?, 1)").run(projectId);
  database.exec("PRAGMA user_version=2");
  database.exec("COMMIT");
  database.close();
}

export function emptySnapshot(projectId = "project") {
  return Object.freeze({
    projects: Object.freeze([Object.freeze({ id: projectId, enabled: true })]),
    tasks: Object.freeze([]),
  });
}
