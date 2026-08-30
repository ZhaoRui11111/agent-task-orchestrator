import {
  evaluateAuthorization,
  type AuthorizationAction,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import { transitionTask, type Task } from "./domain.ts";
import type { ApplicationIngress, TrustedActorAssertion } from "./application.ts";
import {
  ProjectRegistryError,
  inspectTrustedRuntimeRoot,
  revalidateProjectRoot,
  type ProjectRootIdentity,
} from "./project-registry.ts";
import {
  applicationAuditKind,
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationAuditRecord,
  type ApplicationRequestRecord,
  type ApplicationState,
  type ApplicationTransaction,
  type AuthorizationDecisionRecord,
  type ExecutionAttempt,
  type RegisteredProject,
  type TaskExecutionSequence,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import type { PersistenceStore } from "./persistence/store.ts";

export const EXECUTION_APPLICATION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "PROJECT_NOT_FOUND",
  "PROJECT_DISABLED",
  "PROJECT_IDENTITY_CHANGED",
  "TASK_NOT_FOUND",
  "TASK_NOT_ELIGIBLE",
  "EXECUTION_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "STALE_REVISION",
  "STALE_FENCE",
  "LEASE_NOT_RENEWABLE",
  "LEASE_NOT_EXPIRED",
  "RECONCILIATION_REQUIRED",
  "PERSISTENCE_FAILURE",
] as const);

export type ExecutionApplicationErrorCode = (typeof EXECUTION_APPLICATION_ERROR_CODES)[number];
export interface ExecutionApplicationError {
  readonly code: ExecutionApplicationErrorCode;
  readonly message: string;
}
export interface ExecutionApplicationSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly requestId: string;
  readonly correlationId: string;
}
export interface ExecutionApplicationFailure {
  readonly ok: false;
  readonly error: ExecutionApplicationError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}
export type ExecutionApplicationResult<T> = ExecutionApplicationSuccess<T> | ExecutionApplicationFailure;

export interface ExecutionIngress extends Pick<ApplicationIngress, "currentActor" | "now"> {
  nextId(kind: "request" | "correlation" | "decision" | "audit" | "execution"): string;
  currentLeaseOwner(): string;
}
export interface ExecutionClaimCommand {
  readonly kind: "execution.claim";
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly idempotencyKey: string;
  readonly leaseDurationSeconds: number;
}
export interface ExecutionInspectCommand {
  readonly kind: "execution.claim.inspect";
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedTaskRevision: number;
}
export interface ExecutionLeaseRenewCommand {
  readonly kind: "execution.lease.renew";
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedLeaseRevision: number;
  readonly expectedFencingToken: number;
  readonly expectedTaskRevision: number;
  readonly leaseDurationSeconds: number;
}
export interface ExecutionTakeoverCommand {
  readonly kind: "execution.lease.takeover";
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly predecessorExecutionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedLeaseRevision: number;
  readonly expectedFencingToken: number;
  readonly idempotencyKey: string;
  readonly leaseDurationSeconds: number;
}
export interface ExecutionClaimView {
  readonly executionId: string;
  readonly taskId: string;
  readonly attemptNumber: number;
  readonly status: "active" | "superseded";
  readonly ownerId: string;
  readonly leaseRevision: number;
  readonly leaseExpiresAt: string;
  readonly expired: boolean;
  readonly fencingToken: number;
  readonly revision: number;
  readonly taskRevision: number;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly supersedesExecutionId: string | null;
  readonly supersededByExecutionId: string | null;
}
export interface ExecutionApplicationService {
  claim(command: ExecutionClaimCommand): ExecutionApplicationResult<ExecutionClaimView>;
  inspect(command: ExecutionInspectCommand): ExecutionApplicationResult<ExecutionClaimView>;
  renew(command: ExecutionLeaseRenewCommand): ExecutionApplicationResult<ExecutionClaimView>;
  takeover(command: ExecutionTakeoverCommand): ExecutionApplicationResult<ExecutionClaimView>;
}
export interface ExecutionApplicationTestHooks {
  beforeTransaction?(): void;
  afterStage?(stage: string): void;
}

type UnknownRecord = Record<string, unknown>;
interface TrustedExecutionContext {
  readonly actor: TrustedActorAssertion;
  readonly ownerId: string;
  readonly now: string;
}
interface ExecutionOperationIdentity extends TrustedExecutionContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly auditId: string;
}
interface ProjectTaskBinding {
  readonly project: RegisteredProject;
  readonly task: Task;
}

function exactRecord(value: unknown, keys: readonly string[]): Readonly<UnknownRecord> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const expected = new Set(keys);
    const result: UnknownRecord = Object.create(null) as UnknownRecord;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !expected.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      Object.defineProperty(result, key, { enumerable: true, value: descriptor.value });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}
function domainIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !value.includes("\0");
}
function operationIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}
function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function leaseDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 30 && value <= 3600;
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}
function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  return record !== null && operationIdentifier(record.actorId) && /^[0-9A-F]{64}$/u.test(String(record.principal))
    ? Object.freeze({ actorId: record.actorId, principal: record.principal as string })
    : null;
}
function trustedContext(ingress: ExecutionIngress): TrustedExecutionContext | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const ownerId = ingress.currentLeaseOwner();
    const now = ingress.now();
    return actor !== null && operationIdentifier(ownerId) && timestamp(now)
      ? Object.freeze({ actor, ownerId, now })
      : null;
  } catch {
    return null;
  }
}
function operationIdentity(context: TrustedExecutionContext, ingress: ExecutionIngress): ExecutionOperationIdentity | null {
  try {
    const requestId = ingress.nextId("request");
    const correlationId = ingress.nextId("correlation");
    const decisionId = ingress.nextId("decision");
    const auditId = ingress.nextId("audit");
    return [requestId, correlationId, decisionId, auditId].every(operationIdentifier) &&
      new Set([requestId, correlationId, decisionId, auditId]).size === 4
      ? Object.freeze({ ...context, requestId, correlationId, decisionId, auditId })
      : null;
  } catch {
    return null;
  }
}
function nextExecutionId(ingress: ExecutionIngress): string | null {
  try {
    const value = ingress.nextId("execution");
    return operationIdentifier(value) ? value : null;
  } catch {
    return null;
  }
}
function failed(
  code: ExecutionApplicationErrorCode,
  message: string,
  identity: ExecutionOperationIdentity | null = null,
): ExecutionApplicationFailure {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, message }),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}
function succeeded<T>(value: T, requestId: string, correlationId: string): ExecutionApplicationSuccess<T> {
  return Object.freeze({ ok: true, value, requestId, correlationId });
}

function parseClaim(value: unknown): ExecutionClaimCommand | null {
  const record = exactRecord(value, [
    "kind", "projectId", "expectedProjectResourceRevision", "expectedProjectConfigRevision",
    "taskId", "expectedTaskRevision", "idempotencyKey", "leaseDurationSeconds",
  ]);
  if (
    record === null || record.kind !== "execution.claim" ||
    !domainIdentifier(record.projectId) || !revision(record.expectedProjectResourceRevision) ||
    !revision(record.expectedProjectConfigRevision) || !domainIdentifier(record.taskId) ||
    !revision(record.expectedTaskRevision) || !operationIdentifier(record.idempotencyKey) ||
    !leaseDuration(record.leaseDurationSeconds)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId,
    expectedProjectResourceRevision: record.expectedProjectResourceRevision,
    expectedProjectConfigRevision: record.expectedProjectConfigRevision,
    taskId: record.taskId,
    expectedTaskRevision: record.expectedTaskRevision,
    idempotencyKey: record.idempotencyKey,
    leaseDurationSeconds: record.leaseDurationSeconds,
  });
}
function parseInspect(value: unknown): ExecutionInspectCommand | null {
  const record = exactRecord(value, [
    "kind", "projectId", "expectedProjectResourceRevision", "expectedProjectConfigRevision",
    "executionId", "expectedExecutionRevision", "expectedTaskRevision",
  ]);
  if (
    record === null || record.kind !== "execution.claim.inspect" ||
    !domainIdentifier(record.projectId) || !revision(record.expectedProjectResourceRevision) ||
    !revision(record.expectedProjectConfigRevision) || !operationIdentifier(record.executionId) ||
    !revision(record.expectedExecutionRevision) || !revision(record.expectedTaskRevision)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId,
    expectedProjectResourceRevision: record.expectedProjectResourceRevision,
    expectedProjectConfigRevision: record.expectedProjectConfigRevision,
    executionId: record.executionId,
    expectedExecutionRevision: record.expectedExecutionRevision,
    expectedTaskRevision: record.expectedTaskRevision,
  });
}
function parseRenew(value: unknown): ExecutionLeaseRenewCommand | null {
  const record = exactRecord(value, [
    "kind", "projectId", "expectedProjectResourceRevision", "expectedProjectConfigRevision",
    "executionId", "expectedExecutionRevision", "expectedLeaseRevision", "expectedFencingToken",
    "expectedTaskRevision", "leaseDurationSeconds",
  ]);
  if (
    record === null || record.kind !== "execution.lease.renew" ||
    !domainIdentifier(record.projectId) || !revision(record.expectedProjectResourceRevision) ||
    !revision(record.expectedProjectConfigRevision) || !operationIdentifier(record.executionId) ||
    !revision(record.expectedExecutionRevision) || !revision(record.expectedLeaseRevision) ||
    !revision(record.expectedFencingToken) || !revision(record.expectedTaskRevision) ||
    !leaseDuration(record.leaseDurationSeconds)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId,
    expectedProjectResourceRevision: record.expectedProjectResourceRevision,
    expectedProjectConfigRevision: record.expectedProjectConfigRevision,
    executionId: record.executionId,
    expectedExecutionRevision: record.expectedExecutionRevision,
    expectedLeaseRevision: record.expectedLeaseRevision,
    expectedFencingToken: record.expectedFencingToken,
    expectedTaskRevision: record.expectedTaskRevision,
    leaseDurationSeconds: record.leaseDurationSeconds,
  });
}
function parseTakeover(value: unknown): ExecutionTakeoverCommand | null {
  const record = exactRecord(value, [
    "kind", "projectId", "expectedProjectResourceRevision", "expectedProjectConfigRevision",
    "taskId", "expectedTaskRevision", "predecessorExecutionId", "expectedExecutionRevision",
    "expectedLeaseRevision", "expectedFencingToken", "idempotencyKey", "leaseDurationSeconds",
  ]);
  if (
    record === null || record.kind !== "execution.lease.takeover" ||
    !domainIdentifier(record.projectId) || !revision(record.expectedProjectResourceRevision) ||
    !revision(record.expectedProjectConfigRevision) || !domainIdentifier(record.taskId) ||
    !revision(record.expectedTaskRevision) || !operationIdentifier(record.predecessorExecutionId) ||
    !revision(record.expectedExecutionRevision) || !revision(record.expectedLeaseRevision) ||
    !revision(record.expectedFencingToken) || !operationIdentifier(record.idempotencyKey) ||
    !leaseDuration(record.leaseDurationSeconds)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId,
    expectedProjectResourceRevision: record.expectedProjectResourceRevision,
    expectedProjectConfigRevision: record.expectedProjectConfigRevision,
    taskId: record.taskId,
    expectedTaskRevision: record.expectedTaskRevision,
    predecessorExecutionId: record.predecessorExecutionId,
    expectedExecutionRevision: record.expectedExecutionRevision,
    expectedLeaseRevision: record.expectedLeaseRevision,
    expectedFencingToken: record.expectedFencingToken,
    idempotencyKey: record.idempotencyKey,
    leaseDurationSeconds: record.leaseDurationSeconds,
  });
}

function taskById(state: ApplicationState, taskId: string): Task | null {
  return state.domain.tasks.find((candidate) => candidate.id === taskId) ?? null;
}
function binding(
  state: ApplicationState,
  projectId: string,
  expectedResourceRevision: number,
  expectedConfigRevision: number,
  taskId: string,
): ProjectTaskBinding | ExecutionApplicationFailure {
  const project = state.projects.find((candidate) => candidate.projectId === projectId);
  if (project === undefined) return failed("PROJECT_NOT_FOUND", "Project is not registered");
  if (project.resourceRevision !== expectedResourceRevision || project.configRevision !== expectedConfigRevision) {
    return failed("STALE_REVISION", "Project binding is stale");
  }
  const task = taskById(state, taskId);
  if (task === null) return failed("TASK_NOT_FOUND", "Task is not registered");
  if (task.projectId !== projectId) return failed("STALE_REVISION", "Task Project binding is stale");
  return Object.freeze({ project, task });
}
function sameProject(left: RegisteredProject, right: RegisteredProject): boolean {
  return left.projectId === right.projectId &&
    left.resourceRevision === right.resourceRevision &&
    left.configRevision === right.configRevision &&
    left.rootKey === right.rootKey &&
    left.platform === right.platform &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.mode === right.mode;
}
function revalidateProject(project: RegisteredProject, store: PersistenceStore): ExecutionApplicationFailure | null {
  try {
    revalidateProjectRoot(project, store.layout.root);
    return null;
  } catch (error) {
    return error instanceof ProjectRegistryError
      ? failed("PROJECT_IDENTITY_CHANGED", "Project root identity changed or could not be revalidated")
      : failed("PERSISTENCE_FAILURE", "Project root revalidation failed");
  }
}
function authorization(
  state: ApplicationState,
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  project: RegisteredProject,
  policy: AuthorizationPolicyResult,
): AuthorizationEvaluation {
  return evaluateAuthorization({
    actorId: identity.actor.actorId,
    action,
    target: {
      projectId: project.projectId,
      resourceRevision: project.resourceRevision,
      configRevision: project.configRevision,
    },
    now: identity.now,
    policy,
    confirmed: true,
    grants: state.grants,
  });
}
function requestRecord(
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  executionId: string,
  executionRevision: number,
  result: "allow" | "deny",
): ApplicationRequestRecord {
  return Object.freeze({
    requestId: identity.requestId,
    correlationId: identity.correlationId,
    actorId: identity.actor.actorId,
    action,
    targetKind: "execution",
    targetId: executionId,
    targetRevision: executionRevision,
    result,
    createdAt: identity.now,
  });
}
function decisionRecord(
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  evaluation: AuthorizationEvaluation,
  project: RegisteredProject,
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
    projectId: project.projectId,
    resourceRevision: project.resourceRevision,
    createdAt: identity.now,
  });
}
function auditRecord(
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  executionId: string,
  executionRevision: number,
  evaluation: AuthorizationEvaluation,
): ApplicationAuditRecord {
  return Object.freeze({
    auditId: identity.auditId,
    requestId: identity.requestId,
    decisionId: identity.decisionId,
    eventKind: evaluation.allowed ? applicationAuditKind(action) : "authorization.denied",
    result: evaluation.allowed ? "accepted" : "denied",
    actorId: identity.actor.actorId,
    correlationId: identity.correlationId,
    targetKind: "execution",
    targetId: executionId,
    targetRevision: executionRevision,
    reason: evaluation.allowed ? "accepted" : evaluation.reason,
    createdAt: identity.now,
  });
}
function persistAuthorization(
  transaction: ApplicationTransaction,
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  executionId: string,
  executionRevision: number,
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
  hooks: ExecutionApplicationTestHooks,
): void {
  transaction.insertRequest(requestRecord(
    identity, action, executionId, executionRevision, evaluation.allowed ? "allow" : "deny",
  ));
  hooks.afterStage?.("request");
  transaction.insertDecision(decisionRecord(identity, action, evaluation, project));
  hooks.afterStage?.("decision");
}
function persistAudit(
  transaction: ApplicationTransaction,
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  executionId: string,
  executionRevision: number,
  evaluation: AuthorizationEvaluation,
  hooks: ExecutionApplicationTestHooks,
): void {
  transaction.insertAudit(auditRecord(identity, action, executionId, executionRevision, evaluation));
  hooks.afterStage?.("audit");
}
function view(attempt: ExecutionAttempt, now: string): ExecutionClaimView {
  return Object.freeze({
    executionId: attempt.executionId,
    taskId: attempt.taskId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    ownerId: attempt.ownerId,
    leaseRevision: attempt.leaseRevision,
    leaseExpiresAt: attempt.leaseExpiresAt,
    expired: attempt.leaseExpiresAt <= now,
    fencingToken: attempt.fencingToken,
    revision: attempt.revision,
    taskRevision: attempt.postTaskRevision,
    projectResourceRevision: attempt.projectResourceRevision,
    projectConfigRevision: attempt.projectConfigRevision,
    supersedesExecutionId: attempt.supersedesExecutionId,
    supersededByExecutionId: attempt.supersededByExecutionId,
  });
}
function replay(state: ApplicationState, attempt: ExecutionAttempt, now: string): ExecutionApplicationSuccess<ExecutionClaimView> {
  const request = state.requests.find((candidate) => candidate.requestId === attempt.requestId);
  if (request === undefined) throw new TypeError("Persisted execution request is absent");
  return succeeded(view(attempt, now), request.requestId, request.correlationId);
}
function leaseExpiry(now: string, durationSeconds: number): string {
  return new Date(new Date(now).valueOf() + durationSeconds * 1000).toISOString();
}
function executionProjectMatches(state: ApplicationState, attempt: ExecutionAttempt, projectId: string): boolean {
  return state.domain.tasks.find((candidate) => candidate.id === attempt.taskId)?.projectId === projectId;
}
function requiresReliabilityReconciliation(state: ApplicationState, executionId: string): boolean {
  if (state.executionTerminalStates.some((terminal) => terminal.executionId === executionId)) return false;
  return state.executionIntents.some((intent) => intent.executionId === executionId && intent.state !== "finalized") ||
    state.manualTurns.some((turn) => turn.executionId === executionId);
}
function claimTupleMatches(
  state: ApplicationState,
  attempt: ExecutionAttempt,
  command: ExecutionClaimCommand,
  ownerId: string,
): boolean {
  return attempt.operationKind === "claim" &&
    executionProjectMatches(state, attempt, command.projectId) &&
    attempt.taskId === command.taskId &&
    attempt.expectedTaskRevision === command.expectedTaskRevision &&
    attempt.projectResourceRevision === command.expectedProjectResourceRevision &&
    attempt.projectConfigRevision === command.expectedProjectConfigRevision &&
    attempt.ownerId === ownerId &&
    attempt.requestedLeaseSeconds === command.leaseDurationSeconds &&
    attempt.predecessorExecutionRevision === null &&
    attempt.predecessorLeaseRevision === null &&
    attempt.predecessorFencingToken === null &&
    attempt.supersedesExecutionId === null;
}
function takeoverTupleMatches(
  state: ApplicationState,
  attempt: ExecutionAttempt,
  command: ExecutionTakeoverCommand,
  ownerId: string,
): boolean {
  return attempt.operationKind === "takeover" &&
    executionProjectMatches(state, attempt, command.projectId) &&
    attempt.taskId === command.taskId &&
    attempt.expectedTaskRevision === command.expectedTaskRevision &&
    attempt.projectResourceRevision === command.expectedProjectResourceRevision &&
    attempt.projectConfigRevision === command.expectedProjectConfigRevision &&
    attempt.ownerId === ownerId &&
    attempt.requestedLeaseSeconds === command.leaseDurationSeconds &&
    attempt.predecessorExecutionRevision === command.expectedExecutionRevision &&
    attempt.predecessorLeaseRevision === command.expectedLeaseRevision &&
    attempt.predecessorFencingToken === command.expectedFencingToken &&
    attempt.supersedesExecutionId === command.predecessorExecutionId;
}
function mapPersistenceFailure(error: unknown, identity: ExecutionOperationIdentity | null): ExecutionApplicationFailure {
  if (error instanceof PersistenceError) {
    if (error.code === "REVISION_CONFLICT") {
      return failed("STALE_FENCE", "Execution CAS, owner, lease, Task revision, or fence is stale", identity);
    }
  }
  return failed("PERSISTENCE_FAILURE", "Execution persistence operation failed", identity);
}

function sameRootIdentity(left: ProjectRootIdentity, right: ProjectRootIdentity): boolean {
  return left.rootKey === right.rootKey &&
    left.platform === right.platform &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.mode === right.mode;
}
function validateRuntimeAndActor(
  state: ApplicationState,
  identity: ExecutionOperationIdentity,
  store: PersistenceStore,
): ExecutionApplicationFailure | null {
  if (state.bootstrap === null) {
    return failed("AUTHORIZATION_DENIED", "Authorization bootstrap is absent", identity);
  }
  let current: ProjectRootIdentity;
  try {
    current = inspectTrustedRuntimeRoot(store.layout.root);
  } catch {
    return failed("PROJECT_IDENTITY_CHANGED", "Runtime root identity could not be revalidated", identity);
  }
  if (!sameRootIdentity(state.bootstrap, current)) {
    return failed("AUTHORIZATION_DENIED", "Authorization bootstrap is bound to another runtime root", identity);
  }
  const localIdentityRequired = identity.actor.actorId.startsWith("local-v1:") ||
    identity.actor.actorId === state.identity?.actorId;
  if (localIdentityRequired && (
    state.identity === null ||
    state.identity.actorId !== identity.actor.actorId ||
    state.identity.principalSha256 !== identity.actor.principal ||
    state.identity.platform !== current.platform ||
    state.identity.runtimeRootKey !== current.rootKey
  )) {
    return failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity);
  }
  return null;
}
function executionPolicy(
  state: ApplicationState,
  project: RegisteredProject,
  action: AuthorizationAction,
): AuthorizationPolicyResult {
  if (action === "execution.claim.inspect") return "read_not_applicable";
  return state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true
    ? "allow"
    : "deny";
}
function recordDenied(
  transaction: ApplicationTransaction,
  identity: ExecutionOperationIdentity,
  action: AuthorizationAction,
  executionId: string,
  executionRevision: number,
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
  hooks: ExecutionApplicationTestHooks,
): ExecutionApplicationFailure {
  persistAuthorization(transaction, identity, action, executionId, executionRevision, project, evaluation, hooks);
  persistAudit(transaction, identity, action, executionId, executionRevision, evaluation, hooks);
  return failed("AUTHORIZATION_DENIED", "Current explicit authorization did not permit the execution operation", identity);
}

function createExecutionApplicationServiceInternal(
  store: PersistenceStore,
  ingress: ExecutionIngress,
  hooks: ExecutionApplicationTestHooks,
): ExecutionApplicationService {
  const claim = (value: ExecutionClaimCommand): ExecutionApplicationResult<ExecutionClaimView> => {
    const command = parseClaim(value);
    if (command === null) return failed("INVALID_INPUT", "Execution claim input is invalid");
    const context = trustedContext(ingress);
    if (context === null) return failed("INVALID_INPUT", "Trusted execution claim ingress is invalid");
    let preflight: ApplicationState;
    try {
      preflight = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistenceFailure(error, null);
    }
    const replayed = preflight.executions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
    if (replayed !== undefined) {
      const request = preflight.requests.find((candidate) => candidate.requestId === replayed.requestId);
      return claimTupleMatches(preflight, replayed, command, context.ownerId) && request?.actorId === context.actor.actorId
        ? replay(preflight, replayed, context.now)
        : failed("IDEMPOTENCY_CONFLICT", "Execution idempotency identity is bound to another operation");
    }
    const identity = operationIdentity(context, ingress);
    const executionId = nextExecutionId(ingress);
    if (identity === null || executionId === null) {
      return failed("INVALID_INPUT", "Trusted execution identities could not be obtained", identity);
    }
    const preflightBinding = binding(
      preflight,
      command.projectId,
      command.expectedProjectResourceRevision,
      command.expectedProjectConfigRevision,
      command.taskId,
    );
    if ("ok" in preflightBinding) return Object.freeze({ ...preflightBinding, requestId: identity.requestId, correlationId: identity.correlationId });
    if (preflightBinding.task.revision !== command.expectedTaskRevision) {
      return failed("STALE_REVISION", "Task revision is stale", identity);
    }
    if (preflight.domain.projects.find((project) => project.id === command.projectId)?.enabled !== true) {
      return failed("PROJECT_DISABLED", "Disabled Project cannot offer an execution claim", identity);
    }
    if (preflightBinding.task.state !== "ready" || preflight.executionSequences.some((sequence) => sequence.taskId === command.taskId)) {
      return failed("TASK_NOT_ELIGIBLE", "Task is not eligible for an initial execution claim", identity);
    }
    const runtimeFailure = validateRuntimeAndActor(preflight, identity, store);
    if (runtimeFailure !== null) return runtimeFailure;
    const projectFailure = revalidateProject(preflightBinding.project, store);
    if (projectFailure !== null) return Object.freeze({ ...projectFailure, requestId: identity.requestId, correlationId: identity.correlationId });
    try {
      hooks.beforeTransaction?.();
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const concurrentReplay = state.executions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
        if (concurrentReplay !== undefined) {
          const request = state.requests.find((candidate) => candidate.requestId === concurrentReplay.requestId);
          return claimTupleMatches(state, concurrentReplay, command, context.ownerId) && request?.actorId === context.actor.actorId
            ? replay(state, concurrentReplay, identity.now)
            : failed("IDEMPOTENCY_CONFLICT", "Execution idempotency identity is bound to another operation", identity);
        }
        const current = binding(
          state,
          command.projectId,
          command.expectedProjectResourceRevision,
          command.expectedProjectConfigRevision,
          command.taskId,
        );
        if ("ok" in current) return Object.freeze({ ...current, requestId: identity.requestId, correlationId: identity.correlationId });
        if (!sameProject(current.project, preflightBinding.project)) {
          return failed("PROJECT_IDENTITY_CHANGED", "Project identity changed after trusted preflight", identity);
        }
        if (current.task.revision !== command.expectedTaskRevision) {
          return failed("STALE_REVISION", "Task revision changed after preflight", identity);
        }
        if (state.domain.projects.find((project) => project.id === command.projectId)?.enabled !== true) {
          return failed("PROJECT_DISABLED", "Disabled Project cannot offer an execution claim", identity);
        }
        if (current.task.state !== "ready" || state.executionSequences.some((sequence) => sequence.taskId === command.taskId)) {
          return failed("TASK_NOT_ELIGIBLE", "Task is not eligible for an initial execution claim", identity);
        }
        const transition = transitionTask(state.domain, Object.freeze({
          taskId: command.taskId,
          event: "claim_accepted" as const,
          targetState: "running" as const,
          payload: Object.freeze({
            externalAcceptance: Object.freeze({
              taskId: current.task.id,
              taskRevision: current.task.revision,
              authorization: "accepted" as const,
              reliability: "accepted" as const,
            }),
          }),
        }));
        if (!transition.ok) {
          return transition.error.code === "PROJECT_DISABLED"
            ? failed("PROJECT_DISABLED", "Disabled Project cannot offer an execution claim", identity)
            : failed("TASK_NOT_ELIGIBLE", "Task is not domain-eligible for execution claim", identity);
        }
        const evaluation = authorization(
          state,
          identity,
          command.kind,
          current.project,
          executionPolicy(state, current.project, command.kind),
        );
        if (!evaluation.allowed) {
          return recordDenied(transaction, identity, command.kind, executionId, 1, current.project, evaluation, hooks);
        }
        persistAuthorization(transaction, identity, command.kind, executionId, 1, current.project, evaluation, hooks);
        transaction.insertExecutionSequence(Object.freeze({
          taskId: command.taskId,
          lastAttemptNumber: 1,
          currentFencingToken: 1,
          revision: 1,
        }));
        hooks.afterStage?.("execution-sequence");
        transaction.insertExecutionAttempt(Object.freeze({
          executionId,
          taskId: command.taskId,
          attemptNumber: 1,
          operationKind: "claim" as const,
          status: "active" as const,
          idempotencyKey: command.idempotencyKey,
          ownerId: context.ownerId,
          requestedLeaseSeconds: command.leaseDurationSeconds,
          predecessorExecutionRevision: null,
          predecessorLeaseRevision: null,
          predecessorFencingToken: null,
          leaseRevision: 1,
          leaseExpiresAt: leaseExpiry(identity.now, command.leaseDurationSeconds),
          fencingToken: 1,
          revision: 1,
          expectedTaskRevision: command.expectedTaskRevision,
          preTaskRevision: command.expectedTaskRevision,
          postTaskRevision: command.expectedTaskRevision + 1,
          projectResourceRevision: current.project.resourceRevision,
          projectConfigRevision: current.project.configRevision,
          requestId: identity.requestId,
          decisionId: identity.decisionId,
          supersedesExecutionId: null,
          supersededByExecutionId: null,
          createdAt: identity.now,
          updatedAt: identity.now,
        }));
        hooks.afterStage?.("execution-attempt");
        transaction.writeDomain(state.domain, transition.value);
        hooks.afterStage?.("domain");
        persistAudit(transaction, identity, command.kind, executionId, 1, evaluation, hooks);
        const readback = transaction.read();
        const claimed = readback.executions.find((candidate) => candidate.executionId === executionId);
        const task = taskById(readback, command.taskId);
        if (claimed === undefined || task?.state !== "running" || task.revision !== command.expectedTaskRevision + 1) {
          throw new TypeError("Execution claim terminal readback did not match");
        }
        return succeeded(view(claimed, identity.now), identity.requestId, identity.correlationId);
      });
    } catch (error) {
      return mapPersistenceFailure(error, identity);
    }
  };

  const inspect = (value: ExecutionInspectCommand): ExecutionApplicationResult<ExecutionClaimView> => {
    const command = parseInspect(value);
    if (command === null) return failed("INVALID_INPUT", "Execution inspection input is invalid");
    const context = trustedContext(ingress);
    const identity = context === null ? null : operationIdentity(context, ingress);
    if (context === null || identity === null) {
      return failed("INVALID_INPUT", "Trusted execution inspection ingress is invalid", identity);
    }
    let preflight: ApplicationState;
    try {
      preflight = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistenceFailure(error, identity);
    }
    const attempt = preflight.executions.find((candidate) => candidate.executionId === command.executionId);
    if (attempt === undefined) return failed("EXECUTION_NOT_FOUND", "Execution attempt is not registered", identity);
    const preflightBinding = binding(
      preflight,
      command.projectId,
      command.expectedProjectResourceRevision,
      command.expectedProjectConfigRevision,
      attempt.taskId,
    );
    if ("ok" in preflightBinding) return Object.freeze({ ...preflightBinding, requestId: identity.requestId, correlationId: identity.correlationId });
    if (attempt.revision !== command.expectedExecutionRevision || preflightBinding.task.revision !== command.expectedTaskRevision) {
      return failed("STALE_REVISION", "Execution or Task revision is stale", identity);
    }
    const runtimeFailure = validateRuntimeAndActor(preflight, identity, store);
    if (runtimeFailure !== null) return runtimeFailure;
    const projectFailure = revalidateProject(preflightBinding.project, store);
    if (projectFailure !== null) return Object.freeze({ ...projectFailure, requestId: identity.requestId, correlationId: identity.correlationId });
    try {
      hooks.beforeTransaction?.();
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentAttempt = state.executions.find((candidate) => candidate.executionId === command.executionId);
        if (currentAttempt === undefined) return failed("EXECUTION_NOT_FOUND", "Execution attempt is not registered", identity);
        const current = binding(
          state,
          command.projectId,
          command.expectedProjectResourceRevision,
          command.expectedProjectConfigRevision,
          currentAttempt.taskId,
        );
        if ("ok" in current) return Object.freeze({ ...current, requestId: identity.requestId, correlationId: identity.correlationId });
        if (!sameProject(current.project, preflightBinding.project)) {
          return failed("PROJECT_IDENTITY_CHANGED", "Project identity changed after trusted preflight", identity);
        }
        if (currentAttempt.revision !== command.expectedExecutionRevision || current.task.revision !== command.expectedTaskRevision) {
          return failed("STALE_REVISION", "Execution or Task revision changed after preflight", identity);
        }
        const evaluation = authorization(
          state,
          identity,
          command.kind,
          current.project,
          executionPolicy(state, current.project, command.kind),
        );
        if (!evaluation.allowed) {
          return recordDenied(
            transaction, identity, command.kind, currentAttempt.executionId,
            currentAttempt.revision, current.project, evaluation, hooks,
          );
        }
        persistAuthorization(
          transaction, identity, command.kind, currentAttempt.executionId,
          currentAttempt.revision, current.project, evaluation, hooks,
        );
        persistAudit(
          transaction, identity, command.kind, currentAttempt.executionId,
          currentAttempt.revision, evaluation, hooks,
        );
        const readback = transaction.read().executions.find((candidate) => candidate.executionId === currentAttempt.executionId);
        if (readback === undefined) throw new TypeError("Execution inspection terminal readback is absent");
        return succeeded(view(readback, identity.now), identity.requestId, identity.correlationId);
      });
    } catch (error) {
      return mapPersistenceFailure(error, identity);
    }
  };

  const renew = (value: ExecutionLeaseRenewCommand): ExecutionApplicationResult<ExecutionClaimView> => {
    const command = parseRenew(value);
    if (command === null) return failed("INVALID_INPUT", "Execution lease renewal input is invalid");
    const context = trustedContext(ingress);
    const identity = context === null ? null : operationIdentity(context, ingress);
    if (context === null || identity === null) {
      return failed("INVALID_INPUT", "Trusted execution lease renewal ingress is invalid", identity);
    }
    let preflight: ApplicationState;
    try {
      preflight = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistenceFailure(error, identity);
    }
    const attempt = preflight.executions.find((candidate) => candidate.executionId === command.executionId);
    if (attempt === undefined) return failed("EXECUTION_NOT_FOUND", "Execution attempt is not registered", identity);
    const preflightBinding = binding(
      preflight,
      command.projectId,
      command.expectedProjectResourceRevision,
      command.expectedProjectConfigRevision,
      attempt.taskId,
    );
    if ("ok" in preflightBinding) return Object.freeze({ ...preflightBinding, requestId: identity.requestId, correlationId: identity.correlationId });
    if (
      attempt.revision !== command.expectedExecutionRevision ||
      attempt.leaseRevision !== command.expectedLeaseRevision ||
      attempt.fencingToken !== command.expectedFencingToken ||
      preflightBinding.task.revision !== command.expectedTaskRevision
    ) return failed("STALE_FENCE", "Execution lease, Task revision, or fence is stale", identity);
    if (
      attempt.status !== "active" || attempt.ownerId !== context.ownerId ||
      attempt.leaseExpiresAt <= identity.now || attempt.updatedAt >= identity.now
    ) return failed("STALE_FENCE", "Execution lease is expired, superseded, or not owned by the caller", identity);
    const renewedLeaseExpiresAt = leaseExpiry(identity.now, command.leaseDurationSeconds);
    if (renewedLeaseExpiresAt <= attempt.leaseExpiresAt) {
      return failed("LEASE_NOT_RENEWABLE", "Requested lease would not move expiry forward", identity);
    }
    const runtimeFailure = validateRuntimeAndActor(preflight, identity, store);
    if (runtimeFailure !== null) return runtimeFailure;
    const projectFailure = revalidateProject(preflightBinding.project, store);
    if (projectFailure !== null) return Object.freeze({ ...projectFailure, requestId: identity.requestId, correlationId: identity.correlationId });
    try {
      hooks.beforeTransaction?.();
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentAttempt = state.executions.find((candidate) => candidate.executionId === command.executionId);
        if (currentAttempt === undefined) return failed("EXECUTION_NOT_FOUND", "Execution attempt is not registered", identity);
        const current = binding(
          state,
          command.projectId,
          command.expectedProjectResourceRevision,
          command.expectedProjectConfigRevision,
          currentAttempt.taskId,
        );
        if ("ok" in current) return Object.freeze({ ...current, requestId: identity.requestId, correlationId: identity.correlationId });
        if (!sameProject(current.project, preflightBinding.project)) {
          return failed("PROJECT_IDENTITY_CHANGED", "Project identity changed after trusted preflight", identity);
        }
        if (
          currentAttempt.revision !== command.expectedExecutionRevision ||
          currentAttempt.leaseRevision !== command.expectedLeaseRevision ||
          currentAttempt.fencingToken !== command.expectedFencingToken ||
          current.task.revision !== command.expectedTaskRevision ||
          currentAttempt.status !== "active" || currentAttempt.ownerId !== context.ownerId ||
          currentAttempt.leaseExpiresAt <= identity.now || currentAttempt.updatedAt >= identity.now ||
          renewedLeaseExpiresAt <= currentAttempt.leaseExpiresAt
        ) return failed("STALE_FENCE", "Execution lease CAS, owner, Task revision, or fence changed after preflight", identity);
        const evaluation = authorization(
          state,
          identity,
          command.kind,
          current.project,
          executionPolicy(state, current.project, command.kind),
        );
        if (!evaluation.allowed) {
          return recordDenied(
            transaction, identity, command.kind, currentAttempt.executionId,
            currentAttempt.revision, current.project, evaluation, hooks,
          );
        }
        persistAuthorization(
          transaction, identity, command.kind, currentAttempt.executionId,
          currentAttempt.revision, current.project, evaluation, hooks,
        );
        transaction.renewExecutionLease(
          currentAttempt.executionId,
          context.ownerId,
          command.expectedExecutionRevision,
          command.expectedLeaseRevision,
          command.expectedFencingToken,
          command.expectedTaskRevision,
          identity.now,
          renewedLeaseExpiresAt,
        );
        hooks.afterStage?.("execution-lease");
        persistAudit(
          transaction, identity, command.kind, currentAttempt.executionId,
          currentAttempt.revision, evaluation, hooks,
        );
        const readback = transaction.read().executions.find((candidate) => candidate.executionId === currentAttempt.executionId);
        if (
          readback === undefined || readback.revision !== currentAttempt.revision + 1 ||
          readback.leaseRevision !== currentAttempt.leaseRevision + 1 ||
          readback.fencingToken !== currentAttempt.fencingToken || readback.status !== "active"
        ) throw new TypeError("Execution lease renewal terminal readback did not match");
        return succeeded(view(readback, identity.now), identity.requestId, identity.correlationId);
      });
    } catch (error) {
      return mapPersistenceFailure(error, identity);
    }
  };

  const takeover = (value: ExecutionTakeoverCommand): ExecutionApplicationResult<ExecutionClaimView> => {
    const command = parseTakeover(value);
    if (command === null) return failed("INVALID_INPUT", "Execution takeover input is invalid");
    const context = trustedContext(ingress);
    if (context === null) return failed("INVALID_INPUT", "Trusted execution takeover ingress is invalid");
    let preflight: ApplicationState;
    try {
      preflight = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistenceFailure(error, null);
    }
    const replayed = preflight.executions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
    if (replayed !== undefined) {
      const request = preflight.requests.find((candidate) => candidate.requestId === replayed.requestId);
      return takeoverTupleMatches(preflight, replayed, command, context.ownerId) && request?.actorId === context.actor.actorId
        ? replay(preflight, replayed, context.now)
        : failed("IDEMPOTENCY_CONFLICT", "Execution idempotency identity is bound to another operation");
    }
    const identity = operationIdentity(context, ingress);
    const executionId = nextExecutionId(ingress);
    if (identity === null || executionId === null) {
      return failed("INVALID_INPUT", "Trusted takeover identities could not be obtained", identity);
    }
    const predecessor = preflight.executions.find((candidate) => candidate.executionId === command.predecessorExecutionId);
    if (predecessor === undefined) return failed("EXECUTION_NOT_FOUND", "Predecessor execution attempt is not registered", identity);
    if (predecessor.taskId !== command.taskId) return failed("STALE_REVISION", "Predecessor Task binding is stale", identity);
    const preflightBinding = binding(
      preflight,
      command.projectId,
      command.expectedProjectResourceRevision,
      command.expectedProjectConfigRevision,
      command.taskId,
    );
    if ("ok" in preflightBinding) return Object.freeze({ ...preflightBinding, requestId: identity.requestId, correlationId: identity.correlationId });
    const sequence = preflight.executionSequences.find((candidate) => candidate.taskId === command.taskId);
    if (
      predecessor.revision !== command.expectedExecutionRevision ||
      predecessor.leaseRevision !== command.expectedLeaseRevision ||
      predecessor.fencingToken !== command.expectedFencingToken ||
      preflightBinding.task.revision !== command.expectedTaskRevision ||
      sequence === undefined || sequence.lastAttemptNumber !== predecessor.attemptNumber ||
      sequence.currentFencingToken !== predecessor.fencingToken || sequence.revision !== predecessor.attemptNumber
    ) return failed("STALE_FENCE", "Predecessor execution, Task revision, sequence, or fence is stale", identity);
    if (predecessor.status !== "active") return failed("STALE_FENCE", "Predecessor execution is no longer active", identity);
    if (predecessor.leaseExpiresAt > identity.now) return failed("LEASE_NOT_EXPIRED", "Predecessor execution lease has not expired", identity);
    if (requiresReliabilityReconciliation(preflight, predecessor.executionId)) {
      return failed("RECONCILIATION_REQUIRED", "Effect-capable execution state must reconcile before takeover", identity);
    }
    if (preflightBinding.task.state !== "running") {
      return failed("TASK_NOT_ELIGIBLE", "Only a running Task can be taken over", identity);
    }
    const runtimeFailure = validateRuntimeAndActor(preflight, identity, store);
    if (runtimeFailure !== null) return runtimeFailure;
    const projectFailure = revalidateProject(preflightBinding.project, store);
    if (projectFailure !== null) return Object.freeze({ ...projectFailure, requestId: identity.requestId, correlationId: identity.correlationId });
    try {
      hooks.beforeTransaction?.();
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const concurrentReplay = state.executions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
        if (concurrentReplay !== undefined) {
          const request = state.requests.find((candidate) => candidate.requestId === concurrentReplay.requestId);
          return takeoverTupleMatches(state, concurrentReplay, command, context.ownerId) && request?.actorId === context.actor.actorId
            ? replay(state, concurrentReplay, identity.now)
            : failed("IDEMPOTENCY_CONFLICT", "Execution idempotency identity is bound to another operation", identity);
        }
        const currentAttempt = state.executions.find((candidate) => candidate.executionId === command.predecessorExecutionId);
        if (currentAttempt === undefined) return failed("EXECUTION_NOT_FOUND", "Predecessor execution attempt is not registered", identity);
        const current = binding(
          state,
          command.projectId,
          command.expectedProjectResourceRevision,
          command.expectedProjectConfigRevision,
          command.taskId,
        );
        if ("ok" in current) return Object.freeze({ ...current, requestId: identity.requestId, correlationId: identity.correlationId });
        const currentSequence = state.executionSequences.find((candidate) => candidate.taskId === command.taskId);
        if (!sameProject(current.project, preflightBinding.project)) {
          return failed("PROJECT_IDENTITY_CHANGED", "Project identity changed after trusted preflight", identity);
        }
        if (
          currentAttempt.taskId !== command.taskId ||
          currentAttempt.revision !== command.expectedExecutionRevision ||
          currentAttempt.leaseRevision !== command.expectedLeaseRevision ||
          currentAttempt.fencingToken !== command.expectedFencingToken ||
          current.task.revision !== command.expectedTaskRevision || current.task.state !== "running" ||
          currentAttempt.status !== "active" || currentSequence === undefined ||
          currentSequence.lastAttemptNumber !== currentAttempt.attemptNumber ||
          currentSequence.currentFencingToken !== currentAttempt.fencingToken ||
          currentSequence.revision !== currentAttempt.attemptNumber
        ) return failed("STALE_FENCE", "Predecessor execution, Task, sequence, or fence changed after preflight", identity);
        if (currentAttempt.leaseExpiresAt > identity.now) {
          return failed("LEASE_NOT_EXPIRED", "Predecessor execution lease has not expired", identity);
        }
        if (requiresReliabilityReconciliation(state, currentAttempt.executionId)) {
          return failed("RECONCILIATION_REQUIRED", "Effect-capable execution state must reconcile before takeover", identity);
        }
        const evaluation = authorization(
          state,
          identity,
          command.kind,
          current.project,
          executionPolicy(state, current.project, command.kind),
        );
        if (!evaluation.allowed) {
          return recordDenied(transaction, identity, command.kind, executionId, 1, current.project, evaluation, hooks);
        }
        persistAuthorization(transaction, identity, command.kind, executionId, 1, current.project, evaluation, hooks);
        const advanced = transaction.advanceExecutionSequence(
          command.taskId,
          currentSequence.lastAttemptNumber,
          currentSequence.currentFencingToken,
          currentSequence.revision,
        );
        hooks.afterStage?.("execution-sequence");
        transaction.supersedeExecutionAttempt(
          currentAttempt.executionId,
          executionId,
          currentAttempt.ownerId,
          command.expectedExecutionRevision,
          command.expectedLeaseRevision,
          command.expectedFencingToken,
          command.expectedTaskRevision,
          identity.now,
        );
        hooks.afterStage?.("execution-superseded");
        transaction.insertExecutionAttempt(Object.freeze({
          executionId,
          taskId: command.taskId,
          attemptNumber: advanced.lastAttemptNumber,
          operationKind: "takeover" as const,
          status: "active" as const,
          idempotencyKey: command.idempotencyKey,
          ownerId: context.ownerId,
          requestedLeaseSeconds: command.leaseDurationSeconds,
          predecessorExecutionRevision: command.expectedExecutionRevision,
          predecessorLeaseRevision: command.expectedLeaseRevision,
          predecessorFencingToken: command.expectedFencingToken,
          leaseRevision: 1,
          leaseExpiresAt: leaseExpiry(identity.now, command.leaseDurationSeconds),
          fencingToken: advanced.currentFencingToken,
          revision: 1,
          expectedTaskRevision: command.expectedTaskRevision,
          preTaskRevision: command.expectedTaskRevision,
          postTaskRevision: command.expectedTaskRevision,
          projectResourceRevision: current.project.resourceRevision,
          projectConfigRevision: current.project.configRevision,
          requestId: identity.requestId,
          decisionId: identity.decisionId,
          supersedesExecutionId: currentAttempt.executionId,
          supersededByExecutionId: null,
          createdAt: identity.now,
          updatedAt: identity.now,
        }));
        hooks.afterStage?.("execution-attempt");
        persistAudit(transaction, identity, command.kind, executionId, 1, evaluation, hooks);
        const readback = transaction.read();
        const replacement = readback.executions.find((candidate) => candidate.executionId === executionId);
        const superseded = readback.executions.find((candidate) => candidate.executionId === currentAttempt.executionId);
        const terminalSequence = readback.executionSequences.find((candidate) => candidate.taskId === command.taskId);
        if (
          replacement === undefined || replacement.status !== "active" ||
          replacement.fencingToken !== currentAttempt.fencingToken + 1 ||
          superseded?.status !== "superseded" || superseded.supersededByExecutionId !== executionId ||
          terminalSequence?.currentFencingToken !== replacement.fencingToken
        ) throw new TypeError("Execution takeover terminal readback did not match");
        return succeeded(view(replacement, identity.now), identity.requestId, identity.correlationId);
      });
    } catch (error) {
      return mapPersistenceFailure(error, identity);
    }
  };

  return Object.freeze({ claim, inspect, renew, takeover });
}

export function createExecutionApplicationService(
  store: PersistenceStore,
  ingress: ExecutionIngress,
): ExecutionApplicationService {
  return createExecutionApplicationServiceInternal(store, ingress, Object.freeze({}));
}

export function createExecutionApplicationServiceWithHooks(
  store: PersistenceStore,
  ingress: ExecutionIngress,
  hooks: ExecutionApplicationTestHooks,
): ExecutionApplicationService {
  return createExecutionApplicationServiceInternal(store, ingress, hooks);
}
