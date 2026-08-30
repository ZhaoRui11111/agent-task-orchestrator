import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  PHASE1_AUTHORIZATION_ACTIONS,
  createApplicationService,
  prepareRuntimeLayout,
} from "../src/index.ts";
import {
  readApplicationStateForOwner,
  readVersionFourApplicationState,
  versionFourApplicationStateSha256,
} from "../src/persistence/application-repository.ts";
import { inspectTrustedRuntimeRoot } from "../src/project-registry.ts";
import {
  liveSchemaFingerprint,
  loadMigrationRegistry,
  migrationRegistryIdentity,
} from "../src/persistence/migrations.ts";
import { canonicalJson } from "../src/persistence/values.ts";
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

export function createVersionThreeDomainDatabase(
  layout,
  applicationVersion = "test-v3-domain",
  projectId = null,
) {
  const registry = loadMigrationRegistry();
  const prefix = registry.slice(0, 3);
  const database = new DatabaseSync(layout.databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("BEGIN IMMEDIATE");
  for (const migration of prefix) database.exec(migration.sql);
  if (projectId !== null) database.prepare("INSERT INTO projects(project_id, enabled) VALUES (?, 1)").run(projectId);
  const appliedAt = "2026-01-01T00:00:00.000Z";
  for (const migration of prefix) {
    database.prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
    ).run(migration.version, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
  }
  database.prepare(
    `INSERT INTO schema_metadata(
      singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at
    ) VALUES (1, 3, ?, ?, ?, ?)`,
  ).run(projectId === null ? 0 : 1, migrationRegistryIdentity(registry, 3), liveSchemaFingerprint(database), appliedAt);
  database.exec("PRAGMA user_version=3");
  database.exec("COMMIT");
  database.close();
}

export function createVersionThreeDatabase(layout, applicationVersion = "test-v3", options = {}) {
  const registry = loadMigrationRegistry();
  const prefix = registry.slice(0, 3);
  const database = new DatabaseSync(layout.databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("BEGIN IMMEDIATE");
  for (const migration of prefix) database.exec(migration.sql);

  const createdAt = "2026-01-01T00:00:00.000Z";
  const inspectedAt = "2026-01-01T00:00:01.000Z";
  const expiresAt = "2099-01-01T00:00:00.000Z";
  const actorId = "legacy-v3-owner";
  const bootstrapRequestId = "v3-bootstrap-request";
  const runtimeIdentity = inspectTrustedRuntimeRoot(layout.root);
  database.prepare(
    `INSERT INTO application_requests(
      request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at
    ) VALUES (?, ?, ?, 'authorization.grant.issue', 'runtime', 'runtime', NULL, 'bootstrap', ?)`,
  ).run(bootstrapRequestId, "v3-bootstrap-correlation", actorId, createdAt);
  database.prepare(
    `INSERT INTO authorization_bootstrap(
      singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode,
      request_id, created_at, expires_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    actorId, "legacy-v3-principal", runtimeIdentity.canonicalRoot, runtimeIdentity.rootKey,
    runtimeIdentity.platform, runtimeIdentity.device, runtimeIdentity.inode, runtimeIdentity.mode,
    bootstrapRequestId, createdAt, expiresAt,
  );

  const legacyActions = PHASE1_AUTHORIZATION_ACTIONS.slice(0, 15);
  const insertGrant = database.prepare(
    `INSERT INTO authorization_grants(
      grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
    ) VALUES (?, 1, ?, ?, 'runtime', NULL, NULL, NULL, ?, ?, NULL, NULL, NULL, ?, NULL)`,
  );
  for (const [index, action] of legacyActions.entries()) {
    insertGrant.run(`v3-grant-${String(index).padStart(2, "0")}`, actorId, action, createdAt, expiresAt, bootstrapRequestId);
  }
  database.prepare(
    `INSERT INTO application_audit(
      audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
      target_kind, target_id, target_revision, reason, details_json, created_at
    ) VALUES ('v3-bootstrap-audit', ?, NULL, 'bootstrap', 'accepted', ?, ?,
      'runtime', 'runtime', NULL, 'bootstrap', ?, ?)`,
  ).run(
    bootstrapRequestId,
    actorId,
    "v3-bootstrap-correlation",
    canonicalJson({ action: "authorization.grant.issue", reason: "bootstrap", targetKind: "runtime", targetRevision: null }),
    createdAt,
  );

  const inspectGrantId = `v3-grant-${String(legacyActions.indexOf("authorization.grant.inspect")).padStart(2, "0")}`;
  const inspectRequestId = "v3-inspect-request";
  const inspectDecisionId = "v3-inspect-decision";
  database.prepare(
    `INSERT INTO application_requests(
      request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at
    ) VALUES (?, ?, ?, 'authorization.grant.inspect', 'grant', ?, 1, 'allow', ?)`,
  ).run(inspectRequestId, "v3-inspect-correlation", actorId, inspectGrantId, inspectedAt);
  database.prepare(
    `INSERT INTO authorization_decisions(
      decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    ) VALUES (?, ?, ?, 'authorization.grant.inspect', 'allow', 'allowed',
      'read_not_applicable', ?, 1, NULL, NULL, ?)`,
  ).run(
    inspectDecisionId,
    inspectRequestId,
    actorId,
    options.inspectDecisionGrantMismatch === true ? "v3-grant-00" : inspectGrantId,
    inspectedAt,
  );
  database.prepare(
    `INSERT INTO application_audit(
      audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
      target_kind, target_id, target_revision, reason, details_json, created_at
    ) VALUES ('v3-inspect-audit', ?, ?, 'grant.inspected', 'accepted', ?, ?,
      'grant', ?, 1, 'accepted', ?, ?)`,
  ).run(
    inspectRequestId,
    inspectDecisionId,
    actorId,
    "v3-inspect-correlation",
    inspectGrantId,
    canonicalJson({ action: "authorization.grant.inspect", reason: "accepted", targetKind: "grant", targetRevision: 1 }),
    inspectedAt,
  );

  const appliedAt = "2026-01-01T00:00:02.000Z";
  for (const migration of prefix) {
    database.prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
    ).run(migration.version, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
  }
  database.prepare(
    `INSERT INTO schema_metadata(
      singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at
    ) VALUES (1, 3, 0, ?, ?, ?)`,
  ).run(migrationRegistryIdentity(registry, 3), liveSchemaFingerprint(database), appliedAt);
  database.exec("PRAGMA user_version=3");
  database.exec("COMMIT");
  database.close();
}

export function createVersionFourDatabase(layout, applicationVersion = "test-v4") {
  const registry = loadMigrationRegistry();
  const prefix = registry.slice(0, 4);
  const database = new DatabaseSync(layout.databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("BEGIN IMMEDIATE");
  database.exec("PRAGMA defer_foreign_keys=ON");
  for (const migration of prefix) database.exec(migration.sql);
  const appliedAt = "2026-01-01T00:00:03.000Z";
  for (const migration of prefix) {
    database.prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
    ).run(migration.version, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
  }
  database.prepare(
    `INSERT INTO schema_metadata(
      singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at
    ) VALUES (1, 4, 0, ?, ?, ?)`,
  ).run(migrationRegistryIdentity(registry, 4), liveSchemaFingerprint(database), appliedAt);
  database.exec("PRAGMA user_version=4");
  database.exec("COMMIT");
  database.close();
}

export function createVersionFourLifecycleDatabase(
  layout,
  applicationVersion = "test-v4-lifecycle",
  timestamps = {},
) {
  const registry = loadMigrationRegistry();
  const prefix = registry.slice(0, 4);
  const database = new DatabaseSync(layout.databasePath);
  database.exec("PRAGMA foreign_keys=ON");
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("BEGIN IMMEDIATE");
  for (const migration of prefix) database.exec(migration.sql);

  const createdAt = "2026-01-01T00:00:00.000Z";
  const backupAt = timestamps.backupAt ?? "2026-01-01T00:00:01.000Z";
  const authorizationExpiresAt = timestamps.authorizationExpiresAt ?? "2026-01-01T00:05:01.000Z";
  const grantExpiresAt = "2099-01-01T00:00:00.000Z";
  const actorId = "native-v4-owner";
  const principalSha256 = "D".repeat(64);
  const bootstrapRequestId = "v4-bootstrap-request";
  const backupRequestId = "v4-backup-request";
  const backupDecisionId = "v4-backup-decision";
  const backupAuditId = "v4-backup-audit";
  const authorizationId = "v4-backup-authorization";
  const generationId = "44444444-4444-4444-8444-444444444444";
  const runtimeIdentity = inspectTrustedRuntimeRoot(layout.root);

  database.prepare(
    `INSERT INTO application_requests(
      request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at
    ) VALUES (?, 'v4-bootstrap-correlation', ?, 'authorization.grant.issue',
      'runtime', 'runtime', NULL, 'bootstrap', ?)`,
  ).run(bootstrapRequestId, actorId, createdAt);
  database.prepare(
    `INSERT INTO authorization_bootstrap(
      singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode, request_id,
      created_at, expires_at, vocabulary_version
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4)`,
  ).run(
    actorId, principalSha256, runtimeIdentity.canonicalRoot, runtimeIdentity.rootKey,
    runtimeIdentity.platform, runtimeIdentity.device, runtimeIdentity.inode, runtimeIdentity.mode,
    bootstrapRequestId, createdAt, grantExpiresAt,
  );
  database.prepare(
    `INSERT INTO authorization_local_identity(
      singleton, identity_version, actor_id, principal_sha256, platform,
      runtime_root_key, bootstrap_request_id, adoption_request_id, created_at
    ) VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    actorId, principalSha256, runtimeIdentity.platform, runtimeIdentity.rootKey,
    bootstrapRequestId, bootstrapRequestId, createdAt,
  );
  const insertGrant = database.prepare(
    `INSERT INTO authorization_grants(
      grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id, capability_epoch_id,
      created_request_id, revoked_request_id
    ) VALUES (?, 1, ?, ?, 'runtime', NULL, NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, ?, NULL)`,
  );
  for (const [index, action] of PHASE1_AUTHORIZATION_ACTIONS.entries()) {
    insertGrant.run(`v4-grant-${String(index).padStart(2, "0")}`, actorId, action, createdAt, grantExpiresAt, bootstrapRequestId);
  }
  database.prepare(
    `INSERT INTO application_audit(
      audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
      target_kind, target_id, target_revision, reason, details_json, created_at
    ) VALUES ('v4-bootstrap-audit', ?, NULL, 'bootstrap', 'accepted', ?,
      'v4-bootstrap-correlation', 'runtime', 'runtime', NULL, 'bootstrap', ?, ?)`,
  ).run(
    bootstrapRequestId,
    actorId,
    canonicalJson({ action: "authorization.grant.issue", reason: "bootstrap", targetKind: "runtime", targetRevision: null }),
    createdAt,
  );

  const backupGrantId = `v4-grant-${String(PHASE1_AUTHORIZATION_ACTIONS.indexOf("runtime.backup")).padStart(2, "0")}`;
  database.prepare(
    `INSERT INTO application_requests(
      request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at
    ) VALUES (?, 'v4-backup-correlation', ?, 'runtime.backup', 'backup', ?, NULL, 'allow', ?)`,
  ).run(backupRequestId, actorId, generationId, backupAt);
  database.prepare(
    `INSERT INTO authorization_decisions(
      decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    ) VALUES (?, ?, ?, 'runtime.backup', 'allow', 'allowed', 'read_not_applicable',
      ?, 1, NULL, NULL, ?)`,
  ).run(backupDecisionId, backupRequestId, actorId, backupGrantId, backupAt);
  database.prepare(
    `INSERT INTO application_audit(
      audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
      target_kind, target_id, target_revision, reason, details_json, created_at
    ) VALUES (?, ?, ?, 'backup.authorized', 'accepted', ?, 'v4-backup-correlation',
      'backup', ?, NULL, 'accepted', ?, ?)`,
  ).run(
    backupAuditId, backupRequestId, backupDecisionId, actorId, generationId,
    canonicalJson({ action: "runtime.backup", reason: "accepted", targetKind: "backup", targetRevision: null }),
    backupAt,
  );

  const appliedAt = "2026-01-01T00:00:02.000Z";
  for (const migration of prefix) {
    database.prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (?, ?, ?, ?, ?)",
    ).run(migration.version, migration.id, migration.checksumSha256, appliedAt, applicationVersion);
  }
  database.prepare(
    `INSERT INTO schema_metadata(
      singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at
    ) VALUES (1, 4, 0, ?, ?, ?)`,
  ).run(migrationRegistryIdentity(registry, 4), liveSchemaFingerprint(database), appliedAt);
  database.exec("PRAGMA user_version=4");
  database.exec("COMMIT");

  const authorizedStateSha256 = versionFourApplicationStateSha256(readVersionFourApplicationState(database));
  database.exec("BEGIN IMMEDIATE");
  database.prepare(
    `INSERT INTO application_lifecycle_authorizations(
      authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
      grant_id, grant_revision, request_id, decision_id, audit_id, authorized_state_sha256,
      expected_request_count, expected_decision_count, expected_audit_count, issued_at, expires_at
    ) VALUES (?, 'runtime.backup', ?, ?, ?, ?, 1, ?, ?, ?, ?, 2, 1, 2, ?, ?)`,
  ).run(
    authorizationId, generationId, actorId, runtimeIdentity.rootKey, backupGrantId,
    backupRequestId, backupDecisionId, backupAuditId, authorizedStateSha256,
    backupAt, authorizationExpiresAt,
  );
  database.exec("COMMIT");
  database.close();
  return Object.freeze({ authorizationId, authorizedStateSha256, generationId });
}

export function emptySnapshot(projectId = "project") {
  return Object.freeze({
    projects: Object.freeze([Object.freeze({ id: projectId, enabled: true })]),
    tasks: Object.freeze([]),
  });
}
