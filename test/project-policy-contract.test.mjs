import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPLETION_CONTRACT_ID,
  COMPLETION_FAILURE_CATEGORIES,
  COMPLETION_OPERATIONS,
  INTEGRATION_CONTRACT_ID,
  INTEGRATION_FAILURE_CATEGORIES,
  INTEGRATION_OPERATIONS,
  PROJECT_POLICY_CONTRACT_ID,
  PROJECT_POLICY_FAILURE_CATEGORIES,
  PROJECT_POLICY_OPERATIONS,
  parseCompletionBackendRequest,
  parseCompletionBackendResult,
  parseIntegrationBackendRequest,
  parseIntegrationBackendResult,
  parseProjectPolicyFacts,
  parseProjectPolicyRequest,
  parseProjectPolicyResult,
} from "../src/index.ts";

const SHA256_A = "A".repeat(64);
const SHA256_B = "B".repeat(64);
const SHA256_C = "C".repeat(64);
const TARGET = "a".repeat(40);
const SOURCE = "b".repeat(40);
const NOW = "2026-08-30T12:00:00.000Z";
const LATER = "2026-08-30T12:02:00.000Z";

function completionSubject() {
  return {
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1,
    projectRootKey: "project-root", repositoryIdentity: "repository", headObjectId: SOURCE,
    taskId: "task", taskRevision: 3, executionId: "execution", executionRevision: 1,
    attemptNumber: 1, fencingToken: 1, workspaceId: "workspace", generation: 1,
    workspaceRevision: 5, workspaceRootKey: "workspace-root", ownershipBindingSha256: SHA256_A,
    policyId: "policy", policyReceiptId: "policy-receipt", policyConfigRevision: 1,
    gateId: "gate", gateVersion: "1", commandKey: "command", commandIdentitySha256: SHA256_B,
    completionEvidenceRootKey: "evidence-root", toolEnvironmentSha256: SHA256_C,
  };
}

function completionRequest(operation) {
  const common = {
    contractId: COMPLETION_CONTRACT_ID, operation, correlationId: `correlation-${operation}`,
    causationId: operation === "run_gate" ? null : "gate-operation", actorId: "actor",
    adapterId: "completion-adapter", adapterVersion: "1.0.0", subject: completionSubject(),
  };
  return operation === "inspect_gate"
    ? { ...common, queryId: "query", readAuthorizationDecisionId: "read-decision", gateOperationId: "gate-operation", lastObservationNumber: 0 }
    : operation === "cancel_gate"
      ? { ...common, operationId: "cancel-operation", intentId: "cancel-intent", idempotencyKey: "cancel-key",
          finalAuthorizationDecisionId: "cancel-decision", gateOperationId: "gate-operation", expectedObservationNumber: 0 }
      : { ...common, operationId: "gate-operation", intentId: "gate-intent", idempotencyKey: "gate-key",
          finalAuthorizationDecisionId: "gate-decision", timeoutMs: 30_000 };
}

function completionResult(request) {
  const common = {
    contractId: COMPLETION_CONTRACT_ID, receiptId: `receipt-${request.operation}`, operation: request.operation,
    correlationId: request.correlationId, adapterId: request.adapterId, adapterVersion: request.adapterVersion,
    subject: request.subject, gateOperationId: request.operation === "run_gate" ? request.operationId : request.gateOperationId,
    observationNumber: 1, lifecycle: "completed", verdict: "pass", code: "gate_passed",
    startedAt: NOW, endedAt: NOW, validUntil: LATER, evidenceReference: "gate-evidence", observedAt: NOW,
  };
  return { ok: true, receipt: request.operation === "inspect_gate"
    ? { ...common, queryId: request.queryId, readAuthorizationDecisionId: request.readAuthorizationDecisionId }
    : { ...common, operationId: request.operationId, intentId: request.intentId, idempotencyKey: request.idempotencyKey } };
}

function policySubject(operation) {
  const base = {
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1,
    projectRootKey: "project-root", repositoryIdentity: "repository",
  };
  if (operation === "evaluate_mutation") return {
    ...base, subjectKind: "task", subjectId: "task", currentRevision: 3,
    proposedChangeSha256: SHA256_A, externalTargetSha256: null,
  };
  const completion = {
    ...base, taskId: "task", taskRevision: 3, executionId: "execution", executionRevision: 1,
    attemptNumber: 1, fencingToken: 1, workspaceId: "workspace", generation: 1,
    workspaceRevision: 5, ownershipBindingSha256: SHA256_A, headObjectId: SOURCE,
  };
  if (operation === "evaluate_integration") return {
    ...completion, targetReference: "refs/heads/main", expectedTargetObjectId: TARGET,
    sourceHeadObjectId: SOURCE, destinationIdentity: "local-bare", expectedRemoteHead: null,
  };
  if (operation === "evaluate_cleanup") return {
    ...completion, completionDecisionId: "completion", executionTerminalCreatedAt: NOW,
    gateSetSha256: SHA256_B, preservationStateSha256: SHA256_C, integrationDisposition: "not_required",
    integrationReservationId: null, observedInventorySha256: SHA256_A,
  };
  return completion;
}

function policyRequest(operation) {
  return {
    contractId: PROJECT_POLICY_CONTRACT_ID, operation, policyQueryId: `query-${operation}`,
    correlationId: `correlation-${operation}`, actorId: "actor", preliminaryAuthorizationDecisionId: "decision",
    requestedAction: operation === "completion_requirements" ? "completion.accept" : operation === "evaluate_integration"
      ? "integration.reserve" : operation === "evaluate_cleanup" ? "workspace.cleanup" : "task.update",
    policyId: "policy", policyKey: "policy-key", policyConfigRevision: 1,
    adapterId: "policy-adapter", adapterVersion: "1.0.0", subject: policySubject(operation),
  };
}

const POLICY_FACTS = Object.freeze({
  requiredGates: Object.freeze([Object.freeze({
    gateId: "gate", gateVersion: "1", commandKey: "command", commandIdentitySha256: SHA256_B,
    toolEnvironmentSha256: SHA256_C, validForSeconds: 120,
  })]),
  integration: "required", preservation: "not_required", cleanup: "allowed_after_completion",
});

function integrationSubject() {
  return {
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1, projectRootKey: "project-root",
    repositoryIdentity: "repository", objectFormat: "sha1", targetReference: "refs/heads/main",
    expectedTargetObjectId: TARGET, sourceWorkspaceId: "workspace", sourceGeneration: 1,
    sourceWorkspaceRevision: 5, sourceWorkspaceRootKey: "workspace-root", sourceOwnershipBindingSha256: SHA256_A,
    sourceHeadObjectId: SOURCE, reservationId: "reservation", reservationRevision: 1, reservationStatus: "active",
    reservationOwnerExecutionId: "execution", reservationOwnerOperationId: "reservation-operation",
    reservationLeaseOwnerId: "lease-owner", reservationLeaseRevision: 1, reservationFencingToken: 1,
    reservationExpiresAt: LATER, policyReceiptId: "policy-receipt", policyConfigRevision: 1,
    destinationIdentity: "local-bare", destinationReference: "refs/heads/main", expectedRemoteHead: null,
  };
}

function integrationRequest(operation) {
  const common = {
    contractId: INTEGRATION_CONTRACT_ID, operation, correlationId: `correlation-${operation}`,
    causationId: null, actorId: "actor", adapterId: "integration-adapter", adapterVersion: "1.0.0",
    subject: integrationSubject(),
  };
  return operation === "inspect"
    ? { ...common, queryId: "query", readAuthorizationDecisionId: "read-decision", lastObservationNumber: 0 }
    : { ...common, operationId: `operation-${operation}`, intentId: `intent-${operation}`,
        idempotencyKey: `key-${operation}`, finalAuthorizationDecisionId: `decision-${operation}`, expectedObservationNumber: 0 };
}

function integrationResult(request) {
  const inspect = request.operation === "inspect";
  const apply = request.operation === "apply";
  const common = {
    contractId: INTEGRATION_CONTRACT_ID, receiptId: `receipt-${request.operation}`, operation: request.operation,
    correlationId: request.correlationId, causationId: request.causationId, actorId: request.actorId,
    adapterId: request.adapterId, adapterVersion: request.adapterVersion, subject: request.subject,
    observationNumber: 1, localBeforeObjectId: inspect ? null : apply ? TARGET : SOURCE,
    localAfterObjectId: apply || !inspect ? SOURCE : TARGET, remoteBeforeObjectId: null,
    remoteAfterObjectId: apply ? null : inspect ? null : SOURCE,
    localState: apply ? "fast_forwarded" : inspect ? "unchanged" : "already_at_source",
    remoteState: apply ? "not_requested" : inspect ? "absent" : "pushed", outcome: "succeeded",
    code: apply ? "applied" : inspect ? "inspected_unchanged" : "pushed",
    evidenceReference: "integration-evidence", observedAt: NOW,
  };
  return { ok: true, receipt: inspect
    ? { ...common, queryId: request.queryId, readAuthorizationDecisionId: request.readAuthorizationDecisionId }
    : { ...common, operationId: request.operationId, intentId: request.intentId, idempotencyKey: request.idempotencyKey,
        finalAuthorizationDecisionId: request.finalAuthorizationDecisionId,
        expectedObservationNumber: request.expectedObservationNumber } };
}

test("ProjectPolicy, Completion, and Integration port grammars accept exact operations and reject cross-operation or extra fields", () => {
  assert.deepEqual(COMPLETION_OPERATIONS, ["run_gate", "inspect_gate", "cancel_gate"]);
  assert.deepEqual(PROJECT_POLICY_OPERATIONS, ["evaluate_mutation", "completion_requirements", "evaluate_integration", "evaluate_cleanup"]);
  assert.deepEqual(INTEGRATION_OPERATIONS, ["inspect", "apply", "push"]);
  for (const operation of COMPLETION_OPERATIONS) {
    const request = parseCompletionBackendRequest(completionRequest(operation));
    assert.ok(request, operation);
    assert.ok(parseCompletionBackendResult(completionResult(request), request), operation);
    assert.equal(parseCompletionBackendRequest({ ...completionRequest(operation), extra: true }), null);
  }
  for (const operation of PROJECT_POLICY_OPERATIONS) {
    const request = parseProjectPolicyRequest(policyRequest(operation));
    assert.ok(request, operation);
    const result = { ok: true, receipt: {
      ...request, receiptId: `receipt-${operation}`, decision: "allow", reasonCode: "configured_allow",
      facts: POLICY_FACTS, validUntil: LATER, evidenceReference: `policy:${operation}`, observedAt: NOW,
    } };
    assert.ok(parseProjectPolicyResult(result, request), operation);
    assert.equal(parseProjectPolicyRequest({ ...policyRequest(operation), subject: completionSubject() }), null);
  }
  assert.ok(parseProjectPolicyFacts(POLICY_FACTS));
  assert.equal(parseProjectPolicyFacts({ ...POLICY_FACTS, requiredGates: [...POLICY_FACTS.requiredGates, POLICY_FACTS.requiredGates[0]] }), null);
  const impossibleFacts = { ...POLICY_FACTS, integration: "not_required", preservation: "required" };
  assert.equal(parseProjectPolicyFacts(impossibleFacts), null);
  const completionPolicy = parseProjectPolicyRequest(policyRequest("completion_requirements"));
  assert.ok(completionPolicy);
  assert.equal(parseProjectPolicyResult({ ok: true, receipt: {
    ...completionPolicy, receiptId: "receipt-impossible-facts", decision: "allow", reasonCode: "configured_allow",
    facts: impossibleFacts, validUntil: LATER, evidenceReference: null, observedAt: NOW,
  } }, completionPolicy), null);
  for (const operation of INTEGRATION_OPERATIONS) {
    const request = parseIntegrationBackendRequest(integrationRequest(operation));
    assert.ok(request, operation);
    assert.ok(parseIntegrationBackendResult(integrationResult(request), request), operation);
    assert.equal(parseIntegrationBackendRequest({ ...integrationRequest(operation), extra: true }), null);
  }
});

test("Phase 3 ports reject accessors, exceptional proxies, wrong echoes, illegal classifications, and failure flag drift", () => {
  let getterReads = 0;
  const accessor = {};
  Object.defineProperty(accessor, "ok", { enumerable: true, get() { getterReads += 1; return true; } });
  const proxy = new Proxy({}, { ownKeys() { throw new Error("hostile"); } });
  const completion = parseCompletionBackendRequest(completionRequest("run_gate"));
  const policy = parseProjectPolicyRequest(policyRequest("completion_requirements"));
  const integration = parseIntegrationBackendRequest(integrationRequest("apply"));
  assert.ok(completion && policy && integration);
  assert.equal(parseCompletionBackendResult(accessor, completion), null);
  assert.equal(parseProjectPolicyResult(accessor, policy), null);
  assert.equal(parseIntegrationBackendResult(accessor, integration), null);
  assert.equal(parseCompletionBackendRequest(proxy), null);
  assert.equal(parseProjectPolicyRequest(proxy), null);
  assert.equal(parseIntegrationBackendRequest(proxy), null);
  assert.equal(getterReads, 0);
  assert.equal(parseCompletionBackendResult({ ok: true, receipt: { ...completionResult(completion).receipt, subject: { ...completion.subject, headObjectId: TARGET } } }, completion), null);
  assert.equal(parseProjectPolicyResult({ ok: true, receipt: {
    ...policy, receiptId: "receipt", decision: "allow", reasonCode: "allow", facts: POLICY_FACTS,
    validUntil: LATER, evidenceReference: null, observedAt: NOW, policyKey: "substituted",
  } }, policy), null);
  assert.equal(parseIntegrationBackendResult({ ok: true, receipt: {
    ...integrationResult(integration).receipt, localState: "unchanged",
  } }, integration), null);

  for (const categories of [COMPLETION_FAILURE_CATEGORIES, PROJECT_POLICY_FAILURE_CATEGORIES, INTEGRATION_FAILURE_CATEGORIES]) {
    assert.equal(new Set(categories).size, categories.length);
  }
  const invalidFailure = { ok: false, error: {
    category: "integrity_failure", code: "bad", retryable: true, ambiguous: true,
    retryAfter: null, evidenceReference: null,
  } };
  assert.equal(parseCompletionBackendResult(invalidFailure, completion), null);
  assert.equal(parseProjectPolicyResult(invalidFailure, policy), null);
  assert.equal(parseIntegrationBackendResult(invalidFailure, integration), null);
});
