import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEDULER_CONTRACT_ID,
  invokeSchedulerBackend,
  parseSchedulerBackendRequest,
  parseSchedulerBackendResult,
  parseSchedulerDispatchTrigger,
} from "../src/scheduler-port.ts";

const SCOPE = Object.freeze({
  kind: "runtime",
  projectId: null,
  projectResourceRevision: null,
  projectConfigRevision: null,
});

function registerRequest() {
  return Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "register",
    operationId: "operation-1",
    idempotencyKey: "idempotency-1",
    correlationId: "correlation-1",
    scheduleId: "schedule-1",
    configRevision: 1,
    scope: SCOPE,
    scheduleExpression: "hourly-at-minute-zero",
    timeZone: "Etc/UTC",
    dispatcherTarget: "dispatcher-main",
  });
}

function receipt(request, overrides = {}) {
  return Object.freeze({
    ok: true,
    receipt: Object.freeze({
      contractId: SCHEDULER_CONTRACT_ID,
      receiptId: "receipt-1",
      operation: request.operation,
      operationId: request.operationId,
      scheduleId: request.scheduleId,
      configRevision: request.configRevision,
      externalRegistrationId: "external-1",
      externalState: "present",
      outcome: "succeeded",
      code: request.operation === "inspect" ? "inspected_present" : "registered",
      enabled: true,
      nextTriggerAt: "2026-09-04T20:00:00.000Z",
      evidenceReference: "evidence-1",
      observedAt: "2026-09-04T19:00:00.000Z",
      ...overrides,
    }),
  });
}

test("ato.scheduler/v1 accepts only exact backend and dispatch-trigger shapes", () => {
  const register = registerRequest();
  assert.deepEqual(parseSchedulerBackendRequest(register), register);
  const inspect = Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "inspect",
    operationId: "operation-2",
    correlationId: "correlation-2",
    scheduleId: "schedule-1",
    configRevision: 1,
    scope: SCOPE,
    externalRegistrationId: null,
  });
  const remove = Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "remove",
    operationId: "operation-3",
    idempotencyKey: "idempotency-3",
    correlationId: "correlation-3",
    scheduleId: "schedule-1",
    configRevision: 1,
    scope: SCOPE,
    externalRegistrationId: "external-1",
  });
  assert.deepEqual(parseSchedulerBackendRequest(inspect), inspect);
  assert.deepEqual(parseSchedulerBackendRequest(remove), remove);

  const trigger = Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "dispatch_trigger",
    triggerId: "trigger-1",
    scheduleId: "schedule-1",
    configRevision: 1,
    scheduledFor: "2026-09-04T20:00:00.000Z",
    observedAt: "2026-09-04T20:00:01.000Z",
    claimedDeduplication: "adapter-claim-1",
  });
  assert.deepEqual(parseSchedulerDispatchTrigger(trigger), trigger);
  assert.equal(parseSchedulerBackendRequest({ ...register, unknown: true }), null);
  assert.equal(parseSchedulerBackendRequest({ ...register, contractId: "ato.scheduler/v0" }), null);
  assert.equal(parseSchedulerBackendRequest({ ...register, configRevision: 0 }), null);
  assert.equal(parseSchedulerBackendRequest({ ...register, externalRegistrationId: "cross-operation" }), null);
  assert.equal(parseSchedulerBackendRequest({ ...register, scheduleExpression: "hourly\u200Bhidden" }), null);
  assert.equal(parseSchedulerDispatchTrigger({ ...trigger, scheduledFor: "not-a-time" }), null);
  assert.equal(parseSchedulerDispatchTrigger({ ...trigger, operation: "register" }), null);

  const accessor = { ...register };
  Object.defineProperty(accessor, "scheduleId", { enumerable: true, get() { throw new Error("must not execute"); } });
  assert.equal(parseSchedulerBackendRequest(accessor), null);
  const poison = new Proxy({}, { ownKeys() { throw new Error("must be contained"); } });
  assert.equal(parseSchedulerDispatchTrigger(poison), null);
});

test("scheduler receipts bind the exact operation tuple and closed semantic combinations", () => {
  const request = registerRequest();
  const accepted = receipt(request);
  assert.deepEqual(parseSchedulerBackendResult(accepted, request), accepted);
  assert.equal(parseSchedulerBackendResult(receipt(request, { operationId: "other" }), request), null);
  assert.equal(parseSchedulerBackendResult(receipt(request, { code: "removed" }), request), null);
  assert.equal(parseSchedulerBackendResult(receipt(request, { externalRegistrationId: null }), request), null);
  assert.equal(parseSchedulerBackendResult(receipt(request, {
    outcome: "refused", code: "refused", externalState: "present",
  }), request), null);
  assert.equal(parseSchedulerBackendResult(receipt(request, {
    outcome: "ambiguous", code: "ambiguous", externalState: "present",
  }), request), null);

  const inspect = Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "inspect",
    operationId: "operation-inspect-bound",
    correlationId: "correlation-inspect-bound",
    scheduleId: "schedule-1",
    configRevision: 1,
    scope: SCOPE,
    externalRegistrationId: "external-1",
  });
  assert.equal(parseSchedulerBackendResult(receipt(inspect, {
    externalRegistrationId: "external-substituted",
    code: "inspected_present",
  }), inspect), null);
  assert.equal(parseSchedulerBackendResult(receipt(inspect, {
    externalRegistrationId: "external-substituted",
    externalState: "ambiguous",
    outcome: "ambiguous",
    code: "ambiguous",
    enabled: null,
    nextTriggerAt: null,
  }), inspect), null);
  const remove = Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "remove",
    operationId: "operation-remove-bound",
    idempotencyKey: "idempotency-remove-bound",
    correlationId: "correlation-remove-bound",
    scheduleId: "schedule-1",
    configRevision: 1,
    scope: SCOPE,
    externalRegistrationId: "external-1",
  });
  assert.equal(parseSchedulerBackendResult(receipt(remove, {
    externalRegistrationId: "external-substituted",
    outcome: "refused",
    code: "still_present",
  }), remove), null);
  assert.equal(parseSchedulerBackendResult(receipt(remove, {
    externalRegistrationId: "external-substituted",
    externalState: "ambiguous",
    outcome: "ambiguous",
    code: "ambiguous",
    enabled: null,
    nextTriggerAt: null,
  }), remove), null);
  assert.equal(parseSchedulerBackendResult(receipt(remove, {
    outcome: "refused",
    code: "still_present",
    enabled: null,
  }), remove), null);
  assert.equal(parseSchedulerBackendResult({
    ok: false,
    error: {
      category: "transient_external",
      code: "later",
      retryable: false,
      ambiguous: false,
      retryAfter: null,
      evidenceReference: null,
    },
  }, request), null);
  assert.deepEqual(parseSchedulerBackendResult({
    ok: false,
    error: {
      category: "transient_external",
      code: "later",
      retryable: true,
      ambiguous: false,
      retryAfter: null,
      evidenceReference: null,
    },
  }, request)?.error.category, "transient_external");
});

test("scheduler invocation converts throws and invalid adapter output to closed integrity failures", () => {
  const request = registerRequest();
  const throwing = {
    register() { throw new Error("private adapter detail"); },
    inspect() { throw new Error("unused"); },
    remove() { throw new Error("unused"); },
  };
  const thrown = invokeSchedulerBackend(throwing, request);
  assert.equal(thrown.ok, false);
  assert.equal(thrown.error.category, "ambiguous_external_state");
  assert.equal(JSON.stringify(thrown).includes("private adapter detail"), false);
  const malformed = invokeSchedulerBackend({ ...throwing, register() { return { secret: "do-not-persist" }; } }, request);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.category, "integrity_failure");
  assert.equal(JSON.stringify(malformed).includes("do-not-persist"), false);
  const rawSecret = "RAW_ADAPTER_SECRET";
  const hostileEnvelope = new Proxy({}, {
    ownKeys() { throw new Error(rawSecret); },
    getOwnPropertyDescriptor() { throw new Error(rawSecret); },
  });
  const trapped = invokeSchedulerBackend({ ...throwing, register() { return hostileEnvelope; } }, request);
  assert.equal(trapped.ok, false);
  assert.equal(trapped.error.category, "integrity_failure");
  assert.equal(JSON.stringify(trapped).includes(rawSecret), false);
  const accessorEnvelope = {};
  Object.defineProperty(accessorEnvelope, "ok", { enumerable: true, get() { throw new Error(rawSecret); } });
  Object.defineProperty(accessorEnvelope, "receipt", { enumerable: true, value: receipt(request).receipt });
  const accessorTrapped = invokeSchedulerBackend({ ...throwing, register() { return accessorEnvelope; } }, request);
  assert.equal(accessorTrapped.ok, false);
  assert.equal(accessorTrapped.error.category, "integrity_failure");
});
