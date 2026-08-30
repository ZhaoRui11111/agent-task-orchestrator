import {
  AUTHORIZATION_ACTIONS,
  PHASE1_AUTHORIZATION_ACTIONS,
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
  readonly vocabularyVersion: 3 | 4;
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
  readonly adoptionRequestId: string;
  readonly createdAt: string;
}

export interface AuthorizationCapabilityEpoch {
  readonly epochId: string;
  readonly epochRevision: number;
  readonly actorId: string;
  readonly runtimeRootKey: string;
  readonly vocabularyVersion: 4 | 5;
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

type ApplicationStateDigestVersion = 1 | 2;
const lifecycleStateDigestVersions = new WeakMap<ApplicationLifecycleAuthorization, ApplicationStateDigestVersion>();

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
const LEGACY_AUTHORIZATION_ACTIONS = Object.freeze(PHASE1_AUTHORIZATION_ACTIONS.slice(0, 15));

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

function readBootstrap(
  database: SqliteDatabase,
  schemaShape: ApplicationSchemaShape,
): AuthorizationBootstrap | null {
  const rows = database.prepare(schemaShape !== "version-three"
    ? `SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode,
      request_id, created_at, expires_at, vocabulary_version FROM authorization_bootstrap ORDER BY singleton`
    : `SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode,
      request_id, created_at, expires_at FROM authorization_bootstrap ORDER BY singleton`
  ).all();
  if (rows.length === 0) return null;
  if (rows.length !== 1 || integer(rows[0]?.singleton, "authorization_bootstrap.singleton") !== 1) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization bootstrap singleton is invalid");
  }
  const row = rows[0] as Record<string, unknown>;
  const vocabularyVersion = schemaShape !== "version-three"
    ? integer(row.vocabulary_version, "authorization_bootstrap.vocabulary_version")
    : 3;
  if (vocabularyVersion !== 3 && vocabularyVersion !== 4) {
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
      runtime_root_key, bootstrap_request_id, adoption_request_id, created_at
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
    adoptionRequestId: sqliteText(row.adoption_request_id, "authorization_local_identity.adoption_request_id"),
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
    if (vocabularyVersion !== 4 && vocabularyVersion !== 5) {
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

function readLifecycle(
  database: SqliteDatabase,
  schemaShape: Exclude<ApplicationSchemaShape, "version-three">,
): readonly ApplicationLifecycleAuthorization[] {
  const operations = new Set(["runtime.backup", "runtime.restore"] as const);
  const digestVersionColumn = schemaShape === "current"
    ? "state_digest_version"
    : "1 AS state_digest_version";
  return Object.freeze(database.prepare(
    `SELECT authorization_id, operation, backup_generation_id, actor_id, runtime_root_key,
      grant_id, grant_revision, request_id, decision_id, audit_id, authorized_state_sha256,
      ${digestVersionColumn}, expected_request_count, expected_decision_count, expected_audit_count,
      issued_at, expires_at
    FROM application_lifecycle_authorizations ORDER BY authorization_id`,
  ).all().map((row) => {
    const digestVersion = positive(
      row.state_digest_version,
      "application_lifecycle_authorizations.state_digest_version",
    );
    if (digestVersion !== 1 && digestVersion !== 2) {
      throw persistenceFailure("CORRUPT_ROW", "Lifecycle state digest version is unsupported");
    }
    const record: ApplicationLifecycleAuthorization = {
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
    };
    lifecycleStateDigestVersions.set(record, digestVersion);
    return Object.freeze(record);
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
      revoked_at, issuer_grant_id, source_grant_id FROM authorization_grants ORDER BY grant_id`,
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

type ApplicationSchemaShape = "version-three" | "version-four" | "current";

function readApplicationStateUntransactional(
  database: SqliteDatabase,
  schemaShape: ApplicationSchemaShape = "current",
): ApplicationState {
  const domain = readDomainSnapshotUntransactional(database);
  const projects = readProjects(database);
  const bootstrap = readBootstrap(database, schemaShape);
  const identity = schemaShape === "version-three" ? null : readIdentity(database);
  const grants = readGrants(database);
  const epochs = schemaShape === "version-three" ? Object.freeze([]) : readEpochs(database);
  const requests = readRequests(database);
  const decisions = readDecisions(database);
  const decodedAudit = readAudit(database);
  const audit = Object.freeze(decodedAudit.map((event) => event.record));
  const lifecycle = schemaShape === "version-three" ? Object.freeze([]) : readLifecycle(database, schemaShape);
  const executionSequences = schemaShape === "current" ? readExecutionSequences(database) : Object.freeze([]);
  const executions = schemaShape === "current" ? readExecutionAttempts(database) : Object.freeze([]);
  const grantRelationRows = database.prepare(schemaShape !== "version-three"
    ? "SELECT grant_id, capability_epoch_id, created_request_id, revoked_request_id FROM authorization_grants ORDER BY grant_id"
    : "SELECT grant_id, created_request_id, revoked_request_id FROM authorization_grants ORDER BY grant_id"
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
    capabilityEpochId: schemaShape !== "version-three"
      ? sqliteNullableText(row.capability_epoch_id, "authorization_grants.capability_epoch_id")
      : null,
    createdRequestId: sqliteText(row.created_request_id, "authorization_grants.created_request_id"),
    revokedRequestId: sqliteNullableText(row.revoked_request_id, "authorization_grants.revoked_request_id"),
  }));
  const grantRelationById = new Map(grantRelations.map((relation) => [relation.grantId, relation]));
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
    const fixedActions = bootstrap.vocabularyVersion === 3 ? LEGACY_AUTHORIZATION_ACTIONS : PHASE1_AUTHORIZATION_ACTIONS;
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
  if (bootstrap !== null && bootstrap.vocabularyVersion === 4) {
    if (
      identity === null ||
      identity.actorId !== bootstrap.actorId ||
      identity.principalSha256 !== bootstrap.trustedPrincipal ||
      identity.platform !== bootstrap.platform ||
      identity.runtimeRootKey !== bootstrap.rootKey ||
      identity.bootstrapRequestId !== bootstrap.requestId ||
      identity.adoptionRequestId !== bootstrap.requestId ||
      identity.createdAt !== bootstrap.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Vocabulary-v4 bootstrap does not bind the immutable local identity");
    }
  }
  if (bootstrap !== null && bootstrap.vocabularyVersion === 3 && identity !== null) {
    const firstEpoch = epochs[0];
    if (
      firstEpoch === undefined ||
      identity.bootstrapRequestId !== bootstrap.requestId ||
      identity.adoptionRequestId !== firstEpoch.requestId ||
      identity.actorId !== firstEpoch.actorId ||
      identity.runtimeRootKey !== firstEpoch.runtimeRootKey ||
      identity.createdAt !== firstEpoch.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Adopted legacy bootstrap does not bind epoch revision one");
    }
  }
  const phase1ActionSetSha256 = sha256(canonicalJson(PHASE1_AUTHORIZATION_ACTIONS));
  const currentActionSetSha256 = sha256(canonicalJson(AUTHORIZATION_ACTIONS));
  for (let index = 0; index < epochs.length; index += 1) {
    const epoch = epochs[index];
    const request = epoch === undefined ? undefined : requestById.get(epoch.requestId);
    const previousVocabulary = index === 0 ? 4 : epochs[index - 1]?.vocabularyVersion;
    const isUpgrade = previousVocabulary === 4 && epoch?.vocabularyVersion === 5;
    const expectedActionSetSha256 = epoch?.vocabularyVersion === 5
      ? currentActionSetSha256
      : phase1ActionSetSha256;
    if (
      epoch === undefined ||
      identity === null ||
      epoch.epochRevision !== index + 1 ||
      epoch.actorId !== identity.actorId ||
      epoch.runtimeRootKey !== identity.runtimeRootKey ||
      previousVocabulary === undefined ||
      epoch.vocabularyVersion < previousVocabulary ||
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
      ? bootstrap?.vocabularyVersion === 3
        ? LEGACY_AUTHORIZATION_ACTIONS.length
        : PHASE1_AUTHORIZATION_ACTIONS.length
      : request.result === "renewal" || request.result === "upgrade"
        ? (() => {
            const epoch = epochs.find((candidate) => candidate.requestId === request.requestId);
            return epoch?.vocabularyVersion === 5
              ? AUTHORIZATION_ACTIONS.length
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
  if (executionById.size !== executions.length || sequenceByTask.size !== executionSequences.length) {
    throw persistenceFailure("CORRUPT_ROW", "Execution identity inventory is not unique");
  }
  for (const sequence of executionSequences) {
    const task = taskById.get(sequence.taskId);
    const attempts = executions.filter((execution) => execution.taskId === sequence.taskId);
    const active = attempts.filter((execution) => execution.status === "active");
    if (
      task === undefined ||
      task.state !== "running" ||
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
  const stateWithoutLifecycle = Object.freeze({
    domain, projects, bootstrap, identity, grants, epochs, requests, decisions, audit,
    executionSequences, executions,
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
      (countsAreCurrent && authorization.authorizedStateSha256 !== applicationStateSha256ForVersion(
        stateWithoutLifecycle,
        lifecycleStateDigestVersions.get(authorization) ?? 2,
      ))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Lifecycle authorization lineage is incomplete or inconsistent");
    }
  }
  return Object.freeze({ ...stateWithoutLifecycle, lifecycle });
}

export function readApplicationState(database: SqliteDatabase): ApplicationState {
  return runReadSnapshot(database, () => readApplicationStateUntransactional(database));
}

export function readVersionThreeApplicationState(database: SqliteDatabase): ApplicationState {
  return runReadSnapshot(database, () => readApplicationStateUntransactional(database, "version-three"));
}

export function readVersionFourApplicationState(database: SqliteDatabase): ApplicationState {
  return runReadSnapshot(database, () => readApplicationStateUntransactional(database, "version-four"));
}

function applicationStateSha256ForVersion(
  state: ApplicationState,
  version: ApplicationStateDigestVersion,
): string {
  const phaseOneProjection = {
    audit: state.audit,
    bootstrap: state.bootstrap,
    decisions: state.decisions,
    domain: state.domain,
    epochs: state.epochs,
    grants: state.grants,
    identity: state.identity,
    registry: state.projects,
    requests: state.requests,
  };
  return sha256(canonicalJson(version === 1 ? phaseOneProjection : {
    ...phaseOneProjection,
    executionSequences: state.executionSequences,
    executions: state.executions,
  }));
}

export function applicationStateSha256(state: ApplicationState): string {
  return applicationStateSha256ForVersion(state, 2);
}

export function versionFourApplicationStateSha256(state: ApplicationState): string {
  return applicationStateSha256ForVersion(state, 1);
}

function lifecycleAuthorizationDigestVersion(
  authorization: ApplicationLifecycleAuthorization,
): ApplicationStateDigestVersion {
  const version = lifecycleStateDigestVersions.get(authorization);
  if (version === undefined) {
    throw persistenceFailure("CORRUPT_ROW", "Lifecycle state digest provenance is unavailable");
  }
  return version;
}

export function applicationStateSha256ForLifecycleAuthorization(
  state: ApplicationState,
  authorization: ApplicationLifecycleAuthorization,
): string {
  return applicationStateSha256ForVersion(state, lifecycleAuthorizationDigestVersion(authorization));
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
  stateDigestVersion: 1 | 2;
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
  const stateDigestVersion = lifecycleAuthorizationDigestVersion(authorization);
  const stateSha256 = applicationStateSha256ForVersion(state, stateDigestVersion);
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
  stateDigestVersion: 1 | 2;
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
  stateDigestVersion: 1 | 2;
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
        runtime_root_key, bootstrap_request_id, adoption_request_id, created_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.identityVersion, record.actorId, record.principalSha256, record.platform,
      record.runtimeRootKey, record.bootstrapRequestId, record.adoptionRequestId, record.createdAt,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?, ?, ?)`,
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
