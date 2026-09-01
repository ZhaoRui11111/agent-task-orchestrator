import {
  AUTHORIZATION_ACTIONS,
  BASE_AUTHORIZATION_ACTIONS,
  CLAIM_AUTHORIZATION_ACTIONS,
  MANUAL_AUTHORIZATION_ACTIONS,
  actionsForVocabulary,
  canIssueGrant,
  evaluateAuthorization,
  type AuthorizationAction,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
  type AuthorizationScope,
  type AuthorizationVocabularyVersion,
} from "./authorization.ts";
import type { ProjectRootIdentity } from "./project-registry.ts";
import type {
  ApplicationAuditRecord,
  ApplicationAction,
  ApplicationRequestRecord,
  ApplicationState,
  ApplicationTransaction,
  AuthorizationDecisionRecord,
  RegisteredProject,
} from "./persistence/application-repository.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";
import type {
  ApplicationCommand,
  ApplicationFailure,
  ApplicationTestHooks,
  AuditKind,
  BoundTarget,
  CommandAuthorization,
  DomainApplicationCommand,
  ExistingProjectCommand,
  OperationIdentity,
} from "./application-model.ts";
import { failed, sameRootIdentity } from "./application-input.ts";

export { failed };

export function projectById(state: ApplicationState, projectId: string): RegisteredProject | null {
  return state.projects.find((project) => project.projectId === projectId) ?? null;
}

export function sameLocalIdentity(state: ApplicationState, identity: OperationIdentity, root: ProjectRootIdentity): boolean {
  return state.identity !== null &&
    state.identity.actorId === identity.actor.actorId &&
    state.identity.principalSha256 === identity.actor.principal &&
    state.identity.platform === root.platform &&
    state.identity.runtimeRootKey === root.rootKey;
}

export const BASE_CAPABILITY_ACTION_SET_SHA256 = sha256(canonicalJson(BASE_AUTHORIZATION_ACTIONS));
export const CLAIM_CAPABILITY_ACTION_SET_SHA256 = sha256(canonicalJson(CLAIM_AUTHORIZATION_ACTIONS));
export const MANUAL_CAPABILITY_ACTION_SET_SHA256 = sha256(canonicalJson(MANUAL_AUTHORIZATION_ACTIONS));
export const CURRENT_CAPABILITY_ACTION_SET_SHA256 = sha256(canonicalJson(AUTHORIZATION_ACTIONS));

export interface RenewalAssessment {
  readonly mode: "renewed";
  readonly nextEpochRevision: number;
  readonly vocabularyVersion: AuthorizationVocabularyVersion;
}

export function assessRenewal(
  state: ApplicationState,
  identity: OperationIdentity,
  root: ProjectRootIdentity,
): RenewalAssessment | "authorization_denied" | "not_due" | "not_initialized" {
  const bootstrap = state.bootstrap;
  if (bootstrap === null) return "not_initialized";
  if (!sameRootIdentity(bootstrap, root)) return "authorization_denied";
  const localIdentity = state.identity;
  if (localIdentity === null || !sameLocalIdentity(state, identity, root)) return "authorization_denied";
  const latestEpoch = state.epochs.at(-1);
  const vocabularyVersion = latestEpoch?.vocabularyVersion ?? 1;
  const currentActions = actionsForVocabulary(vocabularyVersion);
  const originActor = localIdentity.actorId;
  const originCreatedAt = latestEpoch?.createdAt ?? bootstrap.createdAt;
  const originExpiresAt = latestEpoch?.expiresAt ?? bootstrap.expiresAt;
  const currentOrigin = state.grants.filter((grant) =>
    grant.actorId === originActor &&
    grant.issuerGrantId === null &&
    grant.sourceGrantId === null &&
    grant.notBefore === originCreatedAt &&
    grant.expiresAt === originExpiresAt
  );
  if (currentOrigin.length !== currentActions.length) return "authorization_denied";
  if (!currentActions.every((action) => currentOrigin.some((grant) => grant.action === action))) return "authorization_denied";
  const renewalThreshold = new Date(new Date(identity.now).valueOf() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (originExpiresAt > renewalThreshold) return "not_due";
  if (originExpiresAt > identity.now && currentOrigin.some((grant) => grant.revokedAt !== null)) return "not_due";
  return Object.freeze({
    mode: "renewed",
    nextEpochRevision: (latestEpoch?.epochRevision ?? 0) + 1,
    vocabularyVersion,
  });
}

export interface UpgradeAssessment {
  readonly nextEpochRevision: number;
  readonly currentVocabularyVersion: 1 | 2 | 3;
  readonly targetVocabularyVersion: 2 | 3 | 4;
}

export function assessCapabilityUpgrade(
  state: ApplicationState,
  identity: OperationIdentity,
  root: ProjectRootIdentity,
): UpgradeAssessment | "authorization_denied" | "not_initialized" | "not_eligible" {
  const bootstrap = state.bootstrap;
  if (bootstrap === null) return "not_initialized";
  if (!sameRootIdentity(bootstrap, root) || !sameLocalIdentity(state, identity, root)) {
    return "authorization_denied";
  }
  const latestEpoch = state.epochs.at(-1);
  const currentVocabulary = latestEpoch?.vocabularyVersion ?? bootstrap.vocabularyVersion;
  if (currentVocabulary !== 1 && currentVocabulary !== 2 && currentVocabulary !== 3) {
    return "not_eligible";
  }
  const originCreatedAt = latestEpoch?.createdAt ?? bootstrap.createdAt;
  const originExpiresAt = latestEpoch?.expiresAt ?? bootstrap.expiresAt;
  const currentOrigin = state.grants.filter((grant) =>
    grant.actorId === identity.actor.actorId &&
    grant.issuerGrantId === null &&
    grant.sourceGrantId === null &&
    grant.notBefore === originCreatedAt &&
    grant.expiresAt === originExpiresAt
  );
  const currentActions = actionsForVocabulary(currentVocabulary);
  if (
    currentOrigin.length !== currentActions.length ||
    !currentActions.every((action) => currentOrigin.some((grant) => grant.action === action)) ||
    currentOrigin.some((grant) => grant.revokedAt !== null || grant.notBefore > identity.now || grant.expiresAt <= identity.now)
  ) return "not_eligible";
  return Object.freeze({
    nextEpochRevision: (latestEpoch?.epochRevision ?? 0) + 1,
    currentVocabularyVersion: currentVocabulary,
    targetVocabularyVersion: currentVocabulary === 1 ? 2 as const : currentVocabulary === 2 ? 3 as const : 4 as const,
  });
}

export function sameProjectBinding(current: RegisteredProject, preflight: RegisteredProject): boolean {
  return current.projectId === preflight.projectId &&
    current.configRevision === preflight.configRevision &&
    current.resourceRevision === preflight.resourceRevision &&
    sameRootIdentity(current, preflight);
}


export function requestRecord(identity: OperationIdentity, action: ApplicationAction, target: BoundTarget, result: ApplicationRequestRecord["result"]): ApplicationRequestRecord {
  return Object.freeze({
    requestId: identity.requestId,
    correlationId: identity.correlationId,
    actorId: identity.actor.actorId,
    action,
    targetKind: target.kind,
    targetId: target.id,
    targetRevision: target.revision,
    result,
    createdAt: identity.now,
  });
}

export function decisionRecord(
  identity: OperationIdentity,
  action: AuthorizationAction,
  target: BoundTarget,
  evaluation: AuthorizationEvaluation,
): AuthorizationDecisionRecord {
  return Object.freeze({
    decisionId: identity.decisionId,
    requestId: identity.requestId,
    actorId: identity.actor.actorId,
    action,
    result: evaluation.allowed ? "allow" : "deny",
    reason: evaluation.reason,
    policy: evaluation.policy,
    grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision,
    projectId: target.project?.projectId ?? null,
    resourceRevision: target.project?.resourceRevision ?? null,
    createdAt: identity.now,
  });
}

export function auditRecord(
  identity: OperationIdentity,
  target: BoundTarget,
  eventKind: AuditKind,
  result: "accepted" | "denied",
  reason: string,
  decisionId: string | null = identity.decisionId,
): ApplicationAuditRecord {
  return Object.freeze({
    auditId: identity.auditId,
    requestId: identity.requestId,
    decisionId,
    eventKind,
    result,
    actorId: identity.actor.actorId,
    correlationId: identity.correlationId,
    targetKind: target.kind,
    targetId: target.id,
    targetRevision: target.revision,
    reason,
    createdAt: identity.now,
  });
}

export function policyFor(action: AuthorizationAction, project: RegisteredProject | null, state: ApplicationState): AuthorizationPolicyResult {
  if (action.endsWith(".inspect") || action === "policy.evaluate" || action.startsWith("authorization.") || action.startsWith("runtime.")) return "read_not_applicable";
  if (action === "project.register" || action === "project.update" || action === "project.disable") return "allow";
  if (project === null) return "allow";
  return state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true ? "allow" : "deny";
}

export function authorize(
  identity: OperationIdentity,
  action: AuthorizationAction,
  target: BoundTarget,
  state: ApplicationState,
  confirmed: boolean,
  requiredScopeKind: AuthorizationScope["kind"] | null = null,
): AuthorizationEvaluation {
  const input = {
    actorId: identity.actor.actorId,
    action,
    target: {
      projectId: target.project?.projectId ?? null,
      resourceRevision: target.project?.resourceRevision ?? null,
      configRevision: target.project?.configRevision ?? null,
    },
    now: identity.now,
    policy: policyFor(action, target.project, state),
    confirmed,
    grants: requiredScopeKind === null
      ? state.grants
      : state.grants.filter((grant) => grant.scope.kind === requiredScopeKind),
  };
  return evaluateAuthorization(input);
}

export function authorizeCommand(
  identity: OperationIdentity,
  command: ApplicationCommand,
  target: BoundTarget,
  state: ApplicationState,
  confirmed: boolean,
): CommandAuthorization {
  const initial = authorize(identity, command.kind, target, state, confirmed);
  if (command.kind !== "authorization.grant.issue") {
    return Object.freeze({ evaluation: initial, issuanceProof: null });
  }
  if (!initial.allowed && initial.reason !== "confirmation_required") {
    return Object.freeze({ evaluation: initial, issuanceProof: null });
  }
  const candidate = Object.freeze({
    actorId: command.actorId,
    action: command.action,
    scope: command.scope,
    notBefore: command.notBefore,
    expiresAt: command.expiresAt,
  });
  const issuanceProof = canIssueGrant(identity.actor.actorId, state.grants, candidate, identity.now);
  if (issuanceProof === null) {
    return Object.freeze({
      evaluation: Object.freeze({ ...initial, allowed: false, reason: "scope_mismatch" }),
      issuanceProof: null,
    });
  }
  const administrative = state.grants.find((grant) => grant.grantId === issuanceProof.administrativeGrantId);
  if (administrative === undefined || administrative.action !== "authorization.grant.issue") {
    throw new TypeError("Grant issuance proof selected an absent administrative grant");
  }
  return Object.freeze({
    evaluation: Object.freeze({
      ...initial,
      grantId: administrative.grantId,
      grantRevision: administrative.revision,
    }),
    issuanceProof,
  });
}

export function recordDenied(
  transaction: ApplicationTransaction,
  identity: OperationIdentity,
  action: AuthorizationAction,
  target: BoundTarget,
  evaluation: AuthorizationEvaluation,
  hooks: ApplicationTestHooks,
): ApplicationFailure {
  transaction.insertRequest(requestRecord(identity, action, target, "deny"));
  hooks.afterStage?.("request");
  transaction.insertDecision(decisionRecord(identity, action, target, evaluation));
  hooks.afterStage?.("decision");
  transaction.insertAudit(auditRecord(identity, target, "authorization.denied", "denied", evaluation.reason));
  hooks.afterStage?.("audit");
  return failed("AUTHORIZATION_DENIED", "Current explicit authorization did not permit the operation", identity, { reason: evaluation.reason });
}

export function staleEvaluation(policy: AuthorizationPolicyResult): AuthorizationEvaluation {
  return Object.freeze({ allowed: false, reason: "scope_revision_stale", policy, grantId: null, grantRevision: null });
}

export function ensureCurrentProject(
  state: ApplicationState,
  projectId: string,
  resourceRevision: number,
  configRevision: number | null,
): RegisteredProject | ApplicationFailure {
  const project = projectById(state, projectId);
  if (project === null) return failed("PROJECT_NOT_FOUND", "Project is not registered in ProjectRegistry", null, { projectId });
  if (project.resourceRevision !== resourceRevision || (configRevision !== null && project.configRevision !== configRevision)) {
    return failed("STALE_REVISION", "Project resource or config revision is stale", null, { projectId });
  }
  return project;
}

export function isExistingProjectCommand(command: ApplicationCommand): command is ExistingProjectCommand {
  return command.kind === "project.update" || command.kind === "project.disable" || command.kind === "project.inspect";
}

export function isDomainApplicationCommand(command: ApplicationCommand): command is DomainApplicationCommand {
  return command.kind === "task.create" || command.kind === "task.update" || command.kind === "task.mark_ready" ||
    command.kind === "task.cancel" || command.kind === "task.inspect" || command.kind === "dependency.add" ||
    command.kind === "dependency.remove";
}

export function targetForCommand(command: ApplicationCommand, state: ApplicationState): BoundTarget | ApplicationFailure {
  switch (command.kind) {
    case "authorization.grant.issue": {
      const project = command.scope.kind === "project" && command.scope.projectId !== null ? projectById(state, command.scope.projectId) : null;
      return Object.freeze({ kind: "grant", id: "new-grant", revision: null, project });
    }
    case "authorization.grant.inspect":
    case "authorization.grant.revoke": {
      const grant = state.grants.find((candidate) => candidate.grantId === command.grantId);
      if (grant === undefined) return failed("GRANT_NOT_FOUND", "Grant is not registered");
      const project = grant.scope.kind === "project" && grant.scope.projectId !== null ? projectById(state, grant.scope.projectId) : null;
      return Object.freeze({ kind: "grant", id: grant.grantId, revision: command.expectedGrantRevision, project });
    }
    case "authorization.grant.list":
    case "runtime.status":
      return Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
    case "runtime.backup":
    case "runtime.restore":
      return Object.freeze({ kind: "backup", id: command.backupGenerationId, revision: null, project: null });
    case "project.register":
      return Object.freeze({ kind: "project", id: command.projectId, revision: null, project: null });
    case "project.update":
    case "project.disable":
    case "project.inspect":
    case "policy.evaluate": {
      const project = projectById(state, command.projectId);
      if (project === null) return failed("PROJECT_NOT_FOUND", "Project is not registered in ProjectRegistry", null, { projectId: command.projectId });
      return Object.freeze({ kind: "project", id: command.projectId, revision: command.expectedResourceRevision, project });
    }
    default: {
      const project = projectById(state, command.projectId);
      if (project === null) return failed("PROJECT_NOT_FOUND", "Project is not registered in ProjectRegistry", null, { projectId: command.projectId });
      return Object.freeze({
        kind: "task",
        id: command.taskId,
        revision: command.kind === "task.create" ? null : command.expectedTaskRevision,
        project,
      });
    }
  }
}
