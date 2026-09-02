import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSPACE_CONTRACT_ID,
  WORKSPACE_EXTERNAL_STATES,
  WORKSPACE_FAILURE_CATEGORIES,
  WORKSPACE_OPERATIONS,
  WORKSPACE_RECEIPT_CODES,
  invokeWorkspaceBackend,
  parseWorkspaceBackendRequest,
  parseWorkspaceBackendResult,
} from "../src/index.ts";

function subject() {
  return {
    projectId: "project",
    projectResourceRevision: 1,
    projectConfigRevision: 1,
    projectRootKey: "project-root-key",
    taskId: "task",
    taskRevision: 2,
    runId: "run",
    runRevision: 3,
    memberId: "member",
    membershipRevision: 1,
    memberRevision: 2,
    executionId: "execution",
    executionRevision: 4,
    attemptNumber: 1,
    fencingToken: 7,
    workspaceId: "workspace",
    generation: 1,
    workspaceRevision: 5,
    workspaceRootKey: "workspace-root-key",
    creatorOperationId: "creator-operation",
    baseReference: "refs/heads/main",
  };
}

function request(operation = "reserve") {
  return {
    contractId: WORKSPACE_CONTRACT_ID,
    operation,
    operationId: `operation-${operation}`,
    idempotencyKey: `idempotency-${operation}`,
    correlationId: `correlation-${operation}`,
    causationId: operation === "recover" ? "causal-operation" : null,
    adapterId: "fake-workspace",
    adapterVersion: "1.0.0",
    subject: subject(),
  };
}

function receipt(operation, externalState, outcome, code) {
  const complete = externalState === "complete";
  const present = externalState === "reserved" || externalState === "partial" || complete || externalState === "ambiguous";
  return {
    contractId: WORKSPACE_CONTRACT_ID,
    receiptId: `receipt-${operation}`,
    operation,
    operationId: `operation-${operation}`,
    idempotencyKey: `idempotency-${operation}`,
    adapterId: "fake-workspace",
    adapterVersion: "1.0.0",
    workspaceId: "workspace",
    generation: 1,
    projectRootKey: "project-root-key",
    workspaceRootKey: "workspace-root-key",
    externalState,
    outcome,
    code,
    canonicalPath: present ? "opaque-canonical-path" : null,
    repositoryIdentity: complete ? "repository-identity" : null,
    registrationIdentity: complete ? "registration-identity" : null,
    branchReference: complete ? "refs/heads/workspace" : null,
    baseObjectId: complete ? "A".repeat(40) : null,
    headObjectId: complete ? "B".repeat(40) : null,
    pathSafety: complete ? "safe" : present ? "unknown" : "safe",
    ownershipMatch: complete ? true : present ? null : false,
    inventory: { trackedCount: 2, modifiedCount: 1, untrackedCount: 0, ignoredCount: 0 },
    evidenceReference: "opaque-evidence",
    observedAt: "2026-08-30T12:00:00.000Z",
  };
}

test("ato.workspace/v1 request and receipt grammar is exact, finite, frozen, and operation-specific", () => {
  assert.equal(WORKSPACE_CONTRACT_ID, "ato.workspace/v1");
  assert.deepEqual(WORKSPACE_OPERATIONS, ["reserve", "create", "inspect", "recover", "cleanup"]);
  assert.equal(new Set(WORKSPACE_EXTERNAL_STATES).size, WORKSPACE_EXTERNAL_STATES.length);
  assert.equal(new Set(WORKSPACE_RECEIPT_CODES).size, WORKSPACE_RECEIPT_CODES.length);
  assert.equal(new Set(WORKSPACE_FAILURE_CATEGORIES).size, WORKSPACE_FAILURE_CATEGORIES.length);
  const failureFlags = [
    ["invalid_request", false, false],
    ["incompatible_contract", false, false],
    ["unauthorized", false, false],
    ["policy_denied", false, false],
    ["not_found", false, false],
    ["conflict", false, false],
    ["stale_revision", false, false],
    ["busy", true, false],
    ["rate_limited", true, false],
    ["resource_exhausted", true, false],
    ["transient_external", true, false],
    ["permanent_external", false, false],
    ["ambiguous_external_state", false, true],
    ["cancelled", false, false],
    ["integrity_failure", false, true],
  ];
  assert.deepEqual(WORKSPACE_FAILURE_CATEGORIES, failureFlags.map(([category]) => category));
  const positives = [
    ["reserve", "reserved", "succeeded", "reserved"],
    ["create", "complete", "succeeded", "created"],
    ["inspect", "absent", "succeeded", "inspected_absent"],
    ["recover", "reserved", "succeeded", "recovered_reserved"],
    ["cleanup", "removed", "succeeded", "removed"],
  ];
  for (const [operation, externalState, outcome, code] of positives) {
    const parsedRequest = parseWorkspaceBackendRequest(request(operation));
    assert.ok(parsedRequest);
    assert.equal(Object.isFrozen(parsedRequest), true);
    assert.equal(Object.isFrozen(parsedRequest.subject), true);
    const parsedResult = parseWorkspaceBackendResult({ ok: true, receipt: receipt(operation, externalState, outcome, code) });
    assert.ok(parsedResult);
    assert.equal(Object.isFrozen(parsedResult), true);
    assert.equal(Object.isFrozen(parsedResult.receipt), true);
    assert.equal(Object.isFrozen(parsedResult.receipt.inventory), true);
  }
  const refused = parseWorkspaceBackendResult({ ok: true, receipt: receipt("cleanup", "refused", "refused", "refused") });
  assert.equal(refused.ok, true);
  const ambiguous = parseWorkspaceBackendResult({ ok: true, receipt: receipt("create", "partial", "ambiguous", "partial") });
  assert.equal(ambiguous.ok, true);
  const failure = parseWorkspaceBackendResult({
    ok: false,
    error: {
      category: "ambiguous_external_state",
      code: "response_lost",
      retryable: false,
      ambiguous: true,
      retryAfter: null,
      evidenceReference: "opaque-evidence",
    },
  });
  assert.equal(failure.ok, false);
  assert.equal(Object.isFrozen(failure.error), true);
  for (const [category, retryable, ambiguousFlag] of failureFlags) {
    const parsed = parseWorkspaceBackendResult({
      ok: false,
      error: {
        category,
        code: "closed_error",
        retryable,
        ambiguous: ambiguousFlag,
        retryAfter: null,
        evidenceReference: null,
      },
    });
    assert.ok(parsed, category);
    assert.equal(parsed.ok, false);
  }
});

test("hostile request and result shapes fail closed without getters or exceptional proxies escaping", () => {
  let getterCalls = 0;
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "ok", {
    enumerable: true,
    get() { getterCalls += 1; return true; },
  });
  Object.defineProperty(accessor, "receipt", { enumerable: true, value: receipt("reserve", "reserved", "succeeded", "reserved") });
  const exceptional = new Proxy({}, { ownKeys() { throw new Error("hostile ownKeys"); } });
  assert.equal(parseWorkspaceBackendResult(accessor), null);
  assert.equal(parseWorkspaceBackendResult(exceptional), null);
  assert.equal(parseWorkspaceBackendRequest(exceptional), null);
  assert.equal(getterCalls, 0);

  const extraRequest = { ...request(), extra: true };
  const substitutedMember = { ...request(), subject: { ...subject(), memberId: "" } };
  assert.equal(parseWorkspaceBackendRequest(extraRequest), null);
  assert.equal(parseWorkspaceBackendRequest(substitutedMember), null);
  assert.equal(parseWorkspaceBackendRequest({ ...request(), contractId: "ato.workspace/v2" }), null);

  const valid = receipt("create", "complete", "succeeded", "created");
  const invalidResults = [
    { ok: true, receipt: { ...valid, extra: true } },
    { ok: true, receipt: { ...valid, operation: "reserve" } },
    { ok: true, receipt: { ...valid, outcome: "refused" } },
    { ok: true, receipt: { ...valid, canonicalPath: null } },
    { ok: true, receipt: { ...valid, inventory: { ...valid.inventory, modifiedCount: 3 } } },
    { ok: true, receipt: { ...valid, evidenceReference: "x".repeat(257) } },
    { ok: true, receipt: { ...valid, evidenceReference: "C:\\private\\workspace" } },
    { ok: true, receipt: { ...valid, evidenceReference: "credential=private" } },
    { ok: false, error: { category: "integrity_failure", code: "bad", retryable: true, ambiguous: true, retryAfter: null, evidenceReference: null } },
    { ok: false, error: { category: "ambiguous_external_state", code: "bad", retryable: true, ambiguous: true, retryAfter: null, evidenceReference: null } },
    { ok: false, error: { category: "transient_external", code: "bad", retryable: true, ambiguous: true, retryAfter: null, evidenceReference: null } },
    { ok: false, error: { category: "invalid_request", code: "bad", retryable: true, ambiguous: false, retryAfter: null, evidenceReference: null } },
    { ok: false, error: { category: "ambiguous_external_state", code: "bad-code", retryable: false, ambiguous: true, retryAfter: null, evidenceReference: null } },
  ];
  for (const value of invalidResults) assert.equal(parseWorkspaceBackendResult(value), null);
});

test("backend invocation dispatches exactly one closed operation and preserves the parsed request", () => {
  const calls = [];
  const backend = Object.fromEntries(WORKSPACE_OPERATIONS.map((operation) => [
    operation,
    (value) => {
      calls.push([operation, value]);
      return operation;
    },
  ]));
  for (const operation of WORKSPACE_OPERATIONS) {
    const parsed = parseWorkspaceBackendRequest(request(operation));
    assert.equal(invokeWorkspaceBackend(backend, parsed), operation);
  }
  assert.deepEqual(calls.map(([operation]) => operation), WORKSPACE_OPERATIONS);
  assert.equal(calls.every(([, value]) => Object.isFrozen(value.subject)), true);
});
