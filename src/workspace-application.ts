import {
  evaluateAuthorization,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import type { TrustedActorAssertion } from "./application.ts";
import type { Task } from "./domain.ts";
import { validateTrustedRuntimeAndActor } from "./execution-application.ts";
import { ProjectRegistryError, revalidateProjectRoot } from "./project-registry.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationState,
  type ApplicationTransaction,
  type DispatcherMemberRecord,
  type DispatcherRunRecord,
  type ExecutionAttempt,
  type RegisteredProject,
  type WorkspaceAuthorizationDecisionRecord,
  type WorkspaceEventRecord,
  type WorkspaceFinalizationRecord,
  type WorkspaceGenerationRecord,
  type WorkspaceGenerationStatus,
  type WorkspaceObservationRecord,
  type WorkspaceOperationIntentRecord,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";
import {
  WORKSPACE_CONTRACT_ID,
  invokeWorkspaceBackend,
  parseWorkspaceBackendRequest,
  parseWorkspaceBackendResult,
  workspaceAmbiguousGenerationStatus,
  workspaceGenerationStatusAfterFailure,
  workspaceGenerationStatusAfterReceipt,
  workspaceRecoveryCausationProof,
  type WorkspaceBackend,
  type WorkspaceBackendFailure,
  type WorkspaceBackendReceipt,
  type WorkspaceBackendRequest,
  type WorkspaceOperation,
  type WorkspaceRecoveryCausationProof,
  type WorkspaceSubject,
} from "./workspace-port.ts";

export const WORKSPACE_APPLICATION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "PROJECT_NOT_FOUND",
  "PROJECT_DISABLED",
  "PROJECT_IDENTITY_CHANGED",
  "TASK_NOT_FOUND",
  "RUN_NOT_FOUND",
  "MEMBER_NOT_FOUND",
  "EXECUTION_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "STALE_REVISION",
  "STALE_FENCE",
  "INVALID_STATE",
  "RECONCILIATION_REQUIRED",
  "BACKEND_FAILURE",
  "PERSISTENCE_FAILURE",
] as const);

export type WorkspaceApplicationErrorCode = (typeof WORKSPACE_APPLICATION_ERROR_CODES)[number];

export interface WorkspaceApplicationError {
  readonly code: WorkspaceApplicationErrorCode;
  readonly message: string;
}

export interface WorkspaceApplicationSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface WorkspaceApplicationFailure {
  readonly ok: false;
  readonly error: WorkspaceApplicationError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}

export type WorkspaceApplicationResult<T> = WorkspaceApplicationSuccess<T> | WorkspaceApplicationFailure;

export type WorkspaceIngressIdKind =
  | "request"
  | "correlation"
  | "decision"
  | "event"
  | "operation"
  | "intent"
  | "workspace"
  | "observation"
  | "verified_receipt"
  | "finalization"
  | "confirmation";

export interface WorkspaceCleanupConfirmationRequest {
  readonly actorId: string;
  readonly action: "workspace.cleanup";
  readonly requestId: string;
  readonly correlationId: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly generationRevision: number;
}

export interface WorkspaceIngress {
  currentActor(): TrustedActorAssertion;
  now(): string;
  nextId(kind: WorkspaceIngressIdKind): string;
  confirmHighRisk(request: WorkspaceCleanupConfirmationRequest): boolean;
}

export interface WorkspaceApplicationOptions {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly workspaceRootKey: string;
}

interface WorkspaceOwnerCommand {
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly runId: string;
  readonly expectedRunRevision: number;
  readonly memberId: string;
  readonly expectedMembershipRevision: number;
  readonly expectedMemberRevision: number;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedAttemptNumber: number;
  readonly expectedFencingToken: number;
  readonly idempotencyKey: string;
}

export interface WorkspaceReserveCommand extends WorkspaceOwnerCommand {
  readonly kind: "workspace.reserve";
  readonly baseReference: string;
  readonly predecessorWorkspaceId: string | null;
  readonly predecessorGeneration: number | null;
  readonly predecessorRevision: number | null;
}

interface ExistingWorkspaceCommand extends WorkspaceOwnerCommand {
  readonly workspaceId: string;
  readonly expectedGeneration: number;
  readonly expectedGenerationRevision: number;
}

export interface WorkspaceCreateCommand extends ExistingWorkspaceCommand {
  readonly kind: "workspace.create";
}

export interface WorkspaceInspectCommand extends ExistingWorkspaceCommand {
  readonly kind: "workspace.inspect";
}

export interface WorkspaceRecoverCommand extends ExistingWorkspaceCommand {
  readonly kind: "workspace.recover";
  readonly causationId: string;
}

export interface WorkspaceCleanupCommand extends ExistingWorkspaceCommand {
  readonly kind: "workspace.cleanup";
}

export type WorkspaceCommand =
  | WorkspaceReserveCommand
  | WorkspaceCreateCommand
  | WorkspaceInspectCommand
  | WorkspaceRecoverCommand
  | WorkspaceCleanupCommand;

export interface WorkspaceGenerationView {
  readonly workspaceId: string;
  readonly generation: number;
  readonly revision: number;
  readonly status: WorkspaceGenerationStatus;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
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
  readonly predecessorGeneration: number | null;
  readonly predecessorRevision: number | null;
}

export interface WorkspaceOperationView {
  readonly operationId: string;
  readonly intentId: string;
  readonly operation: WorkspaceOperation;
  readonly state: WorkspaceOperationIntentRecord["state"];
  readonly outcome: WorkspaceFinalizationRecord["outcome"] | null;
  readonly code: string | null;
  readonly observationNumber: number;
  readonly evidenceReference: string | null;
  readonly workspace: WorkspaceGenerationView;
}

export interface WorkspaceApplicationService {
  reserve(command: WorkspaceReserveCommand): WorkspaceApplicationResult<WorkspaceOperationView>;
  create(command: WorkspaceCreateCommand): WorkspaceApplicationResult<WorkspaceOperationView>;
  inspect(command: WorkspaceInspectCommand): WorkspaceApplicationResult<WorkspaceOperationView>;
  recover(command: WorkspaceRecoverCommand): WorkspaceApplicationResult<WorkspaceOperationView>;
  cleanup(command: WorkspaceCleanupCommand): WorkspaceApplicationResult<WorkspaceOperationView>;
}

export interface WorkspaceApplicationTestHooks {
  afterStage?(stage: string): void;
  afterWrite?(stage: string): void;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

interface TrustedContext {
  readonly actor: TrustedActorAssertion;
  readonly now: string;
}

interface PrepareIdentity extends TrustedContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly eventId: string;
  readonly operationId: string;
  readonly intentId: string;
}

interface PhaseIdentity extends TrustedContext {
  readonly requestId: string;
  readonly decisionId: string;
  readonly eventId: string;
}

interface OwnerBinding {
  readonly project: RegisteredProject;
  readonly task: Task;
  readonly run: DispatcherRunRecord;
  readonly member: DispatcherMemberRecord;
  readonly execution: ExecutionAttempt;
}

interface PreparedOperation {
  readonly identity: PrepareIdentity;
  readonly command: WorkspaceCommand;
  readonly generation: WorkspaceGenerationRecord;
  readonly intent: WorkspaceOperationIntentRecord;
}

interface WorkspaceReceiptEvidence {
  readonly receiptId: string;
  readonly externalState: WorkspaceBackendReceipt["externalState"];
  readonly outcome: WorkspaceBackendReceipt["outcome"];
  readonly code: WorkspaceBackendReceipt["code"];
  readonly pathSafety: WorkspaceBackendReceipt["pathSafety"];
  readonly ownershipMatch: WorkspaceBackendReceipt["ownershipMatch"];
  readonly inventory: WorkspaceBackendReceipt["inventory"];
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

const OWNER_KEYS = Object.freeze([
  "projectId",
  "expectedProjectResourceRevision",
  "expectedProjectConfigRevision",
  "taskId",
  "expectedTaskRevision",
  "runId",
  "expectedRunRevision",
  "memberId",
  "expectedMembershipRevision",
  "expectedMemberRevision",
  "executionId",
  "expectedExecutionRevision",
  "expectedAttemptNumber",
  "expectedFencingToken",
  "idempotencyKey",
] as const);

function exactRecord(value: unknown, keys: readonly string[]): UnknownRecord | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const allowed = new Set(keys);
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      Object.defineProperty(result, key, { enumerable: true, value: descriptor.value });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function operationIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function domainIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function boundedReference(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  return record !== null && operationIdentifier(record.actorId) &&
    typeof record.principal === "string" && /^[0-9A-F]{64}$/u.test(record.principal)
    ? Object.freeze({ actorId: record.actorId, principal: record.principal })
    : null;
}

function parseOwner(record: UnknownRecord): WorkspaceOwnerCommand | null {
  const identifiers = [record.projectId, record.taskId, record.runId, record.memberId, record.executionId];
  const revisions = [
    record.expectedProjectResourceRevision,
    record.expectedProjectConfigRevision,
    record.expectedTaskRevision,
    record.expectedRunRevision,
    record.expectedMembershipRevision,
    record.expectedMemberRevision,
    record.expectedExecutionRevision,
    record.expectedAttemptNumber,
    record.expectedFencingToken,
  ];
  if (
    !domainIdentifier(record.projectId) || !domainIdentifier(record.taskId) ||
    !identifiers.slice(2).every(operationIdentifier) || !revisions.every(revision) ||
    !operationIdentifier(record.idempotencyKey)
  ) return null;
  return Object.freeze({
    projectId: record.projectId,
    expectedProjectResourceRevision: record.expectedProjectResourceRevision as number,
    expectedProjectConfigRevision: record.expectedProjectConfigRevision as number,
    taskId: record.taskId,
    expectedTaskRevision: record.expectedTaskRevision as number,
    runId: record.runId as string,
    expectedRunRevision: record.expectedRunRevision as number,
    memberId: record.memberId as string,
    expectedMembershipRevision: record.expectedMembershipRevision as number,
    expectedMemberRevision: record.expectedMemberRevision as number,
    executionId: record.executionId as string,
    expectedExecutionRevision: record.expectedExecutionRevision as number,
    expectedAttemptNumber: record.expectedAttemptNumber as number,
    expectedFencingToken: record.expectedFencingToken as number,
    idempotencyKey: record.idempotencyKey as string,
  });
}

function parseReserve(value: unknown): WorkspaceReserveCommand | null {
  const record = exactRecord(value, [
    "kind", ...OWNER_KEYS, "baseReference", "predecessorWorkspaceId", "predecessorGeneration", "predecessorRevision",
  ]);
  const owner = record === null ? null : parseOwner(record);
  if (record === null || owner === null || record.kind !== "workspace.reserve" || !boundedReference(record.baseReference)) return null;
  const absent = record.predecessorWorkspaceId === null && record.predecessorGeneration === null && record.predecessorRevision === null;
  const present = operationIdentifier(record.predecessorWorkspaceId) && revision(record.predecessorGeneration) && revision(record.predecessorRevision);
  if (!absent && !present) return null;
  return Object.freeze({
    kind: "workspace.reserve",
    ...owner,
    baseReference: record.baseReference,
    predecessorWorkspaceId: record.predecessorWorkspaceId as string | null,
    predecessorGeneration: record.predecessorGeneration as number | null,
    predecessorRevision: record.predecessorRevision as number | null,
  });
}

function parseExisting(value: unknown, operation: Exclude<WorkspaceOperation, "reserve" | "recover">): WorkspaceCreateCommand | WorkspaceInspectCommand | WorkspaceCleanupCommand | null {
  const record = exactRecord(value, ["kind", ...OWNER_KEYS, "workspaceId", "expectedGeneration", "expectedGenerationRevision"]);
  const owner = record === null ? null : parseOwner(record);
  if (
    record === null || owner === null || record.kind !== `workspace.${operation}` ||
    !operationIdentifier(record.workspaceId) || !revision(record.expectedGeneration) ||
    !revision(record.expectedGenerationRevision)
  ) return null;
  return Object.freeze({
    kind: `workspace.${operation}`,
    ...owner,
    workspaceId: record.workspaceId,
    expectedGeneration: record.expectedGeneration,
    expectedGenerationRevision: record.expectedGenerationRevision,
  }) as WorkspaceCreateCommand | WorkspaceInspectCommand | WorkspaceCleanupCommand;
}

function parseRecover(value: unknown): WorkspaceRecoverCommand | null {
  const record = exactRecord(value, [
    "kind", ...OWNER_KEYS, "workspaceId", "expectedGeneration", "expectedGenerationRevision", "causationId",
  ]);
  const owner = record === null ? null : parseOwner(record);
  if (
    record === null || owner === null || record.kind !== "workspace.recover" ||
    !operationIdentifier(record.workspaceId) || !revision(record.expectedGeneration) ||
    !revision(record.expectedGenerationRevision) || !operationIdentifier(record.causationId)
  ) return null;
  return Object.freeze({
    kind: "workspace.recover",
    ...owner,
    workspaceId: record.workspaceId,
    expectedGeneration: record.expectedGeneration,
    expectedGenerationRevision: record.expectedGenerationRevision,
    causationId: record.causationId,
  });
}

function parseCommand(value: unknown, operation: WorkspaceOperation): WorkspaceCommand | null {
  if (operation === "reserve") return parseReserve(value);
  if (operation === "recover") return parseRecover(value);
  return parseExisting(value, operation);
}

function failed(
  code: WorkspaceApplicationErrorCode,
  message: string,
  identity: Readonly<{ requestId: string; correlationId: string }> | null = null,
): WorkspaceApplicationFailure {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ code, message }),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}

function succeeded<T>(
  value: T,
  identity: Readonly<{ requestId: string; correlationId: string }>,
): WorkspaceApplicationSuccess<T> {
  return Object.freeze({ ok: true as const, value, requestId: identity.requestId, correlationId: identity.correlationId });
}

function trustedContext(ingress: WorkspaceIngress): TrustedContext | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const now = ingress.now();
    return actor !== null && timestamp(now) ? Object.freeze({ actor, now }) : null;
  } catch {
    return null;
  }
}

function nextIdentifier(ingress: WorkspaceIngress, kind: WorkspaceIngressIdKind): string | null {
  try {
    const value = ingress.nextId(kind);
    return operationIdentifier(value) ? value : null;
  } catch {
    return null;
  }
}

function prepareIdentity(context: TrustedContext, ingress: WorkspaceIngress): PrepareIdentity | null {
  const requestId = nextIdentifier(ingress, "request");
  const correlationId = nextIdentifier(ingress, "correlation");
  const decisionId = nextIdentifier(ingress, "decision");
  const eventId = nextIdentifier(ingress, "event");
  const operationId = nextIdentifier(ingress, "operation");
  const intentId = nextIdentifier(ingress, "intent");
  const identifiers = [requestId, correlationId, decisionId, eventId, operationId, intentId];
  if (identifiers.some((value) => value === null) || new Set(identifiers).size !== identifiers.length) return null;
  return Object.freeze({
    ...context,
    requestId: requestId!,
    correlationId: correlationId!,
    decisionId: decisionId!,
    eventId: eventId!,
    operationId: operationId!,
    intentId: intentId!,
  });
}

function laterTimestamp(previous: string, candidate: string): string {
  if (candidate > previous) return candidate;
  return new Date(new Date(previous).valueOf() + 1).toISOString();
}

function phaseIdentity(
  ingress: WorkspaceIngress,
  actor: TrustedActorAssertion,
  previousTime: string,
): PhaseIdentity | null {
  try {
    const currentActor = parseActor(ingress.currentActor());
    const candidate = ingress.now();
    const requestId = nextIdentifier(ingress, "request");
    const decisionId = nextIdentifier(ingress, "decision");
    const eventId = nextIdentifier(ingress, "event");
    if (
      currentActor === null || currentActor.actorId !== actor.actorId || currentActor.principal !== actor.principal ||
      !timestamp(candidate) || requestId === null || decisionId === null || eventId === null ||
      new Set([requestId, decisionId, eventId]).size !== 3
    ) return null;
    return Object.freeze({ actor, now: laterTimestamp(previousTime, candidate), requestId, decisionId, eventId });
  } catch {
    return null;
  }
}

function operationFor(command: WorkspaceCommand): WorkspaceOperation {
  return command.kind.slice("workspace.".length) as WorkspaceOperation;
}

function actionFor(operation: WorkspaceOperation): WorkspaceAuthorizationDecisionRecord["action"] {
  return `workspace.${operation}` as WorkspaceAuthorizationDecisionRecord["action"];
}

function commandCausation(command: WorkspaceCommand): string | null {
  return command.kind === "workspace.recover" ? command.causationId : null;
}

function bindingFailure(
  state: ApplicationState,
  command: WorkspaceOwnerCommand,
  now: string,
): OwnerBinding | WorkspaceApplicationFailure {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failed("PROJECT_NOT_FOUND", "Project is not registered");
  if (
    project.resourceRevision !== command.expectedProjectResourceRevision ||
    project.configRevision !== command.expectedProjectConfigRevision
  ) return failed("STALE_REVISION", "Project binding is stale");
  const task = state.domain.tasks.find((candidate) => candidate.id === command.taskId);
  if (task === undefined || task.projectId !== project.projectId) return failed("TASK_NOT_FOUND", "Task is not registered in the Project");
  if (task.revision !== command.expectedTaskRevision) return failed("STALE_REVISION", "Task revision is stale");
  if (state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled !== true) {
    return failed("PROJECT_DISABLED", "Disabled Project cannot perform a workspace operation");
  }
  const run = state.dispatcherRuns.find((candidate) => candidate.runId === command.runId);
  if (run === undefined) return failed("RUN_NOT_FOUND", "Dispatcher run is not registered");
  if (run.runRevision !== command.expectedRunRevision) return failed("STALE_REVISION", "Dispatcher run revision is stale");
  const member = state.dispatcherMembers.find((candidate) => candidate.memberId === command.memberId);
  if (
    member === undefined || member.runId !== run.runId || member.projectId !== project.projectId ||
    member.taskId !== task.id || member.executionId !== command.executionId ||
    member.lifecycle !== "terminal" || member.outcome !== "claimed"
  ) return failed("MEMBER_NOT_FOUND", "Claimed dispatcher member binding is absent");
  if (
    member.membershipRevision !== command.expectedMembershipRevision || member.revision !== command.expectedMemberRevision ||
    member.projectResourceRevision !== project.resourceRevision || member.projectConfigRevision !== project.configRevision
  ) return failed("STALE_REVISION", "Dispatcher member binding is stale");
  const execution = state.executions.find((candidate) => candidate.executionId === command.executionId);
  if (execution === undefined || execution.taskId !== task.id) return failed("EXECUTION_NOT_FOUND", "Execution attempt is not registered");
  if (
    execution.revision !== command.expectedExecutionRevision || execution.attemptNumber !== command.expectedAttemptNumber ||
    execution.projectResourceRevision !== project.resourceRevision || execution.projectConfigRevision !== project.configRevision ||
    execution.postTaskRevision !== task.revision
  ) return failed("STALE_REVISION", "Execution binding is stale");
  if (
    execution.status !== "active" || execution.fencingToken !== command.expectedFencingToken ||
    execution.supersededByExecutionId !== null || execution.leaseExpiresAt <= now
  ) return failed("STALE_FENCE", "Execution lease or fencing token is no longer current");
  return Object.freeze({ project, task, run, member, execution });
}

function sameBinding(left: OwnerBinding, right: OwnerBinding): boolean {
  return left.project.projectId === right.project.projectId &&
    left.project.resourceRevision === right.project.resourceRevision &&
    left.project.configRevision === right.project.configRevision &&
    left.project.rootKey === right.project.rootKey &&
    left.task.id === right.task.id && left.task.revision === right.task.revision &&
    left.run.runId === right.run.runId && left.run.runRevision === right.run.runRevision &&
    left.member.memberId === right.member.memberId &&
    left.member.membershipRevision === right.member.membershipRevision && left.member.revision === right.member.revision &&
    left.execution.executionId === right.execution.executionId &&
    left.execution.revision === right.execution.revision && left.execution.fencingToken === right.execution.fencingToken;
}

function generationMatchesOwner(generation: WorkspaceGenerationRecord, command: WorkspaceOwnerCommand): boolean {
  return generation.projectId === command.projectId &&
    generation.projectResourceRevision <= command.expectedProjectResourceRevision &&
    generation.projectConfigRevision <= command.expectedProjectConfigRevision &&
    generation.taskId === command.taskId && generation.taskRevision <= command.expectedTaskRevision &&
    generation.runId === command.runId && generation.runRevision <= command.expectedRunRevision &&
    generation.memberId === command.memberId && generation.membershipRevision === command.expectedMembershipRevision &&
    generation.memberRevision <= command.expectedMemberRevision && generation.executionId === command.executionId &&
    generation.executionRevision <= command.expectedExecutionRevision &&
    generation.attemptNumber === command.expectedAttemptNumber && generation.fencingToken === command.expectedFencingToken;
}

function generationForExisting(state: ApplicationState, command: ExistingWorkspaceCommand): WorkspaceGenerationRecord | WorkspaceApplicationFailure {
  const generation = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === command.workspaceId && candidate.generation === command.expectedGeneration
  );
  if (generation === undefined) return failed("WORKSPACE_NOT_FOUND", "Workspace generation is not registered");
  if (!generationMatchesOwner(generation, command) || generation.revision !== command.expectedGenerationRevision) {
    return failed("STALE_REVISION", "Workspace generation binding is stale");
  }
  return generation;
}

function requiredStatus(operation: WorkspaceOperation, status: WorkspaceGenerationStatus): boolean {
  if (operation === "create") return status === "reserved";
  if (operation === "cleanup") return status === "ready";
  if (operation === "recover") return status === "recovery_required";
  if (operation === "inspect") return true;
  return status === "allocated";
}

function workspaceView(generation: WorkspaceGenerationRecord): WorkspaceGenerationView {
  return Object.freeze({
    workspaceId: generation.workspaceId,
    generation: generation.generation,
    revision: generation.revision,
    status: generation.status,
    projectId: generation.projectId,
    projectResourceRevision: generation.projectResourceRevision,
    projectConfigRevision: generation.projectConfigRevision,
    taskId: generation.taskId,
    taskRevision: generation.taskRevision,
    runId: generation.runId,
    runRevision: generation.runRevision,
    memberId: generation.memberId,
    membershipRevision: generation.membershipRevision,
    memberRevision: generation.memberRevision,
    executionId: generation.executionId,
    executionRevision: generation.executionRevision,
    attemptNumber: generation.attemptNumber,
    fencingToken: generation.fencingToken,
    predecessorGeneration: generation.predecessorGeneration,
    predecessorRevision: generation.predecessorRevision,
  });
}

function operationView(state: ApplicationState, intent: WorkspaceOperationIntentRecord): WorkspaceOperationView {
  const generation = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === intent.workspaceId && candidate.generation === intent.generation
  );
  if (generation === undefined) throw new TypeError("Workspace operation generation readback is absent");
  const finalization = state.workspaceFinalizations.find((candidate) => candidate.intentId === intent.intentId) ?? null;
  const evidence = [...state.workspaceEvents].reverse().find((candidate) => candidate.intentId === intent.intentId)?.evidenceReference ?? null;
  return Object.freeze({
    operationId: intent.operationId,
    intentId: intent.intentId,
    operation: intent.operationKind,
    state: intent.state,
    outcome: finalization?.outcome ?? null,
    code: finalization?.code ?? null,
    observationNumber: intent.lastObservationNumber,
    evidenceReference: evidence,
    workspace: workspaceView(generation),
  });
}

function replayMatches(
  state: ApplicationState,
  intent: WorkspaceOperationIntentRecord,
  command: WorkspaceCommand,
  actorId: string,
): boolean {
  const generation = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === intent.workspaceId && candidate.generation === intent.generation
  );
  const prepare = state.workspaceAuthorizationDecisions.find((candidate) =>
    candidate.operationId === intent.operationId && candidate.bindingRevision === 1
  );
  if (
    generation === undefined || prepare === undefined || intent.actorId !== actorId ||
    intent.operationKind !== operationFor(command) || intent.causationId !== commandCausation(command) ||
    !generationMatchesOwner(generation, command)
  ) return false;
  if (command.kind === "workspace.reserve") {
    return generation.baseReference === command.baseReference &&
      generation.predecessorGeneration === command.predecessorGeneration &&
      generation.predecessorRevision === command.predecessorRevision &&
      (command.predecessorWorkspaceId === null || command.predecessorWorkspaceId === generation.workspaceId);
  }
  return generation.workspaceId === command.workspaceId && generation.generation === command.expectedGeneration &&
    prepare.generationRevision === command.expectedGenerationRevision;
}

function replayResult(
  state: ApplicationState,
  intent: WorkspaceOperationIntentRecord,
  command: WorkspaceCommand,
  actorId: string,
): WorkspaceApplicationResult<WorkspaceOperationView> {
  if (!replayMatches(state, intent, command, actorId)) {
    return failed("IDEMPOTENCY_CONFLICT", "Workspace idempotency identity is bound to another operation", intent);
  }
  if (intent.state === "pending" || intent.state === "executing" || intent.state === "observed" || intent.state === "verified") {
    return failed("RECONCILIATION_REQUIRED", "Workspace operation is unfinished and requires explicit recovery", intent);
  }
  return succeeded(operationView(state, intent), intent);
}

function unfinishedIntent(intent: WorkspaceOperationIntentRecord): boolean {
  return intent.state === "pending" || intent.state === "executing" ||
    intent.state === "observed" || intent.state === "verified";
}

function replayPrepareIdentity(
  state: ApplicationState,
  intent: WorkspaceOperationIntentRecord,
  actor: TrustedActorAssertion,
): PrepareIdentity | null {
  const decision = state.workspaceAuthorizationDecisions.find((candidate) =>
    candidate.operationId === intent.operationId && candidate.bindingRevision === 1 && candidate.phase === "prepare"
  );
  const event = state.workspaceEvents.find((candidate) =>
    candidate.intentId === intent.intentId && candidate.eventKind === "workspace.operation.prepared"
  );
  if (decision === undefined || event === undefined) return null;
  return Object.freeze({
    actor,
    now: intent.createdAt,
    requestId: intent.requestId,
    correlationId: intent.correlationId,
    decisionId: decision.decisionId,
    eventId: event.eventId,
    operationId: intent.operationId,
    intentId: intent.intentId,
  });
}

function validateRuntime(
  state: ApplicationState,
  actor: TrustedActorAssertion,
  project: RegisteredProject,
  store: PersistenceStore,
): WorkspaceApplicationFailure | null {
  const runtime = validateTrustedRuntimeAndActor(state, actor, store);
  if (!runtime.ok) {
    return failed(
      runtime.reason === "runtime_root_unavailable" ? "PROJECT_IDENTITY_CHANGED" : "AUTHORIZATION_DENIED",
      "Trusted runtime or actor binding is no longer current",
    );
  }
  try {
    revalidateProjectRoot(project, store.layout.root);
    return null;
  } catch (error) {
    return error instanceof ProjectRegistryError
      ? failed("PROJECT_IDENTITY_CHANGED", "Project root identity changed or could not be revalidated")
      : failed("PERSISTENCE_FAILURE", "Project root revalidation failed");
  }
}

function policyFor(state: ApplicationState, project: RegisteredProject, operation: WorkspaceOperation): AuthorizationPolicyResult {
  if (operation === "inspect") return "read_not_applicable";
  return state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true ? "allow" : "deny";
}

function authorization(
  state: ApplicationState,
  actor: TrustedActorAssertion,
  now: string,
  operation: WorkspaceOperation,
  project: RegisteredProject,
  confirmed: boolean,
): AuthorizationEvaluation {
  return evaluateAuthorization({
    actorId: actor.actorId,
    action: actionFor(operation),
    target: {
      projectId: project.projectId,
      resourceRevision: project.resourceRevision,
      configRevision: project.configRevision,
    },
    now,
    policy: policyFor(state, project, operation),
    confirmed,
    grants: state.grants,
  });
}

function authorizationDecision(
  identity: Readonly<{ requestId: string; decisionId: string; actor: TrustedActorAssertion; now: string }>,
  operationId: string,
  bindingRevision: number,
  phase: WorkspaceAuthorizationDecisionRecord["phase"],
  operation: WorkspaceOperation,
  evaluation: AuthorizationEvaluation,
  binding: OwnerBinding,
  generation: WorkspaceGenerationRecord | null,
): WorkspaceAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId: identity.decisionId,
    requestId: identity.requestId,
    operationId,
    bindingRevision,
    phase,
    actorId: identity.actor.actorId,
    action: actionFor(operation),
    result: evaluation.allowed ? "allow" : "deny",
    reason: evaluation.reason,
    policy: evaluation.policy,
    grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision,
    projectId: binding.project.projectId,
    projectResourceRevision: binding.project.resourceRevision,
    projectConfigRevision: binding.project.configRevision,
    executionId: binding.execution.executionId,
    executionRevision: binding.execution.revision,
    fencingToken: binding.execution.fencingToken,
    workspaceId: generation?.workspaceId ?? null,
    generation: generation?.generation ?? null,
    generationRevision: generation?.revision ?? null,
    createdAt: identity.now,
  });
}

function workspaceEvent(
  eventId: string,
  identity: Readonly<{ actor: TrustedActorAssertion; now: string; correlationId: string }>,
  operationId: string,
  intentId: string | null,
  eventKind: WorkspaceEventRecord["eventKind"],
  outcome: WorkspaceEventRecord["outcome"],
  reasonCode: string,
  causationId: string | null,
  generation: WorkspaceGenerationRecord | null,
  observationNumber: number | null,
  evidenceReference: string | null,
): WorkspaceEventRecord {
  return Object.freeze({
    eventId,
    operationId,
    intentId,
    eventKind,
    outcome,
    reasonCode,
    actorId: identity.actor.actorId,
    correlationId: identity.correlationId,
    causationId,
    workspaceId: generation?.workspaceId ?? null,
    generation: generation?.generation ?? null,
    generationRevision: generation?.revision ?? null,
    observationNumber,
    evidenceReference,
    createdAt: identity.now,
  });
}

function createGeneration(
  workspaceId: string,
  generationNumber: number,
  predecessor: WorkspaceGenerationRecord | null,
  identity: PrepareIdentity,
  command: WorkspaceReserveCommand,
  binding: OwnerBinding,
  options: WorkspaceApplicationOptions,
): WorkspaceGenerationRecord {
  return Object.freeze({
    workspaceId,
    generation: generationNumber,
    revision: 1,
    status: "allocated" as const,
    projectId: binding.project.projectId,
    projectResourceRevision: binding.project.resourceRevision,
    projectConfigRevision: binding.project.configRevision,
    projectRootKey: binding.project.rootKey,
    taskId: binding.task.id,
    taskRevision: binding.task.revision,
    runId: binding.run.runId,
    runRevision: binding.run.runRevision,
    memberId: binding.member.memberId,
    membershipRevision: binding.member.membershipRevision,
    memberRevision: binding.member.revision,
    executionId: binding.execution.executionId,
    executionRevision: binding.execution.revision,
    attemptNumber: binding.execution.attemptNumber,
    fencingToken: binding.execution.fencingToken,
    workspaceRootKey: options.workspaceRootKey,
    creatorOperationId: identity.operationId,
    predecessorGeneration: predecessor?.generation ?? null,
    predecessorRevision: predecessor?.revision ?? null,
    baseReference: command.baseReference,
    contractId: WORKSPACE_CONTRACT_ID,
    adapterId: options.adapterId,
    adapterVersion: options.adapterVersion,
    createdAt: identity.now,
    updatedAt: identity.now,
  });
}

function reserveGeneration(
  state: ApplicationState,
  command: WorkspaceReserveCommand,
  identity: PrepareIdentity,
  binding: OwnerBinding,
  workspaceId: string | null,
  options: WorkspaceApplicationOptions,
): WorkspaceGenerationRecord | WorkspaceApplicationFailure {
  const current = state.workspaceGenerations.find((candidate) =>
    candidate.status !== "cleaned" && candidate.projectId === command.projectId &&
    candidate.taskId === command.taskId && candidate.runId === command.runId &&
    candidate.executionId === command.executionId
  );
  if (current !== undefined) {
    const recoveryProof = state.workspaceIntents.find((candidate) => {
      if (
        candidate.operationKind !== "recover" || candidate.state !== "finalized" ||
        candidate.workspaceId !== current.workspaceId || candidate.generation !== current.generation ||
        candidate.causationId === null
      ) return false;
      const proof = validatedRecoveryProof(state, candidate);
      const receipt = state.workspaceReceipts.find((record) => record.intentId === candidate.intentId);
      const finalization = state.workspaceFinalizations.find((record) => record.intentId === candidate.intentId);
      return proof?.rootOperation === "reserve" &&
        receipt?.externalState === "absent" && finalization?.outcome === "succeeded" &&
        finalization.resultingGenerationStatus === "allocated" &&
        finalization.resultingGenerationRevision === current.revision;
    });
    const refusalProof = state.workspaceIntents.find((candidate) => {
      if (
        candidate.operationKind !== "reserve" || candidate.state !== "finalized" ||
        candidate.workspaceId !== current.workspaceId || candidate.generation !== current.generation
      ) return false;
      const receipt = state.workspaceReceipts.find((record) => record.intentId === candidate.intentId);
      const finalization = state.workspaceFinalizations.find((record) => record.intentId === candidate.intentId);
      return receipt?.outcome === "refused" && finalization?.outcome === "refused" &&
        finalization.resultingGenerationStatus === "allocated" &&
        finalization.resultingGenerationRevision === current.revision;
    });
    const noEffectFailureProof = state.workspaceIntents.find((candidate) => {
      if (
        candidate.operationKind !== "reserve" || candidate.state !== "failed" ||
        candidate.workspaceId !== current.workspaceId || candidate.generation !== current.generation ||
        candidate.lastObservationNumber !== 0 || candidate.lastFailureAmbiguous !== false
      ) return false;
      const observation = state.workspaceObservations.find((record) => record.intentId === candidate.intentId);
      const receipt = state.workspaceReceipts.find((record) => record.intentId === candidate.intentId);
      const finalization = state.workspaceFinalizations.find((record) => record.intentId === candidate.intentId);
      return observation === undefined && receipt === undefined && finalization?.outcome === "failed" &&
        finalization.verifiedReceiptId === null && finalization.resultingGenerationStatus === "allocated" &&
        finalization.resultingGenerationRevision === current.revision;
    });
    const unfinished = state.workspaceIntents.some((candidate) =>
      candidate.workspaceId === current.workspaceId && candidate.generation === current.generation && unfinishedIntent(candidate)
    );
    const predecessorMatches = command.predecessorWorkspaceId === null
      ? current.generation === 1 && current.predecessorGeneration === null && current.predecessorRevision === null
      : command.predecessorWorkspaceId === current.workspaceId &&
        command.predecessorGeneration === current.predecessorGeneration &&
        command.predecessorRevision === current.predecessorRevision;
    if (
      (recoveryProof !== undefined || refusalProof !== undefined || noEffectFailureProof !== undefined) &&
      !unfinished && current.status === "allocated" &&
      generationMatchesOwner(current, command) && current.baseReference === command.baseReference && predecessorMatches
    ) return current;
    return failed("INVALID_STATE", "An uncleaned workspace generation already owns this execution tuple", identity);
  }
  if (command.predecessorWorkspaceId === null) {
    if (workspaceId === null) return failed("INVALID_INPUT", "A system workspace identity could not be allocated", identity);
    return createGeneration(workspaceId, 1, null, identity, command, binding, options);
  }
  const predecessor = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === command.predecessorWorkspaceId && candidate.generation === command.predecessorGeneration
  );
  if (
    predecessor === undefined || predecessor.revision !== command.predecessorRevision || predecessor.status !== "cleaned" ||
    !generationMatchesOwner(predecessor, command)
  ) return failed("STALE_REVISION", "Workspace predecessor is absent, nonterminal, or stale", identity);
  return createGeneration(
    predecessor.workspaceId,
    predecessor.generation + 1,
    predecessor,
    identity,
    command,
    binding,
    options,
  );
}

function confirmationForCleanup(
  ingress: WorkspaceIngress,
  identity: PrepareIdentity,
  operation: WorkspaceOperation,
  generation: WorkspaceGenerationRecord | null,
): Readonly<{ confirmed: boolean; confirmationId: string | null }> {
  if (operation !== "cleanup" || generation === null) return Object.freeze({ confirmed: true, confirmationId: null });
  try {
    const confirmed = ingress.confirmHighRisk(Object.freeze({
      actorId: identity.actor.actorId,
      action: "workspace.cleanup" as const,
      requestId: identity.requestId,
      correlationId: identity.correlationId,
      workspaceId: generation.workspaceId,
      generation: generation.generation,
      generationRevision: generation.revision,
    })) === true;
    const confirmationId = confirmed ? nextIdentifier(ingress, "confirmation") : null;
    return Object.freeze({ confirmed: confirmed && confirmationId !== null, confirmationId });
  } catch {
    return Object.freeze({ confirmed: false, confirmationId: null });
  }
}

function mapPersistence(error: unknown, identity: Readonly<{ requestId: string; correlationId: string }> | null): WorkspaceApplicationFailure {
  if (error instanceof PersistenceError && error.code === "REVISION_CONFLICT") {
    return failed("STALE_FENCE", "Workspace revision, owner, or fence CAS is stale", identity);
  }
  return failed("PERSISTENCE_FAILURE", "Workspace persistence operation failed", identity);
}

function initialIntent(
  identity: PrepareIdentity,
  command: WorkspaceCommand,
  generation: WorkspaceGenerationRecord,
  confirmationId: string | null,
  options: WorkspaceApplicationOptions,
): WorkspaceOperationIntentRecord {
  const operation = operationFor(command);
  return Object.freeze({
    intentId: identity.intentId,
    operationId: identity.operationId,
    idempotencyKey: command.idempotencyKey,
    operationKind: operation,
    action: actionFor(operation),
    state: "pending" as const,
    revision: 1,
    actorId: identity.actor.actorId,
    requestId: identity.requestId,
    correlationId: identity.correlationId,
    causationId: commandCausation(command),
    currentAuthorizationDecisionId: identity.decisionId,
    authorizationBindingRevision: 1,
    confirmationId,
    workspaceId: generation.workspaceId,
    generation: generation.generation,
    expectedGenerationRevision: generation.revision,
    expectedGenerationStatus: generation.status,
    lastObservationNumber: 0,
    lastFailureCategory: null,
    lastFailureCode: null,
    lastFailureRetryable: null,
    lastFailureAmbiguous: null,
    contractId: WORKSPACE_CONTRACT_ID,
    adapterId: options.adapterId,
    adapterVersion: options.adapterVersion,
    createdAt: identity.now,
    updatedAt: identity.now,
  });
}

function stateAfterTransition(
  generation: WorkspaceGenerationRecord,
  status: WorkspaceGenerationStatus,
  updatedAt: string,
): WorkspaceGenerationRecord {
  return Object.freeze({ ...generation, status, revision: generation.revision + 1, updatedAt });
}

function effectStatus(operation: WorkspaceOperation, current: WorkspaceGenerationStatus): WorkspaceGenerationStatus {
  if (operation === "create") return "creating";
  if (operation === "cleanup") return "cleaning";
  return current;
}

function subjectFor(generation: WorkspaceGenerationRecord): WorkspaceSubject {
  return Object.freeze({
    projectId: generation.projectId,
    projectResourceRevision: generation.projectResourceRevision,
    projectConfigRevision: generation.projectConfigRevision,
    projectRootKey: generation.projectRootKey,
    taskId: generation.taskId,
    taskRevision: generation.taskRevision,
    runId: generation.runId,
    runRevision: generation.runRevision,
    memberId: generation.memberId,
    membershipRevision: generation.membershipRevision,
    memberRevision: generation.memberRevision,
    executionId: generation.executionId,
    executionRevision: generation.executionRevision,
    attemptNumber: generation.attemptNumber,
    fencingToken: generation.fencingToken,
    workspaceId: generation.workspaceId,
    generation: generation.generation,
    workspaceRevision: generation.revision,
    workspaceRootKey: generation.workspaceRootKey,
    creatorOperationId: generation.creatorOperationId,
    baseReference: generation.baseReference,
  });
}

function requestFor(prepared: PreparedOperation, generation: WorkspaceGenerationRecord): WorkspaceBackendRequest {
  return Object.freeze({
    contractId: WORKSPACE_CONTRACT_ID,
    operation: prepared.intent.operationKind,
    operationId: prepared.intent.operationId,
    idempotencyKey: prepared.intent.idempotencyKey,
    correlationId: prepared.intent.correlationId,
    causationId: prepared.intent.causationId,
    adapterId: prepared.intent.adapterId,
    adapterVersion: prepared.intent.adapterVersion,
    subject: subjectFor(generation),
  });
}

function receiptEchoes(receipt: WorkspaceBackendReceipt, request: WorkspaceBackendRequest): boolean {
  return receipt.operation === request.operation && receipt.operationId === request.operationId &&
    receipt.idempotencyKey === request.idempotencyKey && receipt.adapterId === request.adapterId &&
    receipt.adapterVersion === request.adapterVersion && receipt.workspaceId === request.subject.workspaceId &&
    receipt.generation === request.subject.generation && receipt.projectRootKey === request.subject.projectRootKey &&
    receipt.workspaceRootKey === request.subject.workspaceRootKey;
}

function evidenceFromObservation(observation: WorkspaceObservationRecord): WorkspaceReceiptEvidence {
  return Object.freeze({
    receiptId: observation.adapterReceiptId,
    externalState: observation.externalState,
    outcome: observation.outcome,
    code: observation.code,
    pathSafety: observation.pathSafety,
    ownershipMatch: observation.ownershipMatch,
    inventory: Object.freeze({
      trackedCount: observation.trackedCount,
      modifiedCount: observation.modifiedCount,
      untrackedCount: observation.untrackedCount,
      ignoredCount: observation.ignoredCount,
    }),
    evidenceReference: observation.evidenceReference,
    observedAt: observation.observedAt,
  });
}

function validatedRecoveryProof(
  state: ApplicationState,
  intent: WorkspaceOperationIntentRecord,
): WorkspaceRecoveryCausationProof | null {
  if (intent.operationKind !== "recover") return null;
  const prepareDecision = state.workspaceAuthorizationDecisions.find(
    (decision) => decision.operationId === intent.operationId && decision.bindingRevision === 1 && decision.phase === "prepare",
  );
  const actDecision = state.workspaceAuthorizationDecisions.find(
    (decision) => decision.operationId === intent.operationId && decision.bindingRevision === 2 && decision.phase === "act",
  );
  if (
    prepareDecision?.generationRevision === null || prepareDecision?.generationRevision === undefined ||
    actDecision?.generationRevision !== prepareDecision.generationRevision
  ) return null;
  return workspaceRecoveryCausationProof(
    Object.freeze({
      operationId: intent.operationId,
      workspaceId: intent.workspaceId,
      generation: intent.generation,
      recoveryRevision: prepareDecision.generationRevision,
      causationId: intent.causationId,
      createdAt: intent.createdAt,
    }),
    (operationId) => state.workspaceIntents.find((candidate) => candidate.operationId === operationId),
  );
}

function recoveredOperation(state: ApplicationState, intent: WorkspaceOperationIntentRecord): WorkspaceOperation | null {
  return validatedRecoveryProof(state, intent)?.rootOperation ?? null;
}

function finalStatus(
  state: ApplicationState,
  intent: WorkspaceOperationIntentRecord,
  generation: WorkspaceGenerationRecord,
  receipt: WorkspaceReceiptEvidence,
): WorkspaceGenerationStatus {
  const status = workspaceGenerationStatusAfterReceipt(
    intent.operationKind,
    receipt.code,
    receipt.outcome,
    receipt.externalState,
    generation.status,
    intent.operationKind === "recover" ? recoveredOperation(state, intent) : null,
  );
  if (status === null) throw new TypeError("Workspace receipt semantics are inconsistent");
  return status;
}

function transitionToAmbiguity(
  transaction: ApplicationTransaction,
  generation: WorkspaceGenerationRecord,
  operation: WorkspaceOperation,
  now: string,
): WorkspaceGenerationRecord {
  const target = workspaceAmbiguousGenerationStatus(operation, generation.status);
  if (target === generation.status) return generation;
  transaction.transitionWorkspaceGeneration(
    generation.workspaceId,
    generation.generation,
    generation.revision,
    generation.status,
    target,
    now,
  );
  return stateAfterTransition(generation, target, now);
}

function finalizationRecord(
  finalizationId: string,
  intent: WorkspaceOperationIntentRecord,
  authorizationDecisionId: string,
  outcome: WorkspaceFinalizationRecord["outcome"],
  code: string,
  generation: WorkspaceGenerationRecord,
  verifiedReceiptId: string | null,
  now: string,
): WorkspaceFinalizationRecord {
  return Object.freeze({
    finalizationId,
    intentId: intent.intentId,
    verifiedReceiptId,
    authorizationDecisionId,
    outcome,
    code,
    resultingGenerationStatus: generation.status,
    resultingGenerationRevision: generation.revision,
    finalizedAt: now,
  });
}

function backendFailure(
  category: Extract<WorkspaceBackendFailure["category"], "ambiguous_external_state" | "integrity_failure">,
  code: string,
): WorkspaceBackendFailure {
  return Object.freeze({
    category,
    code,
    retryable: false,
    ambiguous: true,
    retryAfter: null,
    evidenceReference: null,
  });
}

function backendFailureStatus(
  operation: WorkspaceOperation,
  generation: WorkspaceGenerationRecord,
  failure: WorkspaceBackendFailure,
): WorkspaceGenerationStatus {
  const status = workspaceGenerationStatusAfterFailure(
    operation,
    generation.status,
    failure.category,
    failure.retryable,
    failure.ambiguous,
  );
  if (status === null) throw new TypeError("Workspace failure semantics are inconsistent");
  return status;
}

function terminalAfterBackendFailure(
  store: PersistenceStore,
  ingress: WorkspaceIngress,
  prepared: PreparedOperation,
  failure: WorkspaceBackendFailure,
  hooks: WorkspaceApplicationTestHooks,
): WorkspaceApplicationResult<WorkspaceOperationView> {
  const finalizationId = nextIdentifier(ingress, "finalization");
  const eventId = nextIdentifier(ingress, "event");
  const terminalContext = trustedContext(ingress);
  const terminalNow = laterTimestamp(prepared.intent.updatedAt, terminalContext?.now ?? prepared.intent.updatedAt);
  if (finalizationId === null || eventId === null) return failed("INVALID_INPUT", "Trusted terminal identities could not be obtained", prepared.identity);
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const intent = state.workspaceIntents.find((candidate) => candidate.intentId === prepared.intent.intentId);
      const generation = state.workspaceGenerations.find((candidate) =>
        candidate.workspaceId === prepared.generation.workspaceId && candidate.generation === prepared.generation.generation
      );
      if (intent === undefined || generation === undefined || intent.state !== "executing") {
        return failed("RECONCILIATION_REQUIRED", "Workspace operation changed before backend failure could be recorded", prepared.identity);
      }
      const now = laterTimestamp(intent.updatedAt, terminalNow);
      const targetStatus = backendFailureStatus(intent.operationKind, generation, failure);
      let resulting = generation;
      if (targetStatus !== generation.status) {
        transaction.transitionWorkspaceGeneration(
          generation.workspaceId,
          generation.generation,
          generation.revision,
          generation.status,
          targetStatus,
          now,
        );
        resulting = stateAfterTransition(generation, targetStatus, now);
      }
      transaction.terminateWorkspaceIntent(
        intent.intentId,
        intent.revision,
        "executing",
        failure.ambiguous ? "ambiguous" : "failed",
        intent.currentAuthorizationDecisionId,
        intent.authorizationBindingRevision,
        intent.currentAuthorizationDecisionId,
        intent.authorizationBindingRevision,
        resulting.revision,
        resulting.status,
        Object.freeze({
          category: failure.category,
          code: failure.code,
          retryable: failure.retryable,
          ambiguous: failure.ambiguous,
        }),
        now,
      );
      transaction.insertWorkspaceFinalization(finalizationRecord(
        finalizationId,
        intent,
        intent.currentAuthorizationDecisionId,
        failure.ambiguous ? "ambiguous" : "failed",
        failure.code,
        resulting,
        null,
        now,
      ));
      transaction.insertWorkspaceEvent(workspaceEvent(
        eventId,
        { actor: prepared.identity.actor, now, correlationId: intent.correlationId },
        intent.operationId,
        intent.intentId,
        "workspace.operation.observed",
        failure.ambiguous ? "ambiguous" : "failed",
        failure.code,
        intent.causationId,
        resulting,
        null,
        failure.evidenceReference,
      ));
      hooks.afterWrite?.("backend-failure");
      const readback = transaction.read();
      const terminal = readback.workspaceIntents.find((candidate) => candidate.intentId === intent.intentId);
      if (terminal === undefined) throw new TypeError("Workspace terminal intent readback is absent");
      return succeeded(operationView(readback, terminal), terminal);
    });
    hooks.afterStage?.("backend-failure-recorded");
    return result;
  } catch (error) {
    return mapPersistence(error, prepared.identity);
  }
}

function completeObservedOperation(
  store: PersistenceStore,
  ingress: WorkspaceIngress,
  command: WorkspaceCommand,
  operation: WorkspaceOperation,
  identity: PrepareIdentity,
  prepared: PreparedOperation,
  executingGeneration: WorkspaceGenerationRecord,
  preflightBinding: OwnerBinding,
  receipt: WorkspaceReceiptEvidence,
  observationId: string,
  existingVerifiedReceiptId: string | null,
  hooks: WorkspaceApplicationTestHooks,
): WorkspaceApplicationResult<WorkspaceOperationView> {
  let verifiedReceiptId = existingVerifiedReceiptId;
  let verifiedIntent: WorkspaceOperationIntentRecord;
  if (verifiedReceiptId === null) {
    verifiedReceiptId = nextIdentifier(ingress, "verified_receipt");
    const verifiedEventId = nextIdentifier(ingress, "event");
    if (verifiedReceiptId === null || verifiedEventId === null) {
      return failed("RECONCILIATION_REQUIRED", "Observation is durable but trusted verification identities are unavailable", identity);
    }
    const verificationContext = trustedContext(ingress);
    const verificationNow = laterTimestamp(prepared.intent.updatedAt, verificationContext?.now ?? prepared.intent.updatedAt);
    try {
      verifiedIntent = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const intent = state.workspaceIntents.find((candidate) => candidate.intentId === prepared.intent.intentId);
        const observation = state.workspaceObservations.find((candidate) => candidate.observationId === observationId);
        const generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === executingGeneration.workspaceId && candidate.generation === executingGeneration.generation
        );
        if (intent === undefined || observation === undefined || generation === undefined || intent.state !== "observed") {
          throw new TypeError("Workspace verification lineage changed");
        }
        const now = laterTimestamp(intent.updatedAt, verificationNow);
        transaction.insertWorkspaceReceipt(Object.freeze({
          verifiedReceiptId: verifiedReceiptId!,
          intentId: intent.intentId,
          observationId: observation.observationId,
          observationNumber: observation.observationNumber,
          adapterReceiptId: observation.adapterReceiptId,
          receiptSha256: observation.receiptSha256,
          workspaceId: generation.workspaceId,
          generation: generation.generation,
          generationRevision: generation.revision,
          externalState: receipt.externalState,
          outcome: receipt.outcome === "refused" ? "refused" : "succeeded",
          code: receipt.code,
          verifiedAt: now,
        }));
        transaction.verifyWorkspaceIntent(intent.intentId, intent.revision, now);
        transaction.insertWorkspaceEvent(workspaceEvent(
          verifiedEventId,
          { actor: identity.actor, now, correlationId: intent.correlationId },
          intent.operationId,
          intent.intentId,
          "workspace.operation.verified",
          receipt.outcome === "refused" ? "refused" : "accepted",
          receipt.code,
          intent.causationId,
          generation,
          observation.observationNumber,
          receipt.evidenceReference,
        ));
        hooks.afterWrite?.("verified");
        return Object.freeze({ ...intent, state: "verified" as const, revision: intent.revision + 1, updatedAt: now });
      });
    } catch (error) {
      return mapPersistence(error, identity);
    }
    hooks.afterStage?.("verified");
  } else {
    let state: ApplicationState;
    try {
      state = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistence(error, identity);
    }
    const intent = state.workspaceIntents.find((candidate) => candidate.intentId === prepared.intent.intentId);
    const durableReceipt = state.workspaceReceipts.find((candidate) => candidate.verifiedReceiptId === verifiedReceiptId);
    if (
      intent === undefined || intent.state !== "verified" || durableReceipt === undefined ||
      durableReceipt.intentId !== intent.intentId || durableReceipt.observationId !== observationId
    ) return failed("RECONCILIATION_REQUIRED", "Verified workspace lineage changed before restart finalization", identity);
    verifiedIntent = intent;
  }

  const finalizeIdentity = phaseIdentity(ingress, identity.actor, verifiedIntent.updatedAt);
  const finalizationId = nextIdentifier(ingress, "finalization");
  if (finalizeIdentity === null || finalizationId === null) {
    return failed("RECONCILIATION_REQUIRED", "Verified workspace receipt requires explicit finalization recovery", identity);
  }
  let finalRuntimeFailure: WorkspaceApplicationFailure | null;
  try {
    finalRuntimeFailure = validateRuntime(readApplicationStateForOwner(store), identity.actor, preflightBinding.project, store);
  } catch (error) {
    return mapPersistence(error, identity);
  }
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const intent = state.workspaceIntents.find((candidate) => candidate.intentId === prepared.intent.intentId);
      const generation = state.workspaceGenerations.find((candidate) =>
        candidate.workspaceId === executingGeneration.workspaceId && candidate.generation === executingGeneration.generation
      );
      if (intent === undefined || generation === undefined || intent.state !== "verified") {
        return failed("RECONCILIATION_REQUIRED", "Workspace verification changed before finalization", identity);
      }
      const currentBinding = bindingFailure(state, command, finalizeIdentity.now);
      if (finalRuntimeFailure !== null || "ok" in currentBinding || !sameBinding(currentBinding, preflightBinding)) {
        const resulting = transitionToAmbiguity(transaction, generation, operation, finalizeIdentity.now);
        transaction.terminateWorkspaceIntent(
          intent.intentId, intent.revision, "verified", "ambiguous",
          intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
          intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
          resulting.revision, resulting.status,
          Object.freeze({ category: "ambiguous_external_state", code: "finalization_binding_changed", retryable: false, ambiguous: true }),
          finalizeIdentity.now,
        );
        transaction.insertWorkspaceFinalization(finalizationRecord(
          finalizationId, intent, intent.currentAuthorizationDecisionId, "ambiguous",
          "finalization_binding_changed", resulting, null, finalizeIdentity.now,
        ));
        transaction.insertWorkspaceEvent(workspaceEvent(
          finalizeIdentity.eventId,
          { ...finalizeIdentity, correlationId: intent.correlationId },
          intent.operationId,
          intent.intentId,
          "workspace.operation.denied",
          "ambiguous",
          "finalization_binding_changed",
          intent.causationId,
          resulting,
          intent.lastObservationNumber,
          receipt.evidenceReference,
        ));
      } else {
        const evaluation = authorization(
          state,
          finalizeIdentity.actor,
          finalizeIdentity.now,
          operation,
          currentBinding.project,
          operation !== "cleanup" || intent.confirmationId !== null,
        );
        if (!evaluation.allowed) {
          transaction.insertWorkspaceAuthorizationDecision(authorizationDecision(
            finalizeIdentity, intent.operationId, 3, "finalize", operation, evaluation, currentBinding, generation,
          ));
          const resulting = transitionToAmbiguity(transaction, generation, operation, finalizeIdentity.now);
          transaction.terminateWorkspaceIntent(
            intent.intentId, intent.revision, "verified", "ambiguous",
            intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
            finalizeIdentity.decisionId, 3, resulting.revision, resulting.status,
            Object.freeze({ category: "ambiguous_external_state", code: evaluation.reason, retryable: false, ambiguous: true }),
            finalizeIdentity.now,
          );
          transaction.insertWorkspaceFinalization(finalizationRecord(
            finalizationId, intent, finalizeIdentity.decisionId, "ambiguous",
            evaluation.reason, resulting, null, finalizeIdentity.now,
          ));
          transaction.insertWorkspaceEvent(workspaceEvent(
            finalizeIdentity.eventId,
            { ...finalizeIdentity, correlationId: intent.correlationId },
            intent.operationId,
            intent.intentId,
            "workspace.operation.denied",
            "denied",
            evaluation.reason,
            intent.causationId,
            resulting,
            intent.lastObservationNumber,
            receipt.evidenceReference,
          ));
        } else {
          const targetStatus = finalStatus(state, intent, generation, receipt);
          let resulting = generation;
          if (targetStatus !== generation.status) {
            transaction.transitionWorkspaceGeneration(
              generation.workspaceId,
              generation.generation,
              generation.revision,
              generation.status,
              targetStatus,
              finalizeIdentity.now,
            );
            resulting = stateAfterTransition(generation, targetStatus, finalizeIdentity.now);
          }
          transaction.insertWorkspaceAuthorizationDecision(authorizationDecision(
            finalizeIdentity, intent.operationId, 3, "finalize", operation, evaluation, currentBinding, resulting,
          ));
          transaction.finalizeWorkspaceIntent(
            intent.intentId,
            intent.revision,
            intent.currentAuthorizationDecisionId,
            intent.authorizationBindingRevision,
            finalizeIdentity.decisionId,
            3,
            resulting.revision,
            resulting.status,
            finalizeIdentity.now,
          );
          transaction.insertWorkspaceFinalization(finalizationRecord(
            finalizationId,
            intent,
            finalizeIdentity.decisionId,
            receipt.outcome,
            receipt.code,
            resulting,
            verifiedReceiptId,
            finalizeIdentity.now,
          ));
          transaction.insertWorkspaceEvent(workspaceEvent(
            finalizeIdentity.eventId,
            { ...finalizeIdentity, correlationId: intent.correlationId },
            intent.operationId,
            intent.intentId,
            intent.operationKind === "recover" ? "workspace.operation.reconciled" : "workspace.operation.finalized",
            receipt.outcome === "refused" ? "refused" : "accepted",
            receipt.code,
            intent.causationId,
            resulting,
            intent.lastObservationNumber,
            receipt.evidenceReference,
          ));
        }
      }
      hooks.afterWrite?.("finalized");
      const readback = transaction.read();
      const terminal = readback.workspaceIntents.find((candidate) => candidate.intentId === intent.intentId);
      if (terminal === undefined) throw new TypeError("Workspace finalization readback is absent");
      return succeeded(operationView(readback, terminal), terminal);
    });
    hooks.afterStage?.("finalized");
    return result;
  } catch (error) {
    return mapPersistence(error, identity);
  }
}

function createWorkspaceApplicationServiceInternal(
  store: PersistenceStore,
  backend: WorkspaceBackend,
  ingress: WorkspaceIngress,
  options: WorkspaceApplicationOptions,
  hooks: WorkspaceApplicationTestHooks,
): WorkspaceApplicationService {
  if (!operationIdentifier(options.adapterId) || !operationIdentifier(options.adapterVersion) || !operationIdentifier(options.workspaceRootKey)) {
    throw new TypeError("Workspace application options are invalid");
  }

  const execute = (value: unknown, operation: WorkspaceOperation): WorkspaceApplicationResult<WorkspaceOperationView> => {
    const command = parseCommand(value, operation);
    if (command === null) return failed("INVALID_INPUT", "Workspace command input is invalid");
    const context = trustedContext(ingress);
    if (context === null) return failed("INVALID_INPUT", "Trusted workspace ingress is invalid");
    let preflight: ApplicationState;
    try {
      preflight = readApplicationStateForOwner(store);
    } catch (error) {
      return mapPersistence(error, null);
    }
    const replay = preflight.workspaceIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
    if (replay !== undefined) {
      if (!replayMatches(preflight, replay, command, context.actor.actorId)) {
        return failed("IDEMPOTENCY_CONFLICT", "Workspace idempotency identity is bound to another operation", replay);
      }
    }
    const preflightBinding = bindingFailure(preflight, command, context.now);
    if ("ok" in preflightBinding) return preflightBinding;
    const runtimeFailure = validateRuntime(preflight, context.actor, preflightBinding.project, store);
    if (runtimeFailure !== null) return runtimeFailure;
    if (replay !== undefined && !unfinishedIntent(replay)) {
      return succeeded(operationView(preflight, replay), replay);
    }
    const identity = replay === undefined
      ? prepareIdentity(context, ingress)
      : replayPrepareIdentity(preflight, replay, context.actor);
    if (identity === null) return failed("INVALID_INPUT", "Trusted workspace operation identities could not be obtained");
    const replayGeneration = replay === undefined ? null : preflight.workspaceGenerations.find((candidate) =>
      candidate.workspaceId === replay.workspaceId && candidate.generation === replay.generation
    ) ?? null;
    if (replay !== undefined && replayGeneration === null) {
      return failed("PERSISTENCE_FAILURE", "Workspace replay generation is absent", identity);
    }
    const generatedWorkspaceId = replay === undefined && command.kind === "workspace.reserve" && command.predecessorWorkspaceId === null
      ? nextIdentifier(ingress, "workspace")
      : null;
    if (replay === undefined && command.kind === "workspace.reserve" && command.predecessorWorkspaceId === null && generatedWorkspaceId === null) {
      return failed("INVALID_INPUT", "Trusted workspace identity could not be obtained", identity);
    }
    const cleanupGeneration = replay === undefined && command.kind === "workspace.cleanup"
      ? generationForExisting(preflight, command)
      : null;
    if (cleanupGeneration !== null && "ok" in cleanupGeneration) {
      return Object.freeze({ ...cleanupGeneration, requestId: identity.requestId, correlationId: identity.correlationId });
    }
    const confirmation = replay === undefined
      ? confirmationForCleanup(ingress, identity, operation, cleanupGeneration)
      : Object.freeze({ confirmed: operation !== "cleanup" || replay.confirmationId !== null, confirmationId: replay.confirmationId });

    let prepared: PreparedOperation | WorkspaceApplicationResult<WorkspaceOperationView>;
    if (replay !== undefined && replayGeneration !== null) {
      prepared = Object.freeze({ identity, command, generation: replayGeneration, intent: replay });
    } else try {
      prepared = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const concurrentReplay = state.workspaceIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
        if (concurrentReplay !== undefined) return replayResult(state, concurrentReplay, command, context.actor.actorId);
        const currentBinding = bindingFailure(state, command, identity.now);
        if ("ok" in currentBinding) return Object.freeze({ ...currentBinding, requestId: identity.requestId, correlationId: identity.correlationId });
        if (!sameBinding(currentBinding, preflightBinding)) return failed("STALE_REVISION", "Workspace owner binding changed after preflight", identity);
        let generation: WorkspaceGenerationRecord | WorkspaceApplicationFailure;
        if (command.kind === "workspace.reserve") {
          generation = reserveGeneration(state, command, identity, currentBinding, generatedWorkspaceId, options);
        } else {
          generation = generationForExisting(state, command);
        }
        if ("ok" in generation) return Object.freeze({ ...generation, requestId: identity.requestId, correlationId: identity.correlationId });
        if (!requiredStatus(operation, generation.status)) return failed("INVALID_STATE", "Workspace generation is not in the required operation state", identity);
        if (operation === "recover") {
          const recoveryProof = workspaceRecoveryCausationProof(
            Object.freeze({
              operationId: identity.operationId,
              workspaceId: generation.workspaceId,
              generation: generation.generation,
              recoveryRevision: generation.revision,
              causationId: commandCausation(command),
              createdAt: identity.now,
            }),
            (operationId) => state.workspaceIntents.find((candidate) => candidate.operationId === operationId),
          );
          if (recoveryProof === null) {
            return failed(
              "RECONCILIATION_REQUIRED",
              "Workspace recovery causation is not bound to the current unresolved effect-capable operation",
              identity,
            );
          }
        }
        const evaluation = authorization(state, identity.actor, identity.now, operation, currentBinding.project, confirmation.confirmed);
        if (!evaluation.allowed) {
          transaction.insertWorkspaceAuthorizationDecision(authorizationDecision(
            identity,
            identity.operationId,
            1,
            "prepare",
            operation,
            evaluation,
            currentBinding,
            command.kind === "workspace.reserve" ? null : generation,
          ));
          transaction.insertWorkspaceEvent(workspaceEvent(
            identity.eventId,
            identity,
            identity.operationId,
            null,
            "workspace.operation.denied",
            "denied",
            evaluation.reason,
            commandCausation(command),
            command.kind === "workspace.reserve" ? null : generation,
            null,
            null,
          ));
          return failed("AUTHORIZATION_DENIED", "Current explicit authorization did not permit workspace preparation", identity);
        }
        if (
          command.kind === "workspace.reserve" &&
          !state.workspaceGenerations.some((candidate) =>
            candidate.workspaceId === generation.workspaceId && candidate.generation === generation.generation
          )
        ) transaction.insertWorkspaceGeneration(generation);
        transaction.insertWorkspaceAuthorizationDecision(authorizationDecision(
          identity,
          identity.operationId,
          1,
          "prepare",
          operation,
          evaluation,
          currentBinding,
          generation,
        ));
        const intent = initialIntent(identity, command, generation, confirmation.confirmationId, options);
        transaction.insertWorkspaceIntent(intent);
        transaction.insertWorkspaceEvent(workspaceEvent(
          identity.eventId,
          identity,
          identity.operationId,
          intent.intentId,
          "workspace.operation.prepared",
          "accepted",
          "prepared",
          intent.causationId,
          generation,
          null,
          null,
        ));
        hooks.afterWrite?.("prepared");
        return Object.freeze({ identity, command, generation, intent });
      });
    } catch (error) {
      return mapPersistence(error, identity);
    }
    if ("ok" in prepared) return prepared;
    if (replay === undefined) hooks.afterStage?.("prepared");

    let executingGeneration: WorkspaceGenerationRecord | WorkspaceApplicationFailure;
    if (replay?.state === "executing" || replay?.state === "observed" || replay?.state === "verified") {
      executingGeneration = prepared.generation;
    } else {
      const actIdentity = phaseIdentity(ingress, identity.actor, prepared.intent.updatedAt);
      const actFinalizationId = nextIdentifier(ingress, "finalization");
      if (actIdentity === null || actFinalizationId === null) {
        return failed("RECONCILIATION_REQUIRED", "Workspace operation was prepared but trusted act identities are unavailable", identity);
      }
      let actRuntimeFailure: WorkspaceApplicationFailure | null;
      try {
        const actState = readApplicationStateForOwner(store);
        const actProject = actState.projects.find((candidate) => candidate.projectId === command.projectId);
        actRuntimeFailure = actProject === undefined
          ? failed("PROJECT_NOT_FOUND", "Project disappeared before workspace act", identity)
          : validateRuntime(actState, actIdentity.actor, actProject, store);
      } catch (error) {
        return mapPersistence(error, identity);
      }
      try {
      executingGeneration = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const intent = state.workspaceIntents.find((candidate) => candidate.intentId === prepared.intent.intentId);
        const generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === prepared.generation.workspaceId && candidate.generation === prepared.generation.generation
        );
        if (intent === undefined || generation === undefined || intent.state !== "pending" || intent.revision !== 1) {
          return failed("RECONCILIATION_REQUIRED", "Workspace preparation changed before act", identity);
        }
        const currentBinding = bindingFailure(state, command, actIdentity.now);
        const staleBinding = "ok" in currentBinding ||
          !sameBinding(currentBinding, preflightBinding) || !generationMatchesOwner(generation, command);
        if (actRuntimeFailure !== null || staleBinding) {
          const failureCode = actRuntimeFailure === null ? "stale_owner_binding" : "act_runtime_identity_changed";
          transaction.terminateWorkspaceIntent(
            intent.intentId, intent.revision, "pending", "failed",
            intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
            intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
            generation.revision, generation.status,
            Object.freeze({ category: "stale_revision", code: failureCode, retryable: false, ambiguous: false }),
            actIdentity.now,
          );
          transaction.insertWorkspaceFinalization(finalizationRecord(
            actFinalizationId, intent, intent.currentAuthorizationDecisionId, "failed",
            failureCode, generation, null, actIdentity.now,
          ));
          transaction.insertWorkspaceEvent(workspaceEvent(
            actIdentity.eventId,
            { ...actIdentity, correlationId: intent.correlationId },
            intent.operationId,
            intent.intentId,
            "workspace.operation.denied",
            "failed",
            failureCode,
            intent.causationId,
            generation,
            null,
            null,
          ));
          return actRuntimeFailure ?? failed("STALE_FENCE", "Workspace owner binding changed before backend act", identity);
        }
        const evaluation = authorization(
          state,
          actIdentity.actor,
          actIdentity.now,
          operation,
          currentBinding.project,
          operation !== "cleanup" || intent.confirmationId !== null,
        );
        if (!evaluation.allowed) {
          transaction.insertWorkspaceAuthorizationDecision(authorizationDecision(
            actIdentity, intent.operationId, 2, "act", operation, evaluation, currentBinding, generation,
          ));
          transaction.terminateWorkspaceIntent(
            intent.intentId, intent.revision, "pending", "failed",
            intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
            actIdentity.decisionId, 2, generation.revision, generation.status,
            Object.freeze({ category: "unauthorized", code: evaluation.reason, retryable: false, ambiguous: false }),
            actIdentity.now,
          );
          transaction.insertWorkspaceFinalization(finalizationRecord(
            actFinalizationId, intent, actIdentity.decisionId, "failed", evaluation.reason,
            generation, null, actIdentity.now,
          ));
          transaction.insertWorkspaceEvent(workspaceEvent(
            actIdentity.eventId,
            { ...actIdentity, correlationId: intent.correlationId },
            intent.operationId,
            intent.intentId,
            "workspace.operation.denied",
            "denied",
            evaluation.reason,
            intent.causationId,
            generation,
            null,
            null,
          ));
          return failed("AUTHORIZATION_DENIED", "Current explicit authorization did not permit workspace act", identity);
        }
        let effectGeneration = generation;
        if (operation === "reserve" || operation === "create" || operation === "cleanup") {
          const status = effectStatus(operation, generation.status);
          transaction.transitionWorkspaceGeneration(
            generation.workspaceId,
            generation.generation,
            generation.revision,
            generation.status,
            status,
            actIdentity.now,
          );
          effectGeneration = stateAfterTransition(generation, status, actIdentity.now);
        }
        transaction.insertWorkspaceAuthorizationDecision(authorizationDecision(
          actIdentity,
          intent.operationId,
          2,
          "act",
          operation,
          evaluation,
          currentBinding,
          effectGeneration,
        ));
        transaction.startWorkspaceIntent(
          intent.intentId,
          intent.revision,
          intent.currentAuthorizationDecisionId,
          intent.authorizationBindingRevision,
          actIdentity.decisionId,
          2,
          effectGeneration.revision,
          effectGeneration.status,
          actIdentity.now,
        );
        transaction.insertWorkspaceEvent(workspaceEvent(
          actIdentity.eventId,
          { ...actIdentity, correlationId: intent.correlationId },
          intent.operationId,
          intent.intentId,
          "workspace.operation.executing",
          "accepted",
          "executing",
          intent.causationId,
          effectGeneration,
          null,
          null,
        ));
        hooks.afterWrite?.("executing");
        return effectGeneration;
      });
      } catch (error) {
        return mapPersistence(error, identity);
      }
      if ("ok" in executingGeneration) return executingGeneration;
      hooks.afterStage?.("executing");
    }

    if (replay?.state === "executing" && operation !== "inspect" && operation !== "recover") {
      return terminalAfterBackendFailure(
        store,
        ingress,
        Object.freeze({ ...prepared, generation: executingGeneration }),
        backendFailure("ambiguous_external_state", "restart_effect_unknown"),
        hooks,
      );
    }

    const preparedOperation: PreparedOperation = Object.freeze({ ...prepared, generation: executingGeneration });
    if (replay?.state === "observed" || replay?.state === "verified") {
      let restartState: ApplicationState;
      try {
        restartState = readApplicationStateForOwner(store);
      } catch (error) {
        return mapPersistence(error, identity);
      }
      const restartIntent = restartState.workspaceIntents.find((candidate) => candidate.intentId === replay.intentId);
      const observation = restartState.workspaceObservations.find((candidate) =>
        candidate.intentId === replay.intentId && candidate.observationNumber === replay.lastObservationNumber
      );
      const verifiedReceipt = replay.state === "verified"
        ? restartState.workspaceReceipts.find((candidate) => candidate.intentId === replay.intentId)
        : undefined;
      if (
        restartIntent === undefined || observation === undefined ||
        (replay.state === "verified" && verifiedReceipt === undefined)
      ) return failed("RECONCILIATION_REQUIRED", "Workspace restart evidence is incomplete", identity);
      return completeObservedOperation(
        store,
        ingress,
        command,
        operation,
        identity,
        Object.freeze({ ...preparedOperation, intent: restartIntent }),
        executingGeneration,
        preflightBinding,
        evidenceFromObservation(observation),
        observation.observationId,
        verifiedReceipt?.verifiedReceiptId ?? null,
        hooks,
      );
    }
    const request = parseWorkspaceBackendRequest(requestFor(preparedOperation, executingGeneration));
    if (request === null) {
      return terminalAfterBackendFailure(
        store,
        ingress,
        preparedOperation,
        backendFailure("integrity_failure", "invalid_internal_request"),
        hooks,
      );
    }
    let rawResult: unknown;
    try {
      rawResult = invokeWorkspaceBackend(backend, request);
      hooks.afterStage?.("backend-returned");
    } catch {
      return terminalAfterBackendFailure(
        store,
        ingress,
        preparedOperation,
        backendFailure("ambiguous_external_state", "backend_response_unavailable"),
        hooks,
      );
    }
    const parsedResult = parseWorkspaceBackendResult(rawResult);
    if (parsedResult === null) {
      return terminalAfterBackendFailure(
        store,
        ingress,
        preparedOperation,
        backendFailure("integrity_failure", "malformed_backend_result"),
        hooks,
      );
    }
    if (!parsedResult.ok) return terminalAfterBackendFailure(store, ingress, preparedOperation, parsedResult.error, hooks);
    if (!receiptEchoes(parsedResult.receipt, request)) {
      return terminalAfterBackendFailure(
        store,
        ingress,
        preparedOperation,
        backendFailure("integrity_failure", "receipt_binding_mismatch"),
        hooks,
      );
    }

    const receipt = parsedResult.receipt;
    const observationId = nextIdentifier(ingress, "observation");
    const observationEventId = nextIdentifier(ingress, "event");
    const ambiguousFinalizationId = receipt.outcome === "ambiguous" ? nextIdentifier(ingress, "finalization") : null;
    if (observationId === null || observationEventId === null || (receipt.outcome === "ambiguous" && ambiguousFinalizationId === null)) {
      return failed("RECONCILIATION_REQUIRED", "Backend returned but trusted observation identities are unavailable", identity);
    }
    const receiptSha256 = sha256(canonicalJson(receipt));
    const observationContext = trustedContext(ingress);
    const observationNow = laterTimestamp(executingGeneration.updatedAt, observationContext?.now ?? executingGeneration.updatedAt);
    let observed: WorkspaceApplicationResult<WorkspaceOperationView> | WorkspaceOperationIntentRecord;
    try {
      observed = withApplicationTransaction(store, (transaction) => {
        const state = transaction.read();
        const intent = state.workspaceIntents.find((candidate) => candidate.intentId === prepared.intent.intentId);
        const generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === executingGeneration.workspaceId && candidate.generation === executingGeneration.generation
        );
        if (intent === undefined || generation === undefined || intent.state !== "executing") {
          return failed("RECONCILIATION_REQUIRED", "Workspace operation changed before observation", identity);
        }
        const now = laterTimestamp(intent.updatedAt, observationNow);
        transaction.insertWorkspaceObservation(Object.freeze({
          observationId,
          intentId: intent.intentId,
          observationNumber: intent.lastObservationNumber + 1,
          adapterReceiptId: receipt.receiptId,
          receiptSha256,
          authorizationDecisionId: intent.currentAuthorizationDecisionId,
          externalState: receipt.externalState,
          outcome: receipt.outcome,
          code: receipt.code,
          pathSafety: receipt.pathSafety,
          ownershipMatch: receipt.ownershipMatch,
          trackedCount: receipt.inventory.trackedCount,
          modifiedCount: receipt.inventory.modifiedCount,
          untrackedCount: receipt.inventory.untrackedCount,
          ignoredCount: receipt.inventory.ignoredCount,
          evidenceReference: receipt.evidenceReference,
          observedAt: receipt.observedAt,
        }));
        if (receipt.outcome === "ambiguous") {
          const resulting = transitionToAmbiguity(transaction, generation, operation, now);
          transaction.observeWorkspaceIntent(
            intent.intentId,
            intent.revision,
            "ambiguous",
            intent.lastObservationNumber + 1,
            resulting.revision,
            resulting.status,
            null,
            now,
          );
          transaction.insertWorkspaceFinalization(finalizationRecord(
            ambiguousFinalizationId!, intent, intent.currentAuthorizationDecisionId,
            "ambiguous", receipt.code, resulting, null, now,
          ));
          transaction.insertWorkspaceEvent(workspaceEvent(
            observationEventId,
            { actor: identity.actor, now, correlationId: intent.correlationId },
            intent.operationId,
            intent.intentId,
            "workspace.operation.observed",
            "ambiguous",
            receipt.code,
            intent.causationId,
            resulting,
            intent.lastObservationNumber + 1,
            receipt.evidenceReference,
          ));
          hooks.afterWrite?.("observed");
          const readback = transaction.read();
          const terminal = readback.workspaceIntents.find((candidate) => candidate.intentId === intent.intentId);
          if (terminal === undefined) throw new TypeError("Workspace ambiguous intent readback is absent");
          return succeeded(operationView(readback, terminal), terminal);
        }
        transaction.observeWorkspaceIntent(
          intent.intentId,
          intent.revision,
          "observed",
          intent.lastObservationNumber + 1,
          generation.revision,
          generation.status,
          null,
          now,
        );
        transaction.insertWorkspaceEvent(workspaceEvent(
          observationEventId,
          { actor: identity.actor, now, correlationId: intent.correlationId },
          intent.operationId,
          intent.intentId,
          "workspace.operation.observed",
          receipt.outcome === "refused" ? "refused" : "accepted",
          receipt.code,
          intent.causationId,
          generation,
          intent.lastObservationNumber + 1,
          receipt.evidenceReference,
        ));
        hooks.afterWrite?.("observed");
        return Object.freeze({
          ...intent,
          state: "observed" as const,
          revision: intent.revision + 1,
          lastObservationNumber: intent.lastObservationNumber + 1,
          updatedAt: now,
        });
      });
    } catch (error) {
      return mapPersistence(error, identity);
    }
    hooks.afterStage?.("observed");
    if ("ok" in observed) return observed;

    return completeObservedOperation(
      store,
      ingress,
      command,
      operation,
      identity,
      Object.freeze({ ...preparedOperation, intent: observed }),
      executingGeneration,
      preflightBinding,
      receipt,
      observationId,
      null,
      hooks,
    );
  };

  return Object.freeze({
    reserve: (command: WorkspaceReserveCommand) => execute(command, "reserve"),
    create: (command: WorkspaceCreateCommand) => execute(command, "create"),
    inspect: (command: WorkspaceInspectCommand) => execute(command, "inspect"),
    recover: (command: WorkspaceRecoverCommand) => execute(command, "recover"),
    cleanup: (command: WorkspaceCleanupCommand) => execute(command, "cleanup"),
  });
}

export function createWorkspaceApplicationService(
  store: PersistenceStore,
  backend: WorkspaceBackend,
  ingress: WorkspaceIngress,
  options: WorkspaceApplicationOptions,
): WorkspaceApplicationService {
  return createWorkspaceApplicationServiceInternal(store, backend, ingress, options, Object.freeze({}));
}

export function createWorkspaceApplicationServiceWithHooks(
  store: PersistenceStore,
  backend: WorkspaceBackend,
  ingress: WorkspaceIngress,
  options: WorkspaceApplicationOptions,
  hooks: WorkspaceApplicationTestHooks,
): WorkspaceApplicationService {
  return createWorkspaceApplicationServiceInternal(store, backend, ingress, options, hooks);
}
