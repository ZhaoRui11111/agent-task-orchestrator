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
import { sqliteNullableText, sqliteText } from "./database.ts";
import type { SqliteDatabase } from "./database.ts";
import { persistenceFailure } from "./errors.ts";
import { APPLICATION_STATE_DIGEST_VERSION } from "./application-repository-digest.ts";
import {
  DISPATCHER_AUDIT_CODES,
  DISPATCHER_MEMBER_CODES,
  DISPATCHER_RECONCILIATION_CODES,
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
