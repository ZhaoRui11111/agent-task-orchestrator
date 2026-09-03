import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  LOCAL_PROJECT_POLICY_ADAPTER_ID,
  LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
  createApplicationService,
  createLocalProjectPolicy,
  createManualExecutionBackend,
  createPhase3ProductRuntime,
  createProductRuntime,
  createWorkspaceApplicationService,
  inspectRuntimeDoctor,
  openPersistence,
} from "../src/index.ts";
import {
  readApplicationState,
  readApplicationStateForOwner,
} from "../src/persistence/application-repository.ts";
import { canonicalJson, sha256 } from "../src/persistence/values.ts";
import { createFakeWorkspaceBackend } from "./fixtures/fake-workspace-backend.mjs";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const ACTOR = "phase3-local-actor";
const PRINCIPAL = "A".repeat(64);
const BASE_TIME = "2026-08-30T12:00:00.000Z";
const EXPIRY = "2026-09-20T12:00:00.000Z";
const COMMAND_SHA256 = "B".repeat(64);
const TOOL_SHA256 = "C".repeat(64);
const TARGET_OBJECT = "a".repeat(40);

function trustedIngress(label) {
  let sequence = 0;
  let milliseconds = Date.parse("2026-08-30T12:00:00.000Z");
  let runtimeRootKey = "pending-runtime-root";
  let actorId = ACTOR;
  let beforeCleanupPointOfUse = () => {};
  return {
    currentActor: () => ({ actorId, principal: PRINCIPAL }),
    currentLeaseOwner: () => "phase3-execution-owner",
    currentExecutionLeaseOwner: () => "phase3-execution-owner",
    currentDispatcherOwner: () => `phase3-dispatcher-${label}`,
    currentWorkerOwner: () => `phase3-dispatcher-${label}`,
    currentIntegrationLeaseOwner: () => "phase3-integration-owner",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(milliseconds += 1).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: ({ action }) => new Set([
      "completion.accept", "integration.apply", "integration.push", "workspace.cleanup",
    ]).has(action) ? `confirmation-${action.replaceAll(".", "-")}-${++sequence}` : true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${action.replaceAll(".", "-")}-${++sequence}` }),
    beforeCleanupPointOfUse: () => beforeCleanupPointOfUse(),
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setNow(value) { milliseconds = Date.parse(value); },
    setActorId(value) { actorId = value; },
    setBeforeCleanupPointOfUse(value) { beforeCleanupPointOfUse = value; },
  };
}

function binding(state) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const execution = state.executions[0];
  const workspace = state.workspaceGenerations[0];
  assert.ok(project && task && execution && workspace);
  return Object.freeze({
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    taskId: task.id,
    expectedTaskRevision: task.revision,
    executionId: execution.executionId,
    expectedExecutionRevision: execution.revision,
    expectedAttemptNumber: execution.attemptNumber,
    expectedFencingToken: execution.fencingToken,
    workspaceId: workspace.workspaceId,
    expectedGeneration: workspace.generation,
    expectedWorkspaceRevision: workspace.revision,
  });
}

function workspaceOwnerCommand(state, idempotencyKey) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const run = state.dispatcherRuns[0];
  const member = state.dispatcherMembers[0];
  const execution = state.executions[0];
  assert.ok(project && task && run && member && execution);
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

function productCommon(state, idempotencyKey) {
  const project = state.projects[0];
  const task = state.domain.tasks[0];
  const execution = state.executions[0];
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
    idempotencyKey,
  };
}

function integrationCommon(state, idempotencyKey) {
  const project = state.projects[0];
  const reservation = state.integrationReservations[0];
  assert.ok(project && reservation);
  return {
    projectId: project.projectId,
    expectedProjectResourceRevision: project.resourceRevision,
    expectedProjectConfigRevision: project.configRevision,
    reservationId: reservation.reservationId,
    expectedReservationRevision: reservation.revision,
    expectedLeaseRevision: reservation.leaseRevision,
    expectedFencingToken: reservation.fencingToken,
    idempotencyKey,
  };
}

function completionBackend(ingress, settings = {}) {
  const calls = [];
  const response = (request, operation) => {
    calls.push(operation);
    const observedAt = settings.observedAt ?? ingress.now();
    const startedAt = new Date(Date.parse(observedAt) - 2).toISOString();
    const endedAt = new Date(Date.parse(observedAt) - 1).toISOString();
    const indeterminate = operation === "inspect_gate" && settings.indeterminateInspectCall === calls.length;
    const verdict = indeterminate ? "indeterminate" : settings.verdict ?? "pass";
    const common = {
      contractId: "ato.completion/v1",
      receiptId: `completion-receipt-${calls.length}`,
      operation,
      correlationId: request.correlationId,
      adapterId: request.adapterId,
      adapterVersion: request.adapterVersion,
      subject: request.subject,
      gateOperationId: operation === "run_gate" ? request.operationId : request.gateOperationId,
      observationNumber: 1,
      lifecycle: indeterminate ? "unknown" : "completed",
      verdict,
      code: indeterminate ? "gate_evidence_ambiguous" : verdict === "pass" ? "gate_passed" : "gate_failed",
      startedAt: indeterminate ? null : startedAt,
      endedAt: indeterminate ? null : endedAt,
      validUntil: verdict === "pass" ? new Date(Date.parse(observedAt) + 120_000).toISOString() : null,
      evidenceReference: `gate-evidence-${calls.length}`,
      observedAt,
    };
    return Object.freeze({
      ok: true,
      receipt: Object.freeze(operation === "inspect_gate"
        ? { ...common, queryId: request.queryId, readAuthorizationDecisionId: request.readAuthorizationDecisionId }
        : { ...common, operationId: request.operationId, intentId: request.intentId, idempotencyKey: request.idempotencyKey }),
    });
  };
  return Object.freeze({
    runGate: (request) => response(request, "run_gate"),
    inspectGate: (request) => response(request, "inspect_gate"),
    cancelGate: (request) => response(request, "cancel_gate"),
    calls: () => Object.freeze([...calls]),
  });
}

function scriptedIntegrationBackend() {
  const calls = [];
  let applyMode = "refused";
  const inspections = [];
  const respond = (request) => {
    calls.push(request.operation);
    const observationNumber = request.operation === "inspect"
      ? request.lastObservationNumber + 1
      : request.expectedObservationNumber + 1;
    let state;
    if (request.operation === "apply") {
      state = applyMode === "ambiguous"
        ? {
            localBeforeObjectId: request.subject.expectedTargetObjectId,
            localAfterObjectId: null,
            remoteBeforeObjectId: null,
            remoteAfterObjectId: null,
            localState: "unknown",
            remoteState: "not_requested",
            outcome: "ambiguous",
            code: "apply_ambiguous",
          }
        : {
            localBeforeObjectId: request.subject.expectedTargetObjectId,
            localAfterObjectId: request.subject.expectedTargetObjectId,
            remoteBeforeObjectId: null,
            remoteAfterObjectId: null,
            localState: "unchanged",
            remoteState: "not_requested",
            outcome: "refused",
            code: "apply_refused",
          };
    } else {
      const mode = inspections.shift() ?? "foreign";
      state = mode === "ambiguous"
        ? {
            localBeforeObjectId: null,
            localAfterObjectId: null,
            remoteBeforeObjectId: null,
            remoteAfterObjectId: null,
            localState: "unknown",
            remoteState: "absent",
            outcome: "ambiguous",
            code: "inspected_ambiguous",
          }
        : mode === "local_applied"
        ? {
            localBeforeObjectId: null,
            localAfterObjectId: request.subject.sourceHeadObjectId,
            remoteBeforeObjectId: null,
            remoteAfterObjectId: null,
            localState: "already_at_source",
            remoteState: "absent",
            outcome: "succeeded",
            code: "inspected_local_applied",
          }
        : {
            localBeforeObjectId: null,
            localAfterObjectId: "c".repeat(40),
            remoteBeforeObjectId: null,
            remoteAfterObjectId: null,
            localState: "foreign",
            remoteState: "absent",
            outcome: "refused",
            code: "inspected_foreign",
          };
    }
    const common = {
      contractId: "ato.integration/v1",
      receiptId: `scripted-integration-receipt-${calls.length}`,
      operation: request.operation,
      correlationId: request.correlationId,
      causationId: request.causationId,
      actorId: request.actorId,
      adapterId: request.adapterId,
      adapterVersion: request.adapterVersion,
      subject: request.subject,
      observationNumber,
      ...state,
      evidenceReference: `scripted-integration-evidence-${calls.length}`,
      observedAt: BASE_TIME,
    };
    return Object.freeze({
      ok: true,
      receipt: Object.freeze(request.operation === "inspect"
        ? { ...common, queryId: request.queryId, readAuthorizationDecisionId: request.readAuthorizationDecisionId }
        : {
            ...common,
            operationId: request.operationId,
            intentId: request.intentId,
            idempotencyKey: request.idempotencyKey,
            finalAuthorizationDecisionId: request.finalAuthorizationDecisionId,
            expectedObservationNumber: request.expectedObservationNumber,
          }),
    });
  };
  return Object.freeze({
    inspect: respond,
    apply: respond,
    push: respond,
    setApplyMode(value) { applyMode = value; },
    queueInspection(value) { inspections.push(value); },
    calls: () => Object.freeze([...calls]),
  });
}

function unusedIntegrationBackend() {
  const unexpected = () => { throw new Error("integration backend must not be called"); };
  return Object.freeze({ inspect: unexpected, apply: unexpected, push: unexpected });
}

function integrationBackend(ingress) {
  const calls = [];
  let localObjectId = TARGET_OBJECT;
  let remoteObjectId = null;
  const result = (request) => {
    calls.push(request.operation);
    const localBeforeObjectId = request.operation === "inspect" ? null : localObjectId;
    const remoteBeforeObjectId = request.operation === "inspect" || request.operation === "apply" ? null : remoteObjectId;
    if (request.operation === "apply" && localObjectId === request.subject.expectedTargetObjectId) {
      localObjectId = request.subject.sourceHeadObjectId;
    }
    if (request.operation === "push" && localObjectId === request.subject.sourceHeadObjectId) {
      remoteObjectId = request.subject.sourceHeadObjectId;
    }
    const observationNumber = request.operation === "inspect"
      ? request.lastObservationNumber + 1
      : request.expectedObservationNumber + 1;
    const localState = request.operation === "inspect"
      ? localObjectId === request.subject.sourceHeadObjectId ? "already_at_source" : "unchanged"
      : request.operation === "apply" ? "fast_forwarded" : "already_at_source";
    const remoteState = request.operation === "apply"
      ? "not_requested"
      : request.operation === "push" ? "pushed" : remoteObjectId === request.subject.sourceHeadObjectId
        ? "already_at_source" : "absent";
    const code = request.operation === "apply" ? "applied" : request.operation === "push" ? "pushed"
      : localState === "already_at_source" && remoteState === "already_at_source" ? "inspected_pushed"
        : localState === "already_at_source" ? "inspected_local_applied" : "inspected_unchanged";
    const common = {
      contractId: "ato.integration/v1",
      receiptId: `integration-receipt-${calls.length}`,
      operation: request.operation,
      correlationId: request.correlationId,
      causationId: request.causationId,
      actorId: request.actorId,
      adapterId: request.adapterId,
      adapterVersion: request.adapterVersion,
      subject: request.subject,
      observationNumber,
      localBeforeObjectId,
      localAfterObjectId: localObjectId,
      remoteBeforeObjectId,
      remoteAfterObjectId: request.operation === "apply" ? null : remoteObjectId,
      localState,
      remoteState,
      outcome: "succeeded",
      code,
      evidenceReference: `integration-evidence-${calls.length}`,
      observedAt: ingress.now(),
    };
    return Object.freeze({
      ok: true,
      receipt: Object.freeze(request.operation === "inspect"
        ? { ...common, queryId: request.queryId, readAuthorizationDecisionId: request.readAuthorizationDecisionId }
        : {
            ...common,
            operationId: request.operationId,
            intentId: request.intentId,
            idempotencyKey: request.idempotencyKey,
            finalAuthorizationDecisionId: request.finalAuthorizationDecisionId,
            expectedObservationNumber: request.expectedObservationNumber,
          }),
    });
  };
  return Object.freeze({
    inspect: result,
    apply: result,
    push: result,
    calls: () => Object.freeze([...calls]),
  });
}

async function prepareRuntime(
  prefix,
  capabilityUpgradeCount = 5,
  authorizationExpiry = EXPIRY,
  dispatchAt = "2026-08-30T12:00:10.000Z",
) {
  const fixture = createPersistenceFixture(prefix);
  const ingress = trustedIngress(prefix);
  const store = await openPersistence(fixture.layout, { applicationVersion: "phase3-application-test" });
  const application = createApplicationService(store, ingress);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: authorizationExpiry }).ok, true);
  ingress.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  const registered = application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot });
  assert.equal(registered.ok, true, JSON.stringify(registered));
  assert.equal(application.execute({
    kind: "task.create",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    taskId: "task",
    body: "private phase3 task body",
    supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    taskId: "task",
    expectedTaskRevision: 1,
  }).ok, true);
  for (let index = 0; index < capabilityUpgradeCount; index += 1) {
    assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: authorizationExpiry }).ok, true);
  }
  const manual = createManualExecutionBackend(store, { ingress });
  const product = createProductRuntime(store, ingress, manual, manual);
  ingress.setNow(dispatchAt);
  const dispatched = product.dispatchRun({ kind: "dispatch.run", idempotencyKey: `dispatch-${prefix}`, leaseDurationSeconds: 300 });
  assert.equal(dispatched.ok, true, JSON.stringify(dispatched));

  const workspace = createFakeWorkspaceBackend();
  const workspaceService = createWorkspaceApplicationService(store, workspace, ingress, {
    adapterId: "fake-workspace",
    adapterVersion: "1.0.0",
    workspaceRootKey: "phase3-workspace-root",
  });
  let state = readApplicationStateForOwner(store);
  const reserved = workspaceService.reserve({
    kind: "workspace.reserve",
    ...workspaceOwnerCommand(state, `workspace-reserve-${prefix}`),
    baseReference: "refs/heads/main",
    predecessorWorkspaceId: null,
    predecessorGeneration: null,
    predecessorRevision: null,
  });
  assert.equal(reserved.ok, true, JSON.stringify(reserved));
  state = readApplicationStateForOwner(store);
  const generation = state.workspaceGenerations[0];
  const created = workspaceService.create({
    kind: "workspace.create",
    ...workspaceOwnerCommand(state, `workspace-create-${prefix}`),
    workspaceId: generation.workspaceId,
    expectedGeneration: generation.generation,
    expectedGenerationRevision: generation.revision,
  });
  assert.equal(created.ok, true, JSON.stringify(created));

  state = readApplicationStateForOwner(store);
  ingress.setNow(new Date(Date.parse(dispatchAt) + 20_000).toISOString());
  const reported = product.recordManualOutcome({
    kind: "manual.outcome-report",
    ...productCommon(state, `manual-report-${prefix}`),
    reportId: `report-${prefix}`,
    outcome: "succeed",
    code: "manual-success",
    evidenceReference: "manual-evidence",
  });
  assert.equal(reported.ok, true, JSON.stringify(reported));
  return { fixture, ingress, store, workspace, application };
}

function phase3Options() {
  return Object.freeze({
    policyId: "phase3-policy",
    policyKey: "phase3-policy-key",
    policyAdapterId: LOCAL_PROJECT_POLICY_ADAPTER_ID,
    policyAdapterVersion: LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
    completionAdapterId: "fake-completion",
    completionAdapterVersion: "1.0.0",
    completionEvidenceRootKey: "phase3-evidence-root",
    gateTimeoutMs: 30_000,
    integrationAdapterId: "fake-integration",
    integrationAdapterVersion: "1.0.0",
    integrationTargetReference: "refs/heads/main",
    integrationExpectedTargetObjectId: TARGET_OBJECT,
    integrationDestinationIdentity: "phase3-local-bare",
    integrationDestinationReference: "refs/heads/main",
    integrationExpectedRemoteHead: null,
    integrationReservationLeaseSeconds: 300,
    workspaceAdapterId: "fake-workspace",
    workspaceAdapterVersion: "1.0.0",
    cleanupAttestationValiditySeconds: 120,
  });
}

function policyConfiguration(integration = "not_required", preservation = "not_required") {
  const allow = Object.freeze({ decision: "allow", reasonCode: "configured_allow" });
  return Object.freeze({
    policies: Object.freeze([Object.freeze({
      policyId: "phase3-policy",
      policyKey: "phase3-policy-key",
      configRevision: 1,
      decisions: Object.freeze({
        evaluate_mutation: allow,
        completion_requirements: allow,
        evaluate_integration: allow,
        evaluate_cleanup: allow,
      }),
      facts: Object.freeze({
        requiredGates: Object.freeze([Object.freeze({
          gateId: "unit",
          gateVersion: "1",
          commandKey: "unit-command",
          commandIdentitySha256: COMMAND_SHA256,
          toolEnvironmentSha256: TOOL_SHA256,
          validForSeconds: 120,
        })]),
        integration,
        preservation,
        cleanup: "allowed_after_completion",
      }),
      receiptValiditySeconds: 240,
    })]),
  });
}

async function advanceToCleanupPolicy(runtime, prefix, completionAt = "2026-08-30T12:00:40.000Z") {
  const completion = completionBackend(runtime.ingress);
  const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
    projectPolicy: createLocalProjectPolicy(policyConfiguration(), runtime.ingress),
    completion,
    integration: unusedIntegrationBackend(),
    workspace: runtime.workspace,
  }, phase3Options());
  runtime.ingress.setNow(completionAt);
  let state = readApplicationStateForOwner(runtime.store);
  const policy = await service.evaluateCompletionPolicy({
    kind: "policy.completion_requirements",
    ...binding(state),
  });
  assert.equal(policy.ok, true, JSON.stringify(policy));
  const gate = await service.runGate({
    kind: "completion.gate.run",
    ...binding(readApplicationStateForOwner(runtime.store)),
    policyReceiptId: policy.value.receiptId,
    gateId: "unit",
    gateVersion: "1",
    idempotencyKey: `gate-run-${prefix}`,
  });
  assert.equal(gate.ok, true, JSON.stringify(gate));
  const inspected = await service.inspectGate({
    kind: "completion.gate.inspect",
    ...binding(readApplicationStateForOwner(runtime.store)),
    policyReceiptId: policy.value.receiptId,
    gateOperationId: gate.value.gateOperationId,
    idempotencyKey: `gate-inspect-${prefix}`,
  });
  assert.equal(inspected.ok, true, JSON.stringify(inspected));
  state = readApplicationStateForOwner(runtime.store);
  const completed = await service.acceptCompletion({
    kind: "completion.accept",
    ...binding(state),
    policyReceiptId: policy.value.receiptId,
    idempotencyKey: `completion-${prefix}`,
  });
  assert.equal(completed.ok, true, JSON.stringify(completed));
  const cleanupPolicy = await service.evaluateCleanupPolicy({
    kind: "policy.evaluate_cleanup",
    ...binding(readApplicationStateForOwner(runtime.store)),
  });
  assert.equal(cleanupPolicy.ok, true, JSON.stringify(cleanupPolicy));
  return Object.freeze({ service, cleanupPolicy, completion });
}

test("Phase 3 application closes policy, external gate, completion, and attested cleanup without integration", async () => {
  const runtime = await prepareRuntime("phase3-happy");
  try {
    const completion = completionBackend(runtime.ingress);
    const policy = createLocalProjectPolicy(policyConfiguration(), runtime.ingress);
    const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
      projectPolicy: policy,
      completion,
      integration: unusedIntegrationBackend(),
      workspace: runtime.workspace,
    }, phase3Options());

    let state = readApplicationStateForOwner(runtime.store);
    runtime.ingress.setNow("2026-08-30T12:00:40.000Z");
    const policyResult = await service.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...binding(state),
    });
    const afterPolicy = readApplicationStateForOwner(runtime.store);
    assert.equal(policyResult.ok, true, JSON.stringify({
      policyResult,
      generation: state.workspaceGenerations[0],
      receipts: state.workspaceReceipts,
      lastRequest: afterPolicy.requests.at(-1),
      lastDecision: afterPolicy.decisions.at(-1),
      lastAudit: afterPolicy.audit.at(-1),
      policyReceipts: afterPolicy.projectPolicyReceipts,
    }));
    assert.equal(policyResult.value.decision, "allow");

    state = readApplicationStateForOwner(runtime.store);
    const run = await service.runGate({
      kind: "completion.gate.run",
      ...binding(state),
      policyReceiptId: policyResult.value.receiptId,
      gateId: "unit",
      gateVersion: "1",
      idempotencyKey: "gate-run-happy",
    });
    assert.equal(run.ok, true, JSON.stringify(run));
    assert.equal(run.value.state, "finalized");
    assert.equal(run.value.verdict, "pass");

    state = readApplicationStateForOwner(runtime.store);
    const inspected = await service.inspectGate({
      kind: "completion.gate.inspect",
      ...binding(state),
      policyReceiptId: policyResult.value.receiptId,
      gateOperationId: run.value.gateOperationId,
      idempotencyKey: "gate-inspect-happy",
    });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.state, "finalized");
    assert.equal(inspected.value.verdict, "pass");

    state = readApplicationStateForOwner(runtime.store);
    const completed = await service.acceptCompletion({
      kind: "completion.accept",
      ...binding(state),
      policyReceiptId: policyResult.value.receiptId,
      idempotencyKey: "completion-happy",
    });
    assert.equal(completed.ok, true, JSON.stringify(completed));
    assert.equal(completed.value.taskRevision, state.domain.tasks[0].revision + 1);
    assert.equal((await service.acceptCompletion({
      kind: "completion.accept",
      ...binding(state),
      policyReceiptId: policyResult.value.receiptId,
      idempotencyKey: "completion-happy",
    })).replayed, true);

    state = readApplicationStateForOwner(runtime.store);
    const cleanupPolicy = await service.evaluateCleanupPolicy({
      kind: "policy.evaluate_cleanup",
      ...binding(state),
    });
    assert.equal(cleanupPolicy.ok, true, JSON.stringify(cleanupPolicy));
    const cleanup = await service.cleanupWorkspace({
      kind: "workspace.cleanup",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: cleanupPolicy.value.receiptId,
      idempotencyKey: "cleanup-happy",
    });
    const afterCleanup = readApplicationStateForOwner(runtime.store);
    assert.equal(cleanup.ok, true, JSON.stringify({
      cleanup,
      intents: afterCleanup.workspaceIntents.filter((candidate) => candidate.operationKind === "cleanup"),
      decisions: afterCleanup.workspaceAuthorizationDecisions.filter((candidate) => candidate.action === "workspace.cleanup"),
      attestations: afterCleanup.workspaceCleanupAttestations,
      observations: afterCleanup.workspaceObservations.filter((candidate) =>
        afterCleanup.workspaceIntents.some((intent) => intent.intentId === candidate.intentId && intent.operationKind === "cleanup")),
    }));
    assert.equal(cleanup.value.state, "finalized");
    assert.equal(cleanup.value.workspaceStatus, "cleaned");
    assert.match(cleanup.value.attestationSha256, /^[0-9A-F]{64}$/u);

    const final = readApplicationStateForOwner(runtime.store);
    assert.equal(final.completionDecisions.length, 1);
    assert.equal(final.policyGatedCompletionDecisions.length, 1);
    assert.equal(final.executionTerminalStates.length, 1);
    assert.equal(final.workspaceCleanupAttestations.length, 1);
    assert.equal(completion.calls().join(","), "run_gate,inspect_gate,inspect_gate");
    assert.equal(runtime.workspace.calls().filter((call) => call.operation === "cleanup").length, 1);
    assert.doesNotMatch(JSON.stringify({
      policies: final.projectPolicyReceipts,
      gates: final.completionGateEvents,
      integration: final.integrationEvents,
      cleanup: final.workspaceCleanupAttestations,
    }), /private phase3 task body|fake-private-path/u);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 reopens every required gate and refuses completion when the reopened evidence is indeterminate", async () => {
  const runtime = await prepareRuntime("phase3-reopen-refusal");
  try {
    const completion = completionBackend(runtime.ingress, { indeterminateInspectCall: 3 });
    const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
      projectPolicy: createLocalProjectPolicy(policyConfiguration(), runtime.ingress),
      completion,
      integration: unusedIntegrationBackend(),
      workspace: runtime.workspace,
    }, phase3Options());
    runtime.ingress.setNow("2026-08-30T12:00:40.000Z");
    const policy = await service.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(policy.ok, true, JSON.stringify(policy));
    const gate = await service.runGate({
      kind: "completion.gate.run",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      gateId: "unit",
      gateVersion: "1",
      idempotencyKey: "gate-run-reopen-refusal",
    });
    assert.equal(gate.ok, true, JSON.stringify(gate));
    const inspected = await service.inspectGate({
      kind: "completion.gate.inspect",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      gateOperationId: gate.value.gateOperationId,
      idempotencyKey: "gate-inspect-reopen-refusal",
    });
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    const refused = await service.acceptCompletion({
      kind: "completion.accept",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      idempotencyKey: "completion-reopen-refusal",
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "EVIDENCE_STALE");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.equal(state.completionDecisions.length, 0);
    assert.equal(completion.calls().join(","), "run_gate,inspect_gate,inspect_gate");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 cleanup refuses point-of-use grant, policy, and actor drift before backend access", async (context) => {
  const scenarios = [
    {
      name: "revoked cleanup grant",
      expiry: EXPIRY,
      mutate(runtime) {
        const state = readApplicationStateForOwner(runtime.store);
        const grant = state.grants.find((candidate) => candidate.action === "workspace.cleanup" && candidate.revokedAt === null);
        assert.ok(grant);
        const revoked = runtime.application.execute({
          kind: "authorization.grant.revoke",
          grantId: grant.grantId,
          expectedGrantRevision: grant.revision,
        });
        assert.equal(revoked.ok, true, JSON.stringify(revoked));
      },
    },
    {
      name: "expired cleanup grant",
      expiry: EXPIRY,
      dispatchAt: "2026-09-20T11:58:00.000Z",
      completionAt: "2026-09-20T11:59:00.000Z",
      mutate(runtime) { runtime.ingress.setNow("2026-09-20T12:00:00.001Z"); },
    },
    {
      name: "Project policy configuration revision drift",
      expiry: EXPIRY,
      mutate(runtime) {
        const project = readApplicationStateForOwner(runtime.store).projects[0];
        const updated = runtime.application.execute({
          kind: "project.update",
          projectId: project.projectId,
          expectedResourceRevision: project.resourceRevision,
          expectedConfigRevision: project.configRevision,
        });
        assert.equal(updated.ok, true, JSON.stringify(updated));
      },
    },
    {
      name: "actor substitution",
      expiry: EXPIRY,
      mutate(runtime) { runtime.ingress.setActorId("phase3-substituted-actor"); },
    },
  ];
  for (const [index, scenario] of scenarios.entries()) {
    await context.test(scenario.name, async () => {
      const runtime = await prepareRuntime(
        `phase3-cleanup-drift-${index}`,
        5,
        scenario.expiry,
        scenario.dispatchAt,
      );
      try {
        const advanced = await advanceToCleanupPolicy(runtime, `cleanup-drift-${index}`, scenario.completionAt);
        runtime.ingress.setBeforeCleanupPointOfUse(() => scenario.mutate(runtime));
        const refused = await advanced.service.cleanupWorkspace({
          kind: "workspace.cleanup",
          ...binding(readApplicationStateForOwner(runtime.store)),
          policyReceiptId: advanced.cleanupPolicy.value.receiptId,
          idempotencyKey: `cleanup-drift-${index}`,
        });
        assert.equal(refused.ok, false, JSON.stringify(refused));
        assert.equal(refused.error.code, "RECONCILIATION_REQUIRED");
        assert.equal(runtime.workspace.calls().filter((call) => call.operation === "cleanup").length, 0);
      } finally {
        await runtime.store.close();
        cleanupPersistenceFixture(runtime.fixture);
      }
    });
  }
});

async function advanceToRequiredPreservationCompletion(runtime, prefix) {
  const completion = completionBackend(runtime.ingress);
  const integration = integrationBackend(runtime.ingress);
  const policy = createLocalProjectPolicy(policyConfiguration("required", "required"), runtime.ingress);
  const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
    projectPolicy: policy,
    completion,
    integration,
    workspace: runtime.workspace,
  }, phase3Options());

  runtime.ingress.setNow("2026-08-30T12:00:40.000Z");
  let state = readApplicationStateForOwner(runtime.store);
  const completionPolicy = await service.evaluateCompletionPolicy({
    kind: "policy.completion_requirements",
    ...binding(state),
  });
  assert.equal(completionPolicy.ok, true, JSON.stringify(completionPolicy));
  const gate = await service.runGate({
    kind: "completion.gate.run",
    ...binding(readApplicationStateForOwner(runtime.store)),
    policyReceiptId: completionPolicy.value.receiptId,
    gateId: "unit",
    gateVersion: "1",
    idempotencyKey: `${prefix}-gate-run`,
  });
  assert.equal(gate.ok, true, JSON.stringify(gate));
  const gateInspection = await service.inspectGate({
    kind: "completion.gate.inspect",
    ...binding(readApplicationStateForOwner(runtime.store)),
    policyReceiptId: completionPolicy.value.receiptId,
    gateOperationId: gate.value.gateOperationId,
    idempotencyKey: `${prefix}-gate-inspect`,
  });
  assert.equal(gateInspection.ok, true, JSON.stringify(gateInspection));

  state = readApplicationStateForOwner(runtime.store);
  const integrationPolicy = await service.evaluateIntegrationPolicy({
    kind: "policy.evaluate_integration",
    ...binding(state),
  });
  assert.equal(integrationPolicy.ok, true, JSON.stringify(integrationPolicy));
  const reserved = await service.reserveIntegration({
    kind: "integration.reserve",
    ...binding(readApplicationStateForOwner(runtime.store)),
    policyReceiptId: integrationPolicy.value.receiptId,
    idempotencyKey: `${prefix}-reservation`,
  });
  assert.equal(reserved.ok, true, JSON.stringify(reserved));

  const inspected = await service.inspectIntegration({
    kind: "integration.inspect",
    ...integrationCommon(readApplicationStateForOwner(runtime.store), `${prefix}-inspect`),
  });
  assert.equal(inspected.ok, true, JSON.stringify(inspected));
  assert.equal(inspected.value.code, "inspected_unchanged");
  const applied = await service.applyIntegration({
    kind: "integration.apply",
    ...integrationCommon(readApplicationStateForOwner(runtime.store), `${prefix}-apply`),
  });
  assert.equal(applied.ok, true, JSON.stringify(applied));
  assert.equal(applied.value.code, "applied");
  const pushed = await service.pushIntegration({
    kind: "integration.push",
    ...integrationCommon(readApplicationStateForOwner(runtime.store), `${prefix}-push`),
  });
  assert.equal(pushed.ok, true, JSON.stringify(pushed));
  assert.equal(pushed.value.code, "pushed");

  const completed = await service.acceptCompletion({
    kind: "completion.accept",
    ...binding(readApplicationStateForOwner(runtime.store)),
    policyReceiptId: completionPolicy.value.receiptId,
    idempotencyKey: `${prefix}-completion`,
  });
  assert.equal(completed.ok, true, JSON.stringify(completed));
  return Object.freeze({ completed, completionPolicy, integration, service });
}

test("Phase 3 reserves, inspects, applies, pushes, completes, releases, and cleans an integration-required task", async () => {
  const runtime = await prepareRuntime("phase3-integration");
  try {
    const { completed, integration, service } = await advanceToRequiredPreservationCompletion(runtime, "integration");
    assert.equal(completed.value.preservationStateSha256, completed.value.integrationEvidenceSha256);
    const released = await service.releaseIntegration({
      kind: "integration.release",
      ...integrationCommon(readApplicationStateForOwner(runtime.store), "release-integration"),
    });
    assert.equal(released.ok, true, JSON.stringify(released));
    assert.equal(released.value.status, "released");

    const cleanupPolicy = await service.evaluateCleanupPolicy({
      kind: "policy.evaluate_cleanup",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(cleanupPolicy.ok, true, JSON.stringify(cleanupPolicy));
    const cleaned = await service.cleanupWorkspace({
      kind: "workspace.cleanup",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: cleanupPolicy.value.receiptId,
      idempotencyKey: "cleanup-integration",
    });
    assert.equal(cleaned.ok, true, JSON.stringify(cleaned));
    assert.equal(cleaned.value.workspaceStatus, "cleaned");
    assert.deepEqual(integration.calls(), ["inspect", "apply", "push"]);

    const final = readApplicationStateForOwner(runtime.store);
    assert.equal(final.integrationReservations[0].status, "released");
    assert.equal(final.integrationIntents.length, 2);
    assert.equal(final.integrationIntents.every((candidate) => candidate.state === "finalized"), true);
    assert.equal(final.integrationReceipts.length, 2);
    assert.equal(final.policyGatedCompletionDecisions.length, 1);
    assert.equal(final.workspaceCleanupAttestations.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 combined reader rejects a required preservation digest that differs from verified integration evidence", async () => {
  const runtime = await prepareRuntime("phase3-required-preservation-corruption");
  let storeOpen = true;
  try {
    const { completed } = await advanceToRequiredPreservationCompletion(runtime, "preservation-corruption");
    const state = readApplicationStateForOwner(runtime.store);
    const decision = state.policyGatedCompletionDecisions[0];
    assert.ok(decision);
    assert.equal(decision.preservationStateSha256, decision.integrationEvidenceSha256);
    assert.equal(completed.value.preservationStateSha256, decision.preservationStateSha256);

    await runtime.store.close();
    storeOpen = false;
    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      const immutableTrigger = database.prepare(
        "SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='policy_gated_completion_decisions_no_update'",
      ).get();
      assert.equal(typeof immutableTrigger?.sql, "string");
      const tamperedDigest = "D".repeat(64);
      assert.notEqual(tamperedDigest, decision.integrationEvidenceSha256);
      database.exec("DROP TRIGGER policy_gated_completion_decisions_no_update");
      database.prepare(
        "UPDATE policy_gated_completion_decisions SET preservation_state_sha256=? WHERE completion_decision_id=?",
      ).run(tamperedDigest, decision.completionDecisionId);
      database.exec(immutableTrigger.sql);
      assert.throws(
        () => readApplicationState(database),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      database.close();
    }

    assert.equal(
      inspectRuntimeDoctor(runtime.fixture.layout.root, runtime.fixture.sourceCheckoutRoot).health,
      "state_corrupt",
    );
    await assert.rejects(
      openPersistence(runtime.fixture.layout, { applicationVersion: "required-preservation-corruption" }),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    if (storeOpen) await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 combined reader rejects required preservation without required integration", async () => {
  const runtime = await prepareRuntime("phase3-impossible-policy-facts-corruption");
  let storeOpen = true;
  try {
    await advanceToCleanupPolicy(runtime, "impossible-policy-facts");
    const state = readApplicationStateForOwner(runtime.store);
    const decision = state.policyGatedCompletionDecisions[0];
    assert.ok(decision);
    const policy = state.projectPolicyReceipts.find((candidate) => candidate.receiptId === decision.policyReceiptId);
    assert.ok(policy);
    const notRequiredSha256 = sha256(canonicalJson({ disposition: "not_required" }));
    assert.equal(decision.integrationEvidenceSha256, notRequiredSha256);
    assert.equal(decision.preservationStateSha256, notRequiredSha256);

    await runtime.store.close();
    storeOpen = false;
    const database = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      const immutableTrigger = database.prepare(
        "SELECT sql FROM sqlite_schema WHERE type='trigger' AND name='project_policy_receipts_no_update'",
      ).get();
      assert.equal(typeof immutableTrigger?.sql, "string");
      const impossibleFactsJson = canonicalJson({
        ...JSON.parse(policy.factsJson),
        integration: "not_required",
        preservation: "required",
      });
      assert.notEqual(impossibleFactsJson, policy.factsJson);
      database.exec("DROP TRIGGER project_policy_receipts_no_update");
      database.prepare(
        "UPDATE project_policy_receipts SET facts_json=?, facts_sha256=? WHERE receipt_id=?",
      ).run(impossibleFactsJson, sha256(impossibleFactsJson), policy.receiptId);
      database.exec(immutableTrigger.sql);
      assert.throws(
        () => readApplicationState(database),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      database.close();
    }

    assert.equal(
      inspectRuntimeDoctor(runtime.fixture.layout.root, runtime.fixture.sourceCheckoutRoot).health,
      "state_corrupt",
    );
    await assert.rejects(
      openPersistence(runtime.fixture.layout, { applicationVersion: "impossible-policy-facts-corruption" }),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    if (storeOpen) await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 permits preliminary policy evaluation but denies effects when the current epoch lacks Phase 3 authority", async () => {
  const runtime = await prepareRuntime("phase3-authorization-denial", 4);
  try {
    let policyCalls = 0;
    const configured = createLocalProjectPolicy(policyConfiguration(), runtime.ingress);
    const policy = Object.freeze({
      evaluateMutation: (request) => { policyCalls += 1; return configured.evaluateMutation(request); },
      completionRequirements: (request) => { policyCalls += 1; return configured.completionRequirements(request); },
      evaluateIntegration: (request) => { policyCalls += 1; return configured.evaluateIntegration(request); },
      evaluateCleanup: (request) => { policyCalls += 1; return configured.evaluateCleanup(request); },
    });
    const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
      projectPolicy: policy,
      completion: completionBackend(runtime.ingress),
      integration: unusedIntegrationBackend(),
      workspace: runtime.workspace,
    }, phase3Options());
    const evaluated = await service.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(evaluated.ok, true, JSON.stringify(evaluated));
    assert.equal(policyCalls, 1);
    const before = readApplicationStateForOwner(runtime.store);
    const denied = await service.runGate({
      kind: "completion.gate.run",
      ...binding(before),
      policyReceiptId: evaluated.value.receiptId,
      gateId: "unit",
      gateVersion: "1",
      idempotencyKey: "gate-without-phase3-authority",
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    const after = readApplicationStateForOwner(runtime.store);
    assert.equal(after.projectPolicyReceipts.length, 1);
    assert.equal(after.completionGateIntents.length, 0);
    assert.equal(after.requests.length, before.requests.length + 1);
    assert.equal(after.decisions.length, before.decisions.length + 1);
    assert.equal(after.audit.length, before.audit.length + 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 gate operations are replay-safe and reject conflicting or expired policy evidence before backend access", async () => {
  const runtime = await prepareRuntime("phase3-gate-replay-stale");
  try {
    const completion = completionBackend(runtime.ingress);
    const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
      projectPolicy: createLocalProjectPolicy(policyConfiguration(), runtime.ingress),
      completion,
      integration: unusedIntegrationBackend(),
      workspace: runtime.workspace,
    }, phase3Options());
    const policy = await service.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(policy.ok, true, JSON.stringify(policy));
    const command = {
      kind: "completion.gate.run",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      gateId: "unit",
      gateVersion: "1",
      idempotencyKey: "gate-replay-key",
    };
    const first = await service.runGate(command);
    assert.equal(first.ok, true, JSON.stringify(first));
    const replayed = await service.runGate(command);
    assert.equal(replayed.ok, true);
    assert.equal(replayed.replayed, true);
    assert.deepEqual(completion.calls(), ["run_gate"]);

    const conflicted = await service.runGate({ ...command, gateVersion: "2" });
    assert.equal(conflicted.ok, false);
    assert.equal(conflicted.error.code, "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(completion.calls(), ["run_gate"]);

    runtime.ingress.setNow("2026-08-30T12:10:00.000Z");
    const expired = await service.runGate({
      ...command,
      idempotencyKey: "gate-expired-policy-key",
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.error.code, "EVIDENCE_STALE");
    assert.deepEqual(completion.calls(), ["run_gate"]);
    assert.equal(readApplicationStateForOwner(runtime.store).completionGateIntents.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 refuses completion when the authoritative required gate fails", async () => {
  const runtime = await prepareRuntime("phase3-gate-failure");
  try {
    const completion = completionBackend(runtime.ingress, { verdict: "fail" });
    const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
      projectPolicy: createLocalProjectPolicy(policyConfiguration(), runtime.ingress),
      completion,
      integration: unusedIntegrationBackend(),
      workspace: runtime.workspace,
    }, phase3Options());
    const policy = await service.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(policy.ok, true, JSON.stringify(policy));
    const gate = await service.runGate({
      kind: "completion.gate.run",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      gateId: "unit",
      gateVersion: "1",
      idempotencyKey: "gate-failure-run",
    });
    assert.equal(gate.ok, true, JSON.stringify(gate));
    assert.equal(gate.value.verdict, "fail");
    const inspection = await service.inspectGate({
      kind: "completion.gate.inspect",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      gateOperationId: gate.value.gateOperationId,
      idempotencyKey: "gate-failure-inspect",
    });
    assert.equal(inspection.ok, true, JSON.stringify(inspection));
    assert.equal(inspection.value.verdict, "fail");
    const refused = await service.acceptCompletion({
      kind: "completion.accept",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: policy.value.receiptId,
      idempotencyKey: "completion-after-failed-gate",
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "EVIDENCE_STALE");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.domain.tasks[0].state, "running");
    assert.equal(state.completionDecisions.length, 0);
    assert.equal(state.executionTerminalStates.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Phase 3 keeps named no-effect refusals active and terminally reconciles an authoritative foreign inspection", async () => {
  const runtime = await prepareRuntime("phase3-integration-recovery");
  try {
    const completion = completionBackend(runtime.ingress);
    const integration = scriptedIntegrationBackend();
    const service = createPhase3ProductRuntime(runtime.store, runtime.ingress, {
      projectPolicy: createLocalProjectPolicy(policyConfiguration("required"), runtime.ingress),
      completion,
      integration,
      workspace: runtime.workspace,
    }, phase3Options());
    const completionPolicy = await service.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(completionPolicy.ok, true, JSON.stringify(completionPolicy));
    const gate = await service.runGate({
      kind: "completion.gate.run",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: completionPolicy.value.receiptId,
      gateId: "unit",
      gateVersion: "1",
      idempotencyKey: "integration-recovery-gate-run",
    });
    assert.equal(gate.ok, true, JSON.stringify(gate));
    const inspectedGate = await service.inspectGate({
      kind: "completion.gate.inspect",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: completionPolicy.value.receiptId,
      gateOperationId: gate.value.gateOperationId,
      idempotencyKey: "integration-recovery-gate-inspect",
    });
    assert.equal(inspectedGate.ok, true, JSON.stringify(inspectedGate));
    const integrationPolicy = await service.evaluateIntegrationPolicy({
      kind: "policy.evaluate_integration",
      ...binding(readApplicationStateForOwner(runtime.store)),
    });
    assert.equal(integrationPolicy.ok, true, JSON.stringify(integrationPolicy));
    const reserved = await service.reserveIntegration({
      kind: "integration.reserve",
      ...binding(readApplicationStateForOwner(runtime.store)),
      policyReceiptId: integrationPolicy.value.receiptId,
      idempotencyKey: "integration-recovery-reservation",
    });
    assert.equal(reserved.ok, true, JSON.stringify(reserved));

    const refused = await service.applyIntegration({
      kind: "integration.apply",
      ...integrationCommon(readApplicationStateForOwner(runtime.store), "integration-refused-effect"),
    });
    assert.equal(refused.ok, true, JSON.stringify(refused));
    assert.equal(refused.value.intentState, "failed");
    assert.equal(refused.value.outcome, "refused");
    assert.equal(refused.value.status, "active");

    integration.setApplyMode("ambiguous");
    const ambiguous = await service.applyIntegration({
      kind: "integration.apply",
      ...integrationCommon(readApplicationStateForOwner(runtime.store), "integration-ambiguous-effect"),
    });
    assert.equal(ambiguous.ok, true, JSON.stringify(ambiguous));
    assert.equal(ambiguous.value.intentState, "ambiguous");
    assert.equal(ambiguous.value.status, "ambiguous");
    const ambiguousIntentId = ambiguous.value.intentId;

    integration.queueInspection("ambiguous");
    const stillAmbiguous = await service.recoverIntegration({
      kind: "integration.recover",
      ...integrationCommon(readApplicationStateForOwner(runtime.store), "integration-recover-ambiguous"),
      intentId: ambiguousIntentId,
    });
    assert.equal(stillAmbiguous.ok, true, JSON.stringify(stillAmbiguous));
    assert.equal(stillAmbiguous.value.intentState, "ambiguous");
    assert.equal(stillAmbiguous.value.status, "ambiguous");
    assert.equal(stillAmbiguous.value.code, "inspected_ambiguous");

    integration.queueInspection("foreign");
    const foreign = await service.recoverIntegration({
      kind: "integration.recover",
      ...integrationCommon(readApplicationStateForOwner(runtime.store), "integration-recover-foreign"),
      intentId: ambiguousIntentId,
    });
    assert.equal(foreign.ok, true, JSON.stringify(foreign));
    assert.equal(foreign.value.intentState, "finalized");
    assert.equal(foreign.value.status, "released");
    assert.equal(foreign.value.code, "inspected_foreign");
    assert.deepEqual(integration.calls(), ["apply", "apply", "inspect", "inspect"]);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.integrationIntents[0].state, "failed");
    assert.equal(state.integrationIntents[1].state, "finalized");
    assert.equal(state.integrationIntents[1].recoveryResult, "recovered_inconsistent");
    assert.equal(state.integrationReservations[0].status, "released");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
