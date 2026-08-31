import {
  createApplicationService,
  type ApplicationErrorCode,
  type ApplicationFailure,
  type ApplicationIngress,
  type CapabilityEpochResult,
} from "./application.ts";
import {
  createManualDispatcher,
  type ManualDispatcherIngress,
} from "./dispatcher.ts";
import type {
  DispatcherErrorCode,
  DispatcherResult,
  DispatcherRunView,
} from "./dispatcher-application.ts";
import {
  createReliableExecutionService,
  type ExecutionLoopCancelCommand,
  type ExecutionLoopResumeCommand,
  type ManualCompletionCommand,
  type ManualOutcomeCommand,
  type ReliableExecutionErrorCode,
  type ReliableExecutionResult,
  type ReliableExecutionView,
} from "./execution-loop.ts";
import type { ExecutionBackend, ManualOutcomeControl, ManualOutcomeOperation } from "./execution-port.ts";
import {
  readApplicationStateForOwner,
  type ApplicationState,
  type ExecutionAttempt,
  type ExecutionOperationIntent,
  type ManualBackendTurnRecord,
  type RegisteredProject,
} from "./persistence/application-repository.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import type { Task, WaitingMetadata } from "./domain.ts";

export type ProductRuntimeIngress = ApplicationIngress & ManualDispatcherIngress;

export interface ProductApplicationError {
  readonly owner: "application";
  readonly code: ApplicationErrorCode;
  readonly confirmationRequired: boolean;
}

export interface ProductReliableError {
  readonly owner: "reliable";
  readonly code: ReliableExecutionErrorCode;
}

export interface ProductDispatcherError {
  readonly owner: "dispatcher";
  readonly code: DispatcherErrorCode;
}

export type ProductRuntimeError = ProductApplicationError | ProductReliableError | ProductDispatcherError;

export interface ProductRuntimeSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ProductRuntimeFailure {
  readonly ok: false;
  readonly error: ProductRuntimeError;
}

export type ProductRuntimeResult<T> = ProductRuntimeSuccess<T> | ProductRuntimeFailure;

export interface ProductWaitingView {
  readonly reason: WaitingMetadata["reason"];
  readonly phase: string;
  readonly requiredAction: string;
  readonly lastErrorCode: string;
  readonly lastErrorSummary: string | null;
  readonly retryable: boolean;
  readonly retryCount: number;
  readonly retryAfter: number | null;
  readonly executionId: string | null;
  readonly workspaceRevision: string | null;
  readonly waitingTaskRevision: number;
}

export interface ProductExecutionView {
  readonly executionId: string;
  readonly taskId: string;
  readonly taskState: Task["state"];
  readonly taskRevision: number;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly lifecycle: ReliableExecutionView["lifecycle"];
  readonly observationNumber: number | null;
  readonly waiting: ProductWaitingView | null;
  readonly replayed: boolean;
}

export interface ProductDispatcherView {
  readonly runId: string;
  readonly status: DispatcherRunView["status"];
  readonly ownerRevision: number;
  readonly runRevision: number;
  readonly heartbeatAt: string;
  readonly leaseExpiresAt: string;
  readonly membershipRevision: number | null;
  readonly expectedMemberCount: number | null;
  readonly pendingMemberCount: number;
  readonly terminalMemberCount: number;
  readonly terminalStatus: DispatcherRunView["terminalStatus"];
  readonly replayed: boolean;
}

export interface ProductExecutionCommon {
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedAttemptNumber: number;
  readonly expectedFencingToken: number;
  readonly idempotencyKey: string;
}

export interface ProductExecutionInspectCommand extends ProductExecutionCommon {
  readonly kind: "execution.inspect";
}

export interface ProductExecutionContinuationCommand extends ProductExecutionCommon {
  readonly kind: "execution.resume" | "execution.retry";
  readonly continuationReference: string;
  readonly requiredActionReceiptId: string;
}

export interface ProductExecutionCancelCommand extends ProductExecutionCommon {
  readonly kind: "execution.request-cancel";
  readonly reasonCode: string;
}

export interface ProductManualOutcomeCommand extends ProductExecutionCommon {
  readonly kind: "manual.outcome-report";
  readonly reportId: string;
  readonly outcome: ManualOutcomeOperation;
  readonly code: string;
  readonly evidenceReference: string | null;
}

export interface ProductManualCompletionCommand extends ProductExecutionCommon {
  readonly kind: "execution.accept-manual-completion";
}

export interface ProductRuntime {
  upgrade(value: unknown): ProductRuntimeResult<CapabilityEpochResult>;
  dispatchRun(value: unknown): ProductRuntimeResult<ProductDispatcherView>;
  dispatchResume(value: unknown): ProductRuntimeResult<ProductDispatcherView>;
  inspect(value: unknown): ProductRuntimeResult<ProductExecutionView>;
  resume(value: unknown): ProductRuntimeResult<ProductExecutionView>;
  retry(value: unknown): ProductRuntimeResult<ProductExecutionView>;
  requestCancel(value: unknown): ProductRuntimeResult<ProductExecutionView>;
  recordManualOutcome(value: unknown): ProductRuntimeResult<ProductExecutionView>;
  acceptManualCompletion(value: unknown): ProductRuntimeResult<ProductExecutionView>;
}

type UnknownRecord = Record<string, unknown>;
type BoundProductExecution = Readonly<{
  project: RegisteredProject;
  task: Task;
  execution: ExecutionAttempt;
  turn: ManualBackendTurnRecord;
}>;

const COMMON_KEYS = Object.freeze([
  "projectId", "expectedProjectResourceRevision", "expectedProjectConfigRevision", "taskId",
  "expectedTaskRevision", "executionId", "expectedExecutionRevision", "expectedAttemptNumber",
  "expectedFencingToken", "idempotencyKey",
] as const);
const OPERATIONAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const EXECUTION_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;

function exactRecord(value: unknown, keys: readonly string[]): Readonly<UnknownRecord> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  try {
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
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function operationalId(value: unknown): value is string {
  return typeof value === "string" && OPERATIONAL_ID.test(value);
}

function executionCode(value: unknown): value is string {
  return typeof value === "string" && EXECUTION_CODE.test(value);
}

function reliableFailure(code: ReliableExecutionErrorCode): ProductRuntimeFailure {
  return Object.freeze({ ok: false as const, error: Object.freeze({ owner: "reliable" as const, code }) });
}

function applicationFailure(failure: ApplicationFailure): ProductRuntimeFailure {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      owner: "application" as const,
      code: failure.error.code,
      confirmationRequired: failure.error.details.reason === "confirmation_required",
    }),
  });
}

function parseCommon(record: Readonly<UnknownRecord>): ProductExecutionCommon | null {
  if (
    !operationalId(record.projectId) || !positive(record.expectedProjectResourceRevision) ||
    !positive(record.expectedProjectConfigRevision) || !operationalId(record.taskId) ||
    !positive(record.expectedTaskRevision) || !operationalId(record.executionId) ||
    !positive(record.expectedExecutionRevision) || !positive(record.expectedAttemptNumber) ||
    !positive(record.expectedFencingToken) || !operationalId(record.idempotencyKey)
  ) return null;
  return Object.freeze({
    projectId: record.projectId,
    expectedProjectResourceRevision: record.expectedProjectResourceRevision,
    expectedProjectConfigRevision: record.expectedProjectConfigRevision,
    taskId: record.taskId,
    expectedTaskRevision: record.expectedTaskRevision,
    executionId: record.executionId,
    expectedExecutionRevision: record.expectedExecutionRevision,
    expectedAttemptNumber: record.expectedAttemptNumber,
    expectedFencingToken: record.expectedFencingToken,
    idempotencyKey: record.idempotencyKey,
  });
}

function parseInspect(value: unknown): ProductExecutionInspectCommand | null {
  const record = exactRecord(value, ["kind", ...COMMON_KEYS]);
  const common = record === null ? null : parseCommon(record);
  return common !== null && record?.kind === "execution.inspect"
    ? Object.freeze({ kind: "execution.inspect" as const, ...common }) : null;
}

function parseContinuation(
  value: unknown,
  kind: ProductExecutionContinuationCommand["kind"],
): ProductExecutionContinuationCommand | null {
  const record = exactRecord(value, ["kind", ...COMMON_KEYS, "continuationReference", "requiredActionReceiptId"]);
  const common = record === null ? null : parseCommon(record);
  return common !== null && record?.kind === kind && operationalId(record.continuationReference) &&
    operationalId(record.requiredActionReceiptId)
    ? Object.freeze({ kind, ...common, continuationReference: record.continuationReference, requiredActionReceiptId: record.requiredActionReceiptId })
    : null;
}

function parseCancel(value: unknown): ProductExecutionCancelCommand | null {
  const record = exactRecord(value, ["kind", ...COMMON_KEYS, "reasonCode"]);
  const common = record === null ? null : parseCommon(record);
  return common !== null && record?.kind === "execution.request-cancel" && executionCode(record.reasonCode)
    ? Object.freeze({ kind: "execution.request-cancel" as const, ...common, reasonCode: record.reasonCode }) : null;
}

function parseOutcome(value: unknown): ProductManualOutcomeCommand | null {
  const record = exactRecord(value, ["kind", ...COMMON_KEYS, "reportId", "outcome", "code", "evidenceReference"]);
  const common = record === null ? null : parseCommon(record);
  const operations: ReadonlySet<unknown> = new Set(["activate", "wait", "succeed", "fail", "confirm_cancelled"]);
  return common !== null && record?.kind === "manual.outcome-report" && operationalId(record.reportId) &&
    operations.has(record.outcome) && executionCode(record.code) &&
    (record.evidenceReference === null || operationalId(record.evidenceReference))
    ? Object.freeze({
      kind: "manual.outcome-report" as const,
      ...common,
      reportId: record.reportId,
      outcome: record.outcome as ManualOutcomeOperation,
      code: record.code,
      evidenceReference: record.evidenceReference as string | null,
    }) : null;
}

function parseCompletion(value: unknown): ProductManualCompletionCommand | null {
  const record = exactRecord(value, ["kind", ...COMMON_KEYS]);
  const common = record === null ? null : parseCommon(record);
  return common !== null && record?.kind === "execution.accept-manual-completion"
    ? Object.freeze({ kind: "execution.accept-manual-completion" as const, ...common }) : null;
}

function currentTurn(state: ApplicationState, execution: ExecutionAttempt): ManualBackendTurnRecord | ProductRuntimeFailure {
  const turns = state.manualTurns.filter((candidate) => candidate.executionId === execution.executionId &&
    candidate.attemptNumber === execution.attemptNumber && candidate.fencingToken === execution.fencingToken);
  const leaves = turns.filter((candidate) => !turns.some((successor) =>
    successor.predecessorBackendExecutionId === candidate.backendExecutionId && successor.predecessorThreadId === candidate.threadId
  ));
  return leaves.length === 1 ? leaves[0] as ManualBackendTurnRecord : reliableFailure("RECONCILIATION_REQUIRED");
}

function bindCurrent(state: ApplicationState, command: ProductExecutionCommon): BoundProductExecution | ProductRuntimeFailure {
  const projects = state.projects.filter((candidate) => candidate.projectId === command.projectId);
  if (projects.length === 0) return reliableFailure("PROJECT_NOT_FOUND");
  if (projects.length !== 1) return reliableFailure("RECONCILIATION_REQUIRED");
  const project = projects[0] as RegisteredProject;
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
    project.configRevision !== command.expectedProjectConfigRevision) return reliableFailure("STALE_REVISION");
  const tasks = state.domain.tasks.filter((candidate) => candidate.id === command.taskId);
  if (tasks.length === 0) return reliableFailure("TASK_NOT_FOUND");
  if (tasks.length !== 1) return reliableFailure("RECONCILIATION_REQUIRED");
  const task = tasks[0] as Task;
  if (task.projectId !== command.projectId || task.revision !== command.expectedTaskRevision) {
    return reliableFailure("STALE_REVISION");
  }
  const executions = state.executions.filter((candidate) => candidate.executionId === command.executionId);
  if (executions.length === 0) return reliableFailure("EXECUTION_NOT_FOUND");
  if (executions.length !== 1) return reliableFailure("RECONCILIATION_REQUIRED");
  const execution = executions[0] as ExecutionAttempt;
  if (execution.taskId !== task.id || execution.revision !== command.expectedExecutionRevision ||
    execution.attemptNumber !== command.expectedAttemptNumber) return reliableFailure("STALE_REVISION");
  if (execution.fencingToken !== command.expectedFencingToken) return reliableFailure("STALE_FENCE");
  const turn = currentTurn(state, execution);
  return "ok" in turn ? turn : Object.freeze({ project, task, execution, turn });
}

function deadline(now: string): string | null {
  const milliseconds = Date.parse(now);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === now
    ? new Date(milliseconds + 3_600_000).toISOString() : null;
}

function waitingProjection(waiting: WaitingMetadata | null): ProductWaitingView | null {
  return waiting === null ? null : Object.freeze({
    reason: waiting.reason,
    phase: waiting.phase,
    requiredAction: waiting.requiredAction,
    lastErrorCode: waiting.lastErrorCode,
    lastErrorSummary: waiting.lastErrorSummary,
    retryable: waiting.retryable,
    retryCount: waiting.retryCount,
    retryAfter: waiting.retryAfter,
    executionId: waiting.executionId,
    workspaceRevision: waiting.workspaceRevision,
    waitingTaskRevision: waiting.waitingTaskRevision,
  });
}

function executionProjection(view: ReliableExecutionView): ProductExecutionView {
  return Object.freeze({
    executionId: view.executionId,
    taskId: view.taskId,
    taskState: view.taskState,
    taskRevision: view.taskRevision,
    executionRevision: view.executionRevision,
    attemptNumber: view.attemptNumber,
    fencingToken: view.fencingToken,
    lifecycle: view.lifecycle,
    observationNumber: view.observationNumber,
    waiting: waitingProjection(view.waiting),
    replayed: view.replayed,
  });
}

function projectReliable(result: ReliableExecutionResult): ProductRuntimeResult<ProductExecutionView> {
  return result.ok
    ? Object.freeze({ ok: true as const, value: executionProjection(result.value) })
    : reliableFailure(result.error.code);
}

function dispatcherProjection(view: DispatcherRunView, replayed: boolean): ProductDispatcherView {
  return Object.freeze({
    runId: view.runId,
    status: view.status,
    ownerRevision: view.ownerRevision,
    runRevision: view.runRevision,
    heartbeatAt: view.heartbeatAt,
    leaseExpiresAt: view.leaseExpiresAt,
    membershipRevision: view.membershipRevision,
    expectedMemberCount: view.expectedMemberCount,
    pendingMemberCount: view.pendingMemberCount,
    terminalMemberCount: view.terminalMemberCount,
    terminalStatus: view.terminalStatus,
    replayed,
  });
}

function projectDispatcher(
  result: DispatcherResult<DispatcherRunView>,
  replayed: boolean,
): ProductRuntimeResult<ProductDispatcherView> {
  return result.ok
    ? Object.freeze({ ok: true as const, value: dispatcherProjection(result.value, replayed) })
    : Object.freeze({ ok: false as const, error: Object.freeze({ owner: "dispatcher" as const, code: result.error.code }) });
}

function oneIntentByKey(state: ApplicationState, key: string): ExecutionOperationIntent | null | ProductRuntimeFailure {
  const matches = state.executionIntents.filter((candidate) => candidate.idempotencyKey === key);
  return matches.length === 0 ? null : matches.length === 1
    ? matches[0] as ExecutionOperationIntent : reliableFailure("RECONCILIATION_REQUIRED");
}

function commonValues(command: ProductExecutionCommon): ProductExecutionCommon {
  return Object.freeze({
    projectId: command.projectId,
    expectedProjectResourceRevision: command.expectedProjectResourceRevision,
    expectedProjectConfigRevision: command.expectedProjectConfigRevision,
    taskId: command.taskId,
    expectedTaskRevision: command.expectedTaskRevision,
    executionId: command.executionId,
    expectedExecutionRevision: command.expectedExecutionRevision,
    expectedAttemptNumber: command.expectedAttemptNumber,
    expectedFencingToken: command.expectedFencingToken,
    idempotencyKey: command.idempotencyKey,
  });
}

function intentBase(
  command: ProductExecutionCommon,
  intent: ExecutionOperationIntent,
): Readonly<ProductExecutionCommon & {
  inputReference: string;
  policyBindingReference: string;
  requestedDeadline: string;
}> {
  return Object.freeze({
    ...commonValues(command),
    inputReference: intent.inputReference,
    policyBindingReference: intent.policyBindingReference,
    requestedDeadline: intent.requestedDeadline,
  });
}

function currentBase(
  command: ProductExecutionCommon,
  bound: BoundProductExecution,
  now: string,
): Readonly<ProductExecutionCommon & {
  inputReference: string;
  policyBindingReference: string;
  requestedDeadline: string;
}> | ProductRuntimeFailure {
  const requestedDeadline = deadline(now);
  return requestedDeadline === null ? reliableFailure("INVALID_INPUT") : Object.freeze({
    ...commonValues(command),
    inputReference: bound.turn.inputReference,
    policyBindingReference: bound.turn.policyBindingReference,
    requestedDeadline,
  });
}

function latestTurnReceipt(state: ApplicationState, turn: ManualBackendTurnRecord) {
  const matches = state.executionReceipts.filter((receipt) => receipt.backendExecutionId === turn.backendExecutionId &&
    receipt.threadId === turn.threadId && receipt.observedRevision === turn.revision &&
    receipt.fencingToken === turn.fencingToken);
  if (matches.length === 0) return null;
  return [...matches].sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt))[0] ?? null;
}

export function createProductRuntime(
  store: PersistenceStore,
  ingress: ProductRuntimeIngress,
  backend: ExecutionBackend,
  control: ManualOutcomeControl,
): ProductRuntime {
  const application = createApplicationService(store, ingress);
  const reliable = createReliableExecutionService(store, ingress, backend, control);
  const dispatcher = createManualDispatcher(store, ingress, backend, control);

  const state = (): ApplicationState | ProductRuntimeFailure => {
    try {
      return readApplicationStateForOwner(store);
    } catch {
      return reliableFailure("PERSISTENCE_FAILURE");
    }
  };

  const operationContext = (
    command: ProductExecutionCommon,
  ): Readonly<{ state: ApplicationState; bound: BoundProductExecution | null; intent: ExecutionOperationIntent | null }> | ProductRuntimeFailure => {
    const current = state();
    if ("ok" in current) return current;
    const replay = oneIntentByKey(current, command.idempotencyKey);
    if (replay !== null) {
      if ("ok" in replay) return replay;
      return Object.freeze({ state: current, bound: null, intent: replay });
    }
    const bound = bindCurrent(current, command);
    return "ok" in bound ? bound : Object.freeze({ state: current, bound, intent: null });
  };

  return Object.freeze({
    upgrade(value: unknown): ProductRuntimeResult<CapabilityEpochResult> {
      const record = exactRecord(value, ["kind", "expiresAt"]);
      if (record === null || record.kind !== "authorization.upgrade" || typeof record.expiresAt !== "string") {
        return reliableFailure("INVALID_INPUT");
      }
      const result = application.upgrade(Object.freeze({
        kind: "authorization.capability.upgrade" as const,
        expiresAt: record.expiresAt,
      }));
      return result.ok ? Object.freeze({ ok: true as const, value: result.value }) : applicationFailure(result);
    },

    dispatchRun(value: unknown): ProductRuntimeResult<ProductDispatcherView> {
      const record = exactRecord(value, ["kind", "idempotencyKey", "leaseDurationSeconds"]);
      if (record === null || record.kind !== "dispatch.run" || !operationalId(record.idempotencyKey) ||
        !positive(record.leaseDurationSeconds) || record.leaseDurationSeconds < 30 || record.leaseDurationSeconds > 3_600) {
        return reliableFailure("INVALID_INPUT");
      }
      const before = state();
      if ("ok" in before) return before;
      const priorRequestIds = new Set(before.dispatcherTriggerRequests.map((candidate) => candidate.requestId));
      const result = dispatcher.run(Object.freeze({
        kind: "dispatch.start" as const,
        idempotencyKey: record.idempotencyKey,
        leaseDurationSeconds: record.leaseDurationSeconds,
      }));
      if (!result.ok) return projectDispatcher(result, false);
      const after = state();
      if ("ok" in after) return after;
      const run = after.dispatcherRuns.find((candidate) => candidate.runId === result.value.runId);
      return run === undefined ? reliableFailure("RECONCILIATION_REQUIRED")
        : projectDispatcher(result, priorRequestIds.has(run.requestId));
    },

    dispatchResume(value: unknown): ProductRuntimeResult<ProductDispatcherView> {
      const record = exactRecord(value, ["kind", "runId"]);
      if (record === null || record.kind !== "dispatch.resume" || !operationalId(record.runId)) {
        return reliableFailure("INVALID_INPUT");
      }
      return projectDispatcher(dispatcher.resume(record.runId), false);
    },

    inspect(value: unknown): ProductRuntimeResult<ProductExecutionView> {
      const command = parseInspect(value);
      if (command === null) return reliableFailure("INVALID_INPUT");
      const context = operationContext(command);
      if ("ok" in context) return context;
      const internal = context.intent !== null
        ? (() => {
          const intent = context.intent;
          if (intent.operationKind !== "inspect" || intent.backendExecutionId === null || intent.threadId === null) return null;
          return Object.freeze({
            kind: "execution.inspect" as const,
            ...intentBase(command, intent),
            backendExecutionId: intent.backendExecutionId,
            threadId: intent.threadId,
            lastObservationNumber: intent.lastObservationNumber,
          });
        })()
        : (() => {
          const bound = context.bound as BoundProductExecution;
          const base = currentBase(command, bound, ingress.now());
          return "ok" in base ? null : Object.freeze({
            kind: "execution.inspect" as const,
            ...base,
            backendExecutionId: bound.turn.backendExecutionId,
            threadId: bound.turn.threadId,
            lastObservationNumber: bound.turn.revision,
          });
        })();
      return internal === null ? reliableFailure("IDEMPOTENCY_CONFLICT") : projectReliable(reliable.inspect(internal));
    },

    resume(value: unknown): ProductRuntimeResult<ProductExecutionView> {
      const command = parseContinuation(value, "execution.resume");
      if (command === null) return reliableFailure("INVALID_INPUT");
      return continuation(command, "execution.resume");
    },

    retry(value: unknown): ProductRuntimeResult<ProductExecutionView> {
      const command = parseContinuation(value, "execution.retry");
      if (command === null) return reliableFailure("INVALID_INPUT");
      return continuation(command, "execution.retry");
    },

    requestCancel(value: unknown): ProductRuntimeResult<ProductExecutionView> {
      const command = parseCancel(value);
      if (command === null) return reliableFailure("INVALID_INPUT");
      const context = operationContext(command);
      if ("ok" in context) return context;
      let internal: ExecutionLoopCancelCommand | null = null;
      if (context.intent !== null) {
        const intent = context.intent;
        if (intent.operationKind === "request_cancel" && intent.backendExecutionId !== null && intent.threadId !== null &&
          intent.expectedLifecycle !== null) {
          internal = Object.freeze({
            kind: "execution.cancel" as const,
            ...intentBase(command, intent),
            backendExecutionId: intent.backendExecutionId,
            threadId: intent.threadId,
            expectedLifecycle: intent.expectedLifecycle,
            reasonCode: command.reasonCode,
            lastObservationNumber: intent.lastObservationNumber,
          });
        }
      } else {
        const bound = context.bound as BoundProductExecution;
        const base = currentBase(command, bound, ingress.now());
        if (!("ok" in base)) internal = Object.freeze({
          kind: "execution.cancel" as const,
          ...base,
          backendExecutionId: bound.turn.backendExecutionId,
          threadId: bound.turn.threadId,
          expectedLifecycle: bound.turn.lifecycle,
          reasonCode: command.reasonCode,
          lastObservationNumber: bound.turn.revision,
        });
      }
      return internal === null ? reliableFailure("IDEMPOTENCY_CONFLICT") : projectReliable(reliable.requestCancel(internal));
    },

    recordManualOutcome(value: unknown): ProductRuntimeResult<ProductExecutionView> {
      const command = parseOutcome(value);
      if (command === null) return reliableFailure("INVALID_INPUT");
      const context = operationContext(command);
      if ("ok" in context) return context;
      let internal: ManualOutcomeCommand | null = null;
      if (context.intent !== null) {
        const intent = context.intent;
        if (intent.operationKind === "manual_report" && intent.backendExecutionId !== null && intent.threadId !== null &&
          intent.expectedJournalRevision !== null && intent.expectedLifecycle !== null) {
          internal = Object.freeze({
            kind: "manual.turn.report" as const,
            ...intentBase(command, intent),
            reportId: command.reportId,
            backendExecutionId: intent.backendExecutionId,
            threadId: intent.threadId,
            expectedJournalRevision: intent.expectedJournalRevision,
            expectedLifecycle: intent.expectedLifecycle,
            outcomeOperation: command.outcome,
            code: command.code,
            evidenceReference: command.evidenceReference,
            lastObservationNumber: intent.lastObservationNumber,
          });
        }
      } else {
        const bound = context.bound as BoundProductExecution;
        const base = currentBase(command, bound, ingress.now());
        if (!("ok" in base)) internal = Object.freeze({
          kind: "manual.turn.report" as const,
          ...base,
          reportId: command.reportId,
          backendExecutionId: bound.turn.backendExecutionId,
          threadId: bound.turn.threadId,
          expectedJournalRevision: bound.turn.revision,
          expectedLifecycle: bound.turn.lifecycle,
          outcomeOperation: command.outcome,
          code: command.code,
          evidenceReference: command.evidenceReference,
          lastObservationNumber: bound.turn.revision,
        });
      }
      return internal === null ? reliableFailure("IDEMPOTENCY_CONFLICT") : projectReliable(reliable.recordManualOutcome(internal));
    },

    acceptManualCompletion(value: unknown): ProductRuntimeResult<ProductExecutionView> {
      const command = parseCompletion(value);
      if (command === null) return reliableFailure("INVALID_INPUT");
      const current = state();
      if ("ok" in current) return current;
      const decisions = current.manualCompletionDecisions.filter((candidate) => candidate.idempotencyKey === command.idempotencyKey);
      if (decisions.length > 1) return reliableFailure("RECONCILIATION_REQUIRED");
      let internal: ManualCompletionCommand | null = null;
      if (decisions.length === 1) {
        const decision = decisions[0] as ApplicationState["manualCompletionDecisions"][number];
        const finalization = current.executionFinalizations.find((candidate) => candidate.finalizationId === decision.finalizationId);
        const intent = finalization === undefined ? undefined : current.executionIntents.find((candidate) => candidate.intentId === finalization.intentId);
        if (intent !== undefined) internal = Object.freeze({
          kind: "execution.completion.accept" as const,
          ...commonValues(command),
          inputReference: intent.inputReference,
          verifiedReceiptId: decision.verifiedReceiptId,
          finalizationId: decision.finalizationId,
        });
      } else {
        const bound = bindCurrent(current, command);
        if ("ok" in bound) return bound;
        const evidence = current.executionFinalizations.flatMap((finalization) => {
          if (finalization.outcome !== "accepted" || finalization.verifiedReceiptId === null) return [];
          const receipt = current.executionReceipts.find((candidate) => candidate.verifiedReceiptId === finalization.verifiedReceiptId);
          const intent = current.executionIntents.find((candidate) => candidate.intentId === finalization.intentId);
          return receipt !== undefined && intent !== undefined && intent.state === "finalized" &&
            intent.executionId === command.executionId && intent.taskId === command.taskId &&
            intent.attemptNumber === command.expectedAttemptNumber && intent.fencingToken === command.expectedFencingToken &&
            receipt.lifecycle === "turn_succeeded" && receipt.backendExecutionId === bound.turn.backendExecutionId &&
            receipt.threadId === bound.turn.threadId && receipt.observedRevision === bound.turn.revision
            ? [Object.freeze({ finalization, receipt, intent })] : [];
        });
        if (evidence.length !== 1) return reliableFailure("RECONCILIATION_REQUIRED");
        const selected = evidence[0] as (typeof evidence)[number];
        internal = Object.freeze({
          kind: "execution.completion.accept" as const,
          ...commonValues(command),
          inputReference: selected.intent.inputReference,
          verifiedReceiptId: selected.receipt.verifiedReceiptId,
          finalizationId: selected.finalization.finalizationId,
        });
      }
      return internal === null ? reliableFailure("IDEMPOTENCY_CONFLICT") : projectReliable(reliable.acceptManualCompletion(internal));
    },
  });

  function continuation(
    command: ProductExecutionContinuationCommand,
    kind: "execution.resume" | "execution.retry",
  ): ProductRuntimeResult<ProductExecutionView> {
    const context = operationContext(command);
    if ("ok" in context) return context;
    let internal: ExecutionLoopResumeCommand | null = null;
    if (context.intent !== null) {
      const intent = context.intent;
      if (intent.operationKind === kind.slice("execution.".length) && intent.backendExecutionId !== null &&
        intent.threadId !== null && intent.previousReceiptId !== null) {
        internal = Object.freeze({
          kind,
          ...intentBase(command, intent),
          backendExecutionId: intent.backendExecutionId,
          threadId: intent.threadId,
          continuationReference: command.continuationReference,
          previousTurnReceiptId: intent.previousReceiptId,
          requiredActionReceiptId: command.requiredActionReceiptId,
          lastObservationNumber: intent.sourceExecutionId === null ? intent.lastObservationNumber : intent.sourceObservationNumber ?? 0,
        });
      }
    } else {
      const bound = context.bound as BoundProductExecution;
      const base = currentBase(command, bound, ingress.now());
      const receipt = latestTurnReceipt(context.state, bound.turn);
      if (!("ok" in base) && receipt !== null) internal = Object.freeze({
        kind,
        ...base,
        backendExecutionId: bound.turn.backendExecutionId,
        threadId: bound.turn.threadId,
        continuationReference: command.continuationReference,
        previousTurnReceiptId: receipt.verifiedReceiptId,
        requiredActionReceiptId: command.requiredActionReceiptId,
        lastObservationNumber: bound.turn.revision,
      });
    }
    return internal === null ? reliableFailure("RECONCILIATION_REQUIRED") : projectReliable(
      kind === "execution.resume" ? reliable.resume(internal) : reliable.retry(internal),
    );
  }
}
