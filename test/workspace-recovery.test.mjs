import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createWorkspaceApplicationService,
  createWorkspaceApplicationServiceWithHooks,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { createFakeWorkspaceBackend } from "./fixtures/fake-workspace-backend.mjs";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";
const OPTIONS = Object.freeze({
  adapterId: "fake-workspace",
  adapterVersion: "1.0.0",
  workspaceRootKey: "workspace-root-key",
});

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
  };
}

async function runtime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03a-recovery-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "private recovery body", supersedesTaskId: null,
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
  const started = dispatcher.start({ kind: "dispatch.start", idempotencyKey: `dispatch-${prefix}`, leaseDurationSeconds: 300 });
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
  return { fixture, trusted, store, backend: createFakeWorkspaceBackend(), state };
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

function service(context, crashStage = null) {
  if (crashStage === null) {
    return createWorkspaceApplicationService(context.store, context.backend, context.trusted, OPTIONS);
  }
  let fired = false;
  return createWorkspaceApplicationServiceWithHooks(context.store, context.backend, context.trusted, OPTIONS, {
    afterStage(stage) {
      if (!fired && stage === crashStage) {
        fired = true;
        throw new Error(`simulated-process-loss:${stage}`);
      }
    },
  });
}

async function reopen(context) {
  await context.store.close();
  context.store = await openPersistence(context.fixture.layout, { applicationVersion: "ep03a-recovery-reopen" });
  context.state = readApplicationStateForOwner(context.store);
}

function reserveCommand(state, key) {
  return {
    kind: "workspace.reserve", ...ownerCommand(state, key), baseReference: "refs/heads/main",
    predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
  };
}

function existingCommand(kind, state, key) {
  const generation = state.workspaceGenerations[0];
  return {
    kind: `workspace.${kind}`, ...ownerCommand(state, key),
    workspaceId: generation.workspaceId,
    expectedGeneration: generation.generation,
    expectedGenerationRevision: generation.revision,
  };
}

function recoverCommand(state, causalOperationId, key) {
  return { ...existingCommand("recover", state, key), causationId: causalOperationId };
}

async function prepareOperation(context, operation, key) {
  const normal = service(context);
  if (operation !== "reserve") {
    const reserved = normal.reserve(reserveCommand(readApplicationStateForOwner(context.store), `${key}-baseline-reserve`));
    assert.equal(reserved.ok, true, JSON.stringify(reserved));
  }
  if (operation === "create") return existingCommand("create", readApplicationStateForOwner(context.store), key);
  if (operation === "reserve") return reserveCommand(readApplicationStateForOwner(context.store), key);
  if (operation === "inspect") {
    const created = normal.create(existingCommand("create", readApplicationStateForOwner(context.store), `${key}-baseline-create`));
    assert.equal(created.ok, true, JSON.stringify(created));
    return existingCommand(operation, readApplicationStateForOwner(context.store), key);
  }
  context.backend.failNext("response_loss");
  const ambiguousCreate = normal.create(existingCommand("create", readApplicationStateForOwner(context.store), `${key}-ambiguous-create`));
  assert.equal(ambiguousCreate.ok, true, JSON.stringify(ambiguousCreate));
  assert.equal(ambiguousCreate.value.outcome, "ambiguous");
  const state = readApplicationStateForOwner(context.store);
  const causal = state.workspaceIntents.find((intent) => intent.idempotencyKey === `${key}-ambiguous-create`);
  return recoverCommand(state, causal.operationId, key);
}

async function closeContext(context) {
  await context.store.close();
  cleanupPersistenceFixture(context.fixture);
}

test("real SQLite reopen resumes every committed prepare/observation/verification/finalization boundary without a second backend call", async (suite) => {
  const expectedStatus = { reserve: "reserved", create: "ready", inspect: "ready", recover: "ready" };
  for (const operation of ["reserve", "create", "inspect", "recover"]) {
    for (const stage of ["prepared", "observed", "verified", "finalized"]) {
      await suite.test(`${operation}:${stage}`, async () => {
        const context = await runtime(`workspace-restart-${operation}-${stage}`);
        try {
          const command = await prepareOperation(context, operation, `${operation}-${stage}`);
          const callsBefore = context.backend.calls().filter((call) => call.operation === operation).length;
          const crashing = service(context, stage);
          if (stage === "finalized") {
            const interrupted = crashing[operation](command);
            assert.equal(interrupted.ok, false);
            assert.equal(interrupted.error.code, "PERSISTENCE_FAILURE");
          } else {
            assert.throws(() => crashing[operation](command), new RegExp(`simulated-process-loss:${stage}`));
          }
          await reopen(context);
          const resumed = service(context)[operation](command);
          assert.equal(resumed.ok, true, JSON.stringify(resumed));
          assert.equal(resumed.value.workspace.status, expectedStatus[operation]);
          assert.equal(context.backend.calls().filter((call) => call.operation === operation).length, callsBefore + 1);
        } finally {
          await closeContext(context);
        }
      });
    }
  }
});

test("effect-possible restart never blindly replays mutations and read-only restart resumes exactly once", async (suite) => {
  for (const operation of ["reserve", "create", "inspect", "recover"]) {
    await suite.test(operation, async () => {
      const context = await runtime(`workspace-executing-${operation}`);
      try {
        const command = await prepareOperation(context, operation, `${operation}-executing`);
        const callsBefore = context.backend.calls().filter((call) => call.operation === operation).length;
        assert.throws(() => service(context, "executing")[operation](command), /simulated-process-loss:executing/u);
        await reopen(context);
        const resumed = service(context)[operation](command);
        if (operation === "inspect" || operation === "recover") {
          assert.equal(resumed.ok, true, JSON.stringify(resumed));
          assert.equal(context.backend.calls().filter((call) => call.operation === operation).length, callsBefore + 1);
          return;
        }
        assert.equal(resumed.ok, true, JSON.stringify(resumed));
        assert.equal(resumed.value.outcome, "ambiguous");
        assert.equal(context.backend.calls().filter((call) => call.operation === operation).length, callsBefore);
        let state = readApplicationStateForOwner(context.store);
        const causal = state.workspaceIntents.find((intent) => intent.idempotencyKey === command.idempotencyKey);
        const recovered = service(context).recover(recoverCommand(state, causal.operationId, `${operation}-executing-recover`));
        assert.equal(recovered.ok, true, JSON.stringify(recovered));
        state = readApplicationStateForOwner(context.store);
        if (operation === "reserve") {
          const retried = service(context).reserve(reserveCommand(state, `${operation}-executing-retry`));
          assert.equal(retried.ok, true, JSON.stringify(retried));
          assert.equal(retried.value.workspace.status, "reserved");
        } else {
          const retried = service(context)[operation](existingCommand(operation, state, `${operation}-executing-retry`));
          assert.equal(retried.ok, true, JSON.stringify(retried));
          assert.equal(retried.value.workspace.status, "ready");
        }
        assert.equal(context.backend.calls().filter((call) => call.operation === operation).length, callsBefore + 1);
      } finally {
        await closeContext(context);
      }
    });
  }
});

test("lost responses reconcile known Fake state and preserve ambiguity without duplicate mutation", async (suite) => {
  for (const operation of ["reserve", "create"]) {
    await suite.test(operation, async () => {
      const context = await runtime(`workspace-response-loss-${operation}`);
      try {
        const command = await prepareOperation(context, operation, `${operation}-response-loss`);
        const callsBefore = context.backend.calls().filter((call) => call.operation === operation).length;
        context.backend.failNext("response_loss");
        const ambiguous = service(context)[operation](command);
        assert.equal(ambiguous.ok, true, JSON.stringify(ambiguous));
        assert.equal(ambiguous.value.outcome, "ambiguous");
        await reopen(context);
        const state = readApplicationStateForOwner(context.store);
        const causal = state.workspaceIntents.find((intent) => intent.idempotencyKey === command.idempotencyKey);
        const recovered = service(context).recover(recoverCommand(state, causal.operationId, `${operation}-response-recover`));
        assert.equal(recovered.ok, true, JSON.stringify(recovered));
        assert.equal(recovered.value.workspace.status, operation === "reserve" ? "reserved" : "ready");
        assert.equal(context.backend.calls().filter((call) => call.operation === operation).length, callsBefore + 1);
        assert.equal(context.backend.calls().filter((call) => call.operation === "recover").length, 1);
      } finally {
        await closeContext(context);
      }
    });
  }
});

test("legacy workspace cleanup is refused before trusted ingress, persistence, or backend access", async () => {
  const context = await runtime("workspace-legacy-cleanup-disabled");
  try {
    const normal = service(context);
    assert.equal(normal.reserve(reserveCommand(readApplicationStateForOwner(context.store), "legacy-cleanup-reserve")).ok, true);
    assert.equal(normal.create(existingCommand("create", readApplicationStateForOwner(context.store), "legacy-cleanup-create")).ok, true);
    const state = readApplicationStateForOwner(context.store);
    const before = structuredClone(state);
    const callsBefore = context.backend.calls().length;
    const refused = normal.cleanup(existingCommand("cleanup", state, "legacy-cleanup"));
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "INVALID_STATE");
    assert.equal(refused.requestId, null);
    assert.equal(refused.correlationId, null);
    assert.equal(context.backend.calls().length, callsBefore);
    assert.deepEqual(readApplicationStateForOwner(context.store), before);
  } finally {
    await closeContext(context);
  }
});

test("every successful workspace write phase rolls back all-or-none and resumes from its last committed boundary", async (suite) => {
  const expected = {
    prepared: { generations: 0, intents: 0, observations: 0, receipts: 0, finalizations: 0, state: null },
    executing: { generations: 1, intents: 1, observations: 0, receipts: 0, finalizations: 0, state: "pending" },
    observed: { generations: 1, intents: 1, observations: 0, receipts: 0, finalizations: 0, state: "executing" },
    verified: { generations: 1, intents: 1, observations: 1, receipts: 0, finalizations: 0, state: "observed" },
    finalized: { generations: 1, intents: 1, observations: 1, receipts: 1, finalizations: 0, state: "verified" },
  };
  for (const stage of Object.keys(expected)) {
    await suite.test(stage, async () => {
      const context = await runtime(`workspace-write-failpoint-${stage}`);
      try {
        const command = reserveCommand(readApplicationStateForOwner(context.store), `write-failpoint-${stage}`);
        let fired = false;
        const faulting = createWorkspaceApplicationServiceWithHooks(
          context.store,
          context.backend,
          context.trusted,
          OPTIONS,
          {
            afterWrite(current) {
              if (!fired && current === stage) {
                fired = true;
                throw new Error(`workspace-write-failpoint:${stage}`);
              }
            },
          },
        );
        const failed = faulting.reserve(command);
        assert.equal(failed.ok, false);
        assert.equal(failed.error.code, "PERSISTENCE_FAILURE");
        const state = readApplicationStateForOwner(context.store);
        const shape = expected[stage];
        assert.deepEqual({
          generations: state.workspaceGenerations.length,
          intents: state.workspaceIntents.length,
          observations: state.workspaceObservations.length,
          receipts: state.workspaceReceipts.length,
          finalizations: state.workspaceFinalizations.length,
          state: state.workspaceIntents[0]?.state ?? null,
        }, shape);
        await reopen(context);
        const resumed = service(context).reserve(command);
        if (stage === "observed") {
          assert.equal(resumed.ok, true, JSON.stringify(resumed));
          assert.equal(resumed.value.outcome, "ambiguous");
          const recoveryState = readApplicationStateForOwner(context.store);
          const causal = recoveryState.workspaceIntents.find((intent) => intent.idempotencyKey === command.idempotencyKey);
          const recovered = service(context).recover(recoverCommand(recoveryState, causal.operationId, `write-failpoint-${stage}-recover`));
          assert.equal(recovered.ok, true, JSON.stringify(recovered));
          assert.equal(recovered.value.workspace.status, "reserved");
        } else {
          assert.equal(resumed.ok, true, JSON.stringify(resumed));
          assert.equal(resumed.value.workspace.status, "reserved");
        }
        assert.equal(context.backend.calls().filter((call) => call.operation === "reserve").length, 1);
      } finally {
        await closeContext(context);
      }
    });
  }
});
