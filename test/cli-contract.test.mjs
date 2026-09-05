import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CLI_API_VERSION,
  PUBLIC_ERROR_TABLE,
  mapCodexProductFailureToPublicCode,
  mapProductFailureToPublicCode,
  parseCliArguments,
  runCli,
} from "../src/cli-api.ts";
import { APPLICATION_ERROR_CODES } from "../src/application.ts";
import { DISPATCHER_ERROR_CODES } from "../src/dispatcher-application.ts";
import { CODEX_PRODUCT_ERROR_CODES } from "../src/codex-product-application.ts";
import { RELIABLE_EXECUTION_ERROR_CODES } from "../src/execution-loop.ts";

const NOW = "2026-08-30T00:00:00.000Z";
const EXPIRY = "2026-09-20T00:00:00.000Z";
const PROJECT_ROOT = path.resolve("test-cli-contract-project");
const CODEX_HOME = path.resolve("test-cli-contract-codex-home");
const GENERATION = "11111111-1111-4111-8111-111111111111";

const CASES = Object.freeze([
  ["status", ["status"], []],
  ["doctor", ["doctor"], []],
  ["init", ["init"], ["expires-at", EXPIRY, "confirm", "INITIALIZE LOCAL RUNTIME"]],
  ["restore", ["restore"], ["generation-id", GENERATION, "confirm", "RESTORE LOCAL BACKUP", "acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA"]],
  ["authorization.renew", ["authorization", "renew"], ["expires-at", EXPIRY, "confirm", "RENEW LOCAL CAPABILITIES"]],
  ["authorization.list", ["authorization", "list"], ["limit", "10", "after-grant-id", "grant.cursor"]],
  ["authorization.show", ["authorization", "show"], ["grant-id", "grant-1", "expected-grant-revision", "1"]],
  ["authorization.issue", ["authorization", "issue"], ["action", "task.inspect", "scope", "runtime", "not-before", NOW, "expires-at", "2026-09-01T00:00:00.000Z", "confirm", "ISSUE LOCAL GRANT"]],
  ["authorization.revoke", ["authorization", "revoke"], ["grant-id", "grant-1", "expected-grant-revision", "1", "confirm", "REVOKE LOCAL GRANT"]],
  ["authorization.evaluate", ["authorization", "evaluate"], ["project-id", "project", "expected-resource-revision", "1", "expected-config-revision", "1", "action", "task.create"]],
  ["project.register", ["project", "register"], ["project-id", "project", "root", PROJECT_ROOT, "confirm", "REGISTER LOCAL PROJECT"]],
  ["project.show", ["project", "show"], ["project-id", "project", "expected-resource-revision", "1"]],
  ["project.update", ["project", "update"], ["project-id", "project", "expected-resource-revision", "1", "expected-config-revision", "1", "confirm", "UPDATE LOCAL PROJECT"]],
  ["project.disable", ["project", "disable"], ["project-id", "project", "expected-resource-revision", "1", "expected-config-revision", "1", "confirm", "DISABLE LOCAL PROJECT"]],
  ["task.create", ["task", "create"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "body", "body", "supersedes-task-id", "older"]],
  ["task.show", ["task", "show"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1"]],
  ["task.update-body", ["task", "update-body"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1", "body", "updated"]],
  ["task.set-parent", ["task", "set-parent"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1", "parent-id", "parent"]],
  ["task.clear-parent", ["task", "clear-parent"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1"]],
  ["task.mark-ready", ["task", "mark-ready"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1"]],
  ["task.cancel", ["task", "cancel"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1", "reason", "cancelled locally"]],
  ["dependency.add", ["dependency", "add"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1", "dependency-id", "dependency", "expected-dependency-revision", "1"]],
  ["dependency.remove", ["dependency", "remove"], ["project-id", "project", "expected-project-resource-revision", "1", "task-id", "task", "expected-task-revision", "1", "dependency-id", "dependency", "expected-dependency-revision", "1"]],
  ["backup.create", ["backup", "create"], []],
]);

const COMMON = Object.freeze([
  "project-id", "project", "expected-project-resource-revision", "1",
  "expected-project-config-revision", "1", "task-id", "task", "expected-task-revision", "2",
  "execution-id", "execution-1", "expected-execution-revision", "1", "expected-attempt-number", "1",
  "expected-fencing-token", "1", "idempotency-key", "operation-1",
]);

const PRODUCT_CASES = Object.freeze([
  ["authorization.upgrade", ["authorization", "upgrade"], ["expires-at", EXPIRY, "confirm", "UPGRADE LOCAL CAPABILITIES"]],
  ["dispatch.run", ["dispatch", "run"], ["idempotency-key", "dispatch-1", "lease-duration-seconds", "300"]],
  ["dispatch.resume", ["dispatch", "resume"], ["run-id", "run-1"]],
  ["execution.inspect", ["execution", "inspect"], COMMON],
  ["execution.resume", ["execution", "resume"], [...COMMON, "continuation-reference", "continuation-1", "required-action-receipt-id", "required-1"]],
  ["execution.retry", ["execution", "retry"], [...COMMON, "continuation-reference", "continuation-1", "required-action-receipt-id", "required-1"]],
  ["execution.request-cancel", ["execution", "request-cancel"], [...COMMON, "reason-code", "cancel-1"]],
  ["manual.outcome-report", ["manual", "outcome-report"], [...COMMON, "report-id", "report-1", "outcome", "wait", "code", "waiting-1", "evidence-reference", "evidence-1", "confirm", "RECORD MANUAL OUTCOME"]],
  ["execution.accept-manual-completion", ["execution", "accept-manual-completion"], [...COMMON, "confirm", "ACCEPT MANUAL COMPLETION"]],
]);

const CODEX_CASES = Object.freeze([
  ["codex.profile.activate", ["codex", "profile", "activate"], [
    "project-id", "project", "expected-project-resource-revision", "1",
    "expected-project-config-revision", "1", "profile-id", "profile-1",
    "expected-profile-revision", "0", "workspace-root-key", "workspace-root-1",
    "workspace-root", PROJECT_ROOT, "codex-home-key", "codex-home-1", "codex-home", CODEX_HOME,
    "git-executable", process.execPath, "idempotency-key", "profile-activate-1", "confirm", "ACTIVATE CODEX PROFILE",
  ]],
  ["codex.profile.inspect", ["codex", "profile", "inspect"], [
    "project-id", "project", "expected-project-resource-revision", "1",
    "expected-project-config-revision", "1", "profile-id", "profile-1",
    "expected-profile-revision", "1",
  ]],
  ["codex.profile.deactivate", ["codex", "profile", "deactivate"], [
    "project-id", "project", "expected-project-resource-revision", "1",
    "expected-project-config-revision", "1", "profile-id", "profile-1",
    "expected-profile-revision", "1", "idempotency-key", "profile-deactivate-1",
    "confirm", "DEACTIVATE CODEX PROFILE",
  ]],
  ["codex.dispatch-run", ["codex", "dispatch-run"], [
    "project-id", "project", "expected-project-resource-revision", "1",
    "expected-project-config-revision", "1", "profile-id", "profile-1",
    "expected-profile-revision", "1", "task-id", "task", "expected-task-revision", "2",
    "base-reference", "1111111111111111111111111111111111111111",
    "idempotency-key", "codex-dispatch-1", "lease-duration-seconds", "300",
    "confirm", "INVOKE CODEX TASK",
  ]],
]);

const CURRENT_CASES = Object.freeze([...CASES, ...PRODUCT_CASES, ...CODEX_CASES]);

function argsFor(commandPath, options) {
  const result = [...commandPath];
  for (let index = 0; index < options.length; index += 2) {
    result.push(`--${options[index]}`, options[index + 1]);
  }
  return result;
}

test("the sole ato.api/v1 has one exact 37-command tree and duplicate-free option sets", () => {
  assert.equal(CLI_API_VERSION, "ato.api/v1");
  assert.equal(CASES.length, 24);
  assert.equal(PRODUCT_CASES.length, 9);
  assert.equal(CODEX_CASES.length, 4);
  assert.equal(CURRENT_CASES.length, 37);
  assert.equal(new Set(CURRENT_CASES.map(([id]) => id)).size, 37);
  for (const [id, commandPath, options] of CURRENT_CASES) {
    const parsed = parseCliArguments(argsFor(commandPath, options), NOW);
    assert.equal(parsed.ok, true, `${id} did not parse`);
    assert.equal(parsed.command.id, id);
    assert.equal(parsed.command.apiVersion, CLI_API_VERSION);
    assert.equal(parsed.command.format, "human");
    assert.deepEqual(Object.keys(parsed.command.options).sort(), options.filter((_value, index) => index % 2 === 0).sort());
    const explicit = parseCliArguments(["--api-version", CLI_API_VERSION, ...argsFor(commandPath, options)], NOW);
    assert.deepEqual(explicit, parsed, `${id} differs between omitted and explicit ato.api/v1`);
  }
  const projectScope = parseCliArguments(argsFor(["authorization", "issue"], [
    "action", "task.inspect", "scope", "project", "project-id", "project",
    "expected-resource-revision", "1", "expected-config-revision", "1",
    "not-before", NOW, "expires-at", "2026-09-01T00:00:00.000Z",
    "confirm", "ISSUE LOCAL GRANT",
  ]), NOW);
  assert.equal(projectScope.ok, true);
  assert.equal(parseCliArguments([
    "authorization", "evaluate",
    "--project-id", "project", "--expected-resource-revision", "1", "--expected-config-revision", "1",
    "--action", "dispatch.run",
  ], NOW).ok, true);
});

test("ato.api/v1 preserves 128-byte IDs but closes reason and Manual codes at 64 bytes", () => {
  const code64 = `c${"a".repeat(63)}`;
  const code65 = `c${"a".repeat(64)}`;
  const id128 = `i${"a".repeat(127)}`;
  const id129 = `i${"a".repeat(128)}`;
  const cancel = (reasonCode) => [
    ...argsFor(["execution", "request-cancel"], [...COMMON, "reason-code", reasonCode]),
  ];
  const outcome = (code, evidenceReference = "evidence-1") => [
    ...argsFor(["manual", "outcome-report"], [
      ...COMMON, "report-id", "report-1", "outcome", "wait", "code", code,
      "evidence-reference", evidenceReference, "confirm", "RECORD MANUAL OUTCOME",
    ]),
  ];
  assert.equal(parseCliArguments(cancel(code64), NOW).ok, true);
  assert.equal(parseCliArguments(cancel(code65), NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(outcome(code64, id128), NOW).ok, true);
  assert.equal(parseCliArguments(outcome(code65, id128), NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(outcome(code64, id129), NOW).code, "CLI_INVALID_INPUT");
});

test("CLI grammar rejects aliases, equals, response files, positionals, repeated globals, and misplaced globals", () => {
  const invalid = [
    [], ["unknown"], ["task"], ["status", "extra"], ["-j", "status"],
    ["--format=json", "status"], ["@args.txt"], ["status", "--format", "json"],
    ["--format", "json", "--format", "json", "status"],
    ["authorization", "list", "--limit=1"],
    ["authorization", "list", "--limit", "1", "positional"],
    ["authorization", "list", "--limit", "1", "--limit", "2"],
    ["authorization", "list", "--limit", "1", "--unknown", "x"],
    ["authorization", "list", "--limit"],
    ["status", "--limit", "1"],
  ];
  for (const args of invalid) assert.equal(parseCliArguments(args, NOW).ok, false, JSON.stringify(args));
  assert.deepEqual(parseCliArguments(["--format", "json", "unknown"], NOW), {
    ok: false, format: "json", command: "unknown", code: "CLI_INVALID_INPUT",
  });
  assert.deepEqual(parseCliArguments(["--api-version", "ato.api/v3", "status"], NOW), {
    ok: false, format: "human", command: "status", code: "CLI_UNSUPPORTED_VERSION",
  });
  assert.deepEqual(parseCliArguments(["--api-version", "ato.api/v2", "dispatch", "run"], NOW), {
    ok: false, format: "human", command: "dispatch.run", code: "CLI_UNSUPPORTED_VERSION",
  });
  assert.equal(parseCliArguments(["--format", "yaml", "status"], NOW).format, "human");
  assert.equal(parseCliArguments(["--format", "json", "status", "--bad", "x"], NOW).format, "json");
});

test("confirmation, acknowledgement, list bounds, and issuance scope have dedicated parse outcomes", () => {
  assert.equal(parseCliArguments(["authorization", "list", "--limit", "101"], NOW).code, "RESULT_LIMIT_EXCEEDED");
  assert.equal(parseCliArguments(["authorization", "list", "--limit", "01"], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(["init", "--expires-at", EXPIRY], NOW).code, "CONFIRMATION_REQUIRED");
  assert.equal(parseCliArguments(["init", "--expires-at", EXPIRY, "--confirm", "wrong"], NOW).code, "CONFIRMATION_REQUIRED");
  const continuation = argsFor(["execution", "retry"], [
    ...COMMON,
    "continuation-reference", "continuation-1",
    "required-action-receipt-id", "required-1",
  ]);
  assert.equal(parseCliArguments(continuation, NOW).ok, true);
  assert.equal(
    parseCliArguments([...continuation, "--confirm", "wrong"], NOW).code,
    "CONFIRMATION_REQUIRED",
  );
  assert.equal(
    parseCliArguments([...continuation, "--confirm", "INVOKE CODEX CONTINUATION"], NOW).ok,
    true,
  );
  assert.equal(parseCliArguments([
    "restore", "--generation-id", GENERATION, "--confirm", "RESTORE LOCAL BACKUP",
  ], NOW).code, "DATA_LOSS_ACK_REQUIRED");
  assert.equal(parseCliArguments([
    "restore", "--generation-id", GENERATION, "--confirm", "RESTORE LOCAL BACKUP",
    "--acknowledge-data-loss", "wrong",
  ], NOW).code, "DATA_LOSS_ACK_REQUIRED");
  assert.equal(parseCliArguments(argsFor(["authorization", "issue"], [
    "action", "task.inspect", "scope", "runtime", "project-id", "project",
    "not-before", NOW, "expires-at", "2026-09-01T00:00:00.000Z", "confirm", "ISSUE LOCAL GRANT",
  ]), NOW).code, "CLI_INVALID_INPUT");
});

test("the public code, exit, and fixed-message table is exact", () => {
  assert.deepEqual(PUBLIC_ERROR_TABLE, {
    CLI_INVALID_INPUT: { exitCode: 2, message: "The command input is invalid." },
    CLI_UNSUPPORTED_VERSION: { exitCode: 2, message: "The requested API version is unsupported." },
    RUNTIME_NOT_INITIALIZED: { exitCode: 3, message: "The local runtime is not initialized." },
    RUNTIME_ALREADY_INITIALIZED: { exitCode: 3, message: "The local runtime is already initialized." },
    CAPABILITY_RENEWAL_NOT_DUE: { exitCode: 3, message: "Local capabilities are not eligible for renewal." },
    AUTHORIZATION_DENIED: { exitCode: 4, message: "Current explicit authorization denied the operation." },
    CONFIRMATION_REQUIRED: { exitCode: 4, message: "The exact current confirmation is required." },
    SCOPE_EXPANSION_DENIED: { exitCode: 4, message: "The requested authorization scope exceeds current authority." },
    PROJECT_NOT_FOUND: { exitCode: 5, message: "The Project was not found." },
    TASK_NOT_FOUND: { exitCode: 5, message: "The Task was not found." },
    GRANT_NOT_FOUND: { exitCode: 5, message: "The grant was not found." },
    BACKUP_NOT_FOUND: { exitCode: 5, message: "The backup generation was not found." },
    EXECUTION_NOT_FOUND: { exitCode: 5, message: "The execution was not found." },
    DISPATCH_RUN_NOT_FOUND: { exitCode: 5, message: "The dispatcher run was not found." },
    STALE_REVISION: { exitCode: 6, message: "The expected revision is stale." },
    DOMAIN_REJECTED: { exitCode: 6, message: "The requested Task operation was rejected." },
    PROJECT_ALREADY_REGISTERED: { exitCode: 6, message: "The Project is already registered." },
    PROJECT_REGISTRY_REJECTED: { exitCode: 6, message: "The Project registry rejected the operation." },
    RESULT_LIMIT_EXCEEDED: { exitCode: 6, message: "The requested result limit is invalid." },
    OPERATION_CONFLICT: { exitCode: 6, message: "The operation conflicts with current state." },
    STALE_FENCE: { exitCode: 6, message: "The execution or dispatcher ownership fence is stale." },
    LEASE_EXPIRED: { exitCode: 6, message: "The execution or dispatcher lease has expired." },
    RECONCILIATION_REQUIRED: { exitCode: 6, message: "Durable reconciliation is required before the operation can continue." },
    RUNTIME_UNSAFE: { exitCode: 7, message: "The local runtime identity or topology is unsafe." },
    RUNTIME_ACTIVE: { exitCode: 7, message: "The local runtime is active." },
    SCHEMA_UNSUPPORTED: { exitCode: 7, message: "The runtime schema is unsupported." },
    MIGRATION_INVALID: { exitCode: 7, message: "The runtime migration history is invalid." },
    STATE_CORRUPT: { exitCode: 7, message: "The runtime state is corrupt." },
    BACKUP_INVALID: { exitCode: 7, message: "The backup generation is invalid." },
    PERSISTENCE_UNAVAILABLE: { exitCode: 7, message: "Local persistence is unavailable." },
    ADAPTER_FAILURE: { exitCode: 7, message: "The Manual execution adapter failed." },
    DATA_LOSS_ACK_REQUIRED: { exitCode: 8, message: "The exact data-loss acknowledgement is required." },
    RESTORE_CONFLICT: { exitCode: 8, message: "Restore conflicts with current state." },
    RESTORE_BLOCKED: { exitCode: 8, message: "Restore is blocked." },
    RESTORE_RECOVERY_REQUIRED: { exitCode: 8, message: "Restore requires manual recovery." },
    AMBIGUOUS_EXTERNAL_STATE: { exitCode: 8, message: "The external execution state is ambiguous." },
    INTERNAL_ERROR: { exitCode: 9, message: "The operation failed internally." },
    CODEX_PROFILE_NOT_FOUND: { exitCode: 5, message: "The Codex profile was not found." },
    CODEX_PROFILE_INACTIVE: { exitCode: 6, message: "The Codex profile is not active." },
    CODEX_CREDENTIAL_UNAVAILABLE: { exitCode: 7, message: "The configured Codex credential is unavailable." },
    CODEX_ADAPTER_FAILURE: { exitCode: 7, message: "The Codex execution adapter failed." },
  });
  assert.equal(Object.keys(PUBLIC_ERROR_TABLE).length, 41);
});

test("every application, reliable-loop, and dispatcher error has the exact current public mapping", () => {
  const application = {
    INVALID_INPUT: "CLI_INVALID_INPUT",
    BOOTSTRAP_ALREADY_CONSUMED: "RUNTIME_ALREADY_INITIALIZED",
    BOOTSTRAP_REQUIRED: "RUNTIME_NOT_INITIALIZED",
    AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
    PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
    PROJECT_ALREADY_REGISTERED: "PROJECT_ALREADY_REGISTERED",
    PROJECT_REGISTRY_REJECTED: "PROJECT_REGISTRY_REJECTED",
    TASK_NOT_FOUND: "TASK_NOT_FOUND",
    GRANT_NOT_FOUND: "GRANT_NOT_FOUND",
    STALE_REVISION: "STALE_REVISION",
    DOMAIN_REJECTED: "DOMAIN_REJECTED",
    SCOPE_EXPANSION_DENIED: "SCOPE_EXPANSION_DENIED",
    CAPABILITY_RENEWAL_NOT_DUE: "CAPABILITY_RENEWAL_NOT_DUE",
    CAPABILITY_UPGRADE_NOT_ELIGIBLE: "AUTHORIZATION_DENIED",
  };
  const reliable = {
    INVALID_INPUT: "CLI_INVALID_INPUT",
    AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
    CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
    PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
    PROJECT_DISABLED: "DOMAIN_REJECTED",
    PROJECT_IDENTITY_CHANGED: "PROJECT_REGISTRY_REJECTED",
    TASK_NOT_FOUND: "TASK_NOT_FOUND",
    TASK_NOT_ELIGIBLE: "DOMAIN_REJECTED",
    EXECUTION_NOT_FOUND: "EXECUTION_NOT_FOUND",
    EXECUTION_TERMINAL: "DOMAIN_REJECTED",
    IDEMPOTENCY_CONFLICT: "OPERATION_CONFLICT",
    STALE_REVISION: "STALE_REVISION",
    STALE_FENCE: "STALE_FENCE",
    LEASE_EXPIRED: "LEASE_EXPIRED",
    RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
    ADAPTER_FAILURE: "ADAPTER_FAILURE",
    AMBIGUOUS_EXTERNAL_STATE: "AMBIGUOUS_EXTERNAL_STATE",
    PERSISTENCE_FAILURE: "PERSISTENCE_UNAVAILABLE",
  };
  const dispatcher = {
    INVALID_INPUT: "CLI_INVALID_INPUT",
    AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
    IDEMPOTENCY_CONFLICT: "OPERATION_CONFLICT",
    RUN_NOT_FOUND: "DISPATCH_RUN_NOT_FOUND",
    RUN_NOT_RECONCILED: "RECONCILIATION_REQUIRED",
    RUN_NOT_SEALED: "RECONCILIATION_REQUIRED",
    MEMBER_NOT_FOUND: "RECONCILIATION_REQUIRED",
    MEMBER_NOT_PENDING: "RECONCILIATION_REQUIRED",
    STALE_REVISION: "STALE_REVISION",
    STALE_OWNER: "STALE_FENCE",
    LEASE_EXPIRED: "LEASE_EXPIRED",
    LEASE_NOT_EXPIRED: "OPERATION_CONFLICT",
    RECONCILIATION_INCOMPLETE: "RECONCILIATION_REQUIRED",
    PROJECT_IDENTITY_CHANGED: "PROJECT_REGISTRY_REJECTED",
    INTEGRITY_FAILURE: "STATE_CORRUPT",
    PERSISTENCE_FAILURE: "PERSISTENCE_UNAVAILABLE",
  };
  const codex = {
    INVALID_INPUT: "CLI_INVALID_INPUT",
    AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
    CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
    PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
    PROJECT_DISABLED: "DOMAIN_REJECTED",
    PROJECT_IDENTITY_CHANGED: "PROJECT_REGISTRY_REJECTED",
    TASK_NOT_FOUND: "TASK_NOT_FOUND",
    TASK_NOT_ELIGIBLE: "DOMAIN_REJECTED",
    CODEX_PROFILE_NOT_FOUND: "CODEX_PROFILE_NOT_FOUND",
    CODEX_PROFILE_INACTIVE: "CODEX_PROFILE_INACTIVE",
    CODEX_CREDENTIAL_UNAVAILABLE: "CODEX_CREDENTIAL_UNAVAILABLE",
    IDEMPOTENCY_CONFLICT: "OPERATION_CONFLICT",
    STALE_REVISION: "STALE_REVISION",
    STALE_FENCE: "STALE_FENCE",
    LEASE_EXPIRED: "LEASE_EXPIRED",
    RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
    CODEX_ADAPTER_FAILURE: "CODEX_ADAPTER_FAILURE",
    PERSISTENCE_FAILURE: "PERSISTENCE_UNAVAILABLE",
  };
  assert.deepEqual(Object.keys(application), [...APPLICATION_ERROR_CODES]);
  assert.deepEqual(Object.keys(reliable), [...RELIABLE_EXECUTION_ERROR_CODES]);
  assert.deepEqual(Object.keys(dispatcher), [...DISPATCHER_ERROR_CODES]);
  assert.deepEqual(Object.keys(codex), [...CODEX_PRODUCT_ERROR_CODES]);
  for (const code of APPLICATION_ERROR_CODES) {
    assert.equal(mapProductFailureToPublicCode({ owner: "application", code, confirmationRequired: false }), application[code]);
  }
  assert.equal(mapProductFailureToPublicCode({
    owner: "application", code: "AUTHORIZATION_DENIED", confirmationRequired: true,
  }), "CONFIRMATION_REQUIRED");
  for (const code of RELIABLE_EXECUTION_ERROR_CODES) {
    assert.equal(mapProductFailureToPublicCode({ owner: "reliable", code }), reliable[code]);
  }
  for (const code of DISPATCHER_ERROR_CODES) {
    assert.equal(mapProductFailureToPublicCode({ owner: "dispatcher", code }), dispatcher[code]);
  }
  for (const code of CODEX_PRODUCT_ERROR_CODES) {
    assert.equal(mapCodexProductFailureToPublicCode({ code, message: "bounded" }), codex[code]);
  }
  assert.equal(mapProductFailureToPublicCode({ owner: "reliable", code: "UNCLASSIFIED" }), "INTERNAL_ERROR");
  assert.equal(mapProductFailureToPublicCode({ owner: "unclassified", code: "UNCLASSIFIED" }), "INTERNAL_ERROR");
});

test("invalid runs use one current envelope and unsupported majors stop before runtime creation", async () => {
  const json = await runCli(["--format", "json", "unknown", "sensitive-input"], { sourceCheckoutRoot: path.resolve(".") });
  assert.deepEqual(json, {
    exitCode: 2,
    stdout: '{"apiVersion":"ato.api/v1","command":"unknown","ok":false,"error":{"code":"CLI_INVALID_INPUT","message":"The command input is invalid."}}\n',
    stderr: "",
  });
  assert.equal(json.stdout.includes("sensitive-input"), false);
  const human = await runCli(["authorization", "list", "--limit", "101"], { sourceCheckoutRoot: path.resolve(".") });
  assert.deepEqual(human, {
    exitCode: 6,
    stdout: 'ERROR authorization.list code="RESULT_LIMIT_EXCEEDED" message="The requested result limit is invalid."\n',
    stderr: "",
  });
  const failedClock = await runCli(["--format", "json", "status"], {
    sourceCheckoutRoot: path.resolve("."),
    now() { throw new Error("private clock failure"); },
  });
  assert.equal(failedClock.exitCode, 2);
  assert.equal(failedClock.stdout.includes("private clock failure"), false);
  assert.equal(failedClock.stderr, "");
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-unsupported-major-"));
  const runtimeRoot = path.join(generation, "runtime-must-not-exist");
  try {
    const retired = await runCli([
      "--format", "json", "--api-version", "ato.api/v2", "--runtime-root", runtimeRoot,
      "init", "--expires-at", EXPIRY, "--confirm", "INITIALIZE LOCAL RUNTIME",
    ], { sourceCheckoutRoot: path.resolve(".") });
    assert.deepEqual(retired, {
      exitCode: 2,
      stdout: '{"apiVersion":"ato.api/v1","command":"init","ok":false,"error":{"code":"CLI_UNSUPPORTED_VERSION","message":"The requested API version is unsupported."}}\n',
      stderr: "",
    });
    assert.equal(existsSync(runtimeRoot), false);
  } finally {
    rmSync(generation, { recursive: true, force: true });
  }
});
