import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  CLI_API_VERSION,
  PUBLIC_ERROR_TABLE,
  parseCliArguments,
  runCli,
} from "../src/cli-api.ts";

const NOW = "2026-08-30T00:00:00.000Z";
const EXPIRY = "2026-09-20T00:00:00.000Z";
const PROJECT_ROOT = path.resolve("test-cli-contract-project");
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

function argsFor(commandPath, options) {
  const result = [...commandPath];
  for (let index = 0; index < options.length; index += 2) {
    result.push(`--${options[index]}`, options[index + 1]);
  }
  return result;
}

test("ato.api/v1 has one closed command tree and exact duplicate-free option sets", () => {
  assert.equal(CLI_API_VERSION, "ato.api/v1");
  for (const [id, commandPath, options] of CASES) {
    const parsed = parseCliArguments(argsFor(commandPath, options), NOW);
    assert.equal(parsed.ok, true, `${id} did not parse`);
    assert.equal(parsed.command.id, id);
    assert.equal(parsed.command.apiVersion, CLI_API_VERSION);
    assert.equal(parsed.command.format, "human");
    assert.deepEqual(Object.keys(parsed.command.options).sort(), options.filter((_value, index) => index % 2 === 0).sort());
  }
  const projectScope = parseCliArguments(argsFor(["authorization", "issue"], [
    "action", "task.inspect", "scope", "project", "project-id", "project",
    "expected-resource-revision", "1", "expected-config-revision", "1",
    "not-before", NOW, "expires-at", "2026-09-01T00:00:00.000Z",
    "confirm", "ISSUE LOCAL GRANT",
  ]), NOW);
  assert.equal(projectScope.ok, true);
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
    argsFor(["authorization", "issue"], [
      "action", "execution.claim", "scope", "runtime", "not-before", NOW,
      "expires-at", "2026-09-01T00:00:00.000Z", "confirm", "ISSUE LOCAL GRANT",
    ]),
    argsFor(["authorization", "evaluate"], [
      "project-id", "project", "expected-resource-revision", "1",
      "expected-config-revision", "1", "action", "execution.claim",
    ]),
  ];
  for (const args of invalid) assert.equal(parseCliArguments(args, NOW).ok, false, JSON.stringify(args));
  assert.deepEqual(parseCliArguments(["--format", "json", "unknown"], NOW), {
    ok: false, format: "json", command: "unknown", code: "CLI_INVALID_INPUT",
  });
  assert.deepEqual(parseCliArguments(["--api-version", "ato.api/v2", "status"], NOW), {
    ok: false, format: "human", command: "status", code: "CLI_UNSUPPORTED_VERSION",
  });
  assert.equal(parseCliArguments(["--format", "yaml", "status"], NOW).format, "human");
  assert.equal(parseCliArguments(["--format", "json", "status", "--bad", "x"], NOW).format, "json");
});

test("confirmation, acknowledgement, list bounds, and issuance scope have dedicated parse outcomes", () => {
  assert.equal(parseCliArguments(["authorization", "list", "--limit", "101"], NOW).code, "RESULT_LIMIT_EXCEEDED");
  assert.equal(parseCliArguments(["authorization", "list", "--limit", "01"], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(["init", "--expires-at", EXPIRY], NOW).code, "CONFIRMATION_REQUIRED");
  assert.equal(parseCliArguments(["init", "--expires-at", EXPIRY, "--confirm", "wrong"], NOW).code, "CONFIRMATION_REQUIRED");
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
    STALE_REVISION: { exitCode: 6, message: "The expected revision is stale." },
    DOMAIN_REJECTED: { exitCode: 6, message: "The requested Task operation was rejected." },
    PROJECT_ALREADY_REGISTERED: { exitCode: 6, message: "The Project is already registered." },
    PROJECT_REGISTRY_REJECTED: { exitCode: 6, message: "The Project registry rejected the operation." },
    RESULT_LIMIT_EXCEEDED: { exitCode: 6, message: "The requested result limit is invalid." },
    OPERATION_CONFLICT: { exitCode: 6, message: "The operation conflicts with current state." },
    RUNTIME_UNSAFE: { exitCode: 7, message: "The local runtime identity or topology is unsafe." },
    RUNTIME_ACTIVE: { exitCode: 7, message: "The local runtime is active." },
    SCHEMA_UNSUPPORTED: { exitCode: 7, message: "The runtime schema is unsupported." },
    MIGRATION_INVALID: { exitCode: 7, message: "The runtime migration history is invalid." },
    STATE_CORRUPT: { exitCode: 7, message: "The runtime state is corrupt." },
    BACKUP_INVALID: { exitCode: 7, message: "The backup generation is invalid." },
    PERSISTENCE_UNAVAILABLE: { exitCode: 7, message: "Local persistence is unavailable." },
    DATA_LOSS_ACK_REQUIRED: { exitCode: 8, message: "The exact data-loss acknowledgement is required." },
    RESTORE_CONFLICT: { exitCode: 8, message: "Restore conflicts with current state." },
    RESTORE_BLOCKED: { exitCode: 8, message: "Restore is blocked." },
    RESTORE_RECOVERY_REQUIRED: { exitCode: 8, message: "Restore requires manual recovery." },
    INTERNAL_ERROR: { exitCode: 9, message: "The operation failed internally." },
  });
});

test("invalid run results use exact one-line human/JSON envelopes and never throw on a failed trusted clock", async () => {
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
});
