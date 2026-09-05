import {
  BASE_AUTHORIZATION_ACTIONS,
  actionsForVocabulary,
  isHighRiskAction,
} from "./authorization.ts";
import type {
  DomainMutation,
  ProjectDomainMutation,
} from "./domain.ts";
import {
  inspectProjectRoot,
  type ProjectRootIdentity,
} from "./project-registry.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import {
  applicationStateSha256,
  applicationAuditKind,
  readApplicationStateForOwner,
  withApplicationTransaction,
  type NewGrantRecord,
  type ApplicationState,
  type RegisteredProject,
} from "./persistence/application-repository.ts";
import type {
  AffectedProjectPreflight,
  ApplicationCommand,
  ApplicationFailure,
  ApplicationIngress,
  ApplicationResult,
  ApplicationService,
  ApplicationTestHooks,
  BootstrapCommand,
  BoundTarget,
  CapabilityEpochResult,
  CapabilityUpgradeCommand,
  RenewalCommand,
} from "./application-model.ts";
import {
  checkedProjectRoot,
  checkedRuntimeRoot,
  confirmHighRisk,
  failed,
  operationIdentity,
  operationalIdentifier,
  parseBootstrap,
  parseCapabilityUpgrade,
  parseCommand,
  parseRenewal,
  projectRegistryFailure,
  refreshOperationTime,
  sameRootIdentity,
  succeeded,
} from "./application-input.ts";
import {
  CURRENT_CAPABILITY_ACTION_SET_SHA256,
  BASE_CAPABILITY_ACTION_SET_SHA256,
  CLAIM_CAPABILITY_ACTION_SET_SHA256,
  DISPATCHER_CAPABILITY_ACTION_SET_SHA256,
  MANUAL_CAPABILITY_ACTION_SET_SHA256,
  PHASE3_CAPABILITY_ACTION_SET_SHA256,
  SCHEDULER_CAPABILITY_ACTION_SET_SHA256,
  WORKSPACE_CAPABILITY_ACTION_SET_SHA256,
  assessCapabilityUpgrade,
  assessRenewal,
  auditRecord,
  authorize,
  authorizeCommand,
  decisionRecord,
  ensureCurrentProject,
  isDomainApplicationCommand,
  isExistingProjectCommand,
  policyFor,
  projectById,
  recordDenied,
  requestRecord,
  sameLocalIdentity,
  sameProjectBinding,
  staleEvaluation,
  targetForCommand,
} from "./application-policy.ts";
import {
  affectedProjectIds,
  domainMutation,
  outputFor,
  projectDomainMutation,
  projectRegistrationMutation,
  sameProjectIds,
} from "./application-domain.ts";

function authorizationMutationTimeIsCurrent(state: ApplicationState, now: string): boolean {
  const schedulerFloor = state.schedulerAuthorizationDecisions
    .reduce<string | null>((latest, decision) => latest === null || decision.createdAt > latest
      ? decision.createdAt : latest, null);
  return schedulerFloor === null || now >= schedulerFloor;
}

function changesAuthorizationGrants(command: ApplicationCommand): boolean {
  return command.kind === "authorization.grant.issue" || command.kind === "authorization.grant.revoke";
}

function createApplicationServiceInternal(
  store: PersistenceStore,
  ingress: ApplicationIngress,
  hooks: ApplicationTestHooks,
): ApplicationService {
  const bootstrap = (value: BootstrapCommand): ApplicationResult<Readonly<{ actorId: string; grantIds: readonly string[] }>> => {
    const command = parseBootstrap(value);
    let identity = operationIdentity(ingress);
    if (command === null || identity === null) return failed("INVALID_INPUT", "Bootstrap input or trusted ingress is invalid");
    const confirmed = confirmHighRisk(identity, "authorization.grant.issue", ingress);
    if (!confirmed) return failed("AUTHORIZATION_DENIED", "Trusted bootstrap confirmation is required", identity, { reason: "confirmation_required" });
    const refreshedIdentity = refreshOperationTime(identity, ingress);
    if (refreshedIdentity === null) return failed("INVALID_INPUT", "Trusted bootstrap time could not be refreshed", identity);
    identity = refreshedIdentity;
    const maximumExpiry = new Date(new Date(identity.now).valueOf() + 31 * 24 * 60 * 60 * 1000).toISOString();
    if (command.expiresAt <= identity.now || command.expiresAt > maximumExpiry) {
      return failed("INVALID_INPUT", "Bootstrap expiry must be finite and no more than 31 days", identity);
    }
    const grantIds: string[] = [];
    try {
      for (const action of BASE_AUTHORIZATION_ACTIONS) {
        const grantId = ingress.nextId("grant");
        if (!operationalIdentifier(grantId) || grantIds.includes(grantId)) {
          return failed("INVALID_INPUT", `Trusted grant identity is invalid or repeated for ${action}`, identity);
        }
        grantIds.push(grantId);
      }
    } catch {
      return failed("INVALID_INPUT", "Trusted bootstrap grant identities could not be obtained", identity);
    }
    const runtimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in runtimeIdentity) return runtimeIdentity;
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (state.bootstrap !== null) return failed("BOOTSTRAP_ALREADY_CONSUMED", "Authorization bootstrap has already been consumed", identity);
      const target: BoundTarget = Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
      transaction.insertRequest(requestRecord(identity, "authorization.grant.issue", target, "bootstrap"));
      hooks.afterStage?.("request");
      transaction.insertBootstrap(Object.freeze({
        actorId: identity.actor.actorId,
        trustedPrincipal: identity.actor.principal,
        ...runtimeIdentity,
        requestId: identity.requestId,
        createdAt: identity.now,
        expiresAt: command.expiresAt,
        vocabularyVersion: 1 as const,
      }));
      hooks.afterStage?.("bootstrap");
      transaction.insertLocalIdentity(Object.freeze({
        identityVersion: 1 as const,
        actorId: identity.actor.actorId,
        principalSha256: identity.actor.principal,
        platform: runtimeIdentity.platform,
        runtimeRootKey: runtimeIdentity.rootKey,
        bootstrapRequestId: identity.requestId,
        createdAt: identity.now,
      }));
      hooks.afterStage?.("identity");
      for (const [index, action] of BASE_AUTHORIZATION_ACTIONS.entries()) {
        const grantId = grantIds[index];
        if (grantId === undefined) throw new TypeError("Trusted bootstrap grant identity is absent");
        transaction.insertGrant(Object.freeze({
          grantId,
          revision: 1,
          actorId: identity.actor.actorId,
          action,
          scope: Object.freeze({ kind: "runtime", projectId: null, resourceRevision: null, configRevision: null }),
          notBefore: identity.now,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: null,
          sourceGrantId: null,
          createdRequestId: identity.requestId,
        }));
        hooks.afterStage?.(`grant:${action}`);
      }
      transaction.insertAudit(auditRecord(identity, target, "bootstrap", "accepted", "bootstrap", null));
      hooks.afterStage?.("audit");
      const readback = transaction.read();
      if (readback.bootstrap?.requestId !== identity.requestId || !grantIds.every((grantId) => readback.grants.some((grant) => grant.grantId === grantId))) {
        throw new TypeError("Bootstrap terminal readback did not match");
      }
      return succeeded(Object.freeze({ actorId: identity.actor.actorId, grantIds: Object.freeze(grantIds) }), identity);
    });
  };

  const upgrade = (value: CapabilityUpgradeCommand): ApplicationResult<CapabilityEpochResult> => {
    const command = parseCapabilityUpgrade(value);
    if (command === null) return failed("INVALID_INPUT", "Capability upgrade input is invalid");
    let identity = operationIdentity(ingress);
    if (identity === null) return failed("INVALID_INPUT", "Trusted capability upgrade ingress is invalid");
    if (!confirmHighRisk(identity, "authorization.capability.upgrade", ingress)) {
      return failed("AUTHORIZATION_DENIED", "Trusted capability upgrade confirmation is required", identity, {
        reason: "confirmation_required",
      });
    }
    const refreshedIdentity = refreshOperationTime(identity, ingress);
    if (refreshedIdentity === null) {
      return failed("INVALID_INPUT", "Trusted capability upgrade time could not be refreshed", identity);
    }
    identity = refreshedIdentity;
    const minimumExpiry = new Date(new Date(identity.now).valueOf() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const maximumExpiry = new Date(new Date(identity.now).valueOf() + 31 * 24 * 60 * 60 * 1000).toISOString();
    if (command.expiresAt <= minimumExpiry || command.expiresAt > maximumExpiry) {
      return failed("INVALID_INPUT", "Capability upgrade expiry is outside the finite window", identity);
    }
    const runtimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in runtimeIdentity) return runtimeIdentity;
    const preflightState = readApplicationStateForOwner(store);
    if (!authorizationMutationTimeIsCurrent(preflightState, identity.now)) {
      return failed("STALE_REVISION", "Trusted capability-upgrade time precedes durable scheduler authorization evidence", identity);
    }
    const preflightAssessment = assessCapabilityUpgrade(preflightState, identity, runtimeIdentity);
    if (typeof preflightAssessment === "string") {
      return preflightAssessment === "not_initialized"
        ? failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity)
        : preflightAssessment === "authorization_denied"
          ? failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity)
          : failed("CAPABILITY_UPGRADE_NOT_ELIGIBLE", "Current capability origin is not eligible for upgrade", identity);
    }
    const preflightStateSha256 = applicationStateSha256(preflightState);
    const preflightEpochRevision = preflightState.epochs.at(-1)?.epochRevision ?? 0;
    const upgradeActions = actionsForVocabulary(preflightAssessment.targetVocabularyVersion);
    let epochId: string;
    const grantIds: string[] = [];
    try {
      epochId = ingress.nextId("epoch");
      for (const action of upgradeActions) {
        const grantId = ingress.nextId("grant");
        if (!operationalIdentifier(grantId) || grantIds.includes(grantId) || grantId === epochId) {
          return failed("INVALID_INPUT", `Trusted upgrade grant identity is invalid or repeated for ${action}`, identity);
        }
        grantIds.push(grantId);
      }
    } catch {
      return failed("INVALID_INPUT", "Trusted capability upgrade identities could not be obtained", identity);
    }
    if (!operationalIdentifier(epochId)) {
      return failed("INVALID_INPUT", "Trusted capability epoch identity is invalid", identity);
    }
    hooks.beforeTransaction?.();
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (!authorizationMutationTimeIsCurrent(state, identity.now)) {
        return failed("STALE_REVISION", "Trusted capability-upgrade time precedes durable scheduler authorization evidence", identity);
      }
      if (
        applicationStateSha256(state) !== preflightStateSha256 ||
        (state.epochs.at(-1)?.epochRevision ?? 0) !== preflightEpochRevision
      ) {
        return failed("STALE_REVISION", "Capability upgrade preflight is stale", identity);
      }
      const assessment = assessCapabilityUpgrade(state, identity, runtimeIdentity);
      if (typeof assessment === "string") {
        return assessment === "not_initialized"
          ? failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity)
          : assessment === "authorization_denied"
            ? failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity)
            : failed("CAPABILITY_UPGRADE_NOT_ELIGIBLE", "Current capability origin is not eligible for upgrade", identity);
      }
      if (
        assessment.nextEpochRevision !== preflightAssessment.nextEpochRevision ||
        assessment.currentVocabularyVersion !== preflightAssessment.currentVocabularyVersion ||
        assessment.targetVocabularyVersion !== preflightAssessment.targetVocabularyVersion
      ) {
        return failed("STALE_REVISION", "Capability upgrade lineage is stale", identity);
      }
      const target: BoundTarget = Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
      transaction.insertRequest(requestRecord(identity, "authorization.capability.upgrade", target, "upgrade"));
      hooks.afterStage?.("request");
      transaction.insertCapabilityEpoch(Object.freeze({
        epochId,
        epochRevision: assessment.nextEpochRevision,
        actorId: identity.actor.actorId,
        runtimeRootKey: runtimeIdentity.rootKey,
        vocabularyVersion: assessment.targetVocabularyVersion,
        actionSetSha256: assessment.targetVocabularyVersion === 2
          ? CLAIM_CAPABILITY_ACTION_SET_SHA256
          : assessment.targetVocabularyVersion === 3
            ? MANUAL_CAPABILITY_ACTION_SET_SHA256
            : assessment.targetVocabularyVersion === 4
              ? DISPATCHER_CAPABILITY_ACTION_SET_SHA256
              : assessment.targetVocabularyVersion === 5
                ? WORKSPACE_CAPABILITY_ACTION_SET_SHA256
                : assessment.targetVocabularyVersion === 6
                  ? PHASE3_CAPABILITY_ACTION_SET_SHA256
                  : assessment.targetVocabularyVersion === 7
                    ? SCHEDULER_CAPABILITY_ACTION_SET_SHA256
                    : CURRENT_CAPABILITY_ACTION_SET_SHA256,
        requestId: identity.requestId,
        createdAt: identity.now,
        expiresAt: command.expiresAt,
      }));
      hooks.afterStage?.("epoch");
      for (const [index, action] of upgradeActions.entries()) {
        const grantId = grantIds[index];
        if (grantId === undefined) throw new TypeError("Trusted upgrade grant identity is absent");
        transaction.insertGrant(Object.freeze({
          grantId,
          revision: 1,
          actorId: identity.actor.actorId,
          action,
          scope: Object.freeze({ kind: "runtime", projectId: null, resourceRevision: null, configRevision: null }),
          notBefore: identity.now,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: null,
          sourceGrantId: null,
          capabilityEpochId: epochId,
          createdRequestId: identity.requestId,
        }));
        hooks.afterStage?.(`grant:${action}`);
      }
      transaction.insertDecision(Object.freeze({
        decisionId: identity.decisionId,
        requestId: identity.requestId,
        actorId: identity.actor.actorId,
        action: "authorization.capability.upgrade" as const,
        result: "allow" as const,
        reason: "allowed" as const,
        policy: "allow" as const,
        grantId: null,
        grantRevision: null,
        projectId: null,
        resourceRevision: null,
        createdAt: identity.now,
      }));
      hooks.afterStage?.("decision");
      transaction.insertAudit(auditRecord(identity, target, "capability.upgraded", "accepted", "accepted"));
      hooks.afterStage?.("audit");
      const readback = transaction.read();
      const epoch = readback.epochs.find((candidate) => candidate.epochId === epochId);
      if (
        epoch === undefined ||
        epoch.vocabularyVersion !== assessment.targetVocabularyVersion ||
        epoch.epochRevision !== assessment.nextEpochRevision ||
        !grantIds.every((grantId) => readback.grants.some((grant) => grant.grantId === grantId))
      ) throw new TypeError("Capability upgrade terminal readback did not match");
      return succeeded(Object.freeze({
        mode: "upgraded" as const,
        expiresAt: epoch.expiresAt,
        capabilityCount: upgradeActions.length,
        epochRevision: epoch.epochRevision,
      }), identity);
    });
  };
  const renew = (value: RenewalCommand): ApplicationResult<CapabilityEpochResult> => {
    const command = parseRenewal(value);
    let identity = operationIdentity(ingress);
    if (command === null || identity === null) return failed("INVALID_INPUT", "Capability renewal input or trusted ingress is invalid");
    if (!confirmHighRisk(identity, "authorization.capability.renew", ingress)) {
      return failed("AUTHORIZATION_DENIED", "Trusted capability renewal confirmation is required", identity, { reason: "confirmation_required" });
    }
    const refreshedIdentity = refreshOperationTime(identity, ingress);
    if (refreshedIdentity === null) return failed("INVALID_INPUT", "Trusted renewal time could not be refreshed", identity);
    identity = refreshedIdentity;
    const minimumExpiry = new Date(new Date(identity.now).valueOf() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const maximumExpiry = new Date(new Date(identity.now).valueOf() + 31 * 24 * 60 * 60 * 1000).toISOString();
    if (command.expiresAt <= minimumExpiry || command.expiresAt > maximumExpiry) {
      return failed("INVALID_INPUT", "Capability renewal expiry is outside the finite window", identity);
    }
    const runtimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in runtimeIdentity) return runtimeIdentity;
    const preflightState = readApplicationStateForOwner(store);
    if (!authorizationMutationTimeIsCurrent(preflightState, identity.now)) {
      return failed("STALE_REVISION", "Trusted capability-renewal time precedes durable scheduler authorization evidence", identity);
    }
    const preflightAssessment = assessRenewal(preflightState, identity, runtimeIdentity);
    if (preflightAssessment === "not_initialized") {
      return failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity);
    }
    if (preflightAssessment === "authorization_denied") {
      return failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity);
    }
    if (preflightAssessment === "not_due") {
      return failed("CAPABILITY_RENEWAL_NOT_DUE", "Current capability origin is not eligible for renewal", identity);
    }
    const preflightStateSha256 = applicationStateSha256(preflightState);
    const preflightIdentityPresent = preflightState.identity !== null;
    const preflightEpochRevision = preflightState.epochs.at(-1)?.epochRevision ?? 0;
    const renewalActions = actionsForVocabulary(preflightAssessment.vocabularyVersion);
    let epochId: string;
    const grantIds: string[] = [];
    try {
      epochId = ingress.nextId("epoch");
      for (const action of renewalActions) {
        const grantId = ingress.nextId("grant");
        if (!operationalIdentifier(grantId) || grantIds.includes(grantId) || grantId === epochId) {
          return failed("INVALID_INPUT", `Trusted renewal grant identity is invalid or repeated for ${action}`, identity);
        }
        grantIds.push(grantId);
      }
    } catch {
      return failed("INVALID_INPUT", "Trusted renewal identities could not be obtained", identity);
    }
    if (!operationalIdentifier(epochId)) return failed("INVALID_INPUT", "Trusted capability epoch identity is invalid", identity);
    hooks.beforeTransaction?.();
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (!authorizationMutationTimeIsCurrent(state, identity.now)) {
        return failed("STALE_REVISION", "Trusted capability-renewal time precedes durable scheduler authorization evidence", identity);
      }
      if (
        applicationStateSha256(state) !== preflightStateSha256 ||
        (state.identity !== null) !== preflightIdentityPresent ||
        (state.epochs.at(-1)?.epochRevision ?? 0) !== preflightEpochRevision
      ) {
        return failed("STALE_REVISION", "Capability renewal preflight is stale", identity);
      }
      const assessment = assessRenewal(state, identity, runtimeIdentity);
      if (typeof assessment === "string") {
        return assessment === "not_due"
          ? failed("CAPABILITY_RENEWAL_NOT_DUE", "Current capability origin is not eligible for renewal", identity)
          : assessment === "not_initialized"
            ? failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity)
            : failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity);
      }
      if (
        assessment.mode !== preflightAssessment.mode ||
        assessment.nextEpochRevision !== preflightAssessment.nextEpochRevision ||
        assessment.vocabularyVersion !== preflightAssessment.vocabularyVersion
      ) {
        return failed("STALE_REVISION", "Capability renewal lineage is stale", identity);
      }
      const target: BoundTarget = Object.freeze({ kind: "runtime", id: "runtime", revision: null, project: null });
      transaction.insertRequest(requestRecord(identity, "authorization.capability.renew", target, "renewal"));
      hooks.afterStage?.("request");
      transaction.insertCapabilityEpoch(Object.freeze({
        epochId,
        epochRevision: assessment.nextEpochRevision,
        actorId: identity.actor.actorId,
        runtimeRootKey: runtimeIdentity.rootKey,
        vocabularyVersion: assessment.vocabularyVersion,
        actionSetSha256: assessment.vocabularyVersion === 1
          ? BASE_CAPABILITY_ACTION_SET_SHA256
          : assessment.vocabularyVersion === 2
            ? CLAIM_CAPABILITY_ACTION_SET_SHA256
            : assessment.vocabularyVersion === 3
              ? MANUAL_CAPABILITY_ACTION_SET_SHA256
              : assessment.vocabularyVersion === 4
                ? DISPATCHER_CAPABILITY_ACTION_SET_SHA256
                : assessment.vocabularyVersion === 5
                  ? WORKSPACE_CAPABILITY_ACTION_SET_SHA256
                  : assessment.vocabularyVersion === 6
                    ? PHASE3_CAPABILITY_ACTION_SET_SHA256
                    : assessment.vocabularyVersion === 7
                      ? SCHEDULER_CAPABILITY_ACTION_SET_SHA256
                      : CURRENT_CAPABILITY_ACTION_SET_SHA256,
        requestId: identity.requestId,
        createdAt: identity.now,
        expiresAt: command.expiresAt,
      }));
      hooks.afterStage?.("epoch");
      for (const [index, action] of renewalActions.entries()) {
        const grantId = grantIds[index];
        if (grantId === undefined) throw new TypeError("Trusted renewal grant identity is absent");
        transaction.insertGrant(Object.freeze({
          grantId,
          revision: 1,
          actorId: identity.actor.actorId,
          action,
          scope: Object.freeze({ kind: "runtime", projectId: null, resourceRevision: null, configRevision: null }),
          notBefore: identity.now,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: null,
          sourceGrantId: null,
          capabilityEpochId: epochId,
          createdRequestId: identity.requestId,
        }));
        hooks.afterStage?.(`grant:${action}`);
      }
      transaction.insertDecision(Object.freeze({
        decisionId: identity.decisionId,
        requestId: identity.requestId,
        actorId: identity.actor.actorId,
        action: "authorization.capability.renew" as const,
        result: "allow" as const,
        reason: "allowed" as const,
        policy: "allow" as const,
        grantId: null,
        grantRevision: null,
        projectId: null,
        resourceRevision: null,
        createdAt: identity.now,
      }));
      hooks.afterStage?.("decision");
      transaction.insertAudit(auditRecord(identity, target, "capability.renewed", "accepted", "accepted"));
      hooks.afterStage?.("audit");
      const readback = transaction.read();
      const epoch = readback.epochs.find((candidate) => candidate.epochId === epochId);
      if (epoch === undefined || epoch.epochRevision !== assessment.nextEpochRevision ||
          !grantIds.every((grantId) => readback.grants.some((grant) => grant.grantId === grantId))) {
        throw new TypeError("Capability renewal terminal readback did not match");
      }
      return succeeded(Object.freeze({
        mode: assessment.mode,
        expiresAt: epoch.expiresAt,
        capabilityCount: renewalActions.length,
        epochRevision: epoch.epochRevision,
      }), identity);
    });
  };

  const execute = (value: ApplicationCommand): ApplicationResult<unknown> => {
    const command = parseCommand(value);
    if (command === null) return failed("INVALID_INPUT", "Command or trusted ingress is invalid");
    let identity = operationIdentity(ingress);
    if (identity === null) return failed("INVALID_INPUT", "Command or trusted ingress is invalid");

    const preflightState = readApplicationStateForOwner(store);
    if (preflightState.bootstrap === null) {
      return failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity);
    }
    const preflightTarget = targetForCommand(command, preflightState);
    if ("ok" in preflightTarget) {
      return Object.freeze({ ...preflightTarget, requestId: identity.requestId, correlationId: identity.correlationId });
    }
    const preflightCommandAuthorization = authorizeCommand(identity, command, preflightTarget, preflightState, true);
    const preflightAuthorization = preflightCommandAuthorization.evaluation;
    const confirmed = isHighRiskAction(command.kind)
      ? preflightAuthorization.allowed && confirmHighRisk(identity, command.kind, ingress)
      : true;
    if (isHighRiskAction(command.kind)) {
      const refreshedIdentity = refreshOperationTime(identity, ingress);
      if (refreshedIdentity === null) return failed("INVALID_INPUT", "Trusted operation time could not be refreshed", identity);
      identity = refreshedIdentity;
    }
    if (changesAuthorizationGrants(command) && !authorizationMutationTimeIsCurrent(preflightState, identity.now)) {
      return failed("STALE_REVISION", "Trusted grant-mutation time precedes durable scheduler authorization evidence", identity);
    }

    let issuedGrantId: string | null = null;
    if (command.kind === "authorization.grant.issue") {
      try {
        issuedGrantId = ingress.nextId("grant");
      } catch {
        return failed("INVALID_INPUT", "Trusted grant identity could not be obtained", identity);
      }
      if (!operationalIdentifier(issuedGrantId)) return failed("INVALID_INPUT", "Trusted grant identity is invalid", identity);
    }
    let lifecycleAuthorizationId: string | null = null;
    if (command.kind === "runtime.backup" || command.kind === "runtime.restore") {
      try {
        lifecycleAuthorizationId = ingress.nextId("lifecycle");
      } catch {
        return failed("INVALID_INPUT", "Trusted lifecycle authorization identity could not be obtained", identity);
      }
      if (!operationalIdentifier(lifecycleAuthorizationId)) {
        return failed("INVALID_INPUT", "Trusted lifecycle authorization identity is invalid", identity);
      }
    }

    let preflightCancelProjectIds: readonly string[] | null = null;
    if (command.kind === "task.cancel" && preflightAuthorization.allowed) {
      const prospectiveMutation = domainMutation(command, preflightState);
      if (prospectiveMutation !== null && !("ok" in prospectiveMutation)) {
        preflightCancelProjectIds = affectedProjectIds(prospectiveMutation);
      }
    }

    const currentRuntimeIdentity = checkedRuntimeRoot(store.layout.root, identity);
    if ("ok" in currentRuntimeIdentity) return currentRuntimeIdentity;
    if (!sameRootIdentity(preflightState.bootstrap, currentRuntimeIdentity)) {
      return failed("AUTHORIZATION_DENIED", "Authorization bootstrap is bound to another runtime-root identity", identity, { reason: "scope_mismatch" });
    }
    const localIdentityRequired = identity.actor.actorId.startsWith("local-v1:") ||
      identity.actor.actorId === preflightState.identity?.actorId ||
      command.kind === "authorization.grant.list" || command.kind === "runtime.status" ||
      command.kind === "runtime.backup" || command.kind === "runtime.restore";
    if (localIdentityRequired && !sameLocalIdentity(preflightState, identity, currentRuntimeIdentity)) {
      return failed("AUTHORIZATION_DENIED", "Trusted local identity does not match the initialized runtime", identity, { reason: "actor_mismatch" });
    }
    let registrationIdentity: ProjectRootIdentity | null = null;
    if (command.kind === "project.register") {
      try {
        registrationIdentity = inspectProjectRoot(command.root, store.layout.root);
      } catch (error) {
        return projectRegistryFailure(error, identity);
      }
    }
    if (registrationIdentity !== null) {
      const checked = checkedProjectRoot(registrationIdentity, store.layout.root, identity);
      if ("ok" in checked) return checked;
      registrationIdentity = checked;
    }
    let preflightProjectIdentity: ProjectRootIdentity | null = null;
    if (preflightTarget.project !== null) {
      const checked = checkedProjectRoot(preflightTarget.project, store.layout.root, identity);
      if ("ok" in checked) return checked;
      preflightProjectIdentity = checked;
    }
    const affectedProjectPreflights = new Map<string, AffectedProjectPreflight>();
    if (preflightCancelProjectIds !== null) {
      for (const projectId of preflightCancelProjectIds) {
        const project = projectById(preflightState, projectId);
        if (project === null) {
          return failed(
            "PROJECT_REGISTRY_REJECTED",
            "An affected Domain Project is not registered in ProjectRegistry",
            identity,
            { registryCode: "PROJECT_IDENTITY_UNCERTAIN", projectId },
          );
        }
        let checked: ProjectRootIdentity | ApplicationFailure;
        if (preflightTarget.project?.projectId === projectId && preflightProjectIdentity !== null) {
          checked = preflightProjectIdentity;
        } else {
          checked = checkedProjectRoot(project, store.layout.root, identity);
        }
        if ("ok" in checked) return checked;
        affectedProjectPreflights.set(projectId, Object.freeze({ project, identity: checked }));
      }
    }

    hooks.beforeTransaction?.();
    return withApplicationTransaction(store, (transaction) => {
      const state = transaction.read();
      if (state.bootstrap === null) return failed("BOOTSTRAP_REQUIRED", "Trusted authorization bootstrap has not been completed", identity);
      if (changesAuthorizationGrants(command) && !authorizationMutationTimeIsCurrent(state, identity.now)) {
        return failed("STALE_REVISION", "Trusted grant-mutation time precedes durable scheduler authorization evidence", identity);
      }
      if (!sameRootIdentity(state.bootstrap, currentRuntimeIdentity)) {
        return failed("AUTHORIZATION_DENIED", "Authorization bootstrap is bound to another runtime-root identity", identity, { reason: "scope_mismatch" });
      }
      if (localIdentityRequired && !sameLocalIdentity(state, identity, currentRuntimeIdentity)) {
        return failed("AUTHORIZATION_DENIED", "Trusted local identity changed after preflight", identity, { reason: "actor_mismatch" });
      }
      let target = targetForCommand(command, state);
      if ("ok" in target) return Object.freeze({ ...target, requestId: identity.requestId, correlationId: identity.correlationId });
      if (
        target.project !== null &&
        (preflightProjectIdentity === null || !sameRootIdentity(target.project, preflightProjectIdentity))
      ) {
        return failed(
          "PROJECT_REGISTRY_REJECTED",
          "Project identity changed after trusted preflight",
          identity,
          { registryCode: "PROJECT_IDENTITY_CHANGED" },
        );
      }

      if (command.kind === "authorization.grant.issue" && command.scope.kind === "project") {
        const current = command.scope.projectId === null ? null : projectById(state, command.scope.projectId);
        if (
          current === null ||
          current.resourceRevision !== command.scope.resourceRevision ||
          current.configRevision !== command.scope.configRevision
        ) {
          return recordDenied(transaction, identity, command.kind, target, staleEvaluation("read_not_applicable"), hooks);
        }
        target = Object.freeze({ ...target, project: current });
      }

      if (isExistingProjectCommand(command)) {
        const expectedConfig = command.kind === "project.inspect" ? null : command.expectedConfigRevision;
        const current = ensureCurrentProject(state, command.projectId, command.expectedResourceRevision, expectedConfig);
        if ("ok" in current) {
          const denied = staleEvaluation(command.kind === "project.inspect" ? "read_not_applicable" : "allow");
          return recordDenied(transaction, identity, command.kind, target, denied, hooks);
        }
        target = Object.freeze({ ...target, project: current });
      }
      if (command.kind === "policy.evaluate") {
        const current = ensureCurrentProject(state, command.projectId, command.expectedResourceRevision, command.expectedConfigRevision);
        if ("ok" in current) return recordDenied(transaction, identity, command.kind, target, staleEvaluation("read_not_applicable"), hooks);
        target = Object.freeze({ ...target, project: current });
      }
      if (isDomainApplicationCommand(command)) {
        const current = ensureCurrentProject(state, command.projectId, command.expectedProjectResourceRevision, null);
        if ("ok" in current) return recordDenied(transaction, identity, command.kind, target, staleEvaluation(policyFor(command.kind, target.project, state)), hooks);
        target = Object.freeze({ ...target, project: current });
      }
      if (command.kind === "authorization.grant.inspect" || command.kind === "authorization.grant.revoke") {
        const grant = state.grants.find((candidate) => candidate.grantId === command.grantId);
        if (grant === undefined) return failed("GRANT_NOT_FOUND", "Grant is not registered", identity);
        if (grant.revision !== command.expectedGrantRevision) {
          return recordDenied(transaction, identity, command.kind, target, staleEvaluation("read_not_applicable"), hooks);
        }
      }

      const commandAuthorization = authorizeCommand(identity, command, target, state, confirmed);
      let evaluation = commandAuthorization.evaluation;
      const issuanceProof = commandAuthorization.issuanceProof;
      if (!evaluation.allowed) {
        const denial = recordDenied(transaction, identity, command.kind, target, evaluation, hooks);
        return command.kind === "authorization.grant.issue" && evaluation.reason === "scope_mismatch"
          ? failed("SCOPE_EXPANSION_DENIED", "Requested grant exceeds the current issuance authority", identity)
          : denial;
      }

      const mutation = domainMutation(command, state);
      if (mutation !== null && "ok" in mutation) {
        return Object.freeze({ ...mutation, requestId: identity.requestId, correlationId: identity.correlationId });
      }
      if (command.kind === "task.cancel" && mutation !== null) {
        const changedProjectIds = affectedProjectIds(mutation);
        if (preflightCancelProjectIds === null || !sameProjectIds(changedProjectIds, preflightCancelProjectIds)) {
          return recordDenied(
            transaction,
            identity,
            command.kind,
            target,
            staleEvaluation(evaluation.policy),
            hooks,
          );
        }
        for (const projectId of changedProjectIds) {
          const captured = affectedProjectPreflights.get(projectId);
          const current = projectById(state, projectId);
          if (captured === undefined || current === null) {
            return failed(
              "PROJECT_REGISTRY_REJECTED",
              "An affected ProjectRegistry binding is absent after trusted preflight",
              identity,
              { registryCode: "PROJECT_IDENTITY_UNCERTAIN", projectId },
            );
          }
          if (
            current.configRevision !== captured.project.configRevision ||
            current.resourceRevision !== captured.project.resourceRevision
          ) {
            return recordDenied(
              transaction,
              identity,
              command.kind,
              target,
              staleEvaluation(evaluation.policy),
              hooks,
            );
          }
          if (!sameProjectBinding(current, captured.project) || !sameRootIdentity(current, captured.identity)) {
            return failed(
              "PROJECT_REGISTRY_REJECTED",
              "An affected Project identity changed after trusted preflight",
              identity,
              { registryCode: "PROJECT_IDENTITY_CHANGED", projectId },
            );
          }
          if (policyFor(command.kind, current, state) !== "allow") {
            return recordDenied(
              transaction,
              identity,
              command.kind,
              target,
              Object.freeze({ ...evaluation, allowed: false, reason: "policy_denied", policy: "deny" }),
              hooks,
            );
          }
        }
        if (changedProjectIds.length !== 1 || changedProjectIds[0] !== command.projectId) {
          const runtimeEvaluation = authorize(identity, command.kind, target, state, confirmed, "runtime");
          if (!runtimeEvaluation.allowed) {
            const runtimeCapabilityAbsent = runtimeEvaluation.reason === "actor_mismatch" ||
              runtimeEvaluation.reason === "action_mismatch" || runtimeEvaluation.reason === "grant_missing" ||
              runtimeEvaluation.reason === "scope_mismatch";
            return recordDenied(
              transaction,
              identity,
              command.kind,
              target,
              runtimeCapabilityAbsent
                ? Object.freeze({ ...evaluation, allowed: false, reason: "scope_mismatch" })
                : runtimeEvaluation,
              hooks,
            );
          }
          evaluation = runtimeEvaluation;
        }
      }
      const selectedProjectMutation = projectDomainMutation(command, state, identity);
      if (selectedProjectMutation !== null && "ok" in selectedProjectMutation) return selectedProjectMutation;
      const projectMutation: ProjectDomainMutation | null = selectedProjectMutation;

      if (command.kind === "project.register") {
        if (state.projects.some((project) => project.projectId === command.projectId || project.rootKey === registrationIdentity?.rootKey)) {
          return failed("PROJECT_ALREADY_REGISTERED", "Project identity or canonical root is already registered", identity);
        }
      }

      if (command.kind === "authorization.grant.issue") {
        if (issuedGrantId === null) throw new TypeError("Trusted grant identity is absent");
        target = Object.freeze({ ...target, id: issuedGrantId });
      }

      transaction.insertRequest(requestRecord(identity, command.kind, target, "allow"));
      hooks.afterStage?.("request");

      if (command.kind === "authorization.grant.issue") {
        if (issuedGrantId === null) throw new TypeError("Trusted grant identity is absent");
        if (issuanceProof === null) throw new TypeError("Grant issuance proof is absent");
        const record: NewGrantRecord = Object.freeze({
          grantId: issuedGrantId,
          revision: 1,
          actorId: command.actorId,
          action: command.action,
          scope: command.scope,
          notBefore: command.notBefore,
          expiresAt: command.expiresAt,
          revokedAt: null,
          issuerGrantId: issuanceProof.administrativeGrantId,
          sourceGrantId: issuanceProof.sourceGrantId,
          createdRequestId: identity.requestId,
        });
        transaction.insertGrant(record);
        hooks.afterStage?.("grant");
        target = Object.freeze({ ...target, id: issuedGrantId });
      } else if (command.kind === "authorization.grant.revoke") {
        transaction.revokeGrant(command.grantId, command.expectedGrantRevision, identity.now, identity.requestId);
        hooks.afterStage?.("grant");
      } else if (command.kind === "project.register") {
        if (registrationIdentity === null) throw new TypeError("Project identity preflight is absent");
        const projectResult = projectRegistrationMutation(state, command.projectId);
        if (projectResult !== null) {
          transaction.writeProjectDomain(state.domain, projectResult);
          hooks.afterStage?.("domain");
        }
        const project: RegisteredProject = Object.freeze({
          ...registrationIdentity,
          projectId: command.projectId,
          configRevision: 1,
          resourceRevision: 1,
          createdAt: identity.now,
          updatedAt: identity.now,
        });
        transaction.insertProject(project);
        hooks.afterStage?.("registry");
      } else if (command.kind === "project.update") {
        const current = target.project as RegisteredProject;
        if (preflightProjectIdentity === null) throw new TypeError("Project identity preflight is absent");
        if (projectMutation !== null) {
          transaction.writeProjectDomain(state.domain, projectMutation);
          hooks.afterStage?.("domain");
        }
        const next: RegisteredProject = Object.freeze({
          ...preflightProjectIdentity,
          projectId: current.projectId,
          configRevision: current.configRevision + 1,
          resourceRevision: current.resourceRevision + 1,
          createdAt: current.createdAt,
          updatedAt: identity.now,
        });
        transaction.updateProject(next, current.configRevision, current.resourceRevision);
        hooks.afterStage?.("registry");
      } else if (command.kind === "project.disable") {
        const current = target.project as RegisteredProject;
        if (projectMutation === null) throw new TypeError("Project disablement mutation is absent");
        transaction.writeProjectDomain(state.domain, projectMutation);
        hooks.afterStage?.("domain");
        transaction.updateProject(Object.freeze({
          ...current,
          configRevision: current.configRevision + 1,
          resourceRevision: current.resourceRevision + 1,
          updatedAt: identity.now,
        }), current.configRevision, current.resourceRevision);
        hooks.afterStage?.("registry");
      } else if (mutation !== null) {
        transaction.writeDomain(state.domain, mutation as DomainMutation);
        hooks.afterStage?.("domain");
      }

      transaction.insertDecision(decisionRecord(identity, command.kind, target, evaluation));
      hooks.afterStage?.("decision");
      transaction.insertAudit(auditRecord(identity, target, applicationAuditKind(command.kind), "accepted", "accepted"));
      hooks.afterStage?.("audit");
      if (command.kind === "runtime.backup" || command.kind === "runtime.restore") {
        if (lifecycleAuthorizationId === null || evaluation.grantId === null || evaluation.grantRevision === null) {
          throw new TypeError("Lifecycle authorization evidence is incomplete");
        }
        const authorizedState = transaction.read();
        const localIdentity = authorizedState.identity;
        const evaluatedGrant = authorizedState.grants.find((grant) => grant.grantId === evaluation.grantId);
        if (
          localIdentity === null ||
          localIdentity.actorId !== identity.actor.actorId ||
          evaluatedGrant === undefined ||
          evaluatedGrant.revision !== evaluation.grantRevision ||
          evaluatedGrant.revokedAt !== null
        ) {
          throw new TypeError("Lifecycle authorization changed before durable handoff");
        }
        const fiveMinutes = new Date(new Date(identity.now).valueOf() + 5 * 60 * 1000).toISOString();
        transaction.insertLifecycleAuthorization(Object.freeze({
          authorizationId: lifecycleAuthorizationId,
          operation: command.kind,
          backupGenerationId: command.backupGenerationId,
          actorId: identity.actor.actorId,
          runtimeRootKey: localIdentity.runtimeRootKey,
          grantId: evaluatedGrant.grantId,
          grantRevision: evaluatedGrant.revision,
          requestId: identity.requestId,
          decisionId: identity.decisionId,
          auditId: identity.auditId,
          authorizedStateSha256: transaction.stateSha256(),
          expectedRequestCount: authorizedState.requests.length,
          expectedDecisionCount: authorizedState.decisions.length,
          expectedAuditCount: authorizedState.audit.length,
          issuedAt: identity.now,
          expiresAt: evaluatedGrant.expiresAt < fiveMinutes ? evaluatedGrant.expiresAt : fiveMinutes,
        }));
        hooks.afterStage?.("lifecycle");
      }
      const readback = transaction.read();
      if (lifecycleAuthorizationId !== null) {
        const authorization = readback.lifecycle.find(
          (candidate) => candidate.authorizationId === lifecycleAuthorizationId,
        );
        if (authorization === undefined) {
          throw new TypeError("Lifecycle terminal readback is absent");
        }
        return succeeded(authorization, identity);
      }
      if (issuedGrantId !== null) {
        const grant = readback.grants.find((candidate) => candidate.grantId === issuedGrantId);
        if (grant === undefined) throw new TypeError("Grant terminal readback is absent");
        return succeeded(grant, identity);
      }
      return succeeded(outputFor(command, readback, store.migration.schemaVersion), identity);
    });
  };

  return Object.freeze({
    bootstrap,
    upgrade,
    renew,
    execute,
  });
}

export function createApplicationService(
  store: PersistenceStore,
  ingress: ApplicationIngress,
): ApplicationService {
  return createApplicationServiceInternal(store, ingress, Object.freeze({}));
}

export function createApplicationServiceWithHooks(
  store: PersistenceStore,
  ingress: ApplicationIngress,
  hooks: ApplicationTestHooks,
): ApplicationService {
  return createApplicationServiceInternal(store, ingress, hooks);
}
