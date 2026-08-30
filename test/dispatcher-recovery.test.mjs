import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createManualDispatcher,
  createManualExecutionBackend,
  createReliableExecutionService,
  openPersistence,
} from "../src/index.ts";
import { createDispatcherApplicationServiceWithHooks } from "../src/dispatcher-application.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";

function ingress(label) {
  let sequence = 0;
  let milliseconds = Date.parse("2026-08-30T12:00:00.000Z");
  let tickMilliseconds = 0;
  let owner = `worker-${label}`;
  let runtimeRootKey = "pending-runtime-root";
  const nextIdOverrides = new Map();
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => owner,
    currentWorkerOwner: () => owner,
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => {
      const result = new Date(milliseconds).toISOString();
      milliseconds += tickMilliseconds;
      return result;
    },
    nextId: (kind) => {
      const overridden = nextIdOverrides.get(kind);
      if (overridden !== undefined) {
        nextIdOverrides.delete(kind);
        return overridden;
      }
      return `${kind}-${label}-${++sequence}`;
    },
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }),
    setNow(value) { milliseconds = Date.parse(value); },
    enableTick(value = 1000) { tickMilliseconds = value; },
    setOwner(value) { owner = value; },
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setNextIdOnce(kind, value) { nextIdOverrides.set(kind, value); },
  };
}

async function prepareRuntime(prefix, taskCount) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02c-recovery" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  for (let index = 0; index < taskCount; index += 1) {
    assert.equal(application.execute({
      kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
      taskId: `task-${index}`, body: `recovery task ${index}`, supersedesTaskId: null,
    }).ok, true);
    assert.equal(application.execute({
      kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
      taskId: `task-${index}`, expectedTaskRevision: 1,
    }).ok, true);
  }
  for (let version = 1; version <= 3; version += 1) {
    trusted.setNow(`2026-08-30T12:00:0${version}.000Z`);
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  }
  return { fixture, trusted, store };
}

function app(runtime, hooks = null) {
  const options = { adapterId: "manual-local", adapterVersion: "1.0.0" };
  return hooks === null
    ? createDispatcherApplicationService(runtime.store, runtime.trusted, options)
    : createDispatcherApplicationServiceWithHooks(runtime.store, runtime.trusted, options, hooks);
}

function advanceToSweep(runtime, service, key, second) {
  runtime.trusted.setNow(`2026-08-30T12:00:${String(second).padStart(2, "0")}.000Z`);
  const started = service.start({ kind: "dispatch.start", idempotencyKey: key, leaseDurationSeconds: 300 });
  assert.equal(started.ok, true, JSON.stringify(started));
  runtime.trusted.setNow(`2026-08-30T12:00:${String(second + 1).padStart(2, "0")}.000Z`);
  const begun = service.beginReconciliation({
    kind: "dispatch.begin_reconciliation", runId: started.value.runId,
    expectedOwnerRevision: started.value.ownerRevision, expectedRunRevision: started.value.runRevision,
  });
  assert.equal(begun.ok, true, JSON.stringify(begun));
  const inventory = service.reconciliationInventory(started.value.runId);
  assert.equal(inventory.ok, true);
  runtime.trusted.setNow(`2026-08-30T12:00:${String(second + 2).padStart(2, "0")}.000Z`);
  const reconciled = service.commitReconciliation({
    kind: "dispatch.commit_reconciliation", runId: started.value.runId,
    expectedOwnerRevision: begun.value.ownerRevision, expectedRunRevision: begun.value.runRevision,
    resolutions: inventory.value.map((resource) => ({ ...resource, disposition: "no_effect", code: "resource_already_settled" })),
  });
  assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
  runtime.trusted.setNow(`2026-08-30T12:00:${String(second + 3).padStart(2, "0")}.000Z`);
  const sealed = service.sealCandidates({
    kind: "dispatch.seal_candidates", runId: started.value.runId,
    expectedOwnerRevision: reconciled.value.ownerRevision, expectedRunRevision: reconciled.value.runRevision,
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed));
  return sealed.value;
}

test("library-only Manual dispatcher runs reconcile, seal, claim, effect continuation, and complete summary", async () => {
  const runtime = await prepareRuntime("dispatcher-library-loop", 2);
  try {
    runtime.trusted.setNow("2026-08-30T12:00:10.000Z");
    runtime.trusted.enableTick();
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const dispatcher = createManualDispatcher(runtime.store, runtime.trusted, backend, backend);
    const result = dispatcher.run({
      kind: "dispatch.start", idempotencyKey: "library-manual-trigger", leaseDurationSeconds: 300,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.terminalStatus, "completed");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.dispatcherMemberships[0].expectedMemberCount, 2);
    assert.deepEqual(state.dispatcherMembers.map((member) => member.ordinal), [0, 1]);
    assert.equal(state.dispatcherMembers.every((member) => member.outcome === "claimed"), true);
    assert.equal(state.executionIntents.every((intent) => intent.state === "finalized"), true);
    assert.equal(state.manualTurns.length, 2);
    assert.equal(state.dispatcherRunSummaries[0].claimedCount, 2);
    assert.equal(state.domain.tasks.every((task) => task.state === "running"), true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Manual dispatcher heartbeats keep one owner live beyond minimum and maximum lease windows", async () => {
  const scenarios = [
    { name: "minimum", leaseSeconds: 30, tickMilliseconds: 1000, taskCount: 8 },
    { name: "maximum", leaseSeconds: 3600, tickMilliseconds: 60000, taskCount: 8 },
  ];
  for (const scenario of scenarios) {
    const runtime = await prepareRuntime(`dispatcher-heartbeat-${scenario.name}`, scenario.taskCount);
    try {
      runtime.trusted.setNow("2026-08-30T12:00:10.000Z");
      runtime.trusted.enableTick(scenario.tickMilliseconds);
      const ownerId = runtime.trusted.currentLeaseOwner();
      const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
      const result = createManualDispatcher(runtime.store, runtime.trusted, backend, backend, {
        executionLeaseSeconds: 3600,
      }).run({
        kind: "dispatch.start",
        idempotencyKey: `heartbeat-${scenario.name}`,
        leaseDurationSeconds: scenario.leaseSeconds,
      });
      assert.equal(result.ok, true, `${scenario.name}:${JSON.stringify(result)}`);
      assert.equal(result.value.terminalStatus, "completed", scenario.name);
      const state = readApplicationStateForOwner(runtime.store);
      const run = state.dispatcherRuns.find((candidate) => candidate.runId === result.value.runId);
      assert.ok(run, scenario.name);
      assert.equal(run.ownerId, ownerId, scenario.name);
      assert.equal(run.ownerRevision, 1, scenario.name);
      assert.ok(
        Date.parse(run.updatedAt) - Date.parse(run.createdAt) > scenario.leaseSeconds * 1000,
        `${scenario.name}: run must outlive one full requested lease`,
      );
      assert.ok(
        state.dispatcherAudit.filter((event) =>
          event.runId === run.runId && event.eventKind === "dispatch.heartbeat" && event.result === "accepted").length > 0,
        `${scenario.name}: forward heartbeat evidence must be durable`,
      );
      assert.equal(
        state.dispatcherMembers.filter((member) => member.runId === run.runId && member.outcome === "claimed").length,
        scenario.taskCount,
        scenario.name,
      );
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  }
});

test("expired execution lease with an existing Manual turn reconciles without a duplicate effect or takeover", async () => {
  const runtime = await prepareRuntime("dispatcher-existing-turn", 1);
  try {
    runtime.trusted.setNow("2026-08-30T12:00:10.000Z");
    runtime.trusted.enableTick();
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const first = createManualDispatcher(runtime.store, runtime.trusted, backend, backend).run({
      kind: "dispatch.start", idempotencyKey: "existing-turn-first", leaseDurationSeconds: 300,
    });
    assert.equal(first.ok, true, JSON.stringify(first));
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 1);
    assert.equal(state.manualTurns.length, 1);
    assert.equal(state.manualTurns[0].lifecycle, "queued");

    runtime.trusted.setOwner("worker-existing-turn-recovery");
    runtime.trusted.setNow("2026-08-30T12:10:00.000Z");
    const recovered = createManualDispatcher(runtime.store, runtime.trusted, backend, backend).run({
      kind: "dispatch.start", idempotencyKey: "existing-turn-recovery", leaseDurationSeconds: 300,
    });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.terminalStatus, "completed");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 1);
    assert.equal(state.manualTurns.length, 1);
    const item = state.dispatcherReconciliationItems.find(
      (candidate) => candidate.runId === recovered.value.runId && candidate.resourceKind === "execution_lease",
    );
    assert.equal(item?.disposition, "reconciled");
    assert.equal(item?.code, "execution_turn_queued");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("overlapping sealed runs resolve one claim winner and one durable already-claimed loser", async () => {
  const runtime = await prepareRuntime("dispatcher-competing-runs", 1);
  try {
    const service = app(runtime);
    const first = advanceToSweep(runtime, service, "competing-first", 10);
    const second = advanceToSweep(runtime, service, "competing-second", 20);
    let state = readApplicationStateForOwner(runtime.store);
    const firstMember = state.dispatcherMembers.find((member) => member.runId === first.runId);
    const secondMember = state.dispatcherMembers.find((member) => member.runId === second.runId);
    runtime.trusted.setNow("2026-08-30T12:00:30.000Z");
    const winner = service.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: first.runId,
      expectedOwnerRevision: first.ownerRevision, expectedRunRevision: first.runRevision,
      memberId: firstMember.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(winner.ok, true, JSON.stringify(winner));
    assert.equal(winner.value.outcome, "claimed");
    runtime.trusted.setNow("2026-08-30T12:00:31.000Z");
    const loser = service.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: second.runId,
      expectedOwnerRevision: second.ownerRevision, expectedRunRevision: second.runRevision,
      memberId: secondMember.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(loser.ok, true, JSON.stringify(loser));
    assert.equal(loser.value.outcome, "already_claimed");
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    runtime.trusted.setNow("2026-08-30T12:00:32.000Z");
    assert.equal(createReliableExecutionService(runtime.store, runtime.trusted, backend, backend)
      .start(winner.value.startCommand).ok, true);
    for (const run of [first, second]) {
      runtime.trusted.setNow(run.runId === first.runId ? "2026-08-30T12:00:33.000Z" : "2026-08-30T12:00:34.000Z");
      const current = service.inspect(run.runId);
      const terminal = service.finalize({
        kind: "dispatch.finalize", runId: run.runId,
        expectedOwnerRevision: current.value.ownerRevision, expectedRunRevision: current.value.runRevision,
      });
      assert.equal(terminal.ok, true, JSON.stringify(terminal));
    }
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 1);
    assert.deepEqual(state.dispatcherMembers.map((member) => member.outcome).sort(), ["already_claimed", "claimed"]);
    assert.equal(state.dispatcherRunSummaries.length, 2);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("revoked execution.start authority yields one durable authorization-denied member without a claim", async () => {
  const runtime = await prepareRuntime("dispatcher-start-denied-member", 1);
  try {
    const service = app(runtime);
    const sweep = advanceToSweep(runtime, service, "start-denied-member", 10);
    const authorization = createApplicationService(runtime.store, runtime.trusted);
    let state = readApplicationStateForOwner(runtime.store);
    const startGrants = state.grants.filter(
      (grant) => grant.actorId === ACTOR && grant.action === "execution.start" && grant.revokedAt === null,
    );
    for (const [index, grant] of startGrants.entries()) {
      runtime.trusted.setNow(`2026-08-30T12:00:${String(20 + index).padStart(2, "0")}.000Z`);
      assert.equal(authorization.execute({
        kind: "authorization.grant.revoke", grantId: grant.grantId, expectedGrantRevision: grant.revision,
      }).ok, true);
    }
    state = readApplicationStateForOwner(runtime.store);
    const member = state.dispatcherMembers.find((candidate) => candidate.runId === sweep.runId);
    runtime.trusted.setNow("2026-08-30T12:00:30.000Z");
    const replayCommand = {
      kind: "dispatch.claim_member", runId: sweep.runId,
      expectedOwnerRevision: sweep.ownerRevision, expectedRunRevision: sweep.runRevision,
      memberId: member.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    };
    const lostResponse = app(runtime, {
      afterStage(stage) { if (stage === "member-resolved") throw new Error("simulated lost start-denial response"); },
    }).claimAndPrepareMember(replayCommand);
    assert.equal(lostResponse.ok, false);
    assert.equal(lostResponse.error.code, "PERSISTENCE_FAILURE");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "ready");
    assert.equal(state.executions.length, 0);
    assert.equal(state.executionIntents.length, 0);
    assert.equal(state.executionOperationRequests.length, 0);
    const deniedMember = state.dispatcherMembers.find((candidate) => candidate.memberId === member.memberId);
    assert.equal(deniedMember?.revision, 2);
    assert.equal(deniedMember?.outcome, "authorization_denied");
    assert.equal(deniedMember?.code, "execution_start_denied");
    assert.equal(state.dispatcherMemberDenialRequests.length, 1);
    assert.equal(state.dispatcherMemberDenialDecisions.length, 1);
    assert.equal(state.dispatcherMemberDenialAudit.length, 1);
    const denialRequest = state.dispatcherMemberDenialRequests[0];
    const denialDecision = state.dispatcherMemberDenialDecisions[0];
    const denialAudit = state.dispatcherMemberDenialAudit[0];
    assert.deepEqual({
      runId: denialRequest.runId,
      memberId: denialRequest.memberId,
      actorId: denialRequest.actorId,
      action: denialRequest.action,
      targetRevision: denialRequest.targetRevision,
      result: denialRequest.result,
    }, {
      runId: sweep.runId,
      memberId: member.memberId,
      actorId: ACTOR,
      action: "execution.start",
      targetRevision: 1,
      result: "deny",
    });
    assert.equal(state.executions.some((execution) => execution.executionId === denialRequest.targetExecutionId), false);
    assert.deepEqual({
      requestId: denialDecision.requestId,
      actorId: denialDecision.actorId,
      action: denialDecision.action,
      result: denialDecision.result,
      reason: denialDecision.reason,
      projectId: denialDecision.projectId,
      resourceRevision: denialDecision.resourceRevision,
      configRevision: denialDecision.configRevision,
    }, {
      requestId: denialRequest.requestId,
      actorId: ACTOR,
      action: "execution.start",
      result: "deny",
      reason: "grant_revoked",
      projectId: "project",
      resourceRevision: 1,
      configRevision: 1,
    });
    assert.deepEqual({
      requestId: denialAudit.requestId,
      decisionId: denialAudit.decisionId,
      runId: denialAudit.runId,
      memberId: denialAudit.memberId,
      actorId: denialAudit.actorId,
      correlationId: denialAudit.correlationId,
      targetExecutionId: denialAudit.targetExecutionId,
      code: denialAudit.code,
    }, {
      requestId: denialRequest.requestId,
      decisionId: denialDecision.decisionId,
      runId: sweep.runId,
      memberId: member.memberId,
      actorId: ACTOR,
      correlationId: denialRequest.correlationId,
      targetExecutionId: denialRequest.targetExecutionId,
      code: "grant_revoked",
    });
    const replay = service.claimAndPrepareMember(replayCommand);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.replayed, true);
    assert.deepEqual([
      readApplicationStateForOwner(runtime.store).dispatcherMemberDenialRequests.length,
      readApplicationStateForOwner(runtime.store).dispatcherMemberDenialDecisions.length,
      readApplicationStateForOwner(runtime.store).dispatcherMemberDenialAudit.length,
    ], [1, 1, 1]);

    await runtime.store.close();
    runtime.store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep02c-start-denial-restart" });
    const restartedReplay = app(runtime).claimAndPrepareMember(replayCommand);
    assert.equal(restartedReplay.ok, true, JSON.stringify(restartedReplay));
    assert.equal(restartedReplay.replayed, true);
    state = readApplicationStateForOwner(runtime.store);
    assert.deepEqual([
      state.dispatcherMemberDenialRequests.length,
      state.dispatcherMemberDenialDecisions.length,
      state.dispatcherMemberDenialAudit.length,
    ], [1, 1, 1]);
    assert.equal(state.domain.tasks[0].state, "ready");
    assert.equal(state.executions.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("post-seal Task and Project changes resolve as ineligible and policy-deferred with complete partial summaries", async () => {
  const scenarios = [
    {
      name: "task-cancelled",
      outcome: "ineligible_at_cas",
      mutate(application) {
        return application.execute({
          kind: "task.cancel", projectId: "project", expectedProjectResourceRevision: 1,
          taskId: "task-0", expectedTaskRevision: 2, reason: "cancel after dispatcher seal",
        });
      },
    },
    {
      name: "project-disabled",
      outcome: "policy_deferred",
      mutate(application) {
        return application.execute({
          kind: "project.disable", projectId: "project", expectedResourceRevision: 1, expectedConfigRevision: 1,
        });
      },
    },
  ];
  for (const scenario of scenarios) {
    const runtime = await prepareRuntime(`dispatcher-${scenario.name}`, 1);
    try {
      const service = app(runtime);
      const sweep = advanceToSweep(runtime, service, `run-${scenario.name}`, 10);
      const application = createApplicationService(runtime.store, runtime.trusted);
      runtime.trusted.setNow("2026-08-30T12:00:20.000Z");
      const mutation = scenario.mutate(application);
      assert.equal(mutation.ok, true, JSON.stringify(mutation));
      const member = readApplicationStateForOwner(runtime.store).dispatcherMembers
        .find((candidate) => candidate.runId === sweep.runId);
      runtime.trusted.setNow("2026-08-30T12:00:21.000Z");
      const resolved = service.claimAndPrepareMember({
        kind: "dispatch.claim_member", runId: sweep.runId,
        expectedOwnerRevision: sweep.ownerRevision, expectedRunRevision: sweep.runRevision,
        memberId: member.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
      });
      assert.equal(resolved.ok, true, JSON.stringify(resolved));
      assert.equal(resolved.value.outcome, scenario.outcome);
      runtime.trusted.setNow("2026-08-30T12:00:22.000Z");
      const current = service.inspect(sweep.runId);
      const terminal = service.finalize({
        kind: "dispatch.finalize", runId: sweep.runId,
        expectedOwnerRevision: current.value.ownerRevision, expectedRunRevision: current.value.runRevision,
      });
      assert.equal(terminal.ok, true, JSON.stringify(terminal));
      assert.equal(terminal.value.terminalStatus, "partial");
      const state = readApplicationStateForOwner(runtime.store);
      assert.equal(state.executions.length, 0);
      assert.equal(state.executionIntents.length, 0);
      const summary = state.dispatcherRunSummaries.find((candidate) => candidate.runId === sweep.runId);
      assert.equal(scenario.outcome === "ineligible_at_cas" ? summary.ineligibleCount : summary.policyDeferredCount, 1);
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  }
});

test("post-commit response loss recovers claimed intent and terminal summary without duplicating durable work", async () => {
  const runtime = await prepareRuntime("dispatcher-response-loss", 1);
  try {
    const normal = app(runtime);
    const sweep = advanceToSweep(runtime, normal, "response-loss-run", 10);
    let state = readApplicationStateForOwner(runtime.store);
    const member = state.dispatcherMembers[0];
    runtime.trusted.setNow("2026-08-30T12:00:20.000Z");
    const lossyClaim = app(runtime, {
      afterStage(stage) { if (stage === "member-resolved") throw new Error("simulated lost claim response"); },
    }).claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: sweep.runId,
      expectedOwnerRevision: sweep.ownerRevision, expectedRunRevision: sweep.runRevision,
      memberId: member.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(lossyClaim.ok, false);
    assert.equal(lossyClaim.error.code, "PERSISTENCE_FAILURE");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executions.length, 1);
    assert.equal(state.executionIntents.length, 1);
    assert.equal(state.dispatcherMembers[0].outcome, "claimed");
    const replay = normal.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: sweep.runId,
      expectedOwnerRevision: sweep.ownerRevision, expectedRunRevision: sweep.runRevision,
      memberId: member.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, true);
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    runtime.trusted.setNow("2026-08-30T12:00:21.000Z");
    assert.equal(createReliableExecutionService(runtime.store, runtime.trusted, backend, backend)
      .start(replay.value.startCommand).ok, true);
    runtime.trusted.setNow("2026-08-30T12:00:22.000Z");
    const current = normal.inspect(sweep.runId);
    const lossySummary = app(runtime, {
      afterStage(stage) { if (stage === "summary-committed") throw new Error("simulated lost summary response"); },
    }).finalize({
      kind: "dispatch.finalize", runId: sweep.runId,
      expectedOwnerRevision: current.value.ownerRevision, expectedRunRevision: current.value.runRevision,
    });
    assert.equal(lossySummary.ok, false);
    assert.equal(lossySummary.error.code, "PERSISTENCE_FAILURE");
    const recovered = normal.inspect(sweep.runId);
    assert.equal(recovered.ok, true);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(recovered.value.terminalStatus, "completed");
    assert.equal(state.executions.length, 1);
    assert.equal(state.executionIntents.length, 1);
    assert.equal(state.dispatcherRunSummaries.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("summary completeness CAS withholds terminal output while any sealed member remains pending", async () => {
  const runtime = await prepareRuntime("dispatcher-summary-completeness", 2);
  try {
    const service = app(runtime);
    const sweep = advanceToSweep(runtime, service, "incomplete-summary", 10);
    const state = readApplicationStateForOwner(runtime.store);
    const first = state.dispatcherMembers[0];
    runtime.trusted.setNow("2026-08-30T12:00:20.000Z");
    assert.equal(service.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: sweep.runId,
      expectedOwnerRevision: sweep.ownerRevision, expectedRunRevision: sweep.runRevision,
      memberId: first.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    }).ok, true);
    runtime.trusted.setNow("2026-08-30T12:00:21.000Z");
    const current = service.inspect(sweep.runId);
    const rejected = service.finalize({
      kind: "dispatch.finalize", runId: sweep.runId,
      expectedOwnerRevision: current.value.ownerRevision, expectedRunRevision: current.value.runRevision,
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "RECONCILIATION_INCOMPLETE");
    assert.equal(readApplicationStateForOwner(runtime.store).dispatcherRunSummaries.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("post-seal response loss reopens the exact immutable membership before pending-member recovery", async () => {
  const runtime = await prepareRuntime("dispatcher-seal-response-loss", 1);
  try {
    const service = app(runtime);
    runtime.trusted.setNow("2026-08-30T12:00:10.000Z");
    const started = service.start({ kind: "dispatch.start", idempotencyKey: "seal-loss", leaseDurationSeconds: 300 });
    runtime.trusted.setNow("2026-08-30T12:00:11.000Z");
    const begun = service.beginReconciliation({
      kind: "dispatch.begin_reconciliation", runId: started.value.runId,
      expectedOwnerRevision: started.value.ownerRevision, expectedRunRevision: started.value.runRevision,
    });
    const beforeSummarySeal = service.sealCandidates({
      kind: "dispatch.seal_candidates", runId: begun.value.runId,
      expectedOwnerRevision: begun.value.ownerRevision, expectedRunRevision: begun.value.runRevision,
    });
    assert.equal(beforeSummarySeal.ok, false);
    assert.equal(beforeSummarySeal.error.code, "RUN_NOT_RECONCILED");
    assert.equal(readApplicationStateForOwner(runtime.store).dispatcherMemberships.length, 0);
    runtime.trusted.setNow("2026-08-30T12:00:12.000Z");
    const reconciled = service.commitReconciliation({
      kind: "dispatch.commit_reconciliation", runId: begun.value.runId,
      expectedOwnerRevision: begun.value.ownerRevision, expectedRunRevision: begun.value.runRevision,
      resolutions: [],
    });
    runtime.trusted.setNow("2026-08-30T12:00:13.000Z");
    const lost = app(runtime, {
      afterStage(stage) { if (stage === "membership-sealed") throw new Error("simulated lost seal response"); },
    }).sealCandidates({
      kind: "dispatch.seal_candidates", runId: reconciled.value.runId,
      expectedOwnerRevision: reconciled.value.ownerRevision, expectedRunRevision: reconciled.value.runRevision,
    });
    assert.equal(lost.ok, false);
    assert.equal(lost.error.code, "PERSISTENCE_FAILURE");
    const committed = readApplicationStateForOwner(runtime.store);
    const exactMembership = structuredClone(committed.dispatcherMemberships);
    const exactMembers = structuredClone(committed.dispatcherMembers);
    assert.equal(exactMembership.length, 1);
    assert.equal(exactMembers.length, 1);

    await runtime.store.close();
    runtime.store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep02c-seal-restart" });
    const reopened = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(reopened.dispatcherMemberships, exactMembership);
    assert.deepEqual(reopened.dispatcherMembers, exactMembers);
    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      assert.throws(() => database.prepare(
        "UPDATE dispatcher_memberships SET expected_member_count=0 WHERE run_id=?",
      ).run(started.value.runId));
      assert.throws(() => database.prepare(
        "UPDATE dispatcher_members SET ordinal=2 WHERE member_id=?",
      ).run(exactMembers[0].memberId));
    } finally {
      database.close();
    }
    runtime.trusted.setNow("2026-08-30T12:00:14.000Z");
    runtime.trusted.enableTick();
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const recovered = createManualDispatcher(runtime.store, runtime.trusted, backend, backend).resume(started.value.runId);
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.terminalStatus, "completed");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("late intent identity failure rolls the complete claim unit back to the original pending member", async () => {
  const runtime = await prepareRuntime("dispatcher-claim-rollback", 1);
  try {
    const service = app(runtime);
    const first = advanceToSweep(runtime, service, "rollback-first", 10);
    let state = readApplicationStateForOwner(runtime.store);
    const firstMember = state.dispatcherMembers.find((candidate) => candidate.runId === first.runId);
    runtime.trusted.setNow("2026-08-30T12:00:20.000Z");
    const firstClaim = service.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: first.runId,
      expectedOwnerRevision: first.ownerRevision, expectedRunRevision: first.runRevision,
      memberId: firstMember.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(firstClaim.ok, true, JSON.stringify(firstClaim));
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    runtime.trusted.setNow("2026-08-30T12:00:21.000Z");
    assert.equal(createReliableExecutionService(runtime.store, runtime.trusted, backend, backend)
      .start(firstClaim.value.startCommand).ok, true);
    runtime.trusted.setNow("2026-08-30T12:00:22.000Z");
    const firstCurrent = service.inspect(first.runId);
    assert.equal(service.finalize({
      kind: "dispatch.finalize", runId: first.runId,
      expectedOwnerRevision: firstCurrent.value.ownerRevision, expectedRunRevision: firstCurrent.value.runRevision,
    }).ok, true);

    const application = createApplicationService(runtime.store, runtime.trusted);
    runtime.trusted.setNow("2026-08-30T12:00:23.000Z");
    assert.equal(application.execute({
      kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
      taskId: "task-late-rollback", body: "late rollback", supersedesTaskId: null,
    }).ok, true);
    runtime.trusted.setNow("2026-08-30T12:00:24.000Z");
    assert.equal(application.execute({
      kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
      taskId: "task-late-rollback", expectedTaskRevision: 1,
    }).ok, true);
    const second = advanceToSweep(runtime, service, "rollback-second", 30);
    state = readApplicationStateForOwner(runtime.store);
    const secondMember = state.dispatcherMembers.find((candidate) => candidate.runId === second.runId);
    const before = structuredClone(state);
    runtime.trusted.setNextIdOnce("intent", state.executionIntents[0].intentId);
    runtime.trusted.setNow("2026-08-30T12:00:34.000Z");
    const failedClaim = service.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: second.runId,
      expectedOwnerRevision: second.ownerRevision, expectedRunRevision: second.runRevision,
      memberId: secondMember.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(failedClaim.ok, false);
    assert.equal(failedClaim.error.code, "PERSISTENCE_FAILURE");
    assert.deepEqual(readApplicationStateForOwner(runtime.store), before);
    runtime.trusted.setNow("2026-08-30T12:00:35.000Z");
    const retried = service.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: second.runId,
      expectedOwnerRevision: second.ownerRevision, expectedRunRevision: second.runRevision,
      memberId: secondMember.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.value.outcome, "claimed");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("worker restart resumes every durable run checkpoint under one higher-revision owner", async () => {
  const checkpoints = ["starting", "reconciling", "reconciled", "sealed", "claimed", "effect"];
  for (const checkpoint of checkpoints) {
    const runtime = await prepareRuntime(`dispatcher-checkpoint-${checkpoint}`, 1);
    try {
      let service = app(runtime);
      runtime.trusted.setNow("2026-08-30T12:00:10.000Z");
      const started = service.start({
        kind: "dispatch.start", idempotencyKey: `checkpoint-${checkpoint}`, leaseDurationSeconds: 300,
      });
      assert.equal(started.ok, true, checkpoint);
      let view = started.value;
      if (checkpoint !== "starting") {
        runtime.trusted.setNow("2026-08-30T12:00:11.000Z");
        const begun = service.beginReconciliation({
          kind: "dispatch.begin_reconciliation", runId: view.runId,
          expectedOwnerRevision: view.ownerRevision, expectedRunRevision: view.runRevision,
        });
        assert.equal(begun.ok, true, checkpoint);
        view = begun.value;
      }
      if (!["starting", "reconciling"].includes(checkpoint)) {
        runtime.trusted.setNow("2026-08-30T12:00:12.000Z");
        const reconciled = service.commitReconciliation({
          kind: "dispatch.commit_reconciliation", runId: view.runId,
          expectedOwnerRevision: view.ownerRevision, expectedRunRevision: view.runRevision,
          resolutions: [],
        });
        assert.equal(reconciled.ok, true, checkpoint);
        view = reconciled.value;
      }
      if (["sealed", "claimed", "effect"].includes(checkpoint)) {
        runtime.trusted.setNow("2026-08-30T12:00:13.000Z");
        const sealed = service.sealCandidates({
          kind: "dispatch.seal_candidates", runId: view.runId,
          expectedOwnerRevision: view.ownerRevision, expectedRunRevision: view.runRevision,
        });
        assert.equal(sealed.ok, true, checkpoint);
        view = sealed.value;
      }
      if (["claimed", "effect"].includes(checkpoint)) {
        const member = readApplicationStateForOwner(runtime.store).dispatcherMembers
          .find((candidate) => candidate.runId === view.runId);
        runtime.trusted.setNow("2026-08-30T12:00:14.000Z");
        const claimed = service.claimAndPrepareMember({
          kind: "dispatch.claim_member", runId: view.runId,
          expectedOwnerRevision: view.ownerRevision, expectedRunRevision: view.runRevision,
          memberId: member.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
        });
        assert.equal(claimed.ok, true, checkpoint);
        if (checkpoint === "effect") {
          const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
          runtime.trusted.setNow("2026-08-30T12:00:15.000Z");
          assert.equal(createReliableExecutionService(runtime.store, runtime.trusted, backend, backend)
            .start(claimed.value.startCommand).ok, true, checkpoint);
        }
      }

      await runtime.store.close();
      runtime.store = await openPersistence(runtime.fixture.layout, {
        applicationVersion: `ep02c-checkpoint-restart-${checkpoint}`,
      });
      runtime.trusted.setOwner(`worker-checkpoint-recovery-${checkpoint}`);
      runtime.trusted.setNow("2026-08-30T12:10:00.000Z");
      runtime.trusted.enableTick();
      const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
      const recovered = createManualDispatcher(runtime.store, runtime.trusted, backend, backend).resume(started.value.runId);
      assert.equal(recovered.ok, true, `${checkpoint}:${JSON.stringify(recovered)}`);
      assert.equal(recovered.value.terminalStatus, "completed", checkpoint);
      const state = readApplicationStateForOwner(runtime.store);
      assert.equal(state.dispatcherRunSummaries.filter((summary) => summary.runId === started.value.runId).length, 1, checkpoint);
      assert.equal(state.dispatcherMembers.filter((member) => member.runId === started.value.runId)
        .every((member) => member.lifecycle === "terminal"), true, checkpoint);
      assert.equal(state.executionIntents.every((intent) => intent.state === "finalized"), true, checkpoint);
      assert.equal(state.manualTurns.length, 1, checkpoint);
      assert.equal(state.dispatcherRuns.find((run) => run.runId === started.value.runId)?.ownerId,
        `worker-checkpoint-recovery-${checkpoint}`, checkpoint);
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  }
});

test("stale-run takeover recovers a claimed intent and remaining pending members before the new run seals", async () => {
  const runtime = await prepareRuntime("dispatcher-stale-run-recovery", 2);
  try {
    const original = app(runtime);
    const staleSweep = advanceToSweep(runtime, original, "stale-run", 10);
    let state = readApplicationStateForOwner(runtime.store);
    const first = state.dispatcherMembers.find((member) => member.runId === staleSweep.runId && member.ordinal === 0);
    runtime.trusted.setNow("2026-08-30T12:00:14.000Z");
    const prepared = original.claimAndPrepareMember({
      kind: "dispatch.claim_member", runId: staleSweep.runId,
      expectedOwnerRevision: staleSweep.ownerRevision, expectedRunRevision: staleSweep.runRevision,
      memberId: first.memberId, expectedMembershipRevision: 1, expectedMemberRevision: 1,
    });
    assert.equal(prepared.ok, true, JSON.stringify(prepared));
    assert.equal(prepared.value.outcome, "claimed");
    assert.equal(readApplicationStateForOwner(runtime.store).executionIntents[0].state, "pending");

    await runtime.store.close();
    runtime.store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep02c-stale-run-restart" });
    runtime.trusted.setOwner("worker-stale-takeover");
    runtime.trusted.setNow("2026-08-30T12:07:00.000Z");
    runtime.trusted.enableTick();
    const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.trusted });
    const dispatcher = createManualDispatcher(runtime.store, runtime.trusted, backend, backend);
    const recovered = dispatcher.run({
      kind: "dispatch.start", idempotencyKey: "recovery-trigger", leaseDurationSeconds: 300,
    });
    if (!recovered.ok) {
      const diagnosticState = readApplicationStateForOwner(runtime.store);
      const currentRun = [...diagnosticState.dispatcherRuns].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt, "en"))[0];
      const currentInventory = app(runtime).reconciliationInventory(currentRun.runId);
      assert.fail(JSON.stringify({ recovered, currentInventory, currentRun, staleRun: diagnosticState.dispatcherRuns
        .find((candidate) => candidate.runId === staleSweep.runId) }));
    }
    state = readApplicationStateForOwner(runtime.store);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(recovered.value.terminalStatus, "completed", JSON.stringify({
      reconciliation: state.dispatcherReconciliationItems.filter((item) => item.runId === recovered.value.runId),
      staleRun: state.dispatcherRuns.find((run) => run.runId === staleSweep.runId),
      staleMembers: state.dispatcherMembers.filter((member) => member.runId === staleSweep.runId),
      intents: state.executionIntents.map((intent) => ({ id: intent.intentId, state: intent.state, executionId: intent.executionId })),
    }));
    const staleSummary = state.dispatcherRunSummaries.find((summary) => summary.runId === staleSweep.runId);
    const currentSummary = state.dispatcherRunSummaries.find((summary) => summary.runId === recovered.value.runId);
    assert.equal(staleSummary?.terminalStatus, "completed");
    assert.equal(staleSummary?.claimedCount, 2);
    assert.equal(currentSummary?.expectedMemberCount, 0);
    assert.equal(state.dispatcherMembers.filter((member) => member.runId === staleSweep.runId)
      .every((member) => member.outcome === "claimed"), true);
    assert.deepEqual(
      state.dispatcherReconciliationItems.filter((item) => item.runId === recovered.value.runId)
        .map((item) => item.resourceKind).sort(),
      ["dispatcher_run", "execution_intent", "execution_lease"],
    );
    assert.equal(state.executionIntents.every((intent) => intent.state === "finalized"), true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
