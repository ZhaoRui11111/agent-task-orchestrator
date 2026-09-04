import assert from "node:assert/strict";
import { mkdirSync, renameSync } from "node:fs";
import test from "node:test";
import {
  SCHEDULER_CONTRACT_ID,
  createApplicationService,
  createDispatcherApplicationService,
  createDispatcherApplicationServiceWithHooks,
  createSchedulerApplicationService,
  createSchedulerApplicationServiceWithHooks,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";
import { createFakeSchedulerBackend } from "./fixtures/fake-scheduler-backend.mjs";

const ACTOR = "scheduled-dispatch-owner";
const PRINCIPAL = "B".repeat(64);
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
  return Object.freeze({
    currentActor: () => Object.freeze({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => "scheduled-worker",
    currentWorkerOwner: () => "scheduled-worker",
    currentExecutionLeaseOwner: () => "execution-worker",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => Object.freeze({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }),
    setNow(value) { now = value; },
    setRuntimeRootKey(value) { runtimeRootKey = value; },
  });
}

async function prepare(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03e-scheduled-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  for (let stage = 2; stage <= 7; stage += 1) {
    trusted.setNow(`2026-09-04T18:00:0${stage}.000Z`);
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  }
  const backend = createFakeSchedulerBackend();
  trusted.setNow("2026-09-04T18:01:00.000Z");
  const scheduler = createSchedulerApplicationService(store, trusted, backend, {
    adapterId: "fake-scheduler",
    adapterVersion: "1.0.0-test",
  });
  const registered = scheduler.register(Object.freeze({
    kind: "scheduler.register",
    scheduleId: "hourly-main",
    configRevision: 1,
    scope: RUNTIME_SCOPE,
    scheduleExpression: "hourly-at-minute-zero",
    timeZone: "Etc/UTC",
    dispatcherTarget: "dispatcher-main",
    idempotencyKey: "register-hourly-main",
  }));
  assert.equal(registered.ok, true, JSON.stringify(registered));
  trusted.setNow("2026-09-04T20:01:00.000Z");
  const dispatcher = createDispatcherApplicationService(store, trusted, {
    adapterId: "manual-local",
    adapterVersion: "1.0.0",
    schedulerIngress: Object.freeze({
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
      dispatcherTarget: "dispatcher-main",
    }),
    executionLeaseSeconds: 300,
  });
  return { fixture, trusted, store, application, dispatcher };
}

function trigger(overrides = {}) {
  return Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "dispatch_trigger",
    triggerId: "raw-trigger-secret",
    scheduleId: "hourly-main",
    configRevision: 1,
    scheduledFor: "2026-09-04T20:00:00.000Z",
    observedAt: "2026-09-04T20:00:01.000Z",
    claimedDeduplication: "raw-dedup-secret",
    ...overrides,
  });
}

test("scheduled deliveries persist one canonical tuple and attach every duplicate without restart", async () => {
  const runtime = await prepare("scheduled-duplicates");
  try {
    const canonical = runtime.dispatcher.deliverScheduled(trigger());
    assert.equal(canonical.ok, true, JSON.stringify(canonical));
    assert.equal(canonical.replayed, false);
    const duplicate = runtime.dispatcher.deliverScheduled(trigger({
      triggerId: "another-trigger-secret",
      claimedDeduplication: "another-dedup-secret",
    }));
    assert.equal(duplicate.ok, true, JSON.stringify(duplicate));
    assert.equal(duplicate.replayed, true);
    assert.equal(duplicate.value.runId, canonical.value.runId);
    const repeatedExternalId = runtime.dispatcher.deliverScheduled(trigger());
    assert.equal(repeatedExternalId.ok, true, JSON.stringify(repeatedExternalId));
    assert.equal(repeatedExternalId.value.runId, canonical.value.runId);

    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerScheduledTuples.length, 1);
    assert.equal(state.schedulerDeliveryObservations.length, 3);
    assert.deepEqual(state.schedulerDeliveryObservations.map((item) => item.attachmentRole), ["canonical", "duplicate", "duplicate"]);
    assert.equal(new Set(state.schedulerDeliveryObservations.map((item) => item.observationId)).size, 3);
    assert.equal(state.dispatcherRuns.length, 1);
    const serialized = JSON.stringify(state);
    assert.equal(serialized.includes("raw-trigger-secret"), false);
    assert.equal(serialized.includes("raw-dedup-secret"), false);

    runtime.trusted.setNow("2026-09-04T20:02:00.000Z");
    const manual = runtime.dispatcher.start(Object.freeze({
      kind: "dispatch.start",
      idempotencyKey: "manual-near-scheduled",
      leaseDurationSeconds: 300,
    }));
    assert.equal(manual.ok, true, JSON.stringify(manual));
    assert.notEqual(manual.value.runId, canonical.value.runId);
    const afterManual = readApplicationStateForOwner(runtime.store);
    assert.equal(afterManual.dispatcherRuns.length, 2);
    assert.equal(afterManual.schedulerScheduledTuples.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("competing delivery after preflight still attaches to one canonical scheduled run", async () => {
  const runtime = await prepare("scheduled-competing-delivery");
  try {
    let competitor = null;
    let dispatched = false;
    const racing = createDispatcherApplicationServiceWithHooks(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
      schedulerIngress: Object.freeze({
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
        dispatcherTarget: "dispatcher-main",
      }),
    }, {
      afterStage(stage) {
        if (stage !== "scheduled-delivery-preflight" || dispatched) return;
        dispatched = true;
        competitor = runtime.dispatcher.deliverScheduled(trigger({ triggerId: "competing-winner" }));
      },
    });
    const raced = racing.deliverScheduled(trigger({ triggerId: "competing-loser" }));
    assert.equal(competitor.ok, true, JSON.stringify(competitor));
    assert.equal(raced.ok, true, JSON.stringify(raced));
    assert.equal(raced.replayed, true);
    assert.equal(raced.value.runId, competitor.value.runId);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerScheduledTuples.length, 1);
    assert.equal(state.dispatcherRuns.length, 1);
    assert.equal(state.schedulerDeliveryObservations.filter((observation) => observation.attachmentRole === "canonical").length, 1);
    assert.equal(state.schedulerDeliveryObservations.filter((observation) => observation.attachmentRole === "duplicate").length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduled ingress binds its source and receiving target without changing Manual execution identity", async () => {
  const runtime = await prepare("scheduled-source-target-binding");
  try {
    const unconfigured = createDispatcherApplicationService(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
    });
    assert.equal(unconfigured.deliverScheduled(trigger()).error.code, "INVALID_INPUT");
    assert.equal(readApplicationStateForOwner(runtime.store).schedulerDeliveryObservations.length, 0);

    const wrongSource = createDispatcherApplicationService(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
      schedulerIngress: Object.freeze({
        adapterId: "other-scheduler",
        adapterVersion: "1.0.0-test",
        dispatcherTarget: "dispatcher-main",
      }),
    });
    assert.equal(wrongSource.deliverScheduled(trigger({ triggerId: "wrong-source" })).error.code, "STALE_REVISION");
    const wrongTarget = createDispatcherApplicationService(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
      schedulerIngress: Object.freeze({
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
        dispatcherTarget: "dispatcher-other",
      }),
    });
    assert.equal(wrongTarget.deliverScheduled(trigger({ triggerId: "wrong-target" })).error.code, "STALE_REVISION");
    const accepted = runtime.dispatcher.deliverScheduled(trigger({ triggerId: "correct-binding" }));
    assert.equal(accepted.ok, true, JSON.stringify(accepted));
    let state = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(state.schedulerDeliveryObservations.map((observation) => observation.disposition), [
      "rejected_stale_config", "rejected_stale_config", "accepted",
    ]);
    assert.deepEqual(state.schedulerDeliveryObservations.map((observation) => observation.dispatcherTarget), [
      "dispatcher-main", "dispatcher-other", "dispatcher-main",
    ]);

    runtime.trusted.setNow("2026-09-04T20:02:00.000Z");
    assert.equal(runtime.application.execute({
      kind: "project.register",
      projectId: "project",
      root: runtime.fixture.projectRoot,
    }).ok, true);
    assert.equal(runtime.application.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "scheduled-task",
      body: "scheduled candidate body",
      supersedesTaskId: null,
    }).ok, true);
    assert.equal(runtime.application.execute({
      kind: "task.mark_ready",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "scheduled-task",
      expectedTaskRevision: 1,
    }).ok, true);

    runtime.trusted.setNow("2026-09-04T20:03:00.000Z");
    const reconciling = runtime.dispatcher.beginReconciliation({
      kind: "dispatch.begin_reconciliation",
      runId: accepted.value.runId,
      expectedOwnerRevision: accepted.value.ownerRevision,
      expectedRunRevision: accepted.value.runRevision,
    });
    assert.equal(reconciling.ok, true, JSON.stringify(reconciling));
    assert.deepEqual(runtime.dispatcher.reconciliationInventory(accepted.value.runId).value, []);
    runtime.trusted.setNow("2026-09-04T20:04:00.000Z");
    const reconciled = runtime.dispatcher.commitReconciliation({
      kind: "dispatch.commit_reconciliation",
      runId: accepted.value.runId,
      expectedOwnerRevision: reconciling.value.ownerRevision,
      expectedRunRevision: reconciling.value.runRevision,
      resolutions: [],
    });
    assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
    runtime.trusted.setNow("2026-09-04T20:05:00.000Z");
    const sealed = runtime.dispatcher.sealCandidates({
      kind: "dispatch.seal_candidates",
      runId: accepted.value.runId,
      expectedOwnerRevision: reconciled.value.ownerRevision,
      expectedRunRevision: reconciled.value.runRevision,
    });
    assert.equal(sealed.ok, true, JSON.stringify(sealed));
    state = readApplicationStateForOwner(runtime.store);
    const member = state.dispatcherMembers.find((candidate) => candidate.runId === accepted.value.runId);
    assert.ok(member);
    runtime.trusted.setNow("2026-09-04T20:06:00.000Z");
    const claimed = runtime.dispatcher.claimAndPrepareMember({
      kind: "dispatch.claim_member",
      runId: accepted.value.runId,
      expectedOwnerRevision: sealed.value.ownerRevision,
      expectedRunRevision: sealed.value.runRevision,
      memberId: member.memberId,
      expectedMembershipRevision: member.membershipRevision,
      expectedMemberRevision: member.revision,
    });
    assert.equal(claimed.ok, true, JSON.stringify(claimed));
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executionIntents.at(-1).adapterId, "manual-local");
    assert.equal(state.executionIntents.at(-1).adapterVersion, "1.0.0");
    assert.equal(state.executionIntents.at(-1).backendKind, "manual-local");
    assert.equal(state.schedulerDeliveryObservations.at(-1).adapterId, "fake-scheduler");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduled delivery revalidates a Project-scoped configuration in the accepting transaction", async () => {
  const runtime = await prepare("scheduled-project-binding");
  try {
    runtime.trusted.setNow("2026-09-04T20:02:00.000Z");
    assert.equal(runtime.application.execute({
      kind: "project.register",
      projectId: "project",
      root: runtime.fixture.projectRoot,
    }).ok, true);
    const projectScope = Object.freeze({
      kind: "project",
      projectId: "project",
      projectResourceRevision: 1,
      projectConfigRevision: 1,
    });
    const backend = createFakeSchedulerBackend();
    const schedulerStages = [];
    const scheduler = createSchedulerApplicationServiceWithHooks(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    }, {
      afterStage(stage) { schedulerStages.push(stage); },
    });
    const projectRegistered = scheduler.register(Object.freeze({
      kind: "scheduler.register",
      scheduleId: "project-hourly",
      configRevision: 1,
      scope: projectScope,
      scheduleExpression: "hourly-project-schedule",
      timeZone: "Etc/UTC",
      dispatcherTarget: "dispatcher-main",
      idempotencyKey: "register-project-hourly",
    }));
    let decoderFailure = null;
    if (!projectRegistered.ok) {
      try { readApplicationStateForOwner(runtime.store); } catch (error) {
        decoderFailure = Object.freeze({ code: error.code, message: error.message, details: error.details });
      }
    }
    assert.equal(projectRegistered.ok, true, JSON.stringify({ projectRegistered, schedulerStages, decoderFailure }));

    runtime.trusted.setNow("2026-09-04T21:01:00.000Z");
    let changed = false;
    const racing = createDispatcherApplicationServiceWithHooks(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
      schedulerIngress: Object.freeze({
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
        dispatcherTarget: "dispatcher-main",
      }),
    }, {
      afterStage(stage) {
        if (stage !== "scheduled-delivery-preflight" || changed) return;
        changed = true;
        const disabled = runtime.application.execute({
          kind: "project.disable",
          projectId: "project",
          expectedResourceRevision: 1,
          expectedConfigRevision: 1,
        });
        assert.equal(disabled.ok, true, JSON.stringify(disabled));
      },
    });
    const projectTrigger = trigger({
      triggerId: "project-racing-trigger",
      scheduleId: "project-hourly",
      scheduledFor: "2026-09-04T21:00:00.000Z",
      observedAt: "2026-09-04T21:00:01.000Z",
    });
    const disabled = racing.deliverScheduled(projectTrigger);
    assert.equal(disabled.ok, false);
    assert.equal(disabled.error.code, "STALE_REVISION");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerDeliveryObservations.at(-1).disposition, "rejected_stale_config");
    assert.equal(state.schedulerScheduledTuples.some((tuple) => tuple.scheduleId === "project-hourly"), false);

    runtime.trusted.setNow("2026-09-04T21:02:00.000Z");
    assert.equal(runtime.application.execute({
      kind: "project.update",
      projectId: "project",
      expectedResourceRevision: 2,
      expectedConfigRevision: 2,
    }).ok, true);
    runtime.trusted.setNow("2026-09-04T21:03:00.000Z");
    const drifted = runtime.dispatcher.deliverScheduled(projectTrigger);
    assert.equal(drifted.ok, false);
    assert.equal(drifted.error.code, "STALE_REVISION");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerDeliveryObservations.at(-1).disposition, "rejected_stale_config");
    assert.equal(state.dispatcherRuns.filter((run) =>
      state.schedulerDeliveryObservations.some((observation) =>
        observation.scheduleId === "project-hourly" && observation.runId === run.runId)).length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("scheduled delivery rejects a Project-scoped configuration after physical root replacement", async () => {
  const runtime = await prepare("scheduled-project-root-binding");
  try {
    runtime.trusted.setNow("2026-09-04T20:02:00.000Z");
    assert.equal(runtime.application.execute({
      kind: "project.register",
      projectId: "project",
      root: runtime.fixture.projectRoot,
    }).ok, true);
    const projectScope = Object.freeze({
      kind: "project",
      projectId: "project",
      projectResourceRevision: 1,
      projectConfigRevision: 1,
    });
    const backend = createFakeSchedulerBackend();
    const scheduler = createSchedulerApplicationService(runtime.store, runtime.trusted, backend, {
      adapterId: "fake-scheduler",
      adapterVersion: "1.0.0-test",
    });
    assert.equal(scheduler.register(Object.freeze({
      kind: "scheduler.register",
      scheduleId: "project-root-hourly",
      configRevision: 1,
      scope: projectScope,
      scheduleExpression: "hourly-project-root-schedule",
      timeZone: "Etc/UTC",
      dispatcherTarget: "dispatcher-main",
      idempotencyKey: "register-project-root-hourly",
    })).ok, true);

    runtime.trusted.setNow("2026-09-04T21:01:00.000Z");
    let replaced = false;
    const racing = createDispatcherApplicationServiceWithHooks(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
      schedulerIngress: Object.freeze({
        adapterId: "fake-scheduler",
        adapterVersion: "1.0.0-test",
        dispatcherTarget: "dispatcher-main",
      }),
    }, {
      afterStage(stage) {
        if (stage !== "scheduled-delivery-preflight" || replaced) return;
        replaced = true;
        renameSync(runtime.fixture.projectRoot, `${runtime.fixture.projectRoot}-replaced`);
        mkdirSync(runtime.fixture.projectRoot);
      },
    });
    const rejected = racing.deliverScheduled(trigger({
      triggerId: "project-root-racing-trigger",
      scheduleId: "project-root-hourly",
      scheduledFor: "2026-09-04T21:00:00.000Z",
      observedAt: "2026-09-04T21:00:01.000Z",
    }));
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "STALE_REVISION");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerDeliveryObservations.at(-1).disposition, "rejected_stale_config");
    assert.equal(state.schedulerScheduledTuples.some((tuple) => tuple.scheduleId === "project-root-hourly"), false);
    assert.equal(state.dispatcherRuns.some((run) =>
      state.schedulerDeliveryObservations.some((observation) =>
        observation.scheduleId === "project-root-hourly" && observation.runId === run.runId)), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("denied delivery stays unattached and cannot block a later allowed canonical observation", async () => {
  const runtime = await prepare("scheduled-denied-then-allowed");
  try {
    const dispatchGrants = readApplicationStateForOwner(runtime.store).grants.filter((grant) =>
      grant.action === "dispatch.run" && grant.revokedAt === null);
    assert.ok(dispatchGrants.length > 0);
    for (const [index, dispatchGrant] of dispatchGrants.entries()) {
      runtime.trusted.setNow(new Date(Date.parse("2026-09-04T20:01:01.000Z") + index).toISOString());
      const revoked = runtime.application.execute(Object.freeze({
        kind: "authorization.grant.revoke",
        grantId: dispatchGrant.grantId,
        expectedGrantRevision: dispatchGrant.revision,
      }));
      assert.equal(revoked.ok, true, JSON.stringify(revoked));
    }
    const denied = runtime.dispatcher.deliverScheduled(trigger());
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerDeliveryObservations.at(-1).disposition, "authorization_denied");
    assert.equal(state.schedulerDeliveryObservations.at(-1).runId, null);
    assert.equal(state.schedulerScheduledTuples.length, 0);
    assert.equal(state.dispatcherRuns.length, 0);

    runtime.trusted.setNow("2026-10-01T00:00:00.001Z");
    const renewed = runtime.application.renew(Object.freeze({
      kind: "authorization.capability.renew",
      expiresAt: "2026-11-01T00:00:00.000Z",
    }));
    assert.equal(renewed.ok, true, JSON.stringify(renewed));
    const allowed = runtime.dispatcher.deliverScheduled(trigger());
    assert.equal(allowed.ok, true, JSON.stringify(allowed));
    state = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(state.schedulerDeliveryObservations.map((item) => item.attachmentRole), ["none", "canonical"]);
    assert.equal(state.schedulerScheduledTuples.length, 1);
    assert.equal(state.dispatcherRuns.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("malformed and stale-config deliveries are bounded observations with no tuple or run", async () => {
  const runtime = await prepare("scheduled-invalid");
  try {
    const poison = new Proxy({}, { ownKeys() { throw new Error("private-trigger-stack"); } });
    const malformed = runtime.dispatcher.deliverScheduled(poison);
    assert.equal(malformed.ok, false);
    assert.equal(malformed.error.code, "INVALID_INPUT");
    const stale = runtime.dispatcher.deliverScheduled(trigger({
      configRevision: 2,
      triggerId: "stale-trigger-secret",
      claimedDeduplication: "stale-claim-secret",
    }));
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_REVISION");
    const reversedClock = runtime.dispatcher.deliverScheduled(trigger({
      triggerId: "reversed-clock-trigger",
      observedAt: "2026-09-04T19:59:59.000Z",
    }));
    assert.equal(reversedClock.ok, false);
    assert.equal(reversedClock.error.code, "STALE_REVISION");
    const futureClock = runtime.dispatcher.deliverScheduled(trigger({
      triggerId: "future-clock-trigger",
      observedAt: "2026-09-04T20:02:00.000Z",
    }));
    assert.equal(futureClock.ok, false);
    assert.equal(futureClock.error.code, "STALE_REVISION");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.schedulerDeliveryObservations.length, 4);
    assert.deepEqual(state.schedulerDeliveryObservations.map((item) => item.disposition), [
      "malformed", "rejected_stale_config", "rejected_stale_config", "rejected_stale_config",
    ]);
    assert.equal(state.schedulerDeliveryObservations[0].scheduleId, null);
    assert.equal(state.schedulerDeliveryObservations[0].triggerIdSha256, null);
    assert.equal(state.schedulerScheduledTuples.length, 0);
    assert.equal(state.dispatcherRuns.length, 0);
    const serialized = JSON.stringify(state);
    assert.equal(serialized.includes("private-trigger-stack"), false);
    assert.equal(serialized.includes("stale-trigger-secret"), false);
    assert.equal(serialized.includes("stale-claim-secret"), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
