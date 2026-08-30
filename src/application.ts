import {
  AUTHORIZATION_ACTIONS,
  canIssueGrant,
  evaluateAuthorization,
  isAuthorizationAction,
  isHighRiskAction,
  type AuthorizationAction,
  type AuthorizationEvaluation,
  type AuthorizationGrant,
  type GrantIssueProof,
  type AuthorizationPolicyResult,
  type AuthorizationScope,
} from "./authorization.ts";
import {
  addTaskDependency,
  createTask,
  registerProject,
  removeTaskDependency,
  setProjectEnabled,
  setTaskParent,
  transitionTask,
  updateTaskBody,
  type DomainMutation,
  type DomainSnapshot,
  type ProjectDomainMutation,
  type Task,
} from "./domain.ts";
import {
  inspectProjectRoot,
  inspectTrustedRuntimeRoot,
  ProjectRegistryError,
  revalidateProjectRoot,
  type ProjectRootIdentity,
} from "./project-registry.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import {
  applicationStateSha256,
  applicationAuditKind,
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationAuditRecord,
  type ApplicationAction,
  type ApplicationRequestRecord,
  type ApplicationState,
  type ApplicationTransaction,
  type AuthorizationDecisionRecord,
  type NewGrantRecord,
  type RegisteredProject,
} from "./persistence/application-repository.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";

export const APPLICATION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "BOOTSTRAP_ALREADY_CONSUMED",
  "BOOTSTRAP_REQUIRED",
  "AUTHORIZATION_DENIED",
  "PROJECT_NOT_FOUND",
  "PROJECT_ALREADY_REGISTERED",
  "PROJECT_REGISTRY_REJECTED",
  "TASK_NOT_FOUND",
  "GRANT_NOT_FOUND",
  "STALE_REVISION",
  "DOMAIN_REJECTED",
  "SCOPE_EXPANSION_DENIED",
  "CAPABILITY_RENEWAL_NOT_DUE",
] as const);

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];
export type ApplicationDetail = string | number | boolean | null;

export interface ApplicationError {
  readonly code: ApplicationErrorCode;
  readonly message: string;
  readonly details: Readonly<Record<string, ApplicationDetail>>;
}

export interface ApplicationSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ApplicationFailure {
  readonly ok: false;
  readonly error: ApplicationError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}

export type ApplicationResult<T> = ApplicationSuccess<T> | ApplicationFailure;

export interface TrustedActorAssertion {
  readonly actorId: string;
  readonly principal: string;
}

export interface ConfirmationRequest {
  readonly actorId: string;
  readonly action: ApplicationAction;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ApplicationIngress {
  currentActor(): TrustedActorAssertion;
  now(): string;
  nextId(kind: "request" | "correlation" | "decision" | "audit" | "grant" | "epoch" | "lifecycle"): string;
  confirmHighRisk(request: ConfirmationRequest): boolean;
}

interface ApplicationTestHooks {
  beforeTransaction?(): void;
  afterStage?(stage: string): void;
}

export interface BootstrapCommand {
  readonly kind: "authorization.bootstrap";
  readonly expiresAt: string;
}

export interface RenewalCommand {
  readonly kind: "authorization.capability.renew";
  readonly expiresAt: string;
}

export interface CapabilityEpochResult {
  readonly mode: "initialized" | "adopted" | "renewed";
  readonly expiresAt: string;
  readonly capabilityCount: number;
  readonly epochRevision: number;
}

export interface ProjectCommandResult {
  readonly projectId: string;
  readonly enabled: boolean;
  readonly configRevision: number;
  readonly resourceRevision: number;
}

export type ApplicationCommand =
  | { readonly kind: "authorization.grant.issue"; readonly actorId: string; readonly action: AuthorizationAction; readonly scope: AuthorizationScope; readonly notBefore: string; readonly expiresAt: string }
  | { readonly kind: "authorization.grant.inspect"; readonly grantId: string; readonly expectedGrantRevision: number }
  | { readonly kind: "authorization.grant.revoke"; readonly grantId: string; readonly expectedGrantRevision: number }
  | { readonly kind: "policy.evaluate"; readonly projectId: string; readonly expectedResourceRevision: number; readonly expectedConfigRevision: number; readonly action: AuthorizationAction }
  | { readonly kind: "project.register"; readonly projectId: string; readonly root: string }
  | { readonly kind: "project.update"; readonly projectId: string; readonly expectedResourceRevision: number; readonly expectedConfigRevision: number }
  | { readonly kind: "project.disable"; readonly projectId: string; readonly expectedResourceRevision: number; readonly expectedConfigRevision: number }
  | { readonly kind: "project.inspect"; readonly projectId: string; readonly expectedResourceRevision: number }
  | { readonly kind: "task.create"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly body: string; readonly supersedesTaskId: string | null }
  | { readonly kind: "task.update"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly change: { readonly kind: "body"; readonly body: string } | { readonly kind: "parent"; readonly parentId: string | null } }
  | { readonly kind: "task.mark_ready"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number }
  | { readonly kind: "task.cancel"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly reason: string }
  | { readonly kind: "task.inspect"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number }
  | { readonly kind: "dependency.add"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly dependencyId: string; readonly expectedDependencyRevision: number }
  | { readonly kind: "dependency.remove"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly dependencyId: string; readonly expectedDependencyRevision: number }
  | { readonly kind: "authorization.grant.list"; readonly limit: number; readonly afterGrantId: string | null }
  | { readonly kind: "runtime.status" }
  | { readonly kind: "runtime.backup" | "runtime.restore"; readonly backupGenerationId: string };

type ExistingProjectCommand = Extract<ApplicationCommand, {
  readonly kind: "project.update" | "project.disable" | "project.inspect";
}>;
type DomainApplicationCommand = Extract<ApplicationCommand, {
  readonly kind:
    | "task.create"
    | "task.update"
    | "task.mark_ready"
    | "task.cancel"
    | "task.inspect"
    | "dependency.add"
    | "dependency.remove";
}>;

type TargetKind = ApplicationRequestRecord["targetKind"];
type AuditKind = ApplicationAuditRecord["eventKind"];
type UnknownRecord = Record<string, unknown>;

interface OperationIdentity {
  readonly actor: TrustedActorAssertion;
  readonly now: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly auditId: string;
}

interface BoundTarget {
  readonly kind: TargetKind;
  readonly id: string;
  readonly revision: number | null;
  readonly project: RegisteredProject | null;
}

interface CommandAuthorization {
  readonly evaluation: AuthorizationEvaluation;
  readonly issuanceProof: GrantIssueProof | null;
}

interface AffectedProjectPreflight {
  readonly project: RegisteredProject;
  readonly identity: ProjectRootIdentity;
}

function exactRecord(value: unknown, keys: readonly string[]): Readonly<UnknownRecord> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const allowed = new Set(keys);
    const result: UnknownRecord = Object.create(null) as UnknownRecord;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      Object.defineProperty(result, key, { enumerable: true, value: descriptor.value });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function operationalIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function domainIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function nonempty(value: unknown, maximum = 16_384): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !value.includes("\0");
}

const FORBIDDEN_CANCELLATION_REASON_TEXT = /[\p{Cc}\p{Cf}]/u;

function wellFormedText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function isCanonicalCancellationReason(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !wellFormedText(value) ||
    FORBIDDEN_CANCELLATION_REASON_TEXT.test(value) ||
    value.normalize("NFC") !== value
  ) {
    return false;
  }
  const encodedBytes = new TextEncoder().encode(value).byteLength;
  return encodedBytes >= 1 && encodedBytes <= 4096;
}

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function appError(
  code: ApplicationErrorCode,
  message: string,
  details: Readonly<Record<string, ApplicationDetail>> = {},
): ApplicationError {
  return Object.freeze({ code, message, details: Object.freeze({ ...details }) });
}

function failed(
  code: ApplicationErrorCode,
  message: string,
  identity: OperationIdentity | null = null,
  details: Readonly<Record<string, ApplicationDetail>> = {},
): ApplicationFailure {
  return Object.freeze({
    ok: false,
    error: appError(code, message, details),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}

function succeeded<T>(value: T, identity: OperationIdentity): ApplicationSuccess<T> {
  return Object.freeze({ ok: true, value, requestId: identity.requestId, correlationId: identity.correlationId });
}

function projectRegistryFailure(error: unknown, identity: OperationIdentity): ApplicationFailure {
  if (!(error instanceof ProjectRegistryError)) throw error;
  return failed(
    "PROJECT_REGISTRY_REJECTED",
    "Project or runtime root identity could not be established safely",
    identity,
    { registryCode: error.code },
  );
}

function checkedRuntimeRoot(runtimeRoot: string, identity: OperationIdentity): ProjectRootIdentity | ApplicationFailure {
  try {
    return inspectTrustedRuntimeRoot(runtimeRoot);
  } catch (error) {
    return projectRegistryFailure(error, identity);
  }
}

function checkedProjectRoot(
  receipt: ProjectRootIdentity,
  runtimeRoot: string,
  identity: OperationIdentity,
): ProjectRootIdentity | ApplicationFailure {
  try {
    return revalidateProjectRoot(receipt, runtimeRoot);
  } catch (error) {
    return projectRegistryFailure(error, identity);
  }
}

function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  if (record === null || !operationalIdentifier(record.actorId) || !nonempty(record.principal, 256)) return null;
  return Object.freeze({ actorId: record.actorId, principal: record.principal });
}

function parseScope(value: unknown): AuthorizationScope | null {
  const record = exactRecord(value, ["kind", "projectId", "resourceRevision", "configRevision"]);
  if (record === null || (record.kind !== "runtime" && record.kind !== "project")) return null;
  if (record.kind === "runtime") {
    if (record.projectId !== null || record.resourceRevision !== null || record.configRevision !== null) return null;
  } else if (!domainIdentifier(record.projectId) || !revision(record.resourceRevision) || !revision(record.configRevision)) {
    return null;
  }
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId as string | null,
    resourceRevision: record.resourceRevision as number | null,
    configRevision: record.configRevision as number | null,
  });
}

function parseCommand(value: unknown): ApplicationCommand | null {
  let kind: AuthorizationAction;
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable || !isAuthorizationAction(descriptor.value)) return null;
    kind = descriptor.value;
  } catch {
    return null;
  }
  const expectedKeys = (() => {
    switch (kind) {
      case "authorization.grant.issue": return ["kind", "actorId", "action", "scope", "notBefore", "expiresAt"];
      case "authorization.grant.inspect":
      case "authorization.grant.revoke": return ["kind", "grantId", "expectedGrantRevision"];
      case "policy.evaluate": return ["kind", "projectId", "expectedResourceRevision", "expectedConfigRevision", "action"];
      case "project.register": return ["kind", "projectId", "root"];
      case "project.update":
      case "project.disable": return ["kind", "projectId", "expectedResourceRevision", "expectedConfigRevision"];
      case "project.inspect": return ["kind", "projectId", "expectedResourceRevision"];
      case "task.create": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "body", "supersedesTaskId"];
      case "task.update": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision", "change"];
      case "task.mark_ready":
      case "task.inspect": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision"];
      case "task.cancel": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision", "reason"];
      case "dependency.add":
      case "dependency.remove": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision", "dependencyId", "expectedDependencyRevision"];
      case "authorization.grant.list": return ["kind", "limit", "afterGrantId"];
      case "runtime.status": return ["kind"];
      case "runtime.backup":
      case "runtime.restore": return ["kind", "backupGenerationId"];
    }
  })();
  const record = exactRecord(value, expectedKeys);
  if (record === null) return null;
  if (kind === "authorization.grant.list") {
    return Number.isSafeInteger(record.limit) && (record.limit as number) >= 1 && (record.limit as number) <= 100 &&
      (record.afterGrantId === null || operationalIdentifier(record.afterGrantId))
      ? Object.freeze({ kind, limit: record.limit as number, afterGrantId: record.afterGrantId as string | null })
      : null;
  }
  if (kind === "runtime.status") return Object.freeze({ kind });
  if (kind === "runtime.backup" || kind === "runtime.restore") {
    return operationalIdentifier(record.backupGenerationId)
      ? Object.freeze({ kind, backupGenerationId: record.backupGenerationId })
      : null;
  }
  if (kind === "authorization.grant.issue") {
    const scope = parseScope(record.scope);
    return operationalIdentifier(record.actorId) && isAuthorizationAction(record.action) && scope !== null && timestamp(record.notBefore) && timestamp(record.expiresAt)
      ? Object.freeze({ kind, actorId: record.actorId, action: record.action, scope, notBefore: record.notBefore, expiresAt: record.expiresAt })
      : null;
  }
  if (kind === "authorization.grant.inspect" || kind === "authorization.grant.revoke") {
    return operationalIdentifier(record.grantId) && revision(record.expectedGrantRevision)
      ? Object.freeze({ kind, grantId: record.grantId, expectedGrantRevision: record.expectedGrantRevision })
      : null;
  }
  if (kind === "policy.evaluate") {
    return domainIdentifier(record.projectId) && revision(record.expectedResourceRevision) && revision(record.expectedConfigRevision) && isAuthorizationAction(record.action)
      ? Object.freeze({ kind, projectId: record.projectId, expectedResourceRevision: record.expectedResourceRevision, expectedConfigRevision: record.expectedConfigRevision, action: record.action })
      : null;
  }
  if (kind === "project.register") {
    return domainIdentifier(record.projectId) && nonempty(record.root, 4096)
      ? Object.freeze({ kind, projectId: record.projectId, root: record.root })
      : null;
  }
  if (kind === "project.update" || kind === "project.disable") {
    return domainIdentifier(record.projectId) && revision(record.expectedResourceRevision) && revision(record.expectedConfigRevision)
      ? Object.freeze({ kind, projectId: record.projectId, expectedResourceRevision: record.expectedResourceRevision, expectedConfigRevision: record.expectedConfigRevision })
      : null;
  }
  if (kind === "project.inspect") {
    return domainIdentifier(record.projectId) && revision(record.expectedResourceRevision)
      ? Object.freeze({ kind, projectId: record.projectId, expectedResourceRevision: record.expectedResourceRevision })
      : null;
  }
  if (!domainIdentifier(record.projectId) || !revision(record.expectedProjectResourceRevision) || !domainIdentifier(record.taskId)) return null;
  if (kind === "task.create") {
    return nonempty(record.body) && (record.supersedesTaskId === null || domainIdentifier(record.supersedesTaskId))
      ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, body: record.body, supersedesTaskId: record.supersedesTaskId })
      : null;
  }
  if (!revision(record.expectedTaskRevision)) return null;
  if (kind === "task.update") {
    let changeKind: unknown = null;
    try {
      if (typeof record.change === "object" && record.change !== null && !Array.isArray(record.change)) {
        const descriptor = Object.getOwnPropertyDescriptor(record.change, "kind");
        if (descriptor !== undefined && "value" in descriptor && descriptor.enumerable) changeKind = descriptor.value;
      }
    } catch {
      return null;
    }
    if (changeKind === "body") {
      const change = exactRecord(record.change, ["kind", "body"]);
      return change !== null && nonempty(change.body)
        ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, change: Object.freeze({ kind: "body" as const, body: change.body }) })
        : null;
    }
    if (changeKind === "parent") {
      const change = exactRecord(record.change, ["kind", "parentId"]);
      return change !== null && (change.parentId === null || domainIdentifier(change.parentId))
        ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, change: Object.freeze({ kind: "parent" as const, parentId: change.parentId }) })
        : null;
    }
    return null;
  }
  if (kind === "task.cancel") {
    return isCanonicalCancellationReason(record.reason)
      ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, reason: record.reason })
      : null;
  }
  if (kind === "dependency.add" || kind === "dependency.remove") {
    return domainIdentifier(record.dependencyId) && revision(record.expectedDependencyRevision)
      ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, dependencyId: record.dependencyId, expectedDependencyRevision: record.expectedDependencyRevision })
      : null;
  }
  return Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision });
}

function parseBootstrap(value: unknown): BootstrapCommand | null {
  const record = exactRecord(value, ["kind", "expiresAt"]);
  return record !== null && record.kind === "authorization.bootstrap" && timestamp(record.expiresAt)
    ? Object.freeze({ kind: record.kind, expiresAt: record.expiresAt })
    : null;
}

function operationIdentity(ingress: ApplicationIngress): OperationIdentity | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const now = ingress.now();
    const requestId = ingress.nextId("request");
    const correlationId = ingress.nextId("correlation");
    const decisionId = ingress.nextId("decision");
    const auditId = ingress.nextId("audit");
    if (actor === null || !timestamp(now) || !operationalIdentifier(requestId) || !operationalIdentifier(correlationId) || !operationalIdentifier(decisionId) || !operationalIdentifier(auditId)) return null;
    return Object.freeze({ actor, now, requestId, correlationId, decisionId, auditId });
  } catch {
    return null;
  }
}

function refreshOperationTime(identity: OperationIdentity, ingress: ApplicationIngress): OperationIdentity | null {
  try {
    const now = ingress.now();
    if (!timestamp(now) || now < identity.now) return null;
    return Object.freeze({ ...identity, now });
  } catch {
    return null;
  }
}

function confirmHighRisk(identity: OperationIdentity, action: ApplicationAction, ingress: ApplicationIngress): boolean {
  if (action !== "authorization.capability.renew" && !isHighRiskAction(action)) return true;
  try {
    return ingress.confirmHighRisk(Object.freeze({
      actorId: identity.actor.actorId,
      action,
      requestId: identity.requestId,
      correlationId: identity.correlationId,
    })) === true;
  } catch {
    return false;
  }
}

function projectById(state: ApplicationState, projectId: string): RegisteredProject | null {
  return state.projects.find((project) => project.projectId === projectId) ?? null;
}

function projectCommandResult(state: ApplicationState, projectId: string): ProjectCommandResult {
  const project = projectById(state, projectId);
  const domainProject = state.domain.projects.find((candidate) => candidate.id === projectId);
  if (project === null || domainProject === undefined) {
    throw new TypeError("Project terminal projection is absent");
  }
  return Object.freeze({
    projectId: project.projectId,
    enabled: domainProject.enabled,
    configRevision: project.configRevision,
    resourceRevision: project.resourceRevision,
  });
}

function sameRootIdentity(left: ProjectRootIdentity, right: ProjectRootIdentity): boolean {
  return left.rootKey === right.rootKey && left.platform === right.platform && left.device === right.device && left.inode === right.inode && left.mode === right.mode;
}

function parseRenewal(value: unknown): RenewalCommand | null {
  const record = exactRecord(value, ["kind", "expiresAt"]);
  return record !== null && record.kind === "authorization.capability.renew" && timestamp(record.expiresAt)
    ? Object.freeze({ kind: record.kind, expiresAt: record.expiresAt })
    : null;
}

function sameLocalIdentity(state: ApplicationState, identity: OperationIdentity, root: ProjectRootIdentity): boolean {
  return state.identity !== null &&
    state.identity.actorId === identity.actor.actorId &&
    state.identity.principalSha256 === identity.actor.principal &&
    state.identity.platform === root.platform &&
    state.identity.runtimeRootKey === root.rootKey;
}

const CAPABILITY_ACTION_SET_SHA256 = sha256(canonicalJson(AUTHORIZATION_ACTIONS));

interface RenewalAssessment {
  readonly mode: "adopted" | "renewed";
  readonly nextEpochRevision: number;
}

function assessRenewal(
  state: ApplicationState,
  identity: OperationIdentity,
  root: ProjectRootIdentity,
): RenewalAssessment | "authorization_denied" | "not_due" | "not_initialized" {
  const bootstrap = state.bootstrap;
  if (bootstrap === null) return "not_initialized";
  if (!sameRootIdentity(bootstrap, root)) return "authorization_denied";
  if (bootstrap.vocabularyVersion === 3 && state.identity === null) {
    const legacyOrigin = state.grants.filter((grant) =>
      grant.actorId === bootstrap.actorId &&
      grant.issuerGrantId === null &&
      grant.sourceGrantId === null &&
      grant.notBefore === bootstrap.createdAt &&
      grant.expiresAt === bootstrap.expiresAt
    );
    if (legacyOrigin.some((grant) => grant.revokedAt !== null && grant.expiresAt > identity.now)) return "not_due";
    return Object.freeze({ mode: "adopted", nextEpochRevision: 1 });
  }
  const localIdentity = state.identity;
  if (localIdentity === null || !sameLocalIdentity(state, identity, root)) return "authorization_denied";
  const latestEpoch = state.epochs.at(-1);
  const originActor = localIdentity.actorId;
  const originCreatedAt = latestEpoch?.createdAt ?? bootstrap.createdAt;
  const originExpiresAt = latestEpoch?.expiresAt ?? bootstrap.expiresAt;
  const currentOrigin = state.grants.filter((grant) =>
    grant.actorId === originActor &&
    grant.issuerGrantId === null &&
    grant.sourceGrantId === null &&
    grant.notBefore === originCreatedAt &&
    grant.expiresAt === originExpiresAt
  );
  if (currentOrigin.length !== AUTHORIZATION_ACTIONS.length) return "authorization_denied";
  const renewalThreshold = new Date(new Date(identity.now).valueOf() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (originExpiresAt > renewalThreshold) return "not_due";
  if (originExpiresAt > identity.now && currentOrigin.some((grant) => grant.revokedAt !== null)) return "not_due";
  return Object.freeze({ mode: "renewed", nextEpochRevision: (latestEpoch?.epochRevision ?? 0) + 1 });
}

function affectedProjectIds(mutation: DomainMutation): readonly string[] {
  const projectIds = new Set<string>();
  for (const taskId of mutation.changedTaskIds) {
    const task = mutation.snapshot.tasks.find((candidate) => candidate.id === taskId);
    if (task === undefined) throw new TypeError("Domain mutation changed an absent Task");
    projectIds.add(task.projectId);
  }
  return Object.freeze([...projectIds].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
}

function sameProjectIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((projectId, index) => projectId === right[index]);
}

function sameProjectBinding(current: RegisteredProject, preflight: RegisteredProject): boolean {
  return current.projectId === preflight.projectId &&
    current.configRevision === preflight.configRevision &&
    current.resourceRevision === preflight.resourceRevision &&
    sameRootIdentity(current, preflight);
}

function taskById(snapshot: DomainSnapshot, taskId: string): Task | null {
  return snapshot.tasks.find((task) => task.id === taskId) ?? null;
}

function requestRecord(identity: OperationIdentity, action: ApplicationAction, target: BoundTarget, result: ApplicationRequestRecord["result"]): ApplicationRequestRecord {
  return Object.freeze({
    requestId: identity.requestId,
    correlationId: identity.correlationId,
    actorId: identity.actor.actorId,
    action,
    targetKind: target.kind,
    targetId: target.id,
    targetRevision: target.revision,
    result,
    createdAt: identity.now,
  });
}

function decisionRecord(
  identity: OperationIdentity,
  action: AuthorizationAction,
  target: BoundTarget,
  evaluation: AuthorizationEvaluation,
): AuthorizationDecisionRecord {
  return Object.freeze({
    decisionId: identity.decisionId,
    requestId: identity.requestId,
    actorId: identity.actor.actorId,
    action,
    result: evaluation.allowed ? "allow" : "deny",
    reason: evaluation.reason,
    policy: evaluation.policy,
    grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision,
    projectId: target.project?.projectId ?? null,
    resourceRevision: target.project?.resourceRevision ?? null,
    createdAt: identity.now,
  });
}

function auditRecord(
  identity: OperationIdentity,
  target: BoundTarget,
  eventKind: AuditKind,
  result: "accepted" | "denied",
  reason: string,
  decisionId: string | null = identity.decisionId,
): ApplicationAuditRecord {
  return Object.freeze({
    auditId: identity.auditId,
    requestId: identity.requestId,
    decisionId,
    eventKind,
    result,
    actorId: identity.actor.actorId,
    correlationId: identity.correlationId,
    targetKind: target.kind,
    targetId: target.id,
    targetRevision: target.revision,
    reason,
    createdAt: identity.now,
  });
}

function policyFor(action: AuthorizationAction, project: RegisteredProject | null, state: ApplicationState): AuthorizationPolicyResult {
  if (action.endsWith(".inspect") || action === "policy.evaluate" || action.startsWith("authorization.") || action.startsWith("runtime.")) return "read_not_applicable";
  if (action === "project.register" || action === "project.update" || action === "project.disable") return "allow";
  if (project === null) return "allow";
  return state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true ? "allow" : "deny";
}

function authorize(
  identity: OperationIdentity,
  action: AuthorizationAction,
  target: BoundTarget,
  state: ApplicationState,
  confirmed: boolean,
  requiredScopeKind: AuthorizationScope["kind"] | null = null,
): AuthorizationEvaluation {
  const input = {
    actorId: identity.actor.actorId,
    action,
    target: {
      projectId: target.project?.projectId ?? null,
      resourceRevision: target.project?.resourceRevision ?? null,
      configRevision: target.project?.configRevision ?? null,
    },
    now: identity.now,
    policy: policyFor(action, target.project, state),
    confirmed,
    grants: requiredScopeKind === null
      ? state.grants
      : state.grants.filter((grant) => grant.scope.kind === requiredScopeKind),
  };
  return evaluateAuthorization(input);
}

function authorizeCommand(
  identity: OperationIdentity,
  command: ApplicationCommand,
  target: BoundTarget,
  state: ApplicationState,
  confirmed: boolean,
): CommandAuthorization {
  const initial = authorize(identity, command.kind, target, state, confirmed);
  if (command.kind !== "authorization.grant.issue") {
    return Object.freeze({ evaluation: initial, issuanceProof: null });
  }
  if (!initial.allowed && initial.reason !== "confirmation_required") {
    return Object.freeze({ evaluation: initial, issuanceProof: null });
  }
  const candidate = Object.freeze({
    actorId: command.actorId,
    action: command.action,
    scope: command.scope,
    notBefore: command.notBefore,
    expiresAt: command.expiresAt,
  });
  const issuanceProof = canIssueGrant(identity.actor.actorId, state.grants, candidate, identity.now);
  if (issuanceProof === null) {
    return Object.freeze({
      evaluation: Object.freeze({ ...initial, allowed: false, reason: "scope_mismatch" }),
      issuanceProof: null,
    });
  }
  const administrative = state.grants.find((grant) => grant.grantId === issuanceProof.administrativeGrantId);
  if (administrative === undefined || administrative.action !== "authorization.grant.issue") {
    throw new TypeError("Grant issuance proof selected an absent administrative grant");
  }
  return Object.freeze({
    evaluation: Object.freeze({
      ...initial,
      grantId: administrative.grantId,
      grantRevision: administrative.revision,
    }),
    issuanceProof,
  });
}

function recordDenied(
  transaction: ApplicationTransaction,
  identity: OperationIdentity,
  action: AuthorizationAction,
  target: BoundTarget,
  evaluation: AuthorizationEvaluation,
  hooks: ApplicationTestHooks,
): ApplicationFailure {
  transaction.insertRequest(requestRecord(identity, action, target, "deny"));
  hooks.afterStage?.("request");
  transaction.insertDecision(decisionRecord(identity, action, target, evaluation));
  hooks.afterStage?.("decision");
  transaction.insertAudit(auditRecord(identity, target, "authorization.denied", "denied", evaluation.reason));
  hooks.afterStage?.("audit");
  return failed("AUTHORIZATION_DENIED", "Current explicit authorization did not permit the operation", identity, { reason: evaluation.reason });
}

function staleEvaluation(policy: AuthorizationPolicyResult): AuthorizationEvaluation {
  return Object.freeze({ allowed: false, reason: "scope_revision_stale", policy, grantId: null, grantRevision: null });
}

function ensureCurrentProject(
  state: ApplicationState,
  projectId: string,
  resourceRevision: number,
  configRevision: number | null,
): RegisteredProject | ApplicationFailure {
  const project = projectById(state, projectId);
  if (project === null) return failed("PROJECT_NOT_FOUND", "Project is not registered in ProjectRegistry", null, { projectId });
  if (project.resourceRevision !== resourceRevision || (configRevision !== null && project.configRevision !== configRevision)) {
    return failed("STALE_REVISION", "Project resource or config revision is stale", null, { projectId });
  }
  return project;
}

function isExistingProjectCommand(command: ApplicationCommand): command is ExistingProjectCommand {
  return command.kind === "project.update" || command.kind === "project.disable" || command.kind === "project.inspect";
}

function isDomainApplicationCommand(command: ApplicationCommand): command is DomainApplicationCommand {
  return command.kind === "task.create" || command.kind === "task.update" || command.kind === "task.mark_ready" ||
    command.kind === "task.cancel" || command.kind === "task.inspect" || command.kind === "dependency.add" ||
    command.kind === "dependency.remove";
}

function targetForCommand(command: ApplicationCommand, state: ApplicationState): BoundTarget | ApplicationFailure {
  switch (command.kind) {
    case "authorization.grant.issue": {
      const project = command.scope.kind === "project" && command.scope.projectId !== null ? projectById(state, command.scope.projectId) : null;
      return Object.freeze({ kind: "grant", id: "new-grant", revision: null, project });
    }
    case "authorization.grant.inspect":
    case "authorization.grant.revoke": {
      const grant = state.grants.find((candidate) => candidate.grantId === command.grantId);
      if (grant === undefined) return failed("GRANT_NOT_FOUND", "Grant is not registered");
      const project = grant.scope.kind === "project" && grant.scope.projectId !== null ? projectById(state, grant.scope.projectId) : null;
      return Object.freeze({ kind: "grant", id: grant.grantId, revision: command.expectedGrantRevision, project });
    }
    case "authorization.grant.list":
    case "runtime.status":
      return Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
    case "runtime.backup":
    case "runtime.restore":
      return Object.freeze({ kind: "backup", id: command.backupGenerationId, revision: null, project: null });
    case "project.register":
      return Object.freeze({ kind: "project", id: command.projectId, revision: null, project: null });
    case "project.update":
    case "project.disable":
    case "project.inspect":
    case "policy.evaluate": {
      const project = projectById(state, command.projectId);
      if (project === null) return failed("PROJECT_NOT_FOUND", "Project is not registered in ProjectRegistry", null, { projectId: command.projectId });
      return Object.freeze({ kind: "project", id: command.projectId, revision: command.expectedResourceRevision, project });
    }
    default: {
      const project = projectById(state, command.projectId);
      if (project === null) return failed("PROJECT_NOT_FOUND", "Project is not registered in ProjectRegistry", null, { projectId: command.projectId });
      return Object.freeze({
        kind: "task",
        id: command.taskId,
        revision: command.kind === "task.create" ? null : command.expectedTaskRevision,
        project,
      });
    }
  }
}

function domainMutation(command: ApplicationCommand, state: ApplicationState): DomainMutation | ApplicationFailure | null {
  if (!isDomainApplicationCommand(command)) return null;
  if (command.kind !== "task.create") {
    const task = taskById(state.domain, command.taskId);
    if (task === null) return failed("TASK_NOT_FOUND", "Task is not registered", null, { taskId: command.taskId });
    if (task.projectId !== command.projectId || task.revision !== command.expectedTaskRevision) {
      return failed("STALE_REVISION", "Task identity, Project, or revision is stale", null, { taskId: command.taskId });
    }
  }
  let result;
  switch (command.kind) {
    case "task.create":
      result = createTask(state.domain, { id: command.taskId, projectId: command.projectId, body: command.body, supersedesTaskId: command.supersedesTaskId });
      break;
    case "task.update":
      result = command.change.kind === "body"
        ? updateTaskBody(state.domain, { taskId: command.taskId, body: command.change.body })
        : setTaskParent(state.domain, { taskId: command.taskId, parentId: command.change.parentId });
      break;
    case "task.mark_ready":
      result = transitionTask(state.domain, { taskId: command.taskId, event: "mark_ready", targetState: "ready", payload: {} });
      break;
    case "task.cancel": {
      const dependentWaiting = state.domain.tasks
        .filter((task) => task.state === "ready" && task.dependencyIds.includes(command.taskId))
        .map((task) => ({
          taskId: task.id,
          waiting: {
            reason: "dependency_cancelled" as const,
            phase: "task_management",
            requiredAction: "review_dependency",
            lastErrorCode: "DEPENDENCY_CANCELLED",
            lastErrorSummary: null,
            retryable: false,
            retryCount: 0,
            retryAfter: null,
            executionId: null,
            workspaceRevision: null,
            backendThreadId: null,
          },
        }));
      result = transitionTask(state.domain, {
        taskId: command.taskId,
        event: "cancel",
        targetState: "cancelled",
        payload: { reason: command.reason, executionDisposition: null, dependentWaiting },
      });
      break;
    }
    case "dependency.add":
    case "dependency.remove": {
      const dependency = taskById(state.domain, command.dependencyId);
      if (dependency === null || dependency.revision !== command.expectedDependencyRevision) {
        return failed("STALE_REVISION", "Dependency identity or revision is stale", null, { dependencyId: command.dependencyId });
      }
      result = command.kind === "dependency.add"
        ? addTaskDependency(state.domain, { taskId: command.taskId, dependencyId: command.dependencyId })
        : removeTaskDependency(state.domain, { taskId: command.taskId, dependencyId: command.dependencyId });
      break;
    }
    default:
      return null;
  }
  return result.ok
    ? result.value
    : failed("DOMAIN_REJECTED", "Domain Core rejected the command", null, { domainCode: result.error.code });
}

function outputFor(command: ApplicationCommand, state: ApplicationState): unknown {
  switch (command.kind) {
    case "authorization.grant.issue":
      return state.grants.at(-1) ?? null;
    case "authorization.grant.inspect":
    case "authorization.grant.revoke":
      return state.grants.find((grant) => grant.grantId === command.grantId) ?? null;
    case "authorization.grant.list": {
      const actorId = state.identity?.actorId ?? state.bootstrap?.actorId ?? "";
      const matches = state.grants
        .filter((grant) => grant.actorId === actorId && (command.afterGrantId === null || grant.grantId > command.afterGrantId))
        .sort((left, right) => left.grantId < right.grantId ? -1 : left.grantId > right.grantId ? 1 : 0);
      const grants = Object.freeze(matches.slice(0, command.limit));
      return Object.freeze({
        grants,
        nextCursor: matches.length > command.limit ? grants.at(-1)?.grantId ?? null : null,
      });
    }
    case "runtime.status":
      return Object.freeze({
        initialized: true,
        schemaVersion: 4,
        projectCount: state.projects.length,
        taskCount: state.domain.tasks.length,
        dependencyCount: state.domain.tasks.reduce((count, task) => count + task.dependencyIds.length, 0),
        grantCount: state.grants.length,
        auditCount: state.audit.length,
      });
    case "runtime.backup":
    case "runtime.restore":
      throw new TypeError("Lifecycle output requires an exact authorization identity");
    case "policy.evaluate": {
      const project = projectById(state, command.projectId);
      return Object.freeze({
        action: command.action,
        policy: policyFor(command.action, project, state),
        projectId: command.projectId,
        resourceRevision: project?.resourceRevision ?? null,
      });
    }
    case "project.register":
    case "project.update":
    case "project.disable":
    case "project.inspect":
      return projectCommandResult(state, command.projectId);
    case "task.create":
    case "task.update":
    case "task.mark_ready":
    case "task.cancel":
    case "task.inspect":
    case "dependency.add":
    case "dependency.remove":
      return taskById(state.domain, command.taskId);
  }
}

export interface ApplicationService {
  bootstrap(command: BootstrapCommand): ApplicationResult<Readonly<{ actorId: string; grantIds: readonly string[] }>>;
  renew(command: RenewalCommand): ApplicationResult<CapabilityEpochResult>;
  execute(command: ApplicationCommand): ApplicationResult<unknown>;
}

function createApplicationServiceInternal(
  store: PersistenceStore,
  ingress: ApplicationIngress,
  hooks: ApplicationTestHooks,
): ApplicationService {
  const bootstrap = (value: BootstrapCommand): ApplicationResult<Readonly<{ actorId: string; grantIds: readonly string[] }>> => {
    const command = parseBootstrap(value);
    let identity = operationIdentity(ingress);
    if (command === null || identity === null) return failed("INVALID_INPUT", "Bootstrap input or trusted ingress is invalid");
    const confirmed = confirmHighRisk(identity, "authorization.grant.issue", ingress);
    if (!confirmed) return failed("AUTHORIZATION_DENIED", "Trusted bootstrap confirmation is required", identity, { reason: "confirmation_required" });
    const refreshedIdentity = refreshOperationTime(identity, ingress);
    if (refreshedIdentity === null) return failed("INVALID_INPUT", "Trusted bootstrap time could not be refreshed", identity);
    identity = refreshedIdentity;
    const maximumExpiry = new Date(new Date(identity.now).valueOf() + 31 * 24 * 60 * 60 * 1000).toISOString();
    if (command.expiresAt <= identity.now || command.expiresAt > maximumExpiry) {
      return failed("INVALID_INPUT", "Bootstrap expiry must be finite and no more than 31 days", identity);
    }
    const grantIds: string[] = [];
    try {
      for (const action of AUTHORIZATION_ACTIONS) {
        const grantId = ingress.nextId("grant");
        if (!operationalIdentifier(grantId) || grantIds.includes(grantId)) {
          return failed("INVALID_INPUT", `Trusted grant identity is invalid or repeated for ${action}`, identity);
        }
        grantIds.push(grantId);
      }
    } catch {
      return failed("INVALID_INPUT", "Trusted bootstrap grant identities could not be obtained", identity);
    }
    const runtimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in runtimeIdentity) return runtimeIdentity;
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (state.bootstrap !== null) return failed("BOOTSTRAP_ALREADY_CONSUMED", "Authorization bootstrap has already been consumed", identity);
      const target: BoundTarget = Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
      transaction.insertRequest(requestRecord(identity, "authorization.grant.issue", target, "bootstrap"));
      hooks.afterStage?.("request");
      transaction.insertBootstrap(Object.freeze({
        actorId: identity.actor.actorId,
        trustedPrincipal: identity.actor.principal,
        ...runtimeIdentity,
        requestId: identity.requestId,
        createdAt: identity.now,
        expiresAt: command.expiresAt,
        vocabularyVersion: 4 as const,
      }));
      hooks.afterStage?.("bootstrap");
      transaction.insertLocalIdentity(Object.freeze({
        identityVersion: 1 as const,
        actorId: identity.actor.actorId,
        principalSha256: identity.actor.principal,
        platform: runtimeIdentity.platform,
        runtimeRootKey: runtimeIdentity.rootKey,
        bootstrapRequestId: identity.requestId,
        adoptionRequestId: identity.requestId,
        createdAt: identity.now,
      }));
      hooks.afterStage?.("identity");
      for (const [index, action] of AUTHORIZATION_ACTIONS.entries()) {
        const grantId = grantIds[index];
        if (grantId === undefined) throw new TypeError("Trusted bootstrap grant identity is absent");
        transaction.insertGrant(Object.freeze({
          grantId,
          revision: 1,
          actorId: identity.actor.actorId,
          action,
          scope: Object.freeze({ kind: "runtime", projectId: null, resourceRevision: null, configRevision: null }),
          notBefore: identity.now,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: null,
          sourceGrantId: null,
          createdRequestId: identity.requestId,
        }));
        hooks.afterStage?.(`grant:${action}`);
      }
      transaction.insertAudit(auditRecord(identity, target, "bootstrap", "accepted", "bootstrap", null));
      hooks.afterStage?.("audit");
      const readback = transaction.read();
      if (readback.bootstrap?.requestId !== identity.requestId || !grantIds.every((grantId) => readback.grants.some((grant) => grant.grantId === grantId))) {
        throw new TypeError("Bootstrap terminal readback did not match");
      }
      return succeeded(Object.freeze({ actorId: identity.actor.actorId, grantIds: Object.freeze(grantIds) }), identity);
    });
  };

  const renew = (value: RenewalCommand): ApplicationResult<CapabilityEpochResult> => {
    const command = parseRenewal(value);
    let identity = operationIdentity(ingress);
    if (command === null || identity === null) return failed("INVALID_INPUT", "Capability renewal input or trusted ingress is invalid");
    if (!confirmHighRisk(identity, "authorization.capability.renew", ingress)) {
      return failed("AUTHORIZATION_DENIED", "Trusted capability renewal confirmation is required", identity, { reason: "confirmation_required" });
    }
    const refreshedIdentity = refreshOperationTime(identity, ingress);
    if (refreshedIdentity === null) return failed("INVALID_INPUT", "Trusted renewal time could not be refreshed", identity);
    identity = refreshedIdentity;
    const minimumExpiry = new Date(new Date(identity.now).valueOf() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const maximumExpiry = new Date(new Date(identity.now).valueOf() + 31 * 24 * 60 * 60 * 1000).toISOString();
    if (command.expiresAt <= minimumExpiry || command.expiresAt > maximumExpiry) {
      return failed("INVALID_INPUT", "Capability renewal expiry is outside the finite window", identity);
    }
    const runtimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in runtimeIdentity) return runtimeIdentity;
    const preflightState = readApplicationStateForOwner(store);
    const preflightAssessment = assessRenewal(preflightState, identity, runtimeIdentity);
    if (preflightAssessment === "not_initialized") {
      return failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity);
    }
    if (preflightAssessment === "authorization_denied") {
      return failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity);
    }
    if (preflightAssessment === "not_due") {
      return failed("CAPABILITY_RENEWAL_NOT_DUE", "Current capability origin is not eligible for renewal", identity);
    }
    const preflightStateSha256 = applicationStateSha256(preflightState);
    const preflightIdentityPresent = preflightState.identity !== null;
    const preflightEpochRevision = preflightState.epochs.at(-1)?.epochRevision ?? 0;
    let epochId: string;
    const grantIds: string[] = [];
    try {
      epochId = ingress.nextId("epoch");
      for (const action of AUTHORIZATION_ACTIONS) {
        const grantId = ingress.nextId("grant");
        if (!operationalIdentifier(grantId) || grantIds.includes(grantId) || grantId === epochId) {
          return failed("INVALID_INPUT", `Trusted renewal grant identity is invalid or repeated for ${action}`, identity);
        }
        grantIds.push(grantId);
      }
    } catch {
      return failed("INVALID_INPUT", "Trusted renewal identities could not be obtained", identity);
    }
    if (!operationalIdentifier(epochId)) return failed("INVALID_INPUT", "Trusted capability epoch identity is invalid", identity);
    hooks.beforeTransaction?.();
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (
        applicationStateSha256(state) !== preflightStateSha256 ||
        (state.identity !== null) !== preflightIdentityPresent ||
        (state.epochs.at(-1)?.epochRevision ?? 0) !== preflightEpochRevision
      ) {
        return failed("STALE_REVISION", "Capability renewal preflight is stale", identity);
      }
      const assessment = assessRenewal(state, identity, runtimeIdentity);
      if (typeof assessment === "string") {
        return assessment === "not_due"
          ? failed("CAPABILITY_RENEWAL_NOT_DUE", "Current capability origin is not eligible for renewal", identity)
          : assessment === "not_initialized"
            ? failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity)
            : failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity);
      }
      if (assessment.mode !== preflightAssessment.mode || assessment.nextEpochRevision !== preflightAssessment.nextEpochRevision) {
        return failed("STALE_REVISION", "Capability renewal lineage is stale", identity);
      }
      const target: BoundTarget = Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
      transaction.insertRequest(requestRecord(identity, "authorization.capability.renew", target, "renewal"));
      hooks.afterStage?.("request");
      if (assessment.mode === "adopted") {
        const bootstrap = state.bootstrap;
        if (bootstrap === null) throw new TypeError("Legacy bootstrap is absent during adoption");
        transaction.insertLocalIdentity(Object.freeze({
          identityVersion: 1 as const,
          actorId: identity.actor.actorId,
          principalSha256: identity.actor.principal,
          platform: runtimeIdentity.platform,
          runtimeRootKey: runtimeIdentity.rootKey,
          bootstrapRequestId: bootstrap.requestId,
          adoptionRequestId: identity.requestId,
          createdAt: identity.now,
        }));
        hooks.afterStage?.("identity");
      }
      transaction.insertCapabilityEpoch(Object.freeze({
        epochId,
        epochRevision: assessment.nextEpochRevision,
        actorId: identity.actor.actorId,
        runtimeRootKey: runtimeIdentity.rootKey,
        vocabularyVersion: 4 as const,
        actionSetSha256: CAPABILITY_ACTION_SET_SHA256,
        requestId: identity.requestId,
        createdAt: identity.now,
        expiresAt: command.expiresAt,
      }));
      hooks.afterStage?.("epoch");
      for (const [index, action] of AUTHORIZATION_ACTIONS.entries()) {
        const grantId = grantIds[index];
        if (grantId === undefined) throw new TypeError("Trusted renewal grant identity is absent");
        transaction.insertGrant(Object.freeze({
          grantId,
          revision: 1,
          actorId: identity.actor.actorId,
          action,
          scope: Object.freeze({ kind: "runtime", projectId: null, resourceRevision: null, configRevision: null }),
          notBefore: identity.now,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: null,
          sourceGrantId: null,
          capabilityEpochId: epochId,
          createdRequestId: identity.requestId,
        }));
        hooks.afterStage?.(`grant:${action}`);
      }
      transaction.insertDecision(Object.freeze({
        decisionId: identity.decisionId,
        requestId: identity.requestId,
        actorId: identity.actor.actorId,
        action: "authorization.capability.renew" as const,
        result: "allow" as const,
        reason: "allowed" as const,
        policy: "allow" as const,
        grantId: null,
        grantRevision: null,
        projectId: null,
        resourceRevision: null,
        createdAt: identity.now,
      }));
      hooks.afterStage?.("decision");
      transaction.insertAudit(auditRecord(identity, target, "capability.renewed", "accepted", "accepted"));
      hooks.afterStage?.("audit");
      const readback = transaction.read();
      const epoch = readback.epochs.find((candidate) => candidate.epochId === epochId);
      if (epoch === undefined || epoch.epochRevision !== assessment.nextEpochRevision ||
          !grantIds.every((grantId) => readback.grants.some((grant) => grant.grantId === grantId))) {
        throw new TypeError("Capability renewal terminal readback did not match");
      }
      return succeeded(Object.freeze({
        mode: assessment.mode,
        expiresAt: epoch.expiresAt,
        capabilityCount: AUTHORIZATION_ACTIONS.length,
        epochRevision: epoch.epochRevision,
      }), identity);
    });
  };

  const execute = (value: ApplicationCommand): ApplicationResult<unknown> => {
    const command = parseCommand(value);
    if (command === null) return failed("INVALID_INPUT", "Command or trusted ingress is invalid");
    let identity = operationIdentity(ingress);
    if (identity === null) return failed("INVALID_INPUT", "Command or trusted ingress is invalid");

    const preflightState = readApplicationStateForOwner(store);
    if (preflightState.bootstrap === null) {
      return failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity);
    }
    if (preflightState.bootstrap.vocabularyVersion === 3 && preflightState.identity === null) {
      return failed("AUTHORIZATION_DENIED", "Legacy authorization must be adopted before this operation", identity);
    }
    const preflightTarget = targetForCommand(command, preflightState);
    if ("ok" in preflightTarget) {
      return Object.freeze({ ...preflightTarget, requestId: identity.requestId, correlationId: identity.correlationId });
    }
    const preflightCommandAuthorization = authorizeCommand(identity, command, preflightTarget, preflightState, true);
    const preflightAuthorization = preflightCommandAuthorization.evaluation;
    const confirmed = isHighRiskAction(command.kind)
      ? preflightAuthorization.allowed && confirmHighRisk(identity, command.kind, ingress)
      : true;
    if (isHighRiskAction(command.kind)) {
      const refreshedIdentity = refreshOperationTime(identity, ingress);
      if (refreshedIdentity === null) return failed("INVALID_INPUT", "Trusted operation time could not be refreshed", identity);
      identity = refreshedIdentity;
    }

    let issuedGrantId: string | null = null;
    if (command.kind === "authorization.grant.issue") {
      try {
        issuedGrantId = ingress.nextId("grant");
      } catch {
        return failed("INVALID_INPUT", "Trusted grant identity could not be obtained", identity);
      }
      if (!operationalIdentifier(issuedGrantId)) return failed("INVALID_INPUT", "Trusted grant identity is invalid", identity);
    }
    let lifecycleAuthorizationId: string | null = null;
    if (command.kind === "runtime.backup" || command.kind === "runtime.restore") {
      try {
        lifecycleAuthorizationId = ingress.nextId("lifecycle");
      } catch {
        return failed("INVALID_INPUT", "Trusted lifecycle authorization identity could not be obtained", identity);
      }
      if (!operationalIdentifier(lifecycleAuthorizationId)) {
        return failed("INVALID_INPUT", "Trusted lifecycle authorization identity is invalid", identity);
      }
    }

    let preflightCancelProjectIds: readonly string[] | null = null;
    if (command.kind === "task.cancel" && preflightAuthorization.allowed) {
      const prospectiveMutation = domainMutation(command, preflightState);
      if (prospectiveMutation !== null && !("ok" in prospectiveMutation)) {
        preflightCancelProjectIds = affectedProjectIds(prospectiveMutation);
      }
    }

    const currentRuntimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in currentRuntimeIdentity) return currentRuntimeIdentity;
    if (!sameRootIdentity(preflightState.bootstrap, currentRuntimeIdentity)) {
      return failed("AUTHORIZATION_DENIED", "Authorization bootstrap is bound to another runtime-root identity", identity, { reason: "scope_mismatch" });
    }
    const localIdentityRequired = identity.actor.actorId.startsWith("local-v1:") ||
      identity.actor.actorId === preflightState.identity?.actorId ||
      command.kind === "authorization.grant.list" || command.kind === "runtime.status" ||
      command.kind === "runtime.backup" || command.kind === "runtime.restore";
    if (localIdentityRequired && !sameLocalIdentity(preflightState, identity, currentRuntimeIdentity)) {
      return failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity, { reason: "actor_mismatch" });
    }
    let registrationIdentity: ProjectRootIdentity | null = null;
    if (command.kind === "project.register") {
      try {
        registrationIdentity = inspectProjectRoot(command.root, store.layout.root);
      } catch (error) {
        return projectRegistryFailure(error, identity);
      }
    }
    if (registrationIdentity !== null) {
      const checked = checkedProjectRoot(registrationIdentity, store.layout.root, identity);
      if ("ok" in checked) return checked;
      registrationIdentity = checked;
    }
    let preflightProjectIdentity: ProjectRootIdentity | null = null;
    if (preflightTarget.project !== null) {
      const checked = checkedProjectRoot(preflightTarget.project, store.layout.root, identity);
      if ("ok" in checked) return checked;
      preflightProjectIdentity = checked;
    }
    const affectedProjectPreflights = new Map<string, AffectedProjectPreflight>();
    if (preflightCancelProjectIds !== null) {
      for (const projectId of preflightCancelProjectIds) {
        const project = projectById(preflightState, projectId);
        if (project === null) {
          return failed(
            "PROJECT_REGISTRY_REJECTED",
            "An affected Domain Project is not registered in ProjectRegistry",
            identity,
            { registryCode: "PROJECT_IDENTITY_UNCERTAIN", projectId },
          );
        }
        let checked: ProjectRootIdentity | ApplicationFailure;
        if (preflightTarget.project?.projectId === projectId && preflightProjectIdentity !== null) {
          checked = preflightProjectIdentity;
        } else {
          checked = checkedProjectRoot(project, store.layout.root, identity);
        }
        if ("ok" in checked) return checked;
        affectedProjectPreflights.set(projectId, Object.freeze({ project, identity: checked }));
      }
    }

    hooks.beforeTransaction?.();
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (state.bootstrap === null) return failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity);
      if (!sameRootIdentity(state.bootstrap, currentRuntimeIdentity)) {
        return failed("AUTHORIZATION_DENIED", "Authorization bootstrap is bound to another runtime-root identity", identity, { reason: "scope_mismatch" });
      }
      if (localIdentityRequired && !sameLocalIdentity(state, identity, currentRuntimeIdentity)) {
        return failed("AUTHORIZATION_DENIED", "Trusted local identity changed after preflight", identity, { reason: "actor_mismatch" });
      }
      let target = targetForCommand(command, state);
      if ("ok" in target) return Object.freeze({ ...target, requestId: identity.requestId, correlationId: identity.correlationId });
      if (
        target.project !== null &&
        (preflightProjectIdentity === null || !sameRootIdentity(target.project, preflightProjectIdentity))
      ) {
        return failed(
          "PROJECT_REGISTRY_REJECTED",
          "Project identity changed after trusted preflight",
          identity,
          { registryCode: "PROJECT_IDENTITY_CHANGED" },
        );
      }

      if (command.kind === "authorization.grant.issue" && command.scope.kind === "project") {
        const current = command.scope.projectId === null ? null : projectById(state, command.scope.projectId);
        if (
          current === null ||
          current.resourceRevision !== command.scope.resourceRevision ||
          current.configRevision !== command.scope.configRevision
        ) {
          return recordDenied(transaction, identity, command.kind, target, staleEvaluation("read_not_applicable"), hooks);
        }
        target = Object.freeze({ ...target, project: current });
      }

      if (isExistingProjectCommand(command)) {
        const expectedConfig = command.kind === "project.inspect" ? null : command.expectedConfigRevision;
        const current = ensureCurrentProject(state, command.projectId, command.expectedResourceRevision, expectedConfig);
        if ("ok" in current) {
          const denied = staleEvaluation(command.kind === "project.inspect" ? "read_not_applicable" : "allow");
          return recordDenied(transaction, identity, command.kind, target, denied, hooks);
        }
        target = Object.freeze({ ...target, project: current });
      }
      if (command.kind === "policy.evaluate") {
        const current = ensureCurrentProject(state, command.projectId, command.expectedResourceRevision, command.expectedConfigRevision);
        if ("ok" in current) return recordDenied(transaction, identity, command.kind, target, staleEvaluation("read_not_applicable"), hooks);
        target = Object.freeze({ ...target, project: current });
      }
      if (isDomainApplicationCommand(command)) {
        const current = ensureCurrentProject(state, command.projectId, command.expectedProjectResourceRevision, null);
        if ("ok" in current) return recordDenied(transaction, identity, command.kind, target, staleEvaluation(policyFor(command.kind, target.project, state)), hooks);
        target = Object.freeze({ ...target, project: current });
      }
      if (command.kind === "authorization.grant.inspect" || command.kind === "authorization.grant.revoke") {
        const grant = state.grants.find((candidate) => candidate.grantId === command.grantId);
        if (grant === undefined) return failed("GRANT_NOT_FOUND", "Grant is not registered", identity);
        if (grant.revision !== command.expectedGrantRevision) {
          return recordDenied(transaction, identity, command.kind, target, staleEvaluation("read_not_applicable"), hooks);
        }
      }

      const commandAuthorization = authorizeCommand(identity, command, target, state, confirmed);
      let evaluation = commandAuthorization.evaluation;
      const issuanceProof = commandAuthorization.issuanceProof;
      if (!evaluation.allowed) {
        const denial = recordDenied(transaction, identity, command.kind, target, evaluation, hooks);
        return command.kind === "authorization.grant.issue" && evaluation.reason === "scope_mismatch"
          ? failed("SCOPE_EXPANSION_DENIED", "Requested grant exceeds the current issuance authority", identity)
          : denial;
      }

      const mutation = domainMutation(command, state);
      if (mutation !== null && "ok" in mutation) {
        return Object.freeze({ ...mutation, requestId: identity.requestId, correlationId: identity.correlationId });
      }
      if (command.kind === "task.cancel" && mutation !== null) {
        const changedProjectIds = affectedProjectIds(mutation);
        if (preflightCancelProjectIds === null || !sameProjectIds(changedProjectIds, preflightCancelProjectIds)) {
          return recordDenied(
            transaction,
            identity,
            command.kind,
            target,
            staleEvaluation(evaluation.policy),
            hooks,
          );
        }
        for (const projectId of changedProjectIds) {
          const captured = affectedProjectPreflights.get(projectId);
          const current = projectById(state, projectId);
          if (captured === undefined || current === null) {
            return failed(
              "PROJECT_REGISTRY_REJECTED",
              "An affected ProjectRegistry binding is absent after trusted preflight",
              identity,
              { registryCode: "PROJECT_IDENTITY_UNCERTAIN", projectId },
            );
          }
          if (
            current.configRevision !== captured.project.configRevision ||
            current.resourceRevision !== captured.project.resourceRevision
          ) {
            return recordDenied(
              transaction,
              identity,
              command.kind,
              target,
              staleEvaluation(evaluation.policy),
              hooks,
            );
          }
          if (!sameProjectBinding(current, captured.project) || !sameRootIdentity(current, captured.identity)) {
            return failed(
              "PROJECT_REGISTRY_REJECTED",
              "An affected Project identity changed after trusted preflight",
              identity,
              { registryCode: "PROJECT_IDENTITY_CHANGED", projectId },
            );
          }
          if (policyFor(command.kind, current, state) !== "allow") {
            return recordDenied(
              transaction,
              identity,
              command.kind,
              target,
              Object.freeze({ ...evaluation, allowed: false, reason: "policy_denied", policy: "deny" }),
              hooks,
            );
          }
        }
        if (changedProjectIds.length !== 1 || changedProjectIds[0] !== command.projectId) {
          const runtimeEvaluation = authorize(identity, command.kind, target, state, confirmed, "runtime");
          if (!runtimeEvaluation.allowed) {
            const runtimeCapabilityAbsent = runtimeEvaluation.reason === "actor_mismatch" ||
              runtimeEvaluation.reason === "action_mismatch" || runtimeEvaluation.reason === "grant_missing" ||
              runtimeEvaluation.reason === "scope_mismatch";
            return recordDenied(
              transaction,
              identity,
              command.kind,
              target,
              runtimeCapabilityAbsent
                ? Object.freeze({ ...evaluation, allowed: false, reason: "scope_mismatch" })
                : runtimeEvaluation,
              hooks,
            );
          }
          evaluation = runtimeEvaluation;
        }
      }
      let projectMutation: ProjectDomainMutation | null = null;
      if (command.kind === "project.disable" || command.kind === "project.update") {
        const enabled = state.domain.projects.find((project) => project.id === command.projectId)?.enabled;
        if (enabled === undefined) return failed("PROJECT_NOT_FOUND", "Domain Project is not registered", identity, { projectId: command.projectId });
        if ((command.kind === "project.disable" && enabled) || (command.kind === "project.update" && !enabled)) {
          const result = setProjectEnabled(state.domain, { projectId: command.projectId, enabled: command.kind === "project.update" });
          if (!result.ok) return failed("DOMAIN_REJECTED", "Domain Core rejected Project enablement", identity, { domainCode: result.error.code });
          projectMutation = result.value;
        } else if (command.kind === "project.disable") {
          return failed("DOMAIN_REJECTED", "Domain Core rejected Project disablement", identity, { domainCode: "NO_OP" });
        }
      }

      if (command.kind === "project.register") {
        if (state.projects.some((project) => project.projectId === command.projectId || project.rootKey === registrationIdentity?.rootKey)) {
          return failed("PROJECT_ALREADY_REGISTERED", "Project identity or canonical root is already registered", identity);
        }
      }

      if (command.kind === "authorization.grant.issue") {
        if (issuedGrantId === null) throw new TypeError("Trusted grant identity is absent");
        target = Object.freeze({ ...target, id: issuedGrantId });
      }

      transaction.insertRequest(requestRecord(identity, command.kind, target, "allow"));
      hooks.afterStage?.("request");

      if (command.kind === "authorization.grant.issue") {
        if (issuedGrantId === null) throw new TypeError("Trusted grant identity is absent");
        if (issuanceProof === null) throw new TypeError("Grant issuance proof is absent");
        const record: NewGrantRecord = Object.freeze({
          grantId: issuedGrantId,
          revision: 1,
          actorId: command.actorId,
          action: command.action,
          scope: command.scope,
          notBefore: command.notBefore,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: issuanceProof.administrativeGrantId,
          sourceGrantId: issuanceProof.sourceGrantId,
          createdRequestId: identity.requestId,
        });
        transaction.insertGrant(record);
        hooks.afterStage?.("grant");
        target = Object.freeze({ ...target, id: issuedGrantId });
      } else if (command.kind === "authorization.grant.revoke") {
        transaction.revokeGrant(command.grantId, command.expectedGrantRevision, identity.now, identity.requestId);
        hooks.afterStage?.("grant");
      } else if (command.kind === "project.register") {
        if (registrationIdentity === null) throw new TypeError("Project identity preflight is absent");
        const domainProject = state.domain.projects.find((project) => project.id === command.projectId);
        if (domainProject === undefined) {
          const projectResult = registerProject(state.domain, { projectId: command.projectId });
          if (!projectResult.ok) throw new TypeError(`Domain Project registration failed: ${projectResult.error.code}`);
          transaction.writeProjectDomain(state.domain, projectResult.value);
          hooks.afterStage?.("domain");
        }
        const project: RegisteredProject = Object.freeze({
          ...registrationIdentity,
          projectId: command.projectId,
          configRevision: 1,
          resourceRevision: 1,
          createdAt: identity.now,
          updatedAt: identity.now,
        });
        transaction.insertProject(project);
        hooks.afterStage?.("registry");
      } else if (command.kind === "project.update") {
        const current = target.project as RegisteredProject;
        if (preflightProjectIdentity === null) throw new TypeError("Project identity preflight is absent");
        if (projectMutation !== null) {
          transaction.writeProjectDomain(state.domain, projectMutation);
          hooks.afterStage?.("domain");
        }
        const next: RegisteredProject = Object.freeze({
          ...preflightProjectIdentity,
          projectId: current.projectId,
          configRevision: current.configRevision + 1,
          resourceRevision: current.resourceRevision + 1,
          createdAt: current.createdAt,
          updatedAt: identity.now,
        });
        transaction.updateProject(next, current.configRevision, current.resourceRevision);
        hooks.afterStage?.("registry");
      } else if (command.kind === "project.disable") {
        const current = target.project as RegisteredProject;
        if (projectMutation === null) throw new TypeError("Project disablement mutation is absent");
        transaction.writeProjectDomain(state.domain, projectMutation);
        hooks.afterStage?.("domain");
        transaction.updateProject(Object.freeze({
          ...current,
          configRevision: current.configRevision + 1,
          resourceRevision: current.resourceRevision + 1,
          updatedAt: identity.now,
        }), current.configRevision, current.resourceRevision);
        hooks.afterStage?.("registry");
      } else if (mutation !== null) {
        transaction.writeDomain(state.domain, mutation as DomainMutation);
        hooks.afterStage?.("domain");
      }

      transaction.insertDecision(decisionRecord(identity, command.kind, target, evaluation));
      hooks.afterStage?.("decision");
      transaction.insertAudit(auditRecord(identity, target, applicationAuditKind(command.kind), "accepted", "accepted"));
      hooks.afterStage?.("audit");
      if (command.kind === "runtime.backup" || command.kind === "runtime.restore") {
        if (lifecycleAuthorizationId === null || evaluation.grantId === null || evaluation.grantRevision === null) {
          throw new TypeError("Lifecycle authorization evidence is incomplete");
        }
        const authorizedState = transaction.read();
        const localIdentity = authorizedState.identity;
        const evaluatedGrant = authorizedState.grants.find((grant) => grant.grantId === evaluation.grantId);
        if (
          localIdentity === null ||
          localIdentity.actorId !== identity.actor.actorId ||
          evaluatedGrant === undefined ||
          evaluatedGrant.revision !== evaluation.grantRevision ||
          evaluatedGrant.revokedAt !== null
        ) {
          throw new TypeError("Lifecycle authorization changed before durable handoff");
        }
        const fiveMinutes = new Date(new Date(identity.now).valueOf() + 5 * 60 * 1000).toISOString();
        transaction.insertLifecycleAuthorization(Object.freeze({
          authorizationId: lifecycleAuthorizationId,
          operation: command.kind,
          backupGenerationId: command.backupGenerationId,
          actorId: identity.actor.actorId,
          runtimeRootKey: localIdentity.runtimeRootKey,
          grantId: evaluatedGrant.grantId,
          grantRevision: evaluatedGrant.revision,
          requestId: identity.requestId,
          decisionId: identity.decisionId,
          auditId: identity.auditId,
          authorizedStateSha256: transaction.stateSha256(),
          expectedRequestCount: authorizedState.requests.length,
          expectedDecisionCount: authorizedState.decisions.length,
          expectedAuditCount: authorizedState.audit.length,
          issuedAt: identity.now,
          expiresAt: evaluatedGrant.expiresAt < fiveMinutes ? evaluatedGrant.expiresAt : fiveMinutes,
        }));
        hooks.afterStage?.("lifecycle");
      }
      const readback = transaction.read();
      if (lifecycleAuthorizationId !== null) {
        const authorization = readback.lifecycle.find(
          (candidate) => candidate.authorizationId === lifecycleAuthorizationId,
        );
        if (authorization === undefined) {
          throw new TypeError("Lifecycle terminal readback is absent");
        }
        return succeeded(authorization, identity);
      }
      if (issuedGrantId !== null) {
        const grant = readback.grants.find((candidate) => candidate.grantId === issuedGrantId);
        if (grant === undefined) throw new TypeError("Grant terminal readback is absent");
        return succeeded(grant, identity);
      }
      return succeeded(outputFor(command, readback), identity);
    });
  };

  return Object.freeze({
    bootstrap,
    renew,
    execute,
  });
}

export function createApplicationService(
  store: PersistenceStore,
  ingress: ApplicationIngress,
): ApplicationService {
  return createApplicationServiceInternal(store, ingress, Object.freeze({}));
}

export function createApplicationServiceWithHooks(
  store: PersistenceStore,
  ingress: ApplicationIngress,
  hooks: ApplicationTestHooks,
): ApplicationService {
  return createApplicationServiceInternal(store, ingress, hooks);
}
