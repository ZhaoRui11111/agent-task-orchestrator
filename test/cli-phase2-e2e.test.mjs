import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  CLAIM_AUTHORIZATION_ACTIONS,
  DISPATCHER_AUTHORIZATION_ACTIONS,
  MANUAL_AUTHORIZATION_ACTIONS,
  AUTHORIZATION_ACTIONS,
  PHASE3_AUTHORIZATION_ACTIONS,
  WORKSPACE_STAGE_AUTHORIZATION_ACTIONS,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { loadLocalRuntime, prepareLocalRuntime, trustedApplicationDataRoot } from "../src/persistence/local-ingress.ts";
import {
  liveSchemaFingerprint,
  loadMigrationRegistry,
  migrationRegistryIdentity,
} from "../src/persistence/migrations.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCli = path.join(repoRoot, "src", "cli.ts");

function future(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function invoke(runtimeRoot, args) {
  const result = spawnSync(process.execPath, [
    sourceCli,
    "--runtime-root", runtimeRoot,
    "--format", "json",
    ...args,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /\n$/u);
  assert.equal(result.stdout.indexOf("\n"), result.stdout.length - 1);
  const body = JSON.parse(result.stdout);
  assert.equal(body.apiVersion, "ato.api/v1");
  return { status: result.status, raw: result.stdout, body };
}

function cleanupTrustedRuntime(runtimeRoot) {
  if (!existsSync(runtimeRoot)) return;
  const trustedRoot = trustedApplicationDataRoot();
  assert.equal(path.resolve(path.dirname(runtimeRoot)).toLowerCase(), path.resolve(trustedRoot).toLowerCase());
  const stat = lstatSync(runtimeRoot);
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true);
  rmSync(runtimeRoot, { recursive: true, force: true });
}

async function readState(runtimeRoot) {
  const selection = loadLocalRuntime(runtimeRoot, repoRoot);
  const store = await openPersistence(selection.layout, { applicationVersion: "cli-phase2-e2e-read" });
  try {
    return structuredClone(readApplicationStateForOwner(store));
  } finally {
    await store.close();
  }
}

function createCurrentSchema(runtimeRoot) {
  const selection = prepareLocalRuntime(runtimeRoot, repoRoot);
  const registry = loadMigrationRegistry();
  assert.equal(registry.length, 1);
  const baseline = registry[0];
  assert.ok(baseline);
  const database = new DatabaseSync(selection.layout.databasePath);
  try {
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("PRAGMA journal_mode=WAL");
    database.exec("BEGIN IMMEDIATE");
    database.exec(baseline.sql);
    const appliedAt = "2026-01-01T00:00:00.000Z";
    database.prepare(
      "INSERT INTO migration_history(version, migration_id, checksum_sha256, applied_at, application_version) VALUES (1, ?, ?, ?, 'cli-current-baseline')",
    ).run(baseline.id, baseline.checksumSha256, appliedAt);
    database.prepare(
      "INSERT INTO schema_metadata(singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at) VALUES (1, 1, 0, ?, ?, ?)",
    ).run(migrationRegistryIdentity(registry), liveSchemaFingerprint(database), appliedAt);
    database.exec("PRAGMA user_version=1");
    database.exec("COMMIT");
  } finally {
    database.close();
  }
  return Object.freeze([Object.freeze({
    version: 1,
    migration_id: baseline.id,
    checksum_sha256: baseline.checksumSha256,
    applied_at: "2026-01-01T00:00:00.000Z",
    application_version: "cli-current-baseline",
  })]);
}

function schemaSnapshot(runtimeRoot) {
  const selection = loadLocalRuntime(runtimeRoot, repoRoot);
  const database = new DatabaseSync(selection.layout.databasePath, { readOnly: true });
  try {
    return Object.freeze({
      userVersion: database.prepare("PRAGMA user_version").get().user_version,
      metadata: database.prepare(
        "SELECT schema_version, registry_identity, schema_fingerprint FROM schema_metadata WHERE singleton=1",
      ).get(),
      history: database.prepare(
        "SELECT version, migration_id, checksum_sha256, applied_at, application_version FROM migration_history ORDER BY version",
      ).all().map((row) => ({ ...row })),
      schemaEightObjects: database.prepare(
        "SELECT count(*) AS count FROM sqlite_schema WHERE name LIKE '%v8%' OR name LIKE '%phase3%'",
      ).get().count,
    });
  } finally {
    database.close();
  }
}

function common(state, idempotencyKey, taskId = "phase2-task") {
  const project = state.projects.find((candidate) => candidate.projectId === "phase2-project");
  const task = state.domain.tasks.find((candidate) => candidate.id === taskId);
  const execution = state.executions.find((candidate) => candidate.status === "active" && candidate.taskId === taskId);
  assert.ok(project && task && execution);
  return [
    "--project-id", project.projectId,
    "--expected-project-resource-revision", String(project.resourceRevision),
    "--expected-project-config-revision", String(project.configRevision),
    "--task-id", task.id,
    "--expected-task-revision", String(task.revision),
    "--execution-id", execution.executionId,
    "--expected-execution-revision", String(execution.revision),
    "--expected-attempt-number", String(execution.attemptNumber),
    "--expected-fencing-token", String(execution.fencingToken),
    "--idempotency-key", idempotencyKey,
  ];
}

test("source ato.api/v1 closes the real local Manual dispatch-to-completion loop across process restarts", async () => {
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-phase2-"));
  const trustedRoot = trustedApplicationDataRoot();
  mkdirSync(trustedRoot, { recursive: true });
  const runtimeRoot = path.join(trustedRoot, `cli-phase2-${randomUUID()}`);
  const projectRoot = path.join(generation, "project");
  mkdirSync(projectRoot);
  try {
    const expiry = future(30);
    const initialized = invoke(runtimeRoot, [
      "init", "--expires-at", expiry, "--confirm", "INITIALIZE LOCAL RUNTIME",
    ]);
    assert.equal(initialized.status, 0, initialized.raw);
    assert.equal(initialized.body.result.capabilityCount, 19);

    assert.equal(invoke(runtimeRoot, [
      "project", "register", "--project-id", "phase2-project", "--root", projectRoot,
      "--confirm", "REGISTER LOCAL PROJECT",
    ]).status, 0);
    assert.equal(invoke(runtimeRoot, [
      "task", "create", "--project-id", "phase2-project", "--expected-project-resource-revision", "1",
      "--task-id", "phase2-task", "--body", "SECRET_PHASE2_TASK_BODY",
    ]).status, 0);
    assert.equal(invoke(runtimeRoot, [
      "task", "mark-ready", "--project-id", "phase2-project", "--expected-project-resource-revision", "1",
      "--task-id", "phase2-task", "--expected-task-revision", "1",
    ]).status, 0);

    for (const expected of [
      CLAIM_AUTHORIZATION_ACTIONS.length,
      MANUAL_AUTHORIZATION_ACTIONS.length,
      DISPATCHER_AUTHORIZATION_ACTIONS.length,
      WORKSPACE_STAGE_AUTHORIZATION_ACTIONS.length,
      PHASE3_AUTHORIZATION_ACTIONS.length,
      AUTHORIZATION_ACTIONS.length,
    ]) {
      const upgraded = invoke(runtimeRoot, [
        "authorization", "upgrade", "--expires-at", expiry,
        "--confirm", "UPGRADE LOCAL CAPABILITIES",
      ]);
      assert.equal(upgraded.status, 0, upgraded.raw);
      assert.equal(upgraded.body.result.mode, "upgraded");
      assert.equal(upgraded.body.result.capabilityCount, expected);
    }

    const dispatched = invoke(runtimeRoot, [
      "dispatch", "run", "--idempotency-key", "cli-dispatch-one", "--lease-duration-seconds", "300",
    ]);
    assert.equal(dispatched.status, 0, dispatched.raw);
    assert.deepEqual(Object.keys(dispatched.body.result), [
      "runId", "status", "ownerRevision", "runRevision", "heartbeatAt", "leaseExpiresAt",
      "membershipRevision", "expectedMemberCount", "pendingMemberCount", "terminalMemberCount",
      "terminalStatus", "replayed",
    ]);
    assert.equal(dispatched.body.result.terminalStatus, "completed");
    const dispatchReplay = invoke(runtimeRoot, [
      "dispatch", "run", "--idempotency-key", "cli-dispatch-one", "--lease-duration-seconds", "300",
    ]);
    assert.equal(dispatchReplay.status, 0, dispatchReplay.raw);
    assert.equal(dispatchReplay.body.result.replayed, true);

    let state = await readState(runtimeRoot);
    const inspected = invoke(runtimeRoot, ["execution", "inspect", ...common(state, "cli-inspect-one")]);
    assert.equal(inspected.status, 0, inspected.raw);
    assert.deepEqual(Object.keys(inspected.body.result), [
      "executionId", "taskId", "taskState", "taskRevision", "executionRevision", "attemptNumber",
      "fencingToken", "lifecycle", "observationNumber", "waiting", "replayed",
    ]);

    state = await readState(runtimeRoot);
    const reported = invoke(runtimeRoot, [
      "manual", "outcome-report", ...common(state, "cli-report-one"),
      "--report-id", "cli-report-one", "--outcome", "succeed", "--code", "manual-success",
      "--evidence-reference", "SECRET_EVIDENCE_REFERENCE", "--confirm", "RECORD MANUAL OUTCOME",
    ]);
    assert.equal(reported.status, 0, reported.raw);
    assert.equal(reported.body.result.lifecycle, "turn_succeeded");
    assert.equal(reported.body.result.taskState, "running");

    state = await readState(runtimeRoot);
    const completionArgs = [
      "execution", "accept-manual-completion", ...common(state, "cli-completion-one"),
      "--confirm", "ACCEPT MANUAL COMPLETION",
    ];
    const completed = invoke(runtimeRoot, completionArgs);
    assert.equal(completed.status, 0, completed.raw);
    assert.equal(completed.body.result.taskState, "completed");
    assert.equal(completed.body.result.replayed, false);
    const completionReplay = invoke(runtimeRoot, completionArgs);
    assert.equal(completionReplay.status, 0, completionReplay.raw);
    assert.equal(completionReplay.body.result.replayed, true);

    state = await readState(runtimeRoot);
    assert.equal(state.domain.tasks.find((candidate) => candidate.id === "phase2-task").state, "completed");
    assert.equal(state.manualCompletionDecisions.length, 1);
    assert.equal(state.dispatcherRunSummaries.length, 1);

    assert.equal(invoke(runtimeRoot, [
      "task", "create", "--project-id", "phase2-project", "--expected-project-resource-revision", "1",
      "--task-id", "phase2-resume-task", "--body", "SECRET_PHASE2_RESUME_BODY",
    ]).status, 0);
    assert.equal(invoke(runtimeRoot, [
      "task", "mark-ready", "--project-id", "phase2-project", "--expected-project-resource-revision", "1",
      "--task-id", "phase2-resume-task", "--expected-task-revision", "1",
    ]).status, 0);
    const continuationDispatch = invoke(runtimeRoot, [
      "dispatch", "run", "--idempotency-key", "cli-dispatch-continuation", "--lease-duration-seconds", "300",
    ]);
    assert.equal(continuationDispatch.status, 0, continuationDispatch.raw);

    state = await readState(runtimeRoot);
    const waiting = invoke(runtimeRoot, [
      "manual", "outcome-report", ...common(state, "cli-wait-report", "phase2-resume-task"),
      "--report-id", "cli-wait-report", "--outcome", "wait", "--code", "manual-input-required",
      "--evidence-reference", "SECRET_PHASE2_WAIT_EVIDENCE", "--confirm", "RECORD MANUAL OUTCOME",
    ]);
    assert.equal(waiting.status, 0, waiting.raw);
    assert.equal(waiting.body.result.taskState, "waiting");
    assert.equal(waiting.body.result.waiting.reason, "human_input");

    state = await readState(runtimeRoot);
    const resumed = invoke(runtimeRoot, [
      "execution", "resume", ...common(state, "cli-resume-one", "phase2-resume-task"),
      "--continuation-reference", "operator-input-one",
      "--required-action-receipt-id", "operator-accepted-one",
    ]);
    assert.equal(resumed.status, 0, resumed.raw);
    assert.equal(resumed.body.result.lifecycle, "active");
    assert.equal(resumed.body.result.taskState, "running");

    state = await readState(runtimeRoot);
    const cancelRequested = invoke(runtimeRoot, [
      "execution", "request-cancel", ...common(state, "cli-cancel-one", "phase2-resume-task"),
      "--reason-code", "operator-cancelled",
    ]);
    assert.equal(cancelRequested.status, 0, cancelRequested.raw);
    assert.equal(cancelRequested.body.result.taskState, "running");

    state = await readState(runtimeRoot);
    const cancelled = invoke(runtimeRoot, [
      "manual", "outcome-report", ...common(state, "cli-cancel-report", "phase2-resume-task"),
      "--report-id", "cli-cancel-report", "--outcome", "confirm_cancelled", "--code", "manual-cancelled",
      "--confirm", "RECORD MANUAL OUTCOME",
    ]);
    assert.equal(cancelled.status, 0, cancelled.raw);
    assert.equal(cancelled.body.result.lifecycle, "cancelled");
    assert.equal(cancelled.body.result.taskState, "cancelled");
    state = await readState(runtimeRoot);
    assert.equal(state.domain.tasks.find((candidate) => candidate.id === "phase2-resume-task").state, "cancelled");

    for (const output of [
      dispatched.raw, dispatchReplay.raw, inspected.raw, reported.raw, completed.raw, completionReplay.raw,
      continuationDispatch.raw, waiting.raw, resumed.raw, cancelRequested.raw, cancelled.raw,
    ]) {
      for (const secret of [
        "SECRET_PHASE2_TASK_BODY", "SECRET_PHASE2_RESUME_BODY", "SECRET_EVIDENCE_REFERENCE",
        "SECRET_PHASE2_WAIT_EVIDENCE", projectRoot, "owner-v1:",
        "backend_execution:", "thread:", "intent:", "receipt:", "finalization:",
        "RECORD MANUAL OUTCOME", "ACCEPT MANUAL COMPLETION", "cli-dispatch-one", "cli-report-one",
      ]) assert.equal(output.includes(secret), false, secret);
    }
  } finally {
    cleanupTrustedRuntime(runtimeRoot);
    rmSync(generation, { recursive: true, force: true });
  }
});

test("source ato.api/v1 opens the exact current baseline and completes one restart-safe Manual workflow", async (context) => {
  for (const schemaVersion of [1]) {
    await context.test("current-baseline", async () => {
      const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-current-baseline-"));
      const trustedRoot = trustedApplicationDataRoot();
      mkdirSync(trustedRoot, { recursive: true });
      const runtimeRoot = path.join(trustedRoot, `cli-current-baseline-${randomUUID()}`);
      const projectRoot = path.join(generation, "project");
      mkdirSync(projectRoot);
      try {
        const baselineRows = createCurrentSchema(runtimeRoot);
        const expiry = future(30);
        const initialized = invoke(runtimeRoot, [
          "init", "--expires-at", expiry, "--confirm", "INITIALIZE LOCAL RUNTIME",
        ]);
        assert.equal(initialized.status, 0, initialized.raw);
        assert.equal(initialized.body.result.capabilityCount, 19);
        assert.equal(invoke(runtimeRoot, [
          "project", "register", "--project-id", "phase2-project", "--root", projectRoot,
          "--confirm", "REGISTER LOCAL PROJECT",
        ]).status, 0);
        assert.equal(invoke(runtimeRoot, [
          "task", "create", "--project-id", "phase2-project", "--expected-project-resource-revision", "1",
          "--task-id", "phase2-task", "--body", `CURRENT_${schemaVersion}_PRIVATE_BODY`,
        ]).status, 0);
        assert.equal(invoke(runtimeRoot, [
          "task", "mark-ready", "--project-id", "phase2-project", "--expected-project-resource-revision", "1",
          "--task-id", "phase2-task", "--expected-task-revision", "1",
        ]).status, 0);
        for (const expected of [
          CLAIM_AUTHORIZATION_ACTIONS.length,
          MANUAL_AUTHORIZATION_ACTIONS.length,
          DISPATCHER_AUTHORIZATION_ACTIONS.length,
          WORKSPACE_STAGE_AUTHORIZATION_ACTIONS.length,
          PHASE3_AUTHORIZATION_ACTIONS.length,
          AUTHORIZATION_ACTIONS.length,
        ]) {
          const upgraded = invoke(runtimeRoot, [
            "authorization", "upgrade", "--expires-at", expiry,
            "--confirm", "UPGRADE LOCAL CAPABILITIES",
          ]);
          assert.equal(upgraded.status, 0, upgraded.raw);
          assert.equal(upgraded.body.result.capabilityCount, expected);
        }
        const dispatch = invoke(runtimeRoot, [
          "dispatch", "run", "--idempotency-key", `current-${schemaVersion}-dispatch`,
          "--lease-duration-seconds", "300",
        ]);
        assert.equal(dispatch.status, 0, dispatch.raw);
        let state = await readState(runtimeRoot);
        assert.equal(invoke(runtimeRoot, [
          "execution", "inspect", ...common(state, `current-${schemaVersion}-inspect`),
        ]).status, 0);
        state = await readState(runtimeRoot);
        const reported = invoke(runtimeRoot, [
          "manual", "outcome-report", ...common(state, `current-${schemaVersion}-report`),
          "--report-id", `current-${schemaVersion}-report`, "--outcome", "succeed", "--code", "manual-success",
          "--confirm", "RECORD MANUAL OUTCOME",
        ]);
        assert.equal(reported.status, 0, reported.raw);
        assert.equal(reported.body.result.taskState, "running");
        state = await readState(runtimeRoot);
        const completionArgs = [
          "execution", "accept-manual-completion", ...common(state, `current-${schemaVersion}-completion`),
          "--confirm", "ACCEPT MANUAL COMPLETION",
        ];
        const completed = invoke(runtimeRoot, completionArgs);
        assert.equal(completed.status, 0, completed.raw);
        assert.equal(completed.body.result.taskState, "completed");
        const replay = invoke(runtimeRoot, completionArgs);
        assert.equal(replay.status, 0, replay.raw);
        assert.equal(replay.body.result.replayed, true);
        state = await readState(runtimeRoot);
        assert.equal(state.domain.tasks[0].state, "completed");
        assert.equal(state.manualCompletionDecisions.length, 1);
        const schema = schemaSnapshot(runtimeRoot);
        assert.equal(schema.userVersion, 1);
        assert.equal(schema.metadata.schema_version, 1);
        assert.equal(schema.history.length, 1);
        assert.deepEqual(schema.history, baselineRows);
        assert.equal(schema.schemaEightObjects, 0);
      } finally {
        cleanupTrustedRuntime(runtimeRoot);
        rmSync(generation, { recursive: true, force: true });
      }
    });
  }
});
