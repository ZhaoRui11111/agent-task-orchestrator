import {
  evaluateAuthorization,
  type AuthorizationAction,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import type { TrustedActorAssertion } from "./application.ts";
import { transitionTask } from "./domain.ts";
import { validateTrustedRuntimeAndActor } from "./execution-application.ts";
import { revalidateProjectRoot } from "./project-registry.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationAuditRecord,
  type ApplicationRequestRecord,
  type ApplicationState,
  type ApplicationTransaction,
  type AuthorizationDecisionRecord,
  type CompletionGateAuthorizationDecisionRecord,
  type CompletionGateEventRecord,
  type CompletionGateIntentRecord,
  type CompletionGateObservationRecord,
  type CompletionGateOperationKind,
  type CompletionGateRequestRecord,
  type IntegrationAuthorizationDecisionRecord,
  type IntegrationEventRecord,
  type IntegrationIntentRecord,
  type IntegrationObservationRecord,
  type IntegrationOperationKind,
  type IntegrationReservationRecord,
  type ProjectPolicyReceiptRecord,
  type RegisteredProject,
  type WorkspaceAuthorizationDecisionRecord,
  type WorkspaceEventRecord,
  type WorkspaceFinalizationRecord,
  type WorkspaceGenerationRecord,
  type WorkspaceObservationRecord,
  type WorkspaceOperationIntentRecord,
  type WorkspaceVerifiedReceiptRecord,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";
import {
  COMPLETION_CONTRACT_ID,
  parseCompletionBackendRequest,
  parseCompletionBackendResult,
  type CompletionBackend,
  type CompletionBackendFailure,
  type CompletionBackendReceipt,
  type CompletionBackendRequest,
  type CompletionGateSubject,
} from "./completion-port.ts";
import {
  INTEGRATION_CONTRACT_ID,
  parseIntegrationBackendRequest,
  parseIntegrationBackendResult,
  type IntegrationBackend,
  type IntegrationBackendFailure,
  type IntegrationBackendReceipt,
  type IntegrationSubject,
} from "./integration-port.ts";
import {
  PROJECT_POLICY_CONTRACT_ID,
  parseProjectPolicyFacts,
  parseProjectPolicyRequest,
  parseProjectPolicyResult,
  type CleanupPolicySubject,
  type CompletionPolicySubject,
  type IntegrationPolicySubject,
  type ProjectPolicy,
  type ProjectPolicyFacts,
  type ProjectPolicyOperation,
  type ProjectPolicyReceipt,
  type ProjectPolicyRequest,
} from "./project-policy-port.ts";
import {
  WORKSPACE_CLEANUP_ATTESTATION_CONTRACT_ID,
  WORKSPACE_CONTRACT_ID,
  invokeWorkspaceBackend,
  parseWorkspaceCleanupAttestation,
  parseWorkspaceBackendRequest,
  parseWorkspaceBackendResult,
  workspaceCleanupAttestationSha256,
  workspaceCleanupQuiescenceSha256,
  type WorkspaceBackend,
  type WorkspaceBackendFailure,
  type WorkspaceBackendReceipt,
  type WorkspaceCleanupAttestation,
  type WorkspaceCleanupQuiescence,
} from "./workspace-port.ts";
import { workspaceSubjectForGeneration } from "./workspace-application.ts";

export const PHASE3_APPLICATION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "CONFIRMATION_REQUIRED",
  "PROJECT_NOT_FOUND",
  "PROJECT_DISABLED",
  "PROJECT_IDENTITY_CHANGED",
  "TASK_NOT_FOUND",
  "EXECUTION_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
  "POLICY_NOT_FOUND",
  "POLICY_DENIED",
  "POLICY_DEFERRED",
  "IDEMPOTENCY_CONFLICT",
  "STALE_REVISION",
  "STALE_FENCE",
  "INVALID_STATE",
  "EVIDENCE_STALE",
  "RECONCILIATION_REQUIRED",
  "BACKEND_FAILURE",
  "PERSISTENCE_FAILURE",
] as const);

export type Phase3ApplicationErrorCode = (typeof PHASE3_APPLICATION_ERROR_CODES)[number];

export interface Phase3ApplicationError {
  readonly code: Phase3ApplicationErrorCode;
  readonly message: string;
}

export type Phase3ApplicationResult<T> =
  | Readonly<{ readonly ok: true; readonly value: T; readonly requestId: string; readonly correlationId: string; readonly replayed: boolean }>
  | Readonly<{ readonly ok: false; readonly error: Phase3ApplicationError; readonly requestId: string | null; readonly correlationId: string | null }>;

export type Phase3IngressIdKind = "request" | "correlation" | "decision" | "audit" | "policy_query" |
  "operation" | "intent" | "event" | "observation" | "verified_receipt" | "finalization" |
  "reservation" | "completion" | "confirmation" | "attestation";

export interface Phase3ConfirmationRequest {
  readonly actorId: string;
  readonly action: Extract<AuthorizationAction, "completion.accept" | "integration.apply" | "integration.push" | "workspace.cleanup">;
  readonly requestId: string;
  readonly correlationId: string;
  readonly targetId: string;
  readonly targetRevision: number;
}

export interface Phase3Ingress {
  currentActor(): TrustedActorAssertion;
  currentIntegrationLeaseOwner(): string;
  now(): string;
  nextId(kind: Phase3IngressIdKind): string;
  confirmHighRisk(request: Phase3ConfirmationRequest): string | null;
  beforeCleanupPointOfUse?(): void;
}

export interface Phase3ApplicationOptions {
  readonly policyId: string;
  readonly policyKey: string;
  readonly policyAdapterId: string;
  readonly policyAdapterVersion: string;
  readonly completionAdapterId: string;
  readonly completionAdapterVersion: string;
  readonly completionEvidenceRootKey: string;
  readonly gateTimeoutMs: number;
  readonly integrationAdapterId: string;
  readonly integrationAdapterVersion: string;
  readonly integrationTargetReference: string;
  readonly integrationExpectedTargetObjectId: string;
  readonly integrationDestinationIdentity: string;
  readonly integrationDestinationReference: string;
  readonly integrationExpectedRemoteHead: string | null;
  readonly integrationReservationLeaseSeconds: number;
  readonly workspaceAdapterId: string;
  readonly workspaceAdapterVersion: string;
  readonly cleanupAttestationValiditySeconds: number;
}

export interface Phase3BindingCommand {
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly executionId: string;
  readonly expectedExecutionRevision: number;
  readonly expectedAttemptNumber: number;
  readonly expectedFencingToken: number;
  readonly workspaceId: string;
  readonly expectedGeneration: number;
  readonly expectedWorkspaceRevision: number;
}

export interface EvaluateCompletionPolicyCommand extends Phase3BindingCommand {
  readonly kind: "policy.completion_requirements";
}

export interface EvaluateIntegrationPolicyCommand extends Phase3BindingCommand {
  readonly kind: "policy.evaluate_integration";
}

export interface EvaluateCleanupPolicyCommand extends Phase3BindingCommand {
  readonly kind: "policy.evaluate_cleanup";
}

export interface RunCompletionGateCommand extends Phase3BindingCommand {
  readonly kind: "completion.gate.run";
  readonly policyReceiptId: string;
  readonly gateId: string;
  readonly gateVersion: string;
  readonly idempotencyKey: string;
}

export interface InspectCompletionGateCommand extends Phase3BindingCommand {
  readonly kind: "completion.gate.inspect";
  readonly policyReceiptId: string;
  readonly gateOperationId: string;
  readonly idempotencyKey: string;
}

export interface CancelCompletionGateCommand extends Phase3BindingCommand {
  readonly kind: "completion.gate.cancel";
  readonly policyReceiptId: string;
  readonly gateOperationId: string;
  readonly idempotencyKey: string;
}

export interface ReserveIntegrationCommand extends Phase3BindingCommand {
  readonly kind: "integration.reserve";
  readonly policyReceiptId: string;
  readonly idempotencyKey: string;
}

export interface IntegrationReservationCommand {
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly reservationId: string;
  readonly expectedReservationRevision: number;
  readonly expectedLeaseRevision: number;
  readonly expectedFencingToken: number;
  readonly idempotencyKey: string;
}

export interface InspectIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.inspect" }
export interface RenewIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.lease.renew" }
export interface TakeoverIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.lease.takeover" }
export interface ApplyIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.apply" }
export interface PushIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.push" }
export interface RecoverIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.recover"; readonly intentId: string }
export interface ReleaseIntegrationCommand extends IntegrationReservationCommand { readonly kind: "integration.release" }

export interface AcceptPolicyGatedCompletionCommand extends Phase3BindingCommand {
  readonly kind: "completion.accept";
  readonly policyReceiptId: string;
  readonly idempotencyKey: string;
}

export interface CleanupWorkspaceCommand extends Phase3BindingCommand {
  readonly kind: "workspace.cleanup";
  readonly policyReceiptId: string;
  readonly idempotencyKey: string;
}

export interface ProjectPolicyView {
  readonly receiptId: string;
  readonly operation: ProjectPolicyOperation;
  readonly decision: "allow" | "deny" | "defer";
  readonly reasonCode: string;
  readonly facts: ProjectPolicyFacts;
  readonly validUntil: string | null;
  readonly receiptSha256: string;
}

export interface CompletionGateView {
  readonly operationId: string;
  readonly intentId: string;
  readonly gateOperationId: string;
  readonly state: CompletionGateIntentRecord["state"];
  readonly outcome: "accepted" | "refused" | "ambiguous" | "failed" | null;
  readonly code: string | null;
  readonly verdict: "pass" | "fail" | null;
  readonly observationNumber: number;
  readonly evidenceReference: string | null;
}

export interface IntegrationReservationView {
  readonly reservationId: string;
  readonly revision: number;
  readonly status: IntegrationReservationRecord["status"];
  readonly leaseRevision: number;
  readonly fencingToken: number;
  readonly expiresAt: string;
  readonly currentEvidenceSha256: string | null;
}

export interface IntegrationOperationView extends IntegrationReservationView {
  readonly operationId: string | null;
  readonly intentId: string | null;
  readonly operation: "inspect" | "apply" | "push" | null;
  readonly intentState: IntegrationIntentRecord["state"] | null;
  readonly outcome: "succeeded" | "refused" | "ambiguous" | "failed" | null;
  readonly code: string | null;
  readonly observationNumber: number;
  readonly evidenceReference: string | null;
}

export interface PolicyGatedCompletionView {
  readonly completionDecisionId: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly executionId: string;
  readonly executionTerminalCreatedAt: string;
  readonly gateSetSha256: string;
  readonly integrationEvidenceSha256: string;
  readonly preservationStateSha256: string;
}

export interface WorkspaceCleanupView {
  readonly operationId: string;
  readonly intentId: string;
  readonly state: WorkspaceOperationIntentRecord["state"];
  readonly outcome: WorkspaceFinalizationRecord["outcome"] | null;
  readonly code: string | null;
  readonly workspaceId: string;
  readonly generation: number;
  readonly workspaceRevision: number;
  readonly workspaceStatus: WorkspaceGenerationRecord["status"];
  readonly attestationSha256: string | null;
  readonly evidenceReference: string | null;
}

export interface Phase3ApplicationService {
  evaluateCompletionPolicy(command: EvaluateCompletionPolicyCommand): Promise<Phase3ApplicationResult<ProjectPolicyView>>;
  evaluateIntegrationPolicy(command: EvaluateIntegrationPolicyCommand): Promise<Phase3ApplicationResult<ProjectPolicyView>>;
  evaluateCleanupPolicy(command: EvaluateCleanupPolicyCommand): Promise<Phase3ApplicationResult<ProjectPolicyView>>;
  runGate(command: RunCompletionGateCommand): Promise<Phase3ApplicationResult<CompletionGateView>>;
  inspectGate(command: InspectCompletionGateCommand): Promise<Phase3ApplicationResult<CompletionGateView>>;
  cancelGate(command: CancelCompletionGateCommand): Promise<Phase3ApplicationResult<CompletionGateView>>;
  reserveIntegration(command: ReserveIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationReservationView>>;
  renewIntegration(command: RenewIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationReservationView>>;
  takeoverIntegration(command: TakeoverIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationReservationView>>;
  inspectIntegration(command: InspectIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationOperationView>>;
  applyIntegration(command: ApplyIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationOperationView>>;
  pushIntegration(command: PushIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationOperationView>>;
  recoverIntegration(command: RecoverIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationOperationView>>;
  releaseIntegration(command: ReleaseIntegrationCommand): Promise<Phase3ApplicationResult<IntegrationReservationView>>;
  acceptCompletion(command: AcceptPolicyGatedCompletionCommand): Promise<Phase3ApplicationResult<PolicyGatedCompletionView>>;
  cleanupWorkspace(command: CleanupWorkspaceCommand): Promise<Phase3ApplicationResult<WorkspaceCleanupView>>;
}

interface TrustedContext {
  readonly actor: TrustedActorAssertion;
  readonly leaseOwnerId: string;
  readonly now: string;
}

interface OperationIdentity extends TrustedContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly auditId: string;
  readonly operationId: string;
  readonly eventId: string;
}

interface BoundPhase3 {
  readonly project: RegisteredProject;
  readonly task: ApplicationState["domain"]["tasks"][number];
  readonly execution: ApplicationState["executions"][number];
  readonly workspace: WorkspaceGenerationRecord;
  readonly workspaceReceipt: WorkspaceVerifiedReceiptRecord;
}

function identifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
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

function sha1(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

function sha256Value(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
}

function failure<T>(
  code: Phase3ApplicationErrorCode,
  message: string,
  identity: Pick<OperationIdentity, "requestId" | "correlationId"> | null = null,
): Phase3ApplicationResult<T> {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ code, message }),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}

function success<T>(value: T, identity: Pick<OperationIdentity, "requestId" | "correlationId">, replayed = false): Phase3ApplicationResult<T> {
  return Object.freeze({ ok: true as const, value, requestId: identity.requestId, correlationId: identity.correlationId, replayed });
}

function safeContext(ingress: Phase3Ingress): TrustedContext | null {
  try {
    const actor = ingress.currentActor();
    const leaseOwnerId = ingress.currentIntegrationLeaseOwner();
    const now = ingress.now();
    if (typeof actor !== "object" || actor === null || !identifier(actor.actorId) ||
        !sha256Value(actor.principal) || !identifier(leaseOwnerId) || !timestamp(now)) return null;
    return Object.freeze({ actor: Object.freeze({ actorId: actor.actorId, principal: actor.principal }), leaseOwnerId, now });
  } catch {
    return null;
  }
}

function nextId(ingress: Phase3Ingress, kind: Phase3IngressIdKind): string | null {
  try {
    const value = ingress.nextId(kind);
    return identifier(value) ? value : null;
  } catch {
    return null;
  }
}

function operationIdentity(ingress: Phase3Ingress, context: TrustedContext): OperationIdentity | null {
  const requestId = nextId(ingress, "request");
  const correlationId = nextId(ingress, "correlation");
  const decisionId = nextId(ingress, "decision");
  const auditId = nextId(ingress, "audit");
  const operationId = nextId(ingress, "operation");
  const eventId = nextId(ingress, "event");
  return requestId === null || correlationId === null || decisionId === null || auditId === null ||
    operationId === null || eventId === null ? null : Object.freeze({
      ...context, requestId, correlationId, decisionId, auditId, operationId, eventId,
    });
}

function afterTimestamp(previous: string, candidate: string): string {
  return candidate > previous ? candidate : new Date(new Date(previous).valueOf() + 1).toISOString();
}

function validOptions(value: Phase3ApplicationOptions): boolean {
  return identifier(value.policyId) && identifier(value.policyKey) && identifier(value.policyAdapterId) &&
    identifier(value.policyAdapterVersion) && identifier(value.completionAdapterId) &&
    identifier(value.completionAdapterVersion) && identifier(value.completionEvidenceRootKey) &&
    revision(value.gateTimeoutMs) && value.gateTimeoutMs <= 3_600_000 && identifier(value.integrationAdapterId) &&
    identifier(value.integrationAdapterVersion) && identifier(value.integrationTargetReference, 255) &&
    sha1(value.integrationExpectedTargetObjectId) && identifier(value.integrationDestinationIdentity) &&
    identifier(value.integrationDestinationReference, 255) &&
    (value.integrationExpectedRemoteHead === null || sha1(value.integrationExpectedRemoteHead)) &&
    revision(value.integrationReservationLeaseSeconds) && value.integrationReservationLeaseSeconds <= 86_400 &&
    identifier(value.workspaceAdapterId) &&
    identifier(value.workspaceAdapterVersion) && revision(value.cleanupAttestationValiditySeconds) &&
    value.cleanupAttestationValiditySeconds <= 300;
}

function validBindingCommand(value: Phase3BindingCommand): boolean {
  return typeof value === "object" && value !== null && identifier(value.projectId, 1024) &&
    revision(value.expectedProjectResourceRevision) && revision(value.expectedProjectConfigRevision) &&
    identifier(value.taskId, 1024) && revision(value.expectedTaskRevision) && identifier(value.executionId) &&
    revision(value.expectedExecutionRevision) && revision(value.expectedAttemptNumber) &&
    revision(value.expectedFencingToken) && identifier(value.workspaceId) && revision(value.expectedGeneration) &&
    revision(value.expectedWorkspaceRevision);
}

function latestWorkspaceReceipt(
  state: ApplicationState,
  workspace: WorkspaceGenerationRecord,
  readyRevision: number,
): WorkspaceVerifiedReceiptRecord | null {
  const candidates = state.workspaceReceipts.filter((receipt) => receipt.workspaceId === workspace.workspaceId &&
    receipt.generation === workspace.generation && receipt.outcome === "succeeded" && receipt.externalState === "complete" &&
    state.workspaceFinalizations.some((finalization) => finalization.verifiedReceiptId === receipt.verifiedReceiptId &&
      finalization.resultingGenerationStatus === "ready" && finalization.resultingGenerationRevision === readyRevision));
  let selected: WorkspaceVerifiedReceiptRecord | null = null;
  for (const candidate of candidates) {
    if (selected === null || candidate.verifiedAt >= selected.verifiedAt) selected = candidate;
  }
  return selected;
}

function bindPhase3(
  state: ApplicationState,
  command: Phase3BindingCommand,
  expectedWorkspaceStatus: "ready" | "cleaning" = "ready",
): BoundPhase3 | Phase3ApplicationResult<never> {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failure("PROJECT_NOT_FOUND", "Project is absent");
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
      project.configRevision !== command.expectedProjectConfigRevision) return failure("STALE_REVISION", "Project binding is stale");
  if (state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled !== true) {
    return failure("PROJECT_DISABLED", "Project is disabled");
  }
  const task = state.domain.tasks.find((candidate) => candidate.id === command.taskId);
  if (task === undefined) return failure("TASK_NOT_FOUND", "Task is absent");
  if (task.revision !== command.expectedTaskRevision) return failure("STALE_REVISION", "Task revision is stale");
  const execution = state.executions.find((candidate) => candidate.executionId === command.executionId);
  if (execution === undefined) return failure("EXECUTION_NOT_FOUND", "Execution is absent");
  if (execution.taskId !== task.id || execution.revision !== command.expectedExecutionRevision ||
      execution.attemptNumber !== command.expectedAttemptNumber || execution.fencingToken !== command.expectedFencingToken ||
      execution.projectResourceRevision !== project.resourceRevision || execution.projectConfigRevision !== project.configRevision) {
    return failure("STALE_FENCE", "Execution identity or fence is stale");
  }
  const workspace = state.workspaceGenerations.find((candidate) => candidate.workspaceId === command.workspaceId &&
    candidate.generation === command.expectedGeneration);
  if (workspace === undefined) return failure("WORKSPACE_NOT_FOUND", "Workspace generation is absent");
  if (workspace.revision !== command.expectedWorkspaceRevision || workspace.projectId !== project.projectId ||
      workspace.taskId !== task.id || workspace.executionId !== execution.executionId ||
      workspace.attemptNumber !== execution.attemptNumber || workspace.fencingToken !== execution.fencingToken) {
    return failure("STALE_REVISION", "Workspace binding is stale");
  }
  const readyRevision = expectedWorkspaceStatus === "ready" ? workspace.revision : workspace.revision - 1;
  const workspaceReceipt = latestWorkspaceReceipt(state, workspace, readyRevision);
  if (workspace.status !== expectedWorkspaceStatus || workspaceReceipt === null ||
      workspaceReceipt.repositoryIdentity === null ||
      workspaceReceipt.headObjectId === null || workspaceReceipt.ownershipBindingSha256 === null) {
    return failure("INVALID_STATE", "Ready workspace evidence is incomplete");
  }
  return Object.freeze({ project, task, execution, workspace, workspaceReceipt });
}

function sameBound(left: BoundPhase3, right: BoundPhase3): boolean {
  return left.project.projectId === right.project.projectId && left.project.resourceRevision === right.project.resourceRevision &&
    left.project.configRevision === right.project.configRevision && left.project.rootKey === right.project.rootKey &&
    left.task.id === right.task.id && left.task.revision === right.task.revision &&
    left.execution.executionId === right.execution.executionId && left.execution.revision === right.execution.revision &&
    left.execution.fencingToken === right.execution.fencingToken && left.workspace.workspaceId === right.workspace.workspaceId &&
    left.workspace.generation === right.workspace.generation && left.workspace.revision === right.workspace.revision &&
    left.workspaceReceipt.verifiedReceiptId === right.workspaceReceipt.verifiedReceiptId &&
    left.workspaceReceipt.receiptSha256 === right.workspaceReceipt.receiptSha256;
}

function runtimeFailure<T>(store: PersistenceStore, state: ApplicationState, context: TrustedContext): Phase3ApplicationResult<T> | null {
  const validation = validateTrustedRuntimeAndActor(state, context.actor, store);
  if (validation.ok) return null;
  return failure(validation.reason === "runtime_root_unavailable" || validation.reason === "runtime_root_mismatch"
    ? "PROJECT_IDENTITY_CHANGED" : "AUTHORIZATION_DENIED", "Trusted runtime or actor binding is invalid");
}

function projectIdentityCurrent(project: RegisteredProject, store: PersistenceStore): boolean {
  try {
    revalidateProjectRoot(project, store.layout.root);
    return true;
  } catch {
    return false;
  }
}

function authorize(
  state: ApplicationState,
  context: TrustedContext,
  action: AuthorizationAction,
  project: RegisteredProject,
  policy: AuthorizationPolicyResult,
  confirmed: boolean,
): AuthorizationEvaluation {
  return evaluateAuthorization(Object.freeze({
    actorId: context.actor.actorId,
    action,
    target: Object.freeze({ projectId: project.projectId, resourceRevision: project.resourceRevision, configRevision: project.configRevision }),
    now: context.now,
    policy,
    confirmed,
    grants: state.grants,
  }));
}

function genericRequest(
  identity: OperationIdentity,
  action: AuthorizationAction,
  targetId: string,
  targetRevision: number,
  allowed: boolean,
  targetKind: "project" | "execution" = "execution",
): ApplicationRequestRecord {
  return Object.freeze({
    requestId: identity.requestId, correlationId: identity.correlationId, actorId: identity.actor.actorId,
    action, targetKind, targetId, targetRevision,
    result: allowed ? "allow" as const : "deny" as const, createdAt: identity.now,
  });
}

function genericDecision(
  identity: OperationIdentity,
  action: AuthorizationAction,
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
): AuthorizationDecisionRecord {
  return Object.freeze({
    decisionId: identity.decisionId, requestId: identity.requestId, actorId: identity.actor.actorId,
    action, result: evaluation.allowed ? "allow" as const : "deny" as const, reason: evaluation.reason,
    policy: evaluation.policy, grantId: evaluation.grantId, grantRevision: evaluation.grantRevision,
    projectId: project.projectId, resourceRevision: project.resourceRevision, createdAt: identity.now,
  });
}

function genericAudit(
  identity: OperationIdentity,
  eventKind: ApplicationAuditRecord["eventKind"],
  targetId: string,
  targetRevision: number,
  evaluation: AuthorizationEvaluation,
  targetKind: "project" | "execution" = "execution",
): ApplicationAuditRecord {
  return Object.freeze({
    auditId: identity.auditId, requestId: identity.requestId, decisionId: identity.decisionId,
    eventKind: evaluation.allowed ? eventKind : "authorization.denied",
    result: evaluation.allowed ? "accepted" as const : "denied" as const,
    actorId: identity.actor.actorId, correlationId: identity.correlationId, targetKind,
    targetId, targetRevision, reason: evaluation.allowed ? "accepted" : evaluation.reason, createdAt: identity.now,
  });
}

function persistGenericAuthorization(
  transaction: ApplicationTransaction,
  identity: OperationIdentity,
  action: AuthorizationAction,
  eventKind: ApplicationAuditRecord["eventKind"],
  bound: Pick<BoundPhase3, "project" | "execution">,
  evaluation: AuthorizationEvaluation,
  targetKind: "project" | "execution" = "execution",
): void {
  const targetId = targetKind === "project" ? bound.project.projectId : bound.execution.executionId;
  const targetRevision = targetKind === "project" ? bound.project.resourceRevision : bound.execution.revision;
  transaction.insertRequest(genericRequest(identity, action, targetId, targetRevision, evaluation.allowed, targetKind));
  transaction.insertDecision(genericDecision(identity, action, bound.project, evaluation));
  transaction.insertAudit(genericAudit(identity, eventKind, targetId, targetRevision, evaluation, targetKind));
}

function completionSubject(bound: BoundPhase3): CompletionPolicySubject {
  const receipt = bound.workspaceReceipt;
  return Object.freeze({
    projectId: bound.project.projectId,
    projectResourceRevision: bound.project.resourceRevision,
    projectConfigRevision: bound.project.configRevision,
    projectRootKey: bound.project.rootKey,
    repositoryIdentity: receipt.repositoryIdentity!,
    taskId: bound.task.id,
    taskRevision: bound.task.revision,
    executionId: bound.execution.executionId,
    executionRevision: bound.execution.revision,
    attemptNumber: bound.execution.attemptNumber,
    fencingToken: bound.execution.fencingToken,
    workspaceId: bound.workspace.workspaceId,
    generation: bound.workspace.generation,
    workspaceRevision: bound.workspace.revision,
    ownershipBindingSha256: receipt.ownershipBindingSha256!,
    headObjectId: receipt.headObjectId!,
  });
}

function integrationPolicySubject(bound: BoundPhase3, options: Phase3ApplicationOptions): IntegrationPolicySubject {
  return Object.freeze({
    ...completionSubject(bound),
    targetReference: options.integrationTargetReference,
    expectedTargetObjectId: options.integrationExpectedTargetObjectId,
    sourceHeadObjectId: bound.workspaceReceipt.headObjectId!,
    destinationIdentity: options.integrationDestinationIdentity,
    expectedRemoteHead: options.integrationExpectedRemoteHead,
  });
}

function cleanupInventorySha256(state: ApplicationState, receipt: WorkspaceVerifiedReceiptRecord): string {
  const observation = state.workspaceObservations.find((candidate) => candidate.observationId === receipt.observationId);
  if (observation === undefined) throw new TypeError("Workspace inventory observation is absent");
  return sha256(canonicalJson({
    trackedCount: observation.trackedCount,
    modifiedCount: observation.modifiedCount,
    untrackedCount: observation.untrackedCount,
    ignoredCount: observation.ignoredCount,
    receiptSha256: receipt.receiptSha256,
  }));
}

function policySubjectFor(
  state: ApplicationState,
  bound: BoundPhase3,
  command: PolicyCommand,
  options: Phase3ApplicationOptions,
): CompletionPolicySubject | IntegrationPolicySubject | CleanupPolicySubject | null {
  if (command.kind === "policy.completion_requirements") return completionSubject(bound);
  if (command.kind === "policy.evaluate_integration") return integrationPolicySubject(bound, options);
  const evidence = cleanupEvidence(state, bound);
  return evidence === null ? null : cleanupSubjectFromEvidence(state, bound, evidence);
}

function policyView(record: ProjectPolicyReceiptRecord): ProjectPolicyView {
  const facts = parseProjectPolicyFacts(JSON.parse(record.factsJson));
  if (facts === null) throw new TypeError("Durable ProjectPolicy facts are malformed");
  return Object.freeze({
    receiptId: record.receiptId, operation: record.operation, decision: record.decision,
    reasonCode: record.reasonCode, facts, validUntil: record.validUntil, receiptSha256: record.receiptSha256,
  });
}

function policyRecord(receipt: ProjectPolicyReceipt): ProjectPolicyReceiptRecord {
  const factsJson = canonicalJson(receipt.facts);
  return Object.freeze({
    receiptId: receipt.receiptId,
    policyQueryId: receipt.policyQueryId,
    operation: receipt.operation,
    preliminaryAuthorizationDecisionId: receipt.preliminaryAuthorizationDecisionId,
    requestedAction: receipt.requestedAction,
    actorId: receipt.actorId,
    projectId: receipt.subject.projectId,
    projectResourceRevision: receipt.subject.projectResourceRevision,
    projectConfigRevision: receipt.subject.projectConfigRevision,
    projectRootKey: receipt.subject.projectRootKey,
    repositoryIdentity: receipt.subject.repositoryIdentity,
    subjectSha256: sha256(canonicalJson(receipt.subject)),
    policyId: receipt.policyId,
    policyKey: receipt.policyKey,
    policyConfigRevision: receipt.policyConfigRevision,
    adapterId: receipt.adapterId,
    adapterVersion: receipt.adapterVersion,
    decision: receipt.decision,
    reasonCode: receipt.reasonCode,
    factsJson,
    factsSha256: sha256(factsJson),
    receiptSha256: sha256(canonicalJson(receipt)),
    validUntil: receipt.validUntil,
    evidenceReference: receipt.evidenceReference,
    observedAt: receipt.observedAt,
  });
}

function currentPolicyReceipt(
  state: ApplicationState,
  receiptId: string,
  operation: ProjectPolicyOperation,
  requestedAction: string,
  subject: CompletionPolicySubject | IntegrationPolicySubject | CleanupPolicySubject,
  options: Phase3ApplicationOptions,
  now: string,
): ProjectPolicyReceiptRecord | null {
  const receipt = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === receiptId);
  if (receipt === undefined || receipt.operation !== operation || receipt.requestedAction !== requestedAction ||
      receipt.decision !== "allow" || receipt.validUntil === null || receipt.validUntil <= now ||
      receipt.policyId !== options.policyId || receipt.policyKey !== options.policyKey ||
      receipt.policyConfigRevision !== subject.projectConfigRevision || receipt.adapterId !== options.policyAdapterId ||
      receipt.adapterVersion !== options.policyAdapterVersion || receipt.subjectSha256 !== sha256(canonicalJson(subject))) return null;
  const facts = parseProjectPolicyFacts(JSON.parse(receipt.factsJson));
  if (facts === null || receipt.factsSha256 !== sha256(receipt.factsJson)) return null;
  return receipt;
}

function mapThrown<T>(error: unknown, identity: OperationIdentity | null): Phase3ApplicationResult<T> {
  if (error instanceof PersistenceError && error.code === "REVISION_CONFLICT") {
    return failure("STALE_REVISION", "Concurrent durable state changed", identity);
  }
  return failure("PERSISTENCE_FAILURE", "Phase 3 operation failed closed", identity);
}

type PolicyCommand = EvaluateCompletionPolicyCommand | EvaluateIntegrationPolicyCommand | EvaluateCleanupPolicyCommand;

function policyOperationFor(command: PolicyCommand): Readonly<{
  operation: Exclude<ProjectPolicyOperation, "evaluate_mutation">;
  requestedAction: "completion.accept" | "integration.reserve" | "workspace.cleanup";
}> {
  if (command.kind === "policy.completion_requirements") {
    return Object.freeze({ operation: "completion_requirements" as const, requestedAction: "completion.accept" as const });
  }
  if (command.kind === "policy.evaluate_integration") {
    return Object.freeze({ operation: "evaluate_integration" as const, requestedAction: "integration.reserve" as const });
  }
  return Object.freeze({ operation: "evaluate_cleanup" as const, requestedAction: "workspace.cleanup" as const });
}

async function evaluatePolicy(
  store: PersistenceStore,
  policy: ProjectPolicy,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: PolicyCommand,
): Promise<Phase3ApplicationResult<ProjectPolicyView>> {
  if (!validBindingCommand(command)) return failure("INVALID_INPUT", "Policy command identity is invalid");
  const context = safeContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "Trusted Phase 3 ingress is invalid");
  const identity = operationIdentity(ingress, context);
  const policyQueryId = nextId(ingress, "policy_query");
  if (identity === null || policyQueryId === null) return failure("INVALID_INPUT", "Trusted policy identities are invalid", identity);
  let preflight: ApplicationState;
  try { preflight = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, identity); }
  const initialRuntime = runtimeFailure<ProjectPolicyView>(store, preflight, context);
  if (initialRuntime !== null) return Object.freeze({ ...initialRuntime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = bindPhase3(preflight, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const selected = policyOperationFor(command);
  const subject = policySubjectFor(preflight, bound, command, options);
  if (subject === null) return failure("INVALID_STATE", "Policy subject lacks completed execution evidence", identity);
  if (command.kind === "policy.evaluate_integration" &&
      options.integrationExpectedTargetObjectId === bound.workspaceReceipt.headObjectId) {
    return failure("INVALID_STATE", "Integration target and source objects must differ", identity);
  }
  let evaluation: AuthorizationEvaluation;
  try {
    const prepared = withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const currentBound = bindPhase3(state, command);
      if ("ok" in currentBound || !sameBound(currentBound, bound)) throw new TypeError("Policy binding changed before authorization");
      const currentSubject = policySubjectFor(state, currentBound, command, options);
      if (currentSubject === null || canonicalJson(currentSubject) !== canonicalJson(subject)) {
        throw new TypeError("Policy subject changed before authorization");
      }
      evaluation = authorize(state, context, "policy.evaluate", currentBound.project, "read_not_applicable", true);
      persistGenericAuthorization(
        transaction,
        identity,
        "policy.evaluate",
        "policy.evaluated",
        currentBound,
        evaluation,
        "project",
      );
      return evaluation;
    });
    evaluation = prepared;
  } catch (error) {
    return mapThrown(error, identity);
  }
  if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Current policy.evaluate authorization was denied", identity);
  const requestCandidate = Object.freeze({
    contractId: PROJECT_POLICY_CONTRACT_ID,
    operation: selected.operation,
    policyQueryId,
    correlationId: identity.correlationId,
    actorId: context.actor.actorId,
    preliminaryAuthorizationDecisionId: identity.decisionId,
    requestedAction: selected.requestedAction,
    policyId: options.policyId,
    policyKey: options.policyKey,
    policyConfigRevision: bound.project.configRevision,
    adapterId: options.policyAdapterId,
    adapterVersion: options.policyAdapterVersion,
    subject,
  });
  const request = parseProjectPolicyRequest(requestCandidate);
  if (request === null) return failure("INVALID_INPUT", "Derived ProjectPolicy request is invalid", identity);
  let raw: unknown;
  try {
    raw = await Promise.resolve(request.operation === "completion_requirements"
      ? policy.completionRequirements(request as Extract<ProjectPolicyRequest, { readonly operation: "completion_requirements" }>)
      : request.operation === "evaluate_integration"
        ? policy.evaluateIntegration(request as Extract<ProjectPolicyRequest, { readonly operation: "evaluate_integration" }>)
        : policy.evaluateCleanup(request as Extract<ProjectPolicyRequest, { readonly operation: "evaluate_cleanup" }>));
  } catch {
    return failure("BACKEND_FAILURE", "ProjectPolicy adapter failed closed", identity);
  }
  const result = parseProjectPolicyResult(raw, request);
  if (result === null || !result.ok) return failure("BACKEND_FAILURE", "ProjectPolicy adapter returned no valid receipt", identity);
  const record = policyRecord(result.receipt);
  try {
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      const currentBound = bindPhase3(state, command);
      if ("ok" in currentBound || !sameBound(currentBound, bound)) {
        return failure("STALE_REVISION", "Policy subject changed before receipt persistence", identity);
      }
      const currentSubject = policySubjectFor(state, currentBound, command, options);
      if (currentSubject === null || canonicalJson(currentSubject) !== canonicalJson(subject)) {
        return failure("STALE_REVISION", "Policy evidence changed before receipt persistence", identity);
      }
      if (!state.decisions.some((candidate) => candidate.decisionId === identity.decisionId && candidate.result === "allow")) {
        throw new TypeError("Preliminary policy authorization is absent");
      }
      transaction.insertProjectPolicyReceipt(record);
      const readback = transaction.read().projectPolicyReceipts.find((candidate) => candidate.receiptId === record.receiptId);
      if (readback === undefined || readback.receiptSha256 !== record.receiptSha256) throw new TypeError("Policy receipt readback failed");
      return success(policyView(readback), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

function gateRequirement(
  state: ApplicationState,
  bound: BoundPhase3,
  policyReceiptId: string,
  gateId: string,
  gateVersion: string,
  options: Phase3ApplicationOptions,
  now: string,
): Readonly<{ policy: ProjectPolicyReceiptRecord; gate: ProjectPolicyFacts["requiredGates"][number] }> | null {
  const subject = completionSubject(bound);
  const policy = currentPolicyReceipt(
    state, policyReceiptId, "completion_requirements", "completion.accept", subject, options, now,
  );
  if (policy === null) return null;
  const facts = parseProjectPolicyFacts(JSON.parse(policy.factsJson));
  const gate = facts?.requiredGates.find((candidate) => candidate.gateId === gateId && candidate.gateVersion === gateVersion);
  return gate === undefined ? null : Object.freeze({ policy, gate });
}

function completionGateSubject(
  bound: BoundPhase3,
  policy: ProjectPolicyReceiptRecord,
  gate: ProjectPolicyFacts["requiredGates"][number],
  options: Phase3ApplicationOptions,
): CompletionGateSubject {
  return Object.freeze({
    ...completionSubject(bound),
    workspaceRootKey: bound.workspace.workspaceRootKey,
    policyId: policy.policyId,
    policyReceiptId: policy.receiptId,
    policyConfigRevision: policy.policyConfigRevision,
    gateId: gate.gateId,
    gateVersion: gate.gateVersion,
    commandKey: gate.commandKey,
    commandIdentitySha256: gate.commandIdentitySha256,
    completionEvidenceRootKey: options.completionEvidenceRootKey,
    toolEnvironmentSha256: gate.toolEnvironmentSha256,
  });
}

function gateAction(operation: CompletionGateOperationKind): Extract<AuthorizationAction,
  "completion.gate.run" | "completion.gate.inspect" | "completion.gate.cancel"> {
  return operation === "run_gate" ? "completion.gate.run" : operation === "inspect_gate"
    ? "completion.gate.inspect" : "completion.gate.cancel";
}

function gateAuditKind(operation: CompletionGateOperationKind): ApplicationAuditRecord["eventKind"] {
  return operation === "run_gate" ? "completion.gate.ran" : operation === "inspect_gate"
    ? "completion.gate.inspected" : "completion.gate.cancelled";
}

function gateAuthorization(
  decisionId: string,
  requestId: string,
  operationId: string,
  bindingRevision: number,
  phase: CompletionGateAuthorizationDecisionRecord["phase"],
  context: TrustedContext,
  operation: CompletionGateOperationKind,
  evaluation: AuthorizationEvaluation,
  confirmationId: string | null,
): CompletionGateAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, operationId, bindingRevision, phase, actorId: context.actor.actorId,
    action: gateAction(operation), result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision, confirmationId, createdAt: context.now,
  });
}

function gateEvent(
  eventId: string,
  identity: Pick<OperationIdentity, "operationId" | "actor" | "correlationId" | "now">,
  intentId: string | null,
  eventKind: CompletionGateEventRecord["eventKind"],
  outcome: CompletionGateEventRecord["outcome"],
  reasonCode: string,
  observationNumber: number | null = null,
  evidenceReference: string | null = null,
): CompletionGateEventRecord {
  return Object.freeze({
    eventId, operationId: identity.operationId, intentId, eventKind, outcome, reasonCode,
    actorId: identity.actor.actorId, correlationId: identity.correlationId,
    observationNumber, evidenceReference, createdAt: identity.now,
  });
}

function gateView(state: ApplicationState, intent: CompletionGateIntentRecord): CompletionGateView {
  const finalization = state.completionGateFinalizations.find((candidate) => candidate.intentId === intent.intentId);
  const receipt = state.completionGateReceipts.find((candidate) => candidate.intentId === intent.intentId);
  const observation = state.completionGateObservations.filter((candidate) => candidate.intentId === intent.intentId)
    .sort((left, right) => right.observationNumber - left.observationNumber)[0];
  return Object.freeze({
    operationId: intent.operationId,
    intentId: intent.intentId,
    gateOperationId: intent.gateOperationId,
    state: intent.state,
    outcome: finalization?.outcome ?? null,
    code: finalization?.code ?? observation?.code ?? null,
    verdict: receipt?.verdict ?? null,
    observationNumber: intent.lastObservationNumber,
    evidenceReference: observation?.evidenceReference ?? null,
  });
}

function gateRequestRecord(
  identity: OperationIdentity,
  idempotencyKey: string,
  operation: CompletionGateOperationKind,
  subject: CompletionGateSubject,
  gateOperationId: string,
  options: Phase3ApplicationOptions,
): CompletionGateRequestRecord {
  return Object.freeze({
    requestId: identity.requestId,
    operationId: identity.operationId,
    idempotencyKey,
    operationKind: operation,
    actorId: identity.actor.actorId,
    correlationId: identity.correlationId,
    causationId: operation === "run_gate" ? null : gateOperationId,
    projectId: subject.projectId,
    projectResourceRevision: subject.projectResourceRevision,
    projectConfigRevision: subject.projectConfigRevision,
    projectRootKey: subject.projectRootKey,
    repositoryIdentity: subject.repositoryIdentity,
    taskId: subject.taskId,
    taskRevision: subject.taskRevision,
    executionId: subject.executionId,
    executionRevision: subject.executionRevision,
    attemptNumber: subject.attemptNumber,
    fencingToken: subject.fencingToken,
    workspaceId: subject.workspaceId,
    generation: subject.generation,
    workspaceRevision: subject.workspaceRevision,
    workspaceRootKey: subject.workspaceRootKey,
    ownershipBindingSha256: subject.ownershipBindingSha256,
    headObjectId: subject.headObjectId,
    policyReceiptId: subject.policyReceiptId,
    policyId: subject.policyId,
    policyConfigRevision: subject.policyConfigRevision,
    gateId: subject.gateId,
    gateVersion: subject.gateVersion,
    commandKey: subject.commandKey,
    commandIdentitySha256: subject.commandIdentitySha256,
    completionEvidenceRootKey: subject.completionEvidenceRootKey,
    toolEnvironmentSha256: subject.toolEnvironmentSha256,
    contractId: COMPLETION_CONTRACT_ID,
    adapterId: options.completionAdapterId,
    adapterVersion: options.completionAdapterVersion,
    timeoutMs: operation === "run_gate" ? options.gateTimeoutMs : null,
    createdAt: identity.now,
  });
}

function sameGateReplay(request: CompletionGateRequestRecord, command: RunCompletionGateCommand | InspectCompletionGateCommand | CancelCompletionGateCommand): boolean {
  return request.idempotencyKey === command.idempotencyKey && request.actorId.length > 0 &&
    request.projectId === command.projectId && request.projectResourceRevision === command.expectedProjectResourceRevision &&
    request.projectConfigRevision === command.expectedProjectConfigRevision && request.taskId === command.taskId &&
    request.taskRevision === command.expectedTaskRevision && request.executionId === command.executionId &&
    request.executionRevision === command.expectedExecutionRevision && request.attemptNumber === command.expectedAttemptNumber &&
    request.fencingToken === command.expectedFencingToken && request.workspaceId === command.workspaceId &&
    request.generation === command.expectedGeneration && request.workspaceRevision === command.expectedWorkspaceRevision &&
    request.policyReceiptId === command.policyReceiptId &&
    (command.kind === "completion.gate.run"
      ? request.operationKind === "run_gate" && request.gateId === command.gateId && request.gateVersion === command.gateVersion
      : request.operationKind === (command.kind === "completion.gate.inspect" ? "inspect_gate" : "cancel_gate") &&
        request.causationId === command.gateOperationId);
}

type GateCommand = RunCompletionGateCommand | InspectCompletionGateCommand | CancelCompletionGateCommand;

function durableIdentityForGate(request: CompletionGateRequestRecord): Pick<OperationIdentity, "requestId" | "correlationId"> {
  return Object.freeze({ requestId: request.requestId, correlationId: request.correlationId });
}

function gateOperationFor(command: GateCommand): CompletionGateOperationKind {
  return command.kind === "completion.gate.run" ? "run_gate" : command.kind === "completion.gate.inspect"
    ? "inspect_gate" : "cancel_gate";
}

function resolveGateBinding(
  state: ApplicationState,
  bound: BoundPhase3,
  command: GateCommand,
  options: Phase3ApplicationOptions,
  now: string,
): Readonly<{
  readonly policy: ProjectPolicyReceiptRecord;
  readonly gate: ProjectPolicyFacts["requiredGates"][number];
  readonly gateOperationId: string;
}> | null {
  if (command.kind === "completion.gate.run") {
    const required = gateRequirement(state, bound, command.policyReceiptId, command.gateId, command.gateVersion, options, now);
    return required === null ? null : Object.freeze({ ...required, gateOperationId: "" });
  }
  const original = state.completionGateRequests.find((candidate) =>
    candidate.operationId === command.gateOperationId && candidate.operationKind === "run_gate");
  if (original === undefined || original.policyReceiptId !== command.policyReceiptId || original.projectId !== bound.project.projectId ||
      original.taskId !== bound.task.id || original.executionId !== bound.execution.executionId ||
      original.workspaceId !== bound.workspace.workspaceId || original.generation !== bound.workspace.generation) return null;
  const required = gateRequirement(state, bound, command.policyReceiptId, original.gateId, original.gateVersion, options, now);
  return required === null ? null : Object.freeze({ ...required, gateOperationId: command.gateOperationId });
}

function nextPhaseIdentity(
  ingress: Phase3Ingress,
  actorId: string,
  leaseOwnerId: string,
  previous: string,
): Readonly<{ context: TrustedContext; requestId: string; decisionId: string; eventId: string }> | null {
  const context = safeContext(ingress);
  const requestId = nextId(ingress, "request");
  const decisionId = nextId(ingress, "decision");
  const eventId = nextId(ingress, "event");
  if (context === null || context.actor.actorId !== actorId || context.leaseOwnerId !== leaseOwnerId ||
      requestId === null || decisionId === null || eventId === null ||
      new Set([requestId, decisionId, eventId]).size !== 3) return null;
  return Object.freeze({
    context: Object.freeze({ ...context, now: afterTimestamp(previous, context.now) }),
    requestId,
    decisionId,
    eventId,
  });
}

function backendGateRequest(
  request: CompletionGateRequestRecord,
  intent: CompletionGateIntentRecord,
  subject: CompletionGateSubject,
): CompletionBackendRequest | null {
  const base = {
    contractId: COMPLETION_CONTRACT_ID,
    operation: request.operationKind,
    correlationId: request.correlationId,
    causationId: request.causationId,
    actorId: request.actorId,
    adapterId: request.adapterId,
    adapterVersion: request.adapterVersion,
    subject,
  } as const;
  const candidate = request.operationKind === "run_gate"
    ? Object.freeze({
        ...base, operation: "run_gate" as const, operationId: intent.operationId, intentId: intent.intentId,
        idempotencyKey: intent.idempotencyKey, finalAuthorizationDecisionId: intent.currentAuthorizationDecisionId,
        timeoutMs: request.timeoutMs!,
      })
    : request.operationKind === "inspect_gate"
      ? Object.freeze({
          ...base, operation: "inspect_gate" as const, queryId: intent.operationId,
          readAuthorizationDecisionId: intent.currentAuthorizationDecisionId,
          gateOperationId: intent.gateOperationId, lastObservationNumber: 0,
        })
      : Object.freeze({
          ...base, operation: "cancel_gate" as const, operationId: intent.operationId, intentId: intent.intentId,
          idempotencyKey: intent.idempotencyKey, finalAuthorizationDecisionId: intent.currentAuthorizationDecisionId,
          gateOperationId: intent.gateOperationId, expectedObservationNumber: 0,
        });
  return parseCompletionBackendRequest(candidate);
}

function gateObservation(receipt: CompletionBackendReceipt, intent: CompletionGateIntentRecord): CompletionGateObservationRecord {
  return Object.freeze({
    observationId: "",
    intentId: intent.intentId,
    observationNumber: receipt.observationNumber,
    adapterReceiptId: receipt.receiptId,
    receiptSha256: sha256(canonicalJson(receipt)),
    authorizationDecisionId: intent.currentAuthorizationDecisionId,
    gateOperationId: receipt.gateOperationId,
    lifecycle: receipt.lifecycle,
    verdict: receipt.verdict,
    code: receipt.code,
    startedAt: receipt.startedAt,
    endedAt: receipt.endedAt,
    validUntil: receipt.validUntil,
    evidenceReference: receipt.evidenceReference,
    observedAt: receipt.observedAt,
  });
}

async function processGate(
  store: PersistenceStore,
  backend: CompletionBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: GateCommand,
): Promise<Phase3ApplicationResult<CompletionGateView>> {
  if (!validBindingCommand(command) || !identifier(command.policyReceiptId) || !identifier(command.idempotencyKey) ||
      (command.kind === "completion.gate.run"
        ? !identifier(command.gateId) || !identifier(command.gateVersion)
        : !identifier(command.gateOperationId))) return failure("INVALID_INPUT", "Completion gate command is invalid");
  const context = safeContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "Trusted Phase 3 ingress is invalid");
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, null); }
  const replay = state.completionGateIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
  if (replay !== undefined) {
    const request = state.completionGateRequests.find((candidate) => candidate.requestId === replay.requestId);
    if (request === undefined || request.actorId !== context.actor.actorId || !sameGateReplay(request, command)) {
      return failure("IDEMPOTENCY_CONFLICT", "Completion gate idempotency key is bound to another tuple");
    }
    return success(gateView(state, replay), durableIdentityForGate(request), true);
  }
  const identity = operationIdentity(ingress, context);
  const intentId = nextId(ingress, "intent");
  if (identity === null || intentId === null) return failure("INVALID_INPUT", "Trusted gate identities are invalid", identity);
  const runtime = runtimeFailure<CompletionGateView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = bindPhase3(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (bound.task.state !== "running" || state.executionTerminalStates.some((candidate) => candidate.executionId === bound.execution.executionId)) {
    return failure("INVALID_STATE", "Gate operations require a nonterminal running Task", identity);
  }
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const resolved = resolveGateBinding(state, bound, command, options, context.now);
  if (resolved === null) return failure("EVIDENCE_STALE", "Required completion policy or gate identity is stale", identity);
  const operation = gateOperationFor(command);
  const subject = completionGateSubject(bound, resolved.policy, resolved.gate, options);
  const gateOperationId = operation === "run_gate" ? identity.operationId : resolved.gateOperationId;
  const request = gateRequestRecord(identity, command.idempotencyKey, operation, subject, gateOperationId, options);
  let prepared: CompletionGateIntentRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const concurrent = current.completionGateIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
      if (concurrent !== undefined) throw new TypeError("Concurrent gate idempotency conflict");
      const currentBound = bindPhase3(current, command);
      if ("ok" in currentBound || !sameBound(currentBound, bound)) throw new TypeError("Gate binding changed before prepare");
      const currentResolved = resolveGateBinding(current, currentBound, command, options, context.now);
      const evaluation = authorize(current, context, gateAction(operation), currentBound.project,
        currentResolved === null ? "deny" : operation === "inspect_gate" ? "read_not_applicable" : "allow", true);
      persistGenericAuthorization(transaction, identity, gateAction(operation), gateAuditKind(operation), currentBound, evaluation);
      transaction.insertCompletionGateRequest(request);
      transaction.insertCompletionGateAuthorizationDecision(gateAuthorization(
        identity.decisionId, identity.requestId, identity.operationId, 1, "prepare", context, operation, evaluation, null,
      ));
      if (!evaluation.allowed || currentResolved === null) {
        transaction.insertCompletionGateEvent(gateEvent(
          identity.eventId, identity, null, "completion.gate.denied", "denied", evaluation.reason,
        ));
        return failure<CompletionGateView>("AUTHORIZATION_DENIED", "Completion gate prepare authorization was denied", identity);
      }
      const intent: CompletionGateIntentRecord = Object.freeze({
        intentId,
        operationId: identity.operationId,
        idempotencyKey: command.idempotencyKey,
        requestId: identity.requestId,
        operationKind: operation,
        state: "pending",
        revision: 1,
        currentAuthorizationDecisionId: identity.decisionId,
        authorizationBindingRevision: 1,
        gateOperationId,
        lastObservationNumber: 0,
        lastFailureCategory: null,
        lastFailureCode: null,
        lastFailureRetryable: null,
        lastFailureAmbiguous: null,
        createdAt: context.now,
        updatedAt: context.now,
      });
      transaction.insertCompletionGateIntent(intent);
      transaction.insertCompletionGateEvent(gateEvent(
        identity.eventId, identity, intent.intentId, "completion.gate.prepared", "accepted", "prepared",
      ));
      return intent;
    });
    if ("ok" in result) return result;
    prepared = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const act = nextPhaseIdentity(ingress, context.actor.actorId, context.leaseOwnerId, prepared.updatedAt);
  const deniedFinalizationId = nextId(ingress, "finalization");
  if (act === null || deniedFinalizationId === null) {
    return failure("RECONCILIATION_REQUIRED", "Gate intent is durable but act identities are unavailable", identity);
  }
  let executing: CompletionGateIntentRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.completionGateIntents.find((candidate) => candidate.intentId === prepared.intentId);
      const currentBound = bindPhase3(current, command);
      const currentResolved = "ok" in currentBound ? null : resolveGateBinding(current, currentBound, command, options, act.context.now);
      if (intent === undefined || intent.state !== "pending" || "ok" in currentBound || !sameBound(currentBound, bound)) {
        throw new TypeError("Gate prepare binding changed before act");
      }
      const evaluation = authorize(current, act.context, gateAction(operation), currentBound.project,
        currentResolved === null ? "deny" : operation === "inspect_gate" ? "read_not_applicable" : "allow", true);
      transaction.insertCompletionGateAuthorizationDecision(gateAuthorization(
        act.decisionId, intent.requestId, intent.operationId, 2, "act", act.context, operation, evaluation, null,
      ));
      const updatedAt = afterTimestamp(intent.updatedAt, act.context.now);
      if (!evaluation.allowed || currentResolved === null) {
        transaction.transitionCompletionGateIntent(
          intent.intentId, intent.revision, "pending", "failed", act.decisionId, 2, 0,
          Object.freeze({ category: "unauthorized", code: evaluation.reason, retryable: false, ambiguous: false }), updatedAt,
        );
        transaction.insertCompletionGateFinalization(Object.freeze({
          finalizationId: deniedFinalizationId,
          intentId: intent.intentId, verifiedReceiptId: null, authorizationDecisionId: act.decisionId,
          outcome: "failed", code: evaluation.reason, finalizedAt: updatedAt,
        }));
        transaction.insertCompletionGateEvent(gateEvent(
          act.eventId, { ...identity, ...act.context }, intent.intentId, "completion.gate.denied", "denied", evaluation.reason,
        ));
        return failure<CompletionGateView>("AUTHORIZATION_DENIED", "Completion gate act authorization was denied", identity);
      }
      transaction.transitionCompletionGateIntent(intent.intentId, intent.revision, "pending", "executing", act.decisionId, 2, 0, null, updatedAt);
      transaction.insertCompletionGateEvent(gateEvent(
        act.eventId, { ...identity, ...act.context }, intent.intentId, "completion.gate.executing", "accepted", "executing",
      ));
      return Object.freeze({ ...intent, state: "executing" as const, revision: intent.revision + 1,
        currentAuthorizationDecisionId: act.decisionId, authorizationBindingRevision: 2, updatedAt });
    });
    if ("ok" in result) return result;
    executing = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const backendRequest = backendGateRequest(request, executing, subject);
  if (backendRequest === null) return failure("RECONCILIATION_REQUIRED", "Durable gate request cannot be reconstructed", identity);
  let raw: unknown;
  try {
    raw = await Promise.resolve(backendRequest.operation === "run_gate" ? backend.runGate(backendRequest)
      : backendRequest.operation === "inspect_gate" ? backend.inspectGate(backendRequest) : backend.cancelGate(backendRequest));
  } catch {
    raw = Object.freeze({ ok: false, error: Object.freeze({
      category: "ambiguous_external_state", code: "completion_adapter_exception", retryable: false,
      ambiguous: true, retryAfter: null, evidenceReference: null,
    }) });
  }
  const backendResult = parseCompletionBackendResult(raw, backendRequest);
  if (backendResult === null || !backendResult.ok) {
    const backendError: CompletionBackendFailure = backendResult?.ok === false ? backendResult.error : Object.freeze({
      category: "integrity_failure", code: "completion_result_invalid", retryable: false,
      ambiguous: true, retryAfter: null, evidenceReference: null,
    });
    const terminalId = nextId(ingress, "finalization");
    const failureEventId = nextId(ingress, "event");
    if (terminalId === null || failureEventId === null) return failure("RECONCILIATION_REQUIRED", "Gate effect may have occurred; terminal identities are unavailable", identity);
    try {
      return withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const intent = current.completionGateIntents.find((candidate) => candidate.intentId === executing.intentId);
        if (intent === undefined || intent.state !== "executing") throw new TypeError("Executing gate intent changed after backend failure");
        const now = afterTimestamp(intent.updatedAt, safeContext(ingress)?.now ?? intent.updatedAt);
        transaction.transitionCompletionGateIntent(
          intent.intentId, intent.revision, "executing", backendError.ambiguous ? "ambiguous" : "failed",
          intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision, intent.lastObservationNumber,
          Object.freeze({ category: backendError.category, code: backendError.code,
            retryable: backendError.retryable, ambiguous: backendError.ambiguous }), now,
        );
        transaction.insertCompletionGateFinalization(Object.freeze({
          finalizationId: terminalId, intentId: intent.intentId, verifiedReceiptId: null,
          authorizationDecisionId: intent.currentAuthorizationDecisionId,
          outcome: backendError.ambiguous ? "ambiguous" : "failed", code: backendError.code, finalizedAt: now,
        }));
        transaction.insertCompletionGateEvent(gateEvent(
          failureEventId, { ...identity, now }, intent.intentId, "completion.gate.finalized",
          backendError.ambiguous ? "ambiguous" : "failed", backendError.code, intent.lastObservationNumber,
          backendError.evidenceReference,
        ));
        const readback = transaction.read();
        return success(gateView(readback, readback.completionGateIntents.find((candidate) => candidate.intentId === intent.intentId)!), identity);
      });
    } catch (error) {
      return mapThrown(error, identity);
    }
  }
  const receipt = backendResult.receipt;
  const observationId = nextId(ingress, "observation");
  const observedEventId = nextId(ingress, "event");
  const observationContext = safeContext(ingress);
  if (observationId === null || observedEventId === null) return failure("RECONCILIATION_REQUIRED", "Gate receipt exists but observation identities are unavailable", identity);
  if (observationContext === null || observationContext.actor.actorId !== context.actor.actorId ||
      observationContext.leaseOwnerId !== context.leaseOwnerId) {
    return failure("RECONCILIATION_REQUIRED", "Gate observation identity changed after the effect", identity);
  }
  const observationNow = afterTimestamp(executing.updatedAt, observationContext.now);
  const observation = Object.freeze({ ...gateObservation(receipt, executing), observationId });
  let observedIntent: CompletionGateIntentRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.completionGateIntents.find((candidate) => candidate.intentId === executing.intentId);
      if (intent === undefined || intent.state !== "executing") throw new TypeError("Executing gate intent changed before observation");
      const currentBound = bindPhase3(current, command);
      const now = afterTimestamp(intent.updatedAt, observationNow);
      const bindingCurrent = !("ok" in currentBound) && sameBound(currentBound, bound) &&
        resolveGateBinding(current, currentBound, command, options, now) !== null;
      transaction.insertCompletionGateObservation(observation);
      const determinate = receipt.lifecycle === "completed" && (receipt.verdict === "pass" || receipt.verdict === "fail") && bindingCurrent;
      const nextState = determinate ? "observed" as const : "ambiguous" as const;
      transaction.transitionCompletionGateIntent(
        intent.intentId, intent.revision, "executing", nextState, intent.currentAuthorizationDecisionId,
        intent.authorizationBindingRevision, receipt.observationNumber,
        determinate ? null : Object.freeze({ category: "ambiguous_external_state", code: "gate_observation_indeterminate", retryable: false, ambiguous: true }),
        now,
      );
      transaction.insertCompletionGateEvent(gateEvent(
        observedEventId, { ...identity, now }, intent.intentId, "completion.gate.observed",
        determinate ? "accepted" : "ambiguous", receipt.code, receipt.observationNumber, receipt.evidenceReference,
      ));
      if (!determinate) {
        const finalizationId = nextId(ingress, "finalization");
        if (finalizationId === null) throw new TypeError("Indeterminate gate finalization identity is unavailable");
        transaction.insertCompletionGateFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId: null,
          authorizationDecisionId: intent.currentAuthorizationDecisionId,
          outcome: "ambiguous", code: receipt.code, finalizedAt: now,
        }));
      }
      const readback = transaction.read();
      const updated = readback.completionGateIntents.find((candidate) => candidate.intentId === intent.intentId)!;
      return determinate ? updated : success(gateView(readback, updated), identity);
    });
    if ("ok" in result) return result;
    observedIntent = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const verifiedReceiptId = nextId(ingress, "verified_receipt");
  const verifiedEventId = nextId(ingress, "event");
  if (verifiedReceiptId === null || verifiedEventId === null) return failure("RECONCILIATION_REQUIRED", "Gate observation is durable but verification identities are unavailable", identity);
  let verifiedIntent: CompletionGateIntentRecord;
  try {
    verifiedIntent = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.completionGateIntents.find((candidate) => candidate.intentId === observedIntent.intentId);
      const durable = current.completionGateObservations.find((candidate) => candidate.observationId === observationId);
      if (intent === undefined || intent.state !== "observed" || durable === undefined ||
          durable.receiptSha256 !== sha256(canonicalJson(receipt))) throw new TypeError("Gate observation verification lineage changed");
      const now = afterTimestamp(intent.updatedAt, safeContext(ingress)?.now ?? intent.updatedAt);
      transaction.insertCompletionGateReceipt(Object.freeze({
        verifiedReceiptId, intentId: intent.intentId, observationId: durable.observationId,
        observationNumber: durable.observationNumber, adapterReceiptId: durable.adapterReceiptId,
        receiptSha256: durable.receiptSha256, gateOperationId: durable.gateOperationId,
        verdict: durable.verdict as "pass" | "fail", validUntil: durable.validUntil, verifiedAt: now,
      }));
      transaction.transitionCompletionGateIntent(
        intent.intentId, intent.revision, "observed", "verified", intent.currentAuthorizationDecisionId,
        intent.authorizationBindingRevision, intent.lastObservationNumber, null, now,
      );
      transaction.insertCompletionGateEvent(gateEvent(
        verifiedEventId, { ...identity, now }, intent.intentId, "completion.gate.verified", "accepted",
        durable.code, durable.observationNumber, durable.evidenceReference,
      ));
      return Object.freeze({ ...intent, state: "verified" as const, revision: intent.revision + 1, updatedAt: now });
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
  const finalize = nextPhaseIdentity(ingress, context.actor.actorId, context.leaseOwnerId, verifiedIntent.updatedAt);
  const finalizationId = nextId(ingress, "finalization");
  if (finalize === null || finalizationId === null) return failure("RECONCILIATION_REQUIRED", "Verified gate receipt requires explicit finalization", identity);
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.completionGateIntents.find((candidate) => candidate.intentId === verifiedIntent.intentId);
      const verified = current.completionGateReceipts.find((candidate) => candidate.verifiedReceiptId === verifiedReceiptId);
      const currentBound = bindPhase3(current, command);
      const resolvedCurrent = "ok" in currentBound ? null : resolveGateBinding(current, currentBound, command, options, finalize.context.now);
      if (intent === undefined || intent.state !== "verified" || verified === undefined || "ok" in currentBound ||
          !sameBound(currentBound, bound)) throw new TypeError("Gate finalization lineage changed");
      const evaluation = authorize(current, finalize.context, gateAction(operation), currentBound.project,
        resolvedCurrent === null ? "deny" : operation === "inspect_gate" ? "read_not_applicable" : "allow", true);
      transaction.insertCompletionGateAuthorizationDecision(gateAuthorization(
        finalize.decisionId, intent.requestId, intent.operationId, 3, "finalize", finalize.context,
        operation, evaluation, null,
      ));
      const now = afterTimestamp(intent.updatedAt, finalize.context.now);
      if (!evaluation.allowed || resolvedCurrent === null) {
        transaction.transitionCompletionGateIntent(
          intent.intentId, intent.revision, "verified", "ambiguous", finalize.decisionId, 3,
          intent.lastObservationNumber, null, now,
        );
        transaction.insertCompletionGateFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId: null,
          authorizationDecisionId: finalize.decisionId, outcome: "ambiguous", code: evaluation.reason, finalizedAt: now,
        }));
      } else {
        transaction.transitionCompletionGateIntent(
          intent.intentId, intent.revision, "verified", "finalized", finalize.decisionId, 3,
          intent.lastObservationNumber, null, now,
        );
        transaction.insertCompletionGateFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId,
          authorizationDecisionId: finalize.decisionId,
          outcome: verified.verdict === "pass" ? "accepted" : "refused",
          code: observation.code, finalizedAt: now,
        }));
      }
      transaction.insertCompletionGateEvent(gateEvent(
        finalize.eventId, { ...identity, ...finalize.context, now }, intent.intentId, "completion.gate.finalized",
        evaluation.allowed && resolvedCurrent !== null ? (verified.verdict === "pass" ? "accepted" : "refused") : "ambiguous",
        evaluation.allowed && resolvedCurrent !== null ? observation.code : evaluation.reason,
        intent.lastObservationNumber, observation.evidenceReference,
      ));
      const readback = transaction.read();
      const terminal = readback.completionGateIntents.find((candidate) => candidate.intentId === intent.intentId)!;
      return success(gateView(readback, terminal), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

function validReservationCommand(value: IntegrationReservationCommand): boolean {
  return typeof value === "object" && value !== null && identifier(value.projectId, 1024) &&
    revision(value.expectedProjectResourceRevision) && revision(value.expectedProjectConfigRevision) &&
    identifier(value.reservationId) && revision(value.expectedReservationRevision) &&
    revision(value.expectedLeaseRevision) && revision(value.expectedFencingToken) && identifier(value.idempotencyKey);
}

function reservationFor(
  state: ApplicationState,
  command: IntegrationReservationCommand,
): Readonly<{ project: RegisteredProject; reservation: IntegrationReservationRecord }> | Phase3ApplicationResult<never> {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failure("PROJECT_NOT_FOUND", "Integration Project is absent");
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
      project.configRevision !== command.expectedProjectConfigRevision) return failure("STALE_REVISION", "Integration Project binding is stale");
  const reservation = state.integrationReservations.find((candidate) => candidate.reservationId === command.reservationId);
  if (reservation === undefined) return failure("INVALID_STATE", "Integration reservation is absent");
  if (reservation.projectId !== project.projectId || reservation.projectResourceRevision !== project.resourceRevision ||
      reservation.projectConfigRevision !== project.configRevision || reservation.revision !== command.expectedReservationRevision ||
      reservation.leaseRevision !== command.expectedLeaseRevision || reservation.fencingToken !== command.expectedFencingToken) {
    return failure("STALE_FENCE", "Integration reservation revision or fence is stale");
  }
  return Object.freeze({ project, reservation });
}

function reservationView(reservation: IntegrationReservationRecord): IntegrationReservationView {
  return Object.freeze({
    reservationId: reservation.reservationId, revision: reservation.revision, status: reservation.status,
    leaseRevision: reservation.leaseRevision, fencingToken: reservation.fencingToken,
    expiresAt: reservation.expiresAt, currentEvidenceSha256: reservation.currentEvidenceSha256,
  });
}

function integrationView(
  state: ApplicationState,
  reservation: IntegrationReservationRecord,
  intent: IntegrationIntentRecord | null,
  observation: IntegrationObservationRecord | null = null,
): IntegrationOperationView {
  const finalization = intent === null ? null : state.integrationFinalizations.find((candidate) => candidate.intentId === intent.intentId) ?? null;
  const latest = observation ?? state.integrationObservations.filter((candidate) => candidate.reservationId === reservation.reservationId &&
    (intent === null || candidate.intentId === intent.intentId)).sort((left, right) => right.observationNumber - left.observationNumber)[0] ?? null;
  return Object.freeze({
    ...reservationView(reservation),
    operationId: intent?.operationId ?? null,
    intentId: intent?.intentId ?? null,
    operation: latest?.operation ?? intent?.operationKind ?? null,
    intentState: intent?.state ?? null,
    outcome: finalization?.outcome ?? latest?.outcome ?? null,
    code: finalization?.code ?? latest?.code ?? null,
    observationNumber: latest?.observationNumber ?? 0,
    evidenceReference: latest?.evidenceReference ?? null,
  });
}

function integrationSubject(reservation: IntegrationReservationRecord): IntegrationSubject {
  return Object.freeze({
    projectId: reservation.projectId,
    projectResourceRevision: reservation.projectResourceRevision,
    projectConfigRevision: reservation.projectConfigRevision,
    projectRootKey: reservation.projectRootKey,
    repositoryIdentity: reservation.repositoryIdentity,
    objectFormat: "sha1",
    targetReference: reservation.targetReference,
    expectedTargetObjectId: reservation.expectedTargetObjectId,
    sourceWorkspaceId: reservation.sourceWorkspaceId,
    sourceGeneration: reservation.sourceGeneration,
    sourceWorkspaceRevision: reservation.sourceWorkspaceRevision,
    sourceWorkspaceRootKey: reservation.sourceWorkspaceRootKey,
    sourceOwnershipBindingSha256: reservation.sourceOwnershipBindingSha256,
    sourceHeadObjectId: reservation.sourceHeadObjectId,
    reservationId: reservation.reservationId,
    reservationRevision: reservation.revision,
    reservationStatus: reservation.status,
    reservationOwnerExecutionId: reservation.ownerExecutionId,
    reservationOwnerOperationId: reservation.ownerOperationId,
    reservationLeaseOwnerId: reservation.leaseOwnerId,
    reservationLeaseRevision: reservation.leaseRevision,
    reservationFencingToken: reservation.fencingToken,
    reservationExpiresAt: reservation.expiresAt,
    policyReceiptId: reservation.policyReceiptId,
    policyConfigRevision: reservation.policyConfigRevision,
    destinationIdentity: reservation.destinationIdentity,
    destinationReference: reservation.destinationReference,
    expectedRemoteHead: reservation.expectedRemoteHead,
  });
}

function currentIntegrationPolicy(
  state: ApplicationState,
  reservation: IntegrationReservationRecord,
  options: Phase3ApplicationOptions,
  now: string,
): ProjectPolicyReceiptRecord | null {
  const receipt = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === reservation.policyReceiptId);
  return receipt !== undefined && receipt.operation === "evaluate_integration" && receipt.requestedAction === "integration.reserve" &&
    receipt.decision === "allow" && receipt.validUntil !== null && receipt.validUntil > now &&
    receipt.projectId === reservation.projectId && receipt.projectResourceRevision === reservation.projectResourceRevision &&
    receipt.projectConfigRevision === reservation.projectConfigRevision && receipt.projectRootKey === reservation.projectRootKey &&
    receipt.repositoryIdentity === reservation.repositoryIdentity && receipt.policyId === options.policyId &&
    receipt.policyKey === options.policyKey && receipt.policyConfigRevision === reservation.policyConfigRevision &&
    receipt.adapterId === options.policyAdapterId && receipt.adapterVersion === options.policyAdapterVersion
    ? receipt : null;
}

function integrationEvent(
  eventId: string,
  reservationId: string,
  operationId: string,
  intentId: string | null,
  eventKind: IntegrationEventRecord["eventKind"],
  outcome: IntegrationEventRecord["outcome"],
  reasonCode: string,
  context: TrustedContext,
  correlationId: string,
  observationNumber: number | null = null,
  evidenceReference: string | null = null,
): IntegrationEventRecord {
  return Object.freeze({
    eventId, reservationId, operationId, intentId, eventKind, outcome, reasonCode,
    actorId: context.actor.actorId, correlationId, observationNumber, evidenceReference, createdAt: context.now,
  });
}

function replayIdentityForReservation(state: ApplicationState, reservation: IntegrationReservationRecord): Pick<OperationIdentity, "requestId" | "correlationId"> {
  const event = state.integrationEvents.find((candidate) => candidate.reservationId === reservation.reservationId &&
    candidate.eventKind === "integration.reserved");
  const request = event === undefined ? undefined : state.requests.find((candidate) =>
    candidate.correlationId === event.correlationId && candidate.action === "integration.reserve");
  return Object.freeze({ requestId: request?.requestId ?? reservation.ownerOperationId, correlationId: event?.correlationId ?? reservation.ownerOperationId });
}

async function reserveIntegration(
  store: PersistenceStore,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: ReserveIntegrationCommand,
): Promise<Phase3ApplicationResult<IntegrationReservationView>> {
  if (!validBindingCommand(command) || !identifier(command.policyReceiptId) || !identifier(command.idempotencyKey)) {
    return failure("INVALID_INPUT", "Integration reservation command is invalid");
  }
  const context = safeContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "Trusted Phase 3 ingress is invalid");
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, null); }
  const replay = state.integrationReservations.find((candidate) => candidate.ownerOperationId === command.idempotencyKey);
  if (replay !== undefined) {
    if (replay.ownerExecutionId !== command.executionId || replay.projectId !== command.projectId ||
        replay.policyReceiptId !== command.policyReceiptId || replay.sourceWorkspaceId !== command.workspaceId ||
        replay.sourceGeneration !== command.expectedGeneration) return failure("IDEMPOTENCY_CONFLICT", "Reservation idempotency key is bound to another tuple");
    return success(reservationView(replay), replayIdentityForReservation(state, replay), true);
  }
  const identity = operationIdentity(ingress, context);
  const reservationId = nextId(ingress, "reservation");
  if (identity === null || reservationId === null) return failure("INVALID_INPUT", "Trusted integration identities are invalid", identity);
  const runtime = runtimeFailure<IntegrationReservationView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = bindPhase3(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (bound.task.state !== "running" || state.executionTerminalStates.some((candidate) => candidate.executionId === bound.execution.executionId)) {
    return failure("INVALID_STATE", "Integration reservation requires a nonterminal running Task", identity);
  }
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const policySubject = integrationPolicySubject(bound, options);
  const policyReceipt = currentPolicyReceipt(
    state, command.policyReceiptId, "evaluate_integration", "integration.reserve", policySubject, options, context.now,
  );
  if (policyReceipt === null) return failure("EVIDENCE_STALE", "Integration policy receipt is stale", identity);
  if (options.integrationExpectedTargetObjectId === bound.workspaceReceipt.headObjectId) {
    return failure("INVALID_STATE", "Integration target and source objects must differ", identity);
  }
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      if (current.integrationReservations.some((candidate) => candidate.ownerOperationId === command.idempotencyKey)) {
        throw new TypeError("Concurrent reservation idempotency conflict");
      }
      const currentBound = bindPhase3(current, command);
      if ("ok" in currentBound || !sameBound(currentBound, bound)) throw new TypeError("Reservation binding changed");
      const currentPolicy = currentPolicyReceipt(
        current, command.policyReceiptId, "evaluate_integration", "integration.reserve",
        integrationPolicySubject(currentBound, options), options, context.now,
      );
      const evaluation = authorize(current, context, "integration.reserve", currentBound.project,
        currentPolicy === null ? "deny" : "allow", true);
      persistGenericAuthorization(transaction, identity, "integration.reserve", "integration.reserved", currentBound, evaluation);
      if (!evaluation.allowed || currentPolicy === null) return failure("AUTHORIZATION_DENIED", "Integration reservation authorization was denied", identity);
      const currentTarget = current.integrationReservations.find((candidate) => candidate.projectId === currentBound.project.projectId &&
        candidate.repositoryIdentity === currentBound.workspaceReceipt.repositoryIdentity &&
        candidate.targetReference === options.integrationTargetReference &&
        (candidate.status === "active" || candidate.status === "ambiguous"));
      if (currentTarget !== undefined) return failure("INVALID_STATE", "Integration target already has a current reservation", identity);
      const sequence = current.integrationTargetSequences.find((candidate) => candidate.projectId === currentBound.project.projectId &&
        candidate.repositoryIdentity === currentBound.workspaceReceipt.repositoryIdentity &&
        candidate.targetReference === options.integrationTargetReference);
      let fencingToken: number;
      if (sequence === undefined) {
        fencingToken = 1;
        transaction.insertIntegrationTargetSequence(Object.freeze({
          projectId: currentBound.project.projectId, repositoryIdentity: currentBound.workspaceReceipt.repositoryIdentity!,
          targetReference: options.integrationTargetReference, lastFencingToken: fencingToken,
        }));
      } else {
        const priorReservations = current.integrationReservations.filter((candidate) => candidate.projectId === sequence.projectId &&
          candidate.repositoryIdentity === sequence.repositoryIdentity && candidate.targetReference === sequence.targetReference);
        if (priorReservations.some((candidate) => candidate.status === "ambiguous" ||
          current.integrationIntents.some((intent) => intent.reservationId === candidate.reservationId &&
            intent.state !== "finalized" && intent.state !== "failed"))) {
          return failure("RECONCILIATION_REQUIRED", "Prior integration reservation is not terminal", identity);
        }
        fencingToken = transaction.advanceIntegrationTargetSequence(
          sequence.projectId, sequence.repositoryIdentity, sequence.targetReference, sequence.lastFencingToken,
        );
      }
      const expiresAt = new Date(new Date(context.now).valueOf() + options.integrationReservationLeaseSeconds * 1000).toISOString();
      const reservation: IntegrationReservationRecord = Object.freeze({
        reservationId, revision: 1, status: "active", projectId: currentBound.project.projectId,
        projectResourceRevision: currentBound.project.resourceRevision,
        projectConfigRevision: currentBound.project.configRevision, projectRootKey: currentBound.project.rootKey,
        repositoryIdentity: currentBound.workspaceReceipt.repositoryIdentity!, objectFormat: "sha1",
        targetReference: options.integrationTargetReference, expectedTargetObjectId: options.integrationExpectedTargetObjectId,
        sourceWorkspaceId: currentBound.workspace.workspaceId, sourceGeneration: currentBound.workspace.generation,
        sourceWorkspaceRevision: currentBound.workspace.revision, sourceWorkspaceRootKey: currentBound.workspace.workspaceRootKey,
        sourceOwnershipBindingSha256: currentBound.workspaceReceipt.ownershipBindingSha256!,
        sourceHeadObjectId: currentBound.workspaceReceipt.headObjectId!, ownerExecutionId: currentBound.execution.executionId,
        ownerOperationId: command.idempotencyKey, leaseOwnerId: context.leaseOwnerId, leaseRevision: 1,
        fencingToken, expiresAt, policyReceiptId: currentPolicy.receiptId,
        policyConfigRevision: currentPolicy.policyConfigRevision, destinationIdentity: options.integrationDestinationIdentity,
        destinationReference: options.integrationDestinationReference, expectedRemoteHead: options.integrationExpectedRemoteHead,
        currentEvidenceSha256: null, createdAt: context.now, updatedAt: context.now,
      });
      transaction.insertIntegrationReservation(reservation);
      transaction.insertIntegrationEvent(integrationEvent(
        identity.eventId, reservation.reservationId, command.idempotencyKey, null, "integration.reserved",
        "accepted", "reserved", context, identity.correlationId,
      ));
      const readback = transaction.read().integrationReservations.find((candidate) => candidate.reservationId === reservationId);
      if (readback === undefined || readback.fencingToken !== fencingToken) throw new TypeError("Integration reservation readback failed");
      return success(reservationView(readback), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

type ReservationMutationCommand = RenewIntegrationCommand | TakeoverIntegrationCommand | ReleaseIntegrationCommand;

async function mutateReservation(
  store: PersistenceStore,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: ReservationMutationCommand,
): Promise<Phase3ApplicationResult<IntegrationReservationView>> {
  if (!validReservationCommand(command)) return failure("INVALID_INPUT", "Integration reservation mutation is invalid");
  const context = safeContext(ingress);
  const identity = context === null ? null : operationIdentity(ingress, context);
  if (context === null || identity === null) return failure("INVALID_INPUT", "Trusted integration mutation identity is invalid", identity);
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, identity); }
  const runtime = runtimeFailure<IntegrationReservationView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = reservationFor(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const action = command.kind;
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = reservationFor(current, command);
      if ("ok" in currentBound) return Object.freeze({ ...currentBound, requestId: identity.requestId, correlationId: identity.correlationId });
      const reservation = currentBound.reservation;
      const policyCurrent = currentIntegrationPolicy(current, reservation, options, context.now) !== null;
      const policyResult: AuthorizationPolicyResult = action === "integration.lease.renew"
        ? policyCurrent ? "allow" : "deny" : "read_not_applicable";
      const evaluation = authorize(current, context, action, currentBound.project, policyResult, true);
      const execution = current.executions.find((candidate) => candidate.executionId === reservation.ownerExecutionId);
      if (execution === undefined) throw new TypeError("Reservation owner execution is absent");
      persistGenericAuthorization(transaction, identity, action,
        action === "integration.lease.renew" ? "integration.lease.renewed" :
          action === "integration.lease.takeover" ? "integration.lease.taken_over" : "integration.released",
        { project: currentBound.project, execution }, evaluation);
      if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Integration reservation mutation authorization was denied", identity);
      if (reservation.status !== "active") return failure("INVALID_STATE", "Only an active reservation can be mutated", identity);
      const unfinished = current.integrationIntents.some((candidate) => candidate.reservationId === reservation.reservationId &&
        candidate.state !== "finalized" && candidate.state !== "failed");
      if (action === "integration.lease.renew" &&
          (reservation.leaseOwnerId !== context.leaseOwnerId || reservation.expiresAt <= context.now || !policyCurrent)) {
        return failure("STALE_FENCE", "Reservation lease cannot be renewed", identity);
      }
      if (action === "integration.lease.takeover") {
        const inspected = current.integrationObservations.filter((candidate) => candidate.reservationId === reservation.reservationId &&
          candidate.operation === "inspect").sort((left, right) => right.observationNumber - left.observationNumber)[0];
        if (reservation.expiresAt > context.now || unfinished || inspected === undefined || inspected.observedAt < reservation.expiresAt ||
            inspected.outcome === "ambiguous") return failure("RECONCILIATION_REQUIRED", "Takeover requires expired, quiescent, authoritative inspection", identity);
      }
      if (action === "integration.release") {
        const terminal = current.executionTerminalStates.find((candidate) => candidate.executionId === reservation.ownerExecutionId &&
          candidate.status === "completed");
        if (terminal === undefined || unfinished) return failure("INVALID_STATE", "Release requires completed execution and terminal integration intents", identity);
      }
      const nextStatus = action === "integration.release"
        ? (context.now < reservation.expiresAt ? "released" as const : "expired" as const)
        : "active" as const;
      const nextOwner = action === "integration.lease.takeover" ? context.leaseOwnerId : reservation.leaseOwnerId;
      const nextLeaseRevision = action === "integration.release" ? reservation.leaseRevision : reservation.leaseRevision + 1;
      const nextExpiresAt = action === "integration.release" ? reservation.expiresAt :
        new Date(new Date(context.now).valueOf() + options.integrationReservationLeaseSeconds * 1000).toISOString();
      transaction.transitionIntegrationReservation(
        reservation.reservationId, reservation.revision, reservation.status, reservation.leaseRevision,
        reservation.fencingToken, nextStatus, nextOwner, nextLeaseRevision, nextExpiresAt,
        reservation.currentEvidenceSha256, context.now,
      );
      transaction.insertIntegrationEvent(integrationEvent(
        identity.eventId, reservation.reservationId, identity.operationId, null,
        action === "integration.lease.renew" ? "integration.renewed" :
          action === "integration.lease.takeover" ? "integration.taken_over" :
            nextStatus === "expired" ? "integration.expired" : "integration.released",
        "accepted", nextStatus, context, identity.correlationId,
      ));
      const readback = transaction.read().integrationReservations.find((candidate) => candidate.reservationId === reservation.reservationId)!;
      return success(reservationView(readback), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

function integrationBackendObservation(
  receipt: IntegrationBackendReceipt,
  reservationId: string,
  intentId: string | null,
  authorizationDecisionId: string,
): IntegrationObservationRecord {
  return Object.freeze({
    observationId: "", reservationId, intentId, observationNumber: receipt.observationNumber,
    operation: receipt.operation, adapterReceiptId: receipt.receiptId, receiptSha256: sha256(canonicalJson(receipt)),
    authorizationDecisionId, localBeforeObjectId: receipt.localBeforeObjectId,
    localAfterObjectId: receipt.localAfterObjectId, remoteBeforeObjectId: receipt.remoteBeforeObjectId,
    remoteAfterObjectId: receipt.remoteAfterObjectId, localState: receipt.localState, remoteState: receipt.remoteState,
    outcome: receipt.outcome, code: receipt.code, evidenceReference: receipt.evidenceReference, observedAt: receipt.observedAt,
  });
}

async function inspectIntegration(
  store: PersistenceStore,
  backend: IntegrationBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: InspectIntegrationCommand,
): Promise<Phase3ApplicationResult<IntegrationOperationView>> {
  if (!validReservationCommand(command)) return failure("INVALID_INPUT", "Integration inspect command is invalid");
  const context = safeContext(ingress);
  const identity = context === null ? null : operationIdentity(ingress, context);
  if (context === null || identity === null) return failure("INVALID_INPUT", "Trusted integration inspect identity is invalid", identity);
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, identity); }
  const runtime = runtimeFailure<IntegrationOperationView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = reservationFor(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const lastObservation = state.integrationObservations.filter((candidate) => candidate.reservationId === bound.reservation.reservationId)
    .sort((left, right) => right.observationNumber - left.observationNumber)[0]?.observationNumber ?? 0;
  let evaluation: AuthorizationEvaluation;
  try {
    evaluation = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = reservationFor(current, command);
      if ("ok" in currentBound) throw new TypeError("Integration inspect binding changed");
      const ownerExecution = current.executions.find((candidate) => candidate.executionId === currentBound.reservation.ownerExecutionId);
      if (ownerExecution === undefined) throw new TypeError("Integration owner execution is absent");
      const allowed = authorize(current, context, "integration.inspect", currentBound.project, "read_not_applicable", true);
      persistGenericAuthorization(transaction, identity, "integration.inspect", "integration.inspected",
        { project: currentBound.project, execution: ownerExecution }, allowed);
      return allowed;
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
  if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Integration inspect authorization was denied", identity);
  const candidateRequest = parseIntegrationBackendRequest(Object.freeze({
    contractId: INTEGRATION_CONTRACT_ID, operation: "inspect", correlationId: identity.correlationId,
    causationId: null, actorId: context.actor.actorId, adapterId: options.integrationAdapterId,
    adapterVersion: options.integrationAdapterVersion, subject: integrationSubject(bound.reservation),
    queryId: identity.operationId, readAuthorizationDecisionId: identity.decisionId, lastObservationNumber: lastObservation,
  }));
  if (candidateRequest === null || candidateRequest.operation !== "inspect") {
    return failure("INVALID_INPUT", "Derived integration inspect request is invalid", identity);
  }
  let raw: unknown;
  try { raw = await Promise.resolve(backend.inspect(candidateRequest)); } catch {
    return failure("BACKEND_FAILURE", "Integration inspect adapter failed closed", identity);
  }
  const result = parseIntegrationBackendResult(raw, candidateRequest);
  if (result === null || !result.ok) return failure("BACKEND_FAILURE", "Integration inspect returned no authoritative receipt", identity);
  const observationId = nextId(ingress, "observation");
  const observationContext = safeContext(ingress);
  if (observationId === null) return failure("RECONCILIATION_REQUIRED", "Integration inspect receipt cannot be persisted", identity);
  if (observationContext === null || observationContext.actor.actorId !== context.actor.actorId ||
      observationContext.leaseOwnerId !== context.leaseOwnerId) {
    return failure("RECONCILIATION_REQUIRED", "Integration inspect identity changed after observation", identity);
  }
  const observation = Object.freeze({ ...integrationBackendObservation(result.receipt, bound.reservation.reservationId, null, identity.decisionId), observationId });
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = reservationFor(current, command);
      if ("ok" in currentBound) throw new TypeError("Integration reservation changed before inspect observation");
      transaction.insertIntegrationObservation(observation);
      let currentReservation = currentBound.reservation;
      const now = afterTimestamp(currentReservation.updatedAt, observationContext.now);
      if ((result.receipt.code === "inspected_foreign" || result.receipt.code === "inspected_ambiguous") &&
          currentReservation.status === "active") {
        transaction.transitionIntegrationReservation(
          currentReservation.reservationId, currentReservation.revision, "active", currentReservation.leaseRevision,
          currentReservation.fencingToken, "ambiguous", currentReservation.leaseOwnerId,
          currentReservation.leaseRevision, currentReservation.expiresAt, observation.receiptSha256, now,
        );
      }
      transaction.insertIntegrationEvent(integrationEvent(
        identity.eventId, currentReservation.reservationId, identity.operationId, null,
        result.receipt.code === "inspected_ambiguous" || result.receipt.code === "inspected_foreign"
          ? "integration.ambiguous" : "integration.operation.observed",
        result.receipt.outcome === "succeeded" ? "accepted" : result.receipt.outcome,
        result.receipt.code, { ...observationContext, now }, identity.correlationId,
        result.receipt.observationNumber, result.receipt.evidenceReference,
      ));
      const readback = transaction.read();
      currentReservation = readback.integrationReservations.find((candidate) => candidate.reservationId === currentReservation.reservationId)!;
      return success(integrationView(readback, currentReservation, null, observation), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

function integrationAuthorization(
  decisionId: string,
  requestId: string,
  operationId: string,
  bindingRevision: number,
  phase: IntegrationAuthorizationDecisionRecord["phase"],
  context: TrustedContext,
  operation: IntegrationOperationKind,
  evaluation: AuthorizationEvaluation,
  confirmationId: string,
): IntegrationAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, operationId, bindingRevision, phase, actorId: context.actor.actorId,
    action: operation === "apply" ? "integration.apply" : "integration.push",
    result: evaluation.allowed ? "allow" as const : "deny" as const, reason: evaluation.reason,
    policy: evaluation.policy, grantId: evaluation.grantId, grantRevision: evaluation.grantRevision,
    confirmationId, createdAt: context.now,
  });
}

function sameEffectReplay(
  request: ApplicationState["integrationOperationRequests"][number],
  command: ApplyIntegrationCommand | PushIntegrationCommand,
): boolean {
  return request.idempotencyKey === command.idempotencyKey && request.operationKind ===
    (command.kind === "integration.apply" ? "apply" : "push") && request.reservationId === command.reservationId &&
    request.expectedReservationRevision === command.expectedReservationRevision &&
    request.expectedLeaseRevision === command.expectedLeaseRevision &&
    request.expectedFencingToken === command.expectedFencingToken;
}

function nonForeignNoEffect(receipt: IntegrationBackendReceipt, reservation: IntegrationReservationRecord): boolean {
  if (receipt.operation === "apply" && receipt.code === "apply_refused") {
    return receipt.localState === "unchanged" && receipt.localBeforeObjectId === reservation.expectedTargetObjectId &&
      receipt.localAfterObjectId === reservation.expectedTargetObjectId;
  }
  if (receipt.operation === "push" && receipt.code === "push_rejected") {
    return reservation.expectedRemoteHead !== reservation.sourceHeadObjectId &&
      ((reservation.expectedRemoteHead === null && receipt.remoteBeforeObjectId === null &&
          receipt.remoteAfterObjectId === null && receipt.remoteState === "absent") ||
        (reservation.expectedRemoteHead !== null && receipt.remoteBeforeObjectId === reservation.expectedRemoteHead &&
          receipt.remoteAfterObjectId === reservation.expectedRemoteHead &&
          (receipt.remoteState === "rejected" || receipt.remoteState === "unchanged")));
  }
  return false;
}

function ambiguousEffectReceipt(receipt: IntegrationBackendReceipt): boolean {
  return receipt.outcome === "ambiguous" || receipt.localState === "unknown" || receipt.localState === "foreign" ||
    receipt.remoteState === "unknown" || receipt.remoteState === "foreign";
}

async function integrationEffect(
  store: PersistenceStore,
  backend: IntegrationBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: ApplyIntegrationCommand | PushIntegrationCommand,
): Promise<Phase3ApplicationResult<IntegrationOperationView>> {
  if (!validReservationCommand(command)) return failure("INVALID_INPUT", "Integration effect command is invalid");
  const context = safeContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "Trusted integration effect ingress is invalid");
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, null); }
  const replay = state.integrationIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
  if (replay !== undefined) {
    const request = state.integrationOperationRequests.find((candidate) => candidate.requestId === replay.requestId);
    const reservation = state.integrationReservations.find((candidate) => candidate.reservationId === replay.reservationId);
    if (request === undefined || reservation === undefined || request.actorId !== context.actor.actorId || !sameEffectReplay(request, command)) {
      return failure("IDEMPOTENCY_CONFLICT", "Integration effect idempotency key is bound to another tuple");
    }
    return success(integrationView(state, reservation, replay),
      { requestId: request.requestId, correlationId: request.correlationId }, true);
  }
  const identity = operationIdentity(ingress, context);
  const intentId = nextId(ingress, "intent");
  if (identity === null || intentId === null) return failure("INVALID_INPUT", "Trusted integration effect identities are invalid", identity);
  const runtime = runtimeFailure<IntegrationOperationView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = reservationFor(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  const reservation = bound.reservation;
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const ownerExecution = state.executions.find((candidate) => candidate.executionId === reservation.ownerExecutionId);
  const ownerTask = ownerExecution === undefined ? undefined : state.domain.tasks.find((candidate) => candidate.id === ownerExecution.taskId);
  if (reservation.status !== "active" || reservation.expiresAt <= context.now || reservation.leaseOwnerId !== context.leaseOwnerId ||
      ownerExecution === undefined || ownerTask?.state !== "running" ||
      state.executionTerminalStates.some((candidate) => candidate.executionId === reservation.ownerExecutionId) ||
      currentIntegrationPolicy(state, reservation, options, context.now) === null ||
      state.integrationIntents.some((candidate) => candidate.reservationId === reservation.reservationId &&
        candidate.state !== "finalized" && candidate.state !== "failed")) {
    return failure("INVALID_STATE", "Integration effect requires one current authorized reservation", identity);
  }
  const action = command.kind === "integration.apply" ? "integration.apply" as const : "integration.push" as const;
  const preflightEvaluation = authorize(state, context, action, bound.project, "allow", false);
  let confirmationId: string | null = null;
  if (preflightEvaluation.reason === "confirmation_required") {
    try {
      confirmationId = ingress.confirmHighRisk(Object.freeze({
        actorId: context.actor.actorId, action, requestId: identity.requestId, correlationId: identity.correlationId,
        targetId: reservation.reservationId, targetRevision: reservation.revision,
      }));
    } catch {
      confirmationId = null;
    }
  }
  if (!identifier(confirmationId)) return failure("CONFIRMATION_REQUIRED", "Integration effect requires a named confirmation", identity);
  const operation: IntegrationOperationKind = action === "integration.apply" ? "apply" : "push";
  const lastObservationNumber = state.integrationObservations.filter((candidate) => candidate.reservationId === reservation.reservationId)
    .reduce((maximum, candidate) => Math.max(maximum, candidate.observationNumber), 0);
  let prepared: IntegrationIntentRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = reservationFor(current, command);
      if ("ok" in currentBound) throw new TypeError("Integration effect binding changed before prepare");
      const currentReservation = currentBound.reservation;
      const currentOwnerExecution = current.executions.find((candidate) => candidate.executionId === currentReservation.ownerExecutionId);
      const currentOwnerTask = currentOwnerExecution === undefined ? undefined : current.domain.tasks.find((candidate) => candidate.id === currentOwnerExecution.taskId);
      const eligible = currentReservation.status === "active" && currentReservation.expiresAt > context.now &&
        currentReservation.leaseOwnerId === context.leaseOwnerId && currentOwnerTask?.state === "running" &&
        !current.executionTerminalStates.some((candidate) => candidate.executionId === currentReservation.ownerExecutionId) &&
        currentIntegrationPolicy(current, currentReservation, options, context.now) !== null &&
        !current.integrationIntents.some((candidate) => candidate.reservationId === currentReservation.reservationId &&
          candidate.state !== "finalized" && candidate.state !== "failed");
      if (currentOwnerExecution === undefined) throw new TypeError("Integration owner execution disappeared");
      const evaluation = authorize(current, context, action, currentBound.project, eligible ? "allow" : "deny", true);
      persistGenericAuthorization(transaction, identity, action,
        action === "integration.apply" ? "integration.applied" : "integration.pushed",
        { project: currentBound.project, execution: currentOwnerExecution }, evaluation);
      transaction.insertIntegrationOperationRequest(Object.freeze({
        requestId: identity.requestId, operationId: identity.operationId, idempotencyKey: command.idempotencyKey,
        operationKind: operation, actorId: context.actor.actorId, correlationId: identity.correlationId,
        causationId: null, reservationId: currentReservation.reservationId,
        expectedReservationRevision: currentReservation.revision, expectedLeaseRevision: currentReservation.leaseRevision,
        expectedFencingToken: currentReservation.fencingToken, contractId: INTEGRATION_CONTRACT_ID,
        adapterId: options.integrationAdapterId, adapterVersion: options.integrationAdapterVersion, createdAt: context.now,
      }));
      transaction.insertIntegrationAuthorizationDecision(integrationAuthorization(
        identity.decisionId, identity.requestId, identity.operationId, 1, "prepare", context,
        operation, evaluation, confirmationId!,
      ));
      if (!evaluation.allowed || !eligible) {
        transaction.insertIntegrationEvent(integrationEvent(
          identity.eventId, currentReservation.reservationId, identity.operationId, null,
          "integration.operation.denied", "denied", evaluation.reason, context, identity.correlationId,
        ));
        return failure<IntegrationOperationView>("AUTHORIZATION_DENIED", "Integration effect prepare authorization was denied", identity);
      }
      const intent: IntegrationIntentRecord = Object.freeze({
        intentId, operationId: identity.operationId, idempotencyKey: command.idempotencyKey,
        requestId: identity.requestId, reservationId: currentReservation.reservationId,
        reservationFencingToken: currentReservation.fencingToken, operationKind: operation,
        state: "pending", revision: 1, currentAuthorizationDecisionId: identity.decisionId,
        authorizationBindingRevision: 1, lastObservationNumber,
        recoveryResult: null, lastFailureCategory: null, lastFailureCode: null,
        lastFailureRetryable: null, lastFailureAmbiguous: null, createdAt: context.now, updatedAt: context.now,
      });
      transaction.insertIntegrationIntent(intent);
      transaction.insertIntegrationEvent(integrationEvent(
        identity.eventId, currentReservation.reservationId, identity.operationId, intent.intentId,
        "integration.operation.prepared", "accepted", "prepared", context, identity.correlationId,
      ));
      return intent;
    });
    if ("ok" in result) return result;
    prepared = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const act = nextPhaseIdentity(ingress, context.actor.actorId, context.leaseOwnerId, prepared.updatedAt);
  if (act === null) return failure("RECONCILIATION_REQUIRED", "Integration intent is durable but act identities are unavailable", identity);
  let executing: IntegrationIntentRecord;
  let executingReservation: IntegrationReservationRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.integrationIntents.find((candidate) => candidate.intentId === prepared.intentId);
      const currentReservation = current.integrationReservations.find((candidate) => candidate.reservationId === prepared.reservationId);
      const currentProject = current.projects.find((candidate) => candidate.projectId === reservation.projectId);
      if (intent === undefined || intent.state !== "pending" || currentReservation === undefined || currentProject === undefined) {
        throw new TypeError("Integration prepare lineage changed before act");
      }
      const eligible = currentReservation.status === "active" && currentReservation.revision === reservation.revision &&
        currentReservation.leaseRevision === reservation.leaseRevision && currentReservation.fencingToken === reservation.fencingToken &&
        currentReservation.expiresAt > act.context.now && currentReservation.leaseOwnerId === act.context.leaseOwnerId &&
        currentIntegrationPolicy(current, currentReservation, options, act.context.now) !== null;
      const evaluation = authorize(current, act.context, action, currentProject, eligible ? "allow" : "deny", true);
      transaction.insertIntegrationAuthorizationDecision(integrationAuthorization(
        act.decisionId, intent.requestId, intent.operationId, 2, "act", act.context, operation, evaluation, confirmationId!,
      ));
      const now = afterTimestamp(intent.updatedAt, act.context.now);
      if (!evaluation.allowed || !eligible) {
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "pending", "failed", act.decisionId, 2,
          intent.lastObservationNumber, null,
          Object.freeze({ category: "unauthorized", code: evaluation.reason, retryable: false, ambiguous: false }), now,
        );
        transaction.insertIntegrationFinalization(Object.freeze({
          finalizationId: nextId(ingress, "finalization") ?? `integration-finalization:${intent.intentId}`,
          intentId: intent.intentId, verifiedReceiptId: null, authorizationDecisionId: act.decisionId,
          outcome: "failed", code: evaluation.reason, recoveryResult: null, finalizedAt: now,
        }));
        transaction.insertIntegrationEvent(integrationEvent(
          act.eventId, currentReservation.reservationId, intent.operationId, intent.intentId,
          "integration.operation.denied", "denied", evaluation.reason, { ...act.context, now }, identity.correlationId,
        ));
        return failure<IntegrationOperationView>("AUTHORIZATION_DENIED", "Integration effect act authorization was denied", identity);
      }
      transaction.transitionIntegrationIntent(
        intent.intentId, intent.revision, "pending", "executing", act.decisionId, 2,
        intent.lastObservationNumber, null, null, now,
      );
      transaction.insertIntegrationEvent(integrationEvent(
        act.eventId, currentReservation.reservationId, intent.operationId, intent.intentId,
        "integration.operation.executing", "accepted", "executing", { ...act.context, now }, identity.correlationId,
      ));
      return Object.freeze({
        intent: Object.freeze({ ...intent, state: "executing" as const, revision: intent.revision + 1,
          currentAuthorizationDecisionId: act.decisionId, authorizationBindingRevision: 2, updatedAt: now }),
        reservation: currentReservation,
      });
    });
    if ("ok" in result) return result;
    executing = result.intent;
    executingReservation = result.reservation;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const backendRequest = parseIntegrationBackendRequest(Object.freeze({
    contractId: INTEGRATION_CONTRACT_ID, operation, correlationId: identity.correlationId, causationId: null,
    actorId: context.actor.actorId, adapterId: options.integrationAdapterId, adapterVersion: options.integrationAdapterVersion,
    subject: integrationSubject(executingReservation), operationId: executing.operationId, intentId: executing.intentId,
    idempotencyKey: executing.idempotencyKey, finalAuthorizationDecisionId: executing.currentAuthorizationDecisionId,
    expectedObservationNumber: executing.lastObservationNumber,
  }));
  if (backendRequest === null || backendRequest.operation === "inspect") {
    return failure("RECONCILIATION_REQUIRED", "Durable integration request cannot be reconstructed", identity);
  }
  let raw: unknown;
  try {
    raw = await Promise.resolve(backendRequest.operation === "apply"
      ? backend.apply(backendRequest) : backend.push(backendRequest));
  } catch {
    raw = Object.freeze({ ok: false, error: Object.freeze({
      category: "ambiguous_external_state", code: "integration_adapter_exception", retryable: false,
      ambiguous: true, retryAfter: null, evidenceReference: null,
    }) });
  }
  const backendResult = parseIntegrationBackendResult(raw, backendRequest);
  if (backendResult === null || !backendResult.ok) {
    const backendError: IntegrationBackendFailure = backendResult?.ok === false ? backendResult.error : Object.freeze({
      category: "integrity_failure", code: "integration_result_invalid", retryable: false,
      ambiguous: true, retryAfter: null, evidenceReference: null,
    });
    const finalizationId = nextId(ingress, "finalization");
    const eventId = nextId(ingress, "event");
    if (finalizationId === null || eventId === null) return failure("RECONCILIATION_REQUIRED", "Integration effect may have occurred; terminal identities are unavailable", identity);
    try {
      return withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const intent = current.integrationIntents.find((candidate) => candidate.intentId === executing.intentId);
        const currentReservation = current.integrationReservations.find((candidate) => candidate.reservationId === executing.reservationId);
        if (intent === undefined || intent.state !== "executing" || currentReservation === undefined) {
          throw new TypeError("Integration effect failure lineage changed");
        }
        const now = afterTimestamp(intent.updatedAt, safeContext(ingress)?.now ?? intent.updatedAt);
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "executing", backendError.ambiguous ? "ambiguous" : "failed",
          intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision, intent.lastObservationNumber, null,
          Object.freeze({ category: backendError.category, code: backendError.code,
            retryable: backendError.retryable, ambiguous: backendError.ambiguous }), now,
        );
        if (backendError.ambiguous && currentReservation.status === "active") {
          transaction.transitionIntegrationReservation(
            currentReservation.reservationId, currentReservation.revision, "active", currentReservation.leaseRevision,
            currentReservation.fencingToken, "ambiguous", currentReservation.leaseOwnerId,
            currentReservation.leaseRevision, currentReservation.expiresAt, currentReservation.currentEvidenceSha256, now,
          );
        }
        if (!backendError.ambiguous) {
          transaction.insertIntegrationFinalization(Object.freeze({
            finalizationId, intentId: intent.intentId, verifiedReceiptId: null,
            authorizationDecisionId: intent.currentAuthorizationDecisionId,
            outcome: "failed", code: backendError.code, recoveryResult: null, finalizedAt: now,
          }));
        }
        transaction.insertIntegrationEvent(integrationEvent(
          eventId, currentReservation.reservationId, intent.operationId, intent.intentId,
          backendError.ambiguous ? "integration.ambiguous" : "integration.operation.finalized",
          backendError.ambiguous ? "ambiguous" : "failed", backendError.code,
          { ...context, now }, identity.correlationId, intent.lastObservationNumber, backendError.evidenceReference,
        ));
        const readback = transaction.read();
        return success(integrationView(
          readback,
          readback.integrationReservations.find((candidate) => candidate.reservationId === currentReservation.reservationId)!,
          readback.integrationIntents.find((candidate) => candidate.intentId === intent.intentId)!,
        ), identity);
      });
    } catch (error) {
      return mapThrown(error, identity);
    }
  }
  const receipt = backendResult.receipt;
  const observationId = nextId(ingress, "observation");
  const observedEventId = nextId(ingress, "event");
  const observationContext = safeContext(ingress);
  if (observationId === null || observedEventId === null) return failure("RECONCILIATION_REQUIRED", "Integration receipt cannot be persisted", identity);
  if (observationContext === null || observationContext.actor.actorId !== context.actor.actorId ||
      observationContext.leaseOwnerId !== context.leaseOwnerId) {
    return failure("RECONCILIATION_REQUIRED", "Integration observation identity changed after the effect", identity);
  }
  const observationNow = afterTimestamp(executing.updatedAt, observationContext.now);
  const observation = Object.freeze({
    ...integrationBackendObservation(receipt, executing.reservationId, executing.intentId, executing.currentAuthorizationDecisionId),
    observationId,
  });
  const receiptIsAmbiguous = ambiguousEffectReceipt(receipt);
  const receiptIsRefused = receipt.outcome === "refused" && nonForeignNoEffect(receipt, executingReservation);
  let observedIntent: IntegrationIntentRecord | null = null;
  let observedReservation: IntegrationReservationRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.integrationIntents.find((candidate) => candidate.intentId === executing.intentId);
      const currentReservation = current.integrationReservations.find((candidate) => candidate.reservationId === executing.reservationId);
      if (intent === undefined || intent.state !== "executing" || currentReservation === undefined || currentReservation.status !== "active") {
        throw new TypeError("Integration effect lineage changed before observation");
      }
      transaction.insertIntegrationObservation(observation);
      const evidenceSha256 = observation.receiptSha256;
      const now = afterTimestamp(intent.updatedAt, observationNow);
      if (receiptIsAmbiguous || (!receiptIsRefused && receipt.outcome !== "succeeded")) {
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "executing", "ambiguous", intent.currentAuthorizationDecisionId,
          intent.authorizationBindingRevision, receipt.observationNumber, null,
          Object.freeze({ category: "ambiguous_external_state", code: receipt.code, retryable: false, ambiguous: true }),
          now,
        );
        transaction.transitionIntegrationReservation(
          currentReservation.reservationId, currentReservation.revision, "active", currentReservation.leaseRevision,
          currentReservation.fencingToken, "ambiguous", currentReservation.leaseOwnerId,
          currentReservation.leaseRevision, currentReservation.expiresAt, evidenceSha256, now,
        );
      } else if (receiptIsRefused) {
        const verifiedReceiptId = nextId(ingress, "verified_receipt");
        const finalizationId = nextId(ingress, "finalization");
        if (verifiedReceiptId === null || finalizationId === null) throw new TypeError("Integration refusal identities are unavailable");
        transaction.insertIntegrationReceipt(Object.freeze({
          verifiedReceiptId, intentId: intent.intentId, observationId, observationNumber: receipt.observationNumber,
          adapterReceiptId: receipt.receiptId, receiptSha256: evidenceSha256, outcome: "refused", code: receipt.code,
          verifiedAt: now,
        }));
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "executing", "failed", intent.currentAuthorizationDecisionId,
          intent.authorizationBindingRevision, receipt.observationNumber, null,
          Object.freeze({ category: "conflict", code: receipt.code, retryable: false, ambiguous: false }), now,
        );
        transaction.transitionIntegrationReservation(
          currentReservation.reservationId, currentReservation.revision, "active", currentReservation.leaseRevision,
          currentReservation.fencingToken, "active", currentReservation.leaseOwnerId,
          currentReservation.leaseRevision, currentReservation.expiresAt, evidenceSha256, now,
        );
        transaction.insertIntegrationFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId,
          authorizationDecisionId: intent.currentAuthorizationDecisionId, outcome: "refused", code: receipt.code,
          recoveryResult: null, finalizedAt: now,
        }));
      } else {
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "executing", "observed", intent.currentAuthorizationDecisionId,
          intent.authorizationBindingRevision, receipt.observationNumber, null, null, now,
        );
        transaction.transitionIntegrationReservation(
          currentReservation.reservationId, currentReservation.revision, "active", currentReservation.leaseRevision,
          currentReservation.fencingToken, "active", currentReservation.leaseOwnerId,
          currentReservation.leaseRevision, currentReservation.expiresAt, evidenceSha256, now,
        );
      }
      transaction.insertIntegrationEvent(integrationEvent(
        observedEventId, currentReservation.reservationId, intent.operationId, intent.intentId,
        receiptIsAmbiguous ? "integration.ambiguous" : "integration.operation.observed",
        receipt.outcome === "succeeded" ? "accepted" : receipt.outcome,
        receipt.code, { ...observationContext, now }, identity.correlationId,
        receipt.observationNumber, receipt.evidenceReference,
      ));
      const readback = transaction.read();
      const nextIntent = readback.integrationIntents.find((candidate) => candidate.intentId === intent.intentId)!;
      const nextReservation = readback.integrationReservations.find((candidate) => candidate.reservationId === currentReservation.reservationId)!;
      return nextIntent.state === "observed"
        ? Object.freeze({ intent: nextIntent, reservation: nextReservation })
        : success(integrationView(readback, nextReservation, nextIntent, observation), identity);
    });
    if ("ok" in result) return result;
    observedIntent = result.intent;
    observedReservation = result.reservation;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const verifiedReceiptId = nextId(ingress, "verified_receipt");
  const verifiedEventId = nextId(ingress, "event");
  if (verifiedReceiptId === null || verifiedEventId === null || observedIntent === null) {
    return failure("RECONCILIATION_REQUIRED", "Integration observation needs explicit verification", identity);
  }
  let verifiedIntent: IntegrationIntentRecord;
  try {
    verifiedIntent = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.integrationIntents.find((candidate) => candidate.intentId === observedIntent!.intentId);
      const durable = current.integrationObservations.find((candidate) => candidate.observationId === observationId);
      if (intent === undefined || intent.state !== "observed" || durable === undefined || durable.outcome !== "succeeded") {
        throw new TypeError("Integration verification lineage changed");
      }
      const now = afterTimestamp(intent.updatedAt, safeContext(ingress)?.now ?? intent.updatedAt);
      transaction.insertIntegrationReceipt(Object.freeze({
        verifiedReceiptId, intentId: intent.intentId, observationId, observationNumber: durable.observationNumber,
        adapterReceiptId: durable.adapterReceiptId, receiptSha256: durable.receiptSha256,
        outcome: "succeeded", code: durable.code, verifiedAt: now,
      }));
      transaction.transitionIntegrationIntent(
        intent.intentId, intent.revision, "observed", "verified", intent.currentAuthorizationDecisionId,
        intent.authorizationBindingRevision, intent.lastObservationNumber, null, null, now,
      );
      transaction.insertIntegrationEvent(integrationEvent(
        verifiedEventId, intent.reservationId, intent.operationId, intent.intentId,
        "integration.operation.verified", "accepted", durable.code, { ...context, now },
        identity.correlationId, durable.observationNumber, durable.evidenceReference,
      ));
      return Object.freeze({ ...intent, state: "verified" as const, revision: intent.revision + 1, updatedAt: now });
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
  const finalize = nextPhaseIdentity(ingress, context.actor.actorId, context.leaseOwnerId, verifiedIntent.updatedAt);
  const finalizationId = nextId(ingress, "finalization");
  if (finalize === null || finalizationId === null) return failure("RECONCILIATION_REQUIRED", "Verified integration receipt requires finalization", identity);
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.integrationIntents.find((candidate) => candidate.intentId === verifiedIntent.intentId);
      const currentReservation = current.integrationReservations.find((candidate) => candidate.reservationId === verifiedIntent.reservationId);
      const currentProject = current.projects.find((candidate) => candidate.projectId === reservation.projectId);
      const verified = current.integrationReceipts.find((candidate) => candidate.verifiedReceiptId === verifiedReceiptId);
      if (intent === undefined || intent.state !== "verified" || currentReservation === undefined ||
          currentProject === undefined || verified === undefined) throw new TypeError("Integration finalization lineage changed");
      const eligible = currentReservation.status === "active" && currentReservation.revision === observedReservation.revision &&
        currentReservation.leaseRevision === observedReservation.leaseRevision &&
        currentReservation.fencingToken === observedReservation.fencingToken &&
        currentIntegrationPolicy(current, currentReservation, options, finalize.context.now) !== null;
      const evaluation = authorize(current, finalize.context, action, currentProject, eligible ? "allow" : "deny", true);
      transaction.insertIntegrationAuthorizationDecision(integrationAuthorization(
        finalize.decisionId, intent.requestId, intent.operationId, 3, "finalize", finalize.context,
        operation, evaluation, confirmationId!,
      ));
      const now = afterTimestamp(intent.updatedAt, finalize.context.now);
      if (!evaluation.allowed || !eligible) {
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "verified", "ambiguous", finalize.decisionId, 3,
          intent.lastObservationNumber, null, null, now,
        );
        transaction.transitionIntegrationReservation(
          currentReservation.reservationId, currentReservation.revision, "active", currentReservation.leaseRevision,
          currentReservation.fencingToken, "ambiguous", currentReservation.leaseOwnerId,
          currentReservation.leaseRevision, currentReservation.expiresAt, currentReservation.currentEvidenceSha256, now,
        );
      } else {
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "verified", "finalized", finalize.decisionId, 3,
          intent.lastObservationNumber, null, null, now,
        );
        transaction.insertIntegrationFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId,
          authorizationDecisionId: finalize.decisionId, outcome: "succeeded", code: verified.code,
          recoveryResult: null, finalizedAt: now,
        }));
      }
      transaction.insertIntegrationEvent(integrationEvent(
        finalize.eventId, currentReservation.reservationId, intent.operationId, intent.intentId,
        "integration.operation.finalized", evaluation.allowed && eligible ? "accepted" : "ambiguous",
        evaluation.allowed && eligible ? verified.code : evaluation.reason,
        { ...finalize.context, now }, identity.correlationId, intent.lastObservationNumber, observation.evidenceReference,
      ));
      const readback = transaction.read();
      return success(integrationView(
        readback,
        readback.integrationReservations.find((candidate) => candidate.reservationId === currentReservation.reservationId)!,
        readback.integrationIntents.find((candidate) => candidate.intentId === intent.intentId)!,
      ), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

async function recoverIntegration(
  store: PersistenceStore,
  backend: IntegrationBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: RecoverIntegrationCommand,
): Promise<Phase3ApplicationResult<IntegrationOperationView>> {
  if (!validReservationCommand(command) || !identifier(command.intentId)) {
    return failure("INVALID_INPUT", "Integration recovery command is invalid");
  }
  const context = safeContext(ingress);
  const identity = context === null ? null : operationIdentity(ingress, context);
  if (context === null || identity === null) return failure("INVALID_INPUT", "Trusted integration recovery identity is invalid", identity);
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, identity); }
  const runtime = runtimeFailure<IntegrationOperationView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = reservationFor(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  const sourceIntent = state.integrationIntents.find((candidate) => candidate.intentId === command.intentId &&
    candidate.reservationId === bound.reservation.reservationId);
  if (bound.reservation.status !== "ambiguous" || sourceIntent?.state !== "ambiguous") {
    return failure("INVALID_STATE", "Integration recovery requires the exact ambiguous reservation and intent", identity);
  }
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const lastObservationNumber = state.integrationObservations.filter((candidate) => candidate.reservationId === bound.reservation.reservationId)
    .reduce((maximum, candidate) => Math.max(maximum, candidate.observationNumber), 0);
  let evaluation: AuthorizationEvaluation;
  try {
    evaluation = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = reservationFor(current, command);
      const intent = current.integrationIntents.find((candidate) => candidate.intentId === command.intentId);
      if ("ok" in currentBound || currentBound.reservation.status !== "ambiguous" ||
          intent?.state !== "ambiguous" || intent.reservationId !== currentBound.reservation.reservationId) {
        throw new TypeError("Integration recovery binding changed");
      }
      const ownerExecution = current.executions.find((candidate) => candidate.executionId === currentBound.reservation.ownerExecutionId);
      if (ownerExecution === undefined) throw new TypeError("Integration owner execution is absent");
      const allowed = authorize(current, context, "integration.recover", currentBound.project, "read_not_applicable", true);
      persistGenericAuthorization(transaction, identity, "integration.recover", "integration.recovered",
        { project: currentBound.project, execution: ownerExecution }, allowed);
      return allowed;
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
  if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Integration recovery authorization was denied", identity);
  const request = parseIntegrationBackendRequest(Object.freeze({
    contractId: INTEGRATION_CONTRACT_ID, operation: "inspect", correlationId: identity.correlationId,
    causationId: sourceIntent.operationId, actorId: context.actor.actorId, adapterId: options.integrationAdapterId,
    adapterVersion: options.integrationAdapterVersion, subject: integrationSubject(bound.reservation),
    queryId: identity.operationId, readAuthorizationDecisionId: identity.decisionId, lastObservationNumber,
  }));
  if (request === null || request.operation !== "inspect") return failure("INVALID_INPUT", "Derived recovery inspection is invalid", identity);
  let raw: unknown;
  try { raw = await Promise.resolve(backend.inspect(request)); } catch {
    return failure("BACKEND_FAILURE", "Integration recovery inspection failed closed", identity);
  }
  const result = parseIntegrationBackendResult(raw, request);
  if (result === null || !result.ok) return failure("BACKEND_FAILURE", "Integration recovery returned no valid inspection", identity);
  const observationId = nextId(ingress, "observation");
  const eventId = nextId(ingress, "event");
  const observationContext = safeContext(ingress);
  if (observationId === null || eventId === null) return failure("RECONCILIATION_REQUIRED", "Recovery receipt cannot be persisted", identity);
  if (observationContext === null || observationContext.actor.actorId !== context.actor.actorId ||
      observationContext.leaseOwnerId !== context.leaseOwnerId) {
    return failure("RECONCILIATION_REQUIRED", "Integration recovery identity changed after observation", identity);
  }
  const observationNow = afterTimestamp(sourceIntent.updatedAt, observationContext.now);
  const observation = Object.freeze({
    ...integrationBackendObservation(result.receipt, bound.reservation.reservationId, sourceIntent.intentId, identity.decisionId),
    observationId,
  });
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = reservationFor(current, command);
      const intent = current.integrationIntents.find((candidate) => candidate.intentId === sourceIntent.intentId);
      if ("ok" in currentBound || currentBound.reservation.status !== "ambiguous" || intent?.state !== "ambiguous") {
        throw new TypeError("Integration recovery CAS changed before observation");
      }
      const reservation = currentBound.reservation;
      transaction.insertIntegrationObservation(observation);
      const observedAt = afterTimestamp(intent.updatedAt, observationNow);
      const recoveryResult = result.receipt.code === "inspected_unchanged" ? "recovered_no_effect" as const :
        result.receipt.code === "inspected_local_applied" ? "recovered_local_applied" as const :
          result.receipt.code === "inspected_pushed" ? "recovered_pushed" as const : "recovered_inconsistent" as const;
      if (result.receipt.code === "inspected_ambiguous") {
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "ambiguous", "ambiguous", identity.decisionId,
          intent.authorizationBindingRevision + 1, result.receipt.observationNumber, null,
          Object.freeze({ category: "ambiguous_external_state", code: result.receipt.code, retryable: false, ambiguous: true }),
          observedAt,
        );
        transaction.transitionIntegrationReservation(
          reservation.reservationId, reservation.revision, "ambiguous", reservation.leaseRevision,
          reservation.fencingToken, "ambiguous", reservation.leaseOwnerId, reservation.leaseRevision,
          reservation.expiresAt, observation.receiptSha256, observedAt,
        );
        transaction.insertIntegrationEvent(integrationEvent(
          eventId, reservation.reservationId, identity.operationId, intent.intentId,
          "integration.ambiguous", "ambiguous", result.receipt.code,
          { ...observationContext, now: observedAt }, identity.correlationId,
          result.receipt.observationNumber, result.receipt.evidenceReference,
        ));
      } else {
        const verifiedReceiptId = nextId(ingress, "verified_receipt");
        const finalizationId = nextId(ingress, "finalization");
        if (verifiedReceiptId === null || finalizationId === null) throw new TypeError("Recovery terminal identities are unavailable");
        const bindingRevision = intent.authorizationBindingRevision + 1;
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision, "ambiguous", "observed", identity.decisionId,
          bindingRevision, result.receipt.observationNumber, null, null, observedAt,
        );
        transaction.insertIntegrationReceipt(Object.freeze({
          verifiedReceiptId, intentId: intent.intentId, observationId,
          observationNumber: result.receipt.observationNumber, adapterReceiptId: result.receipt.receiptId,
          receiptSha256: observation.receiptSha256,
          outcome: result.receipt.outcome === "refused" ? "refused" : "succeeded",
          code: result.receipt.code, verifiedAt: observedAt,
        }));
        const verifiedAt = afterTimestamp(observedAt, observationContext.now);
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision + 1, "observed", "verified", identity.decisionId,
          bindingRevision, result.receipt.observationNumber, null, null,
          verifiedAt,
        );
        const finalizedAt = afterTimestamp(verifiedAt, observationContext.now);
        transaction.transitionIntegrationIntent(
          intent.intentId, intent.revision + 2, "verified", "finalized", identity.decisionId,
          bindingRevision, result.receipt.observationNumber, recoveryResult, null, finalizedAt,
        );
        transaction.insertIntegrationFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId, authorizationDecisionId: identity.decisionId,
          outcome: result.receipt.outcome === "refused" ? "refused" : "succeeded", code: result.receipt.code,
          recoveryResult, finalizedAt,
        }));
        const terminalStatus = finalizedAt < reservation.expiresAt ? "released" as const : "expired" as const;
        transaction.transitionIntegrationReservation(
          reservation.reservationId, reservation.revision, "ambiguous", reservation.leaseRevision,
          reservation.fencingToken, terminalStatus, reservation.leaseOwnerId, reservation.leaseRevision,
          reservation.expiresAt, observation.receiptSha256, finalizedAt,
        );
        transaction.insertIntegrationEvent(integrationEvent(
          eventId, reservation.reservationId, identity.operationId, intent.intentId,
          "integration.operation.reconciled", result.receipt.outcome === "refused" ? "refused" : "accepted",
          recoveryResult, { ...observationContext, now: finalizedAt }, identity.correlationId,
          result.receipt.observationNumber, result.receipt.evidenceReference,
        ));
      }
      const readback = transaction.read();
      return success(integrationView(
        readback,
        readback.integrationReservations.find((candidate) => candidate.reservationId === reservation.reservationId)!,
        readback.integrationIntents.find((candidate) => candidate.intentId === intent.intentId)!,
        observation,
      ), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

interface ExecutionSuccessEvidence {
  readonly intent: ApplicationState["executionIntents"][number];
  readonly observation: ApplicationState["executionObservations"][number];
  readonly receipt: ApplicationState["executionReceipts"][number];
  readonly finalization: ApplicationState["executionFinalizations"][number];
}

function executionSuccessEvidence(state: ApplicationState, bound: BoundPhase3): ExecutionSuccessEvidence | null {
  const candidates = state.executionFinalizations.filter((candidate) => candidate.outcome === "accepted" &&
    candidate.executionRevision === bound.execution.revision).sort((left, right) => right.finalizedAt.localeCompare(left.finalizedAt));
  for (const finalization of candidates) {
    const intent = state.executionIntents.find((candidate) => candidate.intentId === finalization.intentId);
    const receipt = finalization.verifiedReceiptId === null ? undefined : state.executionReceipts.find((candidate) =>
      candidate.verifiedReceiptId === finalization.verifiedReceiptId);
    const observation = intent === undefined ? undefined : state.executionObservations.filter((candidate) =>
      candidate.intentId === intent.intentId && candidate.lifecycle === "turn_succeeded")
      .sort((left, right) => right.observationNumber - left.observationNumber)[0];
    if (intent?.state === "finalized" && intent.executionId === bound.execution.executionId &&
        intent.taskId === bound.task.id && intent.attemptNumber === bound.execution.attemptNumber &&
        intent.fencingToken === bound.execution.fencingToken && receipt !== undefined &&
        receipt.intentId === intent.intentId && receipt.lifecycle === "turn_succeeded" &&
        observation !== undefined && observation.adapterReceiptId === receipt.adapterReceiptId) {
      return Object.freeze({ intent, observation, receipt, finalization });
    }
  }
  return null;
}

interface GateSetEvidence {
  readonly sha256: string;
  readonly receipts: readonly ApplicationState["completionGateReceipts"][number][];
}

function gateSetEvidence(
  state: ApplicationState,
  bound: BoundPhase3,
  policy: ProjectPolicyReceiptRecord,
  facts: ProjectPolicyFacts,
  options: Phase3ApplicationOptions,
  now: string,
): GateSetEvidence | null {
  const receipts: ApplicationState["completionGateReceipts"][number][] = [];
  const projection: unknown[] = [];
  const requirements = [...facts.requiredGates].sort((left, right) =>
    `${left.gateId}\u0000${left.gateVersion}`.localeCompare(`${right.gateId}\u0000${right.gateVersion}`));
  for (const gate of requirements) {
    const requestCandidates = state.completionGateRequests.filter((candidate) =>
      candidate.operationKind === "inspect_gate" && candidate.projectId === bound.project.projectId &&
      candidate.projectResourceRevision === bound.project.resourceRevision &&
      candidate.projectConfigRevision === bound.project.configRevision && candidate.projectRootKey === bound.project.rootKey &&
      candidate.repositoryIdentity === bound.workspaceReceipt.repositoryIdentity && candidate.taskId === bound.task.id &&
      candidate.taskRevision === bound.task.revision && candidate.executionId === bound.execution.executionId &&
      candidate.executionRevision === bound.execution.revision && candidate.attemptNumber === bound.execution.attemptNumber &&
      candidate.fencingToken === bound.execution.fencingToken && candidate.workspaceId === bound.workspace.workspaceId &&
      candidate.generation === bound.workspace.generation && candidate.workspaceRevision === bound.workspace.revision &&
      candidate.workspaceRootKey === bound.workspace.workspaceRootKey &&
      candidate.ownershipBindingSha256 === bound.workspaceReceipt.ownershipBindingSha256 &&
      candidate.headObjectId === bound.workspaceReceipt.headObjectId && candidate.policyReceiptId === policy.receiptId &&
      candidate.policyId === policy.policyId && candidate.policyConfigRevision === policy.policyConfigRevision &&
      candidate.gateId === gate.gateId && candidate.gateVersion === gate.gateVersion &&
      candidate.commandKey === gate.commandKey && candidate.commandIdentitySha256 === gate.commandIdentitySha256 &&
      candidate.completionEvidenceRootKey === options.completionEvidenceRootKey &&
      candidate.toolEnvironmentSha256 === gate.toolEnvironmentSha256 && candidate.contractId === COMPLETION_CONTRACT_ID &&
      candidate.adapterId === options.completionAdapterId && candidate.adapterVersion === options.completionAdapterVersion);
    const evidence = requestCandidates.flatMap((request) => {
      const intent = state.completionGateIntents.find((candidate) => candidate.requestId === request.requestId && candidate.state === "finalized");
      const finalization = intent === undefined ? undefined : state.completionGateFinalizations.find((candidate) =>
        candidate.intentId === intent.intentId && candidate.outcome === "accepted");
      const receipt = finalization?.verifiedReceiptId === null || finalization?.verifiedReceiptId === undefined
        ? undefined : state.completionGateReceipts.find((candidate) => candidate.verifiedReceiptId === finalization.verifiedReceiptId &&
          candidate.verdict === "pass" && (candidate.validUntil === null || candidate.validUntil > now));
      return receipt === undefined ? [] : [{ request, intent: intent!, finalization: finalization!, receipt }];
    }).sort((left, right) => right.receipt.verifiedAt.localeCompare(left.receipt.verifiedAt))[0];
    if (evidence === undefined) return null;
    receipts.push(evidence.receipt);
    projection.push(Object.freeze({
      gateId: gate.gateId, gateVersion: gate.gateVersion, commandKey: gate.commandKey,
      commandIdentitySha256: gate.commandIdentitySha256, toolEnvironmentSha256: gate.toolEnvironmentSha256,
      requestId: evidence.request.requestId, gateOperationId: evidence.receipt.gateOperationId,
      verifiedReceiptId: evidence.receipt.verifiedReceiptId, receiptSha256: evidence.receipt.receiptSha256,
      validUntil: evidence.receipt.validUntil,
    }));
  }
  return Object.freeze({ sha256: sha256(canonicalJson(projection)), receipts: Object.freeze(receipts) });
}

async function reopenGateSet(
  store: PersistenceStore,
  backend: CompletionBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: AcceptPolicyGatedCompletionCommand,
  completionOperationId: string,
  gates: GateSetEvidence,
): Promise<readonly string[] | null> {
  const intentIds: string[] = [];
  for (const receipt of gates.receipts) {
    const idempotencyKey = `completion-reopen:${sha256(canonicalJson({
      completionOperationId,
      gateOperationId: receipt.gateOperationId,
      verifiedReceiptId: receipt.verifiedReceiptId,
    }))}`;
    const result = await processGate(store, backend, ingress, options, Object.freeze({
      ...command,
      kind: "completion.gate.inspect" as const,
      gateOperationId: receipt.gateOperationId,
      idempotencyKey,
    }));
    if (!result.ok || result.value.state !== "finalized" || result.value.outcome !== "accepted" ||
        result.value.verdict !== "pass") return null;
    intentIds.push(result.value.intentId);
  }
  return Object.freeze(intentIds);
}

function integrationEvidenceSha256(
  state: ApplicationState,
  bound: BoundPhase3,
  facts: ProjectPolicyFacts,
): string | null {
  if (facts.integration === "not_required") return sha256(canonicalJson({ disposition: "not_required" }));
  const reservation = state.integrationReservations.find((candidate) => candidate.ownerExecutionId === bound.execution.executionId &&
    candidate.projectId === bound.project.projectId && candidate.repositoryIdentity === bound.workspaceReceipt.repositoryIdentity &&
    candidate.sourceWorkspaceId === bound.workspace.workspaceId && candidate.sourceGeneration === bound.workspace.generation &&
    candidate.sourceWorkspaceRevision === bound.workspace.revision &&
    candidate.sourceOwnershipBindingSha256 === bound.workspaceReceipt.ownershipBindingSha256 &&
    candidate.sourceHeadObjectId === bound.workspaceReceipt.headObjectId && candidate.status === "active");
  if (reservation === undefined) return null;
  const evidence = (["apply", "push"] as const).map((operation) => {
    const intent = state.integrationIntents.filter((candidate) => candidate.reservationId === reservation.reservationId &&
      candidate.operationKind === operation && candidate.state === "finalized")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const finalization = intent === undefined ? undefined : state.integrationFinalizations.find((candidate) =>
      candidate.intentId === intent.intentId && candidate.outcome === "succeeded");
    const receipt = finalization?.verifiedReceiptId === null || finalization?.verifiedReceiptId === undefined
      ? undefined : state.integrationReceipts.find((candidate) => candidate.verifiedReceiptId === finalization.verifiedReceiptId &&
        candidate.outcome === "succeeded");
    return intent === undefined || finalization === undefined || receipt === undefined ? null : Object.freeze({
      operation, intentId: intent.intentId, finalizationId: finalization.finalizationId,
      verifiedReceiptId: receipt.verifiedReceiptId, receiptSha256: receipt.receiptSha256,
    });
  });
  return evidence.some((item) => item === null) ? null : sha256(canonicalJson({
    reservationId: reservation.reservationId, reservationFencingToken: reservation.fencingToken,
    sourceHeadObjectId: reservation.sourceHeadObjectId, evidence,
  }));
}

function preservationEvidenceSha256(facts: ProjectPolicyFacts, integrationSha256: string): string | null {
  if (facts.preservation === "not_required") return sha256(canonicalJson({ disposition: "not_required" }));
  return facts.integration === "required" ? integrationSha256 : null;
}

function workspaceEvidenceSha256(bound: BoundPhase3): string {
  return sha256(canonicalJson({
    workspaceId: bound.workspace.workspaceId,
    generation: bound.workspace.generation,
    workspaceRevision: bound.workspace.revision,
    workspaceRootKey: bound.workspace.workspaceRootKey,
    verifiedReceiptId: bound.workspaceReceipt.verifiedReceiptId,
    receiptSha256: bound.workspaceReceipt.receiptSha256,
    repositoryIdentity: bound.workspaceReceipt.repositoryIdentity,
    branchReference: bound.workspaceReceipt.branchReference,
    headObjectId: bound.workspaceReceipt.headObjectId,
    ownershipBindingSha256: bound.workspaceReceipt.ownershipBindingSha256,
  }));
}

function completionView(state: ApplicationState, completionDecisionId: string): PolicyGatedCompletionView {
  const parent = state.completionDecisions.find((candidate) => candidate.completionDecisionId === completionDecisionId);
  const child = state.policyGatedCompletionDecisions.find((candidate) => candidate.completionDecisionId === completionDecisionId);
  const terminal = state.executionTerminalStates.find((candidate) => candidate.completionDecisionId === completionDecisionId);
  if (parent === undefined || child === undefined || terminal === undefined) throw new TypeError("Policy completion lineage is incomplete");
  return Object.freeze({
    completionDecisionId, taskId: parent.taskId, taskRevision: parent.postTaskRevision,
    executionId: parent.executionId, executionTerminalCreatedAt: terminal.createdAt,
    gateSetSha256: child.gateSetSha256, integrationEvidenceSha256: child.integrationEvidenceSha256,
    preservationStateSha256: child.preservationStateSha256,
  });
}

async function acceptCompletion(
  store: PersistenceStore,
  backend: CompletionBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: AcceptPolicyGatedCompletionCommand,
): Promise<Phase3ApplicationResult<PolicyGatedCompletionView>> {
  if (!validBindingCommand(command) || !identifier(command.policyReceiptId) || !identifier(command.idempotencyKey)) {
    return failure("INVALID_INPUT", "Policy-gated completion command is invalid");
  }
  const context = safeContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "Trusted completion ingress is invalid");
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, null); }
  const replay = state.policyGatedCompletionDecisions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
  if (replay !== undefined) {
    const parent = state.completionDecisions.find((candidate) => candidate.completionDecisionId === replay.completionDecisionId);
    const request = state.requests.find((candidate) => candidate.requestId === replay.requestId);
    if (parent === undefined || request?.actorId !== context.actor.actorId || parent.taskId !== command.taskId ||
        parent.executionId !== command.executionId || parent.attemptNumber !== command.expectedAttemptNumber ||
        parent.fencingToken !== command.expectedFencingToken || parent.preTaskRevision !== command.expectedTaskRevision ||
        replay.policyReceiptId !== command.policyReceiptId) return failure("IDEMPOTENCY_CONFLICT", "Completion idempotency key is bound to another tuple");
    return success(completionView(state, replay.completionDecisionId),
      { requestId: replay.requestId, correlationId: request.correlationId }, true);
  }
  const identity = operationIdentity(ingress, context);
  const completionDecisionId = nextId(ingress, "completion");
  if (identity === null || completionDecisionId === null) return failure("INVALID_INPUT", "Trusted completion identities are invalid", identity);
  const runtime = runtimeFailure<PolicyGatedCompletionView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = bindPhase3(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (bound.task.state !== "running" || state.executionTerminalStates.some((candidate) => candidate.executionId === bound.execution.executionId)) {
    return failure("INVALID_STATE", "Policy-gated completion requires a nonterminal running Task", identity);
  }
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const policy = currentPolicyReceipt(
    state, command.policyReceiptId, "completion_requirements", "completion.accept",
    completionSubject(bound), options, context.now,
  );
  if (policy === null) return failure("EVIDENCE_STALE", "Completion policy receipt is stale", identity);
  const facts = parseProjectPolicyFacts(JSON.parse(policy.factsJson));
  const executionSuccess = executionSuccessEvidence(state, bound);
  const gates = facts === null ? null : gateSetEvidence(state, bound, policy, facts, options, context.now);
  const integrationSha = facts === null ? null : integrationEvidenceSha256(state, bound, facts);
  const initialPreservationSha = facts === null || integrationSha === null
    ? null : preservationEvidenceSha256(facts, integrationSha);
  if (facts === null || executionSuccess === null || gates === null || integrationSha === null ||
      initialPreservationSha === null) {
    return failure("EVIDENCE_STALE", "Completion evidence is incomplete or stale", identity);
  }
  let confirmationId: string | null;
  try {
    confirmationId = ingress.confirmHighRisk(Object.freeze({
      actorId: context.actor.actorId, action: "completion.accept", requestId: identity.requestId,
      correlationId: identity.correlationId, targetId: bound.execution.executionId,
      targetRevision: bound.execution.revision,
    }));
  } catch {
    confirmationId = null;
  }
  if (!identifier(confirmationId)) return failure("CONFIRMATION_REQUIRED", "Policy-gated completion requires a named confirmation", identity);
  const reopenedIntentIds = await reopenGateSet(store, backend, ingress, options, command, identity.operationId, gates);
  if (reopenedIntentIds === null) {
    return failure("EVIDENCE_STALE", "Required gate evidence did not reopen as a current pass", identity);
  }
  const finalContext = safeContext(ingress);
  if (finalContext === null || finalContext.actor.actorId !== context.actor.actorId ||
      finalContext.leaseOwnerId !== context.leaseOwnerId || finalContext.now < context.now) {
    return failure("RECONCILIATION_REQUIRED", "Completion identity changed during gate reopening", identity);
  }
  let refreshedState: ApplicationState;
  try { refreshedState = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, identity); }
  const refreshedBound = bindPhase3(refreshedState, command);
  if ("ok" in refreshedBound || !sameBound(refreshedBound, bound) || refreshedBound.task.state !== "running" ||
      refreshedState.executionTerminalStates.some((candidate) => candidate.executionId === refreshedBound.execution.executionId) ||
      !projectIdentityCurrent(refreshedBound.project, store)) {
    return failure("STALE_REVISION", "Completion binding changed during gate reopening", identity);
  }
  const refreshedPolicy = currentPolicyReceipt(
    refreshedState, command.policyReceiptId, "completion_requirements", "completion.accept",
    completionSubject(refreshedBound), options, finalContext.now,
  );
  const refreshedFacts = refreshedPolicy === null ? null : parseProjectPolicyFacts(JSON.parse(refreshedPolicy.factsJson));
  const refreshedSuccess = executionSuccessEvidence(refreshedState, refreshedBound);
  const refreshedGates = refreshedPolicy === null || refreshedFacts === null ? null :
    gateSetEvidence(refreshedState, refreshedBound, refreshedPolicy, refreshedFacts, options, finalContext.now);
  const refreshedIntegrationSha = refreshedFacts === null ? null : integrationEvidenceSha256(refreshedState, refreshedBound, refreshedFacts);
  const preservationSha = refreshedFacts === null || refreshedIntegrationSha === null
    ? null : preservationEvidenceSha256(refreshedFacts, refreshedIntegrationSha);
  const reopened = new Set(reopenedIntentIds);
  if (refreshedPolicy === null || refreshedFacts === null || refreshedSuccess === null || refreshedGates === null ||
      refreshedIntegrationSha === null || preservationSha === null ||
      refreshedGates.receipts.length !== reopened.size ||
      refreshedGates.receipts.some((receipt) => !reopened.has(receipt.intentId))) {
    return failure("EVIDENCE_STALE", "Fresh gate, integration, or preservation evidence changed before completion", identity);
  }
  const finalIdentity: OperationIdentity = Object.freeze({ ...identity, ...finalContext });
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const concurrent = current.policyGatedCompletionDecisions.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
      if (concurrent !== undefined) throw new TypeError("Concurrent completion idempotency conflict");
      const currentBound = bindPhase3(current, command);
      if ("ok" in currentBound || !sameBound(currentBound, bound) || currentBound.task.state !== "running" ||
          current.executionTerminalStates.some((candidate) => candidate.executionId === currentBound.execution.executionId)) {
        throw new TypeError("Completion binding changed before CAS");
      }
      const currentPolicy = currentPolicyReceipt(
        current, command.policyReceiptId, "completion_requirements", "completion.accept",
        completionSubject(currentBound), options, finalContext.now,
      );
      const currentFacts = currentPolicy === null ? null : parseProjectPolicyFacts(JSON.parse(currentPolicy.factsJson));
      const currentSuccess = executionSuccessEvidence(current, currentBound);
      const currentGates = currentPolicy === null || currentFacts === null ? null :
        gateSetEvidence(current, currentBound, currentPolicy, currentFacts, options, finalContext.now);
      const currentIntegrationSha = currentFacts === null ? null : integrationEvidenceSha256(current, currentBound, currentFacts);
      const currentPreservationSha = currentFacts === null || currentIntegrationSha === null
        ? null : preservationEvidenceSha256(currentFacts, currentIntegrationSha);
      const evidenceCurrent = currentPolicy !== null && currentFacts !== null && currentSuccess !== null &&
        currentGates !== null && currentIntegrationSha !== null && currentPreservationSha !== null &&
        currentGates.sha256 === refreshedGates.sha256 && currentIntegrationSha === refreshedIntegrationSha &&
        currentPreservationSha === preservationSha && currentSuccess.receipt.verifiedReceiptId === refreshedSuccess.receipt.verifiedReceiptId &&
        currentGates.receipts.length === reopened.size && currentGates.receipts.every((receipt) => reopened.has(receipt.intentId));
      const evaluation = authorize(current, finalContext, "completion.accept", currentBound.project,
        evidenceCurrent ? "allow" : "deny", true);
      persistGenericAuthorization(transaction, finalIdentity, "completion.accept", "completion.accepted", currentBound,
        evaluation);
      if (!evaluation.allowed || !evidenceCurrent || currentPolicy === null || currentSuccess === null || currentGates === null ||
          currentIntegrationSha === null || currentPreservationSha === null) {
        return failure("AUTHORIZATION_DENIED", "Policy-gated completion authorization or evidence was denied", identity);
      }
      if (current.policyGatedCompletionDecisions.some((candidate) => candidate.confirmationId === confirmationId) ||
          current.manualCompletionDecisions.some((candidate) => candidate.confirmationId === confirmationId) ||
          current.executionIntents.some((candidate) => candidate.confirmationId === confirmationId)) {
        throw new TypeError("Completion confirmation was already consumed");
      }
      const postTaskRevision = currentBound.task.revision + 1;
      transaction.insertCompletionDecision(Object.freeze({
        completionDecisionId, kind: "policy_gated", taskId: currentBound.task.id,
        executionId: currentBound.execution.executionId, attemptNumber: currentBound.execution.attemptNumber,
        fencingToken: currentBound.execution.fencingToken, preTaskRevision: currentBound.task.revision,
        postTaskRevision, executionRevision: currentBound.execution.revision, createdAt: finalContext.now,
      }));
      transaction.insertPolicyGatedCompletionDecision(Object.freeze({
        completionDecisionId, operationId: identity.operationId, idempotencyKey: command.idempotencyKey,
        executionSuccessVerifiedReceiptId: currentSuccess.receipt.verifiedReceiptId,
        executionSuccessFinalizationId: currentSuccess.finalization.finalizationId,
        policyReceiptId: currentPolicy.receiptId, gateSetSha256: currentGates.sha256,
        workspaceEvidenceSha256: workspaceEvidenceSha256(currentBound), headObjectId: currentBound.workspaceReceipt.headObjectId!,
        integrationEvidenceSha256: currentIntegrationSha, preservationStateSha256: preservationSha,
        requestId: identity.requestId, authorizationDecisionId: identity.decisionId, auditId: identity.auditId,
        confirmationId: confirmationId!, createdAt: finalContext.now,
      }));
      const domainTransition = transitionTask(current.domain, Object.freeze({
        taskId: currentBound.task.id, event: "completion_accepted" as const, targetState: "completed" as const,
        payload: Object.freeze({ decision: Object.freeze({
          decisionId: completionDecisionId, taskId: currentBound.task.id,
          taskRevision: currentBound.task.revision, status: "accepted" as const,
        }) }),
      }));
      if (!domainTransition.ok) throw new TypeError("Policy-gated Domain completion was rejected");
      transaction.writeDomain(current.domain, domainTransition.value);
      transaction.insertExecutionTerminalState(Object.freeze({
        executionId: currentBound.execution.executionId, status: "completed", attemptNumber: currentBound.execution.attemptNumber,
        fencingToken: currentBound.execution.fencingToken, verifiedReceiptId: currentSuccess.receipt.verifiedReceiptId,
        finalizationId: currentSuccess.finalization.finalizationId, completionDecisionId,
        preTaskRevision: currentBound.task.revision, postTaskRevision, executionRevision: currentBound.execution.revision,
        createdAt: finalContext.now,
      }));
      const readback = transaction.read();
      const completedTask = readback.domain.tasks.find((candidate) => candidate.id === currentBound.task.id);
      if (completedTask?.state !== "completed" || completedTask.revision !== postTaskRevision) {
        throw new TypeError("Policy-gated completion readback failed");
      }
      return success(completionView(readback, completionDecisionId), finalIdentity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

interface CleanupEvidence {
  readonly parent: ApplicationState["completionDecisions"][number];
  readonly child: ApplicationState["policyGatedCompletionDecisions"][number];
  readonly terminal: ApplicationState["executionTerminalStates"][number];
  readonly completionFacts: ProjectPolicyFacts;
  readonly integrationReservation: IntegrationReservationRecord | null;
  readonly integrationDisposition: "not_required" | "released" | "expired";
}

function cleanupEvidence(state: ApplicationState, bound: BoundPhase3): CleanupEvidence | null {
  const parent = state.completionDecisions.find((candidate) => candidate.kind === "policy_gated" &&
    candidate.executionId === bound.execution.executionId && candidate.taskId === bound.task.id &&
    candidate.postTaskRevision === bound.task.revision);
  const child = parent === undefined ? undefined : state.policyGatedCompletionDecisions.find((candidate) =>
    candidate.completionDecisionId === parent.completionDecisionId);
  const terminal = parent === undefined ? undefined : state.executionTerminalStates.find((candidate) =>
    candidate.executionId === bound.execution.executionId && candidate.status === "completed" &&
    candidate.completionDecisionId === parent.completionDecisionId);
  const policy = child === undefined ? undefined : state.projectPolicyReceipts.find((candidate) =>
    candidate.receiptId === child.policyReceiptId && candidate.operation === "completion_requirements");
  const facts = policy === undefined ? null : parseProjectPolicyFacts(JSON.parse(policy.factsJson));
  const expectedPreservationSha = facts === null || child === undefined
    ? null : preservationEvidenceSha256(facts, child.integrationEvidenceSha256);
  if (parent === undefined || child === undefined || terminal === undefined || facts === null ||
      expectedPreservationSha === null || child.preservationStateSha256 !== expectedPreservationSha) return null;
  const currentReservations = state.integrationReservations.filter((candidate) =>
    candidate.ownerExecutionId === bound.execution.executionId && candidate.sourceWorkspaceId === bound.workspace.workspaceId &&
    candidate.sourceGeneration === bound.workspace.generation);
  if (currentReservations.some((candidate) => candidate.status === "active" || candidate.status === "ambiguous")) return null;
  if (facts.integration === "required") {
    const terminalReservation = currentReservations.filter((candidate) => candidate.status === "released" || candidate.status === "expired")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    if (terminalReservation === undefined) return null;
    return Object.freeze({ parent, child, terminal, completionFacts: facts,
      integrationReservation: terminalReservation,
      integrationDisposition: terminalReservation.status === "released" ? "released" as const : "expired" as const });
  }
  return Object.freeze({ parent, child, terminal, completionFacts: facts,
    integrationReservation: null, integrationDisposition: "not_required" });
}

function cleanupSubjectFromEvidence(
  state: ApplicationState,
  bound: BoundPhase3,
  evidence: CleanupEvidence,
  workspaceRevision: number = bound.workspace.revision,
): CleanupPolicySubject {
  return Object.freeze({
    ...completionSubject(bound),
    // Advancing the durable generation from ready to cleaning records the
    // already-authorized intent; it does not change the policy subject's
    // physical workspace snapshot.  Point-of-use validation therefore binds
    // the same ready revision while separately proving the cleaning revision
    // through the intent, attestation, and quiescence projection.
    workspaceRevision,
    taskRevision: evidence.parent.postTaskRevision,
    completionDecisionId: evidence.parent.completionDecisionId,
    executionTerminalCreatedAt: evidence.terminal.createdAt,
    gateSetSha256: evidence.child.gateSetSha256,
    preservationStateSha256: evidence.child.preservationStateSha256,
    integrationDisposition: evidence.integrationDisposition,
    integrationReservationId: evidence.integrationReservation?.reservationId ?? null,
    observedInventorySha256: cleanupInventorySha256(state, bound.workspaceReceipt),
  });
}

function cleanupQuiescence(
  state: ApplicationState,
  bound: BoundPhase3,
  evidence: CleanupEvidence,
  intentId: string,
  permittedIntentState: "pending" | "executing",
  workspaceRevision: number,
  observedAt: string,
): WorkspaceCleanupQuiescence | null {
  const activeExecutionOwnerCount = state.executionTerminalStates.some((candidate) =>
    candidate.executionId === bound.execution.executionId && candidate.status === "completed") ? 0 : 1;
  const currentIntegrationReservationCount = state.integrationReservations.filter((candidate) =>
    candidate.ownerExecutionId === bound.execution.executionId &&
    (candidate.status === "active" || candidate.status === "ambiguous")).length;
  const unfinishedCompletionGateIntentCount = state.completionGateIntents.filter((intent) => {
    const request = state.completionGateRequests.find((candidate) => candidate.requestId === intent.requestId);
    return request?.executionId === bound.execution.executionId && intent.state !== "finalized" && intent.state !== "failed";
  }).length;
  const reservationIds = new Set(state.integrationReservations.filter((candidate) =>
    candidate.ownerExecutionId === bound.execution.executionId).map((candidate) => candidate.reservationId));
  const unfinishedIntegrationIntentCount = state.integrationIntents.filter((intent) => reservationIds.has(intent.reservationId) &&
    intent.state !== "finalized" && intent.state !== "failed").length;
  const unfinishedWorkspace = state.workspaceIntents.filter((intent) => intent.workspaceId === bound.workspace.workspaceId &&
    intent.generation === bound.workspace.generation && intent.state !== "finalized" && intent.state !== "failed");
  const excluded = unfinishedWorkspace.filter((intent) => intent.intentId === intentId && intent.operationKind === "cleanup" &&
    intent.state === permittedIntentState);
  if (activeExecutionOwnerCount !== 0 || currentIntegrationReservationCount !== 0 ||
      unfinishedCompletionGateIntentCount !== 0 || unfinishedIntegrationIntentCount !== 0 || excluded.length !== 1 ||
      unfinishedWorkspace.length !== 1 || evidence.child.preservationStateSha256.length !== 64) return null;
  return Object.freeze({
    activeExecutionOwnerCount: 0,
    currentIntegrationReservationCount: 0,
    executionId: bound.execution.executionId,
    executionTerminalCreatedAt: evidence.terminal.createdAt,
    generation: bound.workspace.generation,
    observedAt,
    taskId: bound.task.id,
    taskRevision: bound.task.revision,
    unfinishedCompletionGateIntentCount: 0,
    unfinishedIntegrationIntentCount: 0,
    unfinishedWorkspaceIntentCount: 0,
    workspaceId: bound.workspace.workspaceId,
    workspaceRevision,
  });
}

function workspaceAuthorization(
  decisionId: string,
  requestId: string,
  operationId: string,
  bindingRevision: number,
  phase: WorkspaceAuthorizationDecisionRecord["phase"],
  context: TrustedContext,
  evaluation: AuthorizationEvaluation,
  bound: BoundPhase3,
  generationRevision: number,
): WorkspaceAuthorizationDecisionRecord {
  return Object.freeze({
    decisionId, requestId, operationId, bindingRevision, phase, actorId: context.actor.actorId,
    action: "workspace.cleanup", result: evaluation.allowed ? "allow" as const : "deny" as const,
    reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision, projectId: bound.project.projectId,
    projectResourceRevision: bound.project.resourceRevision, projectConfigRevision: bound.project.configRevision,
    executionId: bound.execution.executionId, executionRevision: bound.execution.revision,
    fencingToken: bound.execution.fencingToken, workspaceId: bound.workspace.workspaceId,
    generation: bound.workspace.generation, generationRevision, createdAt: context.now,
  });
}

function workspaceEvent(
  eventId: string,
  operationId: string,
  intentId: string | null,
  eventKind: WorkspaceEventRecord["eventKind"],
  outcome: WorkspaceEventRecord["outcome"],
  reasonCode: string,
  context: TrustedContext,
  correlationId: string,
  generation: WorkspaceGenerationRecord,
  observationNumber: number | null = null,
  evidenceReference: string | null = null,
): WorkspaceEventRecord {
  return Object.freeze({
    eventId, operationId, intentId, eventKind, outcome, reasonCode, actorId: context.actor.actorId,
    correlationId, causationId: null, workspaceId: generation.workspaceId, generation: generation.generation,
    generationRevision: generation.revision, observationNumber, evidenceReference, createdAt: context.now,
  });
}

function cleanupView(state: ApplicationState, intent: WorkspaceOperationIntentRecord): WorkspaceCleanupView {
  const generation = state.workspaceGenerations.find((candidate) => candidate.workspaceId === intent.workspaceId &&
    candidate.generation === intent.generation);
  const finalization = state.workspaceFinalizations.find((candidate) => candidate.intentId === intent.intentId);
  const observation = state.workspaceObservations.filter((candidate) => candidate.intentId === intent.intentId)
    .sort((left, right) => right.observationNumber - left.observationNumber)[0];
  const attestation = state.workspaceCleanupAttestations.find((candidate) => candidate.intentId === intent.intentId);
  if (generation === undefined) throw new TypeError("Cleanup workspace generation is absent");
  return Object.freeze({
    operationId: intent.operationId, intentId: intent.intentId, state: intent.state,
    outcome: finalization?.outcome ?? null, code: finalization?.code ?? observation?.code ?? null,
    workspaceId: generation.workspaceId, generation: generation.generation,
    workspaceRevision: generation.revision, workspaceStatus: generation.status,
    attestationSha256: attestation?.attestationSha256 ?? null,
    evidenceReference: observation?.evidenceReference ?? null,
  });
}

function cleanupReceiptObservation(
  receipt: WorkspaceBackendReceipt,
  intent: WorkspaceOperationIntentRecord,
  observationId: string,
): WorkspaceObservationRecord {
  return Object.freeze({
    observationId, intentId: intent.intentId, observationNumber: 1, adapterReceiptId: receipt.receiptId,
    receiptSha256: sha256(canonicalJson(receipt)), authorizationDecisionId: intent.currentAuthorizationDecisionId,
    externalState: receipt.externalState, outcome: receipt.outcome, code: receipt.code,
    pathSafety: receipt.pathSafety, ownershipMatch: receipt.ownershipMatch,
    trackedCount: receipt.inventory.trackedCount, modifiedCount: receipt.inventory.modifiedCount,
    untrackedCount: receipt.inventory.untrackedCount, ignoredCount: receipt.inventory.ignoredCount,
    repositoryIdentity: receipt.repositoryIdentity, branchReference: receipt.branchReference,
    headObjectId: receipt.headObjectId, ownershipBindingSha256: receipt.ownershipBindingSha256,
    evidenceReference: receipt.evidenceReference, cleanupAttestationSha256: receipt.cleanupAttestationSha256,
    observedAt: receipt.observedAt,
  });
}

async function cleanupWorkspace(
  store: PersistenceStore,
  backend: WorkspaceBackend,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
  command: CleanupWorkspaceCommand,
): Promise<Phase3ApplicationResult<WorkspaceCleanupView>> {
  if (!validBindingCommand(command) || !identifier(command.policyReceiptId) || !identifier(command.idempotencyKey)) {
    return failure("INVALID_INPUT", "Workspace cleanup command is invalid");
  }
  const context = safeContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "Trusted cleanup ingress is invalid");
  let state: ApplicationState;
  try { state = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, null); }
  const replay = state.workspaceIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
  if (replay !== undefined) {
    if (replay.operationKind !== "cleanup" || replay.actorId !== context.actor.actorId || replay.workspaceId !== command.workspaceId ||
        replay.generation !== command.expectedGeneration) return failure("IDEMPOTENCY_CONFLICT", "Cleanup idempotency key is bound to another tuple");
    return success(cleanupView(state, replay), { requestId: replay.requestId, correlationId: replay.correlationId }, true);
  }
  const identity = operationIdentity(ingress, context);
  const intentId = nextId(ingress, "intent");
  if (identity === null || intentId === null) return failure("INVALID_INPUT", "Trusted cleanup identities are invalid", identity);
  const runtime = runtimeFailure<WorkspaceCleanupView>(store, state, context);
  if (runtime !== null) return Object.freeze({ ...runtime, requestId: identity.requestId, correlationId: identity.correlationId });
  const bound = bindPhase3(state, command);
  if ("ok" in bound) return Object.freeze({ ...bound, requestId: identity.requestId, correlationId: identity.correlationId });
  if (bound.task.state !== "completed") return failure("INVALID_STATE", "Workspace cleanup requires a completed Task", identity);
  if (!projectIdentityCurrent(bound.project, store)) return failure("PROJECT_IDENTITY_CHANGED", "Project root identity changed", identity);
  const evidence = cleanupEvidence(state, bound);
  const subject = evidence === null ? null : cleanupSubjectFromEvidence(state, bound, evidence);
  const policy = subject === null ? null : currentPolicyReceipt(
    state, command.policyReceiptId, "evaluate_cleanup", "workspace.cleanup", subject, options, context.now,
  );
  const policyFacts = policy === null ? null : parseProjectPolicyFacts(JSON.parse(policy.factsJson));
  if (evidence === null || subject === null || policy === null || policyFacts?.cleanup !== "allowed_after_completion") {
    return failure("EVIDENCE_STALE", "Cleanup policy, completion, integration, or preservation evidence is stale", identity);
  }
  let confirmationId: string | null;
  try {
    confirmationId = ingress.confirmHighRisk(Object.freeze({
      actorId: context.actor.actorId, action: "workspace.cleanup", requestId: identity.requestId,
      correlationId: identity.correlationId, targetId: bound.workspace.workspaceId, targetRevision: bound.workspace.revision,
    }));
  } catch {
    confirmationId = null;
  }
  if (!identifier(confirmationId)) return failure("CONFIRMATION_REQUIRED", "Workspace cleanup requires a named confirmation", identity);
  let prepared: WorkspaceOperationIntentRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const currentBound = bindPhase3(current, command);
      if ("ok" in currentBound || !sameBound(currentBound, bound) || currentBound.task.state !== "completed") {
        throw new TypeError("Cleanup binding changed before prepare");
      }
      const currentEvidence = cleanupEvidence(current, currentBound);
      const currentSubject = currentEvidence === null ? null : cleanupSubjectFromEvidence(current, currentBound, currentEvidence);
      const currentPolicy = currentSubject === null ? null : currentPolicyReceipt(
        current, command.policyReceiptId, "evaluate_cleanup", "workspace.cleanup", currentSubject, options, context.now,
      );
      const currentFacts = currentPolicy === null ? null : parseProjectPolicyFacts(JSON.parse(currentPolicy.factsJson));
      const eligible = currentEvidence !== null && currentPolicy !== null && currentFacts?.cleanup === "allowed_after_completion";
      const evaluation = authorize(current, context, "workspace.cleanup", currentBound.project, eligible ? "allow" : "deny", true);
      transaction.insertWorkspaceAuthorizationDecision(workspaceAuthorization(
        identity.decisionId, identity.requestId, identity.operationId, 1, "prepare", context,
        evaluation, currentBound, currentBound.workspace.revision,
      ));
      if (!evaluation.allowed || !eligible) {
        transaction.insertWorkspaceEvent(workspaceEvent(
          identity.eventId, identity.operationId, null, "workspace.operation.denied", "denied",
          evaluation.reason, context, identity.correlationId, currentBound.workspace,
        ));
        return failure<WorkspaceCleanupView>("AUTHORIZATION_DENIED", "Workspace cleanup prepare authorization was denied", identity);
      }
      const intent: WorkspaceOperationIntentRecord = Object.freeze({
        intentId, operationId: identity.operationId, idempotencyKey: command.idempotencyKey,
        operationKind: "cleanup", action: "workspace.cleanup", state: "pending", revision: 1,
        actorId: context.actor.actorId, requestId: identity.requestId, correlationId: identity.correlationId,
        causationId: null, currentAuthorizationDecisionId: identity.decisionId, authorizationBindingRevision: 1,
        confirmationId: confirmationId!, workspaceId: currentBound.workspace.workspaceId,
        generation: currentBound.workspace.generation, expectedGenerationRevision: currentBound.workspace.revision,
        expectedGenerationStatus: "ready", lastObservationNumber: 0,
        lastFailureCategory: null, lastFailureCode: null, lastFailureRetryable: null,
        lastFailureAmbiguous: null, contractId: WORKSPACE_CONTRACT_ID,
        adapterId: options.workspaceAdapterId, adapterVersion: options.workspaceAdapterVersion,
        createdAt: context.now, updatedAt: context.now,
      });
      transaction.insertWorkspaceIntent(intent);
      transaction.insertWorkspaceEvent(workspaceEvent(
        identity.eventId, identity.operationId, intent.intentId, "workspace.operation.prepared", "accepted",
        "prepared", context, identity.correlationId, currentBound.workspace,
      ));
      return intent;
    });
    if ("ok" in result) return result;
    prepared = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const act = nextPhaseIdentity(ingress, context.actor.actorId, context.leaseOwnerId, prepared.updatedAt);
  const attestationId = nextId(ingress, "attestation");
  const deniedFinalizationId = nextId(ingress, "finalization");
  if (act === null || attestationId === null || deniedFinalizationId === null) {
    return failure("RECONCILIATION_REQUIRED", "Cleanup intent is durable but attestation identities are unavailable", identity);
  }
  let executing: Readonly<{
    intent: WorkspaceOperationIntentRecord;
    generation: WorkspaceGenerationRecord;
    attestation: WorkspaceCleanupAttestation;
  }>;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.workspaceIntents.find((candidate) => candidate.intentId === prepared.intentId);
      const currentBound = bindPhase3(current, command);
      if (intent === undefined || intent.state !== "pending" || "ok" in currentBound || !sameBound(currentBound, bound) ||
          currentBound.workspace.status !== "ready") throw new TypeError("Cleanup prepare lineage changed before attestation");
      const currentEvidence = cleanupEvidence(current, currentBound);
      const currentSubject = currentEvidence === null ? null : cleanupSubjectFromEvidence(current, currentBound, currentEvidence);
      const currentPolicy = currentSubject === null ? null : currentPolicyReceipt(
        current, command.policyReceiptId, "evaluate_cleanup", "workspace.cleanup", currentSubject, options, act.context.now,
      );
      const currentFacts = currentPolicy === null ? null : parseProjectPolicyFacts(JSON.parse(currentPolicy.factsJson));
      const predictedWorkspaceRevision = currentBound.workspace.revision + 1;
      const quiescence = currentEvidence === null ? null : cleanupQuiescence(
        current, currentBound, currentEvidence, intent.intentId, "pending", predictedWorkspaceRevision, act.context.now,
      );
      const eligible = currentEvidence !== null && currentPolicy !== null && currentFacts?.cleanup === "allowed_after_completion" &&
        quiescence !== null;
      const evaluation = authorize(current, act.context, "workspace.cleanup", currentBound.project, eligible ? "allow" : "deny", true);
      transaction.insertWorkspaceAuthorizationDecision(workspaceAuthorization(
        act.decisionId, act.requestId, intent.operationId, 2, "act", act.context,
        evaluation, currentBound, predictedWorkspaceRevision,
      ));
      if (!evaluation.allowed || !eligible || currentEvidence === null || currentPolicy === null || quiescence === null ||
          evaluation.grantId === null || evaluation.grantRevision === null) {
        transaction.terminateWorkspaceIntent(
          intent.intentId, intent.revision, "pending", "failed", intent.currentAuthorizationDecisionId,
          intent.authorizationBindingRevision, act.decisionId, 2, currentBound.workspace.revision,
          currentBound.workspace.status,
          Object.freeze({ category: "unauthorized", code: evaluation.reason, retryable: false, ambiguous: false }), act.context.now,
        );
        transaction.insertWorkspaceFinalization(Object.freeze({
          finalizationId: deniedFinalizationId,
          intentId: intent.intentId, verifiedReceiptId: null, authorizationDecisionId: act.decisionId,
          outcome: "failed", code: evaluation.reason, resultingGenerationStatus: currentBound.workspace.status,
          resultingGenerationRevision: currentBound.workspace.revision, finalizedAt: act.context.now,
        }));
        transaction.insertWorkspaceEvent(workspaceEvent(
          act.eventId, intent.operationId, intent.intentId, "workspace.operation.denied", "denied",
          evaluation.reason, act.context, identity.correlationId, currentBound.workspace,
        ));
        return failure<WorkspaceCleanupView>("AUTHORIZATION_DENIED", "Cleanup final authorization or quiescence was denied", identity);
      }
      const cleaningGeneration: WorkspaceGenerationRecord = Object.freeze({
        ...currentBound.workspace, revision: predictedWorkspaceRevision, status: "cleaning" as const, updatedAt: act.context.now,
      });
      const quiescenceSha256 = workspaceCleanupQuiescenceSha256(quiescence);
      const integrationReservation = currentEvidence.integrationReservation;
      const unsigned = Object.freeze({
        contractId: WORKSPACE_CLEANUP_ATTESTATION_CONTRACT_ID,
        attestationId, operationId: intent.operationId, intentId: intent.intentId,
        projectId: currentBound.project.projectId, projectResourceRevision: currentBound.project.resourceRevision,
        projectConfigRevision: currentBound.project.configRevision, projectRootKey: currentBound.project.rootKey,
        repositoryIdentity: currentBound.workspaceReceipt.repositoryIdentity!, taskId: currentBound.task.id,
        taskCompletedRevision: currentBound.task.revision, completionDecisionId: currentEvidence.parent.completionDecisionId,
        executionId: currentBound.execution.executionId, executionRevision: currentBound.execution.revision,
        attemptNumber: currentBound.execution.attemptNumber, fencingToken: currentBound.execution.fencingToken,
        executionTerminalCreatedAt: currentEvidence.terminal.createdAt, workspaceId: currentBound.workspace.workspaceId,
        generation: currentBound.workspace.generation, workspaceRevision: predictedWorkspaceRevision,
        workspaceRootKey: currentBound.workspace.workspaceRootKey,
        ownershipBindingSha256: currentBound.workspaceReceipt.ownershipBindingSha256!,
        policyReceiptId: currentPolicy.receiptId, policyReceiptSha256: currentPolicy.receiptSha256,
        policyConfigRevision: currentPolicy.policyConfigRevision, cleanupAuthorizationDecisionId: act.decisionId,
        cleanupAuthorizationBindingRevision: 2, grantId: evaluation.grantId, grantRevision: evaluation.grantRevision,
        confirmationId: confirmationId!, gateSetSha256: currentEvidence.child.gateSetSha256,
        preservationStateSha256: currentEvidence.child.preservationStateSha256,
        integrationDisposition: currentEvidence.integrationDisposition,
        integrationReservationId: integrationReservation?.reservationId ?? null,
        integrationReservationRevision: integrationReservation?.revision ?? null,
        integrationReservationFencingToken: integrationReservation?.fencingToken ?? null,
        expectedBranchReference: options.integrationTargetReference,
        expectedHeadObjectId: currentBound.workspaceReceipt.headObjectId!, quiescenceSha256,
        issuedAt: act.context.now,
        validUntil: new Date(new Date(act.context.now).valueOf() + options.cleanupAttestationValiditySeconds * 1000).toISOString(),
      });
      const candidate = Object.freeze({ ...unsigned, attestationSha256: workspaceCleanupAttestationSha256(unsigned) });
      const attestation = parseWorkspaceCleanupAttestation(candidate);
      if (attestation === null) throw new TypeError("Derived cleanup attestation is invalid");
      transaction.transitionWorkspaceGeneration(
        currentBound.workspace.workspaceId, currentBound.workspace.generation, currentBound.workspace.revision,
        "ready", "cleaning", act.context.now,
      );
      transaction.insertWorkspaceCleanupAttestation(Object.freeze({
        attestationId, operationId: intent.operationId, intentId: intent.intentId,
        projectId: currentBound.project.projectId, taskId: currentBound.task.id,
        executionId: currentBound.execution.executionId, workspaceId: currentBound.workspace.workspaceId,
        generation: currentBound.workspace.generation, attestationJson: canonicalJson(attestation),
        attestationSha256: attestation.attestationSha256, quiescenceSha256,
        issuedAt: attestation.issuedAt, validUntil: attestation.validUntil,
      }));
      transaction.startWorkspaceIntent(
        intent.intentId, intent.revision, intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
        act.decisionId, 2, cleaningGeneration.revision, "cleaning", act.context.now,
      );
      transaction.insertWorkspaceEvent(workspaceEvent(
        act.eventId, intent.operationId, intent.intentId, "workspace.operation.executing", "accepted",
        "attested", act.context, identity.correlationId, cleaningGeneration,
      ));
      return Object.freeze({
        intent: Object.freeze({ ...intent, state: "executing" as const, revision: intent.revision + 1,
          currentAuthorizationDecisionId: act.decisionId, authorizationBindingRevision: 2,
          expectedGenerationRevision: cleaningGeneration.revision, expectedGenerationStatus: "cleaning" as const,
          updatedAt: act.context.now }),
        generation: cleaningGeneration,
        attestation,
      });
    });
    if ("ok" in result) return result;
    executing = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  try { ingress.beforeCleanupPointOfUse?.(); } catch {
    return failure("RECONCILIATION_REQUIRED", "Cleanup point-of-use interlock failed", identity);
  }
  const pointContext = safeContext(ingress);
  if (pointContext === null || pointContext.actor.actorId !== context.actor.actorId ||
      pointContext.leaseOwnerId !== context.leaseOwnerId) {
    return failure("RECONCILIATION_REQUIRED", "Cleanup point-of-use identity changed", identity);
  }
  let pointOfUseState: ApplicationState;
  try { pointOfUseState = readApplicationStateForOwner(store); } catch (error) { return mapThrown(error, identity); }
  const pointBound = bindPhase3(
    pointOfUseState,
    { ...command, expectedWorkspaceRevision: executing.generation.revision },
    "cleaning",
  );
  const pointIntent = pointOfUseState.workspaceIntents.find((candidate) => candidate.intentId === executing.intent.intentId);
  const pointEvidence = "ok" in pointBound ? null : cleanupEvidence(pointOfUseState, pointBound);
  const pointQuiescence = "ok" in pointBound || pointEvidence === null ? null : cleanupQuiescence(
    pointOfUseState, pointBound, pointEvidence, executing.intent.intentId, "executing",
    executing.generation.revision, executing.attestation.issuedAt,
  );
  const durableAttestation = pointOfUseState.workspaceCleanupAttestations.find((candidate) => candidate.intentId === executing.intent.intentId);
  const pointSubject = "ok" in pointBound || pointEvidence === null
    ? null : cleanupSubjectFromEvidence(pointOfUseState, pointBound, pointEvidence, pointBound.workspace.revision - 1);
  const pointPolicy = pointSubject === null ? null : currentPolicyReceipt(
    pointOfUseState, command.policyReceiptId, "evaluate_cleanup", "workspace.cleanup",
    pointSubject, options, pointContext.now,
  );
  const pointPolicyFacts = pointPolicy === null ? null : parseProjectPolicyFacts(JSON.parse(pointPolicy.factsJson));
  const pointEvaluation = "ok" in pointBound ? null : authorize(
    pointOfUseState, pointContext, "workspace.cleanup", pointBound.project,
    pointPolicy !== null && pointPolicyFacts?.cleanup === "allowed_after_completion" ? "allow" : "deny", true,
  );
  const attestedDecision = pointOfUseState.workspaceAuthorizationDecisions.find((candidate) =>
    candidate.decisionId === executing.attestation.cleanupAuthorizationDecisionId && candidate.operationId === executing.intent.operationId &&
    candidate.bindingRevision === executing.attestation.cleanupAuthorizationBindingRevision && candidate.phase === "act");
  if ("ok" in pointBound || pointIntent?.state !== "executing" || pointBound.workspace.status !== "cleaning" ||
      pointEvidence === null || pointQuiescence === null || durableAttestation === undefined ||
      durableAttestation.attestationSha256 !== executing.attestation.attestationSha256 ||
      workspaceCleanupQuiescenceSha256(pointQuiescence) !== executing.attestation.quiescenceSha256 ||
      pointPolicy === null || pointPolicyFacts?.cleanup !== "allowed_after_completion" ||
      pointPolicy.receiptId !== executing.attestation.policyReceiptId ||
      pointPolicy.receiptSha256 !== executing.attestation.policyReceiptSha256 ||
      pointPolicy.policyConfigRevision !== executing.attestation.policyConfigRevision ||
      pointEvaluation === null || !pointEvaluation.allowed ||
      pointEvaluation.grantId !== executing.attestation.grantId ||
      pointEvaluation.grantRevision !== executing.attestation.grantRevision ||
      attestedDecision?.result !== "allow" || attestedDecision.grantId !== executing.attestation.grantId ||
      attestedDecision.grantRevision !== executing.attestation.grantRevision ||
      pointContext.now < executing.attestation.issuedAt ||
      executing.attestation.validUntil <= pointContext.now || !projectIdentityCurrent(pointBound.project, store)) {
    return failure("RECONCILIATION_REQUIRED", "Cleanup attestation failed point-of-use revalidation", identity);
  }
  const backendRequest = parseWorkspaceBackendRequest(Object.freeze({
    contractId: WORKSPACE_CONTRACT_ID, operation: "cleanup", operationId: executing.intent.operationId,
    idempotencyKey: executing.intent.idempotencyKey, correlationId: executing.intent.correlationId,
    causationId: null, adapterId: options.workspaceAdapterId, adapterVersion: options.workspaceAdapterVersion,
    subject: workspaceSubjectForGeneration(executing.generation, pointBound.task.revision),
    cleanupAttestation: executing.attestation,
  }));
  if (backendRequest === null || backendRequest.operation !== "cleanup") {
    return failure("RECONCILIATION_REQUIRED", "Durable cleanup request cannot be reconstructed", identity);
  }
  let raw: unknown;
  try { raw = await Promise.resolve(invokeWorkspaceBackend(backend, backendRequest)); } catch {
    raw = Object.freeze({ ok: false, error: Object.freeze({
      category: "ambiguous_external_state", code: "workspace_cleanup_adapter_exception", retryable: false,
      ambiguous: true, retryAfter: null, evidenceReference: null,
    }) });
  }
  const backendResult = parseWorkspaceBackendResult(raw);
  if (backendResult === null || !backendResult.ok) {
    const backendError: WorkspaceBackendFailure = backendResult?.ok === false ? backendResult.error : Object.freeze({
      category: "integrity_failure", code: "workspace_cleanup_result_invalid", retryable: false,
      ambiguous: true, retryAfter: null, evidenceReference: null,
    });
    const finalizationId = nextId(ingress, "finalization");
    const eventId = nextId(ingress, "event");
    if (finalizationId === null || eventId === null) return failure("RECONCILIATION_REQUIRED", "Cleanup failure cannot be persisted", identity);
    try {
      return withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const intent = current.workspaceIntents.find((candidate) => candidate.intentId === executing.intent.intentId);
        const generation = current.workspaceGenerations.find((candidate) => candidate.workspaceId === executing.generation.workspaceId &&
          candidate.generation === executing.generation.generation);
        if (intent === undefined || intent.state !== "executing" || generation?.status !== "cleaning") {
          throw new TypeError("Cleanup failure lineage changed");
        }
        const now = afterTimestamp(intent.updatedAt, safeContext(ingress)?.now ?? intent.updatedAt);
        const nextStatus = backendError.ambiguous ? "recovery_required" as const : "ready" as const;
        transaction.transitionWorkspaceGeneration(generation.workspaceId, generation.generation, generation.revision,
          "cleaning", nextStatus, now);
        transaction.terminateWorkspaceIntent(
          intent.intentId, intent.revision, "executing", backendError.ambiguous ? "ambiguous" : "failed",
          intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
          intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
          generation.revision + 1, nextStatus,
          Object.freeze({ category: backendError.category, code: backendError.code,
            retryable: backendError.retryable, ambiguous: backendError.ambiguous }), now,
        );
        transaction.insertWorkspaceFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId: null,
          authorizationDecisionId: intent.currentAuthorizationDecisionId,
          outcome: backendError.ambiguous ? "ambiguous" : "failed", code: backendError.code,
          resultingGenerationStatus: nextStatus, resultingGenerationRevision: generation.revision + 1, finalizedAt: now,
        }));
        transaction.insertWorkspaceEvent(workspaceEvent(
          eventId, intent.operationId, intent.intentId, "workspace.operation.finalized",
          backendError.ambiguous ? "ambiguous" : "failed", backendError.code,
          { ...context, now }, identity.correlationId,
          { ...generation, revision: generation.revision + 1, status: nextStatus, updatedAt: now },
          intent.lastObservationNumber, backendError.evidenceReference,
        ));
        const readback = transaction.read();
        return success(cleanupView(readback, readback.workspaceIntents.find((candidate) => candidate.intentId === intent.intentId)!), identity);
      });
    } catch (error) {
      return mapThrown(error, identity);
    }
  }
  const receipt = backendResult.receipt;
  if (receipt.cleanupAttestationSha256 !== executing.attestation.attestationSha256) {
    return failure("RECONCILIATION_REQUIRED", "Cleanup receipt did not echo the exact attestation", identity);
  }
  const observationId = nextId(ingress, "observation");
  const eventId = nextId(ingress, "event");
  const ambiguousFinalizationId = nextId(ingress, "finalization");
  const observationContext = safeContext(ingress);
  if (observationId === null || eventId === null || ambiguousFinalizationId === null) {
    return failure("RECONCILIATION_REQUIRED", "Cleanup receipt cannot be observed", identity);
  }
  if (observationContext === null || observationContext.actor.actorId !== context.actor.actorId ||
      observationContext.leaseOwnerId !== context.leaseOwnerId) {
    return failure("RECONCILIATION_REQUIRED", "Cleanup observation identity changed after the effect", identity);
  }
  const observationNow = afterTimestamp(executing.intent.updatedAt, observationContext.now);
  const observation = cleanupReceiptObservation(receipt, executing.intent, observationId);
  let observedIntent: WorkspaceOperationIntentRecord;
  try {
    const result = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.workspaceIntents.find((candidate) => candidate.intentId === executing.intent.intentId);
      const generation = current.workspaceGenerations.find((candidate) => candidate.workspaceId === executing.generation.workspaceId &&
        candidate.generation === executing.generation.generation);
      if (intent === undefined || intent.state !== "executing" || generation?.status !== "cleaning") {
        throw new TypeError("Cleanup observation lineage changed");
      }
      const now = afterTimestamp(intent.updatedAt, observationNow);
      transaction.insertWorkspaceObservation(observation);
      const determinate = receipt.outcome !== "ambiguous" &&
        ((receipt.outcome === "succeeded" &&
          ((receipt.code === "removed" && receipt.externalState === "removed") ||
            (receipt.code === "already_absent" && receipt.externalState === "absent"))) ||
          (receipt.outcome === "refused" && receipt.code === "refused"));
      if (!determinate) {
        transaction.transitionWorkspaceGeneration(generation.workspaceId, generation.generation, generation.revision,
          "cleaning", "recovery_required", now);
        transaction.observeWorkspaceIntent(
          intent.intentId, intent.revision, "ambiguous", observation.observationNumber,
          generation.revision + 1, "recovery_required",
          Object.freeze({ category: "ambiguous_external_state", code: receipt.code, retryable: false, ambiguous: true }), now,
        );
        transaction.insertWorkspaceFinalization(Object.freeze({
          finalizationId: ambiguousFinalizationId,
          intentId: intent.intentId, verifiedReceiptId: null, authorizationDecisionId: intent.currentAuthorizationDecisionId,
          outcome: "ambiguous", code: receipt.code, resultingGenerationStatus: "recovery_required",
          resultingGenerationRevision: generation.revision + 1, finalizedAt: now,
        }));
      } else {
        transaction.observeWorkspaceIntent(
          intent.intentId, intent.revision, "observed", observation.observationNumber,
          generation.revision, generation.status, null, now,
        );
      }
      transaction.insertWorkspaceEvent(workspaceEvent(
        eventId, intent.operationId, intent.intentId, "workspace.operation.observed",
        determinate ? (receipt.outcome === "succeeded" ? "accepted" : "refused") : "ambiguous",
        receipt.code, { ...observationContext, now }, identity.correlationId,
        determinate ? generation : { ...generation, revision: generation.revision + 1, status: "recovery_required", updatedAt: now },
        observation.observationNumber, receipt.evidenceReference,
      ));
      const readback = transaction.read();
      const updated = readback.workspaceIntents.find((candidate) => candidate.intentId === intent.intentId)!;
      return determinate ? updated : success(cleanupView(readback, updated), identity);
    });
    if ("ok" in result) return result;
    observedIntent = result;
  } catch (error) {
    return mapThrown(error, identity);
  }
  const verifiedReceiptId = nextId(ingress, "verified_receipt");
  const verifiedEventId = nextId(ingress, "event");
  if (verifiedReceiptId === null || verifiedEventId === null) return failure("RECONCILIATION_REQUIRED", "Cleanup observation requires verification", identity);
  let verifiedIntent: WorkspaceOperationIntentRecord;
  try {
    verifiedIntent = withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.workspaceIntents.find((candidate) => candidate.intentId === observedIntent.intentId);
      const generation = current.workspaceGenerations.find((candidate) => candidate.workspaceId === executing.generation.workspaceId &&
        candidate.generation === executing.generation.generation);
      const durable = current.workspaceObservations.find((candidate) => candidate.observationId === observationId);
      if (intent === undefined || intent.state !== "observed" || generation?.status !== "cleaning" || durable === undefined) {
        throw new TypeError("Cleanup verification lineage changed");
      }
      const now = afterTimestamp(intent.updatedAt, safeContext(ingress)?.now ?? intent.updatedAt);
      transaction.insertWorkspaceReceipt(Object.freeze({
        verifiedReceiptId, intentId: intent.intentId, observationId, observationNumber: durable.observationNumber,
        adapterReceiptId: durable.adapterReceiptId, receiptSha256: durable.receiptSha256,
        workspaceId: generation.workspaceId, generation: generation.generation, generationRevision: generation.revision,
        externalState: durable.externalState, outcome: durable.outcome === "refused" ? "refused" : "succeeded",
        code: durable.code, repositoryIdentity: durable.repositoryIdentity,
        branchReference: durable.branchReference, headObjectId: durable.headObjectId,
        ownershipBindingSha256: durable.ownershipBindingSha256,
        cleanupAttestationSha256: durable.cleanupAttestationSha256, verifiedAt: now,
      }));
      transaction.verifyWorkspaceIntent(intent.intentId, intent.revision, now);
      transaction.insertWorkspaceEvent(workspaceEvent(
        verifiedEventId, intent.operationId, intent.intentId, "workspace.operation.verified",
        durable.outcome === "refused" ? "refused" : "accepted", durable.code,
        { ...context, now }, identity.correlationId, generation,
        durable.observationNumber, durable.evidenceReference,
      ));
      return Object.freeze({ ...intent, state: "verified" as const, revision: intent.revision + 1, updatedAt: now });
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
  const finalize = nextPhaseIdentity(ingress, context.actor.actorId, context.leaseOwnerId, verifiedIntent.updatedAt);
  const finalizationId = nextId(ingress, "finalization");
  if (finalize === null || finalizationId === null) return failure("RECONCILIATION_REQUIRED", "Verified cleanup receipt requires finalization", identity);
  try {
    return withApplicationTransaction(store, (transaction) => {
      const current = transaction.read();
      const intent = current.workspaceIntents.find((candidate) => candidate.intentId === verifiedIntent.intentId);
      const generation = current.workspaceGenerations.find((candidate) => candidate.workspaceId === executing.generation.workspaceId &&
        candidate.generation === executing.generation.generation);
      const verified = current.workspaceReceipts.find((candidate) => candidate.verifiedReceiptId === verifiedReceiptId);
      const currentProject = current.projects.find((candidate) => candidate.projectId === bound.project.projectId);
      if (intent === undefined || intent.state !== "verified" || generation?.status !== "cleaning" ||
          verified === undefined || currentProject === undefined) throw new TypeError("Cleanup finalization lineage changed");
      const evaluation = authorize(current, finalize.context, "workspace.cleanup", currentProject, "allow", true);
      const targetStatus = verified.outcome === "succeeded" ? "cleaned" as const : "ready" as const;
      transaction.insertWorkspaceAuthorizationDecision(workspaceAuthorization(
        finalize.decisionId, finalize.requestId, intent.operationId, 3, "finalize", finalize.context,
        evaluation, { ...bound, workspace: generation }, generation.revision,
      ));
      const now = afterTimestamp(intent.updatedAt, finalize.context.now);
      if (!evaluation.allowed) {
        transaction.transitionWorkspaceGeneration(generation.workspaceId, generation.generation, generation.revision,
          "cleaning", "recovery_required", now);
        transaction.terminateWorkspaceIntent(
          intent.intentId, intent.revision, "verified", "ambiguous", intent.currentAuthorizationDecisionId,
          intent.authorizationBindingRevision, finalize.decisionId, 3, generation.revision + 1,
          "recovery_required", Object.freeze({ category: "ambiguous_external_state", code: evaluation.reason,
            retryable: false, ambiguous: true }), now,
        );
        transaction.insertWorkspaceFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId: null,
          authorizationDecisionId: finalize.decisionId, outcome: "ambiguous", code: evaluation.reason,
          resultingGenerationStatus: "recovery_required", resultingGenerationRevision: generation.revision + 1,
          finalizedAt: now,
        }));
      } else {
        transaction.transitionWorkspaceGeneration(generation.workspaceId, generation.generation, generation.revision,
          "cleaning", targetStatus, now);
        transaction.finalizeWorkspaceIntent(
          intent.intentId, intent.revision, intent.currentAuthorizationDecisionId, intent.authorizationBindingRevision,
          finalize.decisionId, 3, generation.revision + 1, targetStatus, now,
        );
        transaction.insertWorkspaceFinalization(Object.freeze({
          finalizationId, intentId: intent.intentId, verifiedReceiptId,
          authorizationDecisionId: finalize.decisionId,
          outcome: verified.outcome === "succeeded" ? "succeeded" : "refused", code: verified.code,
          resultingGenerationStatus: targetStatus, resultingGenerationRevision: generation.revision + 1,
          finalizedAt: now,
        }));
      }
      transaction.insertWorkspaceEvent(workspaceEvent(
        finalize.eventId, intent.operationId, intent.intentId, "workspace.operation.finalized",
        evaluation.allowed ? (verified.outcome === "succeeded" ? "accepted" : "refused") : "ambiguous",
        evaluation.allowed ? verified.code : evaluation.reason, { ...finalize.context, now },
        identity.correlationId,
        { ...generation, revision: generation.revision + 1,
          status: evaluation.allowed ? targetStatus : "recovery_required", updatedAt: now },
        intent.lastObservationNumber, observation.evidenceReference,
      ));
      const readback = transaction.read();
      return success(cleanupView(readback, readback.workspaceIntents.find((candidate) => candidate.intentId === intent.intentId)!), identity);
    });
  } catch (error) {
    return mapThrown(error, identity);
  }
}

export function createPhase3ApplicationService(
  store: PersistenceStore,
  adapters: Readonly<{
    readonly projectPolicy: ProjectPolicy;
    readonly completion: CompletionBackend;
    readonly integration: IntegrationBackend;
    readonly workspace: WorkspaceBackend;
  }>,
  ingress: Phase3Ingress,
  options: Phase3ApplicationOptions,
): Phase3ApplicationService {
  if (typeof store !== "object" || store === null || typeof adapters !== "object" || adapters === null ||
      typeof adapters.projectPolicy?.completionRequirements !== "function" ||
      typeof adapters.projectPolicy?.evaluateIntegration !== "function" ||
      typeof adapters.projectPolicy?.evaluateCleanup !== "function" ||
      typeof adapters.completion?.runGate !== "function" || typeof adapters.completion?.inspectGate !== "function" ||
      typeof adapters.completion?.cancelGate !== "function" || typeof adapters.integration?.inspect !== "function" ||
      typeof adapters.integration?.apply !== "function" || typeof adapters.integration?.push !== "function" ||
      typeof adapters.workspace?.cleanup !== "function" || typeof ingress !== "object" || ingress === null ||
      typeof ingress.currentActor !== "function" || typeof ingress.currentIntegrationLeaseOwner !== "function" ||
      typeof ingress.now !== "function" || typeof ingress.nextId !== "function" ||
      typeof ingress.confirmHighRisk !== "function" ||
      (ingress.beforeCleanupPointOfUse !== undefined && typeof ingress.beforeCleanupPointOfUse !== "function") ||
      !validOptions(options)) {
    throw new TypeError("Phase 3 application composition is invalid");
  }
  return Object.freeze({
    evaluateCompletionPolicy: (command: EvaluateCompletionPolicyCommand) =>
      evaluatePolicy(store, adapters.projectPolicy, ingress, options, command),
    evaluateIntegrationPolicy: (command: EvaluateIntegrationPolicyCommand) =>
      evaluatePolicy(store, adapters.projectPolicy, ingress, options, command),
    evaluateCleanupPolicy: (command: EvaluateCleanupPolicyCommand) =>
      evaluatePolicy(store, adapters.projectPolicy, ingress, options, command),
    runGate: (command: RunCompletionGateCommand) => processGate(store, adapters.completion, ingress, options, command),
    inspectGate: (command: InspectCompletionGateCommand) => processGate(store, adapters.completion, ingress, options, command),
    cancelGate: (command: CancelCompletionGateCommand) => processGate(store, adapters.completion, ingress, options, command),
    reserveIntegration: (command: ReserveIntegrationCommand) => reserveIntegration(store, ingress, options, command),
    renewIntegration: (command: RenewIntegrationCommand) => mutateReservation(store, ingress, options, command),
    takeoverIntegration: (command: TakeoverIntegrationCommand) => mutateReservation(store, ingress, options, command),
    inspectIntegration: (command: InspectIntegrationCommand) =>
      inspectIntegration(store, adapters.integration, ingress, options, command),
    applyIntegration: (command: ApplyIntegrationCommand) =>
      integrationEffect(store, adapters.integration, ingress, options, command),
    pushIntegration: (command: PushIntegrationCommand) =>
      integrationEffect(store, adapters.integration, ingress, options, command),
    recoverIntegration: (command: RecoverIntegrationCommand) =>
      recoverIntegration(store, adapters.integration, ingress, options, command),
    releaseIntegration: (command: ReleaseIntegrationCommand) => mutateReservation(store, ingress, options, command),
    acceptCompletion: (command: AcceptPolicyGatedCompletionCommand) => acceptCompletion(store, adapters.completion, ingress, options, command),
    cleanupWorkspace: (command: CleanupWorkspaceCommand) => cleanupWorkspace(store, adapters.workspace, ingress, options, command),
  });
}

export const createCompletionApplicationService = createPhase3ApplicationService;
