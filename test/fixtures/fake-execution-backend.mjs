import {
  EXECUTION_CONTRACT_ID,
  MANUAL_OUTCOME_CONTROL_ID,
  parseExecutionRequest,
  parseManualOutcomeReport,
} from "../../src/execution-port.ts";
import { canonicalJson, sha256 } from "../../src/persistence/values.ts";

function adapterError(correlationId, category, code) {
  const retryable = ["busy", "rate_limited", "resource_exhausted", "transient_external"].includes(category);
  const ambiguous = ["ambiguous_external_state", "integrity_failure"].includes(category);
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code,
      category,
      retryable,
      ambiguous,
      message: "Fake adapter rejected the bounded test request",
      correlationId,
      externalReference: null,
      retryAfter: null,
    }),
  });
}

function integrity(projection) {
  return sha256(canonicalJson(projection));
}

function transitionTarget(operation) {
  return {
    activate: "active",
    wait: "waiting",
    succeed: "turn_succeeded",
    fail: "failed",
    confirm_cancelled: "cancelled",
  }[operation];
}

function transitionAllowed(lifecycle, operation) {
  if (["turn_succeeded", "failed", "cancelled"].includes(lifecycle)) return false;
  if (operation === "activate") return lifecycle === "queued" || lifecycle === "waiting";
  return ["queued", "active", "waiting"].includes(lifecycle);
}

export class FakeExecutionBackend {
  contractId = EXECUTION_CONTRACT_ID;
  outcomeContractId = MANUAL_OUTCOME_CONTROL_ID;
  adapterId = "fake-test-only";
  adapterVersion = "1.0.0-test";
  #sequence = 0;
  #turns = new Map();
  #operations = new Map();

  #id(kind) {
    this.#sequence += 1;
    return `${kind}-fake-${this.#sequence}`;
  }

  #now() {
    const milliseconds = Date.parse("2026-08-30T12:00:10.000Z") + this.#sequence;
    return new Date(milliseconds).toISOString();
  }

  #validAdapter(request) {
    return request.contractId === this.contractId && request.adapterId === this.adapterId &&
      request.adapterVersion === this.adapterVersion;
  }

  #replay(request) {
    const prior = this.#operations.get(request.operationId);
    if (prior === undefined) return null;
    return prior.idempotencyKey === request.idempotencyKey && prior.intentId === request.intentId
      ? prior.result
      : adapterError(request.correlationId, "conflict", "fake_idempotency_conflict");
  }

  #remember(request, result) {
    this.#operations.set(request.operationId, Object.freeze({
      idempotencyKey: request.idempotencyKey,
      intentId: request.intentId,
      result,
    }));
    return result;
  }

  #mutationProjection(request, turn, operation, lifecycle, preRevision) {
    return Object.freeze({
      receiptId: this.#id("receipt"),
      contractId: EXECUTION_CONTRACT_ID,
      correlationId: request.correlationId,
      adapterId: this.adapterId,
      adapterVersion: this.adapterVersion,
      observedEndpointVersion: "local-manual/v1",
      observedExecutionId: request.semantic.executionId,
      outcome: "succeeded",
      code: operation === "start" ? "fake_started" : operation === "resume" ? "fake_resumed" : "fake_cancel_recorded",
      observedAt: this.#now(),
      validUntil: null,
      evidenceReference: null,
      observationNumber: turn.revision,
      operationId: request.operationId,
      intentId: request.intentId,
      idempotencyKey: request.idempotencyKey,
      observedPreRevision: preRevision,
      observedPostRevision: turn.revision,
      operation,
      backendExecutionId: turn.backendExecutionId,
      threadId: turn.threadId,
      lifecycle,
      ...(operation === "start" || operation === "resume" ? { workspaceMode: "none" } : {}),
    });
  }

  start(value) {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "start" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "fake_invalid_start");
    }
    const replay = this.#replay(request);
    if (replay !== null) return replay;
    if ([...this.#turns.values()].some((turn) => turn.executionId === request.semantic.executionId)) {
      return adapterError(request.correlationId, "conflict", "fake_execution_exists");
    }
    const turn = {
      backendExecutionId: this.#id("backend"),
      threadId: this.#id("thread"),
      executionId: request.semantic.executionId,
      semantic: request.semantic,
      lifecycle: "queued",
      code: "fake_queued",
      evidenceReference: null,
      revision: 1,
      cancellationRequested: false,
    };
    this.#turns.set(turn.backendExecutionId, turn);
    const projection = this.#mutationProjection(request, turn, "start", "started", null);
    const result = Object.freeze({ ok: true, receipt: Object.freeze({ ...projection, integritySha256: integrity(projection) }) });
    return this.#remember(request, result);
  }

  resume(value) {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "resume" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "fake_invalid_resume");
    }
    const replay = this.#replay(request);
    if (replay !== null) return replay;
    const source = this.#turns.get(request.backendExecutionId);
    if (source === undefined || source.threadId !== request.threadId) {
      return adapterError(request.correlationId, "not_found", "fake_source_absent");
    }
    const successor = source.executionId !== request.semantic.executionId;
    if ((!successor && source.lifecycle !== "waiting") ||
      (successor && request.action === "execution.retry" && source.lifecycle !== "failed")) {
      return adapterError(request.correlationId, "conflict", "fake_resume_lifecycle_conflict");
    }
    const preRevision = successor ? null : source.revision;
    const turn = successor ? {
      backendExecutionId: this.#id("backend"),
      threadId: this.#id("thread"),
      executionId: request.semantic.executionId,
      semantic: request.semantic,
      lifecycle: "active",
      code: "fake_resumed",
      evidenceReference: null,
      revision: 1,
      cancellationRequested: false,
    } : Object.assign(source, {
      semantic: request.semantic,
      lifecycle: "active",
      code: "fake_resumed",
      evidenceReference: null,
      revision: source.revision + 1,
    });
    if (successor) this.#turns.set(turn.backendExecutionId, turn);
    const projection = this.#mutationProjection(request, turn, "resume", "started", preRevision);
    const result = Object.freeze({ ok: true, receipt: Object.freeze({ ...projection, integritySha256: integrity(projection) }) });
    return this.#remember(request, result);
  }

  inspect(value) {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "inspect" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "fake_invalid_inspect");
    }
    const turn = this.#turns.get(request.backendExecutionId);
    if (turn === undefined || turn.threadId !== request.threadId || turn.executionId !== request.semantic.executionId) {
      return adapterError(request.correlationId, "not_found", "fake_turn_absent");
    }
    const projection = Object.freeze({
      receiptId: this.#id("receipt"),
      contractId: EXECUTION_CONTRACT_ID,
      correlationId: request.correlationId,
      adapterId: this.adapterId,
      adapterVersion: this.adapterVersion,
      observedEndpointVersion: "local-manual/v1",
      operation: "inspect",
      observedExecutionId: request.semantic.executionId,
      outcome: "succeeded",
      code: turn.code,
      observedAt: this.#now(),
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
    return Object.freeze({ ok: true, receipt: Object.freeze({ ...projection, integritySha256: integrity(projection) }) });
  }

  requestCancel(value) {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "request_cancel" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "fake_invalid_cancel");
    }
    const replay = this.#replay(request);
    if (replay !== null) return replay;
    const turn = this.#turns.get(request.backendExecutionId);
    if (turn === undefined || turn.threadId !== request.threadId || turn.executionId !== request.semantic.executionId) {
      return adapterError(request.correlationId, "not_found", "fake_turn_absent");
    }
    const terminal = ["turn_succeeded", "failed", "cancelled"].includes(turn.lifecycle);
    const preRevision = turn.revision;
    if (!terminal) {
      turn.revision += 1;
      turn.cancellationRequested = true;
      turn.code = "fake_cancel_requested";
    }
    const projection = this.#mutationProjection(
      request,
      turn,
      "request_cancel",
      terminal ? "already_terminal" : "requested",
      preRevision,
    );
    const result = Object.freeze({ ok: true, receipt: Object.freeze({ ...projection, integritySha256: integrity(projection) }) });
    return this.#remember(request, result);
  }

  recordOutcome(value) {
    const request = parseManualOutcomeReport(value);
    if (request === null) return adapterError("unknown-correlation", "invalid_request", "fake_invalid_outcome");
    const replay = this.#replay(request);
    if (replay !== null) return replay;
    const turn = this.#turns.get(request.backendExecutionId);
    if (turn === undefined || turn.threadId !== request.threadId || turn.executionId !== request.semantic.executionId) {
      return adapterError(request.correlationId, "not_found", "fake_turn_absent");
    }
    if (turn.revision !== request.expectedJournalRevision || turn.lifecycle !== request.expectedLifecycle ||
      !transitionAllowed(turn.lifecycle, request.operation) ||
      (request.operation === "confirm_cancelled" && !turn.cancellationRequested)) {
      return adapterError(request.correlationId, "stale_revision", "fake_outcome_conflict");
    }
    const preRevision = turn.revision;
    turn.lifecycle = transitionTarget(request.operation);
    turn.code = request.code;
    turn.evidenceReference = request.evidenceReference;
    turn.revision += 1;
    const receipt = Object.freeze({
      contractId: MANUAL_OUTCOME_CONTROL_ID,
      receiptId: this.#id("receipt"),
      reportId: request.reportId,
      operationId: request.operationId,
      intentId: request.intentId,
      idempotencyKey: request.idempotencyKey,
      correlationId: request.correlationId,
      backendExecutionId: turn.backendExecutionId,
      threadId: turn.threadId,
      observedPreRevision: preRevision,
      observedPostRevision: turn.revision,
      lifecycle: turn.lifecycle,
      code: turn.code,
      evidenceReference: turn.evidenceReference,
      observedAt: this.#now(),
    });
    return this.#remember(request, Object.freeze({ ok: true, receipt }));
  }
}

export function createFakeExecutionBackend() {
  return new FakeExecutionBackend();
}
