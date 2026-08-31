import {
  AUTHORIZATION_ACTIONS,
  PHASE1_AUTHORIZATION_ACTIONS,
  PHASE2A_AUTHORIZATION_ACTIONS,
  PHASE2B_AUTHORIZATION_ACTIONS,
  isHighRiskAction,
  parseAuthorizationGrant,
  type AuthorizationAction,
  type AuthorizationGrant,
  type AuthorizationPolicyResult,
  type AuthorizationReason,
  type AuthorizationScope,
} from "../authorization.ts";
import type { DomainMutation, DomainSnapshot, ProjectDomainMutation } from "../domain.ts";
import type { ProjectRootIdentity } from "../project-registry.ts";
import {
  runReadSnapshot,
  runWriteTransaction,
  sqliteNullableText,
  sqliteText,
  type SqliteDatabase,
} from "./database.ts";
import { normalizeSqliteFailure, persistenceFailure } from "./errors.ts";
import { readDomainInitialized } from "./migrations.ts";
import {
  commitDomainMutation,
  initializeDomainSnapshot,
  readDomainSnapshotUntransactional,
  writeDomainMutationUntransactional,
  writeProjectMutationUntransactional,
} from "./repository.ts";
import { canonicalJson, exactRecord, isCanonicalUtcTimestamp, isNonemptyString, sha256 } from "./values.ts";

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
  readonly vocabularyVersion: 4;
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
  readonly vocabularyVersion: 4 | 5 | 6 | 7;
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

export interface AuthorizationGrantEpochLinkRecord {
  readonly grantId: string;
  readonly action: AuthorizationAction;
  readonly capabilityEpochId: string;
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

export interface ApplicationState {
  readonly domain: DomainSnapshot;
  readonly projects: readonly RegisteredProject[];
  readonly bootstrap: AuthorizationBootstrap | null;
  readonly identity: AuthorizationLocalIdentity | null;
  readonly grants: readonly AuthorizationGrant[];
  readonly epochs: readonly AuthorizationCapabilityEpoch[];
  readonly authorizationGrantEpochLinks: readonly AuthorizationGrantEpochLinkRecord[];
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

interface ApplicationDatabaseBinding {
  readonly database: SqliteDatabase;
  readonly assertOpen: () => void;
  readonly assertWriteAllowed: () => void;
}

type TargetKind = ApplicationRequestRecord["targetKind"];
type RequestResult = ApplicationRequestRecord["result"];
type DecisionResult = AuthorizationDecisionRecord["result"];
type AuditKind = ApplicationAuditRecord["eventKind"];
type AuditResult = ApplicationAuditRecord["result"];

interface ApplicationAuditDetails {
  readonly action: ApplicationAction;
  readonly reason: string;
  readonly targetKind: TargetKind;
  readonly targetRevision: number | null;
}

interface DecodedApplicationAudit {
  readonly record: ApplicationAuditRecord;
  readonly details: ApplicationAuditDetails;
}

const boundDatabases = new WeakMap<object, ApplicationDatabaseBinding>();
const TARGET_KINDS: ReadonlySet<TargetKind> = new Set(["runtime", "project", "task", "grant", "backup", "execution"]);
const REQUEST_RESULTS: ReadonlySet<RequestResult> = new Set(["bootstrap", "allow", "deny", "renewal", "upgrade"]);
const DECISION_RESULTS: ReadonlySet<DecisionResult> = new Set(["allow", "deny"]);
const POLICY_RESULTS: ReadonlySet<AuthorizationPolicyResult> = new Set(["allow", "deny", "read_not_applicable"]);
const AUTHORIZATION_REASONS: ReadonlySet<AuthorizationReason> = new Set([
  "allowed",
  "actor_mismatch",
  "action_mismatch",
  "scope_mismatch",
  "scope_revision_stale",
  "grant_expired",
  "grant_not_yet_valid",
  "grant_revoked",
  "grant_missing",
  "policy_denied",
  "confirmation_required",
]);
const AUDIT_KINDS: ReadonlySet<AuditKind> = new Set([
  "bootstrap",
  "grant.issued",
  "grant.revoked",
  "grant.inspected",
  "project.registered",
  "project.updated",
  "project.disabled",
  "project.inspected",
  "task.created",
  "task.updated",
  "task.ready",
  "task.cancelled",
  "task.inspected",
  "dependency.added",
  "dependency.removed",
  "policy.evaluated",
  "authorization.denied",
  "capability.renewed",
  "capability.upgraded",
  "execution.claimed",
  "execution.claim.inspected",
  "execution.lease.renewed",
  "execution.lease.taken_over",
  "grant.listed",
  "runtime.status.inspected",
  "backup.authorized",
  "restore.authorized",
]);
const AUDIT_RESULTS: ReadonlySet<AuditResult> = new Set(["accepted", "denied"]);
const SCOPE_KINDS: ReadonlySet<AuthorizationScope["kind"]> = new Set(["runtime", "project"]);
export function applicationAuditKind(value: AuthorizationAction): AuditKind {
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

function requestTargetIsValid(request: ApplicationRequestRecord): boolean {
  if (request.result === "bootstrap") {
    return request.action === "authorization.grant.issue" && request.targetKind === "runtime" &&
      request.targetId === "runtime" && request.targetRevision === null;
  }
  switch (request.action) {
    case "authorization.grant.issue":
      return request.targetKind === "grant" && request.targetRevision === null;
    case "authorization.grant.inspect":
    case "authorization.grant.revoke":
      return request.targetKind === "grant" && request.targetRevision !== null;
    case "project.register":
      return request.targetKind === "project" && request.targetRevision === null;
    case "project.update":
    case "project.disable":
    case "project.inspect":
    case "policy.evaluate":
      return request.targetKind === "project" && request.targetRevision !== null;
    case "task.create":
      return request.targetKind === "task" && request.targetRevision === null;
    case "task.update":
    case "task.mark_ready":
    case "task.cancel":
    case "task.inspect":
    case "dependency.add":
    case "dependency.remove":
      return request.targetKind === "task" && request.targetRevision !== null;
    case "authorization.grant.list":
    case "runtime.status":
    case "authorization.capability.renew":
    case "authorization.capability.upgrade":
      return request.targetKind === "runtime" && request.targetId === "runtime" && request.targetRevision === null;
    case "runtime.backup":
    case "runtime.restore":
      return request.targetKind === "backup" && request.targetRevision === null;
    case "execution.claim":
    case "execution.claim.inspect":
    case "execution.lease.renew":
    case "execution.lease.takeover":
      return request.targetKind === "execution" && request.targetRevision !== null;
    default:
      return false;
  }
}

function decisionPolicyIsValid(decision: AuthorizationDecisionRecord): boolean {
  if (
    decision.action === "authorization.capability.renew" ||
    decision.action === "authorization.capability.upgrade"
  ) return decision.policy === "allow";
  if (
    decision.action.startsWith("authorization.") ||
    decision.action.endsWith(".inspect") ||
    decision.action === "policy.evaluate" ||
    decision.action === "runtime.status" ||
    decision.action === "runtime.backup" ||
    decision.action === "runtime.restore"
  ) {
    return decision.policy === "read_not_applicable";
  }
  if (
    decision.action === "project.register" ||
    decision.action === "project.update" ||
    decision.action === "project.disable"
  ) {
    return decision.policy === "allow";
  }
  return decision.policy === "allow" || decision.policy === "deny";
}

function decisionTargetIsValid(
  request: ApplicationRequestRecord,
  decision: AuthorizationDecisionRecord,
): boolean {
  switch (request.action) {
    case "project.register":
      return decision.projectId === null;
    case "project.update":
    case "project.disable":
    case "project.inspect":
    case "policy.evaluate":
      return decision.projectId === request.targetId;
    case "task.create":
    case "task.update":
    case "task.mark_ready":
    case "task.cancel":
    case "task.inspect":
    case "dependency.add":
    case "dependency.remove":
    case "execution.claim":
    case "execution.claim.inspect":
    case "execution.lease.renew":
    case "execution.lease.takeover":
      return decision.projectId !== null;
    default:
      return true;
  }
}

function issuedGrantMatchesDecision(
  grant: AuthorizationGrant,
  decision: AuthorizationDecisionRecord | undefined,
): boolean {
  if (decision === undefined || decision.action !== "authorization.grant.issue" || decision.result !== "allow") {
    return false;
  }
  return grant.scope.kind === "runtime"
    ? decision.projectId === null && decision.resourceRevision === null
    : decision.projectId === grant.scope.projectId && decision.resourceRevision === grant.scope.resourceRevision;
}

function scopeContains(authority: AuthorizationScope, candidate: AuthorizationScope): boolean {
  if (authority.kind === "runtime") return true;
  return candidate.kind === "project" &&
    authority.projectId === candidate.projectId &&
    authority.resourceRevision === candidate.resourceRevision &&
    authority.configRevision === candidate.configRevision;
}

function grantWasUsableAt(grant: AuthorizationGrant, actorId: string, actionValue: AuthorizationAction, at: string): boolean {
  return grant.actorId === actorId &&
    grant.action === actionValue &&
    grant.notBefore <= at &&
    grant.expiresAt > at &&
    (grant.revokedAt === null || grant.revokedAt >= at);
}

function grantRevisionWasUsableAt(
  grant: AuthorizationGrant,
  actorId: string,
  actionValue: AuthorizationAction,
  at: string,
  grantRevision: number | null,
): boolean {
  if (grantRevision === null || !grantWasUsableAt(grant, actorId, actionValue, at)) return false;
  return (grant.revision === grantRevision && grant.revokedAt === null) ||
    (grant.revision === grantRevision + 1 && grant.revokedAt !== null && grant.revokedAt >= at);
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not a safe SQLite INTEGER`);
  }
  return value;
}

function positive(value: unknown, label: string): number {
  const result = integer(value, label);
  if (result <= 0) throw persistenceFailure("CORRUPT_ROW", `${label} is not positive`);
  return result;
}

function nullablePositive(value: unknown, label: string): number | null {
  return value === null ? null : positive(value, label);
}

function timestamp(value: unknown, label: string): string {
  const result = sqliteText(value, label);
  if (!isCanonicalUtcTimestamp(result)) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not canonical UTC`);
  }
  return result;
}

function action(value: unknown, label: string): ApplicationAction {
  const result = sqliteText(value, label);
  if (
    !(AUTHORIZATION_ACTIONS as readonly string[]).includes(result) &&
    result !== "authorization.capability.renew" &&
    result !== "authorization.capability.upgrade"
  ) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not an implemented action`);
  }
  return result as ApplicationAction;
}

function grantAction(value: unknown, label: string): AuthorizationAction {
  const result = action(value, label);
  if (result === "authorization.capability.renew" || result === "authorization.capability.upgrade") {
    throw persistenceFailure("CORRUPT_ROW", `${label} contains a non-grantable action`);
  }
  return result;
}

function enumText<T extends string>(value: unknown, label: string, allowed: ReadonlySet<T>): T {
  const result = sqliteText(value, label);
  if (!(allowed as ReadonlySet<string>).has(result)) throw persistenceFailure("CORRUPT_ROW", `${label} contains an unknown enum`);
  return result as T;
}

function nonnegative(value: unknown, label: string): number {
  const parsed = integer(value, label);
  if (parsed < 0) throw persistenceFailure("CORRUPT_ROW", `${label} must be nonnegative`);
  return parsed;
}

function readProjects(database: SqliteDatabase): readonly RegisteredProject[] {
  const rows = database.prepare(
    `SELECT project_id, canonical_root, root_key, platform, root_device, root_inode, root_mode,
      config_revision, resource_revision, created_at, updated_at
    FROM project_registry ORDER BY project_id`,
  ).all();
  return Object.freeze(rows.map((row) => Object.freeze({
    projectId: sqliteText(row.project_id, "project_registry.project_id"),
    canonicalRoot: sqliteText(row.canonical_root, "project_registry.canonical_root"),
    rootKey: sqliteText(row.root_key, "project_registry.root_key"),
    platform: sqliteText(row.platform, "project_registry.platform"),
    device: sqliteText(row.root_device, "project_registry.root_device"),
    inode: sqliteText(row.root_inode, "project_registry.root_inode"),
    mode: integer(row.root_mode, "project_registry.root_mode"),
    configRevision: positive(row.config_revision, "project_registry.config_revision"),
    resourceRevision: positive(row.resource_revision, "project_registry.resource_revision"),
    createdAt: timestamp(row.created_at, "project_registry.created_at"),
    updatedAt: timestamp(row.updated_at, "project_registry.updated_at"),
  })));
}

function readBootstrap(database: SqliteDatabase): AuthorizationBootstrap | null {
  const rows = database.prepare(
    `SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode,
      request_id, created_at, expires_at, vocabulary_version FROM authorization_bootstrap ORDER BY singleton`,
  ).all();
  if (rows.length === 0) return null;
  if (rows.length !== 1 || integer(rows[0]?.singleton, "authorization_bootstrap.singleton") !== 1) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization bootstrap singleton is invalid");
  }
  const row = rows[0] as Record<string, unknown>;
  const vocabularyVersion = integer(row.vocabulary_version, "authorization_bootstrap.vocabulary_version");
  if (vocabularyVersion !== 4) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization bootstrap vocabulary is unsupported");
  }
  return Object.freeze({
    actorId: sqliteText(row.actor_id, "authorization_bootstrap.actor_id"),
    trustedPrincipal: sqliteText(row.trusted_principal, "authorization_bootstrap.trusted_principal"),
    canonicalRoot: sqliteText(row.runtime_root, "authorization_bootstrap.runtime_root"),
    rootKey: sqliteText(row.runtime_root_key, "authorization_bootstrap.runtime_root_key"),
    platform: sqliteText(row.runtime_platform, "authorization_bootstrap.runtime_platform"),
    device: sqliteText(row.runtime_device, "authorization_bootstrap.runtime_device"),
    inode: sqliteText(row.runtime_inode, "authorization_bootstrap.runtime_inode"),
    mode: integer(row.runtime_mode, "authorization_bootstrap.runtime_mode"),
    requestId: sqliteText(row.request_id, "authorization_bootstrap.request_id"),
    createdAt: timestamp(row.created_at, "authorization_bootstrap.created_at"),
    expiresAt: timestamp(row.expires_at, "authorization_bootstrap.expires_at"),
    vocabularyVersion,
  });
}

function uppercaseSha256(value: unknown, label: string): string {
  const result = sqliteText(value, label);
  if (!/^[0-9A-F]{64}$/u.test(result)) throw persistenceFailure("CORRUPT_ROW", `${label} is not uppercase SHA-256`);
  return result;
}

function readIdentity(database: SqliteDatabase): AuthorizationLocalIdentity | null {
  const rows = database.prepare(
    `SELECT singleton, identity_version, actor_id, principal_sha256, platform,
      runtime_root_key, bootstrap_request_id, created_at
    FROM authorization_local_identity ORDER BY singleton`,
  ).all();
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  if (rows.length !== 1 || integer(row.singleton, "authorization_local_identity.singleton") !== 1 ||
      integer(row.identity_version, "authorization_local_identity.identity_version") !== 1) {
    throw persistenceFailure("CORRUPT_ROW", "Local authorization identity singleton is invalid");
  }
  return Object.freeze({
    identityVersion: 1,
    actorId: sqliteText(row.actor_id, "authorization_local_identity.actor_id"),
    principalSha256: uppercaseSha256(row.principal_sha256, "authorization_local_identity.principal_sha256"),
    platform: sqliteText(row.platform, "authorization_local_identity.platform"),
    runtimeRootKey: sqliteText(row.runtime_root_key, "authorization_local_identity.runtime_root_key"),
    bootstrapRequestId: sqliteText(row.bootstrap_request_id, "authorization_local_identity.bootstrap_request_id"),
    createdAt: timestamp(row.created_at, "authorization_local_identity.created_at"),
  });
}

function readEpochs(database: SqliteDatabase): readonly AuthorizationCapabilityEpoch[] {
  return Object.freeze(database.prepare(
    `SELECT epoch_id, epoch_revision, actor_id, runtime_root_key, vocabulary_version,
      action_set_sha256, request_id, created_at, expires_at
    FROM authorization_capability_epochs ORDER BY epoch_revision`,
  ).all().map((row) => {
    const vocabularyVersion = integer(row.vocabulary_version, "authorization_capability_epochs.vocabulary_version");
    if (vocabularyVersion !== 4 && vocabularyVersion !== 5 && vocabularyVersion !== 6 && vocabularyVersion !== 7) {
      throw persistenceFailure("CORRUPT_ROW", "Capability epoch vocabulary is unsupported");
    }
    return Object.freeze({
      epochId: sqliteText(row.epoch_id, "authorization_capability_epochs.epoch_id"),
      epochRevision: positive(row.epoch_revision, "authorization_capability_epochs.epoch_revision"),
      actorId: sqliteText(row.actor_id, "authorization_capability_epochs.actor_id"),
      runtimeRootKey: sqliteText(row.runtime_root_key, "authorization_capability_epochs.runtime_root_key"),
      vocabularyVersion,
      actionSetSha256: uppercaseSha256(row.action_set_sha256, "authorization_capability_epochs.action_set_sha256"),
      requestId: sqliteText(row.request_id, "authorization_capability_epochs.request_id"),
      createdAt: timestamp(row.created_at, "authorization_capability_epochs.created_at"),
      expiresAt: timestamp(row.expires_at, "authorization_capability_epochs.expires_at"),
    });
  }));
}

function readLifecycle(database: SqliteDatabase): readonly ApplicationLifecycleAuthorization[] {
  const operations = new Set(["runtime.backup", "runtime.restore"] as const);
  return Object.freeze(database.prepare(
    `SELECT authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
      grant_id, grant_revision, request_id, decision_id, audit_id, authorized_state_sha256,
      state_digest_version, expected_request_count, expected_decision_count, expected_audit_count,
      issued_at, expires_at
    FROM application_lifecycle_authorizations ORDER BY authorization_id`,
  ).all().map((row) => {
    const digestVersion = positive(
      row.state_digest_version,
      "application_lifecycle_authorizations.state_digest_version",
    );
    if (digestVersion !== 4) {
      throw persistenceFailure("CORRUPT_ROW", "Lifecycle state digest version is unsupported");
    }
    return Object.freeze({
      authorizationId: sqliteText(row.authorization_id, "application_lifecycle_authorizations.authorization_id"),
      operation: enumText(row.operation, "application_lifecycle_authorizations.operation", operations),
      backupGenerationId: sqliteText(row.backup_generation_id, "application_lifecycle_authorizations.backup_generation_id"),
      actorId: sqliteText(row.actor_id, "application_lifecycle_authorizations.actor_id"),
      runtimeRootKey: sqliteText(row.runtime_root_key, "application_lifecycle_authorizations.runtime_root_key"),
      grantId: sqliteText(row.grant_id, "application_lifecycle_authorizations.grant_id"),
      grantRevision: positive(row.grant_revision, "application_lifecycle_authorizations.grant_revision"),
      requestId: sqliteText(row.request_id, "application_lifecycle_authorizations.request_id"),
      decisionId: sqliteText(row.decision_id, "application_lifecycle_authorizations.decision_id"),
      auditId: sqliteText(row.audit_id, "application_lifecycle_authorizations.audit_id"),
      authorizedStateSha256: uppercaseSha256(row.authorized_state_sha256, "application_lifecycle_authorizations.authorized_state_sha256"),
      expectedRequestCount: positive(row.expected_request_count, "application_lifecycle_authorizations.expected_request_count"),
      expectedDecisionCount: positive(row.expected_decision_count, "application_lifecycle_authorizations.expected_decision_count"),
      expectedAuditCount: positive(row.expected_audit_count, "application_lifecycle_authorizations.expected_audit_count"),
      issuedAt: timestamp(row.issued_at, "application_lifecycle_authorizations.issued_at"),
      expiresAt: timestamp(row.expires_at, "application_lifecycle_authorizations.expires_at"),
    });
  }));
}

function readExecutionSequences(database: SqliteDatabase): readonly TaskExecutionSequence[] {
  return Object.freeze(database.prepare(
    `SELECT task_id, last_attempt_number, current_fencing_token, revision
    FROM task_execution_sequences ORDER BY task_id`,
  ).all().map((row) => Object.freeze({
    taskId: sqliteText(row.task_id, "task_execution_sequences.task_id"),
    lastAttemptNumber: positive(row.last_attempt_number, "task_execution_sequences.last_attempt_number"),
    currentFencingToken: positive(row.current_fencing_token, "task_execution_sequences.current_fencing_token"),
    revision: positive(row.revision, "task_execution_sequences.revision"),
  })));
}

function readExecutionAttempts(database: SqliteDatabase): readonly ExecutionAttempt[] {
  const operationKinds = new Set<ExecutionAttempt["operationKind"]>(["claim", "takeover"]);
  const statuses = new Set<ExecutionAttempt["status"]>(["active", "superseded"]);
  return Object.freeze(database.prepare(
    `SELECT execution_id, task_id, attempt_number, operation_kind, status, idempotency_key,
      owner_id, requested_lease_seconds, predecessor_execution_revision,
      predecessor_lease_revision, predecessor_fencing_token,
      lease_revision, lease_expires_at, fencing_token, revision,
      expected_task_revision, pre_task_revision, post_task_revision,
      project_resource_revision, project_config_revision, request_id, decision_id,
      supersedes_execution_id, superseded_by_execution_id, created_at, updated_at
    FROM execution_attempts ORDER BY task_id, attempt_number`,
  ).all().map((row) => Object.freeze({
    executionId: sqliteText(row.execution_id, "execution_attempts.execution_id"),
    taskId: sqliteText(row.task_id, "execution_attempts.task_id"),
    attemptNumber: positive(row.attempt_number, "execution_attempts.attempt_number"),
    operationKind: enumText(row.operation_kind, "execution_attempts.operation_kind", operationKinds),
    status: enumText(row.status, "execution_attempts.status", statuses),
    idempotencyKey: sqliteText(row.idempotency_key, "execution_attempts.idempotency_key"),
    ownerId: sqliteText(row.owner_id, "execution_attempts.owner_id"),
    requestedLeaseSeconds: positive(row.requested_lease_seconds, "execution_attempts.requested_lease_seconds"),
    predecessorExecutionRevision: nullablePositive(
      row.predecessor_execution_revision, "execution_attempts.predecessor_execution_revision",
    ),
    predecessorLeaseRevision: nullablePositive(
      row.predecessor_lease_revision, "execution_attempts.predecessor_lease_revision",
    ),
    predecessorFencingToken: nullablePositive(
      row.predecessor_fencing_token, "execution_attempts.predecessor_fencing_token",
    ),
    leaseRevision: positive(row.lease_revision, "execution_attempts.lease_revision"),
    leaseExpiresAt: timestamp(row.lease_expires_at, "execution_attempts.lease_expires_at"),
    fencingToken: positive(row.fencing_token, "execution_attempts.fencing_token"),
    revision: positive(row.revision, "execution_attempts.revision"),
    expectedTaskRevision: positive(row.expected_task_revision, "execution_attempts.expected_task_revision"),
    preTaskRevision: positive(row.pre_task_revision, "execution_attempts.pre_task_revision"),
    postTaskRevision: positive(row.post_task_revision, "execution_attempts.post_task_revision"),
    projectResourceRevision: positive(row.project_resource_revision, "execution_attempts.project_resource_revision"),
    projectConfigRevision: positive(row.project_config_revision, "execution_attempts.project_config_revision"),
    requestId: sqliteText(row.request_id, "execution_attempts.request_id"),
    decisionId: sqliteText(row.decision_id, "execution_attempts.decision_id"),
    supersedesExecutionId: sqliteNullableText(row.supersedes_execution_id, "execution_attempts.supersedes_execution_id"),
    supersededByExecutionId: sqliteNullableText(row.superseded_by_execution_id, "execution_attempts.superseded_by_execution_id"),
    createdAt: timestamp(row.created_at, "execution_attempts.created_at"),
    updatedAt: timestamp(row.updated_at, "execution_attempts.updated_at"),
  })));
}

function readExecutionOperationRequests(database: SqliteDatabase): readonly ExecutionOperationRequestRecord[] {
  const actions = new Set<ExecutionOperationRequestRecord["action"]>([
    "execution.start", "execution.inspect", "execution.resume", "execution.retry",
    "execution.cancel", "execution.completion.accept",
  ]);
  const results = new Set<ExecutionOperationRequestRecord["result"]>(["allow", "deny"]);
  return Object.freeze(database.prepare(
    `SELECT request_id, correlation_id, actor_id, action, target_execution_id,
      target_revision, result, created_at FROM execution_operation_requests ORDER BY request_id`,
  ).all().map((row) => Object.freeze({
    requestId: sqliteText(row.request_id, "execution_operation_requests.request_id"),
    correlationId: sqliteText(row.correlation_id, "execution_operation_requests.correlation_id"),
    actorId: sqliteText(row.actor_id, "execution_operation_requests.actor_id"),
    action: enumText(row.action, "execution_operation_requests.action", actions),
    targetExecutionId: sqliteText(row.target_execution_id, "execution_operation_requests.target_execution_id"),
    targetRevision: positive(row.target_revision, "execution_operation_requests.target_revision"),
    result: enumText(row.result, "execution_operation_requests.result", results),
    createdAt: timestamp(row.created_at, "execution_operation_requests.created_at"),
  })));
}

function readExecutionAuthorizationDecisions(database: SqliteDatabase): readonly ExecutionAuthorizationDecisionRecord[] {
  const actions = new Set<ExecutionOperationRequestRecord["action"]>([
    "execution.start", "execution.inspect", "execution.resume", "execution.retry",
    "execution.cancel", "execution.completion.accept",
  ]);
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, config_revision, created_at
    FROM execution_authorization_decisions ORDER BY decision_id`,
  ).all().map((row) => Object.freeze({
    decisionId: sqliteText(row.decision_id, "execution_authorization_decisions.decision_id"),
    requestId: sqliteText(row.request_id, "execution_authorization_decisions.request_id"),
    actorId: sqliteText(row.actor_id, "execution_authorization_decisions.actor_id"),
    action: enumText(row.action, "execution_authorization_decisions.action", actions),
    result: enumText(row.result, "execution_authorization_decisions.result", DECISION_RESULTS),
    reason: enumText(row.reason, "execution_authorization_decisions.reason", AUTHORIZATION_REASONS),
    policy: enumText(row.policy_result, "execution_authorization_decisions.policy_result", POLICY_RESULTS),
    grantId: sqliteNullableText(row.grant_id, "execution_authorization_decisions.grant_id"),
    grantRevision: nullablePositive(row.grant_revision, "execution_authorization_decisions.grant_revision"),
    projectId: sqliteText(row.project_id, "execution_authorization_decisions.project_id"),
    resourceRevision: positive(row.resource_revision, "execution_authorization_decisions.resource_revision"),
    configRevision: positive(row.config_revision, "execution_authorization_decisions.config_revision"),
    createdAt: timestamp(row.created_at, "execution_authorization_decisions.created_at"),
  })));
}

function readExecutionOperationAudit(database: SqliteDatabase): readonly ExecutionOperationAuditRecord[] {
  const events = new Set<ExecutionOperationAuditRecord["eventKind"]>([
    "execution.operation.prepared", "execution.operation.denied", "execution.operation.executing",
    "execution.operation.observed", "execution.operation.verified", "execution.operation.finalized",
    "execution.manual.outcome.recorded", "execution.completion.accepted",
    "execution.interruption.verified", "execution.reconciled",
  ]);
  const results = new Set<ExecutionOperationAuditRecord["result"]>(["accepted", "denied"]);
  return Object.freeze(database.prepare(
    `SELECT audit_id, request_id, decision_id, event_kind, result, actor_id,
      correlation_id, execution_id, execution_revision, code, created_at
    FROM execution_operation_audit ORDER BY audit_id`,
  ).all().map((row) => Object.freeze({
    auditId: sqliteText(row.audit_id, "execution_operation_audit.audit_id"),
    requestId: sqliteText(row.request_id, "execution_operation_audit.request_id"),
    decisionId: sqliteText(row.decision_id, "execution_operation_audit.decision_id"),
    eventKind: enumText(row.event_kind, "execution_operation_audit.event_kind", events),
    result: enumText(row.result, "execution_operation_audit.result", results),
    actorId: sqliteText(row.actor_id, "execution_operation_audit.actor_id"),
    correlationId: sqliteText(row.correlation_id, "execution_operation_audit.correlation_id"),
    executionId: sqliteText(row.execution_id, "execution_operation_audit.execution_id"),
    executionRevision: positive(row.execution_revision, "execution_operation_audit.execution_revision"),
    code: sqliteText(row.code, "execution_operation_audit.code"),
    createdAt: timestamp(row.created_at, "execution_operation_audit.created_at"),
  })));
}

function readExecutionIntents(database: SqliteDatabase): readonly ExecutionOperationIntent[] {
  const kinds = new Set<ExecutionOperationKind>(["start", "inspect", "resume", "retry", "request_cancel", "manual_report"]);
  const actions = new Set<ExecutionOperationIntent["action"]>([
    "execution.start", "execution.inspect", "execution.resume", "execution.retry", "execution.cancel",
  ]);
  const states = new Set<ExecutionIntentState>([
    "pending", "executing", "observed", "verified", "finalized", "retry_wait", "ambiguous", "failed",
  ]);
  const manualLifecycles = new Set<ManualTurnLifecycle>(["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"]);
  const reportOperations = new Set<NonNullable<ExecutionOperationIntent["reportOperation"]>>(["activate", "wait", "succeed", "fail", "confirm_cancelled"]);
  return Object.freeze(database.prepare(
    `SELECT intent_id, operation_id, idempotency_key, operation_kind, action, state,
      revision, actor_id, request_id, decision_id, current_authorization_decision_id,
      authorization_binding_revision, confirmation_id, project_id,
      project_resource_revision, project_config_revision, task_id, task_revision,
      input_reference, execution_id, execution_revision, attempt_number, fencing_token,
      source_execution_id, source_execution_revision, source_attempt_number, source_fencing_token,
      source_observation_number,
      contract_id, adapter_id, adapter_version, policy_binding_reference, workspace_mode,
      backend_execution_id, thread_id, previous_receipt_id, expected_journal_revision,
      requested_deadline, continuation_reference, required_action_receipt_id, expected_lifecycle,
      reason_code, report_id, report_operation, report_code, evidence_reference, last_observation_number,
      last_error_category, last_error_code, last_error_retryable, last_error_ambiguous,
      retry_after, retry_count,
      created_at, updated_at FROM execution_operation_intents ORDER BY intent_id`,
  ).all().map((row) => {
    const contractId = sqliteText(row.contract_id, "execution_operation_intents.contract_id");
    const workspaceMode = sqliteText(row.workspace_mode, "execution_operation_intents.workspace_mode");
    if (contractId !== "ato.execution/v1" || workspaceMode !== "none") {
      throw persistenceFailure("CORRUPT_ROW", "Execution intent contract/workspace identity is invalid");
    }
    return Object.freeze({
      intentId: sqliteText(row.intent_id, "execution_operation_intents.intent_id"),
      operationId: sqliteText(row.operation_id, "execution_operation_intents.operation_id"),
      idempotencyKey: sqliteText(row.idempotency_key, "execution_operation_intents.idempotency_key"),
      operationKind: enumText(row.operation_kind, "execution_operation_intents.operation_kind", kinds),
      action: enumText(row.action, "execution_operation_intents.action", actions),
      state: enumText(row.state, "execution_operation_intents.state", states),
      revision: positive(row.revision, "execution_operation_intents.revision"),
      actorId: sqliteText(row.actor_id, "execution_operation_intents.actor_id"),
      requestId: sqliteText(row.request_id, "execution_operation_intents.request_id"),
      decisionId: sqliteText(row.decision_id, "execution_operation_intents.decision_id"),
      currentAuthorizationDecisionId: sqliteText(
        row.current_authorization_decision_id, "execution_operation_intents.current_authorization_decision_id",
      ),
      authorizationBindingRevision: positive(
        row.authorization_binding_revision, "execution_operation_intents.authorization_binding_revision",
      ),
      confirmationId: sqliteNullableText(row.confirmation_id, "execution_operation_intents.confirmation_id"),
      projectId: sqliteText(row.project_id, "execution_operation_intents.project_id"),
      projectResourceRevision: positive(row.project_resource_revision, "execution_operation_intents.project_resource_revision"),
      projectConfigRevision: positive(row.project_config_revision, "execution_operation_intents.project_config_revision"),
      taskId: sqliteText(row.task_id, "execution_operation_intents.task_id"),
      taskRevision: positive(row.task_revision, "execution_operation_intents.task_revision"),
      inputReference: sqliteText(row.input_reference, "execution_operation_intents.input_reference"),
      executionId: sqliteText(row.execution_id, "execution_operation_intents.execution_id"),
      executionRevision: positive(row.execution_revision, "execution_operation_intents.execution_revision"),
      attemptNumber: positive(row.attempt_number, "execution_operation_intents.attempt_number"),
      fencingToken: positive(row.fencing_token, "execution_operation_intents.fencing_token"),
      sourceExecutionId: sqliteNullableText(row.source_execution_id, "execution_operation_intents.source_execution_id"),
      sourceExecutionRevision: nullablePositive(row.source_execution_revision, "execution_operation_intents.source_execution_revision"),
      sourceAttemptNumber: nullablePositive(row.source_attempt_number, "execution_operation_intents.source_attempt_number"),
      sourceFencingToken: nullablePositive(row.source_fencing_token, "execution_operation_intents.source_fencing_token"),
      sourceObservationNumber: row.source_observation_number === null
        ? null : nonnegative(row.source_observation_number, "execution_operation_intents.source_observation_number"),
      contractId, adapterId: sqliteText(row.adapter_id, "execution_operation_intents.adapter_id"),
      adapterVersion: sqliteText(row.adapter_version, "execution_operation_intents.adapter_version"),
      policyBindingReference: sqliteText(row.policy_binding_reference, "execution_operation_intents.policy_binding_reference"),
      workspaceMode,
      backendExecutionId: sqliteNullableText(row.backend_execution_id, "execution_operation_intents.backend_execution_id"),
      threadId: sqliteNullableText(row.thread_id, "execution_operation_intents.thread_id"),
      previousReceiptId: sqliteNullableText(row.previous_receipt_id, "execution_operation_intents.previous_receipt_id"),
      expectedJournalRevision: nullablePositive(row.expected_journal_revision, "execution_operation_intents.expected_journal_revision"),
      requestedDeadline: timestamp(row.requested_deadline, "execution_operation_intents.requested_deadline"),
      continuationReference: sqliteNullableText(row.continuation_reference, "execution_operation_intents.continuation_reference"),
      requiredActionReceiptId: sqliteNullableText(row.required_action_receipt_id, "execution_operation_intents.required_action_receipt_id"),
      expectedLifecycle: row.expected_lifecycle === null ? null : enumText(row.expected_lifecycle, "execution_operation_intents.expected_lifecycle", manualLifecycles),
      reasonCode: sqliteNullableText(row.reason_code, "execution_operation_intents.reason_code"),
      reportId: sqliteNullableText(row.report_id, "execution_operation_intents.report_id"),
      reportOperation: row.report_operation === null ? null : enumText(row.report_operation, "execution_operation_intents.report_operation", reportOperations),
      reportCode: sqliteNullableText(row.report_code, "execution_operation_intents.report_code"),
      evidenceReference: sqliteNullableText(row.evidence_reference, "execution_operation_intents.evidence_reference"),
      lastObservationNumber: nonnegative(row.last_observation_number, "execution_operation_intents.last_observation_number"),
      lastErrorCategory: row.last_error_category === null ? null : enumText(
        row.last_error_category,
        "execution_operation_intents.last_error_category",
        new Set<ExecutionAdapterFailureCategory>([
          "invalid_request", "incompatible_contract", "unauthorized", "policy_denied", "not_found",
          "conflict", "stale_revision", "busy", "rate_limited", "resource_exhausted",
          "transient_external", "permanent_external", "ambiguous_external_state", "cancelled",
          "integrity_failure",
        ]),
      ),
      lastErrorCode: sqliteNullableText(row.last_error_code, "execution_operation_intents.last_error_code"),
      lastErrorRetryable: row.last_error_retryable === null ? null : integer(
        row.last_error_retryable, "execution_operation_intents.last_error_retryable",
      ) === 1,
      lastErrorAmbiguous: row.last_error_ambiguous === null ? null : integer(
        row.last_error_ambiguous, "execution_operation_intents.last_error_ambiguous",
      ) === 1,
      retryAfter: row.retry_after === null ? null : timestamp(row.retry_after, "execution_operation_intents.retry_after"),
      retryCount: nonnegative(row.retry_count, "execution_operation_intents.retry_count"),
      createdAt: timestamp(row.created_at, "execution_operation_intents.created_at"),
      updatedAt: timestamp(row.updated_at, "execution_operation_intents.updated_at"),
    });
  }));
}

function readExecutionIntentAuthorizationBindings(
  database: SqliteDatabase,
): readonly ExecutionIntentAuthorizationBindingRecord[] {
  const phases = new Set<ExecutionIntentAuthorizationBindingRecord["phase"]>(["prepare", "act", "finalize"]);
  return Object.freeze(database.prepare(
    `SELECT binding_id, intent_id, binding_revision, phase, request_id, decision_id,
      audit_id, prior_decision_id, created_at
    FROM execution_intent_authorization_bindings ORDER BY intent_id, binding_revision`,
  ).all().map((row) => Object.freeze({
    bindingId: sqliteText(row.binding_id, "execution_intent_authorization_bindings.binding_id"),
    intentId: sqliteText(row.intent_id, "execution_intent_authorization_bindings.intent_id"),
    bindingRevision: positive(row.binding_revision, "execution_intent_authorization_bindings.binding_revision"),
    phase: enumText(row.phase, "execution_intent_authorization_bindings.phase", phases),
    requestId: sqliteText(row.request_id, "execution_intent_authorization_bindings.request_id"),
    decisionId: sqliteText(row.decision_id, "execution_intent_authorization_bindings.decision_id"),
    auditId: sqliteText(row.audit_id, "execution_intent_authorization_bindings.audit_id"),
    priorDecisionId: sqliteNullableText(row.prior_decision_id, "execution_intent_authorization_bindings.prior_decision_id"),
    createdAt: timestamp(row.created_at, "execution_intent_authorization_bindings.created_at"),
  })));
}

function readExecutionObservations(database: SqliteDatabase): readonly ExecutionObservationRecord[] {
  const lifecycles = new Set<ExecutionObservationRecord["lifecycle"]>([
    "unknown", "queued", "active", "waiting", "turn_succeeded", "failed", "cancelled",
  ]);
  const outcomes = new Set<ExecutionObservationRecord["outcome"]>(["succeeded", "deferred", "rejected"]);
  return Object.freeze(database.prepare(
    `SELECT observation_id, intent_id, observation_number, adapter_receipt_id, receipt_sha256,
      authorization_decision_id, lifecycle, outcome, code,
      backend_execution_id, thread_id, journal_revision, evidence_reference, observed_at
    FROM execution_observations ORDER BY intent_id, observation_number`,
  ).all().map((row) => Object.freeze({
    observationId: sqliteText(row.observation_id, "execution_observations.observation_id"),
    intentId: sqliteText(row.intent_id, "execution_observations.intent_id"),
    observationNumber: positive(row.observation_number, "execution_observations.observation_number"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "execution_observations.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "execution_observations.receipt_sha256"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "execution_observations.authorization_decision_id"),
    lifecycle: enumText(row.lifecycle, "execution_observations.lifecycle", lifecycles),
    outcome: enumText(row.outcome, "execution_observations.outcome", outcomes),
    code: sqliteText(row.code, "execution_observations.code"),
    backendExecutionId: sqliteNullableText(row.backend_execution_id, "execution_observations.backend_execution_id"),
    threadId: sqliteNullableText(row.thread_id, "execution_observations.thread_id"),
    journalRevision: nullablePositive(row.journal_revision, "execution_observations.journal_revision"),
    evidenceReference: sqliteNullableText(row.evidence_reference, "execution_observations.evidence_reference"),
    observedAt: timestamp(row.observed_at, "execution_observations.observed_at"),
  })));
}

function readExecutionReceipts(database: SqliteDatabase): readonly ExecutionVerifiedReceiptRecord[] {
  return Object.freeze(database.prepare(
    `SELECT verified_receipt_id, intent_id, adapter_receipt_id, receipt_sha256, lifecycle,
      backend_execution_id, thread_id, observation_number, observed_revision, fencing_token, verified_at
    FROM execution_verified_receipts ORDER BY verified_receipt_id`,
  ).all().map((row) => Object.freeze({
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "execution_verified_receipts.verified_receipt_id"),
    intentId: sqliteText(row.intent_id, "execution_verified_receipts.intent_id"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "execution_verified_receipts.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "execution_verified_receipts.receipt_sha256"),
    lifecycle: sqliteText(row.lifecycle, "execution_verified_receipts.lifecycle"),
    backendExecutionId: sqliteText(row.backend_execution_id, "execution_verified_receipts.backend_execution_id"),
    threadId: sqliteNullableText(row.thread_id, "execution_verified_receipts.thread_id"),
    observationNumber: positive(row.observation_number, "execution_verified_receipts.observation_number"),
    observedRevision: positive(row.observed_revision, "execution_verified_receipts.observed_revision"),
    fencingToken: positive(row.fencing_token, "execution_verified_receipts.fencing_token"),
    verifiedAt: timestamp(row.verified_at, "execution_verified_receipts.verified_at"),
  })));
}

function readExecutionFinalizations(database: SqliteDatabase): readonly ExecutionFinalizationRecord[] {
  const outcomes = new Set<ExecutionFinalizationRecord["outcome"]>(["accepted", "deferred", "rejected", "waiting", "interrupted"]);
  return Object.freeze(database.prepare(
    `SELECT finalization_id, intent_id, verified_receipt_id, authorization_decision_id, outcome, code,
      task_revision, execution_revision, finalized_at FROM execution_finalizations ORDER BY finalization_id`,
  ).all().map((row) => Object.freeze({
    finalizationId: sqliteText(row.finalization_id, "execution_finalizations.finalization_id"),
    intentId: sqliteText(row.intent_id, "execution_finalizations.intent_id"),
    verifiedReceiptId: sqliteNullableText(row.verified_receipt_id, "execution_finalizations.verified_receipt_id"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "execution_finalizations.authorization_decision_id"),
    outcome: enumText(row.outcome, "execution_finalizations.outcome", outcomes),
    code: sqliteText(row.code, "execution_finalizations.code"),
    taskRevision: positive(row.task_revision, "execution_finalizations.task_revision"),
    executionRevision: positive(row.execution_revision, "execution_finalizations.execution_revision"),
    finalizedAt: timestamp(row.finalized_at, "execution_finalizations.finalized_at"),
  })));
}

function readExecutionTerminalStates(database: SqliteDatabase): readonly ExecutionTerminalStateRecord[] {
  const statuses = new Set<ExecutionTerminalStateRecord["status"]>(["completed", "cancelled"]);
  return Object.freeze(database.prepare(
    `SELECT execution_id, status, attempt_number, fencing_token, verified_receipt_id,
      finalization_id, completion_decision_id, pre_task_revision, post_task_revision,
      execution_revision, created_at FROM execution_terminal_states ORDER BY execution_id`,
  ).all().map((row) => Object.freeze({
    executionId: sqliteText(row.execution_id, "execution_terminal_states.execution_id"),
    status: enumText(row.status, "execution_terminal_states.status", statuses),
    attemptNumber: positive(row.attempt_number, "execution_terminal_states.attempt_number"),
    fencingToken: positive(row.fencing_token, "execution_terminal_states.fencing_token"),
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "execution_terminal_states.verified_receipt_id"),
    finalizationId: sqliteText(row.finalization_id, "execution_terminal_states.finalization_id"),
    completionDecisionId: sqliteNullableText(row.completion_decision_id, "execution_terminal_states.completion_decision_id"),
    preTaskRevision: positive(row.pre_task_revision, "execution_terminal_states.pre_task_revision"),
    postTaskRevision: positive(row.post_task_revision, "execution_terminal_states.post_task_revision"),
    executionRevision: positive(row.execution_revision, "execution_terminal_states.execution_revision"),
    createdAt: timestamp(row.created_at, "execution_terminal_states.created_at"),
  })));
}

function readManualTurns(database: SqliteDatabase): readonly ManualBackendTurnRecord[] {
  const lifecycles = new Set<ManualTurnLifecycle>(["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"]);
  return Object.freeze(database.prepare(
    `SELECT backend_execution_id, thread_id, start_idempotency_key, project_id,
      project_resource_revision, project_config_revision, task_id, task_revision,
      input_reference, execution_id, execution_revision, attempt_number, fencing_token,
      predecessor_backend_execution_id, predecessor_thread_id,
      policy_binding_reference, workspace_mode, lifecycle, cancellation_request_revision,
      cancellation_requested_at, code, evidence_reference, last_report_id, revision,
      created_at, updated_at FROM manual_backend_turns ORDER BY backend_execution_id`,
  ).all().map((row) => {
    const workspaceMode = sqliteText(row.workspace_mode, "manual_backend_turns.workspace_mode");
    if (workspaceMode !== "none") throw persistenceFailure("CORRUPT_ROW", "Manual turn workspace mode is invalid");
    return Object.freeze({
      backendExecutionId: sqliteText(row.backend_execution_id, "manual_backend_turns.backend_execution_id"),
      threadId: sqliteText(row.thread_id, "manual_backend_turns.thread_id"),
      startIdempotencyKey: sqliteText(row.start_idempotency_key, "manual_backend_turns.start_idempotency_key"),
      projectId: sqliteText(row.project_id, "manual_backend_turns.project_id"),
      projectResourceRevision: positive(row.project_resource_revision, "manual_backend_turns.project_resource_revision"),
      projectConfigRevision: positive(row.project_config_revision, "manual_backend_turns.project_config_revision"),
      taskId: sqliteText(row.task_id, "manual_backend_turns.task_id"),
      taskRevision: positive(row.task_revision, "manual_backend_turns.task_revision"),
      inputReference: sqliteText(row.input_reference, "manual_backend_turns.input_reference"),
      executionId: sqliteText(row.execution_id, "manual_backend_turns.execution_id"),
      executionRevision: positive(row.execution_revision, "manual_backend_turns.execution_revision"),
      attemptNumber: positive(row.attempt_number, "manual_backend_turns.attempt_number"),
      fencingToken: positive(row.fencing_token, "manual_backend_turns.fencing_token"),
      predecessorBackendExecutionId: sqliteNullableText(row.predecessor_backend_execution_id, "manual_backend_turns.predecessor_backend_execution_id"),
      predecessorThreadId: sqliteNullableText(row.predecessor_thread_id, "manual_backend_turns.predecessor_thread_id"),
      policyBindingReference: sqliteText(row.policy_binding_reference, "manual_backend_turns.policy_binding_reference"),
      workspaceMode, lifecycle: enumText(row.lifecycle, "manual_backend_turns.lifecycle", lifecycles),
      cancellationRequestRevision: nullablePositive(row.cancellation_request_revision, "manual_backend_turns.cancellation_request_revision"),
      cancellationRequestedAt: row.cancellation_requested_at === null ? null : timestamp(row.cancellation_requested_at, "manual_backend_turns.cancellation_requested_at"),
      code: sqliteText(row.code, "manual_backend_turns.code"),
      evidenceReference: sqliteNullableText(row.evidence_reference, "manual_backend_turns.evidence_reference"),
      lastReportId: sqliteNullableText(row.last_report_id, "manual_backend_turns.last_report_id"),
      revision: positive(row.revision, "manual_backend_turns.revision"),
      createdAt: timestamp(row.created_at, "manual_backend_turns.created_at"),
      updatedAt: timestamp(row.updated_at, "manual_backend_turns.updated_at"),
    });
  }));
}

function readManualBackendOperations(database: SqliteDatabase): readonly ManualBackendOperationRecord[] {
  const kinds = new Set<ManualBackendOperationRecord["operationKind"]>(["start", "resume", "retry", "request_cancel", "manual_report"]);
  const reports = new Set<Exclude<ManualBackendOperationRecord["reportOperation"], null>>(["activate", "wait", "succeed", "fail", "confirm_cancelled"]);
  const lifecycles = new Set<ManualTurnLifecycle>(["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"]);
  return Object.freeze(database.prepare(
    `SELECT backend_operation_id, idempotency_key, intent_id, authorization_decision_id,
      operation_kind, report_operation,
      backend_execution_id, thread_id, source_backend_execution_id, source_thread_id,
      expected_fencing_token, expected_pre_revision,
      post_revision, result_lifecycle, receipt_id, created_at
    FROM manual_backend_operations ORDER BY backend_operation_id`,
  ).all().map((row) => Object.freeze({
    backendOperationId: sqliteText(row.backend_operation_id, "manual_backend_operations.backend_operation_id"),
    idempotencyKey: sqliteText(row.idempotency_key, "manual_backend_operations.idempotency_key"),
    intentId: sqliteText(row.intent_id, "manual_backend_operations.intent_id"),
    authorizationDecisionId: sqliteText(
      row.authorization_decision_id, "manual_backend_operations.authorization_decision_id",
    ),
    operationKind: enumText(row.operation_kind, "manual_backend_operations.operation_kind", kinds),
    reportOperation: row.report_operation === null ? null : enumText(row.report_operation, "manual_backend_operations.report_operation", reports),
    backendExecutionId: sqliteText(row.backend_execution_id, "manual_backend_operations.backend_execution_id"),
    threadId: sqliteText(row.thread_id, "manual_backend_operations.thread_id"),
    sourceBackendExecutionId: sqliteNullableText(row.source_backend_execution_id, "manual_backend_operations.source_backend_execution_id"),
    sourceThreadId: sqliteNullableText(row.source_thread_id, "manual_backend_operations.source_thread_id"),
    expectedFencingToken: positive(row.expected_fencing_token, "manual_backend_operations.expected_fencing_token"),
    expectedPreRevision: nullablePositive(row.expected_pre_revision, "manual_backend_operations.expected_pre_revision"),
    postRevision: positive(row.post_revision, "manual_backend_operations.post_revision"),
    resultLifecycle: enumText(row.result_lifecycle, "manual_backend_operations.result_lifecycle", lifecycles),
    receiptId: sqliteText(row.receipt_id, "manual_backend_operations.receipt_id"),
    createdAt: timestamp(row.created_at, "manual_backend_operations.created_at"),
  })));
}

function readManualCompletionDecisions(database: SqliteDatabase): readonly ManualCompletionDecisionRecord[] {
  return Object.freeze(database.prepare(
    `SELECT completion_decision_id, operation_id, idempotency_key, task_id, execution_id,
      attempt_number, fencing_token, verified_receipt_id, finalization_id,
      pre_task_revision, post_task_revision, request_id, decision_id, audit_id,
      confirmation_id, created_at FROM manual_completion_decisions ORDER BY completion_decision_id`,
  ).all().map((row) => Object.freeze({
    completionDecisionId: sqliteText(row.completion_decision_id, "manual_completion_decisions.completion_decision_id"),
    operationId: sqliteText(row.operation_id, "manual_completion_decisions.operation_id"),
    idempotencyKey: sqliteText(row.idempotency_key, "manual_completion_decisions.idempotency_key"),
    taskId: sqliteText(row.task_id, "manual_completion_decisions.task_id"),
    executionId: sqliteText(row.execution_id, "manual_completion_decisions.execution_id"),
    attemptNumber: positive(row.attempt_number, "manual_completion_decisions.attempt_number"),
    fencingToken: positive(row.fencing_token, "manual_completion_decisions.fencing_token"),
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "manual_completion_decisions.verified_receipt_id"),
    finalizationId: sqliteText(row.finalization_id, "manual_completion_decisions.finalization_id"),
    preTaskRevision: positive(row.pre_task_revision, "manual_completion_decisions.pre_task_revision"),
    postTaskRevision: positive(row.post_task_revision, "manual_completion_decisions.post_task_revision"),
    requestId: sqliteText(row.request_id, "manual_completion_decisions.request_id"),
    decisionId: sqliteText(row.decision_id, "manual_completion_decisions.decision_id"),
    auditId: sqliteText(row.audit_id, "manual_completion_decisions.audit_id"),
    confirmationId: sqliteText(row.confirmation_id, "manual_completion_decisions.confirmation_id"),
    createdAt: timestamp(row.created_at, "manual_completion_decisions.created_at"),
  })));
}

function readDispatcherTriggerRequests(database: SqliteDatabase): readonly DispatcherTriggerRequestRecord[] {
  const results = new Set<DispatcherTriggerRequestRecord["result"]>(["allow", "deny"]);
  return Object.freeze(database.prepare(
    `SELECT request_id, observation_id, idempotency_key, correlation_id, actor_id, action,
      worker_owner_id, requested_lease_seconds, result, created_at
    FROM dispatcher_trigger_requests ORDER BY request_id`,
  ).all().map((row) => {
    if (row.action !== "dispatch.run") throw persistenceFailure("CORRUPT_ROW", "Dispatcher request action is unsupported");
    return Object.freeze({
      requestId: sqliteText(row.request_id, "dispatcher_trigger_requests.request_id"),
      observationId: sqliteText(row.observation_id, "dispatcher_trigger_requests.observation_id"),
      idempotencyKey: sqliteText(row.idempotency_key, "dispatcher_trigger_requests.idempotency_key"),
      correlationId: sqliteText(row.correlation_id, "dispatcher_trigger_requests.correlation_id"),
      actorId: sqliteText(row.actor_id, "dispatcher_trigger_requests.actor_id"),
      action: "dispatch.run" as const,
      workerOwnerId: sqliteText(row.worker_owner_id, "dispatcher_trigger_requests.worker_owner_id"),
      requestedLeaseSeconds: positive(row.requested_lease_seconds, "dispatcher_trigger_requests.requested_lease_seconds"),
      result: enumText(row.result, "dispatcher_trigger_requests.result", results),
      createdAt: timestamp(row.created_at, "dispatcher_trigger_requests.created_at"),
    });
  }));
}

function readDispatcherAuthorizationDecisions(database: SqliteDatabase): readonly DispatcherAuthorizationDecisionRecord[] {
  const results = new Set<DispatcherAuthorizationDecisionRecord["result"]>(["allow", "deny"]);
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, created_at FROM dispatcher_authorization_decisions ORDER BY decision_id`,
  ).all().map((row) => {
    if (row.action !== "dispatch.run") throw persistenceFailure("CORRUPT_ROW", "Dispatcher decision action is unsupported");
    const reason = enumText(row.reason, "dispatcher_authorization_decisions.reason", AUTHORIZATION_REASONS);
    const policy = enumText(row.policy_result, "dispatcher_authorization_decisions.policy_result", POLICY_RESULTS);
    return Object.freeze({
      decisionId: sqliteText(row.decision_id, "dispatcher_authorization_decisions.decision_id"),
      requestId: sqliteText(row.request_id, "dispatcher_authorization_decisions.request_id"),
      actorId: sqliteText(row.actor_id, "dispatcher_authorization_decisions.actor_id"),
      action: "dispatch.run" as const,
      result: enumText(row.result, "dispatcher_authorization_decisions.result", results),
      reason,
      policy,
      grantId: sqliteNullableText(row.grant_id, "dispatcher_authorization_decisions.grant_id"),
      grantRevision: nullablePositive(row.grant_revision, "dispatcher_authorization_decisions.grant_revision"),
      createdAt: timestamp(row.created_at, "dispatcher_authorization_decisions.created_at"),
    });
  }));
}

function readDispatcherRuns(database: SqliteDatabase): readonly DispatcherRunRecord[] {
  const statuses = new Set<DispatcherRunStatus>(["starting", "reconciling", "sweeping", "completed", "partial", "failed", "interrupted"]);
  return Object.freeze(database.prepare(
    `SELECT run_id, observation_id, request_id, decision_id, actor_id, owner_id, owner_revision,
      run_revision, requested_lease_seconds, heartbeat_at, lease_expires_at, status, created_at, updated_at
    FROM dispatcher_runs ORDER BY run_id`,
  ).all().map((row) => Object.freeze({
    runId: sqliteText(row.run_id, "dispatcher_runs.run_id"),
    observationId: sqliteText(row.observation_id, "dispatcher_runs.observation_id"),
    requestId: sqliteText(row.request_id, "dispatcher_runs.request_id"),
    decisionId: sqliteText(row.decision_id, "dispatcher_runs.decision_id"),
    actorId: sqliteText(row.actor_id, "dispatcher_runs.actor_id"),
    ownerId: sqliteText(row.owner_id, "dispatcher_runs.owner_id"),
    ownerRevision: positive(row.owner_revision, "dispatcher_runs.owner_revision"),
    runRevision: positive(row.run_revision, "dispatcher_runs.run_revision"),
    requestedLeaseSeconds: positive(row.requested_lease_seconds, "dispatcher_runs.requested_lease_seconds"),
    heartbeatAt: timestamp(row.heartbeat_at, "dispatcher_runs.heartbeat_at"),
    leaseExpiresAt: timestamp(row.lease_expires_at, "dispatcher_runs.lease_expires_at"),
    status: enumText(row.status, "dispatcher_runs.status", statuses),
    createdAt: timestamp(row.created_at, "dispatcher_runs.created_at"),
    updatedAt: timestamp(row.updated_at, "dispatcher_runs.updated_at"),
  })));
}

function readDispatcherAudit(database: SqliteDatabase): readonly DispatcherAuditRecord[] {
  const events = new Set<DispatcherAuditRecord["eventKind"]>([
    "dispatch.denied", "dispatch.started", "dispatch.reconciling", "dispatch.sealed",
    "dispatch.member.resolved", "dispatch.heartbeat", "dispatch.taken_over", "dispatch.terminal",
    "dispatch.operation.denied",
  ]);
  const results = new Set<DispatcherAuditRecord["result"]>(["accepted", "denied"]);
  const codes = new Set<DispatcherAuditCode>(DISPATCHER_AUDIT_CODES);
  return Object.freeze(database.prepare(
    `SELECT audit_id, request_id, decision_id, run_id, event_kind, result, actor_id,
      correlation_id, code, created_at FROM dispatcher_audit ORDER BY audit_id`,
  ).all().map((row) => Object.freeze({
    auditId: sqliteText(row.audit_id, "dispatcher_audit.audit_id"),
    requestId: sqliteText(row.request_id, "dispatcher_audit.request_id"),
    decisionId: sqliteText(row.decision_id, "dispatcher_audit.decision_id"),
    runId: sqliteNullableText(row.run_id, "dispatcher_audit.run_id"),
    eventKind: enumText(row.event_kind, "dispatcher_audit.event_kind", events),
    result: enumText(row.result, "dispatcher_audit.result", results),
    actorId: sqliteText(row.actor_id, "dispatcher_audit.actor_id"),
    correlationId: sqliteText(row.correlation_id, "dispatcher_audit.correlation_id"),
    code: enumText(row.code, "dispatcher_audit.code", codes),
    createdAt: timestamp(row.created_at, "dispatcher_audit.created_at"),
  })));
}

function readDispatcherReconciliationItems(database: SqliteDatabase): readonly DispatcherReconciliationItemRecord[] {
  const resourceKinds = new Set<DispatcherReconciliationItemRecord["resourceKind"]>(["execution_intent", "execution_lease", "dispatcher_run"]);
  const dispositions = new Set<DispatcherReconciliationItemRecord["disposition"]>(["reconciled", "no_effect", "authorization_denied", "ambiguous", "failed"]);
  const codes = new Set<DispatcherReconciliationCode>(DISPATCHER_RECONCILIATION_CODES);
  return Object.freeze(database.prepare(
    `SELECT reconciliation_item_id, run_id, ordinal, resource_kind, resource_id, disposition, code, created_at
    FROM dispatcher_reconciliation_items ORDER BY run_id, ordinal`,
  ).all().map((row) => Object.freeze({
    reconciliationItemId: sqliteText(row.reconciliation_item_id, "dispatcher_reconciliation_items.reconciliation_item_id"),
    runId: sqliteText(row.run_id, "dispatcher_reconciliation_items.run_id"),
    ordinal: nonnegative(row.ordinal, "dispatcher_reconciliation_items.ordinal"),
    resourceKind: enumText(row.resource_kind, "dispatcher_reconciliation_items.resource_kind", resourceKinds),
    resourceId: sqliteText(row.resource_id, "dispatcher_reconciliation_items.resource_id"),
    disposition: enumText(row.disposition, "dispatcher_reconciliation_items.disposition", dispositions),
    code: enumText(row.code, "dispatcher_reconciliation_items.code", codes),
    createdAt: timestamp(row.created_at, "dispatcher_reconciliation_items.created_at"),
  })));
}

function readDispatcherReconciliationSummaries(database: SqliteDatabase): readonly DispatcherReconciliationSummaryRecord[] {
  return Object.freeze(database.prepare(
    `SELECT run_id, summary_revision, expected_count, reconciled_count, no_effect_count,
      authorization_denied_count, ambiguous_count, failed_count, created_at
    FROM dispatcher_reconciliation_summaries ORDER BY run_id`,
  ).all().map((row) => {
    const summaryRevision = positive(row.summary_revision, "dispatcher_reconciliation_summaries.summary_revision");
    if (summaryRevision !== 1) throw persistenceFailure("CORRUPT_ROW", "Dispatcher reconciliation summary revision is unsupported");
    return Object.freeze({
      runId: sqliteText(row.run_id, "dispatcher_reconciliation_summaries.run_id"),
      summaryRevision: 1 as const,
      expectedCount: nonnegative(row.expected_count, "dispatcher_reconciliation_summaries.expected_count"),
      reconciledCount: nonnegative(row.reconciled_count, "dispatcher_reconciliation_summaries.reconciled_count"),
      noEffectCount: nonnegative(row.no_effect_count, "dispatcher_reconciliation_summaries.no_effect_count"),
      authorizationDeniedCount: nonnegative(row.authorization_denied_count, "dispatcher_reconciliation_summaries.authorization_denied_count"),
      ambiguousCount: nonnegative(row.ambiguous_count, "dispatcher_reconciliation_summaries.ambiguous_count"),
      failedCount: nonnegative(row.failed_count, "dispatcher_reconciliation_summaries.failed_count"),
      createdAt: timestamp(row.created_at, "dispatcher_reconciliation_summaries.created_at"),
    });
  }));
}

function readDispatcherMemberships(database: SqliteDatabase): readonly DispatcherMembershipRecord[] {
  return Object.freeze(database.prepare(
    `SELECT run_id, membership_revision, expected_member_count, sealed_at
    FROM dispatcher_memberships ORDER BY run_id`,
  ).all().map((row) => Object.freeze({
    runId: sqliteText(row.run_id, "dispatcher_memberships.run_id"),
    membershipRevision: positive(row.membership_revision, "dispatcher_memberships.membership_revision"),
    expectedMemberCount: nonnegative(row.expected_member_count, "dispatcher_memberships.expected_member_count"),
    sealedAt: timestamp(row.sealed_at, "dispatcher_memberships.sealed_at"),
  })));
}

function readDispatcherMembers(database: SqliteDatabase): readonly DispatcherMemberRecord[] {
  const lifecycles = new Set<DispatcherMemberRecord["lifecycle"]>(["pending", "terminal"]);
  const outcomes = new Set<DispatcherMemberOutcome>([
    "claimed", "already_claimed", "ineligible_at_cas", "authorization_denied",
    "policy_deferred", "resource_deferred", "reconciliation_required", "failed",
  ]);
  const codes = new Set<DispatcherMemberCode>(DISPATCHER_MEMBER_CODES);
  return Object.freeze(database.prepare(
    `SELECT member_id, run_id, membership_revision, ordinal, project_id, project_resource_revision,
      project_config_revision, task_id, task_revision, lifecycle, outcome, execution_id, intent_id,
      code, revision, created_at, updated_at FROM dispatcher_members ORDER BY run_id, ordinal`,
  ).all().map((row) => Object.freeze({
    memberId: sqliteText(row.member_id, "dispatcher_members.member_id"),
    runId: sqliteText(row.run_id, "dispatcher_members.run_id"),
    membershipRevision: positive(row.membership_revision, "dispatcher_members.membership_revision"),
    ordinal: nonnegative(row.ordinal, "dispatcher_members.ordinal"),
    projectId: sqliteText(row.project_id, "dispatcher_members.project_id"),
    projectResourceRevision: positive(row.project_resource_revision, "dispatcher_members.project_resource_revision"),
    projectConfigRevision: positive(row.project_config_revision, "dispatcher_members.project_config_revision"),
    taskId: sqliteText(row.task_id, "dispatcher_members.task_id"),
    taskRevision: positive(row.task_revision, "dispatcher_members.task_revision"),
    lifecycle: enumText(row.lifecycle, "dispatcher_members.lifecycle", lifecycles),
    outcome: row.outcome === null ? null : enumText(row.outcome, "dispatcher_members.outcome", outcomes),
    executionId: sqliteNullableText(row.execution_id, "dispatcher_members.execution_id"),
    intentId: sqliteNullableText(row.intent_id, "dispatcher_members.intent_id"),
    code: row.code === null ? null : enumText(row.code, "dispatcher_members.code", codes),
    revision: positive(row.revision, "dispatcher_members.revision"),
    createdAt: timestamp(row.created_at, "dispatcher_members.created_at"),
    updatedAt: timestamp(row.updated_at, "dispatcher_members.updated_at"),
  })));
}

function readDispatcherMemberDenialRequests(
  database: SqliteDatabase,
): readonly DispatcherMemberDenialRequestRecord[] {
  return Object.freeze(database.prepare(
    `SELECT request_id, correlation_id, run_id, member_id, actor_id, action,
      target_execution_id, target_revision, result, created_at
    FROM dispatcher_member_denial_requests ORDER BY request_id`,
  ).all().map((row) => Object.freeze({
    requestId: sqliteText(row.request_id, "dispatcher_member_denial_requests.request_id"),
    correlationId: sqliteText(row.correlation_id, "dispatcher_member_denial_requests.correlation_id"),
    runId: sqliteText(row.run_id, "dispatcher_member_denial_requests.run_id"),
    memberId: sqliteText(row.member_id, "dispatcher_member_denial_requests.member_id"),
    actorId: sqliteText(row.actor_id, "dispatcher_member_denial_requests.actor_id"),
    action: enumText(row.action, "dispatcher_member_denial_requests.action", new Set(["execution.start"] as const)),
    targetExecutionId: sqliteText(row.target_execution_id, "dispatcher_member_denial_requests.target_execution_id"),
    targetRevision: (() => {
      const revision = positive(row.target_revision, "dispatcher_member_denial_requests.target_revision");
      if (revision !== 1) throw persistenceFailure("CORRUPT_ROW", "Dispatcher member denial target revision is unsupported");
      return 1 as const;
    })(),
    result: enumText(row.result, "dispatcher_member_denial_requests.result", new Set(["deny"] as const)),
    createdAt: timestamp(row.created_at, "dispatcher_member_denial_requests.created_at"),
  })));
}

function readDispatcherMemberDenialDecisions(
  database: SqliteDatabase,
): readonly DispatcherMemberDenialDecisionRecord[] {
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, config_revision, created_at
    FROM dispatcher_member_denial_decisions ORDER BY decision_id`,
  ).all().map((row) => {
    const reason = enumText(row.reason, "dispatcher_member_denial_decisions.reason", AUTHORIZATION_REASONS);
    if (reason === "allowed") {
      throw persistenceFailure("CORRUPT_ROW", "Dispatcher member denial decision cannot be allowed");
    }
    return Object.freeze({
      decisionId: sqliteText(row.decision_id, "dispatcher_member_denial_decisions.decision_id"),
      requestId: sqliteText(row.request_id, "dispatcher_member_denial_decisions.request_id"),
      actorId: sqliteText(row.actor_id, "dispatcher_member_denial_decisions.actor_id"),
      action: enumText(row.action, "dispatcher_member_denial_decisions.action", new Set(["execution.start"] as const)),
      result: enumText(row.result, "dispatcher_member_denial_decisions.result", new Set(["deny"] as const)),
      reason,
      policy: enumText(row.policy_result, "dispatcher_member_denial_decisions.policy_result", POLICY_RESULTS),
      grantId: sqliteNullableText(row.grant_id, "dispatcher_member_denial_decisions.grant_id"),
      grantRevision: nullablePositive(row.grant_revision, "dispatcher_member_denial_decisions.grant_revision"),
      projectId: sqliteText(row.project_id, "dispatcher_member_denial_decisions.project_id"),
      resourceRevision: positive(row.resource_revision, "dispatcher_member_denial_decisions.resource_revision"),
      configRevision: positive(row.config_revision, "dispatcher_member_denial_decisions.config_revision"),
      createdAt: timestamp(row.created_at, "dispatcher_member_denial_decisions.created_at"),
    });
  }));
}

function readDispatcherMemberDenialAudit(
  database: SqliteDatabase,
): readonly DispatcherMemberDenialAuditRecord[] {
  return Object.freeze(database.prepare(
    `SELECT audit_id, request_id, decision_id, run_id, member_id, event_kind, result,
      actor_id, correlation_id, target_execution_id, target_revision, code, created_at
    FROM dispatcher_member_denial_audit ORDER BY audit_id`,
  ).all().map((row) => {
    const code = enumText(row.code, "dispatcher_member_denial_audit.code", AUTHORIZATION_REASONS);
    if (code === "allowed") {
      throw persistenceFailure("CORRUPT_ROW", "Dispatcher member denial audit cannot be allowed");
    }
    const targetRevision = positive(row.target_revision, "dispatcher_member_denial_audit.target_revision");
    if (targetRevision !== 1) {
      throw persistenceFailure("CORRUPT_ROW", "Dispatcher member denial audit target revision is unsupported");
    }
    return Object.freeze({
      auditId: sqliteText(row.audit_id, "dispatcher_member_denial_audit.audit_id"),
      requestId: sqliteText(row.request_id, "dispatcher_member_denial_audit.request_id"),
      decisionId: sqliteText(row.decision_id, "dispatcher_member_denial_audit.decision_id"),
      runId: sqliteText(row.run_id, "dispatcher_member_denial_audit.run_id"),
      memberId: sqliteText(row.member_id, "dispatcher_member_denial_audit.member_id"),
      eventKind: enumText(row.event_kind, "dispatcher_member_denial_audit.event_kind", new Set(["authorization.denied"] as const)),
      result: enumText(row.result, "dispatcher_member_denial_audit.result", new Set(["denied"] as const)),
      actorId: sqliteText(row.actor_id, "dispatcher_member_denial_audit.actor_id"),
      correlationId: sqliteText(row.correlation_id, "dispatcher_member_denial_audit.correlation_id"),
      targetExecutionId: sqliteText(row.target_execution_id, "dispatcher_member_denial_audit.target_execution_id"),
      targetRevision: 1 as const,
      code,
      createdAt: timestamp(row.created_at, "dispatcher_member_denial_audit.created_at"),
    });
  }));
}

function readDispatcherRunSummaries(database: SqliteDatabase): readonly DispatcherRunSummaryRecord[] {
  const statuses = new Set<DispatcherRunSummaryRecord["terminalStatus"]>(["completed", "partial", "failed", "interrupted"]);
  return Object.freeze(database.prepare(
    `SELECT run_id, membership_revision, expected_member_count, claimed_count, already_claimed_count,
      ineligible_count, authorization_denied_count, policy_deferred_count, resource_deferred_count,
      reconciliation_required_count, failed_count, terminal_status, owner_revision, run_revision, created_at
    FROM dispatcher_run_summaries ORDER BY run_id`,
  ).all().map((row) => Object.freeze({
    runId: sqliteText(row.run_id, "dispatcher_run_summaries.run_id"),
    membershipRevision: positive(row.membership_revision, "dispatcher_run_summaries.membership_revision"),
    expectedMemberCount: nonnegative(row.expected_member_count, "dispatcher_run_summaries.expected_member_count"),
    claimedCount: nonnegative(row.claimed_count, "dispatcher_run_summaries.claimed_count"),
    alreadyClaimedCount: nonnegative(row.already_claimed_count, "dispatcher_run_summaries.already_claimed_count"),
    ineligibleCount: nonnegative(row.ineligible_count, "dispatcher_run_summaries.ineligible_count"),
    authorizationDeniedCount: nonnegative(row.authorization_denied_count, "dispatcher_run_summaries.authorization_denied_count"),
    policyDeferredCount: nonnegative(row.policy_deferred_count, "dispatcher_run_summaries.policy_deferred_count"),
    resourceDeferredCount: nonnegative(row.resource_deferred_count, "dispatcher_run_summaries.resource_deferred_count"),
    reconciliationRequiredCount: nonnegative(row.reconciliation_required_count, "dispatcher_run_summaries.reconciliation_required_count"),
    failedCount: nonnegative(row.failed_count, "dispatcher_run_summaries.failed_count"),
    terminalStatus: enumText(row.terminal_status, "dispatcher_run_summaries.terminal_status", statuses),
    ownerRevision: positive(row.owner_revision, "dispatcher_run_summaries.owner_revision"),
    runRevision: positive(row.run_revision, "dispatcher_run_summaries.run_revision"),
    createdAt: timestamp(row.created_at, "dispatcher_run_summaries.created_at"),
  })));
}

function readRequests(database: SqliteDatabase): readonly ApplicationRequestRecord[] {
  const rows = database.prepare(
    `SELECT request_id, correlation_id, actor_id, action, target_kind, target_id,
      target_revision, result, created_at FROM application_requests ORDER BY request_id`,
  ).all();
  return Object.freeze(rows.map((row) => Object.freeze({
    requestId: sqliteText(row.request_id, "application_requests.request_id"),
    correlationId: sqliteText(row.correlation_id, "application_requests.correlation_id"),
    actorId: sqliteText(row.actor_id, "application_requests.actor_id"),
    action: action(row.action, "application_requests.action"),
    targetKind: enumText(row.target_kind, "application_requests.target_kind", TARGET_KINDS),
    targetId: sqliteText(row.target_id, "application_requests.target_id"),
    targetRevision: nullablePositive(row.target_revision, "application_requests.target_revision"),
    result: enumText(row.result, "application_requests.result", REQUEST_RESULTS),
    createdAt: timestamp(row.created_at, "application_requests.created_at"),
  })));
}

function readGrants(database: SqliteDatabase): readonly AuthorizationGrant[] {
  const rows = database.prepare(
    `SELECT grant_id, revision, actor_id, action, scope_kind, scope_project_id,
      scope_resource_revision, scope_config_revision, not_before, expires_at,
      revoked_at, issuer_grant_id, source_grant_id
    FROM authorization_grants ORDER BY grant_id`,
  ).all();
  return Object.freeze(rows.map((row) => {
    const parsed = parseAuthorizationGrant({
      grantId: sqliteText(row.grant_id, "authorization_grants.grant_id"),
      revision: positive(row.revision, "authorization_grants.revision"),
      actorId: sqliteText(row.actor_id, "authorization_grants.actor_id"),
      action: grantAction(row.action, "authorization_grants.action"),
      scope: {
        kind: enumText(row.scope_kind, "authorization_grants.scope_kind", SCOPE_KINDS),
        projectId: sqliteNullableText(row.scope_project_id, "authorization_grants.scope_project_id"),
        resourceRevision: nullablePositive(row.scope_resource_revision, "authorization_grants.scope_resource_revision"),
        configRevision: nullablePositive(row.scope_config_revision, "authorization_grants.scope_config_revision"),
      },
      notBefore: timestamp(row.not_before, "authorization_grants.not_before"),
      expiresAt: timestamp(row.expires_at, "authorization_grants.expires_at"),
      revokedAt: row.revoked_at === null ? null : timestamp(row.revoked_at, "authorization_grants.revoked_at"),
      issuerGrantId: sqliteNullableText(row.issuer_grant_id, "authorization_grants.issuer_grant_id"),
      sourceGrantId: sqliteNullableText(row.source_grant_id, "authorization_grants.source_grant_id"),
    });
    if (parsed === null) throw persistenceFailure("CORRUPT_ROW", "Authorization grant has an impossible shape");
    return parsed;
  }));
}

function readDecisions(database: SqliteDatabase): readonly AuthorizationDecisionRecord[] {
  const rows = database.prepare(
    `SELECT decision_id, request_id, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, resource_revision, created_at
    FROM authorization_decisions ORDER BY decision_id`,
  ).all();
  return Object.freeze(rows.map((row) => Object.freeze({
    decisionId: sqliteText(row.decision_id, "authorization_decisions.decision_id"),
    requestId: sqliteText(row.request_id, "authorization_decisions.request_id"),
    actorId: sqliteText(row.actor_id, "authorization_decisions.actor_id"),
    action: action(row.action, "authorization_decisions.action"),
    result: enumText(row.result, "authorization_decisions.result", DECISION_RESULTS),
    reason: enumText(row.reason, "authorization_decisions.reason", AUTHORIZATION_REASONS),
    policy: enumText(row.policy_result, "authorization_decisions.policy_result", POLICY_RESULTS),
    grantId: sqliteNullableText(row.grant_id, "authorization_decisions.grant_id"),
    grantRevision: nullablePositive(row.grant_revision, "authorization_decisions.grant_revision"),
    projectId: sqliteNullableText(row.project_id, "authorization_decisions.project_id"),
    resourceRevision: nullablePositive(row.resource_revision, "authorization_decisions.resource_revision"),
    createdAt: timestamp(row.created_at, "authorization_decisions.created_at"),
  })));
}

function readAudit(database: SqliteDatabase): readonly DecodedApplicationAudit[] {
  const rows = database.prepare(
    `SELECT audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
      target_kind, target_id, target_revision, reason, details_json, created_at
    FROM application_audit ORDER BY audit_id`,
  ).all();
  return Object.freeze(rows.map((row) => {
    const detailsText = sqliteText(row.details_json, "application_audit.details_json");
    let details: unknown;
    try {
      details = JSON.parse(detailsText);
    } catch (error) {
      throw persistenceFailure("CORRUPT_ROW", "Application audit details are not JSON", {}, error);
    }
    let detailRecord: Readonly<Record<string, unknown>>;
    try {
      detailRecord = exactRecord(details, ["action", "reason", "targetKind", "targetRevision"], "audit details");
    } catch (error) {
      throw persistenceFailure("CORRUPT_ROW", "Application audit details have an unsafe or unknown field", {}, error);
    }
    if (
      canonicalJson(detailRecord) !== detailsText ||
      !isNonemptyString(detailRecord.reason) ||
      !(TARGET_KINDS as ReadonlySet<string>).has(String(detailRecord.targetKind)) ||
      !(detailRecord.targetRevision === null || (typeof detailRecord.targetRevision === "number" && Number.isSafeInteger(detailRecord.targetRevision) && detailRecord.targetRevision > 0))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Application audit details are not the canonical bounded shape");
    }
    const record: ApplicationAuditRecord = Object.freeze({
      auditId: sqliteText(row.audit_id, "application_audit.audit_id"),
      requestId: sqliteText(row.request_id, "application_audit.request_id"),
      decisionId: sqliteNullableText(row.decision_id, "application_audit.decision_id"),
      eventKind: enumText(row.event_kind, "application_audit.event_kind", AUDIT_KINDS),
      result: enumText(row.result, "application_audit.result", AUDIT_RESULTS),
      actorId: sqliteText(row.actor_id, "application_audit.actor_id"),
      correlationId: sqliteText(row.correlation_id, "application_audit.correlation_id"),
      targetKind: enumText(row.target_kind, "application_audit.target_kind", TARGET_KINDS),
      targetId: sqliteText(row.target_id, "application_audit.target_id"),
      targetRevision: nullablePositive(row.target_revision, "application_audit.target_revision"),
      reason: sqliteText(row.reason, "application_audit.reason"),
      createdAt: timestamp(row.created_at, "application_audit.created_at"),
    });
    return Object.freeze({
      record,
      details: Object.freeze({
        action: action(detailRecord.action, "application_audit.details_json.action"),
        reason: detailRecord.reason as string,
        targetKind: detailRecord.targetKind as TargetKind,
        targetRevision: detailRecord.targetRevision as number | null,
      }),
    });
  }));
}

function readApplicationStateUntransactional(database: SqliteDatabase): ApplicationState {
  const domain = readDomainSnapshotUntransactional(database);
  const projects = readProjects(database);
  const bootstrap = readBootstrap(database);
  const identity = readIdentity(database);
  const grants = readGrants(database);
  const epochs = readEpochs(database);
  const requests = readRequests(database);
  const decisions = readDecisions(database);
  const decodedAudit = readAudit(database);
  const audit = Object.freeze(decodedAudit.map((event) => event.record));
  const lifecycle = readLifecycle(database);
  const executionSequences = readExecutionSequences(database);
  const executions = readExecutionAttempts(database);
  const executionOperationRequests = readExecutionOperationRequests(database);
  const executionAuthorizationDecisions = readExecutionAuthorizationDecisions(database);
  const executionOperationAudit = readExecutionOperationAudit(database);
  const executionIntents = readExecutionIntents(database);
  const executionIntentAuthorizationBindings = readExecutionIntentAuthorizationBindings(database);
  const executionObservations = readExecutionObservations(database);
  const executionReceipts = readExecutionReceipts(database);
  const executionFinalizations = readExecutionFinalizations(database);
  const executionTerminalStates = readExecutionTerminalStates(database);
  const manualTurns = readManualTurns(database);
  const manualBackendOperations = readManualBackendOperations(database);
  const manualCompletionDecisions = readManualCompletionDecisions(database);
  const dispatcherTriggerRequests = readDispatcherTriggerRequests(database);
  const dispatcherAuthorizationDecisions = readDispatcherAuthorizationDecisions(database);
  const dispatcherRuns = readDispatcherRuns(database);
  const dispatcherAudit = readDispatcherAudit(database);
  const dispatcherReconciliationItems = readDispatcherReconciliationItems(database);
  const dispatcherReconciliationSummaries = readDispatcherReconciliationSummaries(database);
  const dispatcherMemberships = readDispatcherMemberships(database);
  const dispatcherMembers = readDispatcherMembers(database);
  const dispatcherMemberDenialRequests = readDispatcherMemberDenialRequests(database);
  const dispatcherMemberDenialDecisions = readDispatcherMemberDenialDecisions(database);
  const dispatcherMemberDenialAudit = readDispatcherMemberDenialAudit(database);
  const dispatcherRunSummaries = readDispatcherRunSummaries(database);
  const grantRelationRows = database.prepare(
    `SELECT grant_id, action, capability_epoch_id, created_request_id, revoked_request_id
     FROM authorization_grants ORDER BY grant_id`,
  ).all();
  const domainProjectIds = new Set(domain.projects.map((project) => project.id));
  if (projects.some((project) => !domainProjectIds.has(project.projectId) || project.updatedAt < project.createdAt)) {
    throw persistenceFailure("CORRUPT_ROW", "ProjectRegistry contains a Project absent from the Domain snapshot");
  }
  const requestById = new Map(requests.map((request) => [request.requestId, request]));
  const decisionByRequest = new Map(decisions.map((decision) => [decision.requestId, decision]));
  const decisionIds = new Set(decisions.map((decision) => decision.decisionId));
  const grantIds = new Set(grants.map((grant) => grant.grantId));
  const grantById = new Map(grants.map((grant) => [grant.grantId, grant]));
  const grantRelations = grantRelationRows.map((row) => Object.freeze({
    grantId: sqliteText(row.grant_id, "authorization_grants.grant_id"),
    action: grantAction(row.action, "authorization_grants.action"),
    capabilityEpochId: sqliteNullableText(row.capability_epoch_id, "authorization_grants.capability_epoch_id"),
    createdRequestId: sqliteText(row.created_request_id, "authorization_grants.created_request_id"),
    revokedRequestId: sqliteNullableText(row.revoked_request_id, "authorization_grants.revoked_request_id"),
  }));
  if (new Set(grantRelations.map((relation) => relation.grantId)).size !== grantRelations.length) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization grant relation identifiers are not globally unique");
  }
  const grantRelationById = new Map(grantRelations.map((relation) => [relation.grantId, relation]));
  const vocabularySevenEpochIds = new Set(epochs.filter((epoch) => epoch.vocabularyVersion === 7).map((epoch) => epoch.epochId));
  const authorizationGrantEpochLinks = Object.freeze(grantRelations
    .filter((relation) => relation.capabilityEpochId !== null && vocabularySevenEpochIds.has(relation.capabilityEpochId))
    .map((relation): AuthorizationGrantEpochLinkRecord => Object.freeze({
      grantId: relation.grantId,
      action: relation.action,
      capabilityEpochId: relation.capabilityEpochId as string,
    })));
  if ((bootstrap === null) !== (grants.length === 0)) {
    throw persistenceFailure("CORRUPT_ROW", "Bootstrap and grant existence do not form one initialized authorization state");
  }
  if (bootstrap !== null) {
    const request = requestById.get(bootstrap.requestId);
    if (
      request === undefined ||
      request.result !== "bootstrap" ||
      request.actorId !== bootstrap.actorId ||
      request.action !== "authorization.grant.issue" ||
      request.targetKind !== "runtime" ||
      request.targetId !== "runtime" ||
      request.targetRevision !== null ||
      request.createdAt !== bootstrap.createdAt ||
      bootstrap.expiresAt <= bootstrap.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Bootstrap request binding is incomplete");
    }
    const fixedActions = PHASE1_AUTHORIZATION_ACTIONS;
    const fixedRelations = grantRelations.filter((relation) => relation.createdRequestId === bootstrap.requestId);
    if (fixedRelations.length !== fixedActions.length) {
      throw persistenceFailure("CORRUPT_ROW", "Bootstrap does not own one fixed grant for every implemented action");
    }
    for (const fixedAction of fixedActions) {
      const matches = fixedRelations
        .map((relation) => grantById.get(relation.grantId))
        .filter((grant): grant is AuthorizationGrant => grant?.action === fixedAction);
      const grant = matches[0];
      if (
        matches.length !== 1 ||
        grant === undefined ||
        grant.actorId !== bootstrap.actorId ||
        grant.scope.kind !== "runtime" ||
        grant.issuerGrantId !== null ||
        grant.sourceGrantId !== null ||
        grant.notBefore !== bootstrap.createdAt ||
        grant.expiresAt !== bootstrap.expiresAt
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Bootstrap fixed-grant set is incomplete or broadened");
      }
    }
  }
  if (bootstrap === null && (identity !== null || epochs.length !== 0 || lifecycle.length !== 0)) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization identity lineage exists without bootstrap");
  }
  if (identity === null && epochs.length !== 0) {
    throw persistenceFailure("CORRUPT_ROW", "Capability epochs exist without a local identity");
  }
  if (bootstrap !== null) {
    if (
      identity === null ||
      identity.actorId !== bootstrap.actorId ||
      identity.principalSha256 !== bootstrap.trustedPrincipal ||
      identity.platform !== bootstrap.platform ||
      identity.runtimeRootKey !== bootstrap.rootKey ||
      identity.bootstrapRequestId !== bootstrap.requestId ||
      identity.createdAt !== bootstrap.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Vocabulary-v4 bootstrap does not bind the immutable local identity");
    }
  }
  const phase1ActionSetSha256 = sha256(canonicalJson(PHASE1_AUTHORIZATION_ACTIONS));
  const phase2aActionSetSha256 = sha256(canonicalJson(PHASE2A_AUTHORIZATION_ACTIONS));
  const phase2bActionSetSha256 = sha256(canonicalJson(PHASE2B_AUTHORIZATION_ACTIONS));
  const currentActionSetSha256 = sha256(canonicalJson(AUTHORIZATION_ACTIONS));
  for (let index = 0; index < epochs.length; index += 1) {
    const epoch = epochs[index];
    const request = epoch === undefined ? undefined : requestById.get(epoch.requestId);
    const previousVocabulary = index === 0 ? 4 : epochs[index - 1]?.vocabularyVersion;
    const isUpgrade = epoch !== undefined && previousVocabulary !== undefined && epoch.vocabularyVersion === previousVocabulary + 1;
    const isRenewal = epoch?.vocabularyVersion === previousVocabulary;
    const expectedActionSetSha256 = epoch?.vocabularyVersion === 7
      ? currentActionSetSha256
      : epoch?.vocabularyVersion === 6
        ? phase2bActionSetSha256
      : epoch?.vocabularyVersion === 5
        ? phase2aActionSetSha256
        : phase1ActionSetSha256;
    if (
      epoch === undefined ||
      identity === null ||
      epoch.epochRevision !== index + 1 ||
      epoch.actorId !== identity.actorId ||
      epoch.runtimeRootKey !== identity.runtimeRootKey ||
      previousVocabulary === undefined ||
      (!isUpgrade && !isRenewal) ||
      epoch.actionSetSha256 !== expectedActionSetSha256 ||
      epoch.createdAt >= epoch.expiresAt ||
      request === undefined ||
      request.action !== (isUpgrade ? "authorization.capability.upgrade" : "authorization.capability.renew") ||
      request.result !== (isUpgrade ? "upgrade" : "renewal") ||
      request.actorId !== epoch.actorId ||
      request.createdAt !== epoch.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Capability epoch lineage is incomplete or non-contiguous");
    }
    const epochRelations = grantRelations.filter((relation) => relation.capabilityEpochId === epoch.epochId);
    const expectedActions = epoch.vocabularyVersion === 7
      ? AUTHORIZATION_ACTIONS
      : epoch.vocabularyVersion === 6
        ? PHASE2B_AUTHORIZATION_ACTIONS
      : epoch.vocabularyVersion === 5
        ? PHASE2A_AUTHORIZATION_ACTIONS
        : PHASE1_AUTHORIZATION_ACTIONS;
    const actionSet = new Set(epochRelations.map((relation) => relation.action));
    if (
      epochRelations.length !== expectedActions.length ||
      actionSet.size !== expectedActions.length ||
      expectedActions.some((expected) => !actionSet.has(expected))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Capability epoch grant action inventory is not exact");
    }
  }
  const bootstrapRequests = requests.filter((request) => request.result === "bootstrap");
  if ((bootstrap === null && bootstrapRequests.length !== 0) || (bootstrap !== null && (bootstrapRequests.length !== 1 || bootstrapRequests[0]?.requestId !== bootstrap.requestId))) {
    throw persistenceFailure("CORRUPT_ROW", "Bootstrap consumption does not have one exact immutable request");
  }
  if (requests.some((request) => !requestTargetIsValid(request))) {
    throw persistenceFailure("CORRUPT_ROW", "Application request target shape does not match its action");
  }
  for (const grant of grants) {
    if (grant.scope.kind === "project") {
      const project = grant.scope.projectId === null
        ? undefined
        : projects.find((candidate) => candidate.projectId === grant.scope.projectId);
      if (
        project === undefined ||
        grant.scope.resourceRevision === null ||
        grant.scope.configRevision === null ||
        grant.scope.resourceRevision > project.resourceRevision ||
        grant.scope.configRevision > project.configRevision
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Project-scoped grant refers to an absent or impossible ProjectRegistry revision");
      }
    }
    if (
      (grant.issuerGrantId === null) !== (grant.sourceGrantId === null) ||
      (grant.issuerGrantId !== null && !grantIds.has(grant.issuerGrantId)) ||
      (grant.sourceGrantId !== null && !grantIds.has(grant.sourceGrantId))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Grant administrative or source relation is incomplete");
    }
    if ((grant.revokedAt === null && grant.revision !== 1) || (grant.revokedAt !== null && grant.revision !== 2)) {
      throw persistenceFailure("CORRUPT_ROW", "Grant revision is inconsistent with its irreversible revocation state");
    }
  }
  if (grantRelationRows.length !== grants.length) {
    throw persistenceFailure("CORRUPT_ROW", "Grant request relation inventory is incomplete");
  }
  for (const relation of grantRelations) {
    const grant = grantById.get(relation.grantId);
    const createdRequest = requestById.get(relation.createdRequestId);
    const createdDecision = decisionByRequest.get(relation.createdRequestId);
    const capabilityEpoch = relation.capabilityEpochId === null
      ? undefined
      : epochs.find((epoch) => epoch.epochId === relation.capabilityEpochId);
    const revokedRequestId = relation.revokedRequestId;
    const revokedRequest = revokedRequestId === null ? null : requestById.get(revokedRequestId);
    if (
      grant === undefined ||
      relation.action !== grant.action ||
      createdRequest === undefined ||
      (
        createdRequest.result !== "bootstrap" &&
        createdRequest.result !== "allow" &&
        createdRequest.result !== "renewal" &&
        createdRequest.result !== "upgrade"
      ) ||
      (grant.revokedAt === null) !== (revokedRequestId === null) ||
      (createdRequest.result === "bootstrap" && (
        bootstrap === null ||
        createdRequest.requestId !== bootstrap.requestId ||
        relation.capabilityEpochId !== null
      )) ||
      (createdRequest.result === "allow" && (
        createdRequest.action !== "authorization.grant.issue" ||
        createdRequest.targetKind !== "grant" ||
        createdRequest.targetId !== grant.grantId ||
        createdRequest.targetRevision !== null ||
        relation.capabilityEpochId !== null ||
        grant.issuerGrantId === null ||
        grant.sourceGrantId === null ||
        grant.notBefore < createdRequest.createdAt ||
        createdDecision?.grantId !== grant.issuerGrantId ||
        !issuedGrantMatchesDecision(grant, createdDecision)
      )) ||
      ((createdRequest.result === "renewal" || createdRequest.result === "upgrade") && (
        createdRequest.action !== (createdRequest.result === "upgrade"
          ? "authorization.capability.upgrade"
          : "authorization.capability.renew") ||
        capabilityEpoch === undefined ||
        capabilityEpoch.requestId !== createdRequest.requestId ||
        grant.actorId !== capabilityEpoch.actorId ||
        grant.scope.kind !== "runtime" ||
        grant.issuerGrantId !== null ||
        grant.sourceGrantId !== null ||
        grant.notBefore !== capabilityEpoch.createdAt ||
        grant.expiresAt !== capabilityEpoch.expiresAt
      )) ||
      (revokedRequestId !== null && (
        revokedRequest?.result !== "allow" ||
        revokedRequest.action !== "authorization.grant.revoke" ||
        revokedRequest.targetKind !== "grant" ||
        revokedRequest.targetId !== grant.grantId ||
        revokedRequest.targetRevision !== grant.revision - 1 ||
        revokedRequest.createdAt !== grant.revokedAt
      ))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Grant creation or revocation request binding is incomplete");
    }
  }
  for (const grant of grants) {
    if (grant.issuerGrantId === null || grant.sourceGrantId === null) continue;
    const relation = grantRelationById.get(grant.grantId);
    const createdRequest = relation === undefined ? undefined : requestById.get(relation.createdRequestId);
    const administrative = grantById.get(grant.issuerGrantId);
    const source = grantById.get(grant.sourceGrantId);
    if (
      createdRequest === undefined ||
      administrative === undefined ||
      source === undefined ||
      !grantWasUsableAt(administrative, createdRequest.actorId, "authorization.grant.issue", createdRequest.createdAt) ||
      !grantWasUsableAt(source, createdRequest.actorId, grant.action, createdRequest.createdAt) ||
      grant.notBefore < createdRequest.createdAt ||
      grant.expiresAt > administrative.expiresAt ||
      grant.expiresAt > source.expiresAt ||
      !scopeContains(administrative.scope, grant.scope) ||
      !scopeContains(source.scope, grant.scope)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Delegated grant does not preserve exact administrative and source authority");
    }
  }
  const provenance = new Map<string, boolean>();
  const reachesBootstrap = (grantId: string, visiting: ReadonlySet<string>): boolean => {
    const known = provenance.get(grantId);
    if (known !== undefined) return known;
    if (visiting.has(grantId)) return false;
    const grant = grantById.get(grantId);
    const relation = grantRelationById.get(grantId);
    if (grant === undefined || relation === undefined) return false;
    if (grant.issuerGrantId === null || grant.sourceGrantId === null) {
      const epoch = relation.capabilityEpochId === null
        ? undefined
        : epochs.find((candidate) => candidate.epochId === relation.capabilityEpochId);
      const rooted = grant.issuerGrantId === null && grant.sourceGrantId === null && (
        (bootstrap !== null && relation.createdRequestId === bootstrap.requestId && relation.capabilityEpochId === null) ||
        (epoch !== undefined && epoch.requestId === relation.createdRequestId)
      );
      provenance.set(grantId, rooted);
      return rooted;
    }
    const next = new Set(visiting);
    next.add(grantId);
    const rooted = reachesBootstrap(grant.issuerGrantId, next) && reachesBootstrap(grant.sourceGrantId, next);
    provenance.set(grantId, rooted);
    return rooted;
  };
  if (grants.some((grant) => !reachesBootstrap(grant.grantId, new Set()))) {
    throw persistenceFailure("CORRUPT_ROW", "Grant provenance does not terminate at the immutable bootstrap grant set");
  }
  for (const request of requests) {
    const createdCount = grantRelations.filter((relation) => relation.createdRequestId === request.requestId).length;
    const revokedCount = grantRelations.filter((relation) => relation.revokedRequestId === request.requestId).length;
    const expectedCreatedCount = request.result === "bootstrap"
      ? PHASE1_AUTHORIZATION_ACTIONS.length
      : request.result === "renewal" || request.result === "upgrade"
        ? (() => {
            const epoch = epochs.find((candidate) => candidate.requestId === request.requestId);
            return epoch?.vocabularyVersion === 7
              ? AUTHORIZATION_ACTIONS.length
              : epoch?.vocabularyVersion === 6
                ? PHASE2B_AUTHORIZATION_ACTIONS.length
                : epoch?.vocabularyVersion === 5
                  ? PHASE2A_AUTHORIZATION_ACTIONS.length
                  : PHASE1_AUTHORIZATION_ACTIONS.length;
          })()
      : request.result === "allow" && request.action === "authorization.grant.issue"
        ? 1
        : 0;
    const expectedRevokedCount = request.result === "allow" && request.action === "authorization.grant.revoke" ? 1 : 0;
    if (createdCount !== expectedCreatedCount || revokedCount !== expectedRevokedCount) {
      throw persistenceFailure("CORRUPT_ROW", "Grant transition and accepted request are not an exact operation pair");
    }
  }
  for (const decision of decisions) {
    const request = requestById.get(decision.requestId);
    const renewal = request?.action === "authorization.capability.renew" && request.result === "renewal";
    const upgrade = request?.action === "authorization.capability.upgrade" && request.result === "upgrade";
    const capabilityTransition = renewal || upgrade;
    if (
      request === undefined ||
      (!capabilityTransition && request.result !== decision.result) ||
      (capabilityTransition && (decision.result !== "allow" || decision.reason !== "allowed" ||
        decision.policy !== "allow" || decision.grantId !== null ||
        decision.grantRevision !== null || decision.projectId !== null || decision.resourceRevision !== null)) ||
      request.actorId !== decision.actorId ||
      request.action !== decision.action ||
      request.createdAt !== decision.createdAt ||
      !decisionPolicyIsValid(decision) ||
      !decisionTargetIsValid(request, decision) ||
      (decision.result === "allow") !== (decision.reason === "allowed") ||
      (decision.result === "allow" && decision.grantId === null && !capabilityTransition) ||
      (decision.grantId === null) !== (decision.grantRevision === null) ||
      (decision.projectId === null) !== (decision.resourceRevision === null)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Authorization decision does not exactly bind its request and resources");
    }
    if (
      (decision.reason === "policy_denied" && (decision.result !== "deny" || decision.policy !== "deny" || decision.grantId === null)) ||
      (decision.reason === "confirmation_required" && (
        decision.result !== "deny" ||
        decision.policy === "deny" ||
        decision.grantId === null ||
        (
          decision.action !== "authorization.capability.renew" &&
          decision.action !== "authorization.capability.upgrade" &&
          !isHighRiskAction(decision.action)
        )
      )) ||
      (
        decision.reason !== "allowed" &&
        decision.reason !== "policy_denied" &&
        decision.reason !== "confirmation_required" &&
        !(decision.reason === "scope_mismatch" && (decision.action === "authorization.grant.issue" || decision.action === "task.cancel")) &&
        decision.grantId !== null
      ) ||
      (decision.reason === "allowed" && decision.policy === "deny")
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Authorization decision reason, result, policy, and grant shape are inconsistent");
    }
    if (decision.grantId !== null) {
      const grant = grantById.get(decision.grantId);
      if (
        grant === undefined ||
        decision.grantRevision !== 1 ||
        grant.actorId !== decision.actorId ||
        grant.action !== decision.action ||
        grant.notBefore > decision.createdAt ||
        grant.expiresAt <= decision.createdAt ||
        (grant.revokedAt !== null && grant.revokedAt < decision.createdAt) ||
        (grant.scope.kind === "project" && (
          decision.projectId !== grant.scope.projectId ||
          decision.resourceRevision !== grant.scope.resourceRevision
        ))
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Authorization decision refers to an absent or impossible grant revision");
      }
    }
    if (decision.projectId !== null) {
      const project = projects.find((candidate) => candidate.projectId === decision.projectId);
      if (project === undefined || decision.resourceRevision === null || decision.resourceRevision > project.resourceRevision) {
        throw persistenceFailure("CORRUPT_ROW", "Authorization decision refers to an absent or impossible ProjectRegistry revision");
      }
    }
  }
  for (const request of requests) {
    const decision = decisionByRequest.get(request.requestId);
    if ((request.result === "bootstrap") !== (decision === undefined)) {
      throw persistenceFailure("CORRUPT_ROW", "Request consumption and decision relation is incomplete");
    }
  }
  const auditRequests = new Set<string>();
  for (const decoded of decodedAudit) {
    const event = decoded.record;
    const details = decoded.details;
    const request = requestById.get(event.requestId);
    const decision = decisionByRequest.get(event.requestId);
    const expectedEventKind = request?.result === "bootstrap"
      ? "bootstrap"
      : request?.result === "deny"
        ? "authorization.denied"
        : request === undefined
          ? null
          : request.action === "authorization.capability.renew"
            ? "capability.renewed"
            : request.action === "authorization.capability.upgrade"
              ? "capability.upgraded"
              : applicationAuditKind(request.action);
    const expectedReason = request?.result === "bootstrap"
      ? "bootstrap"
      : request?.result === "deny"
        ? decision?.reason ?? null
        : "accepted";
    if (
      request === undefined ||
      request.actorId !== event.actorId ||
      request.correlationId !== event.correlationId ||
      request.targetKind !== event.targetKind ||
      request.targetId !== event.targetId ||
      request.targetRevision !== event.targetRevision ||
      request.createdAt !== event.createdAt ||
      (event.eventKind === "bootstrap") !== (event.decisionId === null) ||
      (event.result === "denied") !== (request.result === "deny") ||
      event.eventKind !== expectedEventKind ||
      event.reason !== expectedReason ||
      details.action !== request.action ||
      details.reason !== event.reason ||
      details.targetKind !== event.targetKind ||
      details.targetRevision !== event.targetRevision ||
      (event.decisionId !== null && (
        decision === undefined ||
        decision.decisionId !== event.decisionId ||
        decision.createdAt !== event.createdAt
      ))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Audit event does not bind its consumed request");
    }
    if (event.decisionId !== null && !decisionIds.has(event.decisionId)) {
      throw persistenceFailure("CORRUPT_ROW", "Audit event refers to an absent decision");
    }
    auditRequests.add(event.requestId);
  }
  if (auditRequests.size !== requests.length || requests.some((request) => !auditRequests.has(request.requestId))) {
    throw persistenceFailure("CORRUPT_ROW", "Every consumed request must have exactly one audit event");
  }
  const taskById = new Map(domain.tasks.map((task) => [task.id, task]));
  const executionById = new Map(executions.map((execution) => [execution.executionId, execution]));
  const sequenceByTask = new Map(executionSequences.map((sequence) => [sequence.taskId, sequence]));
  const terminalByExecution = new Map(executionTerminalStates.map((terminal) => [terminal.executionId, terminal]));
  if (executionById.size !== executions.length || sequenceByTask.size !== executionSequences.length) {
    throw persistenceFailure("CORRUPT_ROW", "Execution identity inventory is not unique");
  }
  for (const sequence of executionSequences) {
    const task = taskById.get(sequence.taskId);
    const attempts = executions.filter((execution) => execution.taskId === sequence.taskId);
    const active = attempts.filter((execution) => execution.status === "active");
    const terminal = active[0] === undefined ? undefined : terminalByExecution.get(active[0].executionId);
    const taskStateMatchesExecution = task?.state === "running" || task?.state === "waiting"
      ? terminal === undefined
      : (task?.state === "completed" && terminal?.status === "completed") ||
        (task?.state === "cancelled" && terminal?.status === "cancelled");
    if (
      task === undefined ||
      !taskStateMatchesExecution ||
      attempts.length !== sequence.lastAttemptNumber ||
      sequence.revision !== sequence.lastAttemptNumber ||
      active.length !== 1 ||
      active[0]?.attemptNumber !== sequence.lastAttemptNumber ||
      active[0]?.fencingToken !== sequence.currentFencingToken
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Task execution sequence is incomplete or has no unique active attempt");
    }
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      const previous = index === 0 ? undefined : attempts[index - 1];
      const next = attempts[index + 1];
      const request = attempt === undefined ? undefined : requestById.get(attempt.requestId);
      const decision = attempt === undefined ? undefined : decisionByRequest.get(attempt.requestId);
      const project = attempt === undefined
        ? undefined
        : projects.find((candidate) => candidate.projectId === task.projectId);
      if (
        attempt === undefined ||
        attempt.attemptNumber !== index + 1 ||
        attempt.fencingToken !== index + 1 ||
        attempt.revision < 1 ||
        attempt.leaseRevision < 1 ||
        attempt.requestedLeaseSeconds < 30 || attempt.requestedLeaseSeconds > 3600 ||
        attempt.updatedAt < attempt.createdAt ||
        (attempt.leaseRevision === 1 && attempt.leaseExpiresAt !== new Date(
          new Date(attempt.createdAt).valueOf() + attempt.requestedLeaseSeconds * 1000,
        ).toISOString()) ||
        (attempt.status === "active" && attempt.leaseExpiresAt <= attempt.updatedAt) ||
        attempt.expectedTaskRevision !== attempt.preTaskRevision ||
        task.revision < attempt.postTaskRevision ||
        project === undefined ||
        attempt.projectResourceRevision > project.resourceRevision ||
        attempt.projectConfigRevision > project.configRevision ||
        request === undefined ||
        request.requestId !== attempt.requestId ||
        request.action !== (attempt.operationKind === "claim" ? "execution.claim" : "execution.lease.takeover") ||
        request.result !== "allow" ||
        request.targetKind !== "execution" ||
        request.targetId !== attempt.executionId ||
        request.targetRevision !== 1 ||
        request.createdAt !== attempt.createdAt ||
        decision === undefined ||
        decision.decisionId !== attempt.decisionId ||
        decision.requestId !== attempt.requestId ||
        decision.projectId !== task.projectId ||
        decision.resourceRevision !== attempt.projectResourceRevision ||
        (attempt.operationKind === "claim" && (
          index !== 0 ||
          attempt.postTaskRevision !== attempt.preTaskRevision + 1 ||
          attempt.supersedesExecutionId !== null ||
          attempt.predecessorExecutionRevision !== null ||
          attempt.predecessorLeaseRevision !== null ||
          attempt.predecessorFencingToken !== null
        )) ||
        (attempt.operationKind === "takeover" && (
          index === 0 ||
          attempt.postTaskRevision !== attempt.preTaskRevision ||
          attempt.supersedesExecutionId !== previous?.executionId ||
          attempt.predecessorExecutionRevision !== (previous?.revision ?? 0) - 1 ||
          attempt.predecessorLeaseRevision !== previous?.leaseRevision ||
          attempt.predecessorFencingToken !== previous?.fencingToken
        )) ||
        (attempt.status === "active" && (
          next !== undefined ||
          attempt.supersededByExecutionId !== null
        )) ||
        (attempt.status === "superseded" && (
          next === undefined ||
          attempt.supersededByExecutionId !== next.executionId
        ))
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Execution attempt lineage or authorization binding is inconsistent");
      }
    }
  }
  if (executions.some((execution) => !sequenceByTask.has(execution.taskId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution attempt exists without its Task sequence");
  }
  for (const request of requests) {
    if (!request.action.startsWith("execution.") || request.result !== "allow") continue;
    const execution = executionById.get(request.targetId);
    if (execution === undefined || request.targetRevision === null || request.targetRevision > execution.revision) {
      throw persistenceFailure("CORRUPT_ROW", "Accepted execution request refers to an absent or stale execution revision");
    }
  }
  const executionRequestById = new Map(executionOperationRequests.map((request) => [request.requestId, request]));
  const executionDecisionById = new Map(executionAuthorizationDecisions.map((decision) => [decision.decisionId, decision]));
  const executionDecisionByRequest = new Map(executionAuthorizationDecisions.map((decision) => [decision.requestId, decision]));
  const intentById = new Map(executionIntents.map((intent) => [intent.intentId, intent]));
  const authorizationBindingByDecision = new Map(
    executionIntentAuthorizationBindings.map((binding) => [binding.decisionId, binding]),
  );
  const receiptById = new Map(executionReceipts.map((receipt) => [receipt.verifiedReceiptId, receipt]));
  const finalizationById = new Map(executionFinalizations.map((finalization) => [finalization.finalizationId, finalization]));
  const manualTurnByBackendId = new Map(manualTurns.map((turn) => [turn.backendExecutionId, turn]));
  if (
    executionRequestById.size !== executionOperationRequests.length ||
    executionDecisionById.size !== executionAuthorizationDecisions.length ||
    executionDecisionByRequest.size !== executionAuthorizationDecisions.length ||
    intentById.size !== executionIntents.length ||
    authorizationBindingByDecision.size !== executionIntentAuthorizationBindings.length ||
    receiptById.size !== executionReceipts.length ||
    finalizationById.size !== executionFinalizations.length || manualTurnByBackendId.size !== manualTurns.length
  ) throw persistenceFailure("CORRUPT_ROW", "Phase 2 execution identity inventory is not unique");
  for (const request of executionOperationRequests) {
    const execution = executionById.get(request.targetExecutionId);
    const decision = executionDecisionByRequest.get(request.requestId);
    const requestAudit = executionOperationAudit.filter((event) => event.requestId === request.requestId);
    if (
      execution === undefined || request.targetRevision > execution.revision || decision === undefined ||
      decision.actorId !== request.actorId || decision.action !== request.action || decision.result !== request.result ||
      decision.requestId !== request.requestId || decision.createdAt !== request.createdAt ||
      requestAudit.length === 0 || requestAudit.some((event) =>
        event.decisionId !== decision.decisionId || event.actorId !== request.actorId ||
        event.correlationId !== request.correlationId || event.executionId !== request.targetExecutionId ||
        event.executionRevision < request.targetRevision || event.executionRevision > execution.revision ||
        event.createdAt < request.createdAt || (event.result === "accepted") !== (request.result === "allow")
      ) ||
      (request.result === "allow" && (
        decision.reason !== "allowed" || decision.grantId === null || decision.grantRevision !== 1
      )) ||
      (request.result === "deny" && decision.reason === "allowed")
    ) throw persistenceFailure("CORRUPT_ROW", "Execution request, decision, audit, and target binding is inconsistent");
    const project = projects.find((candidate) => candidate.projectId === decision.projectId);
    if (project === undefined || decision.resourceRevision > project.resourceRevision ||
      decision.configRevision > project.configRevision) {
      throw persistenceFailure("CORRUPT_ROW", "Execution decision Project binding is impossible");
    }
    if (decision.grantId !== null) {
      const grant = grantById.get(decision.grantId);
      if (
        grant === undefined || grant.actorId !== decision.actorId || grant.action !== decision.action ||
        grant.notBefore > decision.createdAt || grant.expiresAt <= decision.createdAt ||
        (grant.revokedAt !== null && grant.revokedAt <= decision.createdAt) ||
        (grant.scope.kind === "project" && (
          grant.scope.projectId !== decision.projectId || grant.scope.resourceRevision !== decision.resourceRevision ||
          grant.scope.configRevision !== decision.configRevision
        ))
      ) throw persistenceFailure("CORRUPT_ROW", "Execution decision grant binding is impossible");
    }
  }
  if (executionAuthorizationDecisions.some((decision) => !executionRequestById.has(decision.requestId)) ||
      executionOperationAudit.some((event) => !executionRequestById.has(event.requestId) || !executionDecisionById.has(event.decisionId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution decision or audit is orphaned");
  }
  const operationIds = new Set<string>();
  const operationIdempotency = new Set<string>();
  for (const intent of executionIntents) {
    const request = executionRequestById.get(intent.requestId);
    const decision = executionDecisionById.get(intent.decisionId);
    const execution = executionById.get(intent.executionId);
    const task = taskById.get(intent.taskId);
    const project = projects.find((candidate) => candidate.projectId === intent.projectId);
    const sourceExecution = intent.sourceExecutionId === null ? undefined : executionById.get(intent.sourceExecutionId);
    const hasSuccessorSource = intent.sourceExecutionId !== null;
    if (
      operationIds.has(intent.operationId) || operationIdempotency.has(intent.idempotencyKey) ||
      request === undefined || request.result !== "allow" || request.actorId !== intent.actorId ||
      request.action !== intent.action || request.targetExecutionId !== intent.executionId ||
      request.targetRevision !== intent.executionRevision || decision === undefined || decision.requestId !== intent.requestId ||
      decision.result !== "allow" || decision.action !== intent.action || decision.actorId !== intent.actorId ||
      execution === undefined || execution.taskId !== intent.taskId || execution.revision < intent.executionRevision ||
      execution.attemptNumber !== intent.attemptNumber || execution.fencingToken !== intent.fencingToken ||
      task === undefined || task.revision < intent.taskRevision || task.projectId !== intent.projectId ||
      project === undefined || project.resourceRevision < intent.projectResourceRevision ||
      project.configRevision < intent.projectConfigRevision || intent.updatedAt < intent.createdAt ||
      intent.requestedDeadline <= intent.createdAt ||
      (intent.operationKind === "retry" && !hasSuccessorSource) ||
      (hasSuccessorSource && (
        (intent.operationKind !== "resume" && intent.operationKind !== "retry") || sourceExecution === undefined ||
        intent.sourceExecutionRevision !== sourceExecution.revision - 1 ||
        intent.sourceAttemptNumber !== sourceExecution.attemptNumber ||
        intent.sourceFencingToken !== sourceExecution.fencingToken ||
        intent.sourceObservationNumber === null ||
        sourceExecution.status !== "superseded" || execution.supersedesExecutionId !== sourceExecution.executionId ||
        execution.attemptNumber !== sourceExecution.attemptNumber + 1 ||
        execution.fencingToken !== sourceExecution.fencingToken + 1
      )) ||
      (!hasSuccessorSource && (intent.sourceExecutionRevision !== null || intent.sourceAttemptNumber !== null ||
        intent.sourceFencingToken !== null || intent.sourceObservationNumber !== null))
    ) throw persistenceFailure("CORRUPT_ROW", "Execution intent semantic, authorization, or revision binding is inconsistent");
    operationIds.add(intent.operationId);
    operationIdempotency.add(intent.idempotencyKey);
    const bindings = executionIntentAuthorizationBindings
      .filter((candidate) => candidate.intentId === intent.intentId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const currentBinding = bindings.at(-1);
    if (
      bindings.length === 0 || currentBinding === undefined ||
      currentBinding.bindingRevision !== intent.authorizationBindingRevision ||
      currentBinding.decisionId !== intent.currentAuthorizationDecisionId ||
      bindings.some((binding, index) => {
        const boundRequest = executionRequestById.get(binding.requestId);
        const boundDecision = executionDecisionById.get(binding.decisionId);
        const boundAudit = executionOperationAudit.find((event) => event.auditId === binding.auditId);
        const previous = index === 0 ? undefined : bindings[index - 1];
        const expectedPhase = index === 0 ? "prepare" : binding.phase;
        return binding.bindingRevision !== index + 1 || binding.phase !== expectedPhase ||
          (index === 0 && (binding.phase !== "prepare" || binding.priorDecisionId !== null ||
            binding.requestId !== intent.requestId || binding.decisionId !== intent.decisionId)) ||
          (index > 0 && binding.priorDecisionId !== previous?.decisionId) ||
          boundRequest?.result !== "allow" || boundRequest.action !== intent.action ||
          boundRequest.actorId !== intent.actorId || boundRequest.targetExecutionId !== intent.executionId ||
          boundRequest.targetRevision !== intent.executionRevision || boundDecision?.result !== "allow" ||
          boundDecision.requestId !== binding.requestId || boundDecision.action !== intent.action ||
          boundDecision.actorId !== intent.actorId || boundDecision.projectId !== intent.projectId ||
          boundDecision.resourceRevision !== intent.projectResourceRevision ||
          boundDecision.configRevision !== intent.projectConfigRevision ||
          boundAudit?.requestId !== binding.requestId || boundAudit.decisionId !== binding.decisionId ||
          boundAudit.result !== "accepted" || boundAudit.actorId !== intent.actorId ||
          boundAudit.executionId !== intent.executionId || boundAudit.executionRevision < intent.executionRevision ||
          boundAudit.createdAt !== binding.createdAt || boundDecision.createdAt !== binding.createdAt ||
          boundRequest.createdAt !== binding.createdAt;
      }) ||
      (intent.state === "pending" && currentBinding.phase !== "prepare") ||
      (intent.state !== "pending" && intent.state !== "executing" && intent.state !== "finalized" &&
        currentBinding.phase !== "act") ||
      (intent.state === "finalized" && currentBinding.phase !== "finalize")
    ) throw persistenceFailure("CORRUPT_ROW", "Execution intent authorization binding chain is inconsistent");
    const observations = executionObservations
      .filter((observation) => observation.intentId === intent.intentId)
      .sort((left, right) => left.observationNumber - right.observationNumber);
    if (observations.some((observation, index) => index > 0 && observation.observationNumber <= (observations[index - 1]?.observationNumber ?? 0))) {
      throw persistenceFailure("CORRUPT_ROW", "Execution observations are not strictly ordered");
    }
    const receipt = executionReceipts.find((candidate) => candidate.intentId === intent.intentId);
    const finalization = executionFinalizations.find((candidate) => candidate.intentId === intent.intentId);
    if (
      (intent.state === "pending" || intent.state === "executing" || intent.state === "retry_wait" || intent.state === "ambiguous" || intent.state === "failed") &&
        (observations.length !== 0 || receipt !== undefined || finalization !== undefined) ||
      intent.state === "observed" && (observations.length === 0 || receipt !== undefined || finalization !== undefined) ||
      intent.state === "verified" && (observations.length === 0 || receipt === undefined || finalization !== undefined) ||
      intent.state === "finalized" && finalization === undefined
    ) throw persistenceFailure("CORRUPT_ROW", "Execution intent state is inconsistent with durable evidence stages");
    if (receipt !== undefined) {
      const observation = observations.find((candidate) => candidate.adapterReceiptId === receipt.adapterReceiptId);
      if (
        observation === undefined || receipt.receiptSha256 !== observation.receiptSha256 ||
        receipt.lifecycle !== observation.lifecycle || receipt.backendExecutionId !== observation.backendExecutionId ||
        receipt.threadId !== observation.threadId || receipt.observationNumber !== observation.observationNumber ||
        receipt.observedRevision !== observation.journalRevision || receipt.fencingToken !== intent.fencingToken
      ) throw persistenceFailure("CORRUPT_ROW", "Verified execution receipt does not reproduce its observation");
    }
    if (finalization !== undefined && (
      finalization.verifiedReceiptId !== (receipt?.verifiedReceiptId ?? null) ||
      finalization.authorizationDecisionId !== currentBinding.decisionId || currentBinding.phase !== "finalize" ||
      finalization.executionRevision < intent.executionRevision || finalization.taskRevision < intent.taskRevision ||
      finalization.finalizedAt < intent.updatedAt
    )) throw persistenceFailure("CORRUPT_ROW", "Execution finalization is inconsistent with its intent and receipt");
  }
  if (executionIntentAuthorizationBindings.some((binding) => !intentById.has(binding.intentId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution intent authorization binding is orphaned");
  }
  for (const observation of executionObservations) {
    const intent = intentById.get(observation.intentId);
    const decision = executionDecisionById.get(observation.authorizationDecisionId);
    const request = decision === undefined ? undefined : executionRequestById.get(decision.requestId);
    if (
      intent === undefined || decision?.result !== "allow" || decision.action !== "execution.inspect" ||
      request?.result !== "allow" || request.action !== "execution.inspect" ||
      request.targetExecutionId !== intent.executionId || request.targetRevision !== intent.executionRevision ||
      observation.observedAt < intent.createdAt
    ) throw persistenceFailure("CORRUPT_ROW", "Execution observation lacks an exact independent inspect allow");
  }
  if (executionReceipts.some((receipt) => !intentById.has(receipt.intentId)) ||
      executionFinalizations.some((finalization) => !intentById.has(finalization.intentId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution receipt or finalization is orphaned");
  }
  for (const turn of manualTurns) {
    const execution = executionById.get(turn.executionId);
    const task = taskById.get(turn.taskId);
    const project = projects.find((candidate) => candidate.projectId === turn.projectId);
    const predecessorTurn = turn.predecessorBackendExecutionId === null
      ? undefined : manualTurnByBackendId.get(turn.predecessorBackendExecutionId);
    if (
      execution === undefined || execution.taskId !== turn.taskId || execution.revision < turn.executionRevision ||
      execution.attemptNumber !== turn.attemptNumber || execution.fencingToken !== turn.fencingToken ||
      task === undefined || task.revision < turn.taskRevision || task.projectId !== turn.projectId ||
      project === undefined || project.resourceRevision < turn.projectResourceRevision ||
      project.configRevision < turn.projectConfigRevision || turn.updatedAt < turn.createdAt ||
      (turn.cancellationRequestRevision === null) !== (turn.cancellationRequestedAt === null) ||
      (turn.predecessorBackendExecutionId === null) !== (turn.predecessorThreadId === null) ||
      (turn.predecessorBackendExecutionId !== null && (
        predecessorTurn === undefined || predecessorTurn.threadId !== turn.predecessorThreadId ||
        execution.supersedesExecutionId !== predecessorTurn.executionId ||
        execution.attemptNumber !== predecessorTurn.attemptNumber + 1 ||
        execution.fencingToken !== predecessorTurn.fencingToken + 1
      ))
    ) throw persistenceFailure("CORRUPT_ROW", "Manual turn semantic, fence, or revision binding is inconsistent");
  }
  for (const operation of manualBackendOperations) {
    const intent = intentById.get(operation.intentId);
    const effectAuthorization = authorizationBindingByDecision.get(operation.authorizationDecisionId);
    const turn = manualTurnByBackendId.get(operation.backendExecutionId);
    const sourceTurn = operation.sourceBackendExecutionId === null
      ? undefined : manualTurnByBackendId.get(operation.sourceBackendExecutionId);
    const hasSourceTurn = operation.sourceBackendExecutionId !== null;
    const expectedKind = intent?.operationKind;
    if (
      intent === undefined || turn === undefined || operation.threadId !== turn.threadId ||
      effectAuthorization?.intentId !== operation.intentId || effectAuthorization.phase !== "act" ||
      operation.expectedFencingToken !== intent.fencingToken || operation.expectedFencingToken !== turn.fencingToken ||
      operation.operationKind !== expectedKind || operation.idempotencyKey !== intent.idempotencyKey ||
      operation.postRevision > turn.revision || operation.createdAt < effectAuthorization.createdAt ||
      (operation.operationKind === "manual_report") !== (operation.reportOperation !== null) ||
      (operation.sourceBackendExecutionId === null) !== (operation.sourceThreadId === null) ||
      (operation.operationKind === "retry" && !hasSourceTurn) ||
      (hasSourceTurn && (
        (operation.operationKind !== "resume" && operation.operationKind !== "retry") ||
        sourceTurn === undefined || sourceTurn.threadId !== operation.sourceThreadId ||
        turn.predecessorBackendExecutionId !== sourceTurn.backendExecutionId ||
        turn.predecessorThreadId !== sourceTurn.threadId
      ))
    ) throw persistenceFailure("CORRUPT_ROW", "Manual backend operation is not bound to its core intent and turn");
  }
  const manualConfirmationIds = new Set(executionIntents
    .map((intent) => intent.confirmationId)
    .filter((value): value is string => value !== null));
  if (manualConfirmationIds.size !== executionIntents.filter((intent) => intent.confirmationId !== null).length) {
    throw persistenceFailure("CORRUPT_ROW", "Manual outcome confirmation was consumed more than once");
  }
  for (const completion of manualCompletionDecisions) {
    const request = executionRequestById.get(completion.requestId);
    const decision = executionDecisionById.get(completion.decisionId);
    const event = executionOperationAudit.find((candidate) => candidate.auditId === completion.auditId);
    const receipt = receiptById.get(completion.verifiedReceiptId);
    const finalization = finalizationById.get(completion.finalizationId);
    const intent = finalization === undefined ? undefined : intentById.get(finalization.intentId);
    const task = taskById.get(completion.taskId);
    const terminal = terminalByExecution.get(completion.executionId);
    if (
      request?.action !== "execution.completion.accept" || request.result !== "allow" ||
      decision?.requestId !== completion.requestId || decision.action !== "execution.completion.accept" || decision.result !== "allow" ||
      event?.requestId !== completion.requestId || event.decisionId !== completion.decisionId ||
      event.eventKind !== "execution.completion.accepted" || receipt === undefined || finalization === undefined ||
      finalization.verifiedReceiptId !== receipt.verifiedReceiptId || intent === undefined ||
      intent.executionId !== completion.executionId || intent.taskId !== completion.taskId ||
      intent.attemptNumber !== completion.attemptNumber || intent.fencingToken !== completion.fencingToken ||
      task?.state !== "completed" || task.revision !== completion.postTaskRevision ||
      task.completion?.decisionId !== completion.completionDecisionId ||
      terminal?.status !== "completed" || terminal.completionDecisionId !== completion.completionDecisionId ||
      manualConfirmationIds.has(completion.confirmationId)
    ) throw persistenceFailure("CORRUPT_ROW", "Manual completion decision lineage is inconsistent");
  }
  const completionConfirmationIds = new Set(manualCompletionDecisions.map((completion) => completion.confirmationId));
  if (completionConfirmationIds.size !== manualCompletionDecisions.length) {
    throw persistenceFailure("CORRUPT_ROW", "Manual completion confirmation was consumed more than once");
  }
  for (const terminal of executionTerminalStates) {
    const execution = executionById.get(terminal.executionId);
    const receipt = receiptById.get(terminal.verifiedReceiptId);
    const finalization = finalizationById.get(terminal.finalizationId);
    const intent = finalization === undefined ? undefined : intentById.get(finalization.intentId);
    const task = execution === undefined ? undefined : taskById.get(execution.taskId);
    if (
      execution === undefined || receipt === undefined || finalization === undefined || intent === undefined ||
      intent.executionId !== terminal.executionId || receipt.intentId !== intent.intentId ||
      execution.attemptNumber !== terminal.attemptNumber || execution.fencingToken !== terminal.fencingToken ||
      execution.revision !== terminal.executionRevision || task?.revision !== terminal.postTaskRevision ||
      task.state !== terminal.status || terminal.postTaskRevision !== terminal.preTaskRevision + 1 ||
      executionIntents.some((candidate) => candidate.executionId === terminal.executionId && candidate.state !== "finalized")
    ) throw persistenceFailure("CORRUPT_ROW", "Execution terminal state is inconsistent with Task, fence, and verified evidence");
  }
  const dispatcherRequestById = new Map(dispatcherTriggerRequests.map((request) => [request.requestId, request]));
  const dispatcherDecisionById = new Map(dispatcherAuthorizationDecisions.map((decision) => [decision.decisionId, decision]));
  const dispatcherRunById = new Map(dispatcherRuns.map((run) => [run.runId, run]));
  if (
    dispatcherRequestById.size !== dispatcherTriggerRequests.length ||
    dispatcherDecisionById.size !== dispatcherAuthorizationDecisions.length ||
    dispatcherRunById.size !== dispatcherRuns.length
  ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher identity inventory is not unique");
  for (const request of dispatcherTriggerRequests) {
    const run = dispatcherRuns.find((candidate) => candidate.requestId === request.requestId);
    const decision = run === undefined
      ? dispatcherAuthorizationDecisions.find((candidate) =>
        candidate.requestId === request.requestId && candidate.createdAt === request.createdAt &&
        candidate.result === request.result)
      : dispatcherDecisionById.get(run.decisionId);
    const events = dispatcherAudit.filter((event) => event.requestId === request.requestId);
    const takeoverEvents = events.filter((event) =>
      event.eventKind === "dispatch.taken_over" && event.result === "accepted");
    const grant = decision?.grantId === null || decision?.grantId === undefined ? undefined : grantById.get(decision.grantId);
    if (
      decision === undefined || decision.actorId !== request.actorId || decision.action !== request.action ||
      decision.result !== request.result || decision.createdAt !== request.createdAt ||
      (decision.result === "allow" && (
        grant === undefined ||
        !grantRevisionWasUsableAt(grant, request.actorId, "dispatch.run", decision.createdAt, decision.grantRevision) ||
        run === undefined || run.observationId !== request.observationId || run.decisionId !== decision.decisionId ||
        run.actorId !== request.actorId ||
        run.ownerRevision !== takeoverEvents.length + 1 ||
        (run.ownerRevision === 1 && run.ownerId !== request.workerOwnerId) ||
        run.requestedLeaseSeconds !== request.requestedLeaseSeconds || run.createdAt !== request.createdAt ||
        !events.some((event) => event.runId === run.runId && event.eventKind === "dispatch.started" && event.result === "accepted")
      )) ||
      (decision.result === "deny" && (
        decision.grantId !== null || decision.grantRevision !== null || run !== undefined ||
        !events.some((event) => event.runId === null && event.eventKind === "dispatch.denied" && event.result === "denied")
      ))
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher trigger authorization lineage is inconsistent");
  }
  for (const decision of dispatcherAuthorizationDecisions) {
    const request = dispatcherRequestById.get(decision.requestId);
    const grant = decision.grantId === null ? undefined : grantById.get(decision.grantId);
    if (
      request === undefined || decision.actorId !== request.actorId || decision.action !== "dispatch.run" ||
      decision.createdAt < request.createdAt ||
      (decision.result === "allow" && (
        decision.reason !== "allowed" || grant === undefined ||
        !grantRevisionWasUsableAt(grant, decision.actorId, "dispatch.run", decision.createdAt, decision.grantRevision)
      )) ||
      (decision.result === "deny" && (decision.reason === "allowed" || decision.grantId !== null || decision.grantRevision !== null))
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher continuation authorization lineage is inconsistent");
  }
  for (const event of dispatcherAudit) {
    const request = dispatcherRequestById.get(event.requestId);
    const decision = dispatcherDecisionById.get(event.decisionId);
    const run = event.runId === null ? undefined : dispatcherRunById.get(event.runId);
    if (
      request === undefined || decision?.requestId !== event.requestId || event.actorId !== request.actorId ||
      event.correlationId !== request.correlationId || event.createdAt < request.createdAt ||
      (event.runId === null) !== (event.eventKind === "dispatch.denied") ||
      (event.runId !== null && (run === undefined || run.requestId !== request.requestId))
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher audit binding is inconsistent");
  }
  for (const run of dispatcherRuns) {
    const heartbeatMillis = new Date(run.heartbeatAt).valueOf();
    const expectedExpiry = new Date(heartbeatMillis + run.requestedLeaseSeconds * 1000).toISOString();
    const reconciliation = dispatcherReconciliationSummaries.find((summary) => summary.runId === run.runId);
    const membership = dispatcherMemberships.find((candidate) => candidate.runId === run.runId);
    const terminalSummary = dispatcherRunSummaries.find((summary) => summary.runId === run.runId);
    if (
      run.requestedLeaseSeconds < 30 || run.requestedLeaseSeconds > 3600 ||
      run.leaseExpiresAt !== expectedExpiry || run.updatedAt < run.createdAt || run.heartbeatAt > run.updatedAt ||
      (run.status === "starting" && (reconciliation !== undefined || membership !== undefined || terminalSummary !== undefined)) ||
      (run.status === "reconciling" && (membership !== undefined || terminalSummary !== undefined)) ||
      (run.status === "sweeping" && (reconciliation === undefined || membership === undefined || terminalSummary !== undefined)) ||
      (["completed", "partial", "failed", "interrupted"] as readonly string[]).includes(run.status) &&
        (reconciliation === undefined || membership === undefined || terminalSummary?.terminalStatus !== run.status)
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher run lifecycle or lease projection is inconsistent");
  }
  for (const summary of dispatcherReconciliationSummaries) {
    const items = dispatcherReconciliationItems.filter((item) => item.runId === summary.runId);
    const ordinals = items.map((item) => item.ordinal).sort((left, right) => left - right);
    if (
      !dispatcherRunById.has(summary.runId) || items.length !== summary.expectedCount ||
      ordinals.some((ordinal, index) => ordinal !== index) ||
      items.filter((item) => item.disposition === "reconciled").length !== summary.reconciledCount ||
      items.filter((item) => item.disposition === "no_effect").length !== summary.noEffectCount ||
      items.filter((item) => item.disposition === "authorization_denied").length !== summary.authorizationDeniedCount ||
      items.filter((item) => item.disposition === "ambiguous").length !== summary.ambiguousCount ||
      items.filter((item) => item.disposition === "failed").length !== summary.failedCount
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher reconciliation summary is incomplete");
  }
  for (const membership of dispatcherMemberships) {
    const run = dispatcherRunById.get(membership.runId);
    const reconciliation = dispatcherReconciliationSummaries.find((summary) => summary.runId === membership.runId);
    const members = dispatcherMembers.filter((member) => member.runId === membership.runId);
    const ordinals = members.map((member) => member.ordinal).sort((left, right) => left - right);
    if (
      run === undefined || reconciliation === undefined || membership.sealedAt < reconciliation.createdAt ||
      members.length !== membership.expectedMemberCount || new Set(members.map((member) => member.taskId)).size !== members.length ||
      ordinals.some((ordinal, index) => ordinal !== index) ||
      members.some((member) => member.membershipRevision !== membership.membershipRevision)
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher sealed membership is incomplete or mutable");
    for (const member of members) {
      const task = taskById.get(member.taskId);
      const project = projects.find((candidate) => candidate.projectId === member.projectId);
      const execution = member.executionId === null ? undefined : executionById.get(member.executionId);
      const intent = member.intentId === null ? undefined : intentById.get(member.intentId);
      if (
        task === undefined || project === undefined || task.projectId !== member.projectId ||
        task.revision < member.taskRevision || project.resourceRevision < member.projectResourceRevision ||
        project.configRevision < member.projectConfigRevision || member.updatedAt < member.createdAt ||
        (member.lifecycle === "pending" && (member.outcome !== null || member.revision !== 1)) ||
        (member.lifecycle === "terminal" && (member.outcome === null || member.revision !== 2)) ||
        (member.outcome === "claimed" && (
          execution === undefined || intent === undefined || intent.executionId !== execution.executionId ||
          execution.taskId !== member.taskId || intent.taskId !== member.taskId || intent.operationKind !== "start"
        )) ||
        (member.outcome !== "claimed" && (member.executionId !== null || member.intentId !== null))
      ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher member binding is inconsistent");
    }
  }
  const denialRequestById = new Map(dispatcherMemberDenialRequests.map((request) => [request.requestId, request]));
  const denialRequestByMember = new Map(dispatcherMemberDenialRequests.map((request) => [request.memberId, request]));
  const denialDecisionById = new Map(dispatcherMemberDenialDecisions.map((decision) => [decision.decisionId, decision]));
  const denialDecisionByRequest = new Map(dispatcherMemberDenialDecisions.map((decision) => [decision.requestId, decision]));
  const denialAuditByRequest = new Map(dispatcherMemberDenialAudit.map((event) => [event.requestId, event]));
  const denialAuditByDecision = new Map(dispatcherMemberDenialAudit.map((event) => [event.decisionId, event]));
  const denialTargetExecutionIds = new Set(dispatcherMemberDenialRequests.map((request) => request.targetExecutionId));
  if (
    denialRequestById.size !== dispatcherMemberDenialRequests.length ||
    denialRequestByMember.size !== dispatcherMemberDenialRequests.length ||
    denialDecisionById.size !== dispatcherMemberDenialDecisions.length ||
    denialDecisionByRequest.size !== dispatcherMemberDenialDecisions.length ||
    denialAuditByRequest.size !== dispatcherMemberDenialAudit.length ||
    denialAuditByDecision.size !== dispatcherMemberDenialAudit.length ||
    denialTargetExecutionIds.size !== dispatcherMemberDenialRequests.length ||
    dispatcherMemberDenialRequests.length !== dispatcherMemberDenialDecisions.length ||
    dispatcherMemberDenialRequests.length !== dispatcherMemberDenialAudit.length ||
    dispatcherMemberDenialRequests.some((request) =>
      requestById.has(request.requestId) || executionRequestById.has(request.requestId) ||
      dispatcherRequestById.has(request.requestId)) ||
    dispatcherMemberDenialDecisions.some((decision) =>
      decisionIds.has(decision.decisionId) || executionDecisionById.has(decision.decisionId) ||
      dispatcherDecisionById.has(decision.decisionId)) ||
    dispatcherMemberDenialAudit.some((event) =>
      audit.some((candidate) => candidate.auditId === event.auditId) ||
      executionOperationAudit.some((candidate) => candidate.auditId === event.auditId) ||
      dispatcherAudit.some((candidate) => candidate.auditId === event.auditId))
  ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher member denial identity inventory is not unique");
  for (const request of dispatcherMemberDenialRequests) {
    const decision = denialDecisionByRequest.get(request.requestId);
    const event = denialAuditByRequest.get(request.requestId);
    const member = dispatcherMembers.find((candidate) => candidate.memberId === request.memberId);
    const run = dispatcherRunById.get(request.runId);
    const project = projects.find((candidate) => candidate.projectId === member?.projectId);
    const grant = decision?.grantId === null || decision?.grantId === undefined
      ? undefined : grantById.get(decision.grantId);
    const grantBackedReason = decision?.reason === "policy_denied" || decision?.reason === "confirmation_required";
    const grantIsExact = grant !== undefined && decision !== undefined && project !== undefined &&
      grantRevisionWasUsableAt(grant, decision.actorId, "execution.start", decision.createdAt, decision.grantRevision) &&
      (grant.scope.kind === "runtime" || (
        grant.scope.projectId === member?.projectId &&
        grant.scope.resourceRevision === member.projectResourceRevision &&
        grant.scope.configRevision === member.projectConfigRevision
      ));
    if (
      member === undefined || run === undefined || project === undefined || request.runId !== member.runId ||
      member.lifecycle !== "terminal" || member.outcome !== "authorization_denied" ||
      member.code !== "execution_start_denied" || member.executionId !== null || member.intentId !== null ||
      request.actorId !== run.actorId || request.createdAt > member.updatedAt ||
      request.action !== "execution.start" || request.targetRevision !== 1 || request.result !== "deny" ||
      executionById.has(request.targetExecutionId) ||
      executionIntents.some((intent) => intent.executionId === request.targetExecutionId) ||
      decision === undefined || decision.actorId !== request.actorId || decision.action !== request.action ||
      decision.result !== request.result || decision.createdAt !== request.createdAt ||
      decision.projectId !== member.projectId || decision.resourceRevision !== member.projectResourceRevision ||
      decision.configRevision !== member.projectConfigRevision ||
      project.resourceRevision < decision.resourceRevision || project.configRevision < decision.configRevision ||
      (decision.grantId === null) !== (decision.grantRevision === null) ||
      grantBackedReason !== (decision.grantId !== null) ||
      (decision.reason === "policy_denied" && decision.policy !== "deny") ||
      decision.policy === "read_not_applicable" ||
      (decision.grantId !== null && !grantIsExact) ||
      event === undefined || event.decisionId !== decision.decisionId || event.runId !== request.runId ||
      event.memberId !== request.memberId || event.eventKind !== "authorization.denied" || event.result !== "denied" ||
      event.actorId !== request.actorId || event.correlationId !== request.correlationId ||
      event.targetExecutionId !== request.targetExecutionId || event.targetRevision !== request.targetRevision ||
      event.code !== decision.reason || event.createdAt !== request.createdAt
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher execution.start denial lineage is incomplete or inconsistent");
  }
  if (
    dispatcherMemberDenialDecisions.some((decision) => !denialRequestById.has(decision.requestId)) ||
    dispatcherMemberDenialAudit.some((event) =>
      !denialRequestById.has(event.requestId) || !denialDecisionById.has(event.decisionId)) ||
    dispatcherMembers.some((member) =>
      (member.code === "execution_start_denied") !== denialRequestByMember.has(member.memberId))
  ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher execution.start denial lineage has an orphan or missing record");
  for (const summary of dispatcherRunSummaries) {
    const run = dispatcherRunById.get(summary.runId);
    const membership = dispatcherMemberships.find((candidate) => candidate.runId === summary.runId);
    const members = dispatcherMembers.filter((member) => member.runId === summary.runId);
    const counts = new Map<DispatcherMemberOutcome, number>();
    for (const member of members) {
      if (member.outcome !== null) counts.set(member.outcome, (counts.get(member.outcome) ?? 0) + 1);
    }
    if (
      run === undefined || membership === undefined || summary.membershipRevision !== membership.membershipRevision ||
      summary.expectedMemberCount !== members.length || members.some((member) => member.lifecycle !== "terminal") ||
      members.some((member) => member.outcome === "claimed" && intentById.get(member.intentId ?? "")?.state !== "finalized") ||
      summary.claimedCount !== (counts.get("claimed") ?? 0) ||
      summary.alreadyClaimedCount !== (counts.get("already_claimed") ?? 0) ||
      summary.ineligibleCount !== (counts.get("ineligible_at_cas") ?? 0) ||
      summary.authorizationDeniedCount !== (counts.get("authorization_denied") ?? 0) ||
      summary.policyDeferredCount !== (counts.get("policy_deferred") ?? 0) ||
      summary.resourceDeferredCount !== (counts.get("resource_deferred") ?? 0) ||
      summary.reconciliationRequiredCount !== (counts.get("reconciliation_required") ?? 0) ||
      summary.failedCount !== (counts.get("failed") ?? 0) ||
      summary.ownerRevision !== run.ownerRevision || summary.runRevision !== run.runRevision ||
      summary.terminalStatus !== run.status
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher terminal summary is inconsistent");
  }
  const stateWithoutLifecycle = Object.freeze({
    domain, projects, bootstrap, identity, grants, epochs, authorizationGrantEpochLinks,
    requests, decisions, audit,
    executionSequences, executions,
    executionOperationRequests, executionAuthorizationDecisions, executionOperationAudit,
    executionIntents, executionIntentAuthorizationBindings, executionObservations,
    executionReceipts, executionFinalizations, executionTerminalStates,
    manualTurns, manualBackendOperations, manualCompletionDecisions,
    dispatcherTriggerRequests, dispatcherAuthorizationDecisions, dispatcherRuns, dispatcherAudit,
    dispatcherReconciliationItems, dispatcherReconciliationSummaries,
    dispatcherMemberships, dispatcherMembers,
    dispatcherMemberDenialRequests, dispatcherMemberDenialDecisions, dispatcherMemberDenialAudit,
    dispatcherRunSummaries,
    lifecycle: Object.freeze([]) as readonly ApplicationLifecycleAuthorization[],
  });
  for (const authorization of lifecycle) {
    const request = requestById.get(authorization.requestId);
    const decision = decisions.find((candidate) => candidate.decisionId === authorization.decisionId);
    const event = audit.find((candidate) => candidate.auditId === authorization.auditId);
    const grant = grantById.get(authorization.grantId);
    const grantRelation = grantRelationById.get(authorization.grantId);
    const revokedRequest = grantRelation?.revokedRequestId === null || grantRelation?.revokedRequestId === undefined
      ? null
      : requestById.get(grantRelation.revokedRequestId);
    const issuedMillis = new Date(authorization.issuedAt).valueOf();
    const expiresMillis = new Date(authorization.expiresAt).valueOf();
    const countsAreCurrent = authorization.expectedRequestCount === requests.length &&
      authorization.expectedDecisionCount === decisions.length && authorization.expectedAuditCount === audit.length;
    const currentOrHistoricalRevision = grant !== undefined && (
      (grant.revision === authorization.grantRevision && grant.revokedAt === null && grantRelation?.revokedRequestId === null) ||
      (grant.revision === authorization.grantRevision + 1 && grant.revokedAt !== null &&
        grantRelation?.revokedRequestId !== null && revokedRequest?.createdAt === grant.revokedAt &&
        grant.revokedAt >= authorization.issuedAt)
    );
    if (
      identity === null ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(authorization.backupGenerationId) ||
      authorization.actorId !== identity.actorId ||
      authorization.runtimeRootKey !== identity.runtimeRootKey ||
      request === undefined ||
      request.action !== authorization.operation ||
      request.result !== "allow" ||
      request.actorId !== authorization.actorId ||
      request.targetKind !== "backup" ||
      request.targetId !== authorization.backupGenerationId ||
      request.targetRevision !== null ||
      request.createdAt !== authorization.issuedAt ||
      decision === undefined ||
      decision.requestId !== authorization.requestId ||
      decision.actorId !== authorization.actorId ||
      decision.action !== authorization.operation ||
      decision.result !== "allow" ||
      decision.reason !== "allowed" ||
      decision.grantId !== authorization.grantId ||
      decision.grantRevision !== authorization.grantRevision ||
      decision.createdAt !== authorization.issuedAt ||
      event === undefined ||
      event.requestId !== authorization.requestId ||
      event.decisionId !== authorization.decisionId ||
      event.actorId !== authorization.actorId ||
      event.targetKind !== "backup" ||
      event.targetId !== authorization.backupGenerationId ||
      event.result !== "accepted" ||
      event.eventKind !== (authorization.operation === "runtime.backup" ? "backup.authorized" : "restore.authorized") ||
      event.createdAt !== authorization.issuedAt ||
      grant === undefined ||
      grant.actorId !== authorization.actorId ||
      grant.action !== authorization.operation ||
      !currentOrHistoricalRevision ||
      authorization.expectedRequestCount > requests.length ||
      authorization.expectedDecisionCount > decisions.length ||
      authorization.expectedAuditCount > audit.length ||
      authorization.expectedAuditCount !== authorization.expectedRequestCount ||
      authorization.expectedDecisionCount !== authorization.expectedRequestCount - 1 ||
      !(expiresMillis > issuedMillis && expiresMillis - issuedMillis <= 5 * 60 * 1000) ||
      authorization.expiresAt > grant.expiresAt ||
      (countsAreCurrent && authorization.authorizedStateSha256 !== applicationStateSha256(stateWithoutLifecycle))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Lifecycle authorization lineage is incomplete or inconsistent");
    }
  }
  return Object.freeze({ ...stateWithoutLifecycle, lifecycle });
}

export function readApplicationState(database: SqliteDatabase): ApplicationState {
  return runReadSnapshot(database, () => readApplicationStateUntransactional(database));
}

export function applicationStateSha256(state: ApplicationState): string {
  const vocabularySevenEpochs = Object.freeze(state.epochs.filter((epoch) => epoch.vocabularyVersion === 7));
  const vocabularySevenEpochIds = new Set(vocabularySevenEpochs.map((epoch) => epoch.epochId));
  const vocabularySevenGrantIds = new Set(state.authorizationGrantEpochLinks
    .filter((link) => vocabularySevenEpochIds.has(link.capabilityEpochId))
    .map((link) => link.grantId));
  const preDispatcherEpochs = Object.freeze(state.epochs.filter((epoch) => epoch.vocabularyVersion <= 6));
  const preDispatcherGrants = Object.freeze(state.grants.filter((grant) => !vocabularySevenGrantIds.has(grant.grantId)));
  return sha256(canonicalJson({
    audit: state.audit,
    authorizationGrantEpochLinks: state.authorizationGrantEpochLinks,
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
    epochs: preDispatcherEpochs,
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
    grants: preDispatcherGrants,
    identity: state.identity,
    manualBackendOperations: state.manualBackendOperations,
    manualCompletionDecisions: state.manualCompletionDecisions,
    manualTurns: state.manualTurns,
    registry: state.projects,
    requests: state.requests,
    vocabularySevenEpochs,
    vocabularySevenGrants: Object.freeze(state.grants.filter((grant) => vocabularySevenGrantIds.has(grant.grantId))),
  }));
}

export function applicationStateSha256ForLifecycleAuthorization(
  state: ApplicationState,
  authorization: ApplicationLifecycleAuthorization,
): string {
  void authorization;
  return applicationStateSha256(state);
}

function lifecycleAuthorizationProjection(record: ApplicationLifecycleAuthorization): Readonly<Record<string, unknown>> {
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

function validateLifecycleAuthorizationState(
  state: ApplicationState,
  handoff: ApplicationLifecycleAuthorization,
  operation: ApplicationLifecycleAuthorization["operation"],
  generationId: string,
  now: string,
): Readonly<{
  authorization: ApplicationLifecycleAuthorization;
  stateSha256: string;
  stateDigestVersion: 4;
}> {
  if (!isCanonicalUtcTimestamp(now)) throw persistenceFailure("INVALID_INPUT", "Lifecycle validation time is invalid");
  const authorization = state.lifecycle.find((candidate) => candidate.authorizationId === handoff.authorizationId);
  if (
    authorization === undefined ||
    canonicalJson(lifecycleAuthorizationProjection(authorization)) !== canonicalJson(lifecycleAuthorizationProjection(handoff)) ||
    authorization.operation !== operation ||
    authorization.backupGenerationId !== generationId
  ) {
    throw persistenceFailure("AUTHORIZATION_DENIED", "Lifecycle authorization handoff is absent or mismatched");
  }
  const grant = state.grants.find((candidate) => candidate.grantId === authorization.grantId);
  if (
    grant === undefined ||
    grant.revision !== authorization.grantRevision ||
    grant.revokedAt !== null ||
    grant.actorId !== authorization.actorId ||
    grant.action !== operation ||
    now >= authorization.expiresAt
  ) {
    throw persistenceFailure("AUTHORIZATION_DENIED", "Lifecycle authorization is no longer current");
  }
  const stateDigestVersion = 4 as const;
  const stateSha256 = applicationStateSha256(state);
  if (
    stateSha256 !== authorization.authorizedStateSha256 ||
    state.requests.length !== authorization.expectedRequestCount ||
    state.decisions.length !== authorization.expectedDecisionCount ||
    state.audit.length !== authorization.expectedAuditCount
  ) {
    throw persistenceFailure("BACKUP_CONFLICT", "Application state changed after lifecycle authorization");
  }
  return Object.freeze({ authorization, stateSha256, stateDigestVersion });
}

export function validateLifecycleAuthorizationForUse(
  database: SqliteDatabase,
  handoff: ApplicationLifecycleAuthorization,
  operation: ApplicationLifecycleAuthorization["operation"],
  generationId: string,
  now: string,
): Readonly<{
  authorization: ApplicationLifecycleAuthorization;
  stateSha256: string;
  stateDigestVersion: 4;
}> {
  return validateLifecycleAuthorizationState(readApplicationState(database), handoff, operation, generationId, now);
}

export function validateLifecycleAuthorizationForUseUntransactional(
  database: SqliteDatabase,
  handoff: ApplicationLifecycleAuthorization,
  operation: ApplicationLifecycleAuthorization["operation"],
  generationId: string,
  now: string,
): Readonly<{
  authorization: ApplicationLifecycleAuthorization;
  stateSha256: string;
  stateDigestVersion: 4;
}> {
  return validateLifecycleAuthorizationState(readApplicationStateUntransactional(database), handoff, operation, generationId, now);
}

export function bindApplicationDatabase(
  owner: object,
  database: SqliteDatabase,
  assertOpen: () => void,
  assertWriteAllowed: () => void,
): void {
  if (boundDatabases.has(owner)) throw persistenceFailure("INTEGRITY_ERROR", "Persistence owner is already bound");
  boundDatabases.set(owner, Object.freeze({ database, assertOpen, assertWriteAllowed }));
}

export function unbindApplicationDatabase(owner: object): void {
  boundDatabases.delete(owner);
}

function changes(value: number | bigint): number {
  const result = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(result)) throw persistenceFailure("INTEGRITY_ERROR", "SQLite change count is invalid");
  return result;
}

export class ApplicationTransaction {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  read(): ApplicationState {
    return readApplicationStateUntransactional(this.#database);
  }

  stateSha256(): string {
    return applicationStateSha256(this.read());
  }

  insertRequest(record: ApplicationRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO application_requests(
        request_id, correlation_id, actor_id, action, target_kind, target_id,
        target_revision, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.correlationId, record.actorId, record.action, record.targetKind,
      record.targetId, record.targetRevision, record.result, record.createdAt,
    );
  }

  insertDecision(record: AuthorizationDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, project_id, resource_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action, record.result,
      record.reason, record.policy, record.grantId, record.grantRevision, record.projectId,
      record.resourceRevision, record.createdAt,
    );
  }

  insertAudit(record: ApplicationAuditRecord): void {
    const details = canonicalJson({
      action: this.#database.prepare("SELECT action FROM application_requests WHERE request_id=?").get(record.requestId)?.action,
      reason: record.reason,
      targetKind: record.targetKind,
      targetRevision: record.targetRevision,
    });
    if (details.length > 1024) throw persistenceFailure("INVALID_INPUT", "Audit details exceed the bounded shape");
    this.#database.prepare(
      `INSERT INTO application_audit(
        audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
        target_kind, target_id, target_revision, reason, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.eventKind, record.result,
      record.actorId, record.correlationId, record.targetKind, record.targetId,
      record.targetRevision, record.reason, details, record.createdAt,
    );
  }

  insertBootstrap(record: AuthorizationBootstrap): void {
    this.#database.prepare(
      `INSERT INTO authorization_bootstrap(
        singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
        runtime_platform, runtime_device, runtime_inode, runtime_mode,
        request_id, created_at, expires_at, vocabulary_version
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.actorId, record.trustedPrincipal, record.canonicalRoot, record.rootKey,
      record.platform, record.device, record.inode, record.mode,
      record.requestId, record.createdAt, record.expiresAt, record.vocabularyVersion,
    );
  }

  insertLocalIdentity(record: NewLocalIdentityRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_local_identity(
        singleton, identity_version, actor_id, principal_sha256, platform,
        runtime_root_key, bootstrap_request_id, created_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.identityVersion, record.actorId, record.principalSha256, record.platform,
      record.runtimeRootKey, record.bootstrapRequestId, record.createdAt,
    );
  }

  insertCapabilityEpoch(record: NewCapabilityEpochRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_capability_epochs(
        epoch_id, epoch_revision, actor_id, runtime_root_key, vocabulary_version,
        action_set_sha256, request_id, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.epochId, record.epochRevision, record.actorId, record.runtimeRootKey,
      record.vocabularyVersion, record.actionSetSha256, record.requestId, record.createdAt,
      record.expiresAt,
    );
  }

  insertGrant(record: NewGrantRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_grants(
        grant_id, revision, actor_id, action, scope_kind, scope_project_id,
        scope_resource_revision, scope_config_revision, not_before, expires_at,
        revoked_at, issuer_grant_id, source_grant_id, capability_epoch_id,
        created_request_id, revoked_request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      record.grantId, record.revision, record.actorId, record.action, record.scope.kind,
      record.scope.projectId, record.scope.resourceRevision, record.scope.configRevision,
      record.notBefore, record.expiresAt, record.revokedAt, record.issuerGrantId, record.sourceGrantId,
      record.capabilityEpochId ?? null, record.createdRequestId,
    );
  }

  insertLifecycleAuthorization(record: NewLifecycleAuthorizationRecord): void {
    this.#database.prepare(
      `INSERT INTO application_lifecycle_authorizations(
        authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
        grant_id, grant_revision, request_id, decision_id, audit_id, authorized_state_sha256,
        state_digest_version, expected_request_count, expected_decision_count, expected_audit_count,
        issued_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4, ?, ?, ?, ?, ?)`,
    ).run(
      record.authorizationId, record.operation, record.backupGenerationId, record.actorId,
      record.runtimeRootKey, record.grantId, record.grantRevision, record.requestId,
      record.decisionId, record.auditId, record.authorizedStateSha256,
      record.expectedRequestCount, record.expectedDecisionCount, record.expectedAuditCount,
      record.issuedAt, record.expiresAt,
    );
  }

  insertExecutionSequence(record: TaskExecutionSequence): void {
    this.#database.prepare(
      `INSERT INTO task_execution_sequences(
        task_id, last_attempt_number, current_fencing_token, revision
      ) VALUES (?, ?, ?, ?)`,
    ).run(record.taskId, record.lastAttemptNumber, record.currentFencingToken, record.revision);
  }

  advanceExecutionSequence(
    taskId: string,
    expectedAttemptNumber: number,
    expectedFencingToken: number,
    expectedRevision: number,
  ): TaskExecutionSequence {
    const result = this.#database.prepare(
      `UPDATE task_execution_sequences
       SET last_attempt_number=last_attempt_number+1,
           current_fencing_token=current_fencing_token+1,
           revision=revision+1
       WHERE task_id=? AND last_attempt_number=? AND current_fencing_token=? AND revision=?`,
    ).run(taskId, expectedAttemptNumber, expectedFencingToken, expectedRevision);
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Task execution sequence CAS failed", { taskId });
    }
    const row = this.#database.prepare(
      `SELECT task_id, last_attempt_number, current_fencing_token, revision
       FROM task_execution_sequences WHERE task_id=?`,
    ).get(taskId);
    if (row === undefined) throw persistenceFailure("INTEGRITY_ERROR", "Advanced execution sequence is absent", { taskId });
    return Object.freeze({
      taskId: sqliteText(row.task_id, "task_execution_sequences.task_id"),
      lastAttemptNumber: positive(row.last_attempt_number, "task_execution_sequences.last_attempt_number"),
      currentFencingToken: positive(row.current_fencing_token, "task_execution_sequences.current_fencing_token"),
      revision: positive(row.revision, "task_execution_sequences.revision"),
    });
  }

  insertExecutionAttempt(record: NewExecutionAttemptRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_attempts(
        execution_id, task_id, attempt_number, operation_kind, status, idempotency_key,
        owner_id, requested_lease_seconds, predecessor_execution_revision,
        predecessor_lease_revision, predecessor_fencing_token,
        lease_revision, lease_expires_at, fencing_token, revision,
        expected_task_revision, pre_task_revision, post_task_revision,
        project_resource_revision, project_config_revision, request_id, decision_id,
        supersedes_execution_id, superseded_by_execution_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.executionId, record.taskId, record.attemptNumber, record.operationKind, record.status,
      record.idempotencyKey, record.ownerId, record.requestedLeaseSeconds,
      record.predecessorExecutionRevision, record.predecessorLeaseRevision,
      record.predecessorFencingToken, record.leaseRevision, record.leaseExpiresAt,
      record.fencingToken, record.revision, record.expectedTaskRevision, record.preTaskRevision,
      record.postTaskRevision, record.projectResourceRevision, record.projectConfigRevision,
      record.requestId, record.decisionId, record.supersedesExecutionId,
      record.supersededByExecutionId, record.createdAt, record.updatedAt,
    );
  }

  insertExecutionOperationRequest(record: ExecutionOperationRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_operation_requests(
        request_id, correlation_id, actor_id, action, target_execution_id,
        target_revision, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.correlationId, record.actorId, record.action,
      record.targetExecutionId, record.targetRevision, record.result, record.createdAt,
    );
  }

  insertExecutionAuthorizationDecision(record: ExecutionAuthorizationDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_authorization_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, project_id, resource_revision, config_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action, record.result,
      record.reason, record.policy, record.grantId, record.grantRevision,
      record.projectId, record.resourceRevision, record.configRevision, record.createdAt,
    );
  }

  insertExecutionOperationAudit(record: ExecutionOperationAuditRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_operation_audit(
        audit_id, request_id, decision_id, event_kind, result, actor_id,
        correlation_id, execution_id, execution_revision, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.eventKind, record.result,
      record.actorId, record.correlationId, record.executionId, record.executionRevision,
      record.code, record.createdAt,
    );
  }

  insertExecutionIntent(record: ExecutionOperationIntent): void {
    this.#database.prepare(
      `INSERT INTO execution_operation_intents(
        intent_id, operation_id, idempotency_key, operation_kind, action, state, revision,
        actor_id, request_id, decision_id, current_authorization_decision_id,
        authorization_binding_revision, confirmation_id, project_id,
        project_resource_revision, project_config_revision, task_id, task_revision,
        input_reference, execution_id, execution_revision, attempt_number, fencing_token,
        source_execution_id, source_execution_revision, source_attempt_number, source_fencing_token,
        source_observation_number,
        contract_id, adapter_id, adapter_version, policy_binding_reference, workspace_mode,
        backend_execution_id, thread_id, previous_receipt_id, expected_journal_revision,
        requested_deadline, continuation_reference, required_action_receipt_id, expected_lifecycle,
        reason_code, report_id, report_operation, report_code, evidence_reference, last_observation_number,
        last_error_category, last_error_code, last_error_retryable, last_error_ambiguous,
        retry_after, retry_count,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
        ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28,
        ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42,
        ?43, ?44, ?45, ?46, ?47, ?48, ?49, ?50, ?51, ?52, ?53, ?54, ?55)`,
    ).run(
      record.intentId, record.operationId, record.idempotencyKey, record.operationKind,
      record.action, record.state, record.revision, record.actorId, record.requestId,
      record.decisionId, record.currentAuthorizationDecisionId,
      record.authorizationBindingRevision, record.confirmationId, record.projectId,
      record.projectResourceRevision, record.projectConfigRevision, record.taskId,
      record.taskRevision, record.inputReference, record.executionId,
      record.executionRevision, record.attemptNumber, record.fencingToken,
      record.sourceExecutionId, record.sourceExecutionRevision, record.sourceAttemptNumber,
      record.sourceFencingToken, record.sourceObservationNumber,
      record.contractId, record.adapterId, record.adapterVersion,
      record.policyBindingReference, record.workspaceMode, record.backendExecutionId,
      record.threadId, record.previousReceiptId, record.expectedJournalRevision,
      record.requestedDeadline, record.continuationReference, record.requiredActionReceiptId,
      record.expectedLifecycle, record.reasonCode, record.reportId, record.reportOperation,
      record.reportCode, record.evidenceReference, record.lastObservationNumber,
      record.lastErrorCategory, record.lastErrorCode,
      record.lastErrorRetryable === null ? null : record.lastErrorRetryable ? 1 : 0,
      record.lastErrorAmbiguous === null ? null : record.lastErrorAmbiguous ? 1 : 0,
      record.retryAfter, record.retryCount,
      record.createdAt, record.updatedAt,
    );
  }

  insertExecutionIntentAuthorizationBinding(record: ExecutionIntentAuthorizationBindingRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_intent_authorization_bindings(
        binding_id, intent_id, binding_revision, phase, request_id, decision_id,
        audit_id, prior_decision_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.bindingId, record.intentId, record.bindingRevision, record.phase,
      record.requestId, record.decisionId, record.auditId, record.priorDecisionId,
      record.createdAt,
    );
  }

  bindExecutionIntentAuthorization(
    intentId: string,
    expectedState: ExecutionIntentState,
    expectedRevision: number,
    nextState: ExecutionIntentState,
    expectedDecisionId: string,
    expectedBindingRevision: number,
    nextDecisionId: string,
    nextBindingRevision: number,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_operation_intents
       SET state=?, current_authorization_decision_id=?, authorization_binding_revision=?,
           revision=revision+1, updated_at=?
       WHERE intent_id=? AND state=? AND revision=?
         AND current_authorization_decision_id=? AND authorization_binding_revision=?`,
    ).run(
      nextState, nextDecisionId, nextBindingRevision, updatedAt, intentId,
      expectedState, expectedRevision, expectedDecisionId, expectedBindingRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution authorization binding CAS failed", { intentId });
    }
  }

  recordExecutionIntentFailure(
    intentId: string,
    expectedRevision: number,
    nextState: Extract<ExecutionIntentState, "retry_wait" | "ambiguous" | "failed">,
    failure: Readonly<{
      category: ExecutionAdapterFailureCategory;
      code: string;
      retryable: boolean;
      ambiguous: boolean;
      retryAfter: string | null;
    }>,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_operation_intents
       SET state=?, last_error_category=?, last_error_code=?, last_error_retryable=?,
           last_error_ambiguous=?, retry_after=?, retry_count=retry_count+1,
           revision=revision+1, updated_at=?
       WHERE intent_id=? AND state='executing' AND revision=?`,
    ).run(
      nextState, failure.category, failure.code, failure.retryable ? 1 : 0,
      failure.ambiguous ? 1 : 0, failure.retryAfter, updatedAt, intentId, expectedRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution adapter failure CAS failed", { intentId });
    }
  }

  transitionExecutionIntent(
    intentId: string,
    expectedState: ExecutionIntentState,
    expectedRevision: number,
    nextState: ExecutionIntentState,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_operation_intents
       SET state=?, revision=revision+1, updated_at=?
       WHERE intent_id=? AND state=? AND revision=?`,
    ).run(nextState, updatedAt, intentId, expectedState, expectedRevision);
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution intent CAS failed", { intentId });
    }
  }

  insertExecutionObservation(record: ExecutionObservationRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_observations(
        observation_id, intent_id, observation_number, adapter_receipt_id, receipt_sha256,
        authorization_decision_id, lifecycle, outcome, code,
        backend_execution_id, thread_id, journal_revision, evidence_reference, observed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.observationId, record.intentId, record.observationNumber, record.adapterReceiptId,
      record.receiptSha256, record.authorizationDecisionId, record.lifecycle, record.outcome,
      record.code, record.backendExecutionId, record.threadId, record.journalRevision,
      record.evidenceReference, record.observedAt,
    );
  }

  insertExecutionVerifiedReceipt(record: ExecutionVerifiedReceiptRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_verified_receipts(
        verified_receipt_id, intent_id, adapter_receipt_id, receipt_sha256, lifecycle,
        backend_execution_id, thread_id, observation_number, observed_revision,
        fencing_token, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.verifiedReceiptId, record.intentId, record.adapterReceiptId,
      record.receiptSha256, record.lifecycle, record.backendExecutionId,
      record.threadId, record.observationNumber, record.observedRevision,
      record.fencingToken, record.verifiedAt,
    );
  }

  insertExecutionFinalization(record: ExecutionFinalizationRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_finalizations(
        finalization_id, intent_id, verified_receipt_id, authorization_decision_id, outcome, code,
        task_revision, execution_revision, finalized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.finalizationId, record.intentId, record.verifiedReceiptId,
      record.authorizationDecisionId, record.outcome,
      record.code, record.taskRevision, record.executionRevision, record.finalizedAt,
    );
  }

  insertExecutionTerminalState(record: ExecutionTerminalStateRecord): void {
    this.#database.prepare(
      `INSERT INTO execution_terminal_states(
        execution_id, status, attempt_number, fencing_token, verified_receipt_id,
        finalization_id, completion_decision_id, pre_task_revision, post_task_revision,
        execution_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.executionId, record.status, record.attemptNumber, record.fencingToken,
      record.verifiedReceiptId, record.finalizationId, record.completionDecisionId,
      record.preTaskRevision, record.postTaskRevision, record.executionRevision, record.createdAt,
    );
  }

  insertManualTurn(record: ManualBackendTurnRecord): void {
    this.#database.prepare(
      `INSERT INTO manual_backend_turns(
        backend_execution_id, thread_id, start_idempotency_key, project_id,
        project_resource_revision, project_config_revision, task_id, task_revision,
        input_reference, execution_id, execution_revision, attempt_number, fencing_token,
        predecessor_backend_execution_id, predecessor_thread_id,
        policy_binding_reference, workspace_mode, lifecycle, cancellation_request_revision,
        cancellation_requested_at, code, evidence_reference, last_report_id, revision,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.backendExecutionId, record.threadId, record.startIdempotencyKey,
      record.projectId, record.projectResourceRevision, record.projectConfigRevision,
      record.taskId, record.taskRevision, record.inputReference, record.executionId,
      record.executionRevision, record.attemptNumber, record.fencingToken,
      record.predecessorBackendExecutionId, record.predecessorThreadId,
      record.policyBindingReference, record.workspaceMode, record.lifecycle,
      record.cancellationRequestRevision, record.cancellationRequestedAt, record.code,
      record.evidenceReference, record.lastReportId, record.revision,
      record.createdAt, record.updatedAt,
    );
  }

  updateManualTurn(record: ManualBackendTurnRecord, expectedRevision: number): void {
    const result = this.#database.prepare(
      `UPDATE manual_backend_turns SET
        lifecycle=?, cancellation_request_revision=?, cancellation_requested_at=?,
        code=?, evidence_reference=?, last_report_id=?, revision=?, updated_at=?
      WHERE backend_execution_id=? AND thread_id=? AND execution_id=?
        AND fencing_token=? AND revision=?`,
    ).run(
      record.lifecycle, record.cancellationRequestRevision, record.cancellationRequestedAt,
      record.code, record.evidenceReference, record.lastReportId, record.revision,
      record.updatedAt, record.backendExecutionId, record.threadId, record.executionId,
      record.fencingToken, expectedRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Manual turn revision/fence CAS failed", {
        backendExecutionId: record.backendExecutionId,
      });
    }
  }

  insertManualBackendOperation(record: ManualBackendOperationRecord): void {
    this.#database.prepare(
      `INSERT INTO manual_backend_operations(
        backend_operation_id, idempotency_key, intent_id, authorization_decision_id, operation_kind,
        report_operation, backend_execution_id, thread_id, source_backend_execution_id,
        source_thread_id, expected_fencing_token,
        expected_pre_revision, post_revision, result_lifecycle, receipt_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.backendOperationId, record.idempotencyKey, record.intentId,
      record.authorizationDecisionId,
      record.operationKind, record.reportOperation, record.backendExecutionId,
      record.threadId, record.sourceBackendExecutionId, record.sourceThreadId,
      record.expectedFencingToken, record.expectedPreRevision,
      record.postRevision, record.resultLifecycle, record.receiptId, record.createdAt,
    );
  }

  insertManualCompletionDecision(record: ManualCompletionDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO manual_completion_decisions(
        completion_decision_id, operation_id, idempotency_key, task_id, execution_id,
        attempt_number, fencing_token, verified_receipt_id, finalization_id,
        pre_task_revision, post_task_revision, request_id, decision_id, audit_id,
        confirmation_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.completionDecisionId, record.operationId, record.idempotencyKey,
      record.taskId, record.executionId, record.attemptNumber, record.fencingToken,
      record.verifiedReceiptId, record.finalizationId, record.preTaskRevision,
      record.postTaskRevision, record.requestId, record.decisionId, record.auditId,
      record.confirmationId, record.createdAt,
    );
  }

  insertDispatcherTriggerRequest(record: DispatcherTriggerRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_trigger_requests(
        request_id, observation_id, idempotency_key, correlation_id, actor_id, action,
        worker_owner_id, requested_lease_seconds, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.observationId, record.idempotencyKey, record.correlationId,
      record.actorId, record.action, record.workerOwnerId, record.requestedLeaseSeconds,
      record.result, record.createdAt,
    );
  }

  insertDispatcherAuthorizationDecision(record: DispatcherAuthorizationDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_authorization_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action, record.result,
      record.reason, record.policy, record.grantId, record.grantRevision, record.createdAt,
    );
  }

  insertDispatcherRun(record: DispatcherRunRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_runs(
        run_id, observation_id, request_id, decision_id, actor_id, owner_id, owner_revision,
        run_revision, requested_lease_seconds, heartbeat_at, lease_expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.runId, record.observationId, record.requestId, record.decisionId, record.actorId,
      record.ownerId, record.ownerRevision, record.runRevision, record.requestedLeaseSeconds,
      record.heartbeatAt, record.leaseExpiresAt, record.status, record.createdAt, record.updatedAt,
    );
  }

  insertDispatcherAudit(record: DispatcherAuditRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_audit(
        audit_id, request_id, decision_id, run_id, event_kind, result,
        actor_id, correlation_id, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.runId, record.eventKind,
      record.result, record.actorId, record.correlationId, record.code, record.createdAt,
    );
  }

  advanceDispatcherRun(
    runId: string,
    ownerId: string,
    expectedOwnerRevision: number,
    expectedRunRevision: number,
    expectedStatus: DispatcherRunStatus,
    nextStatus: DispatcherRunStatus,
    now: string,
    leaseExpiresAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE dispatcher_runs
       SET status=?, run_revision=run_revision+1, heartbeat_at=?, lease_expires_at=?, updated_at=?
       WHERE run_id=? AND owner_id=? AND owner_revision=? AND run_revision=? AND status=?
         AND heartbeat_at<? AND lease_expires_at<?`,
    ).run(
      nextStatus, now, leaseExpiresAt, now, runId, ownerId, expectedOwnerRevision,
      expectedRunRevision, expectedStatus, now, leaseExpiresAt,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Dispatcher run owner/revision/status CAS failed", { runId });
    }
  }

  takeOverDispatcherRun(
    runId: string,
    expectedOwnerId: string,
    newOwnerId: string,
    expectedOwnerRevision: number,
    expectedRunRevision: number,
    expectedStatus: DispatcherRunStatus,
    now: string,
    leaseExpiresAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE dispatcher_runs
       SET owner_id=?, owner_revision=owner_revision+1, run_revision=run_revision+1,
           heartbeat_at=?, lease_expires_at=?, updated_at=?
       WHERE run_id=? AND owner_id=? AND owner_revision=? AND run_revision=? AND status=?
         AND status NOT IN ('completed', 'partial', 'failed', 'interrupted') AND lease_expires_at<=?`,
    ).run(
      newOwnerId, now, leaseExpiresAt, now, runId, expectedOwnerId, expectedOwnerRevision,
      expectedRunRevision, expectedStatus, now,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Dispatcher run takeover CAS or expiry check failed", { runId });
    }
  }

  insertDispatcherReconciliationItem(record: DispatcherReconciliationItemRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_reconciliation_items(
        reconciliation_item_id, run_id, ordinal, resource_kind, resource_id, disposition, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.reconciliationItemId, record.runId, record.ordinal, record.resourceKind,
      record.resourceId, record.disposition, record.code, record.createdAt,
    );
  }

  insertDispatcherReconciliationSummary(record: DispatcherReconciliationSummaryRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_reconciliation_summaries(
        run_id, summary_revision, expected_count, reconciled_count, no_effect_count,
        authorization_denied_count, ambiguous_count, failed_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.runId, record.summaryRevision, record.expectedCount, record.reconciledCount,
      record.noEffectCount, record.authorizationDeniedCount, record.ambiguousCount,
      record.failedCount, record.createdAt,
    );
  }

  insertDispatcherMembership(record: DispatcherMembershipRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_memberships(run_id, membership_revision, expected_member_count, sealed_at)
       VALUES (?, ?, ?, ?)`,
    ).run(record.runId, record.membershipRevision, record.expectedMemberCount, record.sealedAt);
  }

  insertDispatcherMember(record: DispatcherMemberRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_members(
        member_id, run_id, membership_revision, ordinal, project_id, project_resource_revision,
        project_config_revision, task_id, task_revision, lifecycle, outcome, execution_id,
        intent_id, code, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.memberId, record.runId, record.membershipRevision, record.ordinal, record.projectId,
      record.projectResourceRevision, record.projectConfigRevision, record.taskId, record.taskRevision,
      record.lifecycle, record.outcome, record.executionId, record.intentId, record.code,
      record.revision, record.createdAt, record.updatedAt,
    );
  }

  insertDispatcherMemberDenialRequest(record: DispatcherMemberDenialRequestRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_member_denial_requests(
        request_id, correlation_id, run_id, member_id, actor_id, action,
        target_execution_id, target_revision, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.requestId, record.correlationId, record.runId, record.memberId,
      record.actorId, record.action, record.targetExecutionId, record.targetRevision,
      record.result, record.createdAt,
    );
  }

  insertDispatcherMemberDenialDecision(record: DispatcherMemberDenialDecisionRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_member_denial_decisions(
        decision_id, request_id, actor_id, action, result, reason, policy_result,
        grant_id, grant_revision, project_id, resource_revision, config_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.decisionId, record.requestId, record.actorId, record.action,
      record.result, record.reason, record.policy, record.grantId, record.grantRevision,
      record.projectId, record.resourceRevision, record.configRevision, record.createdAt,
    );
  }

  insertDispatcherMemberDenialAudit(record: DispatcherMemberDenialAuditRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_member_denial_audit(
        audit_id, request_id, decision_id, run_id, member_id, event_kind, result,
        actor_id, correlation_id, target_execution_id, target_revision, code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.auditId, record.requestId, record.decisionId, record.runId,
      record.memberId, record.eventKind, record.result, record.actorId,
      record.correlationId, record.targetExecutionId, record.targetRevision,
      record.code, record.createdAt,
    );
  }

  resolveDispatcherMember(
    memberId: string,
    runId: string,
    expectedMembershipRevision: number,
    expectedRevision: number,
    outcome: DispatcherMemberOutcome,
    executionId: string | null,
    intentId: string | null,
    code: string,
    updatedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE dispatcher_members
       SET lifecycle='terminal', outcome=?, execution_id=?, intent_id=?, code=?,
           revision=revision+1, updated_at=?
       WHERE member_id=? AND run_id=? AND membership_revision=? AND revision=? AND lifecycle='pending'`,
    ).run(
      outcome, executionId, intentId, code, updatedAt, memberId, runId,
      expectedMembershipRevision, expectedRevision,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Dispatcher member terminal CAS failed", { memberId, runId });
    }
  }

  insertDispatcherRunSummary(record: DispatcherRunSummaryRecord): void {
    this.#database.prepare(
      `INSERT INTO dispatcher_run_summaries(
        run_id, membership_revision, expected_member_count, claimed_count, already_claimed_count,
        ineligible_count, authorization_denied_count, policy_deferred_count, resource_deferred_count,
        reconciliation_required_count, failed_count, terminal_status, owner_revision, run_revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.runId, record.membershipRevision, record.expectedMemberCount, record.claimedCount,
      record.alreadyClaimedCount, record.ineligibleCount, record.authorizationDeniedCount,
      record.policyDeferredCount, record.resourceDeferredCount, record.reconciliationRequiredCount,
      record.failedCount, record.terminalStatus, record.ownerRevision, record.runRevision, record.createdAt,
    );
  }

  renewExecutionLease(
    executionId: string,
    ownerId: string,
    expectedRevision: number,
    expectedLeaseRevision: number,
    expectedFencingToken: number,
    expectedTaskRevision: number,
    now: string,
    leaseExpiresAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_attempts
       SET lease_revision=lease_revision+1, revision=revision+1,
           lease_expires_at=?, updated_at=?
       WHERE execution_id=? AND owner_id=? AND revision=? AND lease_revision=?
         AND fencing_token=? AND post_task_revision=? AND status='active'
         AND lease_expires_at>?`,
    ).run(
      leaseExpiresAt, now, executionId, ownerId, expectedRevision, expectedLeaseRevision,
      expectedFencingToken, expectedTaskRevision, now,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Execution lease CAS or fence check failed", { executionId });
    }
  }

  supersedeExecutionAttempt(
    executionId: string,
    supersededByExecutionId: string,
    ownerId: string,
    expectedRevision: number,
    expectedLeaseRevision: number,
    expectedFencingToken: number,
    expectedTaskRevision: number,
    observedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_attempts
       SET status='superseded', superseded_by_execution_id=?, revision=revision+1, updated_at=?
       WHERE execution_id=? AND owner_id=? AND revision=? AND lease_revision=?
         AND fencing_token=? AND post_task_revision=? AND status='active'
         AND superseded_by_execution_id IS NULL AND lease_expires_at<=?`,
    ).run(
      supersededByExecutionId, observedAt, executionId, ownerId, expectedRevision,
      expectedLeaseRevision, expectedFencingToken, expectedTaskRevision, observedAt,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Expired execution takeover CAS or fence check failed", { executionId });
    }
  }

  revokeGrant(grantId: string, expectedRevision: number, revokedAt: string, requestId: string): void {
    const result = this.#database.prepare(
      `UPDATE authorization_grants
       SET revision=revision+1, revoked_at=?, revoked_request_id=?
       WHERE grant_id=? AND revision=? AND revoked_at IS NULL`,
    ).run(revokedAt, requestId, grantId, expectedRevision);
    if (changes(result.changes) !== 1) throw persistenceFailure("REVISION_CONFLICT", "Grant revocation CAS failed", { grantId });
  }

  supersedeExecutionAttemptAfterReconciliation(
    executionId: string,
    supersededByExecutionId: string,
    expectedOwnerId: string,
    expectedRevision: number,
    expectedLeaseRevision: number,
    expectedFencingToken: number,
    observedAt: string,
  ): void {
    const result = this.#database.prepare(
      `UPDATE execution_attempts
       SET status='superseded', superseded_by_execution_id=?, revision=revision+1, updated_at=?
       WHERE execution_id=? AND owner_id=? AND revision=? AND lease_revision=?
         AND fencing_token=? AND status='active' AND superseded_by_execution_id IS NULL`,
    ).run(
      supersededByExecutionId, observedAt, executionId, expectedOwnerId,
      expectedRevision, expectedLeaseRevision, expectedFencingToken,
    );
    if (changes(result.changes) !== 1) {
      throw persistenceFailure("REVISION_CONFLICT", "Reconciled execution successor CAS or fence check failed", { executionId });
    }
  }

  insertProject(project: RegisteredProject): void {
    this.#database.prepare(
      `INSERT INTO project_registry(
        project_id, canonical_root, root_key, platform, root_device, root_inode, root_mode,
        config_revision, resource_revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      project.projectId, project.canonicalRoot, project.rootKey, project.platform, project.device,
      project.inode, project.mode, project.configRevision, project.resourceRevision,
      project.createdAt, project.updatedAt,
    );
  }

  updateProject(project: RegisteredProject, expectedConfigRevision: number, expectedResourceRevision: number): void {
    const result = this.#database.prepare(
      `UPDATE project_registry SET
        canonical_root=?, root_key=?, platform=?, root_device=?, root_inode=?, root_mode=?,
        config_revision=?, resource_revision=?, updated_at=?
      WHERE project_id=? AND config_revision=? AND resource_revision=?`,
    ).run(
      project.canonicalRoot, project.rootKey, project.platform, project.device, project.inode,
      project.mode, project.configRevision, project.resourceRevision, project.updatedAt,
      project.projectId, expectedConfigRevision, expectedResourceRevision,
    );
    if (changes(result.changes) !== 1) throw persistenceFailure("REVISION_CONFLICT", "ProjectRegistry revision CAS failed", { projectId: project.projectId });
  }

  writeDomain(expected: DomainSnapshot, mutation: DomainMutation): DomainSnapshot {
    return writeDomainMutationUntransactional(this.#database, expected, mutation);
  }

  writeProjectDomain(expected: DomainSnapshot, mutation: ProjectDomainMutation): DomainSnapshot {
    return writeProjectMutationUntransactional(this.#database, expected, mutation);
  }
}

export function withApplicationTransaction<T>(owner: object, callback: (transaction: ApplicationTransaction) => T): T {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  binding.assertWriteAllowed();
  const database = binding.database;
  return runWriteTransaction(database, () => {
    try {
      const result = callback(new ApplicationTransaction(database));
      readApplicationStateUntransactional(database);
      return result;
    } catch (error) {
      throw normalizeSqliteFailure(error, "INTEGRITY_ERROR");
    }
  });
}

export function readApplicationStateForOwner(owner: object): ApplicationState {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  return readApplicationState(binding.database);
}

export function readDomainForOwner(owner: object): DomainSnapshot {
  return readApplicationStateForOwner(owner).domain;
}

export function initializeDomainForOwner(owner: object, snapshot: DomainSnapshot): DomainSnapshot {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  return initializeDomainSnapshot(binding.database, snapshot);
}

export function commitDomainForOwner(
  owner: object,
  expected: DomainSnapshot,
  mutation: DomainMutation,
): DomainSnapshot {
  const binding = boundDatabases.get(owner);
  if (binding === undefined || !binding.database.isOpen) throw persistenceFailure("STORE_CLOSED", "Persistence store is unavailable");
  binding.assertOpen();
  return commitDomainMutation(binding.database, expected, mutation);
}
