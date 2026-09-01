import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  BASE_AUTHORIZATION_ACTIONS,
  CLAIM_AUTHORIZATION_ACTIONS,
  MANUAL_AUTHORIZATION_ACTIONS,
  createApplicationService,
  openPersistence,
} from "../src/index.ts";
import { createApplicationServiceWithHooks } from "../src/application.ts";
import { readApplicationState, readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const PRINCIPAL = "A".repeat(64);
const MANUAL_EXTENSION_ACTIONS = Object.freeze(MANUAL_AUTHORIZATION_ACTIONS.filter(
  (action) => !CLAIM_AUTHORIZATION_ACTIONS.includes(action),
));

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let confirmed = true;
  return {
    currentActor: () => ({ actorId: "local_manual_operator", principal: PRINCIPAL }),
    currentLeaseOwner: () => "worker-authorization",
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => confirmed,
    setNow(value) { now = value; },
    setConfirmed(value) { confirmed = value; },
  };
}

function hasManualExtensionGrant(state) {
  return state.grants.some((grant) => MANUAL_EXTENSION_ACTIONS.includes(grant.action));
}

async function seedManualStage(fixture, label) {
  const ingress = trustedIngress(label);
  const store = await openPersistence(fixture.layout, { applicationVersion: label });
  try {
    const application = createApplicationService(store, ingress);
    assert.equal(application.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    }).ok, true);
    assert.equal(application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-25T12:00:00.000Z",
    }).ok, true);
    ingress.setNow("2026-09-15T12:00:00.000Z");
    const upgraded = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-26T12:00:00.000Z",
    });
    assert.equal(upgraded.ok, true, JSON.stringify(upgraded));
    assert.equal(readApplicationStateForOwner(store).epochs.at(-1)?.vocabularyVersion, 3);
  } finally {
    await store.close();
  }
}

test("claim-capable renewal exposes no Manual authority, while every claim-to-Manual failpoint is atomic", async () => {
  const fixture = createPersistenceFixture("execution-loop-manual-stage");
  const ingress = trustedIngress("execution-loop-manual-stage");
  let store;
  try {
    assert.equal(MANUAL_EXTENSION_ACTIONS.length, 6);
    assert.equal(MANUAL_AUTHORIZATION_ACTIONS.length, 29);
    store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-authorization" });
    const application = createApplicationService(store, ingress);
    assert.equal(application.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    }).ok, true);
    let state = readApplicationStateForOwner(store);
    assert.equal(state.grants.length, BASE_AUTHORIZATION_ACTIONS.length);
    assert.equal(hasManualExtensionGrant(state), false);

    const firstUpgrade = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-21T12:00:00.000Z",
    });
    assert.equal(firstUpgrade.ok, true, JSON.stringify(firstUpgrade));
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 2);
    assert.equal(hasManualExtensionGrant(state), false);

    ingress.setNow("2026-09-15T12:00:00.000Z");
    const renewed = application.renew({
      kind: "authorization.capability.renew",
      expiresAt: "2026-09-25T12:00:00.000Z",
    });
    assert.equal(renewed.ok, true, JSON.stringify(renewed));
    assert.equal(renewed.value.capabilityCount, CLAIM_AUTHORIZATION_ACTIONS.length);
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 2);
    assert.equal(hasManualExtensionGrant(state), false);
    const exactClaimOrigin = structuredClone(state);

    ingress.setConfirmed(false);
    const unconfirmed = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-26T12:00:00.000Z",
    });
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "AUTHORIZATION_DENIED");
    assert.deepEqual(readApplicationStateForOwner(store), exactClaimOrigin);
    ingress.setConfirmed(true);

    const stages = Object.freeze([
      "request",
      "epoch",
      ...MANUAL_AUTHORIZATION_ACTIONS.map((action) => `grant:${action}`),
      "decision",
      "audit",
    ]);
    for (const stage of stages) {
      const before = readApplicationStateForOwner(store);
      const faulting = createApplicationServiceWithHooks(store, ingress, {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      assert.throws(
        () => faulting.upgrade({
          kind: "authorization.capability.upgrade",
          expiresAt: "2026-09-26T12:00:00.000Z",
        }),
        (error) => error?.name === "PersistenceError",
        stage,
      );
      assert.deepEqual(readApplicationStateForOwner(store), before, stage);
    }

    const upgraded = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-26T12:00:00.000Z",
    });
    assert.equal(upgraded.ok, true, JSON.stringify(upgraded));
    assert.equal(upgraded.value.capabilityCount, MANUAL_AUTHORIZATION_ACTIONS.length);
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 3);
    const claimGrantIds = new Set(exactClaimOrigin.grants.map((grant) => grant.grantId));
    const newestGrants = state.grants.filter((grant) => !claimGrantIds.has(grant.grantId));
    assert.equal(newestGrants.length, MANUAL_AUTHORIZATION_ACTIONS.length);
    assert.deepEqual(newestGrants.map((grant) => grant.action).sort(), [...MANUAL_AUTHORIZATION_ACTIONS].sort());
    assert.equal(MANUAL_EXTENSION_ACTIONS.every((action) => newestGrants.some(
      (grant) => grant.action === action && grant.actorId === "local_manual_operator" && grant.revokedAt === null,
    )), true);

    const inspection = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    try {
      const currentEpochId = state.epochs.at(-1)?.epochId;
      assert.ok(currentEpochId);
      assert.equal(inspection.prepare(
        "SELECT count(*) AS count FROM authorization_grants WHERE capability_epoch_id=?",
      ).get(currentEpochId).count, MANUAL_AUTHORIZATION_ACTIONS.length);
      assert.equal(inspection.prepare(
        `SELECT count(*) AS count
         FROM authorization_grants
         WHERE capability_epoch_id=?
           AND issuer_grant_id IS NULL
           AND source_grant_id IS NULL`,
      ).get(currentEpochId).count, MANUAL_AUTHORIZATION_ACTIONS.length);
      assert.deepEqual(inspection.prepare(
        `SELECT name FROM sqlite_schema
         WHERE name IN (
           'authorization_capability_epochs_claim', 'authorization_capability_epochs_manual',
           'authorization_grants_claim', 'authorization_grants_manual',
           'authorization_grant_epoch_links', 'authorization_grant_epoch_compatibility_links'
         ) ORDER BY name`,
      ).all(), []);
      assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      inspection.close();
    }

    ingress.setNow("2026-09-25T12:00:01.000Z");
    const currentStageStatus = application.execute({ kind: "runtime.status" });
    assert.equal(currentStageStatus.ok, true, JSON.stringify(currentStageStatus));
    const currentStageStatusGrant = newestGrants.find((grant) => grant.action === "runtime.status");
    assert.ok(currentStageStatusGrant);
    assert.equal(
      readApplicationStateForOwner(store).decisions.find(
        (decision) => decision.requestId === currentStageStatus.requestId,
      )?.grantId,
      currentStageStatusGrant.grantId,
    );

    await store.close();
    store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-authorization-reopen" });
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 3);
    assert.equal(
      state.grants.filter((grant) => !claimGrantIds.has(grant.grantId)).length,
      MANUAL_AUTHORIZATION_ACTIONS.length,
    );
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

const currentGrantCorruptions = Object.freeze([
  Object.freeze({
    name: "a missing current Manual action",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_no_delete");
      assert.equal(database.prepare(
        "DELETE FROM authorization_grants WHERE action='execution.start'",
      ).run().changes, 1);
    },
  }),
  Object.freeze({
    name: "a missing direct capability epoch relation",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      assert.equal(database.prepare(
        "UPDATE authorization_grants SET capability_epoch_id=NULL WHERE action='execution.start'",
      ).run().changes, 1);
    },
  }),
]);

test("current schema rejects a duplicated action in one capability epoch", async () => {
  const fixture = createPersistenceFixture("execution-current-duplicate-action");
  try {
    await seedManualStage(fixture, "execution-current-duplicate-action");
    const database = new DatabaseSync(fixture.layout.databasePath);
    try {
      database.exec("PRAGMA foreign_keys=ON");
      assert.throws(
        () => database.exec(`
          INSERT INTO authorization_grants
          SELECT grant_id || '-duplicate', revision, actor_id, action, scope_kind, scope_project_id,
            scope_resource_revision, scope_config_revision, not_before, expires_at, revoked_at,
            issuer_grant_id, source_grant_id, capability_epoch_id, created_request_id, revoked_request_id
          FROM authorization_grants
          WHERE action='execution.start' AND capability_epoch_id IS NOT NULL
        `),
        /UNIQUE constraint failed: authorization_grants\.capability_epoch_id, authorization_grants\.action/u,
      );
      assert.doesNotThrow(() => readApplicationState(database));
    } finally {
      database.close();
    }
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

for (const corruption of currentGrantCorruptions) {
  test(`current decoder rejects ${corruption.name}`, async () => {
    const fixture = createPersistenceFixture(`execution-current-corrupt-${corruption.name.replaceAll(" ", "-")}`);
    try {
      await seedManualStage(fixture, `execution-current-corrupt-${corruption.name.replaceAll(" ", "-")}`);
      const database = new DatabaseSync(fixture.layout.databasePath);
      try {
        database.exec("PRAGMA foreign_keys=ON");
        corruption.mutate(database);
        assert.throws(
          () => readApplicationState(database),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
        );
      } finally {
        database.close();
      }
    } finally {
      cleanupPersistenceFixture(fixture);
    }
  });
}
