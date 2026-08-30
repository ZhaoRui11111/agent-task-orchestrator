import assert from "node:assert/strict";
import test from "node:test";
import {
  EXECUTION_CONTRACT_ID,
  MANUAL_OUTCOME_CONTROL_ID,
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
const SENTINEL = "PROMPT_SECRET C:\\private\\token.env SELECT * FROM credentials Error: stack";

function poisonServiceCounters() {
  const counts = { ingress: 0, adapter: 0, accessor: 0 };
  const store = new Proxy({}, {
    get() {
      throw new Error("persistence must not be touched");
    },
  });
  const ingress = Object.freeze({
    currentActor() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    currentLeaseOwner() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    now() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    nextId() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    confirmOperation() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
  });
  const adapter = Object.freeze({
    contractId: EXECUTION_CONTRACT_ID,
    outcomeContractId: MANUAL_OUTCOME_CONTROL_ID,
    adapterId: "poison-adapter",
    adapterVersion: "1.0.0",
    start() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    resume() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    inspect() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    requestCancel() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    recordOutcome() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
  });
  return { counts, service: createReliableExecutionService(store, ingress, adapter, adapter) };
}

function assertInvalid(result) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_INPUT");
  assert.equal(result.requestId, null);
  assert.equal(result.correlationId, null);
}

test("malformed, overlong, accessor, proxy, path, prompt, credential, SQL, and stack-shaped commands stop before ingress", () => {
  const { counts, service } = poisonServiceCounters();
  const operations = [
    () => service.start({}),
    () => service.inspect({ kind: "execution.start" }),
    () => service.resume({ kind: "execution.resume", unexpected: true }),
    () => service.retry({ kind: "execution.retry", idempotencyKey: "x".repeat(129) }),
    () => service.requestCancel({ kind: "execution.cancel", reasonCode: SENTINEL }),
    () => service.recordManualOutcome({ kind: "manual.turn.report", evidenceReference: SENTINEL }),
    () => service.acceptManualCompletion({ kind: "execution.completion.accept", inputReference: SENTINEL }),
    () => service.reconcile({ kind: "execution.inspect", policyBindingReference: SENTINEL }),
  ];
  for (const operation of operations) assertInvalid(operation());

  const accessor = {};
  Object.defineProperty(accessor, "kind", {
    enumerable: true,
    get() {
      counts.accessor += 1;
      return "execution.start";
    },
  });
  assertInvalid(service.start(accessor));
  assert.equal(counts.accessor, 0);
  const hostileProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error(SENTINEL);
    },
  });
  assertInvalid(service.start(hostileProxy));
  assert.deepEqual(counts, { ingress: 0, adapter: 0, accessor: 0 });
});

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let actorId = ACTOR;
  let operationConfirmation = true;
  return {
    currentActor: () => ({ actorId, principal: PRINCIPAL }),
    currentLeaseOwner: () => "worker-security",
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => operationConfirmation
      ? ({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }) : null,
    setNow(value) { now = value; },
    setActor(value) { actorId = value; },
    setOperationConfirmation(value) { operationConfirmation = value; },
  };
}

async function prepareRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const ingress = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-security" });
  const application = createApplicationService(store, ingress);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: SENTINEL, supersedesTaskId: null,
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

function startCommand(executionId, key = "security-start-key") {
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
    idempotencyKey: key,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
  });
}

test("wrong actor and missing named confirmation cannot invoke the Manual writer or mutate Task/turn state", async () => {
  const runtime = await prepareRuntime("execution-loop-security-denials");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    let outcomeCalls = 0;
    const countingControl = Object.freeze({
      outcomeContractId: manual.outcomeContractId,
      recordOutcome(request) {
        outcomeCalls += 1;
        return manual.recordOutcome(request);
      },
    });
    const service = createReliableExecutionService(runtime.store, runtime.ingress, manual, countingControl);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));
    runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
    const report = Object.freeze({
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
      idempotencyKey: "security-report-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "security-report",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "activate",
      code: "manual_activated",
      evidenceReference: "security-evidence-ref",
      lastObservationNumber: 1,
    });
    const exactBeforeWrongActor = structuredClone(readApplicationStateForOwner(runtime.store));
    runtime.ingress.setActor("intruder");
    const wrongActor = service.recordManualOutcome(report);
    assert.equal(wrongActor.ok, false);
    assert.equal(wrongActor.error.code, "AUTHORIZATION_DENIED");
    assert.equal(outcomeCalls, 0);
    assert.deepEqual(readApplicationStateForOwner(runtime.store), exactBeforeWrongActor);

    runtime.ingress.setActor(ACTOR);
    runtime.ingress.setOperationConfirmation(false);
    const beforeUnconfirmed = readApplicationStateForOwner(runtime.store);
    const unconfirmed = service.recordManualOutcome(report);
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "CONFIRMATION_REQUIRED");
    assert.equal(outcomeCalls, 0);
    const afterUnconfirmed = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(afterUnconfirmed.domain, beforeUnconfirmed.domain);
    assert.deepEqual(afterUnconfirmed.manualTurns, beforeUnconfirmed.manualTurns);
    assert.deepEqual(afterUnconfirmed.manualBackendOperations, beforeUnconfirmed.manualBackendOperations);
    assert.equal(afterUnconfirmed.executionIntents.length, beforeUnconfirmed.executionIntents.length);
    assert.equal(afterUnconfirmed.executionOperationRequests.length, beforeUnconfirmed.executionOperationRequests.length + 1);
    assert.equal(afterUnconfirmed.executionAuthorizationDecisions.find(
      (decision) => decision.requestId === unconfirmed.requestId,
    )?.result, "deny");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

function executionSurface(state) {
  return Object.freeze({
    operationRequests: state.executionOperationRequests,
    decisions: state.executionAuthorizationDecisions,
    audit: state.executionOperationAudit,
    intents: state.executionIntents,
    observations: state.executionObservations,
    receipts: state.executionReceipts,
    finalizations: state.executionFinalizations,
    terminal: state.executionTerminalStates,
    turns: state.manualTurns,
    backendOperations: state.manualBackendOperations,
    completionDecisions: state.manualCompletionDecisions,
  });
}

test("Task content and adapter error detail never enter bounded execution records or public results", async () => {
  const runtime = await prepareRuntime("execution-loop-redaction");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const hostile = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) {
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "safe_external_failure",
            category: "permanent_external",
            retryable: false,
            ambiguous: false,
            message: SENTINEL,
            correlationId: request.correlationId,
            externalReference: null,
            retryAfter: null,
          }),
        });
      },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const result = createReliableExecutionService(runtime.store, runtime.ingress, hostile, manual)
      .start(startCommand(runtime.claim.value.executionId, "redaction-start-key"));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.lifecycle, "ambiguous");
    assert.equal(result.value.taskState, "waiting");
    assert.equal(JSON.stringify(result).includes(SENTINEL), false);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].body, SENTINEL);
    assert.equal(JSON.stringify(executionSurface(state)).includes(SENTINEL), false);
    assert.equal(JSON.stringify(executionSurface(state)).includes("safe_external_failure"), true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
