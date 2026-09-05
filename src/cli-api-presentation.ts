import type { AuthorizationGrant } from "./authorization.ts";
import type { ApplicationFailure } from "./application.ts";
import type { CodexProductError } from "./codex-product-application.ts";
import type { Task } from "./domain.ts";
import type { DoctorResult } from "./persistence/doctor.ts";
import type { PersistenceError } from "./persistence/errors.ts";
import { currentSchemaVersion } from "./persistence/migrations.ts";
import type { ProductRuntimeError } from "./product-runtime.ts";
import {
  CLI_API_VERSION,
  PUBLIC_ERROR_TABLE,
  type CliFormat,
  type CliRunResult,
  type ParsedCliCommand,
  type PublicErrorCode,
} from "./cli-api-model.ts";

function grantStatus(grant: AuthorizationGrant, now: string): "not_yet_valid" | "active" | "expired" | "revoked" {
  if (grant.revokedAt !== null) return "revoked";
  if (grant.notBefore > now) return "not_yet_valid";
  if (grant.expiresAt <= now) return "expired";
  return "active";
}

function grantProjection(grant: AuthorizationGrant, now: string): Readonly<Record<string, unknown>> {
  return Object.freeze({
    grantId: grant.grantId,
    revision: grant.revision,
    action: grant.action,
    scopeKind: grant.scope.kind,
    projectId: grant.scope.projectId,
    resourceRevision: grant.scope.resourceRevision,
    configRevision: grant.scope.configRevision,
    notBefore: grant.notBefore,
    expiresAt: grant.expiresAt,
    status: grantStatus(grant, now),
  });
}

function taskProjection(task: Task): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: task.projectId,
    taskId: task.id,
    status: task.state,
    revision: task.revision,
    parentId: task.parentId,
    dependencyIds: Object.freeze([...task.dependencyIds]),
    supersedesTaskId: task.supersedesTaskId,
  });
}

function jsonValue(value: unknown): string {
  const visit = (item: unknown): void => {
    if (typeof item === "number" && !Number.isFinite(item)) throw new TypeError("Non-finite public number");
    if (Array.isArray(item)) {
      for (const member of item) visit(member);
    } else if (typeof item === "object" && item !== null) {
      for (const member of Object.values(item)) visit(member);
    }
  };
  visit(value);
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("Unserializable public value");
  return encoded.replace(/\u2028/gu, "\\u2028").replace(/\u2029/gu, "\\u2029");
}

export function failureResult(
  format: CliFormat,
  command: string,
  code: PublicErrorCode,
): CliRunResult {
  const definition = PUBLIC_ERROR_TABLE[code] ?? PUBLIC_ERROR_TABLE.INTERNAL_ERROR;
  const stdout = format === "json"
    ? `{"apiVersion":"${CLI_API_VERSION}","command":${jsonValue(command)},"ok":false,"error":{"code":"${code}","message":${jsonValue(definition.message)}}}\n`
    : `ERROR ${command} code=${jsonValue(code)} message=${jsonValue(definition.message)}\n`;
  return Object.freeze({ exitCode: definition.exitCode, stdout, stderr: "" as const });
}

export function successResult(
  format: CliFormat,
  command: string,
  result: object,
): CliRunResult {
  const encoded = jsonValue(result);
  const stdout = format === "json"
    ? `{"apiVersion":"${CLI_API_VERSION}","command":${jsonValue(command)},"ok":true,"result":${encoded}}\n`
    : `OK ${command}${Object.entries(result).map(([key, value]) => ` ${key}=${jsonValue(value)}`).join("")}\n`;
  return Object.freeze({ exitCode: 0, stdout, stderr: "" as const });
}

export function mapApplicationFailure(failure: ApplicationFailure): PublicErrorCode {
  switch (failure.error.code) {
    case "INVALID_INPUT": return "CLI_INVALID_INPUT";
    case "BOOTSTRAP_REQUIRED": return "RUNTIME_NOT_INITIALIZED";
    case "BOOTSTRAP_ALREADY_CONSUMED": return "RUNTIME_ALREADY_INITIALIZED";
    case "CAPABILITY_RENEWAL_NOT_DUE": return "CAPABILITY_RENEWAL_NOT_DUE";
    case "CAPABILITY_UPGRADE_NOT_ELIGIBLE": return "AUTHORIZATION_DENIED";
    case "AUTHORIZATION_DENIED":
      return failure.error.details.reason === "confirmation_required" ? "CONFIRMATION_REQUIRED" : "AUTHORIZATION_DENIED";
    case "SCOPE_EXPANSION_DENIED": return "SCOPE_EXPANSION_DENIED";
    case "PROJECT_NOT_FOUND": return "PROJECT_NOT_FOUND";
    case "TASK_NOT_FOUND": return "TASK_NOT_FOUND";
    case "GRANT_NOT_FOUND": return "GRANT_NOT_FOUND";
    case "STALE_REVISION": return "STALE_REVISION";
    case "DOMAIN_REJECTED": return "DOMAIN_REJECTED";
    case "PROJECT_ALREADY_REGISTERED": return "PROJECT_ALREADY_REGISTERED";
    case "PROJECT_REGISTRY_REJECTED": return "PROJECT_REGISTRY_REJECTED";
  }
}

export function mapProductFailureToPublicCode(error: ProductRuntimeError): PublicErrorCode {
  if (error.owner === "application") {
    switch (error.code) {
      case "INVALID_INPUT": return "CLI_INVALID_INPUT";
      case "BOOTSTRAP_REQUIRED": return "RUNTIME_NOT_INITIALIZED";
      case "BOOTSTRAP_ALREADY_CONSUMED": return "RUNTIME_ALREADY_INITIALIZED";
      case "CAPABILITY_RENEWAL_NOT_DUE": return "CAPABILITY_RENEWAL_NOT_DUE";
      case "CAPABILITY_UPGRADE_NOT_ELIGIBLE": return "AUTHORIZATION_DENIED";
      case "AUTHORIZATION_DENIED": return error.confirmationRequired ? "CONFIRMATION_REQUIRED" : "AUTHORIZATION_DENIED";
      case "SCOPE_EXPANSION_DENIED": return "SCOPE_EXPANSION_DENIED";
      case "PROJECT_NOT_FOUND": return "PROJECT_NOT_FOUND";
      case "TASK_NOT_FOUND": return "TASK_NOT_FOUND";
      case "GRANT_NOT_FOUND": return "GRANT_NOT_FOUND";
      case "STALE_REVISION": return "STALE_REVISION";
      case "DOMAIN_REJECTED": return "DOMAIN_REJECTED";
      case "PROJECT_ALREADY_REGISTERED": return "PROJECT_ALREADY_REGISTERED";
      case "PROJECT_REGISTRY_REJECTED": return "PROJECT_REGISTRY_REJECTED";
    }
  }
  if (error.owner === "reliable") {
    switch (error.code) {
      case "INVALID_INPUT": return "CLI_INVALID_INPUT";
      case "AUTHORIZATION_DENIED": return "AUTHORIZATION_DENIED";
      case "CONFIRMATION_REQUIRED": return "CONFIRMATION_REQUIRED";
      case "PROJECT_NOT_FOUND": return "PROJECT_NOT_FOUND";
      case "PROJECT_DISABLED":
      case "TASK_NOT_ELIGIBLE":
      case "EXECUTION_TERMINAL": return "DOMAIN_REJECTED";
      case "PROJECT_IDENTITY_CHANGED": return "PROJECT_REGISTRY_REJECTED";
      case "TASK_NOT_FOUND": return "TASK_NOT_FOUND";
      case "EXECUTION_NOT_FOUND": return "EXECUTION_NOT_FOUND";
      case "IDEMPOTENCY_CONFLICT": return "OPERATION_CONFLICT";
      case "STALE_REVISION": return "STALE_REVISION";
      case "STALE_FENCE": return "STALE_FENCE";
      case "LEASE_EXPIRED": return "LEASE_EXPIRED";
      case "RECONCILIATION_REQUIRED": return "RECONCILIATION_REQUIRED";
      case "ADAPTER_FAILURE": return "ADAPTER_FAILURE";
      case "AMBIGUOUS_EXTERNAL_STATE": return "AMBIGUOUS_EXTERNAL_STATE";
      case "PERSISTENCE_FAILURE": return "PERSISTENCE_UNAVAILABLE";
    }
  }
  switch (error.code) {
    case "INVALID_INPUT": return "CLI_INVALID_INPUT";
    case "AUTHORIZATION_DENIED": return "AUTHORIZATION_DENIED";
    case "IDEMPOTENCY_CONFLICT":
    case "LEASE_NOT_EXPIRED": return "OPERATION_CONFLICT";
    case "RUN_NOT_FOUND": return "DISPATCH_RUN_NOT_FOUND";
    case "RUN_NOT_RECONCILED":
    case "RUN_NOT_SEALED":
    case "MEMBER_NOT_FOUND":
    case "MEMBER_NOT_PENDING":
    case "RECONCILIATION_INCOMPLETE": return "RECONCILIATION_REQUIRED";
    case "STALE_REVISION": return "STALE_REVISION";
    case "STALE_OWNER": return "STALE_FENCE";
    case "LEASE_EXPIRED": return "LEASE_EXPIRED";
    case "PROJECT_IDENTITY_CHANGED": return "PROJECT_REGISTRY_REJECTED";
    case "INTEGRITY_FAILURE": return "STATE_CORRUPT";
    case "PERSISTENCE_FAILURE": return "PERSISTENCE_UNAVAILABLE";
  }
  return "INTERNAL_ERROR";
}

export function mapCodexProductFailureToPublicCode(error: CodexProductError): PublicErrorCode {
  switch (error.code) {
    case "INVALID_INPUT": return "CLI_INVALID_INPUT";
    case "AUTHORIZATION_DENIED": return "AUTHORIZATION_DENIED";
    case "CONFIRMATION_REQUIRED": return "CONFIRMATION_REQUIRED";
    case "PROJECT_NOT_FOUND": return "PROJECT_NOT_FOUND";
    case "PROJECT_DISABLED":
    case "TASK_NOT_ELIGIBLE": return "DOMAIN_REJECTED";
    case "PROJECT_IDENTITY_CHANGED": return "PROJECT_REGISTRY_REJECTED";
    case "TASK_NOT_FOUND": return "TASK_NOT_FOUND";
    case "CODEX_PROFILE_NOT_FOUND": return "CODEX_PROFILE_NOT_FOUND";
    case "CODEX_PROFILE_INACTIVE": return "CODEX_PROFILE_INACTIVE";
    case "CODEX_CREDENTIAL_UNAVAILABLE": return "CODEX_CREDENTIAL_UNAVAILABLE";
    case "IDEMPOTENCY_CONFLICT": return "OPERATION_CONFLICT";
    case "STALE_REVISION": return "STALE_REVISION";
    case "STALE_FENCE": return "STALE_FENCE";
    case "LEASE_EXPIRED": return "LEASE_EXPIRED";
    case "RECONCILIATION_REQUIRED": return "RECONCILIATION_REQUIRED";
    case "CODEX_ADAPTER_FAILURE": return "CODEX_ADAPTER_FAILURE";
    case "PERSISTENCE_FAILURE": return "PERSISTENCE_UNAVAILABLE";
  }
}

export function mapPersistenceFailure(error: PersistenceError): PublicErrorCode {
  switch (error.code) {
    case "AUTHORIZATION_DENIED": return "AUTHORIZATION_DENIED";
    case "UNSAFE_RUNTIME_ROOT":
    case "OS_IDENTITY_UNAVAILABLE":
    case "PATH_IDENTITY_CHANGED": return "RUNTIME_UNSAFE";
    case "LIFECYCLE_BUSY":
    case "ACTIVE_CONNECTIONS":
    case "BUSY": return "RUNTIME_ACTIVE";
    case "SCHEMA_NEWER":
    case "SCHEMA_UNSUPPORTED": return "SCHEMA_UNSUPPORTED";
    case "MIGRATION_CHECKSUM_MISMATCH":
    case "MIGRATION_HISTORY_MISMATCH":
    case "MIGRATION_FAILED": return "MIGRATION_INVALID";
    case "CORRUPT_ROW":
    case "INTEGRITY_ERROR": return "STATE_CORRUPT";
    case "BACKUP_INVALID": return "BACKUP_INVALID";
    case "NOT_FOUND": return "BACKUP_NOT_FOUND";
    case "REVISION_CONFLICT": return "STALE_REVISION";
    case "BACKUP_CONFLICT":
    case "CONNECTION_RECEIPT_CHANGED":
    case "LIFECYCLE_IDENTITY_CHANGED": return "OPERATION_CONFLICT";
    case "SQLITE_OPEN_FAILED":
    case "CONNECTION_POLICY_FAILED":
    case "TRANSACTION_FAILED":
    case "STORE_CLOSED":
    case "ASYNC_TRANSACTION_FORBIDDEN": return "PERSISTENCE_UNAVAILABLE";
    case "RESTORE_ACK_REQUIRED": return "DATA_LOSS_ACK_REQUIRED";
    case "RESTORE_CONFLICT": return "RESTORE_CONFLICT";
    case "RESTORE_BLOCKED": return "RESTORE_BLOCKED";
    case "RESTORE_RECOVERY_REQUIRED": return "RESTORE_RECOVERY_REQUIRED";
    case "INVALID_INPUT": return "INTERNAL_ERROR";
  }
}

export function mapDoctorBlock(commandId: string, doctor: DoctorResult): PublicErrorCode | null {
  switch (doctor.health) {
    case "runtime_unsafe":
    case "partial_runtime": return "RUNTIME_UNSAFE";
    case "restore_ambiguous": return "RESTORE_BLOCKED";
    case "restore_pending": return "RESTORE_RECOVERY_REQUIRED";
    case "schema_newer": return doctor.schemaVersion !== null && doctor.schemaVersion < currentSchemaVersion()
      ? null : "SCHEMA_UNSUPPORTED";
    case "migration_invalid": return "MIGRATION_INVALID";
    case "state_corrupt": return "STATE_CORRUPT";
    case "not_initialized": return commandId === "init" ? null : "RUNTIME_NOT_INITIALIZED";
    case "backup_invalid": return commandId === "backup.create" || commandId === "restore" ? "BACKUP_INVALID" : null;
    case "runtime_active": return commandId === "backup.create" || commandId === "restore" ? "RUNTIME_ACTIVE" : null;
    case "upgrade_required":
    case "healthy": return null;
  }
}

export function applicationValueResult(
  command: ParsedCliCommand,
  value: unknown,
  now: string,
): Readonly<Record<string, unknown>> {
  if (command.id === "status" || command.id === "authorization.evaluate") {
    return value as Readonly<Record<string, unknown>>;
  }
  if (command.id === "authorization.list") {
    const page = value as Readonly<{ grants: readonly AuthorizationGrant[]; nextCursor: string | null }>;
    return Object.freeze({ grants: Object.freeze(page.grants.map((grant) => grantProjection(grant, now))), nextCursor: page.nextCursor });
  }
  if (command.id === "authorization.show" || command.id === "authorization.issue" || command.id === "authorization.revoke") {
    return Object.freeze({ grant: grantProjection(value as AuthorizationGrant, now) });
  }
  if (command.id.startsWith("project.")) return value as Readonly<Record<string, unknown>>;
  if (command.id.startsWith("task.") || command.id.startsWith("dependency.")) return taskProjection(value as Task);
  throw new TypeError("Application result command is not projectable");
}
