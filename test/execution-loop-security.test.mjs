import assert from "node:assert/strict";
import { copyFileSync } from "node:fs";
import test from "node:test";
import {
  EXECUTION_CONTRACT_ID,
  MANUAL_OUTCOME_CONTROL_ID,
  createApplicationService,
  createExecutionApplicationService,
  createManualExecutionBackend,
  createReliableExecutionService,
  createReliableExecutionServiceWithHooks,
  openPersistence,
} from "../src/index.ts";
import { validateTrustedRuntimeAndActor } from "../src/execution-application.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { canonicalJson, sha256 } from "../src/persistence/values.ts";
import { cleanupPersistenceFixture, createPersistenceFixture } from "./persistence-test-helpers.mjs";

const ACTOR = "local_manual_operator";
const PRINCIPAL = "A".repeat(64);
const EXPIRY = "2026-09-20T12:00:00.000Z";
const SENTINEL = "PROMPT_SECRET C:\\private\\token.env SELECT * FROM credentials Error: stack";

function poisonServiceCounters() {
  const counts = { ingress: 0, adapter: 0, accessor: 0 };
  const store = new Proxy({}, {
    get() {
      throw new Error("persistence must not be touched");
    },
  });
  const ingress = Object.freeze({
    currentActor() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    currentLeaseOwner() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    now() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    nextId() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
    confirmOperation() { counts.ingress += 1; throw new Error("ingress must not be touched"); },
  });
  const adapter = Object.freeze({
    contractId: EXECUTION_CONTRACT_ID,
    outcomeContractId: MANUAL_OUTCOME_CONTROL_ID,
    adapterId: "poison-adapter",
    adapterVersion: "1.0.0",
    start() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    resume() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    inspect() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    requestCancel() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
    recordOutcome() { counts.adapter += 1; throw new Error("adapter must not be touched"); },
  });
  return { counts, service: createReliableExecutionService(store, ingress, adapter, adapter) };
}

function assertInvalid(result) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_INPUT");
  assert.equal(result.requestId, null);
  assert.equal(result.correlationId, null);
}

test("malformed, overlong, accessor, proxy, path, prompt, credential, SQL, and stack-shaped commands stop before ingress", () => {
  const { counts, service } = poisonServiceCounters();
  const operations = [
    () => service.start({}),
    () => service.inspect({ kind: "execution.start" }),
    () => service.resume({ kind: "execution.resume", unexpected: true }),
    () => service.retry({ kind: "execution.retry", idempotencyKey: "x".repeat(129) }),
    () => service.requestCancel({ kind: "execution.cancel", reasonCode: SENTINEL }),
    () => service.recordManualOutcome({ kind: "manual.turn.report", evidenceReference: SENTINEL }),
    () => service.acceptManualCompletion({ kind: "execution.completion.accept", inputReference: SENTINEL }),
    () => service.reconcile({ kind: "execution.inspect", policyBindingReference: SENTINEL }),
  ];
  for (const operation of operations) assertInvalid(operation());

  const accessor = {};
  Object.defineProperty(accessor, "kind", {
    enumerable: true,
    get() {
      counts.accessor += 1;
      return "execution.start";
    },
  });
  assertInvalid(service.start(accessor));
  assert.equal(counts.accessor, 0);
  const hostileProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error(SENTINEL);
    },
  });
  assertInvalid(service.start(hostileProxy));
  assert.deepEqual(counts, { ingress: 0, adapter: 0, accessor: 0 });
});

function trustedIngress(label) {
  let sequence = 0;
  let now = "2026-08-30T12:00:00.000Z";
  let actorId = ACTOR;
  let principal = PRINCIPAL;
  let operationConfirmation = true;
  return {
    currentActor: () => ({ actorId, principal }),
    currentLeaseOwner: () => "worker-security",
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => operationConfirmation
      ? ({ confirmationId: `confirmation-${label}-${action}-${++sequence}` }) : null,
    setNow(value) { now = value; },
    setActor(value) { actorId = value; },
    setPrincipal(value) { principal = value; },
    setOperationConfirmation(value) { operationConfirmation = value; },
  };
}

async function prepareRuntime(prefix) {
  const fixture = createPersistenceFixture(prefix);
  const ingress = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep02b-security" });
  const application = createApplicationService(store, ingress);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: SENTINEL, supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  ingress.setNow("2026-08-30T12:00:01.000Z");
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  ingress.setNow("2026-08-30T12:00:02.000Z");
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY }).ok, true);
  ingress.setNow("2026-08-30T12:00:03.000Z");
  const claim = createExecutionApplicationService(store, ingress).claim({
    kind: "execution.claim", projectId: "project", expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1, taskId: "task", expectedTaskRevision: 2,
    idempotencyKey: `claim-${prefix}`, leaseDurationSeconds: 300,
  });
  assert.equal(claim.ok, true, JSON.stringify(claim));
  ingress.setNow("2026-08-30T12:00:04.000Z");
  return { fixture, ingress, store, claim, application };
}

function startCommand(executionId, key = "security-start-key") {
  return Object.freeze({
    kind: "execution.start",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId: "task",
    expectedTaskRevision: 3,
    inputReference: "input-ref",
    executionId,
    expectedExecutionRevision: 1,
    expectedAttemptNumber: 1,
    expectedFencingToken: 1,
    idempotencyKey: key,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
  });
}

function manualOutcomeCommand(started, key = "security-outcome-key") {
  return Object.freeze({
    kind: "manual.turn.report",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId: "task",
    expectedTaskRevision: 3,
    inputReference: "input-ref",
    executionId: started.executionId,
    expectedExecutionRevision: 1,
    expectedAttemptNumber: 1,
    expectedFencingToken: 1,
    idempotencyKey: key,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
    reportId: `report-${key}`,
    backendExecutionId: started.backendExecutionId,
    threadId: started.threadId,
    expectedJournalRevision: 1,
    expectedLifecycle: "queued",
    outcomeOperation: "activate",
    code: "manual_activated",
    evidenceReference: `${key}-evidence-ref`,
    lastObservationNumber: 1,
  });
}

function inspectCommand(started, key = "security-inspect-key") {
  return Object.freeze({
    kind: "execution.inspect",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId: "task",
    expectedTaskRevision: 3,
    inputReference: "input-ref",
    executionId: started.executionId,
    expectedExecutionRevision: 1,
    expectedAttemptNumber: 1,
    expectedFencingToken: 1,
    idempotencyKey: key,
    policyBindingReference: "policy-ref",
    requestedDeadline: "2026-08-30T12:04:00.000Z",
    backendExecutionId: started.backendExecutionId,
    threadId: started.threadId,
    lastObservationNumber: 1,
  });
}

test("wrong actor and missing named confirmation cannot invoke the Manual writer or mutate Task/turn state", async () => {
  const runtime = await prepareRuntime("execution-loop-security-denials");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    let outcomeCalls = 0;
    const countingControl = Object.freeze({
      outcomeContractId: manual.outcomeContractId,
      recordOutcome(request) {
        outcomeCalls += 1;
        return manual.recordOutcome(request);
      },
    });
    const service = createReliableExecutionService(runtime.store, runtime.ingress, manual, countingControl);
    const started = service.start(startCommand(runtime.claim.value.executionId));
    assert.equal(started.ok, true, JSON.stringify(started));
    runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
    const report = Object.freeze({
      kind: "manual.turn.report",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "security-report-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      reportId: "security-report",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      expectedJournalRevision: 1,
      expectedLifecycle: "queued",
      outcomeOperation: "activate",
      code: "manual_activated",
      evidenceReference: "security-evidence-ref",
      lastObservationNumber: 1,
    });
    const beforeWrongActor = structuredClone(readApplicationStateForOwner(runtime.store));
    runtime.ingress.setActor("intruder");
    const wrongActor = service.recordManualOutcome(report);
    assert.equal(wrongActor.ok, false);
    assert.equal(wrongActor.error.code, "AUTHORIZATION_DENIED");
    assert.equal(outcomeCalls, 0);
    const afterWrongActor = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(afterWrongActor.domain, beforeWrongActor.domain);
    assert.deepEqual(afterWrongActor.executions, beforeWrongActor.executions);
    assert.deepEqual(afterWrongActor.manualTurns, beforeWrongActor.manualTurns);
    assert.deepEqual(afterWrongActor.manualBackendOperations, beforeWrongActor.manualBackendOperations);
    assert.equal(afterWrongActor.executionIntents.length, beforeWrongActor.executionIntents.length);
    assert.equal(afterWrongActor.executionOperationRequests.length, beforeWrongActor.executionOperationRequests.length + 1);
    assert.equal(afterWrongActor.executionAuthorizationDecisions.find(
      (decision) => decision.requestId === wrongActor.requestId,
    )?.reason, "actor_mismatch");
    assert.equal(afterWrongActor.executionOperationAudit.find(
      (audit) => audit.requestId === wrongActor.requestId,
    )?.code, "actor_mismatch");

    runtime.ingress.setActor(ACTOR);
    runtime.ingress.setOperationConfirmation(false);
    const beforeUnconfirmed = readApplicationStateForOwner(runtime.store);
    const unconfirmed = service.recordManualOutcome(report);
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "CONFIRMATION_REQUIRED");
    assert.equal(outcomeCalls, 0);
    const afterUnconfirmed = readApplicationStateForOwner(runtime.store);
    assert.deepEqual(afterUnconfirmed.domain, beforeUnconfirmed.domain);
    assert.deepEqual(afterUnconfirmed.manualTurns, beforeUnconfirmed.manualTurns);
    assert.deepEqual(afterUnconfirmed.manualBackendOperations, beforeUnconfirmed.manualBackendOperations);
    assert.equal(afterUnconfirmed.executionIntents.length, beforeUnconfirmed.executionIntents.length);
    assert.equal(afterUnconfirmed.executionOperationRequests.length, beforeUnconfirmed.executionOperationRequests.length + 1);
    assert.equal(afterUnconfirmed.executionAuthorizationDecisions.find(
      (decision) => decision.requestId === unconfirmed.requestId,
    )?.result, "deny");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("fresh Act and Finalize authorization blocks revoked execution authority at every durable boundary", async (context) => {
  for (const boundary of ["prepared", "executing", "observed", "verified"]) {
    await context.test(`revoked after ${boundary}`, async () => {
      const runtime = await prepareRuntime(`execution-loop-fresh-authorization-${boundary}`);
      try {
        let manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
        let startCalls = 0;
        const countingBackend = Object.freeze({
          contractId: manual.contractId,
          adapterId: manual.adapterId,
          adapterVersion: manual.adapterVersion,
          start(request) { startCalls += 1; return manual.start(request); },
          resume: (request) => manual.resume(request),
          inspect: (request) => manual.inspect(request),
          requestCancel: (request) => manual.requestCancel(request),
        });
        const futureReplacement = runtime.application.execute({
          kind: "authorization.grant.issue",
          actorId: ACTOR,
          action: "execution.start",
          scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
          notBefore: "2026-08-30T12:00:05.000Z",
          expiresAt: EXPIRY,
        });
        assert.equal(futureReplacement.ok, true, JSON.stringify(futureReplacement));
        let revoked = false;
        const service = createReliableExecutionServiceWithHooks(
          runtime.store,
          runtime.ingress,
          countingBackend,
          manual,
          {
            afterStage(stage) {
              if (revoked || stage !== boundary) return;
              revoked = true;
              runtime.ingress.setNow("2026-08-30T12:00:04.500Z");
              const grant = readApplicationStateForOwner(runtime.store).grants.find(
                (candidate) => candidate.action === "execution.start" && candidate.revokedAt === null &&
                  candidate.grantId !== futureReplacement.value.grantId,
              );
              assert.ok(grant);
              const result = runtime.application.execute({
                kind: "authorization.grant.revoke",
                grantId: grant.grantId,
                expectedGrantRevision: grant.revision,
              });
              assert.equal(result.ok, true, JSON.stringify(result));
            },
          },
        );
        const command = startCommand(runtime.claim.value.executionId, `fresh-auth-${boundary}`);
        const result = service.start(command);
        assert.equal(revoked, true);
        assert.equal(result.ok, false, JSON.stringify(result));
        assert.equal(result.error.code, "AUTHORIZATION_DENIED");
        let state = readApplicationStateForOwner(runtime.store);
        assert.equal(startCalls, boundary === "observed" || boundary === "verified" ? 1 : 0);
        assert.equal(state.manualBackendOperations.length, startCalls);
        assert.equal(state.executionFinalizations.length, 0);
        assert.equal(state.executionTerminalStates.length, 0);
        assert.equal(state.domain.tasks[0].state, "running");

        await runtime.store.close();
        runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
        runtime.store = await openPersistence(runtime.fixture.layout, {
          applicationVersion: `ep02b-fresh-authorization-reopen-${boundary}`,
        });
        manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
        const recovered = createReliableExecutionService(
          runtime.store, runtime.ingress, countingBackend, manual,
        ).start(command);
        assert.equal(recovered.ok, true, `${boundary}:${JSON.stringify(recovered)}`);
        assert.equal(recovered.value.intentState, "finalized");
        state = readApplicationStateForOwner(runtime.store);
        assert.equal(startCalls, 1, boundary);
        assert.equal(state.manualBackendOperations.length, 1, boundary);
        assert.equal(state.executionFinalizations.length, 1, boundary);
        assert.equal(state.executionIntents[0].authorizationBindingRevision >= 3, true, boundary);
        assert.equal(new Set(state.executionAuthorizationDecisions.map(
          (decision) => decision.decisionId,
        )).size, state.executionAuthorizationDecisions.length, boundary);
      } finally {
        await runtime.store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
});

test("the reliable loop binds both trusted principal and persisted runtime-root identity before any effect", async () => {
  const runtime = await prepareRuntime("execution-loop-runtime-identity");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    let startCalls = 0;
    const backend = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) { startCalls += 1; return manual.start(request); },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const before = structuredClone(readApplicationStateForOwner(runtime.store));
    runtime.ingress.setPrincipal("B".repeat(64));
    const denied = createReliableExecutionService(runtime.store, runtime.ingress, backend, manual)
      .start(startCommand(runtime.claim.value.executionId, "identity-denied-key"));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(startCalls, 0);
    assert.deepEqual(readApplicationStateForOwner(runtime.store), before);

    const substitutedRootState = Object.freeze({
      ...before,
      bootstrap: Object.freeze({ ...before.bootstrap, rootKey: "substituted-runtime-root" }),
    });
    assert.deepEqual(
      validateTrustedRuntimeAndActor(
        substitutedRootState,
        Object.freeze({ actorId: ACTOR, principal: PRINCIPAL }),
        runtime.store,
      ),
      Object.freeze({ ok: false, reason: "runtime_root_mismatch" }),
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("finalized start and Manual outcome replay revalidate principal and runtime-root identity before result disclosure", async () => {
  const runtime = await prepareRuntime("execution-loop-finalized-replay-identity");
  const substituted = createPersistenceFixture("execution-loop-finalized-replay-substituted-root");
  let originalClosed = false;
  let substitutedStore;
  try {
    let manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const calls = { start: 0, inspect: 0, outcome: 0 };
    const backend = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) { calls.start += 1; return manual.start(request); },
      resume: (request) => manual.resume(request),
      inspect(request) { calls.inspect += 1; return manual.inspect(request); },
      requestCancel: (request) => manual.requestCancel(request),
    });
    const control = Object.freeze({
      outcomeContractId: manual.outcomeContractId,
      recordOutcome(request) { calls.outcome += 1; return manual.recordOutcome(request); },
    });
    let service = createReliableExecutionService(runtime.store, runtime.ingress, backend, control);
    const start = startCommand(runtime.claim.value.executionId, "finalized-replay-start-key");
    const started = service.start(start);
    assert.equal(started.ok, true, JSON.stringify(started));
    runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
    const report = manualOutcomeCommand(started.value, "finalized-replay-outcome-key");
    const reported = service.recordManualOutcome(report);
    assert.equal(reported.ok, true, JSON.stringify(reported));
    assert.equal(readApplicationStateForOwner(runtime.store).executionIntents.every(
      (intent) => intent.state === "finalized",
    ), true);
    const callsAfterFinalization = structuredClone(calls);
    const exactFinalizedState = structuredClone(readApplicationStateForOwner(runtime.store));

    runtime.ingress.setPrincipal("B".repeat(64));
    for (const denied of [service.start(start), service.recordManualOutcome(report)]) {
      assert.equal(denied.ok, false, JSON.stringify(denied));
      assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    }
    assert.deepEqual(calls, callsAfterFinalization);
    assert.deepEqual(readApplicationStateForOwner(runtime.store), exactFinalizedState);
    runtime.ingress.setPrincipal(PRINCIPAL);

    await runtime.store.close();
    originalClosed = true;
    copyFileSync(runtime.fixture.layout.databasePath, substituted.layout.databasePath);
    substitutedStore = await openPersistence(substituted.layout, {
      applicationVersion: "ep02b-finalized-replay-substituted-root",
    });
    manual = createManualExecutionBackend(substitutedStore, { ingress: runtime.ingress });
    service = createReliableExecutionService(substitutedStore, runtime.ingress, backend, control);
    const substitutedBefore = structuredClone(readApplicationStateForOwner(substitutedStore));
    for (const denied of [service.start(start), service.recordManualOutcome(report)]) {
      assert.equal(denied.ok, false, JSON.stringify(denied));
      assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    }
    assert.deepEqual(calls, callsAfterFinalization);
    assert.deepEqual(readApplicationStateForOwner(substitutedStore), substitutedBefore);
  } finally {
    if (!originalClosed) await runtime.store.close();
    if (substitutedStore !== undefined) await substitutedStore.close();
    cleanupPersistenceFixture(runtime.fixture);
    cleanupPersistenceFixture(substituted);
  }
});

test("independent inspection always consumes fresh current authority and can recover after a prior denial", async () => {
  const runtime = await prepareRuntime("execution-loop-fresh-inspection-authorization");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const started = createReliableExecutionService(runtime.store, runtime.ingress, manual, manual)
      .start(startCommand(runtime.claim.value.executionId, "inspection-auth-start-key"));
    assert.equal(started.ok, true, JSON.stringify(started));
    runtime.ingress.setNow("2026-08-30T12:00:04.100Z");
    let mode = "throw";
    const inspectionDecisionIds = [];
    const backend = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start: (request) => manual.start(request),
      resume: (request) => manual.resume(request),
      requestCancel: (request) => manual.requestCancel(request),
      inspect(request) {
        inspectionDecisionIds.push(request.authorizationDecisionId);
        if (mode === "throw") throw new Error("bounded inspection response loss");
        return manual.inspect(request);
      },
    });
    const command = inspectCommand(started.value, "fresh-inspection-auth-key");
    const futureReplacement = runtime.application.execute({
      kind: "authorization.grant.issue",
      actorId: ACTOR,
      action: "execution.inspect",
      scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
      notBefore: "2026-08-30T12:00:04.300Z",
      expiresAt: EXPIRY,
    });
    assert.equal(futureReplacement.ok, true, JSON.stringify(futureReplacement));
    let stoppedAfterFirstInspect = false;
    const first = createReliableExecutionServiceWithHooks(
      runtime.store,
      runtime.ingress,
      backend,
      manual,
      {
        afterStage(stage) {
          if (stage === "independent-inspect" && !stoppedAfterFirstInspect) {
            stoppedAfterFirstInspect = true;
            throw new Error("stop after independently authorized inspection");
          }
        },
      },
    ).inspect(command);
    assert.equal(first.ok, false, JSON.stringify(first));
    assert.equal(first.error.code, "PERSISTENCE_FAILURE");
    assert.equal(inspectionDecisionIds.length, 1);
    assert.equal(readApplicationStateForOwner(runtime.store).executionIntents.find(
      (intent) => intent.idempotencyKey === command.idempotencyKey,
    )?.state, "executing");

    runtime.ingress.setNow("2026-08-30T12:00:04.200Z");
    for (const grant of readApplicationStateForOwner(runtime.store).grants.filter(
      (candidate) => candidate.action === "execution.inspect" && candidate.revokedAt === null &&
        candidate.grantId !== futureReplacement.value.grantId,
    )) {
      const revoked = runtime.application.execute({
        kind: "authorization.grant.revoke",
        grantId: grant.grantId,
        expectedGrantRevision: grant.revision,
      });
      assert.equal(revoked.ok, true, JSON.stringify(revoked));
    }
    const beforeDeniedIds = new Set(readApplicationStateForOwner(runtime.store).executionAuthorizationDecisions.map(
      (decision) => decision.decisionId,
    ));
    let stoppedAfterDeniedInspect = false;
    const denied = createReliableExecutionServiceWithHooks(
      runtime.store,
      runtime.ingress,
      backend,
      manual,
      {
        afterStage(stage) {
          if (stage === "recovery-inspected" && !stoppedAfterDeniedInspect) {
            stoppedAfterDeniedInspect = true;
            throw new Error("stop after denied inspection authorization");
          }
        },
      },
    ).inspect(command);
    assert.equal(denied.ok, false, JSON.stringify(denied));
    assert.equal(denied.error.code, "PERSISTENCE_FAILURE");
    assert.equal(inspectionDecisionIds.length, 1);
    const deniedDecisions = readApplicationStateForOwner(runtime.store).executionAuthorizationDecisions.filter(
      (decision) => !beforeDeniedIds.has(decision.decisionId),
    );
    assert.equal(deniedDecisions.length, 1);
    assert.equal(deniedDecisions[0].action, "execution.inspect");
    assert.equal(deniedDecisions[0].result, "deny");

    runtime.ingress.setNow("2026-08-30T12:00:04.300Z");
    mode = "manual";
    const recovered = createReliableExecutionService(runtime.store, runtime.ingress, backend, manual).inspect(command);
    assert.equal(recovered.ok, true, JSON.stringify(recovered));
    assert.equal(recovered.value.intentState, "finalized");
    assert.equal(inspectionDecisionIds.length, 2);
    assert.notEqual(inspectionDecisionIds[1], inspectionDecisionIds[0]);
    const state = readApplicationStateForOwner(runtime.store);
    const intent = state.executionIntents.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
    assert.ok(intent);
    assert.equal(state.executionObservations.find(
      (observation) => observation.intentId === intent.intentId,
    )?.authorizationDecisionId, inspectionDecisionIds[1]);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("a syntactically valid forged inspect receipt cannot fabricate verified cancellation", async () => {
  const runtime = await prepareRuntime("execution-loop-forged-inspect");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const trustedService = createReliableExecutionService(runtime.store, runtime.ingress, manual, manual);
    const started = trustedService.start(startCommand(runtime.claim.value.executionId, "forged-start-key"));
    assert.equal(started.ok, true, JSON.stringify(started));
    runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
    const forged = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start: (request) => manual.start(request),
      resume: (request) => manual.resume(request),
      requestCancel: (request) => manual.requestCancel(request),
      inspect(request) {
        const result = manual.inspect(request);
        if (!result.ok) return result;
        const { integritySha256: _ignored, ...receipt } = result.receipt;
        const projection = Object.freeze({
          ...receipt,
          lifecycle: "cancelled",
          code: "forged_cancelled",
          evidenceReference: "forged-evidence",
          resultReference: "forged-evidence",
        });
        return Object.freeze({
          ok: true,
          receipt: Object.freeze({ ...projection, integritySha256: sha256(canonicalJson(projection)) }),
        });
      },
    });
    const inspected = createReliableExecutionService(runtime.store, runtime.ingress, forged, manual).inspect({
      kind: "execution.inspect",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      inputReference: "input-ref",
      executionId: runtime.claim.value.executionId,
      expectedExecutionRevision: 1,
      expectedAttemptNumber: 1,
      expectedFencingToken: 1,
      idempotencyKey: "forged-inspect-key",
      policyBindingReference: "policy-ref",
      requestedDeadline: "2026-08-30T12:04:00.000Z",
      backendExecutionId: started.value.backendExecutionId,
      threadId: started.value.threadId,
      lastObservationNumber: 1,
    });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.lifecycle, "ambiguous");
    assert.equal(inspected.value.taskState, "waiting");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "waiting");
    assert.equal(state.manualTurns[0].lifecycle, "queued");
    assert.equal(state.executionTerminalStates.length, 0);
    assert.equal(state.executionObservations.some((candidate) => candidate.lifecycle === "cancelled"), false);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("retry_wait preserves exact adapter taxonomy and retries the same operation only when due", async () => {
  const runtime = await prepareRuntime("execution-loop-retry-wait");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const calls = [];
    const backend = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) {
        calls.push(Object.freeze({
          operationId: request.operationId,
          intentId: request.intentId,
          idempotencyKey: request.idempotencyKey,
        }));
        if (calls.length === 1) {
          return Object.freeze({
            ok: false,
            error: Object.freeze({
              code: "manual_rate_limited",
              category: "rate_limited",
              retryable: true,
              ambiguous: false,
              message: "bounded rate limit",
              correlationId: request.correlationId,
              externalReference: null,
              retryAfter: "2026-08-30T12:00:06.000Z",
            }),
          });
        }
        return manual.start(request);
      },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const service = createReliableExecutionService(runtime.store, runtime.ingress, backend, manual);
    const command = startCommand(runtime.claim.value.executionId, "retry-wait-key");
    const waiting = service.start(command);
    assert.equal(waiting.ok, true, JSON.stringify(waiting));
    assert.equal(waiting.value.intentState, "retry_wait");
    let intent = readApplicationStateForOwner(runtime.store).executionIntents.at(-1);
    assert.equal(intent.lastErrorCategory, "rate_limited");
    assert.equal(intent.lastErrorCode, "manual_rate_limited");
    assert.equal(intent.lastErrorRetryable, true);
    assert.equal(intent.lastErrorAmbiguous, false);
    assert.equal(intent.retryAfter, "2026-08-30T12:00:06.000Z");
    assert.equal(intent.retryCount, 1);

    runtime.ingress.setNow("2026-08-30T12:00:05.000Z");
    const early = service.start(command);
    assert.equal(early.ok, true, JSON.stringify(early));
    assert.equal(early.value.intentState, "retry_wait");
    assert.equal(calls.length, 1);

    runtime.ingress.setNow("2026-08-30T12:00:06.000Z");
    const retried = service.start(command);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.value.lifecycle, "queued");
    assert.equal(retried.value.intentState, "finalized");
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], calls[0]);
    intent = readApplicationStateForOwner(runtime.store).executionIntents.at(-1);
    assert.equal(intent.retryCount, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

function executionSurface(state) {
  return Object.freeze({
    operationRequests: state.executionOperationRequests,
    decisions: state.executionAuthorizationDecisions,
    audit: state.executionOperationAudit,
    intents: state.executionIntents,
    observations: state.executionObservations,
    receipts: state.executionReceipts,
    finalizations: state.executionFinalizations,
    terminal: state.executionTerminalStates,
    turns: state.manualTurns,
    backendOperations: state.manualBackendOperations,
    completionDecisions: state.manualCompletionDecisions,
  });
}

test("Task content and adapter error detail never enter bounded execution records or public results", async () => {
  const runtime = await prepareRuntime("execution-loop-redaction");
  try {
    const manual = createManualExecutionBackend(runtime.store, { ingress: runtime.ingress });
    const hostile = Object.freeze({
      contractId: manual.contractId,
      adapterId: manual.adapterId,
      adapterVersion: manual.adapterVersion,
      start(request) {
        return Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "safe_external_failure",
            category: "permanent_external",
            retryable: false,
            ambiguous: false,
            message: SENTINEL,
            correlationId: request.correlationId,
            externalReference: null,
            retryAfter: null,
          }),
        });
      },
      resume: (request) => manual.resume(request),
      inspect: (request) => manual.inspect(request),
      requestCancel: (request) => manual.requestCancel(request),
    });
    const result = createReliableExecutionService(runtime.store, runtime.ingress, hostile, manual)
      .start(startCommand(runtime.claim.value.executionId, "redaction-start-key"));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.lifecycle, "unknown");
    assert.equal(result.value.taskState, "waiting");
    assert.equal(JSON.stringify(result).includes(SENTINEL), false);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].body, SENTINEL);
    assert.equal(JSON.stringify(executionSurface(state)).includes(SENTINEL), false);
    assert.equal(JSON.stringify(executionSurface(state)).includes("safe_external_failure"), true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
