import assert from "node:assert/strict";
import test from "node:test";
import {
  EXECUTION_ADAPTER_ERROR_CATEGORIES,
  EXECUTION_CONTRACT_ID,
  MANUAL_OUTCOME_CONTROL_ID,
  createApplicationService,
  createExecutionApplicationService,
  createManualExecutionBackend,
  createReliableExecutionService,
  openPersistence,
  parseExecutionAdapterError,
  parseExecutionReceipt,
  parseExecutionRequest,
  parseManualOutcomeReport,
  parseManualOutcomeReportReceipt,
  validateExecutionPortResult,
  validateManualOutcomeControlResult,
} from "../src/index.ts";
import * as packageApi from "../src/index.ts";
import { createFakeExecutionBackend } from "./fixtures/fake-execution-backend.mjs";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => "worker-contract",
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }),
    setNow(value) { now = value; },
  };
}

async function claimedRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const ingress = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-port-contract" });
  const application = createApplicationService(store, ingress);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "contract sentinel body", supersedesTaskId: null,
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
    idempotencyKey: "claim-port-contract", leaseDurationSeconds: 300,
  });
  assert.equal(claim.ok, true, JSON.stringify(claim));
  ingress.setNow("2026-08-30T12:00:04.000Z");
  return { fixture, ingress, store, claim };
}

function assertExchange(request, result, expectedOperation, expectedAdapterId) {
  const parsedRequest = parseExecutionRequest(request);
  assert.notEqual(parsedRequest, null);
  assert.equal(parsedRequest.operation, expectedOperation);
  assert.equal(parsedRequest.contractId, EXECUTION_CONTRACT_ID);
  assert.equal(parsedRequest.adapterId, expectedAdapterId);
  const parsedResult = validateExecutionPortResult(result);
  assert.notEqual(parsedResult, null);
  assert.equal(parsedResult.ok, true);
  assert.equal(parsedResult.receipt.operation, expectedOperation);
  assert.equal(parsedResult.receipt.contractId, EXECUTION_CONTRACT_ID);
  assert.equal(parsedResult.receipt.adapterId, expectedAdapterId);
  assert.equal(parseExecutionReceipt(parsedResult.receipt)?.receiptId, parsedResult.receipt.receiptId);
}

test("Manual and test-only Fake adapters pass one strict start/inspect exchange suite with distinct identities", async () => {
  const runtime = await claimedRuntime("execution-port-shared-suite");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const exchanges = [];
    const capturingBackend = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) {
        const result = manual.start(request);
        exchanges.push({ request, result });
        return result;
      },
      resume: (request) => manual.resume(request),
      inspect(request) {
        const result = manual.inspect(request);
        exchanges.push({ request, result });
        return result;
      },
      requestCancel: (request) => manual.requestCancel(request),
    });
    const service = createReliableExecutionService(runtime.store, runtime.ingress, capturingBackend, manual);
    const started = service.start({
      kind: "execution.start",
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
      idempotencyKey: "shared-start-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(exchanges.length, 2);
    assertExchange(exchanges[0].request, exchanges[0].result, "start", manual.adapterId);
    assertExchange(exchanges[1].request, exchanges[1].result, "inspect", manual.adapterId);

    const fake = createFakeExecutionBackend();
    assert.notEqual(fake.adapterId, manual.adapterId);
    const fakeStartRequest = Object.freeze({
      ...exchanges[0].request,
      adapterId: fake.adapterId,
      adapterVersion: fake.adapterVersion,
      correlationId: "correlation-fake-start",
      operationId: "operation-fake-start",
      intentId: "intent-fake-start",
      idempotencyKey: "idempotency-fake-start",
      authorizationDecisionId: "decision-fake-start",
    });
    const fakeStarted = fake.start(fakeStartRequest);
    assertExchange(fakeStartRequest, fakeStarted, "start", fake.adapterId);
    assert.deepEqual(fake.start(fakeStartRequest), fakeStarted);
    const fakeInspectRequest = Object.freeze({
      ...exchanges[1].request,
      adapterId: fake.adapterId,
      adapterVersion: fake.adapterVersion,
      correlationId: "correlation-fake-inspect",
      queryId: "query-fake-inspect",
      authorizationDecisionId: "decision-fake-inspect",
      backendExecutionId: fakeStarted.receipt.backendExecutionId,
      threadId: fakeStarted.receipt.threadId,
    });
    const fakeInspected = fake.inspect(fakeInspectRequest);
    assertExchange(fakeInspectRequest, fakeInspected, "inspect", fake.adapterId);
    assert.equal(fakeInspected.receipt.lifecycle, "queued");

    assert.equal("FakeExecutionBackend" in packageApi, false);
    assert.equal("createFakeExecutionBackend" in packageApi, false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("execution contract parsers reject missing, extra, cross-class, action, workspace, accessor, and proxy drift", () => {
  const fake = createFakeExecutionBackend();
  const semantic = Object.freeze({
    projectId: "project",
    projectResourceRevision: 1,
    projectConfigRevision: 1,
    taskId: "task",
    taskRevision: 3,
    inputReference: "input-ref",
    executionId: "execution-1",
    executionRevision: 1,
    attemptNumber: 1,
    fencingToken: 1,
    policyBindingReference: "policy-ref",
    workspaceMode: "none",
  });
  const start = Object.freeze({
    contractId: EXECUTION_CONTRACT_ID,
    adapterId: fake.adapterId,
    adapterVersion: fake.adapterVersion,
    correlationId: "correlation-1",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
    semantic,
    operationId: "operation-1",
    intentId: "intent-1",
    idempotencyKey: "idempotency-1",
    actorId: ACTOR,
    authorizationDecisionId: "decision-1",
    action: "execution.start",
    operation: "start",
  });
  assert.notEqual(parseExecutionRequest(start), null);
  const { action: _action, ...missing } = start;
  assert.equal(parseExecutionRequest(missing), null);
  assert.equal(parseExecutionRequest({ ...start, unexpected: true }), null);
  assert.equal(parseExecutionRequest({ ...start, action: "execution.resume" }), null);
  assert.equal(parseExecutionRequest({ ...start, semantic: { ...semantic, workspaceMode: "managed" } }), null);
  assert.equal(parseExecutionRequest({ ...start, workingDirectory: "C:/secret", environment: { TOKEN: "secret" } }), null);
  assert.equal(parseExecutionRequest({ ...start, idempotencyKey: "x".repeat(129) }), null);

  let getterReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "operation", {
    enumerable: true,
    get() {
      getterReads += 1;
      return "start";
    },
  });
  assert.equal(parseExecutionRequest(accessor), null);
  assert.equal(fake.start(accessor).ok, false);
  assert.equal(getterReads, 0);

  const hostileProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("sentinel proxy trap");
    },
  });
  assert.equal(parseExecutionRequest(hostileProxy), null);
  assert.equal(validateExecutionPortResult(hostileProxy), null);

  let resultGetterReads = 0;
  const resultAccessor = {};
  Object.defineProperty(resultAccessor, "ok", {
    enumerable: true,
    get() {
      resultGetterReads += 1;
      return true;
    },
  });
  assert.equal(validateExecutionPortResult(resultAccessor), null);
  assert.equal(validateManualOutcomeControlResult(resultAccessor), null);
  assert.equal(resultGetterReads, 0);
});

test("closed adapter error flags and Manual outcome shapes are exact", () => {
  for (const category of EXECUTION_ADAPTER_ERROR_CATEGORIES) {
    const retryable = ["busy", "rate_limited", "resource_exhausted", "transient_external"].includes(category);
    const ambiguous = ["ambiguous_external_state", "integrity_failure"].includes(category);
    const error = Object.freeze({
      code: `code-${category}`,
      category,
      retryable,
      ambiguous,
      message: "bounded adapter error",
      correlationId: "correlation-error",
      externalReference: null,
      retryAfter: null,
    });
    assert.notEqual(parseExecutionAdapterError(error), null, category);
    assert.equal(parseExecutionAdapterError({ ...error, retryable: !retryable }), null, category);
    assert.equal(parseExecutionAdapterError({ ...error, ambiguous: !ambiguous }), null, category);
  }
  assert.notEqual(parseExecutionAdapterError(Object.freeze({
    code: "bounded_permanent_failure",
    category: "permanent_external",
    retryable: false,
    ambiguous: false,
    message: "bounded adapter error",
    correlationId: "correlation-error-retry-after",
    externalReference: null,
    retryAfter: "2026-08-30T12:01:00.000Z",
  })), null);

  const semantic = Object.freeze({
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1,
    taskId: "task", taskRevision: 3, inputReference: "input-ref",
    executionId: "execution-1", executionRevision: 1, attemptNumber: 1,
    fencingToken: 1, policyBindingReference: "policy-ref", workspaceMode: "none",
  });
  const report = Object.freeze({
    contractId: MANUAL_OUTCOME_CONTROL_ID,
    reportId: "report-1",
    operationId: "operation-report-1",
    intentId: "intent-report-1",
    idempotencyKey: "idempotency-report-1",
    actorId: ACTOR,
    authorizationDecisionId: "decision-report-1",
    confirmationId: "confirmation-report-1",
    correlationId: "correlation-report-1",
    semantic,
    backendExecutionId: "backend-1",
    threadId: "thread-1",
    expectedJournalRevision: 1,
    expectedLifecycle: "queued",
    operation: "wait",
    code: "manual_input_required",
    evidenceReference: "evidence-ref",
  });
  assert.notEqual(parseManualOutcomeReport(report), null);
  assert.equal(parseManualOutcomeReport({ ...report, operation: "complete" }), null);
  assert.equal(parseManualOutcomeReport({ ...report, workspaceReceipt: "forbidden" }), null);

  const reportReceipt = Object.freeze({
    contractId: MANUAL_OUTCOME_CONTROL_ID,
    receiptId: "receipt-report-1",
    reportId: report.reportId,
    operationId: report.operationId,
    intentId: report.intentId,
    idempotencyKey: report.idempotencyKey,
    correlationId: report.correlationId,
    backendExecutionId: report.backendExecutionId,
    threadId: report.threadId,
    observedPreRevision: 1,
    observedPostRevision: 2,
    lifecycle: "waiting",
    code: report.code,
    evidenceReference: report.evidenceReference,
    observedAt: "2026-08-30T12:00:10.000Z",
  });
  assert.notEqual(parseManualOutcomeReportReceipt(reportReceipt), null);
  assert.notEqual(validateManualOutcomeControlResult({ ok: true, receipt: reportReceipt }), null);
  assert.equal(validateManualOutcomeControlResult({ ok: true, receipt: { ...reportReceipt, leaked: "secret" } }), null);
});
