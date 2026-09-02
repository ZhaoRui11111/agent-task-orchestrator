import { persistenceFailure } from "./errors.ts";
import type { ApplicationLifecycleAuthorization, ApplicationState } from "./application-repository-model.ts";
import { canonicalJson, exactRecord, isCanonicalUtcTimestamp, isNonemptyString, sha256 } from "./values.ts";

export function applicationStateSha256(state: ApplicationState): string {
  return sha256(canonicalJson(applicationStateProjection(state)));
}

export const APPLICATION_STATE_DIGEST_VERSION = 1 as const;

export function applicationStateProjection(state: ApplicationState): Readonly<Record<string, unknown>> {
  return Object.freeze({
    audit: state.audit,
    bootstrap: state.bootstrap,
    decisions: state.decisions,
    dispatcherAuthorizationDecisions: state.dispatcherAuthorizationDecisions,
    dispatcherAudit: state.dispatcherAudit,
    dispatcherMemberDenialAudit: state.dispatcherMemberDenialAudit,
    dispatcherMemberDenialDecisions: state.dispatcherMemberDenialDecisions,
    dispatcherMemberDenialRequests: state.dispatcherMemberDenialRequests,
    dispatcherMembers: state.dispatcherMembers,
    dispatcherMemberships: state.dispatcherMemberships,
    dispatcherReconciliationItems: state.dispatcherReconciliationItems,
    dispatcherReconciliationSummaries: state.dispatcherReconciliationSummaries,
    dispatcherRuns: state.dispatcherRuns,
    dispatcherRunSummaries: state.dispatcherRunSummaries,
    dispatcherTriggerRequests: state.dispatcherTriggerRequests,
    domain: state.domain,
    epochs: state.epochs,
    executionAuthorizationDecisions: state.executionAuthorizationDecisions,
    executionFinalizations: state.executionFinalizations,
    executionIntentAuthorizationBindings: state.executionIntentAuthorizationBindings,
    executionIntents: state.executionIntents,
    executionObservations: state.executionObservations,
    executionOperationAudit: state.executionOperationAudit,
    executionOperationRequests: state.executionOperationRequests,
    executionReceipts: state.executionReceipts,
    executionSequences: state.executionSequences,
    executionTerminalStates: state.executionTerminalStates,
    executions: state.executions,
    grants: state.grants,
    identity: state.identity,
    manualBackendOperations: state.manualBackendOperations,
    manualCompletionDecisions: state.manualCompletionDecisions,
    manualTurns: state.manualTurns,
    projects: state.projects,
    requests: state.requests,
    workspaceAuthorizationDecisions: state.workspaceAuthorizationDecisions,
    workspaceEvents: state.workspaceEvents,
    workspaceFinalizations: state.workspaceFinalizations,
    workspaceGenerations: state.workspaceGenerations,
    workspaceIntents: state.workspaceIntents,
    workspaceObservations: state.workspaceObservations,
    workspaceReceipts: state.workspaceReceipts,
  });
}

export function lifecycleAuthorizationProjection(record: ApplicationLifecycleAuthorization): Readonly<Record<string, unknown>> {
  return Object.freeze({
    authorizationId: record.authorizationId,
    operation: record.operation,
    backupGenerationId: record.backupGenerationId,
    actorId: record.actorId,
    runtimeRootKey: record.runtimeRootKey,
    grantId: record.grantId,
    grantRevision: record.grantRevision,
    requestId: record.requestId,
    decisionId: record.decisionId,
    auditId: record.auditId,
    authorizedStateSha256: record.authorizedStateSha256,
    expectedRequestCount: record.expectedRequestCount,
    expectedDecisionCount: record.expectedDecisionCount,
    expectedAuditCount: record.expectedAuditCount,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
}

export function parseApplicationLifecycleAuthorization(value: unknown): ApplicationLifecycleAuthorization {
  const record = exactRecord(value, [
    "actorId",
    "auditId",
    "authorizationId",
    "authorizedStateSha256",
    "backupGenerationId",
    "decisionId",
    "expectedAuditCount",
    "expectedDecisionCount",
    "expectedRequestCount",
    "expiresAt",
    "grantId",
    "grantRevision",
    "issuedAt",
    "operation",
    "requestId",
    "runtimeRootKey",
  ], "application lifecycle authorization handoff");
  const strings = [
    record.actorId,
    record.auditId,
    record.authorizationId,
    record.backupGenerationId,
    record.decisionId,
    record.grantId,
    record.requestId,
    record.runtimeRootKey,
  ];
  const counts = [record.grantRevision, record.expectedAuditCount, record.expectedDecisionCount, record.expectedRequestCount];
  if (
    !strings.every(isNonemptyString) ||
    (record.operation !== "runtime.backup" && record.operation !== "runtime.restore") ||
    typeof record.authorizedStateSha256 !== "string" ||
    !/^[0-9A-F]{64}$/u.test(record.authorizedStateSha256) ||
    !counts.every((item) => typeof item === "number" && Number.isSafeInteger(item) && item > 0) ||
    !isCanonicalUtcTimestamp(record.issuedAt) ||
    !isCanonicalUtcTimestamp(record.expiresAt) ||
    record.issuedAt >= record.expiresAt
  ) {
    throw persistenceFailure("INVALID_INPUT", "Application lifecycle authorization handoff is invalid");
  }
  return Object.freeze({
    authorizationId: record.authorizationId as string,
    operation: record.operation,
    backupGenerationId: record.backupGenerationId as string,
    actorId: record.actorId as string,
    runtimeRootKey: record.runtimeRootKey as string,
    grantId: record.grantId as string,
    grantRevision: record.grantRevision as number,
    requestId: record.requestId as string,
    decisionId: record.decisionId as string,
    auditId: record.auditId as string,
    authorizedStateSha256: record.authorizedStateSha256,
    expectedRequestCount: record.expectedRequestCount as number,
    expectedDecisionCount: record.expectedDecisionCount as number,
    expectedAuditCount: record.expectedAuditCount as number,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  });
}

export function lifecycleAuthorizationSha256(record: ApplicationLifecycleAuthorization): string {
  return sha256(canonicalJson(lifecycleAuthorizationProjection(record)));
}
