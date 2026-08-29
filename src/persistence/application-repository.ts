import {
  AUTHORIZATION_ACTIONS,
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
import { canonicalJson, exactRecord, isCanonicalUtcTimestamp, isNonemptyString } from "./values.ts";

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
}

export interface ApplicationRequestRecord {
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly action: AuthorizationAction;
  readonly targetKind: "runtime" | "project" | "task" | "grant";
  readonly targetId: string;
  readonly targetRevision: number | null;
  readonly result: "bootstrap" | "allow" | "deny";
  readonly createdAt: string;
}

export interface AuthorizationDecisionRecord {
  readonly decisionId: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly action: AuthorizationAction;
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
    | "authorization.denied";
  readonly result: "accepted" | "denied";
  readonly actorId: string;
  readonly correlationId: string;
  readonly targetKind: "runtime" | "project" | "task" | "grant";
  readonly targetId: string;
  readonly targetRevision: number | null;
  readonly reason: string;
  readonly createdAt: string;
}

export interface ApplicationState {
  readonly domain: DomainSnapshot;
  readonly projects: readonly RegisteredProject[];
  readonly bootstrap: AuthorizationBootstrap | null;
  readonly grants: readonly AuthorizationGrant[];
  readonly requests: readonly ApplicationRequestRecord[];
  readonly decisions: readonly AuthorizationDecisionRecord[];
  readonly audit: readonly ApplicationAuditRecord[];
}

export interface NewGrantRecord extends AuthorizationGrant {
  readonly createdRequestId: string;
}

interface ApplicationDatabaseBinding {
  readonly database: SqliteDatabase;
  readonly assertOpen: () => void;
}

type TargetKind = ApplicationRequestRecord["targetKind"];
type RequestResult = ApplicationRequestRecord["result"];
type DecisionResult = AuthorizationDecisionRecord["result"];
type AuditKind = ApplicationAuditRecord["eventKind"];
type AuditResult = ApplicationAuditRecord["result"];

interface ApplicationAuditDetails {
  readonly action: AuthorizationAction;
  readonly reason: string;
  readonly targetKind: TargetKind;
  readonly targetRevision: number | null;
}

interface DecodedApplicationAudit {
  readonly record: ApplicationAuditRecord;
  readonly details: ApplicationAuditDetails;
}

const boundDatabases = new WeakMap<object, ApplicationDatabaseBinding>();
const TARGET_KINDS: ReadonlySet<TargetKind> = new Set(["runtime", "project", "task", "grant"]);
const REQUEST_RESULTS: ReadonlySet<RequestResult> = new Set(["bootstrap", "allow", "deny"]);
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
  }
}

function decisionPolicyIsValid(decision: AuthorizationDecisionRecord): boolean {
  if (
    decision.action.startsWith("authorization.") ||
    decision.action.endsWith(".inspect") ||
    decision.action === "policy.evaluate"
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

function action(value: unknown, label: string): AuthorizationAction {
  const result = sqliteText(value, label);
  if (!(AUTHORIZATION_ACTIONS as readonly string[]).includes(result)) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not an implemented action`);
  }
  return result as AuthorizationAction;
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

function readBootstrap(database: SqliteDatabase): AuthorizationBootstrap | null {
  const rows = database.prepare(
    `SELECT singleton, actor_id, trusted_principal, runtime_root, runtime_root_key,
      runtime_platform, runtime_device, runtime_inode, runtime_mode,
      request_id, created_at, expires_at FROM authorization_bootstrap ORDER BY singleton`,
  ).all();
  if (rows.length === 0) return null;
  if (rows.length !== 1 || integer(rows[0]?.singleton, "authorization_bootstrap.singleton") !== 1) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization bootstrap singleton is invalid");
  }
  const row = rows[0] as Record<string, unknown>;
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
  });
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
      action: action(row.action, "authorization_grants.action"),
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
  const grants = readGrants(database);
  const requests = readRequests(database);
  const decisions = readDecisions(database);
  const decodedAudit = readAudit(database);
  const audit = Object.freeze(decodedAudit.map((event) => event.record));
  const grantRelationRows = database.prepare(
    "SELECT grant_id, created_request_id, revoked_request_id FROM authorization_grants ORDER BY grant_id",
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
    const fixedRelations = grantRelations.filter((relation) => relation.createdRequestId === bootstrap.requestId);
    if (fixedRelations.length !== AUTHORIZATION_ACTIONS.length) {
      throw persistenceFailure("CORRUPT_ROW", "Bootstrap does not own one fixed grant for every implemented action");
    }
    for (const fixedAction of AUTHORIZATION_ACTIONS) {
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
    const revokedRequestId = relation.revokedRequestId;
    const revokedRequest = revokedRequestId === null ? null : requestById.get(revokedRequestId);
    if (
      grant === undefined ||
      createdRequest === undefined ||
      (createdRequest.result !== "bootstrap" && createdRequest.result !== "allow") ||
      (grant.revokedAt === null) !== (revokedRequestId === null) ||
      (createdRequest.result === "bootstrap" && (bootstrap === null || createdRequest.requestId !== bootstrap.requestId)) ||
      (createdRequest.result === "allow" && (
        createdRequest.action !== "authorization.grant.issue" ||
        createdRequest.targetKind !== "grant" ||
        createdRequest.targetId !== grant.grantId ||
        createdRequest.targetRevision !== null ||
        grant.issuerGrantId === null ||
        grant.sourceGrantId === null ||
        grant.notBefore < createdRequest.createdAt ||
        createdDecision?.grantId !== grant.issuerGrantId ||
        !issuedGrantMatchesDecision(grant, createdDecision)
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
      const rooted = grant.issuerGrantId === null && grant.sourceGrantId === null &&
        bootstrap !== null && relation.createdRequestId === bootstrap.requestId;
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
      ? AUTHORIZATION_ACTIONS.length
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
    if (
      request === undefined ||
      request.result !== decision.result ||
      request.actorId !== decision.actorId ||
      request.action !== decision.action ||
      request.createdAt !== decision.createdAt ||
      !decisionPolicyIsValid(decision) ||
      !decisionTargetIsValid(request, decision) ||
      (decision.result === "allow") !== (decision.reason === "allowed") ||
      (decision.result === "allow" && decision.grantId === null) ||
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
        !isHighRiskAction(decision.action)
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
  return Object.freeze({ domain, projects, bootstrap, grants, requests, decisions, audit });
}

export function readApplicationState(database: SqliteDatabase): ApplicationState {
  return runReadSnapshot(database, () => readApplicationStateUntransactional(database));
}

export function bindApplicationDatabase(owner: object, database: SqliteDatabase, assertOpen: () => void): void {
  if (boundDatabases.has(owner)) throw persistenceFailure("INTEGRITY_ERROR", "Persistence owner is already bound");
  boundDatabases.set(owner, Object.freeze({ database, assertOpen }));
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
        request_id, created_at, expires_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.actorId, record.trustedPrincipal, record.canonicalRoot, record.rootKey,
      record.platform, record.device, record.inode, record.mode,
      record.requestId, record.createdAt, record.expiresAt,
    );
  }

  insertGrant(record: NewGrantRecord): void {
    this.#database.prepare(
      `INSERT INTO authorization_grants(
        grant_id, revision, actor_id, action, scope_kind, scope_project_id,
        scope_resource_revision, scope_config_revision, not_before, expires_at,
        revoked_at, issuer_grant_id, source_grant_id, created_request_id, revoked_request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      record.grantId, record.revision, record.actorId, record.action, record.scope.kind,
      record.scope.projectId, record.scope.resourceRevision, record.scope.configRevision,
      record.notBefore, record.expiresAt, record.revokedAt, record.issuerGrantId, record.sourceGrantId,
      record.createdRequestId,
    );
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

export function scopeColumns(scope: AuthorizationScope): readonly [string, string | null, number | null, number | null] {
  return Object.freeze([scope.kind, scope.projectId, scope.resourceRevision, scope.configRevision]);
}
