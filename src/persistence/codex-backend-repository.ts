import type {
  ExecutionCancelRequest,
  ExecutionInspectRequest,
  ExecutionResumeRequest,
  ExecutionSemanticIdentity,
  ExecutionStartRequest,
} from "../execution-port.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationState,
  type CodexBackendOperationRecord,
  type CodexBackendTurnRecord,
  type CodexTurnTerminalSignal,
  type ExecutionOperationIntent,
} from "./application-repository.ts";
import type { PersistenceStore } from "./store.ts";

export type CodexJournalErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STALE_REVISION"
  | "INTEGRITY_FAILURE";

export class CodexJournalError extends Error {
  readonly code: CodexJournalErrorCode;

  constructor(code: CodexJournalErrorCode, message: string) {
    super(message);
    this.name = "CodexJournalError";
    this.code = code;
  }
}

export interface CodexPreparedTurn {
  readonly turn: CodexBackendTurnRecord;
  readonly operation: CodexBackendOperationRecord | null;
  readonly replayed: boolean;
}

export interface CodexTerminalReceiptIdentity {
  readonly receiptId: string;
  readonly receiptSha256: string;
}

export interface CodexTurnJournal {
  prepareStart(
    request: ExecutionStartRequest,
    identity: Readonly<{ backendExecutionId: string; observedAt: string }>,
  ): CodexPreparedTurn;
  prepareResume(
    request: ExecutionResumeRequest,
    identity: Readonly<{ backendExecutionId: string; observedAt: string }>,
  ): CodexPreparedTurn;
  markActive(backendExecutionId: string, threadId: string, observedAt: string): CodexBackendTurnRecord;
  recordTerminal(
    backendExecutionId: string,
    terminalSignal: CodexTurnTerminalSignal,
    code: string,
    evidenceReference: string,
    observedAt: string,
    receiptIdentity: (turn: CodexBackendTurnRecord) => CodexTerminalReceiptIdentity,
  ): Readonly<{ turn: CodexBackendTurnRecord; operation: CodexBackendOperationRecord }>;
  inspect(request: ExecutionInspectRequest): CodexBackendTurnRecord;
  markUnproved(request: ExecutionInspectRequest, observedAt: string): CodexBackendTurnRecord;
  recordCancellationRequest(request: ExecutionCancelRequest, observedAt: string): CodexBackendTurnRecord;
}

function operationalIdentifier(value: string, maximum = 128): boolean {
  return value.length > 0 && value.length <= maximum && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function canonicalTimestamp(value: string): boolean {
  const milliseconds = Date.parse(value);
  return value.length <= 64 && Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function afterTimestamp(previous: string, candidate: string): string {
  if (!canonicalTimestamp(candidate)) throw new CodexJournalError("INVALID_INPUT", "Codex journal timestamp is invalid");
  return new Date(Math.max(Date.parse(candidate), Date.parse(previous) + 1)).toISOString();
}

function codexSemantic(value: ExecutionSemanticIdentity): Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }> {
  if (value.backendKind !== "codex-sdk" || value.workspaceMode !== "owned") {
    throw new CodexJournalError("CONFLICT", "Codex journal requires an owned Codex semantic tuple");
  }
  return value;
}

function semanticMatchesTurn(turn: CodexBackendTurnRecord, value: ExecutionSemanticIdentity): boolean {
  const semantic = codexSemantic(value);
  return turn.projectId === semantic.projectId &&
    turn.projectResourceRevision === semantic.projectResourceRevision &&
    turn.projectConfigRevision === semantic.projectConfigRevision && turn.taskId === semantic.taskId &&
    turn.taskRevision === semantic.taskRevision && turn.inputReference === semantic.inputReference &&
    turn.executionId === semantic.executionId && turn.executionRevision === semantic.executionRevision &&
    turn.attemptNumber === semantic.attemptNumber && turn.fencingToken === semantic.fencingToken &&
    turn.policyBindingReference === semantic.policyBindingReference &&
    turn.workspaceContractId === semantic.workspaceContractId && turn.workspaceId === semantic.workspaceId &&
    turn.workspaceGeneration === semantic.workspaceGeneration && turn.workspaceRevision === semantic.workspaceRevision &&
    turn.workspaceRootKey === semantic.workspaceRootKey &&
    turn.ownershipBindingSha256 === semantic.ownershipBindingSha256 &&
    turn.workspaceHeadObjectId === semantic.workspaceHeadObjectId;
}

function observationSemanticMatchesTurn(
  turn: CodexBackendTurnRecord,
  value: ExecutionSemanticIdentity,
): boolean {
  const semantic = codexSemantic(value);
  return turn.projectId === semantic.projectId &&
    turn.projectResourceRevision === semantic.projectResourceRevision &&
    turn.projectConfigRevision === semantic.projectConfigRevision && turn.taskId === semantic.taskId &&
    turn.taskRevision <= semantic.taskRevision && turn.inputReference === semantic.inputReference &&
    turn.executionId === semantic.executionId && turn.executionRevision <= semantic.executionRevision &&
    turn.attemptNumber === semantic.attemptNumber && turn.fencingToken === semantic.fencingToken &&
    turn.policyBindingReference === semantic.policyBindingReference &&
    turn.workspaceContractId === semantic.workspaceContractId && turn.workspaceId === semantic.workspaceId &&
    turn.workspaceGeneration === semantic.workspaceGeneration && turn.workspaceRevision === semantic.workspaceRevision &&
    turn.workspaceRootKey === semantic.workspaceRootKey &&
    turn.ownershipBindingSha256 === semantic.ownershipBindingSha256 &&
    turn.workspaceHeadObjectId === semantic.workspaceHeadObjectId;
}

function intentSemanticMatches(
  intent: ExecutionOperationIntent,
  operationId: string,
  idempotencyKey: string,
  semanticValue: ExecutionSemanticIdentity,
): boolean {
  const semantic = codexSemantic(semanticValue);
  return intent.backendKind === "codex-sdk" && intent.operationId === operationId &&
    intent.idempotencyKey === idempotencyKey && intent.projectId === semantic.projectId &&
    intent.projectResourceRevision === semantic.projectResourceRevision &&
    intent.projectConfigRevision === semantic.projectConfigRevision && intent.taskId === semantic.taskId &&
    intent.taskRevision === semantic.taskRevision && intent.inputReference === semantic.inputReference &&
    intent.executionId === semantic.executionId && intent.executionRevision === semantic.executionRevision &&
    intent.attemptNumber === semantic.attemptNumber && intent.fencingToken === semantic.fencingToken &&
    intent.policyBindingReference === semantic.policyBindingReference && intent.workspaceMode === "owned" &&
    intent.workspaceContractId === semantic.workspaceContractId && intent.workspaceId === semantic.workspaceId &&
    intent.workspaceGeneration === semantic.workspaceGeneration && intent.workspaceRevision === semantic.workspaceRevision &&
    intent.workspaceRootKey === semantic.workspaceRootKey &&
    intent.ownershipBindingSha256 === semantic.ownershipBindingSha256 &&
    intent.workspaceHeadObjectId === semantic.workspaceHeadObjectId;
}

function requireIntent(
  state: ApplicationState,
  request: ExecutionStartRequest | ExecutionResumeRequest,
): ExecutionOperationIntent {
  const expectedKind = request.operation === "start"
    ? "start"
    : request.action === "execution.retry" ? "retry" : "resume";
  const intent = state.executionIntents.find((candidate) => candidate.intentId === request.intentId);
  if (intent === undefined || intent.operationKind !== expectedKind ||
    !intentSemanticMatches(intent, request.operationId, request.idempotencyKey, request.semantic) ||
    intent.actorId !== request.actorId || intent.action !== request.action ||
    intent.adapterId !== request.adapterId || intent.adapterVersion !== request.adapterVersion) {
    throw new CodexJournalError("CONFLICT", "Codex request is not bound to one exact durable core intent");
  }
  return intent;
}

function requireCurrentActAuthorization(
  state: ApplicationState,
  intent: ExecutionOperationIntent,
  decisionId: string,
  at: string,
): void {
  const binding = state.executionIntentAuthorizationBindings.find((candidate) =>
    candidate.intentId === intent.intentId && candidate.bindingRevision === intent.authorizationBindingRevision &&
    candidate.decisionId === decisionId
  );
  const decision = state.executionAuthorizationDecisions.find((candidate) => candidate.decisionId === decisionId);
  const request = decision === undefined ? undefined : state.executionOperationRequests.find(
    (candidate) => candidate.requestId === decision.requestId,
  );
  const grant = decision?.grantId === null || decision?.grantId === undefined
    ? undefined : state.grants.find((candidate) => candidate.grantId === decision.grantId);
  const scopeMatches = grant?.scope.kind === "runtime" || (
    grant?.scope.kind === "project" && grant.scope.projectId === intent.projectId &&
    grant.scope.resourceRevision === intent.projectResourceRevision &&
    grant.scope.configRevision === intent.projectConfigRevision
  );
  if (
    intent.state !== "executing" || intent.currentAuthorizationDecisionId !== decisionId || binding?.phase !== "act" ||
    decision?.result !== "allow" || decision.action !== intent.action || decision.actorId !== intent.actorId ||
    decision.projectId !== intent.projectId || decision.resourceRevision !== intent.projectResourceRevision ||
    decision.configRevision !== intent.projectConfigRevision || request?.result !== "allow" ||
    request.actorId !== intent.actorId || request.action !== intent.action ||
    request.targetExecutionId !== intent.executionId || request.targetRevision !== intent.executionRevision ||
    grant === undefined || grant.actorId !== intent.actorId || grant.action !== intent.action ||
    grant.revision !== decision.grantRevision || !scopeMatches || grant.revokedAt !== null ||
    grant.notBefore > at || grant.expiresAt <= at
  ) throw new CodexJournalError("CONFLICT", "Codex mutation lacks one current exact intent-bound allow");
}

function requireCurrentSemanticTuple(
  state: ApplicationState,
  semantic: Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }>,
): void {
  const execution = state.executions.find((candidate) => candidate.executionId === semantic.executionId);
  const task = state.domain.tasks.find((candidate) => candidate.id === semantic.taskId);
  const project = state.projects.find((candidate) => candidate.projectId === semantic.projectId);
  const workspace = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === semantic.workspaceId && candidate.generation === semantic.workspaceGeneration
  );
  const workspaceReceipt = state.workspaceReceipts.find((candidate) => {
    const finalization = state.workspaceFinalizations.find((record) =>
      record.intentId === candidate.intentId && record.verifiedReceiptId === candidate.verifiedReceiptId &&
      record.outcome === "succeeded" && record.resultingGenerationStatus === "ready" &&
      record.resultingGenerationRevision === semantic.workspaceRevision
    );
    return candidate.workspaceId === semantic.workspaceId && candidate.generation === semantic.workspaceGeneration &&
      candidate.outcome === "succeeded" && candidate.externalState === "complete" &&
      candidate.headObjectId === semantic.workspaceHeadObjectId &&
      candidate.ownershipBindingSha256 === semantic.ownershipBindingSha256 && finalization !== undefined;
  });
  if (
    execution === undefined || execution.status !== "active" || execution.revision !== semantic.executionRevision ||
    execution.attemptNumber !== semantic.attemptNumber || execution.fencingToken !== semantic.fencingToken ||
    task === undefined || task.revision !== semantic.taskRevision || task.projectId !== semantic.projectId ||
    project === undefined || project.resourceRevision !== semantic.projectResourceRevision ||
    project.configRevision !== semantic.projectConfigRevision || workspace === undefined || workspace.status !== "ready" ||
    workspace.revision !== semantic.workspaceRevision || workspace.projectId !== semantic.projectId ||
    workspace.taskId !== semantic.taskId || workspace.executionId !== semantic.executionId ||
    workspace.attemptNumber !== semantic.attemptNumber || workspace.fencingToken !== semantic.fencingToken ||
    workspace.workspaceRootKey !== semantic.workspaceRootKey || workspaceReceipt === undefined
  ) throw new CodexJournalError("STALE_REVISION", "Codex execution or owned workspace tuple is stale");
}

function requireCurrentTuple(state: ApplicationState, intent: ExecutionOperationIntent): void {
  if (intent.backendKind !== "codex-sdk" || intent.workspaceMode !== "owned" ||
    intent.workspaceContractId !== "ato.workspace/v2" || intent.workspaceId === null ||
    intent.workspaceGeneration === null || intent.workspaceRevision === null || intent.workspaceRootKey === null ||
    intent.ownershipBindingSha256 === null || intent.workspaceHeadObjectId === null) {
    throw new CodexJournalError("CONFLICT", "Codex intent workspace tuple is incomplete");
  }
  requireCurrentSemanticTuple(state, Object.freeze({
    backendKind: "codex-sdk" as const,
    workspaceMode: "owned" as const,
    workspaceContractId: intent.workspaceContractId,
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
    workspaceId: intent.workspaceId,
    workspaceGeneration: intent.workspaceGeneration,
    workspaceRevision: intent.workspaceRevision,
    workspaceRootKey: intent.workspaceRootKey,
    ownershipBindingSha256: intent.ownershipBindingSha256,
    workspaceHeadObjectId: intent.workspaceHeadObjectId,
  }));
}

function requireInspectionTuple(
  state: ApplicationState,
  request: ExecutionInspectRequest,
): Readonly<{ turn: CodexBackendTurnRecord; intent: ExecutionOperationIntent }> {
  const decision = state.executionAuthorizationDecisions.find((candidate) =>
    candidate.decisionId === request.authorizationDecisionId
  );
  const authorizationRequest = decision === undefined ? undefined : state.executionOperationRequests.find(
    (candidate) => candidate.requestId === decision.requestId,
  );
  const turn = state.codexTurns.find((candidate) => candidate.backendExecutionId === request.backendExecutionId);
  const intent = turn === undefined ? undefined : state.executionIntents.find(
    (candidate) => candidate.intentId === turn.originIntentId,
  );
  if (
    decision?.result !== "allow" || decision.action !== "execution.inspect" || decision.actorId !== request.actorId ||
    authorizationRequest?.requestId !== request.queryId || authorizationRequest.correlationId !== request.correlationId ||
    authorizationRequest.result !== "allow" || authorizationRequest.action !== "execution.inspect" ||
    authorizationRequest.targetExecutionId !== request.semantic.executionId ||
    authorizationRequest.targetRevision !== request.semantic.executionRevision || turn === undefined || intent === undefined ||
    turn.threadId !== request.threadId || !observationSemanticMatchesTurn(turn, request.semantic)
  ) throw new CodexJournalError("CONFLICT", "Codex inspection lacks one exact durable allow and turn tuple");
  requireCurrentSemanticTuple(state, codexSemantic(request.semantic));
  return Object.freeze({ turn, intent });
}

function exactReplay(
  state: ApplicationState,
  request: ExecutionStartRequest | ExecutionResumeRequest,
): CodexPreparedTurn | null {
  const turn = state.codexTurns.find((candidate) =>
    candidate.originIntentId === request.intentId || candidate.originOperationId === request.operationId ||
    candidate.startIdempotencyKey === request.idempotencyKey
  );
  if (turn === undefined) return null;
  const operation = state.codexBackendOperations.find((candidate) => candidate.intentId === request.intentId) ?? null;
  if (turn.originIntentId !== request.intentId || turn.originOperationId !== request.operationId ||
    turn.startIdempotencyKey !== request.idempotencyKey || !semanticMatchesTurn(turn, request.semantic) ||
    (operation !== null && (operation.backendOperationId !== request.operationId ||
      operation.idempotencyKey !== request.idempotencyKey))) {
    throw new CodexJournalError("CONFLICT", "Codex operation identity is already bound to another tuple");
  }
  return Object.freeze({ turn, operation, replayed: true });
}

function preparedTurn(
  request: ExecutionStartRequest | ExecutionResumeRequest,
  backendExecutionId: string,
  threadId: string | null,
  predecessor: CodexBackendTurnRecord | null,
  observedAt: string,
): CodexBackendTurnRecord {
  const semantic = codexSemantic(request.semantic);
  return Object.freeze({
    backendExecutionId,
    threadId,
    startIdempotencyKey: request.idempotencyKey,
    originIntentId: request.intentId,
    originOperationId: request.operationId,
    originAuthorizationDecisionId: request.authorizationDecisionId,
    projectId: semantic.projectId,
    projectResourceRevision: semantic.projectResourceRevision,
    projectConfigRevision: semantic.projectConfigRevision,
    taskId: semantic.taskId,
    taskRevision: semantic.taskRevision,
    inputReference: semantic.inputReference,
    executionId: semantic.executionId,
    executionRevision: semantic.executionRevision,
    attemptNumber: semantic.attemptNumber,
    fencingToken: semantic.fencingToken,
    predecessorBackendExecutionId: predecessor?.backendExecutionId ?? null,
    predecessorThreadId: predecessor?.threadId ?? null,
    policyBindingReference: semantic.policyBindingReference,
    workspaceContractId: semantic.workspaceContractId,
    workspaceId: semantic.workspaceId,
    workspaceGeneration: semantic.workspaceGeneration,
    workspaceRevision: semantic.workspaceRevision,
    workspaceRootKey: semantic.workspaceRootKey,
    ownershipBindingSha256: semantic.ownershipBindingSha256,
    workspaceHeadObjectId: semantic.workspaceHeadObjectId,
    lifecycle: "unknown",
    terminalSignal: null,
    cancellationRequestedAt: null,
    code: request.operation === "start" ? "codex_start_prepared" : "codex_continuation_prepared",
    evidenceReference: null,
    revision: 1,
    createdAt: observedAt,
    updatedAt: observedAt,
  });
}

class SqliteCodexTurnJournal implements CodexTurnJournal {
  readonly #store: PersistenceStore;

  constructor(store: PersistenceStore) {
    this.#store = store;
  }

  prepareStart(
    request: ExecutionStartRequest,
    identity: Readonly<{ backendExecutionId: string; observedAt: string }>,
  ): CodexPreparedTurn {
    if (!operationalIdentifier(identity.backendExecutionId) || !canonicalTimestamp(identity.observedAt)) {
      throw new CodexJournalError("INVALID_INPUT", "Codex start journal identity is invalid");
    }
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = requireIntent(state, request);
      const replay = exactReplay(state, request);
      if (replay !== null) return replay;
      if (intent.backendExecutionId !== null || intent.threadId !== null) {
        throw new CodexJournalError("CONFLICT", "Codex start intent already names a backend identity");
      }
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, identity.observedAt);
      requireCurrentTuple(state, intent);
      if (state.codexTurns.some((candidate) =>
        candidate.backendExecutionId === identity.backendExecutionId || candidate.executionId === intent.executionId
      )) throw new CodexJournalError("CONFLICT", "Codex start identity is already allocated");
      const turn = preparedTurn(request, identity.backendExecutionId, null, null, identity.observedAt);
      transaction.insertCodexTurn(turn);
      return Object.freeze({ turn, operation: null, replayed: false });
    });
  }

  prepareResume(
    request: ExecutionResumeRequest,
    identity: Readonly<{ backendExecutionId: string; observedAt: string }>,
  ): CodexPreparedTurn {
    if (!operationalIdentifier(identity.backendExecutionId) || !canonicalTimestamp(identity.observedAt)) {
      throw new CodexJournalError("INVALID_INPUT", "Codex continuation journal identity is invalid");
    }
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = requireIntent(state, request);
      const replay = exactReplay(state, request);
      if (replay !== null) return replay;
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, identity.observedAt);
      requireCurrentTuple(state, intent);
      const source = state.codexTurns.find((candidate) => candidate.backendExecutionId === request.backendExecutionId);
      const sourceExecution = intent.sourceExecutionId === null
        ? undefined : state.executions.find((candidate) => candidate.executionId === intent.sourceExecutionId);
      const execution = state.executions.find((candidate) => candidate.executionId === intent.executionId);
      if (
        intent.sourceExecutionId === null || source === undefined || source.threadId === null ||
        source.threadId !== request.threadId || source.threadId !== request.expectedThreadId ||
        source.executionId !== intent.sourceExecutionId || sourceExecution?.status !== "superseded" ||
        sourceExecution.supersededByExecutionId !== intent.executionId || execution?.supersedesExecutionId !== source.executionId ||
        (request.action === "execution.retry" && source.lifecycle !== "failed") ||
        state.codexTurns.some((candidate) =>
          candidate.backendExecutionId === identity.backendExecutionId || candidate.executionId === intent.executionId
        )
      ) throw new CodexJournalError("CONFLICT", "Codex continuation source or successor tuple is stale");
      const turn = preparedTurn(request, identity.backendExecutionId, source.threadId, source, identity.observedAt);
      transaction.insertCodexTurn(turn);
      return Object.freeze({ turn, operation: null, replayed: false });
    });
  }

  markActive(backendExecutionId: string, threadId: string, observedAt: string): CodexBackendTurnRecord {
    if (!operationalIdentifier(backendExecutionId) || !operationalIdentifier(threadId)) {
      throw new CodexJournalError("INVALID_INPUT", "Codex thread identity is invalid");
    }
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const current = state.codexTurns.find((candidate) => candidate.backendExecutionId === backendExecutionId);
      const intent = current === undefined ? undefined : state.executionIntents.find(
        (candidate) => candidate.intentId === current.originIntentId,
      );
      if (current === undefined || intent === undefined) throw new CodexJournalError("NOT_FOUND", "Codex turn is absent");
      requireCurrentActAuthorization(state, intent, current.originAuthorizationDecisionId, observedAt);
      requireCurrentTuple(state, intent);
      if (current.threadId !== null && current.threadId !== threadId) {
        throw new CodexJournalError("CONFLICT", "Codex thread identity changed");
      }
      if (current.lifecycle === "active" && current.threadId === threadId) return current;
      if (current.lifecycle !== "unknown") throw new CodexJournalError("CONFLICT", "Codex turn cannot become active");
      const updatedAt = afterTimestamp(current.updatedAt, observedAt);
      const turn = Object.freeze({
        ...current,
        threadId,
        lifecycle: "active" as const,
        code: "codex_turn_started",
        revision: current.revision + 1,
        updatedAt,
      });
      transaction.updateCodexTurn(turn, current.revision);
      return turn;
    });
  }

  recordTerminal(
    backendExecutionId: string,
    terminalSignal: CodexTurnTerminalSignal,
    code: string,
    evidenceReference: string,
    observedAt: string,
    receiptIdentity: (turn: CodexBackendTurnRecord) => CodexTerminalReceiptIdentity,
  ): Readonly<{ turn: CodexBackendTurnRecord; operation: CodexBackendOperationRecord }> {
    if (!operationalIdentifier(backendExecutionId) || !operationalIdentifier(code, 64) ||
      !operationalIdentifier(evidenceReference) || !canonicalTimestamp(observedAt)) {
      throw new CodexJournalError("INVALID_INPUT", "Codex terminal evidence is invalid");
    }
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const current = state.codexTurns.find((candidate) => candidate.backendExecutionId === backendExecutionId);
      if (current === undefined || current.threadId === null) throw new CodexJournalError("NOT_FOUND", "Codex thread is absent");
      const threadId = current.threadId;
      const intent = state.executionIntents.find((candidate) => candidate.intentId === current.originIntentId);
      if (intent === undefined) throw new CodexJournalError("INTEGRITY_FAILURE", "Codex origin intent is absent");
      const replay = state.codexBackendOperations.find((candidate) => candidate.intentId === intent.intentId);
      if (replay !== undefined) {
        if (replay.backendExecutionId !== current.backendExecutionId || replay.terminalSignal !== terminalSignal) {
          throw new CodexJournalError("CONFLICT", "Codex terminal operation conflicts with durable evidence");
        }
        return Object.freeze({ turn: current, operation: replay });
      }
      requireCurrentActAuthorization(state, intent, current.originAuthorizationDecisionId, observedAt);
      requireCurrentTuple(state, intent);
      if (current.lifecycle !== "active") throw new CodexJournalError("CONFLICT", "Codex terminal event lacks an active turn");
      const updatedAt = afterTimestamp(current.updatedAt, observedAt);
      const lifecycle = terminalSignal === "turn.completed" ? "turn_succeeded" as const : "failed" as const;
      const turn = Object.freeze({
        ...current,
        lifecycle,
        terminalSignal,
        code,
        evidenceReference,
        revision: current.revision + 1,
        updatedAt,
      });
      const receipt = receiptIdentity(turn);
      if (!operationalIdentifier(receipt.receiptId) || !/^[0-9A-F]{64}$/u.test(receipt.receiptSha256)) {
        throw new CodexJournalError("INVALID_INPUT", "Codex terminal receipt identity is invalid");
      }
      const operation: CodexBackendOperationRecord = Object.freeze({
        backendOperationId: intent.operationId,
        idempotencyKey: intent.idempotencyKey,
        intentId: intent.intentId,
        authorizationDecisionId: current.originAuthorizationDecisionId,
        operationKind: intent.operationKind as "start" | "resume" | "retry",
        backendExecutionId: turn.backendExecutionId,
        threadId,
        sourceBackendExecutionId: turn.predecessorBackendExecutionId,
        sourceThreadId: turn.predecessorThreadId,
        expectedFencingToken: turn.fencingToken,
        expectedPreRevision: null,
        postRevision: turn.revision,
        resultLifecycle: lifecycle,
        terminalSignal,
        receiptId: receipt.receiptId,
        receiptSha256: receipt.receiptSha256,
        createdAt: updatedAt,
      });
      transaction.updateCodexTurn(turn, current.revision);
      transaction.insertCodexBackendOperation(operation);
      return Object.freeze({ turn, operation });
    });
  }

  inspect(request: ExecutionInspectRequest): CodexBackendTurnRecord {
    const state = readApplicationStateForOwner(this.#store);
    return requireInspectionTuple(state, request).turn;
  }

  markUnproved(request: ExecutionInspectRequest, observedAt: string): CodexBackendTurnRecord {
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const current = requireInspectionTuple(state, request).turn;
      if (current.lifecycle === "unknown") return current;
      if (current.lifecycle !== "active") return current;
      const updatedAt = afterTimestamp(current.updatedAt, observedAt);
      const turn = Object.freeze({
        ...current,
        lifecycle: "unknown" as const,
        code: "codex_terminal_unproved",
        evidenceReference: null,
        revision: current.revision + 1,
        updatedAt,
      });
      transaction.updateCodexTurn(turn, current.revision);
      return turn;
    });
  }

  recordCancellationRequest(request: ExecutionCancelRequest, observedAt: string): CodexBackendTurnRecord {
    return withApplicationTransaction(this.#store, (transaction) => {
      const state = transaction.read();
      const intent = state.executionIntents.find((candidate) => candidate.intentId === request.intentId);
      const current = state.codexTurns.find((candidate) => candidate.backendExecutionId === request.backendExecutionId);
      if (current === undefined) throw new CodexJournalError("NOT_FOUND", "Codex turn is absent");
      const terminalNoEffect = request.expectedLifecycle === "turn_succeeded" || request.expectedLifecycle === "failed";
      const turnSemanticMatches = terminalNoEffect
        ? observationSemanticMatchesTurn(current, request.semantic)
        : semanticMatchesTurn(current, request.semantic);
      if (intent === undefined || intent.operationKind !== "request_cancel" || intent.backendKind !== "codex-sdk" ||
        intent.operationId !== request.operationId || intent.idempotencyKey !== request.idempotencyKey ||
        intent.actorId !== request.actorId || intent.action !== request.action ||
        intent.adapterId !== request.adapterId || intent.adapterVersion !== request.adapterVersion ||
        intent.backendExecutionId !== request.backendExecutionId || intent.threadId !== request.threadId ||
        !intentSemanticMatches(intent, request.operationId, request.idempotencyKey, request.semantic) ||
        current.threadId !== request.threadId || !turnSemanticMatches ||
        current.lifecycle !== request.expectedLifecycle) {
        throw new CodexJournalError("CONFLICT", "Codex cancellation is not bound to the current turn and core intent");
      }
      requireCurrentActAuthorization(state, intent, request.authorizationDecisionId, observedAt);
      requireCurrentTuple(state, intent);
      if (current.cancellationRequestedAt !== null || current.lifecycle !== "active") return current;
      const updatedAt = afterTimestamp(current.updatedAt, observedAt);
      const turn = Object.freeze({
        ...current,
        cancellationRequestedAt: updatedAt,
        code: "codex_cancel_requested_unproved",
        revision: current.revision + 1,
        updatedAt,
      });
      transaction.updateCodexTurn(turn, current.revision);
      return turn;
    });
  }
}

export function createCodexTurnJournal(store: PersistenceStore): CodexTurnJournal {
  return new SqliteCodexTurnJournal(store);
}
