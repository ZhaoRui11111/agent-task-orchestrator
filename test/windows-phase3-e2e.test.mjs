import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  COMPLETION_CONTRACT_ID,
  INTEGRATION_CONTRACT_ID,
  LOCAL_COMPLETION_ADAPTER_ID,
  LOCAL_COMPLETION_ADAPTER_VERSION,
  LOCAL_GIT_INTEGRATION_ADAPTER_ID,
  LOCAL_GIT_INTEGRATION_ADAPTER_VERSION,
  LOCAL_PROJECT_POLICY_ADAPTER_ID,
  LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
  PROJECT_POLICY_CONTRACT_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  createApplicationService,
  createLocalCompletionBackend,
  createLocalGitIntegrationBackend,
  createLocalProjectPolicy,
  createManualExecutionBackend,
  createPhase3ProductRuntime,
  createProductRuntime,
  createWorkspaceApplicationService,
  createWindowsGitWorkspaceBackend,
  openPersistence,
  prepareRuntimeLayout,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import {
  TEST_GIT_EXECUTABLE,
  cleanupWorkspaceGitFixture,
  createWorkspaceGitFixture,
  git,
  workspaceRequest,
} from "./fixtures/workspace-git-fixture.mjs";

const SHA256_A = "A".repeat(64);
const SHA256_B = "B".repeat(64);
const SHA256_C = "C".repeat(64);
const BASE_TIME = "2026-08-30T12:00:00.000Z";
const SOURCE_HEAD = "b".repeat(40);

function composedIngress(label) {
  let sequence = 0;
  let runtimeRootKey = "pending-runtime-root";
  return Object.freeze({
    currentActor: () => ({ actorId: "phase3-composed-actor", principal: "E".repeat(64) }),
    currentLeaseOwner: () => "phase3-composed-execution-owner",
    currentExecutionLeaseOwner: () => "phase3-composed-execution-owner",
    currentDispatcherOwner: () => `phase3-composed-dispatcher-${label}`,
    currentWorkerOwner: () => `phase3-composed-dispatcher-${label}`,
    currentIntegrationLeaseOwner: () => "phase3-composed-integration-owner",
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(Date.now() - 1_000).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: ({ action }) => new Set([
      "completion.accept", "integration.apply", "integration.push", "workspace.cleanup",
    ]).has(action) ? `confirmation-${action.replaceAll(".", "-")}-${++sequence}` : true,
    confirmOperation: ({ action }) => ({ confirmationId: `confirmation-${action.replaceAll(".", "-")}-${++sequence}` }),
    setRuntimeRootKey(value) { runtimeRootKey = value; },
  });
}

function phase3Binding(state) {
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

function composedWorkspaceOwner(state, idempotencyKey) {
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

function composedProductCommand(state, idempotencyKey) {
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

function composedIntegrationCommand(state, idempotencyKey) {
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

function policySubject(operation) {
  const project = {
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1,
    projectRootKey: "project-root", repositoryIdentity: "repository",
  };
  if (operation === "evaluate_mutation") return {
    ...project, subjectKind: "task", subjectId: "task", currentRevision: 3,
    proposedChangeSha256: SHA256_A, externalTargetSha256: null,
  };
  const completion = {
    ...project, taskId: "task", taskRevision: 3, executionId: "execution", executionRevision: 1,
    attemptNumber: 1, fencingToken: 1, workspaceId: "workspace", generation: 1,
    workspaceRevision: 5, ownershipBindingSha256: SHA256_A, headObjectId: SOURCE_HEAD,
  };
  if (operation === "evaluate_integration") return {
    ...completion, targetReference: "refs/heads/integration", expectedTargetObjectId: "a".repeat(40),
    sourceHeadObjectId: SOURCE_HEAD, destinationIdentity: "local-bare", expectedRemoteHead: null,
  };
  if (operation === "evaluate_cleanup") return {
    ...completion, completionDecisionId: "completion", executionTerminalCreatedAt: BASE_TIME,
    gateSetSha256: SHA256_B, preservationStateSha256: SHA256_C, integrationDisposition: "not_required",
    integrationReservationId: null, observedInventorySha256: SHA256_A,
  };
  return completion;
}

function policyRequest(operation) {
  return {
    contractId: PROJECT_POLICY_CONTRACT_ID,
    operation,
    policyQueryId: `query-${operation}`,
    correlationId: `correlation-${operation}`,
    actorId: "actor",
    preliminaryAuthorizationDecisionId: "preliminary-decision",
    requestedAction: operation === "completion_requirements" ? "completion.accept"
      : operation === "evaluate_integration" ? "integration.reserve"
        : operation === "evaluate_cleanup" ? "workspace.cleanup" : "task.update",
    policyId: "policy",
    policyKey: "policy-key",
    policyConfigRevision: 1,
    adapterId: LOCAL_PROJECT_POLICY_ADAPTER_ID,
    adapterVersion: LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
    subject: policySubject(operation),
  };
}

function policyConfiguration(
  integration = "not_required",
  preservation = "not_required",
  validitySeconds = 120,
  integrationDecision = "defer",
) {
  return {
    policies: [{
      policyId: "policy",
      policyKey: "policy-key",
      configRevision: 1,
      decisions: {
        evaluate_mutation: { decision: "deny", reasonCode: "mutation_denied" },
        completion_requirements: { decision: "allow", reasonCode: "completion_allowed" },
        evaluate_integration: {
          decision: integrationDecision,
          reasonCode: integrationDecision === "allow" ? "integration_allowed" : "integration_deferred",
        },
        evaluate_cleanup: { decision: "allow", reasonCode: "cleanup_allowed" },
      },
      facts: {
        requiredGates: [{
          gateId: "gate", gateVersion: "1", commandKey: "command",
          commandIdentitySha256: SHA256_B, toolEnvironmentSha256: SHA256_C, validForSeconds: validitySeconds,
        }],
        integration,
        preservation,
        cleanup: "allowed_after_completion",
      },
      receiptValiditySeconds: validitySeconds,
    }],
  };
}

test("Phase 3 local ProjectPolicy snapshots configuration and returns deterministic allow, deny, and defer receipts", () => {
  const configuration = policyConfiguration();
  const adapter = createLocalProjectPolicy(configuration, { now: () => BASE_TIME });
  assert.deepEqual(adapter.description, {
    contractId: PROJECT_POLICY_CONTRACT_ID,
    adapterId: LOCAL_PROJECT_POLICY_ADAPTER_ID,
    adapterVersion: LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
    policyCount: 1,
  });
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(Object.isFrozen(adapter.description), true);

  configuration.policies[0].decisions.completion_requirements.decision = "deny";
  configuration.policies[0].facts.cleanup = "prohibited";

  const denied = adapter.evaluateMutation(policyRequest("evaluate_mutation"));
  const allowed = adapter.completionRequirements(policyRequest("completion_requirements"));
  const repeated = adapter.completionRequirements(policyRequest("completion_requirements"));
  const deferred = adapter.evaluateIntegration(policyRequest("evaluate_integration"));
  assert.equal(denied.ok, true);
  assert.equal(denied.receipt.decision, "deny");
  assert.equal(allowed.ok, true);
  assert.equal(allowed.receipt.decision, "allow");
  assert.equal(allowed.receipt.facts.cleanup, "allowed_after_completion");
  assert.equal(allowed.receipt.validUntil, "2026-08-30T12:02:00.000Z");
  assert.deepEqual(repeated, allowed);
  assert.equal(deferred.ok, true);
  assert.equal(deferred.receipt.decision, "defer");
  assert.equal(deferred.receipt.validUntil, null);

  const cleanupRequest = policyRequest("evaluate_cleanup");
  const absent = adapter.evaluateCleanup({
    ...cleanupRequest,
    policyConfigRevision: 2,
    subject: { ...cleanupRequest.subject, projectConfigRevision: 2 },
  });
  assert.deepEqual(absent, {
    ok: false,
    error: {
      category: "not_found", code: "policy_configuration_absent", retryable: false,
      ambiguous: false, retryAfter: null, evidenceReference: null,
    },
  });
});

test("local ProjectPolicy rejects duplicated gate identities at configuration load", () => {
  const configuration = policyConfiguration();
  configuration.policies[0].facts.requiredGates.push({ ...configuration.policies[0].facts.requiredGates[0] });
  assert.throws(() => createLocalProjectPolicy(configuration), /gate identity is duplicated/u);
});

test("local ProjectPolicy permits required preservation only with required integration", () => {
  const impossible = policyConfiguration();
  impossible.policies[0].facts.preservation = "required";
  assert.throws(() => createLocalProjectPolicy(impossible), /facts configuration is invalid/u);

  const bound = policyConfiguration();
  bound.policies[0].facts.integration = "required";
  bound.policies[0].facts.preservation = "required";
  const adapter = createLocalProjectPolicy(bound, { now: () => BASE_TIME });
  const result = adapter.completionRequirements(policyRequest("completion_requirements"));
  assert.equal(result.ok, true);
  assert.equal(result.receipt.facts.integration, "required");
  assert.equal(result.receipt.facts.preservation, "required");
});

function completionSubject(created) {
  return {
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1,
    projectRootKey: "project-root-key", repositoryIdentity: created.receipt.repositoryIdentity,
    headObjectId: created.receipt.headObjectId,
    taskId: "task", taskRevision: 3, executionId: "execution", executionRevision: 1,
    attemptNumber: 1, fencingToken: 1, workspaceId: "workspace", generation: 1,
    workspaceRevision: 2, workspaceRootKey: "workspace-root-key",
    ownershipBindingSha256: created.receipt.ownershipBindingSha256,
    policyId: "policy", policyReceiptId: "policy-receipt", policyConfigRevision: 1,
    gateId: "gate", gateVersion: "1", commandKey: "command", commandIdentitySha256: SHA256_B,
    completionEvidenceRootKey: "evidence-root", toolEnvironmentSha256: SHA256_C,
  };
}

function completionConfiguration(fixture, created, evidencePath) {
  const environment = {};
  if (process.env.SystemRoot !== undefined) environment.SystemRoot = process.env.SystemRoot;
  if (process.env.WINDIR !== undefined) environment.WINDIR = process.env.WINDIR;
  return {
    gitExecutable: TEST_GIT_EXECUTABLE,
    workspaces: [{
      projectRootKey: "project-root-key", projectPath: fixture.projectRoot,
      repositoryIdentity: created.receipt.repositoryIdentity,
      workspaceId: "workspace", generation: 1, workspaceRevision: 2,
      workspaceRootKey: "workspace-root-key", workspacePath: created.receipt.canonicalPath,
      ownershipBindingSha256: created.receipt.ownershipBindingSha256,
      headObjectId: created.receipt.headObjectId,
    }],
    evidenceRoots: [{ rootKey: "evidence-root", path: evidencePath }],
    gates: [{
      commandKey: "command", commandIdentitySha256: SHA256_B, toolEnvironmentSha256: SHA256_C,
      executable: process.execPath,
      arguments: ["-e", "process.stdout.write('sensitive-gate-output')"],
      environment,
      maximumOutputBytes: 4096,
      passExitCodes: [0],
      passValiditySeconds: 120,
    }],
  };
}

function runGateRequest(created, suffix = "") {
  return {
    contractId: COMPLETION_CONTRACT_ID,
    operation: "run_gate",
    operationId: `gate-operation${suffix}`,
    intentId: `gate-intent${suffix}`,
    idempotencyKey: `gate-key${suffix}`,
    correlationId: `gate-correlation${suffix}`,
    causationId: null,
    actorId: "actor",
    finalAuthorizationDecisionId: "gate-decision",
    adapterId: LOCAL_COMPLETION_ADAPTER_ID,
    adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
    subject: completionSubject(created),
    timeoutMs: 5_000,
  };
}

function inspectGateRequest(request, suffix, lastObservationNumber = 1) {
  return {
    contractId: COMPLETION_CONTRACT_ID,
    operation: "inspect_gate",
    queryId: `gate-query-${suffix}`,
    correlationId: `gate-inspect-${suffix}`,
    causationId: request.operationId,
    actorId: "actor",
    readAuthorizationDecisionId: `gate-read-${suffix}`,
    adapterId: LOCAL_COMPLETION_ADAPTER_ID,
    adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
    subject: request.subject,
    gateOperationId: request.operationId,
    lastObservationNumber,
  };
}

function evidenceResultPath(evidencePath, result) {
  assert.match(result.receipt.evidenceReference, /^gate:[0-9a-f]{64}$/u);
  return path.join(evidencePath, result.receipt.evidenceReference.replace(/^gate:/u, "g-"), "result.json");
}

test("local completion backend executes one configured gate and persists digest-only immutable evidence", async () => {
  const fixture = createWorkspaceGitFixture("phase3-local-completion");
  const evidencePath = path.join(fixture.generation, "gate-evidence");
  mkdirSync(evidencePath);
  try {
    const reserved = fixture.adapter.reserve(workspaceRequest(fixture, "reserve"));
    assert.equal(reserved.ok, true);
    const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
    const configuration = completionConfiguration(fixture, created, evidencePath);
    const adapter = createLocalCompletionBackend(configuration, { now: () => BASE_TIME });
    const request = runGateRequest(created);
    const result = await adapter.runGate(request);
    assert.equal(result.ok, true, result.ok ? undefined : result.error.code);
    assert.equal(result.receipt.lifecycle, "completed");
    assert.equal(result.receipt.verdict, "pass");
    assert.equal(result.receipt.code, "gate_passed");
    assert.equal(result.receipt.validUntil, "2026-08-30T12:02:00.000Z");

    const entries = readdirSync(evidencePath);
    assert.equal(entries.length, 1);
    assert.match(entries[0], /^g-[0-9a-f]{64}$/u);
    const resultPath = path.join(evidencePath, entries[0], "result.json");
    const evidenceText = readFileSync(resultPath, "utf8");
    assert.equal(evidenceText.includes("sensitive-gate-output"), false);
    const evidence = JSON.parse(evidenceText);
    assert.equal(evidence.stdoutSha256, createHash("sha256").update("sensitive-gate-output").digest("hex").toUpperCase());

    const inspected = adapter.inspectGate({
      contractId: COMPLETION_CONTRACT_ID,
      operation: "inspect_gate",
      queryId: "gate-query",
      correlationId: "gate-inspect-correlation",
      causationId: request.operationId,
      actorId: "actor",
      readAuthorizationDecisionId: "gate-read-decision",
      adapterId: LOCAL_COMPLETION_ADAPTER_ID,
      adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
      subject: request.subject,
      gateOperationId: request.operationId,
      lastObservationNumber: 1,
    });
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.verdict, "pass");
    assert.equal(inspected.receipt.observationNumber, 2);

    appendFileSync(resultPath, "not-json", "utf8");
    const ambiguous = adapter.inspectGate({
      contractId: COMPLETION_CONTRACT_ID,
      operation: "inspect_gate",
      queryId: "gate-query-after-tamper",
      correlationId: "gate-inspect-after-tamper",
      causationId: request.operationId,
      actorId: "actor",
      readAuthorizationDecisionId: "gate-read-after-tamper",
      adapterId: LOCAL_COMPLETION_ADAPTER_ID,
      adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
      subject: request.subject,
      gateOperationId: request.operationId,
      lastObservationNumber: 2,
    });
    assert.equal(ambiguous.ok, true);
    assert.equal(ambiguous.receipt.lifecycle, "unknown");
    assert.equal(ambiguous.receipt.verdict, "indeterminate");
    assert.equal(ambiguous.receipt.code, "gate_evidence_ambiguous");

    assert.throws(() => createLocalCompletionBackend({
      ...configuration,
      evidenceRoots: [{ rootKey: "evidence-root", path: fixture.projectRoot }],
    }), /evidence root overlaps/u);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("local completion backend rejects deleted, replaced, hardlinked, reparse, and digest-drifted reopened evidence", async () => {
  const fixture = createWorkspaceGitFixture("phase3-completion-reopen-matrix");
  const evidencePath = path.join(fixture.generation, "gate-evidence-matrix");
  mkdirSync(evidencePath);
  try {
    assert.equal(fixture.adapter.reserve(workspaceRequest(fixture, "reserve")).ok, true);
    const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
    const adapter = createLocalCompletionBackend(completionConfiguration(fixture, created, evidencePath), {
      now: () => BASE_TIME,
    });
    const variants = ["deleted", "replaced", "hardlinked", "digest", "directory-swap", "junction"];
    for (const variant of variants) {
      const request = runGateRequest(created, `-${variant}`);
      const run = await adapter.runGate(request);
      assert.equal(run.ok, true, JSON.stringify(run));
      assert.equal(run.receipt.verdict, "pass");
      const firstInspection = adapter.inspectGate(inspectGateRequest(request, `before-${variant}`, 1));
      assert.equal(firstInspection.ok, true);
      assert.equal(firstInspection.receipt.verdict, "pass");
      const resultPath = evidenceResultPath(evidencePath, run);
      const directory = path.dirname(resultPath);
      const original = readFileSync(resultPath);
      const saved = path.join(fixture.generation, `saved-${variant}`);
      let restore;
      if (variant === "deleted") {
        renameSync(resultPath, saved);
        restore = () => renameSync(saved, resultPath);
      } else if (variant === "replaced") {
        renameSync(resultPath, saved);
        writeFileSync(resultPath, original, { flag: "wx" });
        restore = () => { unlinkSync(resultPath); renameSync(saved, resultPath); };
      } else if (variant === "hardlinked") {
        renameSync(resultPath, saved);
        linkSync(saved, resultPath);
        restore = () => { unlinkSync(resultPath); renameSync(saved, resultPath); };
      } else if (variant === "digest") {
        appendFileSync(resultPath, "digest drift", "utf8");
        restore = () => writeFileSync(resultPath, original);
      } else if (variant === "directory-swap") {
        renameSync(directory, saved);
        mkdirSync(directory);
        writeFileSync(resultPath, original, { flag: "wx" });
        restore = () => { unlinkSync(resultPath); rmdirSync(directory); renameSync(saved, directory); };
      } else {
        renameSync(directory, saved);
        symlinkSync(saved, directory, "junction");
        restore = () => { unlinkSync(directory); renameSync(saved, directory); };
      }
      try {
        const reopened = adapter.inspectGate(inspectGateRequest(request, `after-${variant}`, 2));
        assert.equal(reopened.ok, true);
        assert.equal(reopened.receipt.lifecycle, "unknown");
        assert.equal(reopened.receipt.verdict, "indeterminate");
        assert.equal(reopened.receipt.code, "gate_evidence_ambiguous");
      } finally {
        restore();
      }
    }
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("local completion backend closes read-open and publication directory-swap races", async () => {
  const fixture = createWorkspaceGitFixture("phase3-completion-open-races");
  const evidencePath = path.join(fixture.generation, "gate-evidence-races");
  mkdirSync(evidencePath);
  let beforeReadOpen = null;
  let beforePublishOpen = null;
  try {
    assert.equal(fixture.adapter.reserve(workspaceRequest(fixture, "reserve")).ok, true);
    const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
    const configuration = completionConfiguration(fixture, created, evidencePath);
    const adapter = createLocalCompletionBackend(configuration, {
      now: () => BASE_TIME,
      beforeEvidenceReadOpen() {
        const action = beforeReadOpen;
        beforeReadOpen = null;
        action?.();
      },
    });
    const readRequest = runGateRequest(created, "-read-race");
    const run = await adapter.runGate(readRequest);
    assert.equal(run.ok, true);
    const resultPath = evidenceResultPath(evidencePath, run);
    const original = readFileSync(resultPath);
    const savedLeaf = path.join(fixture.generation, "saved-read-race-result");
    beforeReadOpen = () => {
      renameSync(resultPath, savedLeaf);
      writeFileSync(resultPath, original, { flag: "wx" });
    };
    try {
      const raced = adapter.inspectGate(inspectGateRequest(readRequest, "read-race", 1));
      assert.equal(raced.ok, true);
      assert.equal(raced.receipt.lifecycle, "unknown");
      assert.equal(raced.receipt.verdict, "indeterminate");
    } finally {
      unlinkSync(resultPath);
      renameSync(savedLeaf, resultPath);
    }

    const publishAdapter = createLocalCompletionBackend(configuration, {
      now: () => BASE_TIME,
      beforeEvidencePublishOpen() { beforePublishOpen?.(); },
    });
    const known = new Set(readdirSync(evidencePath));
    let swapped = null;
    beforePublishOpen = () => {
      const acquired = readdirSync(evidencePath).find((name) => !known.has(name));
      if (acquired === undefined) return;
      const directory = path.join(evidencePath, acquired);
      const savedDirectory = path.join(fixture.generation, "saved-publish-race-directory");
      renameSync(directory, savedDirectory);
      mkdirSync(directory);
      swapped = { directory, savedDirectory };
    };
    const publishRequest = runGateRequest(created, "-publish-race");
    const publishResult = await publishAdapter.runGate(publishRequest);
    assert.equal(publishResult.ok, true);
    assert.equal(publishResult.receipt.lifecycle, "unknown");
    assert.equal(publishResult.receipt.verdict, "indeterminate");
    assert.ok(swapped);
    rmdirSync(swapped.directory);
    renameSync(swapped.savedDirectory, swapped.directory);
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("local completion backend refuses live source HEAD, ownership, and object-topology drift before spawn", async (context) => {
  const scenarios = ["metadata-only HEAD advance", "symbolic HEAD substitution", "ownership manifest replacement", "object alternates"];
  for (const [index, scenario] of scenarios.entries()) {
    await context.test(scenario, async () => {
      const fixture = createWorkspaceGitFixture(`phase3-completion-source-${index}`);
      const evidencePath = path.join(fixture.generation, `gate-evidence-source-${index}`);
      mkdirSync(evidencePath);
      let restore = () => {};
      try {
        assert.equal(fixture.adapter.reserve(workspaceRequest(fixture, "reserve")).ok, true);
        const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
        assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
        const configuration = completionConfiguration(fixture, created, evidencePath);
        if (scenario === "object alternates") {
          const objectDirectory = git(fixture, ["rev-parse", "--path-format=absolute", "--git-path", "objects"], {
            cwd: created.receipt.canonicalPath,
          }).trim();
          const alternates = path.join(objectDirectory, "info", "alternates");
          writeFileSync(alternates, `${path.join(fixture.generation, "foreign-objects")}\n`, { flag: "wx" });
          restore = () => unlinkSync(alternates);
          assert.throws(() => createLocalCompletionBackend(configuration), /repository configuration is unsafe/u);
          return;
        }
        let beforeGateEffect;
        const adapter = createLocalCompletionBackend(configuration, {
          now: () => BASE_TIME,
          beforeGateEffect() { beforeGateEffect?.(); },
        });
        const gitDirectory = git(fixture, ["rev-parse", "--absolute-git-dir"], {
          cwd: created.receipt.canonicalPath,
        }).trim();
        if (scenario === "metadata-only HEAD advance") {
          beforeGateEffect = () => git(fixture, [
            "-c", "user.name=ato-fixture", "-c", "user.email=ato-fixture.invalid",
            "commit", "--quiet", "--allow-empty", "-m", "metadata-only-drift",
          ], { cwd: created.receipt.canonicalPath });
        } else if (scenario === "symbolic HEAD substitution") {
          git(fixture, ["update-ref", "refs/heads/phase3-symbolic", created.receipt.headObjectId]);
          git(fixture, ["symbolic-ref", "HEAD", "refs/heads/phase3-symbolic"], { cwd: created.receipt.canonicalPath });
          restore = () => git(fixture, ["checkout", "--quiet", "--detach", created.receipt.headObjectId], {
            cwd: created.receipt.canonicalPath,
          });
        } else {
          const manifestPath = path.join(gitDirectory, "ato-workspace-ownership-v1.json");
          const original = readFileSync(manifestPath);
          const saved = path.join(fixture.generation, "saved-source-manifest");
          renameSync(manifestPath, saved);
          writeFileSync(manifestPath, original, { flag: "wx" });
          restore = () => { unlinkSync(manifestPath); renameSync(saved, manifestPath); };
        }
        const result = await adapter.runGate(runGateRequest(created, `-source-${index}`));
        if (scenario === "metadata-only HEAD advance") {
          assert.equal(result.ok, true);
          assert.equal(result.receipt.lifecycle, "unknown");
          assert.equal(result.receipt.verdict, "indeterminate");
        } else {
          assert.equal(result.ok, false);
          assert.equal(result.error.code, "completion_binding_drift");
        }
      } finally {
        restore();
        cleanupWorkspaceGitFixture(fixture);
      }
    });
  }
});

function integrationSubject(fixture, created, sourceHead, destinationPath) {
  return {
    projectId: "project", projectResourceRevision: 1, projectConfigRevision: 1,
    projectRootKey: "project-root-key", repositoryIdentity: created.receipt.repositoryIdentity,
    objectFormat: "sha1", targetReference: "refs/heads/integration",
    expectedTargetObjectId: fixture.baseObjectId,
    sourceWorkspaceId: "workspace", sourceGeneration: 1, sourceWorkspaceRevision: 2,
    sourceWorkspaceRootKey: "workspace-root-key", sourceOwnershipBindingSha256: fixture.ownershipBindingSha256,
    sourceHeadObjectId: sourceHead,
    reservationId: "reservation", reservationRevision: 1, reservationStatus: "active",
    reservationOwnerExecutionId: "execution", reservationOwnerOperationId: "reservation-operation",
    reservationLeaseOwnerId: "lease-owner", reservationLeaseRevision: 1, reservationFencingToken: 1,
    reservationExpiresAt: "2026-08-30T12:10:00.000Z", policyReceiptId: "policy-receipt",
    policyConfigRevision: 1, destinationIdentity: "local-bare",
    destinationReference: "refs/heads/integration", expectedRemoteHead: null,
    destinationPath,
  };
}

function integrationRequest(operation, subject, observationNumber) {
  const common = {
    contractId: INTEGRATION_CONTRACT_ID,
    operation,
    correlationId: `integration-${operation}-correlation`,
    causationId: "reservation-operation",
    actorId: "actor",
    adapterId: LOCAL_GIT_INTEGRATION_ADAPTER_ID,
    adapterVersion: LOCAL_GIT_INTEGRATION_ADAPTER_VERSION,
    subject,
  };
  return operation === "inspect"
    ? { ...common, queryId: "integration-query", readAuthorizationDecisionId: "integration-read-decision",
        lastObservationNumber: observationNumber }
    : { ...common, operationId: `integration-${operation}-operation`, intentId: `integration-${operation}-intent`,
        idempotencyKey: `integration-${operation}-key`, finalAuthorizationDecisionId: `integration-${operation}-decision`,
        expectedObservationNumber: observationNumber };
}

function prepareIntegrationFixture(label) {
  const fixture = createWorkspaceGitFixture(label);
  assert.equal(fixture.adapter.reserve(workspaceRequest(fixture, "reserve")).ok, true);
  const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
  assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
  writeFileSync(path.join(created.receipt.canonicalPath, "phase3.txt"), "phase 3 integration fixture\n", { flag: "wx" });
  git(fixture, ["add", "--", "phase3.txt"], { cwd: created.receipt.canonicalPath });
  git(fixture, ["-c", "user.name=ato-fixture", "-c", "user.email=ato-fixture.invalid",
    "commit", "--quiet", "-m", "phase3-source"], { cwd: created.receipt.canonicalPath });
  const sourceHead = git(fixture, ["rev-parse", "HEAD"], { cwd: created.receipt.canonicalPath }).trim();
  git(fixture, ["update-ref", "refs/heads/integration", fixture.baseObjectId]);
  const destinationPath = path.join(fixture.generation, "integration-destination.git");
  mkdirSync(destinationPath);
  git(fixture, ["init", "--bare", "--quiet", destinationPath]);
  const subject = integrationSubject(fixture, created, sourceHead, destinationPath);
  const { destinationPath: _destinationPath, ...portSubject } = subject;
  const configuration = {
    gitExecutable: TEST_GIT_EXECUTABLE,
    trustedDisposableRoot: fixture.generation,
    bindings: [{
      projectRootKey: subject.projectRootKey,
      projectPath: fixture.projectRoot,
      repositoryIdentity: subject.repositoryIdentity,
      sourceWorkspaceId: subject.sourceWorkspaceId,
      sourceGeneration: subject.sourceGeneration,
      sourceWorkspaceRevision: subject.sourceWorkspaceRevision,
      sourceWorkspaceRootKey: subject.sourceWorkspaceRootKey,
      sourceWorkspacePath: created.receipt.canonicalPath,
      sourceOwnershipBindingSha256: subject.sourceOwnershipBindingSha256,
      sourceHeadObjectId: subject.sourceHeadObjectId,
      destinationIdentity: subject.destinationIdentity,
      destinationPath,
    }],
  };
  return Object.freeze({ fixture, created, sourceHead, destinationPath, portSubject, configuration });
}

function currentWorkspaceMaterial(state, fixture) {
  const workspace = state.workspaceGenerations[0];
  assert.ok(workspace);
  const receipts = state.workspaceReceipts.filter((candidate) => candidate.workspaceId === workspace.workspaceId &&
    candidate.generation === workspace.generation && candidate.outcome === "succeeded" && candidate.externalState === "complete" &&
    state.workspaceFinalizations.some((finalization) => finalization.verifiedReceiptId === candidate.verifiedReceiptId &&
      finalization.resultingGenerationStatus === "ready" && finalization.resultingGenerationRevision === workspace.revision));
  let receipt = null;
  for (const candidate of receipts) {
    if (receipt === null || candidate.verifiedAt >= receipt.verifiedAt) receipt = candidate;
  }
  assert.ok(receipt?.repositoryIdentity && receipt.headObjectId && receipt.ownershipBindingSha256);
  const workspaceDigest = createHash("sha256").update(workspace.workspaceId).digest("hex");
  const canonicalPath = path.join(fixture.workspaceRoot, "ato-workspaces", `w-${workspaceDigest}-g${workspace.generation}`);
  assert.equal(existsSync(canonicalPath), true);
  return Object.freeze({ workspace, receipt, canonicalPath });
}

function composedCompletionConfiguration(state, fixture, evidencePath) {
  const project = state.projects[0];
  const material = currentWorkspaceMaterial(state, fixture);
  assert.ok(project);
  const environment = {};
  if (process.env.SystemRoot !== undefined) environment.SystemRoot = process.env.SystemRoot;
  if (process.env.WINDIR !== undefined) environment.WINDIR = process.env.WINDIR;
  return {
    gitExecutable: TEST_GIT_EXECUTABLE,
    workspaces: [{
      projectRootKey: project.rootKey,
      projectPath: fixture.projectRoot,
      repositoryIdentity: material.receipt.repositoryIdentity,
      workspaceId: material.workspace.workspaceId,
      generation: material.workspace.generation,
      workspaceRevision: material.workspace.revision,
      workspaceRootKey: material.workspace.workspaceRootKey,
      workspacePath: material.canonicalPath,
      ownershipBindingSha256: material.receipt.ownershipBindingSha256,
      headObjectId: material.receipt.headObjectId,
    }],
    evidenceRoots: [{ rootKey: "phase3-composed-evidence", path: evidencePath }],
    gates: [{
      commandKey: "command",
      commandIdentitySha256: SHA256_B,
      toolEnvironmentSha256: SHA256_C,
      executable: process.execPath,
      arguments: ["-e", "process.stdout.write('composed-gate-output')"],
      environment,
      maximumOutputBytes: 4096,
      passExitCodes: [0],
      passValiditySeconds: 300,
    }],
  };
}

function composedIntegrationConfiguration(state, fixture, destinationPath) {
  const project = state.projects[0];
  const material = currentWorkspaceMaterial(state, fixture);
  assert.ok(project);
  return {
    gitExecutable: TEST_GIT_EXECUTABLE,
    trustedDisposableRoot: fixture.generation,
    bindings: [{
      projectRootKey: project.rootKey,
      projectPath: fixture.projectRoot,
      repositoryIdentity: material.receipt.repositoryIdentity,
      sourceWorkspaceId: material.workspace.workspaceId,
      sourceGeneration: material.workspace.generation,
      sourceWorkspaceRevision: material.workspace.revision,
      sourceWorkspaceRootKey: material.workspace.workspaceRootKey,
      sourceWorkspacePath: material.canonicalPath,
      sourceOwnershipBindingSha256: material.receipt.ownershipBindingSha256,
      sourceHeadObjectId: material.receipt.headObjectId,
      destinationIdentity: "phase3-composed-bare",
      destinationPath,
    }],
  };
}

function composedPhase3Options(baseObjectId) {
  return Object.freeze({
    policyId: "policy",
    policyKey: "policy-key",
    policyAdapterId: LOCAL_PROJECT_POLICY_ADAPTER_ID,
    policyAdapterVersion: LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
    completionAdapterId: LOCAL_COMPLETION_ADAPTER_ID,
    completionAdapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
    completionEvidenceRootKey: "phase3-composed-evidence",
    gateTimeoutMs: 30_000,
    integrationAdapterId: LOCAL_GIT_INTEGRATION_ADAPTER_ID,
    integrationAdapterVersion: LOCAL_GIT_INTEGRATION_ADAPTER_VERSION,
    integrationTargetReference: "refs/heads/integration",
    integrationExpectedTargetObjectId: baseObjectId,
    integrationDestinationIdentity: "phase3-composed-bare",
    integrationDestinationReference: "refs/heads/integration",
    integrationExpectedRemoteHead: null,
    integrationReservationLeaseSeconds: 600,
    workspaceAdapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
    workspaceAdapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
    cleanupAttestationValiditySeconds: 300,
  });
}

test("local Git integration backend inspects, fast-forwards, and pushes only inside one disposable local fixture", { skip: process.platform !== "win32" }, () => {
  const fixture = createWorkspaceGitFixture("phase3-local-integration");
  try {
    const reserved = fixture.adapter.reserve(workspaceRequest(fixture, "reserve"));
    assert.equal(reserved.ok, true);
    const created = fixture.adapter.create(workspaceRequest(fixture, "create"));
    assert.equal(created.ok, true, created.ok ? undefined : created.error.code);
    writeFileSync(path.join(created.receipt.canonicalPath, "phase3.txt"), "phase 3 integration fixture\n", { flag: "wx" });
    git(fixture, ["add", "--", "phase3.txt"], { cwd: created.receipt.canonicalPath });
    git(fixture, ["-c", "user.name=ato-fixture", "-c", "user.email=ato-fixture.invalid",
      "commit", "--quiet", "-m", "phase3-source"], { cwd: created.receipt.canonicalPath });
    const sourceHead = git(fixture, ["rev-parse", "HEAD"], { cwd: created.receipt.canonicalPath }).trim();
    git(fixture, ["update-ref", "refs/heads/integration", fixture.baseObjectId]);
    const destinationPath = path.join(fixture.generation, "integration-destination.git");
    mkdirSync(destinationPath);
    git(fixture, ["init", "--bare", "--quiet", destinationPath]);

    const subject = integrationSubject(fixture, created, sourceHead, destinationPath);
    const { destinationPath: _destinationPath, ...portSubject } = subject;
    const adapter = createLocalGitIntegrationBackend({
      gitExecutable: TEST_GIT_EXECUTABLE,
      trustedDisposableRoot: fixture.generation,
      bindings: [{
        projectRootKey: subject.projectRootKey,
        projectPath: fixture.projectRoot,
        repositoryIdentity: subject.repositoryIdentity,
        sourceWorkspaceId: subject.sourceWorkspaceId,
        sourceGeneration: subject.sourceGeneration,
        sourceWorkspaceRevision: subject.sourceWorkspaceRevision,
        sourceWorkspaceRootKey: subject.sourceWorkspaceRootKey,
        sourceWorkspacePath: created.receipt.canonicalPath,
        sourceOwnershipBindingSha256: subject.sourceOwnershipBindingSha256,
        sourceHeadObjectId: subject.sourceHeadObjectId,
        destinationIdentity: subject.destinationIdentity,
        destinationPath,
      }],
    }, { now: () => BASE_TIME });

    const inspected = adapter.inspect(integrationRequest("inspect", portSubject, 0));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.receipt.code, "inspected_unchanged");
    const applied = adapter.apply(integrationRequest("apply", portSubject, 1));
    assert.equal(applied.ok, true, applied.ok ? undefined : applied.error.code);
    assert.equal(applied.receipt.code, "applied");
    assert.equal(git(fixture, ["rev-parse", "refs/heads/integration"]).trim(), sourceHead);
    const pushed = adapter.push(integrationRequest("push", portSubject, 2));
    assert.equal(pushed.ok, true, pushed.ok ? undefined : pushed.error.code);
    assert.equal(pushed.receipt.code, "pushed", JSON.stringify(pushed.receipt));
    assert.equal(git(fixture, ["--git-dir", destinationPath, "rev-parse", "refs/heads/integration"]).trim(), sourceHead);
    const finalInspection = adapter.inspect(integrationRequest("inspect", portSubject, 3));
    assert.equal(finalInspection.ok, true);
    assert.equal(finalInspection.receipt.code, "inspected_pushed");
  } finally {
    cleanupWorkspaceGitFixture(fixture);
  }
});

test("local Git integration backend revalidates source HEAD and gitdir immediately before ref mutation", { skip: process.platform !== "win32" }, async (context) => {
  for (const [index, scenario] of ["metadata-only HEAD advance", "gitdir pointer replacement"].entries()) {
    await context.test(scenario, () => {
      const setup = prepareIntegrationFixture(`phase3-integration-drift-${index}`);
      let restore = () => {};
      try {
        const gitFile = path.join(setup.created.receipt.canonicalPath, ".git");
        const adapter = createLocalGitIntegrationBackend(setup.configuration, {
          now: () => BASE_TIME,
          beforeEffect(operation) {
            assert.equal(operation, "apply");
            if (scenario === "metadata-only HEAD advance") {
              git(setup.fixture, [
                "-c", "user.name=ato-fixture", "-c", "user.email=ato-fixture.invalid",
                "commit", "--quiet", "--allow-empty", "-m", "integration-source-drift",
              ], { cwd: setup.created.receipt.canonicalPath });
            } else {
              const saved = path.join(setup.fixture.generation, "saved-integration-gitfile");
              renameSync(gitFile, saved);
              writeFileSync(gitFile, `gitdir: ${path.join(setup.fixture.projectRoot, ".git")}\n`, { flag: "wx" });
              restore = () => { unlinkSync(gitFile); renameSync(saved, gitFile); };
            }
          },
        });
        const applied = adapter.apply(integrationRequest("apply", setup.portSubject, 1));
        assert.equal(applied.ok, true, JSON.stringify(applied));
        assert.equal(applied.receipt.code, "apply_refused");
        assert.equal(applied.receipt.localState, "unchanged");
        assert.equal(git(setup.fixture, ["rev-parse", "refs/heads/integration"]).trim(), setup.fixture.baseObjectId);
      } finally {
        restore();
        cleanupWorkspaceGitFixture(setup.fixture);
      }
    });
  }
});

test("local Git integration backend rechecks target checkout immediately before ref mutation", { skip: process.platform !== "win32" }, () => {
  const setup = prepareIntegrationFixture("phase3-integration-target-checkout-race");
  const checkedOutPath = path.join(setup.fixture.generation, "Target Checkout café");
  let checkoutRegistered = false;
  let checkedOutBefore;
  try {
    let effectCalls = 0;
    const adapter = createLocalGitIntegrationBackend(setup.configuration, {
      now: () => BASE_TIME,
      beforeEffect(operation) {
        effectCalls += 1;
        assert.equal(operation, "apply");
        git(setup.fixture, ["worktree", "add", "--quiet", checkedOutPath, "integration"]);
        checkoutRegistered = true;
        checkedOutBefore = Object.freeze({
          head: git(setup.fixture, ["rev-parse", "HEAD"], { cwd: checkedOutPath }).trim(),
          status: git(setup.fixture, ["status", "--porcelain=v2", "--untracked-files=all"], { cwd: checkedOutPath }),
        });
        assert.deepEqual(checkedOutBefore, { head: setup.fixture.baseObjectId, status: "" });
      },
    });
    const applied = adapter.apply(integrationRequest("apply", setup.portSubject, 1));
    assert.equal(effectCalls, 1);
    assert.equal(applied.ok, true, JSON.stringify(applied));
    assert.equal(applied.receipt.code, "apply_refused");
    assert.equal(applied.receipt.localState, "unchanged");
    assert.equal(git(setup.fixture, ["rev-parse", "refs/heads/integration"]).trim(), setup.fixture.baseObjectId);
    assert.deepEqual({
      head: git(setup.fixture, ["rev-parse", "HEAD"], { cwd: checkedOutPath }).trim(),
      status: git(setup.fixture, ["status", "--porcelain=v2", "--untracked-files=all"], { cwd: checkedOutPath }),
    }, checkedOutBefore);
  } finally {
    try {
      if (checkoutRegistered && existsSync(checkedOutPath) &&
          git(setup.fixture, ["status", "--porcelain=v2", "--untracked-files=all"], { cwd: checkedOutPath }) === "") {
        git(setup.fixture, ["worktree", "remove", checkedOutPath]);
      }
    } finally {
      cleanupWorkspaceGitFixture(setup.fixture);
    }
  }
});

test("local Git integration backend rejects escaped gitdir/common/object topology and alternates at configuration", { skip: process.platform !== "win32" }, async (context) => {
  for (const [index, scenario] of ["gitdir escape", "common-directory escape", "object alternates"].entries()) {
    await context.test(scenario, () => {
      const setup = prepareIntegrationFixture(`phase3-integration-topology-${index}`);
      const external = createWorkspaceGitFixture(`phase3-integration-external-${index}`);
      let restore = () => {};
      try {
        const gitFile = path.join(setup.created.receipt.canonicalPath, ".git");
        const gitDirectory = git(setup.fixture, ["rev-parse", "--absolute-git-dir"], {
          cwd: setup.created.receipt.canonicalPath,
        }).trim();
        if (scenario === "gitdir escape") {
          const original = readFileSync(gitFile);
          writeFileSync(gitFile, `gitdir: ${path.join(external.projectRoot, ".git")}\n`);
          restore = () => writeFileSync(gitFile, original);
        } else if (scenario === "common-directory escape") {
          const commonFile = path.join(gitDirectory, "commondir");
          const original = readFileSync(commonFile);
          writeFileSync(commonFile, `${path.join(external.projectRoot, ".git")}\n`);
          restore = () => writeFileSync(commonFile, original);
        } else {
          const objectDirectory = git(setup.fixture, ["rev-parse", "--path-format=absolute", "--git-path", "objects"], {
            cwd: setup.created.receipt.canonicalPath,
          }).trim();
          const alternates = path.join(objectDirectory, "info", "alternates");
          writeFileSync(alternates, `${path.join(external.projectRoot, ".git", "objects")}\n`, { flag: "wx" });
          restore = () => unlinkSync(alternates);
        }
        assert.throws(() => createLocalGitIntegrationBackend(setup.configuration),
          /topology|escapes|configuration is unsafe|identity/u);
      } finally {
        restore();
        cleanupWorkspaceGitFixture(external);
        cleanupWorkspaceGitFixture(setup.fixture);
      }
    });
  }
});

test("Windows Phase 3 composed facade rejects stale HEAD evidence, reruns gates, integrates, completes, cleans, and restarts", { skip: process.platform !== "win32" }, async () => {
  const fixture = createWorkspaceGitFixture("phase3-composed-facade");
  const sourceCheckoutRoot = path.join(fixture.generation, "source-checkout");
  const evidencePath = path.join(fixture.generation, "completion-evidence");
  const destinationPath = path.join(fixture.generation, "integration-destination.git");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(evidencePath);
  mkdirSync(destinationPath);
  git(fixture, ["init", "--bare", "--quiet", destinationPath]);
  git(fixture, ["update-ref", "refs/heads/integration", fixture.baseObjectId]);
  const layout = prepareRuntimeLayout({
    runtimeRoot: path.join(fixture.generation, "runtime"),
    sourceCheckoutRoot,
    projectRoots: [fixture.projectRoot],
  });
  const ingress = composedIngress("facade");
  let store = await openPersistence(layout, { applicationVersion: "phase3-composed-e2e" });
  let storeOpen = true;
  try {
    const application = createApplicationService(store, ingress);
    const expiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt }).ok, true);
    ingress.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
    assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    assert.equal(application.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "task",
      body: "composed phase3 task",
      supersedesTaskId: null,
    }).ok, true);
    assert.equal(application.execute({
      kind: "task.mark_ready",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "task",
      expectedTaskRevision: 1,
    }).ok, true);
    for (let index = 0; index < 5; index += 1) {
      assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt }).ok, true);
    }

    const manual = createManualExecutionBackend(store, { ingress });
    const product = createProductRuntime(store, ingress, manual, manual);
    const dispatched = product.dispatchRun({
      kind: "dispatch.run",
      idempotencyKey: "phase3-composed-dispatch",
      leaseDurationSeconds: 900,
    });
    assert.equal(dispatched.ok, true, JSON.stringify(dispatched));

    let state = readApplicationStateForOwner(store);
    const registeredProject = state.projects[0];
    assert.ok(registeredProject);
    const workspaceBackend = createWindowsGitWorkspaceBackend({
      gitExecutable: TEST_GIT_EXECUTABLE,
      projectRoots: [{ rootKey: registeredProject.rootKey, path: fixture.projectRoot }],
      workspaceRoots: [{ rootKey: "phase3-composed-workspace-root", path: fixture.workspaceRoot }],
    });
    const workspaceService = createWorkspaceApplicationService(store, workspaceBackend, ingress, {
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
      workspaceRootKey: "phase3-composed-workspace-root",
    });
    const reservedWorkspace = workspaceService.reserve({
      kind: "workspace.reserve",
      ...composedWorkspaceOwner(state, "phase3-composed-workspace-reserve"),
      baseReference: fixture.baseObjectId,
      predecessorWorkspaceId: null,
      predecessorGeneration: null,
      predecessorRevision: null,
    });
    assert.equal(reservedWorkspace.ok, true, JSON.stringify(reservedWorkspace));
    state = readApplicationStateForOwner(store);
    const allocated = state.workspaceGenerations[0];
    const createdWorkspace = workspaceService.create({
      kind: "workspace.create",
      ...composedWorkspaceOwner(state, "phase3-composed-workspace-create"),
      workspaceId: allocated.workspaceId,
      expectedGeneration: allocated.generation,
      expectedGenerationRevision: allocated.revision,
    });
    assert.equal(createdWorkspace.ok, true, JSON.stringify(createdWorkspace));

    state = readApplicationStateForOwner(store);
    const reported = product.recordManualOutcome({
      kind: "manual.outcome-report",
      ...composedProductCommand(state, "phase3-composed-manual-outcome"),
      reportId: "phase3-composed-manual-report",
      outcome: "succeed",
      code: "manual-success",
      evidenceReference: "phase3-composed-manual-evidence",
    });
    assert.equal(reported.ok, true, JSON.stringify(reported));

    const options = composedPhase3Options(fixture.baseObjectId);
    const policy = createLocalProjectPolicy(policyConfiguration("required", "required", 300, "allow"), ingress);
    state = readApplicationStateForOwner(store);
    const oldService = createPhase3ProductRuntime(store, ingress, {
      projectPolicy: policy,
      completion: createLocalCompletionBackend(composedCompletionConfiguration(state, fixture, evidencePath), ingress),
      integration: createLocalGitIntegrationBackend(composedIntegrationConfiguration(state, fixture, destinationPath), ingress),
      workspace: workspaceBackend,
    }, options);
    const oldPolicy = await oldService.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...phase3Binding(state),
    });
    assert.equal(oldPolicy.ok, true, JSON.stringify(oldPolicy));
    const oldGate = await oldService.runGate({
      kind: "completion.gate.run",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: oldPolicy.value.receiptId,
      gateId: "gate",
      gateVersion: "1",
      idempotencyKey: "phase3-composed-old-gate",
    });
    assert.equal(oldGate.ok, true, JSON.stringify(oldGate));
    const oldInspection = await oldService.inspectGate({
      kind: "completion.gate.inspect",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: oldPolicy.value.receiptId,
      gateOperationId: oldGate.value.gateOperationId,
      idempotencyKey: "phase3-composed-old-gate-inspect",
    });
    assert.equal(oldInspection.ok, true, JSON.stringify(oldInspection));

    const initialMaterial = currentWorkspaceMaterial(readApplicationStateForOwner(store), fixture);
    writeFileSync(path.join(initialMaterial.canonicalPath, "phase3-composed.txt"), "composed source result\n", { flag: "wx" });
    git(fixture, ["add", "--", "phase3-composed.txt"], { cwd: initialMaterial.canonicalPath });
    git(fixture, ["-c", "user.name=ato-fixture", "-c", "user.email=ato-fixture.invalid",
      "commit", "--quiet", "-m", "phase3-composed-source"], { cwd: initialMaterial.canonicalPath });
    const sourceHead = git(fixture, ["rev-parse", "HEAD"], { cwd: initialMaterial.canonicalPath }).trim();
    assert.notEqual(sourceHead, fixture.baseObjectId);

    state = readApplicationStateForOwner(store);
    const readyBeforeInspect = state.workspaceGenerations[0];
    const inspectedWorkspace = workspaceService.inspect({
      kind: "workspace.inspect",
      ...composedWorkspaceOwner(state, "phase3-composed-workspace-inspect"),
      workspaceId: readyBeforeInspect.workspaceId,
      expectedGeneration: readyBeforeInspect.generation,
      expectedGenerationRevision: readyBeforeInspect.revision,
    });
    assert.equal(inspectedWorkspace.ok, true, JSON.stringify(inspectedWorkspace));
    state = readApplicationStateForOwner(store);
    assert.equal(currentWorkspaceMaterial(state, fixture).receipt.headObjectId, sourceHead, JSON.stringify({
      inspectedWorkspace,
      workspace: state.workspaceGenerations[0],
      receipts: state.workspaceReceipts,
      finalizations: state.workspaceFinalizations,
      adminEntries: readdirSync(git(fixture, ["rev-parse", "--absolute-git-dir"], { cwd: initialMaterial.canonicalPath }).trim()),
    }));
    const staleCompletion = await oldService.acceptCompletion({
      kind: "completion.accept",
      ...phase3Binding(state),
      policyReceiptId: oldPolicy.value.receiptId,
      idempotencyKey: "phase3-composed-stale-completion",
    });
    assert.equal(staleCompletion.ok, false);
    assert.equal(staleCompletion.error.code, "EVIDENCE_STALE");
    assert.equal(readApplicationStateForOwner(store).domain.tasks[0].state, "running");

    state = readApplicationStateForOwner(store);
    const currentService = createPhase3ProductRuntime(store, ingress, {
      projectPolicy: createLocalProjectPolicy(policyConfiguration("required", "required", 300, "allow"), ingress),
      completion: createLocalCompletionBackend(composedCompletionConfiguration(state, fixture, evidencePath), ingress),
      integration: createLocalGitIntegrationBackend(composedIntegrationConfiguration(state, fixture, destinationPath), ingress),
      workspace: workspaceBackend,
    }, options);
    const completionPolicy = await currentService.evaluateCompletionPolicy({
      kind: "policy.completion_requirements",
      ...phase3Binding(state),
    });
    assert.equal(completionPolicy.ok, true, JSON.stringify(completionPolicy));
    const currentGate = await currentService.runGate({
      kind: "completion.gate.run",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: completionPolicy.value.receiptId,
      gateId: "gate",
      gateVersion: "1",
      idempotencyKey: "phase3-composed-current-gate",
    });
    assert.equal(currentGate.ok, true, JSON.stringify(currentGate));
    const currentInspection = await currentService.inspectGate({
      kind: "completion.gate.inspect",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: completionPolicy.value.receiptId,
      gateOperationId: currentGate.value.gateOperationId,
      idempotencyKey: "phase3-composed-current-gate-inspect",
    });
    assert.equal(currentInspection.ok, true, JSON.stringify(currentInspection));

    const integrationPolicy = await currentService.evaluateIntegrationPolicy({
      kind: "policy.evaluate_integration",
      ...phase3Binding(readApplicationStateForOwner(store)),
    });
    assert.equal(integrationPolicy.ok, true, JSON.stringify(integrationPolicy));
    const reservation = await currentService.reserveIntegration({
      kind: "integration.reserve",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: integrationPolicy.value.receiptId,
      idempotencyKey: "phase3-composed-reservation",
    });
    assert.equal(reservation.ok, true, JSON.stringify(reservation));
    const integrationInspection = await currentService.inspectIntegration({
      kind: "integration.inspect",
      ...composedIntegrationCommand(readApplicationStateForOwner(store), "phase3-composed-integration-inspect"),
    });
    assert.equal(integrationInspection.ok, true, JSON.stringify(integrationInspection));
    assert.equal(integrationInspection.value.code, "inspected_unchanged");
    const applied = await currentService.applyIntegration({
      kind: "integration.apply",
      ...composedIntegrationCommand(readApplicationStateForOwner(store), "phase3-composed-integration-apply"),
    });
    assert.equal(applied.ok, true, JSON.stringify(applied));
    assert.equal(applied.value.code, "applied");
    const pushed = await currentService.pushIntegration({
      kind: "integration.push",
      ...composedIntegrationCommand(readApplicationStateForOwner(store), "phase3-composed-integration-push"),
    });
    assert.equal(pushed.ok, true, JSON.stringify(pushed));
    assert.equal(pushed.value.code, "pushed");
    assert.equal(git(fixture, ["rev-parse", "refs/heads/integration"]).trim(), sourceHead);
    assert.equal(git(fixture, ["--git-dir", destinationPath, "rev-parse", "refs/heads/integration"]).trim(), sourceHead);

    const completed = await currentService.acceptCompletion({
      kind: "completion.accept",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: completionPolicy.value.receiptId,
      idempotencyKey: "phase3-composed-completion",
    });
    assert.equal(completed.ok, true, JSON.stringify(completed));
    assert.equal(completed.value.preservationStateSha256, completed.value.integrationEvidenceSha256);
    const released = await currentService.releaseIntegration({
      kind: "integration.release",
      ...composedIntegrationCommand(readApplicationStateForOwner(store), "phase3-composed-integration-release"),
    });
    assert.equal(released.ok, true, JSON.stringify(released));
    assert.equal(released.value.status, "released");
    const cleanupPolicy = await currentService.evaluateCleanupPolicy({
      kind: "policy.evaluate_cleanup",
      ...phase3Binding(readApplicationStateForOwner(store)),
    });
    assert.equal(cleanupPolicy.ok, true, JSON.stringify(cleanupPolicy));
    const cleaned = await currentService.cleanupWorkspace({
      kind: "workspace.cleanup",
      ...phase3Binding(readApplicationStateForOwner(store)),
      policyReceiptId: cleanupPolicy.value.receiptId,
      idempotencyKey: "phase3-composed-cleanup",
    });
    assert.equal(cleaned.ok, true, JSON.stringify(cleaned));
    assert.equal(cleaned.value.workspaceStatus, "cleaned");
    assert.equal(existsSync(initialMaterial.canonicalPath), false);

    const evidenceDirectories = readdirSync(evidencePath).sort();
    assert.equal(evidenceDirectories.length, 2);
    for (const directory of evidenceDirectories) {
      const evidence = readFileSync(path.join(evidencePath, directory, "result.json"), "utf8");
      assert.equal(evidence.includes("composed-gate-output"), false);
    }
    await store.close();
    storeOpen = false;
    store = await openPersistence(layout, { applicationVersion: "phase3-composed-e2e" });
    storeOpen = true;
    const reopened = readApplicationStateForOwner(store);
    assert.equal(reopened.domain.tasks[0].state, "completed");
    assert.equal(reopened.workspaceGenerations[0].status, "cleaned");
    assert.equal(reopened.integrationReservations[0].status, "released");
    assert.equal(reopened.executionTerminalStates.length, 1);
    assert.equal(reopened.policyGatedCompletionDecisions.length, 1);
    assert.equal(readdirSync(evidencePath).length, 2);
  } finally {
    if (storeOpen) await store.close();
    cleanupWorkspaceGitFixture(fixture);
  }
});
