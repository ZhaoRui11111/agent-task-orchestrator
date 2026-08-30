import type {
  ExecutionCancelRequest,
  ExecutionInspectRequest,
  ExecutionResumeRequest,
  ExecutionStartRequest,
  ManualOutcomeReportRequest,
} from "../execution-port.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ManualBackendOperationRecord,
  type ManualBackendTurnRecord,
  type ManualTurnLifecycle,
  type ExecutionOperationIntent,
} from "./application-repository.ts";
import type { PersistenceStore } from "./store.ts";

export type ManualJournalErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "STALE_REVISION" | "INTEGRITY_FAILURE";

export class ManualJournalError extends Error {
  readonly code: ManualJournalErrorCode;

  constructor(code: ManualJournalErrorCode, message: string) {
    super(message);
    this.name = "ManualJournalError";
    this.code = code;
  }
}

export interface ManualJournalMutationResult {
  readonly turn: ManualBackendTurnRecord;
  readonly operation: ManualBackendOperationRecord;
  readonly replayed: boolean;
}

export interface ManualStartIdentity {
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly receiptId: string;
  readonly observedAt: string;
}

export interface ManualMutationIdentity {
  readonly receiptId: string;
  readonly observedAt: string;
}

export interface ManualResumeIdentity extends ManualMutationIdentity {
  readonly successorBackendExecutionId: string;
  readonly successorThreadId: string;
}

export interface ManualTurnJournal {
  start(request: ExecutionStartRequest, identity: ManualStartIdentity): ManualJournalMutationResult;
  resume(request: ExecutionResumeRequest, identity: ManualResumeIdentity): ManualJournalMutationResult;
  inspect(request: ExecutionInspectRequest): ManualBackendTurnRecord;
  requestCancel(request: ExecutionCancelRequest, identity: ManualMutationIdentity): ManualJournalMutationResult;
  recordOutcome(request: ManualOutcomeReportRequest, identity: ManualMutationIdentity): ManualJournalMutationResult;
}

function semanticMatchesTurn(turn: ManualBackendTurnRecord, semantic: ExecutionStartRequest["semantic"]): boolean {
  return turn.projectId === semantic.projectId &&
    turn.projectResourceRevision === semantic.projectResourceRevision &&
    turn.projectConfigRevision === semantic.projectConfigRevision &&
    turn.taskId === semantic.taskId && turn.taskRevision <= semantic.taskRevision &&
    turn.inputReference === semantic.inputReference && turn.executionId === semantic.executionId &&
    turn.executionRevision <= semantic.executionRevision && turn.attemptNumber === semantic.attemptNumber &&
    turn.fencingToken === semantic.fencingToken &&
    turn.policyBindingReference === semantic.policyBindingReference && semantic.workspaceMode === "none";
}

function intentKindMatches(intent: ExecutionOperationIntent, kind: ManualBackendOperationRecord["operationKind"]): boolean {
  return intent.operationKind === kind;
}

function intentSemanticMatches(
  intent: ExecutionOperationIntent,
  operationId: string,
  idempotencyKey: string,
  semantic: ExecutionStartRequest["semantic"],
): boolean {
  return intent.operationId === operationId && intent.idempotencyKey === idempotencyKey &&
    intent.projectId === semantic.projectId &&
    intent.projectResourceRevision === semantic.projectResourceRevision &&
    intent.projectConfigRevision === semantic.projectConfigRevision &&
    intent.taskId === semantic.taskId && intent.taskRevision === semantic.taskRevision &&
    intent.inputReference === semantic.inputReference && intent.executionId === semantic.executionId &&
    intent.executionRevision === semantic.executionRevision && intent.attemptNumber === semantic.attemptNumber &&
    intent.fencingToken === semantic.fencingToken && intent.policyBindingReference === semantic.policyBindingReference &&
    intent.workspaceMode === semantic.workspaceMode;
}

function requireIntent(
  state: ReturnType<typeof readApplicationStateForOwner>,
  intentId: string,
  operationId: string,
  idempotencyKey: string,
  kind: ManualBackendOperationRecord["operationKind"] | "inspect",
  semantic: ExecutionStartRequest["semantic"],
): ExecutionOperationIntent {
  const intent = state.executionIntents.find((candidate) => candidate.intentId === intentId);
  const kindMatches = kind === "inspect" ? intent?.operationKind === "inspect" : intent !== undefined && intentKindMatches(intent, kind);
  if (intent === undefined || !kindMatches || !intentSemanticMatches(intent, operationId, idempotencyKey, semantic)) {
    throw new ManualJournalError("CONFLICT", "Manual request is not bound to one exact durable core intent");
  }
  return intent;
}

function requireCurrentActAuthorization(
  state: ReturnType<typeof readApplicationStateForOwner>,
  intent: ExecutionOperationIntent,
  decisionId: string,
  at: string,
): void {
  const binding = state.executionIntentAuthorizationBindings.find((candidate) =>
    candidate.intentId === intent.intentId &&
    candidate.bindingRevision === intent.authorizationBindingRevision &&
    candidate.decisionId === decisionId
  );
  const decision = state.executionAuthorizationDecisions.find((candidate) => candidate.decisionId === decisionId);
  const request = decision === undefined ? undefined : state.executionOperationRequests.find(
    (candidate) => candidate.requestId === decision.requestId,
  );
  const grant = decision?.grantId === null || decision?.grantId === undefined
    ? undefined : state.grants.find((candidate) => candidate.grantId === decision.grantId);
  const scopeMatches = grant?.scope.kind === "runtime" || (
    grant?.scope.kind === "project" &&
    grant.scope.projectId === intent.projectId &&
    grant.scope.resourceRevision === intent.projectResourceRevision &&
    grant.scope.configRevision === intent.projectConfigRevision
  );
  if (
    intent.state !== "executing" || intent.currentAuthorizationDecisionId !== decisionId ||
    binding?.phase !== "act" || binding.requestId !== request?.requestId || binding.auditId.length === 0 ||
    decision?.result !== "allow" || decision.action !== intent.action || decision.actorId !== intent.actorId ||
    decision.projectId !== intent.projectId || decision.resourceRevision !== intent.projectResourceRevision ||
    decision.configRevision !== intent.projectConfigRevision || request?.result !== "allow" ||
    request.actorId !== intent.actorId || request.action !== intent.action ||
    request.targetExecutionId !== intent.executionId || request.targetRevision !== intent.executionRevision ||
    grant === undefined || grant.actorId !== intent.actorId || grant.action !== intent.action ||
    grant.revision !== decision.grantRevision || !scopeMatches || grant.revokedAt !== null ||
    grant.notBefore > at || grant.expiresAt <= at
  ) throw new ManualJournalError("CONFLICT", "Manual mutation lacks one current exact intent-bound allow");
}

function operationReplay(
  state: ReturnType<typeof readApplicationStateForOwner>,
  operationId: string,
  idempotencyKey: string,
  intentId: string,
  kind: ManualBackendOperationRecord["operationKind"],
  semantic: ExecutionStartRequest["semantic"],
  reportOperation: ManualBackendOperationRecord["reportOperation"],
): ManualJournalMutationResult | null {
  const candidates = state.manualBackendOperations.filter((operation) =>
    operation.backendOperationId === operationId || operation.idempotencyKey === idempotencyKey
  );
  if (candidates.length === 0) return null;
  const operation = candidates[0];
  if (
    candidates.length !== 1 || operation === undefined ||
    operation.backendOperationId !== operationId || operation.idempotencyKey !== idempotencyKey ||
    operation.intentId !== intentId || operation.operationKind !== kind ||
    operation.reportOperation !== reportOperation || operation.expectedFencingToken !== semantic.fencingToken
  ) throw new ManualJournalError("CONFLICT", "Manual operation identity is already bound to another tuple");
  requireIntent(state, intentId, operationId, idempotencyKey, kind, semantic);
  const turn = state.manualTurns.find((candidate) => candidate.backendExecutionId === operation.backendExecutionId);
  if (turn === undefined || turn.threadId !== operation.threadId || !semanticMatchesTurn(turn, semantic)) {
    throw new ManualJournalError("INTEGRITY_FAILURE", "Manual operation replay does not bind its durable turn");
  }
  if (operation.sourceBackendExecutionId !== null) {
    const source = state.manualTurns.find((candidate) => candidate.backendExecutionId === operation.sourceBackendExecutionId);
    if (source === undefined || source.threadId !== operation.sourceThreadId ||
      turn.predecessorBackendExecutionId !== source.backendExecutionId || turn.predecessorThreadId !== source.threadId) {
      throw new ManualJournalError("INTEGRITY_FAILURE", "Manual successor replay does not bind its predecessor turn");
    }
  }
  return Object.freeze({ turn, operation, replayed: true });
}

function requireTurn(
  state: ReturnType<typeof readApplicationStateForOwner>,
  backendExecutionId: string,
  threadId: string | null,
  semantic: ExecutionStartRequest["semantic"],
): ManualBackendTurnRecord {
  const turn = state.manualTurns.find((candidate) => candidate.backendExecutionId === backendExecutionId);
  if (turn === undefined) throw new ManualJournalError("NOT_FOUND", "Manual execution identity is absent");
  if (turn.fencingToken !== semantic.fencingToken) {
    throw new ManualJournalError("STALE_REVISION", "Manual turn fencing token is stale");
  }
  const execution = state.executions.find((candidate) => candidate.executionId === semantic.executionId);
  const task = state.domain.tasks.find((candidate) => candidate.id === semantic.taskId);
  const project = state.projects.find((candidate) => candidate.projectId === semantic.projectId);
  if (
    (threadId !== null && turn.threadId !== threadId) || !semanticMatchesTurn(turn, semantic) ||
    execution === undefined || execution.status !== "active" || execution.revision !== semantic.executionRevision ||
    execution.attemptNumber !== semantic.attemptNumber || execution.fencingToken !== semantic.fencingToken ||
    task === undefined || task.revision !== semantic.taskRevision ||
    project === undefined || project.resourceRevision !== semantic.projectResourceRevision ||
    project.configRevision !== semantic.projectConfigRevision
  ) throw new ManualJournalError("CONFLICT", "Manual turn identity differs from the current semantic tuple");
  return turn;
}

function requireSuccessorSourceTurn(
  state: ReturnType<typeof readApplicationStateForOwner>,
  intent: ExecutionOperationIntent,
  request: ExecutionResumeRequest,
): ManualBackendTurnRecord {
  const source = state.manualTurns.find((candidate) => candidate.backendExecutionId === request.backendExecutionId);
  const sourceExecution = intent.sourceExecutionId === null
    ? undefined : state.executions.find((candidate) => candidate.executionId === intent.sourceExecutionId);
  const currentExecution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
  const task = state.domain.tasks.find((candidate) => candidate.id === intent.taskId);
  const project = state.projects.find((candidate) => candidate.projectId === intent.projectId);
  if (
    source === undefined || source.threadId !== request.threadId || source.executionId !== intent.sourceExecutionId ||
    source.executionRevision !== intent.sourceExecutionRevision || source.attemptNumber !== intent.sourceAttemptNumber ||
    source.fencingToken !== intent.sourceFencingToken || source.inputReference !== intent.inputReference ||
    source.projectId !== intent.projectId || source.taskId !== intent.taskId ||
    sourceExecution === undefined || sourceExecution.status !== "superseded" ||
    sourceExecution.supersededByExecutionId !== intent.executionId || currentExecution === undefined ||
    currentExecution.status !== "active" || currentExecution.revision !== request.semantic.executionRevision ||
    currentExecution.attemptNumber !== request.semantic.attemptNumber ||
    currentExecution.fencingToken !== request.semantic.fencingToken || task === undefined ||
    task.revision !== request.semantic.taskRevision || project === undefined ||
    project.resourceRevision !== request.semantic.projectResourceRevision ||
    project.configRevision !== request.semantic.projectConfigRevision
  ) throw new ManualJournalError("CONFLICT", "Manual successor source or current execution tuple is stale");
  return source;
}

function operationRecord(
  operationId: string,
  idempotencyKey: string,
  intentId: string,
  authorizationDecisionId: string,
  operationKind: ManualBackendOperationRecord["operationKind"],
  reportOperation: ManualBackendOperationRecord["reportOperation"],
  turn: ManualBackendTurnRecord,
  sourceTurn: ManualBackendTurnRecord | null,
  expectedPreRevision: number | null,
  receiptId: string,
  createdAt: string,
): ManualBackendOperationRecord {
  return Object.freeze({
    backendOperationId: operationId,
    idempotencyKey,
    intentId,
    authorizationDecisionId,
    operationKind,
    reportOperation,
    backendExecutionId: turn.backendExecutionId,
    threadId: turn.threadId,
    sourceBackendExecutionId: sourceTurn?.backendExecutionId ?? null,
    sourceThreadId: sourceTurn?.threadId ?? null,
    expectedFencingToken: turn.fencingToken,
    expectedPreRevision,
    postRevision: turn.revision,
    resultLifecycle: turn.lifecycle,
    receiptId,
    createdAt,
  });
}

function reportTarget(operation: ManualOutcomeReportRequest["operation"]): ManualTurnLifecycle {
  switch (operation) {
    case "activate": return "active";
    case "wait": return "waiting";
    case "succeed": return "turn_succeeded";
    case "fail": return "failed";
    case "confirm_cancelled": return "cancelled";
  }
}

function reportTransitionAllowed(from: ManualTurnLifecycle, operation: ManualOutcomeReportRequest["operation"]): boolean {
  if (from === "turn_succeeded" || from === "failed" || from === "cancelled") return false;
  if (operation === "activate") return from === "queued" || from === "waiting";
  return from === "queued" || from === "active" || from === "waiting";
}

class SqliteManualTurnJournal implements ManualTurnJournal {
  readonly #store: PersistenceStore;

  constructor(store: PersistenceStore) {
    this.#store = store;
  }

  start(request: ExecutionStartRequest, identity: ManualStartIdentity): ManualJournalMutationResult {
    const initial = readApplicationStateForOwner(this.#store);
    const initialIntent = requireIntent(initial, request.intentId, request.operationId, request.idempotencyKey, "start", request.semantic);
    if (initialIntent.actorId !== request.actorId ||
      initialIntent.action !== request.action || initialIntent.adapterId !== request.adapterId ||
      initialIntent.adapterVersion !== request.adapterVersion || initialIntent.backendExecutionId !== null ||
      initialIntent.threadId !== null) throw new ManualJournalError("CONFLICT", "Manual start differs from its durable intent");
    const replay = operationReplay(initial, request.operationId, request.idempotencyKey, request.intentId, "start", request.semantic, null);
    if (replay !== null) return replay;
    requireCurrentActAuthorization(initial, initialIntent, request.authorizationDecisionId, identity.observedAt);
    if (
      initial.manualTurns.some((turn) => turn.backendExecutionId === identity.backendExecutionId ||
        turn.threadId === identity.threadId || turn.executionId === request.semantic.executionId)
    ) throw new ManualJournalError("CONFLICT", "Manual start identities are already allocated");
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = requireIntent(state, request.intentId, request.operationId, request.idempotencyKey, "start", request.semantic);
      const concurrent = operationReplay(state, request.operationId, request.idempotencyKey, request.intentId, "start", request.semantic, null);
      if (concurrent !== null) return concurrent;
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, identity.observedAt);
      if (state.manualTurns.some((turn) => turn.backendExecutionId === identity.backendExecutionId ||
        turn.threadId === identity.threadId || turn.executionId === request.semantic.executionId)) {
        throw new ManualJournalError("CONFLICT", "Manual start identity was allocated concurrently");
      }
      const turn: ManualBackendTurnRecord = Object.freeze({
        backendExecutionId: identity.backendExecutionId,
        threadId: identity.threadId,
        startIdempotencyKey: request.idempotencyKey,
        projectId: request.semantic.projectId,
        projectResourceRevision: request.semantic.projectResourceRevision,
        projectConfigRevision: request.semantic.projectConfigRevision,
        taskId: request.semantic.taskId,
        taskRevision: request.semantic.taskRevision,
        inputReference: request.semantic.inputReference,
        executionId: request.semantic.executionId,
        executionRevision: request.semantic.executionRevision,
        attemptNumber: request.semantic.attemptNumber,
        fencingToken: request.semantic.fencingToken,
        predecessorBackendExecutionId: null,
        predecessorThreadId: null,
        policyBindingReference: request.semantic.policyBindingReference,
        workspaceMode: "none",
        lifecycle: "queued",
        cancellationRequestRevision: null,
        cancellationRequestedAt: null,
        code: "manual_queued",
        evidenceReference: null,
        lastReportId: null,
        revision: 1,
        createdAt: identity.observedAt,
        updatedAt: identity.observedAt,
      });
      const operation = operationRecord(
        request.operationId, request.idempotencyKey, request.intentId, request.authorizationDecisionId, "start", null,
        turn, null, null, identity.receiptId, identity.observedAt,
      );
      transaction.insertManualTurn(turn);
      transaction.insertManualBackendOperation(operation);
      return Object.freeze({ turn, operation, replayed: false });
    });
  }

  resume(request: ExecutionResumeRequest, identity: ManualResumeIdentity): ManualJournalMutationResult {
    const initial = readApplicationStateForOwner(this.#store);
    const operationKind = request.action === "execution.retry" ? "retry" as const : "resume" as const;
    const initialIntent = requireIntent(initial, request.intentId, request.operationId, request.idempotencyKey, operationKind, request.semantic);
    if (initialIntent.actorId !== request.actorId ||
      initialIntent.action !== request.action || initialIntent.adapterId !== request.adapterId ||
      initialIntent.adapterVersion !== request.adapterVersion || initialIntent.backendExecutionId !== request.backendExecutionId ||
      initialIntent.threadId !== request.threadId || initialIntent.previousReceiptId !== request.previousTurnReceiptId) {
      throw new ManualJournalError("CONFLICT", "Manual resume differs from its durable intent");
    }
    const replay = operationReplay(initial, request.operationId, request.idempotencyKey, request.intentId, operationKind, request.semantic, null);
    if (replay !== null) return replay;
    requireCurrentActAuthorization(initial, initialIntent, request.authorizationDecisionId, identity.observedAt);
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = requireIntent(state, request.intentId, request.operationId, request.idempotencyKey, operationKind, request.semantic);
      const concurrent = operationReplay(state, request.operationId, request.idempotencyKey, request.intentId, operationKind, request.semantic, null);
      if (concurrent !== null) return concurrent;
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, identity.observedAt);
      if (intent.sourceExecutionId !== null) {
        const source = requireSuccessorSourceTurn(state, intent, request);
        if ((operationKind === "retry" && source.lifecycle !== "failed") ||
          (operationKind === "resume" && source.lifecycle !== "queued" && source.lifecycle !== "active" && source.lifecycle !== "waiting")) {
          throw new ManualJournalError("CONFLICT", "Manual successor source lifecycle is not safe for this continuation");
        }
        if (state.manualTurns.some((candidate) =>
          candidate.backendExecutionId === identity.successorBackendExecutionId ||
          candidate.threadId === identity.successorThreadId || candidate.executionId === intent.executionId
        )) throw new ManualJournalError("CONFLICT", "Manual successor identities are already allocated");
        const turn: ManualBackendTurnRecord = Object.freeze({
          backendExecutionId: identity.successorBackendExecutionId,
          threadId: identity.successorThreadId,
          startIdempotencyKey: request.idempotencyKey,
          projectId: request.semantic.projectId,
          projectResourceRevision: request.semantic.projectResourceRevision,
          projectConfigRevision: request.semantic.projectConfigRevision,
          taskId: request.semantic.taskId,
          taskRevision: request.semantic.taskRevision,
          inputReference: request.semantic.inputReference,
          executionId: request.semantic.executionId,
          executionRevision: request.semantic.executionRevision,
          attemptNumber: request.semantic.attemptNumber,
          fencingToken: request.semantic.fencingToken,
          predecessorBackendExecutionId: source.backendExecutionId,
          predecessorThreadId: source.threadId,
          policyBindingReference: request.semantic.policyBindingReference,
          workspaceMode: "none",
          lifecycle: "active",
          cancellationRequestRevision: null,
          cancellationRequestedAt: null,
          code: operationKind === "retry" ? "manual_retry_started" : "manual_resume_succeeded",
          evidenceReference: null,
          lastReportId: null,
          revision: 1,
          createdAt: identity.observedAt,
          updatedAt: identity.observedAt,
        });
        const operation = operationRecord(
          request.operationId, request.idempotencyKey, request.intentId, request.authorizationDecisionId, operationKind, null,
          turn, source, null, identity.receiptId, identity.observedAt,
        );
        transaction.insertManualTurn(turn);
        transaction.insertManualBackendOperation(operation);
        return Object.freeze({ turn, operation, replayed: false });
      }
      const current = requireTurn(state, request.backendExecutionId, request.threadId, request.semantic);
      if (current.lifecycle !== "waiting") throw new ManualJournalError("CONFLICT", "Only a waiting Manual turn can resume");
      const turn = Object.freeze({ ...current, lifecycle: "active" as const, code: "manual_resumed", revision: current.revision + 1, updatedAt: identity.observedAt });
      const operation = operationRecord(request.operationId, request.idempotencyKey, request.intentId, request.authorizationDecisionId, operationKind, null, turn, null, current.revision, identity.receiptId, identity.observedAt);
      transaction.updateManualTurn(turn, current.revision);
      transaction.insertManualBackendOperation(operation);
      return Object.freeze({ turn, operation, replayed: false });
    });
  }

  inspect(request: ExecutionInspectRequest): ManualBackendTurnRecord {
    const state = readApplicationStateForOwner(this.#store);
    const decision = state.executionAuthorizationDecisions.find((candidate) => candidate.decisionId === request.authorizationDecisionId);
    const authorizationRequest = decision === undefined
      ? undefined
      : state.executionOperationRequests.find((candidate) => candidate.requestId === decision.requestId);
    if (
      decision === undefined || decision.result !== "allow" || decision.action !== "execution.inspect" ||
      decision.actorId !== request.actorId || authorizationRequest === undefined ||
      authorizationRequest.requestId !== request.queryId || authorizationRequest.correlationId !== request.correlationId ||
      authorizationRequest.actorId !== request.actorId || authorizationRequest.action !== "execution.inspect" ||
      authorizationRequest.result !== "allow" || authorizationRequest.targetExecutionId !== request.semantic.executionId ||
      authorizationRequest.targetRevision !== request.semantic.executionRevision
    ) throw new ManualJournalError("CONFLICT", "Manual inspection lacks one exact durable allow decision");
    return requireTurn(state, request.backendExecutionId, request.threadId, request.semantic);
  }

  requestCancel(request: ExecutionCancelRequest, identity: ManualMutationIdentity): ManualJournalMutationResult {
    const initial = readApplicationStateForOwner(this.#store);
    const initialIntent = requireIntent(initial, request.intentId, request.operationId, request.idempotencyKey, "request_cancel", request.semantic);
    if (initialIntent.actorId !== request.actorId ||
      initialIntent.action !== request.action || initialIntent.adapterId !== request.adapterId ||
      initialIntent.adapterVersion !== request.adapterVersion || initialIntent.backendExecutionId !== request.backendExecutionId ||
      initialIntent.threadId !== request.threadId) throw new ManualJournalError("CONFLICT", "Manual cancellation differs from its durable intent");
    const replay = operationReplay(initial, request.operationId, request.idempotencyKey, request.intentId, "request_cancel", request.semantic, null);
    if (replay !== null) return replay;
    requireCurrentActAuthorization(initial, initialIntent, request.authorizationDecisionId, identity.observedAt);
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = requireIntent(state, request.intentId, request.operationId, request.idempotencyKey, "request_cancel", request.semantic);
      const concurrent = operationReplay(state, request.operationId, request.idempotencyKey, request.intentId, "request_cancel", request.semantic, null);
      if (concurrent !== null) return concurrent;
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, identity.observedAt);
      const current = requireTurn(state, request.backendExecutionId, request.threadId, request.semantic);
      const terminal = current.lifecycle === "turn_succeeded" || current.lifecycle === "failed" || current.lifecycle === "cancelled";
      const turn = terminal ? current : Object.freeze({
        ...current,
        cancellationRequestRevision: current.revision + 1,
        cancellationRequestedAt: identity.observedAt,
        code: "manual_cancel_requested",
        revision: current.revision + 1,
        updatedAt: identity.observedAt,
      });
      const operation = operationRecord(request.operationId, request.idempotencyKey, request.intentId, request.authorizationDecisionId, "request_cancel", null, turn, null, current.revision, identity.receiptId, identity.observedAt);
      if (!terminal) transaction.updateManualTurn(turn, current.revision);
      transaction.insertManualBackendOperation(operation);
      return Object.freeze({ turn, operation, replayed: false });
    });
  }

  recordOutcome(request: ManualOutcomeReportRequest, identity: ManualMutationIdentity): ManualJournalMutationResult {
    const initial = readApplicationStateForOwner(this.#store);
    const initialIntent = requireIntent(initial, request.intentId, request.operationId, request.idempotencyKey, "manual_report", request.semantic);
    if (initialIntent.actorId !== request.actorId ||
      initialIntent.action !== "execution.inspect" || initialIntent.confirmationId !== request.confirmationId ||
      initialIntent.backendExecutionId !== request.backendExecutionId || initialIntent.threadId !== request.threadId ||
      initialIntent.expectedJournalRevision !== request.expectedJournalRevision) {
      throw new ManualJournalError("CONFLICT", "Manual outcome differs from its durable intent");
    }
    const replay = operationReplay(initial, request.operationId, request.idempotencyKey, request.intentId, "manual_report", request.semantic, request.operation);
    if (replay !== null) return replay;
    requireCurrentActAuthorization(initial, initialIntent, request.authorizationDecisionId, identity.observedAt);
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = requireIntent(state, request.intentId, request.operationId, request.idempotencyKey, "manual_report", request.semantic);
      const concurrent = operationReplay(state, request.operationId, request.idempotencyKey, request.intentId, "manual_report", request.semantic, request.operation);
      if (concurrent !== null) return concurrent;
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, identity.observedAt);
      const current = requireTurn(state, request.backendExecutionId, request.threadId, request.semantic);
      if (current.revision !== request.expectedJournalRevision || current.lifecycle !== request.expectedLifecycle) {
        throw new ManualJournalError("STALE_REVISION", "Manual outcome expected revision or lifecycle is stale");
      }
      if (!reportTransitionAllowed(current.lifecycle, request.operation)) {
        throw new ManualJournalError("CONFLICT", "Manual outcome transition is outside the closed lifecycle");
      }
      if (request.operation === "confirm_cancelled" && current.cancellationRequestRevision === null) {
        throw new ManualJournalError("CONFLICT", "Manual cancellation cannot be confirmed before a cancellation request");
      }
      const turn = Object.freeze({
        ...current,
        lifecycle: reportTarget(request.operation),
        code: request.code,
        evidenceReference: request.evidenceReference,
        lastReportId: request.reportId,
        revision: current.revision + 1,
        updatedAt: identity.observedAt,
      });
      const operation = operationRecord(request.operationId, request.idempotencyKey, request.intentId, request.authorizationDecisionId, "manual_report", request.operation, turn, null, current.revision, identity.receiptId, identity.observedAt);
      transaction.updateManualTurn(turn, current.revision);
      transaction.insertManualBackendOperation(operation);
      return Object.freeze({ turn, operation, replayed: false });
    });
  }
}

export function createManualTurnJournal(store: PersistenceStore): ManualTurnJournal {
  return new SqliteManualTurnJournal(store);
}
