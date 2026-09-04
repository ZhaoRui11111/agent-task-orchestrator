export const SCHEDULER_CONTRACT_ID = "ato.scheduler/v1" as const;

export const SCHEDULER_OPERATIONS = Object.freeze([
  "register",
  "inspect",
  "remove",
  "dispatch_trigger",
] as const);

export const SCHEDULER_EXTERNAL_STATES = Object.freeze([
  "present",
  "absent",
  "ambiguous",
] as const);

export const SCHEDULER_RECEIPT_CODES = Object.freeze([
  "registered",
  "already_registered",
  "inspected_present",
  "inspected_absent",
  "removed",
  "already_absent",
  "still_present",
  "refused",
  "ambiguous",
] as const);

export const SCHEDULER_FAILURE_CATEGORIES = Object.freeze([
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

export type SchedulerOperation = Exclude<(typeof SCHEDULER_OPERATIONS)[number], "dispatch_trigger">;
export type SchedulerExternalState = (typeof SCHEDULER_EXTERNAL_STATES)[number];
export type SchedulerReceiptCode = (typeof SCHEDULER_RECEIPT_CODES)[number];
export type SchedulerFailureCategory = (typeof SCHEDULER_FAILURE_CATEGORIES)[number];
export type SchedulerReceiptOutcome = "succeeded" | "refused" | "ambiguous";

export interface SchedulerScope {
  readonly kind: "runtime" | "project";
  readonly projectId: string | null;
  readonly projectResourceRevision: number | null;
  readonly projectConfigRevision: number | null;
}

interface SchedulerRequestBase {
  readonly contractId: typeof SCHEDULER_CONTRACT_ID;
  readonly operationId: string;
  readonly correlationId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly scope: SchedulerScope;
}

export interface SchedulerRegisterRequest extends SchedulerRequestBase {
  readonly operation: "register";
  readonly idempotencyKey: string;
  readonly scheduleExpression: string;
  readonly timeZone: string;
  readonly dispatcherTarget: string;
}

export interface SchedulerInspectRequest extends SchedulerRequestBase {
  readonly operation: "inspect";
  readonly externalRegistrationId: string | null;
}

export interface SchedulerRemoveRequest extends SchedulerRequestBase {
  readonly operation: "remove";
  readonly idempotencyKey: string;
  readonly externalRegistrationId: string;
}

export type SchedulerBackendRequest = SchedulerRegisterRequest | SchedulerInspectRequest | SchedulerRemoveRequest;

export interface SchedulerDispatchTrigger {
  readonly contractId: typeof SCHEDULER_CONTRACT_ID;
  readonly operation: "dispatch_trigger";
  readonly triggerId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly scheduledFor: string;
  readonly observedAt: string;
  readonly claimedDeduplication: string;
}

export interface SchedulerBackendReceipt {
  readonly contractId: typeof SCHEDULER_CONTRACT_ID;
  readonly receiptId: string;
  readonly operation: SchedulerOperation;
  readonly operationId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly externalRegistrationId: string | null;
  readonly externalState: SchedulerExternalState;
  readonly outcome: SchedulerReceiptOutcome;
  readonly code: SchedulerReceiptCode;
  readonly enabled: boolean | null;
  readonly nextTriggerAt: string | null;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export interface SchedulerBackendFailure {
  readonly category: SchedulerFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly retryAfter: string | null;
  readonly evidenceReference: string | null;
}

export type SchedulerBackendResult =
  | Readonly<{ readonly ok: true; readonly receipt: SchedulerBackendReceipt }>
  | Readonly<{ readonly ok: false; readonly error: SchedulerBackendFailure }>;

export interface SchedulerBackend {
  register(request: SchedulerRegisterRequest): unknown;
  inspect(request: SchedulerInspectRequest): unknown;
  remove(request: SchedulerRemoveRequest): unknown;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const FAILURE_FLAGS: Readonly<Record<SchedulerFailureCategory, Readonly<{ retryable: boolean; ambiguous: boolean }>>> = Object.freeze({
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

function boundedText(value: unknown, maximum: number, nullable = false): string | null | undefined {
  if (nullable && value === null) return null;
  if (
    typeof value !== "string" || value.length === 0 || value.length > maximum ||
    value !== value.normalize("NFC") || /[\p{Cc}\p{Cf}]/u.test(value)
  ) return undefined;
  return value;
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function positiveRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const instant = new Date(value);
  return Number.isFinite(instant.valueOf()) && instant.toISOString() === value;
}

function nullableTimestamp(value: unknown): value is string | null {
  return value === null || timestamp(value);
}

function parseScope(value: unknown): SchedulerScope | null {
  const record = exactRecord(value, ["kind", "projectId", "projectResourceRevision", "projectConfigRevision"]);
  if (record === null || (record.kind !== "runtime" && record.kind !== "project")) return null;
  if (record.kind === "runtime") {
    if (record.projectId !== null || record.projectResourceRevision !== null || record.projectConfigRevision !== null) return null;
  } else if (!identifier(record.projectId) || !positiveRevision(record.projectResourceRevision) || !positiveRevision(record.projectConfigRevision)) {
    return null;
  }
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId as string | null,
    projectResourceRevision: record.projectResourceRevision as number | null,
    projectConfigRevision: record.projectConfigRevision as number | null,
  });
}

export function parseSchedulerBackendRequest(value: unknown): SchedulerBackendRequest | null {
  const registerKeys = ["contractId", "operation", "operationId", "idempotencyKey", "correlationId", "scheduleId", "configRevision", "scope", "scheduleExpression", "timeZone", "dispatcherTarget"] as const;
  const inspectKeys = ["contractId", "operation", "operationId", "correlationId", "scheduleId", "configRevision", "scope", "externalRegistrationId"] as const;
  const removeKeys = ["contractId", "operation", "operationId", "idempotencyKey", "correlationId", "scheduleId", "configRevision", "scope", "externalRegistrationId"] as const;
  const record = exactRecord(value, registerKeys) ?? exactRecord(value, inspectKeys) ?? exactRecord(value, removeKeys);
  if (
    record === null || record.contractId !== SCHEDULER_CONTRACT_ID ||
    (record.operation !== "register" && record.operation !== "inspect" && record.operation !== "remove") ||
    !identifier(record.operationId) || !identifier(record.correlationId) ||
    !identifier(record.scheduleId) || !positiveRevision(record.configRevision)
  ) return null;
  const operation = record.operation;
  const scope = parseScope(record.scope);
  if (scope === null) return null;
  if (operation === "register") {
    const scheduleExpression = boundedText(record.scheduleExpression, 256);
    const timeZone = boundedText(record.timeZone, 128);
    if (!identifier(record.idempotencyKey) || typeof scheduleExpression !== "string" || typeof timeZone !== "string" || !identifier(record.dispatcherTarget)) return null;
    return Object.freeze({
      contractId: SCHEDULER_CONTRACT_ID, operation, operationId: record.operationId,
      idempotencyKey: record.idempotencyKey, correlationId: record.correlationId,
      scheduleId: record.scheduleId, configRevision: record.configRevision, scope,
      scheduleExpression, timeZone, dispatcherTarget: record.dispatcherTarget,
    });
  }
  if (operation === "inspect") {
    if (!(record.externalRegistrationId === null || identifier(record.externalRegistrationId))) return null;
    return Object.freeze({
      contractId: SCHEDULER_CONTRACT_ID, operation, operationId: record.operationId,
      correlationId: record.correlationId, scheduleId: record.scheduleId,
      configRevision: record.configRevision, scope, externalRegistrationId: record.externalRegistrationId,
    });
  }
  if (!identifier(record.externalRegistrationId) || !identifier(record.idempotencyKey)) return null;
  return Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID, operation: "remove", operationId: record.operationId,
    idempotencyKey: record.idempotencyKey, correlationId: record.correlationId,
    scheduleId: record.scheduleId, configRevision: record.configRevision, scope,
    externalRegistrationId: record.externalRegistrationId,
  });
}

export function parseSchedulerDispatchTrigger(value: unknown): SchedulerDispatchTrigger | null {
  const record = exactRecord(value, [
    "contractId", "operation", "triggerId", "scheduleId", "configRevision",
    "scheduledFor", "observedAt", "claimedDeduplication",
  ]);
  if (
    record === null || record.contractId !== SCHEDULER_CONTRACT_ID || record.operation !== "dispatch_trigger" ||
    !identifier(record.triggerId) || !identifier(record.scheduleId) || !positiveRevision(record.configRevision) ||
    !timestamp(record.scheduledFor) || !timestamp(record.observedAt) || !identifier(record.claimedDeduplication)
  ) return null;
  return Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    operation: "dispatch_trigger",
    triggerId: record.triggerId,
    scheduleId: record.scheduleId,
    configRevision: record.configRevision,
    scheduledFor: record.scheduledFor,
    observedAt: record.observedAt,
    claimedDeduplication: record.claimedDeduplication,
  });
}

function parseFailure(value: unknown): SchedulerBackendFailure | null {
  const record = exactRecord(value, ["category", "code", "retryable", "ambiguous", "retryAfter", "evidenceReference"]);
  if (
    record === null || typeof record.category !== "string" ||
    !(SCHEDULER_FAILURE_CATEGORIES as readonly string[]).includes(record.category) ||
    !identifier(record.code) || typeof record.retryable !== "boolean" || typeof record.ambiguous !== "boolean" ||
    !nullableTimestamp(record.retryAfter) || boundedText(record.evidenceReference, 128, true) === undefined
  ) return null;
  const category = record.category as SchedulerFailureCategory;
  const flags = FAILURE_FLAGS[category];
  if (record.retryable !== flags.retryable || record.ambiguous !== flags.ambiguous) return null;
  return Object.freeze({
    category, code: record.code, retryable: record.retryable, ambiguous: record.ambiguous,
    retryAfter: record.retryAfter, evidenceReference: record.evidenceReference as string | null,
  });
}

export function schedulerReceiptSemanticsAreValid(
  receipt: Pick<
    SchedulerBackendReceipt,
    "operation" | "externalRegistrationId" | "externalState" | "outcome" | "code" | "enabled" | "nextTriggerAt"
  >,
): boolean {
  if (receipt.operation === "register") {
    if (receipt.code === "registered" || receipt.code === "already_registered") {
      return receipt.outcome === "succeeded" && receipt.externalState === "present" &&
        receipt.externalRegistrationId !== null && receipt.enabled === true;
    }
    if (receipt.code === "refused") {
      return receipt.outcome === "refused" && receipt.externalState === "absent" &&
        receipt.externalRegistrationId === null && receipt.enabled === null && receipt.nextTriggerAt === null;
    }
    return receipt.code === "ambiguous" && receipt.outcome === "ambiguous" &&
      receipt.externalState === "ambiguous";
  }
  if (receipt.operation === "inspect") {
    if (receipt.code === "inspected_present") {
      return receipt.outcome === "succeeded" && receipt.externalState === "present" &&
        receipt.externalRegistrationId !== null && receipt.enabled !== null;
    }
    if (receipt.code === "inspected_absent") {
      return receipt.outcome === "succeeded" && receipt.externalState === "absent" &&
        receipt.externalRegistrationId === null && receipt.enabled === null && receipt.nextTriggerAt === null;
    }
    return receipt.code === "ambiguous" && receipt.outcome === "ambiguous" &&
      receipt.externalState === "ambiguous";
  }
  if (receipt.code === "removed" || receipt.code === "already_absent") {
    return receipt.outcome === "succeeded" && receipt.externalState === "absent" &&
      receipt.externalRegistrationId === null && receipt.enabled === null && receipt.nextTriggerAt === null;
  }
  if (receipt.code === "still_present") {
    return receipt.outcome === "refused" && receipt.externalState === "present" &&
      receipt.externalRegistrationId !== null && receipt.enabled !== null;
  }
  if (receipt.code === "refused") {
    return receipt.outcome === "refused" && receipt.externalState === "present" &&
      receipt.externalRegistrationId !== null && receipt.enabled !== null;
  }
  return receipt.code === "ambiguous" && receipt.outcome === "ambiguous" &&
    receipt.externalState === "ambiguous";
}

export function parseSchedulerBackendResult(value: unknown, request: SchedulerBackendRequest): SchedulerBackendResult | null {
  const parsedRequest = parseSchedulerBackendRequest(request);
  if (parsedRequest === null) return null;
  const successEnvelope = exactRecord(value, ["ok", "receipt"]);
  const failureEnvelope = successEnvelope === null ? exactRecord(value, ["ok", "error"]) : null;
  if (successEnvelope === null) {
    if (failureEnvelope === null || failureEnvelope.ok !== false) return null;
    const envelope = failureEnvelope;
    const error = parseFailure(envelope.error);
    return error === null ? null : Object.freeze({ ok: false as const, error });
  }
  if (successEnvelope.ok !== true) return null;
  const envelope = successEnvelope;
  const record = exactRecord(envelope.receipt, [
    "contractId", "receiptId", "operation", "operationId", "scheduleId", "configRevision",
    "externalRegistrationId", "externalState", "outcome", "code", "enabled", "nextTriggerAt",
    "evidenceReference", "observedAt",
  ]);
  if (
    record === null || record.contractId !== SCHEDULER_CONTRACT_ID || !identifier(record.receiptId) ||
    record.operation !== parsedRequest.operation || record.operationId !== parsedRequest.operationId ||
    record.scheduleId !== parsedRequest.scheduleId || record.configRevision !== parsedRequest.configRevision ||
    !(record.externalRegistrationId === null || identifier(record.externalRegistrationId)) ||
    typeof record.externalState !== "string" || !(SCHEDULER_EXTERNAL_STATES as readonly string[]).includes(record.externalState) ||
    (record.outcome !== "succeeded" && record.outcome !== "refused" && record.outcome !== "ambiguous") ||
    typeof record.code !== "string" || !(SCHEDULER_RECEIPT_CODES as readonly string[]).includes(record.code) ||
    !(record.enabled === null || typeof record.enabled === "boolean") || !nullableTimestamp(record.nextTriggerAt) ||
    boundedText(record.evidenceReference, 128, true) === undefined || !timestamp(record.observedAt)
  ) return null;
  const receipt: SchedulerBackendReceipt = Object.freeze({
    contractId: SCHEDULER_CONTRACT_ID,
    receiptId: record.receiptId,
    operation: record.operation as SchedulerOperation,
    operationId: record.operationId,
    scheduleId: record.scheduleId,
    configRevision: record.configRevision,
    externalRegistrationId: record.externalRegistrationId as string | null,
    externalState: record.externalState as SchedulerExternalState,
    outcome: record.outcome,
    code: record.code as SchedulerReceiptCode,
    enabled: record.enabled,
    nextTriggerAt: record.nextTriggerAt,
    evidenceReference: record.evidenceReference as string | null,
    observedAt: record.observedAt,
  });
  if (!schedulerReceiptSemanticsAreValid(receipt)) return null;
  if (
    (parsedRequest.operation === "inspect" || parsedRequest.operation === "remove") &&
    parsedRequest.externalRegistrationId !== null && receipt.externalRegistrationId !== null &&
    receipt.externalRegistrationId !== parsedRequest.externalRegistrationId
  ) return null;
  return Object.freeze({ ok: true as const, receipt });
}

function integrityFailure(code: string): SchedulerBackendResult {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      category: "integrity_failure" as const,
      code,
      retryable: false,
      ambiguous: true,
      retryAfter: null,
      evidenceReference: null,
    }),
  });
}

export function invokeSchedulerBackend(backend: SchedulerBackend, value: unknown): SchedulerBackendResult {
  const request = parseSchedulerBackendRequest(value);
  if (request === null) return integrityFailure("invalid_request_shape");
  let raw: unknown;
  try {
    raw = request.operation === "register"
      ? backend.register(request)
      : request.operation === "inspect"
        ? backend.inspect(request)
        : backend.remove(request);
  } catch {
    return Object.freeze({
      ok: false as const,
      error: Object.freeze({
        category: "ambiguous_external_state" as const,
        code: "adapter_threw",
        retryable: false,
        ambiguous: true,
        retryAfter: null,
        evidenceReference: null,
      }),
    });
  }
  try {
    return parseSchedulerBackendResult(raw, request) ?? integrityFailure("invalid_result_shape");
  } catch {
    return integrityFailure("invalid_result_shape");
  }
}
