import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZATION_ACTIONS,
  PHASE1_AUTHORIZATION_ACTIONS,
  PHASE2A_AUTHORIZATION_ACTIONS,
  createApplicationService,
  openPersistence,
} from "../src/index.ts";
import { createApplicationServiceWithHooks } from "../src/application.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const PRINCIPAL = "A".repeat(64);
const EP02B_ACTIONS = Object.freeze(AUTHORIZATION_ACTIONS.filter(
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

test("vocabulary 5 bootstrap and renewal expose no EP-02B authority, while every 5-to-6 failpoint is atomic", async () => {
  const fixture = createPersistenceFixture("execution-loop-vocabulary-6");
  const ingress = trustedIngress("execution-loop-vocabulary-6");
  let store;
  try {
    assert.equal(EP02B_ACTIONS.length, 6);
    assert.equal(AUTHORIZATION_ACTIONS.length, 29);
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
      ...AUTHORIZATION_ACTIONS.map((action) => `grant:${action}`),
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
    assert.equal(upgraded.value.capabilityCount, 29);
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 6);
    const vocabulary5GrantIds = new Set(exactVocabulary5Origin.grants.map((grant) => grant.grantId));
    const newestGrants = state.grants.filter((grant) => !vocabulary5GrantIds.has(grant.grantId));
    assert.equal(newestGrants.length, 29);
    assert.deepEqual(newestGrants.map((grant) => grant.action).sort(), [...AUTHORIZATION_ACTIONS].sort());
    assert.equal(EP02B_ACTIONS.every((action) => newestGrants.some(
      (grant) => grant.action === action && grant.actorId === "local_manual_operator" && grant.revokedAt === null,
    )), true);

    await store.close();
    store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-authorization-reopen" });
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 6);
    assert.equal(state.grants.filter((grant) => !vocabulary5GrantIds.has(grant.grantId)).length, 29);
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});
