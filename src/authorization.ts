export const PHASE1_AUTHORIZATION_ACTIONS = Object.freeze([
  "authorization.grant.issue",
  "authorization.grant.inspect",
  "authorization.grant.revoke",
  "policy.evaluate",
  "project.register",
  "project.update",
  "project.disable",
  "project.inspect",
  "task.create",
  "task.update",
  "task.mark_ready",
  "task.cancel",
  "task.inspect",
  "dependency.add",
  "dependency.remove",
  "authorization.grant.list",
  "runtime.status",
  "runtime.backup",
  "runtime.restore",
] as const);

export const EXECUTION_AUTHORIZATION_ACTIONS = Object.freeze([
  "execution.claim",
  "execution.claim.inspect",
  "execution.lease.renew",
  "execution.lease.takeover",
] as const);

export const AUTHORIZATION_ACTIONS = Object.freeze([
  ...PHASE1_AUTHORIZATION_ACTIONS,
  ...EXECUTION_AUTHORIZATION_ACTIONS,
] as const);

export const HIGH_RISK_ACTIONS = Object.freeze([
  "authorization.grant.issue",
  "authorization.grant.revoke",
  "project.register",
  "project.update",
  "project.disable",
  "runtime.restore",
] as const);

export type AuthorizationAction = (typeof AUTHORIZATION_ACTIONS)[number];
export type AuthorizationPolicyResult = "allow" | "deny" | "read_not_applicable";
export type AuthorizationReason =
  | "allowed"
  | "actor_mismatch"
  | "action_mismatch"
  | "scope_mismatch"
  | "scope_revision_stale"
  | "grant_expired"
  | "grant_not_yet_valid"
  | "grant_revoked"
  | "grant_missing"
  | "policy_denied"
  | "confirmation_required";

export interface AuthorizationScope {
  readonly kind: "runtime" | "project";
  readonly projectId: string | null;
  readonly resourceRevision: number | null;
  readonly configRevision: number | null;
}

export interface AuthorizationGrant {
  readonly grantId: string;
  readonly revision: number;
  readonly actorId: string;
  readonly action: AuthorizationAction;
  readonly scope: AuthorizationScope;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly issuerGrantId: string | null;
  readonly sourceGrantId: string | null;
}

export interface AuthorizationTarget {
  readonly projectId: string | null;
  readonly resourceRevision: number | null;
  readonly configRevision: number | null;
}

export interface AuthorizationEvaluationInput {
  readonly actorId: string;
  readonly action: AuthorizationAction;
  readonly target: AuthorizationTarget;
  readonly now: string;
  readonly policy: AuthorizationPolicyResult;
  readonly confirmed: boolean;
  readonly grants: readonly AuthorizationGrant[];
}

export interface AuthorizationEvaluation {
  readonly allowed: boolean;
  readonly reason: AuthorizationReason;
  readonly policy: AuthorizationPolicyResult;
  readonly grantId: string | null;
  readonly grantRevision: number | null;
}

type UnknownRecord = Record<string, unknown>;

function exactRecord(value: unknown, keys: readonly string[]): Readonly<UnknownRecord> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const expected = new Set(keys);
    const copy: UnknownRecord = Object.create(null) as UnknownRecord;
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

function canonicalArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (length === undefined || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 0) return null;
    if (Reflect.ownKeys(value).length !== length.value + 1) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const item = Object.getOwnPropertyDescriptor(value, String(index));
      if (item === undefined || !("value" in item) || !item.enumerable) return null;
      result.push(item.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function domainIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

export function isAuthorizationAction(value: unknown): value is AuthorizationAction {
  return typeof value === "string" && (AUTHORIZATION_ACTIONS as readonly string[]).includes(value);
}

export function isHighRiskAction(value: AuthorizationAction): boolean {
  return (HIGH_RISK_ACTIONS as readonly AuthorizationAction[]).includes(value);
}

function parseScope(value: unknown): AuthorizationScope | null {
  const record = exactRecord(value, ["kind", "projectId", "resourceRevision", "configRevision"]);
  if (record === null || (record.kind !== "runtime" && record.kind !== "project")) return null;
  if (record.kind === "runtime") {
    if (record.projectId !== null || record.resourceRevision !== null || record.configRevision !== null) return null;
  } else if (!domainIdentifier(record.projectId) || !revision(record.resourceRevision) || !revision(record.configRevision)) {
    return null;
  }
  return Object.freeze({
    kind: record.kind,
    projectId: record.projectId as string | null,
    resourceRevision: record.resourceRevision as number | null,
    configRevision: record.configRevision as number | null,
  });
}

export function parseAuthorizationGrant(value: unknown): AuthorizationGrant | null {
  const record = exactRecord(value, [
    "grantId",
    "revision",
    "actorId",
    "action",
    "scope",
    "notBefore",
    "expiresAt",
    "revokedAt",
    "issuerGrantId",
    "sourceGrantId",
  ]);
  if (record === null) return null;
  const scope = parseScope(record.scope);
  if (
    !identifier(record.grantId) ||
    !revision(record.revision) ||
    !identifier(record.actorId) ||
    !isAuthorizationAction(record.action) ||
    scope === null ||
    !timestamp(record.notBefore) ||
    !timestamp(record.expiresAt) ||
    !(record.revokedAt === null || timestamp(record.revokedAt)) ||
    !(record.issuerGrantId === null || identifier(record.issuerGrantId)) ||
    !(record.sourceGrantId === null || identifier(record.sourceGrantId)) ||
    record.notBefore >= record.expiresAt
  ) {
    return null;
  }
  return Object.freeze({
    grantId: record.grantId,
    revision: record.revision,
    actorId: record.actorId,
    action: record.action,
    scope,
    notBefore: record.notBefore,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    issuerGrantId: record.issuerGrantId,
    sourceGrantId: record.sourceGrantId,
  });
}

function scopeMatches(scope: AuthorizationScope, target: AuthorizationTarget): boolean {
  if (scope.kind === "runtime") return true;
  return (
    target.projectId === scope.projectId &&
    target.resourceRevision === scope.resourceRevision &&
    target.configRevision === scope.configRevision
  );
}

function evaluation(
  allowed: boolean,
  reason: AuthorizationReason,
  policy: AuthorizationPolicyResult,
  grant: AuthorizationGrant | null,
): AuthorizationEvaluation {
  return Object.freeze({
    allowed,
    reason,
    policy,
    grantId: grant?.grantId ?? null,
    grantRevision: grant?.revision ?? null,
  });
}

export function evaluateAuthorization(value: unknown): AuthorizationEvaluation {
  const input = exactRecord(value, ["actorId", "action", "target", "now", "policy", "confirmed", "grants"]);
  if (input === null || !identifier(input.actorId) || !isAuthorizationAction(input.action) || !timestamp(input.now)) {
    return evaluation(false, "grant_missing", "deny", null);
  }
  const target = exactRecord(input.target, ["projectId", "resourceRevision", "configRevision"]);
  const grants = canonicalArray(input.grants);
  if (
    target === null ||
    !(target.projectId === null || domainIdentifier(target.projectId)) ||
    !(target.resourceRevision === null || revision(target.resourceRevision)) ||
    !(target.configRevision === null || revision(target.configRevision)) ||
    (input.policy !== "allow" && input.policy !== "deny" && input.policy !== "read_not_applicable") ||
    typeof input.confirmed !== "boolean" ||
    grants === null
  ) {
    return evaluation(false, "grant_missing", "deny", null);
  }
  const parsedGrants = grants.map(parseAuthorizationGrant);
  if (parsedGrants.some((grant) => grant === null)) return evaluation(false, "grant_missing", "deny", null);
  const typedTarget = target as unknown as AuthorizationTarget;
  const actorGrants = (parsedGrants as readonly AuthorizationGrant[]).filter((grant) => grant.actorId === input.actorId);
  if (actorGrants.length === 0) return evaluation(false, "actor_mismatch", input.policy, null);
  const actionGrants = actorGrants.filter((grant) => grant.action === input.action);
  if (actionGrants.length === 0) return evaluation(false, "action_mismatch", input.policy, null);
  let firstReason: AuthorizationReason = "grant_missing";
  for (const grant of actionGrants) {
    if (grant.revokedAt !== null) {
      firstReason = "grant_revoked";
      continue;
    }
    if (input.now < grant.notBefore) {
      firstReason = "grant_not_yet_valid";
      continue;
    }
    if (input.now >= grant.expiresAt) {
      firstReason = "grant_expired";
      continue;
    }
    if (!scopeMatches(grant.scope, typedTarget)) {
      firstReason = grant.scope.kind === "project" && grant.scope.projectId === target.projectId
        ? "scope_revision_stale"
        : "scope_mismatch";
      continue;
    }
    if (input.policy === "deny") return evaluation(false, "policy_denied", "deny", grant);
    if (isHighRiskAction(input.action) && input.confirmed !== true) {
      return evaluation(false, "confirmation_required", input.policy, grant);
    }
    return evaluation(true, "allowed", input.policy, grant);
  }
  return evaluation(false, firstReason, input.policy, null);
}

export interface GrantIssueCandidate {
  readonly actorId: string;
  readonly action: AuthorizationAction;
  readonly scope: AuthorizationScope;
  readonly notBefore: string;
  readonly expiresAt: string;
}

export interface GrantIssueProof {
  readonly administrativeGrantId: string;
  readonly sourceGrantId: string;
}

export function canIssueGrant(
  issuerActorId: string,
  issuerGrants: readonly AuthorizationGrant[],
  candidate: GrantIssueCandidate,
  now: string,
): GrantIssueProof | null {
  if (!identifier(issuerActorId) || !identifier(candidate.actorId) || !timestamp(now) || !timestamp(candidate.notBefore) || !timestamp(candidate.expiresAt)) {
    return null;
  }
  if (candidate.notBefore < now || candidate.notBefore >= candidate.expiresAt || candidate.expiresAt <= now) return null;
  const administrative = issuerGrants.filter(
    (grant) => grant.actorId === issuerActorId && grant.action === "authorization.grant.issue",
  );
  const source = issuerGrants.filter(
    (grant) => grant.actorId === issuerActorId && grant.action === candidate.action,
  );
  const target = {
    projectId: candidate.scope.projectId,
    resourceRevision: candidate.scope.resourceRevision,
    configRevision: candidate.scope.configRevision,
  };
  for (const admin of administrative) {
    for (const authority of source) {
      if (
        admin.revokedAt === null &&
        authority.revokedAt === null &&
        admin.notBefore <= now &&
        authority.notBefore <= now &&
        admin.expiresAt >= candidate.expiresAt &&
        authority.expiresAt >= candidate.expiresAt &&
        scopeMatches(admin.scope, target) &&
        scopeMatches(authority.scope, target)
      ) {
        return Object.freeze({
          administrativeGrantId: admin.grantId,
          sourceGrantId: authority.grantId,
        });
      }
    }
  }
  return null;
}
