import {
  AUTHORIZATION_ACTIONS,
  isAuthorizationVocabularyVersion,
  parseAuthorizationGrant,
} from "../authorization.ts";
import type {
  AuthorizationAction,
  AuthorizationGrant,
  AuthorizationPolicyResult,
  AuthorizationReason,
  AuthorizationScope,
} from "../authorization.ts";
import {
  WORKSPACE_EXTERNAL_STATES,
  WORKSPACE_FAILURE_CATEGORIES,
  WORKSPACE_RECEIPT_CODES,
} from "../workspace-port.ts";
import type { WorkspaceFailureCategory, WorkspaceReceiptCode } from "../workspace-port.ts";
import {
  SCHEDULER_EXTERNAL_STATES,
  SCHEDULER_FAILURE_CATEGORIES,
  SCHEDULER_RECEIPT_CODES,
} from "../scheduler-port.ts";
import type { SchedulerExternalState, SchedulerFailureCategory, SchedulerReceiptCode } from "../scheduler-port.ts";
import { sqliteNullableText, sqliteText } from "./database.ts";
import type { SqliteDatabase } from "./database.ts";
import { persistenceFailure } from "./errors.ts";
import { APPLICATION_STATE_DIGEST_VERSION } from "./application-repository-digest.ts";
import {
  DISPATCHER_AUDIT_CODES,
  DISPATCHER_MEMBER_CODES,
  DISPATCHER_RECONCILIATION_CODES,
  WORKSPACE_EVENT_KINDS,
} from "./application-repository-model.ts";
import type {
  RegisteredProject,
  AuthorizationBootstrap,
  ApplicationAction,
  AuthorizationLocalIdentity,
  AuthorizationCapabilityEpoch,
  ApplicationLifecycleAuthorization,
  ApplicationRequestRecord,
  AuthorizationDecisionRecord,
  ApplicationAuditRecord,
  TaskExecutionSequence,
  ExecutionAttempt,
  ExecutionOperationKind,
  ExecutionIntentState,
  ManualTurnLifecycle,
  ExecutionOperationRequestRecord,
  ExecutionAuthorizationDecisionRecord,
  ExecutionOperationAuditRecord,
  ExecutionOperationIntent,
  ExecutionAdapterFailureCategory,
  ExecutionIntentAuthorizationBindingRecord,
  ExecutionObservationRecord,
  ExecutionVerifiedReceiptRecord,
  ExecutionFinalizationRecord,
  ExecutionTerminalStateRecord,
  ManualBackendTurnRecord,
  ManualBackendOperationRecord,
  CodexBackendTurnRecord,
  CodexBackendOperationRecord,
  CodexTurnLifecycle,
  CodexTurnTerminalSignal,
  CompletionDecisionRecord,
  ManualCompletionDecisionRecord,
  DispatcherTriggerRequestRecord,
  DispatcherAuthorizationDecisionRecord,
  DispatcherRunStatus,
  DispatcherRunRecord,
  DispatcherAuditCode,
  DispatcherReconciliationCode,
  DispatcherMemberCode,
  DispatcherAuditRecord,
  DispatcherReconciliationItemRecord,
  DispatcherReconciliationSummaryRecord,
  DispatcherMembershipRecord,
  DispatcherMemberOutcome,
  DispatcherMemberRecord,
  DispatcherMemberDenialRequestRecord,
  DispatcherMemberDenialDecisionRecord,
  DispatcherMemberDenialAuditRecord,
  DispatcherRunSummaryRecord,
  ProjectPolicyReceiptRecord,
  CompletionGateRequestRecord,
  CompletionGateAuthorizationDecisionRecord,
  CompletionGateIntentRecord,
  CompletionGateObservationRecord,
  CompletionGateVerifiedReceiptRecord,
  CompletionGateFinalizationRecord,
  CompletionGateEventRecord,
  PolicyGatedCompletionDecisionRecord,
  IntegrationTargetSequenceRecord,
  IntegrationReservationRecord,
  IntegrationOperationRequestRecord,
  IntegrationAuthorizationDecisionRecord,
  IntegrationIntentRecord,
  IntegrationObservationRecord,
  IntegrationVerifiedReceiptRecord,
  IntegrationFinalizationRecord,
  IntegrationEventRecord,
  WorkspaceCleanupAttestationRecord,
  WorkspaceGenerationRecord,
  WorkspaceGenerationStatus,
  WorkspaceAuthorizationDecisionRecord,
  WorkspaceOperationIntentRecord,
  WorkspaceIntentState,
  WorkspaceObservationRecord,
  WorkspaceExternalState,
  WorkspaceVerifiedReceiptRecord,
  WorkspaceFinalizationRecord,
  WorkspaceOperationOutcome,
  WorkspaceEventRecord,
  SchedulerRegistrationStatus,
  SchedulerIntentState,
  SchedulerConfigurationRecord,
  SchedulerRegistrationRecord,
  SchedulerOperationRequestRecord,
  SchedulerAuthorizationDecisionRecord,
  SchedulerOperationIntentRecord,
  SchedulerObservationRecord,
  SchedulerVerifiedReceiptRecord,
  SchedulerFinalizationRecord,
  SchedulerEventRecord,
  SchedulerDeliveryDisposition,
  SchedulerDeliveryAttachmentRole,
  SchedulerDeliveryObservationRecord,
  SchedulerScheduledTupleRecord,
} from "./application-repository-model.ts";
import { canonicalJson, exactRecord, isCanonicalUtcTimestamp, isNonemptyString } from "./values.ts";

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
  "completion.gate.ran",
  "completion.gate.inspected",
  "completion.gate.cancelled",
  "completion.accepted",
  "integration.reserved",
  "integration.inspected",
  "integration.lease.renewed",
  "integration.lease.taken_over",
  "integration.applied",
  "integration.pushed",
  "integration.recovered",
  "integration.released",
  "grant.listed",
  "runtime.status.inspected",
  "backup.authorized",
  "restore.authorized",
]);
const AUDIT_RESULTS: ReadonlySet<AuditResult> = new Set(["accepted", "denied"]);
const SCOPE_KINDS: ReadonlySet<AuthorizationScope["kind"]> = new Set(["runtime", "project"]);

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

function nullableBoolean(value: unknown, label: string): boolean | null {
  if (value === null) return null;
  const parsed = integer(value, label);
  if (parsed !== 0 && parsed !== 1) throw persistenceFailure("CORRUPT_ROW", `${label} is not a SQLite boolean`);
  return parsed === 1;
}

export function readProjects(database: SqliteDatabase): readonly RegisteredProject[] {
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

export function readBootstrap(database: SqliteDatabase): AuthorizationBootstrap | null {
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
  if (vocabularyVersion !== 1) {
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

export function readIdentity(database: SqliteDatabase): AuthorizationLocalIdentity | null {
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

export function readEpochs(database: SqliteDatabase): readonly AuthorizationCapabilityEpoch[] {
  return Object.freeze(database.prepare(
    `SELECT epoch_id, epoch_revision, actor_id, runtime_root_key, vocabulary_version,
      action_set_sha256, request_id, created_at, expires_at
    FROM authorization_capability_epochs ORDER BY epoch_revision`,
  ).all().map((row) => {
    const vocabularyVersion = integer(row.vocabulary_version, "authorization_capability_epochs.vocabulary_version");
    if (!isAuthorizationVocabularyVersion(vocabularyVersion)) {
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

export function readLifecycle(database: SqliteDatabase): readonly ApplicationLifecycleAuthorization[] {
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
    if (digestVersion !== APPLICATION_STATE_DIGEST_VERSION) {
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

function decodeTaskExecutionSequenceRow(row: Record<string, unknown>): TaskExecutionSequence {
  return Object.freeze({
    taskId: sqliteText(row.task_id, "task_execution_sequences.task_id"),
    lastAttemptNumber: positive(row.last_attempt_number, "task_execution_sequences.last_attempt_number"),
    currentFencingToken: positive(row.current_fencing_token, "task_execution_sequences.current_fencing_token"),
    revision: positive(row.revision, "task_execution_sequences.revision"),
  });
}

export function readExecutionSequences(database: SqliteDatabase): readonly TaskExecutionSequence[] {
  return Object.freeze(database.prepare(
    `SELECT task_id, last_attempt_number, current_fencing_token, revision
    FROM task_execution_sequences ORDER BY task_id`,
  ).all().map((row) => decodeTaskExecutionSequenceRow(row)));
}

export function readExecutionAttempts(database: SqliteDatabase): readonly ExecutionAttempt[] {
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

export function readExecutionOperationRequests(database: SqliteDatabase): readonly ExecutionOperationRequestRecord[] {
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

export function readExecutionAuthorizationDecisions(database: SqliteDatabase): readonly ExecutionAuthorizationDecisionRecord[] {
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

export function readExecutionOperationAudit(database: SqliteDatabase): readonly ExecutionOperationAuditRecord[] {
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

export function readExecutionIntents(database: SqliteDatabase): readonly ExecutionOperationIntent[] {
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
      contract_id, backend_kind, adapter_id, adapter_version, policy_binding_reference, workspace_mode,
      workspace_contract_id, workspace_id, workspace_generation, workspace_revision,
      workspace_root_key, ownership_binding_sha256, workspace_head_object_id,
      backend_execution_id, thread_id, previous_receipt_id, expected_journal_revision,
      requested_deadline, continuation_reference, required_action_receipt_id, expected_lifecycle,
      reason_code, report_id, report_operation, report_code, evidence_reference, last_observation_number,
      last_error_category, last_error_code, last_error_retryable, last_error_ambiguous,
      retry_after, retry_count,
      created_at, updated_at FROM execution_operation_intents ORDER BY intent_id`,
  ).all().map((row) => {
    const contractId = sqliteText(row.contract_id, "execution_operation_intents.contract_id");
    const backendKind = enumText(
      row.backend_kind,
      "execution_operation_intents.backend_kind",
      new Set<ExecutionOperationIntent["backendKind"]>(["manual-local", "codex-sdk"]),
    );
    const workspaceMode = enumText(
      row.workspace_mode,
      "execution_operation_intents.workspace_mode",
      new Set<ExecutionOperationIntent["workspaceMode"]>(["none", "owned"]),
    );
    const workspaceContractId = sqliteNullableText(
      row.workspace_contract_id,
      "execution_operation_intents.workspace_contract_id",
    );
    const workspaceId = sqliteNullableText(row.workspace_id, "execution_operation_intents.workspace_id");
    const workspaceGeneration = nullablePositive(
      row.workspace_generation,
      "execution_operation_intents.workspace_generation",
    );
    const workspaceRevision = nullablePositive(
      row.workspace_revision,
      "execution_operation_intents.workspace_revision",
    );
    const workspaceRootKey = sqliteNullableText(
      row.workspace_root_key,
      "execution_operation_intents.workspace_root_key",
    );
    const ownershipBindingSha256 = row.ownership_binding_sha256 === null ? null : uppercaseSha256(
      row.ownership_binding_sha256,
      "execution_operation_intents.ownership_binding_sha256",
    );
    const workspaceHeadObjectId = nullableLowercaseSha1(
      row.workspace_head_object_id,
      "execution_operation_intents.workspace_head_object_id",
    );
    const manualWorkspace = backendKind === "manual-local" && workspaceMode === "none" &&
      workspaceContractId === null && workspaceId === null && workspaceGeneration === null &&
      workspaceRevision === null && workspaceRootKey === null && ownershipBindingSha256 === null &&
      workspaceHeadObjectId === null;
    const ownedWorkspace = backendKind === "codex-sdk" && workspaceMode === "owned" &&
      workspaceContractId === "ato.workspace/v2" && workspaceId !== null && workspaceGeneration !== null &&
      workspaceRevision !== null && workspaceRootKey !== null && ownershipBindingSha256 !== null &&
      workspaceHeadObjectId !== null;
    if (contractId !== "ato.execution/v2" || (!manualWorkspace && !ownedWorkspace)) {
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
      contractId, backendKind, adapterId: sqliteText(row.adapter_id, "execution_operation_intents.adapter_id"),
      adapterVersion: sqliteText(row.adapter_version, "execution_operation_intents.adapter_version"),
      policyBindingReference: sqliteText(row.policy_binding_reference, "execution_operation_intents.policy_binding_reference"),
      workspaceMode,
      workspaceContractId: workspaceContractId as "ato.workspace/v2" | null,
      workspaceId,
      workspaceGeneration,
      workspaceRevision,
      workspaceRootKey,
      ownershipBindingSha256,
      workspaceHeadObjectId,
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

export function readExecutionIntentAuthorizationBindings(
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

export function readExecutionObservations(database: SqliteDatabase): readonly ExecutionObservationRecord[] {
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

export function readExecutionReceipts(database: SqliteDatabase): readonly ExecutionVerifiedReceiptRecord[] {
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

export function readExecutionFinalizations(database: SqliteDatabase): readonly ExecutionFinalizationRecord[] {
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

export function readExecutionTerminalStates(database: SqliteDatabase): readonly ExecutionTerminalStateRecord[] {
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

export function readManualTurns(database: SqliteDatabase): readonly ManualBackendTurnRecord[] {
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

export function readManualBackendOperations(database: SqliteDatabase): readonly ManualBackendOperationRecord[] {
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

export function readCodexTurns(database: SqliteDatabase): readonly CodexBackendTurnRecord[] {
  const lifecycles = new Set<CodexTurnLifecycle>(["unknown", "active", "turn_succeeded", "failed"]);
  const terminalSignals = new Set<CodexTurnTerminalSignal>(["turn.completed", "turn.failed"]);
  return Object.freeze(database.prepare(
    `SELECT backend_execution_id, thread_id, start_idempotency_key, origin_intent_id,
      origin_operation_id, origin_authorization_decision_id, project_id,
      project_resource_revision, project_config_revision, task_id, task_revision,
      input_reference, execution_id, execution_revision, attempt_number, fencing_token,
      predecessor_backend_execution_id, predecessor_thread_id, policy_binding_reference,
      workspace_contract_id, workspace_id, workspace_generation, workspace_revision,
      workspace_root_key, ownership_binding_sha256, workspace_head_object_id, lifecycle,
      terminal_signal, cancellation_requested_at, code, evidence_reference, revision,
      created_at, updated_at FROM codex_backend_turns ORDER BY backend_execution_id`,
  ).all().map((row) => {
    const inputReference = sqliteText(row.input_reference, "codex_backend_turns.input_reference");
    const workspaceContractId = sqliteText(row.workspace_contract_id, "codex_backend_turns.workspace_contract_id");
    const lifecycle = enumText(row.lifecycle, "codex_backend_turns.lifecycle", lifecycles);
    const terminalSignal = row.terminal_signal === null ? null : enumText(
      row.terminal_signal,
      "codex_backend_turns.terminal_signal",
      terminalSignals,
    );
    if (!/^task-sha256:[0-9a-f]{64}$/u.test(inputReference) || workspaceContractId !== "ato.workspace/v2" ||
      (lifecycle === "turn_succeeded" ? terminalSignal !== "turn.completed" :
        lifecycle === "failed" ? terminalSignal !== "turn.failed" : terminalSignal !== null)) {
      throw persistenceFailure("CORRUPT_ROW", "Codex turn contract, input, or terminal identity is invalid");
    }
    return Object.freeze({
      backendExecutionId: sqliteText(row.backend_execution_id, "codex_backend_turns.backend_execution_id"),
      threadId: sqliteNullableText(row.thread_id, "codex_backend_turns.thread_id"),
      startIdempotencyKey: sqliteText(row.start_idempotency_key, "codex_backend_turns.start_idempotency_key"),
      originIntentId: sqliteText(row.origin_intent_id, "codex_backend_turns.origin_intent_id"),
      originOperationId: sqliteText(row.origin_operation_id, "codex_backend_turns.origin_operation_id"),
      originAuthorizationDecisionId: sqliteText(
        row.origin_authorization_decision_id,
        "codex_backend_turns.origin_authorization_decision_id",
      ),
      projectId: sqliteText(row.project_id, "codex_backend_turns.project_id"),
      projectResourceRevision: positive(row.project_resource_revision, "codex_backend_turns.project_resource_revision"),
      projectConfigRevision: positive(row.project_config_revision, "codex_backend_turns.project_config_revision"),
      taskId: sqliteText(row.task_id, "codex_backend_turns.task_id"),
      taskRevision: positive(row.task_revision, "codex_backend_turns.task_revision"),
      inputReference,
      executionId: sqliteText(row.execution_id, "codex_backend_turns.execution_id"),
      executionRevision: positive(row.execution_revision, "codex_backend_turns.execution_revision"),
      attemptNumber: positive(row.attempt_number, "codex_backend_turns.attempt_number"),
      fencingToken: positive(row.fencing_token, "codex_backend_turns.fencing_token"),
      predecessorBackendExecutionId: sqliteNullableText(
        row.predecessor_backend_execution_id,
        "codex_backend_turns.predecessor_backend_execution_id",
      ),
      predecessorThreadId: sqliteNullableText(row.predecessor_thread_id, "codex_backend_turns.predecessor_thread_id"),
      policyBindingReference: sqliteText(row.policy_binding_reference, "codex_backend_turns.policy_binding_reference"),
      workspaceContractId: workspaceContractId as "ato.workspace/v2",
      workspaceId: sqliteText(row.workspace_id, "codex_backend_turns.workspace_id"),
      workspaceGeneration: positive(row.workspace_generation, "codex_backend_turns.workspace_generation"),
      workspaceRevision: positive(row.workspace_revision, "codex_backend_turns.workspace_revision"),
      workspaceRootKey: sqliteText(row.workspace_root_key, "codex_backend_turns.workspace_root_key"),
      ownershipBindingSha256: uppercaseSha256(
        row.ownership_binding_sha256,
        "codex_backend_turns.ownership_binding_sha256",
      ),
      workspaceHeadObjectId: lowercaseSha1(
        row.workspace_head_object_id,
        "codex_backend_turns.workspace_head_object_id",
      ),
      lifecycle,
      terminalSignal,
      cancellationRequestedAt: row.cancellation_requested_at === null ? null : timestamp(
        row.cancellation_requested_at,
        "codex_backend_turns.cancellation_requested_at",
      ),
      code: boundedCode(row.code, "codex_backend_turns.code"),
      evidenceReference: opaqueEvidenceReference(row.evidence_reference, "codex_backend_turns.evidence_reference"),
      revision: positive(row.revision, "codex_backend_turns.revision"),
      createdAt: timestamp(row.created_at, "codex_backend_turns.created_at"),
      updatedAt: timestamp(row.updated_at, "codex_backend_turns.updated_at"),
    });
  }));
}

export function readCodexBackendOperations(database: SqliteDatabase): readonly CodexBackendOperationRecord[] {
  const kinds = new Set<CodexBackendOperationRecord["operationKind"]>(["start", "resume", "retry"]);
  const lifecycles = new Set<CodexBackendOperationRecord["resultLifecycle"]>(["turn_succeeded", "failed"]);
  const terminalSignals = new Set<CodexTurnTerminalSignal>(["turn.completed", "turn.failed"]);
  return Object.freeze(database.prepare(
    `SELECT backend_operation_id, idempotency_key, intent_id, authorization_decision_id,
      operation_kind, backend_execution_id, thread_id, source_backend_execution_id,
      source_thread_id, expected_fencing_token, expected_pre_revision, post_revision,
      result_lifecycle, terminal_signal, receipt_id, receipt_sha256, created_at
    FROM codex_backend_operations ORDER BY backend_operation_id`,
  ).all().map((row) => {
    const resultLifecycle = enumText(row.result_lifecycle, "codex_backend_operations.result_lifecycle", lifecycles);
    const terminalSignal = enumText(row.terminal_signal, "codex_backend_operations.terminal_signal", terminalSignals);
    if ((resultLifecycle === "turn_succeeded") !== (terminalSignal === "turn.completed")) {
      throw persistenceFailure("CORRUPT_ROW", "Codex operation terminal identity is inconsistent");
    }
    return Object.freeze({
      backendOperationId: sqliteText(row.backend_operation_id, "codex_backend_operations.backend_operation_id"),
      idempotencyKey: sqliteText(row.idempotency_key, "codex_backend_operations.idempotency_key"),
      intentId: sqliteText(row.intent_id, "codex_backend_operations.intent_id"),
      authorizationDecisionId: sqliteText(
        row.authorization_decision_id,
        "codex_backend_operations.authorization_decision_id",
      ),
      operationKind: enumText(row.operation_kind, "codex_backend_operations.operation_kind", kinds),
      backendExecutionId: sqliteText(row.backend_execution_id, "codex_backend_operations.backend_execution_id"),
      threadId: sqliteText(row.thread_id, "codex_backend_operations.thread_id"),
      sourceBackendExecutionId: sqliteNullableText(
        row.source_backend_execution_id,
        "codex_backend_operations.source_backend_execution_id",
      ),
      sourceThreadId: sqliteNullableText(row.source_thread_id, "codex_backend_operations.source_thread_id"),
      expectedFencingToken: positive(row.expected_fencing_token, "codex_backend_operations.expected_fencing_token"),
      expectedPreRevision: nullablePositive(row.expected_pre_revision, "codex_backend_operations.expected_pre_revision"),
      postRevision: positive(row.post_revision, "codex_backend_operations.post_revision"),
      resultLifecycle,
      terminalSignal,
      receiptId: sqliteText(row.receipt_id, "codex_backend_operations.receipt_id"),
      receiptSha256: uppercaseSha256(row.receipt_sha256, "codex_backend_operations.receipt_sha256"),
      createdAt: timestamp(row.created_at, "codex_backend_operations.created_at"),
    });
  }));
}

function lowercaseSha1(value: unknown, label: string): string {
  const result = sqliteText(value, label);
  if (!/^[0-9a-f]{40}$/u.test(result)) throw persistenceFailure("CORRUPT_ROW", `${label} is not lowercase SHA-1`);
  return result;
}

function nullableLowercaseSha1(value: unknown, label: string): string | null {
  return value === null ? null : lowercaseSha1(value, label);
}

export function readCompletionDecisions(database: SqliteDatabase): readonly CompletionDecisionRecord[] {
  const kinds = new Set<CompletionDecisionRecord["kind"]>(["manual", "policy_gated"]);
  return Object.freeze(database.prepare(
    `SELECT completion_decision_id, kind, task_id, execution_id, attempt_number, fencing_token,
      pre_task_revision, post_task_revision, execution_revision, created_at
    FROM completion_decisions ORDER BY completion_decision_id`,
  ).all().map((row) => Object.freeze({
    completionDecisionId: sqliteText(row.completion_decision_id, "completion_decisions.completion_decision_id"),
    kind: enumText(row.kind, "completion_decisions.kind", kinds),
    taskId: sqliteText(row.task_id, "completion_decisions.task_id"),
    executionId: sqliteText(row.execution_id, "completion_decisions.execution_id"),
    attemptNumber: positive(row.attempt_number, "completion_decisions.attempt_number"),
    fencingToken: positive(row.fencing_token, "completion_decisions.fencing_token"),
    preTaskRevision: positive(row.pre_task_revision, "completion_decisions.pre_task_revision"),
    postTaskRevision: positive(row.post_task_revision, "completion_decisions.post_task_revision"),
    executionRevision: positive(row.execution_revision, "completion_decisions.execution_revision"),
    createdAt: timestamp(row.created_at, "completion_decisions.created_at"),
  })));
}

export function readManualCompletionDecisions(database: SqliteDatabase): readonly ManualCompletionDecisionRecord[] {
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

export function readDispatcherTriggerRequests(database: SqliteDatabase): readonly DispatcherTriggerRequestRecord[] {
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

export function readDispatcherAuthorizationDecisions(database: SqliteDatabase): readonly DispatcherAuthorizationDecisionRecord[] {
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

export function readDispatcherRuns(database: SqliteDatabase): readonly DispatcherRunRecord[] {
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

export function readDispatcherAudit(database: SqliteDatabase): readonly DispatcherAuditRecord[] {
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

export function readDispatcherReconciliationItems(database: SqliteDatabase): readonly DispatcherReconciliationItemRecord[] {
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

export function readDispatcherReconciliationSummaries(database: SqliteDatabase): readonly DispatcherReconciliationSummaryRecord[] {
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

export function readDispatcherMemberships(database: SqliteDatabase): readonly DispatcherMembershipRecord[] {
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

export function readDispatcherMembers(database: SqliteDatabase): readonly DispatcherMemberRecord[] {
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

export function readDispatcherMemberDenialRequests(
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

export function readDispatcherMemberDenialDecisions(
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

export function readDispatcherMemberDenialAudit(
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

export function readDispatcherRunSummaries(database: SqliteDatabase): readonly DispatcherRunSummaryRecord[] {
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

const WORKSPACE_STATUSES = new Set<WorkspaceGenerationStatus>([
  "allocated", "reserved", "creating", "ready", "cleaning", "recovery_required", "cleaned",
]);
const WORKSPACE_INTENT_STATES = new Set<WorkspaceIntentState>([
  "pending", "executing", "observed", "verified", "finalized", "ambiguous", "failed",
]);
const WORKSPACE_EXTERNAL_STATE_SET = new Set<WorkspaceExternalState>([
  ...WORKSPACE_EXTERNAL_STATES,
]);
const WORKSPACE_FAILURE_CATEGORY_SET = new Set<WorkspaceFailureCategory>(WORKSPACE_FAILURE_CATEGORIES);
const WORKSPACE_RECEIPT_CODE_SET = new Set<WorkspaceReceiptCode>(WORKSPACE_RECEIPT_CODES);
const WORKSPACE_OUTCOMES = new Set<WorkspaceOperationOutcome>(["succeeded", "refused", "ambiguous", "failed"]);
const WORKSPACE_ACTIONS = new Set<WorkspaceAuthorizationDecisionRecord["action"]>([
  "workspace.reserve", "workspace.create", "workspace.inspect", "workspace.recover", "workspace.cleanup",
]);

function sqliteBoolean(value: unknown, label: string): boolean {
  const result = integer(value, label);
  if (result !== 0 && result !== 1) throw persistenceFailure("CORRUPT_ROW", `${label} is not a SQLite boolean`);
  return result === 1;
}

function sqliteNullableBoolean(value: unknown, label: string): boolean | null {
  return value === null ? null : sqliteBoolean(value, label);
}

function boundedCode(value: unknown, label: string): string {
  const result = sqliteText(value, label);
  if (result.length > 64 || !/^[a-z][a-z0-9_]{0,63}$/u.test(result)) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not a closed bounded code`);
  }
  return result;
}

function opaqueEvidenceReference(value: unknown, label: string): string | null {
  if (value === null) return null;
  const result = sqliteText(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(result)) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not an opaque bounded reference`);
  }
  return result;
}

export function readProjectPolicyReceipts(database: SqliteDatabase): readonly ProjectPolicyReceiptRecord[] {
  const operations = new Set<ProjectPolicyReceiptRecord["operation"]>([
    "evaluate_mutation", "completion_requirements", "evaluate_integration", "evaluate_cleanup",
  ]);
  const decisions = new Set<ProjectPolicyReceiptRecord["decision"]>(["allow", "deny", "defer"]);
  return Object.freeze(database.prepare(
    `SELECT receipt_id, policy_query_id, operation, preliminary_authorization_decision_id, requested_action,
      actor_id, project_id, project_resource_revision, project_config_revision, project_root_key,
      repository_identity, subject_sha256, policy_id, policy_key, policy_config_revision, adapter_id,
      adapter_version, decision, reason_code, facts_json, facts_sha256, receipt_sha256, valid_until,
      evidence_reference, observed_at FROM project_policy_receipts ORDER BY receipt_id`,
  ).all().map((row) => Object.freeze({
    receiptId: sqliteText(row.receipt_id, "project_policy_receipts.receipt_id"),
    policyQueryId: sqliteText(row.policy_query_id, "project_policy_receipts.policy_query_id"),
    operation: enumText(row.operation, "project_policy_receipts.operation", operations),
    preliminaryAuthorizationDecisionId: sqliteText(row.preliminary_authorization_decision_id, "project_policy_receipts.preliminary_authorization_decision_id"),
    requestedAction: sqliteText(row.requested_action, "project_policy_receipts.requested_action"),
    actorId: sqliteText(row.actor_id, "project_policy_receipts.actor_id"),
    projectId: sqliteText(row.project_id, "project_policy_receipts.project_id"),
    projectResourceRevision: positive(row.project_resource_revision, "project_policy_receipts.project_resource_revision"),
    projectConfigRevision: positive(row.project_config_revision, "project_policy_receipts.project_config_revision"),
    projectRootKey: sqliteText(row.project_root_key, "project_policy_receipts.project_root_key"),
    repositoryIdentity: sqliteText(row.repository_identity, "project_policy_receipts.repository_identity"),
    subjectSha256: uppercaseSha256(row.subject_sha256, "project_policy_receipts.subject_sha256"),
    policyId: sqliteText(row.policy_id, "project_policy_receipts.policy_id"),
    policyKey: sqliteText(row.policy_key, "project_policy_receipts.policy_key"),
    policyConfigRevision: positive(row.policy_config_revision, "project_policy_receipts.policy_config_revision"),
    adapterId: sqliteText(row.adapter_id, "project_policy_receipts.adapter_id"),
    adapterVersion: sqliteText(row.adapter_version, "project_policy_receipts.adapter_version"),
    decision: enumText(row.decision, "project_policy_receipts.decision", decisions),
    reasonCode: sqliteText(row.reason_code, "project_policy_receipts.reason_code"),
    factsJson: sqliteText(row.facts_json, "project_policy_receipts.facts_json"),
    factsSha256: uppercaseSha256(row.facts_sha256, "project_policy_receipts.facts_sha256"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "project_policy_receipts.receipt_sha256"),
    validUntil: row.valid_until === null ? null : timestamp(row.valid_until, "project_policy_receipts.valid_until"),
    evidenceReference: sqliteNullableText(row.evidence_reference, "project_policy_receipts.evidence_reference"),
    observedAt: timestamp(row.observed_at, "project_policy_receipts.observed_at"),
  })));
}

export function readCompletionGateRequests(database: SqliteDatabase): readonly CompletionGateRequestRecord[] {
  const kinds = new Set<CompletionGateRequestRecord["operationKind"]>(["run_gate", "inspect_gate", "cancel_gate"]);
  return Object.freeze(database.prepare(
    `SELECT request_id, operation_id, idempotency_key, operation_kind, actor_id, correlation_id, causation_id,
      project_id, project_resource_revision, project_config_revision, project_root_key, repository_identity,
      task_id, task_revision, execution_id, execution_revision, attempt_number, fencing_token, workspace_id,
      generation, workspace_revision, workspace_root_key, ownership_binding_sha256, head_object_id,
      policy_receipt_id, policy_id, policy_config_revision, gate_id, gate_version, command_key, command_identity_sha256,
      completion_evidence_root_key, tool_environment_sha256, contract_id, adapter_id, adapter_version, timeout_ms, created_at
    FROM completion_gate_requests ORDER BY request_id`,
  ).all().map((row) => {
    const contractId = sqliteText(row.contract_id, "completion_gate_requests.contract_id");
    if (contractId !== "ato.completion/v1") throw persistenceFailure("CORRUPT_ROW", "Completion gate contract is unsupported");
    const headObjectId = sqliteText(row.head_object_id, "completion_gate_requests.head_object_id");
    if (!/^[0-9a-f]{40}$/u.test(headObjectId)) throw persistenceFailure("CORRUPT_ROW", "Completion gate HEAD is invalid");
    return Object.freeze({
      requestId: sqliteText(row.request_id, "completion_gate_requests.request_id"),
      operationId: sqliteText(row.operation_id, "completion_gate_requests.operation_id"),
      idempotencyKey: sqliteText(row.idempotency_key, "completion_gate_requests.idempotency_key"),
      operationKind: enumText(row.operation_kind, "completion_gate_requests.operation_kind", kinds),
      actorId: sqliteText(row.actor_id, "completion_gate_requests.actor_id"),
      correlationId: sqliteText(row.correlation_id, "completion_gate_requests.correlation_id"),
      causationId: sqliteNullableText(row.causation_id, "completion_gate_requests.causation_id"),
      projectId: sqliteText(row.project_id, "completion_gate_requests.project_id"),
      projectResourceRevision: positive(row.project_resource_revision, "completion_gate_requests.project_resource_revision"),
      projectConfigRevision: positive(row.project_config_revision, "completion_gate_requests.project_config_revision"),
      projectRootKey: sqliteText(row.project_root_key, "completion_gate_requests.project_root_key"),
      repositoryIdentity: sqliteText(row.repository_identity, "completion_gate_requests.repository_identity"),
      taskId: sqliteText(row.task_id, "completion_gate_requests.task_id"),
      taskRevision: positive(row.task_revision, "completion_gate_requests.task_revision"),
      executionId: sqliteText(row.execution_id, "completion_gate_requests.execution_id"),
      executionRevision: positive(row.execution_revision, "completion_gate_requests.execution_revision"),
      attemptNumber: positive(row.attempt_number, "completion_gate_requests.attempt_number"),
      fencingToken: positive(row.fencing_token, "completion_gate_requests.fencing_token"),
      workspaceId: sqliteText(row.workspace_id, "completion_gate_requests.workspace_id"),
      generation: positive(row.generation, "completion_gate_requests.generation"),
      workspaceRevision: positive(row.workspace_revision, "completion_gate_requests.workspace_revision"),
      workspaceRootKey: sqliteText(row.workspace_root_key, "completion_gate_requests.workspace_root_key"),
      ownershipBindingSha256: uppercaseSha256(row.ownership_binding_sha256, "completion_gate_requests.ownership_binding_sha256"),
      headObjectId,
      policyReceiptId: sqliteText(row.policy_receipt_id, "completion_gate_requests.policy_receipt_id"),
      policyId: sqliteText(row.policy_id, "completion_gate_requests.policy_id"),
      policyConfigRevision: positive(row.policy_config_revision, "completion_gate_requests.policy_config_revision"),
      gateId: sqliteText(row.gate_id, "completion_gate_requests.gate_id"),
      gateVersion: sqliteText(row.gate_version, "completion_gate_requests.gate_version"),
      commandKey: sqliteText(row.command_key, "completion_gate_requests.command_key"),
      commandIdentitySha256: uppercaseSha256(row.command_identity_sha256, "completion_gate_requests.command_identity_sha256"),
      completionEvidenceRootKey: sqliteText(row.completion_evidence_root_key, "completion_gate_requests.completion_evidence_root_key"),
      toolEnvironmentSha256: uppercaseSha256(row.tool_environment_sha256, "completion_gate_requests.tool_environment_sha256"),
      contractId, adapterId: sqliteText(row.adapter_id, "completion_gate_requests.adapter_id"),
      adapterVersion: sqliteText(row.adapter_version, "completion_gate_requests.adapter_version"),
      timeoutMs: row.timeout_ms === null ? null : positive(row.timeout_ms, "completion_gate_requests.timeout_ms"),
      createdAt: timestamp(row.created_at, "completion_gate_requests.created_at"),
    });
  }));
}

export function readCompletionGateAuthorizationDecisions(database: SqliteDatabase): readonly CompletionGateAuthorizationDecisionRecord[] {
  const phases = new Set<CompletionGateAuthorizationDecisionRecord["phase"]>(["prepare", "act", "finalize"]);
  const actions = new Set<CompletionGateAuthorizationDecisionRecord["action"]>([
    "completion.gate.run", "completion.gate.inspect", "completion.gate.cancel",
  ]);
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, operation_id, binding_revision, phase, actor_id, action, result,
      reason, policy_result, grant_id, grant_revision, confirmation_id, created_at
    FROM completion_gate_authorization_decisions ORDER BY decision_id`,
  ).all().map((row) => Object.freeze({
    decisionId: sqliteText(row.decision_id, "completion_gate_authorization_decisions.decision_id"),
    requestId: sqliteText(row.request_id, "completion_gate_authorization_decisions.request_id"),
    operationId: sqliteText(row.operation_id, "completion_gate_authorization_decisions.operation_id"),
    bindingRevision: positive(row.binding_revision, "completion_gate_authorization_decisions.binding_revision"),
    phase: enumText(row.phase, "completion_gate_authorization_decisions.phase", phases),
    actorId: sqliteText(row.actor_id, "completion_gate_authorization_decisions.actor_id"),
    action: enumText(row.action, "completion_gate_authorization_decisions.action", actions),
    result: enumText(row.result, "completion_gate_authorization_decisions.result", DECISION_RESULTS),
    reason: enumText(row.reason, "completion_gate_authorization_decisions.reason", AUTHORIZATION_REASONS),
    policy: enumText(row.policy_result, "completion_gate_authorization_decisions.policy_result", POLICY_RESULTS),
    grantId: sqliteNullableText(row.grant_id, "completion_gate_authorization_decisions.grant_id"),
    grantRevision: nullablePositive(row.grant_revision, "completion_gate_authorization_decisions.grant_revision"),
    confirmationId: sqliteNullableText(row.confirmation_id, "completion_gate_authorization_decisions.confirmation_id"),
    createdAt: timestamp(row.created_at, "completion_gate_authorization_decisions.created_at"),
  })));
}

export function readCompletionGateIntents(database: SqliteDatabase): readonly CompletionGateIntentRecord[] {
  const kinds = new Set<CompletionGateIntentRecord["operationKind"]>(["run_gate", "inspect_gate", "cancel_gate"]);
  const states = new Set<CompletionGateIntentRecord["state"]>(["pending", "executing", "observed", "verified", "finalized", "ambiguous", "failed"]);
  return Object.freeze(database.prepare(
    `SELECT intent_id, operation_id, idempotency_key, request_id, operation_kind, state, revision,
      current_authorization_decision_id, authorization_binding_revision, gate_operation_id,
      last_observation_number, last_failure_category, last_failure_code, last_failure_retryable,
      last_failure_ambiguous, created_at, updated_at FROM completion_gate_intents ORDER BY intent_id`,
  ).all().map((row) => Object.freeze({
    intentId: sqliteText(row.intent_id, "completion_gate_intents.intent_id"),
    operationId: sqliteText(row.operation_id, "completion_gate_intents.operation_id"),
    idempotencyKey: sqliteText(row.idempotency_key, "completion_gate_intents.idempotency_key"),
    requestId: sqliteText(row.request_id, "completion_gate_intents.request_id"),
    operationKind: enumText(row.operation_kind, "completion_gate_intents.operation_kind", kinds),
    state: enumText(row.state, "completion_gate_intents.state", states),
    revision: positive(row.revision, "completion_gate_intents.revision"),
    currentAuthorizationDecisionId: sqliteText(row.current_authorization_decision_id, "completion_gate_intents.current_authorization_decision_id"),
    authorizationBindingRevision: positive(row.authorization_binding_revision, "completion_gate_intents.authorization_binding_revision"),
    gateOperationId: sqliteText(row.gate_operation_id, "completion_gate_intents.gate_operation_id"),
    lastObservationNumber: nonnegative(row.last_observation_number, "completion_gate_intents.last_observation_number"),
    lastFailureCategory: sqliteNullableText(row.last_failure_category, "completion_gate_intents.last_failure_category"),
    lastFailureCode: sqliteNullableText(row.last_failure_code, "completion_gate_intents.last_failure_code"),
    lastFailureRetryable: sqliteNullableBoolean(row.last_failure_retryable, "completion_gate_intents.last_failure_retryable"),
    lastFailureAmbiguous: sqliteNullableBoolean(row.last_failure_ambiguous, "completion_gate_intents.last_failure_ambiguous"),
    createdAt: timestamp(row.created_at, "completion_gate_intents.created_at"),
    updatedAt: timestamp(row.updated_at, "completion_gate_intents.updated_at"),
  })));
}

export function readCompletionGateObservations(database: SqliteDatabase): readonly CompletionGateObservationRecord[] {
  const lifecycles = new Set<CompletionGateObservationRecord["lifecycle"]>(["running", "completed", "cancel_requested", "cancelled", "unknown"]);
  const verdicts = new Set<CompletionGateObservationRecord["verdict"]>(["pass", "fail", "indeterminate"]);
  return Object.freeze(database.prepare(
    `SELECT observation_id, intent_id, observation_number, adapter_receipt_id, receipt_sha256,
      authorization_decision_id, gate_operation_id, lifecycle, verdict, code, started_at, ended_at,
      valid_until, evidence_reference, observed_at FROM completion_gate_observations
    ORDER BY intent_id, observation_number`,
  ).all().map((row) => Object.freeze({
    observationId: sqliteText(row.observation_id, "completion_gate_observations.observation_id"),
    intentId: sqliteText(row.intent_id, "completion_gate_observations.intent_id"),
    observationNumber: positive(row.observation_number, "completion_gate_observations.observation_number"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "completion_gate_observations.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "completion_gate_observations.receipt_sha256"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "completion_gate_observations.authorization_decision_id"),
    gateOperationId: sqliteText(row.gate_operation_id, "completion_gate_observations.gate_operation_id"),
    lifecycle: enumText(row.lifecycle, "completion_gate_observations.lifecycle", lifecycles),
    verdict: enumText(row.verdict, "completion_gate_observations.verdict", verdicts),
    code: sqliteText(row.code, "completion_gate_observations.code"),
    startedAt: row.started_at === null ? null : timestamp(row.started_at, "completion_gate_observations.started_at"),
    endedAt: row.ended_at === null ? null : timestamp(row.ended_at, "completion_gate_observations.ended_at"),
    validUntil: row.valid_until === null ? null : timestamp(row.valid_until, "completion_gate_observations.valid_until"),
    evidenceReference: sqliteText(row.evidence_reference, "completion_gate_observations.evidence_reference"),
    observedAt: timestamp(row.observed_at, "completion_gate_observations.observed_at"),
  })));
}

export function readCompletionGateReceipts(database: SqliteDatabase): readonly CompletionGateVerifiedReceiptRecord[] {
  const verdicts = new Set<CompletionGateVerifiedReceiptRecord["verdict"]>(["pass", "fail"]);
  return Object.freeze(database.prepare(
    `SELECT verified_receipt_id, intent_id, observation_id, observation_number, adapter_receipt_id,
      receipt_sha256, gate_operation_id, verdict, valid_until, verified_at
    FROM completion_gate_verified_receipts ORDER BY verified_receipt_id`,
  ).all().map((row) => Object.freeze({
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "completion_gate_verified_receipts.verified_receipt_id"),
    intentId: sqliteText(row.intent_id, "completion_gate_verified_receipts.intent_id"),
    observationId: sqliteText(row.observation_id, "completion_gate_verified_receipts.observation_id"),
    observationNumber: positive(row.observation_number, "completion_gate_verified_receipts.observation_number"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "completion_gate_verified_receipts.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "completion_gate_verified_receipts.receipt_sha256"),
    gateOperationId: sqliteText(row.gate_operation_id, "completion_gate_verified_receipts.gate_operation_id"),
    verdict: enumText(row.verdict, "completion_gate_verified_receipts.verdict", verdicts),
    validUntil: row.valid_until === null ? null : timestamp(row.valid_until, "completion_gate_verified_receipts.valid_until"),
    verifiedAt: timestamp(row.verified_at, "completion_gate_verified_receipts.verified_at"),
  })));
}

export function readCompletionGateFinalizations(database: SqliteDatabase): readonly CompletionGateFinalizationRecord[] {
  const outcomes = new Set<CompletionGateFinalizationRecord["outcome"]>(["accepted", "refused", "ambiguous", "failed"]);
  return Object.freeze(database.prepare(
    `SELECT finalization_id, intent_id, verified_receipt_id, authorization_decision_id, outcome, code,
      finalized_at FROM completion_gate_finalizations ORDER BY finalization_id`,
  ).all().map((row) => Object.freeze({
    finalizationId: sqliteText(row.finalization_id, "completion_gate_finalizations.finalization_id"),
    intentId: sqliteText(row.intent_id, "completion_gate_finalizations.intent_id"),
    verifiedReceiptId: sqliteNullableText(row.verified_receipt_id, "completion_gate_finalizations.verified_receipt_id"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "completion_gate_finalizations.authorization_decision_id"),
    outcome: enumText(row.outcome, "completion_gate_finalizations.outcome", outcomes),
    code: sqliteText(row.code, "completion_gate_finalizations.code"),
    finalizedAt: timestamp(row.finalized_at, "completion_gate_finalizations.finalized_at"),
  })));
}

export function readCompletionGateEvents(database: SqliteDatabase): readonly CompletionGateEventRecord[] {
  const kinds = new Set<CompletionGateEventRecord["eventKind"]>([
    "completion.gate.prepared", "completion.gate.denied", "completion.gate.executing", "completion.gate.observed",
    "completion.gate.verified", "completion.gate.finalized", "completion.gate.reconciled",
  ]);
  const outcomes = new Set<CompletionGateEventRecord["outcome"]>(["accepted", "denied", "refused", "ambiguous", "failed"]);
  return Object.freeze(database.prepare(
    `SELECT event_id, operation_id, intent_id, event_kind, outcome, reason_code, actor_id,
      correlation_id, observation_number, evidence_reference, created_at
    FROM completion_gate_events ORDER BY event_id`,
  ).all().map((row) => Object.freeze({
    eventId: sqliteText(row.event_id, "completion_gate_events.event_id"),
    operationId: sqliteText(row.operation_id, "completion_gate_events.operation_id"),
    intentId: sqliteNullableText(row.intent_id, "completion_gate_events.intent_id"),
    eventKind: enumText(row.event_kind, "completion_gate_events.event_kind", kinds),
    outcome: enumText(row.outcome, "completion_gate_events.outcome", outcomes),
    reasonCode: sqliteText(row.reason_code, "completion_gate_events.reason_code"),
    actorId: sqliteText(row.actor_id, "completion_gate_events.actor_id"),
    correlationId: sqliteText(row.correlation_id, "completion_gate_events.correlation_id"),
    observationNumber: nullablePositive(row.observation_number, "completion_gate_events.observation_number"),
    evidenceReference: sqliteNullableText(row.evidence_reference, "completion_gate_events.evidence_reference"),
    createdAt: timestamp(row.created_at, "completion_gate_events.created_at"),
  })));
}

export function readPolicyGatedCompletionDecisions(database: SqliteDatabase): readonly PolicyGatedCompletionDecisionRecord[] {
  return Object.freeze(database.prepare(
    `SELECT completion_decision_id, operation_id, idempotency_key, execution_success_verified_receipt_id,
      execution_success_finalization_id, policy_receipt_id, gate_set_sha256, workspace_evidence_sha256,
      head_object_id, integration_evidence_sha256, preservation_state_sha256, request_id,
      authorization_decision_id, audit_id, confirmation_id, created_at
    FROM policy_gated_completion_decisions ORDER BY completion_decision_id`,
  ).all().map((row) => {
    const headObjectId = sqliteText(row.head_object_id, "policy_gated_completion_decisions.head_object_id");
    if (!/^[0-9a-f]{40}$/u.test(headObjectId)) throw persistenceFailure("CORRUPT_ROW", "Policy completion HEAD is invalid");
    return Object.freeze({
      completionDecisionId: sqliteText(row.completion_decision_id, "policy_gated_completion_decisions.completion_decision_id"),
      operationId: sqliteText(row.operation_id, "policy_gated_completion_decisions.operation_id"),
      idempotencyKey: sqliteText(row.idempotency_key, "policy_gated_completion_decisions.idempotency_key"),
      executionSuccessVerifiedReceiptId: sqliteText(row.execution_success_verified_receipt_id, "policy_gated_completion_decisions.execution_success_verified_receipt_id"),
      executionSuccessFinalizationId: sqliteText(row.execution_success_finalization_id, "policy_gated_completion_decisions.execution_success_finalization_id"),
      policyReceiptId: sqliteText(row.policy_receipt_id, "policy_gated_completion_decisions.policy_receipt_id"),
      gateSetSha256: uppercaseSha256(row.gate_set_sha256, "policy_gated_completion_decisions.gate_set_sha256"),
      workspaceEvidenceSha256: uppercaseSha256(row.workspace_evidence_sha256, "policy_gated_completion_decisions.workspace_evidence_sha256"),
      headObjectId,
      integrationEvidenceSha256: uppercaseSha256(row.integration_evidence_sha256, "policy_gated_completion_decisions.integration_evidence_sha256"),
      preservationStateSha256: uppercaseSha256(row.preservation_state_sha256, "policy_gated_completion_decisions.preservation_state_sha256"),
      requestId: sqliteText(row.request_id, "policy_gated_completion_decisions.request_id"),
      authorizationDecisionId: sqliteText(row.authorization_decision_id, "policy_gated_completion_decisions.authorization_decision_id"),
      auditId: sqliteText(row.audit_id, "policy_gated_completion_decisions.audit_id"),
      confirmationId: sqliteText(row.confirmation_id, "policy_gated_completion_decisions.confirmation_id"),
      createdAt: timestamp(row.created_at, "policy_gated_completion_decisions.created_at"),
    });
  }));
}

export function readIntegrationTargetSequences(database: SqliteDatabase): readonly IntegrationTargetSequenceRecord[] {
  return Object.freeze(database.prepare(
    `SELECT project_id, repository_identity, target_reference, last_fencing_token
    FROM integration_target_sequences ORDER BY project_id, repository_identity, target_reference`,
  ).all().map((row) => Object.freeze({
    projectId: sqliteText(row.project_id, "integration_target_sequences.project_id"),
    repositoryIdentity: sqliteText(row.repository_identity, "integration_target_sequences.repository_identity"),
    targetReference: sqliteText(row.target_reference, "integration_target_sequences.target_reference"),
    lastFencingToken: positive(row.last_fencing_token, "integration_target_sequences.last_fencing_token"),
  })));
}

export function readIntegrationReservations(database: SqliteDatabase): readonly IntegrationReservationRecord[] {
  const statuses = new Set<IntegrationReservationRecord["status"]>(["active", "ambiguous", "released", "expired"]);
  return Object.freeze(database.prepare(
    `SELECT reservation_id, revision, status, project_id, project_resource_revision, project_config_revision,
      project_root_key, repository_identity, object_format, target_reference, expected_target_object_id,
      source_workspace_id, source_generation, source_workspace_revision, source_workspace_root_key,
      source_ownership_binding_sha256, source_head_object_id, owner_execution_id, owner_operation_id,
      lease_owner_id, lease_revision, fencing_token, expires_at, policy_receipt_id, policy_config_revision,
      destination_identity, destination_reference, expected_remote_head, current_evidence_sha256, created_at, updated_at
    FROM integration_reservations ORDER BY reservation_id`,
  ).all().map((row) => {
    const objectFormat = sqliteText(row.object_format, "integration_reservations.object_format");
    if (objectFormat !== "sha1") throw persistenceFailure("CORRUPT_ROW", "Integration object format is unsupported");
    return Object.freeze({
      reservationId: sqliteText(row.reservation_id, "integration_reservations.reservation_id"),
      revision: positive(row.revision, "integration_reservations.revision"),
      status: enumText(row.status, "integration_reservations.status", statuses),
      projectId: sqliteText(row.project_id, "integration_reservations.project_id"),
      projectResourceRevision: positive(row.project_resource_revision, "integration_reservations.project_resource_revision"),
      projectConfigRevision: positive(row.project_config_revision, "integration_reservations.project_config_revision"),
      projectRootKey: sqliteText(row.project_root_key, "integration_reservations.project_root_key"),
      repositoryIdentity: sqliteText(row.repository_identity, "integration_reservations.repository_identity"),
      objectFormat,
      targetReference: sqliteText(row.target_reference, "integration_reservations.target_reference"),
      expectedTargetObjectId: lowercaseSha1(row.expected_target_object_id, "integration_reservations.expected_target_object_id"),
      sourceWorkspaceId: sqliteText(row.source_workspace_id, "integration_reservations.source_workspace_id"),
      sourceGeneration: positive(row.source_generation, "integration_reservations.source_generation"),
      sourceWorkspaceRevision: positive(row.source_workspace_revision, "integration_reservations.source_workspace_revision"),
      sourceWorkspaceRootKey: sqliteText(row.source_workspace_root_key, "integration_reservations.source_workspace_root_key"),
      sourceOwnershipBindingSha256: uppercaseSha256(row.source_ownership_binding_sha256, "integration_reservations.source_ownership_binding_sha256"),
      sourceHeadObjectId: lowercaseSha1(row.source_head_object_id, "integration_reservations.source_head_object_id"),
      ownerExecutionId: sqliteText(row.owner_execution_id, "integration_reservations.owner_execution_id"),
      ownerOperationId: sqliteText(row.owner_operation_id, "integration_reservations.owner_operation_id"),
      leaseOwnerId: sqliteText(row.lease_owner_id, "integration_reservations.lease_owner_id"),
      leaseRevision: positive(row.lease_revision, "integration_reservations.lease_revision"),
      fencingToken: positive(row.fencing_token, "integration_reservations.fencing_token"),
      expiresAt: timestamp(row.expires_at, "integration_reservations.expires_at"),
      policyReceiptId: sqliteText(row.policy_receipt_id, "integration_reservations.policy_receipt_id"),
      policyConfigRevision: positive(row.policy_config_revision, "integration_reservations.policy_config_revision"),
      destinationIdentity: sqliteText(row.destination_identity, "integration_reservations.destination_identity"),
      destinationReference: sqliteText(row.destination_reference, "integration_reservations.destination_reference"),
      expectedRemoteHead: nullableLowercaseSha1(row.expected_remote_head, "integration_reservations.expected_remote_head"),
      currentEvidenceSha256: row.current_evidence_sha256 === null ? null : uppercaseSha256(row.current_evidence_sha256, "integration_reservations.current_evidence_sha256"),
      createdAt: timestamp(row.created_at, "integration_reservations.created_at"),
      updatedAt: timestamp(row.updated_at, "integration_reservations.updated_at"),
    });
  }));
}

export function readIntegrationOperationRequests(database: SqliteDatabase): readonly IntegrationOperationRequestRecord[] {
  const kinds = new Set<IntegrationOperationRequestRecord["operationKind"]>(["apply", "push"]);
  return Object.freeze(database.prepare(
    `SELECT request_id, operation_id, idempotency_key, operation_kind, actor_id, correlation_id,
      causation_id, reservation_id, expected_reservation_revision, expected_lease_revision,
      expected_fencing_token, contract_id, adapter_id, adapter_version, created_at
    FROM integration_operation_requests ORDER BY request_id`,
  ).all().map((row) => {
    const contractId = sqliteText(row.contract_id, "integration_operation_requests.contract_id");
    if (contractId !== "ato.integration/v1") throw persistenceFailure("CORRUPT_ROW", "Integration contract is unsupported");
    return Object.freeze({
      requestId: sqliteText(row.request_id, "integration_operation_requests.request_id"),
      operationId: sqliteText(row.operation_id, "integration_operation_requests.operation_id"),
      idempotencyKey: sqliteText(row.idempotency_key, "integration_operation_requests.idempotency_key"),
      operationKind: enumText(row.operation_kind, "integration_operation_requests.operation_kind", kinds),
      actorId: sqliteText(row.actor_id, "integration_operation_requests.actor_id"),
      correlationId: sqliteText(row.correlation_id, "integration_operation_requests.correlation_id"),
      causationId: sqliteNullableText(row.causation_id, "integration_operation_requests.causation_id"),
      reservationId: sqliteText(row.reservation_id, "integration_operation_requests.reservation_id"),
      expectedReservationRevision: positive(row.expected_reservation_revision, "integration_operation_requests.expected_reservation_revision"),
      expectedLeaseRevision: positive(row.expected_lease_revision, "integration_operation_requests.expected_lease_revision"),
      expectedFencingToken: positive(row.expected_fencing_token, "integration_operation_requests.expected_fencing_token"),
      contractId,
      adapterId: sqliteText(row.adapter_id, "integration_operation_requests.adapter_id"),
      adapterVersion: sqliteText(row.adapter_version, "integration_operation_requests.adapter_version"),
      createdAt: timestamp(row.created_at, "integration_operation_requests.created_at"),
    });
  }));
}

export function readIntegrationAuthorizationDecisions(database: SqliteDatabase): readonly IntegrationAuthorizationDecisionRecord[] {
  const phases = new Set<IntegrationAuthorizationDecisionRecord["phase"]>(["prepare", "act", "finalize"]);
  const actions = new Set<IntegrationAuthorizationDecisionRecord["action"]>(["integration.apply", "integration.push"]);
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, operation_id, binding_revision, phase, actor_id, action,
      result, reason, policy_result, grant_id, grant_revision, confirmation_id, created_at
    FROM integration_authorization_decisions ORDER BY decision_id`,
  ).all().map((row) => Object.freeze({
    decisionId: sqliteText(row.decision_id, "integration_authorization_decisions.decision_id"),
    requestId: sqliteText(row.request_id, "integration_authorization_decisions.request_id"),
    operationId: sqliteText(row.operation_id, "integration_authorization_decisions.operation_id"),
    bindingRevision: positive(row.binding_revision, "integration_authorization_decisions.binding_revision"),
    phase: enumText(row.phase, "integration_authorization_decisions.phase", phases),
    actorId: sqliteText(row.actor_id, "integration_authorization_decisions.actor_id"),
    action: enumText(row.action, "integration_authorization_decisions.action", actions),
    result: enumText(row.result, "integration_authorization_decisions.result", DECISION_RESULTS),
    reason: enumText(row.reason, "integration_authorization_decisions.reason", AUTHORIZATION_REASONS),
    policy: enumText(row.policy_result, "integration_authorization_decisions.policy_result", POLICY_RESULTS),
    grantId: sqliteNullableText(row.grant_id, "integration_authorization_decisions.grant_id"),
    grantRevision: nullablePositive(row.grant_revision, "integration_authorization_decisions.grant_revision"),
    confirmationId: sqliteNullableText(row.confirmation_id, "integration_authorization_decisions.confirmation_id"),
    createdAt: timestamp(row.created_at, "integration_authorization_decisions.created_at"),
  })));
}

export function readIntegrationIntents(database: SqliteDatabase): readonly IntegrationIntentRecord[] {
  const kinds = new Set<IntegrationIntentRecord["operationKind"]>(["apply", "push"]);
  const states = new Set<IntegrationIntentRecord["state"]>(["pending", "executing", "observed", "verified", "finalized", "ambiguous", "failed"]);
  const recoveries = new Set<Exclude<IntegrationIntentRecord["recoveryResult"], null>>([
    "recovered_no_effect", "recovered_local_applied", "recovered_pushed", "recovered_inconsistent",
  ]);
  return Object.freeze(database.prepare(
    `SELECT intent_id, operation_id, idempotency_key, request_id, reservation_id, reservation_fencing_token,
      operation_kind, state, revision, current_authorization_decision_id, authorization_binding_revision,
      last_observation_number, recovery_result, last_failure_category, last_failure_code,
      last_failure_retryable, last_failure_ambiguous, created_at, updated_at
    FROM integration_intents ORDER BY intent_id`,
  ).all().map((row) => Object.freeze({
    intentId: sqliteText(row.intent_id, "integration_intents.intent_id"),
    operationId: sqliteText(row.operation_id, "integration_intents.operation_id"),
    idempotencyKey: sqliteText(row.idempotency_key, "integration_intents.idempotency_key"),
    requestId: sqliteText(row.request_id, "integration_intents.request_id"),
    reservationId: sqliteText(row.reservation_id, "integration_intents.reservation_id"),
    reservationFencingToken: positive(row.reservation_fencing_token, "integration_intents.reservation_fencing_token"),
    operationKind: enumText(row.operation_kind, "integration_intents.operation_kind", kinds),
    state: enumText(row.state, "integration_intents.state", states),
    revision: positive(row.revision, "integration_intents.revision"),
    currentAuthorizationDecisionId: sqliteText(row.current_authorization_decision_id, "integration_intents.current_authorization_decision_id"),
    authorizationBindingRevision: positive(row.authorization_binding_revision, "integration_intents.authorization_binding_revision"),
    lastObservationNumber: nonnegative(row.last_observation_number, "integration_intents.last_observation_number"),
    recoveryResult: row.recovery_result === null ? null : enumText(row.recovery_result, "integration_intents.recovery_result", recoveries),
    lastFailureCategory: sqliteNullableText(row.last_failure_category, "integration_intents.last_failure_category"),
    lastFailureCode: sqliteNullableText(row.last_failure_code, "integration_intents.last_failure_code"),
    lastFailureRetryable: sqliteNullableBoolean(row.last_failure_retryable, "integration_intents.last_failure_retryable"),
    lastFailureAmbiguous: sqliteNullableBoolean(row.last_failure_ambiguous, "integration_intents.last_failure_ambiguous"),
    createdAt: timestamp(row.created_at, "integration_intents.created_at"),
    updatedAt: timestamp(row.updated_at, "integration_intents.updated_at"),
  })));
}

export function readIntegrationObservations(database: SqliteDatabase): readonly IntegrationObservationRecord[] {
  const operations = new Set<IntegrationObservationRecord["operation"]>(["inspect", "apply", "push"]);
  const localStates = new Set<IntegrationObservationRecord["localState"]>(["unchanged", "fast_forwarded", "already_at_source", "foreign", "unknown"]);
  const remoteStates = new Set<IntegrationObservationRecord["remoteState"]>(["not_requested", "absent", "unchanged", "pushed", "already_at_source", "rejected", "foreign", "unknown"]);
  const outcomes = new Set<IntegrationObservationRecord["outcome"]>(["succeeded", "refused", "ambiguous"]);
  return Object.freeze(database.prepare(
    `SELECT observation_id, reservation_id, intent_id, observation_number, operation, adapter_receipt_id, receipt_sha256,
      authorization_decision_id, local_before_object_id, local_after_object_id, remote_before_object_id,
      remote_after_object_id, local_state, remote_state, outcome, code, evidence_reference, observed_at
    FROM integration_observations ORDER BY intent_id, observation_number`,
  ).all().map((row) => Object.freeze({
    observationId: sqliteText(row.observation_id, "integration_observations.observation_id"),
    reservationId: sqliteText(row.reservation_id, "integration_observations.reservation_id"),
    intentId: sqliteNullableText(row.intent_id, "integration_observations.intent_id"),
    observationNumber: positive(row.observation_number, "integration_observations.observation_number"),
    operation: enumText(row.operation, "integration_observations.operation", operations),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "integration_observations.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "integration_observations.receipt_sha256"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "integration_observations.authorization_decision_id"),
    localBeforeObjectId: nullableLowercaseSha1(row.local_before_object_id, "integration_observations.local_before_object_id"),
    localAfterObjectId: nullableLowercaseSha1(row.local_after_object_id, "integration_observations.local_after_object_id"),
    remoteBeforeObjectId: nullableLowercaseSha1(row.remote_before_object_id, "integration_observations.remote_before_object_id"),
    remoteAfterObjectId: nullableLowercaseSha1(row.remote_after_object_id, "integration_observations.remote_after_object_id"),
    localState: enumText(row.local_state, "integration_observations.local_state", localStates),
    remoteState: enumText(row.remote_state, "integration_observations.remote_state", remoteStates),
    outcome: enumText(row.outcome, "integration_observations.outcome", outcomes),
    code: sqliteText(row.code, "integration_observations.code"),
    evidenceReference: sqliteText(row.evidence_reference, "integration_observations.evidence_reference"),
    observedAt: timestamp(row.observed_at, "integration_observations.observed_at"),
  })));
}

export function readIntegrationReceipts(database: SqliteDatabase): readonly IntegrationVerifiedReceiptRecord[] {
  const outcomes = new Set<IntegrationVerifiedReceiptRecord["outcome"]>(["succeeded", "refused"]);
  return Object.freeze(database.prepare(
    `SELECT verified_receipt_id, intent_id, observation_id, observation_number, adapter_receipt_id,
      receipt_sha256, outcome, code, verified_at FROM integration_verified_receipts ORDER BY verified_receipt_id`,
  ).all().map((row) => Object.freeze({
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "integration_verified_receipts.verified_receipt_id"),
    intentId: sqliteText(row.intent_id, "integration_verified_receipts.intent_id"),
    observationId: sqliteText(row.observation_id, "integration_verified_receipts.observation_id"),
    observationNumber: positive(row.observation_number, "integration_verified_receipts.observation_number"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "integration_verified_receipts.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "integration_verified_receipts.receipt_sha256"),
    outcome: enumText(row.outcome, "integration_verified_receipts.outcome", outcomes),
    code: sqliteText(row.code, "integration_verified_receipts.code"),
    verifiedAt: timestamp(row.verified_at, "integration_verified_receipts.verified_at"),
  })));
}

export function readIntegrationFinalizations(database: SqliteDatabase): readonly IntegrationFinalizationRecord[] {
  const outcomes = new Set<IntegrationFinalizationRecord["outcome"]>(["succeeded", "refused", "ambiguous", "failed"]);
  const recoveries = new Set<Exclude<IntegrationFinalizationRecord["recoveryResult"], null>>([
    "recovered_no_effect", "recovered_local_applied", "recovered_pushed", "recovered_inconsistent",
  ]);
  return Object.freeze(database.prepare(
    `SELECT finalization_id, intent_id, verified_receipt_id, authorization_decision_id, outcome,
      code, recovery_result, finalized_at FROM integration_finalizations ORDER BY finalization_id`,
  ).all().map((row) => Object.freeze({
    finalizationId: sqliteText(row.finalization_id, "integration_finalizations.finalization_id"),
    intentId: sqliteText(row.intent_id, "integration_finalizations.intent_id"),
    verifiedReceiptId: sqliteNullableText(row.verified_receipt_id, "integration_finalizations.verified_receipt_id"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "integration_finalizations.authorization_decision_id"),
    outcome: enumText(row.outcome, "integration_finalizations.outcome", outcomes),
    code: sqliteText(row.code, "integration_finalizations.code"),
    recoveryResult: row.recovery_result === null ? null : enumText(row.recovery_result, "integration_finalizations.recovery_result", recoveries),
    finalizedAt: timestamp(row.finalized_at, "integration_finalizations.finalized_at"),
  })));
}

export function readIntegrationEvents(database: SqliteDatabase): readonly IntegrationEventRecord[] {
  const kinds = new Set<IntegrationEventRecord["eventKind"]>([
    "integration.reserved", "integration.renewed", "integration.taken_over", "integration.released", "integration.expired",
    "integration.ambiguous", "integration.operation.prepared", "integration.operation.denied", "integration.operation.executing",
    "integration.operation.observed", "integration.operation.verified", "integration.operation.finalized", "integration.operation.reconciled",
  ]);
  const outcomes = new Set<IntegrationEventRecord["outcome"]>(["accepted", "denied", "refused", "ambiguous", "failed"]);
  return Object.freeze(database.prepare(
    `SELECT event_id, reservation_id, operation_id, intent_id, event_kind, outcome, reason_code,
      actor_id, correlation_id, observation_number, evidence_reference, created_at
    FROM integration_events ORDER BY event_id`,
  ).all().map((row) => Object.freeze({
    eventId: sqliteText(row.event_id, "integration_events.event_id"),
    reservationId: sqliteText(row.reservation_id, "integration_events.reservation_id"),
    operationId: sqliteText(row.operation_id, "integration_events.operation_id"),
    intentId: sqliteNullableText(row.intent_id, "integration_events.intent_id"),
    eventKind: enumText(row.event_kind, "integration_events.event_kind", kinds),
    outcome: enumText(row.outcome, "integration_events.outcome", outcomes),
    reasonCode: sqliteText(row.reason_code, "integration_events.reason_code"),
    actorId: sqliteText(row.actor_id, "integration_events.actor_id"),
    correlationId: sqliteText(row.correlation_id, "integration_events.correlation_id"),
    observationNumber: nullablePositive(row.observation_number, "integration_events.observation_number"),
    evidenceReference: sqliteNullableText(row.evidence_reference, "integration_events.evidence_reference"),
    createdAt: timestamp(row.created_at, "integration_events.created_at"),
  })));
}

export function readWorkspaceCleanupAttestations(database: SqliteDatabase): readonly WorkspaceCleanupAttestationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT attestation_id, operation_id, intent_id, project_id, task_id, execution_id, workspace_id,
      generation, attestation_json, attestation_sha256, quiescence_sha256, issued_at, valid_until
    FROM workspace_cleanup_attestations ORDER BY attestation_id`,
  ).all().map((row) => Object.freeze({
    attestationId: sqliteText(row.attestation_id, "workspace_cleanup_attestations.attestation_id"),
    operationId: sqliteText(row.operation_id, "workspace_cleanup_attestations.operation_id"),
    intentId: sqliteText(row.intent_id, "workspace_cleanup_attestations.intent_id"),
    projectId: sqliteText(row.project_id, "workspace_cleanup_attestations.project_id"),
    taskId: sqliteText(row.task_id, "workspace_cleanup_attestations.task_id"),
    executionId: sqliteText(row.execution_id, "workspace_cleanup_attestations.execution_id"),
    workspaceId: sqliteText(row.workspace_id, "workspace_cleanup_attestations.workspace_id"),
    generation: positive(row.generation, "workspace_cleanup_attestations.generation"),
    attestationJson: sqliteText(row.attestation_json, "workspace_cleanup_attestations.attestation_json"),
    attestationSha256: uppercaseSha256(row.attestation_sha256, "workspace_cleanup_attestations.attestation_sha256"),
    quiescenceSha256: uppercaseSha256(row.quiescence_sha256, "workspace_cleanup_attestations.quiescence_sha256"),
    issuedAt: timestamp(row.issued_at, "workspace_cleanup_attestations.issued_at"),
    validUntil: timestamp(row.valid_until, "workspace_cleanup_attestations.valid_until"),
  })));
}

export function readWorkspaceGenerations(database: SqliteDatabase): readonly WorkspaceGenerationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT workspace_id, generation, revision, status, project_id, project_resource_revision,
      project_config_revision, project_root_key, task_id, task_revision, run_id, run_revision,
      member_id, membership_revision, member_revision, execution_id, execution_revision,
      attempt_number, fencing_token, workspace_root_key,
      creator_operation_id, predecessor_generation, predecessor_revision, base_reference,
      contract_id, adapter_id, adapter_version, created_at, updated_at
    FROM workspace_generations ORDER BY workspace_id, generation`,
  ).all().map((row) => Object.freeze({
    workspaceId: sqliteText(row.workspace_id, "workspace_generations.workspace_id"),
    generation: positive(row.generation, "workspace_generations.generation"),
    revision: positive(row.revision, "workspace_generations.revision"),
    status: enumText(row.status, "workspace_generations.status", WORKSPACE_STATUSES),
    projectId: sqliteText(row.project_id, "workspace_generations.project_id"),
    projectResourceRevision: positive(row.project_resource_revision, "workspace_generations.project_resource_revision"),
    projectConfigRevision: positive(row.project_config_revision, "workspace_generations.project_config_revision"),
    projectRootKey: sqliteText(row.project_root_key, "workspace_generations.project_root_key"),
    taskId: sqliteText(row.task_id, "workspace_generations.task_id"),
    taskRevision: positive(row.task_revision, "workspace_generations.task_revision"),
    runId: sqliteText(row.run_id, "workspace_generations.run_id"),
    runRevision: positive(row.run_revision, "workspace_generations.run_revision"),
    memberId: sqliteText(row.member_id, "workspace_generations.member_id"),
    membershipRevision: positive(row.membership_revision, "workspace_generations.membership_revision"),
    memberRevision: positive(row.member_revision, "workspace_generations.member_revision"),
    executionId: sqliteText(row.execution_id, "workspace_generations.execution_id"),
    executionRevision: positive(row.execution_revision, "workspace_generations.execution_revision"),
    attemptNumber: positive(row.attempt_number, "workspace_generations.attempt_number"),
    fencingToken: positive(row.fencing_token, "workspace_generations.fencing_token"),
    workspaceRootKey: sqliteText(row.workspace_root_key, "workspace_generations.workspace_root_key"),
    creatorOperationId: sqliteText(row.creator_operation_id, "workspace_generations.creator_operation_id"),
    predecessorGeneration: nullablePositive(row.predecessor_generation, "workspace_generations.predecessor_generation"),
    predecessorRevision: nullablePositive(row.predecessor_revision, "workspace_generations.predecessor_revision"),
    baseReference: sqliteText(row.base_reference, "workspace_generations.base_reference"),
    contractId: enumText(row.contract_id, "workspace_generations.contract_id", new Set(["ato.workspace/v2"] as const)),
    adapterId: sqliteText(row.adapter_id, "workspace_generations.adapter_id"),
    adapterVersion: sqliteText(row.adapter_version, "workspace_generations.adapter_version"),
    createdAt: timestamp(row.created_at, "workspace_generations.created_at"),
    updatedAt: timestamp(row.updated_at, "workspace_generations.updated_at"),
  })));
}

export function readWorkspaceAuthorizationDecisions(database: SqliteDatabase): readonly WorkspaceAuthorizationDecisionRecord[] {
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, operation_id, binding_revision, phase, actor_id, action,
      result, reason, policy_result, grant_id, grant_revision, project_id,
      project_resource_revision, project_config_revision, execution_id, execution_revision,
      fencing_token, workspace_id, generation, generation_revision, created_at
    FROM workspace_authorization_decisions ORDER BY operation_id, binding_revision`,
  ).all().map((row) => Object.freeze({
    decisionId: sqliteText(row.decision_id, "workspace_authorization_decisions.decision_id"),
    requestId: sqliteText(row.request_id, "workspace_authorization_decisions.request_id"),
    operationId: sqliteText(row.operation_id, "workspace_authorization_decisions.operation_id"),
    bindingRevision: positive(row.binding_revision, "workspace_authorization_decisions.binding_revision"),
    phase: enumText(row.phase, "workspace_authorization_decisions.phase", new Set(["prepare", "act", "finalize"] as const)),
    actorId: sqliteText(row.actor_id, "workspace_authorization_decisions.actor_id"),
    action: enumText(row.action, "workspace_authorization_decisions.action", WORKSPACE_ACTIONS),
    result: enumText(row.result, "workspace_authorization_decisions.result", DECISION_RESULTS),
    reason: enumText(row.reason, "workspace_authorization_decisions.reason", AUTHORIZATION_REASONS),
    policy: enumText(row.policy_result, "workspace_authorization_decisions.policy_result", POLICY_RESULTS),
    grantId: sqliteNullableText(row.grant_id, "workspace_authorization_decisions.grant_id"),
    grantRevision: nullablePositive(row.grant_revision, "workspace_authorization_decisions.grant_revision"),
    projectId: sqliteText(row.project_id, "workspace_authorization_decisions.project_id"),
    projectResourceRevision: positive(row.project_resource_revision, "workspace_authorization_decisions.project_resource_revision"),
    projectConfigRevision: positive(row.project_config_revision, "workspace_authorization_decisions.project_config_revision"),
    executionId: sqliteText(row.execution_id, "workspace_authorization_decisions.execution_id"),
    executionRevision: positive(row.execution_revision, "workspace_authorization_decisions.execution_revision"),
    fencingToken: positive(row.fencing_token, "workspace_authorization_decisions.fencing_token"),
    workspaceId: sqliteNullableText(row.workspace_id, "workspace_authorization_decisions.workspace_id"),
    generation: nullablePositive(row.generation, "workspace_authorization_decisions.generation"),
    generationRevision: nullablePositive(row.generation_revision, "workspace_authorization_decisions.generation_revision"),
    createdAt: timestamp(row.created_at, "workspace_authorization_decisions.created_at"),
  })));
}

export function readWorkspaceIntents(database: SqliteDatabase): readonly WorkspaceOperationIntentRecord[] {
  return Object.freeze(database.prepare(
    `SELECT intent_id, operation_id, idempotency_key, operation_kind, action, state, revision,
      actor_id, request_id, correlation_id, causation_id, current_authorization_decision_id,
      authorization_binding_revision, confirmation_id, workspace_id, generation,
      expected_generation_revision, expected_generation_status, last_observation_number,
      last_failure_category, last_failure_code, last_failure_retryable, last_failure_ambiguous,
      contract_id, adapter_id, adapter_version, created_at, updated_at
    FROM workspace_operation_intents ORDER BY intent_id`,
  ).all().map((row) => Object.freeze({
    intentId: sqliteText(row.intent_id, "workspace_operation_intents.intent_id"),
    operationId: sqliteText(row.operation_id, "workspace_operation_intents.operation_id"),
    idempotencyKey: sqliteText(row.idempotency_key, "workspace_operation_intents.idempotency_key"),
    operationKind: enumText(row.operation_kind, "workspace_operation_intents.operation_kind", new Set(["reserve", "create", "inspect", "recover", "cleanup"] as const)),
    action: enumText(row.action, "workspace_operation_intents.action", WORKSPACE_ACTIONS),
    state: enumText(row.state, "workspace_operation_intents.state", WORKSPACE_INTENT_STATES),
    revision: positive(row.revision, "workspace_operation_intents.revision"),
    actorId: sqliteText(row.actor_id, "workspace_operation_intents.actor_id"),
    requestId: sqliteText(row.request_id, "workspace_operation_intents.request_id"),
    correlationId: sqliteText(row.correlation_id, "workspace_operation_intents.correlation_id"),
    causationId: sqliteNullableText(row.causation_id, "workspace_operation_intents.causation_id"),
    currentAuthorizationDecisionId: sqliteText(row.current_authorization_decision_id, "workspace_operation_intents.current_authorization_decision_id"),
    authorizationBindingRevision: positive(row.authorization_binding_revision, "workspace_operation_intents.authorization_binding_revision"),
    confirmationId: sqliteNullableText(row.confirmation_id, "workspace_operation_intents.confirmation_id"),
    workspaceId: sqliteText(row.workspace_id, "workspace_operation_intents.workspace_id"),
    generation: positive(row.generation, "workspace_operation_intents.generation"),
    expectedGenerationRevision: positive(row.expected_generation_revision, "workspace_operation_intents.expected_generation_revision"),
    expectedGenerationStatus: enumText(row.expected_generation_status, "workspace_operation_intents.expected_generation_status", WORKSPACE_STATUSES),
    lastObservationNumber: nonnegative(row.last_observation_number, "workspace_operation_intents.last_observation_number"),
    lastFailureCategory: row.last_failure_category === null
      ? null
      : enumText(
          row.last_failure_category,
          "workspace_operation_intents.last_failure_category",
          WORKSPACE_FAILURE_CATEGORY_SET,
        ),
    lastFailureCode: sqliteNullableText(row.last_failure_code, "workspace_operation_intents.last_failure_code"),
    lastFailureRetryable: sqliteNullableBoolean(row.last_failure_retryable, "workspace_operation_intents.last_failure_retryable"),
    lastFailureAmbiguous: sqliteNullableBoolean(row.last_failure_ambiguous, "workspace_operation_intents.last_failure_ambiguous"),
    contractId: enumText(row.contract_id, "workspace_operation_intents.contract_id", new Set(["ato.workspace/v2"] as const)),
    adapterId: sqliteText(row.adapter_id, "workspace_operation_intents.adapter_id"),
    adapterVersion: sqliteText(row.adapter_version, "workspace_operation_intents.adapter_version"),
    createdAt: timestamp(row.created_at, "workspace_operation_intents.created_at"),
    updatedAt: timestamp(row.updated_at, "workspace_operation_intents.updated_at"),
  })));
}

export function readWorkspaceObservations(database: SqliteDatabase): readonly WorkspaceObservationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT observation_id, intent_id, observation_number, adapter_receipt_id, receipt_sha256,
      authorization_decision_id, external_state, outcome, code, path_safety, ownership_match,
      tracked_count, modified_count, untracked_count, ignored_count,
      repository_identity, branch_reference, head_object_id, ownership_binding_sha256, evidence_reference,
      cleanup_attestation_sha256, observed_at
    FROM workspace_observations ORDER BY intent_id, observation_number`,
  ).all().map((row) => Object.freeze({
    observationId: sqliteText(row.observation_id, "workspace_observations.observation_id"),
    intentId: sqliteText(row.intent_id, "workspace_observations.intent_id"),
    observationNumber: positive(row.observation_number, "workspace_observations.observation_number"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "workspace_observations.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "workspace_observations.receipt_sha256"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "workspace_observations.authorization_decision_id"),
    externalState: enumText(row.external_state, "workspace_observations.external_state", WORKSPACE_EXTERNAL_STATE_SET),
    outcome: enumText(row.outcome, "workspace_observations.outcome", new Set(["succeeded", "refused", "ambiguous"] as const)),
    code: enumText(row.code, "workspace_observations.code", WORKSPACE_RECEIPT_CODE_SET),
    pathSafety: enumText(row.path_safety, "workspace_observations.path_safety", new Set(["safe", "unsafe", "unknown"] as const)),
    ownershipMatch: sqliteNullableBoolean(row.ownership_match, "workspace_observations.ownership_match"),
    trackedCount: nonnegative(row.tracked_count, "workspace_observations.tracked_count"),
    modifiedCount: nonnegative(row.modified_count, "workspace_observations.modified_count"),
    untrackedCount: nonnegative(row.untracked_count, "workspace_observations.untracked_count"),
    ignoredCount: nonnegative(row.ignored_count, "workspace_observations.ignored_count"),
    repositoryIdentity: sqliteNullableText(row.repository_identity, "workspace_observations.repository_identity"),
    branchReference: sqliteNullableText(row.branch_reference, "workspace_observations.branch_reference"),
    headObjectId: row.head_object_id === null ? null : lowercaseSha1(row.head_object_id, "workspace_observations.head_object_id"),
    ownershipBindingSha256: uppercaseSha256(row.ownership_binding_sha256, "workspace_observations.ownership_binding_sha256"),
    evidenceReference: opaqueEvidenceReference(row.evidence_reference, "workspace_observations.evidence_reference"),
    cleanupAttestationSha256: row.cleanup_attestation_sha256 === null
      ? null
      : uppercaseSha256(row.cleanup_attestation_sha256, "workspace_observations.cleanup_attestation_sha256"),
    observedAt: timestamp(row.observed_at, "workspace_observations.observed_at"),
  })));
}

export function readWorkspaceReceipts(database: SqliteDatabase): readonly WorkspaceVerifiedReceiptRecord[] {
  return Object.freeze(database.prepare(
    `SELECT verified_receipt_id, intent_id, observation_id, observation_number, adapter_receipt_id,
      receipt_sha256, workspace_id, generation, generation_revision, external_state, outcome, code,
      repository_identity, branch_reference, head_object_id, ownership_binding_sha256,
      cleanup_attestation_sha256, verified_at
    FROM workspace_verified_receipts ORDER BY verified_receipt_id`,
  ).all().map((row) => Object.freeze({
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "workspace_verified_receipts.verified_receipt_id"),
    intentId: sqliteText(row.intent_id, "workspace_verified_receipts.intent_id"),
    observationId: sqliteText(row.observation_id, "workspace_verified_receipts.observation_id"),
    observationNumber: positive(row.observation_number, "workspace_verified_receipts.observation_number"),
    adapterReceiptId: sqliteText(row.adapter_receipt_id, "workspace_verified_receipts.adapter_receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "workspace_verified_receipts.receipt_sha256"),
    workspaceId: sqliteText(row.workspace_id, "workspace_verified_receipts.workspace_id"),
    generation: positive(row.generation, "workspace_verified_receipts.generation"),
    generationRevision: positive(row.generation_revision, "workspace_verified_receipts.generation_revision"),
    externalState: enumText(row.external_state, "workspace_verified_receipts.external_state", WORKSPACE_EXTERNAL_STATE_SET),
    outcome: enumText(row.outcome, "workspace_verified_receipts.outcome", new Set(["succeeded", "refused"] as const)),
    code: enumText(row.code, "workspace_verified_receipts.code", WORKSPACE_RECEIPT_CODE_SET),
    repositoryIdentity: sqliteNullableText(row.repository_identity, "workspace_verified_receipts.repository_identity"),
    branchReference: sqliteNullableText(row.branch_reference, "workspace_verified_receipts.branch_reference"),
    headObjectId: row.head_object_id === null ? null : lowercaseSha1(row.head_object_id, "workspace_verified_receipts.head_object_id"),
    ownershipBindingSha256: uppercaseSha256(row.ownership_binding_sha256, "workspace_verified_receipts.ownership_binding_sha256"),
    cleanupAttestationSha256: row.cleanup_attestation_sha256 === null
      ? null
      : uppercaseSha256(row.cleanup_attestation_sha256, "workspace_verified_receipts.cleanup_attestation_sha256"),
    verifiedAt: timestamp(row.verified_at, "workspace_verified_receipts.verified_at"),
  })));
}

export function readWorkspaceFinalizations(database: SqliteDatabase): readonly WorkspaceFinalizationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT finalization_id, intent_id, verified_receipt_id, authorization_decision_id,
      outcome, code, resulting_generation_status, resulting_generation_revision, finalized_at
    FROM workspace_finalizations ORDER BY finalization_id`,
  ).all().map((row) => Object.freeze({
    finalizationId: sqliteText(row.finalization_id, "workspace_finalizations.finalization_id"),
    intentId: sqliteText(row.intent_id, "workspace_finalizations.intent_id"),
    verifiedReceiptId: sqliteNullableText(row.verified_receipt_id, "workspace_finalizations.verified_receipt_id"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "workspace_finalizations.authorization_decision_id"),
    outcome: enumText(row.outcome, "workspace_finalizations.outcome", WORKSPACE_OUTCOMES),
    code: boundedCode(row.code, "workspace_finalizations.code"),
    resultingGenerationStatus: enumText(row.resulting_generation_status, "workspace_finalizations.resulting_generation_status", WORKSPACE_STATUSES),
    resultingGenerationRevision: positive(row.resulting_generation_revision, "workspace_finalizations.resulting_generation_revision"),
    finalizedAt: timestamp(row.finalized_at, "workspace_finalizations.finalized_at"),
  })));
}

export function readWorkspaceEvents(database: SqliteDatabase): readonly WorkspaceEventRecord[] {
  const eventKinds = new Set<WorkspaceEventRecord["eventKind"]>(WORKSPACE_EVENT_KINDS);
  return Object.freeze(database.prepare(
    `SELECT event_id, operation_id, intent_id, event_kind, outcome, reason_code, actor_id,
      correlation_id, causation_id, workspace_id, generation, generation_revision,
      observation_number, evidence_reference, created_at
    FROM workspace_events ORDER BY event_id`,
  ).all().map((row) => Object.freeze({
    eventId: sqliteText(row.event_id, "workspace_events.event_id"),
    operationId: sqliteText(row.operation_id, "workspace_events.operation_id"),
    intentId: sqliteNullableText(row.intent_id, "workspace_events.intent_id"),
    eventKind: enumText(row.event_kind, "workspace_events.event_kind", eventKinds),
    outcome: enumText(row.outcome, "workspace_events.outcome", new Set(["accepted", "denied", "refused", "ambiguous", "failed"] as const)),
    reasonCode: boundedCode(row.reason_code, "workspace_events.reason_code"),
    actorId: sqliteText(row.actor_id, "workspace_events.actor_id"),
    correlationId: sqliteText(row.correlation_id, "workspace_events.correlation_id"),
    causationId: sqliteNullableText(row.causation_id, "workspace_events.causation_id"),
    workspaceId: sqliteNullableText(row.workspace_id, "workspace_events.workspace_id"),
    generation: nullablePositive(row.generation, "workspace_events.generation"),
    generationRevision: nullablePositive(row.generation_revision, "workspace_events.generation_revision"),
    observationNumber: nullablePositive(row.observation_number, "workspace_events.observation_number"),
    evidenceReference: opaqueEvidenceReference(row.evidence_reference, "workspace_events.evidence_reference"),
    createdAt: timestamp(row.created_at, "workspace_events.created_at"),
  })));
}

export function readRequests(database: SqliteDatabase): readonly ApplicationRequestRecord[] {
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

export function readGrants(database: SqliteDatabase): readonly AuthorizationGrant[] {
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

export function readDecisions(database: SqliteDatabase): readonly AuthorizationDecisionRecord[] {
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

export function readAudit(database: SqliteDatabase): readonly DecodedApplicationAudit[] {
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


const SCHEDULER_REGISTRATION_STATUSES: ReadonlySet<SchedulerRegistrationStatus> = new Set([
  "pending_register", "active", "pending_remove", "removed", "ambiguous",
]);
const SCHEDULER_INTENT_STATES: ReadonlySet<SchedulerIntentState> = new Set([
  "pending", "executing", "observed", "verified", "finalized", "ambiguous", "failed",
]);
const SCHEDULER_EXTERNAL_STATE_SET: ReadonlySet<SchedulerExternalState> = new Set(SCHEDULER_EXTERNAL_STATES);
const SCHEDULER_RECEIPT_CODE_SET: ReadonlySet<SchedulerReceiptCode> = new Set(SCHEDULER_RECEIPT_CODES);
const SCHEDULER_OBSERVATION_CODES: ReadonlySet<SchedulerReceiptCode | SchedulerFailureCategory> = new Set([
  ...SCHEDULER_RECEIPT_CODES,
  ...SCHEDULER_FAILURE_CATEGORIES,
]);
const SCHEDULER_DELIVERY_DISPOSITIONS: ReadonlySet<SchedulerDeliveryDisposition> = new Set([
  "accepted", "authorization_denied", "rejected_stale_config", "malformed",
]);
const SCHEDULER_DELIVERY_ATTACHMENT_ROLES: ReadonlySet<SchedulerDeliveryAttachmentRole> = new Set([
  "canonical", "duplicate", "none",
]);

export function readSchedulerConfigurations(database: SqliteDatabase): readonly SchedulerConfigurationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT schedule_id, config_revision, scope_kind, project_id, project_resource_revision,
      project_config_revision, schedule_expression, time_zone, dispatcher_target, config_sha256,
      created_by_operation_id, created_at
    FROM scheduler_configurations ORDER BY schedule_id, config_revision`,
  ).all().map((row) => Object.freeze({
    scheduleId: sqliteText(row.schedule_id, "scheduler_configurations.schedule_id"),
    configRevision: positive(row.config_revision, "scheduler_configurations.config_revision"),
    scopeKind: enumText(row.scope_kind, "scheduler_configurations.scope_kind", SCOPE_KINDS),
    projectId: sqliteNullableText(row.project_id, "scheduler_configurations.project_id"),
    projectResourceRevision: nullablePositive(row.project_resource_revision, "scheduler_configurations.project_resource_revision"),
    projectConfigRevision: nullablePositive(row.project_config_revision, "scheduler_configurations.project_config_revision"),
    scheduleExpression: sqliteText(row.schedule_expression, "scheduler_configurations.schedule_expression"),
    timeZone: sqliteText(row.time_zone, "scheduler_configurations.time_zone"),
    dispatcherTarget: sqliteText(row.dispatcher_target, "scheduler_configurations.dispatcher_target"),
    configSha256: uppercaseSha256(row.config_sha256, "scheduler_configurations.config_sha256"),
    createdByOperationId: sqliteText(row.created_by_operation_id, "scheduler_configurations.created_by_operation_id"),
    createdAt: timestamp(row.created_at, "scheduler_configurations.created_at"),
  })));
}

export function readSchedulerRegistrations(database: SqliteDatabase): readonly SchedulerRegistrationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT schedule_id, config_revision, revision, status, external_registration_id,
      enabled, next_trigger_at, last_intent_id, updated_at
    FROM scheduler_registrations ORDER BY schedule_id, config_revision`,
  ).all().map((row) => Object.freeze({
    scheduleId: sqliteText(row.schedule_id, "scheduler_registrations.schedule_id"),
    configRevision: positive(row.config_revision, "scheduler_registrations.config_revision"),
    revision: positive(row.revision, "scheduler_registrations.revision"),
    status: enumText(row.status, "scheduler_registrations.status", SCHEDULER_REGISTRATION_STATUSES),
    externalRegistrationId: sqliteNullableText(row.external_registration_id, "scheduler_registrations.external_registration_id"),
    enabled: nullableBoolean(row.enabled, "scheduler_registrations.enabled"),
    nextTriggerAt: row.next_trigger_at === null ? null : timestamp(row.next_trigger_at, "scheduler_registrations.next_trigger_at"),
    lastIntentId: sqliteText(row.last_intent_id, "scheduler_registrations.last_intent_id"),
    updatedAt: timestamp(row.updated_at, "scheduler_registrations.updated_at"),
  })));
}

export function readSchedulerOperationRequests(database: SqliteDatabase): readonly SchedulerOperationRequestRecord[] {
  const operations = new Set<SchedulerOperationRequestRecord["operation"]>(["register", "inspect", "remove"]);
  return Object.freeze(database.prepare(
    `SELECT request_id, operation_id, idempotency_key, command_sha256, operation, actor_id, correlation_id,
      schedule_id, config_revision, external_registration_id, scope_kind, project_id, project_resource_revision,
      project_config_revision, result, created_at
    FROM scheduler_operation_requests ORDER BY request_id`,
  ).all().map((row) => Object.freeze({
    requestId: sqliteText(row.request_id, "scheduler_operation_requests.request_id"),
    operationId: sqliteText(row.operation_id, "scheduler_operation_requests.operation_id"),
    idempotencyKey: sqliteNullableText(row.idempotency_key, "scheduler_operation_requests.idempotency_key"),
    commandSha256: uppercaseSha256(row.command_sha256, "scheduler_operation_requests.command_sha256"),
    operation: enumText(row.operation, "scheduler_operation_requests.operation", operations),
    actorId: sqliteText(row.actor_id, "scheduler_operation_requests.actor_id"),
    correlationId: sqliteText(row.correlation_id, "scheduler_operation_requests.correlation_id"),
    scheduleId: sqliteText(row.schedule_id, "scheduler_operation_requests.schedule_id"),
    configRevision: positive(row.config_revision, "scheduler_operation_requests.config_revision"),
    externalRegistrationId: sqliteNullableText(row.external_registration_id, "scheduler_operation_requests.external_registration_id"),
    scopeKind: enumText(row.scope_kind, "scheduler_operation_requests.scope_kind", SCOPE_KINDS),
    projectId: sqliteNullableText(row.project_id, "scheduler_operation_requests.project_id"),
    projectResourceRevision: nullablePositive(row.project_resource_revision, "scheduler_operation_requests.project_resource_revision"),
    projectConfigRevision: nullablePositive(row.project_config_revision, "scheduler_operation_requests.project_config_revision"),
    result: enumText(row.result, "scheduler_operation_requests.result", DECISION_RESULTS),
    createdAt: timestamp(row.created_at, "scheduler_operation_requests.created_at"),
  })));
}

export function readSchedulerAuthorizationDecisions(database: SqliteDatabase): readonly SchedulerAuthorizationDecisionRecord[] {
  const stages = new Set<SchedulerAuthorizationDecisionRecord["stage"]>(["prepare", "act", "inspect"]);
  const schedulerActions = new Set<SchedulerAuthorizationDecisionRecord["action"]>([
    "scheduler.register", "scheduler.inspect", "scheduler.remove",
  ]);
  return Object.freeze(database.prepare(
    `SELECT decision_id, request_id, stage, actor_id, action, result, reason, policy_result,
      grant_id, grant_revision, project_id, project_resource_revision, project_config_revision, created_at
    FROM scheduler_authorization_decisions ORDER BY decision_id`,
  ).all().map((row) => Object.freeze({
    decisionId: sqliteText(row.decision_id, "scheduler_authorization_decisions.decision_id"),
    requestId: sqliteText(row.request_id, "scheduler_authorization_decisions.request_id"),
    stage: enumText(row.stage, "scheduler_authorization_decisions.stage", stages),
    actorId: sqliteText(row.actor_id, "scheduler_authorization_decisions.actor_id"),
    action: enumText(row.action, "scheduler_authorization_decisions.action", schedulerActions),
    result: enumText(row.result, "scheduler_authorization_decisions.result", DECISION_RESULTS),
    reason: enumText(row.reason, "scheduler_authorization_decisions.reason", AUTHORIZATION_REASONS),
    policy: enumText(row.policy_result, "scheduler_authorization_decisions.policy_result", POLICY_RESULTS),
    grantId: sqliteNullableText(row.grant_id, "scheduler_authorization_decisions.grant_id"),
    grantRevision: nullablePositive(row.grant_revision, "scheduler_authorization_decisions.grant_revision"),
    projectId: sqliteNullableText(row.project_id, "scheduler_authorization_decisions.project_id"),
    projectResourceRevision: nullablePositive(row.project_resource_revision, "scheduler_authorization_decisions.project_resource_revision"),
    projectConfigRevision: nullablePositive(row.project_config_revision, "scheduler_authorization_decisions.project_config_revision"),
    createdAt: timestamp(row.created_at, "scheduler_authorization_decisions.created_at"),
  })));
}

export function readSchedulerIntents(database: SqliteDatabase): readonly SchedulerOperationIntentRecord[] {
  const operations = new Set<SchedulerOperationIntentRecord["operation"]>(["register", "remove"]);
  return Object.freeze(database.prepare(
    `SELECT intent_id, request_id, operation_id, operation, state, contract_id, adapter_id,
      adapter_version, schedule_id, config_revision, expected_registration_revision,
      operation_deadline, revision, created_at, updated_at
    FROM scheduler_operation_intents ORDER BY intent_id`,
  ).all().map((row) => {
    const contractId = sqliteText(row.contract_id, "scheduler_operation_intents.contract_id");
    if (contractId !== "ato.scheduler/v1") throw persistenceFailure("CORRUPT_ROW", "Scheduler intent contract is unsupported");
    return Object.freeze({
      intentId: sqliteText(row.intent_id, "scheduler_operation_intents.intent_id"),
      requestId: sqliteText(row.request_id, "scheduler_operation_intents.request_id"),
      operationId: sqliteText(row.operation_id, "scheduler_operation_intents.operation_id"),
      operation: enumText(row.operation, "scheduler_operation_intents.operation", operations),
      state: enumText(row.state, "scheduler_operation_intents.state", SCHEDULER_INTENT_STATES),
      contractId,
      adapterId: sqliteText(row.adapter_id, "scheduler_operation_intents.adapter_id"),
      adapterVersion: sqliteText(row.adapter_version, "scheduler_operation_intents.adapter_version"),
      scheduleId: sqliteText(row.schedule_id, "scheduler_operation_intents.schedule_id"),
      configRevision: positive(row.config_revision, "scheduler_operation_intents.config_revision"),
      expectedRegistrationRevision: nonnegative(row.expected_registration_revision, "scheduler_operation_intents.expected_registration_revision"),
      operationDeadline: timestamp(row.operation_deadline, "scheduler_operation_intents.operation_deadline"),
      revision: positive(row.revision, "scheduler_operation_intents.revision"),
      createdAt: timestamp(row.created_at, "scheduler_operation_intents.created_at"),
      updatedAt: timestamp(row.updated_at, "scheduler_operation_intents.updated_at"),
    });
  }));
}

export function readSchedulerObservations(database: SqliteDatabase): readonly SchedulerObservationRecord[] {
  const outcomes = new Set<SchedulerObservationRecord["outcome"]>(["succeeded", "refused", "ambiguous"]);
  return Object.freeze(database.prepare(
    `SELECT observation_id, request_id, intent_id, observation_number, external_state,
      external_registration_id, enabled, next_trigger_at, outcome, code, receipt_id,
      receipt_sha256, evidence_reference, observed_at
    FROM scheduler_observations
    ORDER BY CASE WHEN intent_id IS NULL THEN request_id ELSE intent_id END, observation_number, observation_id`,
  ).all().map((row) => Object.freeze({
    observationId: sqliteText(row.observation_id, "scheduler_observations.observation_id"),
    requestId: sqliteText(row.request_id, "scheduler_observations.request_id"),
    intentId: sqliteNullableText(row.intent_id, "scheduler_observations.intent_id"),
    observationNumber: positive(row.observation_number, "scheduler_observations.observation_number"),
    externalState: enumText(row.external_state, "scheduler_observations.external_state", SCHEDULER_EXTERNAL_STATE_SET),
    externalRegistrationId: sqliteNullableText(row.external_registration_id, "scheduler_observations.external_registration_id"),
    enabled: nullableBoolean(row.enabled, "scheduler_observations.enabled"),
    nextTriggerAt: row.next_trigger_at === null ? null : timestamp(row.next_trigger_at, "scheduler_observations.next_trigger_at"),
    outcome: enumText(row.outcome, "scheduler_observations.outcome", outcomes),
    code: enumText(row.code, "scheduler_observations.code", SCHEDULER_OBSERVATION_CODES),
    receiptId: sqliteNullableText(row.receipt_id, "scheduler_observations.receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "scheduler_observations.receipt_sha256"),
    evidenceReference: sqliteNullableText(row.evidence_reference, "scheduler_observations.evidence_reference"),
    observedAt: timestamp(row.observed_at, "scheduler_observations.observed_at"),
  })));
}

export function readSchedulerReceipts(database: SqliteDatabase): readonly SchedulerVerifiedReceiptRecord[] {
  return Object.freeze(database.prepare(
    `SELECT verified_receipt_id, intent_id, observation_id, receipt_id, receipt_sha256,
      external_state, external_registration_id, enabled, next_trigger_at, code, verified_at
    FROM scheduler_verified_receipts ORDER BY verified_receipt_id`,
  ).all().map((row) => Object.freeze({
    verifiedReceiptId: sqliteText(row.verified_receipt_id, "scheduler_verified_receipts.verified_receipt_id"),
    intentId: sqliteText(row.intent_id, "scheduler_verified_receipts.intent_id"),
    observationId: sqliteText(row.observation_id, "scheduler_verified_receipts.observation_id"),
    receiptId: sqliteText(row.receipt_id, "scheduler_verified_receipts.receipt_id"),
    receiptSha256: uppercaseSha256(row.receipt_sha256, "scheduler_verified_receipts.receipt_sha256"),
    externalState: enumText(row.external_state, "scheduler_verified_receipts.external_state", SCHEDULER_EXTERNAL_STATE_SET),
    externalRegistrationId: sqliteNullableText(row.external_registration_id, "scheduler_verified_receipts.external_registration_id"),
    enabled: nullableBoolean(row.enabled, "scheduler_verified_receipts.enabled"),
    nextTriggerAt: row.next_trigger_at === null ? null : timestamp(row.next_trigger_at, "scheduler_verified_receipts.next_trigger_at"),
    code: enumText(row.code, "scheduler_verified_receipts.code", SCHEDULER_RECEIPT_CODE_SET),
    verifiedAt: timestamp(row.verified_at, "scheduler_verified_receipts.verified_at"),
  })));
}

export function readSchedulerFinalizations(database: SqliteDatabase): readonly SchedulerFinalizationRecord[] {
  const outcomes = new Set<SchedulerFinalizationRecord["outcome"]>(["registered", "removed", "refused", "ambiguous", "failed"]);
  return Object.freeze(database.prepare(
    `SELECT finalization_id, intent_id, verified_receipt_id, authorization_decision_id,
      outcome, code, resulting_registration_status, resulting_registration_revision, finalized_at
    FROM scheduler_finalizations ORDER BY finalization_id`,
  ).all().map((row) => Object.freeze({
    finalizationId: sqliteText(row.finalization_id, "scheduler_finalizations.finalization_id"),
    intentId: sqliteText(row.intent_id, "scheduler_finalizations.intent_id"),
    verifiedReceiptId: sqliteNullableText(row.verified_receipt_id, "scheduler_finalizations.verified_receipt_id"),
    authorizationDecisionId: sqliteText(row.authorization_decision_id, "scheduler_finalizations.authorization_decision_id"),
    outcome: enumText(row.outcome, "scheduler_finalizations.outcome", outcomes),
    code: sqliteText(row.code, "scheduler_finalizations.code"),
    resultingRegistrationStatus: enumText(row.resulting_registration_status, "scheduler_finalizations.resulting_registration_status", SCHEDULER_REGISTRATION_STATUSES),
    resultingRegistrationRevision: positive(row.resulting_registration_revision, "scheduler_finalizations.resulting_registration_revision"),
    finalizedAt: timestamp(row.finalized_at, "scheduler_finalizations.finalized_at"),
  })));
}

export function readSchedulerEvents(database: SqliteDatabase): readonly SchedulerEventRecord[] {
  const kinds = new Set<SchedulerEventRecord["eventKind"]>([
    "scheduler.operation.prepared", "scheduler.operation.denied", "scheduler.operation.executing",
    "scheduler.operation.observed", "scheduler.operation.verified", "scheduler.operation.finalized",
    "scheduler.operation.reconciled", "scheduler.inspected",
  ]);
  const outcomes = new Set<SchedulerEventRecord["outcome"]>(["accepted", "denied", "refused", "ambiguous", "failed"]);
  return Object.freeze(database.prepare(
    `SELECT event_id, operation_id, request_id, intent_id, event_kind, outcome, reason_code,
      actor_id, correlation_id, schedule_id, config_revision, observation_number,
      evidence_reference, created_at
    FROM scheduler_events ORDER BY event_id`,
  ).all().map((row) => Object.freeze({
    eventId: sqliteText(row.event_id, "scheduler_events.event_id"),
    operationId: sqliteText(row.operation_id, "scheduler_events.operation_id"),
    requestId: sqliteText(row.request_id, "scheduler_events.request_id"),
    intentId: sqliteNullableText(row.intent_id, "scheduler_events.intent_id"),
    eventKind: enumText(row.event_kind, "scheduler_events.event_kind", kinds),
    outcome: enumText(row.outcome, "scheduler_events.outcome", outcomes),
    reasonCode: sqliteText(row.reason_code, "scheduler_events.reason_code"),
    actorId: sqliteText(row.actor_id, "scheduler_events.actor_id"),
    correlationId: sqliteText(row.correlation_id, "scheduler_events.correlation_id"),
    scheduleId: sqliteText(row.schedule_id, "scheduler_events.schedule_id"),
    configRevision: positive(row.config_revision, "scheduler_events.config_revision"),
    observationNumber: nullablePositive(row.observation_number, "scheduler_events.observation_number"),
    evidenceReference: sqliteNullableText(row.evidence_reference, "scheduler_events.evidence_reference"),
    createdAt: timestamp(row.created_at, "scheduler_events.created_at"),
  })));
}

export function readSchedulerDeliveryObservations(database: SqliteDatabase): readonly SchedulerDeliveryObservationRecord[] {
  return Object.freeze(database.prepare(
    `SELECT observation_id, request_id, decision_id, adapter_id, adapter_version, dispatcher_target, contract_id,
      trigger_id_sha256, claimed_deduplication_sha256, schedule_id, config_revision,
      scheduled_for, delivered_at, received_at, disposition, attachment_role, run_id
    FROM scheduler_delivery_observations ORDER BY observation_id`,
  ).all().map((row) => {
    const contractId = sqliteText(row.contract_id, "scheduler_delivery_observations.contract_id");
    if (contractId !== "ato.scheduler/v1") throw persistenceFailure("CORRUPT_ROW", "Scheduler delivery contract is unsupported");
    return Object.freeze({
      observationId: sqliteText(row.observation_id, "scheduler_delivery_observations.observation_id"),
      requestId: sqliteNullableText(row.request_id, "scheduler_delivery_observations.request_id"),
      decisionId: sqliteNullableText(row.decision_id, "scheduler_delivery_observations.decision_id"),
      adapterId: sqliteText(row.adapter_id, "scheduler_delivery_observations.adapter_id"),
      adapterVersion: sqliteText(row.adapter_version, "scheduler_delivery_observations.adapter_version"),
      dispatcherTarget: sqliteText(row.dispatcher_target, "scheduler_delivery_observations.dispatcher_target"),
      contractId,
      triggerIdSha256: row.trigger_id_sha256 === null ? null : uppercaseSha256(row.trigger_id_sha256, "scheduler_delivery_observations.trigger_id_sha256"),
      claimedDeduplicationSha256: row.claimed_deduplication_sha256 === null ? null : uppercaseSha256(row.claimed_deduplication_sha256, "scheduler_delivery_observations.claimed_deduplication_sha256"),
      scheduleId: sqliteNullableText(row.schedule_id, "scheduler_delivery_observations.schedule_id"),
      configRevision: nullablePositive(row.config_revision, "scheduler_delivery_observations.config_revision"),
      scheduledFor: row.scheduled_for === null ? null : timestamp(row.scheduled_for, "scheduler_delivery_observations.scheduled_for"),
      deliveredAt: row.delivered_at === null ? null : timestamp(row.delivered_at, "scheduler_delivery_observations.delivered_at"),
      receivedAt: timestamp(row.received_at, "scheduler_delivery_observations.received_at"),
      disposition: enumText(row.disposition, "scheduler_delivery_observations.disposition", SCHEDULER_DELIVERY_DISPOSITIONS),
      attachmentRole: enumText(row.attachment_role, "scheduler_delivery_observations.attachment_role", SCHEDULER_DELIVERY_ATTACHMENT_ROLES),
      runId: sqliteNullableText(row.run_id, "scheduler_delivery_observations.run_id"),
    });
  }));
}

export function readSchedulerScheduledTuples(database: SqliteDatabase): readonly SchedulerScheduledTupleRecord[] {
  return Object.freeze(database.prepare(
    `SELECT schedule_id, config_revision, scheduled_for, canonical_observation_id, run_id, created_at
    FROM scheduler_scheduled_tuples ORDER BY schedule_id, config_revision, scheduled_for`,
  ).all().map((row) => Object.freeze({
    scheduleId: sqliteText(row.schedule_id, "scheduler_scheduled_tuples.schedule_id"),
    configRevision: positive(row.config_revision, "scheduler_scheduled_tuples.config_revision"),
    scheduledFor: timestamp(row.scheduled_for, "scheduler_scheduled_tuples.scheduled_for"),
    canonicalObservationId: sqliteText(row.canonical_observation_id, "scheduler_scheduled_tuples.canonical_observation_id"),
    runId: sqliteText(row.run_id, "scheduler_scheduled_tuples.run_id"),
    createdAt: timestamp(row.created_at, "scheduler_scheduled_tuples.created_at"),
  })));
}

export interface GrantRelationRecord {
  readonly grantId: string;
  readonly action: AuthorizationAction;
  readonly capabilityEpochId: string | null;
  readonly createdRequestId: string;
  readonly revokedRequestId: string | null;
}

export function readGrantRelations(database: SqliteDatabase): readonly GrantRelationRecord[] {
  const rows = database.prepare(
    `SELECT grant_id, action, capability_epoch_id, created_request_id, revoked_request_id
     FROM authorization_grants ORDER BY grant_id`,
  ).all();
  return rows.map((row) => Object.freeze({
    grantId: sqliteText(row.grant_id, "authorization_grants.grant_id"),
    action: grantAction(row.action, "authorization_grants.action"),
    capabilityEpochId: sqliteNullableText(row.capability_epoch_id, "authorization_grants.capability_epoch_id"),
    createdRequestId: sqliteText(row.created_request_id, "authorization_grants.created_request_id"),
    revokedRequestId: sqliteNullableText(row.revoked_request_id, "authorization_grants.revoked_request_id"),
  }));
}

export function readApplicationRequestActionValue(
  database: SqliteDatabase,
  requestId: string,
): unknown {
  return database.prepare("SELECT action FROM application_requests WHERE request_id=?").get(requestId)?.action;
}

export function readTaskExecutionSequenceById(
  database: SqliteDatabase,
  taskId: string,
): TaskExecutionSequence | null {
  const row = database.prepare(
    `SELECT task_id, last_attempt_number, current_fencing_token, revision
       FROM task_execution_sequences WHERE task_id=?`,
  ).get(taskId);
  return row === undefined ? null : decodeTaskExecutionSequenceRow(row);
}
