import {
  PHASE1_AUTHORIZATION_ACTIONS,
  isAuthorizationAction,
  isHighRiskAction,
  type AuthorizationScope,
} from "./authorization.ts";
import {
  inspectTrustedRuntimeRoot,
  ProjectRegistryError,
  revalidateProjectRoot,
  type ProjectRootIdentity,
} from "./project-registry.ts";
import type { ApplicationAction } from "./persistence/application-repository.ts";
import type {
  ApplicationCommand,
  ApplicationDetail,
  ApplicationError,
  ApplicationErrorCode,
  ApplicationFailure,
  ApplicationIngress,
  ApplicationSuccess,
  BootstrapCommand,
  CapabilityUpgradeCommand,
  OperationIdentity,
  RenewalCommand,
  TrustedActorAssertion,
  UnknownRecord,
} from "./application-model.ts";

function exactRecord(value: unknown, keys: readonly string[]): Readonly<UnknownRecord> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const allowed = new Set(keys);
    const result: UnknownRecord = Object.create(null) as UnknownRecord;
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

export function operationalIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function domainIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function nonempty(value: unknown, maximum = 16_384): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !value.includes("\0");
}

const FORBIDDEN_CANCELLATION_REASON_TEXT = /[\p{Cc}\p{Cf}]/u;

function wellFormedText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

export function isCanonicalCancellationReason(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !wellFormedText(value) ||
    FORBIDDEN_CANCELLATION_REASON_TEXT.test(value) ||
    value.normalize("NFC") !== value
  ) {
    return false;
  }
  const encodedBytes = new TextEncoder().encode(value).byteLength;
  return encodedBytes >= 1 && encodedBytes <= 4096;
}

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function appError(
  code: ApplicationErrorCode,
  message: string,
  details: Readonly<Record<string, ApplicationDetail>> = {},
): ApplicationError {
  return Object.freeze({ code, message, details: Object.freeze({ ...details }) });
}

export function failed(
  code: ApplicationErrorCode,
  message: string,
  identity: OperationIdentity | null = null,
  details: Readonly<Record<string, ApplicationDetail>> = {},
): ApplicationFailure {
  return Object.freeze({
    ok: false,
    error: appError(code, message, details),
    requestId: identity?.requestId ?? null,
    correlationId: identity?.correlationId ?? null,
  });
}

export function succeeded<T>(value: T, identity: OperationIdentity): ApplicationSuccess<T> {
  return Object.freeze({ ok: true, value, requestId: identity.requestId, correlationId: identity.correlationId });
}

export function projectRegistryFailure(error: unknown, identity: OperationIdentity): ApplicationFailure {
  if (!(error instanceof ProjectRegistryError)) throw error;
  return failed(
    "PROJECT_REGISTRY_REJECTED",
    "Project or runtime root identity could not be established safely",
    identity,
    { registryCode: error.code },
  );
}

export function checkedRuntimeRoot(runtimeRoot: string, identity: OperationIdentity): ProjectRootIdentity | ApplicationFailure {
  try {
    return inspectTrustedRuntimeRoot(runtimeRoot);
  } catch (error) {
    return projectRegistryFailure(error, identity);
  }
}

export function checkedProjectRoot(
  receipt: ProjectRootIdentity,
  runtimeRoot: string,
  identity: OperationIdentity,
): ProjectRootIdentity | ApplicationFailure {
  try {
    return revalidateProjectRoot(receipt, runtimeRoot);
  } catch (error) {
    return projectRegistryFailure(error, identity);
  }
}

function parseActor(value: unknown): TrustedActorAssertion | null {
  const record = exactRecord(value, ["actorId", "principal"]);
  if (record === null || !operationalIdentifier(record.actorId) || !nonempty(record.principal, 256)) return null;
  return Object.freeze({ actorId: record.actorId, principal: record.principal });
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

export function parseCommand(value: unknown): ApplicationCommand | null {
  let kind: ApplicationCommand["kind"];
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      typeof descriptor.value !== "string" ||
      !(PHASE1_AUTHORIZATION_ACTIONS as readonly string[]).includes(descriptor.value)
    ) return null;
    kind = descriptor.value as ApplicationCommand["kind"];
  } catch {
    return null;
  }
  const expectedKeys = (() => {
    switch (kind) {
      case "authorization.grant.issue": return ["kind", "actorId", "action", "scope", "notBefore", "expiresAt"];
      case "authorization.grant.inspect":
      case "authorization.grant.revoke": return ["kind", "grantId", "expectedGrantRevision"];
      case "policy.evaluate": return ["kind", "projectId", "expectedResourceRevision", "expectedConfigRevision", "action"];
      case "project.register": return ["kind", "projectId", "root"];
      case "project.update":
      case "project.disable": return ["kind", "projectId", "expectedResourceRevision", "expectedConfigRevision"];
      case "project.inspect": return ["kind", "projectId", "expectedResourceRevision"];
      case "task.create": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "body", "supersedesTaskId"];
      case "task.update": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision", "change"];
      case "task.mark_ready":
      case "task.inspect": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision"];
      case "task.cancel": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision", "reason"];
      case "dependency.add":
      case "dependency.remove": return ["kind", "projectId", "expectedProjectResourceRevision", "taskId", "expectedTaskRevision", "dependencyId", "expectedDependencyRevision"];
      case "authorization.grant.list": return ["kind", "limit", "afterGrantId"];
      case "runtime.status": return ["kind"];
      case "runtime.backup":
      case "runtime.restore": return ["kind", "backupGenerationId"];
    }
  })();
  const record = exactRecord(value, expectedKeys);
  if (record === null) return null;
  if (kind === "authorization.grant.list") {
    return Number.isSafeInteger(record.limit) && (record.limit as number) >= 1 && (record.limit as number) <= 100 &&
      (record.afterGrantId === null || operationalIdentifier(record.afterGrantId))
      ? Object.freeze({ kind, limit: record.limit as number, afterGrantId: record.afterGrantId as string | null })
      : null;
  }
  if (kind === "runtime.status") return Object.freeze({ kind });
  if (kind === "runtime.backup" || kind === "runtime.restore") {
    return operationalIdentifier(record.backupGenerationId)
      ? Object.freeze({ kind, backupGenerationId: record.backupGenerationId })
      : null;
  }
  if (kind === "authorization.grant.issue") {
    const scope = parseScope(record.scope);
    return operationalIdentifier(record.actorId) && isAuthorizationAction(record.action) && scope !== null && timestamp(record.notBefore) && timestamp(record.expiresAt)
      ? Object.freeze({ kind, actorId: record.actorId, action: record.action, scope, notBefore: record.notBefore, expiresAt: record.expiresAt })
      : null;
  }
  if (kind === "authorization.grant.inspect" || kind === "authorization.grant.revoke") {
    return operationalIdentifier(record.grantId) && revision(record.expectedGrantRevision)
      ? Object.freeze({ kind, grantId: record.grantId, expectedGrantRevision: record.expectedGrantRevision })
      : null;
  }
  if (kind === "policy.evaluate") {
    return domainIdentifier(record.projectId) && revision(record.expectedResourceRevision) && revision(record.expectedConfigRevision) && isAuthorizationAction(record.action)
      ? Object.freeze({ kind, projectId: record.projectId, expectedResourceRevision: record.expectedResourceRevision, expectedConfigRevision: record.expectedConfigRevision, action: record.action })
      : null;
  }
  if (kind === "project.register") {
    return domainIdentifier(record.projectId) && nonempty(record.root, 4096)
      ? Object.freeze({ kind, projectId: record.projectId, root: record.root })
      : null;
  }
  if (kind === "project.update" || kind === "project.disable") {
    return domainIdentifier(record.projectId) && revision(record.expectedResourceRevision) && revision(record.expectedConfigRevision)
      ? Object.freeze({ kind, projectId: record.projectId, expectedResourceRevision: record.expectedResourceRevision, expectedConfigRevision: record.expectedConfigRevision })
      : null;
  }
  if (kind === "project.inspect") {
    return domainIdentifier(record.projectId) && revision(record.expectedResourceRevision)
      ? Object.freeze({ kind, projectId: record.projectId, expectedResourceRevision: record.expectedResourceRevision })
      : null;
  }
  if (!domainIdentifier(record.projectId) || !revision(record.expectedProjectResourceRevision) || !domainIdentifier(record.taskId)) return null;
  if (kind === "task.create") {
    return nonempty(record.body) && (record.supersedesTaskId === null || domainIdentifier(record.supersedesTaskId))
      ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, body: record.body, supersedesTaskId: record.supersedesTaskId })
      : null;
  }
  if (!revision(record.expectedTaskRevision)) return null;
  if (kind === "task.update") {
    let changeKind: unknown = null;
    try {
      if (typeof record.change === "object" && record.change !== null && !Array.isArray(record.change)) {
        const descriptor = Object.getOwnPropertyDescriptor(record.change, "kind");
        if (descriptor !== undefined && "value" in descriptor && descriptor.enumerable) changeKind = descriptor.value;
      }
    } catch {
      return null;
    }
    if (changeKind === "body") {
      const change = exactRecord(record.change, ["kind", "body"]);
      return change !== null && nonempty(change.body)
        ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, change: Object.freeze({ kind: "body" as const, body: change.body }) })
        : null;
    }
    if (changeKind === "parent") {
      const change = exactRecord(record.change, ["kind", "parentId"]);
      return change !== null && (change.parentId === null || domainIdentifier(change.parentId))
        ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, change: Object.freeze({ kind: "parent" as const, parentId: change.parentId }) })
        : null;
    }
    return null;
  }
  if (kind === "task.cancel") {
    return isCanonicalCancellationReason(record.reason)
      ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, reason: record.reason })
      : null;
  }
  if (kind === "dependency.add" || kind === "dependency.remove") {
    return domainIdentifier(record.dependencyId) && revision(record.expectedDependencyRevision)
      ? Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision, dependencyId: record.dependencyId, expectedDependencyRevision: record.expectedDependencyRevision })
      : null;
  }
  return Object.freeze({ kind, projectId: record.projectId, expectedProjectResourceRevision: record.expectedProjectResourceRevision, taskId: record.taskId, expectedTaskRevision: record.expectedTaskRevision });
}

export function parseBootstrap(value: unknown): BootstrapCommand | null {
  const record = exactRecord(value, ["kind", "expiresAt"]);
  return record !== null && record.kind === "authorization.bootstrap" && timestamp(record.expiresAt)
    ? Object.freeze({ kind: record.kind, expiresAt: record.expiresAt })
    : null;
}

export function operationIdentity(ingress: ApplicationIngress): OperationIdentity | null {
  try {
    const actor = parseActor(ingress.currentActor());
    const now = ingress.now();
    const requestId = ingress.nextId("request");
    const correlationId = ingress.nextId("correlation");
    const decisionId = ingress.nextId("decision");
    const auditId = ingress.nextId("audit");
    if (actor === null || !timestamp(now) || !operationalIdentifier(requestId) || !operationalIdentifier(correlationId) || !operationalIdentifier(decisionId) || !operationalIdentifier(auditId)) return null;
    return Object.freeze({ actor, now, requestId, correlationId, decisionId, auditId });
  } catch {
    return null;
  }
}

export function refreshOperationTime(identity: OperationIdentity, ingress: ApplicationIngress): OperationIdentity | null {
  try {
    const now = ingress.now();
    if (!timestamp(now) || now < identity.now) return null;
    return Object.freeze({ ...identity, now });
  } catch {
    return null;
  }
}

export function confirmHighRisk(identity: OperationIdentity, action: ApplicationAction, ingress: ApplicationIngress): boolean {
  if (
    action !== "authorization.capability.renew" &&
    action !== "authorization.capability.upgrade" &&
    !isHighRiskAction(action)
  ) return true;
  try {
    return ingress.confirmHighRisk(Object.freeze({
      actorId: identity.actor.actorId,
      action,
      requestId: identity.requestId,
      correlationId: identity.correlationId,
    })) === true;
  } catch {
    return false;
  }
}


export function sameRootIdentity(left: ProjectRootIdentity, right: ProjectRootIdentity): boolean {
  return left.rootKey === right.rootKey && left.platform === right.platform && left.device === right.device && left.inode === right.inode && left.mode === right.mode;
}

export function parseRenewal(value: unknown): RenewalCommand | null {
  const record = exactRecord(value, ["kind", "expiresAt"]);
  return record !== null && record.kind === "authorization.capability.renew" && timestamp(record.expiresAt)
    ? Object.freeze({ kind: record.kind, expiresAt: record.expiresAt })
    : null;
}

export function parseCapabilityUpgrade(value: unknown): CapabilityUpgradeCommand | null {
  const record = exactRecord(value, ["kind", "expiresAt"]);
  return record !== null && record.kind === "authorization.capability.upgrade" && timestamp(record.expiresAt)
    ? Object.freeze({ kind: record.kind, expiresAt: record.expiresAt })
    : null;
}
