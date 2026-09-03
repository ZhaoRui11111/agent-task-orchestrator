export const COMPLETION_CONTRACT_ID = "ato.completion/v1" as const;

export const COMPLETION_OPERATIONS = Object.freeze(["run_gate", "inspect_gate", "cancel_gate"] as const);
export const COMPLETION_GATE_VERDICTS = Object.freeze(["pass", "fail", "indeterminate"] as const);
export const COMPLETION_GATE_LIFECYCLES = Object.freeze([
  "running", "completed", "cancel_requested", "cancelled", "unknown",
] as const);

export const COMPLETION_FAILURE_CATEGORIES = Object.freeze([
  "invalid_request", "incompatible_contract", "unauthorized", "policy_denied", "not_found", "conflict",
  "stale_revision", "busy", "rate_limited", "resource_exhausted", "transient_external", "permanent_external",
  "ambiguous_external_state", "cancelled", "integrity_failure",
] as const);

export type CompletionOperation = (typeof COMPLETION_OPERATIONS)[number];
export type CompletionGateVerdict = (typeof COMPLETION_GATE_VERDICTS)[number];
export type CompletionGateLifecycle = (typeof COMPLETION_GATE_LIFECYCLES)[number];
export type CompletionFailureCategory = (typeof COMPLETION_FAILURE_CATEGORIES)[number];

export interface CompletionGateSubject {
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly repositoryIdentity: string;
  readonly headObjectId: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly workspaceId: string;
  readonly generation: number;
  readonly workspaceRevision: number;
  readonly workspaceRootKey: string;
  readonly ownershipBindingSha256: string;
  readonly policyId: string;
  readonly policyReceiptId: string;
  readonly policyConfigRevision: number;
  readonly gateId: string;
  readonly gateVersion: string;
  readonly commandKey: string;
  readonly commandIdentitySha256: string;
  readonly completionEvidenceRootKey: string;
  readonly toolEnvironmentSha256: string;
}

interface CompletionRequestBase {
  readonly contractId: typeof COMPLETION_CONTRACT_ID;
  readonly operation: CompletionOperation;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly actorId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly subject: CompletionGateSubject;
}

export type RunGateRequest = CompletionRequestBase & Readonly<{
  readonly operation: "run_gate";
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly finalAuthorizationDecisionId: string;
  readonly timeoutMs: number;
}>;

export type InspectGateRequest = CompletionRequestBase & Readonly<{
  readonly operation: "inspect_gate";
  readonly queryId: string;
  readonly readAuthorizationDecisionId: string;
  readonly gateOperationId: string;
  readonly lastObservationNumber: number;
}>;

export type CancelGateRequest = CompletionRequestBase & Readonly<{
  readonly operation: "cancel_gate";
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly finalAuthorizationDecisionId: string;
  readonly gateOperationId: string;
  readonly expectedObservationNumber: number;
}>;

export type CompletionBackendRequest = RunGateRequest | InspectGateRequest | CancelGateRequest;

interface CompletionReceiptBase {
  readonly contractId: typeof COMPLETION_CONTRACT_ID;
  readonly receiptId: string;
  readonly operation: CompletionOperation;
  readonly correlationId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly subject: CompletionGateSubject;
  readonly gateOperationId: string;
  readonly observationNumber: number;
  readonly lifecycle: CompletionGateLifecycle;
  readonly verdict: CompletionGateVerdict;
  readonly code: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly validUntil: string | null;
  readonly evidenceReference: string;
  readonly observedAt: string;
}

export type RunGateReceipt = CompletionReceiptBase & Readonly<{
  readonly operation: "run_gate";
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
}>;

export type InspectGateReceipt = CompletionReceiptBase & Readonly<{
  readonly operation: "inspect_gate";
  readonly queryId: string;
  readonly readAuthorizationDecisionId: string;
}>;

export type CancelGateReceipt = CompletionReceiptBase & Readonly<{
  readonly operation: "cancel_gate";
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
}>;

export type CompletionBackendReceipt = RunGateReceipt | InspectGateReceipt | CancelGateReceipt;

export interface CompletionBackendFailure {
  readonly category: CompletionFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly retryAfter: string | null;
  readonly evidenceReference: string | null;
}

export type CompletionBackendResult =
  | Readonly<{ readonly ok: true; readonly receipt: CompletionBackendReceipt }>
  | Readonly<{ readonly ok: false; readonly error: CompletionBackendFailure }>;

export interface CompletionBackend {
  runGate(request: RunGateRequest): unknown;
  inspectGate(request: InspectGateRequest): unknown;
  cancelGate(request: CancelGateRequest): unknown;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const FAILURE_FLAGS: Readonly<Record<CompletionFailureCategory, Readonly<{ retryable: boolean; ambiguous: boolean }>>> = Object.freeze({
  invalid_request: Object.freeze({ retryable: false, ambiguous: false }),
  incompatible_contract: Object.freeze({ retryable: false, ambiguous: false }),
  unauthorized: Object.freeze({ retryable: false, ambiguous: false }),
  policy_denied: Object.freeze({ retryable: false, ambiguous: false }),
  not_found: Object.freeze({ retryable: false, ambiguous: false }),
  conflict: Object.freeze({ retryable: false, ambiguous: false }),
  stale_revision: Object.freeze({ retryable: false, ambiguous: false }),
  busy: Object.freeze({ retryable: true, ambiguous: false }),
  rate_limited: Object.freeze({ retryable: true, ambiguous: false }),
  resource_exhausted: Object.freeze({ retryable: true, ambiguous: false }),
  transient_external: Object.freeze({ retryable: true, ambiguous: false }),
  permanent_external: Object.freeze({ retryable: false, ambiguous: false }),
  ambiguous_external_state: Object.freeze({ retryable: false, ambiguous: true }),
  cancelled: Object.freeze({ retryable: false, ambiguous: false }),
  integrity_failure: Object.freeze({ retryable: false, ambiguous: true }),
});

function exactRecord(value: unknown, keys: readonly string[]): UnknownRecord | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const expected = new Set(keys);
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !expected.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      Object.defineProperty(copy, key, { enumerable: true, value: descriptor.value });
    }
    return Object.freeze(copy);
  } catch {
    return null;
  }
}

function text(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function positive(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
}

function sha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function timestamp(value: unknown, nullable = false): boolean {
  if (nullable && value === null) return true;
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function operation(value: unknown): value is CompletionOperation {
  return typeof value === "string" && (COMPLETION_OPERATIONS as readonly string[]).includes(value);
}

const SUBJECT_KEYS = Object.freeze([
  "projectId", "projectResourceRevision", "projectConfigRevision", "projectRootKey", "repositoryIdentity",
  "headObjectId", "taskId", "taskRevision", "executionId", "executionRevision", "attemptNumber", "fencingToken",
  "workspaceId", "generation", "workspaceRevision", "workspaceRootKey", "ownershipBindingSha256", "policyId",
  "policyReceiptId", "policyConfigRevision", "gateId", "gateVersion", "commandKey", "commandIdentitySha256",
  "completionEvidenceRootKey", "toolEnvironmentSha256",
]);

function parseSubject(value: unknown): CompletionGateSubject | null {
  const record = exactRecord(value, SUBJECT_KEYS);
  if (record === null || !text(record.projectId) || !positive(record.projectResourceRevision) ||
      !positive(record.projectConfigRevision) || !text(record.projectRootKey) || !text(record.repositoryIdentity) ||
      !sha1(record.headObjectId) || !text(record.taskId) || !positive(record.taskRevision) || !text(record.executionId) ||
      !positive(record.executionRevision) || !positive(record.attemptNumber) || !positive(record.fencingToken) ||
      !text(record.workspaceId) || !positive(record.generation) || !positive(record.workspaceRevision) ||
      !text(record.workspaceRootKey) || !sha256(record.ownershipBindingSha256) || !text(record.policyId) ||
      !text(record.policyReceiptId) || !positive(record.policyConfigRevision) ||
      record.policyConfigRevision !== record.projectConfigRevision || !text(record.gateId) ||
      !text(record.gateVersion) || !text(record.commandKey) || !sha256(record.commandIdentitySha256) ||
      !text(record.completionEvidenceRootKey) || !sha256(record.toolEnvironmentSha256)) return null;
  return Object.freeze(record) as unknown as CompletionGateSubject;
}

const BASE_REQUEST_KEYS = Object.freeze([
  "contractId", "operation", "correlationId", "causationId", "actorId", "adapterId", "adapterVersion", "subject",
]);

export function parseCompletionBackendRequest(value: unknown): CompletionBackendRequest | null {
  const header = exactRecord(value, [
    ...BASE_REQUEST_KEYS,
    ...(typeof value === "object" && value !== null && "operation" in value && (value as Readonly<{ operation?: unknown }>).operation === "run_gate"
      ? ["operationId", "intentId", "idempotencyKey", "finalAuthorizationDecisionId", "timeoutMs"]
      : typeof value === "object" && value !== null && "operation" in value && (value as Readonly<{ operation?: unknown }>).operation === "inspect_gate"
        ? ["queryId", "readAuthorizationDecisionId", "gateOperationId", "lastObservationNumber"]
        : ["operationId", "intentId", "idempotencyKey", "finalAuthorizationDecisionId", "gateOperationId", "expectedObservationNumber"]),
  ]);
  if (header === null || header.contractId !== COMPLETION_CONTRACT_ID || !operation(header.operation) ||
      !text(header.correlationId) || !(header.causationId === null || text(header.causationId)) || !text(header.actorId) ||
      !text(header.adapterId) || !text(header.adapterVersion)) return null;
  const subject = parseSubject(header.subject);
  if (subject === null) return null;
  if (header.operation === "run_gate") {
    if (!text(header.operationId) || !text(header.intentId) || !text(header.idempotencyKey) ||
        !text(header.finalAuthorizationDecisionId) || !positive(header.timeoutMs, 3_600_000)) return null;
  } else if (header.operation === "inspect_gate") {
    if (!text(header.queryId) || !text(header.readAuthorizationDecisionId) || !text(header.gateOperationId) ||
        !nonnegative(header.lastObservationNumber)) return null;
  } else if (!text(header.operationId) || !text(header.intentId) || !text(header.idempotencyKey) ||
      !text(header.finalAuthorizationDecisionId) || !text(header.gateOperationId) ||
      !nonnegative(header.expectedObservationNumber)) return null;
  return Object.freeze({ ...header, subject }) as unknown as CompletionBackendRequest;
}

function parseFailure(value: unknown): CompletionBackendFailure | null {
  const record = exactRecord(value, ["category", "code", "retryable", "ambiguous", "retryAfter", "evidenceReference"]);
  if (record === null || typeof record.category !== "string" ||
      !(COMPLETION_FAILURE_CATEGORIES as readonly string[]).includes(record.category) || !text(record.code) ||
      typeof record.retryable !== "boolean" || typeof record.ambiguous !== "boolean" || !timestamp(record.retryAfter, true) ||
      !(record.evidenceReference === null || text(record.evidenceReference))) return null;
  const category = record.category as CompletionFailureCategory;
  const flags = FAILURE_FLAGS[category];
  if (record.retryable !== flags.retryable || record.ambiguous !== flags.ambiguous ||
      (category === "rate_limited" ? record.retryAfter === null : record.retryAfter !== null)) return null;
  return Object.freeze(record) as unknown as CompletionBackendFailure;
}

function sameSubject(left: CompletionGateSubject, right: CompletionGateSubject): boolean {
  return SUBJECT_KEYS.every((key) => left[key as keyof CompletionGateSubject] === right[key as keyof CompletionGateSubject]);
}

export function parseCompletionBackendResult(value: unknown, request: CompletionBackendRequest): CompletionBackendResult | null {
  const envelope = exactRecord(value, ["ok", "receipt"]) ?? exactRecord(value, ["ok", "error"]);
  if (envelope === null || typeof envelope.ok !== "boolean") return null;
  if (!envelope.ok) {
    const error = parseFailure(envelope.error);
    return error === null ? null : Object.freeze({ ok: false as const, error });
  }
  const effectKeys = ["operationId", "intentId", "idempotencyKey"];
  const inspectKeys = ["queryId", "readAuthorizationDecisionId"];
  const record = exactRecord(envelope.receipt, [
    "contractId", "receiptId", "operation", "correlationId", "adapterId", "adapterVersion", "subject",
    "gateOperationId", "observationNumber", "lifecycle", "verdict", "code", "startedAt", "endedAt",
    "validUntil", "evidenceReference", "observedAt", ...(request.operation === "inspect_gate" ? inspectKeys : effectKeys),
  ]);
  if (record === null || record.contractId !== COMPLETION_CONTRACT_ID || record.operation !== request.operation ||
      record.correlationId !== request.correlationId || record.adapterId !== request.adapterId ||
      record.adapterVersion !== request.adapterVersion || !text(record.receiptId) || !text(record.gateOperationId) ||
      !positive(record.observationNumber) || typeof record.lifecycle !== "string" ||
      !(COMPLETION_GATE_LIFECYCLES as readonly string[]).includes(record.lifecycle) || typeof record.verdict !== "string" ||
      !(COMPLETION_GATE_VERDICTS as readonly string[]).includes(record.verdict) || !text(record.code) ||
      !timestamp(record.startedAt, true) || !timestamp(record.endedAt, true) || !timestamp(record.validUntil, true) ||
      !text(record.evidenceReference) || !timestamp(record.observedAt)) return null;
  const subject = parseSubject(record.subject);
  if (subject === null || !sameSubject(subject, request.subject)) return null;
  if (request.operation === "inspect_gate") {
    if (record.queryId !== request.queryId || record.readAuthorizationDecisionId !== request.readAuthorizationDecisionId ||
        record.gateOperationId !== request.gateOperationId || record.observationNumber <= request.lastObservationNumber) return null;
  } else if (record.operationId !== request.operationId || record.intentId !== request.intentId ||
      record.idempotencyKey !== request.idempotencyKey ||
      (request.operation === "run_gate" ? record.gateOperationId !== request.operationId : record.gateOperationId !== request.gateOperationId)) return null;
  const startedAt = record.startedAt as string | null;
  const endedAt = record.endedAt as string | null;
  const validUntil = record.validUntil as string | null;
  const observedAt = record.observedAt as string;
  if (record.lifecycle === "completed") {
    if (startedAt === null || endedAt === null || endedAt < startedAt) return null;
  } else if (record.verdict !== "indeterminate" || validUntil !== null) return null;
  if (record.verdict !== "pass" && validUntil !== null) return null;
  if (validUntil !== null && validUntil <= observedAt) return null;
  return Object.freeze({
    ok: true as const,
    receipt: Object.freeze({ ...record, subject }) as unknown as CompletionBackendReceipt,
  });
}
