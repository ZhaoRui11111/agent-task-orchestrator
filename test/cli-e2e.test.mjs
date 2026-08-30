import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { openPersistence } from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { loadLocalRuntime, trustedApplicationDataRoot } from "../src/persistence/local-ingress.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCli = path.join(repoRoot, "src", "cli.ts");

function future(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function invoke(entry, home, args) {
  const result = spawnSync(process.execPath, [entry, "--runtime-root", home, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /\n$/u);
  assert.equal(result.stdout.indexOf("\n"), result.stdout.length - 1);
  return { status: result.status, raw: result.stdout, body: JSON.parse(result.stdout) };
}

function cleanupTrustedRuntime(runtimeRoot) {
  if (!existsSync(runtimeRoot)) return;
  const trustedRoot = trustedApplicationDataRoot();
  assert.equal(path.resolve(path.dirname(runtimeRoot)).toLowerCase(), path.resolve(trustedRoot).toLowerCase());
  const stat = lstatSync(runtimeRoot);
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true);
  rmSync(runtimeRoot, { recursive: true, force: true });
}

test("source CLI completes the local Phase 1 init, Project, Task, backup, restore, restart, and doctor path", async () => {
  const generation = mkdtempSync(path.join(tmpdir(), "ato-cli-e2e-"));
  const trustedRoot = trustedApplicationDataRoot();
  mkdirSync(trustedRoot, { recursive: true });
  const home = path.join(trustedRoot, `cli-e2e-${randomUUID()}`);
  const projectRoot = path.join(generation, "project");
  mkdirSync(projectRoot);
  try {
    const doctorBefore = invoke(sourceCli, home, ["--format", "json", "doctor"]);
    assert.equal(doctorBefore.status, 0);
    assert.deepEqual(doctorBefore.body.result, {
      health: "not_initialized",
      initialized: false,
      schemaVersion: null,
      activeUse: false,
      backupInventory: "empty",
      restoreState: "none",
    });

    const expiry = future(30);
    const initialized = invoke(sourceCli, home, [
      "--format", "json", "init", "--expires-at", expiry,
      "--confirm", "INITIALIZE LOCAL RUNTIME",
    ]);
    assert.equal(initialized.status, 0, JSON.stringify(initialized.body));
    assert.deepEqual(initialized.body.result, {
      mode: "initialized",
      expiresAt: expiry,
      capabilityCount: 19,
      epochRevision: 0,
    });

    const registered = invoke(sourceCli, home, [
      "--format", "json", "project", "register", "--project-id", "project",
      "--root", projectRoot, "--confirm", "REGISTER LOCAL PROJECT",
    ]);
    assert.equal(registered.status, 0);
    assert.deepEqual(registered.body.result, {
      projectId: "project",
      enabled: true,
      configRevision: 1,
      resourceRevision: 1,
    });

    const shownProject = invoke(sourceCli, home, [
      "--format", "json", "project", "show", "--project-id", "project",
      "--expected-resource-revision", "1",
    ]);
    assert.equal(shownProject.status, 0);
    assert.equal(JSON.stringify(shownProject.body).includes(projectRoot), false);

    const created = invoke(sourceCli, home, [
      "--format", "json", "task", "create", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup", "--body", "secret body",
    ]);
    assert.equal(created.status, 0);
    assert.equal(JSON.stringify(created.body).includes("secret body"), false);

    const dependency = invoke(sourceCli, home, [
      "--format", "json", "task", "create", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "dependency", "--body", "dependency body",
    ]);
    assert.equal(dependency.status, 0);
    const added = invoke(sourceCli, home, [
      "--format", "json", "dependency", "add", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup",
      "--expected-task-revision", "1", "--dependency-id", "dependency", "--expected-dependency-revision", "1",
    ]);
    assert.equal(added.status, 0);
    assert.deepEqual(added.body.result.dependencyIds, ["dependency"]);
    const removed = invoke(sourceCli, home, [
      "--format", "json", "dependency", "remove", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup",
      "--expected-task-revision", "2", "--dependency-id", "dependency", "--expected-dependency-revision", "1",
    ]);
    assert.equal(removed.status, 0);
    const updated = invoke(sourceCli, home, [
      "--format", "json", "task", "update-body", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup",
      "--expected-task-revision", "3", "--body", "still secret",
    ]);
    assert.equal(updated.status, 0);
    assert.equal(JSON.stringify(updated.body).includes("still secret"), false);
    assert.equal(invoke(sourceCli, home, [
      "--format", "json", "task", "set-parent", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup",
      "--expected-task-revision", "4", "--parent-id", "dependency",
    ]).status, 0);
    assert.equal(invoke(sourceCli, home, [
      "--format", "json", "task", "clear-parent", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup", "--expected-task-revision", "5",
    ]).status, 0);
    assert.equal(invoke(sourceCli, home, [
      "--format", "json", "task", "mark-ready", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup", "--expected-task-revision", "6",
    ]).status, 0);
    const maximumCancellationReason = "é".repeat(2048);
    assert.equal(new TextEncoder().encode(maximumCancellationReason).byteLength, 4096);
    const cancelled = invoke(sourceCli, home, [
      "--format", "json", "task", "cancel", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "before-backup", "--expected-task-revision", "7",
      "--reason", maximumCancellationReason,
    ]);
    assert.equal(cancelled.status, 0);
    assert.equal(cancelled.body.result.status, "cancelled");
    assert.equal(cancelled.raw.includes(maximumCancellationReason), false);

    const humanCancelled = spawnSync(process.execPath, [
      sourceCli, "--runtime-root", home, "task", "cancel", "--project-id", "project",
      "--expected-project-resource-revision", "1", "--task-id", "dependency", "--expected-task-revision", "1",
      "--reason", maximumCancellationReason,
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      windowsHide: true,
    });
    assert.ifError(humanCancelled.error);
    assert.equal(humanCancelled.status, 0);
    assert.equal(humanCancelled.stderr, "");
    assert.match(humanCancelled.stdout, /^OK task\.cancel /u);
    assert.equal(humanCancelled.stdout.includes(maximumCancellationReason), false);

    const reopenedSelection = loadLocalRuntime(home, repoRoot);
    const reopenedStore = await openPersistence(reopenedSelection.layout, { applicationVersion: "cli-e2e-readback" });
    try {
      const state = readApplicationStateForOwner(reopenedStore);
      assert.equal(state.domain.tasks.find((task) => task.id === "before-backup").cancellation.reason, maximumCancellationReason);
      assert.equal(state.domain.tasks.find((task) => task.id === "dependency").cancellation.reason, maximumCancellationReason);
      assert.equal(
        JSON.stringify({ requests: state.requests, decisions: state.decisions, audit: state.audit })
          .includes(maximumCancellationReason),
        false,
      );
    } finally {
      await reopenedStore.close();
    }

    const policy = invoke(sourceCli, home, [
      "--format", "json", "authorization", "evaluate", "--project-id", "project",
      "--expected-resource-revision", "1", "--expected-config-revision", "1", "--action", "task.inspect",
    ]);
    assert.equal(policy.status, 0);
    assert.equal(policy.body.result.policy, "read_not_applicable");
    const grantPage = invoke(sourceCli, home, ["--format", "json", "authorization", "list", "--limit", "100"]);
    assert.equal(grantPage.status, 0);
    assert.equal(grantPage.body.result.grants.length, 19);
    const inspectGrant = grantPage.body.result.grants.find((grant) => grant.action === "task.inspect");
    assert.ok(inspectGrant);
    const shownGrant = invoke(sourceCli, home, [
      "--format", "json", "authorization", "show", "--grant-id", inspectGrant.grantId,
      "--expected-grant-revision", "1",
    ]);
    assert.equal(shownGrant.status, 0);
    assert.equal(shownGrant.body.result.grant.action, "task.inspect");
    const issued = invoke(sourceCli, home, [
      "--format", "json", "authorization", "issue", "--action", "task.inspect", "--scope", "runtime",
      "--not-before", future(1), "--expires-at", future(20), "--confirm", "ISSUE LOCAL GRANT",
    ]);
    assert.equal(issued.status, 0, JSON.stringify(issued.body));
    assert.equal(issued.body.result.grant.status, "not_yet_valid");
    const revoked = invoke(sourceCli, home, [
      "--format", "json", "authorization", "revoke", "--grant-id", issued.body.result.grant.grantId,
      "--expected-grant-revision", "1", "--confirm", "REVOKE LOCAL GRANT",
    ]);
    assert.equal(revoked.status, 0, JSON.stringify(revoked.body));
    assert.equal(revoked.body.result.grant.status, "revoked");

    const disabled = invoke(sourceCli, home, [
      "--format", "json", "project", "disable", "--project-id", "project",
      "--expected-resource-revision", "1", "--expected-config-revision", "1", "--confirm", "DISABLE LOCAL PROJECT",
    ]);
    assert.equal(disabled.status, 0);
    assert.equal(disabled.body.result.enabled, false);
    const reenabled = invoke(sourceCli, home, [
      "--format", "json", "project", "update", "--project-id", "project",
      "--expected-resource-revision", "2", "--expected-config-revision", "2", "--confirm", "UPDATE LOCAL PROJECT",
    ]);
    assert.equal(reenabled.status, 0);
    assert.equal(reenabled.body.result.enabled, true);
    assert.equal(reenabled.body.result.resourceRevision, 3);

    const status = invoke(sourceCli, home, ["--format", "json", "status"]);
    assert.equal(status.status, 0);
    assert.equal(status.body.result.projectCount, 1);
    assert.equal(status.body.result.taskCount, 2);
    assert.equal(status.body.result.dependencyCount, 0);
    const humanStatus = spawnSync(process.execPath, [sourceCli, "--runtime-root", home, "status"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
      windowsHide: true,
    });
    assert.ifError(humanStatus.error);
    assert.equal(humanStatus.status, 0);
    assert.equal(humanStatus.stderr, "");
    assert.match(humanStatus.stdout, /^OK status initialized=true schemaVersion=4 projectCount=1 taskCount=2 dependencyCount=0 grantCount=20 auditCount=[0-9]+\n$/u);

    const backup = invoke(sourceCli, home, ["--format", "json", "backup", "create"]);
    assert.equal(backup.status, 0);
    assert.equal(backup.body.result.kind, "manual");
    assert.equal(backup.body.result.sourceSchemaVersion, 4);
    assert.equal(backup.body.result.verified, true);

    const later = invoke(sourceCli, home, [
      "--format", "json", "task", "create", "--project-id", "project",
      "--expected-project-resource-revision", "3", "--task-id", "after-backup", "--body", "discard me",
    ]);
    assert.equal(later.status, 0);

    const restored = invoke(sourceCli, home, [
      "--format", "json", "restore", "--generation-id", backup.body.result.generationId,
      "--confirm", "RESTORE LOCAL BACKUP", "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
    ]);
    assert.equal(restored.status, 0, JSON.stringify(restored.body));
    assert.equal(restored.body.result.backupGenerationId, backup.body.result.generationId);
    assert.equal(restored.body.result.targetSchemaVersion, 4);
    assert.equal(restored.body.result.dataLossAcknowledged, true);

    const missing = invoke(sourceCli, home, [
      "--format", "json", "task", "show", "--project-id", "project",
      "--expected-project-resource-revision", "3", "--task-id", "after-backup", "--expected-task-revision", "1",
    ]);
    assert.equal(missing.status, 5);
    assert.equal(missing.body.error.code, "TASK_NOT_FOUND");

    const doctorAfter = invoke(sourceCli, home, ["--format", "json", "doctor"]);
    assert.equal(doctorAfter.status, 0);
    assert.equal(doctorAfter.body.result.health, "healthy");
    assert.equal(doctorAfter.body.result.backupInventory, "valid");
  } finally {
    cleanupTrustedRuntime(home);
    rmSync(generation, { recursive: true, force: true });
  }
});
