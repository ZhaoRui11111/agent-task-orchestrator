import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationService,
  createExecutionApplicationService,
  createManualExecutionBackend,
  createReliableExecutionService,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let leaseOwner = "worker-a";
  let confirmation = 0;
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => leaseOwner,
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${action}-${++confirmation}` }),
    setNow(value) { now = value; },
    setLeaseOwner(value) { leaseOwner = value; },
  };
}

async function prepareClaimedRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "sentinel task body must not enter execution records", supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  trusted.setNow("2026-08-30T12:00:01.000Z");
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  trusted.setNow("2026-08-30T12:00:02.000Z");
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  trusted.setNow("2026-08-30T12:00:03.000Z");
  const claim = createExecutionApplicationService(store, trusted).claim({
    kind: "execution.claim", projectId: "project", expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1, taskId: "task", expectedTaskRevision: 2,
    idempotencyKey: "claim-key", leaseDurationSeconds: 300,
  });
  assert.equal(claim.ok, true);
  trusted.setNow("2026-08-30T12:00:04.000Z");
  return { fixture, trusted, store, claim };
}

function startCommand(executionId) {
  return {
    kind: "execution.start",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId: "task",
    expectedTaskRevision: 3,
    inputReference: "input-ref",
    executionId,
    expectedExecutionRevision: 1,
    expectedAttemptNumber: 1,
    expectedFencingToken: 1,
    idempotencyKey: "start-key",
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
  };
}

test("Manual turn success remains running until a separately confirmed completion decision", async () => {
  const runtime = await prepareClaimedRuntime("manual-completion-loop");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true);
    assert.equal(started.value.lifecycle, "queued");
    assert.equal(started.value.taskState, "running");
    const startReplay = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(startReplay.ok, true);
    assert.equal(startReplay.requestId, started.requestId);
    assert.equal(startReplay.value.replayed, true);

    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const reported = service.recordManualOutcome({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "report-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "report-success",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "succeed",
      code: "manual_turn_succeeded",
      evidenceReference: "evidence-ref",
      lastObservationNumber: 1,
    });
    assert.equal(reported.ok, true, JSON.stringify(reported));
    assert.equal(reported.value.lifecycle, "turn_succeeded");
    assert.equal(reported.value.taskState, "running");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.equal(state.manualCompletionDecisions.length, 0);
    assert.equal(state.executionTerminalStates.length, 0);

    runtime.trusted.setNow("2026-08-30T12:06:00.000Z");
    runtime.trusted.setLeaseOwner("worker-b");
    const completed = service.acceptManualCompletion({
      kind: "execution.completion.accept",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      verifiedReceiptId: reported.value.verifiedReceiptId,
      finalizationId: reported.value.finalizationId,
      idempotencyKey: "completion-key",
    });
    assert.equal(completed.ok, true);
    assert.equal(completed.value.taskState, "completed");
    assert.equal(completed.value.lifecycle, "completed");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "completed");
    assert.equal(state.manualCompletionDecisions.length, 1);
    assert.equal(state.executionTerminalStates[0].status, "completed");
    assert.equal(JSON.stringify(state).includes("sentinel task body must not enter execution records"), true);
    assert.equal(JSON.stringify(state.executionIntents).includes("sentinel task body"), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("a waiting Manual turn resumes in the same live attempt and preserves one turn identity", async () => {
  const runtime = await prepareClaimedRuntime("manual-same-attempt-resume");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));

    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const waiting = service.recordManualOutcome({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "report-wait-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "report-wait",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "wait",
      code: "manual_input_required",
      evidenceReference: "input-request-ref",
      lastObservationNumber: 1,
    });
    assert.equal(waiting.ok, true, JSON.stringify(waiting));
    assert.equal(waiting.value.lifecycle, "waiting");
    assert.equal(waiting.value.taskState, "waiting");

    runtime.trusted.setNow("2026-08-30T12:00:06.000Z");
    const resumed = service.resume({
      kind: "execution.resume",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 4,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "same-attempt-resume-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      continuationReference: "same-attempt-continuation",
      previousTurnReceiptId: waiting.value.verifiedReceiptId,
      requiredActionReceiptId: "same-attempt-resume-accepted",
      lastObservationNumber: waiting.value.observationNumber,
    });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(resumed.value.executionId, runtime.claim.value.executionId);
    assert.equal(resumed.value.backendExecutionId, started.value.backendExecutionId);
    assert.equal(resumed.value.threadId, started.value.threadId);
    assert.equal(resumed.value.attemptNumber, 1);
    assert.equal(resumed.value.fencingToken, 1);
    assert.equal(resumed.value.lifecycle, "active");
    assert.equal(resumed.value.taskState, "running");

    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 1);
    assert.equal(state.manualTurns.length, 1);
    assert.equal(state.manualTurns[0].revision, 3);
    assert.equal(state.manualTurns[0].lifecycle, "active");
    assert.equal(state.manualBackendOperations.at(-1)?.operationKind, "resume");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("explicit inspections append immutable receipts without mutating the turn and reject a future cursor without writes", async () => {
  const runtime = await prepareClaimedRuntime("manual-explicit-inspection");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));
    const inspectCommand = (idempotencyKey) => Object.freeze({
      kind: "execution.inspect",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey,
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      lastObservationNumber: 1,
    });
    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const first = service.inspect(inspectCommand("inspect-one-key"));
    assert.equal(first.ok, true, JSON.stringify(first));
    runtime.trusted.setNow("2026-08-30T12:00:06.000Z");
    const second = service.inspect(inspectCommand("inspect-two-key"));
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.equal(first.value.lifecycle, "queued");
    assert.equal(second.value.lifecycle, "queued");
    assert.notEqual(first.value.verifiedReceiptId, second.value.verifiedReceiptId);
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.manualTurns.length, 1);
    assert.equal(state.manualTurns[0].revision, 1);
    assert.equal(state.manualBackendOperations.length, 1);
    assert.equal(state.executionIntents.length, 3);
    assert.equal(state.executionObservations.length, 3);
    assert.equal(state.executionReceipts.length, 3);
    assert.equal(state.executionFinalizations.length, 3);

    const exactBeforeFutureCursor = structuredClone(state);
    const futureCursor = service.inspect(Object.freeze({
      ...inspectCommand("inspect-future-key"),
      lastObservationNumber: 2,
    }));
    assert.equal(futureCursor.ok, false);
    assert.equal(futureCursor.error.code, "STALE_REVISION");
    state = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(state, exactBeforeFutureCursor);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("a cancellation request keeps the Task running until a separately reported cancellation is verified", async () => {
  const runtime = await prepareClaimedRuntime("manual-verified-cancellation");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));

    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const requested = service.requestCancel({
      kind: "execution.cancel",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "cancel-request-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedLifecycle: "queued",
      reasonCode: "operator_cancelled",
      lastObservationNumber: 1,
    });
    assert.equal(requested.ok, true, JSON.stringify(requested));
    assert.equal(requested.value.lifecycle, "queued");
    assert.equal(requested.value.taskState, "running");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.equal(state.executionTerminalStates.length, 0);
    assert.equal(state.manualTurns[0].cancellationRequestRevision, 2);

    runtime.trusted.setNow("2026-08-30T12:00:06.000Z");
    const cancelled = service.recordManualOutcome({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "cancel-confirm-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "report-cancelled",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 2,
      expectedLifecycle: "queued",
      outcomeOperation: "confirm_cancelled",
      code: "manual_cancelled",
      evidenceReference: "cancel-evidence-ref",
      lastObservationNumber: 2,
    });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    assert.equal(cancelled.value.lifecycle, "cancelled");
    assert.equal(cancelled.value.taskState, "cancelled");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "cancelled");
    assert.equal(state.executionTerminalStates.length, 1);
    assert.equal(state.executionTerminalStates[0].status, "cancelled");
    assert.equal(state.manualCompletionDecisions.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("a failed Manual turn retries through one higher attempt and fence without rewriting the predecessor", async () => {
  const runtime = await prepareClaimedRuntime("manual-retry-successor");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true);

    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const failed = service.recordManualOutcome({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "report-failed-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "report-failed",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "fail",
      code: "manual_turn_failed",
      evidenceReference: "failure-evidence",
      lastObservationNumber: 1,
    });
    assert.equal(failed.ok, true, JSON.stringify(failed));
    assert.equal(failed.value.lifecycle, "failed");
    assert.equal(failed.value.taskState, "waiting");
    assert.equal(failed.value.waiting?.requiredAction, "execution.retry");

    runtime.trusted.setNow("2026-08-30T12:00:06.000Z");
    const retried = service.retry({
      kind: "execution.retry",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 4,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "retry-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      continuationReference: "retry-continuation",
      previousTurnReceiptId: failed.value.verifiedReceiptId,
      requiredActionReceiptId: "retry-accepted-receipt",
      lastObservationNumber: failed.value.observationNumber,
    });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.notEqual(retried.value.executionId, runtime.claim.value.executionId);
    assert.equal(retried.value.attemptNumber, 2);
    assert.equal(retried.value.fencingToken, 2);
    assert.equal(retried.value.lifecycle, "active");
    assert.equal(retried.value.taskState, "running");
    const replay = service.retry({
      kind: "execution.retry",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 4,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "retry-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      continuationReference: "retry-continuation",
      previousTurnReceiptId: failed.value.verifiedReceiptId,
      requiredActionReceiptId: "retry-accepted-receipt",
      lastObservationNumber: failed.value.observationNumber,
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.value.executionId, retried.value.executionId);
    assert.equal(replay.value.replayed, true);

    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 2);
    assert.equal(state.executions[0].status, "superseded");
    assert.equal(state.executions[1].status, "active");
    assert.equal(state.manualTurns.length, 2);
    assert.equal(state.manualTurns[1].predecessorBackendExecutionId, state.manualTurns[0].backendExecutionId);
    assert.equal(state.manualTurns[1].predecessorThreadId, state.manualTurns[0].threadId);
    assert.equal(state.manualTurns[0].lifecycle, "failed");
    assert.equal(state.manualBackendOperations.at(-1)?.operationKind, "retry");
    assert.equal(state.manualBackendOperations.at(-1)?.sourceBackendExecutionId, state.manualTurns[0].backendExecutionId);

    const beforeLateWrite = structuredClone(state);
    const late = service.recordManualOutcome({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 5,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 2,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "old-fence-late-write",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "late-report",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 2,
      expectedLifecycle: "failed",
      outcomeOperation: "activate",
      code: "late",
      evidenceReference: null,
      lastObservationNumber: 2,
    });
    assert.equal(late.ok, false);
    assert.equal(late.error.code, "STALE_FENCE");
    assert.deepEqual(readApplicationStateForOwner(runtime.store), beforeLateWrite);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("an expired lease reconciles first and resumes through one fenced successor owned by the new worker", async () => {
  const runtime = await prepareClaimedRuntime("manual-expired-reconcile-resume");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(started.value.lifecycle, "queued");

    runtime.trusted.setNow("2026-08-30T12:06:00.000Z");
    runtime.trusted.setLeaseOwner("worker-b");
    const reconciled = service.reconcile({
      kind: "execution.inspect",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "expired-reconcile-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:10:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      lastObservationNumber: started.value.observationNumber,
    });
    assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
    assert.equal(reconciled.value.lifecycle, "queued");
    assert.equal(reconciled.value.taskState, "waiting");
    assert.equal(reconciled.value.waiting?.requiredAction, "execution.resume");
    assert.equal(reconciled.value.attemptNumber, 1);
    assert.equal(reconciled.value.fencingToken, 1);

    runtime.trusted.setNow("2026-08-30T12:06:01.000Z");
    const resumed = service.resume({
      kind: "execution.resume",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 4,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "expired-resume-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:10:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      continuationReference: "expired-resume-continuation",
      previousTurnReceiptId: reconciled.value.verifiedReceiptId,
      requiredActionReceiptId: "expired-resume-accepted-receipt",
      lastObservationNumber: reconciled.value.observationNumber,
    });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.notEqual(resumed.value.executionId, runtime.claim.value.executionId);
    assert.equal(resumed.value.attemptNumber, 2);
    assert.equal(resumed.value.fencingToken, 2);
    assert.equal(resumed.value.lifecycle, "active");
    assert.equal(resumed.value.taskState, "running");

    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 2);
    assert.equal(state.executions[0].status, "superseded");
    assert.equal(state.executions[0].ownerId, "worker-a");
    assert.equal(state.executions[1].status, "active");
    assert.equal(state.executions[1].ownerId, "worker-b");
    assert.equal(state.manualTurns.length, 2);
    assert.equal(state.manualTurns[1].predecessorBackendExecutionId, state.manualTurns[0].backendExecutionId);
    assert.equal(state.manualTurns[1].predecessorThreadId, state.manualTurns[0].threadId);
    assert.equal(state.manualBackendOperations.at(-1)?.operationKind, "resume");
    assert.equal(state.manualBackendOperations.at(-1)?.sourceBackendExecutionId, state.manualTurns[0].backendExecutionId);

    const beforeLateWrite = structuredClone(state);
    const late = service.recordManualOutcome({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 5,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 2,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "expired-old-fence-late-write",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:10:00.000Z",
      reportId: "expired-late-report",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "activate",
      code: "late",
      evidenceReference: null,
      lastObservationNumber: 1,
    });
    assert.equal(late.ok, false);
    assert.equal(late.error.code, "STALE_FENCE");
    assert.deepEqual(readApplicationStateForOwner(runtime.store), beforeLateWrite);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("competing Manual outcome writers permit one expected-revision CAS and the stale writer changes nothing", async () => {
  const runtime = await prepareClaimedRuntime("manual-competing-outcome-writers");
  try {
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const service = createReliableExecutionService(runtime.store, runtime.trusted, backend, backend);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));
    runtime.trusted.setNow("2026-08-30T12:00:05.000Z");
    const firstCommand = Object.freeze({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "competing-writer-a-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "competing-report-a",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "activate",
      code: "manual_activated",
      evidenceReference: "activation-evidence-ref",
      lastObservationNumber: 1,
    });
    const first = service.recordManualOutcome(firstCommand);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.value.lifecycle, "active");
    const afterWinner = structuredClone(readApplicationStateForOwner(runtime.store));

    const stale = service.recordManualOutcome(Object.freeze({
      ...firstCommand,
      idempotencyKey: "competing-writer-b-key",
      reportId: "competing-report-b",
      outcomeOperation: "wait",
      code: "manual_input_required",
      evidenceReference: "stale-evidence-ref",
    }));
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_REVISION");
    assert.deepEqual(readApplicationStateForOwner(runtime.store), afterWinner);

    const replay = service.recordManualOutcome(firstCommand);
    assert.equal(replay.ok, true);
    assert.equal(replay.value.replayed, true);
    assert.equal(replay.requestId, first.requestId);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.manualBackendOperations.filter((candidate) => candidate.operationKind === "manual_report").length, 1);
    assert.equal(state.manualTurns[0].revision, 2);
    assert.equal(state.manualTurns[0].lifecycle, "active");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
