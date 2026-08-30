import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createManualExecutionBackend,
  createReliableExecutionService,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";

function ingress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let owner = "dispatcher-worker-a";
  let runtimeRootKey = "pending-runtime-root";
  let principal = PRINCIPAL;
  return {
    currentActor: () => ({ actorId: ACTOR, principal }),
    currentLeaseOwner: () => owner,
    currentWorkerOwner: () => owner,
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }),
    setNow(value) { now = value; },
    setOwner(value) { owner = value; },
    setPrincipal(value) { principal = value; },
    setRuntimeRootKey(value) { runtimeRootKey = value; },
  };
}

async function prepareRuntime(prefix, taskCount = 1) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02c-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  for (let index = 1; index <= taskCount; index += 1) {
    assert.equal(application.execute({
      kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
      taskId: `task-${index}`, body: `dispatcher sentinel body ${index}`, supersedesTaskId: null,
    }).ok, true);
    assert.equal(application.execute({
      kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
      taskId: `task-${index}`, expectedTaskRevision: 1,
    }).ok, true);
  }
  for (let upgrade = 1; upgrade <= 3; upgrade += 1) {
    trusted.setNow(`2026-08-30T12:00:0${upgrade}.000Z`);
    const result = application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY });
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  assert.equal(readApplicationStateForOwner(store).epochs.at(-1).vocabularyVersion, 7);
  return { fixture, trusted, store };
}

test("dispatcher commits reconciliation, sealed membership, claim and prepared start intent before the Manual effect", async () => {
  const runtime = await prepareRuntime("dispatcher-atomic-claim");
  try {
    const application = createDispatcherApplicationService(runtime.store, runtime.trusted, {
      adapterId: "manual-local",
      adapterVersion: "1.0.0",
    });
    runtime.trusted.setNow("2026-08-30T12:00:04.000Z");
    const started = application.start({
      kind: "dispatch.start", idempotencyKey: "dispatch-observation-one", leaseDurationSeconds: 300,
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(application.start({
      kind: "dispatch.start", idempotencyKey: "dispatch-observation-one", leaseDurationSeconds: 300,
    }).replayed, true);
    const beforeUntrustedReplay = readApplicationStateForOwner(runtime.store);
    runtime.trusted.setPrincipal("B".repeat(64));
    const untrustedReplay = application.start({
      kind: "dispatch.start", idempotencyKey: "dispatch-observation-one", leaseDurationSeconds: 300,
    });
    assert.equal(untrustedReplay.ok, false);
    assert.equal(untrustedReplay.error.code, "AUTHORIZATION_DENIED");
    assert.deepEqual(readApplicationStateForOwner(runtime.store), beforeUntrustedReplay);
    runtime.trusted.setPrincipal(PRINCIPAL);
    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const reconciling = application.beginReconciliation({
      kind: "dispatch.begin_reconciliation", runId: started.value.runId,
      expectedOwnerRevision: started.value.ownerRevision, expectedRunRevision: started.value.runRevision,
    });
    assert.equal(reconciling.ok, true, JSON.stringify(reconciling));
    const inventory = application.reconciliationInventory(started.value.runId);
    assert.equal(inventory.ok, true);
    assert.deepEqual(inventory.value, []);
    runtime.trusted.setNow("2026-08-30T12:00:06.000Z");
    const reconciled = application.commitReconciliation({
      kind: "dispatch.commit_reconciliation", runId: started.value.runId,
      expectedOwnerRevision: reconciling.value.ownerRevision, expectedRunRevision: reconciling.value.runRevision,
      resolutions: [],
    });
    assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
    runtime.trusted.setNow("2026-08-30T12:00:07.000Z");
    const sealed = application.sealCandidates({
      kind: "dispatch.seal_candidates", runId: started.value.runId,
      expectedOwnerRevision: reconciled.value.ownerRevision, expectedRunRevision: reconciled.value.runRevision,
    });
    assert.equal(sealed.ok, true, JSON.stringify(sealed));
    assert.equal(sealed.value.expectedMemberCount, 1);
    let state = readApplicationStateForOwner(runtime.store);
    const member = state.dispatcherMembers[0];
    assert.equal(member.lifecycle, "pending");
    assert.equal(state.executions.length, 0);
    assert.equal(state.executionIntents.length, 0);

    runtime.trusted.setNow("2026-08-30T12:00:08.000Z");
    const claimCommand = {
      kind: "dispatch.claim_member", runId: started.value.runId,
      expectedOwnerRevision: sealed.value.ownerRevision, expectedRunRevision: sealed.value.runRevision,
      memberId: member.memberId, expectedMembershipRevision: member.membershipRevision,
      expectedMemberRevision: member.revision,
    };
    const claimed = application.claimAndPrepareMember(claimCommand);
    assert.equal(claimed.ok, true, JSON.stringify(claimed));
    assert.equal(claimed.value.outcome, "claimed");
    assert.equal(claimed.value.startCommand.kind, "execution.start");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.equal(state.executions.length, 1);
    assert.equal(state.executionIntents.length, 1);
    assert.equal(state.executionIntents[0].state, "pending");
    assert.equal(state.manualTurns.length, 0);
    assert.equal(state.dispatcherMembers[0].executionId, state.executions[0].executionId);
    assert.equal(state.dispatcherMembers[0].intentId, state.executionIntents[0].intentId);
    const claimReplay = application.claimAndPrepareMember(claimCommand);
    assert.equal(claimReplay.ok, true, JSON.stringify(claimReplay));
    assert.equal(claimReplay.replayed, true);
    const staleReplay = application.claimAndPrepareMember({ ...claimCommand, expectedMemberRevision: 2 });
    assert.equal(staleReplay.ok, false);
    assert.equal(staleReplay.error.code, "STALE_REVISION");

    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const reliable = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    runtime.trusted.setNow("2026-08-30T12:00:09.000Z");
    const effect = reliable.start(claimed.value.startCommand);
    assert.equal(effect.ok, true, JSON.stringify(effect));
    assert.equal(effect.value.lifecycle, "queued");
    runtime.trusted.setNow("2026-08-30T12:00:10.000Z");
    const latest = application.inspect(started.value.runId);
    const terminal = application.finalize({
      kind: "dispatch.finalize", runId: started.value.runId,
      expectedOwnerRevision: latest.value.ownerRevision, expectedRunRevision: latest.value.runRevision,
    });
    assert.equal(terminal.ok, true, JSON.stringify(terminal));
    assert.equal(terminal.value.terminalStatus, "completed");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.dispatcherRunSummaries.length, 1);
    assert.equal(state.dispatcherRunSummaries[0].claimedCount, 1);
    assert.equal(state.executionIntents[0].state, "finalized");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("dispatcher takeover begins exactly at expiry and fences the old worker tuple", async () => {
  const runtime = await prepareRuntime("dispatcher-takeover", 0);
  try {
    const application = createDispatcherApplicationService(runtime.store, runtime.trusted, {
      adapterId: "manual-local", adapterVersion: "1.0.0",
    });
    const beforeBounds = readApplicationStateForOwner(runtime.store);
    for (const leaseDurationSeconds of [29, 30.5, 3601]) {
      const invalid = application.start({
        kind: "dispatch.start", idempotencyKey: `invalid-lease-${leaseDurationSeconds}`,
        leaseDurationSeconds,
      });
      assert.equal(invalid.ok, false);
      assert.equal(invalid.error.code, "INVALID_INPUT");
    }
    assert.deepEqual(readApplicationStateForOwner(runtime.store), beforeBounds);
    runtime.trusted.setNow("2026-08-30T12:00:03.000Z");
    const maximum = application.start({
      kind: "dispatch.start", idempotencyKey: "maximum-lease", leaseDurationSeconds: 3600,
    });
    assert.equal(maximum.ok, true, JSON.stringify(maximum));
    assert.equal(maximum.value.leaseExpiresAt, "2026-08-30T13:00:03.000Z");
    runtime.trusted.setNow("2026-08-30T12:00:04.000Z");
    const started = application.start({
      kind: "dispatch.start", idempotencyKey: "takeover-observation", leaseDurationSeconds: 30,
    });
    assert.equal(started.ok, true);
    const beforeEqualHeartbeat = readApplicationStateForOwner(runtime.store);
    const equalHeartbeat = application.heartbeat({
      kind: "dispatch.heartbeat", runId: started.value.runId,
      expectedOwnerRevision: 1, expectedRunRevision: 1, expectedStatus: "starting",
    });
    assert.equal(equalHeartbeat.ok, false);
    assert.equal(equalHeartbeat.error.code, "STALE_REVISION");
    assert.deepEqual(readApplicationStateForOwner(runtime.store), beforeEqualHeartbeat);
    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const heartbeat = application.heartbeat({
      kind: "dispatch.heartbeat", runId: started.value.runId,
      expectedOwnerRevision: 1, expectedRunRevision: 1, expectedStatus: "starting",
    });
    assert.equal(heartbeat.ok, true, JSON.stringify(heartbeat));
    assert.equal(heartbeat.value.heartbeatAt, "2026-08-30T12:00:05.000Z");
    assert.equal(heartbeat.value.leaseExpiresAt, "2026-08-30T12:00:35.000Z");
    assert.equal(heartbeat.value.runRevision, 2);
    runtime.trusted.setNow("2026-08-30T12:00:04.500Z");
    const backward = application.heartbeat({
      kind: "dispatch.heartbeat", runId: started.value.runId,
      expectedOwnerRevision: 1, expectedRunRevision: 2, expectedStatus: "starting",
    });
    assert.equal(backward.ok, false);
    assert.equal(backward.error.code, "STALE_REVISION");
    runtime.trusted.setOwner("dispatcher-worker-b");
    runtime.trusted.setNow("2026-08-30T12:00:34.999Z");
    const early = application.takeover({
      kind: "dispatch.takeover", runId: started.value.runId, expectedOwnerId: "dispatcher-worker-a",
      expectedOwnerRevision: 1, expectedRunRevision: 2, expectedStatus: "starting",
    });
    assert.equal(early.ok, false);
    assert.equal(early.error.code, "LEASE_NOT_EXPIRED");
    runtime.trusted.setNow("2026-08-30T12:00:35.000Z");
    const taken = application.takeover({
      kind: "dispatch.takeover", runId: started.value.runId, expectedOwnerId: "dispatcher-worker-a",
      expectedOwnerRevision: 1, expectedRunRevision: 2, expectedStatus: "starting",
    });
    assert.equal(taken.ok, true, JSON.stringify(taken));
    assert.equal(taken.value.ownerId, "dispatcher-worker-b");
    assert.equal(taken.value.ownerRevision, 2);
    assert.equal(taken.value.runRevision, 3);
    assert.equal(taken.value.leaseExpiresAt, "2026-08-30T12:01:05.000Z");
    runtime.trusted.setOwner("dispatcher-worker-a");
    runtime.trusted.setNow("2026-08-30T12:00:36.000Z");
    const stale = application.beginReconciliation({
      kind: "dispatch.begin_reconciliation", runId: started.value.runId,
      expectedOwnerRevision: 1, expectedRunRevision: 2,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_OWNER");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
