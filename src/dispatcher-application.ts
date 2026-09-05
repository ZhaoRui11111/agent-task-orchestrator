import {
  evaluateAuthorization,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import {
  evaluateTaskEligibility,
  transitionTask,
  type Task,
} from "./domain.ts";
import { validateTrustedRuntimeAndActor } from "./execution-application.ts";
import type { ExecutionLoopStartCommand } from "./execution-loop.ts";
import { EXECUTION_CONTRACT_ID } from "./execution-port.ts";
import type { TrustedActorAssertion } from "./application.ts";
import {
  revalidateProjectRoot,
  type ProjectRootIdentity,
} from "./project-registry.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  DISPATCHER_RECONCILIATION_CODES,
  type ApplicationAuditRecord,
  type ApplicationRequestRecord,
  type ApplicationState,
  type ApplicationTransaction,
  type AuthorizationDecisionRecord,
  type DispatcherAuditCode,
  type DispatcherAuditRecord,
  type DispatcherAuthorizationDecisionRecord,
  type DispatcherMemberCode,
  type DispatcherMemberDenialAuditRecord,
  type DispatcherMemberDenialDecisionRecord,
  type DispatcherMemberDenialRequestRecord,
  type DispatcherMemberOutcome,
  type DispatcherMemberRecord,
  type DispatcherReconciliationCode,
  type DispatcherRunRecord,
  type DispatcherRunStatus,
  type CodexProductOperationRecord,
  type ExecutionAttempt,
  type ExecutionAuthorizationDecisionRecord,
  type ExecutionIntentAuthorizationBindingRecord,
  type ExecutionOperationAuditRecord,
  type ExecutionOperationIntent,
  type ExecutionOperationRequestRecord,
  type RegisteredProject,
  type SchedulerConfigurationRecord,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, isCanonicalUtcTimestamp, sha256 } from "./persistence/values.ts";
import { schedulerDeliveryIdentitySha256 } from "./persistence/scheduler-receipt-digest.ts";
import {
  SCHEDULER_CONTRACT_ID,
  parseSchedulerDispatchTrigger,
  type SchedulerDispatchTrigger,
} from "./scheduler-port.ts";

export const DISPATCHER_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "IDEMPOTENCY_CONFLICT",
  "RUN_NOT_FOUND",
  "RUN_NOT_RECONCILED",
  "RUN_NOT_SEALED",
  "MEMBER_NOT_FOUND",
  "MEMBER_NOT_PENDING",
  "STALE_REVISION",
  "STALE_OWNER",
  "LEASE_EXPIRED",
  "LEASE_NOT_EXPIRED",
  "RECONCILIATION_INCOMPLETE",
  "PROJECT_IDENTITY_CHANGED",
  "INTEGRITY_FAILURE",
  "PERSISTENCE_FAILURE",
] as const);
const DISPATCHER_RECONCILIATION_CODE_SET: ReadonlySet<string> = new Set(DISPATCHER_RECONCILIATION_CODES);

export type DispatcherErrorCode = (typeof DISPATCHER_ERROR_CODES)[number];
export interface DispatcherError {
  readonly code: DispatcherErrorCode;
  readonly message: string;
}
export interface DispatcherSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly requestId: string;
  readonly correlationId: string;
  readonly replayed: boolean;
}
export interface DispatcherFailure {
  readonly ok: false;
  readonly error: DispatcherError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}
export type DispatcherResult<T> = DispatcherSuccess<T> | DispatcherFailure;

export interface DispatcherIngress {
  currentActor(): TrustedActorAssertion;
  currentWorkerOwner(): string;
  currentExecutionLeaseOwner?(): string;
  currentRuntimeRootKey(): string;
  now(): string;
  nextId(kind:
    | "observation" | "request" | "correlation" | "decision" | "audit" | "run"
    | "reconciliation_item" | "member" | "execution" | "operation" | "intent"): string;
}

export interface DispatcherStartCommand {
  readonly kind: "dispatch.start";
  readonly idempotencyKey: string;
  readonly leaseDurationSeconds: number;
}

export interface DispatcherRunCommand {
  readonly runId: string;
  readonly expectedOwnerRevision: number;
  readonly expectedRunRevision: number;
}

export interface DispatcherBeginReconciliationCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.begin_reconciliation";
}

export interface DispatcherReconciliationResolution {
  readonly resourceKind: "execution_intent" | "execution_lease" | "dispatcher_run";
  readonly resourceId: string;
  readonly disposition: "reconciled" | "no_effect" | "authorization_denied" | "ambiguous" | "failed";
  readonly code: DispatcherReconciliationCode;
}

export interface DispatcherCommitReconciliationCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.commit_reconciliation";
  readonly resolutions: readonly DispatcherReconciliationResolution[];
}

export interface DispatcherSealCandidatesCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.seal_candidates";
}

export interface DispatcherClaimMemberCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.claim_member";
  readonly memberId: string;
  readonly expectedMembershipRevision: number;
  readonly expectedMemberRevision: number;
}

export interface DispatcherHeartbeatCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.heartbeat";
  readonly expectedStatus: Exclude<DispatcherRunStatus, "completed" | "partial" | "failed" | "interrupted">;
}

export interface DispatcherTakeoverCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.takeover";
  readonly expectedOwnerId: string;
  readonly expectedStatus: Exclude<DispatcherRunStatus, "completed" | "partial" | "failed" | "interrupted">;
}

export interface DispatcherFinalizeCommand extends DispatcherRunCommand {
  readonly kind: "dispatch.finalize";
}

export interface DispatcherRunView {
  readonly runId: string;
  readonly status: DispatcherRunStatus;
  readonly actorId: string;
  readonly ownerId: string;
  readonly ownerRevision: number;
  readonly runRevision: number;
  readonly heartbeatAt: string;
  readonly leaseExpiresAt: string;
  readonly requestedLeaseSeconds: number;
  readonly reconciliationComplete: boolean;
  readonly membershipRevision: number | null;
  readonly expectedMemberCount: number | null;
  readonly pendingMemberCount: number;
  readonly terminalMemberCount: number;
  readonly terminalStatus: "completed" | "partial" | "failed" | "interrupted" | null;
}

export interface DispatcherReconciliationResource {
  readonly resourceKind: DispatcherReconciliationResolution["resourceKind"];
  readonly resourceId: string;
}

export interface DispatcherMemberView {
  readonly memberId: string;
  readonly runId: string;
  readonly ordinal: number;
  readonly taskId: string;
  readonly lifecycle: "pending" | "terminal";
  readonly outcome: DispatcherMemberOutcome | null;
  readonly executionId: string | null;
  readonly intentId: string | null;
  readonly code: DispatcherMemberCode | null;
  readonly revision: number;
  readonly startCommand: ExecutionLoopStartCommand | null;
}

export interface DispatcherApplicationService {
  start(command: DispatcherStartCommand): DispatcherResult<DispatcherRunView>;
  deliverScheduled(trigger: SchedulerDispatchTrigger): DispatcherResult<DispatcherRunView>;
  inspect(runId: string): DispatcherResult<DispatcherRunView>;
  beginReconciliation(command: DispatcherBeginReconciliationCommand): DispatcherResult<DispatcherRunView>;
  reconciliationInventory(runId: string): DispatcherResult<readonly DispatcherReconciliationResource[]>;
  commitReconciliation(command: DispatcherCommitReconciliationCommand): DispatcherResult<DispatcherRunView>;
  sealCandidates(command: DispatcherSealCandidatesCommand): DispatcherResult<DispatcherRunView>;
  claimAndPrepareMember(command: DispatcherClaimMemberCommand): DispatcherResult<DispatcherMemberView>;
  heartbeat(command: DispatcherHeartbeatCommand): DispatcherResult<DispatcherRunView>;
  takeover(command: DispatcherTakeoverCommand): DispatcherResult<DispatcherRunView>;
  finalize(command: DispatcherFinalizeCommand): DispatcherResult<DispatcherRunView>;
}

/** Internal product-composition surface; intentionally omitted from the package root. */
export interface CodexTargetedDispatcherService {
  createStartRun(operationId: string): DispatcherResult<DispatcherRunView>;
  claimStartMember(operationId: string): DispatcherResult<DispatcherMemberView>;
  createContinuationRun(operationId: string): DispatcherResult<DispatcherRunView>;
  claimContinuationMember(operationId: string): DispatcherResult<DispatcherMemberView>;
  finalizeRun(operationId: string): DispatcherResult<DispatcherRunView>;
}

export interface DispatcherApplicationOptions {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly schedulerIngress?: Readonly<{
    readonly adapterId: string;
    readonly adapterVersion: string;
    readonly dispatcherTarget: string;
  }>;
  readonly executionLeaseSeconds?: number;
  readonly operationDeadlineSeconds?: number;
}

export interface DispatcherApplicationTestHooks {
  afterStage?(stage: string): void;
}

interface TrustedContext {
  readonly actor: TrustedActorAssertion;
  readonly ownerId: string;
  readonly executionOwnerId: string;
  readonly runtimeRootKey: string;
  readonly now: string;
}

interface OperationIds {
  readonly decisionId: string;
  readonly auditId: string;
}

const ACTIVE_RUN_STATUSES = new Set<DispatcherRunStatus>(["starting", "reconciling", "sweeping"]);
type UnknownRecord = Record<string, unknown>;
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

function operationalIdentifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\p{Cc}\p{Cf}]/u.test(value);
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function exactPositiveRange(value: unknown, minimum: number, maximum: number): value is number {
  return positive(value) && value >= minimum && value <= maximum;
}
function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  return record !== null && operationalIdentifier(record.actorId) &&
    typeof record.principal === "string" && /^[0-9A-F]{64}$/u.test(record.principal)
    ? Object.freeze({ actorId: record.actorId, principal: record.principal }) : null;
}
function context(ingress: DispatcherIngress): TrustedContext | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const ownerId = ingress.currentWorkerOwner();
    const executionOwnerId = ingress.currentExecutionLeaseOwner?.() ?? ownerId;
    const runtimeRootKey = ingress.currentRuntimeRootKey();
    const now = ingress.now();
    return actor !== null && operationalIdentifier(ownerId) && operationalIdentifier(executionOwnerId) &&
      boundedText(runtimeRootKey, 512) &&
      isCanonicalUtcTimestamp(now)
      ? Object.freeze({ actor, ownerId, executionOwnerId, runtimeRootKey, now }) : null;
  } catch {
    return null;
  }
}
function failed(
  code: DispatcherErrorCode,
  message: string,
  identity: Readonly<{ requestId: string; correlationId: string }> | null = null,
): DispatcherFailure {
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
): DispatcherSuccess<T> {
  return Object.freeze({ ok: true as const, value, requestId, correlationId, replayed });
}
function leaseExpiry(now: string, durationSeconds: number): string {
  return new Date(Date.parse(now) + durationSeconds * 1000).toISOString();
}
function stableId(prefix: string, ...parts: readonly unknown[]): string {
  return `${prefix}:${sha256(canonicalJson(parts)).slice(0, 64)}`;
}
function laterTimestamp(previous: string, candidate: string): string {
  return new Date(Math.max(Date.parse(previous) + 1, Date.parse(candidate))).toISOString();
}
function ids(ingress: DispatcherIngress, kinds: readonly Parameters<DispatcherIngress["nextId"]>[0][]): readonly string[] | null {
  try {
    const values = kinds.map((kind) => ingress.nextId(kind));
    return values.every((value) => operationalIdentifier(value)) && new Set(values).size === values.length
      ? Object.freeze(values) : null;
  } catch {
    return null;
  }
}
function runView(state: ApplicationState, run: DispatcherRunRecord): DispatcherRunView {
  const membership = state.dispatcherMemberships.find((candidate) => candidate.runId === run.runId) ?? null;
  const members = state.dispatcherMembers.filter((candidate) => candidate.runId === run.runId);
  const summary = state.dispatcherRunSummaries.find((candidate) => candidate.runId === run.runId) ?? null;
  return Object.freeze({
    runId: run.runId,
    status: run.status,
    actorId: run.actorId,
    ownerId: run.ownerId,
    ownerRevision: run.ownerRevision,
    runRevision: run.runRevision,
    heartbeatAt: run.heartbeatAt,
    leaseExpiresAt: run.leaseExpiresAt,
    requestedLeaseSeconds: run.requestedLeaseSeconds,
    reconciliationComplete: state.dispatcherReconciliationSummaries.some((candidate) => candidate.runId === run.runId),
    membershipRevision: membership?.membershipRevision ?? null,
    expectedMemberCount: membership?.expectedMemberCount ?? null,
    pendingMemberCount: members.filter((candidate) => candidate.lifecycle === "pending").length,
    terminalMemberCount: members.filter((candidate) => candidate.lifecycle === "terminal").length,
    terminalStatus: summary?.terminalStatus ?? null,
  });
}
function sameProjectIdentity(left: ProjectRootIdentity, right: ProjectRootIdentity): boolean {
  return left.canonicalRoot === right.canonicalRoot && left.rootKey === right.rootKey &&
    left.platform === right.platform && left.device === right.device && left.inode === right.inode &&
    left.mode === right.mode;
}
function runtimeFailure(state: ApplicationState, trusted: TrustedContext, store: PersistenceStore): DispatcherFailure | null {
  const validation = validateTrustedRuntimeAndActor(state, trusted.actor, store);
  if (!validation.ok) {
    return validation.reason === "runtime_root_unavailable"
      ? failed("PROJECT_IDENTITY_CHANGED", "Trusted runtime root could not be revalidated")
      : failed("AUTHORIZATION_DENIED", "Trusted runtime actor or root binding is not current");
  }
  if (state.bootstrap?.rootKey !== trusted.runtimeRootKey || state.identity?.runtimeRootKey !== trusted.runtimeRootKey) {
    return failed("AUTHORIZATION_DENIED", "Trusted dispatcher runtime-root assertion is not current");
  }
  return null;
}
function persistedRuntimeFailure(state: ApplicationState, trusted: TrustedContext): DispatcherFailure | null {
  if (state.bootstrap?.rootKey !== trusted.runtimeRootKey || state.identity?.runtimeRootKey !== trusted.runtimeRootKey ||
    state.identity.actorId !== trusted.actor.actorId || state.identity.principalSha256 !== trusted.actor.principal) {
    return failed("AUTHORIZATION_DENIED", "Persisted dispatcher runtime identity changed after trusted preflight");
  }
  return null;
}
function runFailure(run: DispatcherRunRecord | undefined, trusted: TrustedContext, command: DispatcherRunCommand): DispatcherFailure | null {
  if (run === undefined) return failed("RUN_NOT_FOUND", "Dispatcher run is not registered");
  if (run.actorId !== trusted.actor.actorId) return failed("AUTHORIZATION_DENIED", "Dispatcher run actor is not current");
  if (run.ownerId !== trusted.ownerId) return failed("STALE_OWNER", "Dispatcher run owner is stale");
  if (run.ownerRevision !== command.expectedOwnerRevision || run.runRevision !== command.expectedRunRevision) {
    return failed("STALE_REVISION", "Dispatcher run owner or revision is stale");
  }
  if (!ACTIVE_RUN_STATUSES.has(run.status)) return failed("STALE_REVISION", "Dispatcher run is already terminal");
  if (trusted.now >= run.leaseExpiresAt) return failed("LEASE_EXPIRED", "Dispatcher run lease is no longer current");
  return null;
}
function dispatchEvaluation(state: ApplicationState, trusted: TrustedContext): AuthorizationEvaluation {
  return evaluateAuthorization({
    actorId: trusted.actor.actorId,
    action: "dispatch.run",
    target: { projectId: null, resourceRevision: null, configRevision: null },
    now: trusted.now,
    policy: "allow",
    confirmed: true,
    grants: state.grants,
  });
}
function conservativeDeniedDispatchEvaluation(): AuthorizationEvaluation {
  return Object.freeze({
    allowed: false,
    reason: "grant_missing" as const,
    policy: "allow" as const,
    grantId: null,
    grantRevision: null,
  });
}
function allowedDispatchEvaluationIsCurrent(
  preflight: ApplicationState,
  current: ApplicationState,
  evaluation: AuthorizationEvaluation,
): boolean {
  if (!evaluation.allowed || evaluation.grantId === null || evaluation.grantRevision === null) return false;
  const before = preflight.grants.find((grant) =>
    grant.grantId === evaluation.grantId && grant.revision === evaluation.grantRevision);
  const after = current.grants.find((grant) => grant.grantId === evaluation.grantId);
  return before !== undefined && after !== undefined && canonicalJson(before) === canonicalJson(after);
}
function schedulerConfigurationIsCurrent(
  state: ApplicationState,
  configuration: SchedulerConfigurationRecord,
  projectRootReceipt: ProjectRootIdentity | null | undefined,
): boolean {
  if (configuration.scopeKind === "runtime") return projectRootReceipt === null;
  const project = configuration.projectId === null
    ? undefined
    : state.projects.find((candidate) => candidate.projectId === configuration.projectId);
  return project !== undefined && projectRootReceipt !== undefined && projectRootReceipt !== null &&
    sameProjectIdentity(project, projectRootReceipt) &&
    project.resourceRevision === configuration.projectResourceRevision &&
    project.configRevision === configuration.projectConfigRevision &&
    state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true;
}
function projectEvaluation(
  state: ApplicationState,
  trusted: TrustedContext,
  action: "execution.claim" | "execution.start" | "execution.resume" | "execution.retry" | "execution.lease.takeover",
  project: RegisteredProject,
): AuthorizationEvaluation {
  const policy: AuthorizationPolicyResult = state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true
    ? "allow" : "deny";
  return evaluateAuthorization({
    actorId: trusted.actor.actorId,
    action,
    target: {
      projectId: project.projectId,
      resourceRevision: project.resourceRevision,
      configRevision: project.configRevision,
    },
    now: trusted.now,
    policy,
    confirmed: true,
    grants: state.grants,
  });
}
function dispatcherDecision(
  decisionId: string,
  run: DispatcherRunRecord,
  trusted: TrustedContext,
  evaluation: AuthorizationEvaluation,
): DispatcherAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId,
    requestId: run.requestId,
    actorId: trusted.actor.actorId,
    action: "dispatch.run" as const,
    result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason,
    policy: evaluation.policy,
    grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision,
    createdAt: trusted.now,
  });
}
function dispatcherAudit(
  auditId: string,
  requestId: string,
  decisionId: string,
  runId: string | null,
  eventKind: DispatcherAuditRecord["eventKind"],
  accepted: boolean,
  actorId: string,
  correlationId: string,
  code: DispatcherAuditCode,
  now: string,
): DispatcherAuditRecord {
  return Object.freeze({
    auditId, requestId, decisionId, runId, eventKind,
    result: accepted ? "accepted" as const : "denied" as const,
    actorId, correlationId, code, createdAt: now,
  });
}
function triggerRequest(state: ApplicationState, run: DispatcherRunRecord): Readonly<{ requestId: string; correlationId: string }> {
  const request = state.dispatcherTriggerRequests.find((candidate) => candidate.requestId === run.requestId);
  if (request === undefined) throw new TypeError("Dispatcher trigger request is absent");
  return request;
}
function persistContinuationAuthorization(
  transaction: ApplicationTransaction,
  state: ApplicationState,
  run: DispatcherRunRecord,
  trusted: TrustedContext,
  operationIds: OperationIds,
  acceptedEvent: DispatcherAuditRecord["eventKind"],
  code: DispatcherAuditCode,
): AuthorizationEvaluation {
  const evaluation = dispatchEvaluation(state, trusted);
  const request = triggerRequest(state, run);
  transaction.insertDispatcherAuthorizationDecision(dispatcherDecision(
    operationIds.decisionId, run, trusted, evaluation,
  ));
  transaction.insertDispatcherAudit(dispatcherAudit(
    operationIds.auditId,
    run.requestId,
    operationIds.decisionId,
    run.runId,
    evaluation.allowed ? acceptedEvent : "dispatch.operation.denied",
    evaluation.allowed,
    trusted.actor.actorId,
    request.correlationId,
    evaluation.allowed ? code : evaluation.reason,
    trusted.now,
  ));
  return evaluation;
}
function readbackRun(transaction: ApplicationTransaction, runId: string): DispatcherRunRecord {
  const run = transaction.read().dispatcherRuns.find((candidate) => candidate.runId === runId);
  if (run === undefined) throw new TypeError("Dispatcher run readback is absent");
  return run;
}
function mapPersistence(error: unknown): DispatcherFailure {
  if (error instanceof PersistenceError && error.code === "REVISION_CONFLICT") {
    return failed("STALE_REVISION", "Dispatcher CAS rejected a stale owner, revision, status, member, or fence");
  }
  return failed("PERSISTENCE_FAILURE", "Dispatcher persistence failed closed");
}
function parseStart(value: unknown): DispatcherStartCommand | null {
  const record = exactRecord(value, ["idempotencyKey", "kind", "leaseDurationSeconds"]);
  return record !== null && record.kind === "dispatch.start" && operationalIdentifier(record.idempotencyKey) &&
    exactPositiveRange(record.leaseDurationSeconds, 30, 3600)
    ? Object.freeze({
      kind: record.kind,
      idempotencyKey: record.idempotencyKey,
      leaseDurationSeconds: record.leaseDurationSeconds,
    }) : null;
}
function parseRunCommand(value: unknown, kind: string, extraKeys: readonly string[] = []): Readonly<Record<string, unknown>> | null {
  const record = exactRecord(value, ["expectedOwnerRevision", "expectedRunRevision", "kind", "runId", ...extraKeys].sort());
  return record !== null && record.kind === kind && operationalIdentifier(record.runId) &&
    positive(record.expectedOwnerRevision) && positive(record.expectedRunRevision) ? record : null;
}
function parseResolutions(value: unknown): readonly DispatcherReconciliationResolution[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > 10000 || Reflect.ownKeys(value).length !== value.length + 1) return null;
    const parsed: DispatcherReconciliationResolution[] = [];
    const identities = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      const record = exactRecord(descriptor.value, ["code", "disposition", "resourceId", "resourceKind"]);
      if (record === null ||
        (record.resourceKind !== "execution_intent" && record.resourceKind !== "execution_lease" && record.resourceKind !== "dispatcher_run") ||
        (record.disposition !== "reconciled" && record.disposition !== "no_effect" &&
          record.disposition !== "authorization_denied" && record.disposition !== "ambiguous" && record.disposition !== "failed") ||
        !operationalIdentifier(record.resourceId) || typeof record.code !== "string" ||
        !DISPATCHER_RECONCILIATION_CODE_SET.has(record.code)) return null;
      const identity = `${record.resourceKind}:${record.resourceId}`;
      if (identities.has(identity)) return null;
      identities.add(identity);
      parsed.push(Object.freeze({
        resourceKind: record.resourceKind,
        resourceId: record.resourceId,
        disposition: record.disposition,
        code: record.code as DispatcherReconciliationCode,
      }));
    }
    return Object.freeze(parsed);
  } catch {
    return null;
  }
}

function reconciliationInventory(state: ApplicationState, run: DispatcherRunRecord): readonly DispatcherReconciliationResource[] {
  const result = new Map<string, DispatcherReconciliationResource>();
  const remember = (resourceKind: DispatcherReconciliationResource["resourceKind"], resourceId: string): void => {
    result.set(`${resourceKind}:${resourceId}`, Object.freeze({ resourceKind, resourceId }));
  };
  for (const intent of state.executionIntents) {
    if (intent.createdAt >= run.createdAt) continue;
    const finalization = state.executionFinalizations.find((candidate) => candidate.intentId === intent.intentId);
    if (intent.state !== "finalized" || (finalization !== undefined && finalization.finalizedAt >= run.createdAt)) {
      remember("execution_intent", intent.intentId);
    }
  }
  for (const execution of state.executions) {
    if (execution.createdAt >= run.createdAt || execution.leaseExpiresAt > run.createdAt) continue;
    const terminal = state.executionTerminalStates.find((candidate) => candidate.executionId === execution.executionId);
    if ((execution.status === "active" && terminal === undefined) || execution.updatedAt >= run.createdAt ||
      (terminal !== undefined && terminal.createdAt >= run.createdAt)) {
      remember("execution_lease", execution.executionId);
    }
  }
  for (const stale of state.dispatcherRuns) {
    const recoveredDuringRun = state.dispatcherAudit.some((event) =>
      event.runId === stale.runId && event.eventKind === "dispatch.taken_over" &&
      event.result === "accepted" && event.createdAt >= run.createdAt);
    if (stale.runId === run.runId || stale.createdAt >= run.createdAt ||
      (stale.leaseExpiresAt > run.createdAt && !recoveredDuringRun)) continue;
    if (ACTIVE_RUN_STATUSES.has(stale.status) || stale.updatedAt >= run.createdAt) {
      remember("dispatcher_run", stale.runId);
    }
  }
  const kindOrder: Readonly<Record<DispatcherReconciliationResource["resourceKind"], number>> = Object.freeze({
    execution_intent: 0,
    execution_lease: 1,
    dispatcher_run: 2,
  });
  return Object.freeze([...result.values()].sort((left, right) =>
    kindOrder[left.resourceKind] - kindOrder[right.resourceKind] || left.resourceId.localeCompare(right.resourceId, "en")));
}

interface Candidate {
  readonly project: RegisteredProject;
  readonly task: Task;
}
function candidateProjection(candidate: Candidate): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: candidate.project.projectId,
    projectResourceRevision: candidate.project.resourceRevision,
    projectConfigRevision: candidate.project.configRevision,
    taskId: candidate.task.id,
    taskRevision: candidate.task.revision,
  });
}
function candidates(state: ApplicationState): readonly Candidate[] {
  const result: Candidate[] = [];
  for (const task of [...state.domain.tasks].sort((left, right) => left.id.localeCompare(right.id, "en"))) {
    const decision = evaluateTaskEligibility(state.domain, { taskId: task.id, readRevision: `task-revision:${task.revision}` });
    if (!decision.ok || !decision.value.eligible) continue;
    const project = state.projects.find((candidate) => candidate.projectId === task.projectId);
    if (project === undefined) throw new TypeError("Eligible Task lacks a registered Project");
    result.push(Object.freeze({ project, task }));
  }
  return Object.freeze(result);
}
function revalidateCandidateProjects(values: readonly Candidate[], store: PersistenceStore): boolean {
  const checked = new Set<string>();
  try {
    for (const candidate of values) {
      if (checked.has(candidate.project.projectId)) continue;
      revalidateProjectRoot(candidate.project, store.layout.root);
      checked.add(candidate.project.projectId);
    }
    return true;
  } catch {
    return false;
  }
}

function applicationClaimRequest(
  requestId: string,
  correlationId: string,
  actorId: string,
  executionId: string,
  evaluation: AuthorizationEvaluation,
  now: string,
): ApplicationRequestRecord {
  return Object.freeze({
    requestId, correlationId, actorId, action: "execution.claim" as const,
    targetKind: "execution" as const, targetId: executionId, targetRevision: 1,
    result: evaluation.allowed ? "allow" as const : "deny" as const, createdAt: now,
  });
}
function applicationClaimDecision(
  decisionId: string,
  requestId: string,
  actorId: string,
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
  now: string,
): AuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, actorId, action: "execution.claim" as const,
    result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision, projectId: project.projectId,
    resourceRevision: project.resourceRevision, createdAt: now,
  });
}
function applicationClaimAudit(
  auditId: string,
  requestId: string,
  decisionId: string,
  correlationId: string,
  actorId: string,
  executionId: string,
  evaluation: AuthorizationEvaluation,
  now: string,
): ApplicationAuditRecord {
  return Object.freeze({
    auditId, requestId, decisionId,
    eventKind: evaluation.allowed ? "execution.claimed" as const : "authorization.denied" as const,
    result: evaluation.allowed ? "accepted" as const : "denied" as const,
    actorId, correlationId, targetKind: "execution" as const, targetId: executionId,
    targetRevision: 1, reason: evaluation.allowed ? "accepted" : evaluation.reason, createdAt: now,
  });
}
function executionStartRequest(
  requestId: string,
  correlationId: string,
  actorId: string,
  executionId: string,
  evaluation: AuthorizationEvaluation,
  now: string,
): ExecutionOperationRequestRecord {
  return Object.freeze({
    requestId, correlationId, actorId, action: "execution.start" as const,
    targetExecutionId: executionId, targetRevision: 1,
    result: evaluation.allowed ? "allow" as const : "deny" as const, createdAt: now,
  });
}
function executionStartDecision(
  decisionId: string,
  requestId: string,
  actorId: string,
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
  now: string,
): ExecutionAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, actorId, action: "execution.start" as const,
    result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision, projectId: project.projectId,
    resourceRevision: project.resourceRevision, configRevision: project.configRevision, createdAt: now,
  });
}
function executionStartAudit(
  auditId: string,
  requestId: string,
  decisionId: string,
  correlationId: string,
  actorId: string,
  executionId: string,
  evaluation: AuthorizationEvaluation,
  now: string,
): ExecutionOperationAuditRecord {
  return Object.freeze({
    auditId, requestId, decisionId,
    eventKind: evaluation.allowed ? "execution.operation.prepared" as const : "execution.operation.denied" as const,
    result: evaluation.allowed ? "accepted" as const : "denied" as const,
    actorId, correlationId, executionId, executionRevision: 1,
    code: evaluation.allowed ? "prepared" : evaluation.reason, createdAt: now,
  });
}
function dispatcherMemberDenialReason(
  evaluation: AuthorizationEvaluation,
): DispatcherMemberDenialDecisionRecord["reason"] {
  if (evaluation.allowed || evaluation.reason === "allowed") {
    throw new TypeError("Dispatcher member denial requires a denied authorization evaluation");
  }
  return evaluation.reason;
}
function dispatcherMemberDenialRequest(
  requestId: string,
  correlationId: string,
  runId: string,
  memberId: string,
  actorId: string,
  targetExecutionId: string,
  now: string,
): DispatcherMemberDenialRequestRecord {
  return Object.freeze({
    requestId, correlationId, runId, memberId, actorId,
    action: "execution.start" as const, targetExecutionId, targetRevision: 1 as const,
    result: "deny" as const, createdAt: now,
  });
}
function dispatcherMemberDenialDecision(
  decisionId: string,
  requestId: string,
  actorId: string,
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
  now: string,
): DispatcherMemberDenialDecisionRecord {
  return Object.freeze({
    decisionId, requestId, actorId, action: "execution.start" as const,
    result: "deny" as const, reason: dispatcherMemberDenialReason(evaluation),
    policy: evaluation.policy, grantId: evaluation.grantId, grantRevision: evaluation.grantRevision,
    projectId: project.projectId, resourceRevision: project.resourceRevision,
    configRevision: project.configRevision, createdAt: now,
  });
}
function dispatcherMemberDenialAudit(
  auditId: string,
  requestId: string,
  decisionId: string,
  runId: string,
  memberId: string,
  actorId: string,
  correlationId: string,
  targetExecutionId: string,
  evaluation: AuthorizationEvaluation,
  now: string,
): DispatcherMemberDenialAuditRecord {
  return Object.freeze({
    auditId, requestId, decisionId, runId, memberId,
    eventKind: "authorization.denied" as const, result: "denied" as const,
    actorId, correlationId, targetExecutionId, targetRevision: 1 as const,
    code: dispatcherMemberDenialReason(evaluation), createdAt: now,
  });
}
function authorizationBinding(intentId: string, requestId: string, decisionId: string, auditId: string, now: string): ExecutionIntentAuthorizationBindingRecord {
  return Object.freeze({
    bindingId: stableId("authorization-binding", intentId, 1), intentId, bindingRevision: 1,
    phase: "prepare" as const, requestId, decisionId, auditId, priorDecisionId: null, createdAt: now,
  });
}
function startCommandFor(state: ApplicationState, member: DispatcherMemberRecord): ExecutionLoopStartCommand | null {
  if (member.outcome !== "claimed" || member.executionId === null || member.intentId === null) return null;
  const execution = state.executions.find((candidate) => candidate.executionId === member.executionId);
  const intent = state.executionIntents.find((candidate) => candidate.intentId === member.intentId);
  if (execution === undefined || intent === undefined || intent.operationKind !== "start") return null;
  return Object.freeze({
    kind: "execution.start" as const,
    projectId: intent.projectId,
    expectedProjectResourceRevision: intent.projectResourceRevision,
    expectedProjectConfigRevision: intent.projectConfigRevision,
    taskId: intent.taskId,
    expectedTaskRevision: intent.taskRevision,
    inputReference: intent.inputReference,
    executionId: execution.executionId,
    expectedExecutionRevision: intent.executionRevision,
    expectedAttemptNumber: intent.attemptNumber,
    expectedFencingToken: intent.fencingToken,
    idempotencyKey: intent.idempotencyKey,
    policyBindingReference: intent.policyBindingReference,
    requestedDeadline: intent.requestedDeadline,
  });
}
function memberView(state: ApplicationState, member: DispatcherMemberRecord): DispatcherMemberView {
  return Object.freeze({
    memberId: member.memberId, runId: member.runId, ordinal: member.ordinal, taskId: member.taskId,
    lifecycle: member.lifecycle, outcome: member.outcome, executionId: member.executionId,
    intentId: member.intentId, code: member.code, revision: member.revision,
    startCommand: startCommandFor(state, member),
  });
}

function createDispatcherApplicationServiceInternal(
  store: PersistenceStore,
  ingress: DispatcherIngress,
  options: DispatcherApplicationOptions,
  hooks: DispatcherApplicationTestHooks,
): DispatcherApplicationService {
  if (!operationalIdentifier(options.adapterId) || !operationalIdentifier(options.adapterVersion)) {
    throw new TypeError("Dispatcher adapter identity is invalid");
  }
  const schedulerIngressRecord = options.schedulerIngress === undefined
    ? null
    : exactRecord(options.schedulerIngress, ["adapterId", "adapterVersion", "dispatcherTarget"]);
  if (options.schedulerIngress !== undefined && (
    schedulerIngressRecord === null || !operationalIdentifier(schedulerIngressRecord.adapterId) ||
    !operationalIdentifier(schedulerIngressRecord.adapterVersion) ||
    !operationalIdentifier(schedulerIngressRecord.dispatcherTarget)
  )) throw new TypeError("Scheduled dispatcher ingress binding is invalid");
  const schedulerIngress = schedulerIngressRecord === null ? null : Object.freeze({
    adapterId: schedulerIngressRecord.adapterId as string,
    adapterVersion: schedulerIngressRecord.adapterVersion as string,
    dispatcherTarget: schedulerIngressRecord.dispatcherTarget as string,
  });
  const executionLeaseSeconds = options.executionLeaseSeconds ?? 300;
  const operationDeadlineSeconds = options.operationDeadlineSeconds ?? 86400;
  if (!exactPositiveRange(executionLeaseSeconds, 30, 3600) ||
    !exactPositiveRange(operationDeadlineSeconds, 60, 604800)) {
    throw new TypeError("Dispatcher execution lease or deadline policy is invalid");
  }

  const inspect = (runId: string): DispatcherResult<DispatcherRunView> => {
    if (!operationalIdentifier(runId)) return failed("INVALID_INPUT", "Dispatcher run identity is invalid");
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted dispatcher ingress is invalid");
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(state, trusted, store);
      if (runtime !== null) return runtime;
      const run = state.dispatcherRuns.find((candidate) => candidate.runId === runId);
      if (run === undefined) return failed("RUN_NOT_FOUND", "Dispatcher run is not registered");
      if (run.actorId !== trusted.actor.actorId) return failed("AUTHORIZATION_DENIED", "Dispatcher run actor is not current");
      const request = triggerRequest(state, run);
      return succeeded(runView(state, run), request.requestId, request.correlationId, true);
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const start = (value: DispatcherStartCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseStart(value);
    if (command === null) return failed("INVALID_INPUT", "Manual dispatcher trigger is invalid");
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted dispatcher ingress is invalid");
    const idempotencyIdentity = stableId("dispatch-trigger", command.idempotencyKey);
    let state: ApplicationState;
    try { state = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(state, trusted, store);
    if (runtime !== null) return runtime;
    const existingRequest = state.dispatcherTriggerRequests.find((candidate) => candidate.idempotencyKey === idempotencyIdentity);
    if (existingRequest !== undefined) {
      const run = state.dispatcherRuns.find((candidate) => candidate.requestId === existingRequest.requestId);
      if (existingRequest.actorId !== trusted.actor.actorId ||
        existingRequest.requestedLeaseSeconds !== command.leaseDurationSeconds) {
        return failed("IDEMPOTENCY_CONFLICT", "Manual trigger identity is bound to another tuple");
      }
      if (run === undefined) return failed("AUTHORIZATION_DENIED", "The replayed Manual trigger was denied", existingRequest);
      return succeeded(runView(state, run), existingRequest.requestId, existingRequest.correlationId, true);
    }
    const allocated = ids(ingress, ["observation", "request", "correlation", "decision", "audit", "run"]);
    if (allocated === null) return failed("INVALID_INPUT", "Trusted dispatcher identities are invalid");
    const [observationId, requestId, correlationId, decisionId, auditId, runId] = allocated as readonly string[];
    const identity = Object.freeze({ requestId: requestId!, correlationId: correlationId! });
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = persistedRuntimeFailure(current, trusted);
        if (currentRuntime !== null) return Object.freeze({ ...currentRuntime, ...identity });
        const concurrent = current.dispatcherTriggerRequests.find((candidate) => candidate.idempotencyKey === idempotencyIdentity);
        if (concurrent !== undefined) {
          if (concurrent.actorId !== trusted.actor.actorId ||
            concurrent.requestedLeaseSeconds !== command.leaseDurationSeconds) {
            return failed("IDEMPOTENCY_CONFLICT", "Manual trigger raced with another observation", identity);
          }
          const concurrentRun = current.dispatcherRuns.find((candidate) => candidate.requestId === concurrent.requestId);
          if (concurrentRun === undefined) {
            return failed("AUTHORIZATION_DENIED", "The raced Manual trigger was denied", concurrent);
          }
          return succeeded(runView(current, concurrentRun), concurrent.requestId, concurrent.correlationId, true);
        }
        const evaluation = dispatchEvaluation(current, trusted);
        transaction.insertDispatcherTriggerRequest(Object.freeze({
          requestId: requestId!, observationId: observationId!, idempotencyKey: idempotencyIdentity,
          correlationId: correlationId!, actorId: trusted.actor.actorId, action: "dispatch.run" as const,
          workerOwnerId: trusted.ownerId, requestedLeaseSeconds: command.leaseDurationSeconds,
          result: evaluation.allowed ? "allow" as const : "deny" as const, createdAt: trusted.now,
        }));
        transaction.insertDispatcherAuthorizationDecision(Object.freeze({
          decisionId: decisionId!, requestId: requestId!, actorId: trusted.actor.actorId,
          action: "dispatch.run" as const, result: evaluation.allowed ? "allow" as const : "deny" as const,
          reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
          grantRevision: evaluation.grantRevision, createdAt: trusted.now,
        }));
        if (!evaluation.allowed) {
          transaction.insertDispatcherAudit(dispatcherAudit(
            auditId!, requestId!, decisionId!, null, "dispatch.denied", false,
            trusted.actor.actorId, correlationId!, evaluation.reason, trusted.now,
          ));
          return failed("AUTHORIZATION_DENIED", "Current explicit dispatch.run grant did not allow the trigger", identity);
        }
        const run: DispatcherRunRecord = Object.freeze({
          runId: runId!, observationId: observationId!, requestId: requestId!, decisionId: decisionId!,
          actorId: trusted.actor.actorId, ownerId: trusted.ownerId, ownerRevision: 1, runRevision: 1,
          routeKind: "manual" as const, productOperationId: null,
          requestedLeaseSeconds: command.leaseDurationSeconds, heartbeatAt: trusted.now,
          leaseExpiresAt: leaseExpiry(trusted.now, command.leaseDurationSeconds), status: "starting" as const,
          createdAt: trusted.now, updatedAt: trusted.now,
        });
        transaction.insertDispatcherRun(run);
        transaction.insertDispatcherAudit(dispatcherAudit(
          auditId!, requestId!, decisionId!, runId!, "dispatch.started", true,
          trusted.actor.actorId, correlationId!, "started", trusted.now,
        ));
        return succeeded(runView(transaction.read(), readbackRun(transaction, runId!)), requestId!, correlationId!);
      });
      hooks.afterStage?.("trigger-committed");
      return result;
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const deliverScheduled = (value: SchedulerDispatchTrigger): DispatcherResult<DispatcherRunView> => {
    if (schedulerIngress === null) {
      return failed("INVALID_INPUT", "Scheduled dispatcher ingress is not configured");
    }
    const trigger = parseSchedulerDispatchTrigger(value);
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted dispatcher ingress is invalid");
    if (trigger === null) {
      const allocated = ids(ingress, ["observation"]);
      if (allocated === null) return failed("INVALID_INPUT", "Trusted scheduler observation identity is invalid");
      try {
        withApplicationTransaction(store, (transaction) => {
          const runtime = persistedRuntimeFailure(transaction.read(), trusted);
          if (runtime !== null) throw new PersistenceError("REVISION_CONFLICT", "Trusted runtime changed before scheduler observation");
          transaction.insertSchedulerDeliveryObservation(Object.freeze({
            observationId: allocated[0]!,
            requestId: null,
            decisionId: null,
            adapterId: schedulerIngress.adapterId,
            adapterVersion: schedulerIngress.adapterVersion,
            dispatcherTarget: schedulerIngress.dispatcherTarget,
            contractId: SCHEDULER_CONTRACT_ID,
            triggerIdSha256: null,
            claimedDeduplicationSha256: null,
            scheduleId: null,
            configRevision: null,
            scheduledFor: null,
            deliveredAt: null,
            receivedAt: trusted.now,
            disposition: "malformed" as const,
            attachmentRole: "none" as const,
            runId: null,
          }));
        });
        hooks.afterStage?.("scheduled-delivery-malformed-observed");
        return failed("INVALID_INPUT", "Scheduled dispatcher delivery is invalid");
      } catch (error) {
        return mapPersistence(error);
      }
    }
    let preflight: ApplicationState;
    try { preflight = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(preflight, trusted, store);
    if (runtime !== null) return runtime;
    const preflightEvaluation = dispatchEvaluation(preflight, trusted);
    const allocated = ids(ingress, ["observation", "request", "correlation", "decision", "audit", "run"]);
    if (allocated === null) return failed("INVALID_INPUT", "Trusted scheduled dispatcher identities are invalid");
    const [observationId, requestId, correlationId, decisionId, auditId, runId] = allocated as readonly string[];
    const identity = Object.freeze({ requestId: requestId!, correlationId: correlationId! });
    const idempotencyIdentity = stableId("dispatch-scheduled-observation", observationId!);
    try {
      hooks.afterStage?.("scheduled-delivery-preflight");
      const preflightConfiguration = preflight.schedulerConfigurations.find((candidate) =>
        candidate.scheduleId === trigger.scheduleId && candidate.configRevision === trigger.configRevision);
      let projectRootReceipt: ProjectRootIdentity | null | undefined;
      if (preflightConfiguration?.scopeKind === "runtime") {
        projectRootReceipt = null;
      } else if (preflightConfiguration?.projectId !== null && preflightConfiguration?.projectId !== undefined) {
        const preflightProject = preflight.projects.find((candidate) =>
          candidate.projectId === preflightConfiguration.projectId);
        if (preflightProject !== undefined) {
          try {
            projectRootReceipt = revalidateProjectRoot(preflightProject, store.layout.root);
          } catch {
            projectRootReceipt = undefined;
          }
        }
      }
      const result = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = persistedRuntimeFailure(current, trusted);
        if (currentRuntime !== null) return Object.freeze({ ...currentRuntime, ...identity });
        const evaluation = preflightEvaluation.allowed &&
            !allowedDispatchEvaluationIsCurrent(preflight, current, preflightEvaluation)
          ? conservativeDeniedDispatchEvaluation()
          : preflightEvaluation;
        transaction.insertDispatcherTriggerRequest(Object.freeze({
          requestId: requestId!,
          observationId: observationId!,
          idempotencyKey: idempotencyIdentity,
          correlationId: correlationId!,
          actorId: trusted.actor.actorId,
          action: "dispatch.run" as const,
          workerOwnerId: trusted.ownerId,
          requestedLeaseSeconds: executionLeaseSeconds,
          result: evaluation.allowed ? "allow" as const : "deny" as const,
          createdAt: trusted.now,
        }));
        transaction.insertDispatcherAuthorizationDecision(Object.freeze({
          decisionId: decisionId!,
          requestId: requestId!,
          actorId: trusted.actor.actorId,
          action: "dispatch.run" as const,
          result: evaluation.allowed ? "allow" as const : "deny" as const,
          reason: evaluation.reason,
          policy: evaluation.policy,
          grantId: evaluation.grantId,
          grantRevision: evaluation.grantRevision,
          createdAt: trusted.now,
        }));
        const deliveryBase = Object.freeze({
          observationId: observationId!,
          requestId: requestId!,
          decisionId: decisionId!,
          adapterId: schedulerIngress.adapterId,
          adapterVersion: schedulerIngress.adapterVersion,
          dispatcherTarget: schedulerIngress.dispatcherTarget,
          contractId: SCHEDULER_CONTRACT_ID,
          triggerIdSha256: schedulerDeliveryIdentitySha256("trigger", trigger.triggerId),
          claimedDeduplicationSha256: schedulerDeliveryIdentitySha256(
            "claimed_deduplication", trigger.claimedDeduplication,
          ),
          scheduleId: trigger.scheduleId,
          configRevision: trigger.configRevision,
          scheduledFor: trigger.scheduledFor,
          deliveredAt: trigger.observedAt,
          receivedAt: trusted.now,
        });
        if (!evaluation.allowed) {
          transaction.insertDispatcherAudit(dispatcherAudit(
            auditId!, requestId!, decisionId!, null, "dispatch.denied", false,
            trusted.actor.actorId, correlationId!, evaluation.reason, trusted.now,
          ));
          transaction.insertSchedulerDeliveryObservation(Object.freeze({
            ...deliveryBase,
            disposition: "authorization_denied" as const,
            attachmentRole: "none" as const,
            runId: null,
          }));
          return failed("AUTHORIZATION_DENIED", "Current explicit dispatch.run grant did not allow the scheduled trigger", identity);
        }
        const configuration = current.schedulerConfigurations.find((candidate) =>
          candidate.scheduleId === trigger.scheduleId && candidate.configRevision === trigger.configRevision);
        const registration = current.schedulerRegistrations.find((candidate) =>
          candidate.scheduleId === trigger.scheduleId && candidate.configRevision === trigger.configRevision);
        const latestConfigRevision = Math.max(0, ...current.schedulerConfigurations
          .filter((candidate) => candidate.scheduleId === trigger.scheduleId)
          .map((candidate) => candidate.configRevision));
        const configurationRequest = configuration === undefined ? undefined : current.schedulerOperationRequests.find((candidate) =>
          candidate.operationId === configuration.createdByOperationId && candidate.operation === "register");
        const configurationIntent = configurationRequest === undefined ? undefined : current.schedulerIntents.find((candidate) =>
          candidate.requestId === configurationRequest.requestId && candidate.operation === "register");
        if (
          configuration === undefined || registration === undefined || latestConfigRevision !== trigger.configRevision ||
          registration.status !== "active" || registration.enabled !== true ||
          !schedulerConfigurationIsCurrent(current, configuration, projectRootReceipt) ||
          configuration.dispatcherTarget !== schedulerIngress.dispatcherTarget ||
          configurationIntent?.adapterId !== schedulerIngress.adapterId ||
          configurationIntent.adapterVersion !== schedulerIngress.adapterVersion ||
          trigger.scheduledFor > trigger.observedAt || trigger.observedAt > trusted.now
        ) {
          transaction.insertSchedulerDeliveryObservation(Object.freeze({
            ...deliveryBase,
            disposition: "rejected_stale_config" as const,
            attachmentRole: "none" as const,
            runId: null,
          }));
          return failed("STALE_REVISION", "Scheduled dispatcher configuration is not current and active", identity);
        }
        const tuple = current.schedulerScheduledTuples.find((candidate) =>
          candidate.scheduleId === trigger.scheduleId && candidate.configRevision === trigger.configRevision &&
          candidate.scheduledFor === trigger.scheduledFor);
        if (tuple !== undefined) {
          const run = current.dispatcherRuns.find((candidate) => candidate.runId === tuple.runId);
          if (run === undefined) throw new PersistenceError("CORRUPT_ROW", "Scheduled tuple run is absent");
          transaction.insertSchedulerDeliveryObservation(Object.freeze({
            ...deliveryBase,
            disposition: "accepted" as const,
            attachmentRole: "duplicate" as const,
            runId: run.runId,
          }));
          return succeeded(runView(transaction.read(), run), requestId!, correlationId!, true);
        }
        const run: DispatcherRunRecord = Object.freeze({
          runId: runId!,
          observationId: observationId!,
          requestId: requestId!,
          decisionId: decisionId!,
          actorId: trusted.actor.actorId,
          ownerId: trusted.ownerId,
          ownerRevision: 1,
          runRevision: 1,
          routeKind: "scheduled" as const,
          productOperationId: null,
          requestedLeaseSeconds: executionLeaseSeconds,
          heartbeatAt: trusted.now,
          leaseExpiresAt: leaseExpiry(trusted.now, executionLeaseSeconds),
          status: "starting" as const,
          createdAt: trusted.now,
          updatedAt: trusted.now,
        });
        transaction.insertDispatcherRun(run);
        transaction.insertDispatcherAudit(dispatcherAudit(
          auditId!, requestId!, decisionId!, runId!, "dispatch.started", true,
          trusted.actor.actorId, correlationId!, "started", trusted.now,
        ));
        transaction.insertSchedulerDeliveryObservation(Object.freeze({
          ...deliveryBase,
          disposition: "accepted" as const,
          attachmentRole: "canonical" as const,
          runId: run.runId,
        }));
        transaction.insertSchedulerScheduledTuple(Object.freeze({
          scheduleId: trigger.scheduleId,
          configRevision: trigger.configRevision,
          scheduledFor: trigger.scheduledFor,
          canonicalObservationId: observationId!,
          runId: run.runId,
          createdAt: trusted.now,
        }));
        return succeeded(runView(transaction.read(), readbackRun(transaction, run.runId)), requestId!, correlationId!);
      });
      hooks.afterStage?.("scheduled-delivery-committed");
      return result;
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const beginReconciliation = (value: DispatcherBeginReconciliationCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseRunCommand(value, "dispatch.begin_reconciliation");
    if (command === null) return failed("INVALID_INPUT", "Dispatcher reconciliation transition is invalid");
    const trusted = context(ingress);
    const allocated = ids(ingress, ["decision", "audit"]);
    if (trusted === null || allocated === null) return failed("INVALID_INPUT", "Trusted dispatcher continuation is invalid");
    try {
      const preflight = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(preflight, trusted, store);
      if (runtime !== null) return runtime;
    } catch (error) { return mapPersistence(error); }
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const runtime = persistedRuntimeFailure(state, trusted);
        if (runtime !== null) return runtime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        const stale = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
        if (stale !== null) return stale;
        if (run!.status !== "starting") return failed("STALE_REVISION", "Dispatcher run is not starting");
        if (trusted.now <= run!.heartbeatAt || leaseExpiry(trusted.now, run!.requestedLeaseSeconds) <= run!.leaseExpiresAt) {
          return failed("STALE_REVISION", "Dispatcher heartbeat time did not advance");
        }
        const evaluation = persistContinuationAuthorization(
          transaction, state, run!, trusted,
          { decisionId: allocated[0]!, auditId: allocated[1]! }, "dispatch.reconciling", "reconciling",
        );
        if (!evaluation.allowed) return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow reconciliation");
        transaction.advanceDispatcherRun(
          run!.runId, run!.ownerId, run!.ownerRevision, run!.runRevision,
          "starting", "reconciling", trusted.now, leaseExpiry(trusted.now, run!.requestedLeaseSeconds),
        );
        const next = readbackRun(transaction, run!.runId);
        const request = triggerRequest(state, run!);
        return succeeded(runView(transaction.read(), next), request.requestId, request.correlationId);
      });
      hooks.afterStage?.("reconciliation-started");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  const reconciliationInventoryFor = (runId: string): DispatcherResult<readonly DispatcherReconciliationResource[]> => {
    if (!operationalIdentifier(runId)) return failed("INVALID_INPUT", "Dispatcher run identity is invalid");
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted dispatcher ingress is invalid");
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(state, trusted, store);
      if (runtime !== null) return runtime;
      const run = state.dispatcherRuns.find((candidate) => candidate.runId === runId);
      if (run === undefined) return failed("RUN_NOT_FOUND", "Dispatcher run is not registered");
      if (run.actorId !== trusted.actor.actorId) return failed("AUTHORIZATION_DENIED", "Dispatcher run actor is not current");
      if (run.status !== "reconciling") return failed("STALE_REVISION", "Dispatcher run is not reconciling");
      const request = triggerRequest(state, run);
      return succeeded(reconciliationInventory(state, run), request.requestId, request.correlationId, true);
    } catch (error) { return mapPersistence(error); }
  };

  const commitReconciliation = (value: DispatcherCommitReconciliationCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseRunCommand(value, "dispatch.commit_reconciliation", ["resolutions"]);
    const resolutions = command === null ? null : parseResolutions(command.resolutions);
    if (command === null || resolutions === null) return failed("INVALID_INPUT", "Dispatcher reconciliation evidence is invalid");
    const trusted = context(ingress);
    const operation = ids(ingress, ["decision", "audit"]);
    const itemIds = resolutions === null ? null : ids(ingress, resolutions.map(() => "reconciliation_item" as const));
    if (trusted === null || operation === null || itemIds === null) return failed("INVALID_INPUT", "Trusted dispatcher continuation is invalid");
    try {
      const preflight = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(preflight, trusted, store);
      if (runtime !== null) return runtime;
    } catch (error) { return mapPersistence(error); }
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const runtime = persistedRuntimeFailure(state, trusted);
        if (runtime !== null) return runtime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        const stale = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
        if (stale !== null) return stale;
        if (run!.status !== "reconciling") return failed("STALE_REVISION", "Dispatcher run is not reconciling");
        const existing = state.dispatcherReconciliationSummaries.find((candidate) => candidate.runId === run!.runId);
        if (existing !== undefined) {
          const request = triggerRequest(state, run!);
          return succeeded(runView(state, run!), request.requestId, request.correlationId, true);
        }
        const inventory = reconciliationInventory(state, run!);
        const supplied = resolutions.map((item) => ({ resourceKind: item.resourceKind, resourceId: item.resourceId }));
        if (canonicalJson(inventory) !== canonicalJson(supplied)) {
          return failed("RECONCILIATION_INCOMPLETE", "Reconciliation evidence does not cover the complete ordered inventory");
        }
        if (trusted.now <= run!.heartbeatAt || leaseExpiry(trusted.now, run!.requestedLeaseSeconds) <= run!.leaseExpiresAt) {
          return failed("STALE_REVISION", "Dispatcher heartbeat time did not advance");
        }
        const evaluation = persistContinuationAuthorization(
          transaction, state, run!, trusted,
          { decisionId: operation[0]!, auditId: operation[1]! }, "dispatch.reconciling", "reconciled",
        );
        if (!evaluation.allowed) return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow reconciliation commit");
        resolutions.forEach((item, ordinal) => transaction.insertDispatcherReconciliationItem(Object.freeze({
          reconciliationItemId: itemIds[ordinal]!, runId: run!.runId, ordinal,
          resourceKind: item.resourceKind, resourceId: item.resourceId,
          disposition: item.disposition, code: item.code, createdAt: trusted.now,
        })));
        const count = (disposition: DispatcherReconciliationResolution["disposition"]): number =>
          resolutions.filter((item) => item.disposition === disposition).length;
        transaction.insertDispatcherReconciliationSummary(Object.freeze({
          runId: run!.runId, summaryRevision: 1 as const, expectedCount: resolutions.length,
          reconciledCount: count("reconciled"), noEffectCount: count("no_effect"),
          authorizationDeniedCount: count("authorization_denied"), ambiguousCount: count("ambiguous"),
          failedCount: count("failed"), createdAt: trusted.now,
        }));
        transaction.advanceDispatcherRun(
          run!.runId, run!.ownerId, run!.ownerRevision, run!.runRevision,
          "reconciling", "reconciling", trusted.now, leaseExpiry(trusted.now, run!.requestedLeaseSeconds),
        );
        const next = readbackRun(transaction, run!.runId);
        const request = triggerRequest(state, run!);
        return succeeded(runView(transaction.read(), next), request.requestId, request.correlationId);
      });
      hooks.afterStage?.("reconciliation-committed");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  const sealCandidates = (value: DispatcherSealCandidatesCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseRunCommand(value, "dispatch.seal_candidates");
    if (command === null) return failed("INVALID_INPUT", "Dispatcher candidate seal input is invalid");
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted dispatcher ingress is invalid");
    let preflight: ApplicationState;
    try { preflight = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(preflight, trusted, store);
    if (runtime !== null) return runtime;
    const preflightRun = preflight.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
    const stale = runFailure(preflightRun, trusted, command as unknown as DispatcherRunCommand);
    if (stale !== null) return stale;
    if (preflightRun!.status !== "reconciling" ||
      !preflight.dispatcherReconciliationSummaries.some((candidate) => candidate.runId === preflightRun!.runId)) {
      return failed("RUN_NOT_RECONCILED", "Candidate sealing requires a durable reconciliation summary");
    }
    const preflightCandidates = candidates(preflight);
    if (!revalidateCandidateProjects(preflightCandidates, store)) {
      return failed("PROJECT_IDENTITY_CHANGED", "An eligible Project root could not be revalidated");
    }
    const operation = ids(ingress, ["decision", "audit"]);
    const memberIds = ids(ingress, preflightCandidates.map(() => "member" as const));
    if (operation === null || memberIds === null) return failed("INVALID_INPUT", "Trusted dispatcher identities are invalid");
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const runtime = persistedRuntimeFailure(state, trusted);
        if (runtime !== null) return runtime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        const currentFailure = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
        if (currentFailure !== null) return currentFailure;
        const existing = state.dispatcherMemberships.find((candidate) => candidate.runId === run!.runId);
        if (existing !== undefined) {
          const request = triggerRequest(state, run!);
          return succeeded(runView(state, run!), request.requestId, request.correlationId, true);
        }
        if (run!.status !== "reconciling" ||
          !state.dispatcherReconciliationSummaries.some((candidate) => candidate.runId === run!.runId)) {
          return failed("RUN_NOT_RECONCILED", "Candidate sealing requires durable reconciliation");
        }
        const currentCandidates = candidates(state);
        if (canonicalJson(currentCandidates.map(candidateProjection)) !== canonicalJson(preflightCandidates.map(candidateProjection))) {
          return failed("STALE_REVISION", "Complete candidate membership changed before seal CAS");
        }
        if (trusted.now <= run!.heartbeatAt || leaseExpiry(trusted.now, run!.requestedLeaseSeconds) <= run!.leaseExpiresAt) {
          return failed("STALE_REVISION", "Dispatcher heartbeat time did not advance");
        }
        const evaluation = persistContinuationAuthorization(
          transaction, state, run!, trusted,
          { decisionId: operation[0]!, auditId: operation[1]! }, "dispatch.sealed", "sealed",
        );
        if (!evaluation.allowed) return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow candidate sealing");
        transaction.insertDispatcherMembership(Object.freeze({
          runId: run!.runId, membershipRevision: 1, expectedMemberCount: currentCandidates.length,
          sealedAt: trusted.now,
        }));
        currentCandidates.forEach((candidate, ordinal) => transaction.insertDispatcherMember(Object.freeze({
          memberId: memberIds[ordinal]!, runId: run!.runId, membershipRevision: 1, ordinal,
          projectId: candidate.project.projectId, projectResourceRevision: candidate.project.resourceRevision,
          projectConfigRevision: candidate.project.configRevision, taskId: candidate.task.id,
          taskRevision: candidate.task.revision, lifecycle: "pending" as const, outcome: null,
          executionId: null, intentId: null, productOperationId: null, ownerKind: null,
          code: null, revision: 1,
          createdAt: trusted.now, updatedAt: trusted.now,
        })));
        transaction.advanceDispatcherRun(
          run!.runId, run!.ownerId, run!.ownerRevision, run!.runRevision,
          "reconciling", "sweeping", trusted.now, leaseExpiry(trusted.now, run!.requestedLeaseSeconds),
        );
        const next = readbackRun(transaction, run!.runId);
        const request = triggerRequest(state, run!);
        return succeeded(runView(transaction.read(), next), request.requestId, request.correlationId);
      });
      hooks.afterStage?.("membership-sealed");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  const claimAndPrepareMember = (value: DispatcherClaimMemberCommand): DispatcherResult<DispatcherMemberView> => {
    const command = parseRunCommand(value, "dispatch.claim_member", ["expectedMemberRevision", "expectedMembershipRevision", "memberId"]);
    if (command === null || !operationalIdentifier(command.memberId) ||
      !positive(command.expectedMembershipRevision) || !positive(command.expectedMemberRevision)) {
      return failed("INVALID_INPUT", "Dispatcher member claim input is invalid");
    }
    const replayExpectedMemberRevision = command.expectedMemberRevision as number;
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted dispatcher ingress is invalid");
    let preflight: ApplicationState;
    try { preflight = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(preflight, trusted, store);
    if (runtime !== null) return runtime;
    const preflightMember = preflight.dispatcherMembers.find((candidate) => candidate.memberId === command.memberId);
    if (preflightMember === undefined) return failed("MEMBER_NOT_FOUND", "Dispatcher member is not registered");
    if (preflightMember.lifecycle === "terminal") {
      if (preflightMember.runId !== command.runId) return failed("MEMBER_NOT_FOUND", "Dispatcher member is not in this run");
      const run = preflight.dispatcherRuns.find((candidate) => candidate.runId === preflightMember.runId);
      if (run === undefined) return failed("INTEGRITY_FAILURE", "Dispatcher member run is absent");
      const stale = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
      if (stale !== null) return stale;
      if (run.status !== "sweeping" || preflightMember.membershipRevision !== command.expectedMembershipRevision ||
        preflightMember.revision !== replayExpectedMemberRevision + 1) {
        return failed("STALE_REVISION", "Dispatcher terminal member replay tuple is stale");
      }
      const request = triggerRequest(preflight, run);
      return succeeded(memberView(preflight, preflightMember), request.requestId, request.correlationId, true);
    }
    const project = preflight.projects.find((candidate) => candidate.projectId === preflightMember.projectId);
    if (project === undefined) return failed("INTEGRITY_FAILURE", "Dispatcher member Project is absent");
    let projectRootCurrent = true;
    try { revalidateProjectRoot(project, store.layout.root); } catch { projectRootCurrent = false; }
    const allocated = ids(ingress, [
      "decision", "audit",
      "request", "correlation", "decision", "audit", "execution",
      "request", "correlation", "decision", "audit", "operation", "intent",
    ]);
    if (allocated === null) return failed("INVALID_INPUT", "Trusted dispatcher execution identities are invalid");
    const [dispatchDecisionId, dispatchAuditId,
      claimRequestId, claimCorrelationId, claimDecisionId, claimAuditId, executionId,
      startRequestId, startCorrelationId, startDecisionId, startAuditId, operationId, intentId] = allocated;
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentRuntime = persistedRuntimeFailure(state, trusted);
        if (currentRuntime !== null) return currentRuntime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        const currentFailure = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
        if (currentFailure !== null) return currentFailure;
        if (run!.status !== "sweeping") return failed("RUN_NOT_SEALED", "Dispatcher run is not sweeping a sealed membership");
        const member = state.dispatcherMembers.find((candidate) => candidate.memberId === command.memberId);
        if (member === undefined || member.runId !== run!.runId) return failed("MEMBER_NOT_FOUND", "Dispatcher member is not in this run");
        const request = triggerRequest(state, run!);
        if (member.lifecycle === "terminal") {
          if (member.membershipRevision !== command.expectedMembershipRevision ||
            member.revision !== replayExpectedMemberRevision + 1) {
            return failed("STALE_REVISION", "Dispatcher terminal member replay tuple is stale");
          }
          return succeeded(memberView(state, member), request.requestId, request.correlationId, true);
        }
        if (member.membershipRevision !== command.expectedMembershipRevision || member.revision !== command.expectedMemberRevision) {
          return failed("STALE_REVISION", "Dispatcher member revision is stale");
        }
        const dispatch = persistContinuationAuthorization(
          transaction, state, run!, trusted,
          { decisionId: dispatchDecisionId!, auditId: dispatchAuditId! },
          "dispatch.member.resolved", "member_resolved",
        );
        const resolve = (
          outcome: DispatcherMemberOutcome,
          code: DispatcherMemberCode,
          boundExecutionId: string | null = null,
          boundIntentId: string | null = null,
        ): DispatcherResult<DispatcherMemberView> => {
          transaction.resolveDispatcherMember(
            member.memberId, run!.runId, member.membershipRevision, member.revision,
            outcome, boundExecutionId, boundIntentId, code, laterTimestamp(member.updatedAt, trusted.now),
          );
          const readback = transaction.read();
          const resolved = readback.dispatcherMembers.find((candidate) => candidate.memberId === member.memberId);
          if (resolved === undefined) throw new TypeError("Dispatcher member readback is absent");
          return succeeded(memberView(readback, resolved), request.requestId, request.correlationId);
        };
        if (!dispatch.allowed) return resolve("authorization_denied", "dispatch_denied");
        const membership = state.dispatcherMemberships.find((candidate) => candidate.runId === run!.runId);
        if (membership === undefined || membership.membershipRevision !== member.membershipRevision) {
          return failed("RUN_NOT_SEALED", "Dispatcher membership is absent or stale");
        }
        const currentProject = state.projects.find((candidate) => candidate.projectId === member.projectId);
        const task = state.domain.tasks.find((candidate) => candidate.id === member.taskId);
        if (currentProject === undefined || task === undefined || task.projectId !== member.projectId) return resolve("failed", "binding_absent");
        if (!projectRootCurrent || !sameProjectIdentity(currentProject, project)) return resolve("resource_deferred", "project_identity_changed");
        if (currentProject.resourceRevision !== member.projectResourceRevision ||
          currentProject.configRevision !== member.projectConfigRevision) {
          const enabled = state.domain.projects.find((candidate) => candidate.id === currentProject.projectId)?.enabled === true;
          return resolve(enabled ? "ineligible_at_cas" : "policy_deferred", enabled ? "project_revision_changed" : "project_disabled");
        }
        if (state.executionSequences.some((candidate) => candidate.taskId === member.taskId)) {
          return resolve("already_claimed", "execution_sequence_exists");
        }
        if (task.revision !== member.taskRevision) return resolve("ineligible_at_cas", "task_revision_changed");
        const eligibility = evaluateTaskEligibility(state.domain, { taskId: task.id, readRevision: `task-revision:${task.revision}` });
        if (!eligibility.ok || !eligibility.value.eligible) {
          const enabled = state.domain.projects.find((candidate) => candidate.id === currentProject.projectId)?.enabled === true;
          return resolve(enabled ? "ineligible_at_cas" : "policy_deferred", enabled ? "domain_ineligible" : "project_disabled");
        }
        const taskExecutionIds = new Set(state.executions.filter((candidate) => candidate.taskId === task.id).map((candidate) => candidate.executionId));
        const taskIntentIds = new Set(state.executionIntents.filter((candidate) => candidate.taskId === task.id).map((candidate) => candidate.intentId));
        const blocked = state.dispatcherReconciliationItems.some((item) => item.runId === run!.runId &&
          (item.disposition === "authorization_denied" || item.disposition === "ambiguous" || item.disposition === "failed") &&
          ((item.resourceKind === "execution_lease" && taskExecutionIds.has(item.resourceId)) ||
            (item.resourceKind === "execution_intent" && taskIntentIds.has(item.resourceId)) ||
            (item.resourceKind === "dispatcher_run" && state.dispatcherMembers.some((candidate) =>
              candidate.runId === item.resourceId && candidate.taskId === task.id))));
        if (blocked) return resolve("reconciliation_required", "resource_reconciliation_incomplete");
        const claimEvaluation = projectEvaluation(state, trusted, "execution.claim", currentProject);
        if (!claimEvaluation.allowed) {
          transaction.insertRequest(applicationClaimRequest(
            claimRequestId!, claimCorrelationId!, trusted.actor.actorId, executionId!, claimEvaluation, trusted.now,
          ));
          transaction.insertDecision(applicationClaimDecision(
            claimDecisionId!, claimRequestId!, trusted.actor.actorId, currentProject, claimEvaluation, trusted.now,
          ));
          transaction.insertAudit(applicationClaimAudit(
            claimAuditId!, claimRequestId!, claimDecisionId!, claimCorrelationId!, trusted.actor.actorId,
            executionId!, claimEvaluation, trusted.now,
          ));
          return resolve("authorization_denied", "execution_claim_denied");
        }
        const startEvaluation = projectEvaluation(state, trusted, "execution.start", currentProject);
        if (!startEvaluation.allowed) {
          transaction.insertDispatcherMemberDenialRequest(dispatcherMemberDenialRequest(
            startRequestId!, startCorrelationId!, run!.runId, member.memberId,
            trusted.actor.actorId, executionId!, trusted.now,
          ));
          transaction.insertDispatcherMemberDenialDecision(dispatcherMemberDenialDecision(
            startDecisionId!, startRequestId!, trusted.actor.actorId,
            currentProject, startEvaluation, trusted.now,
          ));
          transaction.insertDispatcherMemberDenialAudit(dispatcherMemberDenialAudit(
            startAuditId!, startRequestId!, startDecisionId!, run!.runId, member.memberId,
            trusted.actor.actorId, startCorrelationId!, executionId!, startEvaluation, trusted.now,
          ));
          return resolve("authorization_denied", "execution_start_denied");
        }
        const transition = transitionTask(state.domain, Object.freeze({
          taskId: task.id,
          event: "claim_accepted" as const,
          targetState: "running" as const,
          payload: Object.freeze({
            externalAcceptance: Object.freeze({
              taskId: task.id, taskRevision: task.revision,
              authorization: "accepted" as const, reliability: "accepted" as const,
            }),
          }),
        }));
        if (!transition.ok) return resolve("ineligible_at_cas", "domain_claim_rejected");
        transaction.insertRequest(applicationClaimRequest(
          claimRequestId!, claimCorrelationId!, trusted.actor.actorId, executionId!, claimEvaluation, trusted.now,
        ));
        transaction.insertDecision(applicationClaimDecision(
          claimDecisionId!, claimRequestId!, trusted.actor.actorId, currentProject, claimEvaluation, trusted.now,
        ));
        transaction.insertExecutionSequence(Object.freeze({
          taskId: task.id, lastAttemptNumber: 1, currentFencingToken: 1, revision: 1,
        }));
        const execution: ExecutionAttempt = Object.freeze({
          executionId: executionId!, taskId: task.id, attemptNumber: 1, operationKind: "claim" as const,
          status: "active" as const, idempotencyKey: stableId("dispatch-claim", run!.runId, member.memberId),
          ownerId: trusted.executionOwnerId, requestedLeaseSeconds: executionLeaseSeconds,
          predecessorExecutionRevision: null, predecessorLeaseRevision: null, predecessorFencingToken: null,
          leaseRevision: 1, leaseExpiresAt: leaseExpiry(trusted.now, executionLeaseSeconds),
          fencingToken: 1, revision: 1, expectedTaskRevision: task.revision,
          preTaskRevision: task.revision, postTaskRevision: task.revision + 1,
          projectResourceRevision: currentProject.resourceRevision, projectConfigRevision: currentProject.configRevision,
          requestId: claimRequestId!, decisionId: claimDecisionId!, supersedesExecutionId: null,
          supersededByExecutionId: null, createdAt: trusted.now, updatedAt: trusted.now,
        });
        transaction.insertExecutionAttempt(execution);
        transaction.writeDomain(state.domain, transition.value);
        transaction.insertAudit(applicationClaimAudit(
          claimAuditId!, claimRequestId!, claimDecisionId!, claimCorrelationId!, trusted.actor.actorId,
          executionId!, claimEvaluation, trusted.now,
        ));
        transaction.insertExecutionOperationRequest(executionStartRequest(
          startRequestId!, startCorrelationId!, trusted.actor.actorId, executionId!, startEvaluation, trusted.now,
        ));
        transaction.insertExecutionAuthorizationDecision(executionStartDecision(
          startDecisionId!, startRequestId!, trusted.actor.actorId, currentProject, startEvaluation, trusted.now,
        ));
        transaction.insertExecutionOperationAudit(executionStartAudit(
          startAuditId!, startRequestId!, startDecisionId!, startCorrelationId!, trusted.actor.actorId,
          executionId!, startEvaluation, trusted.now,
        ));
        const intent: ExecutionOperationIntent = Object.freeze({
          intentId: intentId!, operationId: operationId!,
          idempotencyKey: stableId("dispatch-start", run!.runId, member.memberId),
          operationKind: "start" as const, action: "execution.start" as const, state: "pending" as const,
          revision: 1, actorId: trusted.actor.actorId, requestId: startRequestId!, decisionId: startDecisionId!,
          currentAuthorizationDecisionId: startDecisionId!, authorizationBindingRevision: 1, confirmationId: null,
          projectId: currentProject.projectId, projectResourceRevision: currentProject.resourceRevision,
          projectConfigRevision: currentProject.configRevision, taskId: task.id, taskRevision: task.revision + 1,
          inputReference: `task-sha256:${sha256(task.body)}`, executionId: executionId!, executionRevision: 1,
          attemptNumber: 1, fencingToken: 1, sourceExecutionId: null, sourceExecutionRevision: null,
          sourceAttemptNumber: null, sourceFencingToken: null, sourceObservationNumber: null,
          contractId: EXECUTION_CONTRACT_ID, backendKind: "manual-local" as const,
          adapterId: options.adapterId, adapterVersion: options.adapterVersion,
          policyBindingReference: stableId("dispatch-policy", run!.runId, member.memberId), workspaceMode: "none" as const,
          workspaceContractId: null, workspaceId: null, workspaceGeneration: null, workspaceRevision: null,
          workspaceRootKey: null, ownershipBindingSha256: null, workspaceHeadObjectId: null,
          backendExecutionId: null, threadId: null, previousReceiptId: null, expectedJournalRevision: null,
          requestedDeadline: leaseExpiry(trusted.now, operationDeadlineSeconds), continuationReference: null,
          requiredActionReceiptId: null, expectedLifecycle: null, reasonCode: null, reportId: null,
          reportOperation: null, reportCode: null, evidenceReference: null, lastObservationNumber: 0,
          lastErrorCategory: null, lastErrorCode: null, lastErrorRetryable: null, lastErrorAmbiguous: null,
          retryAfter: null, retryCount: 0, createdAt: trusted.now, updatedAt: trusted.now,
        });
        transaction.insertExecutionIntent(intent);
        transaction.insertExecutionIntentAuthorizationBinding(authorizationBinding(
          intent.intentId, startRequestId!, startDecisionId!, startAuditId!, trusted.now,
        ));
        return resolve("claimed", "claimed_and_prepared", execution.executionId, intent.intentId);
      });
      hooks.afterStage?.("member-resolved");
      if (result.ok && result.value.outcome === "claimed") hooks.afterStage?.("claim-start-intent-committed");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  const heartbeat = (value: DispatcherHeartbeatCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseRunCommand(value, "dispatch.heartbeat", ["expectedStatus"]);
    if (command === null || (command.expectedStatus !== "starting" && command.expectedStatus !== "reconciling" && command.expectedStatus !== "sweeping")) {
      return failed("INVALID_INPUT", "Dispatcher heartbeat input is invalid");
    }
    const trusted = context(ingress);
    const operation = ids(ingress, ["decision", "audit"]);
    if (trusted === null || operation === null) return failed("INVALID_INPUT", "Trusted dispatcher continuation is invalid");
    try {
      const preflight = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(preflight, trusted, store);
      if (runtime !== null) return runtime;
    } catch (error) { return mapPersistence(error); }
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const runtime = persistedRuntimeFailure(state, trusted);
        if (runtime !== null) return runtime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        const stale = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
        if (stale !== null) return stale;
        if (run!.status !== command.expectedStatus || trusted.now <= run!.heartbeatAt ||
          leaseExpiry(trusted.now, run!.requestedLeaseSeconds) <= run!.leaseExpiresAt) {
          return failed("STALE_REVISION", "Dispatcher heartbeat did not match a forward current run");
        }
        const evaluation = persistContinuationAuthorization(
          transaction, state, run!, trusted,
          { decisionId: operation[0]!, auditId: operation[1]! }, "dispatch.heartbeat", "heartbeat",
        );
        if (!evaluation.allowed) return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow heartbeat");
        transaction.advanceDispatcherRun(
          run!.runId, run!.ownerId, run!.ownerRevision, run!.runRevision, run!.status, run!.status,
          trusted.now, leaseExpiry(trusted.now, run!.requestedLeaseSeconds),
        );
        const next = readbackRun(transaction, run!.runId);
        const request = triggerRequest(state, run!);
        return succeeded(runView(transaction.read(), next), request.requestId, request.correlationId);
      });
      hooks.afterStage?.("heartbeat-committed");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  const takeover = (value: DispatcherTakeoverCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseRunCommand(value, "dispatch.takeover", ["expectedOwnerId", "expectedStatus"]);
    if (command === null || !operationalIdentifier(command.expectedOwnerId) ||
      (command.expectedStatus !== "starting" && command.expectedStatus !== "reconciling" && command.expectedStatus !== "sweeping")) {
      return failed("INVALID_INPUT", "Dispatcher takeover input is invalid");
    }
    const trusted = context(ingress);
    const operation = ids(ingress, ["decision", "audit"]);
    if (trusted === null || operation === null) return failed("INVALID_INPUT", "Trusted dispatcher takeover is invalid");
    try {
      const preflight = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(preflight, trusted, store);
      if (runtime !== null) return runtime;
    } catch (error) { return mapPersistence(error); }
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const runtime = persistedRuntimeFailure(state, trusted);
        if (runtime !== null) return runtime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        if (run === undefined) return failed("RUN_NOT_FOUND", "Dispatcher run is not registered");
        if (run.actorId !== trusted.actor.actorId) return failed("AUTHORIZATION_DENIED", "Dispatcher run actor is not current");
        if (run.ownerId !== command.expectedOwnerId || run.ownerRevision !== command.expectedOwnerRevision ||
          run.runRevision !== command.expectedRunRevision || run.status !== command.expectedStatus) {
          return failed("STALE_REVISION", "Dispatcher takeover tuple is stale");
        }
        if (trusted.now < run.leaseExpiresAt) return failed("LEASE_NOT_EXPIRED", "Dispatcher run lease has not expired");
        if (trusted.ownerId === run.ownerId) return failed("STALE_OWNER", "Dispatcher takeover requires a new trusted worker owner");
        const evaluation = persistContinuationAuthorization(
          transaction, state, run, trusted,
          { decisionId: operation[0]!, auditId: operation[1]! }, "dispatch.taken_over", "taken_over",
        );
        if (!evaluation.allowed) return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow takeover");
        transaction.takeOverDispatcherRun(
          run.runId, run.ownerId, trusted.ownerId, run.ownerRevision, run.runRevision, run.status,
          trusted.now, leaseExpiry(trusted.now, run.requestedLeaseSeconds),
        );
        const next = readbackRun(transaction, run.runId);
        const request = triggerRequest(state, run);
        return succeeded(runView(transaction.read(), next), request.requestId, request.correlationId);
      });
      hooks.afterStage?.("takeover-committed");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  const finalize = (value: DispatcherFinalizeCommand): DispatcherResult<DispatcherRunView> => {
    const command = parseRunCommand(value, "dispatch.finalize");
    if (command === null) return failed("INVALID_INPUT", "Dispatcher finalization input is invalid");
    const trusted = context(ingress);
    const operation = ids(ingress, ["decision", "audit"]);
    if (trusted === null || operation === null) return failed("INVALID_INPUT", "Trusted dispatcher finalization is invalid");
    try {
      const preflight = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(preflight, trusted, store);
      if (runtime !== null) return runtime;
    } catch (error) { return mapPersistence(error); }
    try {
      const result = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const runtime = persistedRuntimeFailure(state, trusted);
        if (runtime !== null) return runtime;
        const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
        const stale = runFailure(run, trusted, command as unknown as DispatcherRunCommand);
        if (stale !== null) return stale;
        if (run!.status !== "sweeping") return failed("RUN_NOT_SEALED", "Dispatcher run is not sweeping");
        const existing = state.dispatcherRunSummaries.find((candidate) => candidate.runId === run!.runId);
        if (existing !== undefined) {
          const request = triggerRequest(state, run!);
          return succeeded(runView(state, run!), request.requestId, request.correlationId, true);
        }
        const reconciliation = state.dispatcherReconciliationSummaries.find((candidate) => candidate.runId === run!.runId);
        const membership = state.dispatcherMemberships.find((candidate) => candidate.runId === run!.runId);
        const members = state.dispatcherMembers.filter((candidate) => candidate.runId === run!.runId)
          .sort((left, right) => left.ordinal - right.ordinal);
        if (reconciliation === undefined || membership === undefined || members.length !== membership.expectedMemberCount ||
          members.some((member, ordinal) => member.ordinal !== ordinal || member.lifecycle !== "terminal" ||
            member.membershipRevision !== membership.membershipRevision || member.outcome === null)) {
          return failed("RECONCILIATION_INCOMPLETE", "Dispatcher terminal summary requires every sealed member terminal");
        }
        if (members.some((member) => member.outcome === "claimed" && (
          member.ownerKind === "execution-start-intent"
            ? state.executionIntents.find((intent) => intent.intentId === member.intentId)?.state !== "finalized"
            : !state.codexProductOperations.some((operation) =>
              operation.operationId === member.productOperationId && operation.stage === "workspace_refreshed" &&
              (operation.lifecycle === "active" || operation.lifecycle === "finalized")
            )
        ))) {
          return failed("RECONCILIATION_INCOMPLETE", "Dispatcher terminal summary requires every claimed start intent finalized");
        }
        if (trusted.now <= run!.heartbeatAt || leaseExpiry(trusted.now, run!.requestedLeaseSeconds) <= run!.leaseExpiresAt) {
          return failed("STALE_REVISION", "Dispatcher heartbeat time did not advance");
        }
        const evaluation = persistContinuationAuthorization(
          transaction, state, run!, trusted,
          { decisionId: operation[0]!, auditId: operation[1]! }, "dispatch.terminal", "terminal",
        );
        if (!evaluation.allowed) return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow finalization");
        const count = (outcome: DispatcherMemberOutcome): number => members.filter((member) => member.outcome === outcome).length;
        const failedCount = count("failed");
        const reconciliationFailures = reconciliation.failedCount + reconciliation.ambiguousCount + reconciliation.authorizationDeniedCount;
        const terminalStatus: "completed" | "partial" | "failed" =
          (members.length > 0 && failedCount === members.length) || (members.length === 0 && reconciliationFailures > 0)
            ? "failed"
            : failedCount > 0 || reconciliationFailures > 0 || members.some((member) =>
              member.outcome !== "claimed" && member.outcome !== "already_claimed")
              ? "partial" : "completed";
        transaction.insertDispatcherRunSummary(Object.freeze({
          runId: run!.runId, membershipRevision: membership.membershipRevision,
          expectedMemberCount: membership.expectedMemberCount, claimedCount: count("claimed"),
          alreadyClaimedCount: count("already_claimed"), ineligibleCount: count("ineligible_at_cas"),
          authorizationDeniedCount: count("authorization_denied"), policyDeferredCount: count("policy_deferred"),
          resourceDeferredCount: count("resource_deferred"), reconciliationRequiredCount: count("reconciliation_required"),
          failedCount, terminalStatus, ownerRevision: run!.ownerRevision, runRevision: run!.runRevision + 1,
          createdAt: trusted.now,
        }));
        transaction.advanceDispatcherRun(
          run!.runId, run!.ownerId, run!.ownerRevision, run!.runRevision,
          "sweeping", terminalStatus, trusted.now, leaseExpiry(trusted.now, run!.requestedLeaseSeconds),
        );
        const next = readbackRun(transaction, run!.runId);
        const request = triggerRequest(state, run!);
        return succeeded(runView(transaction.read(), next), request.requestId, request.correlationId);
      });
      hooks.afterStage?.("summary-committed");
      return result;
    } catch (error) { return mapPersistence(error); }
  };

  return Object.freeze({
    start,
    deliverScheduled,
    inspect,
    beginReconciliation,
    reconciliationInventory: reconciliationInventoryFor,
    commitReconciliation,
    sealCandidates,
    claimAndPrepareMember,
    heartbeat,
    takeover,
    finalize,
  });
}

export function createDispatcherApplicationService(
  store: PersistenceStore,
  ingress: DispatcherIngress,
  options: DispatcherApplicationOptions,
): DispatcherApplicationService {
  return createDispatcherApplicationServiceInternal(store, ingress, options, Object.freeze({}));
}

export function createDispatcherApplicationServiceWithHooks(
  store: PersistenceStore,
  ingress: DispatcherIngress,
  options: DispatcherApplicationOptions,
  hooks: DispatcherApplicationTestHooks,
): DispatcherApplicationService {
  return createDispatcherApplicationServiceInternal(store, ingress, options, hooks);
}

/** Internal product-composition factory; intentionally omitted from src/index.ts. */
export function createCodexTargetedDispatcherService(
  store: PersistenceStore,
  ingress: DispatcherIngress,
  options: Pick<DispatcherApplicationOptions, "executionLeaseSeconds"> = Object.freeze({}),
): CodexTargetedDispatcherService {
  const executionLeaseSeconds = options.executionLeaseSeconds ?? 300;
  if (!exactPositiveRange(executionLeaseSeconds, 30, 3_600)) {
    throw new TypeError("Codex targeted dispatcher lease is invalid");
  }

  const productOperation = (
    state: ApplicationState,
    operationId: string,
  ): CodexProductOperationRecord | DispatcherFailure => {
    if (!operationalIdentifier(operationId)) return failed("INVALID_INPUT", "Codex product operation identity is invalid");
    const operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
    if (operation === undefined) {
      return failed("RUN_NOT_FOUND", "Codex product operation is absent");
    }
    return operation;
  };

  const targetedLeaseSeconds = (
    state: ApplicationState,
    operation: CodexProductOperationRecord,
    routeKind: "codex-start" | "codex-continuation",
  ): number | null => routeKind === "codex-start"
    ? operation.commandKind === "codex.dispatch-run" ? operation.leaseDurationSeconds : null
    : operation.commandKind === "execution.resume" || operation.commandKind === "execution.retry"
      ? state.executions.find((candidate) => candidate.executionId === operation.sourceExecutionId)?.requestedLeaseSeconds ?? null
      : null;

  const createTargetedRun = (
    operationId: string,
    routeKind: "codex-start" | "codex-continuation",
  ): DispatcherResult<DispatcherRunView> => {
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted Codex dispatcher ingress is invalid");
    try {
      const preflight = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(preflight, trusted, store);
      if (runtime !== null) return runtime;
      const selected = productOperation(preflight, operationId);
      if ("ok" in selected) return selected;
      const operation = selected;
      const leaseSeconds = targetedLeaseSeconds(preflight, operation, routeKind);
      if (operation.actorId !== trusted.actor.actorId || operation.lifecycle !== "active" || operation.stage !== "prepared" ||
        leaseSeconds === null) {
        return failed("STALE_REVISION", "Codex product operation is not ready for targeted dispatch");
      }
      const priorRun = preflight.dispatcherRuns.find((candidate) => candidate.runId === operation.runId);
      if (priorRun !== undefined) {
        if (priorRun.productOperationId !== operation.operationId || priorRun.routeKind !== routeKind) {
          return failed("IDEMPOTENCY_CONFLICT", "Codex run identity belongs to another route");
        }
        const request = triggerRequest(preflight, priorRun);
        return succeeded(runView(preflight, priorRun), request.requestId, request.correlationId, true);
      }
      const requestId = stableId("request", operation.operationId, "targeted-dispatch");
      const correlationId = stableId("correlation", operation.operationId, "targeted-dispatch");
      const decisionId = stableId("decision", operation.operationId, "targeted-dispatch");
      const auditId = stableId("audit", operation.operationId, "targeted-dispatch");
      const observationId = stableId("observation", operation.operationId, "targeted-dispatch");
      const identity = Object.freeze({ requestId, correlationId });
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentRuntime = persistedRuntimeFailure(state, trusted);
        if (currentRuntime !== null) return Object.freeze({ ...currentRuntime, ...identity });
        const current = productOperation(state, operation.operationId);
        if ("ok" in current) return current;
        const currentLeaseSeconds = targetedLeaseSeconds(state, current, routeKind);
        if (current.actorId !== trusted.actor.actorId || current.lifecycle !== "active" || current.stage !== "prepared" ||
          currentLeaseSeconds === null) {
          return failed("STALE_REVISION", "Codex product operation changed before targeted run creation", identity);
        }
        const racedRun = state.dispatcherRuns.find((candidate) => candidate.runId === current.runId);
        if (racedRun !== undefined) {
          if (racedRun.productOperationId !== current.operationId || racedRun.routeKind !== routeKind) {
            return failed("IDEMPOTENCY_CONFLICT", "Codex run identity raced with another route", identity);
          }
          return succeeded(runView(state, racedRun), requestId, correlationId, true);
        }
        const priorRequest = state.dispatcherTriggerRequests.find((candidate) => candidate.requestId === requestId);
        if (priorRequest !== undefined) {
          return failed(priorRequest.result === "deny" ? "AUTHORIZATION_DENIED" : "INTEGRITY_FAILURE",
            "Codex targeted dispatch has an incomplete prior observation", identity);
        }
        const evaluation = dispatchEvaluation(state, trusted);
        transaction.insertDispatcherTriggerRequest(Object.freeze({
          requestId,
          observationId,
          idempotencyKey: stableId("codex-dispatch", current.operationId),
          correlationId,
          actorId: trusted.actor.actorId,
          action: "dispatch.run" as const,
          workerOwnerId: trusted.ownerId,
          requestedLeaseSeconds: currentLeaseSeconds,
          result: evaluation.allowed ? "allow" as const : "deny" as const,
          createdAt: trusted.now,
        }));
        transaction.insertDispatcherAuthorizationDecision(Object.freeze({
          decisionId,
          requestId,
          actorId: trusted.actor.actorId,
          action: "dispatch.run" as const,
          result: evaluation.allowed ? "allow" as const : "deny" as const,
          reason: evaluation.reason,
          policy: evaluation.policy,
          grantId: evaluation.grantId,
          grantRevision: evaluation.grantRevision,
          createdAt: trusted.now,
        }));
        if (!evaluation.allowed) {
          transaction.insertDispatcherAudit(dispatcherAudit(
            auditId, requestId, decisionId, null, "dispatch.denied", false,
            trusted.actor.actorId, correlationId, evaluation.reason, trusted.now,
          ));
          return failed("AUTHORIZATION_DENIED", "Current dispatch.run grant did not allow Codex targeted dispatch", identity);
        }
        const run: DispatcherRunRecord = Object.freeze({
          runId: current.runId,
          observationId,
          requestId,
          decisionId,
          actorId: trusted.actor.actorId,
          ownerId: trusted.ownerId,
          ownerRevision: 1,
          runRevision: 1,
          routeKind,
          productOperationId: current.operationId,
          requestedLeaseSeconds: currentLeaseSeconds,
          heartbeatAt: trusted.now,
          leaseExpiresAt: leaseExpiry(trusted.now, currentLeaseSeconds),
          status: "sweeping" as const,
          createdAt: trusted.now,
          updatedAt: trusted.now,
        });
        transaction.insertDispatcherRun(run);
        transaction.insertDispatcherAudit(dispatcherAudit(
          auditId, requestId, decisionId, run.runId, "dispatch.started", true,
          trusted.actor.actorId, correlationId, "started", trusted.now,
        ));
        transaction.insertDispatcherReconciliationSummary(Object.freeze({
          runId: run.runId,
          summaryRevision: 1 as const,
          expectedCount: 0,
          reconciledCount: 0,
          noEffectCount: 0,
          authorizationDeniedCount: 0,
          ambiguousCount: 0,
          failedCount: 0,
          createdAt: trusted.now,
        }));
        transaction.insertDispatcherMembership(Object.freeze({
          runId: run.runId,
          membershipRevision: 1,
          expectedMemberCount: 1,
          sealedAt: trusted.now,
        }));
        transaction.insertDispatcherMember(Object.freeze({
          memberId: current.memberId,
          runId: run.runId,
          membershipRevision: 1,
          ordinal: 0,
          projectId: current.projectId,
          projectResourceRevision: current.expectedProjectResourceRevision,
          projectConfigRevision: current.expectedProjectConfigRevision,
          taskId: current.taskId,
          taskRevision: current.expectedTaskRevision,
          lifecycle: "pending" as const,
          outcome: null,
          executionId: null,
          intentId: null,
          productOperationId: null,
          ownerKind: null,
          code: null,
          revision: 1,
          createdAt: trusted.now,
          updatedAt: trusted.now,
        }));
        return succeeded(runView(transaction.read(), run), requestId, correlationId);
      });
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const createStartRun = (operationId: string): DispatcherResult<DispatcherRunView> =>
    createTargetedRun(operationId, "codex-start");

  const createContinuationRun = (operationId: string): DispatcherResult<DispatcherRunView> =>
    createTargetedRun(operationId, "codex-continuation");

  const reopenTargetedRun = (
    operationId: string,
    trusted: TrustedContext,
  ): DispatcherResult<DispatcherRunView> => {
    let state: ApplicationState;
    try { state = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(state, trusted, store);
    if (runtime !== null) return runtime;
    const selected = productOperation(state, operationId);
    if ("ok" in selected) return selected;
    const run = state.dispatcherRuns.find((candidate) => candidate.runId === selected.runId);
    if (run === undefined) return failed("RUN_NOT_FOUND", "Codex targeted run is absent");
    const expectedRoute = selected.commandKind === "codex.dispatch-run" ? "codex-start" : "codex-continuation";
    if (run.productOperationId !== selected.operationId || run.routeKind !== expectedRoute ||
      run.actorId !== trusted.actor.actorId) {
      return failed("STALE_REVISION", "Codex targeted run ownership tuple is inconsistent");
    }
    const request = triggerRequest(state, run);
    if (["completed", "partial", "failed", "interrupted"].includes(run.status) ||
      (run.ownerId === trusted.ownerId && trusted.now < run.leaseExpiresAt)) {
      return succeeded(runView(state, run), request.requestId, request.correlationId, true);
    }
    if (run.ownerId === trusted.ownerId) {
      return failed("LEASE_EXPIRED", "Codex targeted run requires a fresh worker owner after lease expiry");
    }
    if (trusted.now < run.leaseExpiresAt) {
      return failed("LEASE_NOT_EXPIRED", "Codex targeted run is still owned by a live worker");
    }
    const lifecycle = createDispatcherApplicationServiceInternal(store, ingress, Object.freeze({
      adapterId: "openai-codex-sdk-local",
      adapterVersion: "0.153.2",
      executionLeaseSeconds,
    }), Object.freeze({}));
    return lifecycle.takeover(Object.freeze({
      kind: "dispatch.takeover" as const,
      runId: run.runId,
      expectedOwnerId: run.ownerId,
      expectedOwnerRevision: run.ownerRevision,
      expectedRunRevision: run.runRevision,
      expectedStatus: run.status as "starting" | "reconciling" | "sweeping",
    }));
  };

  const claimStartMember = (operationId: string): DispatcherResult<DispatcherMemberView> => {
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted Codex dispatcher ingress is invalid");
    const reopened = reopenTargetedRun(operationId, trusted);
    if (!reopened.ok) return reopened;
    let preflight: ApplicationState;
    try { preflight = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(preflight, trusted, store);
    if (runtime !== null) return runtime;
    const selected = productOperation(preflight, operationId);
    if ("ok" in selected) return selected;
    const operation = selected;
    const run = preflight.dispatcherRuns.find((candidate) => candidate.runId === operation.runId);
    const member = preflight.dispatcherMembers.find((candidate) => candidate.memberId === operation.memberId);
    const project = preflight.projects.find((candidate) => candidate.projectId === operation.projectId);
    if (run === undefined || member === undefined || project === undefined) {
      return failed("RUN_NOT_SEALED", "Codex targeted run is incomplete");
    }
    if (member.lifecycle === "terminal") {
      const request = triggerRequest(preflight, run);
      return succeeded(memberView(preflight, member), request.requestId, request.correlationId, true);
    }
    let rootCurrent: ProjectRootIdentity | null = null;
    try { rootCurrent = revalidateProjectRoot(project, store.layout.root); } catch { rootCurrent = null; }
    const request = triggerRequest(preflight, run);
    const identity = Object.freeze({ requestId: request.requestId, correlationId: request.correlationId });
    try {
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentRuntime = persistedRuntimeFailure(state, trusted);
        if (currentRuntime !== null) return Object.freeze({ ...currentRuntime, ...identity });
        const current = productOperation(state, operation.operationId);
        if ("ok" in current) return current;
        const currentRun = state.dispatcherRuns.find((candidate) => candidate.runId === current.runId);
        const currentMember = state.dispatcherMembers.find((candidate) => candidate.memberId === current.memberId);
        const currentProject = state.projects.find((candidate) => candidate.projectId === current.projectId);
        const currentTask = state.domain.tasks.find((candidate) => candidate.id === current.taskId);
        if (currentRun === undefined || currentMember === undefined || currentProject === undefined || currentTask === undefined) {
          return failed("INTEGRITY_FAILURE", "Codex targeted claim lineage is absent", identity);
        }
        if (currentMember.lifecycle === "terminal") {
          return succeeded(memberView(state, currentMember), request.requestId, request.correlationId, true);
        }
        if (current.lifecycle !== "active" || current.stage !== "prepared" ||
          currentRun.productOperationId !== current.operationId || currentRun.routeKind !== "codex-start" ||
          currentRun.ownerId !== trusted.ownerId || currentRun.actorId !== trusted.actor.actorId ||
          currentRun.status !== "sweeping" || currentRun.leaseExpiresAt <= trusted.now ||
          currentMember.runId !== currentRun.runId || currentMember.membershipRevision !== 1 || currentMember.revision !== 1) {
          return failed("STALE_REVISION", "Codex targeted claim tuple is stale", identity);
        }
        const resolve = (
          outcome: DispatcherMemberOutcome,
          code: DispatcherMemberCode,
        ): DispatcherResult<DispatcherMemberView> => {
          transaction.resolveDispatcherMember(
            currentMember.memberId, currentRun.runId, currentMember.membershipRevision, currentMember.revision,
            outcome, null, null, code, laterTimestamp(currentMember.updatedAt, trusted.now),
          );
          const readback = transaction.read();
          const terminal = readback.dispatcherMembers.find((candidate) => candidate.memberId === currentMember.memberId);
          if (terminal === undefined) throw new TypeError("Codex targeted member resolution disappeared");
          return succeeded(memberView(readback, terminal), request.requestId, request.correlationId);
        };
        const profile = state.codexProfiles.find((candidate) => candidate.profileId === current.profileId);
        if (profile === undefined || profile.status !== "active" || profile.revision !== current.profileRevision ||
          profile.constructorConfigSha256 !== current.constructorConfigSha256) {
          return resolve("authorization_denied", "codex_profile_inactive");
        }
        if (rootCurrent === null || !sameProjectIdentity(currentProject, project) ||
          !sameProjectIdentity(currentProject, rootCurrent) ||
          currentProject.resourceRevision !== current.expectedProjectResourceRevision ||
          currentProject.configRevision !== current.expectedProjectConfigRevision ||
          currentTask.projectId !== current.projectId || currentTask.revision !== current.expectedTaskRevision) {
          return resolve("ineligible_at_cas", "codex_product_stale");
        }
        const dispatch = persistContinuationAuthorization(
          transaction, state, currentRun, trusted,
          {
            decisionId: stableId("decision", current.operationId, "targeted-claim-dispatch"),
            auditId: stableId("audit", current.operationId, "targeted-claim-dispatch"),
          },
          "dispatch.member.resolved", "member_resolved",
        );
        if (!dispatch.allowed) return resolve("authorization_denied", "dispatch_denied");
        if (state.executionSequences.some((candidate) => candidate.taskId === currentTask.id)) {
          return resolve("already_claimed", "execution_sequence_exists");
        }
        const eligibility = evaluateTaskEligibility(state.domain, {
          taskId: currentTask.id,
          readRevision: `task-revision:${currentTask.revision}`,
        });
        if (!eligibility.ok || !eligibility.value.eligible) {
          return resolve("ineligible_at_cas", "domain_ineligible");
        }
        const claimEvaluation = projectEvaluation(state, trusted, "execution.claim", currentProject);
        const claimRequestId = stableId("request", current.operationId, "targeted-claim");
        const claimCorrelationId = stableId("correlation", current.operationId, "targeted-claim");
        const claimDecisionId = stableId("decision", current.operationId, "targeted-claim");
        const claimAuditId = stableId("audit", current.operationId, "targeted-claim");
        transaction.insertRequest(applicationClaimRequest(
          claimRequestId, claimCorrelationId, trusted.actor.actorId, current.executionId, claimEvaluation, trusted.now,
        ));
        transaction.insertDecision(applicationClaimDecision(
          claimDecisionId, claimRequestId, trusted.actor.actorId, currentProject, claimEvaluation, trusted.now,
        ));
        transaction.insertAudit(applicationClaimAudit(
          claimAuditId, claimRequestId, claimDecisionId, claimCorrelationId, trusted.actor.actorId,
          current.executionId, claimEvaluation, trusted.now,
        ));
        if (!claimEvaluation.allowed) return resolve("authorization_denied", "execution_claim_denied");
        const startEvaluation = projectEvaluation(state, trusted, "execution.start", currentProject);
        const startRequestId = stableId("request", current.operationId, "targeted-start");
        const startCorrelationId = stableId("correlation", current.operationId, "targeted-start");
        const startDecisionId = stableId("decision", current.operationId, "targeted-start");
        const startAuditId = stableId("audit", current.operationId, "targeted-start");
        if (!startEvaluation.allowed) {
          transaction.insertDispatcherMemberDenialRequest(dispatcherMemberDenialRequest(
            startRequestId, startCorrelationId, currentRun.runId, currentMember.memberId,
            trusted.actor.actorId, current.executionId, trusted.now,
          ));
          transaction.insertDispatcherMemberDenialDecision(dispatcherMemberDenialDecision(
            startDecisionId, startRequestId, trusted.actor.actorId, currentProject, startEvaluation, trusted.now,
          ));
          transaction.insertDispatcherMemberDenialAudit(dispatcherMemberDenialAudit(
            startAuditId, startRequestId, startDecisionId, currentRun.runId, currentMember.memberId,
            trusted.actor.actorId, startCorrelationId, current.executionId, startEvaluation, trusted.now,
          ));
          return resolve("authorization_denied", "execution_start_denied");
        }
        const transition = transitionTask(state.domain, Object.freeze({
          taskId: currentTask.id,
          event: "claim_accepted" as const,
          targetState: "running" as const,
          payload: Object.freeze({
            externalAcceptance: Object.freeze({
              taskId: currentTask.id,
              taskRevision: currentTask.revision,
              authorization: "accepted" as const,
              reliability: "accepted" as const,
            }),
          }),
        }));
        if (!transition.ok) return resolve("ineligible_at_cas", "domain_claim_rejected");
        transaction.insertExecutionSequence(Object.freeze({
          taskId: currentTask.id,
          lastAttemptNumber: 1,
          currentFencingToken: 1,
          revision: 1,
        }));
        const execution: ExecutionAttempt = Object.freeze({
          executionId: current.executionId,
          taskId: currentTask.id,
          attemptNumber: 1,
          operationKind: "claim" as const,
          status: "active" as const,
          idempotencyKey: stableId("codex-targeted-claim", current.operationId),
          ownerId: trusted.executionOwnerId,
          requestedLeaseSeconds: current.leaseDurationSeconds ?? executionLeaseSeconds,
          predecessorExecutionRevision: null,
          predecessorLeaseRevision: null,
          predecessorFencingToken: null,
          leaseRevision: 1,
          leaseExpiresAt: leaseExpiry(trusted.now, current.leaseDurationSeconds ?? executionLeaseSeconds),
          fencingToken: 1,
          revision: 1,
          expectedTaskRevision: currentTask.revision,
          preTaskRevision: currentTask.revision,
          postTaskRevision: currentTask.revision + 1,
          projectResourceRevision: currentProject.resourceRevision,
          projectConfigRevision: currentProject.configRevision,
          requestId: claimRequestId,
          decisionId: claimDecisionId,
          supersedesExecutionId: null,
          supersededByExecutionId: null,
          createdAt: trusted.now,
          updatedAt: trusted.now,
        });
        transaction.insertExecutionAttempt(execution);
        transaction.insertExecutionOperationRequest(executionStartRequest(
          startRequestId, startCorrelationId, trusted.actor.actorId, current.executionId, startEvaluation, trusted.now,
        ));
        transaction.insertExecutionAuthorizationDecision(executionStartDecision(
          startDecisionId, startRequestId, trusted.actor.actorId, currentProject, startEvaluation, trusted.now,
        ));
        transaction.insertExecutionOperationAudit(executionStartAudit(
          startAuditId, startRequestId, startDecisionId, startCorrelationId, trusted.actor.actorId,
          current.executionId, startEvaluation, trusted.now,
        ));
        transaction.writeDomain(state.domain, transition.value);
        transaction.resolveDispatcherMember(
          currentMember.memberId, currentRun.runId, currentMember.membershipRevision, currentMember.revision,
          "claimed", execution.executionId, null, "claimed_for_codex",
          laterTimestamp(currentMember.updatedAt, trusted.now), current.operationId, "codex-product-operation",
        );
        transaction.updateCodexProductOperation(Object.freeze({
          ...current,
          stage: "member_bound" as const,
          revision: current.revision + 1,
          updatedAt: laterTimestamp(current.updatedAt, trusted.now),
        }), current.revision);
        const readback = transaction.read();
        const claimed = readback.dispatcherMembers.find((candidate) => candidate.memberId === currentMember.memberId);
        if (claimed === undefined || claimed.executionId !== execution.executionId || claimed.ownerKind !== "codex-product-operation") {
          throw new TypeError("Codex targeted claim readback failed");
        }
        return succeeded(memberView(readback, claimed), request.requestId, request.correlationId);
      });
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const claimContinuationMember = (operationId: string): DispatcherResult<DispatcherMemberView> => {
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted Codex continuation dispatcher ingress is invalid");
    const reopened = reopenTargetedRun(operationId, trusted);
    if (!reopened.ok) return reopened;
    let preflight: ApplicationState;
    try { preflight = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const runtime = runtimeFailure(preflight, trusted, store);
    if (runtime !== null) return runtime;
    const selected = productOperation(preflight, operationId);
    if ("ok" in selected) return selected;
    if (selected.commandKind !== "execution.resume" && selected.commandKind !== "execution.retry") {
      return failed("INVALID_INPUT", "Codex continuation product operation kind is invalid");
    }
    const run = preflight.dispatcherRuns.find((candidate) => candidate.runId === selected.runId);
    const member = preflight.dispatcherMembers.find((candidate) => candidate.memberId === selected.memberId);
    const project = preflight.projects.find((candidate) => candidate.projectId === selected.projectId);
    if (run === undefined || member === undefined || project === undefined) {
      return failed("RUN_NOT_SEALED", "Codex continuation targeted run is incomplete");
    }
    if (member.lifecycle === "terminal") {
      const request = triggerRequest(preflight, run);
      return succeeded(memberView(preflight, member), request.requestId, request.correlationId, true);
    }
    let rootCurrent: ProjectRootIdentity | null = null;
    try { rootCurrent = revalidateProjectRoot(project, store.layout.root); } catch { rootCurrent = null; }
    const request = triggerRequest(preflight, run);
    const identity = Object.freeze({ requestId: request.requestId, correlationId: request.correlationId });
    try {
      return withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const currentRuntime = persistedRuntimeFailure(state, trusted);
        if (currentRuntime !== null) return Object.freeze({ ...currentRuntime, ...identity });
        const current = productOperation(state, selected.operationId);
        if ("ok" in current) return current;
        if (current.commandKind !== "execution.resume" && current.commandKind !== "execution.retry") {
          return failed("INVALID_INPUT", "Codex continuation product operation changed kind", identity);
        }
        const currentRun = state.dispatcherRuns.find((candidate) => candidate.runId === current.runId);
        const currentMember = state.dispatcherMembers.find((candidate) => candidate.memberId === current.memberId);
        const currentProject = state.projects.find((candidate) => candidate.projectId === current.projectId);
        const currentTask = state.domain.tasks.find((candidate) => candidate.id === current.taskId);
        const source = state.executions.find((candidate) => candidate.executionId === current.sourceExecutionId);
        const sequence = state.executionSequences.find((candidate) => candidate.taskId === current.taskId);
        if (currentRun === undefined || currentMember === undefined || currentProject === undefined ||
          currentTask === undefined || source === undefined || sequence === undefined) {
          return failed("INTEGRITY_FAILURE", "Codex continuation allocation lineage is absent", identity);
        }
        if (currentMember.lifecycle === "terminal") {
          return succeeded(memberView(state, currentMember), request.requestId, request.correlationId, true);
        }
        const resolve = (
          outcome: DispatcherMemberOutcome,
          code: DispatcherMemberCode,
        ): DispatcherResult<DispatcherMemberView> => {
          transaction.resolveDispatcherMember(
            currentMember.memberId, currentRun.runId, currentMember.membershipRevision, currentMember.revision,
            outcome, null, null, code, laterTimestamp(currentMember.updatedAt, trusted.now),
          );
          const readback = transaction.read();
          const terminal = readback.dispatcherMembers.find((candidate) => candidate.memberId === currentMember.memberId);
          if (terminal === undefined) throw new TypeError("Codex continuation member resolution disappeared");
          return succeeded(memberView(readback, terminal), request.requestId, request.correlationId);
        };
        if (current.lifecycle !== "active" || current.stage !== "prepared" ||
          currentRun.productOperationId !== current.operationId || currentRun.routeKind !== "codex-continuation" ||
          currentRun.ownerId !== trusted.ownerId || currentRun.actorId !== trusted.actor.actorId ||
          currentRun.status !== "sweeping" || currentRun.leaseExpiresAt <= trusted.now ||
          currentMember.runId !== currentRun.runId || currentMember.membershipRevision !== 1 || currentMember.revision !== 1) {
          return failed("STALE_REVISION", "Codex continuation claim tuple is stale", identity);
        }
        const profile = state.codexProfiles.find((candidate) => candidate.profileId === current.profileId);
        if (profile === undefined || profile.status !== "active" || profile.revision !== current.profileRevision ||
          profile.constructorConfigSha256 !== current.constructorConfigSha256) {
          return resolve("authorization_denied", "codex_profile_inactive");
        }
        if (rootCurrent === null || !sameProjectIdentity(currentProject, project) ||
          !sameProjectIdentity(currentProject, rootCurrent) ||
          currentProject.resourceRevision !== current.expectedProjectResourceRevision ||
          currentProject.configRevision !== current.expectedProjectConfigRevision ||
          currentTask.projectId !== current.projectId || currentTask.revision !== current.expectedTaskRevision ||
          currentTask.state !== "waiting" || currentTask.waiting === null ||
          source.revision !== current.sourceExecutionRevision || source.attemptNumber !== current.sourceAttemptNumber ||
          source.fencingToken !== current.sourceFencingToken || source.status !== "active" ||
          sequence.lastAttemptNumber !== source.attemptNumber || sequence.currentFencingToken !== source.fencingToken ||
          sequence.revision !== source.attemptNumber ||
          (current.commandKind === "execution.resume" && source.leaseExpiresAt > trusted.now)) {
          return resolve("ineligible_at_cas", "codex_product_stale");
        }
        if (state.executionIntents.some((candidate) =>
          candidate.executionId === source.executionId && candidate.state !== "finalized"
        )) return resolve("reconciliation_required", "codex_source_not_ready");
        const sourceTurn = state.codexTurns.find((candidate) => candidate.backendExecutionId === current.sourceBackendExecutionId);
        const sourceReceipt = state.executionReceipts.find((candidate) => candidate.verifiedReceiptId === current.sourceVerifiedReceiptId);
        const sourceIntent = sourceReceipt === undefined ? undefined
          : state.executionIntents.find((candidate) => candidate.intentId === sourceReceipt.intentId);
        const sourceObservation = sourceIntent === undefined ? undefined : state.executionObservations.find((candidate) =>
          candidate.intentId === sourceIntent.intentId && candidate.observationNumber === current.sourceObservationNumber
        );
        const sourceFinalization = sourceIntent === undefined ? undefined
          : state.executionFinalizations.find((candidate) => candidate.intentId === sourceIntent.intentId);
        const sourceWorkspace = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === current.sourceWorkspaceId && candidate.generation === current.sourceWorkspaceGeneration
        );
        const sourceWorkspaceReceipt = state.workspaceReceipts.find((candidate) =>
          candidate.verifiedReceiptId === current.sourceWorkspaceVerifiedReceiptId
        );
        const sourceWorkspaceFinalization = sourceWorkspaceReceipt === undefined ? undefined
          : state.workspaceFinalizations.find((candidate) => candidate.intentId === sourceWorkspaceReceipt.intentId &&
            candidate.verifiedReceiptId === sourceWorkspaceReceipt.verifiedReceiptId);
        if (sourceTurn === undefined || sourceTurn.threadId !== current.sourceThreadId ||
          sourceTurn.revision !== current.sourceObservationNumber ||
          (current.commandKind === "execution.retry" && sourceTurn.lifecycle !== "failed") ||
          sourceReceipt === undefined || sourceIntent === undefined || sourceIntent.state !== "finalized" ||
          sourceIntent.executionId !== source.executionId || sourceObservation === undefined || sourceFinalization === undefined ||
          sourceObservation.backendExecutionId !== sourceTurn.backendExecutionId ||
          sourceObservation.threadId !== sourceTurn.threadId || sourceObservation.journalRevision !== sourceTurn.revision ||
          sourceReceipt.observedRevision !== sourceTurn.revision || sourceReceipt.fencingToken !== source.fencingToken ||
          sourceWorkspace === undefined || sourceWorkspace.status !== "ready" ||
          sourceWorkspace.revision !== current.sourceWorkspaceRevision ||
          sourceWorkspace.executionId !== source.executionId || sourceWorkspace.fencingToken !== source.fencingToken ||
          sourceWorkspaceReceipt === undefined || sourceWorkspaceReceipt.outcome !== "succeeded" ||
          sourceWorkspaceReceipt.externalState !== "complete" ||
          sourceWorkspaceReceipt.workspaceId !== sourceWorkspace.workspaceId ||
          sourceWorkspaceReceipt.generation !== sourceWorkspace.generation ||
          sourceWorkspace.workspaceRootKey !== current.sourceWorkspaceRootKey ||
          sourceWorkspaceReceipt.ownershipBindingSha256 !== current.sourceWorkspaceOwnershipBindingSha256 ||
          sourceWorkspaceReceipt.headObjectId !== current.sourceWorkspaceHeadObjectId ||
          sourceWorkspaceFinalization?.outcome !== "succeeded" ||
          sourceWorkspaceFinalization.resultingGenerationRevision !== sourceWorkspace.revision) {
          return resolve("reconciliation_required", "codex_source_not_ready");
        }
        const dispatch = persistContinuationAuthorization(
          transaction, state, currentRun, trusted,
          { decisionId: stableId("decision", current.operationId, "continuation-dispatch"),
            auditId: stableId("audit", current.operationId, "continuation-dispatch") },
          "dispatch.member.resolved", "member_resolved",
        );
        if (!dispatch.allowed) return resolve("authorization_denied", "dispatch_denied");
        const claimEvaluation = projectEvaluation(state, trusted, "execution.claim", currentProject);
        const continuationEvaluation = projectEvaluation(state, trusted, current.commandKind, currentProject);
        const takeoverEvaluation = projectEvaluation(state, trusted, "execution.lease.takeover", currentProject);
        const claimRequestId = stableId("request", current.operationId, "continuation-claim");
        const claimCorrelationId = stableId("correlation", current.operationId, "continuation-claim");
        const claimDecisionId = stableId("decision", current.operationId, "continuation-claim");
        const claimAuditId = stableId("audit", current.operationId, "continuation-claim");
        const continuationRequestId = stableId("request", current.operationId, "continuation-operation");
        const continuationCorrelationId = stableId("correlation", current.operationId, "continuation-operation");
        const continuationDecisionId = stableId("decision", current.operationId, "continuation-operation");
        const continuationAuditId = stableId("audit", current.operationId, "continuation-operation");
        const takeoverRequestId = stableId("request", current.operationId, "continuation-takeover");
        const takeoverCorrelationId = stableId("correlation", current.operationId, "continuation-takeover");
        const takeoverDecisionId = stableId("decision", current.operationId, "continuation-takeover");
        const takeoverAuditId = stableId("audit", current.operationId, "continuation-takeover");
        if (!claimEvaluation.allowed || !continuationEvaluation.allowed || !takeoverEvaluation.allowed) {
          transaction.insertRequest(applicationClaimRequest(
            claimRequestId, claimCorrelationId, trusted.actor.actorId, source.executionId, claimEvaluation, trusted.now,
          ));
          transaction.insertDecision(applicationClaimDecision(
            claimDecisionId, claimRequestId, trusted.actor.actorId, currentProject, claimEvaluation, trusted.now,
          ));
          transaction.insertAudit(applicationClaimAudit(
            claimAuditId, claimRequestId, claimDecisionId, claimCorrelationId, trusted.actor.actorId,
            source.executionId, claimEvaluation, trusted.now,
          ));
          transaction.insertRequest(Object.freeze({
            requestId: takeoverRequestId, correlationId: takeoverCorrelationId, actorId: trusted.actor.actorId,
            action: "execution.lease.takeover" as const, targetKind: "execution" as const,
            targetId: source.executionId, targetRevision: source.revision,
            result: takeoverEvaluation.allowed ? "allow" as const : "deny" as const, createdAt: trusted.now,
          }));
          transaction.insertDecision(Object.freeze({
            decisionId: takeoverDecisionId, requestId: takeoverRequestId, actorId: trusted.actor.actorId,
            action: "execution.lease.takeover" as const,
            result: takeoverEvaluation.allowed ? "allow" as const : "deny" as const,
            reason: takeoverEvaluation.reason, policy: takeoverEvaluation.policy,
            grantId: takeoverEvaluation.grantId, grantRevision: takeoverEvaluation.grantRevision,
            projectId: currentProject.projectId, resourceRevision: currentProject.resourceRevision, createdAt: trusted.now,
          }));
          transaction.insertAudit(Object.freeze({
            auditId: takeoverAuditId, requestId: takeoverRequestId, decisionId: takeoverDecisionId,
            eventKind: takeoverEvaluation.allowed ? "execution.lease.taken_over" as const : "authorization.denied" as const,
            result: takeoverEvaluation.allowed ? "accepted" as const : "denied" as const,
            actorId: trusted.actor.actorId, correlationId: takeoverCorrelationId,
            targetKind: "execution" as const, targetId: source.executionId, targetRevision: source.revision,
            reason: takeoverEvaluation.allowed ? "accepted" : takeoverEvaluation.reason, createdAt: trusted.now,
          }));
          transaction.insertExecutionOperationRequest(Object.freeze({
            requestId: continuationRequestId, correlationId: continuationCorrelationId,
            actorId: trusted.actor.actorId, action: current.commandKind,
            targetExecutionId: source.executionId, targetRevision: source.revision,
            result: continuationEvaluation.allowed ? "allow" as const : "deny" as const, createdAt: trusted.now,
          }));
          transaction.insertExecutionAuthorizationDecision(Object.freeze({
            decisionId: continuationDecisionId, requestId: continuationRequestId, actorId: trusted.actor.actorId,
            action: current.commandKind, result: continuationEvaluation.allowed ? "allow" as const : "deny" as const,
            reason: continuationEvaluation.reason, policy: continuationEvaluation.policy,
            grantId: continuationEvaluation.grantId, grantRevision: continuationEvaluation.grantRevision,
            projectId: currentProject.projectId, resourceRevision: currentProject.resourceRevision,
            configRevision: currentProject.configRevision, createdAt: trusted.now,
          }));
          transaction.insertExecutionOperationAudit(Object.freeze({
            auditId: continuationAuditId, requestId: continuationRequestId, decisionId: continuationDecisionId,
            eventKind: continuationEvaluation.allowed ? "execution.operation.prepared" as const : "execution.operation.denied" as const,
            result: continuationEvaluation.allowed ? "accepted" as const : "denied" as const,
            actorId: trusted.actor.actorId, correlationId: continuationCorrelationId,
            executionId: source.executionId, executionRevision: source.revision,
            code: continuationEvaluation.allowed ? "prepared" : continuationEvaluation.reason, createdAt: trusted.now,
          }));
          return resolve("authorization_denied", !takeoverEvaluation.allowed
            ? "execution_takeover_denied" : !continuationEvaluation.allowed
              ? "execution_continuation_denied" : "execution_claim_denied");
        }
        const transition = transitionTask(state.domain, Object.freeze({
          taskId: currentTask.id,
          event: current.commandKind === "execution.resume" ? "resume_accepted" as const : "retry_accepted" as const,
          targetState: "running" as const,
          payload: Object.freeze({
            continuation: Object.freeze({
              taskId: currentTask.id,
              expectedTaskRevision: currentTask.revision,
              readRevision: stableId("continuation-read", current.operationId),
              kind: current.commandKind === "execution.resume" ? "resume" as const : "retry" as const,
              requiredActionReceipt: Object.freeze({
                receiptId: current.requiredActionReceiptId!, taskId: currentTask.id,
                taskRevision: currentTask.revision, requiredAction: currentTask.waiting.requiredAction,
                status: "accepted" as const,
              }),
              targetExecutionId: source.executionId,
              targetWorkspaceRevision: String(current.sourceWorkspaceRevision),
              targetBackendThreadId: current.sourceThreadId,
              trustedTime: Date.parse(trusted.now),
            }),
            externalAcceptance: Object.freeze({
              taskId: currentTask.id, taskRevision: currentTask.revision,
              authorization: "accepted" as const, reliability: "accepted" as const,
            }),
          }),
        }));
        if (!transition.ok) return resolve("ineligible_at_cas", "domain_claim_rejected");
        const advanced = transaction.advanceExecutionSequence(
          currentTask.id, sequence.lastAttemptNumber, sequence.currentFencingToken, sequence.revision,
        );
        transaction.supersedeExecutionAttemptAfterReconciliation(
          source.executionId, current.executionId, source.ownerId, source.revision,
          source.leaseRevision, source.fencingToken, trusted.now,
        );
        const replacement: ExecutionAttempt = Object.freeze({
          executionId: current.executionId,
          taskId: currentTask.id,
          attemptNumber: advanced.lastAttemptNumber,
          operationKind: "takeover" as const,
          status: "active" as const,
          idempotencyKey: stableId("codex-continuation-execution", current.operationId),
          ownerId: trusted.executionOwnerId,
          requestedLeaseSeconds: source.requestedLeaseSeconds,
          predecessorExecutionRevision: source.revision,
          predecessorLeaseRevision: source.leaseRevision,
          predecessorFencingToken: source.fencingToken,
          leaseRevision: 1,
          leaseExpiresAt: leaseExpiry(trusted.now, source.requestedLeaseSeconds),
          fencingToken: advanced.currentFencingToken,
          revision: 1,
          expectedTaskRevision: currentTask.revision,
          preTaskRevision: currentTask.revision,
          postTaskRevision: currentTask.revision + 1,
          projectResourceRevision: currentProject.resourceRevision,
          projectConfigRevision: currentProject.configRevision,
          requestId: takeoverRequestId,
          decisionId: takeoverDecisionId,
          supersedesExecutionId: source.executionId,
          supersededByExecutionId: null,
          createdAt: trusted.now,
          updatedAt: trusted.now,
        });
        transaction.insertRequest(applicationClaimRequest(
          claimRequestId, claimCorrelationId, trusted.actor.actorId, replacement.executionId, claimEvaluation, trusted.now,
        ));
        transaction.insertDecision(applicationClaimDecision(
          claimDecisionId, claimRequestId, trusted.actor.actorId, currentProject, claimEvaluation, trusted.now,
        ));
        transaction.insertAudit(applicationClaimAudit(
          claimAuditId, claimRequestId, claimDecisionId, claimCorrelationId, trusted.actor.actorId,
          replacement.executionId, claimEvaluation, trusted.now,
        ));
        transaction.insertRequest(Object.freeze({
          requestId: takeoverRequestId, correlationId: takeoverCorrelationId, actorId: trusted.actor.actorId,
          action: "execution.lease.takeover" as const, targetKind: "execution" as const,
          targetId: replacement.executionId, targetRevision: replacement.revision,
          result: "allow" as const, createdAt: trusted.now,
        }));
        transaction.insertDecision(Object.freeze({
          decisionId: takeoverDecisionId, requestId: takeoverRequestId, actorId: trusted.actor.actorId,
          action: "execution.lease.takeover" as const, result: "allow" as const,
          reason: takeoverEvaluation.reason, policy: takeoverEvaluation.policy,
          grantId: takeoverEvaluation.grantId, grantRevision: takeoverEvaluation.grantRevision,
          projectId: currentProject.projectId, resourceRevision: currentProject.resourceRevision, createdAt: trusted.now,
        }));
        transaction.insertAudit(Object.freeze({
          auditId: takeoverAuditId, requestId: takeoverRequestId, decisionId: takeoverDecisionId,
          eventKind: "execution.lease.taken_over" as const, result: "accepted" as const,
          actorId: trusted.actor.actorId, correlationId: takeoverCorrelationId,
          targetKind: "execution" as const, targetId: replacement.executionId, targetRevision: replacement.revision,
          reason: "accepted", createdAt: trusted.now,
        }));
        transaction.insertExecutionAttempt(replacement);
        transaction.insertExecutionOperationRequest(Object.freeze({
          requestId: continuationRequestId, correlationId: continuationCorrelationId,
          actorId: trusted.actor.actorId, action: current.commandKind,
          targetExecutionId: replacement.executionId, targetRevision: replacement.revision,
          result: "allow" as const, createdAt: trusted.now,
        }));
        transaction.insertExecutionAuthorizationDecision(Object.freeze({
          decisionId: continuationDecisionId, requestId: continuationRequestId, actorId: trusted.actor.actorId,
          action: current.commandKind, result: "allow" as const,
          reason: continuationEvaluation.reason, policy: continuationEvaluation.policy,
          grantId: continuationEvaluation.grantId, grantRevision: continuationEvaluation.grantRevision,
          projectId: currentProject.projectId, resourceRevision: currentProject.resourceRevision,
          configRevision: currentProject.configRevision, createdAt: trusted.now,
        }));
        transaction.insertExecutionOperationAudit(Object.freeze({
          auditId: continuationAuditId, requestId: continuationRequestId, decisionId: continuationDecisionId,
          eventKind: "execution.operation.prepared" as const, result: "accepted" as const,
          actorId: trusted.actor.actorId, correlationId: continuationCorrelationId,
          executionId: replacement.executionId, executionRevision: replacement.revision,
          code: "prepared", createdAt: trusted.now,
        }));
        transaction.writeDomain(state.domain, transition.value);
        transaction.resolveDispatcherMember(
          currentMember.memberId, currentRun.runId, currentMember.membershipRevision, currentMember.revision,
          "claimed", replacement.executionId, null, "claimed_for_codex",
          laterTimestamp(currentMember.updatedAt, trusted.now), current.operationId, "codex-product-operation",
        );
        transaction.updateCodexProductOperation(Object.freeze({
          ...current, stage: "member_bound" as const, revision: current.revision + 1,
          updatedAt: laterTimestamp(current.updatedAt, trusted.now),
        }), current.revision);
        const readback = transaction.read();
        const claimed = readback.dispatcherMembers.find((candidate) => candidate.memberId === currentMember.memberId);
        if (claimed === undefined || claimed.executionId !== replacement.executionId ||
          claimed.ownerKind !== "codex-product-operation") {
          throw new TypeError("Codex continuation claim readback failed");
        }
        return succeeded(memberView(readback, claimed), request.requestId, request.correlationId);
      });
    } catch (error) {
      return mapPersistence(error);
    }
  };

  const finalizeRun = (operationId: string): DispatcherResult<DispatcherRunView> => {
    const trusted = context(ingress);
    if (trusted === null) return failed("INVALID_INPUT", "Trusted Codex dispatcher ingress is invalid");
    const reopened = reopenTargetedRun(operationId, trusted);
    if (!reopened.ok) return reopened;
    let state: ApplicationState;
    try { state = readApplicationStateForOwner(store); } catch (error) { return mapPersistence(error); }
    const selected = productOperation(state, operationId);
    if ("ok" in selected) return selected;
    const run = state.dispatcherRuns.find((candidate) => candidate.runId === selected.runId);
    if (run === undefined) return failed("RUN_NOT_FOUND", "Codex targeted run is absent");
    if (["completed", "partial", "failed", "interrupted"].includes(run.status)) {
      const request = triggerRequest(state, run);
      return succeeded(runView(state, run), request.requestId, request.correlationId, true);
    }
    const lifecycle = createDispatcherApplicationServiceInternal(store, ingress, Object.freeze({
      adapterId: "openai-codex-sdk-local",
      adapterVersion: "0.153.2",
      executionLeaseSeconds,
    }), Object.freeze({}));
    return lifecycle.finalize(Object.freeze({
      kind: "dispatch.finalize" as const,
      runId: run.runId,
      expectedOwnerRevision: run.ownerRevision,
      expectedRunRevision: run.runRevision,
    }));
  };

  return Object.freeze({
    createStartRun,
    claimStartMember,
    createContinuationRun,
    claimContinuationMember,
    finalizeRun,
  });
}
