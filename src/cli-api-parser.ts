import path from "node:path";
import {
  AUTHORIZATION_ACTIONS,
  type AuthorizationAction,
} from "./authorization.ts";
import {
  isCanonicalCancellationReason,
  type ApplicationCommand,
} from "./application.ts";
import type { LocalRuntimeSelection } from "./persistence/local-ingress.ts";
import {
  CLI_API_VERSION,
  COMMAND_SPECS,
  ONE_TOKEN_COMMANDS,
  PRODUCT_COMMAND_IDS,
  type CliFormat,
  type CommandSpec,
  type ParsedCliCommand,
  type ParseFailure,
  type ParseResult,
} from "./cli-api-model.ts";

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
  if (action !== undefined && !(AUTHORIZATION_ACTIONS as readonly string[]).includes(action)) {
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
  if (PRODUCT_COMMAND_IDS.has(spec.id)) {
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
  const spec = COMMAND_SPECS.find((candidate) =>
    candidate.path.length === commandPath.length && candidate.path.every((part, partIndex) => part === commandPath[partIndex])
  );
  if (spec === undefined) return parseFailure(format);
  if (apiVersion !== CLI_API_VERSION) {
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
  const optionError = validateOptions(spec, options, now);
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

export function option(command: ParsedCliCommand, name: string): string {
  const value = command.options[name];
  if (value === undefined) throw new TypeError("Parsed command option is absent");
  return value;
}

export function optionRevision(command: ParsedCliCommand, name: string): number {
  const value = canonicalRevision(option(command, name));
  if (value === null) throw new TypeError("Parsed revision is invalid");
  return value;
}

export function applicationCommand(
  command: ParsedCliCommand,
  selection: LocalRuntimeSelection,
  generationId: string | null,
): ApplicationCommand | null {
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

export function confirmationFor(command: ParsedCliCommand): Readonly<{
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
