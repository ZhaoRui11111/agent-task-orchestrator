import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  createApplicationService,
  createDispatcherApplicationService,
  createWindowsGitWorkspaceBackend,
  createWorkspaceApplicationService,
  openPersistence,
  prepareRuntimeLayout,
} from "../src/index.ts";
import {
  createWindowsGitWorkspacePostMkdirIdentityFailureBackendForTesting,
} from "../src/workspace-git-adapter.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import {
  TEST_GIT_EXECUTABLE,
  cleanupWorkspaceGitFixture,
  workspaceCleanupRequest,
  createWorkspaceGitFixture,
  fixtureDigest,
  freshWorkspaceGitAdapter,
  git,
  workspaceCapabilityProbePaths,
  workspacePaths,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

const windowsOnly = { skip: process.platform !== "win32" };
const EXPIRY = "2026-09-20T12:00:00.000Z";

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

function independentOwnershipBinding(generation) {
  const value = {
    adapterId: generation.adapterId,
    adapterVersion: generation.adapterVersion,
    attemptNumber: generation.attemptNumber,
    baseReference: generation.baseReference,
    contractId: "ato.workspace/v2",
    creatorOperationId: generation.creatorOperationId,
    executionId: generation.executionId,
    executionRevisionFloor: generation.executionRevision,
    fencingToken: generation.fencingToken,
    generation: generation.generation,
    memberId: generation.memberId,
    memberRevisionFloor: generation.memberRevision,
    membershipRevision: generation.membershipRevision,
    projectConfigRevisionFloor: generation.projectConfigRevision,
    projectId: generation.projectId,
    projectResourceRevisionFloor: generation.projectResourceRevision,
    projectRootKey: generation.projectRootKey,
    runId: generation.runId,
    runRevisionFloor: generation.runRevision,
    taskId: generation.taskId,
    taskRevisionFloor: generation.taskRevision,
    workspaceId: generation.workspaceId,
    workspaceRootKey: generation.workspaceRootKey,
  };
  return createHash("sha256")
    .update(`${JSON.stringify(canonicalValue(value))}\n`)
    .digest("hex")
    .toUpperCase();
}

function applicationIngress(label) {
  let sequence = 0;
  let milliseconds = Date.parse("2026-08-30T12:00:00.000Z");
  let runtimeRootKey = "pending-runtime-root";
  return {
    currentActor: () => ({ actorId: "local_manual_operator", principal: "A".repeat(64) }),
    currentLeaseOwner: () => "workspace-execution-owner",
    currentWorkerOwner: () => "workspace-dispatch-owner",
    currentExecutionLeaseOwner: () => "workspace-execution-owner",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(milliseconds += 1000).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${action}-${++sequence}` }),
    setRuntimeRootKey(value) { runtimeRootKey = value; },
  };
}

async function prepareApplicationRuntime(fixture, label) {
  const sourceCheckoutRoot = path.join(fixture.generation, "application-source");
  mkdirSync(sourceCheckoutRoot);
  const layout = prepareRuntimeLayout({
    runtimeRoot: path.join(fixture.generation, "application-runtime"),
    sourceCheckoutRoot,
    projectRoots: [fixture.projectRoot],
  });
  const trusted = applicationIngress(label);
  const store = await openPersistence(layout, { applicationVersion: "ep03b-real-adapter-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({
    kind: "project.register", projectId: "project", root: fixture.projectRoot,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "APPLICATION_REAL_ADAPTER_PRIVATE_BODY", supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  for (let upgrade = 0; upgrade < 4; upgrade += 1) {
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  }
  const dispatcher = createDispatcherApplicationService(store, trusted, {
    adapterId: "manual-local", adapterVersion: "1.0.0",
  });
  const started = dispatcher.start({
    kind: "dispatch.start", idempotencyKey: `dispatch-${label}`, leaseDurationSeconds: 300,
  });
  assert.equal(started.ok, true, JSON.stringify(started));
  const reconciling = dispatcher.beginReconciliation({
    kind: "dispatch.begin_reconciliation", runId: started.value.runId,
    expectedOwnerRevision: started.value.ownerRevision, expectedRunRevision: started.value.runRevision,
  });
  const reconciled = dispatcher.commitReconciliation({
    kind: "dispatch.commit_reconciliation", runId: started.value.runId,
    expectedOwnerRevision: reconciling.value.ownerRevision, expectedRunRevision: reconciling.value.runRevision,
    resolutions: [],
  });
  const sealed = dispatcher.sealCandidates({
    kind: "dispatch.seal_candidates", runId: started.value.runId,
    expectedOwnerRevision: reconciled.value.ownerRevision, expectedRunRevision: reconciled.value.runRevision,
  });
  let state = readApplicationStateForOwner(store);
  const member = state.dispatcherMembers[0];
  const claimed = dispatcher.claimAndPrepareMember({
    kind: "dispatch.claim_member", runId: started.value.runId,
    expectedOwnerRevision: sealed.value.ownerRevision, expectedRunRevision: sealed.value.runRevision,
    memberId: member.memberId, expectedMembershipRevision: member.membershipRevision,
    expectedMemberRevision: member.revision,
  });
  assert.equal(claimed.ok, true, JSON.stringify(claimed));
  state = readApplicationStateForOwner(store);
  return { layout, trusted, store, state };
}

function ownerCommand(state, idempotencyKey) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const run = state.dispatcherRuns[0];
  const member = state.dispatcherMembers[0];
  const execution = state.executions[0];
  return {
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    runId: run.runId,
    expectedRunRevision: run.runRevision,
    memberId: member.memberId,
    expectedMembershipRevision: member.membershipRevision,
    expectedMemberRevision: member.revision,
    executionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey,
  };
}

function realAdapter(fixture, state) {
  return createWindowsGitWorkspaceBackend({
    gitExecutable: TEST_GIT_EXECUTABLE,
    projectRoots: [{ rootKey: state.projects[0].rootKey, path: fixture.projectRoot }],
    workspaceRoots: [{ rootKey: "workspace-root-key", path: fixture.workspaceRoot }],
  });
}

test("a fresh adapter recovers a complete generation after response loss", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-recovery-response-loss");
  try {
    const create = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(create.ok, true, create.ok ? undefined : create.error.code);
    const before = fixtureDigest(fixture);

    const recovered = freshWorkspaceGitAdapter(fixture).recover(workspaceRequest(fixture, "recover"));
    assert.equal(recovered.ok, true);
    assert.equal(recovered.receipt.code, "recovered_complete");
    assert.equal(recovered.receipt.registrationIdentity, create.receipt.registrationIdentity);
    assert.equal(recovered.receipt.ownershipBindingSha256, fixture.ownershipBindingSha256);
    assert.equal(fixtureDigest(fixture), before);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("read-only recovery reports an interrupted administration acquisition as partial", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-recovery-partial-admin");
  try {
    const paths = workspacePaths(fixture, workspaceRequest(fixture, "create"));
    mkdirSync(path.dirname(paths.adminDirectory), { recursive: true });
    mkdirSync(paths.adminDirectory);
    const before = fixtureDigest(fixture);

    const recovered = freshWorkspaceGitAdapter(fixture).recover(workspaceRequest(fixture, "recover"));
    assert.equal(recovered.ok, true);
    assert.equal(recovered.receipt.code, "partial");
    assert.equal(recovered.receipt.externalState, "partial");
    assert.equal(recovered.receipt.ownershipMatch, null);
    assert.equal(fixtureDigest(fixture), before);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("recovery remains read-only after each representative control, manifest, content, and pre-index interruption", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-recovery-checkpoints");
  try {
    const createRequest = workspaceRequest(fixture, "create");
    const paths = workspacePaths(fixture, createRequest);
    mkdirSync(path.dirname(paths.adminDirectory), { recursive: true });
    mkdirSync(paths.adminDirectory);
    mkdirSync(path.dirname(paths.targetDirectory), { recursive: true });
    mkdirSync(paths.targetDirectory);
    const steps = [
      () => writeFileSync(path.join(paths.adminDirectory, "HEAD"), `${fixture.baseObjectId}\n`, { flag: "wx" }),
      () => writeFileSync(path.join(paths.adminDirectory, "commondir"), "../..\n", { flag: "wx" }),
      () => writeFileSync(
        path.join(paths.adminDirectory, "gitdir"),
        `${path.join(paths.targetDirectory, ".git").replaceAll("\\", "/")}\n`,
        { flag: "wx" },
      ),
      () => writeFileSync(path.join(paths.adminDirectory, "locked"), "ato.workspace/v2 ownership\n", { flag: "wx" }),
      () => writeFileSync(
        path.join(paths.targetDirectory, ".git"),
        `gitdir: ${paths.adminDirectory.replaceAll("\\", "/")}\n`,
        { flag: "wx" },
      ),
      () => writeFileSync(paths.manifestPath, "{\"interrupted\":", { flag: "wx" }),
      () => writeFileSync(path.join(paths.targetDirectory, "README.txt"), "partial content\n", { flag: "wx" }),
    ];
    for (const step of steps) {
      step();
      const before = fixtureDigest(fixture);
      const recovered = freshWorkspaceGitAdapter(fixture).recover(workspaceRequest(fixture, "recover"));
      assert.equal(recovered.ok, true);
      assert.equal(recovered.receipt.code, "partial");
      assert.equal(recovered.receipt.externalState, "partial");
      assert.equal(fixtureDigest(fixture), before);
    }
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

for (const corruption of ["head", "dirty-inventory", "unexpected-admin-child"]) {
  test(`authoritative ${corruption} conflict remains partial`, windowsOnly, () => {
    const label = corruption === "unexpected-admin-child" ? "workspace-git-recovery-admin-child" : `workspace-git-recovery-${corruption}`;
    const fixture = createWorkspaceGitFixture(label);
    try {
      const request = workspaceRequest(fixture, "create");
      const created = fixture.adapter.create(request);
      assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
      const paths = workspacePaths(fixture, request);
      if (corruption === "head") {
        writeFileSync(path.join(paths.adminDirectory, "HEAD"), `${"0".repeat(40)}\n`);
      } else if (corruption === "dirty-inventory") {
        appendFileSync(path.join(paths.targetDirectory, "README.txt"), "dirty\n");
      } else {
        writeFileSync(path.join(paths.adminDirectory, "unexpected"), "unexpected\n", { flag: "wx" });
      }
      const before = fixtureDigest(fixture);
      const recovered = freshWorkspaceGitAdapter(fixture).recover(workspaceRequest(fixture, "recover"));
      assert.equal(recovered.ok, true);
      assert.equal(recovered.receipt.code, "partial");
      assert.equal(recovered.receipt.registrationIdentity, null);
      assert.equal(fixtureDigest(fixture), before);
    } finally {
      cleanupWorkspaceGitFixture(fixture);
    }
  });
}

test("cleanup without the exact attestation is rejected before root or Git access", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-recovery-cleanup-refusal");
  const originalProjectRoot = fixture.projectRoot;
  const hiddenProjectRoot = `${fixture.projectRoot}-temporarily-hidden`;
  try {
    const create = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(create.ok, true, create.ok ? undefined : create.error.code);
    const before = fixtureDigest(fixture);
    renameSync(originalProjectRoot, hiddenProjectRoot);
    const refused = fixture.adapter.cleanup(workspaceRequest(fixture, "cleanup"));
    renameSync(hiddenProjectRoot, originalProjectRoot);

    assert.equal(refused.ok, false);
    assert.equal(refused.error.category, "invalid_request");
    assert.equal(refused.error.code, "request_shape_invalid");
    assert.equal(refused.error.retryable, false);
    assert.equal(refused.error.ambiguous, false);
    assert.equal(fixtureDigest(fixture), before);
  } finally {
    if (originalProjectRoot !== hiddenProjectRoot) {
      try { renameSync(hiddenProjectRoot, originalProjectRoot); } catch { /* already restored */ }
    }
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("attested cleanup quarantines and removes only the exact owned generation", windowsOnly, () => {
  const fixture = createWorkspaceGitFixture("workspace-git-attested-cleanup");
  try {
    const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
    const cleanupRequest = workspaceCleanupRequest(fixture, created.receipt);
    const paths = workspacePaths(fixture, cleanupRequest);
    const cleaned = fixture.adapter.cleanup(cleanupRequest);
    assert.equal(cleaned.ok, true, cleaned.ok ? undefined : cleaned.error.code);
    assert.equal(cleaned.receipt.code, "removed");
    assert.equal(cleaned.receipt.externalState, "removed");
    assert.equal(cleaned.receipt.cleanupAttestationSha256, cleanupRequest.cleanupAttestation.attestationSha256);
    assert.equal(existsSync(paths.targetDirectory), false);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(git(fixture, ["rev-parse", "refs/heads/main"]).trim(), fixture.baseObjectId);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("a capability refusal after parent acquisition durably requires recovery", windowsOnly, async () => {
  const fixture = createWorkspaceGitFixture("workspace-git-cap-recovery");
  let runtime = null;
  try {
    runtime = await prepareApplicationRuntime(fixture, "capability-effect-recovery");
    let state = readApplicationStateForOwner(runtime.store);
    const adapter = realAdapter(fixture, state);
    let capturedCreateRequest = null;
    const observingBackend = Object.freeze({
      ...adapter,
      create(request) {
        capturedCreateRequest = request;
        return adapter.create(request);
      },
    });
    const options = {
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
      workspaceRootKey: "workspace-root-key",
    };
    const service = createWorkspaceApplicationService(runtime.store, observingBackend, runtime.trusted, options);
    const reserved = service.reserve({
      kind: "workspace.reserve",
      ...ownerCommand(state, "capability-effect-reserve"),
      baseReference: fixture.baseObjectId,
      predecessorWorkspaceId: null,
      predecessorGeneration: null,
      predecessorRevision: null,
    });
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
    assert.equal(reserved.value.workspace.status, "reserved");

    state = readApplicationStateForOwner(runtime.store);
    const generation = state.workspaceGenerations[0];
    const expectedBinding = independentOwnershipBinding(generation);
    const requestShape = workspaceRequest(fixture, "create", {
      subject: {
        workspaceId: generation.workspaceId,
        generation: generation.generation,
        ownershipBindingSha256: expectedBinding,
      },
    });
    const workspaceParent = path.dirname(workspacePaths(fixture, requestShape).targetDirectory);
    mkdirSync(workspaceParent);
    const probe = workspaceCapabilityProbePaths(workspaceParent, requestShape);
    mkdirSync(probe.destination);
    assert.equal(existsSync(path.join(fixture.projectRoot, ".git", "worktrees")), false);

    const created = service.create({
      kind: "workspace.create",
      ...ownerCommand(state, "capability-effect-create"),
      workspaceId: generation.workspaceId,
      expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.equal(created.value.outcome, "ambiguous");
    assert.equal(created.value.workspace.status, "recovery_required");
    assert.ok(capturedCreateRequest);
    assert.equal(capturedCreateRequest.subject.ownershipBindingSha256, expectedBinding);
    const paths = workspacePaths(fixture, capturedCreateRequest);
    const worktrees = path.dirname(paths.adminDirectory);
    assert.equal(existsSync(worktrees), true);
    assert.deepEqual(readdirSync(worktrees), []);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(existsSync(paths.targetDirectory), false);
    assert.equal(existsSync(probe.source), false);
    assert.equal(existsSync(probe.destination), true);

    const persisted = readApplicationStateForOwner(runtime.store);
    const intent = persisted.workspaceIntents.find((candidate) =>
      candidate.idempotencyKey === "capability-effect-create");
    assert.ok(intent);
    assert.equal(intent.state, "ambiguous");
    assert.equal(intent.lastFailureCategory, "ambiguous_external_state");
    assert.equal(intent.lastFailureCode, "capability_probe_conflict");
    assert.equal(intent.lastFailureAmbiguous, true);
    assert.equal(persisted.workspaceGenerations[0].status, "recovery_required");
  } finally {
    if (runtime?.store !== undefined) await runtime.store.close();
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("post-mkdir identity loss preserves the effect and durably requires recovery", windowsOnly, async () => {
  const fixture = createWorkspaceGitFixture("workspace-git-post-mkdir-id");
  let runtime = null;
  try {
    runtime = await prepareApplicationRuntime(fixture, "post-mkdir-identity-recovery");
    let state = readApplicationStateForOwner(runtime.store);
    const adapter = createWindowsGitWorkspacePostMkdirIdentityFailureBackendForTesting({
      gitExecutable: TEST_GIT_EXECUTABLE,
      projectRoots: [{ rootKey: state.projects[0].rootKey, path: fixture.projectRoot }],
      workspaceRoots: [{ rootKey: "workspace-root-key", path: fixture.workspaceRoot }],
    });
    let capturedCreateRequest = null;
    const observingBackend = Object.freeze({
      ...adapter,
      create(request) {
        capturedCreateRequest = request;
        return adapter.create(request);
      },
    });
    const options = {
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
      workspaceRootKey: "workspace-root-key",
    };
    const service = createWorkspaceApplicationService(runtime.store, observingBackend, runtime.trusted, options);
    const reserved = service.reserve({
      kind: "workspace.reserve",
      ...ownerCommand(state, "post-mkdir-identity-reserve"),
      baseReference: fixture.baseObjectId,
      predecessorWorkspaceId: null,
      predecessorGeneration: null,
      predecessorRevision: null,
    });
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
    assert.equal(reserved.value.workspace.status, "reserved");

    state = readApplicationStateForOwner(runtime.store);
    const generation = state.workspaceGenerations[0];
    const created = service.create({
      kind: "workspace.create",
      ...ownerCommand(state, "post-mkdir-identity-create"),
      workspaceId: generation.workspaceId,
      expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.equal(created.value.outcome, "ambiguous");
    assert.equal(created.value.workspace.status, "recovery_required");
    assert.ok(capturedCreateRequest);

    const paths = workspacePaths(fixture, capturedCreateRequest);
    const worktrees = path.dirname(paths.adminDirectory);
    assert.equal(existsSync(worktrees), true);
    assert.deepEqual(readdirSync(worktrees), []);
    assert.equal(existsSync(paths.adminDirectory), false);
    assert.equal(existsSync(paths.targetDirectory), false);

    const persisted = readApplicationStateForOwner(runtime.store);
    const intent = persisted.workspaceIntents.find((candidate) =>
      candidate.idempotencyKey === "post-mkdir-identity-create");
    assert.ok(intent);
    assert.equal(intent.state, "ambiguous");
    assert.equal(intent.lastFailureCategory, "ambiguous_external_state");
    assert.equal(intent.lastFailureCode, "worktrees_directory_unavailable");
    assert.equal(intent.lastFailureAmbiguous, true);
    assert.equal(persisted.workspaceGenerations[0].status, "recovery_required");
  } finally {
    if (runtime?.store !== undefined) await runtime.store.close();
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("real SQLite recovery binds a lost create response to the physical manifest without blind replay", windowsOnly, async () => {
  const fixture = createWorkspaceGitFixture("workspace-git-app-recovery");
  let runtime = null;
  try {
    runtime = await prepareApplicationRuntime(fixture, "real-adapter-recovery");
    let state = readApplicationStateForOwner(runtime.store);
    const adapter = realAdapter(fixture, state);
    let capturedCreateRequest = null;
    let physicalCreateCount = 0;
    const responseLosingBackend = Object.freeze({
      ...adapter,
      create(request) {
        capturedCreateRequest = request;
        physicalCreateCount += 1;
        const physical = adapter.create(request);
        assert.equal(physical.ok, true, physical.ok ? undefined : physical.error.code);
        throw new Error("simulated adapter response loss");
      },
    });
    const options = {
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
      workspaceRootKey: "workspace-root-key",
    };
    let service = createWorkspaceApplicationService(runtime.store, responseLosingBackend, runtime.trusted, options);
    const reserved = service.reserve({
      kind: "workspace.reserve",
      ...ownerCommand(state, "real-adapter-reserve"),
      baseReference: fixture.baseObjectId,
      predecessorWorkspaceId: null,
      predecessorGeneration: null,
      predecessorRevision: null,
    });
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
    assert.equal(reserved.value.workspace.status, "reserved");

    state = readApplicationStateForOwner(runtime.store);
    const generation = state.workspaceGenerations[0];
    const expectedBinding = independentOwnershipBinding(generation);
    const lost = service.create({
      kind: "workspace.create",
      ...ownerCommand(state, "real-adapter-create-lost"),
      workspaceId: generation.workspaceId,
      expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(lost.ok, true, JSON.stringify(lost));
    assert.equal(lost.value.outcome, "ambiguous");
    assert.equal(lost.value.workspace.status, "recovery_required");
    assert.equal(physicalCreateCount, 1);
    assert.equal(capturedCreateRequest.subject.ownershipBindingSha256, expectedBinding);

    const physicalPaths = workspacePaths(fixture, capturedCreateRequest);
    const manifest = JSON.parse(readFileSync(physicalPaths.manifestPath, "utf8"));
    assert.equal(manifest.ownershipBindingSha256, expectedBinding);
    assert.equal(manifest.baseObjectId, fixture.baseObjectId);

    await runtime.store.close();
    runtime.store = await openPersistence(runtime.layout, { applicationVersion: "ep03b-real-adapter-reopen" });
    state = readApplicationStateForOwner(runtime.store);
    const causal = state.workspaceIntents.find((intent) => intent.idempotencyKey === "real-adapter-create-lost");
    assert.ok(causal);
    service = createWorkspaceApplicationService(runtime.store, realAdapter(fixture, state), runtime.trusted, options);
    const current = state.workspaceGenerations[0];
    const recovered = service.recover({
      kind: "workspace.recover",
      ...ownerCommand(state, "real-adapter-recover"),
      workspaceId: current.workspaceId,
      expectedGeneration: current.generation,
      expectedGenerationRevision: current.revision,
      causationId: causal.operationId,
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.outcome, "succeeded");
    assert.equal(recovered.value.workspace.status, "ready");
    assert.equal(physicalCreateCount, 1);

    const terminal = readApplicationStateForOwner(runtime.store);
    const persistedWorkspaceEvidence = JSON.stringify({
      generations: terminal.workspaceGenerations,
      decisions: terminal.workspaceAuthorizationDecisions,
      intents: terminal.workspaceIntents,
      observations: terminal.workspaceObservations,
      receipts: terminal.workspaceReceipts,
      finalizations: terminal.workspaceFinalizations,
      events: terminal.workspaceEvents,
    });
    assert.equal(persistedWorkspaceEvidence.includes(fixture.projectRoot), false);
    assert.equal(persistedWorkspaceEvidence.includes(fixture.workspaceRoot), false);
    assert.equal(persistedWorkspaceEvidence.includes("APPLICATION_REAL_ADAPTER_PRIVATE_BODY"), false);
    assert.equal(persistedWorkspaceEvidence.includes(expectedBinding), true);
  } finally {
    if (runtime?.store !== undefined) await runtime.store.close();
    cleanupWorkspaceGitFixture(fixture);
  }
});
