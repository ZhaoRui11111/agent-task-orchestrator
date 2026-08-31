import assert from "node:assert/strict";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createDispatcherApplicationServiceWithHooks,
  createManualExecutionBackend,
  createProductRuntime,
  createReliableExecutionServiceWithHooks,
  openPersistence,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "product-local-actor";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let clockTick = 0;
  let runtimeRootKey = "pending-runtime-root";
  let productConfirmation = true;
  let dispatcherOwner = `dispatcher-${label}`;
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => "owner-product-local",
    currentDispatcherOwner: () => dispatcherOwner,
    currentWorkerOwner: () => dispatcherOwner,
    currentExecutionLeaseOwner: () => "owner-product-local",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(Date.parse(now) + clockTick++).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => productConfirmation
      ? ({ confirmationId: `confirmation-${action.replaceAll(".", "-")}-${++sequence}` }) : null,
    setNow(value) { now = value; clockTick = 0; },
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setProductConfirmation(value) { productConfirmation = value; },
    setDispatcherOwner(value) { dispatcherOwner = value; },
  };
}

function common(state, key) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const execution = state.executions.find((candidate) => candidate.status === "active");
  assert.ok(project && task && execution);
  return {
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    executionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey: key,
  };
}

async function prepareProductRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const ingress = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "product-runtime-test" });
  const application = createApplicationService(store, ingress);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  ingress.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({
    kind: "project.register", projectId: "project", root: fixture.projectRoot,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: "private product task body", supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  for (let index = 1; index <= 3; index += 1) {
    ingress.setNow(`2026-08-30T12:00:0${index}.000Z`);
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  }
  const backend = createManualExecutionBackend(store, { ingress });
  return { fixture, ingress, store, product: createProductRuntime(store, ingress, backend, backend) };
}

function internalInspect(state, key) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const execution = state.executions.find((candidate) => candidate.status === "active");
  const turn = state.manualTurns.find((candidate) => candidate.executionId === execution?.executionId);
  assert.ok(project && task && execution && turn);
  return Object.freeze({
    kind: "execution.inspect",
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    inputReference: turn.inputReference,
    executionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey: key,
    policyBindingReference: turn.policyBindingReference,
    requestedDeadline: "2026-08-30T13:00:00.000Z",
    backendExecutionId: turn.backendExecutionId,
    threadId: turn.threadId,
    lastObservationNumber: turn.revision,
  });
}

function internalManualReport(state, key) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const execution = state.executions.find((candidate) => candidate.status === "active");
  const turn = state.manualTurns.find((candidate) => candidate.executionId === execution?.executionId);
  assert.ok(project && task && execution && turn);
  return Object.freeze({
    kind: "manual.turn.report",
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    inputReference: turn.inputReference,
    executionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey: key,
    policyBindingReference: turn.policyBindingReference,
    requestedDeadline: "2026-08-30T13:00:00.000Z",
    reportId: key,
    backendExecutionId: turn.backendExecutionId,
    threadId: turn.threadId,
    expectedJournalRevision: turn.revision,
    expectedLifecycle: turn.lifecycle,
    outcomeOperation: "succeed",
    code: "manual-success",
    evidenceReference: null,
    lastObservationNumber: turn.revision,
  });
}

test("typed product runtime closes Manual dispatch, inspect, outcome, and separately accepted completion", async () => {
  const runtime = await prepareProductRuntime("product-runtime-happy");
  try {
    runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
    const dispatched = runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "product-dispatch-one", leaseDurationSeconds: 300,
    });
    assert.equal(dispatched.ok, true, JSON.stringify(dispatched));
    assert.deepEqual(Object.keys(dispatched.value), [
      "runId", "status", "ownerRevision", "runRevision", "heartbeatAt", "leaseExpiresAt",
      "membershipRevision", "expectedMemberCount", "pendingMemberCount", "terminalMemberCount",
      "terminalStatus", "replayed",
    ]);
    assert.equal(dispatched.value.terminalStatus, "completed");
    assert.equal(runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "product-dispatch-one", leaseDurationSeconds: 300,
    }).value.replayed, true);

    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.equal(state.manualTurns[0].lifecycle, "queued");
    runtime.ingress.setNow("2026-08-30T12:00:11.000Z");
    const inspected = runtime.product.inspect({ kind: "execution.inspect", ...common(state, "product-inspect-one") });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.deepEqual(Object.keys(inspected.value), [
      "executionId", "taskId", "taskState", "taskRevision", "executionRevision", "attemptNumber",
      "fencingToken", "lifecycle", "observationNumber", "waiting", "replayed",
    ]);

    state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:12.000Z");
    const reported = runtime.product.recordManualOutcome({
      kind: "manual.outcome-report",
      ...common(state, "product-report-one"),
      reportId: "report-one",
      outcome: "succeed",
      code: "manual-success",
      evidenceReference: "evidence-one",
    });
    assert.equal(reported.ok, true, JSON.stringify(reported));
    assert.equal(reported.value.lifecycle, "turn_succeeded");
    assert.equal(reported.value.taskState, "running");

    state = readApplicationStateForOwner(runtime.store);
    const completionCommon = common(state, "product-completion-one");
    runtime.ingress.setNow("2026-08-30T12:00:13.000Z");
    const completed = runtime.product.acceptManualCompletion({
      kind: "execution.accept-manual-completion", ...completionCommon,
    });
    assert.equal(completed.ok, true, JSON.stringify(completed));
    assert.equal(completed.value.taskState, "completed");
    assert.equal(completed.value.replayed, false);
    const replayed = runtime.product.acceptManualCompletion({
      kind: "execution.accept-manual-completion", ...completionCommon,
    });
    assert.equal(replayed.ok, true, JSON.stringify(replayed));
    assert.equal(replayed.value.replayed, true);
    assert.equal(readApplicationStateForOwner(runtime.store).manualCompletionDecisions.length, 1);

    const publicText = JSON.stringify({ dispatched: dispatched.value, reported: reported.value, completed: completed.value });
    for (const secret of [
      "private product task body", ACTOR, PRINCIPAL, "owner-product-local", "backend_execution-",
      "thread-", "intent-", "evidence-one", "product-dispatch-one", "product-report-one",
    ]) assert.equal(publicText.includes(secret), false, secret);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("product runtime projects waiting metadata and routes resume plus verified cancellation", async () => {
  const runtime = await prepareProductRuntime("product-runtime-resume-cancel");
  try {
    runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
    assert.equal(runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "resume-dispatch", leaseDurationSeconds: 300,
    }).ok, true);
    let state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:11.000Z");
    const waiting = runtime.product.recordManualOutcome({
      kind: "manual.outcome-report", ...common(state, "resume-wait-report"),
      reportId: "resume-wait-report", outcome: "wait", code: "manual-input-required",
      evidenceReference: "private-wait-evidence",
    });
    assert.equal(waiting.ok, true, JSON.stringify(waiting));
    assert.equal(waiting.value.taskState, "waiting");
    assert.deepEqual(Object.keys(waiting.value.waiting), [
      "reason", "phase", "requiredAction", "lastErrorCode", "lastErrorSummary", "retryable",
      "retryCount", "retryAfter", "executionId", "workspaceRevision", "waitingTaskRevision",
    ]);
    assert.equal(waiting.value.waiting.reason, "human_input");

    state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:12.000Z");
    const resumed = runtime.product.resume({
      kind: "execution.resume", ...common(state, "resume-operation"),
      continuationReference: "resume-continuation", requiredActionReceiptId: "operator-accepted-input",
    });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(resumed.value.lifecycle, "active");
    assert.equal(resumed.value.taskState, "running");
    assert.equal(resumed.value.waiting, null);

    state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:13.000Z");
    const requested = runtime.product.requestCancel({
      kind: "execution.request-cancel", ...common(state, "cancel-request"), reasonCode: "operator-cancelled",
    });
    assert.equal(requested.ok, true, JSON.stringify(requested));
    assert.equal(requested.value.taskState, "running");

    state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:14.000Z");
    const interrupted = runtime.product.recordManualOutcome({
      kind: "manual.outcome-report", ...common(state, "cancel-confirm-report"),
      reportId: "cancel-confirm-report", outcome: "confirm_cancelled", code: "manual-cancelled",
      evidenceReference: null,
    });
    assert.equal(interrupted.ok, true, JSON.stringify(interrupted));
    assert.equal(interrupted.value.lifecycle, "cancelled");
    assert.equal(interrupted.value.taskState, "cancelled");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("product runtime routes retry from a verified failed Manual turn", async () => {
  const runtime = await prepareProductRuntime("product-runtime-retry");
  try {
    runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
    assert.equal(runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "retry-dispatch", leaseDurationSeconds: 300,
    }).ok, true);
    let state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:11.000Z");
    const failed = runtime.product.recordManualOutcome({
      kind: "manual.outcome-report", ...common(state, "retry-fail-report"),
      reportId: "retry-fail-report", outcome: "fail", code: "manual-turn-failed",
      evidenceReference: null,
    });
    assert.equal(failed.ok, true, JSON.stringify(failed));
    assert.equal(failed.value.taskState, "waiting");
    assert.equal(failed.value.waiting.reason, "execution_failed");

    state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:12.000Z");
    const retried = runtime.product.retry({
      kind: "execution.retry", ...common(state, "retry-operation"),
      continuationReference: "retry-continuation", requiredActionReceiptId: "operator-approved-retry",
    });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.value.lifecycle, "active");
    assert.equal(retried.value.taskState, "running");
    assert.equal(retried.value.waiting, null);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("product runtime rejects exact-shape, stale CAS, and missing named-confirmation failures without mutation", async () => {
  const runtime = await prepareProductRuntime("product-runtime-negative");
  try {
    assert.deepEqual(runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "bad-lease", leaseDurationSeconds: 29,
    }), { ok: false, error: { owner: "reliable", code: "INVALID_INPUT" } });
    runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
    assert.equal(runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "negative-dispatch", leaseDurationSeconds: 300,
    }).ok, true);
    let state = readApplicationStateForOwner(runtime.store);
    const before = structuredClone(state);
    assert.deepEqual(runtime.product.inspect({
      kind: "execution.inspect", ...common(state, "bad-shape"), extra: true,
    }), { ok: false, error: { owner: "reliable", code: "INVALID_INPUT" } });
    assert.deepEqual(runtime.product.inspect({
      kind: "execution.inspect", ...common(state, "stale-inspect"), expectedTaskRevision: 999,
    }), { ok: false, error: { owner: "reliable", code: "STALE_REVISION" } });
    assert.deepEqual(readApplicationStateForOwner(runtime.store), before);

    runtime.ingress.setProductConfirmation(false);
    runtime.ingress.setNow("2026-08-30T12:00:11.000Z");
    const denied = runtime.product.recordManualOutcome({
      kind: "manual.outcome-report", ...common(state, "denied-report"), reportId: "denied-report",
      outcome: "succeed", code: "denied", evidenceReference: null,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.owner, "reliable");
    assert.equal(denied.error.code, "CONFIRMATION_REQUIRED");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.manualTurns[0].lifecycle, "queued");
    assert.equal(state.manualBackendOperations.filter((operation) => operation.operationKind === "manual_report").length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("product dispatch replays across workers, resumes an expired pending run, and fences the old worker", async () => {
  const runtime = await prepareProductRuntime("product-dispatch-takeover");
  let storeOpen = true;
  try {
    runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
    const staged = createDispatcherApplicationServiceWithHooks(runtime.store, runtime.ingress, {
      adapterId: "manual-local", adapterVersion: "1.0.0",
    }, {
      afterStage(stage) {
        if (stage === "membership-sealed") throw new Error("simulated-membership-response-loss");
      },
    });
    const started = staged.start({
      kind: "dispatch.start", idempotencyKey: "product-pending-run", leaseDurationSeconds: 30,
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    let view = staged.beginReconciliation({
      kind: "dispatch.begin_reconciliation", runId: started.value.runId,
      expectedOwnerRevision: started.value.ownerRevision, expectedRunRevision: started.value.runRevision,
    });
    assert.equal(view.ok, true, JSON.stringify(view));
    const reconciled = staged.commitReconciliation({
      kind: "dispatch.commit_reconciliation", runId: started.value.runId,
      expectedOwnerRevision: view.value.ownerRevision, expectedRunRevision: view.value.runRevision,
      resolutions: [],
    });
    assert.equal(reconciled.ok, true, JSON.stringify(reconciled));
    const lostSeal = staged.sealCandidates({
      kind: "dispatch.seal_candidates", runId: started.value.runId,
      expectedOwnerRevision: reconciled.value.ownerRevision, expectedRunRevision: reconciled.value.runRevision,
    });
    assert.equal(lostSeal.ok, false);
    assert.equal(lostSeal.error.code, "PERSISTENCE_FAILURE");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.dispatcherRuns.length, 1);
    assert.equal(state.dispatcherMembers.length, 1);
    assert.equal(state.dispatcherMembers[0].lifecycle, "pending");

    await runtime.store.close();
    storeOpen = false;
    const restartedIngress = trustedIngress("product-dispatch-takeover-restart");
    restartedIngress.setRuntimeRootKey(state.bootstrap.rootKey);
    restartedIngress.setDispatcherOwner("dispatcher-product-restarted");
    restartedIngress.setNow("2026-08-30T12:00:20.000Z");
    runtime.store = await openPersistence(runtime.fixture.layout, { applicationVersion: "product-dispatch-restart" });
    storeOpen = true;
    let backend = createManualExecutionBackend(runtime.store, { ingress: restartedIngress });
    let product = createProductRuntime(runtime.store, restartedIngress, backend, backend);
    const canonical = product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "product-pending-run", leaseDurationSeconds: 30,
    });
    assert.equal(canonical.ok, true, JSON.stringify(canonical));
    assert.equal(canonical.value.replayed, true);
    assert.equal(canonical.value.ownerRevision, 1);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.dispatcherRuns[0].ownerId, "dispatcher-product-dispatch-takeover");
    assert.equal(state.executions.length, 0);

    restartedIngress.setNow("2026-08-30T12:01:00.000Z");
    const recovered = product.dispatchResume({ kind: "dispatch.resume", runId: started.value.runId });
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.terminalStatus, "completed");
    assert.equal(recovered.value.ownerRevision, 2);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.dispatcherRuns[0].ownerId, "dispatcher-product-restarted");
    assert.equal(state.dispatcherRunSummaries.length, 1);
    assert.equal(state.dispatcherMembers[0].lifecycle, "terminal");
    assert.equal(state.executions.length, 1);
    assert.equal(state.executions[0].ownerId, "owner-product-local");
    assert.equal(state.manualTurns.length, 1);

    const staleApplication = createDispatcherApplicationService(runtime.store, runtime.ingress, {
      adapterId: "manual-local", adapterVersion: "1.0.0",
    });
    const run = state.dispatcherRuns[0];
    const staleWrite = staleApplication.finalize({
      kind: "dispatch.finalize", runId: run.runId,
      expectedOwnerRevision: run.ownerRevision, expectedRunRevision: run.runRevision,
    });
    assert.equal(staleWrite.ok, false);
    assert.equal(staleWrite.error.code, "STALE_OWNER");
  } finally {
    if (storeOpen) await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("product facade reopens every durable reliable-loop checkpoint without duplicate evidence", async (context) => {
  for (const failpoint of [
    "prepared", "executing", "independent-inspect",
    "observed", "receipt", "verified", "finalized",
  ]) {
    await context.test(`inspect after ${failpoint}`, async () => {
      const runtime = await prepareProductRuntime(`product-recovery-${failpoint}`);
      let storeOpen = true;
      try {
        runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
        assert.equal(runtime.product.dispatchRun({
          kind: "dispatch.run", idempotencyKey: `recovery-dispatch-${failpoint}`, leaseDurationSeconds: 300,
        }).ok, true);
        const before = readApplicationStateForOwner(runtime.store);
        const publicCommand = Object.freeze({
          kind: "execution.inspect",
          ...common(before, `product-inspect-${failpoint}`),
        });
        const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
        let failpointReached = false;
        const hooked = createReliableExecutionServiceWithHooks(
          runtime.store,
          runtime.ingress,
          backend,
          backend,
          {
            afterStage(stage) {
              if (stage === failpoint) {
                failpointReached = true;
                throw new Error(`simulated-crash-${failpoint}`);
              }
            },
          },
        );
        try {
          hooked.inspect(internalInspect(before, publicCommand.idempotencyKey));
        } catch (error) {
          assert.match(String(error), /simulated-crash/u);
        }
        assert.equal(failpointReached, true, failpoint);
        await runtime.store.close();
        storeOpen = false;
        runtime.store = await openPersistence(runtime.fixture.layout, {
          applicationVersion: `product-recovery-${failpoint}-reopen`,
        });
        storeOpen = true;
        const reopenedBackend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
        const reopenedProduct = createProductRuntime(runtime.store, runtime.ingress, reopenedBackend, reopenedBackend);
        const recovered = reopenedProduct.inspect(publicCommand);
        assert.equal(recovered.ok, true, `${failpoint}:${JSON.stringify(recovered)}`);
        const replay = reopenedProduct.inspect(publicCommand);
        assert.equal(replay.ok, true, `${failpoint}:${JSON.stringify(replay)}`);
        assert.equal(replay.value.replayed, true);
        const state = readApplicationStateForOwner(runtime.store);
        const intents = state.executionIntents.filter((candidate) => candidate.idempotencyKey === publicCommand.idempotencyKey);
        assert.equal(intents.length, 1);
        assert.equal(intents[0].state, "finalized");
        assert.equal(state.executionObservations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
        assert.equal(state.executionReceipts.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
        assert.equal(state.executionFinalizations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
        assert.equal(state.manualBackendOperations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 0);
      } finally {
        if (storeOpen) await runtime.store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
  await context.test("Manual report after adapter-effect", async () => {
    const runtime = await prepareProductRuntime("product-recovery-adapter-effect");
    let storeOpen = true;
    try {
      runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
      assert.equal(runtime.product.dispatchRun({
        kind: "dispatch.run", idempotencyKey: "recovery-dispatch-adapter-effect", leaseDurationSeconds: 300,
      }).ok, true);
      const before = readApplicationStateForOwner(runtime.store);
      const publicCommand = Object.freeze({
        kind: "manual.outcome-report",
        ...common(before, "product-report-adapter-effect"),
        reportId: "product-report-adapter-effect",
        outcome: "succeed",
        code: "manual-success",
        evidenceReference: null,
      });
      const backend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
      let failpointReached = false;
      const hooked = createReliableExecutionServiceWithHooks(
        runtime.store,
        runtime.ingress,
        backend,
        backend,
        {
          afterStage(stage) {
            if (stage === "adapter-effect") {
              failpointReached = true;
              throw new Error("simulated-crash-adapter-effect");
            }
          },
        },
      );
      try {
        hooked.recordManualOutcome(internalManualReport(before, publicCommand.idempotencyKey));
      } catch (error) {
        assert.match(String(error), /simulated-crash/u);
      }
      assert.equal(failpointReached, true);
      await runtime.store.close();
      storeOpen = false;
      runtime.store = await openPersistence(runtime.fixture.layout, {
        applicationVersion: "product-recovery-adapter-effect-reopen",
      });
      storeOpen = true;
      const reopenedBackend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
      const reopenedProduct = createProductRuntime(runtime.store, runtime.ingress, reopenedBackend, reopenedBackend);
      const recovered = reopenedProduct.recordManualOutcome(publicCommand);
      assert.equal(recovered.ok, true, JSON.stringify(recovered));
      assert.equal(recovered.value.lifecycle, "turn_succeeded");
      const state = readApplicationStateForOwner(runtime.store);
      const intents = state.executionIntents.filter((candidate) => candidate.idempotencyKey === publicCommand.idempotencyKey);
      assert.equal(intents.length, 1);
      assert.equal(intents[0].state, "finalized");
      assert.equal(state.manualBackendOperations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
      assert.equal(state.executionObservations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
      assert.equal(state.executionReceipts.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
      assert.equal(state.executionFinalizations.filter((candidate) => candidate.intentId === intents[0].intentId).length, 1);
    } finally {
      if (storeOpen) await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
});

test("product restart replays Manual report and completion response loss exactly once", async () => {
  const runtime = await prepareProductRuntime("product-report-completion-loss");
  let storeOpen = true;
  try {
    runtime.ingress.setNow("2026-08-30T12:00:10.000Z");
    assert.equal(runtime.product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "loss-dispatch", leaseDurationSeconds: 300,
    }).ok, true);
    let state = readApplicationStateForOwner(runtime.store);
    const reportCommand = Object.freeze({
      kind: "manual.outcome-report",
      ...common(state, "loss-report"),
      reportId: "loss-report",
      outcome: "succeed",
      code: "manual-success",
      evidenceReference: null,
    });
    const reported = runtime.product.recordManualOutcome(reportCommand);
    assert.equal(reported.ok, true, JSON.stringify(reported));
    await runtime.store.close();
    storeOpen = false;
    runtime.store = await openPersistence(runtime.fixture.layout, { applicationVersion: "product-report-loss-reopen" });
    storeOpen = true;
    let backend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    let product = createProductRuntime(runtime.store, runtime.ingress, backend, backend);
    const reportReplay = product.recordManualOutcome(reportCommand);
    assert.equal(reportReplay.ok, true, JSON.stringify(reportReplay));
    assert.equal(reportReplay.value.replayed, true);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.manualBackendOperations.filter((candidate) => candidate.operationKind === "manual_report").length, 1);
    const completionCommand = Object.freeze({
      kind: "execution.accept-manual-completion",
      ...common(state, "loss-completion"),
    });
    const completed = product.acceptManualCompletion(completionCommand);
    assert.equal(completed.ok, true, JSON.stringify(completed));
    await runtime.store.close();
    storeOpen = false;
    runtime.store = await openPersistence(runtime.fixture.layout, { applicationVersion: "product-completion-loss-reopen" });
    storeOpen = true;
    backend = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    product = createProductRuntime(runtime.store, runtime.ingress, backend, backend);
    const completionReplay = product.acceptManualCompletion(completionCommand);
    assert.equal(completionReplay.ok, true, JSON.stringify(completionReplay));
    assert.equal(completionReplay.value.replayed, true);
    assert.equal(readApplicationStateForOwner(runtime.store).manualCompletionDecisions.length, 1);
  } finally {
    if (storeOpen) await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("product recovers a lost Manual start response and keeps unresolved external state explicit", async () => {
  const recovered = await prepareProductRuntime("product-start-response-loss");
  try {
    const manual = createManualExecutionBackend(recovered.store, { ingress: recovered.ingress });
    let lost = true;
    const responseLoss = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) {
        const result = manual.start(request);
        if (lost && result.ok) { lost = false; throw new Error("simulated-start-response-loss"); }
        return result;
      },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const product = createProductRuntime(recovered.store, recovered.ingress, responseLoss, manual);
    recovered.ingress.setNow("2026-08-30T12:00:10.000Z");
    const dispatched = product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "lost-start-dispatch", leaseDurationSeconds: 300,
    });
    assert.equal(dispatched.ok, true, JSON.stringify(dispatched));
    let state = readApplicationStateForOwner(recovered.store);
    assert.equal(state.manualTurns.length, 1);
    assert.equal(state.manualBackendOperations.filter((candidate) => candidate.operationKind === "start").length, 1);
    assert.equal(state.executionIntents.some((candidate) => candidate.state !== "finalized"), false);
  } finally {
    await recovered.store.close();
    cleanupPersistenceFixture(recovered.fixture);
  }

  const ambiguous = await prepareProductRuntime("product-ambiguous-start");
  try {
    const manual = createManualExecutionBackend(ambiguous.store, { ingress: ambiguous.ingress });
    const unknown = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start() { throw new Error("simulated-unknown-external-state"); },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const product = createProductRuntime(ambiguous.store, ambiguous.ingress, unknown, manual);
    ambiguous.ingress.setNow("2026-08-30T12:00:10.000Z");
    const dispatched = product.dispatchRun({
      kind: "dispatch.run", idempotencyKey: "ambiguous-dispatch", leaseDurationSeconds: 300,
    });
    assert.equal(dispatched.ok, true, JSON.stringify(dispatched));
    const state = readApplicationStateForOwner(ambiguous.store);
    assert.equal(state.domain.tasks[0].state, "waiting");
    assert.equal(state.domain.tasks[0].waiting.reason, "ambiguous_external_state");
    assert.equal(state.manualTurns.length, 0);
    assert.equal(state.manualBackendOperations.length, 0);
    assert.equal(state.executionReceipts.length, 0);
    assert.equal(state.executionFinalizations.length, 1);
    assert.equal(state.executionFinalizations[0].outcome, "waiting");
    assert.equal(state.executionFinalizations[0].code, "ambiguous_external_state");
  } finally {
    await ambiguous.store.close();
    cleanupPersistenceFixture(ambiguous.fixture);
  }
});
