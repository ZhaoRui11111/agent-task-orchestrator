export const PROJECT_POLICY_CONTRACT_ID = "ato.project-policy/v1" as const;

export const PROJECT_POLICY_OPERATIONS = Object.freeze([
  "evaluate_mutation",
  "completion_requirements",
  "evaluate_integration",
  "evaluate_cleanup",
] as const);

export const PROJECT_POLICY_DECISIONS = Object.freeze(["allow", "deny", "defer"] as const);

export const PROJECT_POLICY_FAILURE_CATEGORIES = Object.freeze([
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

export type ProjectPolicyOperation = (typeof PROJECT_POLICY_OPERATIONS)[number];
export type ProjectPolicyDecision = (typeof PROJECT_POLICY_DECISIONS)[number];
export type ProjectPolicyFailureCategory = (typeof PROJECT_POLICY_FAILURE_CATEGORIES)[number];

export interface PolicyGateRequirement {
  readonly gateId: string;
  readonly gateVersion: string;
  readonly commandKey: string;
  readonly commandIdentitySha256: string;
  readonly toolEnvironmentSha256: string;
  readonly validForSeconds: number | null;
}

export interface ProjectPolicyFacts {
  readonly requiredGates: readonly PolicyGateRequirement[];
  readonly integration: "required" | "not_required";
  readonly preservation: "required" | "not_required";
  readonly cleanup: "allowed_after_completion" | "prohibited";
}

interface PolicySubjectBase {
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly projectRootKey: string;
  readonly repositoryIdentity: string;
}

export interface MutationPolicySubject extends PolicySubjectBase {
  readonly subjectKind: "project" | "task" | "dependency" | "workspace";
  readonly subjectId: string;
  readonly currentRevision: number;
  readonly proposedChangeSha256: string;
  readonly externalTargetSha256: string | null;
}

export interface CompletionPolicySubject extends PolicySubjectBase {
  readonly taskId: string;
  readonly taskRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly workspaceId: string;
  readonly generation: number;
  readonly workspaceRevision: number;
  readonly ownershipBindingSha256: string;
  readonly headObjectId: string;
}

export interface IntegrationPolicySubject extends CompletionPolicySubject {
  readonly targetReference: string;
  readonly expectedTargetObjectId: string;
  readonly sourceHeadObjectId: string;
  readonly destinationIdentity: string;
  readonly expectedRemoteHead: string | null;
}

export interface CleanupPolicySubject extends CompletionPolicySubject {
  readonly completionDecisionId: string;
  readonly executionTerminalCreatedAt: string;
  readonly gateSetSha256: string;
  readonly preservationStateSha256: string;
  readonly integrationDisposition: "not_required" | "released" | "expired";
  readonly integrationReservationId: string | null;
  readonly observedInventorySha256: string;
}

interface ProjectPolicyRequestBase {
  readonly contractId: typeof PROJECT_POLICY_CONTRACT_ID;
  readonly operation: ProjectPolicyOperation;
  readonly policyQueryId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly preliminaryAuthorizationDecisionId: string;
  readonly requestedAction: string;
  readonly policyId: string;
  readonly policyKey: string;
  readonly policyConfigRevision: number;
  readonly adapterId: string;
  readonly adapterVersion: string;
}

export type ProjectPolicyRequest =
  | (ProjectPolicyRequestBase & Readonly<{ readonly operation: "evaluate_mutation"; readonly subject: MutationPolicySubject }>)
  | (ProjectPolicyRequestBase & Readonly<{ readonly operation: "completion_requirements"; readonly subject: CompletionPolicySubject }>)
  | (ProjectPolicyRequestBase & Readonly<{ readonly operation: "evaluate_integration"; readonly subject: IntegrationPolicySubject }>)
  | (ProjectPolicyRequestBase & Readonly<{ readonly operation: "evaluate_cleanup"; readonly subject: CleanupPolicySubject }>);

export interface ProjectPolicyReceipt {
  readonly contractId: typeof PROJECT_POLICY_CONTRACT_ID;
  readonly receiptId: string;
  readonly operation: ProjectPolicyOperation;
  readonly policyQueryId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly preliminaryAuthorizationDecisionId: string;
  readonly requestedAction: string;
  readonly policyId: string;
  readonly policyKey: string;
  readonly policyConfigRevision: number;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly subject: MutationPolicySubject | CompletionPolicySubject | IntegrationPolicySubject | CleanupPolicySubject;
  readonly decision: ProjectPolicyDecision;
  readonly reasonCode: string;
  readonly facts: ProjectPolicyFacts;
  readonly validUntil: string | null;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export interface ProjectPolicyFailure {
  readonly category: ProjectPolicyFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly retryAfter: string | null;
  readonly evidenceReference: string | null;
}

export type ProjectPolicyResult =
  | Readonly<{ readonly ok: true; readonly receipt: ProjectPolicyReceipt }>
  | Readonly<{ readonly ok: false; readonly error: ProjectPolicyFailure }>;

export interface ProjectPolicy {
  evaluateMutation(request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "evaluate_mutation" }>>): unknown;
  completionRequirements(request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "completion_requirements" }>>): unknown;
  evaluateIntegration(request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "evaluate_integration" }>>): unknown;
  evaluateCleanup(request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "evaluate_cleanup" }>>): unknown;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const FAILURE_FLAGS: Readonly<Record<ProjectPolicyFailureCategory, Readonly<{ retryable: boolean; ambiguous: boolean }>>> = Object.freeze({
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

function exactArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) return null;
    if (Reflect.ownKeys(value).length !== value.length + 1) return null;
    const copy: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      copy.push(descriptor.value);
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

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
}

function sha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function timestamp(value: unknown, nullable = false): value is string | null {
  if (nullable && value === null) return true;
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function policyOperation(value: unknown): value is ProjectPolicyOperation {
  return typeof value === "string" && (PROJECT_POLICY_OPERATIONS as readonly string[]).includes(value);
}

function parseSubjectBase(record: UnknownRecord): boolean {
  return text(record.projectId) && revision(record.projectResourceRevision) && revision(record.projectConfigRevision) &&
    text(record.projectRootKey) && text(record.repositoryIdentity);
}

function parseMutationSubject(value: unknown): MutationPolicySubject | null {
  const record = exactRecord(value, [
    "projectId", "projectResourceRevision", "projectConfigRevision", "projectRootKey", "repositoryIdentity",
    "subjectKind", "subjectId", "currentRevision", "proposedChangeSha256", "externalTargetSha256",
  ]);
  if (record === null || !parseSubjectBase(record) ||
      (record.subjectKind !== "project" && record.subjectKind !== "task" && record.subjectKind !== "dependency" && record.subjectKind !== "workspace") ||
      !text(record.subjectId) || !revision(record.currentRevision) || !sha256(record.proposedChangeSha256) ||
      !(record.externalTargetSha256 === null || sha256(record.externalTargetSha256))) return null;
  return Object.freeze(record) as unknown as MutationPolicySubject;
}

const COMPLETION_KEYS = Object.freeze([
  "projectId", "projectResourceRevision", "projectConfigRevision", "projectRootKey", "repositoryIdentity",
  "taskId", "taskRevision", "executionId", "executionRevision", "attemptNumber", "fencingToken",
  "workspaceId", "generation", "workspaceRevision", "ownershipBindingSha256", "headObjectId",
]);

function completionRecord(value: unknown, extra: readonly string[] = []): UnknownRecord | null {
  const record = exactRecord(value, [...COMPLETION_KEYS, ...extra]);
  if (record === null || !parseSubjectBase(record) || !text(record.taskId) || !revision(record.taskRevision) ||
      !text(record.executionId) || !revision(record.executionRevision) || !revision(record.attemptNumber) ||
      !revision(record.fencingToken) || !text(record.workspaceId) || !revision(record.generation) ||
      !revision(record.workspaceRevision) || !sha256(record.ownershipBindingSha256) || !sha1(record.headObjectId)) return null;
  return record;
}

function parseCompletionSubject(value: unknown): CompletionPolicySubject | null {
  const record = completionRecord(value);
  return record === null ? null : Object.freeze(record) as unknown as CompletionPolicySubject;
}

function parseIntegrationSubject(value: unknown): IntegrationPolicySubject | null {
  const record = completionRecord(value, [
    "targetReference", "expectedTargetObjectId", "sourceHeadObjectId", "destinationIdentity", "expectedRemoteHead",
  ]);
  if (record === null || !text(record.targetReference, 255) || !sha1(record.expectedTargetObjectId) ||
      !sha1(record.sourceHeadObjectId) || record.expectedTargetObjectId === record.sourceHeadObjectId ||
      !text(record.destinationIdentity) || !(record.expectedRemoteHead === null || sha1(record.expectedRemoteHead))) return null;
  return Object.freeze(record) as unknown as IntegrationPolicySubject;
}

function parseCleanupSubject(value: unknown): CleanupPolicySubject | null {
  const record = completionRecord(value, [
    "completionDecisionId", "executionTerminalCreatedAt", "gateSetSha256", "preservationStateSha256",
    "integrationDisposition", "integrationReservationId", "observedInventorySha256",
  ]);
  if (record === null || !text(record.completionDecisionId) || !timestamp(record.executionTerminalCreatedAt) ||
      !sha256(record.gateSetSha256) || !sha256(record.preservationStateSha256) ||
      (record.integrationDisposition !== "not_required" && record.integrationDisposition !== "released" && record.integrationDisposition !== "expired") ||
      !(record.integrationReservationId === null || text(record.integrationReservationId)) ||
      (record.integrationDisposition === "not_required") !== (record.integrationReservationId === null) ||
      !sha256(record.observedInventorySha256)) return null;
  return Object.freeze(record) as unknown as CleanupPolicySubject;
}

function parseSubject(operation: ProjectPolicyOperation, value: unknown): ProjectPolicyReceipt["subject"] | null {
  return operation === "evaluate_mutation"
    ? parseMutationSubject(value)
    : operation === "completion_requirements"
      ? parseCompletionSubject(value)
      : operation === "evaluate_integration"
        ? parseIntegrationSubject(value)
        : parseCleanupSubject(value);
}

function sameSubject(left: ProjectPolicyReceipt["subject"], right: ProjectPolicyReceipt["subject"]): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key) &&
    left[key as keyof typeof left] === right[key as keyof typeof right]);
}

const REQUEST_KEYS = Object.freeze([
  "contractId", "operation", "policyQueryId", "correlationId", "actorId",
  "preliminaryAuthorizationDecisionId", "requestedAction", "policyId", "policyKey",
  "policyConfigRevision", "adapterId", "adapterVersion", "subject",
]);

export function parseProjectPolicyRequest(value: unknown): ProjectPolicyRequest | null {
  const record = exactRecord(value, REQUEST_KEYS);
  if (record === null || record.contractId !== PROJECT_POLICY_CONTRACT_ID || !policyOperation(record.operation) ||
      !text(record.policyQueryId) || !text(record.correlationId) || !text(record.actorId) ||
      !text(record.preliminaryAuthorizationDecisionId) || !text(record.requestedAction) || !text(record.policyId) ||
      !text(record.policyKey) || !revision(record.policyConfigRevision) || !text(record.adapterId) ||
      !text(record.adapterVersion)) return null;
  const subject = parseSubject(record.operation, record.subject);
  if (subject === null || subject.projectConfigRevision !== record.policyConfigRevision) return null;
  return Object.freeze({ ...record, subject }) as unknown as ProjectPolicyRequest;
}

function parseGateRequirement(value: unknown): PolicyGateRequirement | null {
  const record = exactRecord(value, [
    "gateId", "gateVersion", "commandKey", "commandIdentitySha256", "toolEnvironmentSha256", "validForSeconds",
  ]);
  if (record === null || !text(record.gateId) || !text(record.gateVersion) || !text(record.commandKey) ||
      !sha256(record.commandIdentitySha256) || !sha256(record.toolEnvironmentSha256) ||
      !(record.validForSeconds === null || (revision(record.validForSeconds) && record.validForSeconds <= 86_400))) return null;
  return Object.freeze(record) as unknown as PolicyGateRequirement;
}

export function parseProjectPolicyFacts(value: unknown): ProjectPolicyFacts | null {
  const record = exactRecord(value, ["requiredGates", "integration", "preservation", "cleanup"]);
  const gates = record === null ? null : exactArray(record.requiredGates, 32);
  if (record === null || gates === null ||
      (record.integration !== "required" && record.integration !== "not_required") ||
      (record.preservation !== "required" && record.preservation !== "not_required") ||
      (record.cleanup !== "allowed_after_completion" && record.cleanup !== "prohibited") ||
      (record.preservation === "required" && record.integration !== "required")) return null;
  const parsed = gates.map(parseGateRequirement);
  if (parsed.some((gate) => gate === null)) return null;
  const typed = parsed as readonly PolicyGateRequirement[];
  if (new Set(typed.map((gate) => `${gate.gateId}\u0000${gate.gateVersion}`)).size !== typed.length) return null;
  return Object.freeze({
    requiredGates: Object.freeze([...typed]),
    integration: record.integration,
    preservation: record.preservation,
    cleanup: record.cleanup,
  }) as ProjectPolicyFacts;
}

function parseFailure(value: unknown): ProjectPolicyFailure | null {
  const record = exactRecord(value, ["category", "code", "retryable", "ambiguous", "retryAfter", "evidenceReference"]);
  if (record === null || typeof record.category !== "string" ||
      !(PROJECT_POLICY_FAILURE_CATEGORIES as readonly string[]).includes(record.category) || !text(record.code) ||
      typeof record.retryable !== "boolean" || typeof record.ambiguous !== "boolean" ||
      !timestamp(record.retryAfter, true) || !(record.evidenceReference === null || text(record.evidenceReference))) return null;
  const category = record.category as ProjectPolicyFailureCategory;
  const flags = FAILURE_FLAGS[category];
  if (record.retryable !== flags.retryable || record.ambiguous !== flags.ambiguous ||
      (category === "rate_limited" ? record.retryAfter === null : record.retryAfter !== null)) return null;
  return Object.freeze(record) as unknown as ProjectPolicyFailure;
}

export function parseProjectPolicyResult(value: unknown, request: ProjectPolicyRequest): ProjectPolicyResult | null {
  const envelope = exactRecord(value, ["ok", "receipt"] ) ?? exactRecord(value, ["ok", "error"]);
  if (envelope === null || typeof envelope.ok !== "boolean") return null;
  if (!envelope.ok) {
    const failure = parseFailure(envelope.error);
    return failure === null ? null : Object.freeze({ ok: false as const, error: failure });
  }
  const record = exactRecord(envelope.receipt, [
    "contractId", "receiptId", "operation", "policyQueryId", "correlationId", "actorId",
    "preliminaryAuthorizationDecisionId", "requestedAction", "policyId", "policyKey",
    "policyConfigRevision", "adapterId", "adapterVersion", "subject", "decision", "reasonCode",
    "facts", "validUntil", "evidenceReference", "observedAt",
  ]);
  if (record === null || record.contractId !== PROJECT_POLICY_CONTRACT_ID || record.operation !== request.operation ||
      record.policyQueryId !== request.policyQueryId || record.correlationId !== request.correlationId ||
      record.actorId !== request.actorId || record.preliminaryAuthorizationDecisionId !== request.preliminaryAuthorizationDecisionId ||
      record.requestedAction !== request.requestedAction || record.policyId !== request.policyId || record.policyKey !== request.policyKey ||
      record.policyConfigRevision !== request.policyConfigRevision || record.adapterId !== request.adapterId ||
      record.adapterVersion !== request.adapterVersion || !text(record.receiptId) || !text(record.reasonCode) ||
      typeof record.decision !== "string" || !(PROJECT_POLICY_DECISIONS as readonly string[]).includes(record.decision) ||
      !timestamp(record.validUntil, true) || !(record.evidenceReference === null || text(record.evidenceReference)) ||
      !timestamp(record.observedAt)) return null;
  const subject = parseSubject(request.operation, record.subject);
  const facts = parseProjectPolicyFacts(record.facts);
  const validUntil = record.validUntil as string | null;
  const observedAt = record.observedAt as string;
  if (subject === null || facts === null || !sameSubject(subject, request.subject) ||
      (validUntil !== null && validUntil <= observedAt)) return null;
  return Object.freeze({
    ok: true as const,
    receipt: Object.freeze({ ...record, subject, facts }) as unknown as ProjectPolicyReceipt,
  });
}
