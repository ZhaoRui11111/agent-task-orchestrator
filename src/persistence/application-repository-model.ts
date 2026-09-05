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
import type {
  SchedulerExternalState,
  SchedulerFailureCategory,
  SchedulerReceiptCode,
  SchedulerReceiptOutcome,
} from "../scheduler-port.ts";

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
    | "completion.gate.ran"
    | "completion.gate.inspected"
    | "completion.gate.cancelled"
    | "completion.accepted"
    | "integration.reserved"
    | "integration.inspected"
    | "integration.lease.renewed"
    | "integration.lease.taken_over"
    | "integration.applied"
    | "integration.pushed"
    | "integration.recovered"
    | "integration.released"
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
  readonly contractId: "ato.execution/v2";
  readonly backendKind: "manual-local" | "codex-sdk";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly policyBindingReference: string;
  readonly workspaceMode: "none" | "owned";
  readonly workspaceContractId: "ato.workspace/v2" | null;
  readonly workspaceId: string | null;
  readonly workspaceGeneration: number | null;
  readonly workspaceRevision: number | null;
  readonly workspaceRootKey: string | null;
  readonly ownershipBindingSha256: string | null;
  readonly workspaceHeadObjectId: string | null;
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

export type CodexTurnLifecycle = "unknown" | "active" | "turn_succeeded" | "failed";
export type CodexTurnTerminalSignal = "turn.completed" | "turn.failed";

export interface CodexBackendTurnRecord {
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly startIdempotencyKey: string;
  readonly originIntentId: string;
  readonly originOperationId: string;
  readonly originAuthorizationDecisionId: string;
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
  readonly workspaceContractId: "ato.workspace/v2";
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly workspaceRevision: number;
  readonly workspaceRootKey: string;
  readonly ownershipBindingSha256: string;
  readonly workspaceHeadObjectId: string;
  readonly lifecycle: CodexTurnLifecycle;
  readonly terminalSignal: CodexTurnTerminalSignal | null;
  readonly cancellationRequestedAt: string | null;
  readonly code: string;
  readonly evidenceReference: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CodexBackendOperationRecord {
  readonly backendOperationId: string;
  readonly idempotencyKey: string;
  readonly intentId: string;
  readonly authorizationDecisionId: string;
  readonly operationKind: "start" | "resume" | "retry";
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly sourceBackendExecutionId: string | null;
  readonly sourceThreadId: string | null;
  readonly expectedFencingToken: number;
  readonly expectedPreRevision: number | null;
  readonly postRevision: number;
  readonly resultLifecycle: Extract<CodexTurnLifecycle, "turn_succeeded" | "failed">;
  readonly terminalSignal: CodexTurnTerminalSignal;
  readonly receiptId: string;
  readonly receiptSha256: string;
  readonly createdAt: string;
}

export interface CompletionDecisionRecord {
  readonly completionDecisionId: string;
  readonly kind: "manual" | "policy_gated";
  readonly taskId: string;
  readonly executionId: string;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly preTaskRevision: number;
  readonly postTaskRevision: number;
  readonly executionRevision: number;
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

export type CodexProfileStatus = "active" | "deactivated";

export interface CodexProfileRecord {
  readonly profileId: string;
  readonly projectId: string;
  readonly creatorOperationId: string;
  readonly actorId: string;
  readonly revision: number;
  readonly status: CodexProfileStatus;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly destination: "openai-codex-api";
  readonly credentialReference: "process-env:CODEX_API_KEY";
  readonly workspaceRoot: string;
  readonly workspaceRootKey: string;
  readonly workspacePlatform: string;
  readonly workspaceDevice: string;
  readonly workspaceInode: string;
  readonly workspaceMode: number;
  readonly codexHome: string;
  readonly codexHomeKey: string;
  readonly codexHomePlatform: string;
  readonly codexHomeDevice: string;
  readonly codexHomeInode: string;
  readonly codexHomeMode: number;
  readonly gitExecutable: string;
  readonly gitExecutableKey: string;
  readonly gitExecutablePlatform: string;
  readonly gitExecutableDevice: string;
  readonly gitExecutableInode: string;
  readonly gitExecutableMode: number;
  readonly constructorConfigSha256: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CodexProfileOperationRecord {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly confirmationId: string | null;
  readonly actorId: string;
  readonly action: "codex.profile.activate" | "codex.profile.deactivate";
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly profileId: string;
  readonly expectedProfileRevision: number;
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly configurationSha256: string | null;
  readonly resultingProfileRevision: number | null;
  readonly resultingStatus: CodexProfileStatus | null;
  readonly createdAt: string;
}

export type CodexProductCommandKind = "codex.dispatch-run" | "execution.resume" | "execution.retry";
export type CodexProductStage =
  | "prepared" | "member_bound" | "workspace_ready" | "intent_prepared"
  | "effect_possible" | "effect_terminal" | "workspace_refreshed";
export type CodexProductLifecycle = "active" | "finalized" | "refused" | "recovery_required";

export interface CodexProductOperationRecord {
  readonly operationId: string;
  readonly publicIdempotencyKey: string;
  readonly commandKind: CodexProductCommandKind;
  readonly commandJson: string;
  readonly commandSha256: string;
  readonly actorId: string;
  readonly profileId: string;
  readonly profileRevision: number;
  readonly constructorConfigSha256: string;
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly baseReference: string | null;
  readonly leaseDurationSeconds: number | null;
  readonly sourceExecutionId: string | null;
  readonly sourceExecutionRevision: number | null;
  readonly sourceAttemptNumber: number | null;
  readonly sourceFencingToken: number | null;
  readonly sourceBackendExecutionId: string | null;
  readonly sourceThreadId: string | null;
  readonly sourceObservationNumber: number | null;
  readonly sourceVerifiedReceiptId: string | null;
  readonly sourceWorkspaceId: string | null;
  readonly sourceWorkspaceGeneration: number | null;
  readonly sourceWorkspaceRevision: number | null;
  readonly sourceWorkspaceRootKey: string | null;
  readonly sourceWorkspaceOwnershipBindingSha256: string | null;
  readonly sourceWorkspaceHeadObjectId: string | null;
  readonly sourceWorkspaceVerifiedReceiptId: string | null;
  readonly continuationReference: string | null;
  readonly requiredActionReceiptId: string | null;
  readonly runId: string;
  readonly memberId: string;
  readonly executionId: string;
  readonly workspaceId: string;
  readonly intentId: string;
  readonly stage: CodexProductStage;
  readonly lifecycle: CodexProductLifecycle;
  readonly revision: number;
  readonly workspaceGeneration: number | null;
  readonly workspaceRevision: number | null;
  readonly workspaceHeadObjectId: string | null;
  readonly resultCode: string | null;
  readonly resultJson: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CodexEffectAuthorizationRecord {
  readonly authorizationId: string;
  readonly productOperationId: string;
  readonly phase: "prepare" | "act";
  readonly bindingRevision: number;
  readonly requestId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly confirmationId: string | null;
  readonly actorId: string;
  readonly action: "codex.execution.invoke";
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly requiredGrantSetVersion: 1;
  readonly requiredGrantSetJson: string;
  readonly requiredGrantSetSha256: string;
  readonly coreAuthorizationDecisionId: string | null;
  readonly coreAuthorizationBindingRevision: number | null;
  readonly profileId: string;
  readonly profileRevision: number;
  readonly constructorConfigSha256: string;
  readonly runId: string;
  readonly memberId: string;
  readonly executionId: string;
  readonly intentId: string | null;
  readonly workspaceId: string;
  readonly workspaceGeneration: number | null;
  readonly workspaceRevision: number | null;
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
export type DispatcherRouteKind = "manual" | "scheduled" | "codex-start" | "codex-continuation";

export interface DispatcherRunRecord {
  readonly runId: string;
  readonly observationId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly actorId: string;
  readonly routeKind: DispatcherRouteKind;
  readonly productOperationId: string | null;
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
  "claimed_for_codex",
  "codex_profile_inactive", "codex_product_stale", "codex_source_not_ready",
  "execution_continuation_denied", "execution_takeover_denied",
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
  readonly productOperationId: string | null;
  readonly ownerKind: "execution-start-intent" | "codex-product-operation" | null;
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

export interface ProjectPolicyReceiptRecord {
  readonly receiptId: string;
  readonly policyQueryId: string;
  readonly operation: "evaluate_mutation" | "completion_requirements" | "evaluate_integration" | "evaluate_cleanup";
  readonly preliminaryAuthorizationDecisionId: string;
  readonly requestedAction: string;
  readonly actorId: string;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly repositoryIdentity: string;
  readonly subjectSha256: string;
  readonly policyId: string;
  readonly policyKey: string;
  readonly policyConfigRevision: number;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly decision: "allow" | "deny" | "defer";
  readonly reasonCode: string;
  readonly factsJson: string;
  readonly factsSha256: string;
  readonly receiptSha256: string;
  readonly validUntil: string | null;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export type CompletionGateOperationKind = "run_gate" | "inspect_gate" | "cancel_gate";
export type CompletionGateIntentState = "pending" | "executing" | "observed" | "verified" | "finalized" | "ambiguous" | "failed";

export interface CompletionGateRequestRecord {
  readonly requestId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly operationKind: CompletionGateOperationKind;
  readonly actorId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly repositoryIdentity: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly workspaceId: string;
  readonly generation: number;
  readonly workspaceRevision: number;
  readonly workspaceRootKey: string;
  readonly ownershipBindingSha256: string;
  readonly headObjectId: string;
  readonly policyReceiptId: string;
  readonly policyId: string;
  readonly policyConfigRevision: number;
  readonly gateId: string;
  readonly gateVersion: string;
  readonly commandKey: string;
  readonly commandIdentitySha256: string;
  readonly completionEvidenceRootKey: string;
  readonly toolEnvironmentSha256: string;
  readonly contractId: "ato.completion/v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly timeoutMs: number | null;
  readonly createdAt: string;
}

export interface CompletionGateAuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly bindingRevision: number;
  readonly phase: "prepare" | "act" | "finalize";
  readonly actorId: string;
  readonly action: Extract<AuthorizationAction, "completion.gate.run" | "completion.gate.inspect" | "completion.gate.cancel">;
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly confirmationId: string | null;
  readonly createdAt: string;
}

export interface CompletionGateIntentRecord {
  readonly intentId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly operationKind: CompletionGateOperationKind;
  readonly state: CompletionGateIntentState;
  readonly revision: number;
  readonly currentAuthorizationDecisionId: string;
  readonly authorizationBindingRevision: number;
  readonly gateOperationId: string;
  readonly lastObservationNumber: number;
  readonly lastFailureCategory: string | null;
  readonly lastFailureCode: string | null;
  readonly lastFailureRetryable: boolean | null;
  readonly lastFailureAmbiguous: boolean | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CompletionGateObservationRecord {
  readonly observationId: string;
  readonly intentId: string;
  readonly observationNumber: number;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly authorizationDecisionId: string;
  readonly gateOperationId: string;
  readonly lifecycle: "running" | "completed" | "cancel_requested" | "cancelled" | "unknown";
  readonly verdict: "pass" | "fail" | "indeterminate";
  readonly code: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly validUntil: string | null;
  readonly evidenceReference: string;
  readonly observedAt: string;
}

export interface CompletionGateVerifiedReceiptRecord {
  readonly verifiedReceiptId: string;
  readonly intentId: string;
  readonly observationId: string;
  readonly observationNumber: number;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly gateOperationId: string;
  readonly verdict: "pass" | "fail";
  readonly validUntil: string | null;
  readonly verifiedAt: string;
}

export interface CompletionGateFinalizationRecord {
  readonly finalizationId: string;
  readonly intentId: string;
  readonly verifiedReceiptId: string | null;
  readonly authorizationDecisionId: string;
  readonly outcome: "accepted" | "refused" | "ambiguous" | "failed";
  readonly code: string;
  readonly finalizedAt: string;
}

export interface CompletionGateEventRecord {
  readonly eventId: string;
  readonly operationId: string;
  readonly intentId: string | null;
  readonly eventKind: "completion.gate.prepared" | "completion.gate.denied" | "completion.gate.executing" |
    "completion.gate.observed" | "completion.gate.verified" | "completion.gate.finalized" | "completion.gate.reconciled";
  readonly outcome: "accepted" | "denied" | "refused" | "ambiguous" | "failed";
  readonly reasonCode: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly observationNumber: number | null;
  readonly evidenceReference: string | null;
  readonly createdAt: string;
}

export interface PolicyGatedCompletionDecisionRecord {
  readonly completionDecisionId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly executionSuccessVerifiedReceiptId: string;
  readonly executionSuccessFinalizationId: string;
  readonly policyReceiptId: string;
  readonly gateSetSha256: string;
  readonly workspaceEvidenceSha256: string;
  readonly headObjectId: string;
  readonly integrationEvidenceSha256: string;
  readonly preservationStateSha256: string;
  readonly requestId: string;
  readonly authorizationDecisionId: string;
  readonly auditId: string;
  readonly confirmationId: string;
  readonly createdAt: string;
}

export type IntegrationReservationStatus = "active" | "ambiguous" | "released" | "expired";
export type IntegrationIntentState = "pending" | "executing" | "observed" | "verified" | "finalized" | "ambiguous" | "failed";
export type IntegrationOperationKind = "apply" | "push";

export interface IntegrationTargetSequenceRecord {
  readonly projectId: string;
  readonly repositoryIdentity: string;
  readonly targetReference: string;
  readonly lastFencingToken: number;
}

export interface IntegrationReservationRecord {
  readonly reservationId: string;
  readonly revision: number;
  readonly status: IntegrationReservationStatus;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly repositoryIdentity: string;
  readonly objectFormat: "sha1";
  readonly targetReference: string;
  readonly expectedTargetObjectId: string;
  readonly sourceWorkspaceId: string;
  readonly sourceGeneration: number;
  readonly sourceWorkspaceRevision: number;
  readonly sourceWorkspaceRootKey: string;
  readonly sourceOwnershipBindingSha256: string;
  readonly sourceHeadObjectId: string;
  readonly ownerExecutionId: string;
  readonly ownerOperationId: string;
  readonly leaseOwnerId: string;
  readonly leaseRevision: number;
  readonly fencingToken: number;
  readonly expiresAt: string;
  readonly policyReceiptId: string;
  readonly policyConfigRevision: number;
  readonly destinationIdentity: string;
  readonly destinationReference: string;
  readonly expectedRemoteHead: string | null;
  readonly currentEvidenceSha256: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IntegrationOperationRequestRecord {
  readonly requestId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly operationKind: IntegrationOperationKind;
  readonly actorId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly reservationId: string;
  readonly expectedReservationRevision: number;
  readonly expectedLeaseRevision: number;
  readonly expectedFencingToken: number;
  readonly contractId: "ato.integration/v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly createdAt: string;
}

export interface IntegrationAuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly bindingRevision: number;
  readonly phase: "prepare" | "act" | "finalize";
  readonly actorId: string;
  readonly action: Extract<AuthorizationAction, "integration.apply" | "integration.push">;
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly confirmationId: string | null;
  readonly createdAt: string;
}

export interface IntegrationIntentRecord {
  readonly intentId: string;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly reservationId: string;
  readonly reservationFencingToken: number;
  readonly operationKind: IntegrationOperationKind;
  readonly state: IntegrationIntentState;
  readonly revision: number;
  readonly currentAuthorizationDecisionId: string;
  readonly authorizationBindingRevision: number;
  readonly lastObservationNumber: number;
  readonly recoveryResult: "recovered_no_effect" | "recovered_local_applied" | "recovered_pushed" | "recovered_inconsistent" | null;
  readonly lastFailureCategory: string | null;
  readonly lastFailureCode: string | null;
  readonly lastFailureRetryable: boolean | null;
  readonly lastFailureAmbiguous: boolean | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IntegrationObservationRecord {
  readonly observationId: string;
  readonly reservationId: string;
  readonly intentId: string | null;
  readonly observationNumber: number;
  readonly operation: "inspect" | "apply" | "push";
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly authorizationDecisionId: string;
  readonly localBeforeObjectId: string | null;
  readonly localAfterObjectId: string | null;
  readonly remoteBeforeObjectId: string | null;
  readonly remoteAfterObjectId: string | null;
  readonly localState: "unchanged" | "fast_forwarded" | "already_at_source" | "foreign" | "unknown";
  readonly remoteState: "not_requested" | "absent" | "unchanged" | "pushed" | "already_at_source" | "rejected" | "foreign" | "unknown";
  readonly outcome: "succeeded" | "refused" | "ambiguous";
  readonly code: string;
  readonly evidenceReference: string;
  readonly observedAt: string;
}

export interface IntegrationVerifiedReceiptRecord {
  readonly verifiedReceiptId: string;
  readonly intentId: string;
  readonly observationId: string;
  readonly observationNumber: number;
  readonly adapterReceiptId: string;
  readonly receiptSha256: string;
  readonly outcome: "succeeded" | "refused";
  readonly code: string;
  readonly verifiedAt: string;
}

export interface IntegrationFinalizationRecord {
  readonly finalizationId: string;
  readonly intentId: string;
  readonly verifiedReceiptId: string | null;
  readonly authorizationDecisionId: string;
  readonly outcome: "succeeded" | "refused" | "ambiguous" | "failed";
  readonly code: string;
  readonly recoveryResult: IntegrationIntentRecord["recoveryResult"];
  readonly finalizedAt: string;
}

export interface IntegrationEventRecord {
  readonly eventId: string;
  readonly reservationId: string;
  readonly operationId: string;
  readonly intentId: string | null;
  readonly eventKind: "integration.reserved" | "integration.renewed" | "integration.taken_over" |
    "integration.released" | "integration.expired" | "integration.ambiguous" | "integration.operation.prepared" |
    "integration.operation.denied" | "integration.operation.executing" | "integration.operation.observed" |
    "integration.operation.verified" | "integration.operation.finalized" | "integration.operation.reconciled";
  readonly outcome: "accepted" | "denied" | "refused" | "ambiguous" | "failed";
  readonly reasonCode: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly observationNumber: number | null;
  readonly evidenceReference: string | null;
  readonly createdAt: string;
}

export interface WorkspaceCleanupAttestationRecord {
  readonly attestationId: string;
  readonly operationId: string;
  readonly intentId: string;
  readonly projectId: string;
  readonly taskId: string;
  readonly executionId: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly attestationJson: string;
  readonly attestationSha256: string;
  readonly quiescenceSha256: string;
  readonly issuedAt: string;
  readonly validUntil: string;
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
  readonly contractId: "ato.workspace/v2";
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
  readonly contractId: "ato.workspace/v2";
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
  readonly repositoryIdentity: string | null;
  readonly branchReference: string | null;
  readonly headObjectId: string | null;
  readonly ownershipBindingSha256: string;
  readonly evidenceReference: string | null;
  readonly cleanupAttestationSha256: string | null;
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
  readonly repositoryIdentity: string | null;
  readonly branchReference: string | null;
  readonly headObjectId: string | null;
  readonly ownershipBindingSha256: string;
  readonly cleanupAttestationSha256: string | null;
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

export type SchedulerRegistrationStatus = "pending_register" | "active" | "pending_remove" | "removed" | "ambiguous";
export type SchedulerIntentState = "pending" | "executing" | "observed" | "verified" | "finalized" | "ambiguous" | "failed";

export interface SchedulerConfigurationRecord {
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly scopeKind: "runtime" | "project";
  readonly projectId: string | null;
  readonly projectResourceRevision: number | null;
  readonly projectConfigRevision: number | null;
  readonly scheduleExpression: string;
  readonly timeZone: string;
  readonly dispatcherTarget: string;
  readonly configSha256: string;
  readonly createdByOperationId: string;
  readonly createdAt: string;
}

export interface SchedulerRegistrationRecord {
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly revision: number;
  readonly status: SchedulerRegistrationStatus;
  readonly externalRegistrationId: string | null;
  readonly enabled: boolean | null;
  readonly nextTriggerAt: string | null;
  readonly lastIntentId: string;
  readonly updatedAt: string;
}

export interface SchedulerOperationRequestRecord {
  readonly requestId: string;
  readonly operationId: string;
  readonly idempotencyKey: string | null;
  readonly commandSha256: string;
  readonly operation: "register" | "inspect" | "remove";
  readonly actorId: string;
  readonly correlationId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly externalRegistrationId: string | null;
  readonly scopeKind: "runtime" | "project";
  readonly projectId: string | null;
  readonly projectResourceRevision: number | null;
  readonly projectConfigRevision: number | null;
  readonly result: "allow" | "deny";
  readonly createdAt: string;
}

export interface SchedulerAuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly stage: "prepare" | "act" | "inspect";
  readonly actorId: string;
  readonly action: Extract<AuthorizationAction, "scheduler.register" | "scheduler.inspect" | "scheduler.remove">;
  readonly result: "allow" | "deny";
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
  readonly projectId: string | null;
  readonly projectResourceRevision: number | null;
  readonly projectConfigRevision: number | null;
  readonly createdAt: string;
}

export interface SchedulerOperationIntentRecord {
  readonly intentId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly operation: "register" | "remove";
  readonly state: SchedulerIntentState;
  readonly contractId: "ato.scheduler/v1";
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly expectedRegistrationRevision: number;
  readonly operationDeadline: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SchedulerObservationRecord {
  readonly observationId: string;
  readonly requestId: string;
  readonly intentId: string | null;
  readonly observationNumber: number;
  readonly externalState: SchedulerExternalState;
  readonly externalRegistrationId: string | null;
  readonly enabled: boolean | null;
  readonly nextTriggerAt: string | null;
  readonly outcome: SchedulerReceiptOutcome;
  readonly code: SchedulerReceiptCode | SchedulerFailureCategory;
  readonly receiptId: string | null;
  readonly receiptSha256: string;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export interface SchedulerVerifiedReceiptRecord {
  readonly verifiedReceiptId: string;
  readonly intentId: string;
  readonly observationId: string;
  readonly receiptId: string;
  readonly receiptSha256: string;
  readonly externalState: SchedulerExternalState;
  readonly externalRegistrationId: string | null;
  readonly enabled: boolean | null;
  readonly nextTriggerAt: string | null;
  readonly code: SchedulerReceiptCode;
  readonly verifiedAt: string;
}

export interface SchedulerFinalizationRecord {
  readonly finalizationId: string;
  readonly intentId: string;
  readonly verifiedReceiptId: string | null;
  readonly authorizationDecisionId: string;
  readonly outcome: "registered" | "removed" | "refused" | "ambiguous" | "failed";
  readonly code: string;
  readonly resultingRegistrationStatus: SchedulerRegistrationStatus;
  readonly resultingRegistrationRevision: number;
  readonly finalizedAt: string;
}

export interface SchedulerEventRecord {
  readonly eventId: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly intentId: string | null;
  readonly eventKind:
    | "scheduler.operation.prepared"
    | "scheduler.operation.denied"
    | "scheduler.operation.executing"
    | "scheduler.operation.observed"
    | "scheduler.operation.verified"
    | "scheduler.operation.finalized"
    | "scheduler.operation.reconciled"
    | "scheduler.inspected";
  readonly outcome: "accepted" | "denied" | "refused" | "ambiguous" | "failed";
  readonly reasonCode: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly observationNumber: number | null;
  readonly evidenceReference: string | null;
  readonly createdAt: string;
}

export type SchedulerDeliveryDisposition = "accepted" | "authorization_denied" | "rejected_stale_config" | "malformed";
export type SchedulerDeliveryAttachmentRole = "canonical" | "duplicate" | "none";

export interface SchedulerDeliveryObservationRecord {
  readonly observationId: string;
  readonly requestId: string | null;
  readonly decisionId: string | null;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly dispatcherTarget: string;
  readonly contractId: "ato.scheduler/v1";
  readonly triggerIdSha256: string | null;
  readonly claimedDeduplicationSha256: string | null;
  readonly scheduleId: string | null;
  readonly configRevision: number | null;
  readonly scheduledFor: string | null;
  readonly deliveredAt: string | null;
  readonly receivedAt: string;
  readonly disposition: SchedulerDeliveryDisposition;
  readonly attachmentRole: SchedulerDeliveryAttachmentRole;
  readonly runId: string | null;
}

export interface SchedulerScheduledTupleRecord {
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly scheduledFor: string;
  readonly canonicalObservationId: string;
  readonly runId: string;
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
  readonly codexTurns: readonly CodexBackendTurnRecord[];
  readonly codexBackendOperations: readonly CodexBackendOperationRecord[];
  readonly completionDecisions: readonly CompletionDecisionRecord[];
  readonly manualCompletionDecisions: readonly ManualCompletionDecisionRecord[];
  readonly codexProfiles: readonly CodexProfileRecord[];
  readonly codexProfileOperations: readonly CodexProfileOperationRecord[];
  readonly codexProductOperations: readonly CodexProductOperationRecord[];
  readonly codexEffectAuthorizations: readonly CodexEffectAuthorizationRecord[];
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
  readonly projectPolicyReceipts: readonly ProjectPolicyReceiptRecord[];
  readonly completionGateRequests: readonly CompletionGateRequestRecord[];
  readonly completionGateAuthorizationDecisions: readonly CompletionGateAuthorizationDecisionRecord[];
  readonly completionGateIntents: readonly CompletionGateIntentRecord[];
  readonly completionGateObservations: readonly CompletionGateObservationRecord[];
  readonly completionGateReceipts: readonly CompletionGateVerifiedReceiptRecord[];
  readonly completionGateFinalizations: readonly CompletionGateFinalizationRecord[];
  readonly completionGateEvents: readonly CompletionGateEventRecord[];
  readonly policyGatedCompletionDecisions: readonly PolicyGatedCompletionDecisionRecord[];
  readonly integrationTargetSequences: readonly IntegrationTargetSequenceRecord[];
  readonly integrationReservations: readonly IntegrationReservationRecord[];
  readonly integrationOperationRequests: readonly IntegrationOperationRequestRecord[];
  readonly integrationAuthorizationDecisions: readonly IntegrationAuthorizationDecisionRecord[];
  readonly integrationIntents: readonly IntegrationIntentRecord[];
  readonly integrationObservations: readonly IntegrationObservationRecord[];
  readonly integrationReceipts: readonly IntegrationVerifiedReceiptRecord[];
  readonly integrationFinalizations: readonly IntegrationFinalizationRecord[];
  readonly integrationEvents: readonly IntegrationEventRecord[];
  readonly workspaceGenerations: readonly WorkspaceGenerationRecord[];
  readonly workspaceAuthorizationDecisions: readonly WorkspaceAuthorizationDecisionRecord[];
  readonly workspaceIntents: readonly WorkspaceOperationIntentRecord[];
  readonly workspaceObservations: readonly WorkspaceObservationRecord[];
  readonly workspaceReceipts: readonly WorkspaceVerifiedReceiptRecord[];
  readonly workspaceFinalizations: readonly WorkspaceFinalizationRecord[];
  readonly workspaceEvents: readonly WorkspaceEventRecord[];
  readonly workspaceCleanupAttestations: readonly WorkspaceCleanupAttestationRecord[];
  readonly schedulerConfigurations: readonly SchedulerConfigurationRecord[];
  readonly schedulerRegistrations: readonly SchedulerRegistrationRecord[];
  readonly schedulerOperationRequests: readonly SchedulerOperationRequestRecord[];
  readonly schedulerAuthorizationDecisions: readonly SchedulerAuthorizationDecisionRecord[];
  readonly schedulerIntents: readonly SchedulerOperationIntentRecord[];
  readonly schedulerObservations: readonly SchedulerObservationRecord[];
  readonly schedulerReceipts: readonly SchedulerVerifiedReceiptRecord[];
  readonly schedulerFinalizations: readonly SchedulerFinalizationRecord[];
  readonly schedulerEvents: readonly SchedulerEventRecord[];
  readonly schedulerDeliveryObservations: readonly SchedulerDeliveryObservationRecord[];
  readonly schedulerScheduledTuples: readonly SchedulerScheduledTupleRecord[];
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
    case "completion.gate.run": return "completion.gate.ran";
    case "completion.gate.inspect": return "completion.gate.inspected";
    case "completion.gate.cancel": return "completion.gate.cancelled";
    case "completion.accept": return "completion.accepted";
    case "integration.reserve": return "integration.reserved";
    case "integration.inspect": return "integration.inspected";
    case "integration.lease.renew": return "integration.lease.renewed";
    case "integration.lease.takeover": return "integration.lease.taken_over";
    case "integration.apply": return "integration.applied";
    case "integration.push": return "integration.pushed";
    case "integration.recover": return "integration.recovered";
    case "integration.release": return "integration.released";
    default: throw new TypeError("Manual execution and workspace actions use their dedicated audit owners");
  }
}
