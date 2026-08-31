import {
  AUTHORIZATION_ACTIONS,
  PHASE1_AUTHORIZATION_ACTIONS,
  PHASE2A_AUTHORIZATION_ACTIONS,
  PHASE2B_AUTHORIZATION_ACTIONS,
  isHighRiskAction,
} from "../authorization.ts";
import type { AuthorizationAction, AuthorizationGrant, AuthorizationScope } from "../authorization.ts";
import { runReadSnapshot } from "./database.ts";
import type { SqliteDatabase } from "./database.ts";
import { persistenceFailure } from "./errors.ts";
import { applicationStateSha256 } from "./application-repository-digest.ts";
import { applicationAuditKind } from "./application-repository-model.ts";
import type {
  ApplicationLifecycleAuthorization,
  ApplicationRequestRecord,
  AuthorizationDecisionRecord,
  AuthorizationGrantEpochLinkRecord,
  DispatcherMemberOutcome,
  ApplicationState,
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
  const vocabularySevenEpochIds = new Set(epochs.filter((epoch) => epoch.vocabularyVersion === 7).map((epoch) => epoch.epochId));
  const authorizationGrantEpochLinks = Object.freeze(grantRelations
    .filter((relation) => relation.capabilityEpochId !== null && vocabularySevenEpochIds.has(relation.capabilityEpochId))
    .map((relation): AuthorizationGrantEpochLinkRecord => Object.freeze({
      grantId: relation.grantId,
      action: relation.action,
      capabilityEpochId: relation.capabilityEpochId as string,
    })));
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
    const fixedActions = PHASE1_AUTHORIZATION_ACTIONS;
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
      throw persistenceFailure("CORRUPT_ROW", "Vocabulary-v4 bootstrap does not bind the immutable local identity");
    }
  }
  const phase1ActionSetSha256 = sha256(canonicalJson(PHASE1_AUTHORIZATION_ACTIONS));
  const phase2aActionSetSha256 = sha256(canonicalJson(PHASE2A_AUTHORIZATION_ACTIONS));
  const phase2bActionSetSha256 = sha256(canonicalJson(PHASE2B_AUTHORIZATION_ACTIONS));
  const currentActionSetSha256 = sha256(canonicalJson(AUTHORIZATION_ACTIONS));
  for (let index = 0; index < epochs.length; index += 1) {
    const epoch = epochs[index];
    const request = epoch === undefined ? undefined : requestById.get(epoch.requestId);
    const previousVocabulary = index === 0 ? 4 : epochs[index - 1]?.vocabularyVersion;
    const isUpgrade = epoch !== undefined && previousVocabulary !== undefined && epoch.vocabularyVersion === previousVocabulary + 1;
    const isRenewal = epoch?.vocabularyVersion === previousVocabulary;
    const expectedActionSetSha256 = epoch?.vocabularyVersion === 7
      ? currentActionSetSha256
      : epoch?.vocabularyVersion === 6
        ? phase2bActionSetSha256
      : epoch?.vocabularyVersion === 5
        ? phase2aActionSetSha256
        : phase1ActionSetSha256;
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
    const expectedActions = epoch.vocabularyVersion === 7
      ? AUTHORIZATION_ACTIONS
      : epoch.vocabularyVersion === 6
        ? PHASE2B_AUTHORIZATION_ACTIONS
      : epoch.vocabularyVersion === 5
        ? PHASE2A_AUTHORIZATION_ACTIONS
        : PHASE1_AUTHORIZATION_ACTIONS;
    const actionSet = new Set(epochRelations.map((relation) => relation.action));
    if (
      epochRelations.length !== expectedActions.length ||
      actionSet.size !== expectedActions.length ||
      expectedActions.some((expected) => !actionSet.has(expected))
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
      ? PHASE1_AUTHORIZATION_ACTIONS.length
      : request.result === "renewal" || request.result === "upgrade"
        ? (() => {
            const epoch = epochs.find((candidate) => candidate.requestId === request.requestId);
            return epoch?.vocabularyVersion === 7
              ? AUTHORIZATION_ACTIONS.length
              : epoch?.vocabularyVersion === 6
                ? PHASE2B_AUTHORIZATION_ACTIONS.length
                : epoch?.vocabularyVersion === 5
                  ? PHASE2A_AUTHORIZATION_ACTIONS.length
                  : PHASE1_AUTHORIZATION_ACTIONS.length;
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
  for (const completion of manualCompletionDecisions) {
    const request = executionRequestById.get(completion.requestId);
    const decision = executionDecisionById.get(completion.decisionId);
    const event = executionOperationAudit.find((candidate) => candidate.auditId === completion.auditId);
    const receipt = receiptById.get(completion.verifiedReceiptId);
    const finalization = finalizationById.get(completion.finalizationId);
    const intent = finalization === undefined ? undefined : intentById.get(finalization.intentId);
    const task = taskById.get(completion.taskId);
    const terminal = terminalByExecution.get(completion.executionId);
    if (
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
    domain, projects, bootstrap, identity, grants, epochs, authorizationGrantEpochLinks,
    requests, decisions, audit,
    executionSequences, executions,
    executionOperationRequests, executionAuthorizationDecisions, executionOperationAudit,
    executionIntents, executionIntentAuthorizationBindings, executionObservations,
    executionReceipts, executionFinalizations, executionTerminalStates,
    manualTurns, manualBackendOperations, manualCompletionDecisions,
    dispatcherTriggerRequests, dispatcherAuthorizationDecisions, dispatcherRuns, dispatcherAudit,
    dispatcherReconciliationItems, dispatcherReconciliationSummaries,
    dispatcherMemberships, dispatcherMembers,
    dispatcherMemberDenialRequests, dispatcherMemberDenialDecisions, dispatcherMemberDenialAudit,
    dispatcherRunSummaries,
    lifecycle: Object.freeze([]) as readonly ApplicationLifecycleAuthorization[],
  });
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
