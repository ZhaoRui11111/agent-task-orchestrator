import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZATION_ACTIONS,
  EXECUTION_AUTHORIZATION_ACTIONS,
  PHASE1_AUTHORIZATION_ACTIONS,
  PHASE2A_AUTHORIZATION_ACTIONS,
  createApplicationService,
  createExecutionApplicationService,
  openPersistence,
} from "../src/index.ts";
import { createExecutionApplicationServiceWithHooks } from "../src/execution-application.ts";
import { createApplicationServiceWithHooks } from "../src/application.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
} from "./persistence-test-helpers.mjs";

const PRINCIPAL = "A".repeat(64);
const ACTOR = "local-v1:execution-owner";
const UPGRADE_EXPIRY = "2026-09-20T12:00:00.000Z";

function ingress(label = "execution") {
  let sequence = 0;
  let now = "2026-08-29T12:00:00.000Z";
  let ownerId = "worker-a";
  let confirmed = true;
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => confirmed,
    currentLeaseOwner: () => ownerId,
    setNow: (value) => { now = value; },
    setOwner: (value) => { ownerId = value; },
    setConfirmed: (value) => { confirmed = value; },
  };
}

function prepareReadyTask(store, trusted, fixture) {
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({
    kind: "authorization.bootstrap",
    expiresAt: UPGRADE_EXPIRY,
  }).ok, true);
  assert.equal(application.execute({
    kind: "project.register",
    projectId: "project",
    root: fixture.projectRoot,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.create",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    taskId: "task",
    body: "execute safely",
    supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    taskId: "task",
    expectedTaskRevision: 1,
  }).ok, true);
  return application;
}

function claimCommand(idempotencyKey = "claim-key", leaseDurationSeconds = 60) {
  return {
    kind: "execution.claim",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId: "task",
    expectedTaskRevision: 2,
    idempotencyKey,
    leaseDurationSeconds,
  };
}

test("explicit capability upgrade gates claim, renewal, restart takeover, replay, and stale-fence rejection", async () => {
  const fixture = createPersistenceFixture("execution-claim-lifecycle");
  const trusted = ingress("lifecycle");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-claim-test" });
    assert.equal(store.migration.schemaVersion, 1);
    const application = prepareReadyTask(store, trusted, fixture);
    let state = readApplicationStateForOwner(store);
    assert.equal(PHASE1_AUTHORIZATION_ACTIONS.length, 19);
    assert.equal(EXECUTION_AUTHORIZATION_ACTIONS.length, 4);
    assert.equal(PHASE2A_AUTHORIZATION_ACTIONS.length, 23);
    assert.equal(AUTHORIZATION_ACTIONS.length, 30);
    assert.equal(state.bootstrap?.vocabularyVersion, 4);
    assert.equal(state.epochs.length, 0);
    assert.equal(state.grants.some((grant) => grant.action.startsWith("execution.")), false);

    const execution = createExecutionApplicationService(store, trusted);
    const denied = execution.claim(claimCommand("denied-before-upgrade"));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    state = readApplicationStateForOwner(store);
    assert.equal(state.executions.length, 0);
    assert.equal(state.domain.tasks[0]?.state, "ready");

    const upgraded = application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(upgraded.ok, true);
    assert.equal(upgraded.value.mode, "upgraded");
    assert.equal(upgraded.value.capabilityCount, 23);
    state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.at(-1)?.vocabularyVersion, 5);
    assert.equal(state.grants.length, PHASE1_AUTHORIZATION_ACTIONS.length + PHASE2A_AUTHORIZATION_ACTIONS.length);
    assert.equal(
      EXECUTION_AUTHORIZATION_ACTIONS.every(
        (action) => state.grants.some((grant) => grant.action === action && grant.actorId === ACTOR),
      ),
      true,
    );

    const claimed = execution.claim(claimCommand());
    assert.equal(claimed.ok, true);
    assert.equal(claimed.value.attemptNumber, 1);
    assert.equal(claimed.value.fencingToken, 1);
    assert.equal(claimed.value.taskRevision, 3);
    const afterClaim = readApplicationStateForOwner(store);
    assert.equal(afterClaim.domain.tasks[0]?.state, "running");
    assert.equal(afterClaim.executions.length, 1);
    assert.equal(afterClaim.executions[0]?.requestedLeaseSeconds, 60);

    const replayCounts = {
      requests: afterClaim.requests.length,
      decisions: afterClaim.decisions.length,
      audit: afterClaim.audit.length,
    };
    const replayedClaim = execution.claim(claimCommand());
    assert.equal(replayedClaim.ok, true);
    assert.equal(replayedClaim.requestId, claimed.requestId);
    assert.deepEqual({
      requests: readApplicationStateForOwner(store).requests.length,
      decisions: readApplicationStateForOwner(store).decisions.length,
      audit: readApplicationStateForOwner(store).audit.length,
    }, replayCounts);
    const driftedClaim = execution.claim(claimCommand("claim-key", 61));
    assert.equal(driftedClaim.ok, false);
    assert.equal(driftedClaim.error.code, "IDEMPOTENCY_CONFLICT");
    const projectDriftedClaim = execution.claim({ ...claimCommand(), projectId: "other-project" });
    assert.equal(projectDriftedClaim.ok, false);
    assert.equal(projectDriftedClaim.error.code, "IDEMPOTENCY_CONFLICT");

    trusted.setNow("2026-08-29T12:00:30.000Z");
    const renewed = execution.renew({
      kind: "execution.lease.renew",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision: 1,
      expectedLeaseRevision: 1,
      expectedFencingToken: 1,
      expectedTaskRevision: 3,
      leaseDurationSeconds: 60,
    });
    assert.equal(renewed.ok, true);
    assert.equal(renewed.value.revision, 2);
    assert.equal(renewed.value.leaseRevision, 2);
    assert.equal(renewed.value.leaseExpiresAt, "2026-08-29T12:01:30.000Z");

    await store.close();
    store = undefined;
    trusted.setOwner("worker-b");
    trusted.setNow("2026-08-29T12:01:29.000Z");
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-claim-restart" });
    const restarted = createExecutionApplicationService(store, trusted);
    const early = restarted.takeover({
      kind: "execution.lease.takeover",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      predecessorExecutionId: claimed.value.executionId,
      expectedExecutionRevision: 2,
      expectedLeaseRevision: 2,
      expectedFencingToken: 1,
      idempotencyKey: "takeover-key",
      leaseDurationSeconds: 60,
    });
    assert.equal(early.ok, false);
    assert.equal(early.error.code, "LEASE_NOT_EXPIRED");

    trusted.setNow("2026-08-29T12:01:30.000Z");
    const takeoverCommand = {
      kind: "execution.lease.takeover",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      predecessorExecutionId: claimed.value.executionId,
      expectedExecutionRevision: 2,
      expectedLeaseRevision: 2,
      expectedFencingToken: 1,
      idempotencyKey: "takeover-key",
      leaseDurationSeconds: 60,
    };
    const takenOver = restarted.takeover(takeoverCommand);
    assert.equal(takenOver.ok, true);
    assert.equal(takenOver.value.attemptNumber, 2);
    assert.equal(takenOver.value.fencingToken, 2);
    assert.equal(takenOver.value.ownerId, "worker-b");
    const takeoverReplay = restarted.takeover(takeoverCommand);
    assert.equal(takeoverReplay.ok, true);
    assert.equal(takeoverReplay.requestId, takenOver.requestId);
    const driftedTakeover = restarted.takeover({ ...takeoverCommand, expectedLeaseRevision: 1 });
    assert.equal(driftedTakeover.ok, false);
    assert.equal(driftedTakeover.error.code, "IDEMPOTENCY_CONFLICT");
    const projectDriftedTakeover = restarted.takeover({ ...takeoverCommand, projectId: "other-project" });
    assert.equal(projectDriftedTakeover.ok, false);
    assert.equal(projectDriftedTakeover.error.code, "IDEMPOTENCY_CONFLICT");

    trusted.setOwner("worker-a");
    trusted.setNow("2026-08-29T12:01:31.000Z");
    const staleWrite = restarted.renew({
      kind: "execution.lease.renew",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision: 2,
      expectedLeaseRevision: 2,
      expectedFencingToken: 1,
      expectedTaskRevision: 3,
      leaseDurationSeconds: 60,
    });
    assert.equal(staleWrite.ok, false);
    assert.equal(staleWrite.error.code, "STALE_FENCE");

    const terminal = readApplicationStateForOwner(store);
    assert.equal(terminal.domain.tasks[0]?.state, "running");
    assert.equal(terminal.executionSequences[0]?.lastAttemptNumber, 2);
    assert.equal(terminal.executionSequences[0]?.currentFencingToken, 2);
    assert.deepEqual(terminal.executions.map((attempt) => attempt.status), ["superseded", "active"]);
    assert.equal(terminal.executions[0]?.revision, 3);
    assert.equal(terminal.executions[1]?.predecessorExecutionRevision, 2);
    assert.equal(terminal.executions[1]?.predecessorLeaseRevision, 2);
    assert.equal(terminal.executions[1]?.predecessorFencingToken, 1);
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("claim failpoints roll back authorization, execution, Domain, and audit as one unit", async () => {
  const fixture = createPersistenceFixture("execution-claim-failpoints");
  const trusted = ingress("failpoints");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-failpoints" });
    const application = prepareReadyTask(store, trusted, fixture);
    assert.equal(application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    }).ok, true);
    for (const stage of ["request", "decision", "execution-sequence", "execution-attempt", "domain", "audit"]) {
      const before = readApplicationStateForOwner(store);
      const execution = createExecutionApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      const result = execution.claim(claimCommand(`failpoint-${stage}`));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "PERSISTENCE_FAILURE");
      await store.close();
      store = undefined;
      store = await openPersistence(fixture.layout, { applicationVersion: `execution-failpoint-restart-${stage}` });
      assert.deepEqual(readApplicationStateForOwner(store), before);
    }
    const claimed = createExecutionApplicationService(store, trusted).claim(claimCommand("after-failpoints"));
    assert.equal(claimed.ok, true);
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("renewal and takeover failpoints remain all-or-none after a real restart", async () => {
  const fixture = createPersistenceFixture("execution-lease-failpoint-restart");
  const trusted = ingress("lease-failpoint-restart");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-lease-failpoints" });
    const application = prepareReadyTask(store, trusted, fixture);
    assert.equal(application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    }).ok, true);
    const claimed = createExecutionApplicationService(store, trusted).claim(claimCommand("lease-failpoint-claim"));
    assert.equal(claimed.ok, true);

    trusted.setNow("2026-08-29T12:00:30.000Z");
    const renewalCommand = {
      kind: "execution.lease.renew",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision: 1,
      expectedLeaseRevision: 1,
      expectedFencingToken: 1,
      expectedTaskRevision: 3,
      leaseDurationSeconds: 60,
    };
    for (const stage of ["request", "decision", "execution-lease", "audit"]) {
      const before = readApplicationStateForOwner(store);
      const result = createExecutionApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`renewal-failpoint:${stage}`);
        },
      }).renew(renewalCommand);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "PERSISTENCE_FAILURE");
      await store.close();
      store = undefined;
      store = await openPersistence(fixture.layout, { applicationVersion: `execution-renewal-restart-${stage}` });
      assert.deepEqual(readApplicationStateForOwner(store), before);
    }
    const renewed = createExecutionApplicationService(store, trusted).renew(renewalCommand);
    assert.equal(renewed.ok, true);
    assert.equal(renewed.value.leaseExpiresAt, "2026-08-29T12:01:30.000Z");

    trusted.setOwner("worker-b");
    trusted.setNow("2026-08-29T12:01:30.000Z");
    const takeoverCommand = {
      kind: "execution.lease.takeover",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      predecessorExecutionId: claimed.value.executionId,
      expectedExecutionRevision: 2,
      expectedLeaseRevision: 2,
      expectedFencingToken: 1,
      idempotencyKey: "lease-failpoint-takeover",
      leaseDurationSeconds: 60,
    };
    for (const stage of [
      "request", "decision", "execution-sequence", "execution-superseded", "execution-attempt", "audit",
    ]) {
      const before = readApplicationStateForOwner(store);
      const result = createExecutionApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`takeover-failpoint:${stage}`);
        },
      }).takeover(takeoverCommand);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "PERSISTENCE_FAILURE");
      await store.close();
      store = undefined;
      store = await openPersistence(fixture.layout, { applicationVersion: `execution-takeover-restart-${stage}` });
      assert.deepEqual(readApplicationStateForOwner(store), before);
    }
    const takenOver = createExecutionApplicationService(store, trusted).takeover(takeoverCommand);
    assert.equal(takenOver.ok, true);
    assert.equal(takenOver.value.attemptNumber, 2);
    assert.equal(takenOver.value.fencingToken, 2);
    assert.equal(takenOver.value.leaseExpiresAt, "2026-08-29T12:02:30.000Z");
    const terminal = readApplicationStateForOwner(store);
    assert.equal(terminal.domain.tasks[0]?.state, "running");
    assert.deepEqual(terminal.executions.map((attempt) => attempt.status), ["superseded", "active"]);
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("lease renewal never banks more than the bounded duration from trusted now", async () => {
  const fixture = createPersistenceFixture("execution-lease-no-banking");
  const trusted = ingress("lease-no-banking");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-lease-no-banking" });
    const application = prepareReadyTask(store, trusted, fixture);
    assert.equal(application.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    }).ok, true);
    const execution = createExecutionApplicationService(store, trusted);
    const claimed = execution.claim(claimCommand("lease-no-banking-claim", 3600));
    assert.equal(claimed.ok, true);
    let expectedExecutionRevision = 1;
    let expectedLeaseRevision = 1;
    for (const [now, expiry] of [
      ["2026-08-29T12:00:01.000Z", "2026-08-29T13:00:01.000Z"],
      ["2026-08-29T12:00:02.000Z", "2026-08-29T13:00:02.000Z"],
      ["2026-08-29T12:00:03.000Z", "2026-08-29T13:00:03.000Z"],
    ]) {
      trusted.setNow(now);
      const renewed = execution.renew({
        kind: "execution.lease.renew",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        expectedProjectConfigRevision: 1,
        executionId: claimed.value.executionId,
        expectedExecutionRevision,
        expectedLeaseRevision,
        expectedFencingToken: 1,
        expectedTaskRevision: 3,
        leaseDurationSeconds: 3600,
      });
      assert.equal(renewed.ok, true);
      assert.equal(renewed.value.leaseExpiresAt, expiry);
      expectedExecutionRevision += 1;
      expectedLeaseRevision += 1;
    }
    trusted.setNow("2026-08-29T12:00:04.000Z");
    const wouldShorten = execution.renew({
      kind: "execution.lease.renew",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision,
      expectedLeaseRevision,
      expectedFencingToken: 1,
      expectedTaskRevision: 3,
      leaseDurationSeconds: 30,
    });
    assert.equal(wouldShorten.ok, false);
    assert.equal(wouldShorten.error.code, "LEASE_NOT_RENEWABLE");
    assert.equal(readApplicationStateForOwner(store).executions[0]?.leaseExpiresAt, "2026-08-29T13:00:03.000Z");
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("capability upgrade requires fresh confirmation and every staged failure preserves the exact vocabulary-4 origin", async () => {
  const fixture = createPersistenceFixture("execution-upgrade-failpoints");
  const trusted = ingress("upgrade-failpoints");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-upgrade-failpoints" });
    const setup = createApplicationService(store, trusted);
    const absentOrigin = readApplicationStateForOwner(store);
    const missingBootstrap = setup.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(missingBootstrap.ok, false);
    assert.equal(missingBootstrap.error.code, "BOOTSTRAP_REQUIRED");
    assert.deepEqual(readApplicationStateForOwner(store), absentOrigin);
    assert.equal(setup.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: UPGRADE_EXPIRY,
    }).ok, true);
    const origin = readApplicationStateForOwner(store);
    trusted.setConfirmed(false);
    const unconfirmed = setup.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "AUTHORIZATION_DENIED");
    assert.deepEqual(readApplicationStateForOwner(store), origin);
    trusted.setConfirmed(true);
    const wrongActor = createApplicationService(store, {
      ...trusted,
      currentActor: () => ({ actorId: "other-actor", principal: PRINCIPAL }),
    }).upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(wrongActor.ok, false);
    assert.equal(wrongActor.error.code, "AUTHORIZATION_DENIED");
    assert.deepEqual(readApplicationStateForOwner(store), origin);

    const stages = [
      "request",
      "epoch",
      ...PHASE2A_AUTHORIZATION_ACTIONS.map((action) => `grant:${action}`),
      "decision",
      "audit",
    ];
    for (const stage of stages) {
      const before = readApplicationStateForOwner(store);
      const service = createApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      assert.throws(
        () => service.upgrade({ kind: "authorization.capability.upgrade", expiresAt: UPGRADE_EXPIRY }),
        (error) => error?.name === "PersistenceError",
      );
      assert.deepEqual(readApplicationStateForOwner(store), before);
    }
    const beforeSuccess = readApplicationStateForOwner(store);
    assert.equal(beforeSuccess.epochs.length, 0);
    assert.equal(beforeSuccess.grants.length, PHASE1_AUTHORIZATION_ACTIONS.length);
    const upgraded = setup.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(upgraded.ok, true);
    const terminal = readApplicationStateForOwner(store);
    assert.equal(terminal.epochs.length, 1);
    assert.equal(terminal.epochs[0]?.vocabularyVersion, 5);
    assert.equal(terminal.grants.length, PHASE1_AUTHORIZATION_ACTIONS.length + PHASE2A_AUTHORIZATION_ACTIONS.length);
    const afterUpgrade = readApplicationStateForOwner(store);
    const replay = setup.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.error.code, "CAPABILITY_UPGRADE_NOT_ELIGIBLE");
    assert.deepEqual(readApplicationStateForOwner(store), afterUpgrade);
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("competing initial claims persist exactly one winner, active attempt, sequence, and fence", async () => {
  const fixture = createPersistenceFixture("execution-claim-contention");
  const primaryIngress = ingress("claim-primary");
  const competingIngress = ingress("claim-competitor");
  competingIngress.setOwner("worker-b");
  let primary;
  let competitor;
  try {
    primary = await openPersistence(fixture.layout, { applicationVersion: "claim-primary" });
    const application = prepareReadyTask(primary, primaryIngress, fixture);
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: UPGRADE_EXPIRY }).ok, true);
    competitor = await openPersistence(fixture.layout, { applicationVersion: "claim-competitor" });
    const competingService = createExecutionApplicationService(competitor, competingIngress);
    let winningResult;
    const racingService = createExecutionApplicationServiceWithHooks(primary, primaryIngress, {
      beforeTransaction() {
        winningResult = competingService.claim(claimCommand("competing-winner"));
      },
    });
    const losingResult = racingService.claim(claimCommand("competing-loser"));
    assert.equal(winningResult?.ok, true);
    assert.equal(losingResult.ok, false);
    assert.equal(losingResult.error.code, "STALE_REVISION");
    const state = readApplicationStateForOwner(primary);
    assert.equal(state.executionSequences.length, 1);
    assert.equal(state.executionSequences[0]?.lastAttemptNumber, 1);
    assert.equal(state.executionSequences[0]?.currentFencingToken, 1);
    assert.equal(state.executions.length, 1);
    assert.equal(state.executions[0]?.status, "active");
    assert.equal(state.executions[0]?.ownerId, "worker-b");
    assert.equal(state.domain.tasks[0]?.state, "running");
  } finally {
    if (competitor !== undefined) await competitor.close();
    if (primary !== undefined) await primary.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("a competing capability upgrade creates one vocabulary-5 origin and makes stale preflight a no-write loser", async () => {
  const fixture = createPersistenceFixture("execution-upgrade-contention");
  const primaryIngress = ingress("upgrade-primary");
  const competingIngress = ingress("upgrade-competitor");
  let primary;
  let competitor;
  try {
    primary = await openPersistence(fixture.layout, { applicationVersion: "upgrade-primary" });
    const setup = createApplicationService(primary, primaryIngress);
    assert.equal(setup.bootstrap({ kind: "authorization.bootstrap", expiresAt: UPGRADE_EXPIRY }).ok, true);
    competitor = await openPersistence(fixture.layout, { applicationVersion: "upgrade-competitor" });
    const competingService = createApplicationService(competitor, competingIngress);
    let winningResult;
    const racingService = createApplicationServiceWithHooks(primary, primaryIngress, {
      beforeTransaction() {
        winningResult = competingService.upgrade({
          kind: "authorization.capability.upgrade",
          expiresAt: UPGRADE_EXPIRY,
        });
      },
    });
    const losingResult = racingService.upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: UPGRADE_EXPIRY,
    });
    assert.equal(winningResult?.ok, true);
    assert.equal(losingResult.ok, false);
    assert.equal(losingResult.error.code, "STALE_REVISION");
    const state = readApplicationStateForOwner(primary);
    assert.equal(state.epochs.length, 1);
    assert.equal(state.epochs[0]?.vocabularyVersion, 5);
    assert.equal(state.grants.length, PHASE1_AUTHORIZATION_ACTIONS.length + PHASE2A_AUTHORIZATION_ACTIONS.length);
    assert.equal(state.requests.filter((request) => request.action === "authorization.capability.upgrade").length, 1);
  } finally {
    if (competitor !== undefined) await competitor.close();
    if (primary !== undefined) await primary.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("competing renewal and takeover writers leave one current lease and one higher active fence", async () => {
  const fixture = createPersistenceFixture("execution-lease-contention");
  const primaryIngress = ingress("lease-primary");
  const competingIngress = ingress("lease-competitor");
  let primary;
  let competitor;
  try {
    primary = await openPersistence(fixture.layout, { applicationVersion: "lease-primary" });
    const application = prepareReadyTask(primary, primaryIngress, fixture);
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: UPGRADE_EXPIRY }).ok, true);
    const claimed = createExecutionApplicationService(primary, primaryIngress).claim(claimCommand("lease-claim"));
    assert.equal(claimed.ok, true);
    competitor = await openPersistence(fixture.layout, { applicationVersion: "lease-competitor" });

    primaryIngress.setNow("2026-08-29T12:00:30.000Z");
    competingIngress.setNow("2026-08-29T12:00:30.000Z");
    const renewCommand = {
      kind: "execution.lease.renew",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision: 1,
      expectedLeaseRevision: 1,
      expectedFencingToken: 1,
      expectedTaskRevision: 3,
      leaseDurationSeconds: 60,
    };
    const competingRenewal = createExecutionApplicationService(competitor, competingIngress);
    let renewalWinner;
    const racingRenewal = createExecutionApplicationServiceWithHooks(primary, primaryIngress, {
      beforeTransaction() {
        renewalWinner = competingRenewal.renew(renewCommand);
      },
    });
    const renewalLoser = racingRenewal.renew(renewCommand);
    assert.equal(renewalWinner?.ok, true);
    assert.equal(renewalLoser.ok, false);
    assert.equal(renewalLoser.error.code, "STALE_FENCE");
    let state = readApplicationStateForOwner(primary);
    assert.equal(state.executions[0]?.revision, 2);
    assert.equal(state.executions[0]?.leaseRevision, 2);

    primaryIngress.setNow("2026-08-29T12:02:00.000Z");
    primaryIngress.setOwner("worker-b");
    competingIngress.setNow("2026-08-29T12:02:00.000Z");
    competingIngress.setOwner("worker-c");
    const takeoverBase = {
      kind: "execution.lease.takeover",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      predecessorExecutionId: claimed.value.executionId,
      expectedExecutionRevision: 2,
      expectedLeaseRevision: 2,
      expectedFencingToken: 1,
      leaseDurationSeconds: 60,
    };
    const competingTakeover = createExecutionApplicationService(competitor, competingIngress);
    let takeoverWinner;
    const racingTakeover = createExecutionApplicationServiceWithHooks(primary, primaryIngress, {
      beforeTransaction() {
        takeoverWinner = competingTakeover.takeover({ ...takeoverBase, idempotencyKey: "takeover-winner" });
      },
    });
    const takeoverLoser = racingTakeover.takeover({ ...takeoverBase, idempotencyKey: "takeover-loser" });
    assert.equal(takeoverWinner?.ok, true);
    assert.equal(takeoverLoser.ok, false);
    assert.equal(takeoverLoser.error.code, "STALE_FENCE");
    state = readApplicationStateForOwner(primary);
    assert.equal(state.executionSequences[0]?.lastAttemptNumber, 2);
    assert.equal(state.executionSequences[0]?.currentFencingToken, 2);
    assert.equal(state.executions.filter((attempt) => attempt.status === "active").length, 1);
    assert.equal(state.executions.find((attempt) => attempt.status === "active")?.ownerId, "worker-c");
  } finally {
    if (competitor !== undefined) await competitor.close();
    if (primary !== undefined) await primary.close();
    cleanupPersistenceFixture(fixture);
  }
});
