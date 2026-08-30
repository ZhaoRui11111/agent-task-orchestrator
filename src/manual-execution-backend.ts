import { randomUUID } from "node:crypto";
import {
  EXECUTION_CONTRACT_ID,
  MANUAL_OUTCOME_CONTROL_ID,
  parseExecutionRequest,
  parseManualOutcomeReport,
  type ExecutionAdapterError,
  type ExecutionAdapterErrorCategory,
  type ExecutionBackend,
  type ExecutionCancelReceipt,
  type ExecutionCancelRequest,
  type ExecutionInspectReceipt,
  type ExecutionInspectRequest,
  type ExecutionPortResult,
  type ExecutionResumeRequest,
  type ExecutionStartReceipt,
  type ExecutionStartRequest,
  type ManualOutcomeControl,
  type ManualOutcomeControlResult,
  type ManualOutcomeReportReceipt,
  type ManualOutcomeReportRequest,
} from "./execution-port.ts";
import {
  createManualTurnJournal,
  ManualJournalError,
  type ManualJournalMutationResult,
  type ManualTurnJournal,
} from "./persistence/manual-backend-repository.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";

export interface ManualBackendIngress {
  now(): string;
  nextId(kind: "backend_execution" | "thread" | "receipt"): string;
}

export interface ManualExecutionBackendOptions {
  readonly adapterId?: string;
  readonly adapterVersion?: string;
  readonly ingress?: ManualBackendIngress;
  readonly journal?: ManualTurnJournal;
}

function defaultIngress(): ManualBackendIngress {
  return Object.freeze({
    now: () => new Date().toISOString(),
    nextId: (kind: "backend_execution" | "thread" | "receipt") => `${kind}:${randomUUID()}`,
  });
}

function operationalIdentifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function errorFlags(category: ExecutionAdapterErrorCategory): readonly [boolean, boolean] {
  switch (category) {
    case "busy": case "rate_limited": case "resource_exhausted": case "transient_external": return [true, false];
    case "ambiguous_external_state": case "integrity_failure": return [false, true];
    default: return [false, false];
  }
}

function adapterError(
  correlationId: string,
  category: ExecutionAdapterErrorCategory,
  code: string,
  message: string,
): Readonly<{ ok: false; error: ExecutionAdapterError }> {
  const flags = errorFlags(category);
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      code,
      category,
      retryable: flags[0],
      ambiguous: flags[1],
      message,
      correlationId: operationalIdentifier(correlationId) ? correlationId : "unknown-correlation",
      externalReference: null,
      retryAfter: null,
    }),
  });
}

function mapJournalError(correlationId: string, error: unknown): Readonly<{ ok: false; error: ExecutionAdapterError }> {
  if (error instanceof ManualJournalError) {
    switch (error.code) {
      case "INVALID_INPUT": return adapterError(correlationId, "invalid_request", "manual_invalid_request", "Manual request is invalid");
      case "NOT_FOUND": return adapterError(correlationId, "not_found", "manual_not_found", "Manual turn was not found");
      case "CONFLICT": return adapterError(correlationId, "conflict", "manual_conflict", "Manual turn identity or lifecycle conflicts");
      case "STALE_REVISION": return adapterError(correlationId, "stale_revision", "manual_stale_revision", "Manual turn revision or fence is stale");
      case "INTEGRITY_FAILURE": return adapterError(correlationId, "integrity_failure", "manual_integrity_failure", "Manual journal evidence is not trustworthy");
    }
  }
  return adapterError(correlationId, "integrity_failure", "manual_internal_failure", "Manual journal operation failed closed");
}

function receiptIntegrity(value: Readonly<Record<string, unknown>>): string {
  return sha256(canonicalJson(value));
}

function mutationBase(
  request: ExecutionStartRequest | ExecutionResumeRequest | ExecutionCancelRequest,
  result: ManualJournalMutationResult,
  adapterId: string,
  adapterVersion: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    receiptId: result.operation.receiptId,
    contractId: EXECUTION_CONTRACT_ID,
    correlationId: request.correlationId,
    adapterId,
    adapterVersion,
    observedEndpointVersion: "local-manual/v1",
    observedExecutionId: request.semantic.executionId,
    outcome: "succeeded",
    code: result.operation.operationKind === "start" ? "manual_started" :
      result.operation.operationKind === "resume" ? "manual_resumed" : "manual_cancel_recorded",
    observedAt: result.operation.createdAt,
    validUntil: null,
    evidenceReference: null,
    observationNumber: result.operation.postRevision,
    operationId: request.operationId,
    intentId: request.intentId,
    idempotencyKey: request.idempotencyKey,
    observedPreRevision: result.operation.expectedPreRevision,
    observedPostRevision: result.operation.postRevision,
  });
}

export class ManualExecutionBackend implements ExecutionBackend, ManualOutcomeControl {
  readonly contractId = EXECUTION_CONTRACT_ID;
  readonly outcomeContractId = MANUAL_OUTCOME_CONTROL_ID;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly #ingress: ManualBackendIngress;
  readonly #journal: ManualTurnJournal;

  constructor(store: PersistenceStore, options: ManualExecutionBackendOptions = {}) {
    this.adapterId = options.adapterId ?? "manual-local";
    this.adapterVersion = options.adapterVersion ?? "1.0.0";
    this.#ingress = options.ingress ?? defaultIngress();
    this.#journal = options.journal ?? createManualTurnJournal(store);
    if (!operationalIdentifier(this.adapterId) || !operationalIdentifier(this.adapterVersion)) {
      throw new TypeError("Manual adapter identity is invalid");
    }
  }

  #time(): string | null {
    try {
      const value = this.#ingress.now();
      return canonicalTimestamp(value) ? value : null;
    } catch {
      return null;
    }
  }

  #id(kind: "backend_execution" | "thread" | "receipt"): string | null {
    try {
      const value = this.#ingress.nextId(kind);
      return operationalIdentifier(value) ? value : null;
    } catch {
      return null;
    }
  }

  #validAdapter(request: ExecutionStartRequest | ExecutionResumeRequest | ExecutionInspectRequest | ExecutionCancelRequest): boolean {
    return request.contractId === EXECUTION_CONTRACT_ID && request.adapterId === this.adapterId && request.adapterVersion === this.adapterVersion;
  }

  start(value: ExecutionStartRequest): ExecutionPortResult<ExecutionStartReceipt> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "start" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "manual_invalid_start", "Manual start request is invalid");
    }
    const observedAt = this.#time();
    const backendExecutionId = this.#id("backend_execution");
    const threadId = this.#id("thread");
    const receiptId = this.#id("receipt");
    if (observedAt === null || backendExecutionId === null || threadId === null || receiptId === null) {
      return adapterError(request.correlationId, "integrity_failure", "manual_identity_failure", "Manual trusted identities are unavailable");
    }
    try {
      const result = this.#journal.start(request, { backendExecutionId, threadId, receiptId, observedAt });
      const base = mutationBase(request, result, this.adapterId, this.adapterVersion);
      const projection = Object.freeze({
        ...base,
        operation: "start" as const,
        backendExecutionId: result.operation.backendExecutionId,
        threadId: result.operation.threadId,
        lifecycle: "started" as const,
        workspaceMode: "none" as const,
      });
      const receipt = Object.freeze({ ...projection, integritySha256: receiptIntegrity(projection) }) as ExecutionStartReceipt;
      return Object.freeze({ ok: true as const, receipt });
    } catch (error) {
      return mapJournalError(request.correlationId, error);
    }
  }

  resume(value: ExecutionResumeRequest): ExecutionPortResult<ExecutionStartReceipt> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "resume" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "manual_invalid_resume", "Manual resume request is invalid");
    }
    const observedAt = this.#time();
    const successorBackendExecutionId = this.#id("backend_execution");
    const successorThreadId = this.#id("thread");
    const receiptId = this.#id("receipt");
    if (observedAt === null || successorBackendExecutionId === null || successorThreadId === null || receiptId === null) {
      return adapterError(request.correlationId, "integrity_failure", "manual_identity_failure", "Manual trusted identities are unavailable");
    }
    try {
      const result = this.#journal.resume(request, {
        successorBackendExecutionId, successorThreadId, receiptId, observedAt,
      });
      const base = mutationBase(request, result, this.adapterId, this.adapterVersion);
      const projection = Object.freeze({
        ...base,
        operation: "resume" as const,
        backendExecutionId: result.operation.backendExecutionId,
        threadId: result.operation.threadId,
        lifecycle: "started" as const,
        workspaceMode: "none" as const,
      });
      const receipt = Object.freeze({ ...projection, integritySha256: receiptIntegrity(projection) }) as ExecutionStartReceipt;
      return Object.freeze({ ok: true as const, receipt });
    } catch (error) {
      return mapJournalError(request.correlationId, error);
    }
  }

  inspect(value: ExecutionInspectRequest): ExecutionPortResult<ExecutionInspectReceipt> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "inspect" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "manual_invalid_inspect", "Manual inspect request is invalid");
    }
    const observedAt = this.#time();
    const receiptId = this.#id("receipt");
    if (observedAt === null || receiptId === null) return adapterError(request.correlationId, "integrity_failure", "manual_identity_failure", "Manual trusted identities are unavailable");
    try {
      const turn = this.#journal.inspect(request);
      const projection = Object.freeze({
        receiptId,
        contractId: EXECUTION_CONTRACT_ID,
        correlationId: request.correlationId,
        adapterId: this.adapterId,
        adapterVersion: this.adapterVersion,
        observedEndpointVersion: "local-manual/v1" as const,
        operation: "inspect" as const,
        observedExecutionId: request.semantic.executionId,
        outcome: "succeeded" as const,
        code: turn.code,
        observedAt,
        validUntil: null,
        evidenceReference: turn.evidenceReference,
        observationNumber: turn.revision,
        queryId: request.queryId,
        authorizationDecisionId: request.authorizationDecisionId,
        backendExecutionId: turn.backendExecutionId,
        threadId: turn.threadId,
        lifecycle: turn.lifecycle,
        resultReference: turn.evidenceReference,
      });
      const receipt = Object.freeze({ ...projection, integritySha256: receiptIntegrity(projection) }) as ExecutionInspectReceipt;
      return Object.freeze({ ok: true as const, receipt });
    } catch (error) {
      return mapJournalError(request.correlationId, error);
    }
  }

  requestCancel(value: ExecutionCancelRequest): ExecutionPortResult<ExecutionCancelReceipt> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "request_cancel" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "manual_invalid_cancel", "Manual cancel request is invalid");
    }
    const observedAt = this.#time();
    const receiptId = this.#id("receipt");
    if (observedAt === null || receiptId === null) return adapterError(request.correlationId, "integrity_failure", "manual_identity_failure", "Manual trusted identities are unavailable");
    try {
      const result = this.#journal.requestCancel(request, { receiptId, observedAt });
      const base = mutationBase(request, result, this.adapterId, this.adapterVersion);
      const projection = Object.freeze({
        ...base,
        operation: "request_cancel" as const,
        backendExecutionId: result.operation.backendExecutionId,
        threadId: result.operation.threadId,
        lifecycle: result.operation.expectedPreRevision === result.operation.postRevision
          ? "already_terminal" as const : "requested" as const,
      });
      const receipt = Object.freeze({ ...projection, integritySha256: receiptIntegrity(projection) }) as ExecutionCancelReceipt;
      return Object.freeze({ ok: true as const, receipt });
    } catch (error) {
      return mapJournalError(request.correlationId, error);
    }
  }

  recordOutcome(value: ManualOutcomeReportRequest): ManualOutcomeControlResult {
    const request = parseManualOutcomeReport(value);
    if (request === null) return adapterError("unknown-correlation", "invalid_request", "manual_invalid_outcome", "Manual outcome report is invalid");
    const observedAt = this.#time();
    const receiptId = this.#id("receipt");
    if (observedAt === null || receiptId === null) return adapterError(request.correlationId, "integrity_failure", "manual_identity_failure", "Manual trusted identities are unavailable");
    try {
      const result = this.#journal.recordOutcome(request, { receiptId, observedAt });
      const receipt: ManualOutcomeReportReceipt = Object.freeze({
        contractId: MANUAL_OUTCOME_CONTROL_ID,
        receiptId: result.operation.receiptId,
        reportId: request.reportId,
        operationId: request.operationId,
        intentId: request.intentId,
        idempotencyKey: request.idempotencyKey,
        correlationId: request.correlationId,
        backendExecutionId: result.operation.backendExecutionId,
        threadId: result.operation.threadId,
        observedPreRevision: result.operation.expectedPreRevision ?? result.operation.postRevision,
        observedPostRevision: result.operation.postRevision,
        lifecycle: result.operation.resultLifecycle,
        code: result.turn.code,
        evidenceReference: result.turn.evidenceReference,
        observedAt: result.operation.createdAt,
      });
      return Object.freeze({ ok: true as const, receipt });
    } catch (error) {
      return mapJournalError(request.correlationId, error);
    }
  }
}

export function createManualExecutionBackend(
  store: PersistenceStore,
  options: ManualExecutionBackendOptions = {},
): ManualExecutionBackend {
  return new ManualExecutionBackend(store, options);
}
