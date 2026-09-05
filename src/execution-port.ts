export const EXECUTION_CONTRACT_ID = "ato.execution/v2" as const;
export const MANUAL_EXECUTION_ENDPOINT_VERSION = "local-manual/v2" as const;
export const CODEX_EXECUTION_ENDPOINT_VERSION = "openai-codex-sdk/v1" as const;

export type ExecutionBackendKind = "manual-local" | "codex-sdk";
export type ExecutionEndpointVersion =
  | typeof MANUAL_EXECUTION_ENDPOINT_VERSION
  | typeof CODEX_EXECUTION_ENDPOINT_VERSION;

export const EXECUTION_ADAPTER_ERROR_CATEGORIES = Object.freeze([
  "invalid_request",
  "incompatible_contract",
  "unauthorized",
  "policy_denied",
  "not_found",
  "conflict",
  "stale_revision",
  "busy",
  "rate_limited",
  "resource_exhausted",
  "transient_external",
  "permanent_external",
  "ambiguous_external_state",
  "cancelled",
  "integrity_failure",
] as const);

export type ExecutionAdapterErrorCategory = (typeof EXECUTION_ADAPTER_ERROR_CATEGORIES)[number];
export type ExecutionAction = "execution.start" | "execution.resume" | "execution.retry" | "execution.cancel";
export type ExecutionLifecycle = "unknown" | "queued" | "active" | "waiting" | "turn_succeeded" | "failed" | "cancelled";

interface ExecutionSemanticCommon {
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly inputReference: string;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly policyBindingReference: string;
}

export type ExecutionSemanticIdentity = Readonly<ExecutionSemanticCommon & (
  | {
    readonly backendKind: "manual-local";
    readonly workspaceMode: "none";
  }
  | {
    readonly backendKind: "codex-sdk";
    readonly workspaceMode: "owned";
    readonly workspaceContractId: "ato.workspace/v2";
    readonly workspaceId: string;
    readonly workspaceGeneration: number;
    readonly workspaceRevision: number;
    readonly workspaceRootKey: string;
    readonly ownershipBindingSha256: string;
    readonly workspaceHeadObjectId: string;
  }
)>;

interface ExecutionCallBase {
  readonly contractId: typeof EXECUTION_CONTRACT_ID;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly correlationId: string;
  readonly requestedDeadline: string;
  readonly semantic: ExecutionSemanticIdentity;
}

interface ExecutionMutationBase extends ExecutionCallBase {
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly authorizationDecisionId: string;
  readonly action: ExecutionAction;
}

export interface ExecutionStartRequest extends ExecutionMutationBase {
  readonly operation: "start";
  readonly action: "execution.start";
  readonly input: string | null;
}

export interface ExecutionResumeRequest extends ExecutionMutationBase {
  readonly operation: "resume";
  readonly action: "execution.resume" | "execution.retry";
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly continuationReference: string;
  readonly previousTurnReceiptId: string;
  readonly expectedThreadId: string;
  readonly input: string | null;
}

export interface ExecutionInspectRequest extends ExecutionCallBase {
  readonly operation: "inspect";
  readonly queryId: string;
  readonly actorId: string;
  readonly authorizationDecisionId: string;
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly lastObservationNumber: number;
}

export interface ExecutionCancelRequest extends ExecutionMutationBase {
  readonly operation: "request_cancel";
  readonly action: "execution.cancel";
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly expectedLifecycle: Exclude<ExecutionLifecycle, "unknown">;
  readonly reasonCode: string;
}

export type ExecutionPortRequest =
  | ExecutionStartRequest
  | ExecutionResumeRequest
  | ExecutionInspectRequest
  | ExecutionCancelRequest;

interface ExecutionReceiptBase {
  readonly receiptId: string;
  readonly contractId: typeof EXECUTION_CONTRACT_ID;
  readonly correlationId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly backendKind: ExecutionBackendKind;
  readonly observedEndpointVersion: ExecutionEndpointVersion;
  readonly observedExecutionId: string;
  readonly outcome: "succeeded" | "deferred" | "rejected";
  readonly code: string;
  readonly observedAt: string;
  readonly validUntil: string | null;
  readonly evidenceReference: string | null;
  readonly integritySha256: string;
  readonly observationNumber: number;
}

interface ExecutionMutationReceiptBase extends ExecutionReceiptBase {
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly observedPreRevision: number | null;
  readonly observedPostRevision: number;
}

export interface ExecutionStartReceipt extends ExecutionMutationReceiptBase {
  readonly operation: "start" | "resume";
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly lifecycle: "started" | "deferred" | "rejected";
  readonly workspaceMode: "none" | "owned";
}

export interface ExecutionInspectReceipt extends ExecutionReceiptBase {
  readonly operation: "inspect";
  readonly queryId: string;
  readonly authorizationDecisionId: string;
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly lifecycle: ExecutionLifecycle;
  readonly resultReference: string | null;
}

export interface ExecutionCancelReceipt extends ExecutionMutationReceiptBase {
  readonly operation: "request_cancel";
  readonly backendExecutionId: string;
  readonly threadId: string | null;
  readonly lifecycle: "requested" | "already_terminal" | "rejected";
}

export type ExecutionPortReceipt = ExecutionStartReceipt | ExecutionInspectReceipt | ExecutionCancelReceipt;

export interface ExecutionAdapterError {
  readonly code: string;
  readonly category: ExecutionAdapterErrorCategory;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly message: string;
  readonly correlationId: string;
  readonly externalReference: string | null;
  readonly retryAfter: string | null;
}

export type ExecutionPortResult<T extends ExecutionPortReceipt = ExecutionPortReceipt> =
  | Readonly<{ ok: true; receipt: T }>
  | Readonly<{ ok: false; error: ExecutionAdapterError }>;

export interface ExecutionBackend {
  readonly contractId: typeof EXECUTION_CONTRACT_ID;
  readonly backendKind: ExecutionBackendKind;
  readonly adapterId: string;
  readonly adapterVersion: string;
  start(request: ExecutionStartRequest): ExecutionPortResult<ExecutionStartReceipt> | Promise<ExecutionPortResult<ExecutionStartReceipt>>;
  resume(request: ExecutionResumeRequest): ExecutionPortResult<ExecutionStartReceipt> | Promise<ExecutionPortResult<ExecutionStartReceipt>>;
  inspect(request: ExecutionInspectRequest): ExecutionPortResult<ExecutionInspectReceipt> | Promise<ExecutionPortResult<ExecutionInspectReceipt>>;
  requestCancel(request: ExecutionCancelRequest): ExecutionPortResult<ExecutionCancelReceipt> | Promise<ExecutionPortResult<ExecutionCancelReceipt>>;
}

export const MANUAL_OUTCOME_CONTROL_ID = "ato.manual-outcome-control/v1" as const;
export type ManualOutcomeOperation = "activate" | "wait" | "succeed" | "fail" | "confirm_cancelled";

export interface ManualOutcomeReportRequest {
  readonly contractId: typeof MANUAL_OUTCOME_CONTROL_ID;
  readonly reportId: string;
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly authorizationDecisionId: string;
  readonly confirmationId: string;
  readonly correlationId: string;
  readonly semantic: ExecutionSemanticIdentity;
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly expectedJournalRevision: number;
  readonly expectedLifecycle: Exclude<ExecutionLifecycle, "unknown">;
  readonly operation: ManualOutcomeOperation;
  readonly code: string;
  readonly evidenceReference: string | null;
}

export interface ManualOutcomeReportReceipt {
  readonly contractId: typeof MANUAL_OUTCOME_CONTROL_ID;
  readonly receiptId: string;
  readonly reportId: string;
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly backendExecutionId: string;
  readonly threadId: string;
  readonly observedPreRevision: number;
  readonly observedPostRevision: number;
  readonly lifecycle: Exclude<ExecutionLifecycle, "unknown">;
  readonly code: string;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export type ManualOutcomeControlResult =
  | Readonly<{ ok: true; receipt: ManualOutcomeReportReceipt }>
  | Readonly<{ ok: false; error: ExecutionAdapterError }>;

export interface ManualOutcomeControl {
  readonly outcomeContractId: typeof MANUAL_OUTCOME_CONTROL_ID;
  recordOutcome(request: ManualOutcomeReportRequest): ManualOutcomeControlResult;
}

export function parseManualOutcomeReportReceipt(value: unknown): ManualOutcomeReportReceipt | null {
  const record = exactRecord(value, [
    "backendExecutionId", "code", "contractId", "correlationId", "evidenceReference",
    "idempotencyKey", "intentId", "lifecycle", "observedAt", "observedPostRevision",
    "observedPreRevision", "operationId", "receiptId", "reportId", "threadId",
  ]);
  if (
    record === null || record.contractId !== MANUAL_OUTCOME_CONTROL_ID || !operationalIdentifier(record.receiptId) ||
    !operationalIdentifier(record.reportId) || !operationalIdentifier(record.operationId) || !operationalIdentifier(record.intentId) ||
    !operationalIdentifier(record.idempotencyKey) || !operationalIdentifier(record.correlationId) ||
    !operationalIdentifier(record.backendExecutionId) || !operationalIdentifier(record.threadId) ||
    !positive(record.observedPreRevision) || !positive(record.observedPostRevision) ||
    record.observedPostRevision < record.observedPreRevision ||
    !["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"].includes(record.lifecycle as string) ||
    !operationalIdentifier(record.code, 64) ||
    (record.evidenceReference !== null && !operationalIdentifier(record.evidenceReference)) ||
    !timestamp(record.observedAt)
  ) return null;
  return Object.freeze(record as unknown as ManualOutcomeReportReceipt);
}

export function validateManualOutcomeControlResult(value: unknown): ManualOutcomeControlResult | null {
  const ok = ownDataValue(value, "ok");
  if (ok === true) {
    const record = exactRecord(value, ["ok", "receipt"]);
    const receipt = record === null ? null : parseManualOutcomeReportReceipt(record.receipt);
    return receipt === null ? null : Object.freeze({ ok: true as const, receipt });
  }
  if (ok === false) {
    const record = exactRecord(value, ["error", "ok"]);
    const error = record === null ? null : parseExecutionAdapterError(record.error);
    return error === null ? null : Object.freeze({ ok: false as const, error });
  }
  return null;
}

export function parseManualOutcomeReport(value: unknown): ManualOutcomeReportRequest | null {
  const record = exactRecord(value, [
    "actorId", "authorizationDecisionId", "backendExecutionId", "code", "confirmationId",
    "contractId", "correlationId", "evidenceReference", "expectedJournalRevision",
    "expectedLifecycle", "idempotencyKey", "intentId", "operation", "operationId",
    "reportId", "semantic", "threadId",
  ]);
  if (
    record === null || record.contractId !== MANUAL_OUTCOME_CONTROL_ID ||
    !operationalIdentifier(record.reportId) || !operationalIdentifier(record.operationId) ||
    !operationalIdentifier(record.intentId) || !operationalIdentifier(record.idempotencyKey) ||
    !operationalIdentifier(record.actorId) || !operationalIdentifier(record.authorizationDecisionId) ||
    !operationalIdentifier(record.confirmationId) || !operationalIdentifier(record.correlationId) ||
    parseSemantic(record.semantic) === null || !operationalIdentifier(record.backendExecutionId) ||
    !operationalIdentifier(record.threadId) ||
    !positive(record.expectedJournalRevision) ||
    !["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"].includes(record.expectedLifecycle as string) ||
    !["activate", "wait", "succeed", "fail", "confirm_cancelled"].includes(record.operation as string) ||
    !operationalIdentifier(record.code, 64) ||
    (record.evidenceReference !== null && !operationalIdentifier(record.evidenceReference))
  ) return null;
  return Object.freeze({ ...record, semantic: parseSemantic(record.semantic) }) as unknown as ManualOutcomeReportRequest;
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

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : null;
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

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
}

function sha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function taskInputReference(value: unknown): value is string {
  return typeof value === "string" &&
    /^(?:task-sha256:[0-9a-f]{64}|codex-task-binding:[0-9A-F]{64})$/u.test(value);
}

function effectInput(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    new TextEncoder().encode(value).byteLength <= 1_048_576;
}

function parseSemantic(value: unknown): ExecutionSemanticIdentity | null {
  const workspaceMode = ownDataValue(value, "workspaceMode");
  const commonKeys = [
    "attemptNumber", "executionId", "executionRevision", "fencingToken", "inputReference",
    "backendKind", "policyBindingReference", "projectConfigRevision", "projectId", "projectResourceRevision",
    "taskId", "taskRevision", "workspaceMode",
  ] as const;
  const record = workspaceMode === "owned"
    ? exactRecord(value, [
      ...commonKeys, "ownershipBindingSha256", "workspaceContractId", "workspaceGeneration",
      "workspaceHeadObjectId", "workspaceId", "workspaceRevision", "workspaceRootKey",
    ])
    : exactRecord(value, commonKeys);
  if (
    record === null || !bounded(record.projectId) || !positive(record.projectResourceRevision) ||
    !positive(record.projectConfigRevision) || !bounded(record.taskId) || !positive(record.taskRevision) ||
    !operationalIdentifier(record.inputReference) || !operationalIdentifier(record.executionId) ||
    !positive(record.executionRevision) ||
    !positive(record.attemptNumber) || !positive(record.fencingToken) ||
    !operationalIdentifier(record.policyBindingReference)
  ) return null;
  if (record.workspaceMode === "none") {
    return record.backendKind === "manual-local"
      ? Object.freeze(record as unknown as ExecutionSemanticIdentity)
      : null;
  }
  if (
    record.workspaceMode !== "owned" || record.backendKind !== "codex-sdk" ||
    record.workspaceContractId !== "ato.workspace/v2" || !taskInputReference(record.inputReference) ||
    !operationalIdentifier(record.workspaceId) || !positive(record.workspaceGeneration) ||
    !positive(record.workspaceRevision) || !operationalIdentifier(record.workspaceRootKey) ||
    !sha256(record.ownershipBindingSha256) || !sha1(record.workspaceHeadObjectId)
  ) return null;
  return Object.freeze(record as unknown as ExecutionSemanticIdentity);
}

const CALL_KEYS = ["adapterId", "adapterVersion", "contractId", "correlationId", "requestedDeadline", "semantic"] as const;
const MUTATION_KEYS = ["action", "actorId", "authorizationDecisionId", "idempotencyKey", "intentId", "operationId"] as const;

function validCall(record: Readonly<UnknownRecord>): record is Readonly<UnknownRecord> & ExecutionCallBase {
  return record.contractId === EXECUTION_CONTRACT_ID && operationalIdentifier(record.adapterId) &&
    operationalIdentifier(record.adapterVersion) && operationalIdentifier(record.correlationId) &&
    timestamp(record.requestedDeadline) && parseSemantic(record.semantic) !== null;
}

function validMutation(record: Readonly<UnknownRecord>): record is Readonly<UnknownRecord> & ExecutionMutationBase {
  return validCall(record) && operationalIdentifier(record.operationId) && operationalIdentifier(record.intentId) &&
    operationalIdentifier(record.idempotencyKey) && operationalIdentifier(record.actorId) &&
    operationalIdentifier(record.authorizationDecisionId);
}

export function parseExecutionRequest(value: unknown): ExecutionPortRequest | null {
  const operation = ownDataValue(value, "operation");
  if (operation === "start") {
    const record = exactRecord(value, [...CALL_KEYS, ...MUTATION_KEYS, "input", "operation"]);
    const semantic = record === null ? null : parseSemantic(record.semantic);
    return record !== null && semantic !== null && validMutation(record) && record.action === "execution.start" &&
      (semantic.backendKind === "manual-local" ? record.input === null : effectInput(record.input))
      ? Object.freeze({ ...record, semantic: parseSemantic(record.semantic) }) as unknown as ExecutionStartRequest
      : null;
  }
  if (operation === "resume") {
    const record = exactRecord(value, [
      ...CALL_KEYS, ...MUTATION_KEYS, "backendExecutionId", "continuationReference", "expectedThreadId", "input",
      "operation", "previousTurnReceiptId", "threadId",
    ]);
    const semantic = record === null ? null : parseSemantic(record.semantic);
    return record !== null && semantic !== null && validMutation(record) &&
      (record.action === "execution.resume" || record.action === "execution.retry") &&
      operationalIdentifier(record.backendExecutionId) && operationalIdentifier(record.threadId) &&
      operationalIdentifier(record.continuationReference) && operationalIdentifier(record.previousTurnReceiptId) &&
      record.expectedThreadId === record.threadId &&
      (semantic.backendKind === "manual-local" ? record.input === null : effectInput(record.input))
      ? Object.freeze({ ...record, semantic: parseSemantic(record.semantic) }) as unknown as ExecutionResumeRequest
      : null;
  }
  if (operation === "inspect") {
    const record = exactRecord(value, [
      ...CALL_KEYS, "actorId", "authorizationDecisionId", "backendExecutionId", "lastObservationNumber",
      "operation", "queryId", "threadId",
    ]);
    return record !== null && validCall(record) && operationalIdentifier(record.queryId) &&
      operationalIdentifier(record.actorId) && operationalIdentifier(record.authorizationDecisionId) &&
      operationalIdentifier(record.backendExecutionId) &&
      (record.threadId === null || operationalIdentifier(record.threadId)) && nonnegative(record.lastObservationNumber)
      ? Object.freeze({ ...record, semantic: parseSemantic(record.semantic) }) as unknown as ExecutionInspectRequest
      : null;
  }
  if (operation === "request_cancel") {
    const record = exactRecord(value, [
      ...CALL_KEYS, ...MUTATION_KEYS, "backendExecutionId", "expectedLifecycle", "operation", "reasonCode", "threadId",
    ]);
    return record !== null && validMutation(record) && record.action === "execution.cancel" &&
      operationalIdentifier(record.backendExecutionId) &&
      (record.threadId === null || operationalIdentifier(record.threadId)) &&
      ["queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"].includes(record.expectedLifecycle as string) &&
      operationalIdentifier(record.reasonCode, 64)
      ? Object.freeze({ ...record, semantic: parseSemantic(record.semantic) }) as unknown as ExecutionCancelRequest
      : null;
  }
  return null;
}

const ERROR_FLAGS: Readonly<Record<ExecutionAdapterErrorCategory, readonly [boolean, boolean]>> = Object.freeze({
  invalid_request: [false, false], incompatible_contract: [false, false], unauthorized: [false, false],
  policy_denied: [false, false], not_found: [false, false], conflict: [false, false], stale_revision: [false, false],
  busy: [true, false], rate_limited: [true, false], resource_exhausted: [true, false],
  transient_external: [true, false], permanent_external: [false, false],
  ambiguous_external_state: [false, true], cancelled: [false, false], integrity_failure: [false, true],
});

export function parseExecutionAdapterError(value: unknown): ExecutionAdapterError | null {
  const record = exactRecord(value, [
    "ambiguous", "category", "code", "correlationId", "externalReference", "message", "retryAfter", "retryable",
  ]);
  if (record === null || !operationalIdentifier(record.code, 64) || !bounded(record.message, 256) ||
    !operationalIdentifier(record.correlationId)) return null;
  if (!(EXECUTION_ADAPTER_ERROR_CATEGORIES as readonly unknown[]).includes(record.category)) return null;
  const category = record.category as ExecutionAdapterErrorCategory;
  const flags = ERROR_FLAGS[category];
  if (record.retryable !== flags[0] || record.ambiguous !== flags[1]) return null;
  if (record.externalReference !== null && !operationalIdentifier(record.externalReference)) return null;
  if (record.retryAfter !== null && !timestamp(record.retryAfter)) return null;
  return Object.freeze(record as unknown as ExecutionAdapterError);
}

function validReceiptBase(record: Readonly<UnknownRecord>): boolean {
  return operationalIdentifier(record.receiptId) && record.contractId === EXECUTION_CONTRACT_ID &&
    operationalIdentifier(record.correlationId) && operationalIdentifier(record.adapterId) &&
    operationalIdentifier(record.adapterVersion) &&
    ((record.backendKind === "manual-local" && record.observedEndpointVersion === MANUAL_EXECUTION_ENDPOINT_VERSION) ||
      (record.backendKind === "codex-sdk" && record.observedEndpointVersion === CODEX_EXECUTION_ENDPOINT_VERSION)) &&
    operationalIdentifier(record.observedExecutionId) && ["succeeded", "deferred", "rejected"].includes(record.outcome as string) &&
    operationalIdentifier(record.code, 64) && timestamp(record.observedAt) &&
    (record.validUntil === null || timestamp(record.validUntil)) &&
    (record.evidenceReference === null || operationalIdentifier(record.evidenceReference)) && sha256(record.integritySha256) &&
    positive(record.observationNumber);
}

const RECEIPT_BASE_KEYS = [
  "adapterId", "adapterVersion", "backendKind", "code", "contractId", "correlationId", "evidenceReference", "integritySha256",
  "observationNumber", "observedAt", "observedEndpointVersion", "observedExecutionId", "outcome", "receiptId", "validUntil",
] as const;
const MUTATION_RECEIPT_KEYS = [
  "idempotencyKey", "intentId", "observedPostRevision", "observedPreRevision", "operationId",
] as const;

export function parseExecutionReceipt(value: unknown): ExecutionPortReceipt | null {
  const operation = ownDataValue(value, "operation");
  if (operation === "start" || operation === "resume") {
    const record = exactRecord(value, [
      ...RECEIPT_BASE_KEYS, ...MUTATION_RECEIPT_KEYS, "backendExecutionId", "lifecycle", "operation", "threadId", "workspaceMode",
    ]);
    return record !== null && validReceiptBase(record) && operationalIdentifier(record.operationId) &&
      operationalIdentifier(record.intentId) && operationalIdentifier(record.idempotencyKey) &&
      (record.observedPreRevision === null || positive(record.observedPreRevision)) &&
      positive(record.observedPostRevision) && operationalIdentifier(record.backendExecutionId) &&
      (record.threadId === null || operationalIdentifier(record.threadId)) &&
      ["started", "deferred", "rejected"].includes(record.lifecycle as string) &&
      ((record.backendKind === "manual-local" && record.workspaceMode === "none") ||
        (record.backendKind === "codex-sdk" && record.workspaceMode === "owned"))
      ? Object.freeze(record as unknown as ExecutionStartReceipt) : null;
  }
  if (operation === "inspect") {
    const record = exactRecord(value, [
      ...RECEIPT_BASE_KEYS, "authorizationDecisionId", "backendExecutionId", "lifecycle", "operation", "queryId", "resultReference", "threadId",
    ]);
    return record !== null && validReceiptBase(record) && operationalIdentifier(record.queryId) &&
      operationalIdentifier(record.authorizationDecisionId) && operationalIdentifier(record.backendExecutionId) &&
      (record.threadId === null || operationalIdentifier(record.threadId)) &&
      ["unknown", "queued", "active", "waiting", "turn_succeeded", "failed", "cancelled"].includes(record.lifecycle as string) &&
      (record.resultReference === null || operationalIdentifier(record.resultReference))
      ? Object.freeze(record as unknown as ExecutionInspectReceipt) : null;
  }
  if (operation === "request_cancel") {
    const record = exactRecord(value, [
      ...RECEIPT_BASE_KEYS, ...MUTATION_RECEIPT_KEYS, "backendExecutionId", "lifecycle", "operation", "threadId",
    ]);
    return record !== null && validReceiptBase(record) && operationalIdentifier(record.operationId) &&
      operationalIdentifier(record.intentId) && operationalIdentifier(record.idempotencyKey) &&
      (record.observedPreRevision === null || positive(record.observedPreRevision)) &&
      positive(record.observedPostRevision) && operationalIdentifier(record.backendExecutionId) &&
      (record.threadId === null || operationalIdentifier(record.threadId)) &&
      ["requested", "already_terminal", "rejected"].includes(record.lifecycle as string)
      ? Object.freeze(record as unknown as ExecutionCancelReceipt) : null;
  }
  return null;
}

export function validateExecutionPortResult(value: unknown): ExecutionPortResult | null {
  const ok = ownDataValue(value, "ok");
  if (ok === true) {
    const record = exactRecord(value, ["ok", "receipt"]);
    const receipt = record === null ? null : parseExecutionReceipt(record.receipt);
    return receipt === null ? null : Object.freeze({ ok: true as const, receipt });
  }
  if (ok === false) {
    const record = exactRecord(value, ["error", "ok"]);
    const error = record === null ? null : parseExecutionAdapterError(record.error);
    return error === null ? null : Object.freeze({ ok: false as const, error });
  }
  return null;
}
