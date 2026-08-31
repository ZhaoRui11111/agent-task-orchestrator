import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  AUTHORIZATION_ACTIONS,
  PHASE1_AUTHORIZATION_ACTIONS,
  type AuthorizationAction,
  type AuthorizationGrant,
} from "./authorization.ts";
import {
  createApplicationService,
  isCanonicalCancellationReason,
  type ApplicationCommand,
  type ApplicationFailure,
  type ApplicationResult,
} from "./application.ts";
import type { Task } from "./domain.ts";
import {
  inspectRuntimeDoctor,
  inspectRuntimeForRestoreAuthorizationPreflight,
} from "./persistence/doctor.ts";
import { PersistenceError } from "./persistence/errors.ts";
import { inspectPrimaryIdentity, restoreBackup } from "./persistence/backup.ts";
import {
  createLocalApplicationIngress,
  createLocalProductIngress,
  loadLocalRuntime,
  prepareLocalRuntime,
  selectTrustedLocalRuntimeRoot,
  type LocalRuntimeSelection,
} from "./persistence/local-ingress.ts";
import {
  parseApplicationLifecycleAuthorization,
} from "./persistence/application-repository.ts";
import { openPersistence, type PersistenceStore } from "./persistence/store.ts";
import { currentSchemaVersion } from "./persistence/migrations.ts";
import { createManualExecutionBackend } from "./manual-execution-backend.ts";
import {
  createProductRuntime,
  type ProductRuntime,
  type ProductRuntimeError,
  type ProductRuntimeResult,
} from "./product-runtime.ts";

export const CLI_API_VERSION = "ato.api/v1" as const;
export const CLI_API_V2_VERSION = "ato.api/v2" as const;

export const PUBLIC_ERROR_TABLE = Object.freeze({
  CLI_INVALID_INPUT: Object.freeze({ exitCode: 2, message: "The command input is invalid." }),
  CLI_UNSUPPORTED_VERSION: Object.freeze({ exitCode: 2, message: "The requested API version is unsupported." }),
  RUNTIME_NOT_INITIALIZED: Object.freeze({ exitCode: 3, message: "The local runtime is not initialized." }),
  RUNTIME_ALREADY_INITIALIZED: Object.freeze({ exitCode: 3, message: "The local runtime is already initialized." }),
  CAPABILITY_RENEWAL_NOT_DUE: Object.freeze({ exitCode: 3, message: "Local capabilities are not eligible for renewal." }),
  AUTHORIZATION_DENIED: Object.freeze({ exitCode: 4, message: "Current explicit authorization denied the operation." }),
  CONFIRMATION_REQUIRED: Object.freeze({ exitCode: 4, message: "The exact current confirmation is required." }),
  SCOPE_EXPANSION_DENIED: Object.freeze({ exitCode: 4, message: "The requested authorization scope exceeds current authority." }),
  PROJECT_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The Project was not found." }),
  TASK_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The Task was not found." }),
  GRANT_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The grant was not found." }),
  BACKUP_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The backup generation was not found." }),
  STALE_REVISION: Object.freeze({ exitCode: 6, message: "The expected revision is stale." }),
  DOMAIN_REJECTED: Object.freeze({ exitCode: 6, message: "The requested Task operation was rejected." }),
  PROJECT_ALREADY_REGISTERED: Object.freeze({ exitCode: 6, message: "The Project is already registered." }),
  PROJECT_REGISTRY_REJECTED: Object.freeze({ exitCode: 6, message: "The Project registry rejected the operation." }),
  RESULT_LIMIT_EXCEEDED: Object.freeze({ exitCode: 6, message: "The requested result limit is invalid." }),
  OPERATION_CONFLICT: Object.freeze({ exitCode: 6, message: "The operation conflicts with current state." }),
  RUNTIME_UNSAFE: Object.freeze({ exitCode: 7, message: "The local runtime identity or topology is unsafe." }),
  RUNTIME_ACTIVE: Object.freeze({ exitCode: 7, message: "The local runtime is active." }),
  SCHEMA_UNSUPPORTED: Object.freeze({ exitCode: 7, message: "The runtime schema is unsupported." }),
  MIGRATION_INVALID: Object.freeze({ exitCode: 7, message: "The runtime migration history is invalid." }),
  STATE_CORRUPT: Object.freeze({ exitCode: 7, message: "The runtime state is corrupt." }),
  BACKUP_INVALID: Object.freeze({ exitCode: 7, message: "The backup generation is invalid." }),
  PERSISTENCE_UNAVAILABLE: Object.freeze({ exitCode: 7, message: "Local persistence is unavailable." }),
  DATA_LOSS_ACK_REQUIRED: Object.freeze({ exitCode: 8, message: "The exact data-loss acknowledgement is required." }),
  RESTORE_CONFLICT: Object.freeze({ exitCode: 8, message: "Restore conflicts with current state." }),
  RESTORE_BLOCKED: Object.freeze({ exitCode: 8, message: "Restore is blocked." }),
  RESTORE_RECOVERY_REQUIRED: Object.freeze({ exitCode: 8, message: "Restore requires manual recovery." }),
  INTERNAL_ERROR: Object.freeze({ exitCode: 9, message: "The operation failed internally." }),
} as const);

export const PUBLIC_ERROR_TABLE_V2 = Object.freeze({
  ...PUBLIC_ERROR_TABLE,
  EXECUTION_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The execution was not found." }),
  DISPATCH_RUN_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The dispatcher run was not found." }),
  STALE_FENCE: Object.freeze({ exitCode: 6, message: "The execution or dispatcher ownership fence is stale." }),
  LEASE_EXPIRED: Object.freeze({ exitCode: 6, message: "The execution or dispatcher lease has expired." }),
  RECONCILIATION_REQUIRED: Object.freeze({ exitCode: 6, message: "Durable reconciliation is required before the operation can continue." }),
  ADAPTER_FAILURE: Object.freeze({ exitCode: 7, message: "The Manual execution adapter failed." }),
  AMBIGUOUS_EXTERNAL_STATE: Object.freeze({ exitCode: 8, message: "The external execution state is ambiguous." }),
} as const);

export type PublicErrorCode = keyof typeof PUBLIC_ERROR_TABLE;
export type PublicErrorCodeV2 = keyof typeof PUBLIC_ERROR_TABLE_V2;
type AnyPublicErrorCode = PublicErrorCodeV2;
export type CliFormat = "human" | "json";

interface ParsedCliCommand {
  readonly format: CliFormat;
  readonly apiVersion: string;
  readonly runtimeRoot: string | null;
  readonly id: string;
  readonly options: Readonly<Record<string, string>>;
}

interface ParseFailure {
  readonly ok: false;
  readonly format: CliFormat;
  readonly command: string;
  readonly code:
    | "CLI_INVALID_INPUT"
    | "CLI_UNSUPPORTED_VERSION"
    | "RESULT_LIMIT_EXCEEDED"
    | "CONFIRMATION_REQUIRED"
    | "DATA_LOSS_ACK_REQUIRED";
}

interface ParseSuccess {
  readonly ok: true;
  readonly command: ParsedCliCommand;
}

type ParseResult = ParseFailure | ParseSuccess;

interface CommandSpec {
  readonly id: string;
  readonly path: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

const COMMAND_SPECS = Object.freeze([
  { id: "status", path: ["status"], required: [], optional: [] },
  { id: "doctor", path: ["doctor"], required: [], optional: [] },
  { id: "init", path: ["init"], required: ["expires-at", "confirm"], optional: [] },
  { id: "restore", path: ["restore"], required: ["generation-id", "confirm", "acknowledge-data-loss"], optional: [] },
  { id: "authorization.renew", path: ["authorization", "renew"], required: ["expires-at", "confirm"], optional: [] },
  { id: "authorization.list", path: ["authorization", "list"], required: ["limit"], optional: ["after-grant-id"] },
  { id: "authorization.show", path: ["authorization", "show"], required: ["grant-id", "expected-grant-revision"], optional: [] },
  { id: "authorization.issue", path: ["authorization", "issue"], required: ["action", "scope", "not-before", "expires-at", "confirm"], optional: ["project-id", "expected-resource-revision", "expected-config-revision"] },
  { id: "authorization.revoke", path: ["authorization", "revoke"], required: ["grant-id", "expected-grant-revision", "confirm"], optional: [] },
  { id: "authorization.evaluate", path: ["authorization", "evaluate"], required: ["project-id", "expected-resource-revision", "expected-config-revision", "action"], optional: [] },
  { id: "project.register", path: ["project", "register"], required: ["project-id", "root", "confirm"], optional: [] },
  { id: "project.show", path: ["project", "show"], required: ["project-id", "expected-resource-revision"], optional: [] },
  { id: "project.update", path: ["project", "update"], required: ["project-id", "expected-resource-revision", "expected-config-revision", "confirm"], optional: [] },
  { id: "project.disable", path: ["project", "disable"], required: ["project-id", "expected-resource-revision", "expected-config-revision", "confirm"], optional: [] },
  { id: "task.create", path: ["task", "create"], required: ["project-id", "expected-project-resource-revision", "task-id", "body"], optional: ["supersedes-task-id"] },
  { id: "task.show", path: ["task", "show"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision"], optional: [] },
  { id: "task.update-body", path: ["task", "update-body"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision", "body"], optional: [] },
  { id: "task.set-parent", path: ["task", "set-parent"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision", "parent-id"], optional: [] },
  { id: "task.clear-parent", path: ["task", "clear-parent"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision"], optional: [] },
  { id: "task.mark-ready", path: ["task", "mark-ready"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision"], optional: [] },
  { id: "task.cancel", path: ["task", "cancel"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision", "reason"], optional: [] },
  { id: "dependency.add", path: ["dependency", "add"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision", "dependency-id", "expected-dependency-revision"], optional: [] },
  { id: "dependency.remove", path: ["dependency", "remove"], required: ["project-id", "expected-project-resource-revision", "task-id", "expected-task-revision", "dependency-id", "expected-dependency-revision"], optional: [] },
  { id: "backup.create", path: ["backup", "create"], required: [], optional: [] },
] satisfies readonly CommandSpec[]);

const EXECUTION_COMMON_OPTIONS = Object.freeze([
  "project-id", "expected-project-resource-revision", "expected-project-config-revision", "task-id",
  "expected-task-revision", "execution-id", "expected-execution-revision", "expected-attempt-number",
  "expected-fencing-token", "idempotency-key",
]);

const V2_ONLY_COMMAND_SPECS = Object.freeze([
  { id: "authorization.upgrade", path: ["authorization", "upgrade"], required: ["expires-at", "confirm"], optional: [] },
  { id: "dispatch.run", path: ["dispatch", "run"], required: ["idempotency-key", "lease-duration-seconds"], optional: [] },
  { id: "dispatch.resume", path: ["dispatch", "resume"], required: ["run-id"], optional: [] },
  { id: "execution.inspect", path: ["execution", "inspect"], required: [...EXECUTION_COMMON_OPTIONS], optional: [] },
  { id: "execution.resume", path: ["execution", "resume"], required: [...EXECUTION_COMMON_OPTIONS, "continuation-reference", "required-action-receipt-id"], optional: [] },
  { id: "execution.retry", path: ["execution", "retry"], required: [...EXECUTION_COMMON_OPTIONS, "continuation-reference", "required-action-receipt-id"], optional: [] },
  { id: "execution.request-cancel", path: ["execution", "request-cancel"], required: [...EXECUTION_COMMON_OPTIONS, "reason-code"], optional: [] },
  { id: "manual.outcome-report", path: ["manual", "outcome-report"], required: [...EXECUTION_COMMON_OPTIONS, "report-id", "outcome", "code", "confirm"], optional: ["evidence-reference"] },
  { id: "execution.accept-manual-completion", path: ["execution", "accept-manual-completion"], required: [...EXECUTION_COMMON_OPTIONS, "confirm"], optional: [] },
] satisfies readonly CommandSpec[]);

const V2_COMMAND_SPECS = Object.freeze([...COMMAND_SPECS, ...V2_ONLY_COMMAND_SPECS]);
const V2_ONLY_COMMAND_IDS: ReadonlySet<string> = new Set(V2_ONLY_COMMAND_SPECS.map((spec) => spec.id));

const ONE_TOKEN_COMMANDS = new Set(["status", "doctor", "init", "restore"]);
const FORBIDDEN_TEXT = /[\p{Cc}\p{Cf}]/u;
const OPERATIONAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const EXECUTION_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const GENERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;

function bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function wellFormed(value: string): boolean {
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

function safeToken(value: string): boolean {
  return value.length > 0 && wellFormed(value) && !FORBIDDEN_TEXT.test(value) && value.normalize("NFC") === value;
}

function canonicalRevision(value: string): number | null {
  if (!DECIMAL.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : null;
}

function canonicalTimestamp(value: string): boolean {
  const date = new Date(value);
  return value.length >= 20 && value.length <= 40 && Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function domainId(value: string): boolean {
  return safeToken(value) && bytes(value) >= 1 && bytes(value) <= 128;
}

function absolutePath(value: string): boolean {
  if (!safeToken(value) || bytes(value) > 1024 || !path.isAbsolute(value)) return false;
  const parsed = path.parse(value);
  return !value.slice(parsed.root.length).split(/[\\/]+/u).some((segment) => segment === "." || segment === "..");
}

function parseFailure(format: CliFormat, command = "unknown", code: ParseFailure["code"] = "CLI_INVALID_INPUT"): ParseFailure {
  return Object.freeze({ ok: false, format, command, code });
}

function validateOptions(
  spec: CommandSpec,
  options: Readonly<Record<string, string>>,
  now: string,
  apiVersion: string,
): ParseFailure["code"] | null {
  const revisionOptions = [
    "expected-grant-revision",
    "expected-resource-revision",
    "expected-config-revision",
    "expected-project-resource-revision",
    "expected-task-revision",
    "expected-dependency-revision",
    "expected-project-config-revision",
    "expected-execution-revision",
    "expected-attempt-number",
    "expected-fencing-token",
  ];
  for (const name of revisionOptions) {
    const value = options[name];
    if (value !== undefined && canonicalRevision(value) === null) return "CLI_INVALID_INPUT";
  }
  for (const name of ["project-id", "task-id", "dependency-id", "parent-id", "supersedes-task-id"]) {
    const value = options[name];
    if (value !== undefined && !domainId(value)) return "CLI_INVALID_INPUT";
  }
  for (const name of ["grant-id", "after-grant-id"]) {
    const value = options[name];
    if (value !== undefined && !OPERATIONAL_ID.test(value)) return "CLI_INVALID_INPUT";
  }
  const generationId = options["generation-id"];
  if (generationId !== undefined && !GENERATION_ID.test(generationId)) return "CLI_INVALID_INPUT";
  for (const name of ["expires-at", "not-before"]) {
    const value = options[name];
    if (value !== undefined && !canonicalTimestamp(value)) return "CLI_INVALID_INPUT";
  }
  const action = options.action;
  const actionVocabulary = apiVersion === CLI_API_V2_VERSION ? AUTHORIZATION_ACTIONS : PHASE1_AUTHORIZATION_ACTIONS;
  if (action !== undefined && !(actionVocabulary as readonly string[]).includes(action)) {
    return "CLI_INVALID_INPUT";
  }
  const root = options.root;
  if (root !== undefined && !absolutePath(root)) return "CLI_INVALID_INPUT";
  const body = options.body;
  if (body !== undefined && (!safeToken(body) || bytes(body) < 1 || bytes(body) > 16_384)) return "CLI_INVALID_INPUT";
  const reason = options.reason;
  if (reason !== undefined && !isCanonicalCancellationReason(reason)) return "CLI_INVALID_INPUT";
  const limit = options.limit;
  if (limit !== undefined) {
    if (!DECIMAL.test(limit) || String(Number(limit)) !== limit || !Number.isSafeInteger(Number(limit))) return "CLI_INVALID_INPUT";
    if (Number(limit) < 1 || Number(limit) > 100) return "RESULT_LIMIT_EXCEEDED";
  }
  if (spec.id === "authorization.issue") {
    const scope = options.scope;
    const projectFields = [options["project-id"], options["expected-resource-revision"], options["expected-config-revision"]];
    if (scope === "runtime") {
      if (projectFields.some((value) => value !== undefined)) return "CLI_INVALID_INPUT";
    } else if (scope === "project") {
      if (projectFields.some((value) => value === undefined)) return "CLI_INVALID_INPUT";
    } else {
      return "CLI_INVALID_INPUT";
    }
    const notBefore = options["not-before"] as string;
    const expiresAt = options["expires-at"] as string;
    if (notBefore < now || expiresAt <= notBefore) return "CLI_INVALID_INPUT";
  }
  const nowMillis = new Date(now).valueOf();
  const expiresAt = options["expires-at"];
  if (spec.id === "init" && expiresAt !== undefined) {
    const expiresMillis = new Date(expiresAt).valueOf();
    if (!(expiresMillis > nowMillis && expiresMillis <= nowMillis + 31 * 24 * 60 * 60 * 1000)) {
      return "CLI_INVALID_INPUT";
    }
  }
  if (spec.id === "authorization.renew" && expiresAt !== undefined) {
    const expiresMillis = new Date(expiresAt).valueOf();
    if (!(expiresMillis > nowMillis + 7 * 24 * 60 * 60 * 1000 && expiresMillis <= nowMillis + 31 * 24 * 60 * 60 * 1000)) {
      return "CLI_INVALID_INPUT";
    }
  }
  if (spec.id === "authorization.upgrade" && expiresAt !== undefined) {
    const expiresMillis = new Date(expiresAt).valueOf();
    if (!(expiresMillis > nowMillis + 7 * 24 * 60 * 60 * 1000 && expiresMillis <= nowMillis + 31 * 24 * 60 * 60 * 1000)) {
      return "CLI_INVALID_INPUT";
    }
  }
  if (V2_ONLY_COMMAND_IDS.has(spec.id)) {
    for (const name of [
      "project-id", "task-id", "execution-id", "idempotency-key", "continuation-reference",
      "required-action-receipt-id", "reason-code", "report-id", "code", "evidence-reference", "run-id",
    ]) {
      const value = options[name];
      if (value !== undefined && !OPERATIONAL_ID.test(value)) return "CLI_INVALID_INPUT";
    }
    for (const name of ["reason-code", "code"]) {
      const value = options[name];
      if (value !== undefined && !EXECUTION_CODE.test(value)) return "CLI_INVALID_INPUT";
    }
  }
  const leaseDuration = options["lease-duration-seconds"];
  if (leaseDuration !== undefined &&
    (!DECIMAL.test(leaseDuration) || String(Number(leaseDuration)) !== leaseDuration ||
      !Number.isSafeInteger(Number(leaseDuration)) || Number(leaseDuration) < 30 || Number(leaseDuration) > 3_600)) {
    return "CLI_INVALID_INPUT";
  }
  const outcome = options.outcome;
  if (outcome !== undefined && !(["activate", "wait", "succeed", "fail", "confirm_cancelled"] as const).includes(
    outcome as "activate" | "wait" | "succeed" | "fail" | "confirm_cancelled",
  )) return "CLI_INVALID_INPUT";
  return null;
}

export function parseCliArguments(args: readonly string[], now = new Date().toISOString()): ParseResult {
  let format: CliFormat = "human";
  let index = 0;
  let apiVersion = CLI_API_VERSION as string;
  let runtimeRoot: string | null = null;
  let seenFormat = false;
  let seenVersion = false;
  let seenRuntime = false;
  const globals = new Set(["--format", "--api-version", "--runtime-root"]);
  while (index < args.length && globals.has(args[index] as string)) {
    const name = args[index] as string;
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return parseFailure(name === "--format" ? "human" : format);
    }
    if (name === "--format") {
      if (seenFormat || (value !== "human" && value !== "json")) return parseFailure("human");
      seenFormat = true;
      format = value;
    } else if (name === "--api-version") {
      if (seenVersion) return parseFailure(format);
      seenVersion = true;
      apiVersion = value;
    } else {
      if (seenRuntime) return parseFailure(format);
      seenRuntime = true;
      runtimeRoot = value;
    }
    index += 2;
  }
  if (
    args.length === 0 ||
    args.length > 64 ||
    args.reduce((count, value) => count + bytes(value), 0) > 32_768 ||
    !args.every(safeToken) ||
    !canonicalTimestamp(now)
  ) {
    return parseFailure(format);
  }
  const first = args[index];
  if (first === undefined || first.startsWith("-") || first.startsWith("@") || first.includes("=")) return parseFailure(format);
  const pathLength = ONE_TOKEN_COMMANDS.has(first) ? 1 : 2;
  const commandPath = args.slice(index, index + pathLength);
  const registry = apiVersion === CLI_API_VERSION ? COMMAND_SPECS : apiVersion === CLI_API_V2_VERSION
    ? V2_COMMAND_SPECS : V2_COMMAND_SPECS;
  const spec = registry.find((candidate) =>
    candidate.path.length === commandPath.length && candidate.path.every((part, partIndex) => part === commandPath[partIndex])
  );
  if (spec === undefined) return parseFailure(format);
  if (apiVersion !== CLI_API_VERSION && apiVersion !== CLI_API_V2_VERSION) {
    return parseFailure(format, spec.id, "CLI_UNSUPPORTED_VERSION");
  }
  if (runtimeRoot !== null && !absolutePath(runtimeRoot)) return parseFailure(format, spec.id);
  index += pathLength;
  const allowed = new Set([...spec.required, ...spec.optional]);
  const options: Record<string, string> = Object.create(null) as Record<string, string>;
  while (index < args.length) {
    const option = args[index];
    const value = args[index + 1];
    if (
      option === undefined || value === undefined ||
      !/^--[a-z][a-z0-9-]*$/u.test(option) || option.includes("=") ||
      value.startsWith("--") || globals.has(option)
    ) {
      return parseFailure(format, spec.id);
    }
    const name = option.slice(2);
    if (!allowed.has(name) || Object.hasOwn(options, name)) return parseFailure(format, spec.id);
    options[name] = value;
    index += 2;
  }
  const missing = spec.required.filter((name) => !Object.hasOwn(options, name));
  if (missing.includes("acknowledge-data-loss")) return parseFailure(format, spec.id, "DATA_LOSS_ACK_REQUIRED");
  if (missing.includes("confirm")) return parseFailure(format, spec.id, "CONFIRMATION_REQUIRED");
  if (missing.length !== 0) return parseFailure(format, spec.id);
  const optionError = validateOptions(spec, options, now, apiVersion);
  if (optionError !== null) return parseFailure(format, spec.id, optionError);
  const command = Object.freeze({ format, apiVersion, runtimeRoot, id: spec.id, options: Object.freeze(options) });
  if (spec.id === "restore" && options["acknowledge-data-loss"] !== "DISCARD CURRENT LOCAL DATA") {
    return parseFailure(format, spec.id, "DATA_LOSS_ACK_REQUIRED");
  }
  const confirmation = confirmationFor(command);
  if (confirmation.phrase !== null && options.confirm !== confirmation.phrase) {
    return parseFailure(format, spec.id, "CONFIRMATION_REQUIRED");
  }
  return Object.freeze({
    ok: true,
    command,
  });
}

function option(command: ParsedCliCommand, name: string): string {
  const value = command.options[name];
  if (value === undefined) throw new TypeError("Parsed command option is absent");
  return value;
}

function optionRevision(command: ParsedCliCommand, name: string): number {
  const value = canonicalRevision(option(command, name));
  if (value === null) throw new TypeError("Parsed revision is invalid");
  return value;
}

function applicationCommand(command: ParsedCliCommand, selection: LocalRuntimeSelection, generationId: string | null): ApplicationCommand | null {
  switch (command.id) {
    case "status": return Object.freeze({ kind: "runtime.status" });
    case "authorization.list": return Object.freeze({
      kind: "authorization.grant.list",
      limit: Number(option(command, "limit")),
      afterGrantId: command.options["after-grant-id"] ?? null,
    });
    case "authorization.show": return Object.freeze({
      kind: "authorization.grant.inspect",
      grantId: option(command, "grant-id"),
      expectedGrantRevision: optionRevision(command, "expected-grant-revision"),
    });
    case "authorization.issue": {
      const scopeKind = option(command, "scope") as "runtime" | "project";
      return Object.freeze({
        kind: "authorization.grant.issue",
        actorId: selection.identity.actorId,
        action: option(command, "action") as AuthorizationAction,
        scope: Object.freeze({
          kind: scopeKind,
          projectId: scopeKind === "project" ? option(command, "project-id") : null,
          resourceRevision: scopeKind === "project" ? optionRevision(command, "expected-resource-revision") : null,
          configRevision: scopeKind === "project" ? optionRevision(command, "expected-config-revision") : null,
        }),
        notBefore: option(command, "not-before"),
        expiresAt: option(command, "expires-at"),
      });
    }
    case "authorization.revoke": return Object.freeze({
      kind: "authorization.grant.revoke",
      grantId: option(command, "grant-id"),
      expectedGrantRevision: optionRevision(command, "expected-grant-revision"),
    });
    case "authorization.evaluate": return Object.freeze({
      kind: "policy.evaluate",
      projectId: option(command, "project-id"),
      expectedResourceRevision: optionRevision(command, "expected-resource-revision"),
      expectedConfigRevision: optionRevision(command, "expected-config-revision"),
      action: option(command, "action") as AuthorizationAction,
    });
    case "project.register": return Object.freeze({ kind: "project.register", projectId: option(command, "project-id"), root: option(command, "root") });
    case "project.show": return Object.freeze({ kind: "project.inspect", projectId: option(command, "project-id"), expectedResourceRevision: optionRevision(command, "expected-resource-revision") });
    case "project.update": return Object.freeze({ kind: "project.update", projectId: option(command, "project-id"), expectedResourceRevision: optionRevision(command, "expected-resource-revision"), expectedConfigRevision: optionRevision(command, "expected-config-revision") });
    case "project.disable": return Object.freeze({ kind: "project.disable", projectId: option(command, "project-id"), expectedResourceRevision: optionRevision(command, "expected-resource-revision"), expectedConfigRevision: optionRevision(command, "expected-config-revision") });
    case "task.create": return Object.freeze({ kind: "task.create", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), body: option(command, "body"), supersedesTaskId: command.options["supersedes-task-id"] ?? null });
    case "task.show": return Object.freeze({ kind: "task.inspect", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), expectedTaskRevision: optionRevision(command, "expected-task-revision") });
    case "task.update-body": return Object.freeze({ kind: "task.update", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), expectedTaskRevision: optionRevision(command, "expected-task-revision"), change: Object.freeze({ kind: "body", body: option(command, "body") }) });
    case "task.set-parent": return Object.freeze({ kind: "task.update", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), expectedTaskRevision: optionRevision(command, "expected-task-revision"), change: Object.freeze({ kind: "parent", parentId: option(command, "parent-id") }) });
    case "task.clear-parent": return Object.freeze({ kind: "task.update", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), expectedTaskRevision: optionRevision(command, "expected-task-revision"), change: Object.freeze({ kind: "parent", parentId: null }) });
    case "task.mark-ready": return Object.freeze({ kind: "task.mark_ready", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), expectedTaskRevision: optionRevision(command, "expected-task-revision") });
    case "task.cancel": return Object.freeze({ kind: "task.cancel", projectId: option(command, "project-id"), expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"), taskId: option(command, "task-id"), expectedTaskRevision: optionRevision(command, "expected-task-revision"), reason: option(command, "reason") });
    case "dependency.add":
    case "dependency.remove": return Object.freeze({
      kind: command.id,
      projectId: option(command, "project-id"),
      expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"),
      taskId: option(command, "task-id"),
      expectedTaskRevision: optionRevision(command, "expected-task-revision"),
      dependencyId: option(command, "dependency-id"),
      expectedDependencyRevision: optionRevision(command, "expected-dependency-revision"),
    });
    case "backup.create":
      if (generationId === null) throw new TypeError("Backup generation was not allocated");
      return Object.freeze({ kind: "runtime.backup", backupGenerationId: generationId });
    case "restore": return Object.freeze({ kind: "runtime.restore", backupGenerationId: option(command, "generation-id") });
    default: return null;
  }
}

function confirmationFor(command: ParsedCliCommand): Readonly<{
  phrase: string | null;
  action: AuthorizationAction | "authorization.capability.renew" | "authorization.capability.upgrade" | null;
  productAction: "manual.turn.report" | "execution.completion.accept" | null;
}> {
  switch (command.id) {
    case "init": return Object.freeze({ phrase: "INITIALIZE LOCAL RUNTIME", action: "authorization.grant.issue", productAction: null });
    case "authorization.renew": return Object.freeze({ phrase: "RENEW LOCAL CAPABILITIES", action: "authorization.capability.renew", productAction: null });
    case "authorization.upgrade": return Object.freeze({ phrase: "UPGRADE LOCAL CAPABILITIES", action: "authorization.capability.upgrade", productAction: null });
    case "authorization.issue": return Object.freeze({ phrase: "ISSUE LOCAL GRANT", action: "authorization.grant.issue", productAction: null });
    case "authorization.revoke": return Object.freeze({ phrase: "REVOKE LOCAL GRANT", action: "authorization.grant.revoke", productAction: null });
    case "project.register": return Object.freeze({ phrase: "REGISTER LOCAL PROJECT", action: "project.register", productAction: null });
    case "project.update": return Object.freeze({ phrase: "UPDATE LOCAL PROJECT", action: "project.update", productAction: null });
    case "project.disable": return Object.freeze({ phrase: "DISABLE LOCAL PROJECT", action: "project.disable", productAction: null });
    case "restore": return Object.freeze({ phrase: "RESTORE LOCAL BACKUP", action: "runtime.restore", productAction: null });
    case "manual.outcome-report": return Object.freeze({ phrase: "RECORD MANUAL OUTCOME", action: null, productAction: "manual.turn.report" });
    case "execution.accept-manual-completion": return Object.freeze({ phrase: "ACCEPT MANUAL COMPLETION", action: null, productAction: "execution.completion.accept" });
    default: return Object.freeze({ phrase: null, action: null, productAction: null });
  }
}

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

export interface CliRunOptions {
  readonly sourceCheckoutRoot: string;
  readonly applicationVersion?: string;
  readonly now?: () => string;
  readonly nextId?: () => string;
}

export interface CliRunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: "";
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

function failureResult(
  format: CliFormat,
  command: string,
  code: AnyPublicErrorCode,
  apiVersion: string = CLI_API_VERSION,
): CliRunResult {
  const table = apiVersion === CLI_API_V2_VERSION ? PUBLIC_ERROR_TABLE_V2 : PUBLIC_ERROR_TABLE;
  const definition = table[code as keyof typeof table] ?? PUBLIC_ERROR_TABLE.INTERNAL_ERROR;
  const stdout = format === "json"
    ? `{"apiVersion":"${apiVersion}","command":${jsonValue(command)},"ok":false,"error":{"code":"${code}","message":${jsonValue(definition.message)}}}\n`
    : `ERROR ${command} code=${jsonValue(code)} message=${jsonValue(definition.message)}\n`;
  return Object.freeze({ exitCode: definition.exitCode, stdout, stderr: "" as const });
}

function successResult(
  format: CliFormat,
  command: string,
  result: object,
  apiVersion: string = CLI_API_VERSION,
): CliRunResult {
  const encoded = jsonValue(result);
  const stdout = format === "json"
    ? `{"apiVersion":"${apiVersion}","command":${jsonValue(command)},"ok":true,"result":${encoded}}\n`
    : `OK ${command}${Object.entries(result).map(([key, value]) => ` ${key}=${jsonValue(value)}`).join("")}\n`;
  return Object.freeze({ exitCode: 0, stdout, stderr: "" as const });
}

function mapApplicationFailure(failure: ApplicationFailure): PublicErrorCode {
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

export function mapProductFailureToPublicCode(error: ProductRuntimeError): PublicErrorCodeV2 {
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

function mapPersistenceFailure(error: PersistenceError): PublicErrorCode {
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

function mapDoctorBlock(commandId: string, doctor: ReturnType<typeof inspectRuntimeDoctor>): PublicErrorCode | null {
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

function applicationValueResult(
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

function parseFailureApiVersion(args: readonly string[]): string {
  for (let index = 0; index + 1 < args.length; index += 2) {
    const name = args[index];
    if (name !== "--format" && name !== "--api-version" && name !== "--runtime-root") break;
    if (name === "--api-version" && args[index + 1] === CLI_API_V2_VERSION) return CLI_API_V2_VERSION;
  }
  return CLI_API_VERSION;
}

function productCommon(command: ParsedCliCommand): Readonly<Record<string, unknown>> {
  return Object.freeze({
    projectId: option(command, "project-id"),
    expectedProjectResourceRevision: optionRevision(command, "expected-project-resource-revision"),
    expectedProjectConfigRevision: optionRevision(command, "expected-project-config-revision"),
    taskId: option(command, "task-id"),
    expectedTaskRevision: optionRevision(command, "expected-task-revision"),
    executionId: option(command, "execution-id"),
    expectedExecutionRevision: optionRevision(command, "expected-execution-revision"),
    expectedAttemptNumber: optionRevision(command, "expected-attempt-number"),
    expectedFencingToken: optionRevision(command, "expected-fencing-token"),
    idempotencyKey: option(command, "idempotency-key"),
  });
}

function executeProductCommand(
  product: ProductRuntime,
  command: ParsedCliCommand,
): ProductRuntimeResult<object> {
  switch (command.id) {
    case "authorization.upgrade": return product.upgrade(Object.freeze({
      kind: "authorization.upgrade",
      expiresAt: option(command, "expires-at"),
    }));
    case "dispatch.run": return product.dispatchRun(Object.freeze({
      kind: "dispatch.run",
      idempotencyKey: option(command, "idempotency-key"),
      leaseDurationSeconds: Number(option(command, "lease-duration-seconds")),
    }));
    case "dispatch.resume": return product.dispatchResume(Object.freeze({
      kind: "dispatch.resume",
      runId: option(command, "run-id"),
    }));
    case "execution.inspect": return product.inspect(Object.freeze({
      kind: "execution.inspect",
      ...productCommon(command),
    }));
    case "execution.resume": return product.resume(Object.freeze({
      kind: "execution.resume",
      ...productCommon(command),
      continuationReference: option(command, "continuation-reference"),
      requiredActionReceiptId: option(command, "required-action-receipt-id"),
    }));
    case "execution.retry": return product.retry(Object.freeze({
      kind: "execution.retry",
      ...productCommon(command),
      continuationReference: option(command, "continuation-reference"),
      requiredActionReceiptId: option(command, "required-action-receipt-id"),
    }));
    case "execution.request-cancel": return product.requestCancel(Object.freeze({
      kind: "execution.request-cancel",
      ...productCommon(command),
      reasonCode: option(command, "reason-code"),
    }));
    case "manual.outcome-report": return product.recordManualOutcome(Object.freeze({
      kind: "manual.outcome-report",
      ...productCommon(command),
      reportId: option(command, "report-id"),
      outcome: option(command, "outcome"),
      code: option(command, "code"),
      evidenceReference: command.options["evidence-reference"] ?? null,
    }));
    case "execution.accept-manual-completion": return product.acceptManualCompletion(Object.freeze({
      kind: "execution.accept-manual-completion",
      ...productCommon(command),
    }));
    default: throw new TypeError("CLI command has no Phase 2 product route");
  }
}

export async function runCli(args: readonly string[], options: CliRunOptions): Promise<CliRunResult> {
  const clock = options.now ?? (() => new Date().toISOString());
  let parseNow: string;
  try {
    parseNow = clock();
  } catch {
    parseNow = "";
  }
  const parsed = parseCliArguments(args, parseNow);
  if (!parsed.ok) return failureResult(parsed.format, parsed.command, parsed.code, parseFailureApiVersion(args));
  const command = parsed.command;
  let store: PersistenceStore | null = null;
  let outcome: CliRunResult;
  try {
    const runtimeRoot = selectTrustedLocalRuntimeRoot(command.runtimeRoot);
    if (command.id === "doctor") {
      return successResult(command.format, command.id, inspectRuntimeDoctor(runtimeRoot, options.sourceCheckoutRoot), command.apiVersion);
    }
    const doctor = command.id === "restore"
      ? inspectRuntimeForRestoreAuthorizationPreflight(runtimeRoot, options.sourceCheckoutRoot)
      : inspectRuntimeDoctor(runtimeRoot, options.sourceCheckoutRoot);
    const block = mapDoctorBlock(command.id, doctor);
    if (block !== null) return failureResult(command.format, command.id, block, command.apiVersion);
    const selection = command.id === "init"
      ? prepareLocalRuntime(command.runtimeRoot, options.sourceCheckoutRoot)
      : loadLocalRuntime(command.runtimeRoot, options.sourceCheckoutRoot);
    const confirmation = confirmationFor(command);
    const ingressOptions = Object.freeze({
      confirmation: command.options.confirm ?? null,
      expectedConfirmation: confirmation.phrase,
      expectedAction: confirmation.action,
      now: clock,
      ...(options.nextId === undefined ? {} : { nextId: options.nextId }),
    });
    const productIngress = command.apiVersion === CLI_API_V2_VERSION
      ? createLocalProductIngress(selection.identity, Object.freeze({
        ...ingressOptions,
        expectedProductAction: confirmation.productAction,
      }))
      : null;
    const ingress = productIngress ?? createLocalApplicationIngress(selection.identity, ingressOptions);
    store = await openPersistence(selection.layout, {
      applicationVersion: options.applicationVersion ?? "0.0.0-development",
    });
    const service = createApplicationService(store, ingress);
    outcome = await (async (): Promise<CliRunResult> => {
      if (V2_ONLY_COMMAND_IDS.has(command.id)) {
        if (productIngress === null) throw new TypeError("Phase 2 product command lacks v2 trusted ingress");
        const backend = createManualExecutionBackend(store!, { ingress: productIngress });
        const product = createProductRuntime(store!, productIngress, backend, backend);
        const result = executeProductCommand(product, command);
        return result.ok
          ? successResult(command.format, command.id, result.value, command.apiVersion)
          : failureResult(command.format, command.id, mapProductFailureToPublicCode(result.error), command.apiVersion);
      }
      if (command.id === "init") {
        const initialized = service.bootstrap({ kind: "authorization.bootstrap", expiresAt: option(command, "expires-at") });
        if (!initialized.ok) return failureResult(command.format, command.id, mapApplicationFailure(initialized), command.apiVersion);
        return successResult(command.format, command.id, Object.freeze({
          mode: "initialized",
          expiresAt: option(command, "expires-at"),
          capabilityCount: PHASE1_AUTHORIZATION_ACTIONS.length,
          epochRevision: 0,
        }), command.apiVersion);
      }
      if (command.id === "authorization.renew") {
        const renewed = service.renew({ kind: "authorization.capability.renew", expiresAt: option(command, "expires-at") });
        if (!renewed.ok) return failureResult(command.format, command.id, mapApplicationFailure(renewed), command.apiVersion);
        return successResult(command.format, command.id, renewed.value as unknown as Readonly<Record<string, unknown>>, command.apiVersion);
      }

      const generationId = command.id === "backup.create" ? randomUUID() : null;
      const routed = applicationCommand(command, selection, generationId);
      if (routed === null) throw new TypeError("CLI command has no application route");
      const result: ApplicationResult<unknown> = service.execute(routed);
      if (!result.ok) return failureResult(command.format, command.id, mapApplicationFailure(result), command.apiVersion);
      if (command.id === "backup.create") {
        const authorization = parseApplicationLifecycleAuthorization(result.value);
        const generation = await store!.createBackup(authorization);
        const manifest = generation.manifest;
        return successResult(command.format, command.id, Object.freeze({
          generationId: generation.generationId,
          kind: manifest.kind,
          sourceSchemaVersion: manifest.sourceSchemaVersion,
          createdAt: manifest.createdAt,
          verified: true,
        }), command.apiVersion);
      }
      if (command.id === "restore") {
        const authorization = parseApplicationLifecycleAuthorization(result.value);
        await store!.close();
        store = null;
        const restoreDoctor = inspectRuntimeDoctor(runtimeRoot, options.sourceCheckoutRoot);
        const restoreBlock = mapDoctorBlock(command.id, restoreDoctor);
        if (restoreBlock !== null) {
          return failureResult(command.format, command.id, restoreBlock, command.apiVersion);
        }
        const expectedCurrent = await inspectPrimaryIdentity(selection.layout);
        const receipt = await restoreBackup(selection.layout, {
          generationId: option(command, "generation-id"),
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: options.applicationVersion ?? "0.0.0-development",
          authorization,
        });
        return successResult(command.format, command.id, Object.freeze({
          backupGenerationId: receipt.backupGenerationId,
          targetSchemaVersion: receipt.targetSchemaVersion,
          restoredAt: receipt.restoredAt,
          dataLossAcknowledged: true,
        }), command.apiVersion);
      }
      return successResult(command.format, command.id, applicationValueResult(command, result.value, clock()), command.apiVersion);
    })();
  } catch (error) {
    const code = error instanceof PersistenceError ? mapPersistenceFailure(error) : "INTERNAL_ERROR";
    outcome = failureResult(command.format, command.id, code, command.apiVersion);
  }
  if (store !== null) {
    try {
      await store.close();
    } catch (error) {
      const code = error instanceof PersistenceError ? mapPersistenceFailure(error) : "INTERNAL_ERROR";
      return failureResult(command.format, command.id, code, command.apiVersion);
    }
  }
  return outcome;
}
