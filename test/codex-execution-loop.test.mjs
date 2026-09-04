import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  createApplicationService,
  createDispatcherApplicationService,
  createManualExecutionBackend,
  createReliableExecutionService,
  createWorkspaceApplicationService,
  openPersistence,
  verifyBackupGeneration,
} from "../src/index.ts";
import { createCodexExecutionBackend } from "../src/codex-execution-backend.ts";
import { createInjectedCodexReliableExecutionService } from "../src/execution-loop.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { readApplicationState } from "../src/persistence/application-repository-state.ts";
import { sha256 } from "../src/persistence/values.ts";
import { createFakeWorkspaceBackend } from "./fixtures/fake-workspace-backend.mjs";
import {
  cleanupPersistenceFixture,
  createAuthorizedTestBackup,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";
const TASK_BODY = "private Codex task input must remain ephemeral";

function ingress(label) {
  let sequence = 0;
  let milliseconds = Date.parse("2026-08-30T12:00:00.000Z");
  let runtimeRootKey = "pending-runtime-root";
  let executionOwner = "codex-execution-owner";
  return {
    currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
    currentLeaseOwner: () => executionOwner,
    currentWorkerOwner: () => "codex-dispatch-owner",
    currentExecutionLeaseOwner: () => executionOwner,
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(milliseconds += 1000).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${action}-${++sequence}` }),
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setExecutionOwner(value) { executionOwner = value; },
  };
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

async function prepareRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const trusted = ingress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03d-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: TASK_BODY, supersedesTaskId: null,
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
  const preparedManual = state.executionIntents[0];
  const manualBackend = createManualExecutionBackend(store, { ingress: trusted });
  const manual = createReliableExecutionService(store, trusted, manualBackend, manualBackend);
  const preparedManualCommand = {
    kind: "execution.start",
    projectId: preparedManual.projectId,
    expectedProjectResourceRevision: preparedManual.projectResourceRevision,
    expectedProjectConfigRevision: preparedManual.projectConfigRevision,
    taskId: preparedManual.taskId,
    expectedTaskRevision: preparedManual.taskRevision,
    inputReference: preparedManual.inputReference,
    executionId: preparedManual.executionId,
    expectedExecutionRevision: preparedManual.executionRevision,
    expectedAttemptNumber: preparedManual.attemptNumber,
    expectedFencingToken: preparedManual.fencingToken,
    idempotencyKey: preparedManual.idempotencyKey,
    policyBindingReference: preparedManual.policyBindingReference,
    requestedDeadline: preparedManual.requestedDeadline,
  };
  trusted.setExecutionOwner("codex-no-effect-reconciler");
  const manualNoEffect = manual.reconcileExpiredStartNoEffect(preparedManualCommand);
  assert.equal(manualNoEffect.ok, true, JSON.stringify(manualNoEffect));
  trusted.setExecutionOwner("codex-execution-owner");
  state = readApplicationStateForOwner(store);
  assert.equal(state.executionIntents[0].state, "finalized");
  assert.equal(state.manualTurns.length, 0);
  assert.equal(state.manualBackendOperations.length, 0);
  const workspaceBackend = createFakeWorkspaceBackend();
  const workspace = createWorkspaceApplicationService(store, workspaceBackend, trusted, {
    adapterId: "fake-workspace", adapterVersion: "1.0.0", workspaceRootKey: "codex-workspace-root",
  });
  state = readApplicationStateForOwner(store);
  const reserved = workspace.reserve({
    kind: "workspace.reserve", ...ownerCommand(state, `reserve-${prefix}`), baseReference: "refs/heads/main",
    predecessorWorkspaceId: null, predecessorGeneration: null, predecessorRevision: null,
  });
  assert.equal(reserved.ok, true, JSON.stringify(reserved));
  state = readApplicationStateForOwner(store);
  const generation = state.workspaceGenerations[0];
  const created = workspace.create({
    kind: "workspace.create", ...ownerCommand(state, `create-${prefix}`),
    workspaceId: generation.workspaceId, expectedGeneration: generation.generation,
    expectedGenerationRevision: generation.revision,
  });
  assert.equal(created.ok, true, JSON.stringify(created));
  state = readApplicationStateForOwner(store);
  const ready = state.workspaceGenerations[0];
  const receipt = state.workspaceReceipts.find((candidate) => {
    const finalization = state.workspaceFinalizations.find((record) =>
      record.intentId === candidate.intentId && record.verifiedReceiptId === candidate.verifiedReceiptId &&
      record.resultingGenerationRevision === ready.revision && record.resultingGenerationStatus === "ready"
    );
    return candidate.workspaceId === ready.workspaceId && candidate.generation === ready.generation &&
      finalization !== undefined;
  });
  assert.ok(receipt);
  const workspaceContext = Object.freeze({
    workspaceContractId: "ato.workspace/v2",
    workspaceId: ready.workspaceId,
    workspaceGeneration: ready.generation,
    workspaceRevision: ready.revision,
    workspaceRootKey: ready.workspaceRootKey,
    ownershipBindingSha256: receipt.ownershipBindingSha256,
    workspaceHeadObjectId: receipt.headObjectId,
  });
  return { fixture, trusted, store, workspaceContext };
}

function startCommand(state, workspace, idempotencyKey = "codex-start") {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const execution = state.executions[0];
  return Object.freeze({
    kind: "execution.start",
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    inputReference: `task-sha256:${sha256(task.body).toLowerCase()}`,
    executionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    idempotencyKey,
    policyBindingReference: "codex-policy-binding",
    requestedDeadline: "2026-09-10T12:00:00.000Z",
    workspace,
  });
}

function backendFor(runtime, behavior = "success") {
  const calls = [];
  let backendSequence = 0;
  let backendMilliseconds = Date.parse("2026-08-30T13:00:00.000Z");
  let inspectRefused = false;
  const driver = Object.freeze({
    async run(request, observe) {
      calls.push(Object.freeze({ ...request, signal: "redacted" }));
      if (request.operation === "start") observe(Object.freeze({ type: "thread.started", threadId: "codex-thread-1" }));
      observe(Object.freeze({ type: "turn.started" }));
      if (behavior === "unproved") throw new Error("SENTINEL RAW SDK ERROR MUST NOT PERSIST");
      if (behavior === "failed") observe(Object.freeze({ type: "turn.failed" }));
      else observe(Object.freeze({
        type: "turn.completed",
        usage: Object.freeze({
          input_tokens: 1, cached_input_tokens: 0, cache_write_input_tokens: 0,
          output_tokens: 1, reasoning_output_tokens: 0,
        }),
      }));
    },
  });
  const verifierCalls = [];
  const workspaceVerifier = Object.freeze({
    verify(semantic, input) {
      verifierCalls.push(Object.freeze({ semantic, input }));
      if (inspectRefused && input === null) throw new Error("injected workspace inspection refusal");
      return Object.freeze({ workingDirectory: runtime.fixture.projectRoot });
    },
  });
  const backend = createCodexExecutionBackend(runtime.store, {
    gitExecutable: "git", projectBindings: [], workspaceRoots: [],
  }, {
    driver,
    workspaceVerifier,
    ingress: Object.freeze({
      now: () => new Date(backendMilliseconds += 1000).toISOString(),
      nextId: (kind) => `${kind}-codex-${++backendSequence}`,
    }),
  });
  return {
    backend,
    calls,
    verifierCalls,
    setInspectRefused(value) { inspectRefused = value; },
  };
}

test("injected Codex start persists terminal evidence, replays without SDK access, and never completes the Task", async () => {
  const runtime = await prepareRuntime("codex-loop-success");
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const initial = readApplicationStateForOwner(runtime.store);
    const command = startCommand(initial, runtime.workspaceContext);
    const result = await service.start(command);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.lifecycle, "turn_succeeded");
    assert.equal(result.value.taskState, "running");
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0].input, TASK_BODY);
    assert.equal(fake.verifierCalls.every((call) => call.semantic.workspaceMode === "owned"), true);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(state.codexBackendOperations.length, 1);
    assert.equal(state.codexTurns[0].terminalSignal, "turn.completed");
    assert.equal(state.executionTerminalStates.length, 0);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.doesNotMatch(JSON.stringify({
      intents: state.executionIntents,
      observations: state.executionObservations,
      receipts: state.executionReceipts,
      finalizations: state.executionFinalizations,
      turns: state.codexTurns,
      operations: state.codexBackendOperations,
    }), /private Codex task input|SENTINEL RAW/u);
    const replay = await service.start(command);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replayed, true);
    assert.equal(fake.calls.length, 1);
    const beforeCancel = readApplicationStateForOwner(runtime.store);
    const currentTask = beforeCancel.domain.tasks[0];
    const currentExecution = beforeCancel.executions[0];
    const cancelled = await service.requestCancel({
      kind: "execution.cancel",
      projectId: command.projectId,
      expectedProjectResourceRevision: command.expectedProjectResourceRevision,
      expectedProjectConfigRevision: command.expectedProjectConfigRevision,
      taskId: command.taskId,
      expectedTaskRevision: currentTask.revision,
      inputReference: command.inputReference,
      executionId: command.executionId,
      expectedExecutionRevision: currentExecution.revision,
      expectedAttemptNumber: currentExecution.attemptNumber,
      expectedFencingToken: currentExecution.fencingToken,
      idempotencyKey: "codex-cancel-terminal",
      policyBindingReference: command.policyBindingReference,
      requestedDeadline: command.requestedDeadline,
      backendExecutionId: result.value.backendExecutionId,
      threadId: result.value.threadId,
      expectedLifecycle: "turn_succeeded",
      reasonCode: "operator_requested",
      lastObservationNumber: result.value.observationNumber,
      workspace: runtime.workspaceContext,
    });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    assert.equal(cancelled.value.lifecycle, "turn_succeeded");
    assert.equal(cancelled.value.taskState, "running");
    assert.equal(cancelled.value.waiting, null);
    const afterCancel = readApplicationStateForOwner(runtime.store);
    assert.equal(afterCancel.executionTerminalStates.length, 0);
    assert.equal(afterCancel.codexTurns[0].cancellationRequestedAt, null);
    assert.equal(afterCancel.codexBackendOperations.length, 1);
    const cancelIntent = afterCancel.executionIntents.find((candidate) =>
      candidate.idempotencyKey === "codex-cancel-terminal"
    );
    assert.equal(cancelIntent?.operationKind, "request_cancel");
    assert.equal(cancelIntent?.state, "finalized");
    assert.equal(afterCancel.executionObservations.some((candidate) => candidate.intentId === cancelIntent?.intentId), true);
    assert.equal(afterCancel.executionReceipts.some((candidate) => candidate.intentId === cancelIntent?.intentId), true);
    assert.equal(afterCancel.executionFinalizations.some((candidate) => candidate.intentId === cancelIntent?.intentId), true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex turn.failed is durably observed as waiting failure without completing the execution", async () => {
  const runtime = await prepareRuntime("codex-loop-terminal-failed");
  try {
    const fake = backendFor(runtime, "failed");
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const command = startCommand(
      readApplicationStateForOwner(runtime.store),
      runtime.workspaceContext,
      "codex-terminal-failed",
    );
    const result = await service.start(command);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.lifecycle, "failed");
    assert.equal(result.value.taskState, "waiting");
    assert.equal(result.value.waiting?.reason, "execution_failed");
    assert.equal(result.value.waiting?.requiredAction, "execution.retry");
    assert.equal(fake.calls.length, 1);

    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(state.codexTurns[0].lifecycle, "failed");
    assert.equal(state.codexTurns[0].terminalSignal, "turn.failed");
    assert.equal(state.codexBackendOperations.length, 1);
    assert.equal(state.codexBackendOperations[0].resultLifecycle, "failed");
    assert.equal(state.executionTerminalStates.length, 0);
    assert.equal(state.domain.tasks[0].state, "waiting");

    const evidenceCounts = Object.freeze({
      intents: state.executionIntents.length,
      observations: state.executionObservations.length,
      receipts: state.executionReceipts.length,
      finalizations: state.executionFinalizations.length,
    });
    const currentTask = state.domain.tasks[0];
    const currentExecution = state.executions[0];
    const inspected = await service.inspect({
      kind: "execution.inspect",
      projectId: command.projectId,
      expectedProjectResourceRevision: command.expectedProjectResourceRevision,
      expectedProjectConfigRevision: command.expectedProjectConfigRevision,
      taskId: command.taskId,
      expectedTaskRevision: currentTask.revision,
      inputReference: command.inputReference,
      executionId: command.executionId,
      expectedExecutionRevision: currentExecution.revision,
      expectedAttemptNumber: currentExecution.attemptNumber,
      expectedFencingToken: currentExecution.fencingToken,
      idempotencyKey: "codex-terminal-failed-inspect",
      policyBindingReference: command.policyBindingReference,
      requestedDeadline: command.requestedDeadline,
      backendExecutionId: result.value.backendExecutionId,
      threadId: result.value.threadId,
      lastObservationNumber: result.value.observationNumber,
      workspace: runtime.workspaceContext,
    });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.lifecycle, "failed");
    assert.equal(inspected.value.taskState, "waiting");
    assert.equal(fake.calls.length, 1);
    const afterInspect = readApplicationStateForOwner(runtime.store);
    const inspectIntent = afterInspect.executionIntents.find((candidate) =>
      candidate.idempotencyKey === "codex-terminal-failed-inspect"
    );
    assert.equal(inspectIntent?.operationKind, "inspect");
    assert.equal(inspectIntent?.state, "finalized");
    assert.equal(afterInspect.executionIntents.length, evidenceCounts.intents + 1);
    assert.equal(afterInspect.executionObservations.length, evidenceCounts.observations + 1);
    assert.equal(afterInspect.executionReceipts.length, evidenceCounts.receipts + 1);
    assert.equal(afterInspect.executionFinalizations.length, evidenceCounts.finalizations + 1);
    assert.equal(afterInspect.executionObservations.some((candidate) => candidate.intentId === inspectIntent?.intentId), true);
    assert.equal(afterInspect.executionReceipts.some((candidate) => candidate.intentId === inspectIntent?.intentId), true);
    assert.equal(afterInspect.executionFinalizations.some((candidate) => candidate.intentId === inspectIntent?.intentId), true);

    const beforeCancel = Object.freeze({
      intents: afterInspect.executionIntents.length,
      observations: afterInspect.executionObservations.length,
      receipts: afterInspect.executionReceipts.length,
      finalizations: afterInspect.executionFinalizations.length,
      operations: afterInspect.codexBackendOperations.length,
      turnRevision: afterInspect.codexTurns[0].revision,
    });
    const waitingTask = afterInspect.domain.tasks[0];
    const waitingExecution = afterInspect.executions[0];
    const cancelled = await service.requestCancel({
      kind: "execution.cancel",
      projectId: command.projectId,
      expectedProjectResourceRevision: command.expectedProjectResourceRevision,
      expectedProjectConfigRevision: command.expectedProjectConfigRevision,
      taskId: command.taskId,
      expectedTaskRevision: waitingTask.revision,
      inputReference: command.inputReference,
      executionId: command.executionId,
      expectedExecutionRevision: waitingExecution.revision,
      expectedAttemptNumber: waitingExecution.attemptNumber,
      expectedFencingToken: waitingExecution.fencingToken,
      idempotencyKey: "codex-terminal-failed-cancel",
      policyBindingReference: command.policyBindingReference,
      requestedDeadline: command.requestedDeadline,
      backendExecutionId: result.value.backendExecutionId,
      threadId: result.value.threadId,
      expectedLifecycle: "failed",
      reasonCode: "operator_requested",
      lastObservationNumber: result.value.observationNumber,
      workspace: runtime.workspaceContext,
    });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    assert.equal(cancelled.value.lifecycle, "failed");
    assert.equal(cancelled.value.taskState, "waiting");
    assert.equal(cancelled.value.waiting?.reason, "execution_failed");
    const afterCancel = readApplicationStateForOwner(runtime.store);
    const cancelIntent = afterCancel.executionIntents.find((candidate) =>
      candidate.idempotencyKey === "codex-terminal-failed-cancel"
    );
    assert.equal(cancelIntent?.state, "finalized");
    assert.equal(afterCancel.codexTurns[0].revision, beforeCancel.turnRevision);
    assert.equal(afterCancel.codexTurns[0].cancellationRequestedAt, null);
    assert.equal(afterCancel.codexBackendOperations.length, beforeCancel.operations);
    assert.equal(afterCancel.executionIntents.length, beforeCancel.intents + 1);
    assert.equal(afterCancel.executionObservations.length, beforeCancel.observations + 1);
    assert.equal(afterCancel.executionReceipts.length, beforeCancel.receipts + 1);
    assert.equal(afterCancel.executionFinalizations.length, beforeCancel.finalizations + 1);
    assert.equal(afterCancel.executionObservations.some((candidate) => candidate.intentId === cancelIntent?.intentId), true);
    assert.equal(afterCancel.executionReceipts.some((candidate) => candidate.intentId === cancelIntent?.intentId), true);
    assert.equal(afterCancel.executionFinalizations.some((candidate) => candidate.intentId === cancelIntent?.intentId), true);

    const replay = await service.start(command);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replayed, true);
    assert.equal(replay.value.lifecycle, "failed");
    assert.equal(fake.calls.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex inspect refusal cannot replay an earlier terminal success as fresh evidence", async () => {
  const runtime = await prepareRuntime("codex-loop-inspect-refused");
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const command = startCommand(
      readApplicationStateForOwner(runtime.store),
      runtime.workspaceContext,
      "codex-inspect-origin",
    );
    const started = await service.start(command);
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(started.value.lifecycle, "turn_succeeded");
    const before = readApplicationStateForOwner(runtime.store);
    const evidenceCounts = Object.freeze({
      observations: before.executionObservations.length,
      receipts: before.executionReceipts.length,
      finalizations: before.executionFinalizations.length,
    });
    fake.setInspectRefused(true);

    const currentTask = before.domain.tasks[0];
    const currentExecution = before.executions[0];
    const inspected = await service.inspect({
      kind: "execution.inspect",
      projectId: command.projectId,
      expectedProjectResourceRevision: command.expectedProjectResourceRevision,
      expectedProjectConfigRevision: command.expectedProjectConfigRevision,
      taskId: command.taskId,
      expectedTaskRevision: currentTask.revision,
      inputReference: command.inputReference,
      executionId: command.executionId,
      expectedExecutionRevision: currentExecution.revision,
      expectedAttemptNumber: currentExecution.attemptNumber,
      expectedFencingToken: currentExecution.fencingToken,
      idempotencyKey: "codex-inspect-refused",
      policyBindingReference: command.policyBindingReference,
      requestedDeadline: command.requestedDeadline,
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      lastObservationNumber: started.value.observationNumber,
      workspace: runtime.workspaceContext,
    });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.lifecycle, "ambiguous");
    assert.equal(inspected.value.taskState, "waiting");
    const after = readApplicationStateForOwner(runtime.store);
    const inspectIntent = after.executionIntents.find((candidate) => candidate.idempotencyKey === "codex-inspect-refused");
    assert.equal(inspectIntent?.state, "finalized");
    assert.equal(inspectIntent?.lastErrorAmbiguous, true);
    assert.equal(after.executionObservations.length, evidenceCounts.observations);
    assert.equal(after.executionReceipts.length, evidenceCounts.receipts);
    assert.equal(after.executionFinalizations.length, evidenceCounts.finalizations + 1);
    assert.equal(after.executionFinalizations.some((candidate) => candidate.intentId === inspectIntent?.intentId), true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("one execution cannot acquire both Codex and Manual backend turns", async () => {
  const codexFirst = await prepareRuntime("codex-loop-cross-family-codex-first");
  try {
    const fake = backendFor(codexFirst);
    const codex = createInjectedCodexReliableExecutionService(codexFirst.store, codexFirst.trusted, fake.backend);
    const codexCommand = startCommand(
      readApplicationStateForOwner(codexFirst.store),
      codexFirst.workspaceContext,
      "codex-first",
    );
    const started = await codex.start(codexCommand);
    assert.equal(started.ok, true, JSON.stringify(started));
    const manualBackend = createManualExecutionBackend(codexFirst.store, { ingress: codexFirst.trusted });
    const manual = createReliableExecutionService(codexFirst.store, codexFirst.trusted, manualBackend, manualBackend);
    const { workspace: _workspace, ...manualCommand } = startCommand(
      readApplicationStateForOwner(codexFirst.store),
      codexFirst.workspaceContext,
      "manual-after-codex",
    );
    const refused = manual.start(manualCommand);
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "IDEMPOTENCY_CONFLICT");
    const state = readApplicationStateForOwner(codexFirst.store);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(state.manualTurns.length, 0);
  } finally {
    await codexFirst.store.close();
    cleanupPersistenceFixture(codexFirst.fixture);
  }

  const manualFirst = await prepareRuntime("codex-loop-cross-family-manual-first");
  try {
    const manualBackend = createManualExecutionBackend(manualFirst.store, { ingress: manualFirst.trusted });
    const manual = createReliableExecutionService(manualFirst.store, manualFirst.trusted, manualBackend, manualBackend);
    const { workspace: _workspace, ...manualCommand } = startCommand(
      readApplicationStateForOwner(manualFirst.store),
      manualFirst.workspaceContext,
      "manual-first",
    );
    const started = manual.start(manualCommand);
    assert.equal(started.ok, true, JSON.stringify(started));
    const fake = backendFor(manualFirst);
    const codex = createInjectedCodexReliableExecutionService(manualFirst.store, manualFirst.trusted, fake.backend);
    const refused = await codex.start(startCommand(
      readApplicationStateForOwner(manualFirst.store),
      manualFirst.workspaceContext,
      "codex-after-manual",
    ));
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "IDEMPOTENCY_CONFLICT");
    const state = readApplicationStateForOwner(manualFirst.store);
    assert.equal(state.manualTurns.length, 1);
    assert.equal(state.codexTurns.length, 0);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.verifierCalls.length, 0);
  } finally {
    await manualFirst.store.close();
    cleanupPersistenceFixture(manualFirst.fixture);
  }
});

test("unproved Codex response loss becomes durable ambiguity and is never replayed blindly", async () => {
  const runtime = await prepareRuntime("codex-loop-unproved");
  try {
    const fake = backendFor(runtime, "unproved");
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const command = startCommand(readApplicationStateForOwner(runtime.store), runtime.workspaceContext, "codex-unproved");
    const first = await service.start(command);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.value.lifecycle, "ambiguous");
    assert.equal(first.value.taskState, "waiting");
    assert.equal(fake.calls.length, 1);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(state.codexTurns[0].lifecycle, "unknown");
    assert.equal(state.codexBackendOperations.length, 0);
    assert.doesNotMatch(JSON.stringify(state), /SENTINEL RAW SDK ERROR/u);
    const replay = await service.start(command);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.lifecycle, "ambiguous");
    assert.equal(fake.calls.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex v2 evidence survives verified backup and restart without repeating the SDK effect", async () => {
  const runtime = await prepareRuntime("codex-loop-restart-backup");
  let store = runtime.store;
  try {
    const firstFake = backendFor(runtime);
    const firstService = createInjectedCodexReliableExecutionService(store, runtime.trusted, firstFake.backend);
    const command = startCommand(readApplicationStateForOwner(store), runtime.workspaceContext, "codex-restart");
    const first = await firstService.start(command);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.value.lifecycle, "turn_succeeded");
    assert.equal(firstFake.calls.length, 1);

    const backup = await createAuthorizedTestBackup(store);
    assert.equal(verifyBackupGeneration(runtime.fixture.layout, backup.generationId).generationId, backup.generationId);
    const beforeRestart = readApplicationStateForOwner(store);
    assert.equal(beforeRestart.codexTurns.length, 1);
    assert.equal(beforeRestart.codexBackendOperations.length, 1);
    await store.close();

    store = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep03d-test-restart" });
    const afterRestart = readApplicationStateForOwner(store);
    assert.deepEqual(afterRestart.codexTurns, beforeRestart.codexTurns);
    assert.deepEqual(afterRestart.codexBackendOperations, beforeRestart.codexBackendOperations);
    const restartedFake = backendFor({ ...runtime, store });
    const restartedService = createInjectedCodexReliableExecutionService(store, runtime.trusted, restartedFake.backend);
    const replay = await restartedService.start(command);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replayed, true);
    assert.equal(restartedFake.calls.length, 0);
  } finally {
    await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("combined persistence decode refuses corrupted Codex thread-to-terminal linkage", async () => {
  const runtime = await prepareRuntime("codex-loop-corrupt-linkage");
  let store = runtime.store;
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(store, runtime.trusted, fake.backend);
    const command = startCommand(readApplicationStateForOwner(store), runtime.workspaceContext, "codex-corrupt-linkage");
    assert.equal((await service.start(command)).ok, true);
    await store.close();
    store = null;

    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      database.exec("PRAGMA foreign_keys=OFF");
      database.exec("DROP TRIGGER codex_backend_turns_update_guard");
      database.prepare("UPDATE codex_backend_turns SET thread_id='forged-thread' WHERE lifecycle='turn_succeeded'").run();
      assert.throws(
        () => readApplicationState(database),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      database.close();
    }
  } finally {
    if (store !== null) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("combined persistence decode refuses a dangling Codex predecessor linkage", async () => {
  const runtime = await prepareRuntime("codex-loop-corrupt-predecessor");
  let store = runtime.store;
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const command = startCommand(
      readApplicationStateForOwner(runtime.store),
      runtime.workspaceContext,
      "codex-corrupt-predecessor",
    );
    assert.equal((await service.start(command)).ok, true);
    await store.close();
    store = null;

    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      database.exec("PRAGMA foreign_keys=OFF");
      database.exec("DROP TRIGGER codex_backend_turns_update_guard");
      database.prepare(
        "UPDATE codex_backend_turns SET predecessor_backend_execution_id='missing-backend', predecessor_thread_id='missing-thread'",
      ).run();
      assert.throws(
        () => readApplicationState(database),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      database.close();
    }
  } finally {
    if (store !== null) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("combined persistence decode refuses cross-family ownership of one execution", async () => {
  const runtime = await prepareRuntime("codex-loop-corrupt-cross-family");
  let store = runtime.store;
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(store, runtime.trusted, fake.backend);
    const command = startCommand(readApplicationStateForOwner(store), runtime.workspaceContext, "codex-cross-family");
    assert.equal((await service.start(command)).ok, true);
    await store.close();
    store = null;

    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      database.prepare(`
        INSERT INTO manual_backend_turns (
          backend_execution_id, thread_id, start_idempotency_key,
          project_id, project_resource_revision, project_config_revision,
          task_id, task_revision, input_reference, execution_id, execution_revision,
          attempt_number, fencing_token, predecessor_backend_execution_id, predecessor_thread_id,
          policy_binding_reference, workspace_mode, lifecycle,
          cancellation_request_revision, cancellation_requested_at, code, evidence_reference,
          last_report_id, revision, created_at, updated_at
        )
        SELECT
          'shadow-manual-backend', 'shadow-manual-thread', 'shadow-manual-start',
          project_id, project_resource_revision, project_config_revision,
          task_id, task_revision, input_reference, execution_id, execution_revision,
          attempt_number, fencing_token, NULL, NULL,
          policy_binding_reference, 'none', 'queued',
          NULL, NULL, 'manual_turn_queued', NULL,
          NULL, 1, created_at, updated_at
        FROM codex_backend_turns
        LIMIT 1
      `).run();
      assert.throws(
        () => readApplicationState(database),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      database.close();
    }
  } finally {
    if (store !== null) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("combined persistence decode recomputes Codex terminal receipt identity and digest", async () => {
  const runtime = await prepareRuntime("codex-loop-corrupt-receipt");
  let store = runtime.store;
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(store, runtime.trusted, fake.backend);
    const command = startCommand(readApplicationStateForOwner(store), runtime.workspaceContext, "codex-corrupt-receipt");
    assert.equal((await service.start(command)).ok, true);
    await store.close();
    store = null;

    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      database.exec("DROP TRIGGER codex_backend_operations_no_update");
      const original = database.prepare(
        "SELECT receipt_id, receipt_sha256 FROM codex_backend_operations LIMIT 1",
      ).get();
      for (const [column, value] of [
        ["receipt_id", "forged-codex-receipt"],
        ["receipt_sha256", "B".repeat(64)],
      ]) {
        try {
          database.prepare(`UPDATE codex_backend_operations SET ${column}=?`).run(value);
          assert.throws(
            () => readApplicationState(database),
            (error) => expectPersistenceError(error, "CORRUPT_ROW"),
          );
        } finally {
          database.prepare(`UPDATE codex_backend_operations SET ${column}=?`).run(original[column]);
        }
      }
    } finally {
      database.close();
    }
  } finally {
    if (store !== null) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("execution intent SQL guard rejects Codex backend and workspace tuple rewrites", async () => {
  const runtime = await prepareRuntime("codex-loop-intent-guard");
  let store = runtime.store;
  try {
    const fake = backendFor(runtime);
    let interrupted = false;
    const service = createInjectedCodexReliableExecutionService(
      store,
      runtime.trusted,
      fake.backend,
      Object.freeze({
        afterStage(stage) {
          if (!interrupted && stage === "executing") {
            interrupted = true;
            throw new Error("stop at executing intent");
          }
        },
      }),
    );
    const command = startCommand(readApplicationStateForOwner(store), runtime.workspaceContext, "codex-intent-guard");
    const stopped = await service.start(command);
    assert.equal(stopped.ok, false);
    assert.equal(stopped.error.code, "PERSISTENCE_FAILURE");
    assert.equal(interrupted, true);
    const intent = readApplicationStateForOwner(store).executionIntents.find((candidate) =>
      candidate.idempotencyKey === command.idempotencyKey
    );
    assert.equal(intent?.state, "executing");
    await store.close();
    store = null;

    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      const legal = database.prepare(`
        UPDATE execution_operation_intents
        SET state='finalized', updated_at='2099-01-01T00:00:00.000Z', revision=revision+1
        WHERE intent_id=?
      `);
      database.exec("SAVEPOINT legal_intent_transition");
      assert.equal(legal.run(intent.intentId).changes, 1);
      database.exec("ROLLBACK TO legal_intent_transition; RELEASE legal_intent_transition");

      const rewrites = [
        "backend_kind='manual-local', workspace_mode='none', workspace_contract_id=NULL, workspace_id=NULL, workspace_generation=NULL, workspace_revision=NULL, workspace_root_key=NULL, ownership_binding_sha256=NULL, workspace_head_object_id=NULL",
        "workspace_id='forged-workspace'",
        "workspace_generation=workspace_generation+1",
        "workspace_revision=workspace_revision+1",
        "workspace_root_key='forged-root'",
        `ownership_binding_sha256='${"B".repeat(64)}'`,
        `workspace_head_object_id='${"c".repeat(40)}'`,
      ];
      for (const [index, rewrite] of rewrites.entries()) {
        assert.throws(() => database.prepare(`
          UPDATE execution_operation_intents
          SET state='finalized', updated_at='2099-01-01T00:00:00.000Z', revision=revision+1, ${rewrite}
          WHERE intent_id=?
        `).run(intent.intentId), /execution intent transition is not one exact CAS step/u, `rewrite ${index} must be refused`);
      }
    } finally {
      database.close();
    }
  } finally {
    if (store !== null) await store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const crashStage of [
  "executing",
  "adapter-effect",
  "independent-inspect",
  "observed",
  "receipt",
  "verified",
  "finalized",
]) {
  test(`Codex restart converges after the durable ${crashStage} boundary without duplicate effect`, async () => {
    const runtime = await prepareRuntime(`codex-crash-${crashStage}`);
    let store = runtime.store;
    try {
      const firstFake = backendFor(runtime);
      let injected = false;
      const crashingService = createInjectedCodexReliableExecutionService(
        store,
        runtime.trusted,
        firstFake.backend,
        Object.freeze({
          afterStage(stage) {
            if (!injected && stage === crashStage) {
              injected = true;
              throw new Error(`injected crash after ${crashStage}`);
            }
          },
        }),
      );
      const command = startCommand(
        readApplicationStateForOwner(store),
        runtime.workspaceContext,
        `codex-crash-${crashStage}`,
      );
      const interrupted = await crashingService.start(command);
      assert.equal(injected, true);
      assert.equal(interrupted.ok, false);
      assert.equal(interrupted.error.code, "PERSISTENCE_FAILURE");
      assert.equal(firstFake.calls.length, crashStage === "executing" ? 0 : 1);
      await store.close();

      store = await openPersistence(runtime.fixture.layout, { applicationVersion: `ep03d-restart-${crashStage}` });
      const restartedFake = backendFor({ ...runtime, store });
      const restartedService = createInjectedCodexReliableExecutionService(store, runtime.trusted, restartedFake.backend);
      const recovered = await restartedService.start(command);
      assert.equal(recovered.ok, true, JSON.stringify(recovered));
      assert.equal(recovered.value.lifecycle, "turn_succeeded");
      assert.equal(restartedFake.calls.length, crashStage === "executing" ? 1 : 0);
      const final = readApplicationStateForOwner(store);
      assert.equal(final.codexTurns.length, 1);
      assert.equal(final.codexBackendOperations.length, 1);
      assert.equal(final.executionFinalizations.filter((candidate) => candidate.intentId ===
        final.executionIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey)?.intentId).length, 1);
    } finally {
      await store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

test("Codex commands reject mismatched Task digests before durable intent or SDK access", async () => {
  const runtime = await prepareRuntime("codex-loop-input-refusal");
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const intentCount = readApplicationStateForOwner(runtime.store).executionIntents.length;
    const valid = startCommand(readApplicationStateForOwner(runtime.store), runtime.workspaceContext);
    const refused = await service.start({ ...valid, inputReference: `task-sha256:${"0".repeat(64)}` });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "INVALID_INPUT");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executionIntents.length, intentCount);
    assert.equal(state.codexTurns.length, 0);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.verifierCalls.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex commands reject a stale fence before durable intent, workspace verification, or SDK access", async () => {
  const runtime = await prepareRuntime("codex-loop-stale-fence");
  try {
    const fake = backendFor(runtime);
    const service = createInjectedCodexReliableExecutionService(runtime.store, runtime.trusted, fake.backend);
    const before = readApplicationStateForOwner(runtime.store);
    const valid = startCommand(before, runtime.workspaceContext, "codex-stale-fence");
    const refused = await service.start({
      ...valid,
      expectedFencingToken: valid.expectedFencingToken + 1,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "STALE_FENCE");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.executionIntents.length, before.executionIntents.length);
    assert.equal(state.codexTurns.length, 0);
    assert.equal(state.codexBackendOperations.length, 0);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.verifierCalls.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
