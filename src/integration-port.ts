export const INTEGRATION_CONTRACT_ID = "ato.integration/v1" as const;

export const INTEGRATION_OPERATIONS = Object.freeze(["inspect", "apply", "push"] as const);
export const INTEGRATION_RESERVATION_STATUSES = Object.freeze(["active", "ambiguous", "released", "expired"] as const);
export const INTEGRATION_LOCAL_STATES = Object.freeze([
  "unchanged", "fast_forwarded", "already_at_source", "foreign", "unknown",
] as const);
export const INTEGRATION_REMOTE_STATES = Object.freeze([
  "not_requested", "absent", "unchanged", "pushed", "already_at_source", "rejected", "foreign", "unknown",
] as const);
export const INTEGRATION_RECEIPT_OUTCOMES = Object.freeze(["succeeded", "refused", "ambiguous"] as const);
export const INTEGRATION_RECEIPT_CODES = Object.freeze([
  "inspected_unchanged",
  "inspected_local_applied",
  "inspected_pushed",
  "inspected_foreign",
  "inspected_ambiguous",
  "applied",
  "already_applied",
  "apply_refused",
  "apply_ambiguous",
  "pushed",
  "already_pushed",
  "push_rejected",
  "push_ambiguous",
] as const);
export const INTEGRATION_FAILURE_CATEGORIES = Object.freeze([
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

export type IntegrationOperation = (typeof INTEGRATION_OPERATIONS)[number];
export type IntegrationReservationStatus = (typeof INTEGRATION_RESERVATION_STATUSES)[number];
export type IntegrationLocalState = (typeof INTEGRATION_LOCAL_STATES)[number];
export type IntegrationRemoteState = (typeof INTEGRATION_REMOTE_STATES)[number];
export type IntegrationReceiptOutcome = (typeof INTEGRATION_RECEIPT_OUTCOMES)[number];
export type IntegrationReceiptCode = (typeof INTEGRATION_RECEIPT_CODES)[number];
export type IntegrationFailureCategory = (typeof INTEGRATION_FAILURE_CATEGORIES)[number];

export interface IntegrationSubject {
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly repositoryIdentity: string;
  readonly objectFormat: "sha1";
  readonly targetReference: string;
  readonly expectedTargetObjectId: string;
  readonly sourceWorkspaceId: string;
  readonly sourceGeneration: number;
  readonly sourceWorkspaceRevision: number;
  readonly sourceWorkspaceRootKey: string;
  readonly sourceOwnershipBindingSha256: string;
  readonly sourceHeadObjectId: string;
  readonly reservationId: string;
  readonly reservationRevision: number;
  readonly reservationStatus: IntegrationReservationStatus;
  readonly reservationOwnerExecutionId: string;
  readonly reservationOwnerOperationId: string;
  readonly reservationLeaseOwnerId: string;
  readonly reservationLeaseRevision: number;
  readonly reservationFencingToken: number;
  readonly reservationExpiresAt: string;
  readonly policyReceiptId: string;
  readonly policyConfigRevision: number;
  readonly destinationIdentity: string;
  readonly destinationReference: string;
  readonly expectedRemoteHead: string | null;
}

interface IntegrationRequestBase {
  readonly contractId: typeof INTEGRATION_CONTRACT_ID;
  readonly operation: IntegrationOperation;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly actorId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly subject: IntegrationSubject;
}

export type InspectIntegrationRequest = IntegrationRequestBase & Readonly<{
  readonly operation: "inspect";
  readonly queryId: string;
  readonly readAuthorizationDecisionId: string;
  readonly lastObservationNumber: number;
}>;

interface IntegrationEffectRequest extends IntegrationRequestBase {
  readonly operation: "apply" | "push";
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly finalAuthorizationDecisionId: string;
  readonly expectedObservationNumber: number;
}

export type ApplyIntegrationRequest = IntegrationEffectRequest & Readonly<{ readonly operation: "apply" }>;
export type PushIntegrationRequest = IntegrationEffectRequest & Readonly<{ readonly operation: "push" }>;
export type IntegrationBackendRequest = InspectIntegrationRequest | ApplyIntegrationRequest | PushIntegrationRequest;

interface IntegrationReceiptBase {
  readonly contractId: typeof INTEGRATION_CONTRACT_ID;
  readonly receiptId: string;
  readonly operation: IntegrationOperation;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly actorId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly subject: IntegrationSubject;
  readonly observationNumber: number;
  readonly localBeforeObjectId: string | null;
  readonly localAfterObjectId: string | null;
  readonly remoteBeforeObjectId: string | null;
  readonly remoteAfterObjectId: string | null;
  readonly localState: IntegrationLocalState;
  readonly remoteState: IntegrationRemoteState;
  readonly outcome: IntegrationReceiptOutcome;
  readonly code: IntegrationReceiptCode;
  readonly evidenceReference: string;
  readonly observedAt: string;
}

export type InspectIntegrationReceipt = IntegrationReceiptBase & Readonly<{
  readonly operation: "inspect";
  readonly queryId: string;
  readonly readAuthorizationDecisionId: string;
}>;

interface IntegrationEffectReceipt extends IntegrationReceiptBase {
  readonly operation: "apply" | "push";
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly finalAuthorizationDecisionId: string;
  readonly expectedObservationNumber: number;
}

export type ApplyIntegrationReceipt = IntegrationEffectReceipt & Readonly<{ readonly operation: "apply" }>;
export type PushIntegrationReceipt = IntegrationEffectReceipt & Readonly<{ readonly operation: "push" }>;
export type IntegrationBackendReceipt = InspectIntegrationReceipt | ApplyIntegrationReceipt | PushIntegrationReceipt;

export interface IntegrationBackendFailure {
  readonly category: IntegrationFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly retryAfter: string | null;
  readonly evidenceReference: string | null;
}

export type IntegrationBackendResult =
  | Readonly<{ readonly ok: true; readonly receipt: IntegrationBackendReceipt }>
  | Readonly<{ readonly ok: false; readonly error: IntegrationBackendFailure }>;

export interface IntegrationBackend {
  inspect(request: InspectIntegrationRequest): unknown;
  apply(request: ApplyIntegrationRequest): unknown;
  push(request: PushIntegrationRequest): unknown;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const FAILURE_FLAGS: Readonly<Record<IntegrationFailureCategory, Readonly<{ retryable: boolean; ambiguous: boolean }>>> = Object.freeze({
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

const SUBJECT_KEYS = Object.freeze([
  "projectId", "projectResourceRevision", "projectConfigRevision", "projectRootKey", "repositoryIdentity",
  "objectFormat", "targetReference", "expectedTargetObjectId", "sourceWorkspaceId", "sourceGeneration",
  "sourceWorkspaceRevision", "sourceWorkspaceRootKey", "sourceOwnershipBindingSha256", "sourceHeadObjectId",
  "reservationId", "reservationRevision", "reservationStatus", "reservationOwnerExecutionId",
  "reservationOwnerOperationId", "reservationLeaseOwnerId", "reservationLeaseRevision", "reservationFencingToken",
  "reservationExpiresAt", "policyReceiptId", "policyConfigRevision", "destinationIdentity", "destinationReference",
  "expectedRemoteHead",
] as const);

const RECEIPT_COMMON_KEYS = Object.freeze([
  "contractId", "receiptId", "operation", "correlationId", "causationId", "actorId", "adapterId", "adapterVersion",
  "subject", "observationNumber", "localBeforeObjectId", "localAfterObjectId", "remoteBeforeObjectId",
  "remoteAfterObjectId", "localState", "remoteState", "outcome", "code", "evidenceReference", "observedAt",
] as const);

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

function revision(value: unknown, allowZero = false): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && (allowZero ? value >= 0 : value > 0);
}

function sha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function nullableSha1(value: unknown): value is string | null {
  return value === null || sha1(value);
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function gitReference(value: unknown): value is string {
  if (!text(value, 255) || !value.startsWith("refs/heads/") || value.endsWith("/") || value.endsWith(".")) return false;
  if (value.includes("..") || value.includes("@{") || /[ ~^:?*[\\]/u.test(value)) return false;
  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".." && !part.endsWith(".lock"));
}

function parseSubject(value: unknown): IntegrationSubject | null {
  const record = exactRecord(value, SUBJECT_KEYS);
  if (record === null || !text(record.projectId) || !revision(record.projectResourceRevision) ||
      !revision(record.projectConfigRevision) || !text(record.projectRootKey) || !text(record.repositoryIdentity) ||
      record.objectFormat !== "sha1" || !gitReference(record.targetReference) || !sha1(record.expectedTargetObjectId) ||
      !text(record.sourceWorkspaceId) || !revision(record.sourceGeneration) || !revision(record.sourceWorkspaceRevision) ||
      !text(record.sourceWorkspaceRootKey) || !sha256(record.sourceOwnershipBindingSha256) ||
      !sha1(record.sourceHeadObjectId) || record.expectedTargetObjectId === record.sourceHeadObjectId ||
      !text(record.reservationId) || !revision(record.reservationRevision) || typeof record.reservationStatus !== "string" ||
      !(INTEGRATION_RESERVATION_STATUSES as readonly string[]).includes(record.reservationStatus) ||
      !text(record.reservationOwnerExecutionId) || !text(record.reservationOwnerOperationId) ||
      !text(record.reservationLeaseOwnerId) || !revision(record.reservationLeaseRevision) ||
      !revision(record.reservationFencingToken) || !timestamp(record.reservationExpiresAt) ||
      !text(record.policyReceiptId) || !revision(record.policyConfigRevision) || !text(record.destinationIdentity) ||
      !gitReference(record.destinationReference) || !nullableSha1(record.expectedRemoteHead)) return null;
  return Object.freeze(record) as unknown as IntegrationSubject;
}

function sameSubject(left: IntegrationSubject, right: IntegrationSubject): boolean {
  return SUBJECT_KEYS.every((key) => left[key] === right[key]);
}

export function parseIntegrationBackendRequest(value: unknown): IntegrationBackendRequest | null {
  const candidate = typeof value === "object" && value !== null
    ? (value as Readonly<{ operation?: unknown }>).operation
    : undefined;
  const operationKeys = candidate === "inspect"
    ? ["queryId", "readAuthorizationDecisionId", "lastObservationNumber"]
    : candidate === "apply" || candidate === "push"
      ? ["operationId", "intentId", "idempotencyKey", "finalAuthorizationDecisionId", "expectedObservationNumber"]
      : [];
  const record = exactRecord(value, [
    "contractId", "operation", "correlationId", "causationId", "actorId", "adapterId", "adapterVersion", "subject",
    ...operationKeys,
  ]);
  if (record === null || record.contractId !== INTEGRATION_CONTRACT_ID || typeof record.operation !== "string" ||
      !(INTEGRATION_OPERATIONS as readonly string[]).includes(record.operation) || !text(record.correlationId) ||
      !(record.causationId === null || text(record.causationId)) || !text(record.actorId) || !text(record.adapterId) ||
      !text(record.adapterVersion)) return null;
  const subject = parseSubject(record.subject);
  if (subject === null || ((record.operation === "apply" || record.operation === "push") && subject.reservationStatus !== "active")) return null;
  if (record.operation === "inspect") {
    if (!text(record.queryId) || !text(record.readAuthorizationDecisionId) || !revision(record.lastObservationNumber, true)) return null;
  } else if (!text(record.operationId) || !text(record.intentId) || !text(record.idempotencyKey) ||
      !text(record.finalAuthorizationDecisionId) || !revision(record.expectedObservationNumber, true)) return null;
  return Object.freeze({ ...record, subject }) as unknown as IntegrationBackendRequest;
}

function parseFailure(value: unknown): IntegrationBackendFailure | null {
  const record = exactRecord(value, ["category", "code", "retryable", "ambiguous", "retryAfter", "evidenceReference"]);
  if (record === null || typeof record.category !== "string" ||
      !(INTEGRATION_FAILURE_CATEGORIES as readonly string[]).includes(record.category) || !text(record.code) ||
      typeof record.retryable !== "boolean" || typeof record.ambiguous !== "boolean" ||
      !(record.retryAfter === null || timestamp(record.retryAfter)) ||
      !(record.evidenceReference === null || text(record.evidenceReference))) return null;
  const category = record.category as IntegrationFailureCategory;
  const flags = FAILURE_FLAGS[category];
  if (record.retryable !== flags.retryable || record.ambiguous !== flags.ambiguous ||
      (category === "rate_limited" ? record.retryAfter === null : record.retryAfter !== null)) return null;
  return Object.freeze(record) as unknown as IntegrationBackendFailure;
}

function expectedInspectClassification(
  subject: IntegrationSubject,
  localAfter: string | null,
  remoteAfter: string | null,
): Readonly<{ localState: IntegrationLocalState; remoteState: IntegrationRemoteState; outcome: IntegrationReceiptOutcome; code: IntegrationReceiptCode }> {
  const localState: IntegrationLocalState = localAfter === subject.sourceHeadObjectId
    ? "already_at_source"
    : localAfter === subject.expectedTargetObjectId
      ? "unchanged"
      : localAfter === null ? "unknown" : "foreign";
  const remoteState: IntegrationRemoteState = remoteAfter === subject.sourceHeadObjectId
    ? "already_at_source"
    : remoteAfter === null && subject.expectedRemoteHead === null
      ? "absent"
      : remoteAfter !== null && remoteAfter === subject.expectedRemoteHead
        ? "unchanged"
        : remoteAfter === null ? "unknown" : "foreign";
  if (localState === "unknown" || remoteState === "unknown") {
    return Object.freeze({ localState, remoteState, outcome: "ambiguous", code: "inspected_ambiguous" });
  }
  if (localState === "unchanged" && (remoteState === "absent" || remoteState === "unchanged")) {
    return Object.freeze({ localState, remoteState, outcome: "succeeded", code: "inspected_unchanged" });
  }
  if (localState === "already_at_source" && (remoteState === "absent" || remoteState === "unchanged")) {
    return Object.freeze({ localState, remoteState, outcome: "succeeded", code: "inspected_local_applied" });
  }
  if (localState === "already_at_source" && remoteState === "already_at_source") {
    return Object.freeze({ localState, remoteState, outcome: "succeeded", code: "inspected_pushed" });
  }
  return Object.freeze({ localState, remoteState, outcome: "refused", code: "inspected_foreign" });
}

function validInspectReceipt(record: UnknownRecord, subject: IntegrationSubject): boolean {
  if (record.localBeforeObjectId !== null || record.remoteBeforeObjectId !== null) return false;
  const expected = expectedInspectClassification(
    subject,
    record.localAfterObjectId as string | null,
    record.remoteAfterObjectId as string | null,
  );
  return record.localState === expected.localState && record.remoteState === expected.remoteState &&
    record.outcome === expected.outcome && record.code === expected.code;
}

function validApplyReceipt(record: UnknownRecord, subject: IntegrationSubject): boolean {
  if (record.remoteBeforeObjectId !== null || record.remoteAfterObjectId !== null || record.remoteState !== "not_requested") return false;
  const before = record.localBeforeObjectId;
  const after = record.localAfterObjectId;
  if (record.code === "applied") {
    return record.outcome === "succeeded" && record.localState === "fast_forwarded" &&
      before === subject.expectedTargetObjectId && after === subject.sourceHeadObjectId;
  }
  if (record.code === "already_applied") {
    return record.outcome === "succeeded" && record.localState === "already_at_source" &&
      before === subject.sourceHeadObjectId && after === subject.sourceHeadObjectId;
  }
  if (record.code === "apply_refused") {
    if (record.outcome !== "refused") return false;
    const noEffect = record.localState === "unchanged" && before === subject.expectedTargetObjectId &&
      after === subject.expectedTargetObjectId;
    const foreign = record.localState === "foreign" && sha1(after) &&
      after !== subject.expectedTargetObjectId && after !== subject.sourceHeadObjectId;
    return noEffect || foreign;
  }
  return record.code === "apply_ambiguous" && record.outcome === "ambiguous" &&
    record.localState === "unknown" && after === null;
}

function validPushReceipt(record: UnknownRecord, subject: IntegrationSubject): boolean {
  if (record.localBeforeObjectId !== subject.sourceHeadObjectId || record.localAfterObjectId !== subject.sourceHeadObjectId ||
      record.localState !== "already_at_source") return false;
  const before = record.remoteBeforeObjectId;
  const after = record.remoteAfterObjectId;
  if (record.code === "already_pushed") {
    return record.outcome === "succeeded" && record.remoteState === "already_at_source" &&
      before === subject.sourceHeadObjectId && after === subject.sourceHeadObjectId;
  }
  if (record.code === "pushed") {
    return record.outcome === "succeeded" && record.remoteState === "pushed" &&
      subject.expectedRemoteHead !== subject.sourceHeadObjectId && before === subject.expectedRemoteHead &&
      after === subject.sourceHeadObjectId;
  }
  if (record.code === "push_rejected") {
    if (record.outcome !== "refused") return false;
    const nonForeignNoEffect = subject.expectedRemoteHead !== subject.sourceHeadObjectId && (
      (subject.expectedRemoteHead !== null && before === subject.expectedRemoteHead && after === subject.expectedRemoteHead &&
        (record.remoteState === "rejected" || record.remoteState === "unchanged")) ||
      (subject.expectedRemoteHead === null && before === null && after === null && record.remoteState === "absent")
    );
    const foreign = record.remoteState === "foreign" && sha1(after) &&
      after !== subject.expectedRemoteHead && after !== subject.sourceHeadObjectId;
    return nonForeignNoEffect || foreign;
  }
  return record.code === "push_ambiguous" && record.outcome === "ambiguous" &&
    record.remoteState === "unknown" && after === null;
}

export function parseIntegrationBackendResult(
  value: unknown,
  request: IntegrationBackendRequest,
): IntegrationBackendResult | null {
  const envelope = exactRecord(value, ["ok", "receipt"]) ?? exactRecord(value, ["ok", "error"]);
  if (envelope === null || typeof envelope.ok !== "boolean") return null;
  if (!envelope.ok) {
    const failure = parseFailure(envelope.error);
    return failure === null ? null : Object.freeze({ ok: false as const, error: failure });
  }
  const operationKeys = request.operation === "inspect"
    ? ["queryId", "readAuthorizationDecisionId"]
    : ["operationId", "intentId", "idempotencyKey", "finalAuthorizationDecisionId", "expectedObservationNumber"];
  const record = exactRecord(envelope.receipt, [...RECEIPT_COMMON_KEYS, ...operationKeys]);
  if (record === null || record.contractId !== INTEGRATION_CONTRACT_ID || record.operation !== request.operation ||
      record.correlationId !== request.correlationId || record.causationId !== request.causationId ||
      record.actorId !== request.actorId || record.adapterId !== request.adapterId || record.adapterVersion !== request.adapterVersion ||
      !text(record.receiptId) || !revision(record.observationNumber) || !nullableSha1(record.localBeforeObjectId) ||
      !nullableSha1(record.localAfterObjectId) || !nullableSha1(record.remoteBeforeObjectId) ||
      !nullableSha1(record.remoteAfterObjectId) || typeof record.localState !== "string" ||
      !(INTEGRATION_LOCAL_STATES as readonly string[]).includes(record.localState) || typeof record.remoteState !== "string" ||
      !(INTEGRATION_REMOTE_STATES as readonly string[]).includes(record.remoteState) || typeof record.outcome !== "string" ||
      !(INTEGRATION_RECEIPT_OUTCOMES as readonly string[]).includes(record.outcome) || typeof record.code !== "string" ||
      !(INTEGRATION_RECEIPT_CODES as readonly string[]).includes(record.code) || !text(record.evidenceReference) ||
      !timestamp(record.observedAt)) return null;
  const subject = parseSubject(record.subject);
  if (subject === null || !sameSubject(subject, request.subject)) return null;
  if (request.operation === "inspect") {
    if (record.queryId !== request.queryId || record.readAuthorizationDecisionId !== request.readAuthorizationDecisionId ||
        record.observationNumber <= request.lastObservationNumber || !validInspectReceipt(record, subject)) return null;
  } else {
    if (record.operationId !== request.operationId || record.intentId !== request.intentId ||
        record.idempotencyKey !== request.idempotencyKey ||
        record.finalAuthorizationDecisionId !== request.finalAuthorizationDecisionId ||
        record.expectedObservationNumber !== request.expectedObservationNumber ||
        record.observationNumber !== request.expectedObservationNumber + 1) return null;
    if (request.operation === "apply" ? !validApplyReceipt(record, subject) : !validPushReceipt(record, subject)) return null;
  }
  return Object.freeze({
    ok: true as const,
    receipt: Object.freeze({ ...record, subject }) as unknown as IntegrationBackendReceipt,
  });
}
