import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createSchedulerApplicationService,
  createSchedulerApplicationServiceWithHooks,
  inspectPrimaryIdentity,
  inspectRuntimeDoctor,
  openPersistence,
  restoreBackup,
  verifyBackupGeneration,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { schedulerReceiptSha256 } from "../src/persistence/scheduler-receipt-digest.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";
import { createFakeSchedulerBackend } from "./fixtures/fake-scheduler-backend.mjs";

const ACTOR = "scheduler-owner";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-10-01T00:00:00.000Z";
const RUNTIME_SCOPE = Object.freeze({
  kind: "runtime",
  projectId: null,
  projectResourceRevision: null,
  projectConfigRevision: null,
});

function ingress(label) {
  let sequence = 0;
  let now = "2026-09-04T18:00:00.000Z";
  let runtimeRootKey = "pending-runtime-root";
  let confirm = true;
  let confirmationThrows = false;
  const observationIds = [];
  const nextIds = new Map();
  return Object.freeze({
    currentActor: () => Object.freeze({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => "scheduler-worker",
    currentWorkerOwner: () => "scheduler-worker",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => now,
    nextId: (kind) => {
      const queued = nextIds.get(kind);
      if (queued?.length > 0) return queued.shift();
      return kind === "observation" && observationIds.length > 0
        ? observationIds.shift()
        : `${kind}-${label}-${++sequence}`;
    },
    confirmHighRisk: () => {
      if (confirmationThrows) throw new Error("raw-confirmation-error");
      return confirm;
    },
    confirmOperation: ({ action }) => Object.freeze({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }),
    setNow(value) { now = value; },
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setConfirmation(value) { confirm = value; },
    setConfirmationThrows(value) { confirmationThrows = value; },
    setObservationIds(values) { observationIds.push(...values); },
    setNextIds(kind, values) { nextIds.set(kind, [...values]); },
  });
}

async function prepare(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix.toLowerCase().replaceAll(/[^a-z0-9-]/gu, "-").slice(0, 40));
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03e-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  for (let stage = 2; stage <= 7; stage += 1) {
    trusted.setNow(`2026-09-04T18:00:0${stage}.000Z`);
    const upgraded = application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY });
    assert.equal(upgraded.ok, true, JSON.stringify(upgraded));
  }
  assert.equal(readApplicationStateForOwner(store).epochs.at(-1).vocabularyVersion, 7);
  trusted.setNow("2026-09-04T18:01:00.000Z");
  return { fixture, trusted, store, application };
}

function registerCommand(idempotencyKey = "register-one") {
  return Object.freeze({
    kind: "scheduler.register",
    scheduleId: "hourly-main",
    configRevision: 1,
    scope: RUNTIME_SCOPE,
    scheduleExpression: "hourly-at-minute-zero",
    timeZone: "Etc/UTC",
    dispatcherTarget: "dispatcher-main",
    idempotencyKey,
  });
}

test("scheduler register, inspect, and remove use distinct durable mutation and read paths", async () => {
  const runtime = await prepare("scheduler-lifecycle");
  try {
    const backend = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const registered = scheduler.register(registerCommand());
    assert.equal(registered.ok, true, JSON.stringify(registered));
    assert.equal(registered.value.state, "finalized");
    assert.equal(registered.value.outcome, "registered");
    assert.equal(registered.value.registration.status, "active");
    assert.equal(scheduler.register(registerCommand()).replayed, true);
    assert.equal(backend.calls().length, 1);

    runtime.trusted.setNow("2026-09-04T19:01:00.000Z");
    const beforeInspect = readApplicationStateForOwner(runtime.store);
    const inspected = scheduler.inspect(Object.freeze({
      kind: "scheduler.inspect",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
    }));
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.state, "inspected");
    const afterInspect = readApplicationStateForOwner(runtime.store);
    assert.equal(afterInspect.schedulerIntents.length, beforeInspect.schedulerIntents.length);
    assert.equal(afterInspect.schedulerFinalizations.length, beforeInspect.schedulerFinalizations.length);
    assert.equal(afterInspect.schedulerOperationRequests.at(-1).idempotencyKey, null);

    runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
    const removed = scheduler.remove(Object.freeze({
      kind: "scheduler.remove",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
      idempotencyKey: "remove-one",
    }));
    assert.equal(removed.ok, true, JSON.stringify(removed));
    assert.equal(removed.value.outcome, "removed");
    assert.equal(removed.value.registration.status, "removed");
    const afterRemove = readApplicationStateForOwner(runtime.store);
    const removeRequest = afterRemove.schedulerOperationRequests.filter((request) =>
      request.operation === "remove").at(-1);
    assert.ok(removeRequest);
    const removeObservation = afterRemove.schedulerObservations.find((observation) =>
      observation.requestId === removeRequest.requestId);
    assert.ok(removeObservation);
    const removeReceipt = afterRemove.schedulerReceipts.find((receipt) =>
      receipt.observationId === removeObservation.observationId);
    assert.ok(removeReceipt);
    assert.notEqual(removeRequest.externalRegistrationId, null);
    assert.equal(removeObservation.externalRegistrationId, removeRequest.externalRegistrationId);
    assert.equal(removeReceipt.externalRegistrationId, removeRequest.externalRegistrationId);
    assert.deepEqual(backend.calls().map((call) => call.operation), ["register", "inspect", "remove"]);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler response loss remains ambiguous until restart inspection proves the external state", async () => {
  const runtime = await prepare("scheduler-response-loss");
  try {
    const backend = createFakeSchedulerBackend();
    backend.failNext("response_loss");
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const uncertain = scheduler.register(registerCommand("response-loss"));
    assert.equal(uncertain.ok, false);
    assert.equal(uncertain.error.code, "RECONCILIATION_REQUIRED");
    let state = readApplicationStateForOwner(runtime.store);
    const intent = state.schedulerIntents.at(-1);
    assert.equal(intent.state, "ambiguous");
    assert.equal(state.schedulerRegistrations.at(-1).status, "ambiguous");

    runtime.trusted.setNow("2026-09-04T19:03:00.000Z");
    const restarted = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const reconciled = restarted.reconcile(Object.freeze({
      kind: "scheduler.reconcile",
      intentId: intent.intentId,
      expectedIntentRevision: intent.revision,
    }));
    assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerIntents.at(-1).state, "finalized");
    assert.equal(state.schedulerRegistrations.at(-1).status, "active");
    assert.deepEqual(backend.calls().map((call) => call.operation), ["register", "inspect"]);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler rechecks current authorization after prepare and never calls the backend after revocation", async () => {
  const runtime = await prepare("scheduler-final-authorization");
  try {
    const backend = createFakeSchedulerBackend();
    let revoked = false;
    const scheduler = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    }, {
      afterStage(stage) {
        if (stage !== "prepared" || revoked) return;
        revoked = true;
        const grant = readApplicationStateForOwner(runtime.store).grants.find((candidate) =>
          candidate.action === "scheduler.register" && candidate.revokedAt === null);
        assert.ok(grant);
        runtime.trusted.setNow("2026-09-04T18:01:01.000Z");
        const result = runtime.application.execute(Object.freeze({
          kind: "authorization.grant.revoke",
          grantId: grant.grantId,
          expectedGrantRevision: grant.revision,
        }));
        assert.equal(result.ok, true, JSON.stringify(result));
      },
    });
    const denied = scheduler.register(registerCommand("revoked-before-act"));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(backend.calls().length, 0);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerIntents.at(-1).state, "failed");
    assert.equal(state.schedulerRegistrations.at(-1).status, "removed");
    assert.equal(state.schedulerFinalizations.at(-1).verifiedReceiptId, null);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler denial remains readable when vocabulary-v7 grants are created at the same trusted time", async () => {
  const fixture = createPersistenceFixture("scheduler-equal-time-upgrade");
  const trusted = ingress("scheduler-equal-time-upgrade");
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03e-test" });
  try {
    const application = createApplicationService(store, trusted);
    assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
    trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
    for (let stage = 2; stage <= 6; stage += 1) {
      trusted.setNow(`2026-09-04T18:00:0${stage}.000Z`);
      assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
    }
    const scheduler = createSchedulerApplicationService(store, trusted, createFakeSchedulerBackend(), {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const denied = scheduler.register(registerCommand("equal-time-pre-v7-denial"));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    let state = readApplicationStateForOwner(store);
    assert.equal(state.schedulerAuthorizationDecisions.at(-1).reason, "action_mismatch");

    const denialTime = state.schedulerAuthorizationDecisions.at(-1).createdAt;
    trusted.setNow(new Date(new Date(denialTime).valueOf() - 1).toISOString());
    const staleUpgrade = application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY });
    assert.equal(staleUpgrade.ok, false);
    assert.equal(staleUpgrade.error.code, "STALE_REVISION");
    trusted.setNow(denialTime);
    const upgraded = application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY });
    assert.equal(upgraded.ok, true, JSON.stringify(upgraded));
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1).vocabularyVersion, 7);
    assert.equal(state.schedulerAuthorizationDecisions.at(-1).reason, "action_mismatch");
  } finally {
    await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("grant revocation rejects a clock behind scheduler Act and accepts the equal causal boundary", async () => {
  const runtime = await prepare("scheduler-grant-time-boundary");
  try {
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, createFakeSchedulerBackend(), {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(scheduler.register(registerCommand("grant-time-boundary")).ok, true);
    let state = readApplicationStateForOwner(runtime.store);
    const act = state.schedulerAuthorizationDecisions.find((decision) => decision.stage === "act");
    const targetGrant = state.grants.find((grant) =>
      grant.actorId === ACTOR && grant.action === "scheduler.register" && grant.revokedAt === null);
    assert.ok(act);
    assert.ok(targetGrant);

    const stale = runtime.application.execute(Object.freeze({
      kind: "authorization.grant.revoke",
      grantId: targetGrant.grantId,
      expectedGrantRevision: targetGrant.revision,
    }));
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_REVISION");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.grants.find((grant) => grant.grantId === targetGrant.grantId).revokedAt, null);

    runtime.trusted.setNow(act.createdAt);
    const revoked = runtime.application.execute(Object.freeze({
      kind: "authorization.grant.revoke",
      grantId: targetGrant.grantId,
      expectedGrantRevision: targetGrant.revision,
    }));
    assert.equal(revoked.ok, true, JSON.stringify(revoked));
    state = readApplicationStateForOwner(runtime.store);
    const revokedGrant = state.grants.find((grant) => grant.grantId === targetGrant.grantId);
    assert.equal(revokedGrant.revision, targetGrant.revision + 1);
    assert.equal(revokedGrant.revokedAt, act.createdAt);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler grant replay preserves per-grant causal boundaries at one trusted instant", async () => {
  const runtime = await prepare("scheduler-per-grant-time-boundary");
  try {
    const grantScope = Object.freeze({
      kind: "runtime",
      projectId: null,
      resourceRevision: null,
      configRevision: null,
    });
    runtime.trusted.setNextIds("grant", ["111-equal-grant-a"]);
    const issuedA = runtime.application.execute(Object.freeze({
      kind: "authorization.grant.issue",
      actorId: ACTOR,
      action: "scheduler.register",
      scope: grantScope,
      notBefore: "2026-09-04T18:01:00.000Z",
      expiresAt: EXPIRY,
    }));
    assert.equal(issuedA.ok, true, JSON.stringify(issuedA));
    assert.equal(issuedA.value.grantId, "111-equal-grant-a");
    const origin = readApplicationStateForOwner(runtime.store).grants.find((grant) =>
      grant.actorId === ACTOR && grant.action === "scheduler.register" &&
      grant.issuerGrantId === null && grant.revokedAt === null);
    assert.ok(origin);
    assert.equal(runtime.application.execute(Object.freeze({
      kind: "authorization.grant.revoke",
      grantId: origin.grantId,
      expectedGrantRevision: origin.revision,
    })).ok, true);

    let issuedB;
    runtime.trusted.setNextIds("grant", ["000-equal-grant-b"]);
    const scheduler = createSchedulerApplicationServiceWithHooks(
      runtime.store,
      runtime.trusted,
      createFakeSchedulerBackend(),
      {
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
      },
      {
        afterStage(stage) {
          if (stage !== "prepared" || issuedB !== undefined) return;
          issuedB = runtime.application.execute(Object.freeze({
            kind: "authorization.grant.issue",
            actorId: ACTOR,
            action: "scheduler.register",
            scope: grantScope,
            notBefore: "2026-09-04T18:01:00.000Z",
            expiresAt: EXPIRY,
          }));
        },
      },
    );
    const registered = scheduler.register(registerCommand("per-grant-time-boundary"));
    assert.equal(issuedB?.ok, true, JSON.stringify(issuedB));
    assert.equal(issuedB.value.grantId, "000-equal-grant-b");
    assert.equal(registered.ok, true, JSON.stringify(registered));
    const state = readApplicationStateForOwner(runtime.store);
    const prepareDecision = state.schedulerAuthorizationDecisions.find((decision) => decision.stage === "prepare");
    const actDecision = state.schedulerAuthorizationDecisions.find((decision) => decision.stage === "act");
    assert.equal(prepareDecision.grantId, "111-equal-grant-a");
    assert.equal(actDecision.grantId, "000-equal-grant-b");
    assert.ok(state.grants.some((grant) => grant.grantId === "000-equal-grant-b"));

    const later = new Date(new Date(actDecision.createdAt).valueOf() + 1).toISOString();
    runtime.trusted.setNextIds("grant", ["222-later-grant-c"]);
    runtime.trusted.setNow(prepareDecision.createdAt);
    const staleIssue = runtime.application.execute(Object.freeze({
      kind: "authorization.grant.issue",
      actorId: ACTOR,
      action: "scheduler.register",
      scope: grantScope,
      notBefore: prepareDecision.createdAt,
      expiresAt: EXPIRY,
    }));
    assert.equal(staleIssue.ok, false);
    assert.equal(staleIssue.error.code, "STALE_REVISION");
    runtime.trusted.setNow(later);
    const laterIssue = runtime.application.execute(Object.freeze({
      kind: "authorization.grant.issue",
      actorId: ACTOR,
      action: "scheduler.register",
      scope: grantScope,
      notBefore: later,
      expiresAt: EXPIRY,
    }));
    assert.equal(laterIssue.ok, true, JSON.stringify(laterIssue));
    assert.equal(laterIssue.value.grantId, "222-later-grant-c");
    assert.ok(readApplicationStateForOwner(runtime.store).grants.some((grant) =>
      grant.grantId === "222-later-grant-c"));
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("capability renewal remains readable at a successful scheduler decision instant", async () => {
  const runtime = await prepare("scheduler-equal-time-renewal");
  try {
    runtime.trusted.setNow("2026-09-25T18:00:00.000Z");
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, createFakeSchedulerBackend(), {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(scheduler.register(registerCommand("equal-time-renewal")).ok, true);
    let state = readApplicationStateForOwner(runtime.store);
    const act = state.schedulerAuthorizationDecisions.find((decision) => decision.stage === "act");
    assert.ok(act);
    runtime.trusted.setNow(new Date(new Date(act.createdAt).valueOf() - 1).toISOString());
    const staleRenewal = runtime.application.renew(Object.freeze({
      kind: "authorization.capability.renew",
      expiresAt: "2026-10-20T18:00:00.000Z",
    }));
    assert.equal(staleRenewal.ok, false);
    assert.equal(staleRenewal.error.code, "STALE_REVISION");
    runtime.trusted.setNow(act.createdAt);
    const renewed = runtime.application.renew(Object.freeze({
      kind: "authorization.capability.renew",
      expiresAt: "2026-10-20T18:00:00.000Z",
    }));
    assert.equal(renewed.ok, true, JSON.stringify(renewed));
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerAuthorizationDecisions.find((decision) => decision.decisionId === act.decisionId).grantId, act.grantId);
    assert.equal(state.epochs.at(-1).vocabularyVersion, 7);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const operation of ["register", "remove"]) {
  test(`scheduler ${operation} rechecks Project revisions changed inside the fresh Act confirmation`, async () => {
    const runtime = await prepare(`scheduler-project-act-race-${operation}`);
    try {
      assert.equal(runtime.application.execute(Object.freeze({
        kind: "project.register",
        projectId: "project",
        root: runtime.fixture.projectRoot,
      })).ok, true);
      const projectScope = Object.freeze({
        kind: "project",
        projectId: "project",
        projectResourceRevision: 1,
        projectConfigRevision: 1,
      });
      const backend = createFakeSchedulerBackend();
      const scheduleId = `project-act-race-${operation}`;
      if (operation === "remove") {
        const setup = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
        });
        assert.equal(setup.register(Object.freeze({
          kind: "scheduler.register",
          scheduleId,
          configRevision: 1,
          scope: projectScope,
          scheduleExpression: "hourly-project-race",
          timeZone: "Etc/UTC",
          dispatcherTarget: "dispatcher-main",
          idempotencyKey: "project-race-remove-setup",
        })).ok, true);
        runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
      }
      let targetConfirmationCount = 0;
      const action = `scheduler.${operation}`;
      const racingIngress = Object.freeze({
        ...runtime.trusted,
        confirmHighRisk(input) {
          if (input.action === action && ++targetConfirmationCount === 2) {
            runtime.trusted.setNow(operation === "register"
              ? "2026-09-04T18:02:00.000Z"
              : "2026-09-04T19:03:00.000Z");
            const advanced = runtime.application.execute(Object.freeze({
              kind: "project.update",
              projectId: "project",
              expectedResourceRevision: 1,
              expectedConfigRevision: 1,
            }));
            assert.equal(advanced.ok, true, JSON.stringify(advanced));
          }
          return true;
        },
      });
      const scheduler = createSchedulerApplicationService(runtime.store, racingIngress, backend, {
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
      });
      const command = operation === "register"
        ? Object.freeze({
          kind: "scheduler.register",
          scheduleId,
          configRevision: 1,
          scope: projectScope,
          scheduleExpression: "hourly-project-race",
          timeZone: "Etc/UTC",
          dispatcherTarget: "dispatcher-main",
          idempotencyKey: "project-race-register",
        })
        : Object.freeze({
          kind: "scheduler.remove",
          scheduleId,
          configRevision: 1,
          scope: projectScope,
          expectedRegistrationRevision: 2,
          idempotencyKey: "project-race-remove",
        });
      const denied = scheduler[operation](command);
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
      assert.equal(targetConfirmationCount, 2);
      const state = readApplicationStateForOwner(runtime.store);
      const intent = state.schedulerIntents.at(-1);
      const act = state.schedulerAuthorizationDecisions.find((decision) =>
        decision.requestId === intent.requestId && decision.stage === "act");
      assert.equal(act.result, "deny");
      assert.equal(act.reason, "scope_revision_stale");
      assert.equal(intent.state, "failed");
      assert.deepEqual(
        backend.calls().map((call) => call.operation),
        operation === "register" ? [] : ["register"],
      );
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

for (const operation of ["register", "remove"]) {
  test(`scheduler ${operation} binds a fresh physical Project root after the final confirmation`, async () => {
    const runtime = await prepare(`scheduler-project-root-act-race-${operation}`);
    try {
      assert.equal(runtime.application.execute(Object.freeze({
        kind: "project.register",
        projectId: "project",
        root: runtime.fixture.projectRoot,
      })).ok, true);
      const projectScope = Object.freeze({
        kind: "project",
        projectId: "project",
        projectResourceRevision: 1,
        projectConfigRevision: 1,
      });
      const backend = createFakeSchedulerBackend();
      const scheduleId = `project-root-act-race-${operation}`;
      if (operation === "remove") {
        const setup = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
        });
        assert.equal(setup.register(Object.freeze({
          kind: "scheduler.register",
          scheduleId,
          configRevision: 1,
          scope: projectScope,
          scheduleExpression: "hourly-project-root-race",
          timeZone: "Etc/UTC",
          dispatcherTarget: "dispatcher-main",
          idempotencyKey: "project-root-race-remove-setup",
        })).ok, true);
        runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
      }
      let targetConfirmationCount = 0;
      const action = `scheduler.${operation}`;
      const racingIngress = Object.freeze({
        ...runtime.trusted,
        confirmHighRisk(input) {
          if (input.action === action && ++targetConfirmationCount === 2) {
            renameSync(runtime.fixture.projectRoot, `${runtime.fixture.projectRoot}-replaced-${operation}`);
            mkdirSync(runtime.fixture.projectRoot);
          }
          return true;
        },
      });
      const scheduler = createSchedulerApplicationService(runtime.store, racingIngress, backend, {
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
      });
      const command = operation === "register"
        ? Object.freeze({
          kind: "scheduler.register",
          scheduleId,
          configRevision: 1,
          scope: projectScope,
          scheduleExpression: "hourly-project-root-race",
          timeZone: "Etc/UTC",
          dispatcherTarget: "dispatcher-main",
          idempotencyKey: "project-root-race-register",
        })
        : Object.freeze({
          kind: "scheduler.remove",
          scheduleId,
          configRevision: 1,
          scope: projectScope,
          expectedRegistrationRevision: 2,
          idempotencyKey: "project-root-race-remove",
        });
      const denied = scheduler[operation](command);
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
      assert.equal(targetConfirmationCount, 2);
      const state = readApplicationStateForOwner(runtime.store);
      const intent = state.schedulerIntents.at(-1);
      const act = state.schedulerAuthorizationDecisions.find((decision) =>
        decision.requestId === intent.requestId && decision.stage === "act");
      assert.equal(act.result, "deny");
      assert.equal(act.reason, "scope_revision_stale");
      assert.equal(intent.state, "failed");
      assert.equal(state.schedulerFinalizations.at(-1).verifiedReceiptId, null);
      assert.deepEqual(
        backend.calls().map((call) => call.operation),
        operation === "register" ? [] : ["register"],
      );
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

for (const operation of ["register", "remove"]) {
  for (const confirmationMode of ["false", "throw"]) {
    test(`scheduler ${operation} requires a fresh ${confirmationMode} Act confirmation and replays its durable denial`, async () => {
      const runtime = await prepare(`scheduler-act-confirmation-${operation}-${confirmationMode}`);
      try {
        const backend = createFakeSchedulerBackend();
        if (operation === "remove") {
          const setup = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
            adapterId: "fake-scheduler",
            adapterVersion: "1.0.0-test",
          });
          assert.equal(setup.register(registerCommand(`setup-${confirmationMode}`)).ok, true);
          runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
        }
        const scheduler = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
        }, {
          afterStage(stage) {
            if (stage !== "prepared") return;
            if (confirmationMode === "throw") runtime.trusted.setConfirmationThrows(true);
            else runtime.trusted.setConfirmation(false);
          },
        });
        const command = operation === "register"
          ? registerCommand(`fresh-act-${confirmationMode}`)
          : Object.freeze({
            kind: "scheduler.remove",
            scheduleId: "hourly-main",
            configRevision: 1,
            scope: RUNTIME_SCOPE,
            expectedRegistrationRevision: 2,
            idempotencyKey: `remove-fresh-act-${confirmationMode}`,
          });
        const denied = scheduler[operation](command);
        assert.equal(denied.ok, false);
        assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
        const state = readApplicationStateForOwner(runtime.store);
        const intent = state.schedulerIntents.at(-1);
        const registration = state.schedulerRegistrations.at(-1);
        const finalization = state.schedulerFinalizations.at(-1);
        assert.equal(intent.state, "failed");
        assert.equal(state.schedulerAuthorizationDecisions.filter((decision) =>
          decision.requestId === intent.requestId && decision.stage === "act").at(-1).result, "deny");
        assert.equal(registration.status, operation === "register" ? "removed" : "active");
        assert.equal(registration.revision, 2);
        assert.equal(finalization.resultingRegistrationRevision, 2);
        assert.deepEqual(backend.calls().map((call) => call.operation), operation === "register" ? [] : ["register"]);

        runtime.trusted.setConfirmation(true);
        runtime.trusted.setConfirmationThrows(false);
        const restarted = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
        });
        const replay = restarted[operation](command);
        assert.equal(replay.ok, false);
        assert.equal(replay.error.code, "AUTHORIZATION_DENIED");
        assert.deepEqual(backend.calls().map((call) => call.operation), operation === "register" ? [] : ["register"]);
        assert.equal(JSON.stringify(state).includes("raw-confirmation-error"), false);
      } finally {
        await runtime.store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
}

test("scheduler traps hostile backend result envelopes and durably records bounded ambiguity", async () => {
  const runtime = await prepare("scheduler-hostile-result-envelope");
  try {
    const rawSecret = "RAW_ADAPTER_SECRET";
    const hostile = new Proxy({}, {
      ownKeys() { throw new Error(rawSecret); },
      getOwnPropertyDescriptor() { throw new Error(rawSecret); },
    });
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, Object.freeze({
      register() { return hostile; },
      inspect() { return hostile; },
      remove() { return hostile; },
    }), {
      adapterId: "hostile-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const result = scheduler.register(registerCommand("hostile-result"));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "RECONCILIATION_REQUIRED");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerIntents.at(-1).state, "ambiguous");
    assert.equal(state.schedulerObservations.at(-1).code, "integrity_failure");
    assert.equal(state.schedulerObservations.at(-1).outcome, "ambiguous");
    assert.equal(JSON.stringify(state).includes(rawSecret), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler refuses external registration identity substitution in inspect and remove results", async () => {
  const runtime = await prepare("scheduler-registration-substitution");
  try {
    const fake = createFakeSchedulerBackend();
    const setup = createSchedulerApplicationService(runtime.store, runtime.trusted, fake, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(setup.register(registerCommand("substitution-setup")).ok, true);
    const originalId = readApplicationStateForOwner(runtime.store).schedulerRegistrations.at(-1).externalRegistrationId;
    const maliciousReceipt = (request, code, outcome = "succeeded", externalState = "present") => Object.freeze({
      ok: true,
      receipt: Object.freeze({
        contractId: "ato.scheduler/v1",
        receiptId: `malicious-${request.operation}-${code}`,
        operation: request.operation,
        operationId: request.operationId,
        scheduleId: request.scheduleId,
        configRevision: request.configRevision,
        externalRegistrationId: "external-substituted",
        externalState,
        outcome,
        code,
        enabled: externalState === "present" ? true : null,
        nextTriggerAt: externalState === "present" ? "2026-09-04T20:00:00.000Z" : null,
        evidenceReference: "bounded-evidence",
        observedAt: "2026-09-04T19:00:00.000Z",
      }),
    });
    const malicious = Object.freeze({
      register: (request) => fake.register(request),
      inspect: (request) => maliciousReceipt(request, "inspected_present"),
      remove: (request) => maliciousReceipt(request, "ambiguous", "ambiguous", "ambiguous"),
    });
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, malicious, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
    const inspected = scheduler.inspect(Object.freeze({
      kind: "scheduler.inspect",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
    }));
    assert.equal(inspected.ok, false);
    assert.equal(inspected.error.code, "RECONCILIATION_REQUIRED");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerRegistrations.at(-1).externalRegistrationId, originalId);
    assert.equal(state.schedulerObservations.at(-1).code, "integrity_failure");

    runtime.trusted.setNow("2026-09-04T19:03:00.000Z");
    const removed = scheduler.remove(Object.freeze({
      kind: "scheduler.remove",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
      idempotencyKey: "substituted-remove",
    }));
    assert.equal(removed.ok, false);
    assert.equal(removed.error.code, "RECONCILIATION_REQUIRED");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerRegistrations.at(-1).status, "ambiguous");
    assert.equal(state.schedulerRegistrations.at(-1).externalRegistrationId, originalId);
    assert.equal(JSON.stringify(state).includes("external-substituted"), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler reconciliation cannot replace a removal intent's bound external registration identity", async () => {
  const runtime = await prepare("scheduler-reconcile-substitution");
  try {
    const fake = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, fake, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(scheduler.register(registerCommand("reconcile-substitution-setup")).ok, true);
    const originalId = readApplicationStateForOwner(runtime.store).schedulerRegistrations.at(-1).externalRegistrationId;
    fake.failNext("response_loss");
    runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
    assert.equal(scheduler.remove(Object.freeze({
      kind: "scheduler.remove",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
      idempotencyKey: "reconcile-substituted-remove",
    })).error.code, "RECONCILIATION_REQUIRED");
    let state = readApplicationStateForOwner(runtime.store);
    const intent = state.schedulerIntents.at(-1);
    const malicious = Object.freeze({
      register: (request) => fake.register(request),
      remove: (request) => fake.remove(request),
      inspect(request) {
        assert.equal(request.externalRegistrationId, originalId);
        return Object.freeze({
          ok: true,
          receipt: Object.freeze({
            contractId: "ato.scheduler/v1",
            receiptId: "malicious-reconcile-receipt",
            operation: "inspect",
            operationId: request.operationId,
            scheduleId: request.scheduleId,
            configRevision: request.configRevision,
            externalRegistrationId: "external-substituted",
            externalState: "ambiguous",
            outcome: "ambiguous",
            code: "ambiguous",
            enabled: null,
            nextTriggerAt: null,
            evidenceReference: "bounded-reconcile-evidence",
            observedAt: "2026-09-04T19:03:00.000Z",
          }),
        });
      },
    });
    runtime.trusted.setNow("2026-09-04T19:03:00.000Z");
    const restarted = createSchedulerApplicationService(runtime.store, runtime.trusted, malicious, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const reconciled = restarted.reconcile(Object.freeze({
      kind: "scheduler.reconcile",
      intentId: intent.intentId,
      expectedIntentRevision: intent.revision,
    }));
    assert.equal(reconciled.ok, false);
    assert.equal(reconciled.error.code, "RECONCILIATION_REQUIRED");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerRegistrations.at(-1).externalRegistrationId, originalId);
    assert.equal(state.schedulerRegistrations.at(-1).status, "ambiguous");
    assert.equal(state.schedulerObservations.at(-1).code, "integrity_failure");
    assert.equal(JSON.stringify(state).includes("external-substituted"), false);

    runtime.trusted.setNow("2026-09-04T19:04:00.000Z");
    const proving = createSchedulerApplicationService(runtime.store, runtime.trusted, fake, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const currentIntent = state.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
    const recovered = proving.reconcile(Object.freeze({
      kind: "scheduler.reconcile",
      intentId: intent.intentId,
      expectedIntentRevision: currentIntent.revision,
    }));
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    state = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(
      state.schedulerObservations.filter((candidate) => candidate.intentId === intent.intentId)
        .map((candidate) => candidate.observationNumber),
      [1, 2, 3],
    );
    assert.equal(state.schedulerRegistrations.at(-1).status, "removed");
    assert.equal(state.schedulerRegistrations.at(-1).revision, 6);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler classifies retryable no-effect failures as terminal refusal rather than ambiguity", async () => {
  const runtime = await prepare("scheduler-retryable-no-effect");
  try {
    const backend = createFakeSchedulerBackend();
    backend.failNext("transient");
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const command = registerCommand("retryable-no-effect");
    const result = scheduler.register(command);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "BACKEND_FAILURE");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerIntents.at(-1).state, "failed");
    assert.equal(state.schedulerRegistrations.at(-1).status, "removed");
    assert.equal(state.schedulerObservations.at(-1).outcome, "refused");
    assert.equal(state.schedulerObservations.at(-1).code, "transient_external");
    assert.equal(state.schedulerFinalizations.at(-1).code, "transient_external");
    assert.equal(scheduler.register(command).error.code, "BACKEND_FAILURE");
    assert.equal(backend.calls().length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler keeps adapter observation time separate from trusted lifecycle time", async () => {
  const runtime = await prepare("scheduler-adapter-time-separation");
  try {
    const fake = createFakeSchedulerBackend();
    const backend = Object.freeze({
      register(request) {
        const result = fake.register(request);
        return Object.freeze({
          ok: true,
          receipt: Object.freeze({ ...result.receipt, observedAt: "2099-01-01T00:00:00.000Z" }),
        });
      },
      inspect: (request) => fake.inspect(request),
      remove: (request) => fake.remove(request),
    });
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const result = scheduler.register(registerCommand("adapter-future-time"));
    assert.equal(result.ok, true, JSON.stringify(result));
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerObservations.at(-1).observedAt, "2099-01-01T00:00:00.000Z");
    assert.ok(state.schedulerReceipts.at(-1).verifiedAt < "2099-01-01T00:00:00.000Z");
    assert.ok(state.schedulerFinalizations.at(-1).finalizedAt < "2099-01-01T00:00:00.000Z");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler restart selects reconciliation evidence by observation number rather than opaque ID", async () => {
  const runtime = await prepare("scheduler-observation-order");
  try {
    runtime.trusted.setObservationIds(["observation-z-last-lexically", "observation-a-first-lexically"]);
    const backend = createFakeSchedulerBackend();
    backend.failNext("response_loss");
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const command = registerCommand("reverse-observation-order");
    assert.equal(scheduler.register(command).error.code, "RECONCILIATION_REQUIRED");
    let state = readApplicationStateForOwner(runtime.store);
    const ambiguous = state.schedulerIntents.at(-1);
    runtime.trusted.setNow("2026-09-04T19:03:00.000Z");
    const crashing = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    }, {
      afterStage(stage) {
        if (stage === "reconciled-observed") throw new Error("simulated-worker-death");
      },
    });
    const interrupted = crashing.reconcile(Object.freeze({
      kind: "scheduler.reconcile",
      intentId: ambiguous.intentId,
      expectedIntentRevision: ambiguous.revision,
    }));
    assert.equal(interrupted.ok, false);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerIntents.at(-1).state, "observed");
    assert.deepEqual(state.schedulerObservations.map((item) => item.observationNumber), [1, 2]);
    assert.deepEqual(state.schedulerObservations.map((item) => item.observationId), [
      "observation-z-last-lexically",
      "observation-a-first-lexically",
    ]);

    runtime.trusted.setNow("2026-09-04T19:04:00.000Z");
    const restarted = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const recovered = restarted.register(command);
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.registration.status, "active");
    assert.deepEqual(backend.calls().map((call) => call.operation), ["register", "inspect"]);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const operation of ["register", "remove"]) {
  for (const failpoint of ["prepared", "executing", "adapter-returned", "observed", "verified", "finalized"]) {
    test(`scheduler ${operation} recovers durably after ${failpoint}`, async () => {
      const runtime = await prepare(`scheduler-recovery-${operation}-${failpoint}`);
      try {
        const backend = createFakeSchedulerBackend();
        if (operation === "remove") {
          const setup = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
            adapterId: "fake-scheduler",
            adapterVersion: "1.0.0-test",
          });
          assert.equal(setup.register(registerCommand(`recovery-setup-${failpoint}`)).ok, true);
          runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
        }
        let interrupted = false;
        const crashing = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
        }, {
          afterStage(stage) {
            if (stage !== failpoint || interrupted) return;
            interrupted = true;
            throw new Error(`simulated-worker-death-${failpoint}`);
          },
        });
        const command = operation === "register"
          ? registerCommand(`recovery-register-${failpoint}`)
          : Object.freeze({
            kind: "scheduler.remove",
            scheduleId: "hourly-main",
            configRevision: 1,
            scope: RUNTIME_SCOPE,
            expectedRegistrationRevision: 2,
            idempotencyKey: `recovery-remove-${failpoint}`,
          });
        let first = null;
        try {
          first = crashing[operation](command);
        } catch (error) {
          assert.match(error.message, /simulated-worker-death/u);
        }
        if (first !== null) assert.equal(first.ok, false);
        let state = readApplicationStateForOwner(runtime.store);
        let intent = state.schedulerIntents.at(-1);
        assert.equal(interrupted, true);
        const restarted = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
        });
        if (intent.state === "executing" || intent.state === "ambiguous") {
          const replay = restarted[operation](command);
          assert.equal(replay.ok, false);
          assert.equal(replay.error.code, "RECONCILIATION_REQUIRED");
          runtime.trusted.setNow("2026-09-04T19:03:00.000Z");
          restarted.reconcile(Object.freeze({
            kind: "scheduler.reconcile",
            intentId: intent.intentId,
            expectedIntentRevision: intent.revision,
          }));
        } else {
          runtime.trusted.setNow("2026-09-04T19:03:00.000Z");
          restarted[operation](command);
        }
        state = readApplicationStateForOwner(runtime.store);
        intent = state.schedulerIntents.at(-1);
        assert.equal(intent.state, "finalized");
        const mutationCalls = backend.calls().filter((call) => call.operation === operation);
        assert.ok(mutationCalls.length <= 1);
        const beforeReplayCalls = backend.calls().length;
        restarted[operation](command);
        assert.equal(backend.calls().length, beforeReplayCalls);
        assert.equal(JSON.stringify(state).includes("simulated-worker-death"), false);
      } finally {
        await runtime.store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
}

test("scheduler hostile commands and unconfirmed high-risk mutations fail without backend access", async () => {
  const runtime = await prepare("scheduler-denials");
  try {
    const backend = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    runtime.trusted.setConfirmation(false);
    const unconfirmed = scheduler.register(registerCommand("unconfirmed"));
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "AUTHORIZATION_DENIED");
    const poison = new Proxy({}, { ownKeys() { throw new Error("must not escape"); } });
    assert.equal(scheduler.register(poison).error.code, "INVALID_INPUT");
    assert.equal(backend.calls().length, 0);
    const serialized = JSON.stringify(readApplicationStateForOwner(runtime.store));
    assert.equal(serialized.includes("unconfirmed"), false);
    assert.equal(serialized.includes("must not escape"), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler state survives exact backup, doctor, restore, and fresh reopen", async () => {
  const runtime = await prepare("scheduler-backup-restore");
  let store = runtime.store;
  try {
    const backend = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationService(store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(scheduler.register(registerCommand("backup-schedule")).ok, true);
    const generationId = randomUUID();
    runtime.trusted.setNow(new Date(Date.now() + 60_000).toISOString());
    const backupAuthorization = runtime.application.execute(Object.freeze({
      kind: "runtime.backup",
      backupGenerationId: generationId,
    }));
    assert.equal(backupAuthorization.ok, true, JSON.stringify(backupAuthorization));
    const backup = await store.createBackup(backupAuthorization.value);
    assert.equal(backup.generationId, generationId);
    assert.equal(verifyBackupGeneration(runtime.fixture.layout, generationId).generationId, generationId);
    const backedUp = readApplicationStateForOwner(store);
    assert.equal(backedUp.schedulerRegistrations.at(-1).status, "active");

    runtime.trusted.setNow(new Date(Date.now() + 120_000).toISOString());
    const restoreAuthorization = runtime.application.execute(Object.freeze({
      kind: "runtime.restore",
      backupGenerationId: generationId,
    }));
    assert.equal(restoreAuthorization.ok, true, JSON.stringify(restoreAuthorization));
    await store.close();
    store = null;
    assert.equal(
      inspectRuntimeDoctor(runtime.fixture.layout.root, runtime.fixture.sourceCheckoutRoot).health,
      "healthy",
    );
    const expectedCurrent = await inspectPrimaryIdentity(runtime.fixture.layout);
    await restoreBackup(runtime.fixture.layout, Object.freeze({
      generationId,
      expectedCurrent,
      acknowledgeDataLoss: true,
      applicationVersion: "ep03e-scheduler-restore",
      authorization: restoreAuthorization.value,
    }));
    store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep03e-scheduler-reopen" });
    const restored = readApplicationStateForOwner(store);
    assert.deepEqual(restored.schedulerConfigurations, backedUp.schedulerConfigurations);
    assert.deepEqual(restored.schedulerRegistrations, backedUp.schedulerRegistrations);
    assert.deepEqual(restored.schedulerIntents, backedUp.schedulerIntents);
    assert.deepEqual(restored.schedulerReceipts, backedUp.schedulerReceipts);
    assert.deepEqual(restored.schedulerFinalizations, backedUp.schedulerFinalizations);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

const SCHEDULER_CORRUPTIONS = Object.freeze([
  Object.freeze({
    name: "configuration digest",
    sql: "DROP TRIGGER scheduler_configurations_no_update; UPDATE scheduler_configurations SET config_sha256='BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'",
  }),
  Object.freeze({
    name: "registration projection",
    sql: "DROP TRIGGER scheduler_registrations_update_guard; UPDATE scheduler_registrations SET external_registration_id='substituted-external'",
  }),
  Object.freeze({
    name: "partial registration lifecycle",
    sql: "DROP TRIGGER scheduler_registrations_update_guard; UPDATE scheduler_registrations SET status='pending_remove'",
  }),
  Object.freeze({
    name: "registration last intent lineage",
    sql: "PRAGMA foreign_keys=OFF; DROP TRIGGER scheduler_registrations_update_guard; UPDATE scheduler_registrations SET last_intent_id='missing-scheduler-intent'",
  }),
  Object.freeze({
    name: "operation request lineage",
    sql: "DROP TRIGGER scheduler_operation_requests_no_update; UPDATE scheduler_operation_requests SET operation='remove', external_registration_id='substituted-external' WHERE operation='register'",
  }),
  Object.freeze({
    name: "authorization decision action",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET action='scheduler.inspect' WHERE action='scheduler.register'",
  }),
  Object.freeze({
    name: "Act decision actor",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET actor_id='substituted-actor' WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision action",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET action='scheduler.remove' WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision scope",
    sql: "PRAGMA foreign_keys=OFF; DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET project_id='substituted-project', project_resource_revision=1, project_config_revision=1 WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision grant",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET grant_id=(SELECT grant_id FROM authorization_grants WHERE action='scheduler.remove' AND revoked_at IS NULL LIMIT 1), grant_revision=(SELECT revision FROM authorization_grants WHERE action='scheduler.remove' AND revoked_at IS NULL LIMIT 1) WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision grant revision",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET grant_revision=grant_revision+1 WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision result reason",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET result='deny', reason='confirmation_required' WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision policy",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET policy_result='deny' WHERE stage='act'",
  }),
  Object.freeze({
    name: "Act decision timestamp",
    sql: "DROP TRIGGER scheduler_authorization_decisions_no_update; UPDATE scheduler_authorization_decisions SET created_at='2026-01-01T00:00:00.000Z' WHERE stage='act'",
  }),
  Object.freeze({
    name: "intent operation",
    sql: "DROP TRIGGER scheduler_operation_intents_update_guard; UPDATE scheduler_operation_intents SET operation='remove'",
  }),
  Object.freeze({
    name: "observation receipt digest",
    sql: "DROP TRIGGER scheduler_observations_no_update; UPDATE scheduler_observations SET code='removed' WHERE intent_id IS NOT NULL",
  }),
  Object.freeze({
    name: "verified receipt",
    sql: "DROP TRIGGER scheduler_verified_receipts_no_update; UPDATE scheduler_verified_receipts SET code='removed'",
  }),
  Object.freeze({
    name: "finalization outcome",
    sql: "DROP TRIGGER scheduler_finalizations_no_update; UPDATE scheduler_finalizations SET outcome='removed'",
  }),
  Object.freeze({
    name: "event actor",
    sql: "DROP TRIGGER scheduler_events_no_update; UPDATE scheduler_events SET actor_id='substituted-actor'",
  }),
  Object.freeze({
    name: "delivery attachment",
    sql: "DROP TRIGGER scheduler_delivery_observations_no_update; UPDATE scheduler_delivery_observations SET attachment_role='duplicate' WHERE attachment_role='canonical'",
  }),
  Object.freeze({
    name: "delivery scheduler source",
    sql: "DROP TRIGGER scheduler_delivery_observations_no_update; UPDATE scheduler_delivery_observations SET adapter_id='substituted-scheduler' WHERE attachment_role='canonical'",
  }),
  Object.freeze({
    name: "delivery dispatcher target",
    sql: "DROP TRIGGER scheduler_delivery_observations_no_update; UPDATE scheduler_delivery_observations SET dispatcher_target='substituted-dispatcher' WHERE attachment_role='canonical'",
  }),
  Object.freeze({
    name: "scheduled tuple",
    sql: "DROP TRIGGER scheduler_scheduled_tuples_no_update; UPDATE scheduler_scheduled_tuples SET scheduled_for='2026-09-04T21:00:00.000Z'",
  }),
]);

for (const corruption of SCHEDULER_CORRUPTIONS) {
  test(`scheduler decoder rejects ${corruption.name} corruption`, async () => {
    const runtime = await prepare(`scheduler-corruption-${corruption.name}`);
    try {
      const backend = createFakeSchedulerBackend();
      const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
      });
      const corruptionKey = corruption.name.replaceAll(/[^a-z0-9]+/gu, "-");
      assert.equal(scheduler.register(registerCommand(`corruption-${corruptionKey}`)).ok, true);
      runtime.trusted.setNow("2026-09-04T20:01:00.000Z");
      const dispatcher = createDispatcherApplicationService(runtime.store, runtime.trusted, {
        adapterId: "manual-local",
        adapterVersion: "1.0.0",
        schedulerIngress: Object.freeze({
          adapterId: "fake-scheduler",
          adapterVersion: "1.0.0-test",
          dispatcherTarget: "dispatcher-main",
        }),
      });
      assert.equal(dispatcher.deliverScheduled(Object.freeze({
        contractId: "ato.scheduler/v1",
        operation: "dispatch_trigger",
        triggerId: "corruption-trigger",
        scheduleId: "hourly-main",
        configRevision: 1,
        scheduledFor: "2026-09-04T20:00:00.000Z",
        observedAt: "2026-09-04T20:00:01.000Z",
        claimedDeduplication: "corruption-claim",
      })).ok, true);
      const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
      try {
        writable.exec(corruption.sql);
      } finally {
        writable.close();
      }
      assert.throws(
        () => readApplicationStateForOwner(runtime.store),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

test("scheduler decoder rejects a schema-valid pending remove projection written before Act", async () => {
  const runtime = await prepare("scheduler-corruption-pending-remove-before-act");
  try {
    const backend = createFakeSchedulerBackend();
    const setup = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(setup.register(registerCommand("pending-remove-setup")).ok, true);
    runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
    const crashing = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    }, {
      afterStage(stage) {
        if (stage === "prepared") throw new Error("simulated-worker-death");
      },
    });
    const interrupted = crashing.remove(Object.freeze({
      kind: "scheduler.remove",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
      idempotencyKey: "pending-remove-before-act",
    }));
    assert.equal(interrupted.ok, false);
    assert.equal(readApplicationStateForOwner(runtime.store).schedulerIntents.at(-1).state, "pending");
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER scheduler_registrations_update_guard; UPDATE scheduler_registrations SET status='pending_remove', revision=revision+1, last_intent_id=(SELECT intent_id FROM scheduler_operation_intents WHERE operation='remove'), updated_at='2026-09-04T19:02:01.000Z'");
    } finally {
      writable.close();
    }
    assert.throws(
      () => readApplicationStateForOwner(runtime.store),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler decoder rejects grant_missing when an exact usable Act grant existed", async () => {
  const runtime = await prepare("scheduler-corruption-denied-act-reason");
  try {
    const backend = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    }, {
      afterStage(stage) {
        if (stage === "prepared") runtime.trusted.setConfirmation(false);
      },
    });
    const denied = scheduler.register(registerCommand("corrupt-denied-act-reason"));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    const state = readApplicationStateForOwner(runtime.store);
    const act = state.schedulerAuthorizationDecisions.find((decision) => decision.stage === "act");
    assert.notEqual(act.grantId, null);
    assert.equal(act.reason, "confirmation_required");
    assert.ok(state.grants.some((grant) =>
      grant.actorId === act.actorId && grant.action === act.action && grant.revokedAt === null &&
      grant.notBefore <= act.createdAt && grant.expiresAt > act.createdAt));
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER scheduler_authorization_decisions_no_update; DROP TRIGGER scheduler_finalizations_no_update; DROP TRIGGER scheduler_events_no_update; UPDATE scheduler_authorization_decisions SET reason='grant_missing', grant_id=NULL, grant_revision=NULL WHERE stage='act'; UPDATE scheduler_finalizations SET code='grant_missing'; UPDATE scheduler_events SET reason_code='grant_missing' WHERE event_kind='scheduler.operation.denied'");
    } finally {
      writable.close();
    }
    assert.throws(
      () => readApplicationStateForOwner(runtime.store),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler decoder rejects an ambiguous effect-possible mutation without its allowed Act", async () => {
  const runtime = await prepare("scheduler-corruption-ambiguous-without-act");
  try {
    const backend = createFakeSchedulerBackend();
    backend.failNext("ambiguous");
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const ambiguous = scheduler.register(registerCommand("ambiguous-without-act"));
    assert.equal(ambiguous.ok, false);
    assert.equal(ambiguous.error.code, "RECONCILIATION_REQUIRED");
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER scheduler_authorization_decisions_no_delete; DELETE FROM scheduler_authorization_decisions WHERE stage='act'");
    } finally {
      writable.close();
    }
    assert.throws(
      () => readApplicationStateForOwner(runtime.store),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduler decoder reapplies receipt semantics even when a forged observation digest matches", async () => {
  const runtime = await prepare("scheduler-corruption-receipt-semantics");
  try {
    const backend = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(scheduler.register(registerCommand("receipt-semantics-setup")).ok, true);
    runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
    assert.equal(scheduler.inspect(Object.freeze({
      kind: "scheduler.inspect",
      scheduleId: "hourly-main",
      configRevision: 1,
      scope: RUNTIME_SCOPE,
      expectedRegistrationRevision: 2,
    })).ok, true);
    const state = readApplicationStateForOwner(runtime.store);
    const observation = state.schedulerObservations.find((candidate) => candidate.intentId === null);
    const request = state.schedulerOperationRequests.find((candidate) => candidate.requestId === observation.requestId);
    const forged = Object.freeze({
      requestId: observation.requestId,
      intentId: null,
      observationNumber: observation.observationNumber,
      operation: request.operation,
      operationId: request.operationId,
      scheduleId: request.scheduleId,
      configRevision: request.configRevision,
      externalState: "present",
      externalRegistrationId: observation.externalRegistrationId,
      enabled: observation.enabled,
      nextTriggerAt: observation.nextTriggerAt,
      outcome: "ambiguous",
      code: "ambiguous",
      receiptId: observation.receiptId,
      evidenceReference: observation.evidenceReference,
      observedAt: observation.observedAt,
    });
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER scheduler_observations_no_update");
      writable.prepare("UPDATE scheduler_observations SET outcome='ambiguous', code='ambiguous', receipt_sha256=? WHERE observation_id=?")
        .run(schedulerReceiptSha256(forged), observation.observationId);
    } finally {
      writable.close();
    }
    assert.throws(
      () => readApplicationStateForOwner(runtime.store),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const corruption of [
  Object.freeze({ operation: "inspect", behavior: "ambiguous" }),
  Object.freeze({ operation: "inspect", behavior: "malformed" }),
  Object.freeze({ operation: "remove", behavior: "ambiguous" }),
  Object.freeze({ operation: "remove", behavior: "response_loss" }),
]) {
  for (const identityForgery of ["different", "null"]) {
    test(`scheduler decoder rejects ${corruption.operation} ${corruption.behavior} observation ${identityForgery} identity with a recomputed digest`, async () => {
      const runtime = await prepare(`scheduler-corruption-${corruption.operation}-${corruption.behavior}-${identityForgery}`);
    try {
      const backend = createFakeSchedulerBackend();
      const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
      });
      assert.equal(scheduler.register(registerCommand(`identity-${corruption.operation}-${corruption.behavior}-setup`)).ok, true);
      runtime.trusted.setNow("2026-09-04T19:02:00.000Z");
      backend.failNext(corruption.behavior);
      const result = corruption.operation === "inspect"
        ? scheduler.inspect(Object.freeze({
          kind: "scheduler.inspect",
          scheduleId: "hourly-main",
          configRevision: 1,
          scope: RUNTIME_SCOPE,
          expectedRegistrationRevision: 2,
        }))
        : scheduler.remove(Object.freeze({
          kind: "scheduler.remove",
          scheduleId: "hourly-main",
          configRevision: 1,
          scope: RUNTIME_SCOPE,
          expectedRegistrationRevision: 2,
          idempotencyKey: `identity-remove-${corruption.behavior}-${identityForgery}`,
        }));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "RECONCILIATION_REQUIRED");
      const state = readApplicationStateForOwner(runtime.store);
      const observation = state.schedulerObservations.at(-1);
      const request = state.schedulerOperationRequests.find((candidate) => candidate.requestId === observation.requestId);
      assert.notEqual(request.externalRegistrationId, null);
      assert.equal(observation.externalState, "ambiguous");
      const forgedExternalRegistrationId = identityForgery === "null" ? null : "external-substituted";
      const forged = Object.freeze({
        requestId: observation.requestId,
        intentId: observation.intentId,
        observationNumber: observation.observationNumber,
        operation: request.operation,
        operationId: request.operationId,
        scheduleId: request.scheduleId,
        configRevision: request.configRevision,
        externalState: observation.externalState,
        externalRegistrationId: forgedExternalRegistrationId,
        enabled: observation.enabled,
        nextTriggerAt: observation.nextTriggerAt,
        outcome: observation.outcome,
        code: observation.code,
        receiptId: observation.receiptId,
        evidenceReference: observation.evidenceReference,
        observedAt: observation.observedAt,
      });
      const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
      try {
        writable.exec("DROP TRIGGER scheduler_observations_no_update");
        if (corruption.operation === "remove") {
          writable.exec("DROP TRIGGER scheduler_registrations_update_guard");
          writable.prepare("UPDATE scheduler_registrations SET external_registration_id=? WHERE status='ambiguous'")
            .run(forgedExternalRegistrationId);
        }
        writable.prepare("UPDATE scheduler_observations SET external_registration_id=?, receipt_sha256=? WHERE observation_id=?")
          .run(forgedExternalRegistrationId, schedulerReceiptSha256(forged), observation.observationId);
      } finally {
        writable.close();
      }
      assert.throws(
        () => readApplicationStateForOwner(runtime.store),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
    });
  }
}

test("scheduler decoder rejects forging ambiguous effect evidence into failed no-effect state", async () => {
  const runtime = await prepare("scheduler-corruption-ambiguous-to-failed");
  try {
    const backend = createFakeSchedulerBackend();
    backend.failNext("response_loss");
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    const result = scheduler.register(registerCommand("ambiguous-to-failed"));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "RECONCILIATION_REQUIRED");
    const state = readApplicationStateForOwner(runtime.store);
    const intent = state.schedulerIntents.at(-1);
    const registration = state.schedulerRegistrations.at(-1);
    const observation = state.schedulerObservations.at(-1);
    const act = state.schedulerAuthorizationDecisions.find((decision) =>
      decision.requestId === intent.requestId && decision.stage === "act");
    assert.equal(intent.state, "ambiguous");
    assert.equal(registration.status, "ambiguous");
    assert.equal(observation.outcome, "ambiguous");
    assert.equal(observation.receiptId, null);
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER scheduler_operation_intents_update_guard; DROP TRIGGER scheduler_registrations_update_guard");
      writable.prepare("UPDATE scheduler_operation_intents SET state='failed' WHERE intent_id=?").run(intent.intentId);
      writable.prepare("UPDATE scheduler_registrations SET status='removed', external_registration_id=NULL, enabled=NULL, next_trigger_at=NULL WHERE schedule_id=? AND config_revision=?")
        .run(registration.scheduleId, registration.configRevision);
      writable.prepare(`INSERT INTO scheduler_finalizations(
        finalization_id, intent_id, verified_receipt_id, authorization_decision_id,
        outcome, code, resulting_registration_status, resulting_registration_revision, finalized_at
      ) VALUES (?, ?, NULL, ?, 'failed', ?, 'removed', ?, ?)`).run(
        "forged-ambiguous-finalization",
        intent.intentId,
        act.decisionId,
        observation.code,
        registration.revision,
        observation.observedAt,
      );
    } finally {
      writable.close();
    }
    assert.throws(
      () => readApplicationStateForOwner(runtime.store),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
