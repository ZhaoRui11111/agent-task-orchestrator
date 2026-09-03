import {
  BASE_AUTHORIZATION_ACTIONS,
  actionsForVocabulary,
  isHighRiskAction,
} from "../authorization.ts";
import type { AuthorizationAction, AuthorizationGrant, AuthorizationScope } from "../authorization.ts";
import {
  COMPLETION_CONTRACT_ID,
  COMPLETION_FAILURE_CATEGORIES,
  parseCompletionBackendResult,
} from "../completion-port.ts";
import type { CompletionBackendRequest, CompletionGateSubject } from "../completion-port.ts";
import {
  INTEGRATION_CONTRACT_ID,
  INTEGRATION_FAILURE_CATEGORIES,
  parseIntegrationBackendResult,
} from "../integration-port.ts";
import type { IntegrationBackendRequest, IntegrationSubject } from "../integration-port.ts";
import { parseProjectPolicyFacts } from "../project-policy-port.ts";
import type { ProjectPolicyFacts } from "../project-policy-port.ts";
import {
  parseWorkspaceCleanupAttestation,
  workspaceFailureSemanticsAreValid,
  workspaceCleanupQuiescenceSha256,
  workspaceGenerationStatusAfterFailure,
  workspaceGenerationStatusAfterReceipt,
  workspaceRecoveryCausationProof,
  workspaceReceiptSemanticsAreValid,
} from "../workspace-port.ts";
import type { WorkspaceCleanupQuiescence } from "../workspace-port.ts";
import { runReadSnapshot } from "./database.ts";
import type { SqliteDatabase } from "./database.ts";
import { persistenceFailure } from "./errors.ts";
import { applicationStateSha256 } from "./application-repository-digest.ts";
import { applicationAuditKind } from "./application-repository-model.ts";
import type {
  ApplicationLifecycleAuthorization,
  ApplicationRequestRecord,
  AuthorizationDecisionRecord,
  DispatcherMemberOutcome,
  ApplicationState,
  WorkspaceFinalizationRecord,
} from "./application-repository-model.ts";
import {
  readProjects,
  readBootstrap,
  readIdentity,
  readGrants,
  readEpochs,
  readRequests,
  readDecisions,
  readAudit,
  readLifecycle,
  readExecutionSequences,
  readExecutionAttempts,
  readExecutionOperationRequests,
  readExecutionAuthorizationDecisions,
  readExecutionOperationAudit,
  readExecutionIntents,
  readExecutionIntentAuthorizationBindings,
  readExecutionObservations,
  readExecutionReceipts,
  readExecutionFinalizations,
  readExecutionTerminalStates,
  readManualTurns,
  readManualBackendOperations,
  readCompletionDecisions,
  readManualCompletionDecisions,
  readDispatcherTriggerRequests,
  readDispatcherAuthorizationDecisions,
  readDispatcherRuns,
  readDispatcherAudit,
  readDispatcherReconciliationItems,
  readDispatcherReconciliationSummaries,
  readDispatcherMemberships,
  readDispatcherMembers,
  readDispatcherMemberDenialRequests,
  readDispatcherMemberDenialDecisions,
  readDispatcherMemberDenialAudit,
  readDispatcherRunSummaries,
  readProjectPolicyReceipts,
  readCompletionGateRequests,
  readCompletionGateAuthorizationDecisions,
  readCompletionGateIntents,
  readCompletionGateObservations,
  readCompletionGateReceipts,
  readCompletionGateFinalizations,
  readCompletionGateEvents,
  readPolicyGatedCompletionDecisions,
  readIntegrationTargetSequences,
  readIntegrationReservations,
  readIntegrationOperationRequests,
  readIntegrationAuthorizationDecisions,
  readIntegrationIntents,
  readIntegrationObservations,
  readIntegrationReceipts,
  readIntegrationFinalizations,
  readIntegrationEvents,
  readWorkspaceGenerations,
  readWorkspaceAuthorizationDecisions,
  readWorkspaceIntents,
  readWorkspaceObservations,
  readWorkspaceReceipts,
  readWorkspaceFinalizations,
  readWorkspaceEvents,
  readWorkspaceCleanupAttestations,
  readGrantRelations,
} from "./application-repository-readers.ts";
import { readDomainSnapshotUntransactional } from "./repository.ts";
import { canonicalJson, sha256 } from "./values.ts";

function requestTargetIsValid(request: ApplicationRequestRecord): boolean {
  if (request.result === "bootstrap") {
    return request.action === "authorization.grant.issue" && request.targetKind === "runtime" &&
      request.targetId === "runtime" && request.targetRevision === null;
  }
  switch (request.action) {
    case "authorization.grant.issue":
      return request.targetKind === "grant" && request.targetRevision === null;
    case "authorization.grant.inspect":
    case "authorization.grant.revoke":
      return request.targetKind === "grant" && request.targetRevision !== null;
    case "project.register":
      return request.targetKind === "project" && request.targetRevision === null;
    case "project.update":
    case "project.disable":
    case "project.inspect":
    case "policy.evaluate":
      return request.targetKind === "project" && request.targetRevision !== null;
    case "task.create":
      return request.targetKind === "task" && request.targetRevision === null;
    case "task.update":
    case "task.mark_ready":
    case "task.cancel":
    case "task.inspect":
    case "dependency.add":
    case "dependency.remove":
      return request.targetKind === "task" && request.targetRevision !== null;
    case "authorization.grant.list":
    case "runtime.status":
    case "authorization.capability.renew":
    case "authorization.capability.upgrade":
      return request.targetKind === "runtime" && request.targetId === "runtime" && request.targetRevision === null;
    case "runtime.backup":
    case "runtime.restore":
      return request.targetKind === "backup" && request.targetRevision === null;
    case "execution.claim":
    case "execution.claim.inspect":
    case "execution.lease.renew":
    case "execution.lease.takeover":
    case "completion.gate.run":
    case "completion.gate.inspect":
    case "completion.gate.cancel":
    case "completion.accept":
    case "integration.reserve":
    case "integration.inspect":
    case "integration.lease.renew":
    case "integration.lease.takeover":
    case "integration.apply":
    case "integration.push":
    case "integration.recover":
    case "integration.release":
      return request.targetKind === "execution" && request.targetRevision !== null;
    default:
      return false;
  }
}

function decisionPolicyIsValid(decision: AuthorizationDecisionRecord): boolean {
  if (
    decision.action === "authorization.capability.renew" ||
    decision.action === "authorization.capability.upgrade"
  ) return decision.policy === "allow";
  if (
    decision.action.startsWith("authorization.") ||
    decision.action.endsWith(".inspect") ||
    decision.action === "policy.evaluate" ||
    decision.action === "integration.lease.takeover" ||
    decision.action === "integration.recover" ||
    decision.action === "integration.release" ||
    decision.action === "runtime.status" ||
    decision.action === "runtime.backup" ||
    decision.action === "runtime.restore"
  ) {
    return decision.policy === "read_not_applicable";
  }
  if (
    decision.action === "project.register" ||
    decision.action === "project.update" ||
    decision.action === "project.disable"
  ) {
    return decision.policy === "allow";
  }
  return decision.policy === "allow" || decision.policy === "deny";
}

function decisionTargetIsValid(
  request: ApplicationRequestRecord,
  decision: AuthorizationDecisionRecord,
): boolean {
  switch (request.action) {
    case "project.register":
      return decision.projectId === null;
    case "project.update":
    case "project.disable":
    case "project.inspect":
    case "policy.evaluate":
      return decision.projectId === request.targetId;
    case "task.create":
    case "task.update":
    case "task.mark_ready":
    case "task.cancel":
    case "task.inspect":
    case "dependency.add":
    case "dependency.remove":
    case "execution.claim":
    case "execution.claim.inspect":
    case "execution.lease.renew":
    case "execution.lease.takeover":
    case "completion.gate.run":
    case "completion.gate.inspect":
    case "completion.gate.cancel":
    case "completion.accept":
    case "integration.reserve":
    case "integration.inspect":
    case "integration.lease.renew":
    case "integration.lease.takeover":
    case "integration.apply":
    case "integration.push":
    case "integration.recover":
    case "integration.release":
      return decision.projectId !== null;
    default:
      return true;
  }
}

function issuedGrantMatchesDecision(
  grant: AuthorizationGrant,
  decision: AuthorizationDecisionRecord | undefined,
): boolean {
  if (decision === undefined || decision.action !== "authorization.grant.issue" || decision.result !== "allow") {
    return false;
  }
  return grant.scope.kind === "runtime"
    ? decision.projectId === null && decision.resourceRevision === null
    : decision.projectId === grant.scope.projectId && decision.resourceRevision === grant.scope.resourceRevision;
}

function scopeContains(authority: AuthorizationScope, candidate: AuthorizationScope): boolean {
  if (authority.kind === "runtime") return true;
  return candidate.kind === "project" &&
    authority.projectId === candidate.projectId &&
    authority.resourceRevision === candidate.resourceRevision &&
    authority.configRevision === candidate.configRevision;
}

function grantWasUsableAt(grant: AuthorizationGrant, actorId: string, actionValue: AuthorizationAction, at: string): boolean {
  return grant.actorId === actorId &&
    grant.action === actionValue &&
    grant.notBefore <= at &&
    grant.expiresAt > at &&
    (grant.revokedAt === null || grant.revokedAt >= at);
}

function grantRevisionWasUsableAt(
  grant: AuthorizationGrant,
  actorId: string,
  actionValue: AuthorizationAction,
  at: string,
  grantRevision: number | null,
): boolean {
  if (grantRevision === null || !grantWasUsableAt(grant, actorId, actionValue, at)) return false;
  return (grant.revision === grantRevision && grant.revokedAt === null) ||
    (grant.revision === grantRevision + 1 && grant.revokedAt !== null && grant.revokedAt >= at);
}

const RETRYABLE_ADAPTER_FAILURES = new Set(["busy", "rate_limited", "resource_exhausted", "transient_external"]);
const AMBIGUOUS_ADAPTER_FAILURES = new Set(["ambiguous_external_state", "integrity_failure"]);

function adapterFailureSemanticsAreValid(
  category: string,
  retryable: boolean,
  ambiguous: boolean,
  categories: readonly string[],
): boolean {
  return categories.includes(category) && retryable === RETRYABLE_ADAPTER_FAILURES.has(category) &&
    ambiguous === AMBIGUOUS_ADAPTER_FAILURES.has(category);
}

function projectPolicyFacts(record: ApplicationState["projectPolicyReceipts"][number]): ProjectPolicyFacts | null {
  try {
    const decoded: unknown = JSON.parse(record.factsJson);
    const facts = parseProjectPolicyFacts(decoded);
    if (facts === null || canonicalJson(facts) !== record.factsJson || sha256(record.factsJson) !== record.factsSha256) {
      return null;
    }
    return facts;
  } catch {
    return null;
  }
}

function genericAuthorizationMatches(
  state: ApplicationState,
  decisionId: string,
  action: AuthorizationAction,
  actorId: string,
  projectId: string,
  projectResourceRevision: number,
  projectConfigRevision: number,
  targetKind: ApplicationRequestRecord["targetKind"],
  targetId: string,
  targetRevision: number,
  expectedResult: "allow" | "deny",
  eventKind: ApplicationState["audit"][number]["eventKind"],
): boolean {
  const decision = state.decisions.find((candidate) => candidate.decisionId === decisionId);
  const request = decision === undefined ? undefined : state.requests.find((candidate) => candidate.requestId === decision.requestId);
  const event = decision === undefined ? undefined : state.audit.find((candidate) => candidate.decisionId === decision.decisionId);
  if (decision === undefined || request === undefined || event === undefined || decision.action !== action ||
      decision.actorId !== actorId || decision.projectId !== projectId ||
      decision.resourceRevision !== projectResourceRevision || decision.result !== expectedResult ||
      request.action !== action || request.actorId !== actorId || request.result !== expectedResult ||
      request.targetKind !== targetKind || request.targetId !== targetId || request.targetRevision !== targetRevision ||
      event.requestId !== request.requestId ||
      event.eventKind !== (expectedResult === "allow" ? eventKind : "authorization.denied") ||
      event.actorId !== actorId ||
      event.targetKind !== targetKind || event.targetId !== targetId || event.targetRevision !== targetRevision ||
      event.result !== (expectedResult === "allow" ? "accepted" : "denied")) return false;
  if (expectedResult === "deny") return decision.reason !== "allowed";
  if (decision.reason !== "allowed" || decision.grantId === null) return false;
  const grant = state.grants.find((candidate) => candidate.grantId === decision.grantId);
  return grant !== undefined && grantRevisionWasUsableAt(
    grant,
    actorId,
    action,
    decision.createdAt,
    decision.grantRevision,
  ) && (grant.scope.kind === "runtime" || (
    grant.scope.projectId === projectId && grant.scope.resourceRevision === projectResourceRevision &&
    grant.scope.configRevision === projectConfigRevision
  ));
}

function validateProjectPolicyState(state: ApplicationState): void {
  for (const receipt of state.projectPolicyReceipts) {
    const project = state.projects.find((candidate) => candidate.projectId === receipt.projectId);
    const facts = projectPolicyFacts(receipt);
    const requestedAction = receipt.operation === "completion_requirements"
      ? "completion.accept"
      : receipt.operation === "evaluate_integration"
        ? "integration.reserve"
        : receipt.operation === "evaluate_cleanup"
          ? "workspace.cleanup"
          : receipt.requestedAction;
    if (
      project === undefined || facts === null || receipt.requestedAction !== requestedAction ||
      project.rootKey !== receipt.projectRootKey || project.resourceRevision < receipt.projectResourceRevision ||
      project.configRevision < receipt.projectConfigRevision ||
      receipt.policyConfigRevision !== receipt.projectConfigRevision ||
      (receipt.validUntil !== null && receipt.validUntil <= receipt.observedAt) ||
      (receipt.decision === "allow" && receipt.validUntil === null) ||
      !genericAuthorizationMatches(
        state,
        receipt.preliminaryAuthorizationDecisionId,
        "policy.evaluate",
        receipt.actorId,
        receipt.projectId,
        receipt.projectResourceRevision,
        receipt.projectConfigRevision,
        "project",
        receipt.projectId,
        receipt.projectResourceRevision,
        "allow",
        "policy.evaluated",
      )
    ) {
      throw persistenceFailure("CORRUPT_ROW", "ProjectPolicy receipt identity, facts, or authorization is inconsistent");
    }
    const decision = state.decisions.find((candidate) => candidate.decisionId === receipt.preliminaryAuthorizationDecisionId)!;
    if (receipt.observedAt < decision.createdAt) {
      throw persistenceFailure("CORRUPT_ROW", "ProjectPolicy receipt predates its preliminary authorization");
    }
  }
}

function phaseAuthorizationIsValid(
  state: ApplicationState,
  decision: ApplicationState["completionGateAuthorizationDecisions"][number] |
    ApplicationState["integrationAuthorizationDecisions"][number] |
    ApplicationState["workspaceAuthorizationDecisions"][number],
  action: AuthorizationAction,
  projectId: string,
  projectResourceRevision: number,
  projectConfigRevision: number,
): boolean {
  if (decision.action !== action || (decision.result === "allow") !== (decision.reason === "allowed")) return false;
  if (decision.result === "deny") return true;
  if (decision.grantId === null) return false;
  const grant = state.grants.find((candidate) => candidate.grantId === decision.grantId);
  return grant !== undefined && grantRevisionWasUsableAt(
    grant,
    decision.actorId,
    action,
    decision.createdAt,
    decision.grantRevision,
  ) && (grant.scope.kind === "runtime" || (
    grant.scope.projectId === projectId && grant.scope.resourceRevision === projectResourceRevision &&
    grant.scope.configRevision === projectConfigRevision
  ));
}

function completionGateSubjectForRequest(
  request: ApplicationState["completionGateRequests"][number],
): CompletionGateSubject {
  return Object.freeze({
    projectId: request.projectId,
    projectResourceRevision: request.projectResourceRevision,
    projectConfigRevision: request.projectConfigRevision,
    projectRootKey: request.projectRootKey,
    repositoryIdentity: request.repositoryIdentity,
    headObjectId: request.headObjectId,
    taskId: request.taskId,
    taskRevision: request.taskRevision,
    executionId: request.executionId,
    executionRevision: request.executionRevision,
    attemptNumber: request.attemptNumber,
    fencingToken: request.fencingToken,
    workspaceId: request.workspaceId,
    generation: request.generation,
    workspaceRevision: request.workspaceRevision,
    workspaceRootKey: request.workspaceRootKey,
    ownershipBindingSha256: request.ownershipBindingSha256,
    policyId: request.policyId,
    policyReceiptId: request.policyReceiptId,
    policyConfigRevision: request.policyConfigRevision,
    gateId: request.gateId,
    gateVersion: request.gateVersion,
    commandKey: request.commandKey,
    commandIdentitySha256: request.commandIdentitySha256,
    completionEvidenceRootKey: request.completionEvidenceRootKey,
    toolEnvironmentSha256: request.toolEnvironmentSha256,
  });
}

function completionPolicySubjectForRequest(
  request: ApplicationState["completionGateRequests"][number],
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: request.projectId,
    projectResourceRevision: request.projectResourceRevision,
    projectConfigRevision: request.projectConfigRevision,
    projectRootKey: request.projectRootKey,
    repositoryIdentity: request.repositoryIdentity,
    taskId: request.taskId,
    taskRevision: request.taskRevision,
    executionId: request.executionId,
    executionRevision: request.executionRevision,
    attemptNumber: request.attemptNumber,
    fencingToken: request.fencingToken,
    workspaceId: request.workspaceId,
    generation: request.generation,
    workspaceRevision: request.workspaceRevision,
    ownershipBindingSha256: request.ownershipBindingSha256,
    headObjectId: request.headObjectId,
  });
}

function completionObservationSemanticsAreValid(
  request: ApplicationState["completionGateRequests"][number],
  intent: ApplicationState["completionGateIntents"][number],
  observation: ApplicationState["completionGateObservations"][number],
): boolean {
  const subject = completionGateSubjectForRequest(request);
  const base = Object.freeze({
    contractId: COMPLETION_CONTRACT_ID,
    operation: request.operationKind,
    correlationId: request.correlationId,
    causationId: request.causationId,
    actorId: request.actorId,
    adapterId: request.adapterId,
    adapterVersion: request.adapterVersion,
    subject,
  });
  const candidateRequest = request.operationKind === "run_gate"
    ? Object.freeze({
        ...base,
        operation: "run_gate" as const,
        operationId: intent.operationId,
        intentId: intent.intentId,
        idempotencyKey: intent.idempotencyKey,
        finalAuthorizationDecisionId: observation.authorizationDecisionId,
        timeoutMs: request.timeoutMs ?? 0,
      })
    : request.operationKind === "inspect_gate"
      ? Object.freeze({
          ...base,
          operation: "inspect_gate" as const,
          queryId: intent.operationId,
          readAuthorizationDecisionId: observation.authorizationDecisionId,
          gateOperationId: intent.gateOperationId,
          lastObservationNumber: observation.observationNumber - 1,
        })
      : Object.freeze({
          ...base,
          operation: "cancel_gate" as const,
          operationId: intent.operationId,
          intentId: intent.intentId,
          idempotencyKey: intent.idempotencyKey,
          finalAuthorizationDecisionId: observation.authorizationDecisionId,
          gateOperationId: intent.gateOperationId,
          expectedObservationNumber: observation.observationNumber - 1,
        });
  const receiptBase = Object.freeze({
    contractId: COMPLETION_CONTRACT_ID,
    receiptId: observation.adapterReceiptId,
    operation: request.operationKind,
    correlationId: request.correlationId,
    adapterId: request.adapterId,
    adapterVersion: request.adapterVersion,
    subject,
    gateOperationId: observation.gateOperationId,
    observationNumber: observation.observationNumber,
    lifecycle: observation.lifecycle,
    verdict: observation.verdict,
    code: observation.code,
    startedAt: observation.startedAt,
    endedAt: observation.endedAt,
    validUntil: observation.validUntil,
    evidenceReference: observation.evidenceReference,
    observedAt: observation.observedAt,
  });
  const receipt = request.operationKind === "inspect_gate"
    ? Object.freeze({
        ...receiptBase,
        operation: "inspect_gate" as const,
        queryId: intent.operationId,
        readAuthorizationDecisionId: observation.authorizationDecisionId,
      })
    : Object.freeze({
        ...receiptBase,
        operation: request.operationKind,
        operationId: intent.operationId,
        intentId: intent.intentId,
        idempotencyKey: intent.idempotencyKey,
      });
  return parseCompletionBackendResult(
    Object.freeze({ ok: true as const, receipt }),
    candidateRequest as CompletionBackendRequest,
  )?.ok === true;
}

function readyWorkspaceRevisionForReceipt(
  state: ApplicationState,
  receipt: ApplicationState["workspaceReceipts"][number],
): number | null {
  const finalization = state.workspaceFinalizations.find((candidate) =>
    candidate.verifiedReceiptId === receipt.verifiedReceiptId && candidate.outcome === "succeeded" &&
    candidate.resultingGenerationStatus === "ready");
  return finalization?.resultingGenerationRevision ?? null;
}

function workspaceReceiptForGateRequest(
  state: ApplicationState,
  request: ApplicationState["completionGateRequests"][number],
): ApplicationState["workspaceReceipts"][number] | undefined {
  return state.workspaceReceipts.find((candidate) => candidate.workspaceId === request.workspaceId &&
    candidate.generation === request.generation && readyWorkspaceRevisionForReceipt(state, candidate) === request.workspaceRevision &&
    candidate.outcome === "succeeded" && candidate.externalState === "complete" &&
    candidate.repositoryIdentity === request.repositoryIdentity && candidate.headObjectId === request.headObjectId &&
    candidate.ownershipBindingSha256 === request.ownershipBindingSha256);
}

function gateActionFor(operation: ApplicationState["completionGateRequests"][number]["operationKind"]):
  Extract<AuthorizationAction, "completion.gate.run" | "completion.gate.inspect" | "completion.gate.cancel"> {
  return operation === "run_gate" ? "completion.gate.run" : operation === "inspect_gate"
    ? "completion.gate.inspect" : "completion.gate.cancel";
}

function gateAuditKindFor(operation: ApplicationState["completionGateRequests"][number]["operationKind"]):
  Extract<ApplicationState["audit"][number]["eventKind"], "completion.gate.ran" | "completion.gate.inspected" | "completion.gate.cancelled"> {
  return operation === "run_gate" ? "completion.gate.ran" : operation === "inspect_gate"
    ? "completion.gate.inspected" : "completion.gate.cancelled";
}

function validateCompletionGateState(state: ApplicationState): void {
  const requestById = new Map(state.completionGateRequests.map((record) => [record.requestId, record]));
  const intentById = new Map(state.completionGateIntents.map((record) => [record.intentId, record]));
  const intentByRequest = new Map(state.completionGateIntents.map((record) => [record.requestId, record]));
  const decisionById = new Map(state.completionGateAuthorizationDecisions.map((record) => [record.decisionId, record]));
  const observationById = new Map(state.completionGateObservations.map((record) => [record.observationId, record]));
  const receiptById = new Map(state.completionGateReceipts.map((record) => [record.verifiedReceiptId, record]));

  for (const request of state.completionGateRequests) {
    const project = state.projects.find((candidate) => candidate.projectId === request.projectId);
    const task = state.domain.tasks.find((candidate) => candidate.id === request.taskId);
    const execution = state.executions.find((candidate) => candidate.executionId === request.executionId);
    const workspace = state.workspaceGenerations.find((candidate) => candidate.workspaceId === request.workspaceId &&
      candidate.generation === request.generation);
    const workspaceReceipt = workspaceReceiptForGateRequest(state, request);
    const policy = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === request.policyReceiptId);
    const facts = policy === undefined ? null : projectPolicyFacts(policy);
    const requiredGate = facts?.requiredGates.find((candidate) => candidate.gateId === request.gateId &&
      candidate.gateVersion === request.gateVersion);
    const subject = completionPolicySubjectForRequest(request);
    const intent = intentByRequest.get(request.requestId);
    const decisions = state.completionGateAuthorizationDecisions.filter((candidate) => candidate.operationId === request.operationId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const prepare = decisions[0];
    const action = gateActionFor(request.operationKind);
    const original = request.operationKind === "run_gate" ? request : state.completionGateRequests.find((candidate) =>
      candidate.operationId === request.causationId && candidate.operationKind === "run_gate");
    const sameOriginalSubject = original !== undefined && canonicalJson(completionGateSubjectForRequest(original)) ===
      canonicalJson(completionGateSubjectForRequest(request));
    if (
      project === undefined || task === undefined || execution === undefined || workspace === undefined ||
      workspaceReceipt === undefined || policy === undefined || facts === null || requiredGate === undefined ||
      project.rootKey !== request.projectRootKey || project.resourceRevision < request.projectResourceRevision ||
      project.configRevision < request.projectConfigRevision || task.projectId !== request.projectId ||
      task.revision < request.taskRevision || execution.taskId !== request.taskId ||
      execution.revision !== request.executionRevision || execution.attemptNumber !== request.attemptNumber ||
      execution.fencingToken !== request.fencingToken || workspace.projectId !== request.projectId ||
      workspace.taskId !== request.taskId || workspace.executionId !== request.executionId ||
      workspace.revision < request.workspaceRevision || workspace.workspaceRootKey !== request.workspaceRootKey ||
      policy.operation !== "completion_requirements" || policy.requestedAction !== "completion.accept" ||
      policy.decision !== "allow" || policy.validUntil === null || policy.validUntil <= request.createdAt ||
      policy.policyId !== request.policyId || policy.policyConfigRevision !== request.policyConfigRevision ||
      policy.subjectSha256 !== sha256(canonicalJson(subject)) ||
      requiredGate.commandKey !== request.commandKey ||
      requiredGate.commandIdentitySha256 !== request.commandIdentitySha256 ||
      requiredGate.toolEnvironmentSha256 !== request.toolEnvironmentSha256 ||
      request.projectConfigRevision !== request.policyConfigRevision || request.contractId !== COMPLETION_CONTRACT_ID ||
      (request.operationKind === "run_gate") !== (request.causationId === null) || !sameOriginalSubject ||
      decisions.length === 0 || prepare?.requestId !== request.requestId || prepare.operationId !== request.operationId ||
      prepare.bindingRevision !== 1 || prepare.phase !== "prepare" || prepare.actorId !== request.actorId ||
      prepare.action !== action || prepare.confirmationId !== null ||
      !phaseAuthorizationIsValid(
        state, prepare, action, request.projectId, request.projectResourceRevision, request.projectConfigRevision,
      ) ||
      !genericAuthorizationMatches(
        state, prepare.decisionId, action, request.actorId, request.projectId,
        request.projectResourceRevision, request.projectConfigRevision, "execution", request.executionId,
        request.executionRevision, prepare.result, gateAuditKindFor(request.operationKind),
      ) ||
      (prepare.result === "allow") !== (intent !== undefined)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Completion gate request binding or preliminary authorization is inconsistent");
    }
    if (intent === undefined) {
      const deniedEvents = state.completionGateEvents.filter((event) => event.operationId === request.operationId);
      if (decisions.length !== 1 || prepare.result !== "deny" || deniedEvents.length !== 1 ||
          deniedEvents[0]?.intentId !== null || deniedEvents[0]?.eventKind !== "completion.gate.denied" ||
          deniedEvents[0]?.outcome !== "denied") {
        throw persistenceFailure("CORRUPT_ROW", "Denied completion gate request evidence is inconsistent");
      }
    }
  }

  for (const intent of state.completionGateIntents) {
    const request = requestById.get(intent.requestId);
    if (request === undefined) {
      throw persistenceFailure("CORRUPT_ROW", "Completion gate intent request is absent");
    }
    const decisions = state.completionGateAuthorizationDecisions.filter((candidate) => candidate.operationId === intent.operationId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const observations = state.completionGateObservations.filter((candidate) => candidate.intentId === intent.intentId)
      .sort((left, right) => left.observationNumber - right.observationNumber);
    const receipts = state.completionGateReceipts.filter((candidate) => candidate.intentId === intent.intentId);
    const finalizations = state.completionGateFinalizations.filter((candidate) => candidate.intentId === intent.intentId);
    const events = state.completionGateEvents.filter((candidate) => candidate.intentId === intent.intentId);
    const currentDecision = decisionById.get(intent.currentAuthorizationDecisionId);
    const failureEmpty = intent.lastFailureCategory === null && intent.lastFailureCode === null &&
      intent.lastFailureRetryable === null && intent.lastFailureAmbiguous === null;
    const failureComplete = intent.lastFailureCategory !== null && intent.lastFailureCode !== null &&
      intent.lastFailureRetryable !== null && intent.lastFailureAmbiguous !== null;
    const failureValid = failureComplete && adapterFailureSemanticsAreValid(
      intent.lastFailureCategory!, intent.lastFailureRetryable!, intent.lastFailureAmbiguous!, COMPLETION_FAILURE_CATEGORIES,
    );
    const terminal = intent.state === "finalized" || intent.state === "failed" || intent.state === "ambiguous";
    const expectedDecisionCount = intent.state === "pending" ? 1 :
      intent.state === "finalized" ? 3 :
        intent.state === "ambiguous" && decisions.length === 3 ? 3 : 2;
    if (
      request.operationId !== intent.operationId || request.idempotencyKey !== intent.idempotencyKey ||
      request.operationKind !== intent.operationKind || intent.createdAt !== request.createdAt || intent.updatedAt < intent.createdAt ||
      intent.gateOperationId !== (intent.operationKind === "run_gate" ? intent.operationId : request.causationId) ||
      decisions.length !== expectedDecisionCount || decisions.some((decision, index) =>
        decision.bindingRevision !== index + 1 || decision.requestId !== intent.requestId ||
        decision.operationId !== intent.operationId || decision.actorId !== request.actorId ||
        decision.action !== gateActionFor(intent.operationKind) || decision.confirmationId !== null ||
        (index === 0 ? decision.phase !== "prepare" : index === 1 ? decision.phase !== "act" : decision.phase !== "finalize") ||
        !phaseAuthorizationIsValid(
          state, decision, gateActionFor(intent.operationKind), request.projectId,
          request.projectResourceRevision, request.projectConfigRevision,
        )) ||
      decisions[0]?.result !== "allow" || (decisions[1] !== undefined && intent.state !== "failed" && decisions[1].result !== "allow") ||
      (decisions[2] !== undefined && intent.state === "finalized" && decisions[2].result !== "allow") ||
      (decisions[2] !== undefined && intent.state === "ambiguous" && decisions[2].result !== "deny") ||
      currentDecision === undefined || currentDecision.decisionId !== decisions.at(-1)?.decisionId ||
      intent.authorizationBindingRevision !== currentDecision.bindingRevision ||
      observations.length > 1 || observations.some((observation) => observation.observationNumber !== 1) ||
      intent.lastObservationNumber !== (observations.length === 0 ? 0 : 1) ||
      observations.some((observation) => !completionObservationSemanticsAreValid(request, intent, observation)) ||
      (!failureEmpty && !failureValid) ||
      (intent.state === "failed" && (!failureValid || intent.lastFailureAmbiguous !== false)) ||
      (intent.state === "ambiguous" && !failureEmpty && (!failureValid || intent.lastFailureAmbiguous !== true)) ||
      (!terminal && !failureEmpty) ||
      (intent.state === "pending" || intent.state === "executing" || intent.state === "observed" ? receipts.length !== 0 : receipts.length > 1) ||
      (intent.state === "verified" || intent.state === "finalized" ? receipts.length !== 1 : false) ||
      (terminal ? finalizations.length !== 1 : finalizations.length !== 0) ||
      events.filter((event) => event.eventKind === "completion.gate.prepared").length !== 1 ||
      events.some((event) => event.operationId !== intent.operationId || event.actorId !== request.actorId ||
        event.correlationId !== request.correlationId)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Completion gate intent lineage or lifecycle is inconsistent");
    }
    const finalization = finalizations[0];
    const receipt = receipts[0];
    if (finalization !== undefined) {
      const expectedOutcome = intent.state === "finalized"
        ? receipt?.verdict === "pass" ? "accepted" : "refused"
        : intent.state === "failed" ? "failed" : "ambiguous";
      if (finalization.authorizationDecisionId !== intent.currentAuthorizationDecisionId ||
          finalization.outcome !== expectedOutcome ||
          (intent.state === "finalized" ? finalization.verifiedReceiptId !== receipt?.verifiedReceiptId :
            finalization.verifiedReceiptId !== null)) {
        throw persistenceFailure("CORRUPT_ROW", "Completion gate finalization is inconsistent");
      }
    }
  }

  for (const observation of state.completionGateObservations) {
    const intent = intentById.get(observation.intentId);
    const decision = decisionById.get(observation.authorizationDecisionId);
    if (intent === undefined || decision === undefined || decision.operationId !== intent.operationId ||
        decision.phase !== "act" || decision.bindingRevision !== 2 || decision.result !== "allow" ||
        observation.gateOperationId !== intent.gateOperationId) {
      throw persistenceFailure("CORRUPT_ROW", "Completion gate observation authorization is inconsistent");
    }
  }

  for (const receipt of state.completionGateReceipts) {
    const intent = intentById.get(receipt.intentId);
    const observation = observationById.get(receipt.observationId);
    if (intent === undefined || observation === undefined || observation.intentId !== receipt.intentId ||
        observation.observationNumber !== receipt.observationNumber ||
        observation.adapterReceiptId !== receipt.adapterReceiptId || observation.receiptSha256 !== receipt.receiptSha256 ||
        observation.gateOperationId !== receipt.gateOperationId || observation.verdict !== receipt.verdict ||
        observation.validUntil !== receipt.validUntil || observation.lifecycle !== "completed" ||
        (receipt.verdict === "pass" && receipt.validUntil !== null && receipt.validUntil <= receipt.verifiedAt)) {
      throw persistenceFailure("CORRUPT_ROW", "Completion gate verified receipt is inconsistent");
    }
  }

  for (const finalization of state.completionGateFinalizations) {
    const intent = intentById.get(finalization.intentId);
    const decision = decisionById.get(finalization.authorizationDecisionId);
    const receipt = finalization.verifiedReceiptId === null ? null : receiptById.get(finalization.verifiedReceiptId) ?? null;
    if (intent === undefined || decision === undefined || decision.operationId !== intent.operationId ||
        (receipt !== null && receipt.intentId !== intent.intentId) ||
        ((finalization.outcome === "accepted" || finalization.outcome === "refused") !== (receipt !== null)) ||
        (finalization.outcome === "accepted" && receipt?.verdict !== "pass") ||
        (finalization.outcome === "refused" && receipt?.verdict !== "fail")) {
      throw persistenceFailure("CORRUPT_ROW", "Completion gate finalization evidence is inconsistent");
    }
  }
}

function integrationSubjectForReservation(
  reservation: ApplicationState["integrationReservations"][number],
): IntegrationSubject {
  return Object.freeze({
    projectId: reservation.projectId,
    projectResourceRevision: reservation.projectResourceRevision,
    projectConfigRevision: reservation.projectConfigRevision,
    projectRootKey: reservation.projectRootKey,
    repositoryIdentity: reservation.repositoryIdentity,
    objectFormat: reservation.objectFormat,
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

function integrationObservationSemanticsAreValid(
  reservation: ApplicationState["integrationReservations"][number],
  intent: ApplicationState["integrationIntents"][number] | null,
  observation: ApplicationState["integrationObservations"][number],
): boolean {
  if (observation.operation !== "inspect" && (intent === null || intent.operationKind !== observation.operation)) return false;
  const subject = integrationSubjectForReservation(reservation);
  const base = Object.freeze({
    contractId: INTEGRATION_CONTRACT_ID,
    operation: observation.operation,
    correlationId: "semantic-correlation",
    causationId: null,
    actorId: "semantic-actor",
    adapterId: "semantic-adapter",
    adapterVersion: "1",
    subject,
  });
  const candidateRequest = observation.operation === "inspect"
    ? Object.freeze({
        ...base,
        operation: "inspect" as const,
        queryId: "semantic-query",
        readAuthorizationDecisionId: observation.authorizationDecisionId,
        lastObservationNumber: observation.observationNumber - 1,
      })
    : Object.freeze({
        ...base,
        operation: observation.operation,
        operationId: intent!.operationId,
        intentId: intent!.intentId,
        idempotencyKey: intent!.idempotencyKey,
        finalAuthorizationDecisionId: observation.authorizationDecisionId,
        expectedObservationNumber: observation.observationNumber - 1,
      });
  const receiptBase = Object.freeze({
    contractId: INTEGRATION_CONTRACT_ID,
    receiptId: observation.adapterReceiptId,
    operation: observation.operation,
    correlationId: "semantic-correlation",
    causationId: null,
    actorId: "semantic-actor",
    adapterId: "semantic-adapter",
    adapterVersion: "1",
    subject,
    observationNumber: observation.observationNumber,
    localBeforeObjectId: observation.localBeforeObjectId,
    localAfterObjectId: observation.localAfterObjectId,
    remoteBeforeObjectId: observation.remoteBeforeObjectId,
    remoteAfterObjectId: observation.remoteAfterObjectId,
    localState: observation.localState,
    remoteState: observation.remoteState,
    outcome: observation.outcome,
    code: observation.code,
    evidenceReference: observation.evidenceReference,
    observedAt: observation.observedAt,
  });
  const receipt = observation.operation === "inspect"
    ? Object.freeze({
        ...receiptBase,
        operation: "inspect" as const,
        queryId: "semantic-query",
        readAuthorizationDecisionId: observation.authorizationDecisionId,
      })
    : Object.freeze({
        ...receiptBase,
        operation: observation.operation,
        operationId: intent!.operationId,
        intentId: intent!.intentId,
        idempotencyKey: intent!.idempotencyKey,
        finalAuthorizationDecisionId: observation.authorizationDecisionId,
        expectedObservationNumber: observation.observationNumber - 1,
      });
  return parseIntegrationBackendResult(
    Object.freeze({ ok: true as const, receipt }),
    candidateRequest as IntegrationBackendRequest,
  )?.ok === true;
}

function workspaceReceiptForReservation(
  state: ApplicationState,
  reservation: ApplicationState["integrationReservations"][number],
): ApplicationState["workspaceReceipts"][number] | undefined {
  return state.workspaceReceipts.find((candidate) => candidate.workspaceId === reservation.sourceWorkspaceId &&
    candidate.generation === reservation.sourceGeneration &&
    readyWorkspaceRevisionForReceipt(state, candidate) === reservation.sourceWorkspaceRevision && candidate.outcome === "succeeded" &&
    candidate.externalState === "complete" && candidate.repositoryIdentity === reservation.repositoryIdentity &&
    candidate.headObjectId === reservation.sourceHeadObjectId &&
    candidate.ownershipBindingSha256 === reservation.sourceOwnershipBindingSha256);
}

function integrationPolicySubjectForReservation(
  state: ApplicationState,
  reservation: ApplicationState["integrationReservations"][number],
): Readonly<Record<string, unknown>> | null {
  const workspace = state.workspaceGenerations.find((candidate) => candidate.workspaceId === reservation.sourceWorkspaceId &&
    candidate.generation === reservation.sourceGeneration);
  const execution = state.executions.find((candidate) => candidate.executionId === reservation.ownerExecutionId);
  if (workspace === undefined || execution === undefined) return null;
  return Object.freeze({
    projectId: reservation.projectId,
    projectResourceRevision: reservation.projectResourceRevision,
    projectConfigRevision: reservation.projectConfigRevision,
    projectRootKey: reservation.projectRootKey,
    repositoryIdentity: reservation.repositoryIdentity,
    taskId: execution.taskId,
    taskRevision: workspace.taskRevision,
    executionId: execution.executionId,
    executionRevision: execution.revision,
    attemptNumber: execution.attemptNumber,
    fencingToken: execution.fencingToken,
    workspaceId: workspace.workspaceId,
    generation: workspace.generation,
    workspaceRevision: reservation.sourceWorkspaceRevision,
    ownershipBindingSha256: reservation.sourceOwnershipBindingSha256,
    headObjectId: reservation.sourceHeadObjectId,
    targetReference: reservation.targetReference,
    expectedTargetObjectId: reservation.expectedTargetObjectId,
    sourceHeadObjectId: reservation.sourceHeadObjectId,
    destinationIdentity: reservation.destinationIdentity,
    expectedRemoteHead: reservation.expectedRemoteHead,
  });
}

function integrationActionFor(operation: ApplicationState["integrationOperationRequests"][number]["operationKind"]):
  Extract<AuthorizationAction, "integration.apply" | "integration.push"> {
  return operation === "apply" ? "integration.apply" : "integration.push";
}

function integrationAuditKindFor(operation: ApplicationState["integrationOperationRequests"][number]["operationKind"]):
  Extract<ApplicationState["audit"][number]["eventKind"], "integration.applied" | "integration.pushed"> {
  return operation === "apply" ? "integration.applied" : "integration.pushed";
}

function integrationRecoveryResultFor(code: string): ApplicationState["integrationIntents"][number]["recoveryResult"] {
  return code === "inspected_unchanged" ? "recovered_no_effect" :
    code === "inspected_local_applied" ? "recovered_local_applied" :
      code === "inspected_pushed" ? "recovered_pushed" :
        code === "inspected_foreign" ? "recovered_inconsistent" : null;
}

function validateIntegrationState(state: ApplicationState): void {
  const reservationById = new Map(state.integrationReservations.map((record) => [record.reservationId, record]));
  const requestById = new Map(state.integrationOperationRequests.map((record) => [record.requestId, record]));
  const intentById = new Map(state.integrationIntents.map((record) => [record.intentId, record]));
  const intentByRequest = new Map(state.integrationIntents.map((record) => [record.requestId, record]));
  const phaseDecisionById = new Map(state.integrationAuthorizationDecisions.map((record) => [record.decisionId, record]));
  const observationById = new Map(state.integrationObservations.map((record) => [record.observationId, record]));
  const receiptById = new Map(state.integrationReceipts.map((record) => [record.verifiedReceiptId, record]));

  for (const sequence of state.integrationTargetSequences) {
    const reservations = state.integrationReservations.filter((candidate) => candidate.projectId === sequence.projectId &&
      candidate.repositoryIdentity === sequence.repositoryIdentity && candidate.targetReference === sequence.targetReference)
      .sort((left, right) => left.fencingToken - right.fencingToken);
    if (reservations.length === 0 || sequence.lastFencingToken !== reservations.at(-1)?.fencingToken ||
        reservations.some((reservation, index) => reservation.fencingToken !== index + 1) ||
        reservations.slice(0, -1).some((reservation) =>
          (reservation.status !== "released" && reservation.status !== "expired") ||
          state.integrationIntents.some((intent) => intent.reservationId === reservation.reservationId &&
            intent.state !== "finalized" && intent.state !== "failed"))) {
      throw persistenceFailure("CORRUPT_ROW", "Integration target fencing sequence is inconsistent");
    }
  }

  for (const reservation of state.integrationReservations) {
    const project = state.projects.find((candidate) => candidate.projectId === reservation.projectId);
    const workspace = state.workspaceGenerations.find((candidate) => candidate.workspaceId === reservation.sourceWorkspaceId &&
      candidate.generation === reservation.sourceGeneration);
    const workspaceReceipt = workspaceReceiptForReservation(state, reservation);
    const execution = state.executions.find((candidate) => candidate.executionId === reservation.ownerExecutionId);
    const policy = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === reservation.policyReceiptId);
    const policySubject = integrationPolicySubjectForReservation(state, reservation);
    const sequence = state.integrationTargetSequences.find((candidate) => candidate.projectId === reservation.projectId &&
      candidate.repositoryIdentity === reservation.repositoryIdentity && candidate.targetReference === reservation.targetReference);
    const intents = state.integrationIntents.filter((candidate) => candidate.reservationId === reservation.reservationId);
    const unfinished = intents.filter((candidate) => candidate.state !== "finalized" && candidate.state !== "failed");
    const reservedEvent = state.integrationEvents.find((candidate) => candidate.reservationId === reservation.reservationId &&
      candidate.eventKind === "integration.reserved");
    const reservationRequest = reservedEvent === undefined ? undefined : state.requests.find((candidate) =>
      candidate.correlationId === reservedEvent.correlationId && candidate.action === "integration.reserve" &&
      candidate.targetId === reservation.ownerExecutionId && candidate.createdAt === reservation.createdAt);
    const reservationDecision = reservationRequest === undefined ? undefined : state.decisions.find((candidate) =>
      candidate.requestId === reservationRequest.requestId);
    if (
      project === undefined || workspace === undefined || workspaceReceipt === undefined || execution === undefined ||
      policy === undefined || policySubject === null || sequence === undefined || reservedEvent === undefined ||
      reservationDecision === undefined || reservation.expectedTargetObjectId === reservation.sourceHeadObjectId ||
      reservation.objectFormat !== "sha1" || reservation.createdAt > reservation.updatedAt ||
      project.rootKey !== reservation.projectRootKey || project.resourceRevision < reservation.projectResourceRevision ||
      project.configRevision < reservation.projectConfigRevision || workspace.projectId !== reservation.projectId ||
      workspace.executionId !== reservation.ownerExecutionId || workspace.revision < reservation.sourceWorkspaceRevision ||
      workspace.workspaceRootKey !== reservation.sourceWorkspaceRootKey || execution.taskId !== workspace.taskId ||
      execution.revision !== workspace.executionRevision || execution.attemptNumber !== workspace.attemptNumber ||
      execution.fencingToken !== workspace.fencingToken || policy.operation !== "evaluate_integration" ||
      policy.requestedAction !== "integration.reserve" || policy.decision !== "allow" ||
      policy.policyConfigRevision !== reservation.policyConfigRevision ||
      policy.subjectSha256 !== sha256(canonicalJson(policySubject)) || policy.validUntil === null ||
      policy.validUntil <= reservation.createdAt || reservation.fencingToken > sequence.lastFencingToken ||
      reservedEvent.operationId !== reservation.ownerOperationId || reservedEvent.intentId !== null ||
      reservedEvent.outcome !== "accepted" || reservedEvent.reasonCode !== "reserved" ||
      !genericAuthorizationMatches(
        state, reservationDecision.decisionId, "integration.reserve", reservedEvent.actorId,
        reservation.projectId, reservation.projectResourceRevision, reservation.projectConfigRevision,
        "execution", reservation.ownerExecutionId, execution.revision, "allow", "integration.reserved",
      ) ||
      unfinished.length > 1 ||
      ((reservation.status === "released" || reservation.status === "expired") && unfinished.length !== 0) ||
      (reservation.status === "active" && unfinished.some((intent) => intent.state === "ambiguous")) ||
      (reservation.status === "ambiguous" && unfinished.some((intent) => intent.state !== "ambiguous")) ||
      (reservation.currentEvidenceSha256 !== null && !state.integrationObservations.some((observation) =>
        observation.reservationId === reservation.reservationId && observation.receiptSha256 === reservation.currentEvidenceSha256))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Integration reservation identity, policy, fence, or terminality is inconsistent");
    }
  }

  for (const request of state.integrationOperationRequests) {
    const reservation = reservationById.get(request.reservationId);
    const intent = intentByRequest.get(request.requestId);
    const decisions = state.integrationAuthorizationDecisions.filter((candidate) => candidate.operationId === request.operationId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const prepare = decisions[0];
    const action = integrationActionFor(request.operationKind);
    const ownerExecution = reservation === undefined ? undefined : state.executions.find((candidate) =>
      candidate.executionId === reservation.ownerExecutionId);
    if (
      reservation === undefined || ownerExecution === undefined || request.causationId !== null ||
      request.contractId !== INTEGRATION_CONTRACT_ID || request.expectedFencingToken !== reservation.fencingToken ||
      request.expectedReservationRevision > reservation.revision || request.expectedLeaseRevision > reservation.leaseRevision ||
      decisions.length === 0 || prepare?.requestId !== request.requestId || prepare.operationId !== request.operationId ||
      prepare.bindingRevision !== 1 || prepare.phase !== "prepare" || prepare.actorId !== request.actorId ||
      prepare.action !== action || prepare.confirmationId === null ||
      !phaseAuthorizationIsValid(
        state, prepare, action, reservation.projectId,
        reservation.projectResourceRevision, reservation.projectConfigRevision,
      ) ||
      !genericAuthorizationMatches(
        state, prepare.decisionId, action, request.actorId, reservation.projectId,
        reservation.projectResourceRevision, reservation.projectConfigRevision, "execution",
        reservation.ownerExecutionId, ownerExecution.revision, prepare.result, integrationAuditKindFor(request.operationKind),
      ) ||
      (prepare.result === "allow") !== (intent !== undefined)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Integration operation request or preliminary authorization is inconsistent");
    }
    if (intent === undefined) {
      const denied = state.integrationEvents.filter((event) => event.operationId === request.operationId);
      if (decisions.length !== 1 || prepare.result !== "deny" || denied.length !== 1 ||
          denied[0]?.intentId !== null || denied[0]?.eventKind !== "integration.operation.denied" ||
          denied[0]?.outcome !== "denied") {
        throw persistenceFailure("CORRUPT_ROW", "Denied integration operation evidence is inconsistent");
      }
    }
  }

  for (const intent of state.integrationIntents) {
    const request = requestById.get(intent.requestId);
    const reservation = reservationById.get(intent.reservationId);
    if (request === undefined || reservation === undefined) {
      throw persistenceFailure("CORRUPT_ROW", "Integration intent request or reservation is absent");
    }
    const decisions = state.integrationAuthorizationDecisions.filter((candidate) => candidate.operationId === intent.operationId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const observations = state.integrationObservations.filter((candidate) => candidate.intentId === intent.intentId)
      .sort((left, right) => left.observationNumber - right.observationNumber);
    const effectObservations = observations.filter((candidate) => candidate.operation !== "inspect");
    const recoveryObservations = observations.filter((candidate) => candidate.operation === "inspect");
    const receipts = state.integrationReceipts.filter((candidate) => candidate.intentId === intent.intentId);
    const finalizations = state.integrationFinalizations.filter((candidate) => candidate.intentId === intent.intentId);
    const currentPhaseDecision = phaseDecisionById.get(intent.currentAuthorizationDecisionId);
    const currentGenericDecision = state.decisions.find((candidate) => candidate.decisionId === intent.currentAuthorizationDecisionId);
    const lastRecovery = recoveryObservations.at(-1);
    const expectedPhaseCount = intent.state === "pending" ? 1 :
      intent.state === "finalized" && intent.recoveryResult === null ? 3 :
        intent.state === "ambiguous" && decisions.length === 3 ? 3 : 2;
    const failureEmpty = intent.lastFailureCategory === null && intent.lastFailureCode === null &&
      intent.lastFailureRetryable === null && intent.lastFailureAmbiguous === null;
    const failureComplete = intent.lastFailureCategory !== null && intent.lastFailureCode !== null &&
      intent.lastFailureRetryable !== null && intent.lastFailureAmbiguous !== null;
    const failureValid = failureComplete && adapterFailureSemanticsAreValid(
      intent.lastFailureCategory!, intent.lastFailureRetryable!, intent.lastFailureAmbiguous!, INTEGRATION_FAILURE_CATEGORIES,
    );
    const latestLinkedObservation = observations.at(-1)?.observationNumber ?? null;
    const reservationObservationMaximum = state.integrationObservations.filter((candidate) =>
      candidate.reservationId === reservation.reservationId).reduce((maximum, candidate) =>
        Math.max(maximum, candidate.observationNumber), 0);
    const recoveryAuthorizationValid = lastRecovery === undefined ? false : genericAuthorizationMatches(
      state, lastRecovery.authorizationDecisionId, "integration.recover", request.actorId,
      reservation.projectId, reservation.projectResourceRevision, reservation.projectConfigRevision,
      "execution", reservation.ownerExecutionId,
      state.executions.find((candidate) => candidate.executionId === reservation.ownerExecutionId)?.revision ?? 0,
      "allow", "integration.recovered",
    );
    if (
      request.operationId !== intent.operationId || request.idempotencyKey !== intent.idempotencyKey ||
      request.operationKind !== intent.operationKind || intent.reservationFencingToken !== reservation.fencingToken ||
      intent.createdAt !== request.createdAt || intent.updatedAt < intent.createdAt || decisions.length !== expectedPhaseCount ||
      decisions.some((decision, index) => decision.bindingRevision !== index + 1 ||
        decision.requestId !== intent.requestId || decision.operationId !== intent.operationId ||
        decision.actorId !== request.actorId || decision.action !== integrationActionFor(intent.operationKind) ||
        decision.confirmationId !== decisions[0]?.confirmationId || decision.confirmationId === null ||
        (index === 0 ? decision.phase !== "prepare" : index === 1 ? decision.phase !== "act" : decision.phase !== "finalize") ||
        !phaseAuthorizationIsValid(
          state, decision, integrationActionFor(intent.operationKind), reservation.projectId,
          reservation.projectResourceRevision, reservation.projectConfigRevision,
        )) ||
      decisions[0]?.result !== "allow" ||
      (intent.state !== "failed" && decisions[1] !== undefined && decisions[1].result !== "allow") ||
      (intent.state === "finalized" && intent.recoveryResult === null && decisions[2]?.result !== "allow") ||
      (intent.state === "ambiguous" && decisions[2] !== undefined && decisions[2].result !== "deny") ||
      effectObservations.length > 1 ||
      observations.some((observation) => !integrationObservationSemanticsAreValid(reservation, intent, observation)) ||
      observations.some((observation, index) => index > 0 &&
        observation.observationNumber <= observations[index - 1]!.observationNumber) ||
      (latestLinkedObservation !== null && intent.lastObservationNumber !== latestLinkedObservation) ||
      intent.lastObservationNumber > reservationObservationMaximum ||
      (!failureEmpty && !failureValid) ||
      (intent.state === "failed" && (!failureValid || intent.lastFailureAmbiguous !== false)) ||
      (intent.state === "ambiguous" && !failureEmpty && (!failureValid || intent.lastFailureAmbiguous !== true)) ||
      ((intent.state === "pending" || intent.state === "executing" || intent.state === "observed" ||
        intent.state === "verified" || intent.state === "finalized") && !failureEmpty) ||
      (recoveryObservations.length === 0 && (currentPhaseDecision === undefined ||
        currentPhaseDecision.decisionId !== decisions.at(-1)?.decisionId ||
        intent.authorizationBindingRevision !== currentPhaseDecision.bindingRevision)) ||
      (recoveryObservations.length > 0 && (!recoveryAuthorizationValid ||
        currentGenericDecision?.decisionId !== lastRecovery?.authorizationDecisionId ||
        lastRecovery === undefined || intent.currentAuthorizationDecisionId !== lastRecovery.authorizationDecisionId ||
        intent.authorizationBindingRevision !== decisions.length + recoveryObservations.length)) ||
      (intent.state === "pending" || intent.state === "executing" || intent.state === "observed" ? receipts.length !== 0 : receipts.length > 1) ||
      (intent.state === "verified" || intent.state === "finalized" ? receipts.length !== 1 : false) ||
      (intent.state === "finalized" || intent.state === "failed" ? finalizations.length !== 1 : finalizations.length !== 0)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Integration intent lineage, authorization, or lifecycle is inconsistent");
    }
    const receipt = receipts[0];
    const finalization = finalizations[0];
    if (finalization !== undefined) {
      const expectedRecovery = receipt === undefined ? null : integrationRecoveryResultFor(receipt.code);
      const normalRefusal = intent.state === "failed" && receipt !== undefined;
      if (finalization.authorizationDecisionId !== intent.currentAuthorizationDecisionId ||
          (receipt === undefined ? finalization.verifiedReceiptId !== null :
            finalization.verifiedReceiptId !== receipt.verifiedReceiptId) ||
          (intent.state === "finalized" && (finalization.outcome !== receipt?.outcome ||
            finalization.recoveryResult !== intent.recoveryResult)) ||
          (intent.recoveryResult !== null && (expectedRecovery !== intent.recoveryResult ||
            finalization.recoveryResult !== expectedRecovery)) ||
          (normalRefusal && (finalization.outcome !== "refused" || receipt?.outcome !== "refused")) ||
          (intent.state === "failed" && !normalRefusal && finalization.outcome !== "failed")) {
        throw persistenceFailure("CORRUPT_ROW", "Integration finalization is inconsistent");
      }
    }
  }

  for (const observation of state.integrationObservations) {
    const reservation = reservationById.get(observation.reservationId);
    const intent = observation.intentId === null ? null : intentById.get(observation.intentId) ?? null;
    const phaseDecision = phaseDecisionById.get(observation.authorizationDecisionId);
    const genericDecision = state.decisions.find((candidate) => candidate.decisionId === observation.authorizationDecisionId);
    const ownerExecution = reservation === undefined ? undefined : state.executions.find((candidate) =>
      candidate.executionId === reservation.ownerExecutionId);
    const inspectAction = intent === null ? "integration.inspect" as const : "integration.recover" as const;
    if (reservation === undefined || ownerExecution === undefined || !integrationObservationSemanticsAreValid(reservation, intent, observation) ||
        (observation.operation === "inspect" ? !genericAuthorizationMatches(
          state, observation.authorizationDecisionId, inspectAction,
          genericDecision?.actorId ?? "", reservation.projectId, reservation.projectResourceRevision,
          reservation.projectConfigRevision, "execution", reservation.ownerExecutionId, ownerExecution.revision,
          "allow", intent === null ? "integration.inspected" : "integration.recovered",
        ) : phaseDecision === undefined || phaseDecision.operationId !== intent?.operationId ||
          phaseDecision.phase !== "act" || phaseDecision.bindingRevision !== 2 || phaseDecision.result !== "allow")) {
      throw persistenceFailure("CORRUPT_ROW", "Integration observation identity, authorization, or receipt matrix is inconsistent");
    }
  }

  for (const receipt of state.integrationReceipts) {
    const intent = intentById.get(receipt.intentId);
    const observation = observationById.get(receipt.observationId);
    if (intent === undefined || observation === undefined || observation.intentId !== receipt.intentId ||
        observation.observationNumber !== receipt.observationNumber ||
        observation.adapterReceiptId !== receipt.adapterReceiptId || observation.receiptSha256 !== receipt.receiptSha256 ||
        observation.outcome !== receipt.outcome || observation.code !== receipt.code ||
        receipt.verifiedAt < observation.observedAt) {
      throw persistenceFailure("CORRUPT_ROW", "Integration verified receipt is inconsistent");
    }
  }

  for (const finalization of state.integrationFinalizations) {
    const intent = intentById.get(finalization.intentId);
    const receipt = finalization.verifiedReceiptId === null ? null : receiptById.get(finalization.verifiedReceiptId) ?? null;
    if (intent === undefined || (receipt !== null && receipt.intentId !== intent.intentId) ||
        ((finalization.outcome === "succeeded" || finalization.outcome === "refused") !== (receipt !== null))) {
      throw persistenceFailure("CORRUPT_ROW", "Integration finalization evidence is inconsistent");
    }
  }

  for (const event of state.integrationEvents) {
    const reservation = reservationById.get(event.reservationId);
    const intent = event.intentId === null ? null : intentById.get(event.intentId) ?? null;
    if (reservation === undefined || (event.intentId !== null && intent === null) ||
        (intent !== null && intent.reservationId !== event.reservationId) ||
        (event.observationNumber !== null && !state.integrationObservations.some((observation) =>
          observation.reservationId === event.reservationId && observation.observationNumber === event.observationNumber))) {
      throw persistenceFailure("CORRUPT_ROW", "Integration event evidence is inconsistent");
    }
  }
}

function workspaceEvidenceSha256For(
  workspace: ApplicationState["workspaceGenerations"][number],
  receipt: ApplicationState["workspaceReceipts"][number],
  readyRevision: number,
): string {
  return sha256(canonicalJson({
    workspaceId: workspace.workspaceId,
    generation: workspace.generation,
    workspaceRevision: readyRevision,
    workspaceRootKey: workspace.workspaceRootKey,
    verifiedReceiptId: receipt.verifiedReceiptId,
    receiptSha256: receipt.receiptSha256,
    repositoryIdentity: receipt.repositoryIdentity,
    branchReference: receipt.branchReference,
    headObjectId: receipt.headObjectId,
    ownershipBindingSha256: receipt.ownershipBindingSha256,
  }));
}

function policyCompletionWorkspace(
  state: ApplicationState,
  parent: ApplicationState["completionDecisions"][number],
  child: ApplicationState["policyGatedCompletionDecisions"][number],
): Readonly<{
  workspace: ApplicationState["workspaceGenerations"][number];
  receipt: ApplicationState["workspaceReceipts"][number];
}> | null {
  const candidates = state.workspaceGenerations.flatMap((workspace) => {
    if (workspace.executionId !== parent.executionId || workspace.taskId !== parent.taskId ||
        workspace.taskRevision !== parent.preTaskRevision) return [];
    return state.workspaceReceipts.filter((receipt) => receipt.workspaceId === workspace.workspaceId &&
      receipt.generation === workspace.generation && receipt.outcome === "succeeded" &&
      receipt.externalState === "complete" && receipt.headObjectId === child.headObjectId &&
      receipt.repositoryIdentity !== null && receipt.branchReference !== undefined &&
      readyWorkspaceRevisionForReceipt(state, receipt) !== null &&
      workspaceEvidenceSha256For(workspace, receipt, readyWorkspaceRevisionForReceipt(state, receipt)!) === child.workspaceEvidenceSha256)
      .map((receipt) => Object.freeze({ workspace, receipt }));
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function completionPolicySubjectForDecision(
  project: ApplicationState["projects"][number],
  parent: ApplicationState["completionDecisions"][number],
  workspace: ApplicationState["workspaceGenerations"][number],
  receipt: ApplicationState["workspaceReceipts"][number],
  readyRevision: number,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: project.projectId,
    projectResourceRevision: project.resourceRevision,
    projectConfigRevision: project.configRevision,
    projectRootKey: project.rootKey,
    repositoryIdentity: receipt.repositoryIdentity,
    taskId: parent.taskId,
    taskRevision: parent.preTaskRevision,
    executionId: parent.executionId,
    executionRevision: parent.executionRevision,
    attemptNumber: parent.attemptNumber,
    fencingToken: parent.fencingToken,
    workspaceId: workspace.workspaceId,
    generation: workspace.generation,
    workspaceRevision: readyRevision,
    ownershipBindingSha256: receipt.ownershipBindingSha256,
    headObjectId: receipt.headObjectId,
  });
}

function gateSetDigestIsValid(
  state: ApplicationState,
  parent: ApplicationState["completionDecisions"][number],
  child: ApplicationState["policyGatedCompletionDecisions"][number],
  policy: ApplicationState["projectPolicyReceipts"][number],
  facts: ProjectPolicyFacts,
  workspace: ApplicationState["workspaceGenerations"][number],
  workspaceReceipt: ApplicationState["workspaceReceipts"][number],
): boolean {
  const requirements = [...facts.requiredGates].sort((left, right) =>
    `${left.gateId}\u0000${left.gateVersion}`.localeCompare(`${right.gateId}\u0000${right.gateVersion}`));
  if (requirements.length === 0) return child.gateSetSha256 === sha256(canonicalJson([]));
  const first = requirements[0]!;
  const configurations = state.completionGateRequests.filter((request) => request.operationKind === "inspect_gate" &&
    request.policyReceiptId === policy.receiptId && request.gateId === first.gateId &&
    request.gateVersion === first.gateVersion).map((request) =>
      `${request.adapterId}\u0000${request.adapterVersion}\u0000${request.completionEvidenceRootKey}`);
  for (const configuration of new Set(configurations)) {
    const [adapterId, adapterVersion, evidenceRootKey] = configuration.split("\u0000");
    const projection: unknown[] = [];
    let complete = true;
    for (const gate of requirements) {
      const candidates = state.completionGateRequests.filter((request) => request.operationKind === "inspect_gate" &&
        request.projectId === policy.projectId && request.projectResourceRevision === policy.projectResourceRevision &&
        request.projectConfigRevision === policy.projectConfigRevision && request.projectRootKey === policy.projectRootKey &&
        request.repositoryIdentity === workspaceReceipt.repositoryIdentity && request.taskId === parent.taskId &&
        request.taskRevision === parent.preTaskRevision && request.executionId === parent.executionId &&
        request.executionRevision === parent.executionRevision && request.attemptNumber === parent.attemptNumber &&
        request.fencingToken === parent.fencingToken && request.workspaceId === workspace.workspaceId &&
        request.generation === workspace.generation && request.workspaceRevision ===
          readyWorkspaceRevisionForReceipt(state, workspaceReceipt) &&
        request.workspaceRootKey === workspace.workspaceRootKey &&
        request.ownershipBindingSha256 === workspaceReceipt.ownershipBindingSha256 &&
        request.headObjectId === workspaceReceipt.headObjectId && request.policyReceiptId === policy.receiptId &&
        request.policyId === policy.policyId && request.policyConfigRevision === policy.policyConfigRevision &&
        request.gateId === gate.gateId && request.gateVersion === gate.gateVersion &&
        request.commandKey === gate.commandKey && request.commandIdentitySha256 === gate.commandIdentitySha256 &&
        request.toolEnvironmentSha256 === gate.toolEnvironmentSha256 && request.adapterId === adapterId &&
        request.adapterVersion === adapterVersion && request.completionEvidenceRootKey === evidenceRootKey)
        .flatMap((request) => {
          const intent = state.completionGateIntents.find((candidate) => candidate.requestId === request.requestId &&
            candidate.state === "finalized");
          const finalization = intent === undefined ? undefined : state.completionGateFinalizations.find((candidate) =>
            candidate.intentId === intent.intentId && candidate.outcome === "accepted" &&
            candidate.finalizedAt <= child.createdAt);
          const receipt = finalization?.verifiedReceiptId === null || finalization?.verifiedReceiptId === undefined
            ? undefined : state.completionGateReceipts.find((candidate) =>
              candidate.verifiedReceiptId === finalization.verifiedReceiptId && candidate.verdict === "pass" &&
              (candidate.validUntil === null || candidate.validUntil > child.createdAt));
          return intent === undefined || finalization === undefined || receipt === undefined
            ? [] : [Object.freeze({ request, receipt })];
        }).sort((left, right) => right.receipt.verifiedAt.localeCompare(left.receipt.verifiedAt));
      const evidence = candidates[0];
      if (evidence === undefined) {
        complete = false;
        break;
      }
      projection.push(Object.freeze({
        gateId: gate.gateId,
        gateVersion: gate.gateVersion,
        commandKey: gate.commandKey,
        commandIdentitySha256: gate.commandIdentitySha256,
        toolEnvironmentSha256: gate.toolEnvironmentSha256,
        requestId: evidence.request.requestId,
        gateOperationId: evidence.receipt.gateOperationId,
        verifiedReceiptId: evidence.receipt.verifiedReceiptId,
        receiptSha256: evidence.receipt.receiptSha256,
        validUntil: evidence.receipt.validUntil,
      }));
    }
    if (complete && sha256(canonicalJson(projection)) === child.gateSetSha256) return true;
  }
  return false;
}

function integrationEvidenceDigestIsValid(
  state: ApplicationState,
  parent: ApplicationState["completionDecisions"][number],
  child: ApplicationState["policyGatedCompletionDecisions"][number],
  facts: ProjectPolicyFacts,
  projectId: string,
  workspace: ApplicationState["workspaceGenerations"][number],
  workspaceReceipt: ApplicationState["workspaceReceipts"][number],
): boolean {
  if (facts.integration === "not_required") {
    return child.integrationEvidenceSha256 === sha256(canonicalJson({ disposition: "not_required" }));
  }
  const reservations = state.integrationReservations.filter((candidate) => candidate.ownerExecutionId === parent.executionId &&
    candidate.projectId === projectId && candidate.repositoryIdentity === workspaceReceipt.repositoryIdentity &&
    candidate.sourceWorkspaceId === workspace.workspaceId && candidate.sourceGeneration === workspace.generation &&
    candidate.sourceWorkspaceRevision === readyWorkspaceRevisionForReceipt(state, workspaceReceipt) &&
    candidate.sourceOwnershipBindingSha256 === workspaceReceipt.ownershipBindingSha256 &&
    candidate.sourceHeadObjectId === workspaceReceipt.headObjectId && candidate.createdAt <= child.createdAt);
  return reservations.some((reservation) => {
    const evidence = (["apply", "push"] as const).map((operation) => {
      const intent = state.integrationIntents.filter((candidate) => candidate.reservationId === reservation.reservationId &&
        candidate.operationKind === operation && candidate.state === "finalized" && candidate.updatedAt <= child.createdAt)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
      const finalization = intent === undefined ? undefined : state.integrationFinalizations.find((candidate) =>
        candidate.intentId === intent.intentId && candidate.outcome === "succeeded" &&
        candidate.finalizedAt <= child.createdAt);
      const receipt = finalization?.verifiedReceiptId === null || finalization?.verifiedReceiptId === undefined
        ? undefined : state.integrationReceipts.find((candidate) => candidate.verifiedReceiptId === finalization.verifiedReceiptId &&
          candidate.outcome === "succeeded");
      return intent === undefined || finalization === undefined || receipt === undefined ? null : Object.freeze({
        operation,
        intentId: intent.intentId,
        finalizationId: finalization.finalizationId,
        verifiedReceiptId: receipt.verifiedReceiptId,
        receiptSha256: receipt.receiptSha256,
      });
    });
    return !evidence.some((item) => item === null) && sha256(canonicalJson({
      reservationId: reservation.reservationId,
      reservationFencingToken: reservation.fencingToken,
      sourceHeadObjectId: reservation.sourceHeadObjectId,
      evidence,
    })) === child.integrationEvidenceSha256;
  });
}

function validatePolicyGatedCompletionState(state: ApplicationState): void {
  for (const child of state.policyGatedCompletionDecisions) {
    const parent = state.completionDecisions.find((candidate) => candidate.completionDecisionId === child.completionDecisionId);
    const execution = parent === undefined ? undefined : state.executions.find((candidate) =>
      candidate.executionId === parent.executionId);
    const task = parent === undefined ? undefined : state.domain.tasks.find((candidate) => candidate.id === parent.taskId);
    const project = task === undefined ? undefined : state.projects.find((candidate) => candidate.projectId === task.projectId);
    const terminal = parent === undefined ? undefined : state.executionTerminalStates.find((candidate) =>
      candidate.completionDecisionId === parent.completionDecisionId);
    const policy = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === child.policyReceiptId);
    const facts = policy === undefined ? null : projectPolicyFacts(policy);
    const workspaceEvidence = parent === undefined ? null : policyCompletionWorkspace(state, parent, child);
    const executionReceipt = state.executionReceipts.find((candidate) =>
      candidate.verifiedReceiptId === child.executionSuccessVerifiedReceiptId);
    const executionFinalization = state.executionFinalizations.find((candidate) =>
      candidate.finalizationId === child.executionSuccessFinalizationId);
    const completionAuthorization = state.decisions.find((candidate) =>
      candidate.decisionId === child.authorizationDecisionId);
    if (
      parent?.kind !== "policy_gated" || execution === undefined || task === undefined || project === undefined ||
      terminal === undefined || policy === undefined || facts === null || workspaceEvidence === null ||
      executionReceipt === undefined || executionFinalization === undefined ||
      child.createdAt !== parent.createdAt || terminal.createdAt !== child.createdAt ||
      terminal.verifiedReceiptId !== child.executionSuccessVerifiedReceiptId ||
      terminal.finalizationId !== child.executionSuccessFinalizationId ||
      executionReceipt.lifecycle !== "turn_succeeded" || executionFinalization.outcome !== "accepted" ||
      executionFinalization.verifiedReceiptId !== executionReceipt.verifiedReceiptId ||
      policy.operation !== "completion_requirements" || policy.requestedAction !== "completion.accept" ||
      policy.decision !== "allow" || policy.validUntil === null || policy.validUntil <= child.createdAt ||
      policy.subjectSha256 !== sha256(canonicalJson(completionPolicySubjectForDecision(
        Object.freeze({ ...project, resourceRevision: policy.projectResourceRevision, configRevision: policy.projectConfigRevision }),
        parent,
        workspaceEvidence.workspace,
        workspaceEvidence.receipt,
        readyWorkspaceRevisionForReceipt(state, workspaceEvidence.receipt)!,
      ))) ||
      child.headObjectId !== workspaceEvidence.receipt.headObjectId ||
      !gateSetDigestIsValid(state, parent, child, policy, facts, workspaceEvidence.workspace, workspaceEvidence.receipt) ||
      !integrationEvidenceDigestIsValid(
        state, parent, child, facts, project.projectId, workspaceEvidence.workspace, workspaceEvidence.receipt,
      ) ||
      child.preservationStateSha256 !== (facts.preservation === "required"
        ? child.integrationEvidenceSha256
        : sha256(canonicalJson({ disposition: "not_required" }))) ||
      !genericAuthorizationMatches(
        state, child.authorizationDecisionId, "completion.accept", completionAuthorization?.actorId ?? "",
        project.projectId, policy.projectResourceRevision, policy.projectConfigRevision,
        "execution", parent.executionId, parent.executionRevision, "allow", "completion.accepted",
      ) ||
      state.requests.find((candidate) => candidate.requestId === child.requestId)?.requestId !== child.requestId ||
      state.audit.find((candidate) => candidate.auditId === child.auditId)?.decisionId !== child.authorizationDecisionId
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Policy-gated completion evidence or authorization lineage is inconsistent");
    }
  }
  const confirmationClaims = [
    ...state.manualCompletionDecisions.map((record) => `manual:${record.confirmationId}`),
    ...state.policyGatedCompletionDecisions.map((record) => `policy:${record.confirmationId}`),
    ...state.executionIntents.filter((record) => record.confirmationId !== null)
      .map((record) => `execution:${record.confirmationId!}`),
    ...state.workspaceIntents.filter((record) => record.operationKind === "cleanup" && record.confirmationId !== null)
      .map((record) => `cleanup:${record.confirmationId!}`),
    ...new Map(state.integrationAuthorizationDecisions.filter((record) => record.confirmationId !== null)
      .map((record) => [record.operationId, `integration:${record.confirmationId!}`])).values(),
  ];
  const confirmationIds = confirmationClaims.map((claim) => claim.slice(claim.indexOf(":") + 1));
  if (new Set(confirmationIds).size !== confirmationIds.length) {
    throw persistenceFailure("CORRUPT_ROW", "High-risk confirmation was consumed by more than one operation");
  }
}

function cleanupInventorySha256For(
  state: ApplicationState,
  receipt: ApplicationState["workspaceReceipts"][number],
): string | null {
  const observation = state.workspaceObservations.find((candidate) => candidate.observationId === receipt.observationId);
  return observation === undefined ? null : sha256(canonicalJson({
    trackedCount: observation.trackedCount,
    modifiedCount: observation.modifiedCount,
    untrackedCount: observation.untrackedCount,
    ignoredCount: observation.ignoredCount,
    receiptSha256: receipt.receiptSha256,
  }));
}

function cleanupPolicySubjectForAttestation(
  state: ApplicationState,
  attestation: NonNullable<ReturnType<typeof parseWorkspaceCleanupAttestation>>,
  receipt: ApplicationState["workspaceReceipts"][number],
): Readonly<Record<string, unknown>> | null {
  const observedInventorySha256 = cleanupInventorySha256For(state, receipt);
  if (observedInventorySha256 === null) return null;
  return Object.freeze({
    projectId: attestation.projectId,
    projectResourceRevision: attestation.projectResourceRevision,
    projectConfigRevision: attestation.projectConfigRevision,
    projectRootKey: attestation.projectRootKey,
    repositoryIdentity: attestation.repositoryIdentity,
    taskId: attestation.taskId,
    taskRevision: attestation.taskCompletedRevision,
    executionId: attestation.executionId,
    executionRevision: attestation.executionRevision,
    attemptNumber: attestation.attemptNumber,
    fencingToken: attestation.fencingToken,
    workspaceId: attestation.workspaceId,
    generation: attestation.generation,
    workspaceRevision: attestation.workspaceRevision - 1,
    ownershipBindingSha256: attestation.ownershipBindingSha256,
    headObjectId: attestation.expectedHeadObjectId,
    completionDecisionId: attestation.completionDecisionId,
    executionTerminalCreatedAt: attestation.executionTerminalCreatedAt,
    gateSetSha256: attestation.gateSetSha256,
    preservationStateSha256: attestation.preservationStateSha256,
    integrationDisposition: attestation.integrationDisposition,
    integrationReservationId: attestation.integrationReservationId,
    observedInventorySha256,
  });
}

function validateCleanupAttestationState(state: ApplicationState): void {
  for (const record of state.workspaceCleanupAttestations) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(record.attestationJson);
    } catch {
      throw persistenceFailure("CORRUPT_ROW", "Workspace cleanup attestation JSON is malformed");
    }
    const attestation = parseWorkspaceCleanupAttestation(decoded);
    const intent = state.workspaceIntents.find((candidate) => candidate.intentId === record.intentId);
    const generation = state.workspaceGenerations.find((candidate) => candidate.workspaceId === record.workspaceId &&
      candidate.generation === record.generation);
    const project = state.projects.find((candidate) => candidate.projectId === record.projectId);
    const task = state.domain.tasks.find((candidate) => candidate.id === record.taskId);
    const execution = state.executions.find((candidate) => candidate.executionId === record.executionId);
    const parent = task?.completion === undefined ? undefined : state.completionDecisions.find((candidate) =>
      candidate.completionDecisionId === task.completion?.decisionId);
    const child = parent === undefined ? undefined : state.policyGatedCompletionDecisions.find((candidate) =>
      candidate.completionDecisionId === parent.completionDecisionId);
    const terminal = execution === undefined ? undefined : state.executionTerminalStates.find((candidate) =>
      candidate.executionId === execution.executionId);
    if (attestation === null || canonicalJson(attestation) !== record.attestationJson || intent === undefined ||
        generation === undefined || project === undefined || task === undefined || execution === undefined ||
        parent === undefined || child === undefined || terminal === undefined) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace cleanup attestation has no complete durable subject");
    }
    const policy = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === attestation.policyReceiptId);
    const policyFacts = policy === undefined ? null : projectPolicyFacts(policy);
    const actDecision = state.workspaceAuthorizationDecisions.find((candidate) =>
      candidate.decisionId === attestation.cleanupAuthorizationDecisionId);
    const ownershipReceipts = state.workspaceReceipts.filter((receipt) => receipt.workspaceId === attestation.workspaceId &&
      receipt.generation === attestation.generation &&
      readyWorkspaceRevisionForReceipt(state, receipt) === attestation.workspaceRevision - 1 &&
      receipt.outcome === "succeeded" && receipt.externalState === "complete" &&
      receipt.repositoryIdentity === attestation.repositoryIdentity &&
      receipt.headObjectId === attestation.expectedHeadObjectId &&
      receipt.ownershipBindingSha256 === attestation.ownershipBindingSha256);
    const matchingPolicySubjects = policy === undefined ? [] : ownershipReceipts.filter((receipt) => {
      const subject = cleanupPolicySubjectForAttestation(state, attestation, receipt);
      return subject !== null && sha256(canonicalJson(subject)) === policy.subjectSha256;
    });
    const integrationReservation = attestation.integrationReservationId === null ? null :
      state.integrationReservations.find((candidate) => candidate.reservationId === attestation.integrationReservationId) ?? null;
    const quiescence: WorkspaceCleanupQuiescence = Object.freeze({
      activeExecutionOwnerCount: 0,
      currentIntegrationReservationCount: 0,
      executionId: attestation.executionId,
      executionTerminalCreatedAt: attestation.executionTerminalCreatedAt,
      generation: attestation.generation,
      observedAt: attestation.issuedAt,
      taskId: attestation.taskId,
      taskRevision: attestation.taskCompletedRevision,
      unfinishedCompletionGateIntentCount: 0,
      unfinishedIntegrationIntentCount: 0,
      unfinishedWorkspaceIntentCount: 0,
      workspaceId: attestation.workspaceId,
      workspaceRevision: attestation.workspaceRevision,
    });
    const integrationIsValid = attestation.integrationDisposition === "not_required"
      ? integrationReservation === null && policyFacts !== null && policyFacts.integration === "not_required"
      : integrationReservation !== null && policyFacts !== null && policyFacts.integration === "required" &&
        integrationReservation.status === attestation.integrationDisposition &&
        integrationReservation.revision === attestation.integrationReservationRevision &&
        integrationReservation.fencingToken === attestation.integrationReservationFencingToken &&
        integrationReservation.ownerExecutionId === attestation.executionId &&
        integrationReservation.targetReference === attestation.expectedBranchReference;
    if (
      record.attestationId !== attestation.attestationId || record.operationId !== attestation.operationId ||
      record.intentId !== attestation.intentId || record.projectId !== attestation.projectId ||
      record.taskId !== attestation.taskId || record.executionId !== attestation.executionId ||
      record.workspaceId !== attestation.workspaceId || record.generation !== attestation.generation ||
      record.attestationSha256 !== attestation.attestationSha256 ||
      record.quiescenceSha256 !== attestation.quiescenceSha256 || record.issuedAt !== attestation.issuedAt ||
      record.validUntil !== attestation.validUntil || workspaceCleanupQuiescenceSha256(quiescence) !== record.quiescenceSha256 ||
      intent.operationKind !== "cleanup" || intent.action !== "workspace.cleanup" || intent.operationId !== record.operationId ||
      intent.confirmationId !== attestation.confirmationId || intent.state === "pending" ||
      generation.projectId !== attestation.projectId || generation.taskId !== attestation.taskId ||
      generation.executionId !== attestation.executionId || generation.revision < attestation.workspaceRevision ||
      generation.workspaceRootKey !== attestation.workspaceRootKey ||
      project.rootKey !== attestation.projectRootKey || project.resourceRevision < attestation.projectResourceRevision ||
      project.configRevision < attestation.projectConfigRevision || task.state !== "completed" ||
      task.revision !== attestation.taskCompletedRevision || task.completion?.decisionId !== attestation.completionDecisionId ||
      parent.kind !== "policy_gated" || parent.executionId !== attestation.executionId ||
      parent.attemptNumber !== attestation.attemptNumber || parent.fencingToken !== attestation.fencingToken ||
      child.gateSetSha256 !== attestation.gateSetSha256 ||
      child.preservationStateSha256 !== attestation.preservationStateSha256 ||
      child.headObjectId !== attestation.expectedHeadObjectId || execution.revision !== attestation.executionRevision ||
      execution.attemptNumber !== attestation.attemptNumber || execution.fencingToken !== attestation.fencingToken ||
      terminal.status !== "completed" || terminal.completionDecisionId !== attestation.completionDecisionId ||
      terminal.createdAt !== attestation.executionTerminalCreatedAt || policy === undefined || policyFacts === null ||
      policy.operation !== "evaluate_cleanup" || policy.requestedAction !== "workspace.cleanup" ||
      policy.decision !== "allow" || policyFacts.cleanup !== "allowed_after_completion" ||
      policy.receiptSha256 !== attestation.policyReceiptSha256 ||
      policy.policyConfigRevision !== attestation.policyConfigRevision || policy.validUntil === null ||
      policy.validUntil <= attestation.issuedAt || matchingPolicySubjects.length !== 1 || actDecision === undefined ||
      actDecision.operationId !== attestation.operationId ||
      actDecision.bindingRevision !== attestation.cleanupAuthorizationBindingRevision ||
      actDecision.bindingRevision !== 2 || actDecision.phase !== "act" || actDecision.result !== "allow" ||
      actDecision.projectId !== attestation.projectId ||
      actDecision.projectResourceRevision !== attestation.projectResourceRevision ||
      actDecision.projectConfigRevision !== attestation.projectConfigRevision ||
      actDecision.executionId !== attestation.executionId ||
      actDecision.executionRevision !== attestation.executionRevision ||
      actDecision.fencingToken !== attestation.fencingToken || actDecision.workspaceId !== attestation.workspaceId ||
      actDecision.generation !== attestation.generation || actDecision.generationRevision !== attestation.workspaceRevision ||
      actDecision.grantId !== attestation.grantId || actDecision.grantRevision !== attestation.grantRevision ||
      actDecision.createdAt !== attestation.issuedAt || !phaseAuthorizationIsValid(
        state, actDecision, "workspace.cleanup", attestation.projectId,
        attestation.projectResourceRevision, attestation.projectConfigRevision,
      ) || !integrationIsValid
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace cleanup attestation identity, policy, or quiescence is inconsistent");
    }
  }
}

function workspaceGenerationKey(workspaceId: string, generation: number): string {
  return `${workspaceId}\u0000${generation}`;
}

function recoveredWorkspaceOperation(
  intentByOperation: ReadonlyMap<string, ApplicationState["workspaceIntents"][number]>,
  intent: ApplicationState["workspaceIntents"][number],
  decisions: ReadonlyArray<ApplicationState["workspaceAuthorizationDecisions"][number]>,
): ApplicationState["workspaceIntents"][number]["operationKind"] | null {
  if (intent.operationKind !== "recover") return null;
  const prepareDecision = decisions.find((decision) => decision.bindingRevision === 1 && decision.phase === "prepare");
  const actDecision = decisions.find((decision) => decision.bindingRevision === 2 && decision.phase === "act");
  if (
    prepareDecision?.generationRevision === null || prepareDecision?.generationRevision === undefined ||
    (actDecision !== undefined && actDecision.generationRevision !== prepareDecision.generationRevision)
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
    (operationId) => intentByOperation.get(operationId),
  )?.rootOperation ?? null;
}

function validateWorkspaceState(state: ApplicationState): void {
  const generationByKey = new Map(
    state.workspaceGenerations.map((record) => [workspaceGenerationKey(record.workspaceId, record.generation), record]),
  );
  const intentById = new Map(state.workspaceIntents.map((record) => [record.intentId, record]));
  const intentByOperation = new Map(state.workspaceIntents.map((record) => [record.operationId, record]));
  const decisionById = new Map(state.workspaceAuthorizationDecisions.map((record) => [record.decisionId, record]));
  const observationById = new Map(state.workspaceObservations.map((record) => [record.observationId, record]));
  const receiptById = new Map(state.workspaceReceipts.map((record) => [record.verifiedReceiptId, record]));
  const finalizationByIntent = new Map(state.workspaceFinalizations.map((record) => [record.intentId, record]));
  const currentOwners = new Set<string>();

  for (const generation of state.workspaceGenerations) {
    const project = state.projects.find((candidate) => candidate.projectId === generation.projectId);
    const task = state.domain.tasks.find((candidate) => candidate.id === generation.taskId);
    const run = state.dispatcherRuns.find((candidate) => candidate.runId === generation.runId);
    const execution = state.executions.find((candidate) => candidate.executionId === generation.executionId);
    const member = state.dispatcherMembers.find((candidate) => candidate.memberId === generation.memberId);
    const predecessor = generation.predecessorGeneration === null
      ? null
      : generationByKey.get(workspaceGenerationKey(generation.workspaceId, generation.predecessorGeneration));
    const ownerKey = `${generation.projectId}\u0000${generation.taskId}\u0000${generation.runId}\u0000${generation.executionId}`;
    if (generation.status !== "cleaned") {
      if (currentOwners.has(ownerKey)) {
        throw persistenceFailure("CORRUPT_ROW", "Workspace generation current ownership is not unique");
      }
      currentOwners.add(ownerKey);
    }
    if (
      project === undefined || project.rootKey !== generation.projectRootKey ||
      project.resourceRevision < generation.projectResourceRevision ||
      project.configRevision < generation.projectConfigRevision ||
      task === undefined || task.projectId !== generation.projectId || task.revision < generation.taskRevision ||
      run === undefined || run.runRevision < generation.runRevision ||
      member === undefined || member.runId !== generation.runId || member.taskId !== generation.taskId ||
      member.executionId !== generation.executionId || member.outcome !== "claimed" ||
      member.membershipRevision !== generation.membershipRevision || member.revision < generation.memberRevision ||
      execution === undefined || execution.taskId !== generation.taskId ||
      execution.revision < generation.executionRevision ||
      execution.attemptNumber !== generation.attemptNumber || execution.fencingToken !== generation.fencingToken ||
      generation.updatedAt < generation.createdAt ||
      (generation.generation === 1 && predecessor !== null) ||
      (generation.generation > 1 && (
        predecessor === undefined || predecessor === null || predecessor.status !== "cleaned" ||
        predecessor.revision !== generation.predecessorRevision
      ))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace generation ownership tuple or predecessor is inconsistent");
    }
  }

  for (const decision of state.workspaceAuthorizationDecisions) {
    const generation = decision.workspaceId === null || decision.generation === null
      ? null
      : generationByKey.get(workspaceGenerationKey(decision.workspaceId, decision.generation));
    const project = state.projects.find((candidate) => candidate.projectId === decision.projectId);
    const execution = state.executions.find((candidate) => candidate.executionId === decision.executionId);
    const grant = decision.grantId === null
      ? null
      : state.grants.find((candidate) => candidate.grantId === decision.grantId) ?? null;
    const tupleAbsent = decision.workspaceId === null && decision.generation === null && decision.generationRevision === null;
    const tuplePresent = decision.workspaceId !== null && decision.generation !== null && decision.generationRevision !== null;
    const grantIsUsable = grant !== null && grantRevisionWasUsableAt(
      grant,
      decision.actorId,
      decision.action,
      decision.createdAt,
      decision.grantRevision,
    ) && (grant.scope.kind === "runtime" || (
      grant.scope.projectId === decision.projectId &&
      grant.scope.resourceRevision === decision.projectResourceRevision &&
      grant.scope.configRevision === decision.projectConfigRevision
    ));
    if (
      (!tupleAbsent && !tuplePresent) ||
      project === undefined || project.resourceRevision < decision.projectResourceRevision ||
      project.configRevision < decision.projectConfigRevision ||
      execution === undefined || execution.revision < decision.executionRevision ||
      execution.fencingToken !== decision.fencingToken ||
      (generation !== null && generation !== undefined && (
        generation.projectId !== decision.projectId || generation.executionId !== decision.executionId ||
        generation.revision < (decision.generationRevision ?? 0)
      )) ||
      (decision.result === "allow" && (!tuplePresent || decision.reason !== "allowed" || !grantIsUsable)) ||
      (decision.result === "deny" && decision.reason === "allowed")
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace authorization decision is inconsistent");
    }
  }

  for (const intent of state.workspaceIntents) {
    const generation = generationByKey.get(workspaceGenerationKey(intent.workspaceId, intent.generation));
    const decisions = state.workspaceAuthorizationDecisions
      .filter((record) => record.operationId === intent.operationId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const currentDecision = decisionById.get(intent.currentAuthorizationDecisionId);
    const observations = state.workspaceObservations
      .filter((record) => record.intentId === intent.intentId)
      .sort((left, right) => left.observationNumber - right.observationNumber);
    const receipts = state.workspaceReceipts.filter((record) => record.intentId === intent.intentId);
    const events = state.workspaceEvents.filter((record) => record.intentId === intent.intentId);
    const verifiedEvents = events.filter((record) => record.eventKind === "workspace.operation.verified");
    const terminalEvents = events.filter((record) =>
      record.eventKind === "workspace.operation.finalized" || record.eventKind === "workspace.operation.reconciled"
    );
    const finalization = finalizationByIntent.get(intent.intentId);
    const phases = decisions.map((record) => record.phase);
    const exactPhaseSequence = (expected: readonly ("prepare" | "act" | "finalize")[]): boolean =>
      phases.length === expected.length && phases.every((phase, index) => phase === expected[index]);
    const phaseSequenceIsValid = intent.state === "pending"
      ? exactPhaseSequence(["prepare"])
      : intent.state === "executing" || intent.state === "observed" || intent.state === "verified"
        ? exactPhaseSequence(["prepare", "act"])
        : intent.state === "finalized"
          ? exactPhaseSequence(["prepare", "act", "finalize"])
          : intent.state === "failed"
            ? exactPhaseSequence(["prepare"]) || exactPhaseSequence(["prepare", "act"])
            : exactPhaseSequence(["prepare", "act"]) || exactPhaseSequence(["prepare", "act", "finalize"]);
    const prepareDecision = decisions[0];
    const actDecision = decisions[1];
    const finalizeDecision = decisions[2];
    const authorizationPatternIsValid = prepareDecision?.result === "allow" && (
      intent.state === "pending"
        ? decisions.length === 1
        : intent.state === "executing" || intent.state === "observed" || intent.state === "verified"
          ? decisions.length === 2 && actDecision?.result === "allow"
          : intent.state === "finalized"
            ? decisions.length === 3 && actDecision?.result === "allow" && finalizeDecision?.result === "allow"
            : intent.state === "failed"
              ? decisions.length === 1 || (decisions.length === 2 && (
                  actDecision?.result === "allow" || actDecision?.result === "deny"
                ))
              : (decisions.length === 2 && actDecision?.result === "allow") || (
                  decisions.length === 3 && actDecision?.result === "allow" && finalizeDecision?.result === "deny"
                )
    );
    const recoveredOperation = recoveredWorkspaceOperation(intentByOperation, intent, decisions);
    const causationIsValid = intent.operationKind === "recover"
      ? recoveredOperation !== null
      : intent.causationId === null;
    const needsVerifiedReceipt = intent.state === "verified" || intent.state === "finalized";
    const forbidsVerifiedReceipt = intent.state === "pending" || intent.state === "executing" ||
      intent.state === "observed" || intent.state === "failed";
    const expectedTerminalEventKind = intent.operationKind === "recover"
      ? "workspace.operation.reconciled"
      : "workspace.operation.finalized";
    const terminalEvent = terminalEvents[0];
    const failureTupleIsEmpty = intent.lastFailureCategory === null && intent.lastFailureCode === null &&
      intent.lastFailureRetryable === null && intent.lastFailureAmbiguous === null;
    const failureTupleIsComplete = intent.lastFailureCategory !== null && intent.lastFailureCode !== null &&
      intent.lastFailureRetryable !== null && intent.lastFailureAmbiguous !== null;
    const failureSemanticsAreValid = failureTupleIsComplete && workspaceFailureSemanticsAreValid(
      intent.lastFailureCategory,
      intent.lastFailureRetryable,
      intent.lastFailureAmbiguous,
    );
    const unsuccessfulTerminal = intent.state === "failed" || intent.state === "ambiguous";
    const terminalEvidenceCode = failureTupleIsComplete
      ? intent.lastFailureCode
      : observations.at(-1)?.code ?? null;
    const terminalEvidenceEvents = finalization === undefined
      ? []
      : events.filter((record) =>
          (record.eventKind === "workspace.operation.observed" || record.eventKind === "workspace.operation.denied") &&
          record.reasonCode === finalization.code && record.workspaceId === intent.workspaceId &&
          record.generation === intent.generation && record.generationRevision === finalization.resultingGenerationRevision
        );
    const expectedUnsuccessfulEventOutcome = currentDecision?.result === "deny"
      ? "denied"
      : finalization?.outcome;
    if (
      generation === undefined || intent.action !== `workspace.${intent.operationKind}` ||
      generation.adapterId !== intent.adapterId || generation.adapterVersion !== intent.adapterVersion ||
      intent.requestId !== decisions[0]?.requestId || intent.actorId !== decisions[0]?.actorId ||
      decisions.length === 0 || decisions[0]?.bindingRevision !== 1 || decisions[0]?.phase !== "prepare" ||
      decisions.some((record, index) => record.bindingRevision !== index + 1) ||
      decisions.some((record) => record.actorId !== intent.actorId || record.action !== intent.action) ||
      decisions.some((record) =>
        record.workspaceId !== intent.workspaceId || record.generation !== intent.generation ||
        record.generationRevision === null
      ) ||
      phases.some((phase, index) => index > 0 && phase === "prepare") ||
      !phaseSequenceIsValid || !authorizationPatternIsValid || !causationIsValid ||
      currentDecision === undefined || currentDecision.operationId !== intent.operationId ||
      currentDecision.bindingRevision !== intent.authorizationBindingRevision ||
      decisions.at(-1)?.decisionId !== currentDecision.decisionId ||
      (currentDecision.result !== "allow" && !(
        currentDecision.result === "deny" && finalization !== undefined &&
        finalization.authorizationDecisionId === currentDecision.decisionId &&
        (finalization.outcome === "ambiguous" || finalization.outcome === "failed")
      )) ||
      intent.expectedGenerationRevision > generation.revision ||
      observations.length !== intent.lastObservationNumber ||
      observations.some((record, index) => record.observationNumber !== index + 1) ||
      (!failureTupleIsEmpty && !failureSemanticsAreValid) ||
      (intent.state === "failed" && (!failureSemanticsAreValid || intent.lastFailureAmbiguous !== false)) ||
      (intent.state === "ambiguous" && failureTupleIsComplete && (
        !failureSemanticsAreValid || intent.lastFailureAmbiguous !== true
      )) ||
      (!unsuccessfulTerminal && !failureTupleIsEmpty) ||
      (intent.state === "ambiguous" && failureTupleIsEmpty && observations.at(-1)?.outcome !== "ambiguous") ||
      (needsVerifiedReceipt && receipts.length !== 1) ||
      (forbidsVerifiedReceipt && receipts.length !== 0) ||
      (needsVerifiedReceipt && verifiedEvents.length !== 1) ||
      (forbidsVerifiedReceipt && verifiedEvents.length !== 0) ||
      (intent.operationKind === "cleanup") !== (intent.confirmationId !== null) ||
      (intent.state === "finalized") !== (finalization?.outcome === "succeeded" || finalization?.outcome === "refused") ||
      (intent.state === "ambiguous") !== (finalization?.outcome === "ambiguous") ||
      (intent.state === "failed") !== (finalization?.outcome === "failed") ||
      (intent.state === "finalized" && (
        terminalEvents.length !== 1 || terminalEvent?.eventKind !== expectedTerminalEventKind ||
        terminalEvent.outcome !== (finalization?.outcome === "refused" ? "refused" : "accepted") ||
        terminalEvent.reasonCode !== finalization?.code ||
        terminalEvent.workspaceId !== intent.workspaceId || terminalEvent.generation !== intent.generation ||
        terminalEvent.generationRevision !== finalization?.resultingGenerationRevision
      )) ||
      (unsuccessfulTerminal && (
        finalization === undefined || finalization.code !== terminalEvidenceCode ||
        terminalEvidenceEvents.length !== 1 ||
        terminalEvidenceEvents[0]?.outcome !== expectedUnsuccessfulEventOutcome ||
        terminalEvidenceEvents[0]?.observationNumber !== (
          intent.lastObservationNumber === 0 ? null : intent.lastObservationNumber
        )
      )) ||
      (intent.state !== "finalized" && terminalEvents.length !== 0) ||
      (["pending", "executing", "observed", "verified"] as readonly string[]).includes(intent.state) && finalization !== undefined
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace intent lineage is incomplete or inconsistent");
    }
  }

  for (const observation of state.workspaceObservations) {
    const intent = intentById.get(observation.intentId);
    const decision = decisionById.get(observation.authorizationDecisionId);
    const cleanupAttestation = state.workspaceCleanupAttestations.find((candidate) => candidate.intentId === observation.intentId);
    if (
      intent === undefined || decision === undefined || decision.operationId !== intent.operationId ||
      decision.phase !== "act" || decision.bindingRevision !== 2 || decision.result !== "allow" ||
      !workspaceReceiptSemanticsAreValid(
        intent.operationKind,
        observation.code,
        observation.outcome,
        observation.externalState,
      ) ||
      observation.modifiedCount > observation.trackedCount ||
      (intent.operationKind === "cleanup"
        ? cleanupAttestation === undefined ||
          observation.cleanupAttestationSha256 !== cleanupAttestation.attestationSha256
        : observation.cleanupAttestationSha256 !== null)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace observation lineage is incomplete or inconsistent");
    }
  }

  for (const receipt of state.workspaceReceipts) {
    const intent = intentById.get(receipt.intentId);
    const observation = observationById.get(receipt.observationId);
    const generation = generationByKey.get(workspaceGenerationKey(receipt.workspaceId, receipt.generation));
    if (
      intent === undefined || observation === undefined || generation === undefined ||
      observation.intentId !== intent.intentId || observation.observationNumber !== receipt.observationNumber ||
      observation.adapterReceiptId !== receipt.adapterReceiptId || observation.receiptSha256 !== receipt.receiptSha256 ||
      observation.externalState !== receipt.externalState || observation.outcome !== receipt.outcome ||
      observation.code !== receipt.code || intent.workspaceId !== receipt.workspaceId ||
      intent.generation !== receipt.generation || generation.revision < receipt.generationRevision ||
      observation.repositoryIdentity !== receipt.repositoryIdentity ||
      observation.branchReference !== receipt.branchReference || observation.headObjectId !== receipt.headObjectId ||
      observation.ownershipBindingSha256 !== receipt.ownershipBindingSha256 ||
      observation.cleanupAttestationSha256 !== receipt.cleanupAttestationSha256 ||
      !workspaceReceiptSemanticsAreValid(
        intent.operationKind,
        receipt.code,
        receipt.outcome,
        receipt.externalState,
      )
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace verified receipt is inconsistent");
    }
  }

  for (const finalization of state.workspaceFinalizations) {
    const intent = intentById.get(finalization.intentId);
    const decision = decisionById.get(finalization.authorizationDecisionId);
    const receipt = finalization.verifiedReceiptId === null
      ? null
      : receiptById.get(finalization.verifiedReceiptId) ?? null;
    const generation = intent === undefined
      ? undefined : generationByKey.get(workspaceGenerationKey(intent.workspaceId, intent.generation));
    const observations = intent === undefined
      ? []
      : state.workspaceObservations
          .filter((record) => record.intentId === intent.intentId)
          .sort((left, right) => left.observationNumber - right.observationNumber);
    const lastObservation = observations.at(-1);
    const recoveredOperation = intent === undefined
      ? null
      : recoveredWorkspaceOperation(
          intentByOperation,
          intent,
          state.workspaceAuthorizationDecisions
            .filter((record) => record.operationId === intent.operationId)
            .sort((left, right) => left.bindingRevision - right.bindingRevision),
        );
    let expectedResultingStatus: WorkspaceFinalizationRecord["resultingGenerationStatus"] | null = null;
    let expectedFinalizationCode: string | null = null;
    if (intent !== undefined) {
      if (receipt !== null) {
        expectedResultingStatus = workspaceGenerationStatusAfterReceipt(
          intent.operationKind,
          receipt.code,
          receipt.outcome,
          receipt.externalState,
          finalization.resultingGenerationStatus,
          intent.operationKind === "recover" ? recoveredOperation : null,
        );
        expectedFinalizationCode = receipt.code;
      } else if (
        intent.lastFailureCategory !== null && intent.lastFailureCode !== null &&
        intent.lastFailureRetryable !== null && intent.lastFailureAmbiguous !== null
      ) {
        expectedResultingStatus = workspaceGenerationStatusAfterFailure(
          intent.operationKind,
          finalization.resultingGenerationStatus,
          intent.lastFailureCategory,
          intent.lastFailureRetryable,
          intent.lastFailureAmbiguous,
        );
        expectedFinalizationCode = intent.lastFailureCode;
      } else if (lastObservation?.outcome === "ambiguous") {
        expectedResultingStatus = workspaceGenerationStatusAfterReceipt(
          intent.operationKind,
          lastObservation.code,
          lastObservation.outcome,
          lastObservation.externalState,
          finalization.resultingGenerationStatus,
          intent.operationKind === "recover" ? recoveredOperation : null,
        );
        expectedFinalizationCode = lastObservation.code;
      }
    }
    if (
      intent === undefined || decision === undefined || generation === undefined ||
      decision.operationId !== intent.operationId ||
      finalization.authorizationDecisionId !== intent.currentAuthorizationDecisionId ||
      ((finalization.outcome === "succeeded" || finalization.outcome === "refused") && decision.result !== "allow") ||
      ((finalization.outcome === "succeeded" || finalization.outcome === "refused") &&
        (decision.phase !== "finalize" || decision.bindingRevision !== intent.authorizationBindingRevision)) ||
      ((finalization.outcome === "ambiguous" || finalization.outcome === "failed") &&
        decision.result !== "allow" && decision.result !== "deny") ||
      finalization.resultingGenerationRevision > generation.revision ||
      finalization.resultingGenerationRevision !== intent.expectedGenerationRevision ||
      finalization.resultingGenerationStatus !== intent.expectedGenerationStatus ||
      (finalization.resultingGenerationRevision === generation.revision &&
        finalization.resultingGenerationStatus !== generation.status) ||
      expectedResultingStatus === null || expectedResultingStatus !== finalization.resultingGenerationStatus ||
      expectedFinalizationCode === null || expectedFinalizationCode !== finalization.code ||
      ((finalization.outcome === "succeeded" || finalization.outcome === "refused") !== (receipt !== null)) ||
      (receipt !== null && (receipt.intentId !== intent.intentId || receipt.outcome !== finalization.outcome))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace finalization is inconsistent");
    }
  }

  for (const event of state.workspaceEvents) {
    const intent = event.intentId === null ? null : intentById.get(event.intentId);
    const generation = event.workspaceId === null || event.generation === null
      ? null : generationByKey.get(workspaceGenerationKey(event.workspaceId, event.generation));
    if (
      (event.intentId === null && event.eventKind !== "workspace.operation.denied") ||
      (intent !== null && intent !== undefined && (
        intent.operationId !== event.operationId || intent.actorId !== event.actorId ||
        intent.correlationId !== event.correlationId || intent.causationId !== event.causationId
      )) ||
      (event.intentId !== null && intent === undefined) ||
      (generation !== null && generation !== undefined && generation.revision < (event.generationRevision ?? 0)) ||
      (event.workspaceId !== null && generation === undefined)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Workspace event evidence is inconsistent");
    }
  }

  if (state.workspaceGenerations.some((generation) => !intentByOperation.has(generation.creatorOperationId))) {
    throw persistenceFailure("CORRUPT_ROW", "Workspace generation creator intent is absent");
  }
}


export function readApplicationStateUntransactional(database: SqliteDatabase): ApplicationState {
  const domain = readDomainSnapshotUntransactional(database);
  const projects = readProjects(database);
  const bootstrap = readBootstrap(database);
  const identity = readIdentity(database);
  const grants = readGrants(database);
  const epochs = readEpochs(database);
  const requests = readRequests(database);
  const decisions = readDecisions(database);
  const decodedAudit = readAudit(database);
  const audit = Object.freeze(decodedAudit.map((event) => event.record));
  const lifecycle = readLifecycle(database);
  const executionSequences = readExecutionSequences(database);
  const executions = readExecutionAttempts(database);
  const executionOperationRequests = readExecutionOperationRequests(database);
  const executionAuthorizationDecisions = readExecutionAuthorizationDecisions(database);
  const executionOperationAudit = readExecutionOperationAudit(database);
  const executionIntents = readExecutionIntents(database);
  const executionIntentAuthorizationBindings = readExecutionIntentAuthorizationBindings(database);
  const executionObservations = readExecutionObservations(database);
  const executionReceipts = readExecutionReceipts(database);
  const executionFinalizations = readExecutionFinalizations(database);
  const executionTerminalStates = readExecutionTerminalStates(database);
  const manualTurns = readManualTurns(database);
  const manualBackendOperations = readManualBackendOperations(database);
  const completionDecisions = readCompletionDecisions(database);
  const manualCompletionDecisions = readManualCompletionDecisions(database);
  const dispatcherTriggerRequests = readDispatcherTriggerRequests(database);
  const dispatcherAuthorizationDecisions = readDispatcherAuthorizationDecisions(database);
  const dispatcherRuns = readDispatcherRuns(database);
  const dispatcherAudit = readDispatcherAudit(database);
  const dispatcherReconciliationItems = readDispatcherReconciliationItems(database);
  const dispatcherReconciliationSummaries = readDispatcherReconciliationSummaries(database);
  const dispatcherMemberships = readDispatcherMemberships(database);
  const dispatcherMembers = readDispatcherMembers(database);
  const dispatcherMemberDenialRequests = readDispatcherMemberDenialRequests(database);
  const dispatcherMemberDenialDecisions = readDispatcherMemberDenialDecisions(database);
  const dispatcherMemberDenialAudit = readDispatcherMemberDenialAudit(database);
  const dispatcherRunSummaries = readDispatcherRunSummaries(database);
  const projectPolicyReceipts = readProjectPolicyReceipts(database);
  const completionGateRequests = readCompletionGateRequests(database);
  const completionGateAuthorizationDecisions = readCompletionGateAuthorizationDecisions(database);
  const completionGateIntents = readCompletionGateIntents(database);
  const completionGateObservations = readCompletionGateObservations(database);
  const completionGateReceipts = readCompletionGateReceipts(database);
  const completionGateFinalizations = readCompletionGateFinalizations(database);
  const completionGateEvents = readCompletionGateEvents(database);
  const policyGatedCompletionDecisions = readPolicyGatedCompletionDecisions(database);
  const integrationTargetSequences = readIntegrationTargetSequences(database);
  const integrationReservations = readIntegrationReservations(database);
  const integrationOperationRequests = readIntegrationOperationRequests(database);
  const integrationAuthorizationDecisions = readIntegrationAuthorizationDecisions(database);
  const integrationIntents = readIntegrationIntents(database);
  const integrationObservations = readIntegrationObservations(database);
  const integrationReceipts = readIntegrationReceipts(database);
  const integrationFinalizations = readIntegrationFinalizations(database);
  const integrationEvents = readIntegrationEvents(database);
  const workspaceGenerations = readWorkspaceGenerations(database);
  const workspaceAuthorizationDecisions = readWorkspaceAuthorizationDecisions(database);
  const workspaceIntents = readWorkspaceIntents(database);
  const workspaceObservations = readWorkspaceObservations(database);
  const workspaceReceipts = readWorkspaceReceipts(database);
  const workspaceFinalizations = readWorkspaceFinalizations(database);
  const workspaceEvents = readWorkspaceEvents(database);
  const workspaceCleanupAttestations = readWorkspaceCleanupAttestations(database);
  const grantRelations = readGrantRelations(database);
  const domainProjectIds = new Set(domain.projects.map((project) => project.id));
  if (projects.some((project) => !domainProjectIds.has(project.projectId) || project.updatedAt < project.createdAt)) {
    throw persistenceFailure("CORRUPT_ROW", "ProjectRegistry contains a Project absent from the Domain snapshot");
  }
  const requestById = new Map(requests.map((request) => [request.requestId, request]));
  const decisionByRequest = new Map(decisions.map((decision) => [decision.requestId, decision]));
  const decisionIds = new Set(decisions.map((decision) => decision.decisionId));
  const grantIds = new Set(grants.map((grant) => grant.grantId));
  const grantById = new Map(grants.map((grant) => [grant.grantId, grant]));
  if (new Set(grantRelations.map((relation) => relation.grantId)).size !== grantRelations.length) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization grant relation identifiers are not globally unique");
  }
  const grantRelationById = new Map(grantRelations.map((relation) => [relation.grantId, relation]));
  if ((bootstrap === null) !== (grants.length === 0)) {
    throw persistenceFailure("CORRUPT_ROW", "Bootstrap and grant existence do not form one initialized authorization state");
  }
  if (bootstrap !== null) {
    const request = requestById.get(bootstrap.requestId);
    if (
      request === undefined ||
      request.result !== "bootstrap" ||
      request.actorId !== bootstrap.actorId ||
      request.action !== "authorization.grant.issue" ||
      request.targetKind !== "runtime" ||
      request.targetId !== "runtime" ||
      request.targetRevision !== null ||
      request.createdAt !== bootstrap.createdAt ||
      bootstrap.expiresAt <= bootstrap.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Bootstrap request binding is incomplete");
    }
    const fixedActions = BASE_AUTHORIZATION_ACTIONS;
    const fixedRelations = grantRelations.filter((relation) => relation.createdRequestId === bootstrap.requestId);
    if (fixedRelations.length !== fixedActions.length) {
      throw persistenceFailure("CORRUPT_ROW", "Bootstrap does not own one fixed grant for every implemented action");
    }
    for (const fixedAction of fixedActions) {
      const matches = fixedRelations
        .map((relation) => grantById.get(relation.grantId))
        .filter((grant): grant is AuthorizationGrant => grant?.action === fixedAction);
      const grant = matches[0];
      if (
        matches.length !== 1 ||
        grant === undefined ||
        grant.actorId !== bootstrap.actorId ||
        grant.scope.kind !== "runtime" ||
        grant.issuerGrantId !== null ||
        grant.sourceGrantId !== null ||
        grant.notBefore !== bootstrap.createdAt ||
        grant.expiresAt !== bootstrap.expiresAt
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Bootstrap fixed-grant set is incomplete or broadened");
      }
    }
  }
  if (bootstrap === null && (identity !== null || epochs.length !== 0 || lifecycle.length !== 0)) {
    throw persistenceFailure("CORRUPT_ROW", "Authorization identity lineage exists without bootstrap");
  }
  if (identity === null && epochs.length !== 0) {
    throw persistenceFailure("CORRUPT_ROW", "Capability epochs exist without a local identity");
  }
  if (bootstrap !== null) {
    if (
      identity === null ||
      identity.actorId !== bootstrap.actorId ||
      identity.principalSha256 !== bootstrap.trustedPrincipal ||
      identity.platform !== bootstrap.platform ||
      identity.runtimeRootKey !== bootstrap.rootKey ||
      identity.bootstrapRequestId !== bootstrap.requestId ||
      identity.createdAt !== bootstrap.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Version-1 bootstrap does not bind the immutable local identity");
    }
  }
  for (let index = 0; index < epochs.length; index += 1) {
    const epoch = epochs[index];
    const request = epoch === undefined ? undefined : requestById.get(epoch.requestId);
    const previousVocabulary = index === 0 ? 1 : epochs[index - 1]?.vocabularyVersion;
    const isUpgrade = epoch !== undefined && previousVocabulary !== undefined && epoch.vocabularyVersion === previousVocabulary + 1;
    const isRenewal = epoch?.vocabularyVersion === previousVocabulary;
    const expectedActions = epoch === undefined ? null : actionsForVocabulary(epoch.vocabularyVersion);
    const expectedActionSetSha256 = expectedActions === null ? null : sha256(canonicalJson(expectedActions));
    if (
      epoch === undefined ||
      identity === null ||
      epoch.epochRevision !== index + 1 ||
      epoch.actorId !== identity.actorId ||
      epoch.runtimeRootKey !== identity.runtimeRootKey ||
      previousVocabulary === undefined ||
      (!isUpgrade && !isRenewal) ||
      epoch.actionSetSha256 !== expectedActionSetSha256 ||
      epoch.createdAt >= epoch.expiresAt ||
      request === undefined ||
      request.action !== (isUpgrade ? "authorization.capability.upgrade" : "authorization.capability.renew") ||
      request.result !== (isUpgrade ? "upgrade" : "renewal") ||
      request.actorId !== epoch.actorId ||
      request.createdAt !== epoch.createdAt
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Capability epoch lineage is incomplete or non-contiguous");
    }
    const epochRelations = grantRelations.filter((relation) => relation.capabilityEpochId === epoch.epochId);
    const epochActions = actionsForVocabulary(epoch.vocabularyVersion);
    const actionSet = new Set(epochRelations.map((relation) => relation.action));
    if (
      epochRelations.length !== epochActions.length ||
      actionSet.size !== epochActions.length ||
      epochActions.some((expected) => !actionSet.has(expected))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Capability epoch grant action inventory is not exact");
    }
  }
  const bootstrapRequests = requests.filter((request) => request.result === "bootstrap");
  if ((bootstrap === null && bootstrapRequests.length !== 0) || (bootstrap !== null && (bootstrapRequests.length !== 1 || bootstrapRequests[0]?.requestId !== bootstrap.requestId))) {
    throw persistenceFailure("CORRUPT_ROW", "Bootstrap consumption does not have one exact immutable request");
  }
  if (requests.some((request) => !requestTargetIsValid(request))) {
    throw persistenceFailure("CORRUPT_ROW", "Application request target shape does not match its action");
  }
  for (const grant of grants) {
    if (grant.scope.kind === "project") {
      const project = grant.scope.projectId === null
        ? undefined
        : projects.find((candidate) => candidate.projectId === grant.scope.projectId);
      if (
        project === undefined ||
        grant.scope.resourceRevision === null ||
        grant.scope.configRevision === null ||
        grant.scope.resourceRevision > project.resourceRevision ||
        grant.scope.configRevision > project.configRevision
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Project-scoped grant refers to an absent or impossible ProjectRegistry revision");
      }
    }
    if (
      (grant.issuerGrantId === null) !== (grant.sourceGrantId === null) ||
      (grant.issuerGrantId !== null && !grantIds.has(grant.issuerGrantId)) ||
      (grant.sourceGrantId !== null && !grantIds.has(grant.sourceGrantId))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Grant administrative or source relation is incomplete");
    }
    if ((grant.revokedAt === null && grant.revision !== 1) || (grant.revokedAt !== null && grant.revision !== 2)) {
      throw persistenceFailure("CORRUPT_ROW", "Grant revision is inconsistent with its irreversible revocation state");
    }
  }
  if (grantRelations.length !== grants.length) {
    throw persistenceFailure("CORRUPT_ROW", "Grant request relation inventory is incomplete");
  }
  for (const relation of grantRelations) {
    const grant = grantById.get(relation.grantId);
    const createdRequest = requestById.get(relation.createdRequestId);
    const createdDecision = decisionByRequest.get(relation.createdRequestId);
    const capabilityEpoch = relation.capabilityEpochId === null
      ? undefined
      : epochs.find((epoch) => epoch.epochId === relation.capabilityEpochId);
    const revokedRequestId = relation.revokedRequestId;
    const revokedRequest = revokedRequestId === null ? null : requestById.get(revokedRequestId);
    if (
      grant === undefined ||
      relation.action !== grant.action ||
      createdRequest === undefined ||
      (
        createdRequest.result !== "bootstrap" &&
        createdRequest.result !== "allow" &&
        createdRequest.result !== "renewal" &&
        createdRequest.result !== "upgrade"
      ) ||
      (grant.revokedAt === null) !== (revokedRequestId === null) ||
      (createdRequest.result === "bootstrap" && (
        bootstrap === null ||
        createdRequest.requestId !== bootstrap.requestId ||
        relation.capabilityEpochId !== null
      )) ||
      (createdRequest.result === "allow" && (
        createdRequest.action !== "authorization.grant.issue" ||
        createdRequest.targetKind !== "grant" ||
        createdRequest.targetId !== grant.grantId ||
        createdRequest.targetRevision !== null ||
        relation.capabilityEpochId !== null ||
        grant.issuerGrantId === null ||
        grant.sourceGrantId === null ||
        grant.notBefore < createdRequest.createdAt ||
        createdDecision?.grantId !== grant.issuerGrantId ||
        !issuedGrantMatchesDecision(grant, createdDecision)
      )) ||
      ((createdRequest.result === "renewal" || createdRequest.result === "upgrade") && (
        createdRequest.action !== (createdRequest.result === "upgrade"
          ? "authorization.capability.upgrade"
          : "authorization.capability.renew") ||
        capabilityEpoch === undefined ||
        capabilityEpoch.requestId !== createdRequest.requestId ||
        grant.actorId !== capabilityEpoch.actorId ||
        grant.scope.kind !== "runtime" ||
        grant.issuerGrantId !== null ||
        grant.sourceGrantId !== null ||
        grant.notBefore !== capabilityEpoch.createdAt ||
        grant.expiresAt !== capabilityEpoch.expiresAt
      )) ||
      (revokedRequestId !== null && (
        revokedRequest?.result !== "allow" ||
        revokedRequest.action !== "authorization.grant.revoke" ||
        revokedRequest.targetKind !== "grant" ||
        revokedRequest.targetId !== grant.grantId ||
        revokedRequest.targetRevision !== grant.revision - 1 ||
        revokedRequest.createdAt !== grant.revokedAt
      ))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Grant creation or revocation request binding is incomplete");
    }
  }
  for (const grant of grants) {
    if (grant.issuerGrantId === null || grant.sourceGrantId === null) continue;
    const relation = grantRelationById.get(grant.grantId);
    const createdRequest = relation === undefined ? undefined : requestById.get(relation.createdRequestId);
    const administrative = grantById.get(grant.issuerGrantId);
    const source = grantById.get(grant.sourceGrantId);
    if (
      createdRequest === undefined ||
      administrative === undefined ||
      source === undefined ||
      !grantWasUsableAt(administrative, createdRequest.actorId, "authorization.grant.issue", createdRequest.createdAt) ||
      !grantWasUsableAt(source, createdRequest.actorId, grant.action, createdRequest.createdAt) ||
      grant.notBefore < createdRequest.createdAt ||
      grant.expiresAt > administrative.expiresAt ||
      grant.expiresAt > source.expiresAt ||
      !scopeContains(administrative.scope, grant.scope) ||
      !scopeContains(source.scope, grant.scope)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Delegated grant does not preserve exact administrative and source authority");
    }
  }
  const provenance = new Map<string, boolean>();
  const reachesBootstrap = (grantId: string, visiting: ReadonlySet<string>): boolean => {
    const known = provenance.get(grantId);
    if (known !== undefined) return known;
    if (visiting.has(grantId)) return false;
    const grant = grantById.get(grantId);
    const relation = grantRelationById.get(grantId);
    if (grant === undefined || relation === undefined) return false;
    if (grant.issuerGrantId === null || grant.sourceGrantId === null) {
      const epoch = relation.capabilityEpochId === null
        ? undefined
        : epochs.find((candidate) => candidate.epochId === relation.capabilityEpochId);
      const rooted = grant.issuerGrantId === null && grant.sourceGrantId === null && (
        (bootstrap !== null && relation.createdRequestId === bootstrap.requestId && relation.capabilityEpochId === null) ||
        (epoch !== undefined && epoch.requestId === relation.createdRequestId)
      );
      provenance.set(grantId, rooted);
      return rooted;
    }
    const next = new Set(visiting);
    next.add(grantId);
    const rooted = reachesBootstrap(grant.issuerGrantId, next) && reachesBootstrap(grant.sourceGrantId, next);
    provenance.set(grantId, rooted);
    return rooted;
  };
  if (grants.some((grant) => !reachesBootstrap(grant.grantId, new Set()))) {
    throw persistenceFailure("CORRUPT_ROW", "Grant provenance does not terminate at the immutable bootstrap grant set");
  }
  for (const request of requests) {
    const createdCount = grantRelations.filter((relation) => relation.createdRequestId === request.requestId).length;
    const revokedCount = grantRelations.filter((relation) => relation.revokedRequestId === request.requestId).length;
    const expectedCreatedCount = request.result === "bootstrap"
      ? BASE_AUTHORIZATION_ACTIONS.length
      : request.result === "renewal" || request.result === "upgrade"
        ? (() => {
            const epoch = epochs.find((candidate) => candidate.requestId === request.requestId);
            return epoch === undefined ? -1 : actionsForVocabulary(epoch.vocabularyVersion).length;
          })()
      : request.result === "allow" && request.action === "authorization.grant.issue"
        ? 1
        : 0;
    const expectedRevokedCount = request.result === "allow" && request.action === "authorization.grant.revoke" ? 1 : 0;
    if (createdCount !== expectedCreatedCount || revokedCount !== expectedRevokedCount) {
      throw persistenceFailure("CORRUPT_ROW", "Grant transition and accepted request are not an exact operation pair");
    }
  }
  for (const decision of decisions) {
    const request = requestById.get(decision.requestId);
    const renewal = request?.action === "authorization.capability.renew" && request.result === "renewal";
    const upgrade = request?.action === "authorization.capability.upgrade" && request.result === "upgrade";
    const capabilityTransition = renewal || upgrade;
    if (
      request === undefined ||
      (!capabilityTransition && request.result !== decision.result) ||
      (capabilityTransition && (decision.result !== "allow" || decision.reason !== "allowed" ||
        decision.policy !== "allow" || decision.grantId !== null ||
        decision.grantRevision !== null || decision.projectId !== null || decision.resourceRevision !== null)) ||
      request.actorId !== decision.actorId ||
      request.action !== decision.action ||
      request.createdAt !== decision.createdAt ||
      !decisionPolicyIsValid(decision) ||
      !decisionTargetIsValid(request, decision) ||
      (decision.result === "allow") !== (decision.reason === "allowed") ||
      (decision.result === "allow" && decision.grantId === null && !capabilityTransition) ||
      (decision.grantId === null) !== (decision.grantRevision === null) ||
      (decision.projectId === null) !== (decision.resourceRevision === null)
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Authorization decision does not exactly bind its request and resources");
    }
    if (
      (decision.reason === "policy_denied" && (decision.result !== "deny" || decision.policy !== "deny" || decision.grantId === null)) ||
      (decision.reason === "confirmation_required" && (
        decision.result !== "deny" ||
        decision.policy === "deny" ||
        decision.grantId === null ||
        (
          decision.action !== "authorization.capability.renew" &&
          decision.action !== "authorization.capability.upgrade" &&
          !isHighRiskAction(decision.action)
        )
      )) ||
      (
        decision.reason !== "allowed" &&
        decision.reason !== "policy_denied" &&
        decision.reason !== "confirmation_required" &&
        !(decision.reason === "scope_mismatch" && (decision.action === "authorization.grant.issue" || decision.action === "task.cancel")) &&
        decision.grantId !== null
      ) ||
      (decision.reason === "allowed" && decision.policy === "deny")
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Authorization decision reason, result, policy, and grant shape are inconsistent");
    }
    if (decision.grantId !== null) {
      const grant = grantById.get(decision.grantId);
      if (
        grant === undefined ||
        decision.grantRevision !== 1 ||
        grant.actorId !== decision.actorId ||
        grant.action !== decision.action ||
        grant.notBefore > decision.createdAt ||
        grant.expiresAt <= decision.createdAt ||
        (grant.revokedAt !== null && grant.revokedAt < decision.createdAt) ||
        (grant.scope.kind === "project" && (
          decision.projectId !== grant.scope.projectId ||
          decision.resourceRevision !== grant.scope.resourceRevision
        ))
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Authorization decision refers to an absent or impossible grant revision");
      }
    }
    if (decision.projectId !== null) {
      const project = projects.find((candidate) => candidate.projectId === decision.projectId);
      if (project === undefined || decision.resourceRevision === null || decision.resourceRevision > project.resourceRevision) {
        throw persistenceFailure("CORRUPT_ROW", "Authorization decision refers to an absent or impossible ProjectRegistry revision");
      }
    }
  }
  for (const request of requests) {
    const decision = decisionByRequest.get(request.requestId);
    if ((request.result === "bootstrap") !== (decision === undefined)) {
      throw persistenceFailure("CORRUPT_ROW", "Request consumption and decision relation is incomplete");
    }
  }
  const auditRequests = new Set<string>();
  for (const decoded of decodedAudit) {
    const event = decoded.record;
    const details = decoded.details;
    const request = requestById.get(event.requestId);
    const decision = decisionByRequest.get(event.requestId);
    const expectedEventKind = request?.result === "bootstrap"
      ? "bootstrap"
      : request?.result === "deny"
        ? "authorization.denied"
        : request === undefined
          ? null
          : request.action === "authorization.capability.renew"
            ? "capability.renewed"
            : request.action === "authorization.capability.upgrade"
              ? "capability.upgraded"
              : applicationAuditKind(request.action);
    const expectedReason = request?.result === "bootstrap"
      ? "bootstrap"
      : request?.result === "deny"
        ? decision?.reason ?? null
        : "accepted";
    if (
      request === undefined ||
      request.actorId !== event.actorId ||
      request.correlationId !== event.correlationId ||
      request.targetKind !== event.targetKind ||
      request.targetId !== event.targetId ||
      request.targetRevision !== event.targetRevision ||
      request.createdAt !== event.createdAt ||
      (event.eventKind === "bootstrap") !== (event.decisionId === null) ||
      (event.result === "denied") !== (request.result === "deny") ||
      event.eventKind !== expectedEventKind ||
      event.reason !== expectedReason ||
      details.action !== request.action ||
      details.reason !== event.reason ||
      details.targetKind !== event.targetKind ||
      details.targetRevision !== event.targetRevision ||
      (event.decisionId !== null && (
        decision === undefined ||
        decision.decisionId !== event.decisionId ||
        decision.createdAt !== event.createdAt
      ))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Audit event does not bind its consumed request");
    }
    if (event.decisionId !== null && !decisionIds.has(event.decisionId)) {
      throw persistenceFailure("CORRUPT_ROW", "Audit event refers to an absent decision");
    }
    auditRequests.add(event.requestId);
  }
  if (auditRequests.size !== requests.length || requests.some((request) => !auditRequests.has(request.requestId))) {
    throw persistenceFailure("CORRUPT_ROW", "Every consumed request must have exactly one audit event");
  }
  const taskById = new Map(domain.tasks.map((task) => [task.id, task]));
  const executionById = new Map(executions.map((execution) => [execution.executionId, execution]));
  const sequenceByTask = new Map(executionSequences.map((sequence) => [sequence.taskId, sequence]));
  const terminalByExecution = new Map(executionTerminalStates.map((terminal) => [terminal.executionId, terminal]));
  if (executionById.size !== executions.length || sequenceByTask.size !== executionSequences.length) {
    throw persistenceFailure("CORRUPT_ROW", "Execution identity inventory is not unique");
  }
  for (const sequence of executionSequences) {
    const task = taskById.get(sequence.taskId);
    const attempts = executions.filter((execution) => execution.taskId === sequence.taskId);
    const active = attempts.filter((execution) => execution.status === "active");
    const terminal = active[0] === undefined ? undefined : terminalByExecution.get(active[0].executionId);
    const taskStateMatchesExecution = task?.state === "running" || task?.state === "waiting"
      ? terminal === undefined
      : (task?.state === "completed" && terminal?.status === "completed") ||
        (task?.state === "cancelled" && terminal?.status === "cancelled");
    if (
      task === undefined ||
      !taskStateMatchesExecution ||
      attempts.length !== sequence.lastAttemptNumber ||
      sequence.revision !== sequence.lastAttemptNumber ||
      active.length !== 1 ||
      active[0]?.attemptNumber !== sequence.lastAttemptNumber ||
      active[0]?.fencingToken !== sequence.currentFencingToken
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Task execution sequence is incomplete or has no unique active attempt");
    }
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      const previous = index === 0 ? undefined : attempts[index - 1];
      const next = attempts[index + 1];
      const request = attempt === undefined ? undefined : requestById.get(attempt.requestId);
      const decision = attempt === undefined ? undefined : decisionByRequest.get(attempt.requestId);
      const project = attempt === undefined
        ? undefined
        : projects.find((candidate) => candidate.projectId === task.projectId);
      if (
        attempt === undefined ||
        attempt.attemptNumber !== index + 1 ||
        attempt.fencingToken !== index + 1 ||
        attempt.revision < 1 ||
        attempt.leaseRevision < 1 ||
        attempt.requestedLeaseSeconds < 30 || attempt.requestedLeaseSeconds > 3600 ||
        attempt.updatedAt < attempt.createdAt ||
        (attempt.leaseRevision === 1 && attempt.leaseExpiresAt !== new Date(
          new Date(attempt.createdAt).valueOf() + attempt.requestedLeaseSeconds * 1000,
        ).toISOString()) ||
        (attempt.status === "active" && attempt.leaseExpiresAt <= attempt.updatedAt) ||
        attempt.expectedTaskRevision !== attempt.preTaskRevision ||
        task.revision < attempt.postTaskRevision ||
        project === undefined ||
        attempt.projectResourceRevision > project.resourceRevision ||
        attempt.projectConfigRevision > project.configRevision ||
        request === undefined ||
        request.requestId !== attempt.requestId ||
        request.action !== (attempt.operationKind === "claim" ? "execution.claim" : "execution.lease.takeover") ||
        request.result !== "allow" ||
        request.targetKind !== "execution" ||
        request.targetId !== attempt.executionId ||
        request.targetRevision !== 1 ||
        request.createdAt !== attempt.createdAt ||
        decision === undefined ||
        decision.decisionId !== attempt.decisionId ||
        decision.requestId !== attempt.requestId ||
        decision.projectId !== task.projectId ||
        decision.resourceRevision !== attempt.projectResourceRevision ||
        (attempt.operationKind === "claim" && (
          index !== 0 ||
          attempt.postTaskRevision !== attempt.preTaskRevision + 1 ||
          attempt.supersedesExecutionId !== null ||
          attempt.predecessorExecutionRevision !== null ||
          attempt.predecessorLeaseRevision !== null ||
          attempt.predecessorFencingToken !== null
        )) ||
        (attempt.operationKind === "takeover" && (
          index === 0 ||
          attempt.postTaskRevision !== attempt.preTaskRevision ||
          attempt.supersedesExecutionId !== previous?.executionId ||
          attempt.predecessorExecutionRevision !== (previous?.revision ?? 0) - 1 ||
          attempt.predecessorLeaseRevision !== previous?.leaseRevision ||
          attempt.predecessorFencingToken !== previous?.fencingToken
        )) ||
        (attempt.status === "active" && (
          next !== undefined ||
          attempt.supersededByExecutionId !== null
        )) ||
        (attempt.status === "superseded" && (
          next === undefined ||
          attempt.supersededByExecutionId !== next.executionId
        ))
      ) {
        throw persistenceFailure("CORRUPT_ROW", "Execution attempt lineage or authorization binding is inconsistent");
      }
    }
  }
  if (executions.some((execution) => !sequenceByTask.has(execution.taskId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution attempt exists without its Task sequence");
  }
  for (const request of requests) {
    if (!request.action.startsWith("execution.") || request.result !== "allow") continue;
    const execution = executionById.get(request.targetId);
    if (execution === undefined || request.targetRevision === null || request.targetRevision > execution.revision) {
      throw persistenceFailure("CORRUPT_ROW", "Accepted execution request refers to an absent or stale execution revision");
    }
  }
  const executionRequestById = new Map(executionOperationRequests.map((request) => [request.requestId, request]));
  const executionDecisionById = new Map(executionAuthorizationDecisions.map((decision) => [decision.decisionId, decision]));
  const executionDecisionByRequest = new Map(executionAuthorizationDecisions.map((decision) => [decision.requestId, decision]));
  const intentById = new Map(executionIntents.map((intent) => [intent.intentId, intent]));
  const authorizationBindingByDecision = new Map(
    executionIntentAuthorizationBindings.map((binding) => [binding.decisionId, binding]),
  );
  const receiptById = new Map(executionReceipts.map((receipt) => [receipt.verifiedReceiptId, receipt]));
  const finalizationById = new Map(executionFinalizations.map((finalization) => [finalization.finalizationId, finalization]));
  const manualTurnByBackendId = new Map(manualTurns.map((turn) => [turn.backendExecutionId, turn]));
  if (
    executionRequestById.size !== executionOperationRequests.length ||
    executionDecisionById.size !== executionAuthorizationDecisions.length ||
    executionDecisionByRequest.size !== executionAuthorizationDecisions.length ||
    intentById.size !== executionIntents.length ||
    authorizationBindingByDecision.size !== executionIntentAuthorizationBindings.length ||
    receiptById.size !== executionReceipts.length ||
    finalizationById.size !== executionFinalizations.length || manualTurnByBackendId.size !== manualTurns.length
  ) throw persistenceFailure("CORRUPT_ROW", "Phase 2 execution identity inventory is not unique");
  for (const request of executionOperationRequests) {
    const execution = executionById.get(request.targetExecutionId);
    const decision = executionDecisionByRequest.get(request.requestId);
    const requestAudit = executionOperationAudit.filter((event) => event.requestId === request.requestId);
    if (
      execution === undefined || request.targetRevision > execution.revision || decision === undefined ||
      decision.actorId !== request.actorId || decision.action !== request.action || decision.result !== request.result ||
      decision.requestId !== request.requestId || decision.createdAt !== request.createdAt ||
      requestAudit.length === 0 || requestAudit.some((event) =>
        event.decisionId !== decision.decisionId || event.actorId !== request.actorId ||
        event.correlationId !== request.correlationId || event.executionId !== request.targetExecutionId ||
        event.executionRevision < request.targetRevision || event.executionRevision > execution.revision ||
        event.createdAt < request.createdAt || (event.result === "accepted") !== (request.result === "allow")
      ) ||
      (request.result === "allow" && (
        decision.reason !== "allowed" || decision.grantId === null || decision.grantRevision !== 1
      )) ||
      (request.result === "deny" && decision.reason === "allowed")
    ) throw persistenceFailure("CORRUPT_ROW", "Execution request, decision, audit, and target binding is inconsistent");
    const project = projects.find((candidate) => candidate.projectId === decision.projectId);
    if (project === undefined || decision.resourceRevision > project.resourceRevision ||
      decision.configRevision > project.configRevision) {
      throw persistenceFailure("CORRUPT_ROW", "Execution decision Project binding is impossible");
    }
    if (decision.grantId !== null) {
      const grant = grantById.get(decision.grantId);
      if (
        grant === undefined || grant.actorId !== decision.actorId || grant.action !== decision.action ||
        grant.notBefore > decision.createdAt || grant.expiresAt <= decision.createdAt ||
        (grant.revokedAt !== null && grant.revokedAt <= decision.createdAt) ||
        (grant.scope.kind === "project" && (
          grant.scope.projectId !== decision.projectId || grant.scope.resourceRevision !== decision.resourceRevision ||
          grant.scope.configRevision !== decision.configRevision
        ))
      ) throw persistenceFailure("CORRUPT_ROW", "Execution decision grant binding is impossible");
    }
  }
  if (executionAuthorizationDecisions.some((decision) => !executionRequestById.has(decision.requestId)) ||
      executionOperationAudit.some((event) => !executionRequestById.has(event.requestId) || !executionDecisionById.has(event.decisionId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution decision or audit is orphaned");
  }
  const operationIds = new Set<string>();
  const operationIdempotency = new Set<string>();
  for (const intent of executionIntents) {
    const request = executionRequestById.get(intent.requestId);
    const decision = executionDecisionById.get(intent.decisionId);
    const execution = executionById.get(intent.executionId);
    const task = taskById.get(intent.taskId);
    const project = projects.find((candidate) => candidate.projectId === intent.projectId);
    const sourceExecution = intent.sourceExecutionId === null ? undefined : executionById.get(intent.sourceExecutionId);
    const hasSuccessorSource = intent.sourceExecutionId !== null;
    if (
      operationIds.has(intent.operationId) || operationIdempotency.has(intent.idempotencyKey) ||
      request === undefined || request.result !== "allow" || request.actorId !== intent.actorId ||
      request.action !== intent.action || request.targetExecutionId !== intent.executionId ||
      request.targetRevision !== intent.executionRevision || decision === undefined || decision.requestId !== intent.requestId ||
      decision.result !== "allow" || decision.action !== intent.action || decision.actorId !== intent.actorId ||
      execution === undefined || execution.taskId !== intent.taskId || execution.revision < intent.executionRevision ||
      execution.attemptNumber !== intent.attemptNumber || execution.fencingToken !== intent.fencingToken ||
      task === undefined || task.revision < intent.taskRevision || task.projectId !== intent.projectId ||
      project === undefined || project.resourceRevision < intent.projectResourceRevision ||
      project.configRevision < intent.projectConfigRevision || intent.updatedAt < intent.createdAt ||
      intent.requestedDeadline <= intent.createdAt ||
      (intent.operationKind === "retry" && !hasSuccessorSource) ||
      (hasSuccessorSource && (
        (intent.operationKind !== "resume" && intent.operationKind !== "retry") || sourceExecution === undefined ||
        intent.sourceExecutionRevision !== sourceExecution.revision - 1 ||
        intent.sourceAttemptNumber !== sourceExecution.attemptNumber ||
        intent.sourceFencingToken !== sourceExecution.fencingToken ||
        intent.sourceObservationNumber === null ||
        sourceExecution.status !== "superseded" || execution.supersedesExecutionId !== sourceExecution.executionId ||
        execution.attemptNumber !== sourceExecution.attemptNumber + 1 ||
        execution.fencingToken !== sourceExecution.fencingToken + 1
      )) ||
      (!hasSuccessorSource && (intent.sourceExecutionRevision !== null || intent.sourceAttemptNumber !== null ||
        intent.sourceFencingToken !== null || intent.sourceObservationNumber !== null))
    ) throw persistenceFailure("CORRUPT_ROW", "Execution intent semantic, authorization, or revision binding is inconsistent");
    operationIds.add(intent.operationId);
    operationIdempotency.add(intent.idempotencyKey);
    const bindings = executionIntentAuthorizationBindings
      .filter((candidate) => candidate.intentId === intent.intentId)
      .sort((left, right) => left.bindingRevision - right.bindingRevision);
    const currentBinding = bindings.at(-1);
    if (
      bindings.length === 0 || currentBinding === undefined ||
      currentBinding.bindingRevision !== intent.authorizationBindingRevision ||
      currentBinding.decisionId !== intent.currentAuthorizationDecisionId ||
      bindings.some((binding, index) => {
        const boundRequest = executionRequestById.get(binding.requestId);
        const boundDecision = executionDecisionById.get(binding.decisionId);
        const boundAudit = executionOperationAudit.find((event) => event.auditId === binding.auditId);
        const previous = index === 0 ? undefined : bindings[index - 1];
        const expectedPhase = index === 0 ? "prepare" : binding.phase;
        return binding.bindingRevision !== index + 1 || binding.phase !== expectedPhase ||
          (index === 0 && (binding.phase !== "prepare" || binding.priorDecisionId !== null ||
            binding.requestId !== intent.requestId || binding.decisionId !== intent.decisionId)) ||
          (index > 0 && binding.priorDecisionId !== previous?.decisionId) ||
          boundRequest?.result !== "allow" || boundRequest.action !== intent.action ||
          boundRequest.actorId !== intent.actorId || boundRequest.targetExecutionId !== intent.executionId ||
          boundRequest.targetRevision !== intent.executionRevision || boundDecision?.result !== "allow" ||
          boundDecision.requestId !== binding.requestId || boundDecision.action !== intent.action ||
          boundDecision.actorId !== intent.actorId || boundDecision.projectId !== intent.projectId ||
          boundDecision.resourceRevision !== intent.projectResourceRevision ||
          boundDecision.configRevision !== intent.projectConfigRevision ||
          boundAudit?.requestId !== binding.requestId || boundAudit.decisionId !== binding.decisionId ||
          boundAudit.result !== "accepted" || boundAudit.actorId !== intent.actorId ||
          boundAudit.executionId !== intent.executionId || boundAudit.executionRevision < intent.executionRevision ||
          boundAudit.createdAt !== binding.createdAt || boundDecision.createdAt !== binding.createdAt ||
          boundRequest.createdAt !== binding.createdAt;
      }) ||
      (intent.state === "pending" && currentBinding.phase !== "prepare") ||
      (intent.state !== "pending" && intent.state !== "executing" && intent.state !== "finalized" &&
        currentBinding.phase !== "act") ||
      (intent.state === "finalized" && currentBinding.phase !== "finalize")
    ) throw persistenceFailure("CORRUPT_ROW", "Execution intent authorization binding chain is inconsistent");
    const observations = executionObservations
      .filter((observation) => observation.intentId === intent.intentId)
      .sort((left, right) => left.observationNumber - right.observationNumber);
    if (observations.some((observation, index) => index > 0 && observation.observationNumber <= (observations[index - 1]?.observationNumber ?? 0))) {
      throw persistenceFailure("CORRUPT_ROW", "Execution observations are not strictly ordered");
    }
    const receipt = executionReceipts.find((candidate) => candidate.intentId === intent.intentId);
    const finalization = executionFinalizations.find((candidate) => candidate.intentId === intent.intentId);
    if (
      (intent.state === "pending" || intent.state === "executing" || intent.state === "retry_wait" || intent.state === "ambiguous" || intent.state === "failed") &&
        (observations.length !== 0 || receipt !== undefined || finalization !== undefined) ||
      intent.state === "observed" && (observations.length === 0 || receipt !== undefined || finalization !== undefined) ||
      intent.state === "verified" && (observations.length === 0 || receipt === undefined || finalization !== undefined) ||
      intent.state === "finalized" && finalization === undefined
    ) throw persistenceFailure("CORRUPT_ROW", "Execution intent state is inconsistent with durable evidence stages");
    if (receipt !== undefined) {
      const observation = observations.find((candidate) => candidate.adapterReceiptId === receipt.adapterReceiptId);
      if (
        observation === undefined || receipt.receiptSha256 !== observation.receiptSha256 ||
        receipt.lifecycle !== observation.lifecycle || receipt.backendExecutionId !== observation.backendExecutionId ||
        receipt.threadId !== observation.threadId || receipt.observationNumber !== observation.observationNumber ||
        receipt.observedRevision !== observation.journalRevision || receipt.fencingToken !== intent.fencingToken
      ) throw persistenceFailure("CORRUPT_ROW", "Verified execution receipt does not reproduce its observation");
    }
    if (finalization !== undefined && (
      finalization.verifiedReceiptId !== (receipt?.verifiedReceiptId ?? null) ||
      finalization.authorizationDecisionId !== currentBinding.decisionId || currentBinding.phase !== "finalize" ||
      finalization.executionRevision < intent.executionRevision || finalization.taskRevision < intent.taskRevision ||
      finalization.finalizedAt < intent.updatedAt
    )) throw persistenceFailure("CORRUPT_ROW", "Execution finalization is inconsistent with its intent and receipt");
  }
  if (executionIntentAuthorizationBindings.some((binding) => !intentById.has(binding.intentId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution intent authorization binding is orphaned");
  }
  for (const observation of executionObservations) {
    const intent = intentById.get(observation.intentId);
    const decision = executionDecisionById.get(observation.authorizationDecisionId);
    const request = decision === undefined ? undefined : executionRequestById.get(decision.requestId);
    if (
      intent === undefined || decision?.result !== "allow" || decision.action !== "execution.inspect" ||
      request?.result !== "allow" || request.action !== "execution.inspect" ||
      request.targetExecutionId !== intent.executionId || request.targetRevision !== intent.executionRevision ||
      observation.observedAt < intent.createdAt
    ) throw persistenceFailure("CORRUPT_ROW", "Execution observation lacks an exact independent inspect allow");
  }
  if (executionReceipts.some((receipt) => !intentById.has(receipt.intentId)) ||
      executionFinalizations.some((finalization) => !intentById.has(finalization.intentId))) {
    throw persistenceFailure("CORRUPT_ROW", "Execution receipt or finalization is orphaned");
  }
  for (const turn of manualTurns) {
    const execution = executionById.get(turn.executionId);
    const task = taskById.get(turn.taskId);
    const project = projects.find((candidate) => candidate.projectId === turn.projectId);
    const predecessorTurn = turn.predecessorBackendExecutionId === null
      ? undefined : manualTurnByBackendId.get(turn.predecessorBackendExecutionId);
    if (
      execution === undefined || execution.taskId !== turn.taskId || execution.revision < turn.executionRevision ||
      execution.attemptNumber !== turn.attemptNumber || execution.fencingToken !== turn.fencingToken ||
      task === undefined || task.revision < turn.taskRevision || task.projectId !== turn.projectId ||
      project === undefined || project.resourceRevision < turn.projectResourceRevision ||
      project.configRevision < turn.projectConfigRevision || turn.updatedAt < turn.createdAt ||
      (turn.cancellationRequestRevision === null) !== (turn.cancellationRequestedAt === null) ||
      (turn.predecessorBackendExecutionId === null) !== (turn.predecessorThreadId === null) ||
      (turn.predecessorBackendExecutionId !== null && (
        predecessorTurn === undefined || predecessorTurn.threadId !== turn.predecessorThreadId ||
        execution.supersedesExecutionId !== predecessorTurn.executionId ||
        execution.attemptNumber !== predecessorTurn.attemptNumber + 1 ||
        execution.fencingToken !== predecessorTurn.fencingToken + 1
      ))
    ) throw persistenceFailure("CORRUPT_ROW", "Manual turn semantic, fence, or revision binding is inconsistent");
  }
  for (const operation of manualBackendOperations) {
    const intent = intentById.get(operation.intentId);
    const effectAuthorization = authorizationBindingByDecision.get(operation.authorizationDecisionId);
    const turn = manualTurnByBackendId.get(operation.backendExecutionId);
    const sourceTurn = operation.sourceBackendExecutionId === null
      ? undefined : manualTurnByBackendId.get(operation.sourceBackendExecutionId);
    const hasSourceTurn = operation.sourceBackendExecutionId !== null;
    const expectedKind = intent?.operationKind;
    if (
      intent === undefined || turn === undefined || operation.threadId !== turn.threadId ||
      effectAuthorization?.intentId !== operation.intentId || effectAuthorization.phase !== "act" ||
      operation.expectedFencingToken !== intent.fencingToken || operation.expectedFencingToken !== turn.fencingToken ||
      operation.operationKind !== expectedKind || operation.idempotencyKey !== intent.idempotencyKey ||
      operation.postRevision > turn.revision || operation.createdAt < effectAuthorization.createdAt ||
      (operation.operationKind === "manual_report") !== (operation.reportOperation !== null) ||
      (operation.sourceBackendExecutionId === null) !== (operation.sourceThreadId === null) ||
      (operation.operationKind === "retry" && !hasSourceTurn) ||
      (hasSourceTurn && (
        (operation.operationKind !== "resume" && operation.operationKind !== "retry") ||
        sourceTurn === undefined || sourceTurn.threadId !== operation.sourceThreadId ||
        turn.predecessorBackendExecutionId !== sourceTurn.backendExecutionId ||
        turn.predecessorThreadId !== sourceTurn.threadId
      ))
    ) throw persistenceFailure("CORRUPT_ROW", "Manual backend operation is not bound to its core intent and turn");
  }
  const manualConfirmationIds = new Set(executionIntents
    .map((intent) => intent.confirmationId)
    .filter((value): value is string => value !== null));
  if (manualConfirmationIds.size !== executionIntents.filter((intent) => intent.confirmationId !== null).length) {
    throw persistenceFailure("CORRUPT_ROW", "Manual outcome confirmation was consumed more than once");
  }
  const completionDecisionById = new Map(completionDecisions.map((completion) => [completion.completionDecisionId, completion]));
  const manualCompletionById = new Map(manualCompletionDecisions.map((completion) => [completion.completionDecisionId, completion]));
  const policyCompletionById = new Map(policyGatedCompletionDecisions.map((completion) => [completion.completionDecisionId, completion]));
  if (completionDecisionById.size !== completionDecisions.length ||
      manualCompletionById.size !== manualCompletionDecisions.length ||
      policyCompletionById.size !== policyGatedCompletionDecisions.length) {
    throw persistenceFailure("CORRUPT_ROW", "Completion decision identity inventory is not unique");
  }
  for (const parent of completionDecisions) {
    const manual = manualCompletionById.get(parent.completionDecisionId);
    const policyGated = policyCompletionById.get(parent.completionDecisionId);
    const execution = executionById.get(parent.executionId);
    const task = taskById.get(parent.taskId);
    const terminal = terminalByExecution.get(parent.executionId);
    if ((parent.kind === "manual") !== (manual !== undefined) ||
        (parent.kind === "policy_gated") !== (policyGated !== undefined) ||
        (manual !== undefined && policyGated !== undefined) || execution === undefined || task === undefined ||
        execution.taskId !== parent.taskId || execution.attemptNumber !== parent.attemptNumber ||
        execution.fencingToken !== parent.fencingToken || execution.revision !== parent.executionRevision ||
        parent.postTaskRevision !== parent.preTaskRevision + 1 || task.state !== "completed" ||
        task.revision !== parent.postTaskRevision || task.completion?.decisionId !== parent.completionDecisionId ||
        terminal?.status !== "completed" || terminal.completionDecisionId !== parent.completionDecisionId ||
        terminal.preTaskRevision !== parent.preTaskRevision || terminal.postTaskRevision !== parent.postTaskRevision ||
        terminal.executionRevision !== parent.executionRevision
    ) throw persistenceFailure("CORRUPT_ROW", "Generic completion decision lineage is incomplete or inconsistent");
  }
  if (manualCompletionDecisions.some((child) => !completionDecisionById.has(child.completionDecisionId)) ||
      policyGatedCompletionDecisions.some((child) => !completionDecisionById.has(child.completionDecisionId))) {
    throw persistenceFailure("CORRUPT_ROW", "Completion subtype has no generic parent");
  }
  for (const completion of manualCompletionDecisions) {
    const parent = completionDecisionById.get(completion.completionDecisionId);
    const request = executionRequestById.get(completion.requestId);
    const decision = executionDecisionById.get(completion.decisionId);
    const event = executionOperationAudit.find((candidate) => candidate.auditId === completion.auditId);
    const receipt = receiptById.get(completion.verifiedReceiptId);
    const finalization = finalizationById.get(completion.finalizationId);
    const intent = finalization === undefined ? undefined : intentById.get(finalization.intentId);
    const task = taskById.get(completion.taskId);
    const terminal = terminalByExecution.get(completion.executionId);
    if (
      parent?.kind !== "manual" || parent.taskId !== completion.taskId || parent.executionId !== completion.executionId ||
      parent.attemptNumber !== completion.attemptNumber || parent.fencingToken !== completion.fencingToken ||
      parent.preTaskRevision !== completion.preTaskRevision || parent.postTaskRevision !== completion.postTaskRevision ||
      request?.action !== "execution.completion.accept" || request.result !== "allow" ||
      decision?.requestId !== completion.requestId || decision.action !== "execution.completion.accept" || decision.result !== "allow" ||
      event?.requestId !== completion.requestId || event.decisionId !== completion.decisionId ||
      event.eventKind !== "execution.completion.accepted" || receipt === undefined || finalization === undefined ||
      finalization.verifiedReceiptId !== receipt.verifiedReceiptId || intent === undefined ||
      intent.executionId !== completion.executionId || intent.taskId !== completion.taskId ||
      intent.attemptNumber !== completion.attemptNumber || intent.fencingToken !== completion.fencingToken ||
      task?.state !== "completed" || task.revision !== completion.postTaskRevision ||
      task.completion?.decisionId !== completion.completionDecisionId ||
      terminal?.status !== "completed" || terminal.completionDecisionId !== completion.completionDecisionId ||
      manualConfirmationIds.has(completion.confirmationId)
    ) throw persistenceFailure("CORRUPT_ROW", "Manual completion decision lineage is inconsistent");
  }
  const completionConfirmationIds = new Set(manualCompletionDecisions.map((completion) => completion.confirmationId));
  if (completionConfirmationIds.size !== manualCompletionDecisions.length) {
    throw persistenceFailure("CORRUPT_ROW", "Manual completion confirmation was consumed more than once");
  }
  for (const terminal of executionTerminalStates) {
    const execution = executionById.get(terminal.executionId);
    const receipt = receiptById.get(terminal.verifiedReceiptId);
    const finalization = finalizationById.get(terminal.finalizationId);
    const intent = finalization === undefined ? undefined : intentById.get(finalization.intentId);
    const task = execution === undefined ? undefined : taskById.get(execution.taskId);
    if (
      execution === undefined || receipt === undefined || finalization === undefined || intent === undefined ||
      intent.executionId !== terminal.executionId || receipt.intentId !== intent.intentId ||
      execution.attemptNumber !== terminal.attemptNumber || execution.fencingToken !== terminal.fencingToken ||
      execution.revision !== terminal.executionRevision || task?.revision !== terminal.postTaskRevision ||
      task.state !== terminal.status || terminal.postTaskRevision !== terminal.preTaskRevision + 1 ||
      executionIntents.some((candidate) => candidate.executionId === terminal.executionId && candidate.state !== "finalized")
    ) throw persistenceFailure("CORRUPT_ROW", "Execution terminal state is inconsistent with Task, fence, and verified evidence");
  }
  const dispatcherRequestById = new Map(dispatcherTriggerRequests.map((request) => [request.requestId, request]));
  const dispatcherDecisionById = new Map(dispatcherAuthorizationDecisions.map((decision) => [decision.decisionId, decision]));
  const dispatcherRunById = new Map(dispatcherRuns.map((run) => [run.runId, run]));
  if (
    dispatcherRequestById.size !== dispatcherTriggerRequests.length ||
    dispatcherDecisionById.size !== dispatcherAuthorizationDecisions.length ||
    dispatcherRunById.size !== dispatcherRuns.length
  ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher identity inventory is not unique");
  for (const request of dispatcherTriggerRequests) {
    const run = dispatcherRuns.find((candidate) => candidate.requestId === request.requestId);
    const decision = run === undefined
      ? dispatcherAuthorizationDecisions.find((candidate) =>
        candidate.requestId === request.requestId && candidate.createdAt === request.createdAt &&
        candidate.result === request.result)
      : dispatcherDecisionById.get(run.decisionId);
    const events = dispatcherAudit.filter((event) => event.requestId === request.requestId);
    const takeoverEvents = events.filter((event) =>
      event.eventKind === "dispatch.taken_over" && event.result === "accepted");
    const grant = decision?.grantId === null || decision?.grantId === undefined ? undefined : grantById.get(decision.grantId);
    if (
      decision === undefined || decision.actorId !== request.actorId || decision.action !== request.action ||
      decision.result !== request.result || decision.createdAt !== request.createdAt ||
      (decision.result === "allow" && (
        grant === undefined ||
        !grantRevisionWasUsableAt(grant, request.actorId, "dispatch.run", decision.createdAt, decision.grantRevision) ||
        run === undefined || run.observationId !== request.observationId || run.decisionId !== decision.decisionId ||
        run.actorId !== request.actorId ||
        run.ownerRevision !== takeoverEvents.length + 1 ||
        (run.ownerRevision === 1 && run.ownerId !== request.workerOwnerId) ||
        run.requestedLeaseSeconds !== request.requestedLeaseSeconds || run.createdAt !== request.createdAt ||
        !events.some((event) => event.runId === run.runId && event.eventKind === "dispatch.started" && event.result === "accepted")
      )) ||
      (decision.result === "deny" && (
        decision.grantId !== null || decision.grantRevision !== null || run !== undefined ||
        !events.some((event) => event.runId === null && event.eventKind === "dispatch.denied" && event.result === "denied")
      ))
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher trigger authorization lineage is inconsistent");
  }
  for (const decision of dispatcherAuthorizationDecisions) {
    const request = dispatcherRequestById.get(decision.requestId);
    const grant = decision.grantId === null ? undefined : grantById.get(decision.grantId);
    if (
      request === undefined || decision.actorId !== request.actorId || decision.action !== "dispatch.run" ||
      decision.createdAt < request.createdAt ||
      (decision.result === "allow" && (
        decision.reason !== "allowed" || grant === undefined ||
        !grantRevisionWasUsableAt(grant, decision.actorId, "dispatch.run", decision.createdAt, decision.grantRevision)
      )) ||
      (decision.result === "deny" && (decision.reason === "allowed" || decision.grantId !== null || decision.grantRevision !== null))
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher continuation authorization lineage is inconsistent");
  }
  for (const event of dispatcherAudit) {
    const request = dispatcherRequestById.get(event.requestId);
    const decision = dispatcherDecisionById.get(event.decisionId);
    const run = event.runId === null ? undefined : dispatcherRunById.get(event.runId);
    if (
      request === undefined || decision?.requestId !== event.requestId || event.actorId !== request.actorId ||
      event.correlationId !== request.correlationId || event.createdAt < request.createdAt ||
      (event.runId === null) !== (event.eventKind === "dispatch.denied") ||
      (event.runId !== null && (run === undefined || run.requestId !== request.requestId))
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher audit binding is inconsistent");
  }
  for (const run of dispatcherRuns) {
    const heartbeatMillis = new Date(run.heartbeatAt).valueOf();
    const expectedExpiry = new Date(heartbeatMillis + run.requestedLeaseSeconds * 1000).toISOString();
    const reconciliation = dispatcherReconciliationSummaries.find((summary) => summary.runId === run.runId);
    const membership = dispatcherMemberships.find((candidate) => candidate.runId === run.runId);
    const terminalSummary = dispatcherRunSummaries.find((summary) => summary.runId === run.runId);
    if (
      run.requestedLeaseSeconds < 30 || run.requestedLeaseSeconds > 3600 ||
      run.leaseExpiresAt !== expectedExpiry || run.updatedAt < run.createdAt || run.heartbeatAt > run.updatedAt ||
      (run.status === "starting" && (reconciliation !== undefined || membership !== undefined || terminalSummary !== undefined)) ||
      (run.status === "reconciling" && (membership !== undefined || terminalSummary !== undefined)) ||
      (run.status === "sweeping" && (reconciliation === undefined || membership === undefined || terminalSummary !== undefined)) ||
      (["completed", "partial", "failed", "interrupted"] as readonly string[]).includes(run.status) &&
        (reconciliation === undefined || membership === undefined || terminalSummary?.terminalStatus !== run.status)
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher run lifecycle or lease projection is inconsistent");
  }
  for (const summary of dispatcherReconciliationSummaries) {
    const items = dispatcherReconciliationItems.filter((item) => item.runId === summary.runId);
    const ordinals = items.map((item) => item.ordinal).sort((left, right) => left - right);
    if (
      !dispatcherRunById.has(summary.runId) || items.length !== summary.expectedCount ||
      ordinals.some((ordinal, index) => ordinal !== index) ||
      items.filter((item) => item.disposition === "reconciled").length !== summary.reconciledCount ||
      items.filter((item) => item.disposition === "no_effect").length !== summary.noEffectCount ||
      items.filter((item) => item.disposition === "authorization_denied").length !== summary.authorizationDeniedCount ||
      items.filter((item) => item.disposition === "ambiguous").length !== summary.ambiguousCount ||
      items.filter((item) => item.disposition === "failed").length !== summary.failedCount
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher reconciliation summary is incomplete");
  }
  for (const membership of dispatcherMemberships) {
    const run = dispatcherRunById.get(membership.runId);
    const reconciliation = dispatcherReconciliationSummaries.find((summary) => summary.runId === membership.runId);
    const members = dispatcherMembers.filter((member) => member.runId === membership.runId);
    const ordinals = members.map((member) => member.ordinal).sort((left, right) => left - right);
    if (
      run === undefined || reconciliation === undefined || membership.sealedAt < reconciliation.createdAt ||
      members.length !== membership.expectedMemberCount || new Set(members.map((member) => member.taskId)).size !== members.length ||
      ordinals.some((ordinal, index) => ordinal !== index) ||
      members.some((member) => member.membershipRevision !== membership.membershipRevision)
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher sealed membership is incomplete or mutable");
    for (const member of members) {
      const task = taskById.get(member.taskId);
      const project = projects.find((candidate) => candidate.projectId === member.projectId);
      const execution = member.executionId === null ? undefined : executionById.get(member.executionId);
      const intent = member.intentId === null ? undefined : intentById.get(member.intentId);
      if (
        task === undefined || project === undefined || task.projectId !== member.projectId ||
        task.revision < member.taskRevision || project.resourceRevision < member.projectResourceRevision ||
        project.configRevision < member.projectConfigRevision || member.updatedAt < member.createdAt ||
        (member.lifecycle === "pending" && (member.outcome !== null || member.revision !== 1)) ||
        (member.lifecycle === "terminal" && (member.outcome === null || member.revision !== 2)) ||
        (member.outcome === "claimed" && (
          execution === undefined || intent === undefined || intent.executionId !== execution.executionId ||
          execution.taskId !== member.taskId || intent.taskId !== member.taskId || intent.operationKind !== "start"
        )) ||
        (member.outcome !== "claimed" && (member.executionId !== null || member.intentId !== null))
      ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher member binding is inconsistent");
    }
  }
  const denialRequestById = new Map(dispatcherMemberDenialRequests.map((request) => [request.requestId, request]));
  const denialRequestByMember = new Map(dispatcherMemberDenialRequests.map((request) => [request.memberId, request]));
  const denialDecisionById = new Map(dispatcherMemberDenialDecisions.map((decision) => [decision.decisionId, decision]));
  const denialDecisionByRequest = new Map(dispatcherMemberDenialDecisions.map((decision) => [decision.requestId, decision]));
  const denialAuditByRequest = new Map(dispatcherMemberDenialAudit.map((event) => [event.requestId, event]));
  const denialAuditByDecision = new Map(dispatcherMemberDenialAudit.map((event) => [event.decisionId, event]));
  const denialTargetExecutionIds = new Set(dispatcherMemberDenialRequests.map((request) => request.targetExecutionId));
  if (
    denialRequestById.size !== dispatcherMemberDenialRequests.length ||
    denialRequestByMember.size !== dispatcherMemberDenialRequests.length ||
    denialDecisionById.size !== dispatcherMemberDenialDecisions.length ||
    denialDecisionByRequest.size !== dispatcherMemberDenialDecisions.length ||
    denialAuditByRequest.size !== dispatcherMemberDenialAudit.length ||
    denialAuditByDecision.size !== dispatcherMemberDenialAudit.length ||
    denialTargetExecutionIds.size !== dispatcherMemberDenialRequests.length ||
    dispatcherMemberDenialRequests.length !== dispatcherMemberDenialDecisions.length ||
    dispatcherMemberDenialRequests.length !== dispatcherMemberDenialAudit.length ||
    dispatcherMemberDenialRequests.some((request) =>
      requestById.has(request.requestId) || executionRequestById.has(request.requestId) ||
      dispatcherRequestById.has(request.requestId)) ||
    dispatcherMemberDenialDecisions.some((decision) =>
      decisionIds.has(decision.decisionId) || executionDecisionById.has(decision.decisionId) ||
      dispatcherDecisionById.has(decision.decisionId)) ||
    dispatcherMemberDenialAudit.some((event) =>
      audit.some((candidate) => candidate.auditId === event.auditId) ||
      executionOperationAudit.some((candidate) => candidate.auditId === event.auditId) ||
      dispatcherAudit.some((candidate) => candidate.auditId === event.auditId))
  ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher member denial identity inventory is not unique");
  for (const request of dispatcherMemberDenialRequests) {
    const decision = denialDecisionByRequest.get(request.requestId);
    const event = denialAuditByRequest.get(request.requestId);
    const member = dispatcherMembers.find((candidate) => candidate.memberId === request.memberId);
    const run = dispatcherRunById.get(request.runId);
    const project = projects.find((candidate) => candidate.projectId === member?.projectId);
    const grant = decision?.grantId === null || decision?.grantId === undefined
      ? undefined : grantById.get(decision.grantId);
    const grantBackedReason = decision?.reason === "policy_denied" || decision?.reason === "confirmation_required";
    const grantIsExact = grant !== undefined && decision !== undefined && project !== undefined &&
      grantRevisionWasUsableAt(grant, decision.actorId, "execution.start", decision.createdAt, decision.grantRevision) &&
      (grant.scope.kind === "runtime" || (
        grant.scope.projectId === member?.projectId &&
        grant.scope.resourceRevision === member.projectResourceRevision &&
        grant.scope.configRevision === member.projectConfigRevision
      ));
    if (
      member === undefined || run === undefined || project === undefined || request.runId !== member.runId ||
      member.lifecycle !== "terminal" || member.outcome !== "authorization_denied" ||
      member.code !== "execution_start_denied" || member.executionId !== null || member.intentId !== null ||
      request.actorId !== run.actorId || request.createdAt > member.updatedAt ||
      request.action !== "execution.start" || request.targetRevision !== 1 || request.result !== "deny" ||
      executionById.has(request.targetExecutionId) ||
      executionIntents.some((intent) => intent.executionId === request.targetExecutionId) ||
      decision === undefined || decision.actorId !== request.actorId || decision.action !== request.action ||
      decision.result !== request.result || decision.createdAt !== request.createdAt ||
      decision.projectId !== member.projectId || decision.resourceRevision !== member.projectResourceRevision ||
      decision.configRevision !== member.projectConfigRevision ||
      project.resourceRevision < decision.resourceRevision || project.configRevision < decision.configRevision ||
      (decision.grantId === null) !== (decision.grantRevision === null) ||
      grantBackedReason !== (decision.grantId !== null) ||
      (decision.reason === "policy_denied" && decision.policy !== "deny") ||
      decision.policy === "read_not_applicable" ||
      (decision.grantId !== null && !grantIsExact) ||
      event === undefined || event.decisionId !== decision.decisionId || event.runId !== request.runId ||
      event.memberId !== request.memberId || event.eventKind !== "authorization.denied" || event.result !== "denied" ||
      event.actorId !== request.actorId || event.correlationId !== request.correlationId ||
      event.targetExecutionId !== request.targetExecutionId || event.targetRevision !== request.targetRevision ||
      event.code !== decision.reason || event.createdAt !== request.createdAt
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher execution.start denial lineage is incomplete or inconsistent");
  }
  if (
    dispatcherMemberDenialDecisions.some((decision) => !denialRequestById.has(decision.requestId)) ||
    dispatcherMemberDenialAudit.some((event) =>
      !denialRequestById.has(event.requestId) || !denialDecisionById.has(event.decisionId)) ||
    dispatcherMembers.some((member) =>
      (member.code === "execution_start_denied") !== denialRequestByMember.has(member.memberId))
  ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher execution.start denial lineage has an orphan or missing record");
  for (const summary of dispatcherRunSummaries) {
    const run = dispatcherRunById.get(summary.runId);
    const membership = dispatcherMemberships.find((candidate) => candidate.runId === summary.runId);
    const members = dispatcherMembers.filter((member) => member.runId === summary.runId);
    const counts = new Map<DispatcherMemberOutcome, number>();
    for (const member of members) {
      if (member.outcome !== null) counts.set(member.outcome, (counts.get(member.outcome) ?? 0) + 1);
    }
    if (
      run === undefined || membership === undefined || summary.membershipRevision !== membership.membershipRevision ||
      summary.expectedMemberCount !== members.length || members.some((member) => member.lifecycle !== "terminal") ||
      members.some((member) => member.outcome === "claimed" && intentById.get(member.intentId ?? "")?.state !== "finalized") ||
      summary.claimedCount !== (counts.get("claimed") ?? 0) ||
      summary.alreadyClaimedCount !== (counts.get("already_claimed") ?? 0) ||
      summary.ineligibleCount !== (counts.get("ineligible_at_cas") ?? 0) ||
      summary.authorizationDeniedCount !== (counts.get("authorization_denied") ?? 0) ||
      summary.policyDeferredCount !== (counts.get("policy_deferred") ?? 0) ||
      summary.resourceDeferredCount !== (counts.get("resource_deferred") ?? 0) ||
      summary.reconciliationRequiredCount !== (counts.get("reconciliation_required") ?? 0) ||
      summary.failedCount !== (counts.get("failed") ?? 0) ||
      summary.ownerRevision !== run.ownerRevision || summary.runRevision !== run.runRevision ||
      summary.terminalStatus !== run.status
    ) throw persistenceFailure("CORRUPT_ROW", "Dispatcher terminal summary is inconsistent");
  }
  const stateWithoutLifecycle = Object.freeze({
    domain, projects, bootstrap, identity, grants, epochs,
    requests, decisions, audit,
    executionSequences, executions,
    executionOperationRequests, executionAuthorizationDecisions, executionOperationAudit,
    executionIntents, executionIntentAuthorizationBindings, executionObservations,
    executionReceipts, executionFinalizations, executionTerminalStates,
    manualTurns, manualBackendOperations, completionDecisions, manualCompletionDecisions,
    dispatcherTriggerRequests, dispatcherAuthorizationDecisions, dispatcherRuns, dispatcherAudit,
    dispatcherReconciliationItems, dispatcherReconciliationSummaries,
    dispatcherMemberships, dispatcherMembers,
    dispatcherMemberDenialRequests, dispatcherMemberDenialDecisions, dispatcherMemberDenialAudit,
    dispatcherRunSummaries,
    projectPolicyReceipts,
    completionGateRequests, completionGateAuthorizationDecisions, completionGateIntents,
    completionGateObservations, completionGateReceipts, completionGateFinalizations, completionGateEvents,
    policyGatedCompletionDecisions,
    integrationTargetSequences, integrationReservations, integrationOperationRequests,
    integrationAuthorizationDecisions, integrationIntents, integrationObservations,
    integrationReceipts, integrationFinalizations, integrationEvents,
    workspaceGenerations, workspaceAuthorizationDecisions, workspaceIntents,
    workspaceObservations, workspaceReceipts, workspaceFinalizations, workspaceEvents,
    workspaceCleanupAttestations,
    lifecycle: Object.freeze([]) as readonly ApplicationLifecycleAuthorization[],
  });
  validateProjectPolicyState(stateWithoutLifecycle);
  validateCompletionGateState(stateWithoutLifecycle);
  validateIntegrationState(stateWithoutLifecycle);
  validatePolicyGatedCompletionState(stateWithoutLifecycle);
  validateWorkspaceState(stateWithoutLifecycle);
  validateCleanupAttestationState(stateWithoutLifecycle);
  for (const authorization of lifecycle) {
    const request = requestById.get(authorization.requestId);
    const decision = decisions.find((candidate) => candidate.decisionId === authorization.decisionId);
    const event = audit.find((candidate) => candidate.auditId === authorization.auditId);
    const grant = grantById.get(authorization.grantId);
    const grantRelation = grantRelationById.get(authorization.grantId);
    const revokedRequest = grantRelation?.revokedRequestId === null || grantRelation?.revokedRequestId === undefined
      ? null
      : requestById.get(grantRelation.revokedRequestId);
    const issuedMillis = new Date(authorization.issuedAt).valueOf();
    const expiresMillis = new Date(authorization.expiresAt).valueOf();
    const countsAreCurrent = authorization.expectedRequestCount === requests.length &&
      authorization.expectedDecisionCount === decisions.length && authorization.expectedAuditCount === audit.length;
    const currentOrHistoricalRevision = grant !== undefined && (
      (grant.revision === authorization.grantRevision && grant.revokedAt === null && grantRelation?.revokedRequestId === null) ||
      (grant.revision === authorization.grantRevision + 1 && grant.revokedAt !== null &&
        grantRelation?.revokedRequestId !== null && revokedRequest?.createdAt === grant.revokedAt &&
        grant.revokedAt >= authorization.issuedAt)
    );
    if (
      identity === null ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(authorization.backupGenerationId) ||
      authorization.actorId !== identity.actorId ||
      authorization.runtimeRootKey !== identity.runtimeRootKey ||
      request === undefined ||
      request.action !== authorization.operation ||
      request.result !== "allow" ||
      request.actorId !== authorization.actorId ||
      request.targetKind !== "backup" ||
      request.targetId !== authorization.backupGenerationId ||
      request.targetRevision !== null ||
      request.createdAt !== authorization.issuedAt ||
      decision === undefined ||
      decision.requestId !== authorization.requestId ||
      decision.actorId !== authorization.actorId ||
      decision.action !== authorization.operation ||
      decision.result !== "allow" ||
      decision.reason !== "allowed" ||
      decision.grantId !== authorization.grantId ||
      decision.grantRevision !== authorization.grantRevision ||
      decision.createdAt !== authorization.issuedAt ||
      event === undefined ||
      event.requestId !== authorization.requestId ||
      event.decisionId !== authorization.decisionId ||
      event.actorId !== authorization.actorId ||
      event.targetKind !== "backup" ||
      event.targetId !== authorization.backupGenerationId ||
      event.result !== "accepted" ||
      event.eventKind !== (authorization.operation === "runtime.backup" ? "backup.authorized" : "restore.authorized") ||
      event.createdAt !== authorization.issuedAt ||
      grant === undefined ||
      grant.actorId !== authorization.actorId ||
      grant.action !== authorization.operation ||
      !currentOrHistoricalRevision ||
      authorization.expectedRequestCount > requests.length ||
      authorization.expectedDecisionCount > decisions.length ||
      authorization.expectedAuditCount > audit.length ||
      authorization.expectedAuditCount !== authorization.expectedRequestCount ||
      authorization.expectedDecisionCount !== authorization.expectedRequestCount - 1 ||
      !(expiresMillis > issuedMillis && expiresMillis - issuedMillis <= 5 * 60 * 1000) ||
      authorization.expiresAt > grant.expiresAt ||
      (countsAreCurrent && authorization.authorizedStateSha256 !== applicationStateSha256(stateWithoutLifecycle))
    ) {
      throw persistenceFailure("CORRUPT_ROW", "Lifecycle authorization lineage is incomplete or inconsistent");
    }
  }
  return Object.freeze({ ...stateWithoutLifecycle, lifecycle });
}

export function readApplicationState(database: SqliteDatabase): ApplicationState {
  return runReadSnapshot(database, () => readApplicationStateUntransactional(database));
}
