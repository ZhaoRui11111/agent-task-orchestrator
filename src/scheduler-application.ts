import {
  evaluateAuthorization,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import type { TrustedActorAssertion } from "./application.ts";
import { validateTrustedRuntimeAndActor } from "./execution-application.ts";
import { revalidateProjectRoot, type ProjectRootIdentity } from "./project-registry.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationState,
  type RegisteredProject,
  type SchedulerAuthorizationDecisionRecord,
  type SchedulerConfigurationRecord,
  type SchedulerEventRecord,
  type SchedulerFinalizationRecord,
  type SchedulerIntentState,
  type SchedulerObservationRecord,
  type SchedulerOperationIntentRecord,
  type SchedulerOperationRequestRecord,
  type SchedulerRegistrationRecord,
  type SchedulerRegistrationStatus,
  type SchedulerVerifiedReceiptRecord,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import {
  schedulerConfigurationSha256,
  schedulerReceiptSha256,
} from "./persistence/scheduler-receipt-digest.ts";
import { canonicalJson, isCanonicalUtcTimestamp, sha256 } from "./persistence/values.ts";
import {
  SCHEDULER_CONTRACT_ID,
  invokeSchedulerBackend,
  type SchedulerBackend,
  type SchedulerBackendRequest,
  type SchedulerBackendResult,
  type SchedulerExternalState,
  type SchedulerReceiptCode,
  type SchedulerReceiptOutcome,
  type SchedulerScope,
} from "./scheduler-port.ts";

export const SCHEDULER_APPLICATION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "PROJECT_NOT_FOUND",
  "PROJECT_DISABLED",
  "PROJECT_IDENTITY_CHANGED",
  "SCHEDULE_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "STALE_REVISION",
  "INVALID_STATE",
  "RECONCILIATION_REQUIRED",
  "BACKEND_FAILURE",
  "PERSISTENCE_FAILURE",
] as const);

export type SchedulerApplicationErrorCode = (typeof SCHEDULER_APPLICATION_ERROR_CODES)[number];
export interface SchedulerApplicationError {
  readonly code: SchedulerApplicationErrorCode;
  readonly message: string;
}
export interface SchedulerApplicationSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly requestId: string;
  readonly correlationId: string;
  readonly replayed: boolean;
}
export interface SchedulerApplicationFailure {
  readonly ok: false;
  readonly error: SchedulerApplicationError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}
export type SchedulerApplicationResult<T> = SchedulerApplicationSuccess<T> | SchedulerApplicationFailure;

export type SchedulerIngressIdKind =
  | "request"
  | "correlation"
  | "decision"
  | "event"
  | "operation"
  | "intent"
  | "observation"
  | "verified_receipt"
  | "finalization";

export interface SchedulerConfirmationRequest {
  readonly actorId: string;
  readonly action: "scheduler.register" | "scheduler.remove";
  readonly requestId: string;
  readonly correlationId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
}

export interface SchedulerIngress {
  currentActor(): TrustedActorAssertion;
  now(): string;
  nextId(kind: SchedulerIngressIdKind): string;
  confirmHighRisk(request: SchedulerConfirmationRequest): boolean;
}

export interface SchedulerApplicationOptions {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly operationDeadlineSeconds?: number;
}

interface SchedulerCommandBase {
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly scope: SchedulerScope;
}

export interface SchedulerRegisterCommand extends SchedulerCommandBase {
  readonly kind: "scheduler.register";
  readonly scheduleExpression: string;
  readonly timeZone: string;
  readonly dispatcherTarget: string;
  readonly idempotencyKey: string;
}

export interface SchedulerInspectCommand extends SchedulerCommandBase {
  readonly kind: "scheduler.inspect";
  readonly expectedRegistrationRevision: number;
}

export interface SchedulerRemoveCommand extends SchedulerCommandBase {
  readonly kind: "scheduler.remove";
  readonly expectedRegistrationRevision: number;
  readonly idempotencyKey: string;
}

export interface SchedulerReconcileCommand {
  readonly kind: "scheduler.reconcile";
  readonly intentId: string;
  readonly expectedIntentRevision: number;
}

type SchedulerMutationCommand = SchedulerRegisterCommand | SchedulerRemoveCommand;

export interface SchedulerRegistrationView {
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly revision: number;
  readonly status: SchedulerRegistrationStatus;
  readonly externalRegistrationId: string | null;
  readonly enabled: boolean | null;
  readonly nextTriggerAt: string | null;
}

export interface SchedulerOperationView {
  readonly operationId: string;
  readonly intentId: string | null;
  readonly operation: "register" | "inspect" | "remove" | "reconcile";
  readonly state: SchedulerIntentState | "inspected" | "denied";
  readonly outcome: SchedulerFinalizationRecord["outcome"] | SchedulerReceiptOutcome | null;
  readonly code: string | null;
  readonly observationNumber: number;
  readonly registration: SchedulerRegistrationView;
}

export interface SchedulerApplicationService {
  register(command: SchedulerRegisterCommand): SchedulerApplicationResult<SchedulerOperationView>;
  inspect(command: SchedulerInspectCommand): SchedulerApplicationResult<SchedulerOperationView>;
  remove(command: SchedulerRemoveCommand): SchedulerApplicationResult<SchedulerOperationView>;
  reconcile(command: SchedulerReconcileCommand): SchedulerApplicationResult<SchedulerOperationView>;
}

export interface SchedulerApplicationTestHooks {
  afterStage?(stage: string): void;
}

type UnknownRecord = Readonly<Record<string, unknown>>;
interface TrustedContext {
  readonly actor: TrustedActorAssertion;
  readonly now: string;
}
interface PrepareIdentity extends TrustedContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly eventId: string;
  readonly operationId: string;
  readonly intentId: string;
}
interface PhaseIdentity extends TrustedContext {
  readonly decisionId: string;
  readonly eventId: string;
  readonly observationId?: string;
  readonly verifiedReceiptId?: string;
  readonly finalizationId?: string;
}

function exactRecord(value: unknown, keys: readonly string[]): UnknownRecord | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const expected = new Set(keys);
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
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

function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.normalize("NFC") && !/[\p{Cc}\p{Cf}]/u.test(value);
}
function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  return record !== null && identifier(record.actorId) && typeof record.principal === "string" &&
    /^[0-9A-F]{64}$/u.test(record.principal)
    ? Object.freeze({ actorId: record.actorId, principal: record.principal }) : null;
}
function parseScope(value: unknown): SchedulerScope | null {
  const record = exactRecord(value, ["kind", "projectId", "projectResourceRevision", "projectConfigRevision"]);
  if (record === null || (record.kind !== "runtime" && record.kind !== "project")) return null;
  if (record.kind === "runtime") {
    if (record.projectId !== null || record.projectResourceRevision !== null || record.projectConfigRevision !== null) return null;
  } else if (!identifier(record.projectId) || !revision(record.projectResourceRevision) || !revision(record.projectConfigRevision)) {
    return null;
  }
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId as string | null,
    projectResourceRevision: record.projectResourceRevision as number | null,
    projectConfigRevision: record.projectConfigRevision as number | null,
  });
}

function parseRegister(value: unknown): SchedulerRegisterCommand | null {
  const record = exactRecord(value, [
    "kind", "scheduleId", "configRevision", "scope", "scheduleExpression",
    "timeZone", "dispatcherTarget", "idempotencyKey",
  ]);
  const scope = record === null ? null : parseScope(record.scope);
  if (
    record === null || record.kind !== "scheduler.register" || !identifier(record.scheduleId) ||
    !revision(record.configRevision) || scope === null || !boundedText(record.scheduleExpression, 256) ||
    !boundedText(record.timeZone, 128) || !identifier(record.dispatcherTarget) || !identifier(record.idempotencyKey)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    scheduleId: record.scheduleId,
    configRevision: record.configRevision,
    scope,
    scheduleExpression: record.scheduleExpression,
    timeZone: record.timeZone,
    dispatcherTarget: record.dispatcherTarget,
    idempotencyKey: record.idempotencyKey,
  });
}

function parseInspect(value: unknown): SchedulerInspectCommand | null {
  const record = exactRecord(value, ["kind", "scheduleId", "configRevision", "scope", "expectedRegistrationRevision"]);
  const scope = record === null ? null : parseScope(record.scope);
  if (
    record === null || record.kind !== "scheduler.inspect" || !identifier(record.scheduleId) ||
    !revision(record.configRevision) || scope === null || !revision(record.expectedRegistrationRevision)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    scheduleId: record.scheduleId,
    configRevision: record.configRevision,
    scope,
    expectedRegistrationRevision: record.expectedRegistrationRevision,
  });
}

function parseRemove(value: unknown): SchedulerRemoveCommand | null {
  const record = exactRecord(value, [
    "kind", "scheduleId", "configRevision", "scope", "expectedRegistrationRevision", "idempotencyKey",
  ]);
  const scope = record === null ? null : parseScope(record.scope);
  if (
    record === null || record.kind !== "scheduler.remove" || !identifier(record.scheduleId) ||
    !revision(record.configRevision) || scope === null || !revision(record.expectedRegistrationRevision) ||
    !identifier(record.idempotencyKey)
  ) return null;
  return Object.freeze({
    kind: record.kind,
    scheduleId: record.scheduleId,
    configRevision: record.configRevision,
    scope,
    expectedRegistrationRevision: record.expectedRegistrationRevision,
    idempotencyKey: record.idempotencyKey,
  });
}

function parseReconcile(value: unknown): SchedulerReconcileCommand | null {
  const record = exactRecord(value, ["kind", "intentId", "expectedIntentRevision"]);
  return record !== null && record.kind === "scheduler.reconcile" && identifier(record.intentId) &&
    revision(record.expectedIntentRevision)
    ? Object.freeze({ kind: record.kind, intentId: record.intentId, expectedIntentRevision: record.expectedIntentRevision })
    : null;
}

function context(ingress: SchedulerIngress): TrustedContext | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const now = ingress.now();
    return actor !== null && isCanonicalUtcTimestamp(now) ? Object.freeze({ actor, now }) : null;
  } catch {
    return null;
  }
}
function laterTimestamp(previous: string, candidate: string): string {
  return candidate > previous ? candidate : new Date(Date.parse(previous) + 1).toISOString();
}
function nextId(ingress: SchedulerIngress, kind: SchedulerIngressIdKind): string | null {
  try {
    const value = ingress.nextId(kind);
    return identifier(value) ? value : null;
  } catch {
    return null;
  }
}
function prepareIdentity(ingress: SchedulerIngress): PrepareIdentity | null {
  const trusted = context(ingress);
  if (trusted === null) return null;
  const requestId = nextId(ingress, "request");
  const correlationId = nextId(ingress, "correlation");
  const decisionId = nextId(ingress, "decision");
  const eventId = nextId(ingress, "event");
  const operationId = nextId(ingress, "operation");
  const intentId = nextId(ingress, "intent");
  const ids = [requestId, correlationId, decisionId, eventId, operationId, intentId];
  return ids.every((value) => value !== null) && new Set(ids).size === ids.length
    ? Object.freeze({ ...trusted, requestId: requestId!, correlationId: correlationId!, decisionId: decisionId!, eventId: eventId!, operationId: operationId!, intentId: intentId! })
    : null;
}
function phaseIdentity(
  ingress: SchedulerIngress,
  actor: TrustedActorAssertion,
  previousTime: string,
  kinds: readonly ("observation" | "verified_receipt" | "finalization")[] = [],
): PhaseIdentity | null {
  const trusted = context(ingress);
  if (trusted === null || trusted.actor.actorId !== actor.actorId || trusted.actor.principal !== actor.principal) return null;
  const decisionId = nextId(ingress, "decision");
  const eventId = nextId(ingress, "event");
  const extra = kinds.map((kind) => nextId(ingress, kind));
  const ids = [decisionId, eventId, ...extra];
  if (ids.some((value) => value === null) || new Set(ids).size !== ids.length) return null;
  const result: {
    actor: TrustedActorAssertion;
    now: string;
    decisionId: string;
    eventId: string;
    observationId?: string;
    verifiedReceiptId?: string;
    finalizationId?: string;
  } = {
    actor,
    now: laterTimestamp(previousTime, trusted.now),
    decisionId: decisionId!,
    eventId: eventId!,
  };
  for (const [index, kind] of kinds.entries()) {
    if (kind === "observation") result.observationId = extra[index]!;
    if (kind === "verified_receipt") result.verifiedReceiptId = extra[index]!;
    if (kind === "finalization") result.finalizationId = extra[index]!;
  }
  return Object.freeze(result);
}

function failed(
  code: SchedulerApplicationErrorCode,
  message: string,
  identity: Readonly<{ requestId: string; correlationId: string }> | null = null,
): SchedulerApplicationFailure {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ code, message }),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}
function succeeded<T>(
  value: T,
  requestId: string,
  correlationId: string,
  replayed = false,
): SchedulerApplicationSuccess<T> {
  return Object.freeze({ ok: true as const, value, requestId, correlationId, replayed });
}
function mapPersistence(error: unknown): SchedulerApplicationFailure {
  if (error instanceof PersistenceError) {
    return error.code === "REVISION_CONFLICT"
      ? failed("STALE_REVISION", "Scheduler persistence revision changed")
      : failed("PERSISTENCE_FAILURE", "Scheduler persistence operation failed");
  }
  return failed("PERSISTENCE_FAILURE", "Scheduler persistence operation failed");
}
function stableId(prefix: string, value: unknown): string {
  return `${prefix}:${sha256(canonicalJson(value)).slice(0, 64)}`;
}
function commandSha256(command: SchedulerRegisterCommand | SchedulerInspectCommand | SchedulerRemoveCommand): string {
  return sha256(canonicalJson(command));
}
function operationDeadline(now: string, seconds: number): string {
  return new Date(Date.parse(now) + seconds * 1000).toISOString();
}
function scopeMatches(left: SchedulerScope, right: SchedulerScope): boolean {
  return left.kind === right.kind && left.projectId === right.projectId &&
    left.projectResourceRevision === right.projectResourceRevision &&
    left.projectConfigRevision === right.projectConfigRevision;
}
function requestScope(request: SchedulerOperationRequestRecord): SchedulerScope {
  return Object.freeze({
    kind: request.scopeKind,
    projectId: request.projectId,
    projectResourceRevision: request.projectResourceRevision,
    projectConfigRevision: request.projectConfigRevision,
  });
}
function registrationView(registration: SchedulerRegistrationRecord): SchedulerRegistrationView {
  return Object.freeze({
    scheduleId: registration.scheduleId,
    configRevision: registration.configRevision,
    revision: registration.revision,
    status: registration.status,
    externalRegistrationId: registration.externalRegistrationId,
    enabled: registration.enabled,
    nextTriggerAt: registration.nextTriggerAt,
  });
}
function operationView(
  state: ApplicationState,
  request: SchedulerOperationRequestRecord,
  intent: SchedulerOperationIntentRecord | null,
  operation: SchedulerOperationView["operation"] = request.operation,
): SchedulerOperationView {
  const registration = state.schedulerRegistrations.find((candidate) =>
    candidate.scheduleId === request.scheduleId && candidate.configRevision === request.configRevision);
  if (registration === undefined) throw new TypeError("Scheduler registration readback is absent");
  const observations = intent === null
    ? state.schedulerObservations.filter((candidate) => candidate.requestId === request.requestId)
    : state.schedulerObservations.filter((candidate) => candidate.intentId === intent.intentId);
  const latest = observations.sort((left, right) => left.observationNumber - right.observationNumber).at(-1) ?? null;
  const finalization = intent === null ? null : state.schedulerFinalizations.find((candidate) => candidate.intentId === intent.intentId) ?? null;
  return Object.freeze({
    operationId: request.operationId,
    intentId: intent?.intentId ?? null,
    operation,
    state: intent?.state ?? "inspected",
    outcome: finalization?.outcome ?? latest?.outcome ?? null,
    code: finalization?.code ?? latest?.code ?? null,
    observationNumber: latest?.observationNumber ?? 0,
    registration: registrationView(registration),
  });
}
function binding(
  state: ApplicationState,
  scope: SchedulerScope,
): RegisteredProject | null | SchedulerApplicationFailure {
  if (scope.kind === "runtime") return null;
  const project = state.projects.find((candidate) => candidate.projectId === scope.projectId);
  if (project === undefined) return failed("PROJECT_NOT_FOUND", "Scheduler Project is not registered");
  if (project.resourceRevision !== scope.projectResourceRevision || project.configRevision !== scope.projectConfigRevision) {
    return failed("STALE_REVISION", "Scheduler Project binding is stale");
  }
  if (state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled !== true) {
    return failed("PROJECT_DISABLED", "Disabled Project cannot own a schedule");
  }
  return project;
}
function validatePhysicalBinding(
  project: RegisteredProject | null,
  runtimeRoot: string,
): SchedulerApplicationFailure | null {
  if (project === null) return null;
  try {
    const current = revalidateProjectRoot(project, runtimeRoot);
    return current.rootKey === project.rootKey && current.device === project.device &&
      current.inode === project.inode && current.mode === project.mode
      ? null : failed("PROJECT_IDENTITY_CHANGED", "Scheduler Project root identity changed");
  } catch {
    return failed("PROJECT_IDENTITY_CHANGED", "Scheduler Project root could not be revalidated");
  }
}
function sameProjectIdentity(left: RegisteredProject, right: ProjectRootIdentity): boolean {
  return left.canonicalRoot === right.canonicalRoot && left.rootKey === right.rootKey &&
    left.platform === right.platform && left.device === right.device && left.inode === right.inode &&
    left.mode === right.mode;
}
function runtimeFailure(
  state: ApplicationState,
  actor: TrustedActorAssertion,
  store: PersistenceStore,
): SchedulerApplicationFailure | null {
  const validation = validateTrustedRuntimeAndActor(state, actor, store);
  if (validation.ok) return null;
  return validation.reason === "runtime_root_unavailable"
    ? failed("PROJECT_IDENTITY_CHANGED", "Trusted runtime root could not be revalidated")
    : failed("AUTHORIZATION_DENIED", "Trusted scheduler actor or runtime binding is not current");
}
function persistedRuntimeFailure(state: ApplicationState, actor: TrustedActorAssertion): SchedulerApplicationFailure | null {
  return state.identity === null || state.identity.actorId !== actor.actorId || state.identity.principalSha256 !== actor.principal
    ? failed("AUTHORIZATION_DENIED", "Persisted scheduler actor binding changed") : null;
}
function policyFor(state: ApplicationState, scope: SchedulerScope): AuthorizationPolicyResult {
  return scope.kind === "runtime" || state.domain.projects.find((candidate) => candidate.id === scope.projectId)?.enabled === true
    ? "allow" : "deny";
}
function evaluate(
  state: ApplicationState,
  actor: TrustedActorAssertion,
  action: SchedulerAuthorizationDecisionRecord["action"],
  scope: SchedulerScope,
  now: string,
  confirmed: boolean,
): AuthorizationEvaluation {
  return evaluateAuthorization({
    actorId: actor.actorId,
    action,
    target: {
      projectId: scope.projectId,
      resourceRevision: scope.projectResourceRevision,
      configRevision: scope.projectConfigRevision,
    },
    now,
    policy: policyFor(state, scope),
    confirmed,
    grants: state.grants,
  });
}
function decisionRecord(
  decisionId: string,
  request: SchedulerOperationRequestRecord,
  stage: SchedulerAuthorizationDecisionRecord["stage"],
  evaluation: AuthorizationEvaluation,
  createdAt: string,
): SchedulerAuthorizationDecisionRecord {
  const action = request.operation === "register"
    ? "scheduler.register" as const
    : request.operation === "inspect"
      ? "scheduler.inspect" as const
      : "scheduler.remove" as const;
  return Object.freeze({
    decisionId,
    requestId: request.requestId,
    stage,
    actorId: request.actorId,
    action,
    result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason,
    policy: evaluation.policy,
    grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision,
    projectId: request.projectId,
    projectResourceRevision: request.projectResourceRevision,
    projectConfigRevision: request.projectConfigRevision,
    createdAt,
  });
}
function eventRecord(
  eventId: string,
  request: SchedulerOperationRequestRecord,
  intentId: string | null,
  eventKind: SchedulerEventRecord["eventKind"],
  outcome: SchedulerEventRecord["outcome"],
  reasonCode: string,
  observationNumber: number | null,
  evidenceReference: string | null,
  createdAt: string,
): SchedulerEventRecord {
  return Object.freeze({
    eventId,
    operationId: request.operationId,
    requestId: request.requestId,
    intentId,
    eventKind,
    outcome,
    reasonCode,
    actorId: request.actorId,
    correlationId: request.correlationId,
    scheduleId: request.scheduleId,
    configRevision: request.configRevision,
    observationNumber,
    evidenceReference,
    createdAt,
  });
}
function schedulerRequest(
  identity: PrepareIdentity,
  command: SchedulerMutationCommand,
  idempotencyKey: string,
  allowed: boolean,
  externalRegistrationId: string | null,
): SchedulerOperationRequestRecord {
  return Object.freeze({
    requestId: identity.requestId,
    operationId: identity.operationId,
    idempotencyKey,
    commandSha256: commandSha256(command),
    operation: command.kind === "scheduler.register" ? "register" as const : "remove" as const,
    actorId: identity.actor.actorId,
    correlationId: identity.correlationId,
    scheduleId: command.scheduleId,
    configRevision: command.configRevision,
    externalRegistrationId,
    scopeKind: command.scope.kind,
    projectId: command.scope.projectId,
    projectResourceRevision: command.scope.projectResourceRevision,
    projectConfigRevision: command.scope.projectConfigRevision,
    result: allowed ? "allow" as const : "deny" as const,
    createdAt: identity.now,
  });
}

function observationFromResult(
  result: SchedulerBackendResult,
  request: SchedulerOperationRequestRecord,
  intentId: string | null,
  observationId: string,
  observationNumber: number,
  observedAt: string,
  fallbackRegistration: SchedulerRegistrationRecord,
): SchedulerObservationRecord {
  const receipt = result.ok ? result.receipt : null;
  const failure = result.ok ? null : result.error;
  const ambiguous = receipt?.outcome === "ambiguous" || failure?.ambiguous === true;
  const externalState: SchedulerExternalState = receipt?.externalState ?? (ambiguous
    ? "ambiguous"
    : request.operation === "register" ? "absent" : fallbackRegistration.status === "removed" ? "absent" : "present");
  const outcome: SchedulerReceiptOutcome = receipt?.outcome ?? (ambiguous ? "ambiguous" : "refused");
  const code = receipt?.code ?? failure!.category;
  const receiptId = receipt?.receiptId ?? null;
  const preserveFallback = request.operation !== "register" &&
    (receipt === null || externalState === "ambiguous");
  const externalRegistrationId = request.operation !== "register" && request.externalRegistrationId !== null
    ? request.externalRegistrationId
    : receipt?.externalRegistrationId ?? (
      preserveFallback || externalState === "present" ? fallbackRegistration.externalRegistrationId : null);
  const enabled = receipt?.enabled ?? (
    preserveFallback || externalState === "present" ? fallbackRegistration.enabled : null);
  const nextTriggerAt = receipt?.nextTriggerAt ?? (
    preserveFallback || externalState === "present" ? fallbackRegistration.nextTriggerAt : null);
  const evidenceReference = receipt?.evidenceReference ?? failure?.evidenceReference ?? null;
  const projection = Object.freeze({
    requestId: request.requestId,
    intentId,
    observationNumber,
    operation: request.operation,
    operationId: request.operationId,
    scheduleId: request.scheduleId,
    configRevision: request.configRevision,
    externalState,
    externalRegistrationId,
    enabled,
    nextTriggerAt,
    outcome,
    code,
    receiptId,
    evidenceReference,
    observedAt,
  });
  return Object.freeze({
    observationId,
    ...projection,
    receiptSha256: schedulerReceiptSha256(projection),
  });
}

function backendRequest(
  request: SchedulerOperationRequestRecord,
  configuration: SchedulerConfigurationRecord,
): SchedulerBackendRequest {
  const scope = requestScope(request);
  return request.operation === "register"
    ? Object.freeze({
      contractId: SCHEDULER_CONTRACT_ID,
      operation: "register" as const,
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey!,
      correlationId: request.correlationId,
      scheduleId: request.scheduleId,
      configRevision: request.configRevision,
      scope,
      scheduleExpression: configuration.scheduleExpression,
      timeZone: configuration.timeZone,
      dispatcherTarget: configuration.dispatcherTarget,
    })
    : Object.freeze({
      contractId: SCHEDULER_CONTRACT_ID,
      operation: "remove" as const,
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey!,
      correlationId: request.correlationId,
      scheduleId: request.scheduleId,
      configRevision: request.configRevision,
      scope,
      externalRegistrationId: request.externalRegistrationId!,
    });
}

function inspectBackendRequest(
  request: SchedulerOperationRequestRecord,
): SchedulerBackendRequest {
  return Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "inspect" as const,
    operationId: request.operationId,
    correlationId: request.correlationId,
    scheduleId: request.scheduleId,
    configRevision: request.configRevision,
    scope: requestScope(request),
    externalRegistrationId: request.externalRegistrationId,
  });
}

function outcomeFailure(
  observation: SchedulerObservationRecord,
  identity: Readonly<{ requestId: string; correlationId: string }>,
): SchedulerApplicationFailure {
  return observation.outcome === "ambiguous"
    ? failed("RECONCILIATION_REQUIRED", "Scheduler external state remains ambiguous", identity)
    : failed("BACKEND_FAILURE", "Scheduler backend did not complete the requested mutation", identity);
}

export function createSchedulerApplicationServiceWithHooks(
  store: PersistenceStore,
  ingress: SchedulerIngress,
  backend: SchedulerBackend,
  options: SchedulerApplicationOptions,
  hooks: SchedulerApplicationTestHooks,
): SchedulerApplicationService {
  if (!identifier(options.adapterId) || !identifier(options.adapterVersion)) {
    throw new TypeError("Scheduler adapter identity is invalid");
  }
  const deadlineSeconds = options.operationDeadlineSeconds ?? 86400;
  if (!Number.isSafeInteger(deadlineSeconds) || deadlineSeconds < 60 || deadlineSeconds > 604800) {
    throw new TypeError("Scheduler operation deadline policy is invalid");
  }

  const finalView = (
    requestId: string,
    replayed: boolean,
  ): SchedulerApplicationResult<SchedulerOperationView> => {
    try {
      const state = readApplicationStateForOwner(store);
      const request = state.schedulerOperationRequests.find((candidate) => candidate.requestId === requestId);
      const intent = state.schedulerIntents.find((candidate) => candidate.requestId === requestId) ?? null;
      if (request === undefined || intent === null) return failed("PERSISTENCE_FAILURE", "Scheduler terminal readback is absent");
      const view = operationView(state, request, intent);
      const finalization = state.schedulerFinalizations.find((candidate) => candidate.intentId === intent.intentId);
      const authorizationDecision = finalization === undefined ? undefined : state.schedulerAuthorizationDecisions.find((candidate) =>
        candidate.decisionId === finalization.authorizationDecisionId);
      return finalization?.outcome === "registered" || finalization?.outcome === "removed"
        ? succeeded(view, request.requestId, request.correlationId, replayed)
        : finalization !== undefined && authorizationDecision?.result === "deny"
          ? failed("AUTHORIZATION_DENIED", "Final scheduler authorization did not allow adapter access", request)
        : finalization === undefined && intent.state === "ambiguous"
          ? failed("RECONCILIATION_REQUIRED", "Scheduler operation requires reconciliation", request)
          : failed("BACKEND_FAILURE", "Scheduler operation reached a non-success terminal outcome", request);
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const finalizeVerified = (
    request: SchedulerOperationRequestRecord,
    intent: SchedulerOperationIntentRecord,
    receipt: SchedulerVerifiedReceiptRecord,
    actor: TrustedActorAssertion,
    replayed: boolean,
  ): SchedulerApplicationResult<SchedulerOperationView> => {
    const phase = phaseIdentity(ingress, actor, receipt.verifiedAt, ["finalization"]);
    if (phase === null || phase.finalizationId === undefined) return failed("INVALID_INPUT", "Trusted scheduler finalization identity is invalid", request);
    try {
      withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentIntent = state.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
        const registration = state.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
        const actDecision = state.schedulerAuthorizationDecisions.find((candidate) =>
          candidate.requestId === request.requestId && candidate.stage === "act" && candidate.result === "allow");
        if (currentIntent === undefined || currentIntent.state !== "verified" || registration === undefined || actDecision === undefined) {
          throw new PersistenceError("REVISION_CONFLICT", "Scheduler finalization tuple changed");
        }
        const registered = intent.operation === "register" && receipt.externalState === "present";
        const removed = intent.operation === "remove" && receipt.externalState === "absent";
        const success = registered || removed;
        const nextStatus: SchedulerRegistrationStatus = registered
          ? "active"
          : removed
            ? "removed"
            : receipt.externalState === "ambiguous"
              ? "ambiguous"
              : intent.operation === "register" ? "removed" : "active";
        const finalOutcome: SchedulerFinalizationRecord["outcome"] = registered
          ? "registered" : removed ? "removed" : "failed";
        transaction.advanceSchedulerRegistration(
          registration.scheduleId,
          registration.configRevision,
          registration.revision,
          registration.status,
          nextStatus,
          nextStatus === "active" ? receipt.externalRegistrationId : nextStatus === "ambiguous" ? receipt.externalRegistrationId : null,
          nextStatus === "active" ? receipt.enabled : nextStatus === "ambiguous" ? receipt.enabled : null,
          nextStatus === "active" || nextStatus === "ambiguous" ? receipt.nextTriggerAt : null,
          intent.intentId,
          phase.now,
        );
        transaction.insertSchedulerFinalization(Object.freeze({
          finalizationId: phase.finalizationId!,
          intentId: intent.intentId,
          verifiedReceiptId: receipt.verifiedReceiptId,
          authorizationDecisionId: actDecision.decisionId,
          outcome: finalOutcome,
          code: receipt.code,
          resultingRegistrationStatus: nextStatus,
          resultingRegistrationRevision: registration.revision + 1,
          finalizedAt: phase.now,
        }));
        transaction.advanceSchedulerIntent(intent.intentId, currentIntent.revision, "verified", "finalized", phase.now);
        transaction.insertSchedulerEvent(eventRecord(
          phase.eventId, request, intent.intentId, "scheduler.operation.finalized",
          success ? "accepted" : "failed", receipt.code, null, null, phase.now,
        ));
      });
      hooks.afterStage?.("finalized");
      return finalView(request.requestId, replayed);
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const verifyObserved = (
    request: SchedulerOperationRequestRecord,
    intent: SchedulerOperationIntentRecord,
    observation: SchedulerObservationRecord,
    actor: TrustedActorAssertion,
    replayed: boolean,
  ): SchedulerApplicationResult<SchedulerOperationView> => {
    if (observation.receiptId === null || observation.outcome !== "succeeded") {
      return outcomeFailure(observation, request);
    }
    const phase = phaseIdentity(
      ingress,
      actor,
      intent.updatedAt,
      ["verified_receipt"],
    );
    if (phase === null || phase.verifiedReceiptId === undefined) return failed("INVALID_INPUT", "Trusted scheduler receipt identity is invalid", request);
    const receipt: SchedulerVerifiedReceiptRecord = Object.freeze({
      verifiedReceiptId: phase.verifiedReceiptId,
      intentId: intent.intentId,
      observationId: observation.observationId,
      receiptId: observation.receiptId,
      receiptSha256: observation.receiptSha256,
      externalState: observation.externalState,
      externalRegistrationId: observation.externalRegistrationId,
      enabled: observation.enabled,
      nextTriggerAt: observation.nextTriggerAt,
      code: observation.code as SchedulerReceiptCode,
      verifiedAt: phase.now,
    });
    try {
      withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentIntent = state.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
        const currentObservation = state.schedulerObservations.find((candidate) => candidate.observationId === observation.observationId);
        if (currentIntent === undefined || currentIntent.state !== "observed" ||
          currentObservation?.receiptSha256 !== observation.receiptSha256) {
          throw new PersistenceError("REVISION_CONFLICT", "Scheduler observation changed before verification");
        }
        transaction.insertSchedulerReceipt(receipt);
        transaction.advanceSchedulerIntent(intent.intentId, currentIntent.revision, "observed", "verified", phase.now);
        transaction.insertSchedulerEvent(eventRecord(
          phase.eventId, request, intent.intentId, "scheduler.operation.verified",
          "accepted", observation.code, observation.observationNumber,
          observation.evidenceReference, phase.now,
        ));
      });
      hooks.afterStage?.("verified");
      return finalizeVerified(request, { ...intent, state: "verified", revision: intent.revision + 1, updatedAt: phase.now }, receipt, actor, replayed);
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const settleBackendResult = (
    request: SchedulerOperationRequestRecord,
    intent: SchedulerOperationIntentRecord,
    actor: TrustedActorAssertion,
    result: SchedulerBackendResult,
    replayed: boolean,
  ): SchedulerApplicationResult<SchedulerOperationView> => {
    const currentState = readApplicationStateForOwner(store);
    const registration = currentState.schedulerRegistrations.find((candidate) =>
      candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
    if (registration === undefined) return failed("PERSISTENCE_FAILURE", "Scheduler registration is absent", request);
    const previousObservationCount = currentState.schedulerObservations.filter((candidate) => candidate.intentId === intent.intentId).length;
    const phase = phaseIdentity(ingress, actor, intent.updatedAt, ["observation", "finalization"]);
    if (phase === null || phase.observationId === undefined || phase.finalizationId === undefined) {
      return failed("INVALID_INPUT", "Trusted scheduler observation identity is invalid", request);
    }
    const observation = observationFromResult(
      result, request, intent.intentId, phase.observationId, previousObservationCount + 1,
      result.ok ? result.receipt.observedAt : phase.now, registration,
    );
    const terminalState: Extract<SchedulerIntentState, "ambiguous" | "failed"> = observation.outcome === "ambiguous" ? "ambiguous" : "failed";
    try {
      withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentIntent = state.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
        const currentRegistration = state.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
        const actDecision = state.schedulerAuthorizationDecisions.find((candidate) =>
          candidate.requestId === request.requestId && candidate.stage === "act" && candidate.result === "allow");
        if (currentIntent === undefined || currentIntent.state !== "executing" || currentRegistration === undefined || actDecision === undefined) {
          throw new PersistenceError("REVISION_CONFLICT", "Scheduler observation tuple changed");
        }
        transaction.insertSchedulerObservation(observation);
        if (observation.outcome === "succeeded") {
          transaction.advanceSchedulerIntent(intent.intentId, currentIntent.revision, "executing", "observed", phase.now);
          transaction.insertSchedulerEvent(eventRecord(
            phase.eventId, request, intent.intentId, "scheduler.operation.observed", "accepted",
            observation.code, observation.observationNumber, observation.evidenceReference, phase.now,
          ));
          return;
        }
        const nextStatus: SchedulerRegistrationStatus = terminalState === "ambiguous"
          ? "ambiguous" : intent.operation === "register" ? "removed" : "active";
        transaction.advanceSchedulerRegistration(
          currentRegistration.scheduleId, currentRegistration.configRevision,
          currentRegistration.revision, currentRegistration.status, nextStatus,
          nextStatus === "active" || nextStatus === "ambiguous" ? observation.externalRegistrationId : null,
          nextStatus === "active" || nextStatus === "ambiguous" ? observation.enabled : null,
          nextStatus === "active" || nextStatus === "ambiguous" ? observation.nextTriggerAt : null,
          intent.intentId, phase.now,
        );
        transaction.advanceSchedulerIntent(intent.intentId, currentIntent.revision, "executing", terminalState, phase.now);
        if (terminalState === "failed") {
          transaction.insertSchedulerFinalization(Object.freeze({
            finalizationId: phase.finalizationId!,
            intentId: intent.intentId,
            verifiedReceiptId: null,
            authorizationDecisionId: actDecision.decisionId,
            outcome: "failed" as const,
            code: observation.code,
            resultingRegistrationStatus: nextStatus,
            resultingRegistrationRevision: currentRegistration.revision + 1,
            finalizedAt: phase.now,
          }));
        }
        transaction.insertSchedulerEvent(eventRecord(
          phase.eventId, request, intent.intentId, "scheduler.operation.observed",
          terminalState === "ambiguous" ? "ambiguous" : "refused",
          observation.code, observation.observationNumber, observation.evidenceReference, phase.now,
        ));
      });
      hooks.afterStage?.("observed");
      if (observation.outcome !== "succeeded") return outcomeFailure(observation, request);
      return verifyObserved(
        request,
        { ...intent, state: "observed", revision: intent.revision + 1, updatedAt: phase.now },
        observation,
        actor,
        replayed,
      );
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const executePending = (
    request: SchedulerOperationRequestRecord,
    intent: SchedulerOperationIntentRecord,
    actor: TrustedActorAssertion,
    replayed: boolean,
  ): SchedulerApplicationResult<SchedulerOperationView> => {
    let state: ApplicationState;
    try {
      state = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistence(error);
    }
    const runtime = runtimeFailure(state, actor, store);
    if (runtime !== null) return runtime;
    const project = binding(state, requestScope(request));
    if (project !== null && "ok" in project) return project;
    const physical = validatePhysicalBinding(project, store.layout.root);
    if (physical !== null) return physical;
    const registration = state.schedulerRegistrations.find((candidate) =>
      candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
    const configuration = state.schedulerConfigurations.find((candidate) =>
      candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
    if (registration === undefined || configuration === undefined) return failed("PERSISTENCE_FAILURE", "Scheduler mutation binding is absent", request);
    if (intent.adapterId !== options.adapterId || intent.adapterVersion !== options.adapterVersion) {
      return failed("INVALID_STATE", "Scheduler adapter identity changed", request);
    }
    if (intent.operation === "remove" && registration.externalRegistrationId === null) {
      return failed("RECONCILIATION_REQUIRED", "Scheduler removal has no proven external registration identity", request);
    }
    let confirmed = false;
    try {
      confirmed = ingress.confirmHighRisk(Object.freeze({
        actorId: actor.actorId,
        action: intent.operation === "register" ? "scheduler.register" : "scheduler.remove",
        requestId: request.requestId,
        correlationId: request.correlationId,
        scheduleId: request.scheduleId,
        configRevision: request.configRevision,
      }));
    } catch {
      confirmed = false;
    }
    let actProjectReceipt: ProjectRootIdentity | null = null;
    let actProjectIdentityCurrent = true;
    if (project !== null) {
      try {
        actProjectReceipt = revalidateProjectRoot(project, store.layout.root);
      } catch {
        actProjectIdentityCurrent = false;
      }
    }
    const phase = phaseIdentity(ingress, actor, intent.updatedAt, ["finalization"]);
    if (phase === null || phase.finalizationId === undefined) {
      return failed("INVALID_INPUT", "Trusted scheduler act identity is invalid", request);
    }
    try {
      const actResult = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const runtimeChanged = persistedRuntimeFailure(current, actor);
        if (runtimeChanged !== null) return runtimeChanged;
        const currentIntent = current.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
        const currentRegistration = current.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
        if (currentIntent === undefined || currentIntent.state !== "pending" || currentRegistration === undefined ||
          currentIntent.revision !== intent.revision || currentRegistration.revision !== registration.revision) {
          return failed("STALE_REVISION", "Scheduler mutation changed before adapter access", request);
        }
        const scope = requestScope(request);
        const currentProject = binding(current, scope);
        const databaseProjectBindingChanged = currentProject !== null && "ok" in currentProject &&
          currentProject.error.code !== "PROJECT_DISABLED";
        const physicalProjectBindingChanged = scope.kind === "project" && (
          !actProjectIdentityCurrent || actProjectReceipt === null ||
          (currentProject !== null && !("ok" in currentProject) &&
            !sameProjectIdentity(currentProject, actProjectReceipt))
        );
        const projectBindingChanged = databaseProjectBindingChanged || physicalProjectBindingChanged;
        const evaluation: AuthorizationEvaluation = projectBindingChanged
          ? Object.freeze({
            allowed: false,
            reason: "scope_revision_stale" as const,
            policy: policyFor(current, scope),
            grantId: null,
            grantRevision: null,
          })
          : evaluate(current, actor, intent.operation === "register" ? "scheduler.register" : "scheduler.remove", scope, phase.now, confirmed);
        transaction.insertSchedulerAuthorizationDecision(decisionRecord(phase.decisionId, request, "act", evaluation, phase.now));
        if (!evaluation.allowed) {
          const nextStatus: SchedulerRegistrationStatus = intent.operation === "register" ? "removed" : "active";
          const resultingRegistrationRevision = intent.operation === "register"
            ? registration.revision + 1
            : registration.revision;
          if (intent.operation === "register") {
            transaction.advanceSchedulerRegistration(
              registration.scheduleId, registration.configRevision, registration.revision,
              registration.status, nextStatus, registration.externalRegistrationId,
              registration.enabled, registration.nextTriggerAt, intent.intentId, phase.now,
            );
          }
          transaction.advanceSchedulerIntent(intent.intentId, intent.revision, "pending", "failed", phase.now);
          transaction.insertSchedulerFinalization(Object.freeze({
            finalizationId: phase.finalizationId!,
            intentId: intent.intentId,
            verifiedReceiptId: null,
            authorizationDecisionId: phase.decisionId,
            outcome: "failed" as const,
            code: evaluation.reason,
            resultingRegistrationStatus: nextStatus,
            resultingRegistrationRevision,
            finalizedAt: phase.now,
          }));
          transaction.insertSchedulerEvent(eventRecord(
            phase.eventId, request, intent.intentId, "scheduler.operation.denied",
            "denied", evaluation.reason, null, null, phase.now,
          ));
          return failed("AUTHORIZATION_DENIED", "Final scheduler authorization did not allow adapter access", request);
        }
        transaction.advanceSchedulerIntent(intent.intentId, intent.revision, "pending", "executing", phase.now);
        if (intent.operation === "remove") {
          transaction.advanceSchedulerRegistration(
            registration.scheduleId, registration.configRevision, registration.revision,
            "active", "pending_remove", registration.externalRegistrationId,
            registration.enabled, registration.nextTriggerAt, intent.intentId, phase.now,
          );
        }
        transaction.insertSchedulerEvent(eventRecord(
          phase.eventId, request, intent.intentId, "scheduler.operation.executing",
          "accepted", "allowed", null, null, phase.now,
        ));
        return null;
      });
      hooks.afterStage?.("executing");
      if (actResult !== null) return actResult;
    } catch (error) {
      return mapPersistence(error);
    }
    const executingState = readApplicationStateForOwner(store);
    const executingIntent = executingState.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
    const executingRegistration = executingState.schedulerRegistrations.find((candidate) =>
      candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
    if (executingIntent === undefined || executingRegistration === undefined) return failed("PERSISTENCE_FAILURE", "Scheduler executing readback is absent", request);
    const result = invokeSchedulerBackend(backend, backendRequest(request, configuration));
    hooks.afterStage?.("adapter-returned");
    return settleBackendResult(request, executingIntent, actor, result, replayed);
  };

  const continueExisting = (
    request: SchedulerOperationRequestRecord,
    intent: SchedulerOperationIntentRecord,
    actor: TrustedActorAssertion,
  ): SchedulerApplicationResult<SchedulerOperationView> => {
    if (intent.state === "pending") return executePending(request, intent, actor, true);
    if (intent.state === "observed") {
      const state = readApplicationStateForOwner(store);
      const observation = state.schedulerObservations
        .filter((candidate) => candidate.intentId === intent.intentId)
        .sort((left, right) => left.observationNumber - right.observationNumber)
        .at(-1);
      return observation === undefined
        ? failed("PERSISTENCE_FAILURE", "Scheduler observed intent has no observation", request)
        : verifyObserved(request, intent, observation, actor, true);
    }
    if (intent.state === "verified") {
      const state = readApplicationStateForOwner(store);
      const receipt = state.schedulerReceipts.find((candidate) => candidate.intentId === intent.intentId);
      return receipt === undefined
        ? failed("PERSISTENCE_FAILURE", "Scheduler verified intent has no receipt", request)
        : finalizeVerified(request, intent, receipt, actor, true);
    }
    if (intent.state === "finalized") return finalView(request.requestId, true);
    if (intent.state === "executing" || intent.state === "ambiguous") {
      return failed("RECONCILIATION_REQUIRED", "Scheduler effect must be inspected before continuation", request);
    }
    return intent.state === "failed"
      ? finalView(request.requestId, true)
      : failed("BACKEND_FAILURE", "Scheduler operation is not continuable", request);
  };

  const mutate = (command: SchedulerMutationCommand): SchedulerApplicationResult<SchedulerOperationView> => {
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted scheduler ingress is invalid");
    const idempotencyKey = stableId("scheduler-idempotency", command.idempotencyKey);
    const digest = commandSha256(command);
    let state: ApplicationState;
    try {
      state = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistence(error);
    }
    const runtime = runtimeFailure(state, trusted.actor, store);
    if (runtime !== null) return runtime;
    const existing = state.schedulerOperationRequests.find((candidate) => candidate.idempotencyKey === idempotencyKey);
    if (existing !== undefined) {
      if (existing.actorId !== trusted.actor.actorId || existing.commandSha256 !== digest || !scopeMatches(requestScope(existing), command.scope)) {
        return failed("IDEMPOTENCY_CONFLICT", "Scheduler idempotency identity belongs to another semantic command", existing);
      }
      if (existing.result === "deny") return failed("AUTHORIZATION_DENIED", "Replayed scheduler operation was denied", existing);
      const intent = state.schedulerIntents.find((candidate) => candidate.requestId === existing.requestId);
      if (intent === undefined) return failed("PERSISTENCE_FAILURE", "Scheduler replay intent is absent", existing);
      return continueExisting(existing, intent, trusted.actor);
    }
    const project = binding(state, command.scope);
    if (project !== null && "ok" in project) return project;
    const physical = validatePhysicalBinding(project, store.layout.root);
    if (physical !== null) return physical;
    const identity = prepareIdentity(ingress);
    if (identity === null || identity.actor.actorId !== trusted.actor.actorId || identity.actor.principal !== trusted.actor.principal) {
      return failed("INVALID_INPUT", "Trusted scheduler operation identities are invalid");
    }
    let confirmed = false;
    try {
      confirmed = ingress.confirmHighRisk(Object.freeze({
        actorId: identity.actor.actorId,
        action: command.kind,
        requestId: identity.requestId,
        correlationId: identity.correlationId,
        scheduleId: command.scheduleId,
        configRevision: command.configRevision,
      }));
    } catch {
      confirmed = false;
    }
    try {
      const prepared = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = persistedRuntimeFailure(current, identity.actor);
        if (currentRuntime !== null) return currentRuntime;
        const raced = current.schedulerOperationRequests.find((candidate) => candidate.idempotencyKey === idempotencyKey);
        if (raced !== undefined) return failed("IDEMPOTENCY_CONFLICT", "Scheduler operation raced with another request", raced);
        const currentBinding = binding(current, command.scope);
        if (currentBinding !== null && "ok" in currentBinding) return currentBinding;
        const operation = command.kind === "scheduler.register" ? "register" as const : "remove" as const;
        const removalRegistration = operation === "remove" ? current.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === command.scheduleId && candidate.configRevision === command.configRevision) : undefined;
        const removalConfiguration = operation === "remove" ? current.schedulerConfigurations.find((candidate) =>
          candidate.scheduleId === command.scheduleId && candidate.configRevision === command.configRevision) : undefined;
        if (operation === "remove" && (removalRegistration === undefined || removalConfiguration === undefined)) {
          throw new PersistenceError("NOT_FOUND", "Scheduler registration is absent");
        }
        if (operation === "remove" && removalRegistration!.externalRegistrationId === null) {
          throw new PersistenceError("REVISION_CONFLICT", "Scheduler registration identity is not proven");
        }
        const evaluation = evaluate(current, identity.actor, command.kind, command.scope, identity.now, confirmed);
        const request = schedulerRequest(
          identity,
          command,
          idempotencyKey,
          evaluation.allowed,
          removalRegistration?.externalRegistrationId ?? null,
        );
        transaction.insertSchedulerOperationRequest(request);
        transaction.insertSchedulerAuthorizationDecision(decisionRecord(identity.decisionId, request, "prepare", evaluation, identity.now));
        if (!evaluation.allowed) {
          transaction.insertSchedulerEvent(eventRecord(
            identity.eventId, request, null, "scheduler.operation.denied", "denied",
            evaluation.reason, null, null, identity.now,
          ));
          return Object.freeze({ denied: true as const, request });
        }
        let expectedRegistrationRevision = 0;
        if (command.kind === "scheduler.register") {
          const registerCommand = command;
          const latestRevision = Math.max(0, ...current.schedulerConfigurations
            .filter((candidate) => candidate.scheduleId === registerCommand.scheduleId)
            .map((candidate) => candidate.configRevision));
          if (registerCommand.configRevision !== latestRevision + 1) {
            throw new PersistenceError("REVISION_CONFLICT", "Scheduler configuration revision is not contiguous");
          }
          const configuration: SchedulerConfigurationRecord = Object.freeze({
            scheduleId: registerCommand.scheduleId,
            configRevision: registerCommand.configRevision,
            scopeKind: registerCommand.scope.kind,
            projectId: registerCommand.scope.projectId,
            projectResourceRevision: registerCommand.scope.projectResourceRevision,
            projectConfigRevision: registerCommand.scope.projectConfigRevision,
            scheduleExpression: registerCommand.scheduleExpression,
            timeZone: registerCommand.timeZone,
            dispatcherTarget: registerCommand.dispatcherTarget,
            configSha256: schedulerConfigurationSha256(Object.freeze({
              scheduleId: registerCommand.scheduleId,
              configRevision: registerCommand.configRevision,
              scopeKind: registerCommand.scope.kind,
              projectId: registerCommand.scope.projectId,
              projectResourceRevision: registerCommand.scope.projectResourceRevision,
              projectConfigRevision: registerCommand.scope.projectConfigRevision,
              scheduleExpression: registerCommand.scheduleExpression,
              timeZone: registerCommand.timeZone,
              dispatcherTarget: registerCommand.dispatcherTarget,
            })),
            createdByOperationId: identity.operationId,
            createdAt: identity.now,
          });
          transaction.insertSchedulerConfiguration(configuration);
        } else {
          const removeCommand = command;
          const registration = removalRegistration!;
          const configuration = removalConfiguration!;
          if (!scopeMatches(removeCommand.scope, Object.freeze({
            kind: configuration.scopeKind,
            projectId: configuration.projectId,
            projectResourceRevision: configuration.projectResourceRevision,
            projectConfigRevision: configuration.projectConfigRevision,
          })) || registration.revision !== removeCommand.expectedRegistrationRevision || registration.status !== "active") {
            throw new PersistenceError("REVISION_CONFLICT", "Scheduler removal binding is stale");
          }
          expectedRegistrationRevision = registration.revision;
        }
        const intent: SchedulerOperationIntentRecord = Object.freeze({
          intentId: identity.intentId,
          requestId: identity.requestId,
          operationId: identity.operationId,
          operation,
          state: "pending" as const,
          contractId: SCHEDULER_CONTRACT_ID,
          adapterId: options.adapterId,
          adapterVersion: options.adapterVersion,
          scheduleId: command.scheduleId,
          configRevision: command.configRevision,
          expectedRegistrationRevision,
          operationDeadline: operationDeadline(identity.now, deadlineSeconds),
          revision: 1,
          createdAt: identity.now,
          updatedAt: identity.now,
        });
        transaction.insertSchedulerIntent(intent);
        if (operation === "register") {
          transaction.insertSchedulerRegistration(Object.freeze({
            scheduleId: command.scheduleId,
            configRevision: command.configRevision,
            revision: 1,
            status: "pending_register" as const,
            externalRegistrationId: null,
            enabled: null,
            nextTriggerAt: null,
            lastIntentId: intent.intentId,
            updatedAt: identity.now,
          }));
        }
        transaction.insertSchedulerEvent(eventRecord(
          identity.eventId, request, intent.intentId, "scheduler.operation.prepared",
          "accepted", "allowed", null, null, identity.now,
        ));
        return Object.freeze({ denied: false as const, request, intent });
      });
      hooks.afterStage?.("prepared");
      if ("ok" in prepared) return prepared;
      if (prepared.denied) return failed("AUTHORIZATION_DENIED", "Scheduler operation authorization was denied", prepared.request);
      return executePending(prepared.request, prepared.intent, identity.actor, false);
    } catch (error) {
      if (error instanceof PersistenceError && error.code === "NOT_FOUND") return failed("SCHEDULE_NOT_FOUND", "Scheduler registration is absent");
      return mapPersistence(error);
    }
  };

  const inspect = (value: SchedulerInspectCommand): SchedulerApplicationResult<SchedulerOperationView> => {
    const command = parseInspect(value);
    if (command === null) return failed("INVALID_INPUT", "Scheduler inspect command is invalid");
    const trusted = context(ingress);
    const identity = prepareIdentity(ingress);
    if (trusted === null || identity === null || identity.actor.actorId !== trusted.actor.actorId || identity.actor.principal !== trusted.actor.principal) {
      return failed("INVALID_INPUT", "Trusted scheduler inspect ingress is invalid");
    }
    let state: ApplicationState;
    try { state = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(state, trusted.actor, store);
    if (runtime !== null) return runtime;
    const project = binding(state, command.scope);
    if (project !== null && "ok" in project) return project;
    const physical = validatePhysicalBinding(project, store.layout.root);
    if (physical !== null) return physical;
    const registration = state.schedulerRegistrations.find((candidate) =>
      candidate.scheduleId === command.scheduleId && candidate.configRevision === command.configRevision);
    const configuration = state.schedulerConfigurations.find((candidate) =>
      candidate.scheduleId === command.scheduleId && candidate.configRevision === command.configRevision);
    if (registration === undefined || configuration === undefined) return failed("SCHEDULE_NOT_FOUND", "Scheduler registration is absent");
    if (registration.revision !== command.expectedRegistrationRevision || !scopeMatches(command.scope, Object.freeze({
      kind: configuration.scopeKind,
      projectId: configuration.projectId,
      projectResourceRevision: configuration.projectResourceRevision,
      projectConfigRevision: configuration.projectConfigRevision,
    }))) return failed("STALE_REVISION", "Scheduler inspect binding is stale");
    const request: SchedulerOperationRequestRecord = Object.freeze({
      requestId: identity.requestId,
      operationId: identity.operationId,
      idempotencyKey: null,
      commandSha256: commandSha256(command),
      operation: "inspect" as const,
      actorId: identity.actor.actorId,
      correlationId: identity.correlationId,
      scheduleId: command.scheduleId,
      configRevision: command.configRevision,
      externalRegistrationId: registration.externalRegistrationId,
      scopeKind: command.scope.kind,
      projectId: command.scope.projectId,
      projectResourceRevision: command.scope.projectResourceRevision,
      projectConfigRevision: command.scope.projectConfigRevision,
      result: "allow" as const,
      createdAt: identity.now,
    });
    try {
      const prepared = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = persistedRuntimeFailure(current, identity.actor);
        if (currentRuntime !== null) return currentRuntime;
        const currentRegistration = current.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === command.scheduleId && candidate.configRevision === command.configRevision);
        if (currentRegistration?.revision !== command.expectedRegistrationRevision) return failed("STALE_REVISION", "Scheduler inspect registration changed", request);
        const evaluation = evaluate(current, identity.actor, "scheduler.inspect", command.scope, identity.now, true);
        const persistedRequest = Object.freeze({ ...request, result: evaluation.allowed ? "allow" as const : "deny" as const });
        transaction.insertSchedulerOperationRequest(persistedRequest);
        transaction.insertSchedulerAuthorizationDecision(decisionRecord(identity.decisionId, persistedRequest, "inspect", evaluation, identity.now));
        if (!evaluation.allowed) {
          transaction.insertSchedulerEvent(eventRecord(
            identity.eventId, persistedRequest, null, "scheduler.operation.denied", "denied",
            evaluation.reason, null, null, identity.now,
          ));
          return Object.freeze({ allowed: false as const, request: persistedRequest });
        }
        return Object.freeze({ allowed: true as const, request: persistedRequest });
      });
      hooks.afterStage?.("inspect-authorized");
      if ("ok" in prepared) return prepared;
      if (!prepared.allowed) return failed("AUTHORIZATION_DENIED", "Scheduler inspect authorization was denied", prepared.request);
      const result = invokeSchedulerBackend(backend, inspectBackendRequest(prepared.request));
      hooks.afterStage?.("inspect-adapter-returned");
      const phase = phaseIdentity(ingress, identity.actor, identity.now, ["observation"]);
      if (phase === null || phase.observationId === undefined) return failed("INVALID_INPUT", "Trusted scheduler inspect observation identity is invalid", request);
      const observation = observationFromResult(result, prepared.request, null, phase.observationId, 1,
        result.ok ? result.receipt.observedAt : phase.now, registration);
      withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRegistration = current.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === registration.scheduleId && candidate.configRevision === registration.configRevision);
        if (currentRegistration?.revision !== registration.revision) throw new PersistenceError("REVISION_CONFLICT", "Scheduler registration changed during inspect");
        transaction.insertSchedulerObservation(observation);
        transaction.insertSchedulerEvent(eventRecord(
          phase.eventId, prepared.request, null, "scheduler.inspected",
          observation.outcome === "succeeded" ? "accepted" : observation.outcome === "ambiguous" ? "ambiguous" : "refused",
          observation.code, 1, observation.evidenceReference, phase.now,
        ));
      });
      hooks.afterStage?.("inspected");
      const terminal = readApplicationStateForOwner(store);
      const terminalRequest = terminal.schedulerOperationRequests.find((candidate) => candidate.requestId === prepared.request.requestId)!;
      const view = operationView(terminal, terminalRequest, null);
      return observation.outcome === "succeeded"
        ? succeeded(view, terminalRequest.requestId, terminalRequest.correlationId)
        : outcomeFailure(observation, terminalRequest);
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const reconcile = (value: SchedulerReconcileCommand): SchedulerApplicationResult<SchedulerOperationView> => {
    const command = parseReconcile(value);
    if (command === null) return failed("INVALID_INPUT", "Scheduler reconcile command is invalid");
    const trusted = context(ingress);
    const identity = prepareIdentity(ingress);
    if (trusted === null || identity === null || identity.actor.actorId !== trusted.actor.actorId || identity.actor.principal !== trusted.actor.principal) {
      return failed("INVALID_INPUT", "Trusted scheduler reconcile ingress is invalid");
    }
    let state: ApplicationState;
    try { state = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(state, trusted.actor, store);
    if (runtime !== null) return runtime;
    const intent = state.schedulerIntents.find((candidate) => candidate.intentId === command.intentId);
    if (intent === undefined) return failed("SCHEDULE_NOT_FOUND", "Scheduler intent is absent");
    if (intent.revision !== command.expectedIntentRevision) return failed("STALE_REVISION", "Scheduler intent revision is stale");
    if (intent.state !== "executing" && intent.state !== "ambiguous") return failed("INVALID_STATE", "Scheduler intent does not require external reconciliation");
    const origin = state.schedulerOperationRequests.find((candidate) => candidate.requestId === intent.requestId);
    const registration = state.schedulerRegistrations.find((candidate) =>
      candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
    const configuration = state.schedulerConfigurations.find((candidate) =>
      candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
    if (origin === undefined || registration === undefined || configuration === undefined) return failed("PERSISTENCE_FAILURE", "Scheduler reconciliation binding is absent");
    if (origin.actorId !== trusted.actor.actorId) return failed("AUTHORIZATION_DENIED", "Scheduler intent actor is not current", origin);
    const scope = requestScope(origin);
    const project = binding(state, scope);
    if (project !== null && "ok" in project) return project;
    const physical = validatePhysicalBinding(project, store.layout.root);
    if (physical !== null) return physical;
    const reconcileRequest: SchedulerOperationRequestRecord = Object.freeze({
      requestId: identity.requestId,
      operationId: identity.operationId,
      idempotencyKey: null,
      commandSha256: sha256(canonicalJson(command)),
      operation: "inspect" as const,
      actorId: identity.actor.actorId,
      correlationId: identity.correlationId,
      scheduleId: intent.scheduleId,
      configRevision: intent.configRevision,
      externalRegistrationId: intent.operation === "remove"
        ? origin.externalRegistrationId : registration.externalRegistrationId,
      scopeKind: scope.kind,
      projectId: scope.projectId,
      projectResourceRevision: scope.projectResourceRevision,
      projectConfigRevision: scope.projectConfigRevision,
      result: "allow" as const,
      createdAt: identity.now,
    });
    try {
      const prepared = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentIntent = current.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
        if (currentIntent?.revision !== intent.revision || currentIntent.state !== intent.state) return failed("STALE_REVISION", "Scheduler intent changed before reconciliation", origin);
        const evaluation = evaluate(current, identity.actor, "scheduler.inspect", scope, identity.now, true);
        const request = Object.freeze({ ...reconcileRequest, result: evaluation.allowed ? "allow" as const : "deny" as const });
        transaction.insertSchedulerOperationRequest(request);
        transaction.insertSchedulerAuthorizationDecision(decisionRecord(identity.decisionId, request, "inspect", evaluation, identity.now));
        if (!evaluation.allowed) {
          transaction.insertSchedulerEvent(eventRecord(
            identity.eventId, request, intent.intentId, "scheduler.operation.denied", "denied",
            evaluation.reason, null, null, identity.now,
          ));
          return Object.freeze({ allowed: false as const, request });
        }
        return Object.freeze({ allowed: true as const, request });
      });
      hooks.afterStage?.("reconcile-authorized");
      if ("ok" in prepared) return prepared;
      if (!prepared.allowed) return failed("AUTHORIZATION_DENIED", "Scheduler reconciliation inspect was denied", prepared.request);
      const result = invokeSchedulerBackend(backend, inspectBackendRequest(prepared.request));
      hooks.afterStage?.("reconcile-adapter-returned");
      const phase = phaseIdentity(ingress, identity.actor, identity.now, ["observation"]);
      if (phase === null || phase.observationId === undefined) return failed("INVALID_INPUT", "Trusted reconciliation observation identity is invalid", prepared.request);
      const observationNumber = state.schedulerObservations.filter((candidate) => candidate.intentId === intent.intentId).length + 1;
      const observation = observationFromResult(result, prepared.request, intent.intentId, phase.observationId,
        observationNumber, result.ok ? result.receipt.observedAt : phase.now, registration);
      const provesSuccess = observation.outcome === "succeeded" && (
        (intent.operation === "register" && observation.externalState === "present") ||
        (intent.operation === "remove" && observation.externalState === "absent")
      );
      const provesOpposite = observation.outcome === "succeeded" && (
        (intent.operation === "register" && observation.externalState === "absent") ||
        (intent.operation === "remove" && observation.externalState === "present")
      );
      if (!provesSuccess && !provesOpposite) {
        withApplicationTransaction(store, (transaction) => {
          const current = transaction.read();
          const currentIntent = current.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
          const currentRegistration = current.schedulerRegistrations.find((candidate) =>
            candidate.scheduleId === intent.scheduleId && candidate.configRevision === intent.configRevision);
          if (currentIntent === undefined || currentRegistration === undefined || currentIntent.revision !== intent.revision) {
            throw new PersistenceError("REVISION_CONFLICT", "Scheduler reconcile target changed");
          }
          transaction.insertSchedulerObservation(observation);
          transaction.advanceSchedulerIntent(intent.intentId, intent.revision, intent.state, "ambiguous", phase.now);
          transaction.advanceSchedulerRegistration(
            registration.scheduleId, registration.configRevision, registration.revision,
            registration.status, "ambiguous", observation.externalRegistrationId,
            observation.enabled, observation.nextTriggerAt, intent.intentId, phase.now,
          );
          transaction.insertSchedulerEvent(eventRecord(
            phase.eventId, prepared.request, intent.intentId, "scheduler.operation.reconciled",
            "ambiguous", observation.code, observationNumber, observation.evidenceReference, phase.now,
          ));
        });
        hooks.afterStage?.("reconciled-ambiguous");
        return failed("RECONCILIATION_REQUIRED", "Scheduler inspection did not prove external state", prepared.request);
      }
      withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentIntent = current.schedulerIntents.find((candidate) => candidate.intentId === intent.intentId);
        if (currentIntent === undefined || currentIntent.revision !== intent.revision || currentIntent.state !== intent.state) {
          throw new PersistenceError("REVISION_CONFLICT", "Scheduler reconcile target changed");
        }
        transaction.insertSchedulerObservation(observation);
        transaction.advanceSchedulerIntent(intent.intentId, intent.revision, intent.state, "observed", phase.now);
        transaction.insertSchedulerEvent(eventRecord(
          phase.eventId, prepared.request, intent.intentId, "scheduler.operation.reconciled",
          provesSuccess ? "accepted" : "failed", observation.code,
          observationNumber, observation.evidenceReference, phase.now,
        ));
      });
      hooks.afterStage?.("reconciled-observed");
      return verifyObserved(
        origin,
        { ...intent, state: "observed", revision: intent.revision + 1, updatedAt: phase.now },
        observation,
        identity.actor,
        true,
      );
    } catch (error) {
      return mapPersistence(error);
    }
  };

  return Object.freeze({
    register(value: SchedulerRegisterCommand) {
      const command = parseRegister(value);
      return command === null ? failed("INVALID_INPUT", "Scheduler register command is invalid") : mutate(command);
    },
    inspect,
    remove(value: SchedulerRemoveCommand) {
      const command = parseRemove(value);
      return command === null ? failed("INVALID_INPUT", "Scheduler remove command is invalid") : mutate(command);
    },
    reconcile,
  });
}

export function createSchedulerApplicationService(
  store: PersistenceStore,
  ingress: SchedulerIngress,
  backend: SchedulerBackend,
  options: SchedulerApplicationOptions,
): SchedulerApplicationService {
  return createSchedulerApplicationServiceWithHooks(store, ingress, backend, options, Object.freeze({}));
}
