import type { SqliteDatabase } from "./database.ts";
import { persistenceFailure } from "./errors.ts";
import { applicationStateSha256, lifecycleAuthorizationProjection } from "./application-repository-digest.ts";
import type { ApplicationLifecycleAuthorization, ApplicationState } from "./application-repository-model.ts";
import { readApplicationState, readApplicationStateUntransactional } from "./application-repository-state.ts";
import { canonicalJson, isCanonicalUtcTimestamp } from "./values.ts";

function validateLifecycleAuthorizationState(
  state: ApplicationState,
  handoff: ApplicationLifecycleAuthorization,
  operation: ApplicationLifecycleAuthorization["operation"],
  generationId: string,
  now: string,
): Readonly<{
  authorization: ApplicationLifecycleAuthorization;
  stateSha256: string;
  stateDigestVersion: 4;
}> {
  if (!isCanonicalUtcTimestamp(now)) throw persistenceFailure("INVALID_INPUT", "Lifecycle validation time is invalid");
  const authorization = state.lifecycle.find((candidate) => candidate.authorizationId === handoff.authorizationId);
  if (
    authorization === undefined ||
    canonicalJson(lifecycleAuthorizationProjection(authorization)) !== canonicalJson(lifecycleAuthorizationProjection(handoff)) ||
    authorization.operation !== operation ||
    authorization.backupGenerationId !== generationId
  ) {
    throw persistenceFailure("AUTHORIZATION_DENIED", "Lifecycle authorization handoff is absent or mismatched");
  }
  const grant = state.grants.find((candidate) => candidate.grantId === authorization.grantId);
  if (
    grant === undefined ||
    grant.revision !== authorization.grantRevision ||
    grant.revokedAt !== null ||
    grant.actorId !== authorization.actorId ||
    grant.action !== operation ||
    now >= authorization.expiresAt
  ) {
    throw persistenceFailure("AUTHORIZATION_DENIED", "Lifecycle authorization is no longer current");
  }
  const stateDigestVersion = 4 as const;
  const stateSha256 = applicationStateSha256(state);
  if (
    stateSha256 !== authorization.authorizedStateSha256 ||
    state.requests.length !== authorization.expectedRequestCount ||
    state.decisions.length !== authorization.expectedDecisionCount ||
    state.audit.length !== authorization.expectedAuditCount
  ) {
    throw persistenceFailure("BACKUP_CONFLICT", "Application state changed after lifecycle authorization");
  }
  return Object.freeze({ authorization, stateSha256, stateDigestVersion });
}

export function validateLifecycleAuthorizationForUse(
  database: SqliteDatabase,
  handoff: ApplicationLifecycleAuthorization,
  operation: ApplicationLifecycleAuthorization["operation"],
  generationId: string,
  now: string,
): Readonly<{
  authorization: ApplicationLifecycleAuthorization;
  stateSha256: string;
  stateDigestVersion: 4;
}> {
  return validateLifecycleAuthorizationState(readApplicationState(database), handoff, operation, generationId, now);
}

export function validateLifecycleAuthorizationForUseUntransactional(
  database: SqliteDatabase,
  handoff: ApplicationLifecycleAuthorization,
  operation: ApplicationLifecycleAuthorization["operation"],
  generationId: string,
  now: string,
): Readonly<{
  authorization: ApplicationLifecycleAuthorization;
  stateSha256: string;
  stateDigestVersion: 4;
}> {
  return validateLifecycleAuthorizationState(readApplicationStateUntransactional(database), handoff, operation, generationId, now);
}
