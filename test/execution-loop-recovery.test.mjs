import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationService,
  createExecutionApplicationService,
  createManualExecutionBackend,
  createReliableExecutionService,
  createReliableExecutionServiceWithHooks,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";
const FAILPOINTS = Object.freeze([
  "prepared",
  "executing",
  "adapter-effect",
  "independent-inspect",
  "observed",
  "receipt",
  "verified",
  "finalized",
]);

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let owner = "worker-recovery";
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => owner,
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }),
    setNow(value) { now = value; },
    setOwner(value) { owner = value; },
  };
}

async function prepareRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const ingress = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-recovery" });
  const application = createApplicationService(store, ingress);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "restart sentinel task body", supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  ingress.setNow("2026-08-30T12:00:01.000Z");
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  ingress.setNow("2026-08-30T12:00:02.000Z");
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  ingress.setNow("2026-08-30T12:00:03.000Z");
  const claim = createExecutionApplicationService(store, ingress).claim({
    kind: "execution.claim", projectId: "project", expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1, taskId: "task", expectedTaskRevision: 2,
    idempotencyKey: `claim-${prefix}`, leaseDurationSeconds: 300,
  });
  assert.equal(claim.ok, true, JSON.stringify(claim));
  ingress.setNow("2026-08-30T12:00:04.000Z");
  return { fixture, ingress, store, claim };
}

function startCommand(executionId, idempotencyKey) {
  return Object.freeze({
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
    idempotencyKey,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
  });
}

function outcomeCommand(started, idempotencyKey, operation) {
  const code = operation === "wait" ? "manual_input_required" :
    operation === "fail" ? "manual_turn_failed" : "manual_activated";
  return Object.freeze({
    kind: "manual.turn.report",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId: "task",
    expectedTaskRevision: 3,
    inputReference: "input-ref",
    executionId: started.executionId,
    expectedExecutionRevision: 1,
    expectedAttemptNumber: 1,
    expectedFencingToken: 1,
    idempotencyKey,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
    reportId: `report-${idempotencyKey}`,
    backendExecutionId: started.backendExecutionId,
    threadId: started.threadId,
    expectedJournalRevision: 1,
    expectedLifecycle: "queued",
    outcomeOperation: operation,
    code,
    evidenceReference: `${idempotencyKey}-evidence-ref`,
    lastObservationNumber: 1,
  });
}

async function buildScenario(operation, runtime) {
  const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
  const service = createReliableExecutionService(runtime.store, runtime.ingress, backend, backend);
  if (operation === "start") {
    const command = startCommand(runtime.claim.value.executionId, "tested-start-key");
    return { backend, command, invoke: (candidate) => candidate.start(command), lifecycle: "queued", taskState: "running" };
  }

  const started = service.start(startCommand(runtime.claim.value.executionId, "setup-start-key"));
  assert.equal(started.ok, true, JSON.stringify(started));
  runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
  if (operation === "manual_report") {
    const command = outcomeCommand(started.value, "tested-report-key", "activate");
    return { backend, command, invoke: (candidate) => candidate.recordManualOutcome(command), lifecycle: "active", taskState: "running" };
  }
  if (operation === "cancel") {
    const command = Object.freeze({
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
      idempotencyKey: "tested-cancel-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedLifecycle: "queued",
      reasonCode: "operator_cancelled",
      lastObservationNumber: 1,
    });
    return { backend, command, invoke: (candidate) => candidate.requestCancel(command), lifecycle: "queued", taskState: "running" };
  }

  const setupOperation = operation === "retry" ? "fail" : "wait";
  const predecessor = service.recordManualOutcome(outcomeCommand(started.value, `setup-${setupOperation}-key`, setupOperation));
  assert.equal(predecessor.ok, true, JSON.stringify(predecessor));
  assert.equal(predecessor.value.taskState, "waiting");
  runtime.ingress.setNow("2026-08-30T12:00:06.000Z");
  const kind = operation === "retry" ? "execution.retry" : "execution.resume";
  const command = Object.freeze({
    kind,
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
    idempotencyKey: `tested-${operation}-key`,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
    backendExecutionId: started.value.backendExecutionId,
    threadId: started.value.threadId,
    continuationReference: `${operation}-continuation-ref`,
    previousTurnReceiptId: predecessor.value.verifiedReceiptId,
    requiredActionReceiptId: `${operation}-accepted-ref`,
    lastObservationNumber: predecessor.value.observationNumber,
  });
  return {
    backend,
    command,
    invoke: (candidate) => operation === "retry" ? candidate.retry(command) : candidate.resume(command),
    lifecycle: "active",
    taskState: "running",
  };
}

async function runCrashScenario(operation, failpoint) {
  const runtime = await prepareRuntime(`recovery-${operation}-${failpoint}`);
  let store = runtime.store;
  let storeOpen = true;
  try {
    const scenario = await buildScenario(operation, runtime);
    let failpointReached = false;
    const hooked = createReliableExecutionServiceWithHooks(
      store,
      runtime.ingress,
      scenario.backend,
      scenario.backend,
      {
        afterStage(stage) {
          if (!failpointReached && stage === failpoint) {
            failpointReached = true;
            throw new Error(`simulated-crash-after-${stage}`);
          }
        },
      },
    );
    try {
      scenario.invoke(hooked);
    } catch (error) {
      assert.match(String(error), /simulated-crash/u);
    }
    assert.equal(failpointReached, true, `${operation}:${failpoint}`);

    await store.close();
    storeOpen = false;
    store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep02b-recovery-reopen" });
    storeOpen = true;
    const reopenedBackend = createManualExecutionBackend(store, { ingress: runtime.ingress });
    const reopenedService = createReliableExecutionService(store, runtime.ingress, reopenedBackend, reopenedBackend);
    const recovered = scenario.invoke(reopenedService);
    assert.equal(recovered.ok, true, `${operation}:${failpoint}:${JSON.stringify(recovered)}`);
    assert.equal(
      recovered.value.lifecycle,
      scenario.lifecycle,
      `${operation}:${failpoint}:${JSON.stringify(recovered)}:${JSON.stringify(readApplicationStateForOwner(store).manualBackendOperations)}`,
    );
    assert.equal(recovered.value.taskState, scenario.taskState);
    const replay = scenario.invoke(reopenedService);
    assert.equal(replay.ok, true, `${operation}:${failpoint}:${JSON.stringify(replay)}`);
    assert.equal(replay.requestId, recovered.requestId);
    assert.equal(replay.value.replayed, true);

    const state = readApplicationStateForOwner(store);
    const intents = state.executionIntents.filter((candidate) => candidate.idempotencyKey === scenario.command.idempotencyKey);
    assert.equal(intents.length, 1);
    assert.equal(intents[0].state, "finalized");
    assert.equal(state.executionObservations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
    assert.equal(state.executionReceipts.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
    assert.equal(state.executionFinalizations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
    assert.equal(
      state.manualBackendOperations.filter((candidate) => candidate.idempotencyKey === scenario.command.idempotencyKey).length,
      1,
      `${operation}:${failpoint}:${JSON.stringify(state.manualBackendOperations)}`,
    );
    assert.equal(state.executionIntents.some((candidate) => candidate.state !== "finalized"), false);
    assert.equal(JSON.stringify(state.executionIntents).includes("restart sentinel task body"), false);
  } finally {
    if (storeOpen) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
}

test("start, resume, retry, cancel, and Manual report reopen cleanly from every durable protocol checkpoint", async (context) => {
  for (const operation of ["start", "resume", "retry", "cancel", "manual_report"]) {
    for (const failpoint of FAILPOINTS) {
      await context.test(`${operation} after ${failpoint}`, async () => {
        await runCrashScenario(operation, failpoint);
      });
    }
  }
});

function responseLossAdapter(manual, lostMethod) {
  const call = (method, request) => {
    const result = manual[method](request);
    if (method === lostMethod && result.ok) throw new Error(`simulated-${method}-response-loss`);
    return result;
  };
  return Object.freeze({
    contractId: manual.contractId,
    backendKind: manual.backendKind,
    outcomeContractId: manual.outcomeContractId,
    adapterId: manual.adapterId,
    adapterVersion: manual.adapterVersion,
    start: (request) => call("start", request),
    resume: (request) => call("resume", request),
    inspect: (request) => manual.inspect(request),
    requestCancel: (request) => call("requestCancel", request),
    recordOutcome: (request) => call("recordOutcome", request),
  });
}

test("lost successful adapter responses reconcile through independent inspection without duplicate effects", async (context) => {
  const methods = Object.freeze({
    start: "start",
    resume: "resume",
    retry: "resume",
    cancel: "requestCancel",
    manual_report: "recordOutcome",
  });
  for (const [operation, lostMethod] of Object.entries(methods)) {
    await context.test(operation, async () => {
      const runtime = await prepareRuntime(`response-loss-${operation}`);
      let store = runtime.store;
      let storeOpen = true;
      try {
        const scenario = await buildScenario(operation, runtime);
        const lossy = responseLossAdapter(scenario.backend, lostMethod);
        const service = createReliableExecutionService(store, runtime.ingress, lossy, lossy);
        const result = scenario.invoke(service);
        assert.equal(result.ok, true, `${operation}:${JSON.stringify(result)}`);
        assert.equal(result.value.lifecycle, scenario.lifecycle);
        let state = readApplicationStateForOwner(store);
        assert.equal(state.manualBackendOperations.filter(
          (candidate) => candidate.idempotencyKey === scenario.command.idempotencyKey,
        ).length, 1);

        await store.close();
        storeOpen = false;
        store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep02b-response-loss-reopen" });
        storeOpen = true;
        const reopenedBackend = createManualExecutionBackend(store, { ingress: runtime.ingress });
        const reopenedService = createReliableExecutionService(store, runtime.ingress, reopenedBackend, reopenedBackend);
        const replay = scenario.invoke(reopenedService);
        assert.equal(replay.ok, true, `${operation}:${JSON.stringify(replay)}`);
        assert.equal(replay.value.replayed, true);
        state = readApplicationStateForOwner(store);
        assert.equal(state.manualBackendOperations.filter(
          (candidate) => candidate.idempotencyKey === scenario.command.idempotencyKey,
        ).length, 1);
      } finally {
        if (storeOpen) await store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
});

test("an ambiguous start with no durable Manual effect finalizes waiting and exact retry never blindly replays", async () => {
  const runtime = await prepareRuntime("ambiguous-start-no-effect");
  let store = runtime.store;
  let storeOpen = true;
  try {
    const manual = createManualExecutionBackend(store, { ingress: runtime.ingress });
    const ambiguous = Object.freeze({
      contractId: manual.contractId,
      backendKind: manual.backendKind,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start() { throw new Error("simulated-unknown-external-state"); },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const command = startCommand(runtime.claim.value.executionId, "ambiguous-start-key");
    const service = createReliableExecutionService(store, runtime.ingress, ambiguous, manual);
    const first = service.start(command);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.value.lifecycle, "ambiguous");
    assert.equal(first.value.taskState, "waiting");
    assert.equal(first.value.waiting?.reason, "ambiguous_external_state");
    assert.equal(first.value.waiting?.requiredAction, "execution.inspect");
    assert.equal(first.value.waiting?.backendThreadId, null);
    let state = readApplicationStateForOwner(store);
    assert.equal(state.manualTurns.length, 0);
    assert.equal(state.manualBackendOperations.length, 0);
    assert.equal(state.executionReceipts.length, 0);
    assert.equal(state.executionFinalizations.length, 1);

    await store.close();
    storeOpen = false;
    store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep02b-ambiguous-reopen" });
    storeOpen = true;
    const reopenedManual = createManualExecutionBackend(store, { ingress: runtime.ingress });
    const reopened = createReliableExecutionService(store, runtime.ingress, reopenedManual, reopenedManual).start(command);
    assert.equal(reopened.ok, true, JSON.stringify(reopened));
    assert.equal(reopened.value.lifecycle, "ambiguous");
    assert.equal(reopened.value.replayed, true);
    state = readApplicationStateForOwner(store);
    assert.equal(state.manualTurns.length, 0);
    assert.equal(state.manualBackendOperations.length, 0);
    assert.equal(state.executionFinalizations.length, 1);
  } finally {
    if (storeOpen) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("expired pending and executing intents never invoke an old-fence effect and permit fenced takeover after reconciliation", async (context) => {
  for (const boundary of ["prepared", "executing"]) {
    await context.test(`expired after ${boundary}`, async () => {
      const runtime = await prepareRuntime(`expired-old-fence-${boundary}`);
      try {
        let startCalls = 0;
        let manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
        const wrap = () => Object.freeze({
          contractId: manual.contractId,
          backendKind: manual.backendKind,
          adapterId: manual.adapterId,
          adapterVersion: manual.adapterVersion,
          start(request) { startCalls += 1; return manual.start(request); },
          resume: (request) => manual.resume(request),
          inspect: (request) => manual.inspect(request),
          requestCancel: (request) => manual.requestCancel(request),
        });
        const crashing = createReliableExecutionServiceWithHooks(
          runtime.store,
          runtime.ingress,
          wrap(),
          manual,
          {
            afterStage(stage) {
              if (stage === boundary) throw new Error(`crash-${boundary}`);
            },
          },
        );
        let stopped;
        try {
          stopped = crashing.start(startCommand(runtime.claim.value.executionId, `expired-${boundary}-start-key`));
        } catch (error) {
          assert.match(String(error), new RegExp(`crash-${boundary}`, "u"));
        }
        if (stopped !== undefined) {
          assert.equal(stopped.ok, false, JSON.stringify(stopped));
          assert.equal(stopped.error.code, "PERSISTENCE_FAILURE");
        }
        assert.equal(startCalls, 0);

        await runtime.store.close();
        runtime.ingress.setNow("2026-08-30T12:06:00.000Z");
        runtime.ingress.setOwner("worker-recovery-b");
        runtime.store = await openPersistence(runtime.fixture.layout, {
          applicationVersion: `ep02b-expired-${boundary}-restart`,
        });
        manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
        const service = createReliableExecutionService(runtime.store, runtime.ingress, wrap(), manual);
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
          idempotencyKey: `expired-${boundary}-reconcile-key`,
          policyBindingReference: "policy-ref",
          requestedDeadline: "2026-08-30T12:10:00.000Z",
          backendExecutionId: `absent-backend-${boundary}`,
          threadId: `absent-thread-${boundary}`,
          lastObservationNumber: 0,
        });
        assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
        assert.equal(reconciled.value.intentState, "finalized");
        assert.equal(startCalls, 0);
        let state = readApplicationStateForOwner(runtime.store);
        assert.equal(state.manualTurns.length, 0);
        assert.equal(state.manualBackendOperations.length, 0);
        assert.equal(state.executionIntents.every((candidate) => candidate.state === "finalized"), true);

        runtime.ingress.setNow("2026-08-30T12:06:01.000Z");
        const takeover = createExecutionApplicationService(runtime.store, runtime.ingress).takeover({
          kind: "execution.lease.takeover",
          projectId: "project",
          expectedProjectResourceRevision: 1,
          expectedProjectConfigRevision: 1,
          taskId: "task",
          expectedTaskRevision: 3,
          predecessorExecutionId: runtime.claim.value.executionId,
          expectedExecutionRevision: 1,
          expectedLeaseRevision: 1,
          expectedFencingToken: 1,
          idempotencyKey: `expired-${boundary}-takeover-key`,
          leaseDurationSeconds: 300,
        });
        assert.equal(takeover.ok, true, JSON.stringify(takeover));
        assert.equal(takeover.value.attemptNumber, 2);
        assert.equal(takeover.value.fencingToken, 2);
        state = readApplicationStateForOwner(runtime.store);
        assert.equal(state.executions.find((candidate) => candidate.executionId === runtime.claim.value.executionId)?.status, "superseded");
      } finally {
        await runtime.store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
});
