import {
  evaluateAuthorization,
  type AuthorizationAction,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import { transitionTask, type Task, type WaitingMetadataInput } from "./domain.ts";
import type { TrustedActorAssertion } from "./application.ts";
import { ProjectRegistryError, revalidateProjectRoot } from "./project-registry.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationState,
  type ApplicationTransaction,
  type ApplicationAuditRecord,
  type ApplicationRequestRecord,
  type AuthorizationDecisionRecord,
  type ExecutionAttempt,
  type ExecutionAuthorizationDecisionRecord,
  type ExecutionFinalizationRecord,
  type ExecutionOperationAuditRecord,
  type ExecutionOperationIntent,
  type ExecutionOperationRequestRecord,
  type ExecutionObservationRecord,
  type ExecutionVerifiedReceiptRecord,
  type RegisteredProject,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";
import {
  EXECUTION_CONTRACT_ID,
  MANUAL_OUTCOME_CONTROL_ID,
  parseExecutionReceipt,
  validateManualOutcomeControlResult,
  validateExecutionPortResult,
  type ExecutionAdapterError,
  type ExecutionBackend,
  type ExecutionCancelRequest,
  type ExecutionInspectReceipt,
  type ExecutionInspectRequest,
  type ExecutionLifecycle,
  type ExecutionPortResult,
  type ExecutionResumeRequest,
  type ExecutionSemanticIdentity,
  type ExecutionStartRequest,
  type ManualOutcomeControl,
  type ManualOutcomeOperation,
  type ManualOutcomeReportRequest,
} from "./execution-port.ts";

export const RELIABLE_EXECUTION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "CONFIRMATION_REQUIRED",
  "PROJECT_NOT_FOUND",
  "PROJECT_DISABLED",
  "PROJECT_IDENTITY_CHANGED",
  "TASK_NOT_FOUND",
  "TASK_NOT_ELIGIBLE",
  "EXECUTION_NOT_FOUND",
  "EXECUTION_TERMINAL",
  "IDEMPOTENCY_CONFLICT",
  "STALE_REVISION",
  "STALE_FENCE",
  "LEASE_EXPIRED",
  "RECONCILIATION_REQUIRED",
  "ADAPTER_FAILURE",
  "AMBIGUOUS_EXTERNAL_STATE",
  "PERSISTENCE_FAILURE",
] as const);

export type ReliableExecutionErrorCode = (typeof RELIABLE_EXECUTION_ERROR_CODES)[number];
export interface ReliableExecutionError {
  readonly code: ReliableExecutionErrorCode;
  readonly message: string;
}
export interface ReliableExecutionSuccess {
  readonly ok: true;
  readonly value: ReliableExecutionView;
  readonly requestId: string;
  readonly correlationId: string;
}
export interface ReliableExecutionFailure {
  readonly ok: false;
  readonly error: ReliableExecutionError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}
export type ReliableExecutionResult = ReliableExecutionSuccess | ReliableExecutionFailure;

export interface ReliableExecutionConfirmationRequest {
  readonly actorId: string;
  readonly action: "manual.turn.report" | "execution.completion.accept";
  readonly requestId: string;
  readonly correlationId: string;
}
export interface ReliableExecutionIngress {
  currentActor(): TrustedActorAssertion;
  currentLeaseOwner(): string;
  now(): string;
  nextId(kind: "request" | "correlation" | "decision" | "audit" | "operation" | "intent"): string;
  confirmOperation(request: ReliableExecutionConfirmationRequest): Readonly<{ confirmationId: string }> | null;
}

interface OperationCommandBase {
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly inputReference: string;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedAttemptNumber: number;
  readonly expectedFencingToken: number;
  readonly idempotencyKey: string;
  readonly policyBindingReference: string;
  readonly requestedDeadline: string;
}

export interface ExecutionLoopStartCommand extends OperationCommandBase {
  readonly kind: "execution.start";
}
export interface ExecutionLoopInspectCommand extends OperationCommandBase {
  readonly kind: "execution.inspect";
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly lastObservationNumber: number;
}
export interface ExecutionLoopResumeCommand extends OperationCommandBase {
  readonly kind: "execution.resume" | "execution.retry";
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly continuationReference: string;
  readonly previousTurnReceiptId: string;
  readonly requiredActionReceiptId: string;
  readonly lastObservationNumber: number;
}
export interface ExecutionLoopCancelCommand extends OperationCommandBase {
  readonly kind: "execution.cancel";
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly expectedLifecycle: Exclude<ExecutionLifecycle, "unknown">;
  readonly reasonCode: string;
  readonly lastObservationNumber: number;
}
export interface ManualOutcomeCommand extends OperationCommandBase {
  readonly kind: "manual.turn.report";
  readonly reportId: string;
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly expectedJournalRevision: number;
  readonly expectedLifecycle: Exclude<ExecutionLifecycle, "unknown">;
  readonly outcomeOperation: ManualOutcomeOperation;
  readonly code: string;
  readonly evidenceReference: string | null;
  readonly lastObservationNumber: number;
}
export interface ManualCompletionCommand {
  readonly kind: "execution.completion.accept";
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly inputReference: string;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedAttemptNumber: number;
  readonly expectedFencingToken: number;
  readonly verifiedReceiptId: string;
  readonly finalizationId: string;
  readonly idempotencyKey: string;
}

type OperationCommand = ExecutionLoopStartCommand | ExecutionLoopInspectCommand | ExecutionLoopResumeCommand |
  ExecutionLoopCancelCommand | ManualOutcomeCommand;

export interface ReliableExecutionView {
  readonly executionId: string;
  readonly taskId: string;
  readonly taskState: Task["state"];
  readonly taskRevision: number;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly intentId: string | null;
  readonly intentState: ExecutionOperationIntent["state"] | null;
  readonly lifecycle: ExecutionLifecycle | "completed" | "ambiguous";
  readonly backendExecutionId: string | null;
  readonly threadId: string | null;
  readonly observationNumber: number | null;
  readonly verifiedReceiptId: string | null;
  readonly finalizationId: string | null;
  readonly waiting: Task["waiting"];
  readonly replayed: boolean;
}

export interface ReliableExecutionService {
  start(command: ExecutionLoopStartCommand): ReliableExecutionResult;
  inspect(command: ExecutionLoopInspectCommand): ReliableExecutionResult;
  resume(command: ExecutionLoopResumeCommand): ReliableExecutionResult;
  retry(command: ExecutionLoopResumeCommand): ReliableExecutionResult;
  requestCancel(command: ExecutionLoopCancelCommand): ReliableExecutionResult;
  recordManualOutcome(command: ManualOutcomeCommand): ReliableExecutionResult;
  acceptManualCompletion(command: ManualCompletionCommand): ReliableExecutionResult;
  reconcile(command: ExecutionLoopInspectCommand): ReliableExecutionResult;
}

export interface ReliableExecutionTestHooks {
  afterStage?(stage: string): void;
}

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

function bounded(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\p{Cc}\p{Cf}]/u.test(value);
}
function operationalIdentifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

const BASE_KEYS = [
  "executionId", "expectedAttemptNumber", "expectedExecutionRevision", "expectedFencingToken",
  "expectedProjectConfigRevision", "expectedProjectResourceRevision", "expectedTaskRevision",
  "idempotencyKey", "inputReference", "kind", "policyBindingReference", "projectId",
  "requestedDeadline", "taskId",
] as const;

function commonOperation(record: Readonly<UnknownRecord>): boolean {
  return bounded(record.projectId, 1024) && positive(record.expectedProjectResourceRevision) &&
    positive(record.expectedProjectConfigRevision) && bounded(record.taskId, 1024) &&
    positive(record.expectedTaskRevision) && operationalIdentifier(record.inputReference) && operationalIdentifier(record.executionId) &&
    positive(record.expectedExecutionRevision) && positive(record.expectedAttemptNumber) &&
    positive(record.expectedFencingToken) && operationalIdentifier(record.idempotencyKey) &&
    operationalIdentifier(record.policyBindingReference) && timestamp(record.requestedDeadline);
}

function commandKind(value: unknown): unknown {
  try {
    if (typeof value !== "object" || value === null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : null;
  } catch {
    return null;
  }
}

function parseOperationCommand(value: unknown): OperationCommand | null {
  const kind = commandKind(value);
  if (kind === "execution.start") {
    const record = exactRecord(value, BASE_KEYS);
    return record !== null && commonOperation(record) ? Object.freeze(record) as unknown as ExecutionLoopStartCommand : null;
  }
  if (kind === "execution.inspect") {
    const record = exactRecord(value, [...BASE_KEYS, "backendExecutionId", "lastObservationNumber", "threadId"]);
    return record !== null && commonOperation(record) && operationalIdentifier(record.backendExecutionId) && operationalIdentifier(record.threadId) &&
      nonnegative(record.lastObservationNumber) ? Object.freeze(record) as unknown as ExecutionLoopInspectCommand : null;
  }
  if (kind === "execution.resume" || kind === "execution.retry") {
    const record = exactRecord(value, [
      ...BASE_KEYS, "backendExecutionId", "continuationReference", "lastObservationNumber",
      "previousTurnReceiptId", "requiredActionReceiptId", "threadId",
    ]);
    return record !== null && commonOperation(record) && operationalIdentifier(record.backendExecutionId) && operationalIdentifier(record.threadId) &&
      operationalIdentifier(record.continuationReference) && operationalIdentifier(record.previousTurnReceiptId) &&
      operationalIdentifier(record.requiredActionReceiptId) && nonnegative(record.lastObservationNumber)
      ? Object.freeze(record) as unknown as ExecutionLoopResumeCommand : null;
  }
  if (kind === "execution.cancel") {
    const record = exactRecord(value, [
      ...BASE_KEYS, "backendExecutionId", "expectedLifecycle", "lastObservationNumber", "reasonCode", "threadId",
    ]);
    return record !== null && commonOperation(record) && operationalIdentifier(record.backendExecutionId) && operationalIdentifier(record.threadId) &&
      ["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"].includes(record.expectedLifecycle as string) &&
      operationalIdentifier(record.reasonCode, 64) && nonnegative(record.lastObservationNumber)
      ? Object.freeze(record) as unknown as ExecutionLoopCancelCommand : null;
  }
  if (kind === "manual.turn.report") {
    const record = exactRecord(value, [
      ...BASE_KEYS, "backendExecutionId", "code", "evidenceReference", "expectedJournalRevision",
      "expectedLifecycle", "lastObservationNumber", "outcomeOperation", "reportId", "threadId",
    ]);
    return record !== null && commonOperation(record) && operationalIdentifier(record.reportId) && operationalIdentifier(record.backendExecutionId) &&
      operationalIdentifier(record.threadId) && positive(record.expectedJournalRevision) &&
      ["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"].includes(record.expectedLifecycle as string) &&
      ["activate", "wait", "succeed", "fail", "confirm_cancelled"].includes(record.outcomeOperation as string) &&
      operationalIdentifier(record.code, 64) &&
      (record.evidenceReference === null || operationalIdentifier(record.evidenceReference)) &&
      nonnegative(record.lastObservationNumber)
      ? Object.freeze(record) as unknown as ManualOutcomeCommand : null;
  }
  return null;
}

function parseCompletionCommand(value: unknown): ManualCompletionCommand | null {
  const record = exactRecord(value, [
    "executionId", "expectedAttemptNumber", "expectedExecutionRevision", "expectedFencingToken",
    "expectedProjectConfigRevision", "expectedProjectResourceRevision", "expectedTaskRevision",
    "finalizationId", "idempotencyKey", "inputReference", "kind", "projectId", "taskId", "verifiedReceiptId",
  ]);
  return record !== null && record.kind === "execution.completion.accept" && bounded(record.projectId, 1024) &&
    positive(record.expectedProjectResourceRevision) && positive(record.expectedProjectConfigRevision) &&
    bounded(record.taskId, 1024) && positive(record.expectedTaskRevision) && operationalIdentifier(record.inputReference) &&
    operationalIdentifier(record.executionId) && positive(record.expectedExecutionRevision) && positive(record.expectedAttemptNumber) &&
    positive(record.expectedFencingToken) && operationalIdentifier(record.verifiedReceiptId) && operationalIdentifier(record.finalizationId) &&
    operationalIdentifier(record.idempotencyKey) ? Object.freeze(record) as unknown as ManualCompletionCommand : null;
}

interface TrustedContext {
  readonly actor: TrustedActorAssertion;
  readonly ownerId: string;
  readonly now: string;
}
interface OperationIdentity extends TrustedContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly operationId: string;
  readonly intentId: string;
}

function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  return record !== null && operationalIdentifier(record.actorId) && typeof record.principal === "string" && /^[0-9A-F]{64}$/u.test(record.principal)
    ? Object.freeze({ actorId: record.actorId, principal: record.principal }) : null;
}
function trustedContext(ingress: ReliableExecutionIngress): TrustedContext | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const ownerId = ingress.currentLeaseOwner();
    const now = ingress.now();
    return actor !== null && operationalIdentifier(ownerId) && timestamp(now) ? Object.freeze({ actor, ownerId, now }) : null;
  } catch {
    return null;
  }
}
function operationIdentity(context: TrustedContext, ingress: ReliableExecutionIngress): OperationIdentity | null {
  try {
    const values = {
      requestId: ingress.nextId("request"), correlationId: ingress.nextId("correlation"),
      decisionId: ingress.nextId("decision"), auditId: ingress.nextId("audit"),
      operationId: ingress.nextId("operation"), intentId: ingress.nextId("intent"),
    };
    const ids = Object.values(values);
    return ids.every((value) => operationalIdentifier(value)) && new Set(ids).size === ids.length
      ? Object.freeze({ ...context, ...values }) : null;
  } catch {
    return null;
  }
}

function stableId(prefix: string, ...parts: readonly unknown[]): string {
  return `${prefix}:${sha256(canonicalJson(parts)).slice(0, 64)}`;
}
function afterTimestamp(previous: string, candidate: string): string {
  const previousValue = Date.parse(previous);
  const candidateValue = Date.parse(candidate);
  return new Date(Math.max(candidateValue, previousValue + 1)).toISOString();
}
function failed(
  code: ReliableExecutionErrorCode,
  message: string,
  identity: Pick<OperationIdentity, "requestId" | "correlationId"> | null = null,
): ReliableExecutionFailure {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ code, message }),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}

interface BoundExecution {
  readonly project: RegisteredProject;
  readonly task: Task;
  readonly execution: ExecutionAttempt;
}

interface BindExecutionOptions {
  readonly allowExpiredLease?: boolean;
  readonly allowDifferentOwner?: boolean;
}

function bindExecution(
  state: ApplicationState,
  command: OperationCommand | ManualCompletionCommand,
  context: TrustedContext,
  options: BindExecutionOptions = Object.freeze({}),
): BoundExecution | ReliableExecutionFailure {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failed("PROJECT_NOT_FOUND", "Project is not registered");
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
    project.configRevision !== command.expectedProjectConfigRevision) return failed("STALE_REVISION", "Project binding is stale");
  const task = state.domain.tasks.find((candidate) => candidate.id === command.taskId);
  if (task === undefined) return failed("TASK_NOT_FOUND", "Task is not registered");
  if (task.projectId !== command.projectId || task.revision !== command.expectedTaskRevision) {
    return failed("STALE_REVISION", "Task binding or revision is stale");
  }
  const execution = state.executions.find((candidate) => candidate.executionId === command.executionId);
  if (execution === undefined) return failed("EXECUTION_NOT_FOUND", "Execution attempt is not registered");
  if (execution.taskId !== task.id || execution.revision !== command.expectedExecutionRevision ||
    execution.attemptNumber !== command.expectedAttemptNumber) return failed("STALE_REVISION", "Execution tuple is stale");
  if (execution.fencingToken !== command.expectedFencingToken) return failed("STALE_FENCE", "Execution fencing token is stale");
  if (execution.status !== "active" || (!options.allowDifferentOwner && execution.ownerId !== context.ownerId)) {
    return failed("STALE_FENCE", "Execution owner is no longer current");
  }
  if (!options.allowExpiredLease && execution.leaseExpiresAt <= context.now) {
    return failed("LEASE_EXPIRED", "Execution lease expired before this operation");
  }
  const sequence = state.executionSequences.find((candidate) => candidate.taskId === task.id);
  if (sequence === undefined || sequence.lastAttemptNumber !== execution.attemptNumber ||
    sequence.currentFencingToken !== execution.fencingToken) return failed("STALE_FENCE", "Execution sequence is stale");
  if (state.executionTerminalStates.some((terminal) => terminal.executionId === execution.executionId)) {
    return failed("EXECUTION_TERMINAL", "Execution already has a durable terminal state");
  }
  return Object.freeze({ project, task, execution });
}

function revalidateBoundProject(project: RegisteredProject, store: PersistenceStore): ReliableExecutionFailure | null {
  try {
    revalidateProjectRoot(project, store.layout.root);
    return null;
  } catch (error) {
    return error instanceof ProjectRegistryError
      ? failed("PROJECT_IDENTITY_CHANGED", "Project root identity changed or could not be revalidated")
      : failed("PERSISTENCE_FAILURE", "Project root revalidation failed");
  }
}

function operationAction(command: OperationCommand): Exclude<ExecutionOperationRequestRecord["action"], "execution.completion.accept"> {
  return command.kind === "manual.turn.report" ? "execution.inspect" : command.kind;
}
function operationKind(command: OperationCommand): ExecutionOperationIntent["operationKind"] {
  if (command.kind === "manual.turn.report") return "manual_report";
  if (command.kind === "execution.cancel") return "request_cancel";
  return command.kind.slice("execution.".length) as "start" | "inspect" | "resume" | "retry";
}
function policyFor(action: ExecutionOperationRequestRecord["action"], state: ApplicationState, projectId: string): AuthorizationPolicyResult {
  if (action === "execution.inspect") return "read_not_applicable";
  return state.domain.projects.find((candidate) => candidate.id === projectId)?.enabled === true ? "allow" : "deny";
}
function authorize(
  state: ApplicationState,
  actorId: string,
  action: ExecutionOperationRequestRecord["action"],
  project: RegisteredProject,
  now: string,
  confirmed: boolean,
): AuthorizationEvaluation {
  return evaluateAuthorization({
    actorId, action,
    target: { projectId: project.projectId, resourceRevision: project.resourceRevision, configRevision: project.configRevision },
    now, policy: policyFor(action, state, project.projectId), confirmed, grants: state.grants,
  });
}

function requestRecord(
  requestId: string,
  correlationId: string,
  actorId: string,
  action: ExecutionOperationRequestRecord["action"],
  execution: ExecutionAttempt,
  allowed: boolean,
  now: string,
): ExecutionOperationRequestRecord {
  return Object.freeze({
    requestId, correlationId, actorId, action, targetExecutionId: execution.executionId,
    targetRevision: execution.revision, result: allowed ? "allow" : "deny", createdAt: now,
  });
}
function decisionRecord(
  decisionId: string,
  requestId: string,
  actorId: string,
  action: ExecutionOperationRequestRecord["action"],
  evaluation: AuthorizationEvaluation,
  project: RegisteredProject,
  now: string,
): ExecutionAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, actorId, action, result: evaluation.allowed ? "allow" : "deny",
    reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision, projectId: project.projectId,
    resourceRevision: project.resourceRevision, createdAt: now,
  });
}
function auditRecord(
  auditId: string,
  requestId: string,
  decisionId: string,
  actorId: string,
  correlationId: string,
  execution: ExecutionAttempt,
  eventKind: ExecutionOperationAuditRecord["eventKind"],
  accepted: boolean,
  code: string,
  now: string,
): ExecutionOperationAuditRecord {
  return Object.freeze({
    auditId, requestId, decisionId, eventKind, result: accepted ? "accepted" : "denied",
    actorId, correlationId, executionId: execution.executionId, executionRevision: execution.revision,
    code, createdAt: now,
  });
}

function intentTupleMatches(state: ApplicationState, intent: ExecutionOperationIntent, command: OperationCommand): boolean {
  const expectedTaskRevision = command.kind === "execution.resume" || command.kind === "execution.retry"
    ? command.expectedTaskRevision + 1 : command.expectedTaskRevision;
  const successor = intent.sourceExecutionId !== null;
  const executionTupleMatches = successor
    ? intent.sourceExecutionId === command.executionId &&
      intent.sourceExecutionRevision === command.expectedExecutionRevision &&
      intent.sourceAttemptNumber === command.expectedAttemptNumber &&
      intent.sourceFencingToken === command.expectedFencingToken &&
      state.executions.some((candidate) => candidate.executionId === intent.executionId &&
        candidate.supersedesExecutionId === command.executionId)
    : intent.executionId === command.executionId && intent.executionRevision === command.expectedExecutionRevision &&
      intent.attemptNumber === command.expectedAttemptNumber && intent.fencingToken === command.expectedFencingToken;
  if (
    intent.idempotencyKey !== command.idempotencyKey || intent.operationKind !== operationKind(command) ||
    intent.action !== operationAction(command) || intent.projectId !== command.projectId ||
    intent.projectResourceRevision !== command.expectedProjectResourceRevision ||
    intent.projectConfigRevision !== command.expectedProjectConfigRevision || intent.taskId !== command.taskId ||
    intent.taskRevision !== expectedTaskRevision || intent.inputReference !== command.inputReference ||
    !executionTupleMatches ||
    intent.contractId !== EXECUTION_CONTRACT_ID || intent.policyBindingReference !== command.policyBindingReference ||
    intent.workspaceMode !== "none" || intent.requestedDeadline !== command.requestedDeadline
  ) return false;
  if (command.kind === "execution.start") return intent.backendExecutionId === null && intent.threadId === null;
  if (command.kind === "execution.inspect") {
    return intent.backendExecutionId === command.backendExecutionId && intent.threadId === command.threadId &&
      intent.lastObservationNumber === command.lastObservationNumber;
  }
  if (command.kind === "execution.resume" || command.kind === "execution.retry") {
    return intent.backendExecutionId === command.backendExecutionId && intent.threadId === command.threadId &&
      intent.previousReceiptId === command.previousTurnReceiptId &&
      intent.continuationReference === command.continuationReference &&
      intent.requiredActionReceiptId === command.requiredActionReceiptId &&
      (successor ? intent.sourceObservationNumber === command.lastObservationNumber && intent.lastObservationNumber === 0
        : intent.lastObservationNumber === command.lastObservationNumber);
  }
  if (command.kind === "execution.cancel") {
    return intent.backendExecutionId === command.backendExecutionId && intent.threadId === command.threadId &&
      intent.expectedLifecycle === command.expectedLifecycle && intent.reasonCode === command.reasonCode &&
      intent.lastObservationNumber === command.lastObservationNumber;
  }
  return command.kind === "manual.turn.report" && intent.backendExecutionId === command.backendExecutionId &&
    intent.threadId === command.threadId && intent.expectedJournalRevision === command.expectedJournalRevision &&
    intent.expectedLifecycle === command.expectedLifecycle && intent.reportId === command.reportId &&
    intent.reportOperation === command.outcomeOperation && intent.reportCode === command.code &&
    intent.evidenceReference === command.evidenceReference && intent.lastObservationNumber === command.lastObservationNumber;
}

function latestObservation(state: ApplicationState, intentId: string): ExecutionObservationRecord | null {
  return state.executionObservations
    .filter((candidate) => candidate.intentId === intentId)
    .sort((left, right) => right.observationNumber - left.observationNumber)[0] ?? null;
}

function viewForIntent(state: ApplicationState, intent: ExecutionOperationIntent, replayed: boolean): ReliableExecutionView {
  const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
  const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
  if (task === undefined || execution === undefined) throw new TypeError("Reliable execution readback is incomplete");
  const observation = latestObservation(state, intent.intentId);
  const receipt = state.executionReceipts.find((candidate) => candidate.intentId === intent.intentId) ?? null;
  const finalization = state.executionFinalizations.find((candidate) => candidate.intentId === intent.intentId) ?? null;
  const terminal = state.executionTerminalStates.find((candidate) => candidate.executionId === intent.executionId) ?? null;
  const turn = state.manualTurns.find((candidate) => candidate.executionId === intent.executionId) ?? null;
  const finalizedAmbiguity = finalization?.outcome === "waiting" &&
    task.waiting?.reason === "ambiguous_external_state" && task.waiting.executionId === intent.executionId;
  const lifecycle: ReliableExecutionView["lifecycle"] = terminal?.status ??
    (observation?.lifecycle === "unknown" ? "ambiguous" : observation?.lifecycle) ??
    (finalizedAmbiguity ? "ambiguous" : turn?.lifecycle) ?? "unknown";
  return Object.freeze({
    executionId: execution.executionId,
    taskId: task.id,
    taskState: task.state,
    taskRevision: task.revision,
    executionRevision: execution.revision,
    attemptNumber: execution.attemptNumber,
    fencingToken: execution.fencingToken,
    intentId: intent.intentId,
    intentState: intent.state,
    lifecycle,
    backendExecutionId: observation?.backendExecutionId ?? turn?.backendExecutionId ?? intent.backendExecutionId,
    threadId: observation?.threadId ?? turn?.threadId ?? intent.threadId,
    observationNumber: observation?.observationNumber ?? null,
    verifiedReceiptId: receipt?.verifiedReceiptId ?? null,
    finalizationId: finalization?.finalizationId ?? null,
    waiting: task.waiting,
    replayed,
  });
}

function successForIntent(state: ApplicationState, intent: ExecutionOperationIntent, replayed: boolean): ReliableExecutionSuccess {
  const request = state.executionOperationRequests.find((candidate) => candidate.requestId === intent.requestId);
  if (request === undefined) throw new TypeError("Reliable execution request readback is absent");
  return Object.freeze({
    ok: true as const,
    value: viewForIntent(state, intent, replayed),
    requestId: request.requestId,
    correlationId: request.correlationId,
  });
}

function manualTurnMatches(state: ApplicationState, command: Exclude<OperationCommand, ExecutionLoopStartCommand>): boolean {
  const turn = state.manualTurns.find((candidate) => candidate.backendExecutionId === command.backendExecutionId);
  const exactMutationRevision = turn === undefined || (command.kind === "execution.inspect"
    ? command.lastObservationNumber <= turn.revision
    : command.lastObservationNumber === turn.revision);
  const reportRevision = command.kind !== "manual.turn.report" || turn === undefined ||
    (command.expectedJournalRevision === turn.revision && command.expectedLifecycle === turn.lifecycle);
  const cancelLifecycle = command.kind !== "execution.cancel" || turn === undefined ||
    command.expectedLifecycle === turn.lifecycle;
  return turn !== undefined && exactMutationRevision && reportRevision && cancelLifecycle &&
    turn.threadId === command.threadId && turn.projectId === command.projectId &&
    turn.projectResourceRevision === command.expectedProjectResourceRevision &&
    turn.projectConfigRevision === command.expectedProjectConfigRevision && turn.taskId === command.taskId &&
    turn.taskRevision <= command.expectedTaskRevision && turn.inputReference === command.inputReference &&
    turn.executionId === command.executionId && turn.executionRevision <= command.expectedExecutionRevision &&
    turn.attemptNumber === command.expectedAttemptNumber && turn.fencingToken === command.expectedFencingToken &&
    turn.policyBindingReference === command.policyBindingReference && turn.workspaceMode === "none";
}

function dependentWaiting(state: ApplicationState, taskId: string): readonly Readonly<{ taskId: string; waiting: WaitingMetadataInput }>[] {
  return Object.freeze(state.domain.tasks
    .filter((candidate) => candidate.state === "ready" && candidate.dependencyIds.includes(taskId))
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((candidate) => Object.freeze({
      taskId: candidate.id,
      waiting: Object.freeze({
        reason: "dependency_cancelled" as const,
        phase: "dependency",
        requiredAction: "dependency.replace_or_cancel",
        lastErrorCode: "dependency_cancelled",
        lastErrorSummary: null,
        retryable: false,
        retryCount: 0,
        retryAfter: null,
        executionId: null,
        workspaceRevision: null,
        backendThreadId: null,
      }),
    })));
}

function waitingMetadata(
  lifecycle: ExecutionLifecycle | "adapter_failure",
  intent: ExecutionOperationIntent,
  code: string,
): WaitingMetadataInput {
  const reason = lifecycle === "unknown" ? "ambiguous_external_state" :
    lifecycle === "failed" || lifecycle === "adapter_failure" ? "execution_failed" : "human_input";
  const requiredAction = lifecycle === "failed" || lifecycle === "adapter_failure" ? "execution.retry" :
    lifecycle === "unknown" ? "execution.inspect" : "execution.resume";
  return Object.freeze({
    reason,
    phase: lifecycle === "unknown" ? "reconcile" : "manual_execution",
    requiredAction,
    lastErrorCode: code,
    lastErrorSummary: null,
    retryable: lifecycle !== "unknown",
    retryCount: 0,
    retryAfter: null,
    executionId: intent.executionId,
    workspaceRevision: null,
    backendThreadId: intent.threadId,
  });
}

function transitionContinuation(
  state: ApplicationState,
  task: Task,
  command: ExecutionLoopResumeCommand,
  identity: OperationIdentity,
) {
  if (task.state !== "waiting" || task.waiting === null) return null;
  const transition = transitionTask(state.domain, {
    taskId: task.id,
    event: command.kind === "execution.resume" ? "resume_accepted" : "retry_accepted",
    targetState: "running",
    payload: {
      continuation: {
        taskId: task.id,
        expectedTaskRevision: task.revision,
        readRevision: identity.operationId,
        kind: command.kind === "execution.resume" ? "resume" : "retry",
        requiredActionReceipt: {
          receiptId: command.requiredActionReceiptId,
          taskId: task.id,
          taskRevision: task.revision,
          requiredAction: task.waiting.requiredAction,
          status: "accepted",
        },
        targetExecutionId: command.executionId,
        targetWorkspaceRevision: null,
        targetBackendThreadId: command.threadId,
        trustedTime: Date.parse(identity.now),
      },
      externalAcceptance: {
        taskId: task.id,
        taskRevision: task.revision,
        authorization: "accepted",
        reliability: "accepted",
      },
    },
  });
  return transition.ok ? transition.value : null;
}

function successorLeaseExpiry(now: string, seconds: number): string {
  return new Date(Date.parse(now) + seconds * 1_000).toISOString();
}

function takeoverRequestRecord(
  requestId: string,
  correlationId: string,
  actorId: string,
  executionId: string,
  allowed: boolean,
  now: string,
): ApplicationRequestRecord {
  return Object.freeze({
    requestId, correlationId, actorId, action: "execution.lease.takeover" as const,
    targetKind: "execution" as const, targetId: executionId, targetRevision: 1,
    result: allowed ? "allow" as const : "deny" as const, createdAt: now,
  });
}

function takeoverDecisionRecord(
  decisionId: string,
  requestId: string,
  actorId: string,
  evaluation: AuthorizationEvaluation,
  project: RegisteredProject,
  now: string,
): AuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, actorId, action: "execution.lease.takeover" as const,
    result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision, projectId: project.projectId,
    resourceRevision: project.resourceRevision, createdAt: now,
  });
}

function takeoverAuditRecord(
  auditId: string,
  requestId: string,
  decisionId: string,
  actorId: string,
  correlationId: string,
  executionId: string,
  accepted: boolean,
  reason: string,
  now: string,
): ApplicationAuditRecord {
  return Object.freeze({
    auditId, requestId, decisionId,
    eventKind: accepted ? "execution.lease.taken_over" as const : "authorization.denied" as const,
    result: accepted ? "accepted" as const : "denied" as const,
    actorId, correlationId, targetKind: "execution" as const, targetId: executionId,
    targetRevision: 1, reason, createdAt: now,
  });
}

function continuationSuccessorRequirement(
  state: ApplicationState,
  command: ExecutionLoopResumeCommand,
  context: TrustedContext,
): Readonly<{ useSuccessor: boolean; bound: BoundExecution }> | ReliableExecutionFailure {
  const bound = bindExecution(state, command, context, {
    allowExpiredLease: true,
    allowDifferentOwner: true,
  });
  if ("ok" in bound) return bound;
  if (bound.task.state !== "waiting" || bound.task.waiting === null) {
    return failed("TASK_NOT_ELIGIBLE", "Continuation requires a waiting Task");
  }
  if (!manualTurnMatches(state, command)) return failed("STALE_REVISION", "Manual continuation source tuple is stale");
  const turn = state.manualTurns.find((candidate) => candidate.backendExecutionId === command.backendExecutionId);
  if (turn === undefined) return failed("STALE_REVISION", "Manual continuation source turn is absent");
  const expired = bound.execution.leaseExpiresAt <= context.now;
  if (!expired && bound.execution.ownerId !== context.ownerId) {
    return failed("STALE_FENCE", "A live execution lease belongs to another owner");
  }
  if (command.kind === "execution.retry") {
    return turn.lifecycle === "failed"
      ? Object.freeze({ useSuccessor: true, bound })
      : failed("TASK_NOT_ELIGIBLE", "Retry requires a durably failed Manual turn");
  }
  return Object.freeze({ useSuccessor: expired, bound });
}

function hasExactSuccessorProof(
  state: ApplicationState,
  command: ExecutionLoopResumeCommand,
  source: ExecutionAttempt,
): boolean {
  const receipt = state.executionReceipts.find((candidate) => candidate.verifiedReceiptId === command.previousTurnReceiptId);
  const proofIntent = receipt === undefined
    ? undefined : state.executionIntents.find((candidate) => candidate.intentId === receipt.intentId);
  const observation = proofIntent === undefined ? null : latestObservation(state, proofIntent.intentId);
  const finalization = proofIntent === undefined
    ? undefined : state.executionFinalizations.find((candidate) => candidate.intentId === proofIntent.intentId);
  const turn = state.manualTurns.find((candidate) => candidate.backendExecutionId === command.backendExecutionId);
  if (
    receipt === undefined || proofIntent === undefined || observation === null || finalization === undefined ||
    proofIntent.state !== "finalized" || proofIntent.executionId !== source.executionId ||
    proofIntent.fencingToken !== source.fencingToken || receipt.fencingToken !== source.fencingToken ||
    observation.backendExecutionId !== command.backendExecutionId || observation.threadId !== command.threadId ||
    observation.observationNumber !== command.lastObservationNumber || receipt.observedRevision !== observation.journalRevision ||
    turn === undefined || turn.threadId !== command.threadId || turn.revision !== observation.journalRevision ||
    turn.lifecycle !== observation.lifecycle
  ) return false;
  if (command.kind === "execution.retry") {
    return turn.lifecycle === "failed" && observation.lifecycle === "failed";
  }
  return source.leaseExpiresAt <= finalization.finalizedAt && proofIntent.operationKind === "inspect" &&
    (observation.lifecycle === "queued" || observation.lifecycle === "active" || observation.lifecycle === "waiting");
}

function prepareSuccessorOperation(
  store: PersistenceStore,
  command: ExecutionLoopResumeCommand,
  identity: OperationIdentity,
  backend: ExecutionBackend,
): PreparedOperation | ReliableExecutionFailure {
  try {
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const requirement = continuationSuccessorRequirement(state, command, identity);
      if ("ok" in requirement) return Object.freeze({ ...requirement, requestId: identity.requestId, correlationId: identity.correlationId });
      if (!requirement.useSuccessor) throw new TypeError("Successor preparation was selected for a live same-attempt continuation");
      const { bound } = requirement;
      if (command.requestedDeadline <= identity.now) return failed("INVALID_INPUT", "Execution deadline is not in the future", identity);
      if (state.executionIntents.some((candidate) =>
        candidate.executionId === bound.execution.executionId && candidate.state !== "finalized"
      )) return failed("RECONCILIATION_REQUIRED", "Every predecessor intent must reconcile before successor allocation", identity);
      if (!hasExactSuccessorProof(state, command, bound.execution)) {
        return failed("RECONCILIATION_REQUIRED", "A current verified predecessor observation is required before successor allocation", identity);
      }
      const transition = transitionContinuation(state, bound.task, command, identity);
      if (transition === null) return failed("TASK_NOT_ELIGIBLE", "Waiting continuation predicate did not pass", identity);
      const action = operationAction(command);
      const operationEvaluation = authorize(state, identity.actor.actorId, action, bound.project, identity.now, true);
      const takeoverEvaluation = evaluateAuthorization({
        actorId: identity.actor.actorId,
        action: "execution.lease.takeover",
        target: {
          projectId: bound.project.projectId,
          resourceRevision: bound.project.resourceRevision,
          configRevision: bound.project.configRevision,
        },
        now: identity.now,
        policy: state.domain.projects.find((candidate) => candidate.id === bound.project.projectId)?.enabled === true
          ? "allow" : "deny",
        confirmed: true,
        grants: state.grants,
      });
      const replacementExecutionId = stableId("execution", identity.operationId);
      const takeoverRequestId = stableId("request", identity.operationId, "successor-takeover");
      const takeoverDecisionId = stableId("decision", identity.operationId, "successor-takeover");
      const takeoverAuditId = stableId("audit", identity.operationId, "successor-takeover");
      if (!operationEvaluation.allowed || !takeoverEvaluation.allowed) {
        const combinedEvaluation: AuthorizationEvaluation = operationEvaluation.allowed
          ? Object.freeze({ ...operationEvaluation, allowed: false, reason: "policy_denied" as const, policy: "deny" as const })
          : operationEvaluation;
        transaction.insertExecutionOperationRequest(requestRecord(
          identity.requestId, identity.correlationId, identity.actor.actorId, action,
          bound.execution, false, identity.now,
        ));
        transaction.insertExecutionAuthorizationDecision(decisionRecord(
          identity.decisionId, identity.requestId, identity.actor.actorId, action,
          combinedEvaluation, bound.project, identity.now,
        ));
        transaction.insertExecutionOperationAudit(auditRecord(
          identity.auditId, identity.requestId, identity.decisionId, identity.actor.actorId,
          identity.correlationId, bound.execution, "execution.operation.denied", false,
          combinedEvaluation.reason, identity.now,
        ));
        if (operationEvaluation.allowed) {
          transaction.insertRequest(takeoverRequestRecord(
            takeoverRequestId, identity.correlationId, identity.actor.actorId,
            replacementExecutionId, false, identity.now,
          ));
          transaction.insertDecision(takeoverDecisionRecord(
            takeoverDecisionId, takeoverRequestId, identity.actor.actorId,
            takeoverEvaluation, bound.project, identity.now,
          ));
          transaction.insertAudit(takeoverAuditRecord(
            takeoverAuditId, takeoverRequestId, takeoverDecisionId, identity.actor.actorId,
            identity.correlationId, replacementExecutionId, false, takeoverEvaluation.reason, identity.now,
          ));
        }
        return failed("AUTHORIZATION_DENIED", "Current continuation and takeover grants did not jointly allow successor allocation", identity);
      }
      transaction.insertRequest(takeoverRequestRecord(
        takeoverRequestId, identity.correlationId, identity.actor.actorId,
        replacementExecutionId, true, identity.now,
      ));
      transaction.insertDecision(takeoverDecisionRecord(
        takeoverDecisionId, takeoverRequestId, identity.actor.actorId,
        takeoverEvaluation, bound.project, identity.now,
      ));
      transaction.insertAudit(takeoverAuditRecord(
        takeoverAuditId, takeoverRequestId, takeoverDecisionId, identity.actor.actorId,
        identity.correlationId, replacementExecutionId, true, "accepted", identity.now,
      ));
      const sequence = state.executionSequences.find((candidate) => candidate.taskId === command.taskId);
      if (sequence === undefined || sequence.lastAttemptNumber !== bound.execution.attemptNumber ||
        sequence.currentFencingToken !== bound.execution.fencingToken || sequence.revision !== bound.execution.attemptNumber) {
        return failed("STALE_FENCE", "Execution sequence is stale before successor allocation", identity);
      }
      const advanced = transaction.advanceExecutionSequence(
        command.taskId, sequence.lastAttemptNumber, sequence.currentFencingToken, sequence.revision,
      );
      transaction.supersedeExecutionAttemptAfterReconciliation(
        bound.execution.executionId, replacementExecutionId, bound.execution.ownerId,
        bound.execution.revision, bound.execution.leaseRevision, bound.execution.fencingToken, identity.now,
      );
      const replacement: ExecutionAttempt = Object.freeze({
        executionId: replacementExecutionId,
        taskId: command.taskId,
        attemptNumber: advanced.lastAttemptNumber,
        operationKind: "takeover",
        status: "active",
        idempotencyKey: stableId("successor", command.idempotencyKey),
        ownerId: identity.ownerId,
        requestedLeaseSeconds: bound.execution.requestedLeaseSeconds,
        predecessorExecutionRevision: bound.execution.revision,
        predecessorLeaseRevision: bound.execution.leaseRevision,
        predecessorFencingToken: bound.execution.fencingToken,
        leaseRevision: 1,
        leaseExpiresAt: successorLeaseExpiry(identity.now, bound.execution.requestedLeaseSeconds),
        fencingToken: advanced.currentFencingToken,
        revision: 1,
        expectedTaskRevision: bound.task.revision,
        preTaskRevision: bound.task.revision,
        postTaskRevision: bound.task.revision,
        projectResourceRevision: bound.project.resourceRevision,
        projectConfigRevision: bound.project.configRevision,
        requestId: takeoverRequestId,
        decisionId: takeoverDecisionId,
        supersedesExecutionId: bound.execution.executionId,
        supersededByExecutionId: null,
        createdAt: identity.now,
        updatedAt: identity.now,
      });
      transaction.insertExecutionAttempt(replacement);
      transaction.insertExecutionOperationRequest(requestRecord(
        identity.requestId, identity.correlationId, identity.actor.actorId,
        action, replacement, true, identity.now,
      ));
      transaction.insertExecutionAuthorizationDecision(decisionRecord(
        identity.decisionId, identity.requestId, identity.actor.actorId,
        action, operationEvaluation, bound.project, identity.now,
      ));
      transaction.insertExecutionOperationAudit(auditRecord(
        identity.auditId, identity.requestId, identity.decisionId, identity.actor.actorId,
        identity.correlationId, replacement, "execution.operation.prepared", true,
        "prepared", identity.now,
      ));
      transaction.writeDomain(state.domain, transition);
      const intent: ExecutionOperationIntent = Object.freeze({
        intentId: identity.intentId,
        operationId: identity.operationId,
        idempotencyKey: command.idempotencyKey,
        operationKind: operationKind(command),
        action,
        state: "pending",
        revision: 1,
        actorId: identity.actor.actorId,
        requestId: identity.requestId,
        decisionId: identity.decisionId,
        confirmationId: null,
        projectId: command.projectId,
        projectResourceRevision: command.expectedProjectResourceRevision,
        projectConfigRevision: command.expectedProjectConfigRevision,
        taskId: command.taskId,
        taskRevision: command.expectedTaskRevision + 1,
        inputReference: command.inputReference,
        executionId: replacement.executionId,
        executionRevision: replacement.revision,
        attemptNumber: replacement.attemptNumber,
        fencingToken: replacement.fencingToken,
        sourceExecutionId: bound.execution.executionId,
        sourceExecutionRevision: command.expectedExecutionRevision,
        sourceAttemptNumber: command.expectedAttemptNumber,
        sourceFencingToken: command.expectedFencingToken,
        sourceObservationNumber: command.lastObservationNumber,
        contractId: EXECUTION_CONTRACT_ID,
        adapterId: backend.adapterId,
        adapterVersion: backend.adapterVersion,
        policyBindingReference: command.policyBindingReference,
        workspaceMode: "none",
        backendExecutionId: command.backendExecutionId,
        threadId: command.threadId,
        previousReceiptId: command.previousTurnReceiptId,
        expectedJournalRevision: null,
        requestedDeadline: command.requestedDeadline,
        continuationReference: command.continuationReference,
        requiredActionReceiptId: command.requiredActionReceiptId,
        expectedLifecycle: null,
        reasonCode: null,
        reportId: null,
        reportOperation: null,
        reportCode: null,
        evidenceReference: null,
        lastObservationNumber: 0,
        createdAt: identity.now,
        updatedAt: identity.now,
      });
      transaction.insertExecutionIntent(intent);
      const readback = transaction.read().executionIntents.find((candidate) => candidate.intentId === intent.intentId);
      if (readback === undefined || readback.executionId !== replacement.executionId || readback.state !== "pending") {
        throw new TypeError("Successor execution intent readback failed");
      }
      return Object.freeze({ intent: readback, requestId: identity.requestId, correlationId: identity.correlationId });
    });
  } catch {
    return failed("PERSISTENCE_FAILURE", "Reliable execution successor preparation failed closed", identity);
  }
}

interface PreparedOperation {
  readonly intent: ExecutionOperationIntent;
  readonly requestId: string;
  readonly correlationId: string;
}

function prepareOperation(
  store: PersistenceStore,
  command: OperationCommand,
  identity: OperationIdentity,
  backend: ExecutionBackend,
  confirmationId: string | null,
  options: BindExecutionOptions = Object.freeze({}),
): PreparedOperation | ReliableExecutionFailure {
  try {
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const bound = bindExecution(
        state,
        command,
        identity,
        command.kind === "execution.inspect" ? options : Object.freeze({}),
      );
      if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
      if (command.requestedDeadline <= identity.now) return failed("INVALID_INPUT", "Execution deadline is not in the future", identity);
      if (command.kind === "execution.start") {
        if (bound.task.state !== "running") return failed("TASK_NOT_ELIGIBLE", "Start requires a running claimed Task", identity);
        if (state.manualTurns.some((turn) => turn.executionId === command.executionId)) {
          return failed("IDEMPOTENCY_CONFLICT", "Execution already has a Manual turn", identity);
        }
      } else if (!manualTurnMatches(state, command)) {
        return failed("STALE_REVISION", "Manual turn tuple is stale", identity);
      }
      if ((command.kind === "execution.resume" || command.kind === "execution.retry") && bound.task.state !== "waiting") {
        return failed("TASK_NOT_ELIGIBLE", "Continuation requires a waiting Task", identity);
      }
      if (command.kind !== "execution.resume" && command.kind !== "execution.retry" &&
        bound.task.state !== "running" && bound.task.state !== "waiting") {
        return failed("TASK_NOT_ELIGIBLE", "Execution operation requires a running or waiting Task", identity);
      }
      const unfinished = state.executionIntents.find((candidate) =>
        candidate.executionId === command.executionId && candidate.state !== "finalized"
      );
      if (unfinished !== undefined) return failed("RECONCILIATION_REQUIRED", "An unfinished execution intent must reconcile first", identity);
      const action = operationAction(command);
      const baseEvaluation = authorize(state, identity.actor.actorId, action, bound.project, identity.now, true);
      const needsNamedConfirmation = command.kind === "manual.turn.report";
      const evaluation: AuthorizationEvaluation = needsNamedConfirmation && confirmationId === null && baseEvaluation.allowed
        ? Object.freeze({ ...baseEvaluation, allowed: false, reason: "confirmation_required" as const })
        : baseEvaluation;
      transaction.insertExecutionOperationRequest(requestRecord(
        identity.requestId, identity.correlationId, identity.actor.actorId, action,
        bound.execution, evaluation.allowed, identity.now,
      ));
      transaction.insertExecutionAuthorizationDecision(decisionRecord(
        identity.decisionId, identity.requestId, identity.actor.actorId, action,
        evaluation, bound.project, identity.now,
      ));
      transaction.insertExecutionOperationAudit(auditRecord(
        identity.auditId, identity.requestId, identity.decisionId, identity.actor.actorId,
        identity.correlationId, bound.execution,
        evaluation.allowed ? "execution.operation.prepared" : "execution.operation.denied",
        evaluation.allowed, evaluation.allowed ? "prepared" : evaluation.reason, identity.now,
      ));
      if (!evaluation.allowed) {
        return failed(
          evaluation.reason === "confirmation_required" ? "CONFIRMATION_REQUIRED" : "AUTHORIZATION_DENIED",
          evaluation.reason === "confirmation_required" ? "Fresh named confirmation is required" : "Current explicit grant did not allow the execution operation",
          identity,
        );
      }
      let taskRevision = bound.task.revision;
      if (command.kind === "execution.resume" || command.kind === "execution.retry") {
        const transition = transitionContinuation(state, bound.task, command, identity);
        if (transition === null) return failed("TASK_NOT_ELIGIBLE", "Waiting continuation predicate did not pass", identity);
        transaction.writeDomain(state.domain, transition);
        taskRevision += 1;
      }
      const intent: ExecutionOperationIntent = Object.freeze({
        intentId: identity.intentId,
        operationId: identity.operationId,
        idempotencyKey: command.idempotencyKey,
        operationKind: operationKind(command),
        action,
        state: "pending",
        revision: 1,
        actorId: identity.actor.actorId,
        requestId: identity.requestId,
        decisionId: identity.decisionId,
        confirmationId,
        projectId: command.projectId,
        projectResourceRevision: command.expectedProjectResourceRevision,
        projectConfigRevision: command.expectedProjectConfigRevision,
        taskId: command.taskId,
        taskRevision,
        inputReference: command.inputReference,
        executionId: command.executionId,
        executionRevision: command.expectedExecutionRevision,
        attemptNumber: command.expectedAttemptNumber,
        fencingToken: command.expectedFencingToken,
        sourceExecutionId: null,
        sourceExecutionRevision: null,
        sourceAttemptNumber: null,
        sourceFencingToken: null,
        sourceObservationNumber: null,
        contractId: EXECUTION_CONTRACT_ID,
        adapterId: backend.adapterId,
        adapterVersion: backend.adapterVersion,
        policyBindingReference: command.policyBindingReference,
        workspaceMode: "none",
        backendExecutionId: command.kind === "execution.start" ? null : command.backendExecutionId,
        threadId: command.kind === "execution.start" ? null : command.threadId,
        previousReceiptId: command.kind === "execution.resume" || command.kind === "execution.retry"
          ? command.previousTurnReceiptId : null,
        expectedJournalRevision: command.kind === "manual.turn.report" ? command.expectedJournalRevision : null,
        requestedDeadline: command.requestedDeadline,
        continuationReference: command.kind === "execution.resume" || command.kind === "execution.retry"
          ? command.continuationReference : null,
        requiredActionReceiptId: command.kind === "execution.resume" || command.kind === "execution.retry"
          ? command.requiredActionReceiptId : null,
        expectedLifecycle: command.kind === "execution.cancel" || command.kind === "manual.turn.report"
          ? command.expectedLifecycle : null,
        reasonCode: command.kind === "execution.cancel" ? command.reasonCode : null,
        reportId: command.kind === "manual.turn.report" ? command.reportId : null,
        reportOperation: command.kind === "manual.turn.report" ? command.outcomeOperation : null,
        reportCode: command.kind === "manual.turn.report" ? command.code : null,
        evidenceReference: command.kind === "manual.turn.report" ? command.evidenceReference : null,
        lastObservationNumber: command.kind === "execution.start" ? 0 : command.lastObservationNumber,
        createdAt: identity.now,
        updatedAt: identity.now,
      });
      transaction.insertExecutionIntent(intent);
      const readback = transaction.read().executionIntents.find((candidate) => candidate.intentId === intent.intentId);
      if (readback === undefined || readback.state !== "pending") throw new TypeError("Prepared execution intent readback failed");
      return Object.freeze({ intent: readback, requestId: identity.requestId, correlationId: identity.correlationId });
    });
  } catch (error) {
    return error instanceof PersistenceError
      ? failed("PERSISTENCE_FAILURE", "Reliable execution prepare failed closed", identity)
      : failed("PERSISTENCE_FAILURE", "Reliable execution prepare integrity check failed", identity);
  }
}

function insertStageAudit(
  transaction: ApplicationTransaction,
  state: ApplicationState,
  intent: ExecutionOperationIntent,
  eventKind: ExecutionOperationAuditRecord["eventKind"],
  code: string,
  now: string,
): void {
  const auditId = stableId("audit", intent.intentId, eventKind);
  if (state.executionOperationAudit.some((candidate) => candidate.auditId === auditId)) return;
  const request = state.executionOperationRequests.find((candidate) => candidate.requestId === intent.requestId);
  const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
  if (request === undefined || execution === undefined) throw new TypeError("Execution stage audit lineage is absent");
  transaction.insertExecutionOperationAudit(auditRecord(
    auditId, intent.requestId, intent.decisionId, intent.actorId, request.correlationId,
    execution, eventKind, true, code, now,
  ));
}

function markExecuting(store: PersistenceStore, intentId: string, now: string): ExecutionOperationIntent {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined) throw new TypeError("Prepared execution intent is absent");
    if (intent.state === "executing") return intent;
    if (intent.state !== "pending" && intent.state !== "retry_wait") throw new TypeError("Execution intent cannot enter executing");
    const updatedAt = afterTimestamp(intent.updatedAt, now);
    transaction.transitionExecutionIntent(intent.intentId, intent.state, intent.revision, "executing", updatedAt);
    insertStageAudit(transaction, state, intent, "execution.operation.executing", "executing", updatedAt);
    const readback = transaction.read().executionIntents.find((candidate) => candidate.intentId === intentId);
    if (readback === undefined || readback.state !== "executing") throw new TypeError("Executing intent readback failed");
    return readback;
  });
}

function semanticForIntent(
  state: ApplicationState,
  intent: ExecutionOperationIntent,
  context: TrustedContext,
  options: BindExecutionOptions = Object.freeze({}),
): ExecutionSemanticIdentity | ReliableExecutionFailure {
  const project = state.projects.find((candidate) => candidate.projectId === intent.projectId);
  const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
  const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
  const sequence = state.executionSequences.find((candidate) => candidate.taskId === intent.taskId);
  if (project === undefined || task === undefined || execution === undefined || sequence === undefined) {
    return failed("STALE_REVISION", "Execution semantic lineage is absent");
  }
  if (context.actor.actorId !== intent.actorId || (!options.allowDifferentOwner && execution.ownerId !== context.ownerId) ||
    execution.status !== "active") {
    return failed("STALE_FENCE", "Execution actor or owner is stale");
  }
  if (!options.allowExpiredLease && execution.leaseExpiresAt <= context.now) {
    return failed("LEASE_EXPIRED", "Execution lease expired before observation");
  }
  if (project.resourceRevision !== intent.projectResourceRevision || project.configRevision !== intent.projectConfigRevision ||
    task.revision !== intent.taskRevision || execution.revision !== intent.executionRevision ||
    execution.attemptNumber !== intent.attemptNumber || execution.fencingToken !== intent.fencingToken ||
    sequence.lastAttemptNumber !== intent.attemptNumber || sequence.currentFencingToken !== intent.fencingToken) {
    return failed(execution.fencingToken !== intent.fencingToken ? "STALE_FENCE" : "STALE_REVISION", "Execution semantic tuple changed");
  }
  return Object.freeze({
    projectId: intent.projectId,
    projectResourceRevision: intent.projectResourceRevision,
    projectConfigRevision: intent.projectConfigRevision,
    taskId: intent.taskId,
    taskRevision: intent.taskRevision,
    inputReference: intent.inputReference,
    executionId: intent.executionId,
    executionRevision: intent.executionRevision,
    attemptNumber: intent.attemptNumber,
    fencingToken: intent.fencingToken,
    policyBindingReference: intent.policyBindingReference,
    workspaceMode: "none",
  });
}

interface InspectionAuthorization {
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly semantic: ExecutionSemanticIdentity;
  readonly requestedDeadline: string;
}

function authorizeInspection(
  store: PersistenceStore,
  intentId: string,
  context: TrustedContext,
  options: BindExecutionOptions = Object.freeze({}),
): InspectionAuthorization | ReliableExecutionFailure {
  try {
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
      if (intent === undefined) return failed("RECONCILIATION_REQUIRED", "Execution intent is absent");
      const semantic = semanticForIntent(state, intent, context, options);
      if ("ok" in semantic) return semantic;
      const requestedDeadline = new Date(Date.parse(context.now) + 30_000).toISOString();
      const ordinal = state.executionObservations.filter((candidate) => candidate.intentId === intent.intentId).length + 1;
      const requestId = stableId("request", intent.intentId, "inspect", ordinal);
      const correlationId = stableId("correlation", intent.intentId, "inspect", ordinal);
      const decisionId = stableId("decision", intent.intentId, "inspect", ordinal);
      const auditId = stableId("audit", intent.intentId, "inspect", ordinal);
      const existingRequest = state.executionOperationRequests.find((candidate) => candidate.requestId === requestId);
      if (existingRequest !== undefined) {
        const existingDecision = state.executionAuthorizationDecisions.find((candidate) => candidate.requestId === requestId);
        if (
          existingDecision === undefined || existingRequest.correlationId !== correlationId ||
          existingRequest.actorId !== intent.actorId || existingRequest.action !== "execution.inspect" ||
          existingRequest.targetExecutionId !== intent.executionId || existingRequest.targetRevision !== intent.executionRevision ||
          existingDecision.decisionId !== decisionId || existingDecision.result !== "allow"
        ) return failed("AUTHORIZATION_DENIED", "Persisted inspection authorization is not an exact allow");
        return Object.freeze({ requestId, correlationId, decisionId, semantic, requestedDeadline });
      }
      const project = state.projects.find((candidate) => candidate.projectId === intent.projectId);
      const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
      if (project === undefined || execution === undefined) return failed("STALE_REVISION", "Inspection target is stale");
      const evaluation = authorize(state, intent.actorId, "execution.inspect", project, context.now, true);
      transaction.insertExecutionOperationRequest(requestRecord(
        requestId, correlationId, intent.actorId, "execution.inspect", execution, evaluation.allowed, context.now,
      ));
      transaction.insertExecutionAuthorizationDecision(decisionRecord(
        decisionId, requestId, intent.actorId, "execution.inspect", evaluation, project, context.now,
      ));
      transaction.insertExecutionOperationAudit(auditRecord(
        auditId, requestId, decisionId, intent.actorId, correlationId, execution,
        evaluation.allowed ? "execution.operation.prepared" : "execution.operation.denied",
        evaluation.allowed, evaluation.allowed ? "inspect_prepared" : evaluation.reason, context.now,
      ));
      return evaluation.allowed
        ? Object.freeze({ requestId, correlationId, decisionId, semantic, requestedDeadline })
        : failed("AUTHORIZATION_DENIED", "Current execution.inspect grant did not allow independent observation");
    });
  } catch {
    return failed("PERSISTENCE_FAILURE", "Independent inspection authorization failed closed");
  }
}

function buildInspectRequest(
  intent: ExecutionOperationIntent,
  authorization: InspectionAuthorization,
  backendExecutionId: string,
  threadId: string,
): ExecutionInspectRequest {
  return Object.freeze({
    contractId: EXECUTION_CONTRACT_ID,
    adapterId: intent.adapterId,
    adapterVersion: intent.adapterVersion,
    correlationId: authorization.correlationId,
    requestedDeadline: authorization.requestedDeadline,
    semantic: authorization.semantic,
    operation: "inspect",
    queryId: authorization.requestId,
    actorId: intent.actorId,
    authorizationDecisionId: authorization.decisionId,
    backendExecutionId,
    threadId,
    lastObservationNumber: intent.lastObservationNumber,
  });
}

function receiptIntegrityMatches(receipt: ExecutionInspectReceipt): boolean {
  const {
    integritySha256,
    ...projection
  } = receipt;
  return sha256(canonicalJson(projection)) === integritySha256;
}

type InspectionResult =
  | Readonly<{ ok: true; receipt: ExecutionInspectReceipt; authorization: InspectionAuthorization }>
  | Readonly<{ ok: false; error: ExecutionAdapterError | null; ambiguous: boolean }>;

function independentlyInspect(
  store: PersistenceStore,
  intent: ExecutionOperationIntent,
  context: TrustedContext,
  backend: ExecutionBackend,
  identityOverride: Readonly<{ backendExecutionId: string; threadId: string }> | null = null,
  options: BindExecutionOptions = Object.freeze({}),
): InspectionResult {
  const state = readApplicationStateForOwner(store);
  const turn = state.manualTurns.find((candidate) => candidate.executionId === intent.executionId);
  const backendExecutionId = identityOverride?.backendExecutionId ?? turn?.backendExecutionId ?? intent.backendExecutionId;
  const threadId = identityOverride?.threadId ?? turn?.threadId ?? intent.threadId;
  if (backendExecutionId === null || threadId === null) return Object.freeze({ ok: false, error: null, ambiguous: true });
  const authorization = authorizeInspection(store, intent.intentId, context, options);
  if ("ok" in authorization) return Object.freeze({ ok: false, error: null, ambiguous: true });
  const request = buildInspectRequest(intent, authorization, backendExecutionId, threadId);
  let raw: unknown;
  try {
    raw = backend.inspect(request);
  } catch {
    return Object.freeze({ ok: false, error: null, ambiguous: true });
  }
  const result = validateExecutionPortResult(raw);
  if (result === null) return Object.freeze({ ok: false, error: null, ambiguous: true });
  if (!result.ok) return Object.freeze({ ok: false, error: result.error, ambiguous: result.error.ambiguous });
  const receipt = parseExecutionReceipt(result.receipt);
  if (
    receipt === null || receipt.operation !== "inspect" || !receiptIntegrityMatches(receipt) ||
    receipt.contractId !== EXECUTION_CONTRACT_ID || receipt.adapterId !== backend.adapterId ||
    receipt.adapterVersion !== backend.adapterVersion || receipt.correlationId !== authorization.correlationId ||
    receipt.queryId !== authorization.requestId || receipt.authorizationDecisionId !== authorization.decisionId ||
    receipt.observedExecutionId !== intent.executionId || receipt.backendExecutionId !== backendExecutionId ||
    receipt.threadId !== threadId || receipt.observationNumber < intent.lastObservationNumber
  ) return Object.freeze({ ok: false, error: null, ambiguous: true });
  return Object.freeze({ ok: true, receipt, authorization });
}

function persistObservation(
  store: PersistenceStore,
  intentId: string,
  receipt: ExecutionInspectReceipt,
  authorization: InspectionAuthorization,
  context: TrustedContext,
  options: BindExecutionOptions = Object.freeze({}),
): ExecutionOperationIntent {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined || intent.state !== "executing") throw new TypeError("Executing intent is absent at observation");
    const semantic = semanticForIntent(state, intent, context, options);
    if ("ok" in semantic) throw new TypeError("Observation fence or revision is stale");
    const observation: ExecutionObservationRecord = Object.freeze({
      observationId: stableId("observation", intent.intentId, receipt.receiptId),
      intentId: intent.intentId,
      observationNumber: receipt.observationNumber,
      adapterReceiptId: receipt.receiptId,
      receiptSha256: receipt.integritySha256,
      authorizationDecisionId: authorization.decisionId,
      lifecycle: receipt.lifecycle,
      outcome: receipt.outcome,
      code: receipt.code,
      backendExecutionId: receipt.backendExecutionId,
      threadId: receipt.threadId,
      journalRevision: receipt.observationNumber,
      evidenceReference: receipt.resultReference,
      observedAt: receipt.observedAt,
    });
    const updatedAt = afterTimestamp(intent.updatedAt, receipt.observedAt > context.now ? receipt.observedAt : context.now);
    transaction.insertExecutionObservation(observation);
    transaction.transitionExecutionIntent(intent.intentId, "executing", intent.revision, "observed", updatedAt);
    insertStageAudit(transaction, state, intent, "execution.operation.observed", receipt.code, updatedAt);
    const readback = transaction.read().executionIntents.find((candidate) => candidate.intentId === intentId);
    if (readback === undefined || readback.state !== "observed") throw new TypeError("Observed intent readback failed");
    return readback;
  });
}

function verifyObservation(store: PersistenceStore, intentId: string, now: string): ExecutionOperationIntent {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined) throw new TypeError("Observed intent is absent");
    if (intent.state === "verified") return intent;
    if (intent.state !== "observed") throw new TypeError("Execution intent is not observed");
    const observation = latestObservation(state, intent.intentId);
    if (observation === null || observation.backendExecutionId === null || observation.journalRevision === null) {
      throw new TypeError("Observed receipt evidence is incomplete");
    }
    const verified: ExecutionVerifiedReceiptRecord = Object.freeze({
      verifiedReceiptId: stableId("verified", intent.intentId, observation.adapterReceiptId),
      intentId: intent.intentId,
      adapterReceiptId: observation.adapterReceiptId,
      receiptSha256: observation.receiptSha256,
      lifecycle: observation.lifecycle,
      backendExecutionId: observation.backendExecutionId,
      threadId: observation.threadId,
      observationNumber: observation.observationNumber,
      observedRevision: observation.journalRevision,
      fencingToken: intent.fencingToken,
      verifiedAt: afterTimestamp(intent.updatedAt, now),
    });
    transaction.insertExecutionVerifiedReceipt(verified);
    transaction.transitionExecutionIntent(intent.intentId, "observed", intent.revision, "verified", verified.verifiedAt);
    insertStageAudit(transaction, state, intent, "execution.operation.verified", observation.code, verified.verifiedAt);
    const readback = transaction.read().executionIntents.find((candidate) => candidate.intentId === intentId);
    if (readback === undefined || readback.state !== "verified") throw new TypeError("Verified intent readback failed");
    return readback;
  });
}

function executionWaitTransition(
  state: ApplicationState,
  task: Task,
  intent: ExecutionOperationIntent,
  lifecycle: ExecutionLifecycle | "adapter_failure",
  code: string,
  backendThreadId: string | null,
) {
  if (task.state !== "running") return null;
  const waiting = Object.freeze({ ...waitingMetadata(lifecycle, intent, code), backendThreadId });
  const result = transitionTask(state.domain, {
    taskId: task.id,
    event: "execution_wait",
    targetState: "waiting",
    payload: { waiting },
  });
  return result.ok ? result.value : null;
}

function finalizeVerified(
  store: PersistenceStore,
  intentId: string,
  context: TrustedContext,
  options: BindExecutionOptions = Object.freeze({}),
): ReliableExecutionSuccess {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined) throw new TypeError("Verified execution intent is absent");
    if (intent.state === "finalized") return successForIntent(state, intent, true);
    if (intent.state !== "verified") throw new TypeError("Execution intent is not verified");
    const semantic = semanticForIntent(state, intent, context, options);
    if ("ok" in semantic) throw new TypeError("Verified finalization has a stale fence or revision");
    const observation = latestObservation(state, intent.intentId);
    const receipt = state.executionReceipts.find((candidate) => candidate.intentId === intent.intentId);
    const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
    const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
    if (observation === null || receipt === undefined || task === undefined || execution === undefined ||
      receipt.fencingToken !== intent.fencingToken || receipt.adapterReceiptId !== observation.adapterReceiptId) {
      throw new TypeError("Verified execution evidence is incomplete");
    }
    const preTaskRevision = task.revision;
    let postTaskRevision = task.revision;
    const expiredReconciliation = options.allowExpiredLease === true && execution.leaseExpiresAt <= context.now;
    if (observation.lifecycle === "waiting" || observation.lifecycle === "failed" || observation.lifecycle === "unknown" ||
      (expiredReconciliation && (observation.lifecycle === "queued" || observation.lifecycle === "active"))) {
      const transition = executionWaitTransition(
        state, task, intent, observation.lifecycle, observation.code, observation.threadId,
      );
      if (task.state === "running" && transition === null) throw new TypeError("Execution waiting transition was rejected");
      if (transition !== null) {
        transaction.writeDomain(state.domain, transition);
        postTaskRevision += 1;
      }
    }
    if (observation.lifecycle === "cancelled") {
      const turn = state.manualTurns.find((candidate) => candidate.backendExecutionId === observation.backendExecutionId);
      const cancellationWasRequested = turn?.cancellationRequestRevision !== null &&
        state.manualBackendOperations.some((candidate) =>
          candidate.backendExecutionId === observation.backendExecutionId && candidate.operationKind === "request_cancel"
        );
      if (!cancellationWasRequested || task.state !== "running") {
        throw new TypeError("Cancellation observation lacks a prior exact request or current running Task");
      }
      const transition = transitionTask(state.domain, {
        taskId: task.id,
        event: "interruption_verified",
        targetState: "cancelled",
        payload: {
          reason: intent.reasonCode ?? "manual_cancelled",
          verification: {
            receiptId: receipt.verifiedReceiptId,
            taskId: task.id,
            taskRevision: task.revision,
            executionId: intent.executionId,
            status: "stopped",
          },
          dependentWaiting: dependentWaiting(state, task.id),
        },
      });
      if (!transition.ok) throw new TypeError("Verified interruption Domain transition was rejected");
      transaction.writeDomain(state.domain, transition.value);
      postTaskRevision += 1;
    }
    const finalizationId = stableId("finalization", intent.intentId);
    const finalizedAt = afterTimestamp(intent.updatedAt, context.now);
    const outcome: ExecutionFinalizationRecord["outcome"] = observation.lifecycle === "cancelled" ? "interrupted" :
      observation.lifecycle === "waiting" || observation.lifecycle === "failed" || observation.lifecycle === "unknown" ||
        (expiredReconciliation && (observation.lifecycle === "queued" || observation.lifecycle === "active"))
        ? "waiting" : observation.outcome === "rejected" ? "rejected" : observation.outcome === "deferred" ? "deferred" : "accepted";
    transaction.insertExecutionFinalization(Object.freeze({
      finalizationId,
      intentId: intent.intentId,
      verifiedReceiptId: receipt.verifiedReceiptId,
      outcome,
      code: observation.code,
      taskRevision: postTaskRevision,
      executionRevision: execution.revision,
      finalizedAt,
    }));
    if (observation.lifecycle === "cancelled") {
      transaction.insertExecutionTerminalState(Object.freeze({
        executionId: execution.executionId,
        status: "cancelled" as const,
        attemptNumber: execution.attemptNumber,
        fencingToken: execution.fencingToken,
        verifiedReceiptId: receipt.verifiedReceiptId,
        finalizationId,
        completionDecisionId: null,
        preTaskRevision,
        postTaskRevision,
        executionRevision: execution.revision,
        createdAt: finalizedAt,
      }));
    }
    transaction.transitionExecutionIntent(intent.intentId, "verified", intent.revision, "finalized", finalizedAt);
    insertStageAudit(transaction, state, intent, "execution.operation.finalized", observation.code, finalizedAt);
    if (observation.lifecycle === "cancelled") {
      insertStageAudit(transaction, state, intent, "execution.interruption.verified", "manual_cancelled", finalizedAt);
    }
    const readback = transaction.read();
    const terminalIntent = readback.executionIntents.find((candidate) => candidate.intentId === intent.intentId);
    if (terminalIntent === undefined || terminalIntent.state !== "finalized") throw new TypeError("Finalized intent readback failed");
    return successForIntent(readback, terminalIntent, false);
  });
}

function markAdapterFailure(
  store: PersistenceStore,
  intentId: string,
  error: ExecutionAdapterError | null,
  ambiguous: boolean,
  now: string,
): ExecutionOperationIntent {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined) throw new TypeError("Executing intent is absent at adapter failure");
    if (intent.state === "ambiguous" || intent.state === "retry_wait" || intent.state === "failed") return intent;
    if (intent.state !== "executing") throw new TypeError("Adapter failure does not bind an executing intent");
    const nextState = ambiguous || error?.ambiguous === true ? "ambiguous" : error?.retryable === true ? "retry_wait" : "failed";
    const updatedAt = afterTimestamp(intent.updatedAt, now);
    transaction.transitionExecutionIntent(intent.intentId, "executing", intent.revision, nextState, updatedAt);
    const readback = transaction.read().executionIntents.find((candidate) => candidate.intentId === intent.intentId);
    if (readback === undefined || readback.state !== nextState) throw new TypeError("Adapter failure state readback failed");
    return readback;
  });
}

function finalizeAdapterFailure(
  store: PersistenceStore,
  intentId: string,
  context: TrustedContext,
  error: ExecutionAdapterError | null,
): ReliableExecutionSuccess {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined) throw new TypeError("Failed execution intent is absent");
    if (intent.state === "finalized") return successForIntent(state, intent, true);
    if (intent.state !== "ambiguous" && intent.state !== "retry_wait" && intent.state !== "failed") {
      throw new TypeError("Execution intent is not in a finalizable failure state");
    }
    const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
    const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
    if (task === undefined || execution === undefined || execution.fencingToken !== intent.fencingToken) {
      throw new TypeError("Adapter failure fence or Task is stale");
    }
    const code = error?.code ?? (intent.state === "ambiguous" ? "ambiguous_external_state" : "adapter_failure");
    let postTaskRevision = task.revision;
    const transition = executionWaitTransition(
      state, task, intent, intent.state === "ambiguous" ? "unknown" : "adapter_failure", code,
      state.manualTurns.find((candidate) => candidate.executionId === intent.executionId)?.threadId ?? intent.threadId,
    );
    if (task.state === "running" && transition === null) throw new TypeError("Adapter failure waiting transition was rejected");
    if (transition !== null) {
      transaction.writeDomain(state.domain, transition);
      postTaskRevision += 1;
    }
    const finalizedAt = afterTimestamp(intent.updatedAt, context.now);
    transaction.insertExecutionFinalization(Object.freeze({
      finalizationId: stableId("finalization", intent.intentId),
      intentId: intent.intentId,
      verifiedReceiptId: null,
      outcome: "waiting",
      code,
      taskRevision: postTaskRevision,
      executionRevision: execution.revision,
      finalizedAt,
    }));
    transaction.transitionExecutionIntent(intent.intentId, intent.state, intent.revision, "finalized", finalizedAt);
    insertStageAudit(transaction, state, intent, "execution.operation.finalized", code, finalizedAt);
    const readback = transaction.read();
    const terminalIntent = readback.executionIntents.find((candidate) => candidate.intentId === intent.intentId);
    if (terminalIntent === undefined || terminalIntent.state !== "finalized") throw new TypeError("Failed intent finalization readback failed");
    return successForIntent(readback, terminalIntent, false);
  });
}

function portReceiptIntegrityMatches(receipt: ReturnType<typeof parseExecutionReceipt> extends infer T ? Exclude<T, null> : never): boolean {
  const { integritySha256, ...projection } = receipt;
  return sha256(canonicalJson(projection)) === integritySha256;
}

function baseMutationRequest(intent: ExecutionOperationIntent, correlationId: string, semantic: ExecutionSemanticIdentity) {
  return Object.freeze({
    contractId: EXECUTION_CONTRACT_ID,
    adapterId: intent.adapterId,
    adapterVersion: intent.adapterVersion,
    correlationId,
    requestedDeadline: intent.requestedDeadline,
    semantic,
    operationId: intent.operationId,
    intentId: intent.intentId,
    idempotencyKey: intent.idempotencyKey,
    actorId: intent.actorId,
    authorizationDecisionId: intent.decisionId,
  });
}

interface EffectAttempt {
  readonly error: ExecutionAdapterError | null;
  readonly ambiguous: boolean;
  readonly identity: Readonly<{ backendExecutionId: string; threadId: string }> | null;
}

function invokeEffect(
  intent: ExecutionOperationIntent,
  semantic: ExecutionSemanticIdentity,
  correlationId: string,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
): EffectAttempt {
  let raw: unknown;
  try {
    const base = baseMutationRequest(intent, correlationId, semantic);
    if (intent.operationKind === "start") {
      const request: ExecutionStartRequest = Object.freeze({ ...base, operation: "start", action: "execution.start" });
      raw = backend.start(request);
    } else if (intent.operationKind === "resume" || intent.operationKind === "retry") {
      if (intent.backendExecutionId === null || intent.threadId === null || intent.continuationReference === null ||
        intent.previousReceiptId === null) return Object.freeze({ error: null, ambiguous: true, identity: null });
      const request: ExecutionResumeRequest = Object.freeze({
        ...base,
        operation: "resume",
        action: intent.operationKind === "resume" ? "execution.resume" : "execution.retry",
        backendExecutionId: intent.backendExecutionId,
        threadId: intent.threadId,
        continuationReference: intent.continuationReference,
        previousTurnReceiptId: intent.previousReceiptId,
        expectedThreadId: intent.threadId,
      });
      raw = backend.resume(request);
    } else if (intent.operationKind === "request_cancel") {
      if (intent.backendExecutionId === null || intent.threadId === null || intent.expectedLifecycle === null ||
        intent.reasonCode === null) return Object.freeze({ error: null, ambiguous: true, identity: null });
      const request: ExecutionCancelRequest = Object.freeze({
        ...base,
        operation: "request_cancel",
        action: "execution.cancel",
        backendExecutionId: intent.backendExecutionId,
        threadId: intent.threadId,
        expectedLifecycle: intent.expectedLifecycle,
        reasonCode: intent.reasonCode,
      });
      raw = backend.requestCancel(request);
    } else if (intent.operationKind === "manual_report") {
      if (
        intent.backendExecutionId === null || intent.threadId === null || intent.expectedJournalRevision === null ||
        intent.expectedLifecycle === null || intent.reportId === null || intent.reportOperation === null ||
        intent.reportCode === null || intent.confirmationId === null
      ) return Object.freeze({ error: null, ambiguous: true, identity: null });
      const request: ManualOutcomeReportRequest = Object.freeze({
        contractId: MANUAL_OUTCOME_CONTROL_ID,
        reportId: intent.reportId,
        operationId: intent.operationId,
        intentId: intent.intentId,
        idempotencyKey: intent.idempotencyKey,
        actorId: intent.actorId,
        authorizationDecisionId: intent.decisionId,
        confirmationId: intent.confirmationId,
        correlationId,
        semantic,
        backendExecutionId: intent.backendExecutionId,
        threadId: intent.threadId,
        expectedJournalRevision: intent.expectedJournalRevision,
        expectedLifecycle: intent.expectedLifecycle,
        operation: intent.reportOperation,
        code: intent.reportCode,
        evidenceReference: intent.evidenceReference,
      });
      const result = validateManualOutcomeControlResult(control.recordOutcome(request));
      if (result === null) return Object.freeze({ error: null, ambiguous: true, identity: null });
      if (!result.ok) return Object.freeze({ error: result.error, ambiguous: result.error.ambiguous, identity: null });
      if (
        result.receipt.operationId !== intent.operationId || result.receipt.intentId !== intent.intentId ||
        result.receipt.idempotencyKey !== intent.idempotencyKey || result.receipt.correlationId !== correlationId ||
        result.receipt.backendExecutionId !== intent.backendExecutionId || result.receipt.threadId !== intent.threadId ||
        result.receipt.reportId !== intent.reportId
      ) return Object.freeze({ error: null, ambiguous: true, identity: null });
      return Object.freeze({
        error: null,
        ambiguous: false,
        identity: Object.freeze({ backendExecutionId: intent.backendExecutionId, threadId: intent.threadId }),
      });
    } else {
      return Object.freeze({ error: null, ambiguous: false, identity: null });
    }
  } catch {
    return Object.freeze({ error: null, ambiguous: true, identity: null });
  }
  const result = validateExecutionPortResult(raw);
  if (result === null) return Object.freeze({ error: null, ambiguous: true, identity: null });
  if (!result.ok) return Object.freeze({ error: result.error, ambiguous: result.error.ambiguous, identity: null });
  const receipt = parseExecutionReceipt(result.receipt);
  if (
    receipt === null || !portReceiptIntegrityMatches(receipt) || receipt.correlationId !== correlationId ||
    receipt.adapterId !== intent.adapterId || receipt.adapterVersion !== intent.adapterVersion ||
    receipt.observedExecutionId !== intent.executionId ||
    (receipt.operation !== "inspect" && (
      receipt.operationId !== intent.operationId || receipt.intentId !== intent.intentId ||
      receipt.idempotencyKey !== intent.idempotencyKey
    ))
  ) return Object.freeze({ error: null, ambiguous: true, identity: null });
  if (receipt.operation === "start" || receipt.operation === "resume") {
    return Object.freeze({
      error: null,
      ambiguous: false,
      identity: receipt.threadId === null ? null : Object.freeze({
        backendExecutionId: receipt.backendExecutionId,
        threadId: receipt.threadId,
      }),
    });
  }
  if (receipt.operation === "request_cancel") {
    return Object.freeze({
      error: null,
      ambiguous: false,
      identity: receipt.threadId === null ? null : Object.freeze({
        backendExecutionId: receipt.backendExecutionId,
        threadId: receipt.threadId,
      }),
    });
  }
  return Object.freeze({ error: null, ambiguous: true, identity: null });
}

function effectReflected(
  state: ApplicationState,
  intent: ExecutionOperationIntent,
  _receipt: ExecutionInspectReceipt,
): boolean {
  if (intent.operationKind === "inspect") return true;
  return state.manualBackendOperations.some((candidate) => candidate.intentId === intent.intentId);
}

function processIntent(
  store: PersistenceStore,
  intentId: string,
  context: TrustedContext,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
  hooks: ReliableExecutionTestHooks,
  options: BindExecutionOptions = Object.freeze({}),
): ReliableExecutionResult {
  try {
    let state = readApplicationStateForOwner(store);
    let intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (intent === undefined) return failed("RECONCILIATION_REQUIRED", "Execution intent is absent");
    if (intent.state === "finalized") return successForIntent(state, intent, true);
    if (intent.state === "observed") {
      intent = verifyObservation(store, intent.intentId, context.now);
      hooks.afterStage?.("receipt");
      hooks.afterStage?.("verified");
    }
    if (intent.state === "verified") {
      const result = finalizeVerified(store, intent.intentId, context, options);
      hooks.afterStage?.("finalized");
      return result;
    }
    if (intent.state === "ambiguous" || intent.state === "retry_wait" || intent.state === "failed") {
      const result = finalizeAdapterFailure(store, intent.intentId, context, null);
      hooks.afterStage?.("failure-finalized");
      return result;
    }
    const wasPending = intent.state === "pending";
    if (wasPending) {
      intent = markExecuting(store, intent.intentId, context.now);
      hooks.afterStage?.("executing");
    }
    if (intent.state !== "executing") return failed("RECONCILIATION_REQUIRED", "Execution intent state cannot progress");
    state = readApplicationStateForOwner(store);
    const persistedIntent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
    if (persistedIntent === undefined) return failed("RECONCILIATION_REQUIRED", "Executing intent disappeared");
    intent = persistedIntent;
    const effectIntent = persistedIntent;
    const semantic = semanticForIntent(state, effectIntent, context, options);
    if ("ok" in semantic) return semantic;
    let priorInspection: InspectionResult | null = null;
    if (!wasPending) {
      priorInspection = independentlyInspect(store, effectIntent, context, backend, null, options);
      hooks.afterStage?.("recovery-inspected");
      if (priorInspection.ok && effectReflected(state, effectIntent, priorInspection.receipt)) {
        intent = persistObservation(
          store,
          effectIntent.intentId,
          priorInspection.receipt,
          priorInspection.authorization,
          context,
          options,
        );
        hooks.afterStage?.("observed");
        intent = verifyObservation(store, intent.intentId, context.now);
        hooks.afterStage?.("receipt");
        hooks.afterStage?.("verified");
        const result = finalizeVerified(store, intent.intentId, context, options);
        hooks.afterStage?.("finalized");
        return result;
      }
      if (options.allowExpiredLease === true && effectIntent.operationKind !== "inspect") {
        const startIsProvenAbsent = effectIntent.operationKind === "start" &&
          !state.manualTurns.some((candidate) => candidate.executionId === effectIntent.executionId) &&
          !state.manualBackendOperations.some((candidate) => candidate.intentId === effectIntent.intentId);
        if (!startIsProvenAbsent) {
          const error = priorInspection.ok ? null : priorInspection.error;
          intent = markAdapterFailure(store, effectIntent.intentId, error, true, context.now);
          hooks.afterStage?.("adapter-failure-recorded");
          const result = finalizeAdapterFailure(store, intent.intentId, context, error);
          hooks.afterStage?.("failure-finalized");
          return result;
        }
      }
    }
    let effect = Object.freeze({ error: null, ambiguous: false, identity: null }) as EffectAttempt;
    if (effectIntent.operationKind !== "inspect") {
      const request = state.executionOperationRequests.find((candidate) => candidate.requestId === effectIntent.requestId);
      if (request === undefined) throw new TypeError("Execution intent request is absent");
      effect = invokeEffect(effectIntent, semantic, request.correlationId, backend, control);
      hooks.afterStage?.("adapter-effect");
    }
    const inspection = independentlyInspect(store, effectIntent, context, backend, effect.identity, options);
    hooks.afterStage?.("independent-inspect");
    if (!inspection.ok) {
      const error = inspection.error ?? effect.error;
      const ambiguous = inspection.ambiguous || effect.ambiguous || error === null;
      intent = markAdapterFailure(store, effectIntent.intentId, error, ambiguous, context.now);
      hooks.afterStage?.("adapter-failure-recorded");
      const result = finalizeAdapterFailure(store, intent.intentId, context, error);
      hooks.afterStage?.("failure-finalized");
      return result;
    }
    const postEffectState = readApplicationStateForOwner(store);
    if (!effectReflected(postEffectState, effectIntent, inspection.receipt)) {
      const error = effect.error;
      const ambiguous = effect.ambiguous || error === null;
      intent = markAdapterFailure(store, effectIntent.intentId, error, ambiguous, context.now);
      hooks.afterStage?.("adapter-failure-recorded");
      const result = finalizeAdapterFailure(store, intent.intentId, context, error);
      hooks.afterStage?.("failure-finalized");
      return result;
    }
    intent = persistObservation(
      store,
      effectIntent.intentId,
      inspection.receipt,
      inspection.authorization,
      context,
      options,
    );
    hooks.afterStage?.("observed");
    intent = verifyObservation(store, intent.intentId, context.now);
    hooks.afterStage?.("receipt");
    hooks.afterStage?.("verified");
    const result = finalizeVerified(store, intent.intentId, context, options);
    hooks.afterStage?.("finalized");
    return result;
  } catch (error) {
    if (error instanceof PersistenceError) return failed("PERSISTENCE_FAILURE", "Reliable execution persistence failed closed");
    return failed("PERSISTENCE_FAILURE", "Reliable execution integrity check failed closed");
  }
}

function confirmationId(
  ingress: ReliableExecutionIngress,
  identity: OperationIdentity,
  action: ReliableExecutionConfirmationRequest["action"],
): string | null {
  try {
    const result = ingress.confirmOperation(Object.freeze({
      actorId: identity.actor.actorId,
      action,
      requestId: identity.requestId,
      correlationId: identity.correlationId,
    }));
    const record = exactRecord(result, ["confirmationId"]);
    return record !== null && operationalIdentifier(record.confirmationId) ? record.confirmationId : null;
  } catch {
    return null;
  }
}

function runOperation(
  store: PersistenceStore,
  value: unknown,
  expectedKind: OperationCommand["kind"],
  ingress: ReliableExecutionIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
  hooks: ReliableExecutionTestHooks,
  options: BindExecutionOptions = Object.freeze({}),
): ReliableExecutionResult {
  const command = parseOperationCommand(value);
  if (command === null || command.kind !== expectedKind) return failed("INVALID_INPUT", "Reliable execution command is invalid");
  let state: ApplicationState;
  try {
    state = readApplicationStateForOwner(store);
  } catch {
    return failed("PERSISTENCE_FAILURE", "Reliable execution state could not be read");
  }
  const replay = state.executionIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
  if (replay !== undefined) {
    if (!intentTupleMatches(state, replay, command)) return failed("IDEMPOTENCY_CONFLICT", "Idempotency identity is bound to another operation tuple");
    const context = trustedContext(ingress);
    if (context === null) return failed("INVALID_INPUT", "Trusted execution ingress is invalid");
    if (context.actor.actorId !== replay.actorId) return failed("AUTHORIZATION_DENIED", "Replay actor differs from the durable operation actor");
    return processIntent(store, replay.intentId, context, backend, control, hooks, options);
  }
  let context = trustedContext(ingress);
  if (context === null) return failed("INVALID_INPUT", "Trusted execution ingress is invalid");
  let identity = operationIdentity(context, ingress);
  if (identity === null) return failed("INVALID_INPUT", "Trusted execution identities are invalid");
  let useSuccessor = false;
  let bound: BoundExecution | ReliableExecutionFailure;
  if (command.kind === "execution.resume" || command.kind === "execution.retry") {
    const requirement = continuationSuccessorRequirement(state, command, context);
    if ("ok" in requirement) return requirement;
    useSuccessor = requirement.useSuccessor;
    bound = requirement.bound;
  } else {
    bound = bindExecution(
      state,
      command,
      context,
      command.kind === "execution.inspect" ? options : Object.freeze({}),
    );
    if ("ok" in bound) return bound;
  }
  const projectFailure = revalidateBoundProject(bound.project, store);
  if (projectFailure !== null) return projectFailure;
  let namedConfirmation: string | null = null;
  if (command.kind === "manual.turn.report") {
    if (context.actor.actorId !== "local_manual_operator") {
      return failed("AUTHORIZATION_DENIED", "Manual outcome writer requires the trusted local_manual_operator actor", identity);
    }
    const preflight = authorize(state, context.actor.actorId, "execution.inspect", bound.project, context.now, true);
    if (preflight.allowed) namedConfirmation = confirmationId(ingress, identity, "manual.turn.report");
    const refreshed = trustedContext(ingress);
    if (refreshed === null || refreshed.actor.actorId !== context.actor.actorId || refreshed.ownerId !== context.ownerId) {
      return failed("INVALID_INPUT", "Trusted execution context changed during confirmation", identity);
    }
    context = refreshed;
    identity = Object.freeze({ ...identity, ...refreshed });
  }
  const prepared = useSuccessor && (command.kind === "execution.resume" || command.kind === "execution.retry")
    ? prepareSuccessorOperation(store, command, identity, backend)
    : prepareOperation(store, command, identity, backend, namedConfirmation, options);
  if ("ok" in prepared) return prepared;
  hooks.afterStage?.("prepared");
  return processIntent(store, prepared.intent.intentId, context, backend, control, hooks, options);
}

function completionResult(
  state: ApplicationState,
  completionDecisionId: string,
  replayed: boolean,
): ReliableExecutionSuccess {
  const decision = state.manualCompletionDecisions.find((candidate) => candidate.completionDecisionId === completionDecisionId);
  if (decision === undefined) throw new TypeError("Manual completion decision readback is absent");
  const request = state.executionOperationRequests.find((candidate) => candidate.requestId === decision.requestId);
  const finalization = state.executionFinalizations.find((candidate) => candidate.finalizationId === decision.finalizationId);
  const sourceIntent = finalization === undefined
    ? undefined : state.executionIntents.find((candidate) => candidate.intentId === finalization.intentId);
  if (request === undefined || sourceIntent === undefined) throw new TypeError("Manual completion lineage is absent");
  return Object.freeze({
    ok: true as const,
    value: viewForIntent(state, sourceIntent, replayed),
    requestId: request.requestId,
    correlationId: request.correlationId,
  });
}

function completionTupleMatches(
  state: ApplicationState,
  command: ManualCompletionCommand,
  completion: ApplicationState["manualCompletionDecisions"][number],
): boolean {
  const terminal = state.executionTerminalStates.find((candidate) => candidate.executionId === completion.executionId);
  const finalization = state.executionFinalizations.find((candidate) => candidate.finalizationId === completion.finalizationId);
  const intent = finalization === undefined
    ? undefined : state.executionIntents.find((candidate) => candidate.intentId === finalization.intentId);
  return completion.idempotencyKey === command.idempotencyKey && completion.taskId === command.taskId &&
    completion.executionId === command.executionId && completion.attemptNumber === command.expectedAttemptNumber &&
    completion.fencingToken === command.expectedFencingToken && completion.verifiedReceiptId === command.verifiedReceiptId &&
    completion.finalizationId === command.finalizationId && completion.preTaskRevision === command.expectedTaskRevision &&
    terminal?.executionRevision === command.expectedExecutionRevision && terminal.status === "completed" &&
    intent?.projectId === command.projectId && intent.projectResourceRevision === command.expectedProjectResourceRevision &&
    intent.projectConfigRevision === command.expectedProjectConfigRevision && intent.inputReference === command.inputReference;
}

function acceptCompletion(
  store: PersistenceStore,
  value: unknown,
  ingress: ReliableExecutionIngress,
  hooks: ReliableExecutionTestHooks,
): ReliableExecutionResult {
  const command = parseCompletionCommand(value);
  if (command === null) return failed("INVALID_INPUT", "Manual completion command is invalid");
  let state: ApplicationState;
  try {
    state = readApplicationStateForOwner(store);
  } catch {
    return failed("PERSISTENCE_FAILURE", "Manual completion state could not be read");
  }
  const replay = state.manualCompletionDecisions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
  if (replay !== undefined) {
    return completionTupleMatches(state, command, replay)
      ? completionResult(state, replay.completionDecisionId, true)
      : failed("IDEMPOTENCY_CONFLICT", "Completion idempotency identity is bound to another tuple");
  }
  let context = trustedContext(ingress);
  if (context === null) return failed("INVALID_INPUT", "Trusted completion ingress is invalid");
  let identity = operationIdentity(context, ingress);
  if (identity === null) return failed("INVALID_INPUT", "Trusted completion identities are invalid");
  const completionOptions = Object.freeze({ allowExpiredLease: true, allowDifferentOwner: true });
  const bound = bindExecution(state, command, context, completionOptions);
  if ("ok" in bound) return bound;
  if (bound.task.state !== "running") return failed("TASK_NOT_ELIGIBLE", "Manual completion requires a running Task", identity);
  const projectFailure = revalidateBoundProject(bound.project, store);
  if (projectFailure !== null) return projectFailure;
  const preflight = authorize(state, context.actor.actorId, "execution.completion.accept", bound.project, context.now, false);
  const namedConfirmation = preflight.reason === "confirmation_required"
    ? confirmationId(ingress, identity, "execution.completion.accept") : null;
  const refreshed = trustedContext(ingress);
  if (refreshed === null || refreshed.actor.actorId !== context.actor.actorId || refreshed.ownerId !== context.ownerId) {
    return failed("INVALID_INPUT", "Trusted completion context changed during confirmation", identity);
  }
  context = refreshed;
  identity = Object.freeze({ ...identity, ...refreshed });
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = bindExecution(current, command, context, completionOptions);
      if ("ok" in currentBound) return Object.freeze({ ...currentBound, requestId: identity.requestId, correlationId: identity.correlationId });
      if (currentBound.task.state !== "running") return failed("TASK_NOT_ELIGIBLE", "Manual completion requires a current running Task", identity);
      const receipt = current.executionReceipts.find((candidate) => candidate.verifiedReceiptId === command.verifiedReceiptId);
      const finalization = current.executionFinalizations.find((candidate) => candidate.finalizationId === command.finalizationId);
      const sourceIntent = finalization === undefined
        ? undefined : current.executionIntents.find((candidate) => candidate.intentId === finalization.intentId);
      const observation = sourceIntent === undefined ? null : latestObservation(current, sourceIntent.intentId);
      const turn = current.manualTurns.find((candidate) => candidate.executionId === command.executionId);
      const evidenceMatches = receipt !== undefined && finalization !== undefined && sourceIntent !== undefined &&
        observation?.lifecycle === "turn_succeeded" && receipt.intentId === sourceIntent.intentId &&
        finalization.intentId === sourceIntent.intentId && finalization.verifiedReceiptId === receipt.verifiedReceiptId &&
        finalization.outcome === "accepted" && sourceIntent.state === "finalized" &&
        sourceIntent.executionId === command.executionId && sourceIntent.taskId === command.taskId &&
        sourceIntent.inputReference === command.inputReference && sourceIntent.executionRevision === command.expectedExecutionRevision &&
        sourceIntent.attemptNumber === command.expectedAttemptNumber && sourceIntent.fencingToken === command.expectedFencingToken &&
        turn?.lifecycle === "turn_succeeded" && turn.fencingToken === command.expectedFencingToken;
      const baseEvaluation = authorize(
        current, identity.actor.actorId, "execution.completion.accept", currentBound.project, identity.now,
        namedConfirmation !== null,
      );
      const evaluation: AuthorizationEvaluation = evidenceMatches ? baseEvaluation : Object.freeze({
        ...baseEvaluation, allowed: false, reason: "policy_denied" as const, policy: "deny" as const,
      });
      transaction.insertExecutionOperationRequest(requestRecord(
        identity.requestId, identity.correlationId, identity.actor.actorId, "execution.completion.accept",
        currentBound.execution, evaluation.allowed, identity.now,
      ));
      transaction.insertExecutionAuthorizationDecision(decisionRecord(
        identity.decisionId, identity.requestId, identity.actor.actorId, "execution.completion.accept",
        evaluation, currentBound.project, identity.now,
      ));
      if (!evaluation.allowed || namedConfirmation === null || receipt === undefined || finalization === undefined) {
        transaction.insertExecutionOperationAudit(auditRecord(
          identity.auditId, identity.requestId, identity.decisionId, identity.actor.actorId,
          identity.correlationId, currentBound.execution, "execution.operation.denied", false,
          evaluation.reason, identity.now,
        ));
        return failed(
          evaluation.reason === "confirmation_required" || namedConfirmation === null ? "CONFIRMATION_REQUIRED" : "AUTHORIZATION_DENIED",
          "Manual completion lacks current authorization, confirmation, or exact verified turn evidence",
          identity,
        );
      }
      if (current.executionIntents.some((candidate) => candidate.confirmationId === namedConfirmation) ||
        current.manualCompletionDecisions.some((candidate) => candidate.confirmationId === namedConfirmation)) {
        throw new TypeError("Completion confirmation was already consumed");
      }
      const completionDecisionId = stableId("completion", identity.operationId);
      const postTaskRevision = currentBound.task.revision + 1;
      transaction.insertExecutionOperationAudit(auditRecord(
        identity.auditId, identity.requestId, identity.decisionId, identity.actor.actorId,
        identity.correlationId, currentBound.execution, "execution.completion.accepted", true,
        "manual_completion_accepted", identity.now,
      ));
      transaction.insertManualCompletionDecision(Object.freeze({
        completionDecisionId,
        operationId: identity.operationId,
        idempotencyKey: command.idempotencyKey,
        taskId: command.taskId,
        executionId: command.executionId,
        attemptNumber: command.expectedAttemptNumber,
        fencingToken: command.expectedFencingToken,
        verifiedReceiptId: command.verifiedReceiptId,
        finalizationId: command.finalizationId,
        preTaskRevision: currentBound.task.revision,
        postTaskRevision,
        requestId: identity.requestId,
        decisionId: identity.decisionId,
        auditId: identity.auditId,
        confirmationId: namedConfirmation,
        createdAt: identity.now,
      }));
      const transition = transitionTask(current.domain, {
        taskId: currentBound.task.id,
        event: "completion_accepted",
        targetState: "completed",
        payload: {
          decision: {
            decisionId: completionDecisionId,
            taskId: currentBound.task.id,
            taskRevision: currentBound.task.revision,
            status: "accepted",
          },
        },
      });
      if (!transition.ok) throw new TypeError("Manual completion Domain transition was rejected");
      transaction.writeDomain(current.domain, transition.value);
      transaction.insertExecutionTerminalState(Object.freeze({
        executionId: currentBound.execution.executionId,
        status: "completed" as const,
        attemptNumber: currentBound.execution.attemptNumber,
        fencingToken: currentBound.execution.fencingToken,
        verifiedReceiptId: receipt.verifiedReceiptId,
        finalizationId: finalization.finalizationId,
        completionDecisionId,
        preTaskRevision: currentBound.task.revision,
        postTaskRevision,
        executionRevision: currentBound.execution.revision,
        createdAt: identity.now,
      }));
      const readback = transaction.read();
      const completedTask = readback.domain.tasks.find((candidate) => candidate.id === command.taskId);
      if (completedTask?.state !== "completed" || completedTask.revision !== postTaskRevision) {
        throw new TypeError("Manual completion terminal readback failed");
      }
      return completionResult(readback, completionDecisionId, false);
    });
    hooks.afterStage?.("completion-accepted");
    return result;
  } catch {
    return failed("PERSISTENCE_FAILURE", "Manual completion failed closed", identity);
  }
}

function createReliableExecutionServiceInternal(
  store: PersistenceStore,
  ingress: ReliableExecutionIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
  hooks: ReliableExecutionTestHooks,
): ReliableExecutionService {
  if (backend.contractId !== EXECUTION_CONTRACT_ID || control.outcomeContractId !== MANUAL_OUTCOME_CONTROL_ID ||
    !operationalIdentifier(backend.adapterId) || !operationalIdentifier(backend.adapterVersion)) {
    throw new TypeError("Reliable execution adapter contract identity is invalid");
  }
  const reconcile = (value: ExecutionLoopInspectCommand): ReliableExecutionResult => {
    const command = parseOperationCommand(value);
    if (command === null || command.kind !== "execution.inspect") return failed("INVALID_INPUT", "Reconciliation command is invalid");
    const context = trustedContext(ingress);
    if (context === null) return failed("INVALID_INPUT", "Trusted reconciliation ingress is invalid");
    let state: ApplicationState;
    try { state = readApplicationStateForOwner(store); } catch { return failed("PERSISTENCE_FAILURE", "Reconciliation state could not be read"); }
    const reconciliationOptions = Object.freeze({ allowExpiredLease: true, allowDifferentOwner: true });
    const bound = bindExecution(state, command, context, reconciliationOptions);
    if ("ok" in bound) return bound;
    const projectFailure = revalidateBoundProject(bound.project, store);
    if (projectFailure !== null) return projectFailure;
    const unfinished = state.executionIntents.find((candidate) =>
      candidate.executionId === command.executionId && candidate.state !== "finalized"
    );
    if (unfinished === undefined) {
      return runOperation(
        store,
        command,
        "execution.inspect",
        ingress,
        backend,
        control,
        hooks,
        reconciliationOptions,
      );
    }
    if (
      unfinished.actorId !== context.actor.actorId || unfinished.projectId !== command.projectId ||
      unfinished.taskId !== command.taskId || unfinished.taskRevision !== command.expectedTaskRevision ||
      unfinished.inputReference !== command.inputReference || unfinished.executionRevision !== command.expectedExecutionRevision ||
      unfinished.attemptNumber !== command.expectedAttemptNumber || unfinished.fencingToken !== command.expectedFencingToken ||
      unfinished.policyBindingReference !== command.policyBindingReference
    ) return failed("STALE_REVISION", "Reconciliation command does not match the unfinished intent");
    return processIntent(store, unfinished.intentId, context, backend, control, hooks, reconciliationOptions);
  };
  return Object.freeze({
    start: (command: ExecutionLoopStartCommand) => runOperation(store, command, "execution.start", ingress, backend, control, hooks),
    inspect: (command: ExecutionLoopInspectCommand) => runOperation(store, command, "execution.inspect", ingress, backend, control, hooks),
    resume: (command: ExecutionLoopResumeCommand) => runOperation(store, command, "execution.resume", ingress, backend, control, hooks),
    retry: (command: ExecutionLoopResumeCommand) => runOperation(store, command, "execution.retry", ingress, backend, control, hooks),
    requestCancel: (command: ExecutionLoopCancelCommand) => runOperation(store, command, "execution.cancel", ingress, backend, control, hooks),
    recordManualOutcome: (command: ManualOutcomeCommand) => runOperation(store, command, "manual.turn.report", ingress, backend, control, hooks),
    acceptManualCompletion: (command: ManualCompletionCommand) => acceptCompletion(store, command, ingress, hooks),
    reconcile,
  });
}

export function createReliableExecutionService(
  store: PersistenceStore,
  ingress: ReliableExecutionIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
): ReliableExecutionService {
  return createReliableExecutionServiceInternal(store, ingress, backend, control, Object.freeze({}));
}

export function createReliableExecutionServiceWithHooks(
  store: PersistenceStore,
  ingress: ReliableExecutionIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
  hooks: ReliableExecutionTestHooks,
): ReliableExecutionService {
  return createReliableExecutionServiceInternal(store, ingress, backend, control, hooks);
}
