import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createApplicationService,
  prepareRuntimeLayout,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
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

function lifecycleService(store) {
  const current = readApplicationStateForOwner(store);
  const actorId = current.identity?.actorId ?? "test-lifecycle-owner";
  const principal = current.identity?.principalSha256 ?? "A".repeat(64);
  const ingress = {
    currentActor: () => ({ actorId, principal }),
    now: () => new Date().toISOString(),
    nextId: () => randomUUID(),
    confirmHighRisk: () => true,
  };
  const service = createApplicationService(store, ingress);
  if (current.bootstrap === null) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const initialized = service.bootstrap({ kind: "authorization.bootstrap", expiresAt });
    assert.equal(initialized.ok, true);
  }
  return service;
}

export function authorizeTestLifecycle(store, operation, generationId) {
  const result = lifecycleService(store).execute({ kind: operation, backupGenerationId: generationId });
  assert.equal(result.ok, true);
  return result.value;
}

export async function createAuthorizedTestBackup(store) {
  const generationId = randomUUID();
  const authorization = authorizeTestLifecycle(store, "runtime.backup", generationId);
  return store.createBackup(authorization);
}

export function createCurrentDatabase(layout, applicationVersion = "test-current") {
  const registry = loadMigrationRegistry();
  const baseline = registry[0];
  assert.equal(registry.length, 1);
  assert.ok(baseline);
  const database = new DatabaseSync(layout.databasePath);
  try {
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("PRAGMA journal_mode=WAL");
    database.exec("BEGIN IMMEDIATE");
    database.exec(baseline.sql);
    const appliedAt = new Date().toISOString();
    database.prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (1, ?, ?, ?, ?)",
    ).run(baseline.id, baseline.checksumSha256, appliedAt, applicationVersion);
    database.prepare(
      "INSERT INTO schema_metadata(singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at) VALUES (1, 1, 0, ?, ?, ?)",
    ).run(migrationRegistryIdentity(registry), liveSchemaFingerprint(database), appliedAt);
    database.exec("PRAGMA user_version=1");
    database.exec("COMMIT");
  } finally {
    database.close();
  }
}

export function createIncompatibleDatabase(layout, marker = "pre-phase-3") {
  const database = new DatabaseSync(layout.databasePath);
  try {
    database.exec("CREATE TABLE incompatible_runtime(marker TEXT NOT NULL)");
    database.prepare("INSERT INTO incompatible_runtime(marker) VALUES (?)").run(marker);
    database.exec("PRAGMA user_version=42");
  } finally {
    database.close();
  }
}

export function emptySnapshot(projectId = "project") {
  return Object.freeze({
    projects: Object.freeze([Object.freeze({ id: projectId, enabled: true })]),
    tasks: Object.freeze([]),
  });
}
