import type {
  AuthorizationAction,
  AuthorizationGrant,
  AuthorizationPolicyResult,
  AuthorizationReason,
  AuthorizationVocabularyVersion,
} from "../authorization.ts";
import type { DomainSnapshot } from "../domain.ts";
import type { ProjectRootIdentity } from "../project-registry.ts";
import type {
  WorkspaceExternalState as WorkspacePortExternalState,
  WorkspaceFailureCategory as WorkspacePortFailureCategory,
  WorkspaceOperation as WorkspacePortOperation,
  WorkspaceReceiptCode as WorkspacePortReceiptCode,
} from "../workspace-port.ts";

export interface RegisteredProject extends ProjectRootIdentity {
  readonly projectId: string;
  readonly configRevision: number;
  readonly resourceRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthorizationBootstrap extends ProjectRootIdentity {
  readonly actorId: string;
  readonly trustedPrincipal: string;
  readonly requestId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly vocabularyVersion: 1;
}

export type ApplicationAction =
  | AuthorizationAction
  | "authorization.capability.renew"
  | "authorization.capability.upgrade";

export interface AuthorizationLocalIdentity {
  readonly identityVersion: 1;
  readonly actorId: string;
  readonly principalSha256: string;
  readonly platform: string;
  readonly runtimeRootKey: string;
  readonly bootstrapRequestId: string;
  readonly createdAt: string;
}

export interface AuthorizationCapabilityEpoch {
  readonly epochId: string;
  readonly epochRevision: number;
  readonly actorId: string;
  readonly runtimeRootKey: string;
  readonly vocabularyVersion: AuthorizationVocabularyVersion;
  readonly actionSetSha256: string;
  readonly requestId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface ApplicationLifecycleAuthorization {
  readonly authorizationId: string;
  readonly operation: "runtime.backup" | "runtime.restore";
  readonly backupGenerationId: string;
  readonly actorId: string;
  readonly runtimeRootKey: string;
  readonly grantId: string;
  readonly grantRevision: number;
  readonly requestId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly authorizedStateSha256: string;
  readonly expectedRequestCount: number;
  readonly expectedDecisionCount: number;
  readonly expectedAuditCount: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ApplicationRequestRecord {
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly action: ApplicationAction;
  readonly targetKind: "runtime" | "project" | "task" | "grant" | "backup" | "execution";
  readonly targetId: string;
  readonly targetRevision: number | null;
  readonly result: "bootstrap" | "allow" | "deny" | "renewal" | "upgrade";
  readonly createdAt: string;
}

export interface AuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly action: ApplicationAction;
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly projectId: string | null;
  readonly resourceRevision: number | null;
  readonly createdAt: string;
}

export interface ApplicationAuditRecord {
  readonly auditId: string;
  readonly requestId: string;
  readonly decisionId: string | null;
  readonly eventKind:
    | "bootstrap"
    | "grant.issued"
    | "grant.revoked"
    | "grant.inspected"
    | "project.registered"
    | "project.updated"
    | "project.disabled"
    | "project.inspected"
    | "task.created"
    | "task.updated"
    | "task.ready"
    | "task.cancelled"
    | "task.inspected"
    | "dependency.added"
    | "dependency.removed"
    | "policy.evaluated"
    | "authorization.denied"
    | "capability.renewed"
    | "capability.upgraded"
    | "execution.claimed"
    | "execution.claim.inspected"
    | "execution.lease.renewed"
    | "execution.lease.taken_over"
    | "grant.listed"
    | "runtime.status.inspected"
    | "backup.authorized"
    | "restore.authorized";
  readonly result: "accepted" | "denied";
  readonly actorId: string;
  readonly correlationId: string;
  readonly targetKind: "runtime" | "project" | "task" | "grant" | "backup" | "execution";
  readonly targetId: string;
  readonly targetRevision: number | null;
  readonly reason: string;
  readonly createdAt: string;
}

export interface TaskExecutionSequence {
  readonly taskId: string;
  readonly lastAttemptNumber: number;
  readonly currentFencingToken: number;
  readonly revision: number;
}

export interface ExecutionAttempt {
  readonly executionId: string;
  readonly taskId: string;
  readonly attemptNumber: number;
  readonly operationKind: "claim" | "takeover";
  readonly status: "active" | "superseded";
  readonly idempotencyKey: string;
  readonly ownerId: string;
  readonly requestedLeaseSeconds: number;
  readonly predecessorExecutionRevision: number | null;
  readonly predecessorLeaseRevision: number | null;
  readonly predecessorFencingToken: number | null;
  readonly leaseRevision: number;
  readonly leaseExpiresAt: string;
  readonly fencingToken: number;
  readonly revision: number;
  readonly expectedTaskRevision: number;
  readonly preTaskRevision: number;
  readonly postTaskRevision: number;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly requestId: string;
  readonly decisionId: string;
  readonly supersedesExecutionId: string | null;
  readonly supersededByExecutionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ExecutionOperationKind = "start" | "inspect" | "resume" | "retry" | "request_cancel" | "manual_report";
export type ExecutionIntentState = "pending" | "executing" | "observed" | "verified" | "finalized" | "retry_wait" | "ambiguous" | "failed";
export type ManualTurnLifecycle = "queued" | "active" | "waiting" | "turn_succeeded" | "failed" | "cancelled";

export interface ExecutionOperationRequestRecord {
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly action: Extract<AuthorizationAction,
    "execution.start" | "execution.inspect" | "execution.resume" | "execution.retry" | "execution.cancel" | "execution.completion.accept">;
  readonly targetExecutionId: string;
  readonly targetRevision: number;
  readonly result: "allow" | "deny";
  readonly createdAt: string;
}

export interface ExecutionAuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly action: ExecutionOperationRequestRecord["action"];
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly projectId: string;
  readonly resourceRevision: number;
  readonly configRevision: number;
  readonly createdAt: string;
}

export interface ExecutionOperationAuditRecord {
  readonly auditId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly eventKind:
    | "execution.operation.prepared" | "execution.operation.denied" | "execution.operation.executing"
    | "execution.operation.observed" | "execution.operation.verified" | "execution.operation.finalized"
    | "execution.manual.outcome.recorded" | "execution.completion.accepted"
    | "execution.interruption.verified" | "execution.reconciled";
  readonly result: "accepted" | "denied";
  readonly actorId: string;
  readonly correlationId: string;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly code: string;
  readonly createdAt: string;
}

export interface ExecutionOperationIntent {
  readonly intentId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly operationKind: ExecutionOperationKind;
  readonly action: Exclude<ExecutionOperationRequestRecord["action"], "execution.completion.accept">;
  readonly state: ExecutionIntentState;
  readonly revision: number;
  readonly actorId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly currentAuthorizationDecisionId: string;
  readonly authorizationBindingRevision: number;
  readonly confirmationId: string | null;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly inputReference: string;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly sourceExecutionId: string | null;
  readonly sourceExecutionRevision: number | null;
  readonly sourceAttemptNumber: number | null;
  readonly sourceFencingToken: number | null;
  readonly sourceObservationNumber: number | null;
  readonly contractId: "ato.execution/v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly policyBindingReference: string;
  readonly workspaceMode: "none";
  readonly backendExecutionId: string | null;
  readonly threadId: string | null;
  readonly previousReceiptId: string | null;
  readonly expectedJournalRevision: number | null;
  readonly requestedDeadline: string;
  readonly continuationReference: string | null;
  readonly requiredActionReceiptId: string | null;
  readonly expectedLifecycle: ManualTurnLifecycle | null;
  readonly reasonCode: string | null;
  readonly reportId: string | null;
  readonly reportOperation: "activate" | "wait" | "succeed" | "fail" | "confirm_cancelled" | null;
  readonly reportCode: string | null;
  readonly evidenceReference: string | null;
  readonly lastObservationNumber: number;
  readonly lastErrorCategory: ExecutionAdapterFailureCategory | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorRetryable: boolean | null;
  readonly lastErrorAmbiguous: boolean | null;
  readonly retryAfter: string | null;
  readonly retryCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ExecutionAdapterFailureCategory =
  | "invalid_request" | "incompatible_contract" | "unauthorized" | "policy_denied"
  | "not_found" | "conflict" | "stale_revision" | "busy" | "rate_limited"
  | "resource_exhausted" | "transient_external" | "permanent_external"
  | "ambiguous_external_state" | "cancelled" | "integrity_failure";

export interface ExecutionIntentAuthorizationBindingRecord {
  readonly bindingId: string;
  readonly intentId: string;
  readonly bindingRevision: number;
  readonly phase: "prepare" | "act" | "finalize";
  readonly requestId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly priorDecisionId: string | null;
  readonly createdAt: string;
}

export interface ExecutionObservationRecord {
  readonly observationId: string;
  readonly intentId: string;
  readonly observationNumber: number;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly authorizationDecisionId: string;
  readonly lifecycle: "unknown" | ManualTurnLifecycle;
  readonly outcome: "succeeded" | "deferred" | "rejected";
  readonly code: string;
  readonly backendExecutionId: string | null;
  readonly threadId: string | null;
  readonly journalRevision: number | null;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export interface ExecutionVerifiedReceiptRecord {
  readonly verifiedReceiptId: string;
  readonly intentId: string;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly lifecycle: string;
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly observationNumber: number;
  readonly observedRevision: number;
  readonly fencingToken: number;
  readonly verifiedAt: string;
}

export interface ExecutionFinalizationRecord {
  readonly finalizationId: string;
  readonly intentId: string;
  readonly verifiedReceiptId: string | null;
  readonly authorizationDecisionId: string;
  readonly outcome: "accepted" | "deferred" | "rejected" | "waiting" | "interrupted";
  readonly code: string;
  readonly taskRevision: number;
  readonly executionRevision: number;
  readonly finalizedAt: string;
}

export interface ExecutionTerminalStateRecord {
  readonly executionId: string;
  readonly status: "completed" | "cancelled";
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly verifiedReceiptId: string;
  readonly finalizationId: string;
  readonly completionDecisionId: string | null;
  readonly preTaskRevision: number;
  readonly postTaskRevision: number;
  readonly executionRevision: number;
  readonly createdAt: string;
}

export interface ManualBackendTurnRecord {
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly startIdempotencyKey: string;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly inputReference: string;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly predecessorBackendExecutionId: string | null;
  readonly predecessorThreadId: string | null;
  readonly policyBindingReference: string;
  readonly workspaceMode: "none";
  readonly lifecycle: ManualTurnLifecycle;
  readonly cancellationRequestRevision: number | null;
  readonly cancellationRequestedAt: string | null;
  readonly code: string;
  readonly evidenceReference: string | null;
  readonly lastReportId: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ManualBackendOperationRecord {
  readonly backendOperationId: string;
  readonly idempotencyKey: string;
  readonly intentId: string;
  readonly authorizationDecisionId: string;
  readonly operationKind: "start" | "resume" | "retry" | "request_cancel" | "manual_report";
  readonly reportOperation: "activate" | "wait" | "succeed" | "fail" | "confirm_cancelled" | null;
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly sourceBackendExecutionId: string | null;
  readonly sourceThreadId: string | null;
  readonly expectedFencingToken: number;
  readonly expectedPreRevision: number | null;
  readonly postRevision: number;
  readonly resultLifecycle: ManualTurnLifecycle;
  readonly receiptId: string;
  readonly createdAt: string;
}

export interface ManualCompletionDecisionRecord {
  readonly completionDecisionId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly taskId: string;
  readonly executionId: string;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly verifiedReceiptId: string;
  readonly finalizationId: string;
  readonly preTaskRevision: number;
  readonly postTaskRevision: number;
  readonly requestId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly confirmationId: string;
  readonly createdAt: string;
}

export interface DispatcherTriggerRequestRecord {
  readonly requestId: string;
  readonly observationId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly action: "dispatch.run";
  readonly workerOwnerId: string;
  readonly requestedLeaseSeconds: number;
  readonly result: "allow" | "deny";
  readonly createdAt: string;
}

export interface DispatcherAuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly action: "dispatch.run";
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly createdAt: string;
}

export type DispatcherRunStatus = "starting" | "reconciling" | "sweeping" | "completed" | "partial" | "failed" | "interrupted";

export interface DispatcherRunRecord {
  readonly runId: string;
  readonly observationId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly actorId: string;
  readonly ownerId: string;
  readonly ownerRevision: number;
  readonly runRevision: number;
  readonly requestedLeaseSeconds: number;
  readonly heartbeatAt: string;
  readonly leaseExpiresAt: string;
  readonly status: DispatcherRunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const DISPATCHER_AUDIT_CODES = Object.freeze([
  "started", "reconciling", "reconciled", "sealed", "member_resolved", "heartbeat", "taken_over", "terminal",
  "allowed", "actor_mismatch", "action_mismatch", "scope_mismatch", "scope_revision_stale", "grant_expired",
  "grant_not_yet_valid", "grant_revoked", "grant_missing", "policy_denied", "confirmation_required",
] as const);
export type DispatcherAuditCode = (typeof DISPATCHER_AUDIT_CODES)[number];

export const DISPATCHER_RECONCILIATION_CODES = Object.freeze([
  "reliable_reconciled", "reliable_authorization_denied", "reliable_state_ambiguous", "reliable_recovery_failed",
  "stale_run_already_terminal", "stale_run_recovered", "stale_run_authorization_denied",
  "stale_run_recovery_failed", "stale_run_recovery_pending", "resource_already_settled",
  "execution_already_terminal", "execution_intent_absent", "execution_intent_ambiguous",
  "execution_no_longer_active", "execution_intent_unfinished", "execution_binding_changed",
  "execution_takeover_denied", "execution_takeover_stale", "execution_takeover_failed",
  "execution_backend_journal_present", "execution_turn_queued", "execution_turn_active", "execution_turn_waiting",
  "execution_turn_turn_succeeded", "execution_turn_failed", "execution_turn_cancelled",
] as const);
export type DispatcherReconciliationCode = (typeof DISPATCHER_RECONCILIATION_CODES)[number];

export const DISPATCHER_MEMBER_CODES = Object.freeze([
  "dispatch_denied", "binding_absent", "project_identity_changed", "project_revision_changed", "project_disabled",
  "execution_sequence_exists", "task_revision_changed", "domain_ineligible", "resource_reconciliation_incomplete",
  "execution_claim_denied", "execution_start_denied", "domain_claim_rejected", "claimed_and_prepared",
] as const);
export type DispatcherMemberCode = (typeof DISPATCHER_MEMBER_CODES)[number];

export interface DispatcherAuditRecord {
  readonly auditId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly runId: string | null;
  readonly eventKind: "dispatch.denied" | "dispatch.started" | "dispatch.reconciling" | "dispatch.sealed" |
    "dispatch.member.resolved" | "dispatch.heartbeat" | "dispatch.taken_over" | "dispatch.terminal" |
    "dispatch.operation.denied";
  readonly result: "accepted" | "denied";
  readonly actorId: string;
  readonly correlationId: string;
  readonly code: DispatcherAuditCode;
  readonly createdAt: string;
}

export interface DispatcherReconciliationItemRecord {
  readonly reconciliationItemId: string;
  readonly runId: string;
  readonly ordinal: number;
  readonly resourceKind: "execution_intent" | "execution_lease" | "dispatcher_run";
  readonly resourceId: string;
  readonly disposition: "reconciled" | "no_effect" | "authorization_denied" | "ambiguous" | "failed";
  readonly code: DispatcherReconciliationCode;
  readonly createdAt: string;
}

export interface DispatcherReconciliationSummaryRecord {
  readonly runId: string;
  readonly summaryRevision: 1;
  readonly expectedCount: number;
  readonly reconciledCount: number;
  readonly noEffectCount: number;
  readonly authorizationDeniedCount: number;
  readonly ambiguousCount: number;
  readonly failedCount: number;
  readonly createdAt: string;
}

export interface DispatcherMembershipRecord {
  readonly runId: string;
  readonly membershipRevision: number;
  readonly expectedMemberCount: number;
  readonly sealedAt: string;
}

export type DispatcherMemberOutcome = "claimed" | "already_claimed" | "ineligible_at_cas" |
  "authorization_denied" | "policy_deferred" | "resource_deferred" | "reconciliation_required" | "failed";

export interface DispatcherMemberRecord {
  readonly memberId: string;
  readonly runId: string;
  readonly membershipRevision: number;
  readonly ordinal: number;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly lifecycle: "pending" | "terminal";
  readonly outcome: DispatcherMemberOutcome | null;
  readonly executionId: string | null;
  readonly intentId: string | null;
  readonly code: DispatcherMemberCode | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DispatcherMemberDenialRequestRecord {
  readonly requestId: string;
  readonly correlationId: string;
  readonly runId: string;
  readonly memberId: string;
  readonly actorId: string;
  readonly action: "execution.start";
  readonly targetExecutionId: string;
  readonly targetRevision: 1;
  readonly result: "deny";
  readonly createdAt: string;
}

export interface DispatcherMemberDenialDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly action: "execution.start";
  readonly result: "deny";
  readonly reason: Exclude<AuthorizationReason, "allowed">;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly projectId: string;
  readonly resourceRevision: number;
  readonly configRevision: number;
  readonly createdAt: string;
}

export interface DispatcherMemberDenialAuditRecord {
  readonly auditId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly runId: string;
  readonly memberId: string;
  readonly eventKind: "authorization.denied";
  readonly result: "denied";
  readonly actorId: string;
  readonly correlationId: string;
  readonly targetExecutionId: string;
  readonly targetRevision: 1;
  readonly code: Exclude<AuthorizationReason, "allowed">;
  readonly createdAt: string;
}

export interface DispatcherRunSummaryRecord {
  readonly runId: string;
  readonly membershipRevision: number;
  readonly expectedMemberCount: number;
  readonly claimedCount: number;
  readonly alreadyClaimedCount: number;
  readonly ineligibleCount: number;
  readonly authorizationDeniedCount: number;
  readonly policyDeferredCount: number;
  readonly resourceDeferredCount: number;
  readonly reconciliationRequiredCount: number;
  readonly failedCount: number;
  readonly terminalStatus: Extract<DispatcherRunStatus, "completed" | "partial" | "failed" | "interrupted">;
  readonly ownerRevision: number;
  readonly runRevision: number;
  readonly createdAt: string;
}

export type WorkspaceGenerationStatus =
  | "allocated"
  | "reserved"
  | "creating"
  | "ready"
  | "cleaning"
  | "recovery_required"
  | "cleaned";

export type WorkspaceOperationKind = WorkspacePortOperation;
export type WorkspaceIntentState = "pending" | "executing" | "observed" | "verified" | "finalized" | "ambiguous" | "failed";
export type WorkspaceExternalState = WorkspacePortExternalState;
export type WorkspaceOperationOutcome = "succeeded" | "refused" | "ambiguous" | "failed";

export interface WorkspaceGenerationRecord {
  readonly workspaceId: string;
  readonly generation: number;
  readonly revision: number;
  readonly status: WorkspaceGenerationStatus;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly runId: string;
  readonly runRevision: number;
  readonly memberId: string;
  readonly membershipRevision: number;
  readonly memberRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly workspaceRootKey: string;
  readonly creatorOperationId: string;
  readonly predecessorGeneration: number | null;
  readonly predecessorRevision: number | null;
  readonly baseReference: string;
  readonly contractId: "ato.workspace/v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceAuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly bindingRevision: number;
  readonly phase: "prepare" | "act" | "finalize";
  readonly actorId: string;
  readonly action: Extract<AuthorizationAction,
    "workspace.reserve" | "workspace.create" | "workspace.inspect" | "workspace.recover" | "workspace.cleanup">;
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly fencingToken: number;
  readonly workspaceId: string | null;
  readonly generation: number | null;
  readonly generationRevision: number | null;
  readonly createdAt: string;
}

export interface WorkspaceOperationIntentRecord {
  readonly intentId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly operationKind: WorkspaceOperationKind;
  readonly action: WorkspaceAuthorizationDecisionRecord["action"];
  readonly state: WorkspaceIntentState;
  readonly revision: number;
  readonly actorId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly currentAuthorizationDecisionId: string;
  readonly authorizationBindingRevision: number;
  readonly confirmationId: string | null;
  readonly workspaceId: string;
  readonly generation: number;
  readonly expectedGenerationRevision: number;
  readonly expectedGenerationStatus: WorkspaceGenerationStatus;
  readonly lastObservationNumber: number;
  readonly lastFailureCategory: WorkspacePortFailureCategory | null;
  readonly lastFailureCode: string | null;
  readonly lastFailureRetryable: boolean | null;
  readonly lastFailureAmbiguous: boolean | null;
  readonly contractId: "ato.workspace/v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceObservationRecord {
  readonly observationId: string;
  readonly intentId: string;
  readonly observationNumber: number;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly authorizationDecisionId: string;
  readonly externalState: WorkspaceExternalState;
  readonly outcome: Exclude<WorkspaceOperationOutcome, "failed">;
  readonly code: WorkspacePortReceiptCode;
  readonly pathSafety: "safe" | "unsafe" | "unknown";
  readonly ownershipMatch: boolean | null;
  readonly trackedCount: number;
  readonly modifiedCount: number;
  readonly untrackedCount: number;
  readonly ignoredCount: number;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export interface WorkspaceVerifiedReceiptRecord {
  readonly verifiedReceiptId: string;
  readonly intentId: string;
  readonly observationId: string;
  readonly observationNumber: number;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly generationRevision: number;
  readonly externalState: WorkspaceExternalState;
  readonly outcome: "succeeded" | "refused";
  readonly code: WorkspacePortReceiptCode;
  readonly verifiedAt: string;
}

export interface WorkspaceFinalizationRecord {
  readonly finalizationId: string;
  readonly intentId: string;
  readonly verifiedReceiptId: string | null;
  readonly authorizationDecisionId: string;
  readonly outcome: WorkspaceOperationOutcome;
  readonly code: string;
  readonly resultingGenerationStatus: WorkspaceGenerationStatus;
  readonly resultingGenerationRevision: number;
  readonly finalizedAt: string;
}

export const WORKSPACE_EVENT_KINDS = Object.freeze([
  "workspace.operation.prepared",
  "workspace.operation.denied",
  "workspace.operation.executing",
  "workspace.operation.observed",
  "workspace.operation.verified",
  "workspace.operation.finalized",
  "workspace.operation.reconciled",
] as const);

export type WorkspaceEventKind = (typeof WORKSPACE_EVENT_KINDS)[number];

export interface WorkspaceEventRecord {
  readonly eventId: string;
  readonly operationId: string;
  readonly intentId: string | null;
  readonly eventKind: WorkspaceEventKind;
  readonly outcome: "accepted" | "denied" | "refused" | "ambiguous" | "failed";
  readonly reasonCode: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly workspaceId: string | null;
  readonly generation: number | null;
  readonly generationRevision: number | null;
  readonly observationNumber: number | null;
  readonly evidenceReference: string | null;
  readonly createdAt: string;
}

export interface ApplicationState {
  readonly domain: DomainSnapshot;
  readonly projects: readonly RegisteredProject[];
  readonly bootstrap: AuthorizationBootstrap | null;
  readonly identity: AuthorizationLocalIdentity | null;
  readonly grants: readonly AuthorizationGrant[];
  readonly epochs: readonly AuthorizationCapabilityEpoch[];
  readonly requests: readonly ApplicationRequestRecord[];
  readonly decisions: readonly AuthorizationDecisionRecord[];
  readonly audit: readonly ApplicationAuditRecord[];
  readonly executionSequences: readonly TaskExecutionSequence[];
  readonly executions: readonly ExecutionAttempt[];
  readonly executionOperationRequests: readonly ExecutionOperationRequestRecord[];
  readonly executionAuthorizationDecisions: readonly ExecutionAuthorizationDecisionRecord[];
  readonly executionOperationAudit: readonly ExecutionOperationAuditRecord[];
  readonly executionIntents: readonly ExecutionOperationIntent[];
  readonly executionIntentAuthorizationBindings: readonly ExecutionIntentAuthorizationBindingRecord[];
  readonly executionObservations: readonly ExecutionObservationRecord[];
  readonly executionReceipts: readonly ExecutionVerifiedReceiptRecord[];
  readonly executionFinalizations: readonly ExecutionFinalizationRecord[];
  readonly executionTerminalStates: readonly ExecutionTerminalStateRecord[];
  readonly manualTurns: readonly ManualBackendTurnRecord[];
  readonly manualBackendOperations: readonly ManualBackendOperationRecord[];
  readonly manualCompletionDecisions: readonly ManualCompletionDecisionRecord[];
  readonly dispatcherTriggerRequests: readonly DispatcherTriggerRequestRecord[];
  readonly dispatcherAuthorizationDecisions: readonly DispatcherAuthorizationDecisionRecord[];
  readonly dispatcherRuns: readonly DispatcherRunRecord[];
  readonly dispatcherAudit: readonly DispatcherAuditRecord[];
  readonly dispatcherReconciliationItems: readonly DispatcherReconciliationItemRecord[];
  readonly dispatcherReconciliationSummaries: readonly DispatcherReconciliationSummaryRecord[];
  readonly dispatcherMemberships: readonly DispatcherMembershipRecord[];
  readonly dispatcherMembers: readonly DispatcherMemberRecord[];
  readonly dispatcherMemberDenialRequests: readonly DispatcherMemberDenialRequestRecord[];
  readonly dispatcherMemberDenialDecisions: readonly DispatcherMemberDenialDecisionRecord[];
  readonly dispatcherMemberDenialAudit: readonly DispatcherMemberDenialAuditRecord[];
  readonly dispatcherRunSummaries: readonly DispatcherRunSummaryRecord[];
  readonly workspaceGenerations: readonly WorkspaceGenerationRecord[];
  readonly workspaceAuthorizationDecisions: readonly WorkspaceAuthorizationDecisionRecord[];
  readonly workspaceIntents: readonly WorkspaceOperationIntentRecord[];
  readonly workspaceObservations: readonly WorkspaceObservationRecord[];
  readonly workspaceReceipts: readonly WorkspaceVerifiedReceiptRecord[];
  readonly workspaceFinalizations: readonly WorkspaceFinalizationRecord[];
  readonly workspaceEvents: readonly WorkspaceEventRecord[];
  readonly lifecycle: readonly ApplicationLifecycleAuthorization[];
}

export interface NewGrantRecord extends AuthorizationGrant {
  readonly createdRequestId: string;
  readonly capabilityEpochId?: string | null;
}

export type NewLocalIdentityRecord = AuthorizationLocalIdentity;
export type NewCapabilityEpochRecord = AuthorizationCapabilityEpoch;
export type NewLifecycleAuthorizationRecord = ApplicationLifecycleAuthorization;
export type NewExecutionAttemptRecord = ExecutionAttempt;

export function applicationAuditKind(value: AuthorizationAction): ApplicationAuditRecord["eventKind"] {
  switch (value) {
    case "authorization.grant.issue": return "grant.issued";
    case "authorization.grant.inspect": return "grant.inspected";
    case "authorization.grant.revoke": return "grant.revoked";
    case "policy.evaluate": return "policy.evaluated";
    case "project.register": return "project.registered";
    case "project.update": return "project.updated";
    case "project.disable": return "project.disabled";
    case "project.inspect": return "project.inspected";
    case "task.create": return "task.created";
    case "task.update": return "task.updated";
    case "task.mark_ready": return "task.ready";
    case "task.cancel": return "task.cancelled";
    case "task.inspect": return "task.inspected";
    case "dependency.add": return "dependency.added";
    case "dependency.remove": return "dependency.removed";
    case "authorization.grant.list": return "grant.listed";
    case "runtime.status": return "runtime.status.inspected";
    case "runtime.backup": return "backup.authorized";
    case "runtime.restore": return "restore.authorized";
    case "execution.claim": return "execution.claimed";
    case "execution.claim.inspect": return "execution.claim.inspected";
    case "execution.lease.renew": return "execution.lease.renewed";
    case "execution.lease.takeover": return "execution.lease.taken_over";
    default: throw new TypeError("Manual execution actions use the execution-operation audit owner");
  }
}
