import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  PHASE1_AUTHORIZATION_ACTIONS,
  PHASE2A_AUTHORIZATION_ACTIONS,
  PHASE2B_AUTHORIZATION_ACTIONS,
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
const EP02B_ACTIONS = Object.freeze(PHASE2B_AUTHORIZATION_ACTIONS.filter(
  (action) => !PHASE2A_AUTHORIZATION_ACTIONS.includes(action),
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

function hasEp02bGrant(state) {
  return state.grants.some((grant) => EP02B_ACTIONS.includes(grant.action));
}

async function seedVocabularySix(fixture, label) {
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
    assert.equal(readApplicationStateForOwner(store).epochs.at(-1)?.vocabularyVersion, 6);
  } finally {
    await store.close();
  }
}

test("vocabulary 5 bootstrap and renewal expose no EP-02B authority, while every 5-to-6 failpoint is atomic", async () => {
  const fixture = createPersistenceFixture("execution-loop-vocabulary-6");
  const ingress = trustedIngress("execution-loop-vocabulary-6");
  let store;
  try {
    assert.equal(EP02B_ACTIONS.length, 6);
    assert.equal(PHASE2B_AUTHORIZATION_ACTIONS.length, 29);
    store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-authorization" });
    const application = createApplicationService(store, ingress);
    assert.equal(application.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    }).ok, true);
    let state = readApplicationStateForOwner(store);
    assert.equal(state.grants.length, PHASE1_AUTHORIZATION_ACTIONS.length);
    assert.equal(hasEp02bGrant(state), false);

    const firstUpgrade = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-21T12:00:00.000Z",
    });
    assert.equal(firstUpgrade.ok, true, JSON.stringify(firstUpgrade));
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 5);
    assert.equal(hasEp02bGrant(state), false);

    ingress.setNow("2026-09-15T12:00:00.000Z");
    const renewed = application.renew({
      kind: "authorization.capability.renew",
      expiresAt: "2026-09-25T12:00:00.000Z",
    });
    assert.equal(renewed.ok, true, JSON.stringify(renewed));
    assert.equal(renewed.value.capabilityCount, PHASE2A_AUTHORIZATION_ACTIONS.length);
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 5);
    assert.equal(hasEp02bGrant(state), false);
    const exactVocabulary5Origin = structuredClone(state);

    ingress.setConfirmed(false);
    const unconfirmed = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "2026-09-26T12:00:00.000Z",
    });
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "AUTHORIZATION_DENIED");
    assert.deepEqual(readApplicationStateForOwner(store), exactVocabulary5Origin);
    ingress.setConfirmed(true);

    const stages = Object.freeze([
      "request",
      "epoch",
      ...PHASE2B_AUTHORIZATION_ACTIONS.map((action) => `grant:${action}`),
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
    assert.equal(upgraded.value.capabilityCount, PHASE2B_AUTHORIZATION_ACTIONS.length);
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 6);
    const vocabulary5GrantIds = new Set(exactVocabulary5Origin.grants.map((grant) => grant.grantId));
    const newestGrants = state.grants.filter((grant) => !vocabulary5GrantIds.has(grant.grantId));
    assert.equal(newestGrants.length, PHASE2B_AUTHORIZATION_ACTIONS.length);
    assert.deepEqual(newestGrants.map((grant) => grant.action).sort(), [...PHASE2B_AUTHORIZATION_ACTIONS].sort());
    assert.equal(EP02B_ACTIONS.every((action) => newestGrants.some(
      (grant) => grant.action === action && grant.actorId === "local_manual_operator" && grant.revokedAt === null,
    )), true);

    const inspection = new DatabaseSync(fixture.layout.databasePath, { readOnly: true });
    try {
      const currentEpochId = state.epochs.at(-1)?.epochId;
      assert.ok(currentEpochId);
      assert.equal(inspection.prepare(
        "SELECT count(*) AS count FROM authorization_grants WHERE capability_epoch_id=?",
      ).get(currentEpochId).count, PHASE2B_AUTHORIZATION_ACTIONS.length);
      assert.equal(inspection.prepare(
        `SELECT count(*) AS count
         FROM authorization_grants
         WHERE capability_epoch_id=?
           AND issuer_grant_id IS NULL
           AND source_grant_id IS NULL`,
      ).get(currentEpochId).count, PHASE2B_AUTHORIZATION_ACTIONS.length);
      assert.deepEqual(inspection.prepare(
        `SELECT name FROM sqlite_schema
         WHERE name IN (
           'authorization_capability_epochs_v6', 'authorization_capability_epochs_v7',
           'authorization_grants_v6', 'authorization_grants_v7',
           'authorization_grant_epoch_v6_links', 'authorization_grant_epoch_v7_legacy_links',
           'authorization_grant_epoch_v7_v6_links'
         ) ORDER BY name`,
      ).all(), []);
      assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      inspection.close();
    }

    ingress.setNow("2026-09-25T12:00:01.000Z");
    const v6OnlyStatus = application.execute({ kind: "runtime.status" });
    assert.equal(v6OnlyStatus.ok, true, JSON.stringify(v6OnlyStatus));
    const v6StatusGrant = newestGrants.find((grant) => grant.action === "runtime.status");
    assert.ok(v6StatusGrant);
    assert.equal(
      readApplicationStateForOwner(store).decisions.find(
        (decision) => decision.requestId === v6OnlyStatus.requestId,
      )?.grantId,
      v6StatusGrant.grantId,
    );

    await store.close();
    store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-authorization-reopen" });
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 6);
    assert.equal(
      state.grants.filter((grant) => !vocabulary5GrantIds.has(grant.grantId)).length,
      PHASE2B_AUTHORIZATION_ACTIONS.length,
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
    await seedVocabularySix(fixture, "execution-current-duplicate-action");
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
      await seedVocabularySix(fixture, `execution-current-corrupt-${corruption.name.replaceAll(" ", "-")}`);
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
