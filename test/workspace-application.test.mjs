import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createExecutionApplicationService,
  createWorkspaceApplicationService,
  createWorkspaceApplicationServiceWithHooks,
  openPersistence,
} from "../src/index.ts";
import { readApplicationState, readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { createFakeWorkspaceBackend } from "./fixtures/fake-workspace-backend.mjs";
import { cleanupPersistenceFixture, createPersistenceFixture, expectPersistenceError } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";

function ingress(label) {
  let sequence = 0;
  let milliseconds = Date.parse("2026-08-30T12:00:00.000Z");
  let runtimeRootKey = "pending-runtime-root";
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => "workspace-execution-owner",
    currentWorkerOwner: () => "workspace-dispatch-owner",
    currentExecutionLeaseOwner: () => "workspace-execution-owner",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(milliseconds += 1000).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${action}-${++sequence}` }),
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setNow(value) { milliseconds = Date.parse(value); },
  };
}

async function runtime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03a-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "workspace body must never enter workspace evidence", supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  for (let upgrade = 0; upgrade < 4; upgrade += 1) {
    const result = application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY });
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  const dispatcher = createDispatcherApplicationService(store, trusted, {
    adapterId: "manual-local", adapterVersion: "1.0.0",
  });
  const started = dispatcher.start({ kind: "dispatch.start", idempotencyKey: `dispatch-${prefix}`, leaseDurationSeconds: 300 });
  assert.equal(started.ok, true, JSON.stringify(started));
  const reconciling = dispatcher.beginReconciliation({
    kind: "dispatch.begin_reconciliation", runId: started.value.runId,
    expectedOwnerRevision: started.value.ownerRevision, expectedRunRevision: started.value.runRevision,
  });
  assert.equal(reconciling.ok, true, JSON.stringify(reconciling));
  const reconciled = dispatcher.commitReconciliation({
    kind: "dispatch.commit_reconciliation", runId: started.value.runId,
    expectedOwnerRevision: reconciling.value.ownerRevision, expectedRunRevision: reconciling.value.runRevision,
    resolutions: [],
  });
  assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
  const sealed = dispatcher.sealCandidates({
    kind: "dispatch.seal_candidates", runId: started.value.runId,
    expectedOwnerRevision: reconciled.value.ownerRevision, expectedRunRevision: reconciled.value.runRevision,
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed));
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
  return { fixture, trusted, store, state };
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

test("workspace reserve/create/inspect use durable exact bindings and direct cleanup stays closed", async () => {
  const testRuntime = await runtime("workspace-happy");
  try {
    const backend = createFakeWorkspaceBackend();
    const service = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    const reserveCommand = {
      kind: "workspace.reserve", ...ownerCommand(state, "reserve-idempotency"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    };
    const reserved = service.reserve(reserveCommand);
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
    assert.equal(reserved.value.outcome, "succeeded");
    assert.equal(reserved.value.workspace.status, "reserved");
    assert.equal(service.reserve(reserveCommand).ok, true);
    assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 1);
    const wrongPrincipal = createWorkspaceApplicationService(testRuntime.store, backend, {
      ...testRuntime.trusted,
      currentActor: () => ({ actorId: ACTOR, principal: "B".repeat(64) }),
    }, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    }).reserve(reserveCommand);
    assert.equal(wrongPrincipal.ok, false);
    assert.equal(wrongPrincipal.error.code, "AUTHORIZATION_DENIED");
    state = readApplicationStateForOwner(testRuntime.store);
    const execution = state.executions[0];
    const renewed = createExecutionApplicationService(testRuntime.store, testRuntime.trusted).renew({
      kind: "execution.lease.renew",
      projectId: state.projects[0].projectId,
      expectedProjectResourceRevision: state.projects[0].resourceRevision,
      expectedProjectConfigRevision: state.projects[0].configRevision,
      executionId: execution.executionId,
      expectedExecutionRevision: execution.revision,
      expectedLeaseRevision: execution.leaseRevision,
      expectedFencingToken: execution.fencingToken,
      expectedTaskRevision: state.domain.tasks[0].revision,
      leaseDurationSeconds: 600,
    });
    assert.equal(renewed.ok, true, JSON.stringify(renewed));
    const staleReplay = service.reserve(reserveCommand);
    assert.equal(staleReplay.ok, false);
    assert.equal(staleReplay.error.code, "STALE_REVISION");
    state = readApplicationStateForOwner(testRuntime.store);
    const currentReplay = service.reserve({ ...reserveCommand, ...ownerCommand(state, "reserve-idempotency") });
    assert.equal(currentReplay.ok, true, JSON.stringify(currentReplay));
    assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 1);

    state = readApplicationStateForOwner(testRuntime.store);
    const generation = state.workspaceGenerations[0];
    const createCommand = {
      kind: "workspace.create", ...ownerCommand(state, "create-idempotency"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    };
    const created = service.create(createCommand);
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.equal(created.value.workspace.status, "ready");

    state = readApplicationStateForOwner(testRuntime.store);
    const ready = state.workspaceGenerations[0];
    const inspected = service.inspect({
      kind: "workspace.inspect", ...ownerCommand(state, "inspect-idempotency"),
      workspaceId: ready.workspaceId, expectedGeneration: ready.generation,
      expectedGenerationRevision: ready.revision,
    });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.workspace.status, "ready");

    state = readApplicationStateForOwner(testRuntime.store);
    const beforeCleanup = state.workspaceGenerations[0];
    const refusedCleanup = service.cleanup({
      kind: "workspace.cleanup", ...ownerCommand(state, "cleanup-idempotency"),
      workspaceId: beforeCleanup.workspaceId, expectedGeneration: beforeCleanup.generation,
      expectedGenerationRevision: beforeCleanup.revision,
    });
    assert.equal(refusedCleanup.ok, false);
    assert.equal(refusedCleanup.error.code, "INVALID_STATE");
    assert.equal(backend.calls().filter((call) => call.operation === "cleanup").length, 0);
    const finalState = readApplicationStateForOwner(testRuntime.store);
    assert.equal(finalState.workspaceGenerations[0].status, "ready");
    const serialized = JSON.stringify({
      generations: finalState.workspaceGenerations,
      decisions: finalState.workspaceAuthorizationDecisions,
      intents: finalState.workspaceIntents,
      observations: finalState.workspaceObservations,
      receipts: finalState.workspaceReceipts,
      finalizations: finalState.workspaceFinalizations,
      events: finalState.workspaceEvents,
    });
    assert.doesNotMatch(serialized, /fake-private-path|workspace body must never/u);
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("a canonical non-ambiguous backend failure restores the no-effect generation edge", async () => {
  const testRuntime = await runtime("workspace-nonambiguous-failure");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    const reserved = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "nonambiguous-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    });
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
    state = readApplicationStateForOwner(testRuntime.store);
    let generation = state.workspaceGenerations[0];
    backend.failNext("transient");
    const failedCreate = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "nonambiguous-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(failedCreate.ok, true, JSON.stringify(failedCreate));
    assert.equal(failedCreate.value.state, "failed");
    assert.equal(failedCreate.value.outcome, "failed");
    assert.equal(failedCreate.value.workspace.status, "reserved");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const retried = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "nonambiguous-create-retry"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.value.workspace.status, "ready");
    assert.equal(backend.calls().filter((call) => call.operation === "create").length, 2);
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("a receipt-free pre-Act authorization denial permits a later fresh-authorized reserve", async () => {
  const testRuntime = await runtime("workspace-pre-act-denial-retry");
  try {
    const application = createApplicationService(testRuntime.store, testRuntime.trusted);
    let state = readApplicationStateForOwner(testRuntime.store);
    const futureGrant = application.execute({
      kind: "authorization.grant.issue",
      actorId: ACTOR,
      action: "workspace.reserve",
      scope: {
        kind: "project",
        projectId: state.projects[0].projectId,
        resourceRevision: state.projects[0].resourceRevision,
        configRevision: state.projects[0].configRevision,
      },
      notBefore: "2026-08-30T12:01:30.000Z",
      expiresAt: EXPIRY,
    });
    assert.equal(futureGrant.ok, true, JSON.stringify(futureGrant));
    state = readApplicationStateForOwner(testRuntime.store);
    const currentRuntimeGrant = state.grants.find((grant) =>
      grant.action === "workspace.reserve" && grant.scope.kind === "runtime" && grant.revokedAt === null
    );
    assert.ok(currentRuntimeGrant);
    const backend = createFakeWorkspaceBackend();
    let revoked = null;
    const workspace = createWorkspaceApplicationServiceWithHooks(
      testRuntime.store,
      backend,
      testRuntime.trusted,
      { adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key" },
      {
        afterStage(stage) {
          if (stage !== "prepared" || revoked !== null) return;
          revoked = application.execute({
            kind: "authorization.grant.revoke",
            grantId: currentRuntimeGrant.grantId,
            expectedGrantRevision: currentRuntimeGrant.revision,
          });
          assert.equal(revoked.ok, true, JSON.stringify(revoked));
        },
      },
    );
    const denied = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "pre-act-denied"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(backend.calls().length, 0);
    const deniedState = readApplicationStateForOwner(testRuntime.store);
    assert.equal(deniedState.workspaceGenerations[0].status, "allocated");
    assert.equal(deniedState.workspaceIntents[0].state, "failed");
    assert.equal(deniedState.workspaceIntents[0].lastObservationNumber, 0);
    assert.equal(deniedState.workspaceReceipts.length, 0);

    testRuntime.trusted.setNow("2026-08-30T12:01:30.000Z");
    state = readApplicationStateForOwner(testRuntime.store);
    const retried = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "pre-act-denied-retry"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.value.workspace.status, "reserved");
    assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 1);
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("verified reserve refusal permits an exact same-generation retry while partial evidence remains recovery-required", async () => {
  const refusedRuntime = await runtime("workspace-refusal-retry");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(refusedRuntime.store, backend, refusedRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    const initialState = readApplicationStateForOwner(refusedRuntime.store);
    const initial = {
      kind: "workspace.reserve", ...ownerCommand(initialState, "reserve-refused"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    };
    backend.failNext("refused");
    const refused = workspace.reserve(initial);
    assert.equal(refused.ok, true, JSON.stringify(refused));
    assert.equal(refused.value.outcome, "refused");
    assert.equal(refused.value.workspace.status, "allocated");
    const retryState = readApplicationStateForOwner(refusedRuntime.store);
    const retried = workspace.reserve({ ...initial, ...ownerCommand(retryState, "reserve-after-refusal") });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.value.workspace.status, "reserved");
    assert.equal(retried.value.workspace.workspaceId, refused.value.workspace.workspaceId);
    assert.equal(retried.value.workspace.generation, refused.value.workspace.generation);
    assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 2);
  } finally {
    await refusedRuntime.store.close();
    cleanupPersistenceFixture(refusedRuntime.fixture);
  }

  const partialRuntime = await runtime("workspace-partial-recovery");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(partialRuntime.store, backend, partialRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(partialRuntime.store);
    const command = {
      kind: "workspace.reserve", ...ownerCommand(state, "reserve-partial"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    };
    backend.failNext("ambiguous");
    const ambiguous = workspace.reserve(command);
    assert.equal(ambiguous.ok, true, JSON.stringify(ambiguous));
    assert.equal(ambiguous.value.outcome, "ambiguous");
    assert.equal(ambiguous.value.workspace.status, "recovery_required");
    state = readApplicationStateForOwner(partialRuntime.store);
    const causal = state.workspaceIntents.find((intent) => intent.idempotencyKey === "reserve-partial");
    const generation = state.workspaceGenerations[0];
    const recoverCommand = {
      kind: "workspace.recover", ...ownerCommand(state, "recover-partial"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: causal.operationId,
    };
    const recovered = workspace.recover(recoverCommand);
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.outcome, "ambiguous");
    assert.equal(recovered.value.workspace.status, "recovery_required");
    assert.equal(workspace.recover(recoverCommand).ok, true);
    assert.equal(backend.calls().filter((call) => call.operation === "recover").length, 1);
  } finally {
    await partialRuntime.store.close();
    cleanupPersistenceFixture(partialRuntime.fixture);
  }
});

test("an uncleaned predecessor cannot allocate another generation through the legacy service", async () => {
  const testRuntime = await runtime("workspace-replacement");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    const first = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "replacement-reserve-one"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    });
    state = readApplicationStateForOwner(testRuntime.store);
    let current = state.workspaceGenerations[0];
    assert.equal(workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "replacement-create-one"),
      workspaceId: current.workspaceId, expectedGeneration: current.generation, expectedGenerationRevision: current.revision,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    current = state.workspaceGenerations[0];
    const cleanup = workspace.cleanup({
      kind: "workspace.cleanup", ...ownerCommand(state, "replacement-cleanup-one"),
      workspaceId: current.workspaceId, expectedGeneration: current.generation, expectedGenerationRevision: current.revision,
    });
    assert.equal(cleanup.ok, false);
    assert.equal(cleanup.error.code, "INVALID_STATE");
    state = readApplicationStateForOwner(testRuntime.store);
    const predecessor = state.workspaceGenerations[0];
    const second = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "replacement-reserve-two"), baseReference: "refs/heads/next",
      predecessorWorkspaceId: predecessor.workspaceId,
      predecessorGeneration: predecessor.generation,
      predecessorRevision: predecessor.revision,
    });
    assert.equal(second.ok, false);
    assert.equal(second.error.code, "INVALID_STATE");
    const finalState = readApplicationStateForOwner(testRuntime.store);
    assert.deepEqual(finalState.workspaceGenerations.map(({ generation, status }) => [generation, status]), [[1, "ready"]]);
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("competing exact replay produces one generation, intent, and backend effect", async () => {
  const testRuntime = await runtime("workspace-competing-replay");
  let competingStore;
  try {
    competingStore = await openPersistence(testRuntime.fixture.layout, { applicationVersion: "ep03a-competing-workspace" });
    const backend = createFakeWorkspaceBackend();
    const options = { adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key" };
    const competing = createWorkspaceApplicationService(competingStore, backend, testRuntime.trusted, options);
    const state = readApplicationStateForOwner(testRuntime.store);
    const command = {
      kind: "workspace.reserve", ...ownerCommand(state, "competing-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    };
    let competingResult = null;
    const primary = createWorkspaceApplicationServiceWithHooks(
      testRuntime.store,
      backend,
      testRuntime.trusted,
      options,
      { afterStage(stage) { if (stage === "prepared" && competingResult === null) competingResult = competing.reserve(command); } },
    );
    const primaryResult = primary.reserve(command);
    assert.equal(competingResult.ok, true, JSON.stringify(competingResult));
    assert.equal(primaryResult.ok, false);
    assert.equal(primaryResult.error.code, "RECONCILIATION_REQUIRED");
    const finalState = readApplicationStateForOwner(testRuntime.store);
    assert.equal(finalState.workspaceGenerations.length, 1);
    assert.equal(finalState.workspaceIntents.length, 1);
    assert.equal(finalState.workspaceIntents[0].state, "finalized");
    assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 1);
  } finally {
    if (competingStore) await competingStore.close();
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("legacy cleanup stays closed and fresh Act/finalize fence checks prevent unauthorized effects", async () => {
  const deniedRuntime = await runtime("workspace-cleanup-confirmation");
  try {
    const backend = createFakeWorkspaceBackend();
    const allowed = createWorkspaceApplicationService(deniedRuntime.store, backend, deniedRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(deniedRuntime.store);
    assert.equal(allowed.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "confirmation-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    }).ok, true);
    state = readApplicationStateForOwner(deniedRuntime.store);
    let generation = state.workspaceGenerations[0];
    assert.equal(allowed.create({
      kind: "workspace.create", ...ownerCommand(state, "confirmation-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    }).ok, true);
    state = readApplicationStateForOwner(deniedRuntime.store);
    generation = state.workspaceGenerations[0];
    const deniedIngress = {
      currentActor: () => deniedRuntime.trusted.currentActor(),
      now: () => deniedRuntime.trusted.now(),
      nextId: (kind) => deniedRuntime.trusted.nextId(kind),
      confirmHighRisk: () => false,
    };
    const denied = createWorkspaceApplicationService(deniedRuntime.store, backend, deniedIngress, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    }).cleanup({
      kind: "workspace.cleanup", ...ownerCommand(state, "confirmation-cleanup"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "INVALID_STATE");
    assert.equal(backend.calls().filter((call) => call.operation === "cleanup").length, 0);
    assert.equal(readApplicationStateForOwner(deniedRuntime.store).workspaceGenerations[0].status, "ready");
  } finally {
    await deniedRuntime.store.close();
    cleanupPersistenceFixture(deniedRuntime.fixture);
  }

  for (const boundary of ["prepared", "verified"]) {
    const staleRuntime = await runtime(`workspace-stale-${boundary}`);
    try {
      const backend = createFakeWorkspaceBackend();
      let renewed = null;
      const state = readApplicationStateForOwner(staleRuntime.store);
      const execution = state.executions[0];
      const command = {
        kind: "workspace.reserve", ...ownerCommand(state, `stale-${boundary}`), baseReference: "refs/heads/main",
        predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
      };
      const workspace = createWorkspaceApplicationServiceWithHooks(
        staleRuntime.store,
        backend,
        staleRuntime.trusted,
        { adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key" },
        {
          afterStage(stage) {
            if (stage !== boundary || renewed !== null) return;
            renewed = createExecutionApplicationService(staleRuntime.store, staleRuntime.trusted).renew({
              kind: "execution.lease.renew",
              projectId: state.projects[0].projectId,
              expectedProjectResourceRevision: state.projects[0].resourceRevision,
              expectedProjectConfigRevision: state.projects[0].configRevision,
              executionId: execution.executionId,
              expectedExecutionRevision: execution.revision,
              expectedLeaseRevision: execution.leaseRevision,
              expectedFencingToken: execution.fencingToken,
              expectedTaskRevision: state.domain.tasks[0].revision,
              leaseDurationSeconds: 600,
            });
            assert.equal(renewed.ok, true, JSON.stringify(renewed));
          },
        },
      );
      const result = workspace.reserve(command);
      if (boundary === "prepared") {
        assert.equal(result.ok, false);
        assert.equal(result.error.code, "STALE_FENCE");
        assert.equal(backend.calls().length, 0);
        const retryState = readApplicationStateForOwner(staleRuntime.store);
        const retried = workspace.reserve({
          ...command,
          ...ownerCommand(retryState, `stale-${boundary}-retry`),
        });
        assert.equal(retried.ok, true, JSON.stringify(retried));
        assert.equal(retried.value.workspace.status, "reserved");
        assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 1);
      } else {
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.value.outcome, "ambiguous");
        assert.equal(result.value.workspace.status, "recovery_required");
        assert.equal(backend.calls().filter((call) => call.operation === "reserve").length, 1);
        const recoveryState = readApplicationStateForOwner(staleRuntime.store);
        const causal = recoveryState.workspaceIntents.find((intent) => intent.idempotencyKey === `stale-${boundary}`);
        assert.ok(causal);
        const generation = recoveryState.workspaceGenerations[0];
        const recovered = workspace.recover({
          kind: "workspace.recover", ...ownerCommand(recoveryState, `stale-${boundary}-recover`),
          workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
          expectedGenerationRevision: generation.revision, causationId: causal.operationId,
        });
        assert.equal(recovered.ok, true, JSON.stringify(recovered));
        assert.equal(recovered.value.workspace.status, "reserved");
      }
    } finally {
      await staleRuntime.store.close();
      cleanupPersistenceFixture(staleRuntime.fixture);
    }
  }
});

test("Act revalidates a prepared Project root before any backend invocation", async () => {
  const testRuntime = await runtime("workspace-act-root-revalidation");
  try {
    const backend = createFakeWorkspaceBackend();
    let swapped = false;
    const workspace = createWorkspaceApplicationServiceWithHooks(
      testRuntime.store,
      backend,
      testRuntime.trusted,
      { adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key" },
      {
        afterStage(stage) {
          if (stage !== "prepared" || swapped) return;
          renameSync(testRuntime.fixture.projectRoot, path.join(testRuntime.fixture.generation, "project-original"));
          mkdirSync(testRuntime.fixture.projectRoot);
          swapped = true;
        },
      },
    );
    const state = readApplicationStateForOwner(testRuntime.store);
    const command = {
      kind: "workspace.reserve", ...ownerCommand(state, "root-swap-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    };
    const result = workspace.reserve(command);
    assert.equal(swapped, true);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "PROJECT_IDENTITY_CHANGED");
    assert.equal(backend.calls().length, 0);
    const terminal = readApplicationStateForOwner(testRuntime.store);
    assert.equal(terminal.workspaceGenerations[0].status, "allocated");
    assert.equal(terminal.workspaceIntents[0].state, "failed");
    assert.equal(terminal.workspaceIntents[0].lastFailureAmbiguous, false);
    const terminalReplay = workspace.reserve(command);
    assert.equal(terminalReplay.ok, false);
    assert.equal(terminalReplay.error.code, "PROJECT_IDENTITY_CHANGED");
    assert.equal(backend.calls().length, 0);
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("combined decoder rejects representative workspace lineage, enum, fence, and evidence corruption", async () => {
  const testRuntime = await runtime("workspace-corruption");
  let storeOpen = true;
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    assert.equal(workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "corruption-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    const generation = state.workspaceGenerations[0];
    assert.equal(workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "corruption-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    }).ok, true);
    await testRuntime.store.close();
    storeOpen = false;

    const corruptions = [
      {
        name: "wrong-generation-fence",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_generations_update_guard");
          database.prepare("UPDATE workspace_generations SET fencing_token=fencing_token+1").run();
        },
      },
      {
        name: "unknown-generation-status",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_generations_update_guard");
          database.exec("PRAGMA ignore_check_constraints=ON");
          database.prepare("UPDATE workspace_generations SET status='unknown'").run();
          database.exec("PRAGMA ignore_check_constraints=OFF");
        },
      },
      {
        name: "noncontiguous-observation",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_observations_no_update");
          database.prepare("UPDATE workspace_observations SET observation_number=observation_number+1").run();
        },
      },
      {
        name: "operation-incompatible-receipt-semantics",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_observations_no_update");
          database.exec("DROP TRIGGER workspace_verified_receipts_no_update");
          database.prepare(`UPDATE workspace_observations SET external_state='absent'
            WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create')`).run();
          database.prepare(`UPDATE workspace_verified_receipts SET external_state='absent'
            WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create')`).run();
        },
      },
      {
        name: "operation-incompatible-resulting-status",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_generations_update_guard");
          database.exec("DROP TRIGGER workspace_operation_intents_update_guard");
          database.exec("DROP TRIGGER workspace_finalizations_no_update");
          database.prepare("UPDATE workspace_generations SET status='reserved'").run();
          database.prepare(`UPDATE workspace_operation_intents SET expected_generation_status='reserved'
            WHERE operation_kind='create'`).run();
          database.prepare(`UPDATE workspace_finalizations SET resulting_generation_status='reserved'
            WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create')`).run();
        },
      },
      {
        name: "denied-act-in-successful-chain",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_authorization_decisions_no_update");
          database.prepare(`UPDATE workspace_authorization_decisions
            SET result='deny', reason='grant_missing'
            WHERE phase='act' AND operation_id IN (
              SELECT operation_id FROM workspace_operation_intents WHERE operation_kind='create'
            )`).run();
        },
      },
      {
        name: "finalize-decision-substituted-for-observation",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_observations_no_update");
          database.prepare(`UPDATE workspace_observations
            SET authorization_decision_id=(
              SELECT decision_id FROM workspace_authorization_decisions
              WHERE operation_id=(
                SELECT operation_id FROM workspace_operation_intents
                WHERE intent_id=workspace_observations.intent_id
              ) AND phase='finalize'
            )
            WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create')`).run();
        },
      },
      {
        name: "verified-without-receipt",
        mutate(database) {
          database.exec(`
            PRAGMA foreign_keys=OFF;
            DROP TRIGGER workspace_operation_intents_update_guard;
            DROP TRIGGER workspace_authorization_decisions_no_delete;
            DROP TRIGGER workspace_verified_receipts_no_delete;
            DROP TRIGGER workspace_finalizations_no_delete;
            DROP TRIGGER workspace_events_no_delete;
            UPDATE workspace_operation_intents
              SET state='verified',
                current_authorization_decision_id=(
                  SELECT decision_id FROM workspace_authorization_decisions
                  WHERE operation_id=workspace_operation_intents.operation_id AND phase='act'
                ),
                authorization_binding_revision=2
              WHERE operation_kind='create';
            DELETE FROM workspace_finalizations
              WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create');
            DELETE FROM workspace_verified_receipts
              WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create');
            DELETE FROM workspace_authorization_decisions
              WHERE phase='finalize' AND operation_id IN (
                SELECT operation_id FROM workspace_operation_intents WHERE operation_kind='create'
              );
            DELETE FROM workspace_events
              WHERE event_kind IN ('workspace.operation.finalized', 'workspace.operation.reconciled')
                AND intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create');
          `);
        },
      },
      {
        name: "act-decision-fabricated-finalization",
        mutate(database) {
          database.exec(`
            PRAGMA foreign_keys=OFF;
            DROP TRIGGER workspace_operation_intents_update_guard;
            DROP TRIGGER workspace_authorization_decisions_no_delete;
            DROP TRIGGER workspace_finalizations_no_update;
            DROP TRIGGER workspace_events_no_delete;
            UPDATE workspace_finalizations
              SET authorization_decision_id=(
                SELECT decision_id FROM workspace_authorization_decisions
                WHERE operation_id=(
                  SELECT operation_id FROM workspace_operation_intents
                  WHERE intent_id=workspace_finalizations.intent_id
                ) AND phase='act'
              )
              WHERE intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create');
            UPDATE workspace_operation_intents
              SET current_authorization_decision_id=(
                  SELECT decision_id FROM workspace_authorization_decisions
                  WHERE operation_id=workspace_operation_intents.operation_id AND phase='act'
                ),
                authorization_binding_revision=2
              WHERE operation_kind='create';
            DELETE FROM workspace_authorization_decisions
              WHERE phase='finalize' AND operation_id IN (
                SELECT operation_id FROM workspace_operation_intents WHERE operation_kind='create'
              );
            DELETE FROM workspace_events
              WHERE event_kind IN ('workspace.operation.finalized', 'workspace.operation.reconciled')
                AND intent_id IN (SELECT intent_id FROM workspace_operation_intents WHERE operation_kind='create');
          `);
        },
      },
      {
        name: "missing-verified-receipt",
        mutate(database) {
          database.exec("PRAGMA foreign_keys=OFF");
          database.exec("DROP TRIGGER workspace_verified_receipts_no_delete");
          database.prepare("DELETE FROM workspace_verified_receipts WHERE verified_receipt_id=(SELECT verified_receipt_id FROM workspace_verified_receipts LIMIT 1)").run();
        },
      },
      {
        name: "missing-finalization",
        mutate(database) {
          database.exec("PRAGMA foreign_keys=OFF");
          database.exec("DROP TRIGGER workspace_finalizations_no_delete");
          database.prepare("DELETE FROM workspace_finalizations WHERE finalization_id=(SELECT finalization_id FROM workspace_finalizations LIMIT 1)").run();
        },
      },
      {
        name: "unknown-event-kind",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_events_no_update");
          database.exec("PRAGMA ignore_check_constraints=ON");
          database.prepare("UPDATE workspace_events SET event_kind='credential.secret'").run();
          database.exec("PRAGMA ignore_check_constraints=OFF");
        },
      },
      {
        name: "unbounded-event-evidence",
        mutate(database) {
          database.exec("DROP TRIGGER workspace_events_no_update");
          database.exec("PRAGMA ignore_check_constraints=ON");
          database.prepare("UPDATE workspace_events SET evidence_reference=? WHERE evidence_reference IS NOT NULL").run("x".repeat(257));
          database.exec("PRAGMA ignore_check_constraints=OFF");
        },
      },
    ];
    for (const corruption of corruptions) {
      const databasePath = path.join(testRuntime.fixture.generation, `${corruption.name}.sqlite3`);
      copyFileSync(testRuntime.fixture.layout.databasePath, databasePath);
      const writable = new DatabaseSync(databasePath);
      try {
        corruption.mutate(writable);
      } finally {
        writable.close();
      }
      const inspection = new DatabaseSync(databasePath, { readOnly: true });
      try {
        assert.throws(
          () => readApplicationState(inspection),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
          corruption.name,
        );
      } finally {
        inspection.close();
      }
    }
  } finally {
    if (storeOpen) await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("combined decoder requires an exact same-generation durable ambiguous acyclic recover causation", async () => {
  const testRuntime = await runtime("workspace-recover-causation-corruption");
  let storeOpen = true;
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    assert.equal(workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "causation-reserve-1"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    let generation = state.workspaceGenerations[0];
    backend.failNext("response_loss");
    const ambiguousCreate = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "causation-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(ambiguousCreate.ok, true, JSON.stringify(ambiguousCreate));
    assert.equal(ambiguousCreate.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    const causal = state.workspaceIntents.find((intent) => intent.idempotencyKey === "causation-create");
    assert.ok(causal);
    generation = state.workspaceGenerations[0];
    backend.failNext("response_loss");
    const ambiguousInspect = workspace.inspect({
      kind: "workspace.inspect", ...ownerCommand(state, "causation-inspect"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(ambiguousInspect.ok, true, JSON.stringify(ambiguousInspect));
    assert.equal(ambiguousInspect.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const recovered = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "causation-recover"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: causal.operationId,
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.workspace.status, "ready");
    await testRuntime.store.close();
    storeOpen = false;

    const corruptions = [
      { name: "missing-recover-causation", target: null },
      { name: "nonambiguous-recover-causation", target: "causation-reserve-1" },
      { name: "inspect-root-recover-causation", target: "causation-inspect" },
      { name: "cyclic-recover-causation", target: "causation-recover" },
    ];
    for (const corruption of corruptions) {
      const databasePath = path.join(testRuntime.fixture.generation, `${corruption.name}.sqlite3`);
      copyFileSync(testRuntime.fixture.layout.databasePath, databasePath);
      const writable = new DatabaseSync(databasePath);
      try {
        writable.exec("DROP TRIGGER workspace_operation_intents_update_guard");
        writable.exec("DROP TRIGGER workspace_events_no_update");
        const targetOperationId = corruption.target === null
          ? null
          : writable.prepare(
              "SELECT operation_id FROM workspace_operation_intents WHERE idempotency_key=?",
            ).get(corruption.target).operation_id;
        const recoverIntent = writable.prepare(
          "SELECT intent_id FROM workspace_operation_intents WHERE idempotency_key='causation-recover'",
        ).get();
        writable.prepare(
          "UPDATE workspace_operation_intents SET causation_id=? WHERE intent_id=?",
        ).run(targetOperationId, recoverIntent.intent_id);
        writable.prepare("UPDATE workspace_events SET causation_id=? WHERE intent_id=?").run(
          targetOperationId,
          recoverIntent.intent_id,
        );
      } finally {
        writable.close();
      }
      const inspection = new DatabaseSync(databasePath, { readOnly: true });
      try {
        assert.throws(
          () => readApplicationState(inspection),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
          corruption.name,
        );
      } finally {
        inspection.close();
      }
    }
  } finally {
    if (storeOpen) await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("recover rejects ambiguous inspect roots and retains the original create projection", async () => {
  const testRuntime = await runtime("workspace-recover-effect-root");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    assert.equal(workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "effect-root-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    }).ok, true);

    state = readApplicationStateForOwner(testRuntime.store);
    let generation = state.workspaceGenerations[0];
    backend.failNext("response_loss");
    const ambiguousCreate = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "effect-root-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(ambiguousCreate.ok, true, JSON.stringify(ambiguousCreate));
    assert.equal(ambiguousCreate.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const createRoot = state.workspaceIntents.find((intent) => intent.idempotencyKey === "effect-root-create");
    assert.ok(createRoot);
    backend.setExternalState(generation.workspaceId, generation.generation, "absent");
    backend.failNext("response_loss");
    const createInspect = workspace.inspect({
      kind: "workspace.inspect", ...ownerCommand(state, "effect-root-create-inspect"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(createInspect.ok, true, JSON.stringify(createInspect));
    assert.equal(createInspect.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const createInspectRoot = state.workspaceIntents.find(
      (intent) => intent.idempotencyKey === "effect-root-create-inspect",
    );
    assert.ok(createInspectRoot);
    const recoverCallsBeforeCreate = backend.calls().filter((call) => call.operation === "recover").length;
    const rejectedCreateInspect = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "effect-root-create-inspect-recover"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: createInspectRoot.operationId,
    });
    assert.equal(rejectedCreateInspect.ok, false);
    assert.equal(rejectedCreateInspect.error.code, "RECONCILIATION_REQUIRED");
    assert.equal(backend.calls().filter((call) => call.operation === "recover").length, recoverCallsBeforeCreate);

    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const recoveredCreate = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "effect-root-create-recover"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: createRoot.operationId,
    });
    assert.equal(recoveredCreate.ok, true, JSON.stringify(recoveredCreate));
    assert.equal(recoveredCreate.value.workspace.status, "reserved");

    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const recreated = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "effect-root-recreate"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(recreated.ok, true, JSON.stringify(recreated));
    assert.equal(recreated.value.workspace.status, "ready");
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("recover causation is bound to the current unresolved generation revision", async () => {
  const testRuntime = await runtime("workspace-current-recovery-root");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    backend.failNext("response_loss");
    const ambiguousReserve = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "current-root-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    });
    assert.equal(ambiguousReserve.ok, true, JSON.stringify(ambiguousReserve));
    assert.equal(ambiguousReserve.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    let generation = state.workspaceGenerations[0];
    const resolvedReserveRoot = state.workspaceIntents.find(
      (intent) => intent.idempotencyKey === "current-root-reserve",
    );
    assert.ok(resolvedReserveRoot);
    const recoveredReserve = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "current-root-reserve-recover"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: resolvedReserveRoot.operationId,
    });
    assert.equal(recoveredReserve.ok, true, JSON.stringify(recoveredReserve));
    assert.equal(recoveredReserve.value.workspace.status, "reserved");

    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    backend.failNext("response_loss");
    const ambiguousCreate = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "current-root-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(ambiguousCreate.ok, true, JSON.stringify(ambiguousCreate));
    assert.equal(ambiguousCreate.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const currentCreateRoot = state.workspaceIntents.find(
      (intent) => intent.idempotencyKey === "current-root-create",
    );
    assert.ok(currentCreateRoot);
    const stateBeforeRejectedOldRoot = state;
    const recoverCallsBeforeRejectedOldRoot = backend.calls().filter((call) => call.operation === "recover").length;
    const rejectedOldRoot = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "current-root-old-recover"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: resolvedReserveRoot.operationId,
    });
    assert.equal(rejectedOldRoot.ok, false);
    assert.equal(rejectedOldRoot.error.code, "RECONCILIATION_REQUIRED");
    assert.equal(
      backend.calls().filter((call) => call.operation === "recover").length,
      recoverCallsBeforeRejectedOldRoot,
    );
    assert.deepEqual(readApplicationStateForOwner(testRuntime.store), stateBeforeRejectedOldRoot);

    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const recoveredCreate = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "current-root-create-recover"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: currentCreateRoot.operationId,
    });
    assert.equal(recoveredCreate.ok, true, JSON.stringify(recoveredCreate));
    assert.equal(recoveredCreate.value.workspace.status, "ready");
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("nested ambiguous recover retains the current effect-capable root revision", async () => {
  const testRuntime = await runtime("workspace-nested-recovery-root");
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    assert.equal(workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "nested-root-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    let generation = state.workspaceGenerations[0];
    backend.failNext("ambiguous");
    const ambiguousCreate = workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "nested-root-create"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    });
    assert.equal(ambiguousCreate.ok, true, JSON.stringify(ambiguousCreate));
    assert.equal(ambiguousCreate.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const createRoot = state.workspaceIntents.find((intent) => intent.idempotencyKey === "nested-root-create");
    assert.ok(createRoot);
    backend.failNext("ambiguous");
    const firstRecover = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "nested-root-recover-one"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: createRoot.operationId,
    });
    assert.equal(firstRecover.ok, true, JSON.stringify(firstRecover));
    assert.equal(firstRecover.value.outcome, "ambiguous");
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const nestedRoot = state.workspaceIntents.find(
      (intent) => intent.idempotencyKey === "nested-root-recover-one",
    );
    assert.ok(nestedRoot);
    assert.equal(nestedRoot.expectedGenerationRevision, createRoot.expectedGenerationRevision);
    backend.setExternalState(generation.workspaceId, generation.generation, "absent");
    const secondRecover = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "nested-root-recover-two"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: nestedRoot.operationId,
    });
    assert.equal(secondRecover.ok, true, JSON.stringify(secondRecover));
    assert.equal(secondRecover.value.workspace.status, "reserved");
  } finally {
    await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("combined decoder rejects a resolved old same-operation recovery root", async () => {
  const testRuntime = await runtime("workspace-old-recovery-root-corruption");
  let storeOpen = true;
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    let state = readApplicationStateForOwner(testRuntime.store);
    assert.equal(workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "old-root-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    let generation = state.workspaceGenerations[0];
    backend.failNext("response_loss");
    assert.equal(workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "old-root-create-one"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const oldCreateRoot = state.workspaceIntents.find((intent) => intent.idempotencyKey === "old-root-create-one");
    assert.ok(oldCreateRoot);
    backend.setExternalState(generation.workspaceId, generation.generation, "absent");
    assert.equal(workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "old-root-recover-one"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: oldCreateRoot.operationId,
    }).ok, true);

    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    backend.failNext("response_loss");
    assert.equal(workspace.create({
      kind: "workspace.create", ...ownerCommand(state, "old-root-create-two"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision,
    }).ok, true);
    state = readApplicationStateForOwner(testRuntime.store);
    generation = state.workspaceGenerations[0];
    const currentCreateRoot = state.workspaceIntents.find((intent) => intent.idempotencyKey === "old-root-create-two");
    assert.ok(currentCreateRoot);
    backend.setExternalState(generation.workspaceId, generation.generation, "absent");
    const currentRecover = workspace.recover({
      kind: "workspace.recover", ...ownerCommand(state, "old-root-recover-two"),
      workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
      expectedGenerationRevision: generation.revision, causationId: currentCreateRoot.operationId,
    });
    assert.equal(currentRecover.ok, true, JSON.stringify(currentRecover));
    assert.equal(currentRecover.value.workspace.status, "reserved");
    await testRuntime.store.close();
    storeOpen = false;

    const databasePath = path.join(testRuntime.fixture.generation, "old-same-operation-root.sqlite3");
    copyFileSync(testRuntime.fixture.layout.databasePath, databasePath);
    const writable = new DatabaseSync(databasePath);
    try {
      writable.exec("DROP TRIGGER workspace_operation_intents_update_guard");
      writable.exec("DROP TRIGGER workspace_events_no_update");
      const oldOperationId = writable.prepare(
        "SELECT operation_id FROM workspace_operation_intents WHERE idempotency_key='old-root-create-one'",
      ).get().operation_id;
      const recoverIntent = writable.prepare(
        "SELECT intent_id FROM workspace_operation_intents WHERE idempotency_key='old-root-recover-two'",
      ).get();
      writable.prepare("UPDATE workspace_operation_intents SET causation_id=? WHERE intent_id=?").run(
        oldOperationId,
        recoverIntent.intent_id,
      );
      writable.prepare("UPDATE workspace_events SET causation_id=? WHERE intent_id=?").run(
        oldOperationId,
        recoverIntent.intent_id,
      );
    } finally {
      writable.close();
    }
    const inspection = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.throws(
        () => readApplicationState(inspection),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      inspection.close();
    }

    const actRevisionPath = path.join(testRuntime.fixture.generation, "recover-act-revision-mismatch.sqlite3");
    copyFileSync(testRuntime.fixture.layout.databasePath, actRevisionPath);
    const actRevisionWritable = new DatabaseSync(actRevisionPath);
    try {
      actRevisionWritable.exec("DROP TRIGGER workspace_authorization_decisions_no_update");
      actRevisionWritable.prepare(`UPDATE workspace_authorization_decisions
        SET generation_revision=generation_revision+1
        WHERE phase='act' AND operation_id=(
          SELECT operation_id FROM workspace_operation_intents
          WHERE idempotency_key='old-root-recover-two'
        )`).run();
    } finally {
      actRevisionWritable.close();
    }
    const actRevisionInspection = new DatabaseSync(actRevisionPath, { readOnly: true });
    try {
      assert.throws(
        () => readApplicationState(actRevisionInspection),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      actRevisionInspection.close();
    }
  } finally {
    if (storeOpen) await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});

test("combined decoder refuses forged workspace failure evidence before same-generation reserve reuse", async () => {
  const testRuntime = await runtime("workspace-failure-corruption");
  let storeOpen = true;
  try {
    const backend = createFakeWorkspaceBackend();
    const workspace = createWorkspaceApplicationService(testRuntime.store, backend, testRuntime.trusted, {
      adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "workspace-root-key",
    });
    const state = readApplicationStateForOwner(testRuntime.store);
    backend.failNext("transient");
    const failed = workspace.reserve({
      kind: "workspace.reserve", ...ownerCommand(state, "failure-corruption-reserve"), baseReference: "refs/heads/main",
      predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
    });
    assert.equal(failed.ok, true, JSON.stringify(failed));
    assert.equal(failed.value.state, "failed");
    assert.equal(failed.value.workspace.status, "allocated");
    await testRuntime.store.close();
    storeOpen = false;

    const corruptions = [
      {
        name: "unknown-failure-category",
        sql: "UPDATE workspace_operation_intents SET last_failure_category='forged_category'",
      },
      {
        name: "forged-nonambiguous-integrity",
        sql: `UPDATE workspace_operation_intents
          SET last_failure_category='integrity_failure', last_failure_retryable=0, last_failure_ambiguous=0`,
      },
    ];
    for (const corruption of corruptions) {
      const databasePath = path.join(testRuntime.fixture.generation, `${corruption.name}.sqlite3`);
      copyFileSync(testRuntime.fixture.layout.databasePath, databasePath);
      const writable = new DatabaseSync(databasePath);
      try {
        writable.exec("DROP TRIGGER workspace_operation_intents_update_guard");
        writable.prepare(corruption.sql).run();
      } finally {
        writable.close();
      }
      const inspection = new DatabaseSync(databasePath, { readOnly: true });
      try {
        assert.throws(
          () => readApplicationState(inspection),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
          corruption.name,
        );
      } finally {
        inspection.close();
      }
    }
  } finally {
    if (storeOpen) await testRuntime.store.close();
    cleanupPersistenceFixture(testRuntime.fixture);
  }
});
