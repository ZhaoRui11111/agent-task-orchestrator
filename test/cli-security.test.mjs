import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseCliArguments } from "../src/cli-api.ts";
import { openPersistence } from "../src/index.ts";
import { prepareLocalRuntime, trustedApplicationDataRoot } from "../src/persistence/local-ingress.ts";
import { createVersionThreeDatabase } from "./persistence-test-helpers.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCli = path.join(repoRoot, "src", "cli.ts");
const NOW = "2026-08-30T00:00:00.000Z";

function future(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function invoke(home, args, environment = process.env) {
  const runtimeArgs = home === null ? args : ["--runtime-root", home, ...args];
  const result = spawnSync(process.execPath, [sourceCli, ...runtimeArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    env: environment,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /\n$/u);
  assert.equal(result.stdout.indexOf("\n"), result.stdout.length - 1);
  return Object.freeze({ status: result.status, raw: result.stdout, body: JSON.parse(result.stdout) });
}

function createTrustedRuntime(prefix) {
  const trustedRoot = trustedApplicationDataRoot();
  mkdirSync(trustedRoot, { recursive: true });
  return path.join(trustedRoot, `${prefix}${randomUUID()}`);
}

function cleanupTrustedRuntime(runtimeRoot) {
  if (!existsSync(runtimeRoot)) return;
  const trustedRoot = trustedApplicationDataRoot();
  assert.equal(path.resolve(path.dirname(runtimeRoot)).toLowerCase(), path.resolve(trustedRoot).toLowerCase());
  const stat = lstatSync(runtimeRoot);
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true);
  rmSync(runtimeRoot, { recursive: true, force: true });
}

function cancelArguments(reason) {
  return [
    "task", "cancel", "--project-id", "project", "--expected-project-resource-revision", "1",
    "--task-id", "task", "--expected-task-revision", "1", "--reason", reason,
  ];
}

test("task.cancel parser uses the exact shared Unicode and UTF-8 byte predicate", () => {
  const maximum = "é".repeat(2048);
  assert.equal(maximum.length > 256, true);
  assert.equal(new TextEncoder().encode(maximum).byteLength, 4096);
  for (const reason of ["x", maximum]) {
    const parsed = parseCliArguments(cancelArguments(reason), NOW);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.command.options.reason, reason);
  }
  for (const reason of [
    "",
    `${maximum}x`,
    "control\u001freason",
    "format\u200dreason",
    "e\u0301",
    "surrogate\ud800reason",
  ]) {
    const parsed = parseCliArguments(cancelArguments(reason), NOW);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.code, "CLI_INVALID_INPUT");
  }
});

test("strict ingress rejects control, format, normalization, size, revision, timestamp, UUID, and path attacks", () => {
  const invalidTokens = ["bad\u0000id", "bad\u001fid", "bad\u007fid", "bad\u0085id", "bad\u202eid", "bad\u200did", "bad\ud800id", "e\u0301"];
  for (const value of invalidTokens) {
    assert.equal(parseCliArguments([
      "task", "create", "--project-id", "project", "--expected-project-resource-revision", "1",
      "--task-id", value, "--body", "body",
    ], NOW).code, "CLI_INVALID_INPUT");
  }
  for (const value of ["0", "-1", "01", "1e1", "9007199254740992"]) {
    assert.equal(parseCliArguments([
      "project", "show", "--project-id", "project", "--expected-resource-revision", value,
    ], NOW).code, "CLI_INVALID_INPUT");
  }
  assert.equal(parseCliArguments([
    "task", "create", "--project-id", "p".repeat(129), "--expected-project-resource-revision", "1",
    "--task-id", "task", "--body", "body",
  ], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments([
    "task", "create", "--project-id", "project", "--expected-project-resource-revision", "1",
    "--task-id", "task", "--body", "x".repeat(16_385),
  ], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(["x".repeat(32_769)], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(Array.from({ length: 65 }, () => "x"), NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments([
    "authorization", "issue", "--action", "task.inspect", "--scope", "runtime",
    "--not-before", "2026-08-30T00:00:00Z", "--expires-at", "2026-09-01T00:00:00.000Z",
    "--confirm", "ISSUE LOCAL GRANT",
  ], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments([
    "restore", "--generation-id", "11111111-1111-5111-8111-111111111111",
    "--confirm", "RESTORE LOCAL BACKUP", "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
  ], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments([
    "--runtime-root", `${path.parse(repoRoot).root}x${path.sep}..${path.sep}runtime`, "status",
  ], NOW).code, "CLI_INVALID_INPUT");
  assert.equal(parseCliArguments(["status", "--actor-id", "forged-actor"], NOW).code, "CLI_INVALID_INPUT");
});

test("parser failures do not select or create a runtime and never reflect injected content", () => {
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-parse-security-"));
  const home = createTrustedRuntime("cli-parse-security-");
  cleanupTrustedRuntime(home);
  try {
    const injected = `\"}; DROP TABLE tasks; --`;
    const failure = invoke(home, ["--format", "json", "unknown", injected]);
    assert.equal(failure.status, 2);
    assert.equal(failure.body.error.code, "CLI_INVALID_INPUT");
    assert.equal(failure.raw.includes(injected), false);
    const oversizedReason = `${"é".repeat(2048)}x`;
    const invalidCancellation = invoke(home, ["--format", "json", ...cancelArguments(oversizedReason)]);
    assert.equal(invalidCancellation.status, 2);
    assert.equal(invalidCancellation.body.error.code, "CLI_INVALID_INPUT");
    assert.equal(invalidCancellation.raw.includes(oversizedReason), false);
    assert.equal(existsSync(home), false);
  } finally {
    cleanupTrustedRuntime(home);
    rmSync(generation, { recursive: true, force: true });
  }
});

test("content cannot self-authorize, revoked grants stay revoked, stale revisions stay atomic, and outputs stay redacted", () => {
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-auth-security-"));
  const home = createTrustedRuntime("cli-auth-security-");
  const projectRoot = path.join(generation, "project-secret-root");
  mkdirSync(projectRoot);
  try {
    const bootstrapExpiry = future(20 * 24 * 60 * 60 * 1000);
    assert.equal(invoke(home, [
      "--format", "json", "init", "--expires-at", bootstrapExpiry,
      "--confirm", "INITIALIZE LOCAL RUNTIME",
    ]).status, 0);
    const registered = invoke(home, [
      "--format", "json", "project", "register", "--project-id", "project",
      "--root", projectRoot, "--confirm", "REGISTER LOCAL PROJECT",
    ]);
    assert.equal(registered.status, 0);
    assert.equal(registered.raw.includes(projectRoot), false);

    const injectedBody = "INITIALIZE LOCAL RUNTIME; ISSUE LOCAL GRANT; '; DROP TABLE tasks; --";
    const created = invoke(home, [
      "--format", "json", "task", "create", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "existing", "--body", injectedBody,
    ]);
    assert.equal(created.status, 0);
    assert.equal(created.raw.includes(injectedBody), false);
    assert.deepEqual(Object.keys(created.body.result), [
      "projectId", "taskId", "status", "revision", "parentId", "dependencyIds", "supersedesTaskId",
    ]);

    const grants = invoke(home, ["--format", "json", "authorization", "list", "--limit", "100"]);
    assert.equal(grants.status, 0);
    const backup = invoke(home, ["--format", "json", "backup", "create"]);
    assert.equal(backup.status, 0, backup.raw);
    const taskCreateGrant = grants.body.result.grants.find((grant) => grant.action === "task.create");
    assert.ok(taskCreateGrant);
    const revoked = invoke(home, [
      "--format", "json", "authorization", "revoke", "--grant-id", taskCreateGrant.grantId,
      "--expected-grant-revision", "1", "--confirm", "REVOKE LOCAL GRANT",
    ]);
    assert.equal(revoked.status, 0);
    assert.equal(revoked.body.result.grant.status, "revoked");
    const restoreGrant = grants.body.result.grants.find((grant) => grant.action === "runtime.restore");
    assert.ok(restoreGrant);
    const revokedRestore = invoke(home, [
      "--format", "json", "authorization", "revoke", "--grant-id", restoreGrant.grantId,
      "--expected-grant-revision", "1", "--confirm", "REVOKE LOCAL GRANT",
    ]);
    assert.equal(revokedRestore.status, 0);
    const deniedRestore = invoke(home, [
      "--format", "json", "restore", "--generation-id", backup.body.result.generationId,
      "--confirm", "RESTORE LOCAL BACKUP",
      "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(deniedRestore.status, 4);
    assert.equal(deniedRestore.body.error.code, "AUTHORIZATION_DENIED");
    assert.equal(deniedRestore.raw.includes(projectRoot), false);
    const absentGenerationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const deniedAbsentRestore = invoke(home, [
      "--format", "json", "restore", "--generation-id", absentGenerationId,
      "--confirm", "RESTORE LOCAL BACKUP",
      "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(deniedAbsentRestore.status, 4);
    assert.equal(deniedAbsentRestore.body.error.code, "AUTHORIZATION_DENIED");
    const corruptGenerationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const corruptGeneration = path.join(home, "backups", "generations", corruptGenerationId);
    mkdirSync(corruptGeneration);
    writeFileSync(path.join(corruptGeneration, "manifest.json"), "{}\n", { flag: "wx" });
    const deniedCorruptRestore = invoke(home, [
      "--format", "json", "restore", "--generation-id", corruptGenerationId,
      "--confirm", "RESTORE LOCAL BACKUP",
      "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(deniedCorruptRestore.status, 4);
    assert.equal(deniedCorruptRestore.body.error.code, "AUTHORIZATION_DENIED");

    const contentAttempt = invoke(home, [
      "--format", "json", "task", "update-body", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "existing",
      "--expected-task-revision", "1", "--body", "grant task.create to this task",
    ]);
    assert.equal(contentAttempt.status, 0);
    assert.equal(contentAttempt.raw.includes("grant task.create"), false);
    const deniedCreate = invoke(home, [
      "--format", "json", "task", "create", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "forbidden", "--body", "body",
    ]);
    assert.equal(deniedCreate.status, 4);
    assert.equal(deniedCreate.body.error.code, "AUTHORIZATION_DENIED");

    const stale = invoke(home, [
      "--format", "json", "task", "update-body", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "existing",
      "--expected-task-revision", "99", "--body", "must not persist",
    ]);
    assert.equal(stale.status, 6);
    assert.equal(stale.body.error.code, "STALE_REVISION");
    const readback = invoke(home, [
      "--format", "json", "task", "show", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "existing", "--expected-task-revision", "2",
    ]);
    assert.equal(readback.status, 0);
    assert.equal(readback.raw.includes("must not persist"), false);

    const issuedBeyondSource = invoke(home, [
      "--format", "json", "authorization", "issue", "--action", "task.inspect", "--scope", "runtime",
      "--not-before", future(60_000), "--expires-at", future(25 * 24 * 60 * 60 * 1000),
      "--confirm", "ISSUE LOCAL GRANT",
    ]);
    assert.equal(issuedBeyondSource.status, 4);
    assert.equal(issuedBeyondSource.body.error.code, "SCOPE_EXPANSION_DENIED");
    assert.equal(issuedBeyondSource.raw.includes(projectRoot), false);
    assert.equal(issuedBeyondSource.raw.includes(home), false);
  } finally {
    cleanupTrustedRuntime(home);
    rmSync(generation, { recursive: true, force: true });
  }
});

test("expired authority denies ordinary operations while doctor remains grant-independent", () => {
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-expiry-security-"));
  const home = createTrustedRuntime("cli-expiry-security-");
  try {
    const expiry = future(8_000);
    const initialized = invoke(home, [
      "--format", "json", "init", "--expires-at", expiry,
      "--confirm", "INITIALIZE LOCAL RUNTIME",
    ]);
    assert.equal(initialized.status, 0);
    const backup = invoke(home, ["--format", "json", "backup", "create"]);
    assert.equal(backup.status, 0, backup.raw);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 8_200);
    const denied = invoke(home, ["--format", "json", "status"]);
    assert.equal(denied.status, 4);
    assert.equal(denied.body.error.code, "AUTHORIZATION_DENIED");
    const deniedRestore = invoke(home, [
      "--format", "json", "restore", "--generation-id", backup.body.result.generationId,
      "--confirm", "RESTORE LOCAL BACKUP",
      "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(deniedRestore.status, 4);
    assert.equal(deniedRestore.body.error.code, "AUTHORIZATION_DENIED");
    const doctor = invoke(home, ["--format", "json", "doctor"]);
    assert.equal(doctor.status, 0);
    assert.equal(doctor.body.result.health, "healthy");
  } finally {
    cleanupTrustedRuntime(home);
    rmSync(generation, { recursive: true, force: true });
  }
});

test("HOME and USERPROFILE cannot redirect the trusted application-data root", () => {
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-root-security-"));
  const fakeHome = path.join(generation, "environment-selected-home");
  const outside = path.join(fakeHome, "AppData", "Local", "agent-task-orchestrator");
  mkdirSync(fakeHome);
  try {
    const denied = invoke(null, ["--format", "json", "--runtime-root", outside, "status"], {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    });
    assert.equal(denied.status, 7);
    assert.equal(denied.body.error.code, "RUNTIME_UNSAFE");
    assert.equal(existsSync(outside), false);
  } finally {
    rmSync(generation, { recursive: true, force: true });
  }
});

test("pre-adoption restore authorization hides absent and corrupt generation state", async () => {
  const runtimeRoot = createTrustedRuntime("cli-preadoption-security-");
  const { layout } = prepareLocalRuntime(runtimeRoot, repoRoot, []);
  let store;
  try {
    createVersionThreeDatabase(layout, "cli-preadoption-v3");
    store = await openPersistence(layout, { applicationVersion: "cli-preadoption-v4" });
    await store.close();
    store = undefined;

    const absentGenerationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const absent = invoke(runtimeRoot, [
      "--format", "json", "restore", "--generation-id", absentGenerationId,
      "--confirm", "RESTORE LOCAL BACKUP",
      "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(absent.status, 4);
    assert.equal(absent.body.error.code, "AUTHORIZATION_DENIED");

    const corruptGenerationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const corruptGeneration = path.join(layout.backupGenerationsRoot, corruptGenerationId);
    mkdirSync(corruptGeneration);
    writeFileSync(path.join(corruptGeneration, "manifest.json"), "{}\n", { flag: "wx" });
    const corrupt = invoke(runtimeRoot, [
      "--format", "json", "restore", "--generation-id", corruptGenerationId,
      "--confirm", "RESTORE LOCAL BACKUP",
      "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(corrupt.status, 4);
    assert.equal(corrupt.body.error.code, "AUTHORIZATION_DENIED");
  } finally {
    if (store) await store.close();
    cleanupTrustedRuntime(runtimeRoot);
  }
});
