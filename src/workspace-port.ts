export const WORKSPACE_CONTRACT_ID = "ato.workspace/v1" as const;

export const WORKSPACE_OPERATIONS = Object.freeze([
  "reserve",
  "create",
  "inspect",
  "recover",
  "cleanup",
] as const);

export const WORKSPACE_EXTERNAL_STATES = Object.freeze([
  "absent",
  "reserved",
  "partial",
  "complete",
  "ambiguous",
  "removed",
  "refused",
] as const);

export const WORKSPACE_GENERATION_STATUSES = Object.freeze([
  "allocated",
  "reserved",
  "creating",
  "ready",
  "cleaning",
  "recovery_required",
  "cleaned",
] as const);

export const WORKSPACE_RECEIPT_CODES = Object.freeze([
  "reserved",
  "already_reserved",
  "created",
  "already_created",
  "inspected_absent",
  "inspected_reserved",
  "inspected_partial",
  "inspected_complete",
  "recovered_absent",
  "recovered_reserved",
  "recovered_complete",
  "removed",
  "already_absent",
  "refused",
  "partial",
  "ambiguous",
] as const);

export const WORKSPACE_FAILURE_CATEGORIES = Object.freeze([
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

export type WorkspaceOperation = (typeof WORKSPACE_OPERATIONS)[number];
export type WorkspaceExternalState = (typeof WORKSPACE_EXTERNAL_STATES)[number];
export type WorkspaceGenerationLifecycleStatus = (typeof WORKSPACE_GENERATION_STATUSES)[number];
export type WorkspaceReceiptCode = (typeof WORKSPACE_RECEIPT_CODES)[number];
export type WorkspaceFailureCategory = (typeof WORKSPACE_FAILURE_CATEGORIES)[number];
export type WorkspaceReceiptOutcome = "succeeded" | "refused" | "ambiguous";
export type WorkspacePathSafety = "safe" | "unsafe" | "unknown";

const WORKSPACE_FAILURE_FLAGS: Readonly<Record<
  WorkspaceFailureCategory,
  Readonly<{ retryable: boolean; ambiguous: boolean }>
>> = Object.freeze({
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

export interface WorkspaceSubject {
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly runId: string;
  readonly runRevision: number;
  readonly memberId: string;
  readonly membershipRevision: number;
  readonly memberRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly workspaceId: string;
  readonly generation: number;
  readonly workspaceRevision: number;
  readonly workspaceRootKey: string;
  readonly creatorOperationId: string;
  readonly baseReference: string;
}

export interface WorkspaceBackendRequest {
  readonly contractId: typeof WORKSPACE_CONTRACT_ID;
  readonly operation: WorkspaceOperation;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly subject: WorkspaceSubject;
}

export interface WorkspaceInventorySummary {
  readonly trackedCount: number;
  readonly modifiedCount: number;
  readonly untrackedCount: number;
  readonly ignoredCount: number;
}

export interface WorkspaceBackendReceipt {
  readonly contractId: typeof WORKSPACE_CONTRACT_ID;
  readonly receiptId: string;
  readonly operation: WorkspaceOperation;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly projectRootKey: string;
  readonly workspaceRootKey: string;
  readonly externalState: WorkspaceExternalState;
  readonly outcome: WorkspaceReceiptOutcome;
  readonly code: WorkspaceReceiptCode;
  readonly canonicalPath: string | null;
  readonly repositoryIdentity: string | null;
  readonly registrationIdentity: string | null;
  readonly branchReference: string | null;
  readonly baseObjectId: string | null;
  readonly headObjectId: string | null;
  readonly pathSafety: WorkspacePathSafety;
  readonly ownershipMatch: boolean | null;
  readonly inventory: WorkspaceInventorySummary;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export interface WorkspaceBackendFailure {
  readonly category: WorkspaceFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly retryAfter: string | null;
  readonly evidenceReference: string | null;
}

export type WorkspaceBackendResult =
  | Readonly<{ readonly ok: true; readonly receipt: WorkspaceBackendReceipt }>
  | Readonly<{ readonly ok: false; readonly error: WorkspaceBackendFailure }>;

export interface WorkspaceBackend {
  reserve(request: WorkspaceBackendRequest & Readonly<{ readonly operation: "reserve" }>): unknown;
  create(request: WorkspaceBackendRequest & Readonly<{ readonly operation: "create" }>): unknown;
  inspect(request: WorkspaceBackendRequest & Readonly<{ readonly operation: "inspect" }>): unknown;
  recover(request: WorkspaceBackendRequest & Readonly<{ readonly operation: "recover" }>): unknown;
  cleanup(request: WorkspaceBackendRequest & Readonly<{ readonly operation: "cleanup" }>): unknown;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

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
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.normalize("NFC") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) return undefined;
  return value;
}

function identifier(value: unknown): value is string {
  return boundedText(value, 128) !== undefined;
}

function reference(value: unknown, nullable = false): string | null | undefined {
  return boundedText(value, 256, nullable);
}

function opaqueReference(value: unknown): string | null | undefined {
  if (value === null) return null;
  const result = boundedText(value, 128);
  return typeof result === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(result)
    ? result
    : undefined;
}

function pathText(value: unknown): string | null | undefined {
  return boundedText(value, 1024, true);
}

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function isOperation(value: unknown): value is WorkspaceOperation {
  return typeof value === "string" && (WORKSPACE_OPERATIONS as readonly string[]).includes(value);
}

function parseSubject(value: unknown): WorkspaceSubject | null {
  const record = exactRecord(value, [
    "projectId",
    "projectResourceRevision",
    "projectConfigRevision",
    "projectRootKey",
    "taskId",
    "taskRevision",
    "runId",
    "runRevision",
    "memberId",
    "membershipRevision",
    "memberRevision",
    "executionId",
    "executionRevision",
    "attemptNumber",
    "fencingToken",
    "workspaceId",
    "generation",
    "workspaceRevision",
    "workspaceRootKey",
    "creatorOperationId",
    "baseReference",
  ]);
  if (record === null) return null;
  const identifiers = [
    record.projectId,
    record.projectRootKey,
    record.taskId,
    record.runId,
    record.memberId,
    record.executionId,
    record.workspaceId,
    record.workspaceRootKey,
    record.creatorOperationId,
  ];
  const revisions = [
    record.projectResourceRevision,
    record.projectConfigRevision,
    record.taskRevision,
    record.runRevision,
    record.membershipRevision,
    record.memberRevision,
    record.executionRevision,
    record.attemptNumber,
    record.fencingToken,
    record.generation,
    record.workspaceRevision,
  ];
  const baseReference = reference(record.baseReference);
  if (!identifiers.every(identifier) || !revisions.every(revision) || baseReference === undefined || baseReference === null) {
    return null;
  }
  return Object.freeze({
    projectId: record.projectId as string,
    projectResourceRevision: record.projectResourceRevision as number,
    projectConfigRevision: record.projectConfigRevision as number,
    projectRootKey: record.projectRootKey as string,
    taskId: record.taskId as string,
    taskRevision: record.taskRevision as number,
    runId: record.runId as string,
    runRevision: record.runRevision as number,
    memberId: record.memberId as string,
    membershipRevision: record.membershipRevision as number,
    memberRevision: record.memberRevision as number,
    executionId: record.executionId as string,
    executionRevision: record.executionRevision as number,
    attemptNumber: record.attemptNumber as number,
    fencingToken: record.fencingToken as number,
    workspaceId: record.workspaceId as string,
    generation: record.generation as number,
    workspaceRevision: record.workspaceRevision as number,
    workspaceRootKey: record.workspaceRootKey as string,
    creatorOperationId: record.creatorOperationId as string,
    baseReference,
  });
}

export function parseWorkspaceBackendRequest(value: unknown): WorkspaceBackendRequest | null {
  const record = exactRecord(value, [
    "contractId",
    "operation",
    "operationId",
    "idempotencyKey",
    "correlationId",
    "causationId",
    "adapterId",
    "adapterVersion",
    "subject",
  ]);
  if (record === null || record.contractId !== WORKSPACE_CONTRACT_ID || !isOperation(record.operation)) return null;
  const required = [record.operationId, record.idempotencyKey, record.correlationId, record.adapterId, record.adapterVersion];
  const causationId = boundedText(record.causationId, 128, true);
  const subject = parseSubject(record.subject);
  if (!required.every(identifier) || causationId === undefined || subject === null) return null;
  return Object.freeze({
    contractId: WORKSPACE_CONTRACT_ID,
    operation: record.operation,
    operationId: record.operationId as string,
    idempotencyKey: record.idempotencyKey as string,
    correlationId: record.correlationId as string,
    causationId,
    adapterId: record.adapterId as string,
    adapterVersion: record.adapterVersion as string,
    subject,
  });
}

function parseInventory(value: unknown): WorkspaceInventorySummary | null {
  const record = exactRecord(value, ["trackedCount", "modifiedCount", "untrackedCount", "ignoredCount"]);
  if (
    record === null ||
    !count(record.trackedCount) ||
    !count(record.modifiedCount) ||
    !count(record.untrackedCount) ||
    !count(record.ignoredCount) ||
    record.modifiedCount > record.trackedCount
  ) return null;
  return Object.freeze({
    trackedCount: record.trackedCount,
    modifiedCount: record.modifiedCount,
    untrackedCount: record.untrackedCount,
    ignoredCount: record.ignoredCount,
  });
}

const OPERATION_CODES: Readonly<Record<WorkspaceOperation, ReadonlySet<WorkspaceReceiptCode>>> = Object.freeze({
  reserve: new Set<WorkspaceReceiptCode>(["reserved", "already_reserved", "refused", "partial", "ambiguous"]),
  create: new Set<WorkspaceReceiptCode>(["created", "already_created", "refused", "partial", "ambiguous"]),
  inspect: new Set<WorkspaceReceiptCode>([
    "inspected_absent",
    "inspected_reserved",
    "inspected_partial",
    "inspected_complete",
    "refused",
    "ambiguous",
  ]),
  recover: new Set<WorkspaceReceiptCode>([
    "recovered_absent",
    "recovered_reserved",
    "recovered_complete",
    "refused",
    "partial",
    "ambiguous",
  ]),
  cleanup: new Set<WorkspaceReceiptCode>(["removed", "already_absent", "refused", "partial", "ambiguous"]),
});

export function workspaceReceiptSemanticsAreValid(
  operation: WorkspaceOperation,
  code: WorkspaceReceiptCode,
  outcome: WorkspaceReceiptOutcome,
  state: WorkspaceExternalState,
): boolean {
  if (!OPERATION_CODES[operation].has(code)) return false;
  if ((code === "partial" || code === "ambiguous" || code === "inspected_partial") && outcome !== "ambiguous") return false;
  if (code === "refused" && (outcome !== "refused" || state !== "refused")) return false;
  if (code !== "refused" && code !== "partial" && code !== "ambiguous" && code !== "inspected_partial" && outcome !== "succeeded") return false;
  const expectedStates: Readonly<Record<WorkspaceReceiptCode, WorkspaceExternalState>> = Object.freeze({
    reserved: "reserved",
    already_reserved: "reserved",
    created: "complete",
    already_created: "complete",
    inspected_absent: "absent",
    inspected_reserved: "reserved",
    inspected_partial: "partial",
    inspected_complete: "complete",
    recovered_absent: "absent",
    recovered_reserved: "reserved",
    recovered_complete: "complete",
    removed: "removed",
    already_absent: "absent",
    partial: "partial",
    ambiguous: "ambiguous",
    refused: "refused",
  });
  return expectedStates[code] === state;
}

export function workspaceFailureSemanticsAreValid(
  category: WorkspaceFailureCategory,
  retryable: boolean,
  ambiguous: boolean,
): boolean {
  const expected = WORKSPACE_FAILURE_FLAGS[category];
  return expected !== undefined && retryable === expected.retryable && ambiguous === expected.ambiguous;
}

export function workspaceAmbiguousGenerationStatus(
  operation: WorkspaceOperation,
  currentStatus: WorkspaceGenerationLifecycleStatus,
): WorkspaceGenerationLifecycleStatus {
  return operation === "inspect" ? currentStatus : "recovery_required";
}

export function workspaceRecoveryRootOperationIsValid(
  operation: WorkspaceOperation | null,
): operation is "reserve" | "create" | "cleanup" {
  return operation === "reserve" || operation === "create" || operation === "cleanup";
}

export interface WorkspaceRecoveryCausationNode {
  readonly operationId: string;
  readonly operationKind: WorkspaceOperation;
  readonly state: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly expectedGenerationRevision: number;
  readonly expectedGenerationStatus: WorkspaceGenerationLifecycleStatus;
  readonly causationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceRecoveryCausationRequest {
  readonly operationId: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly recoveryRevision: number;
  readonly causationId: string | null;
  readonly createdAt: string;
}

export interface WorkspaceRecoveryCausationProof {
  readonly rootOperation: "reserve" | "create" | "cleanup";
  readonly recoveryRevision: number;
}

export function workspaceRecoveryCausationProof(
  request: WorkspaceRecoveryCausationRequest,
  resolve: (operationId: string) => WorkspaceRecoveryCausationNode | undefined,
): WorkspaceRecoveryCausationProof | null {
  if (!Number.isSafeInteger(request.recoveryRevision) || request.recoveryRevision < 1 || request.causationId === null) {
    return null;
  }
  const visited = new Set<string>([request.operationId]);
  let causalOperationId = request.causationId;
  let childCreatedAt = request.createdAt;
  while (true) {
    if (visited.has(causalOperationId)) return null;
    const causal = resolve(causalOperationId);
    if (
      causal === undefined || causal.workspaceId !== request.workspaceId ||
      causal.generation !== request.generation || causal.state !== "ambiguous" ||
      causal.expectedGenerationRevision !== request.recoveryRevision ||
      causal.expectedGenerationStatus !== "recovery_required" || causal.updatedAt > childCreatedAt
    ) return null;
    visited.add(causal.operationId);
    if (causal.operationKind !== "recover") {
      return workspaceRecoveryRootOperationIsValid(causal.operationKind)
        ? Object.freeze({ rootOperation: causal.operationKind, recoveryRevision: request.recoveryRevision })
        : null;
    }
    if (causal.causationId === null) return null;
    causalOperationId = causal.causationId;
    childCreatedAt = causal.createdAt;
  }
}

export function workspaceGenerationStatusAfterReceipt(
  operation: WorkspaceOperation,
  code: WorkspaceReceiptCode,
  outcome: WorkspaceReceiptOutcome,
  state: WorkspaceExternalState,
  currentStatus: WorkspaceGenerationLifecycleStatus,
  recoveredOperation: WorkspaceOperation | null,
): WorkspaceGenerationLifecycleStatus | null {
  if (!workspaceReceiptSemanticsAreValid(operation, code, outcome, state)) return null;
  if (operation === "recover" && !workspaceRecoveryRootOperationIsValid(recoveredOperation)) return null;
  if (outcome === "ambiguous") return workspaceAmbiguousGenerationStatus(operation, currentStatus);
  if (operation === "reserve") return outcome === "succeeded" ? "reserved" : "allocated";
  if (operation === "create") return outcome === "succeeded" ? "ready" : "reserved";
  if (operation === "cleanup") return outcome === "succeeded" ? "cleaned" : "ready";
  if (operation === "inspect") return currentStatus;
  if (state === "complete") return "ready";
  if (state === "reserved") return "reserved";
  if (recoveredOperation === "cleanup") return state === "absent" || state === "removed" ? "cleaned" : "ready";
  if (recoveredOperation === "create") return "reserved";
  return "allocated";
}

export function workspaceGenerationStatusAfterFailure(
  operation: WorkspaceOperation,
  currentStatus: WorkspaceGenerationLifecycleStatus,
  category: WorkspaceFailureCategory,
  retryable: boolean,
  ambiguous: boolean,
): WorkspaceGenerationLifecycleStatus | null {
  if (!workspaceFailureSemanticsAreValid(category, retryable, ambiguous)) return null;
  if (ambiguous) return workspaceAmbiguousGenerationStatus(operation, currentStatus);
  if (operation === "reserve") return "allocated";
  if (operation === "create") return "reserved";
  if (operation === "cleanup") return "ready";
  if (operation === "recover") return "recovery_required";
  return currentStatus;
}

function receiptRelationshipIsValid(record: UnknownRecord): boolean {
  const operation = record.operation as WorkspaceOperation;
  const code = record.code as WorkspaceReceiptCode;
  const outcome = record.outcome as WorkspaceReceiptOutcome;
  const state = record.externalState as WorkspaceExternalState;
  if (!workspaceReceiptSemanticsAreValid(operation, code, outcome, state)) return false;
  if (state === "absent" || state === "removed" || state === "refused") {
    if (record.canonicalPath !== null || record.registrationIdentity !== null || record.branchReference !== null || record.headObjectId !== null) return false;
  }
  if (state === "complete") {
    if (
      record.canonicalPath === null ||
      record.repositoryIdentity === null ||
      record.registrationIdentity === null ||
      record.baseObjectId === null ||
      record.headObjectId === null ||
      record.pathSafety !== "safe" ||
      record.ownershipMatch !== true
    ) return false;
  }
  return true;
}

function parseReceipt(value: unknown): WorkspaceBackendReceipt | null {
  const record = exactRecord(value, [
    "contractId",
    "receiptId",
    "operation",
    "operationId",
    "idempotencyKey",
    "adapterId",
    "adapterVersion",
    "workspaceId",
    "generation",
    "projectRootKey",
    "workspaceRootKey",
    "externalState",
    "outcome",
    "code",
    "canonicalPath",
    "repositoryIdentity",
    "registrationIdentity",
    "branchReference",
    "baseObjectId",
    "headObjectId",
    "pathSafety",
    "ownershipMatch",
    "inventory",
    "evidenceReference",
    "observedAt",
  ]);
  if (record === null || record.contractId !== WORKSPACE_CONTRACT_ID || !isOperation(record.operation)) return null;
  const required = [
    record.operationId,
    record.receiptId,
    record.idempotencyKey,
    record.adapterId,
    record.adapterVersion,
    record.workspaceId,
    record.projectRootKey,
    record.workspaceRootKey,
  ];
  const externalState = typeof record.externalState === "string" &&
    (WORKSPACE_EXTERNAL_STATES as readonly string[]).includes(record.externalState)
    ? record.externalState as WorkspaceExternalState
    : null;
  const outcome = record.outcome === "succeeded" || record.outcome === "refused" || record.outcome === "ambiguous"
    ? record.outcome
    : null;
  const code = typeof record.code === "string" && (WORKSPACE_RECEIPT_CODES as readonly string[]).includes(record.code)
    ? record.code as WorkspaceReceiptCode
    : null;
  const canonicalPath = pathText(record.canonicalPath);
  const repositoryIdentity = reference(record.repositoryIdentity, true);
  const registrationIdentity = reference(record.registrationIdentity, true);
  const branchReference = reference(record.branchReference, true);
  const baseObjectId = reference(record.baseObjectId, true);
  const headObjectId = reference(record.headObjectId, true);
  const evidenceReference = opaqueReference(record.evidenceReference);
  const inventory = parseInventory(record.inventory);
  if (
    !required.every(identifier) ||
    !revision(record.generation) ||
    externalState === null ||
    outcome === null ||
    code === null ||
    canonicalPath === undefined ||
    repositoryIdentity === undefined ||
    registrationIdentity === undefined ||
    branchReference === undefined ||
    baseObjectId === undefined ||
    headObjectId === undefined ||
    (record.pathSafety !== "safe" && record.pathSafety !== "unsafe" && record.pathSafety !== "unknown") ||
    !(record.ownershipMatch === null || typeof record.ownershipMatch === "boolean") ||
    inventory === null ||
    evidenceReference === undefined ||
    !timestamp(record.observedAt) ||
    !receiptRelationshipIsValid(record)
  ) return null;
  return Object.freeze({
    contractId: WORKSPACE_CONTRACT_ID,
    receiptId: record.receiptId as string,
    operation: record.operation,
    operationId: record.operationId as string,
    idempotencyKey: record.idempotencyKey as string,
    adapterId: record.adapterId as string,
    adapterVersion: record.adapterVersion as string,
    workspaceId: record.workspaceId as string,
    generation: record.generation,
    projectRootKey: record.projectRootKey as string,
    workspaceRootKey: record.workspaceRootKey as string,
    externalState,
    outcome,
    code,
    canonicalPath,
    repositoryIdentity,
    registrationIdentity,
    branchReference,
    baseObjectId,
    headObjectId,
    pathSafety: record.pathSafety,
    ownershipMatch: record.ownershipMatch,
    inventory,
    evidenceReference,
    observedAt: record.observedAt,
  });
}

function parseFailure(value: unknown): WorkspaceBackendFailure | null {
  const record = exactRecord(value, ["category", "code", "retryable", "ambiguous", "retryAfter", "evidenceReference"]);
  const category = record !== null && typeof record.category === "string" &&
    (WORKSPACE_FAILURE_CATEGORIES as readonly string[]).includes(record.category)
    ? record.category as WorkspaceFailureCategory
    : null;
  const code = record === null ? undefined : boundedText(record.code, 64);
  const retryAfter = record === null || record.retryAfter === null
    ? null
    : timestamp(record.retryAfter) ? record.retryAfter : undefined;
  const evidenceReference = record === null ? undefined : opaqueReference(record.evidenceReference);
  const expectedFlags = category === null ? null : WORKSPACE_FAILURE_FLAGS[category];
  if (
    record === null ||
    category === null ||
    code === undefined ||
    code === null ||
    !/^[a-z][a-z0-9_]{0,63}$/u.test(code) ||
    typeof record.retryable !== "boolean" ||
    typeof record.ambiguous !== "boolean" ||
    retryAfter === undefined ||
    evidenceReference === undefined ||
    expectedFlags === null ||
    !workspaceFailureSemanticsAreValid(category, record.retryable, record.ambiguous)
  ) return null;
  return Object.freeze({
    category,
    code,
    retryable: record.retryable,
    ambiguous: record.ambiguous,
    retryAfter,
    evidenceReference,
  });
}

export function parseWorkspaceBackendResult(value: unknown): WorkspaceBackendResult | null {
  const success = exactRecord(value, ["ok", "receipt"]);
  if (success !== null && success.ok === true) {
    const receipt = parseReceipt(success.receipt);
    return receipt === null ? null : Object.freeze({ ok: true as const, receipt });
  }
  const failure = exactRecord(value, ["ok", "error"]);
  if (failure === null || failure.ok !== false) return null;
  const error = parseFailure(failure.error);
  return error === null ? null : Object.freeze({ ok: false as const, error });
}

export function invokeWorkspaceBackend(backend: WorkspaceBackend, request: WorkspaceBackendRequest): unknown {
  if (request.operation === "reserve") return backend.reserve({ ...request, operation: "reserve" });
  if (request.operation === "create") return backend.create({ ...request, operation: "create" });
  if (request.operation === "inspect") return backend.inspect({ ...request, operation: "inspect" });
  if (request.operation === "recover") return backend.recover({ ...request, operation: "recover" });
  return backend.cleanup({ ...request, operation: "cleanup" });
}
