export const CLI_API_VERSION = "ato.api/v1" as const;

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
  EXECUTION_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The execution was not found." }),
  DISPATCH_RUN_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The dispatcher run was not found." }),
  STALE_REVISION: Object.freeze({ exitCode: 6, message: "The expected revision is stale." }),
  DOMAIN_REJECTED: Object.freeze({ exitCode: 6, message: "The requested Task operation was rejected." }),
  PROJECT_ALREADY_REGISTERED: Object.freeze({ exitCode: 6, message: "The Project is already registered." }),
  PROJECT_REGISTRY_REJECTED: Object.freeze({ exitCode: 6, message: "The Project registry rejected the operation." }),
  RESULT_LIMIT_EXCEEDED: Object.freeze({ exitCode: 6, message: "The requested result limit is invalid." }),
  OPERATION_CONFLICT: Object.freeze({ exitCode: 6, message: "The operation conflicts with current state." }),
  STALE_FENCE: Object.freeze({ exitCode: 6, message: "The execution or dispatcher ownership fence is stale." }),
  LEASE_EXPIRED: Object.freeze({ exitCode: 6, message: "The execution or dispatcher lease has expired." }),
  RECONCILIATION_REQUIRED: Object.freeze({ exitCode: 6, message: "Durable reconciliation is required before the operation can continue." }),
  RUNTIME_UNSAFE: Object.freeze({ exitCode: 7, message: "The local runtime identity or topology is unsafe." }),
  RUNTIME_ACTIVE: Object.freeze({ exitCode: 7, message: "The local runtime is active." }),
  SCHEMA_UNSUPPORTED: Object.freeze({ exitCode: 7, message: "The runtime schema is unsupported." }),
  MIGRATION_INVALID: Object.freeze({ exitCode: 7, message: "The runtime migration history is invalid." }),
  STATE_CORRUPT: Object.freeze({ exitCode: 7, message: "The runtime state is corrupt." }),
  BACKUP_INVALID: Object.freeze({ exitCode: 7, message: "The backup generation is invalid." }),
  PERSISTENCE_UNAVAILABLE: Object.freeze({ exitCode: 7, message: "Local persistence is unavailable." }),
  ADAPTER_FAILURE: Object.freeze({ exitCode: 7, message: "The Manual execution adapter failed." }),
  DATA_LOSS_ACK_REQUIRED: Object.freeze({ exitCode: 8, message: "The exact data-loss acknowledgement is required." }),
  RESTORE_CONFLICT: Object.freeze({ exitCode: 8, message: "Restore conflicts with current state." }),
  RESTORE_BLOCKED: Object.freeze({ exitCode: 8, message: "Restore is blocked." }),
  RESTORE_RECOVERY_REQUIRED: Object.freeze({ exitCode: 8, message: "Restore requires manual recovery." }),
  AMBIGUOUS_EXTERNAL_STATE: Object.freeze({ exitCode: 8, message: "The external execution state is ambiguous." }),
  INTERNAL_ERROR: Object.freeze({ exitCode: 9, message: "The operation failed internally." }),
  CODEX_PROFILE_NOT_FOUND: Object.freeze({ exitCode: 5, message: "The Codex profile was not found." }),
  CODEX_PROFILE_INACTIVE: Object.freeze({ exitCode: 6, message: "The Codex profile is not active." }),
  CODEX_CREDENTIAL_UNAVAILABLE: Object.freeze({ exitCode: 7, message: "The configured Codex credential is unavailable." }),
  CODEX_ADAPTER_FAILURE: Object.freeze({ exitCode: 7, message: "The Codex execution adapter failed." }),
} as const);

export type PublicErrorCode = keyof typeof PUBLIC_ERROR_TABLE;
export type CliFormat = "human" | "json";

export interface ParsedCliCommand {
  readonly format: CliFormat;
  readonly apiVersion: string;
  readonly runtimeRoot: string | null;
  readonly id: string;
  readonly options: Readonly<Record<string, string>>;
}

export interface ParseFailure {
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

export interface ParseSuccess {
  readonly ok: true;
  readonly command: ParsedCliCommand;
}

export type ParseResult = ParseFailure | ParseSuccess;

export interface CommandSpec {
  readonly id: string;
  readonly path: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

const EXECUTION_COMMON_OPTIONS = Object.freeze([
  "project-id", "expected-project-resource-revision", "expected-project-config-revision", "task-id",
  "expected-task-revision", "execution-id", "expected-execution-revision", "expected-attempt-number",
  "expected-fencing-token", "idempotency-key",
]);

export const COMMAND_SPECS = Object.freeze([
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
  { id: "authorization.upgrade", path: ["authorization", "upgrade"], required: ["expires-at", "confirm"], optional: [] },
  { id: "dispatch.run", path: ["dispatch", "run"], required: ["idempotency-key", "lease-duration-seconds"], optional: [] },
  { id: "dispatch.resume", path: ["dispatch", "resume"], required: ["run-id"], optional: [] },
  { id: "execution.inspect", path: ["execution", "inspect"], required: [...EXECUTION_COMMON_OPTIONS], optional: [] },
  { id: "execution.resume", path: ["execution", "resume"], required: [...EXECUTION_COMMON_OPTIONS, "continuation-reference", "required-action-receipt-id"], optional: ["confirm"] },
  { id: "execution.retry", path: ["execution", "retry"], required: [...EXECUTION_COMMON_OPTIONS, "continuation-reference", "required-action-receipt-id"], optional: ["confirm"] },
  { id: "execution.request-cancel", path: ["execution", "request-cancel"], required: [...EXECUTION_COMMON_OPTIONS, "reason-code"], optional: [] },
  { id: "manual.outcome-report", path: ["manual", "outcome-report"], required: [...EXECUTION_COMMON_OPTIONS, "report-id", "outcome", "code", "confirm"], optional: ["evidence-reference"] },
  { id: "execution.accept-manual-completion", path: ["execution", "accept-manual-completion"], required: [...EXECUTION_COMMON_OPTIONS, "confirm"], optional: [] },
  {
    id: "codex.profile.activate", path: ["codex", "profile", "activate"],
    required: [
      "project-id", "expected-project-resource-revision", "expected-project-config-revision",
      "profile-id", "expected-profile-revision", "workspace-root-key", "workspace-root",
      "codex-home-key", "codex-home", "git-executable", "idempotency-key", "confirm",
    ], optional: [],
  },
  {
    id: "codex.profile.inspect", path: ["codex", "profile", "inspect"],
    required: [
      "project-id", "expected-project-resource-revision", "expected-project-config-revision",
      "profile-id", "expected-profile-revision",
    ], optional: [],
  },
  {
    id: "codex.profile.deactivate", path: ["codex", "profile", "deactivate"],
    required: [
      "project-id", "expected-project-resource-revision", "expected-project-config-revision",
      "profile-id", "expected-profile-revision", "idempotency-key", "confirm",
    ], optional: [],
  },
  {
    id: "codex.dispatch-run", path: ["codex", "dispatch-run"],
    required: [
      "project-id", "expected-project-resource-revision", "expected-project-config-revision",
      "profile-id", "expected-profile-revision", "task-id", "expected-task-revision",
      "base-reference", "idempotency-key", "lease-duration-seconds", "confirm",
    ], optional: [],
  },
] satisfies readonly CommandSpec[]);

export const PRODUCT_COMMAND_IDS: ReadonlySet<string> = new Set([
  "authorization.upgrade",
  "dispatch.run",
  "dispatch.resume",
  "execution.inspect",
  "execution.resume",
  "execution.retry",
  "execution.request-cancel",
  "manual.outcome-report",
  "execution.accept-manual-completion",
  "codex.profile.activate",
  "codex.profile.inspect",
  "codex.profile.deactivate",
  "codex.dispatch-run",
]);

export const ONE_TOKEN_COMMANDS: ReadonlySet<string> = new Set(["status", "doctor", "init", "restore"]);

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
