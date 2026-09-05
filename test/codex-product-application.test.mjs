import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApplicationService, openPersistence } from "../src/index.ts";
import { createCodexExecutionBackend } from "../src/codex-execution-backend.ts";
import { createCodexProductApplicationWithDependencies } from "../src/codex-product-application.ts";
import { inspectCodexProfileConfiguration } from "../src/codex-product-configuration.ts";
import { createCodexTargetedDispatcherService } from "../src/dispatcher-application.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import { createFakeWorkspaceBackend } from "./fixtures/fake-workspace-backend.mjs";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const ACTOR = "codex-product-operator";
const PRINCIPAL = "C".repeat(64);
const EXPIRY = "2026-09-25T12:00:00.000Z";
const TASK_BODY = "SENTINEL EP03F PRIVATE TASK BODY";

function testSha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function ingress(label) {
  let sequence = 0;
  let milliseconds = Date.parse("2026-09-05T01:00:00.000Z");
  let runtimeRootKey = "pending-runtime";
  let actorId = ACTOR;
  let principal = PRINCIPAL;
  let codexConfirmationCount = 0;
  let codexConfirmationFailure = null;
  let confirmationHook = null;
  let dispatcherOwner = "codex-dispatch-owner";
  return {
    currentActor: () => ({ actorId, principal }),
    currentLeaseOwner: () => "codex-execution-owner",
    currentWorkerOwner: () => "codex-dispatch-owner",
    currentExecutionLeaseOwner: () => "codex-execution-owner",
    currentDispatcherOwner: () => dispatcherOwner,
    currentRuntimeRootKey: () => runtimeRootKey,
    now: () => new Date(milliseconds += 1_000).toISOString(),
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    confirmOperation: ({ action }) => {
      if (action === "codex.execution.invoke") {
        codexConfirmationCount += 1;
        if (codexConfirmationFailure?.ordinal === codexConfirmationCount) {
          if (codexConfirmationFailure.mode === "throw") throw new Error("confirmation failed");
          return null;
        }
      }
      const callback = confirmationHook;
      confirmationHook = null;
      callback?.(action);
      return { confirmationId: `confirmation-${action}-${++sequence}` };
    },
    setRuntimeRootKey(value) { runtimeRootKey = value; },
    setActor(value, valuePrincipal = PRINCIPAL) { actorId = value; principal = valuePrincipal; },
    setNow(value) { milliseconds = Date.parse(value) - 1_000; },
    afterNextConfirmation(callback) { confirmationHook = callback; },
    failCodexConfirmation(ordinal, mode = "null") {
      codexConfirmationFailure = { ordinal, mode };
    },
    setDispatcherOwner(value) { dispatcherOwner = value; },
  };
}

async function setup(label, terminal = "turn.failed", hooks = Object.freeze({})) {
  const fixture = createPersistenceFixture(label);
  const trusted = ingress(label);
  const workspaceRoot = path.join(fixture.generation, "codex-workspaces");
  const codexHome = path.join(fixture.generation, "codex-home");
  mkdirSync(workspaceRoot);
  mkdirSync(codexHome);
  const store = await openPersistence(fixture.layout, { applicationVersion: "ep03f-test" });
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRY }).ok, true);
  trusted.setRuntimeRootKey(readApplicationStateForOwner(store).bootstrap.rootKey);
  assert.equal(application.execute({
    kind: "project.register", projectId: "project", root: fixture.projectRoot,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.create", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", body: TASK_BODY, supersedesTaskId: null,
  }).ok, true);
  assert.equal(application.execute({
    kind: "task.mark_ready", projectId: "project", expectedProjectResourceRevision: 1,
    taskId: "task", expectedTaskRevision: 1,
  }).ok, true);
  for (let index = 0; index < 7; index += 1) {
    const upgraded = application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRY });
    assert.equal(upgraded.ok, true, JSON.stringify(upgraded));
  }

  const workspace = createFakeWorkspaceBackend();
  const sdkCalls = [];
  const events = [];
  let nextTerminal = terminal;
  const driver = Object.freeze({
    async run(request, observe) {
      events.push("sdk-run");
      sdkCalls.push(Object.freeze({ ...request, signal: "redacted" }));
      hooks.beforeSdkEvents?.(request);
      if (request.operation === "start") {
        observe(Object.freeze({ type: "thread.started", threadId: "codex-product-thread" }));
      }
      observe(Object.freeze({ type: "turn.started" }));
      observe(nextTerminal === "turn.completed"
        ? Object.freeze({
          type: nextTerminal,
          usage: Object.freeze({ inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 }),
        })
        : Object.freeze({ type: nextTerminal }));
      nextTerminal = "turn.completed";
    },
  });
  const verifier = Object.freeze({
    verify() { return Object.freeze({ workingDirectory: fixture.projectRoot }); },
  });
  let backendSequence = 0;
  let backendMilliseconds = Date.parse("2026-09-05T02:00:00.000Z");
  const credential = {
    configuredCalls: 0,
    resolveCalls: 0,
    configured(reference) {
      assert.equal(reference, "process-env:CODEX_API_KEY");
      events.push("credential-configured");
      this.configuredCalls += 1;
      return true;
    },
    resolve(reference) {
      assert.equal(reference, "process-env:CODEX_API_KEY");
      events.push("credential-resolved");
      this.resolveCalls += 1;
      return "SENTINEL_FAKE_CODEX_KEY";
    },
  };
  const dependencies = Object.freeze({
    credentialResolver: credential,
    sdkDriver(apiKey, selectedCodexHome) {
      assert.equal(apiKey, "SENTINEL_FAKE_CODEX_KEY");
      assert.equal(selectedCodexHome, codexHome);
      if (hooks.sdkDriver !== undefined) return hooks.sdkDriver(apiKey, selectedCodexHome);
      return driver;
    },
    workspaceBackend: () => Object.freeze({
      backend: workspace, adapterId: "fake-workspace", adapterVersion: "1.0.0",
    }),
    executionBackend: (backendStore, _profile, _project, driverFactory) => createCodexExecutionBackend(backendStore, {
      gitExecutable: "git", projectBindings: [], workspaceRoots: [],
    }, {
      driverFactory,
      workspaceVerifier: verifier,
      ingress: Object.freeze({
        now: () => new Date(backendMilliseconds += 1_000).toISOString(),
        nextId: (kind) => `${kind}-ep03f-${++backendSequence}`,
      }),
    }),
  });
  const product = createCodexProductApplicationWithDependencies(store, trusted, dependencies, Object.freeze({
    afterStage(stage) {
      events.push(stage);
      hooks.afterStage?.(stage);
    },
  }));
  const activated = product.activateProfile(Object.freeze({
    kind: "codex.profile.activate",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    profileId: "profile",
    expectedProfileRevision: 0,
    workspaceRootKey: "codex-workspace-root",
    workspaceRoot,
    codexHomeKey: "codex-home-root",
    codexHome,
    gitExecutable: process.execPath,
    idempotencyKey: "activate-profile",
  }));
  assert.equal(activated.ok, true, JSON.stringify(activated));
  return {
    fixture, trusted, store, product, application, dependencies, workspace, sdkCalls, credential, events,
    workspaceRoot, codexHome,
  };
}

test("authorized Codex product start owns one targeted tuple and defers Task bytes until Act", async () => {
  const runtime = await setup("codex-product-start", "turn.completed");
  try {
    const result = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-start",
      leaseDurationSeconds: 300,
    }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.value.taskState, "running");
    assert.equal(result.value.workspaceStatus, "ready");
    assert.equal(runtime.sdkCalls.length, 1);
    assert.equal(runtime.sdkCalls[0].input, TASK_BODY);
    assert.equal(runtime.credential.resolveCalls, 1);
    assert.equal(runtime.events.indexOf("product-prepared") < runtime.events.indexOf("credential-configured"), true);
    assert.equal(runtime.events.indexOf("intent-prepared") < runtime.events.indexOf("effect-possible"), true);
    assert.equal(runtime.events.indexOf("effect-possible") < runtime.events.indexOf("credential-resolved"), true);
    assert.equal(runtime.events.indexOf("credential-resolved") < runtime.events.indexOf("sdk-run"), true);
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations.length, 1);
    assert.equal(state.codexProductOperations[0].lifecycle, "finalized");
    assert.equal(typeof state.codexProductOperations[0].resultJson, "string");
    assert.doesNotMatch(state.codexProductOperations[0].resultJson, /SENTINEL|CODEX_API_KEY/u);
    assert.equal(state.dispatcherRuns[0].routeKind, "codex-start");
    assert.equal(state.dispatcherMembers[0].ownerKind, "codex-product-operation");
    assert.equal(state.executionIntents.length, 1);
    assert.equal(state.executionIntents[0].state, "finalized");
    assert.equal(state.codexEffectAuthorizations.length, 2);
    assert.deepEqual(state.codexEffectAuthorizations.map((item) => item.phase), ["prepare", "act"]);
    assert.doesNotMatch(JSON.stringify(state), /SENTINEL_FAKE_CODEX_KEY/u);
    const replay = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-start",
      leaseDurationSeconds: 300,
    }));
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replayed, true);
    assert.equal(runtime.sdkCalls.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex retry allocates a fresh targeted member, higher fence, and fresh workspace", async () => {
  const runtime = await setup("codex-product-retry", "turn.failed");
  try {
    const start = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-failed-start",
      leaseDurationSeconds: 300,
    }));
    assert.equal(start.ok, true, JSON.stringify({ start, state: readApplicationStateForOwner(runtime.store) }));
    const before = readApplicationStateForOwner(runtime.store);
    const task = before.domain.tasks[0];
    const source = before.executions[0];
    assert.equal(task.state, "waiting");
    const retried = await runtime.product.retry(Object.freeze({
      kind: "execution.retry",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: task.revision,
      executionId: source.executionId,
      expectedExecutionRevision: source.revision,
      expectedAttemptNumber: source.attemptNumber,
      expectedFencingToken: source.fencingToken,
      idempotencyKey: "codex-product-retry",
      continuationReference: "continue-after-failure",
      requiredActionReceiptId: "accepted-required-action",
    }));
    assert.equal(retried.ok, true, JSON.stringify(retried));
    const after = readApplicationStateForOwner(runtime.store);
    assert.equal(after.codexProductOperations.length, 2);
    assert.equal(after.dispatcherRuns.length, 2);
    assert.deepEqual(after.dispatcherRuns.map((item) => item.routeKind), ["codex-start", "codex-continuation"]);
    assert.equal(after.dispatcherMembers.length, 2);
    assert.equal(after.executions.length, 2);
    assert.equal(after.workspaceGenerations.length, 2);
    assert.equal(after.executions[0].status, "superseded");
    assert.equal(after.executions[1].fencingToken > after.executions[0].fencingToken, true);
    assert.notEqual(after.workspaceGenerations[0].workspaceId, after.workspaceGenerations[1].workspaceId);
    assert.equal(runtime.sdkCalls.length, 2);
    assert.equal(runtime.sdkCalls[1].operation, "resume");
    assert.equal(runtime.sdkCalls[1].threadId, "codex-product-thread");
    assert.equal(retried.value.taskState, "running");
    const startReplay = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-failed-start",
      leaseDurationSeconds: 300,
    }));
    assert.deepEqual(startReplay, Object.freeze({
      ok: true,
      value: Object.freeze({ ...start.value, replayed: true }),
    }));
    const replay = await runtime.product.retry(Object.freeze({
      kind: "execution.retry",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: task.revision,
      executionId: source.executionId,
      expectedExecutionRevision: source.revision,
      expectedAttemptNumber: source.attemptNumber,
      expectedFencingToken: source.fencingToken,
      idempotencyKey: "codex-product-retry",
      continuationReference: "continue-after-failure",
      requiredActionReceiptId: "accepted-required-action",
    }));
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replayed, true);
    assert.equal(runtime.sdkCalls.length, 2);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("credential refusal replays its stored result after the profile changes", async () => {
  const runtime = await setup("codex-product-refusal", "turn.completed");
  try {
    runtime.credential.configured = () => false;
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-refused",
      leaseDurationSeconds: 300,
    });
    const refused = await runtime.product.dispatchRun(command);
    assert.deepEqual(refused, {
      ok: false,
      error: {
        code: "CODEX_CREDENTIAL_UNAVAILABLE",
        message: "The configured Codex credential is unavailable.",
      },
    });
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].lifecycle, "refused");
    assert.equal(state.codexProductOperations[0].stage, "prepared");
    assert.equal(state.codexProductOperations[0].resultJson,
      '{"error":{"code":"CODEX_CREDENTIAL_UNAVAILABLE","message":"The configured Codex credential is unavailable."},"ok":false}');
    assert.equal(state.dispatcherRuns.length, 0);
    assert.equal(state.executions.length, 0);
    const deactivated = runtime.product.deactivateProfile(Object.freeze({
      kind: "codex.profile.deactivate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      idempotencyKey: "deactivate-after-refusal",
    }));
    assert.equal(deactivated.ok, true, JSON.stringify(deactivated));
    assert.deepEqual(await runtime.product.dispatchRun(command), refused);
    assert.equal(runtime.sdkCalls.length, 0);
    assert.equal(runtime.credential.resolveCalls, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const confirmationFailure of ["null", "throw"]) {
  test(`Codex Act ${confirmationFailure} confirmation persists a denial and exact replay obtains a fresh Act`, async () => {
    const runtime = await setup(`codex-product-act-${confirmationFailure}`, "turn.completed");
    try {
      runtime.trusted.failCodexConfirmation(2, confirmationFailure);
      const command = Object.freeze({
        kind: "codex.dispatch-run",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        expectedProjectConfigRevision: 1,
        profileId: "profile",
        expectedProfileRevision: 1,
        taskId: "task",
        expectedTaskRevision: 2,
        baseReference: "a".repeat(40),
        idempotencyKey: `codex-product-act-${confirmationFailure}`,
        leaseDurationSeconds: 300,
      });
      const denied = await runtime.product.dispatchRun(command);
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, "CONFIRMATION_REQUIRED");
      let state = readApplicationStateForOwner(runtime.store);
      assert.equal(state.codexProductOperations[0].stage, "intent_prepared");
      assert.equal(state.codexProductOperations[0].lifecycle, "recovery_required");
      assert.equal(state.executionIntents[0].state, "pending");
      assert.deepEqual(state.codexEffectAuthorizations.map((item) => [item.phase, item.result, item.reason]), [
        ["prepare", "allow", "allowed"],
        ["act", "deny", "confirmation_required"],
      ]);
      assert.equal(state.codexEffectAuthorizations[1].confirmationId, null);
      assert.equal(runtime.credential.resolveCalls, 0);
      assert.equal(runtime.sdkCalls.length, 0);

      const replay = await runtime.product.dispatchRun(command);
      assert.equal(replay.ok, true, JSON.stringify(replay));
      assert.equal(replay.value.replayed, true);
      state = readApplicationStateForOwner(runtime.store);
      assert.deepEqual(state.codexEffectAuthorizations.map((item) => [item.bindingRevision, item.result]), [
        [1, "allow"], [2, "deny"], [3, "allow"],
      ]);
      assert.equal(runtime.sdkCalls.length, 1);
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

test("a crash immediately after T6 reauthorizes one first call when the backend journal proves absence", async () => {
  let crash = true;
  const runtime = await setup("codex-product-t6-crash", "turn.completed", Object.freeze({
    afterStage(stage) {
      if (stage === "effect-possible" && crash) {
        crash = false;
        throw new Error("crash after T6");
      }
    },
  }));
  try {
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-t6-crash",
      leaseDurationSeconds: 300,
    });
    const interrupted = await runtime.product.dispatchRun(command);
    assert.equal(interrupted.ok, false);
    assert.equal(interrupted.error.code, "PERSISTENCE_FAILURE");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].stage, "effect_possible");
    assert.equal(state.executionIntents[0].state, "executing");
    assert.equal(runtime.credential.resolveCalls, 0);
    assert.equal(runtime.sdkCalls.length, 0);

    const replay = await runtime.product.dispatchRun(command);
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.value.replayed, true);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].stage, "workspace_refreshed");
    assert.equal(state.codexProductOperations[0].lifecycle, "finalized");
    assert.deepEqual(state.codexEffectAuthorizations.map((item) => [item.phase, item.result]), [
      ["prepare", "allow"], ["act", "allow"], ["act", "allow"],
    ]);
    assert.equal(runtime.credential.resolveCalls, 1);
    assert.equal(runtime.sdkCalls.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("a present uncertain backend turn is observation-only and never invokes the SDK twice", async () => {
  let loseResponse = true;
  const runtime = await setup("codex-product-present-uncertain-turn", "turn.completed", Object.freeze({
    beforeSdkEvents() {
      if (loseResponse) {
        loseResponse = false;
        throw new Error("simulated response loss after durable turn insertion");
      }
    },
  }));
  try {
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-present-uncertain-turn",
      leaseDurationSeconds: 300,
    });
    const first = await runtime.product.dispatchRun(command);
    assert.equal(runtime.sdkCalls.length, 1);
    assert.equal(runtime.credential.resolveCalls, 1);
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(state.codexTurns[0].lifecycle, "unknown");
    assert.equal(state.executionIntents[0].state, "finalized");

    const replay = await runtime.product.dispatchRun(command);
    assert.deepEqual(replay, first.ok
      ? Object.freeze({ ok: true, value: Object.freeze({ ...first.value, replayed: true }) })
      : first);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(runtime.sdkCalls.length, 1);
    assert.equal(runtime.credential.resolveCalls, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const restartStage of [
  "targeted-run-created",
  "targeted-member-bound",
  "intent-prepared",
  "effect-possible",
  "workspace-refreshed",
]) {
  test(`a new local process reopens the exact targeted Codex run after ${restartStage}`, async () => {
    let interrupt = true;
    const runtime = await setup(`codex-targeted-restart-${restartStage}`, "turn.completed", Object.freeze({
      afterStage(stage) {
        if (stage === restartStage && interrupt) {
          interrupt = false;
          throw new Error(`simulated process loss after ${stage}`);
        }
      },
    }));
    let activeStore = runtime.store;
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: `codex-targeted-restart-${restartStage}`,
      leaseDurationSeconds: 300,
    });
    try {
      const interrupted = await runtime.product.dispatchRun(command);
      assert.equal(interrupted.ok, false);
      let state = readApplicationStateForOwner(activeStore);
      assert.equal(state.dispatcherRuns.length, 1);
      assert.equal(state.dispatcherMembers.length, 1);

      if (restartStage === "targeted-run-created") {
        const operationId = state.codexProductOperations[0].operationId;
        const foreign = createCodexTargetedDispatcherService(activeStore, Object.freeze({
          currentActor: () => runtime.trusted.currentActor(),
          currentWorkerOwner: () => "foreign-live-worker",
          currentExecutionLeaseOwner: () => runtime.trusted.currentLeaseOwner(),
          currentRuntimeRootKey: () => runtime.trusted.currentRuntimeRootKey(),
          now: () => runtime.trusted.now(),
          nextId: (kind) => runtime.trusted.nextId(kind),
        }));
        const refused = foreign.claimStartMember(operationId);
        assert.equal(refused.ok, false);
        assert.equal(refused.error.code, "LEASE_NOT_EXPIRED");
      }

      await activeStore.close();
      activeStore = await openPersistence(runtime.fixture.layout, { applicationVersion: "ep03f-restarted-test" });
      runtime.trusted.setDispatcherOwner(`replacement-${restartStage}`);
      const restarted = createCodexProductApplicationWithDependencies(
        activeStore, runtime.trusted, runtime.dependencies,
      );
      const resumed = await restarted.dispatchRun(command);
      assert.equal(resumed.ok, true, JSON.stringify(resumed));
      assert.equal(resumed.value.replayed, true);
      state = readApplicationStateForOwner(activeStore);
      assert.equal(state.codexProductOperations.length, 1);
      assert.equal(state.codexProductOperations[0].lifecycle, "finalized");
      assert.equal(state.dispatcherRuns.length, 1);
      assert.equal(state.dispatcherMembers.length, 1);
      assert.equal(state.executions.length, 1);
      assert.equal(state.workspaceGenerations.length, 1);
      assert.equal(state.executionIntents.length, 1);
      assert.equal(runtime.sdkCalls.length, 1);
    } finally {
      await activeStore.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

test("credential disappearance after T6 finalizes one stored failure result", async () => {
  const runtime = await setup("codex-product-post-t6-credential", "turn.completed");
  try {
    runtime.credential.resolve = function resolve(reference) {
      assert.equal(reference, "process-env:CODEX_API_KEY");
      this.resolveCalls += 1;
      return null;
    };
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-post-t6-credential",
      leaseDurationSeconds: 300,
    });
    const unavailable = await runtime.product.dispatchRun(command);
    assert.deepEqual(unavailable, {
      ok: false,
      error: {
        code: "CODEX_CREDENTIAL_UNAVAILABLE",
        message: "The configured Codex credential is unavailable.",
      },
    });
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].stage, "workspace_refreshed");
    assert.equal(state.codexProductOperations[0].lifecycle, "finalized");
    assert.equal(state.codexProductOperations[0].resultCode, "credential_unavailable");
    assert.equal(state.executionIntents[0].state, "finalized");
    assert.equal(state.dispatcherRunSummaries.length, 1);
    assert.equal(runtime.sdkCalls.length, 0);
    assert.equal(runtime.credential.resolveCalls, 1);
    assert.deepEqual(await runtime.product.dispatchRun(command), unavailable);
    assert.equal(runtime.credential.resolveCalls, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("credential resolver failure after T6 finalizes a stored adapter failure", async () => {
  const runtime = await setup("codex-product-resolver-failure", "turn.completed");
  try {
    runtime.credential.resolve = function resolve(reference) {
      assert.equal(reference, "process-env:CODEX_API_KEY");
      this.resolveCalls += 1;
      throw new Error("resolver failure");
    };
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-resolver-failure",
      leaseDurationSeconds: 300,
    });
    const failed = await runtime.product.dispatchRun(command);
    assert.deepEqual(failed, {
      ok: false,
      error: {
        code: "CODEX_ADAPTER_FAILURE",
        message: "The Codex execution adapter failed.",
      },
    });
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].resultCode, "adapter_failure");
    assert.equal(state.executionIntents[0].lastErrorCode, "codex_driver_construction_failed");
    assert.equal(runtime.credential.resolveCalls, 1);
    assert.equal(runtime.sdkCalls.length, 0);
    assert.deepEqual(await runtime.product.dispatchRun(command), failed);
    assert.equal(runtime.credential.resolveCalls, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("SDK driver construction failure after T6 finalizes a stored adapter failure", async () => {
  const runtime = await setup("codex-product-driver-construction", "turn.completed", Object.freeze({
    sdkDriver() { throw new Error("driver construction failure"); },
  }));
  try {
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-driver-construction",
      leaseDurationSeconds: 300,
    });
    const failed = await runtime.product.dispatchRun(command);
    assert.equal(failed.ok, false);
    assert.equal(failed.error.code, "CODEX_ADAPTER_FAILURE");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].resultCode, "adapter_failure");
    assert.equal(state.executionIntents[0].lastErrorCode, "codex_driver_construction_failed");
    assert.equal(runtime.credential.resolveCalls, 1);
    assert.equal(runtime.sdkCalls.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("profile configuration drift after T6 finalizes a stored identity failure before credential access", async () => {
  let codexHome = null;
  const runtime = await setup("codex-product-configuration-drift", "turn.completed", Object.freeze({
    afterStage(stage) {
      if (stage === "effect-possible") writeFileSync(path.join(codexHome, "config.toml"), "refused = true\n");
    },
  }));
  codexHome = runtime.codexHome;
  try {
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-configuration-drift",
      leaseDurationSeconds: 300,
    });
    const failed = await runtime.product.dispatchRun(command);
    assert.deepEqual(failed, {
      ok: false,
      error: {
        code: "PROJECT_IDENTITY_CHANGED",
        message: "The Project identity changed.",
      },
    });
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].resultCode, "configuration_changed");
    assert.equal(state.executionIntents[0].lastErrorCode, "codex_profile_configuration_changed");
    assert.equal(runtime.credential.resolveCalls, 0);
    assert.equal(runtime.sdkCalls.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("workspace-root substitution after T6 finalizes a stored identity failure before credential access", async () => {
  let workspaceRoot = null;
  let fixtureRoot = null;
  const runtime = await setup("codex-product-workspace-root-drift", "turn.completed", Object.freeze({
    afterStage(stage) {
      if (stage !== "effect-possible") return;
      renameSync(workspaceRoot, path.join(fixtureRoot, "displaced-workspace-root"));
      mkdirSync(workspaceRoot);
    },
  }));
  workspaceRoot = runtime.workspaceRoot;
  fixtureRoot = runtime.fixture.generation;
  try {
    const failed = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-product-workspace-root-drift",
      leaseDurationSeconds: 300,
    }));
    assert.equal(failed.ok, false);
    assert.equal(failed.error.code, "PROJECT_IDENTITY_CHANGED");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations[0].resultCode, "configuration_changed");
    assert.equal(state.executionIntents[0].lastErrorCode, "codex_profile_configuration_changed");
    assert.equal(runtime.credential.resolveCalls, 0);
    assert.equal(runtime.sdkCalls.length, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex profile configuration rejects global workspace nesting and path aliases", async () => {
  const runtime = await setup("codex-profile-global-disjointness", "turn.completed");
  try {
    const state = readApplicationStateForOwner(runtime.store);
    const project = state.projects[0];
    const candidateWorkspace = path.join(runtime.fixture.generation, "candidate-workspace-root");
    const candidateHome = path.join(runtime.fixture.generation, "candidate-codex-home");
    mkdirSync(candidateWorkspace);
    mkdirSync(candidateHome);
    const input = Object.freeze({
      workspaceRootKey: "candidate-workspace-root",
      workspaceRoot: candidateWorkspace,
      codexHomeKey: "candidate-codex-home",
      codexHome: candidateHome,
      gitExecutable: process.execPath,
    });
    for (const historicalWorkspace of [
      path.join(candidateHome, "ato-workspaces", "w-historical-g1"),
      path.dirname(candidateHome),
    ]) {
      assert.throws(
        () => inspectCodexProfileConfiguration(
          input, project, runtime.store.layout.root, null, Object.freeze([historicalWorkspace]),
        ),
        (error) => error?.name === "CodexProfileConfigurationError" && error?.code === "path_overlap",
      );
    }

    const realHome = path.join(runtime.fixture.generation, "real-candidate-home");
    const aliasHome = path.join(runtime.fixture.generation, "alias-candidate-home");
    mkdirSync(realHome);
    symlinkSync(realHome, aliasHome, "junction");
    assert.throws(
      () => inspectCodexProfileConfiguration(Object.freeze({
        ...input,
        codexHomeKey: "alias-candidate-codex-home",
        codexHome: aliasHome,
      }), project, runtime.store.layout.root, null, Object.freeze([runtime.workspaceRoot])),
      (error) => error?.name === "CodexProfileConfigurationError" && error?.code === "path_alias",
    );
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex continuation rejects an aliased historical workspace generation before credential access", async () => {
  const runtime = await setup("codex-historical-workspace-alias", "turn.failed");
  try {
    const start = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-historical-workspace-alias-source",
      leaseDurationSeconds: 300,
    }));
    assert.equal(start.ok, true, JSON.stringify(start));
    const state = readApplicationStateForOwner(runtime.store);
    const sourceWorkspace = state.workspaceGenerations[0];
    const workspaceParent = path.join(runtime.workspaceRoot, "ato-workspaces");
    mkdirSync(workspaceParent, { recursive: true });
    const generationPath = path.join(
      workspaceParent,
      `w-${testSha256(sourceWorkspace.workspaceId).toLocaleLowerCase("en-US")}-g${sourceWorkspace.generation}`,
    );
    symlinkSync(runtime.codexHome, generationPath, "junction");
    const task = state.domain.tasks[0];
    const execution = state.executions[0];
    const initialResolveCalls = runtime.credential.resolveCalls;
    const refused = await runtime.product.retry(Object.freeze({
      kind: "execution.retry",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: task.revision,
      executionId: execution.executionId,
      expectedExecutionRevision: execution.revision,
      expectedAttemptNumber: execution.attemptNumber,
      expectedFencingToken: execution.fencingToken,
      idempotencyKey: "codex-historical-workspace-alias-retry",
      continuationReference: "continue-after-failure",
      requiredActionReceiptId: "accepted-required-action",
    }));
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, "PROJECT_IDENTITY_CHANGED");
    assert.equal(runtime.credential.resolveCalls, initialResolveCalls);
    assert.equal(runtime.sdkCalls.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("profile operation replay returns its original revision and status snapshot", async () => {
  const runtime = await setup("codex-profile-replay-snapshot", "turn.completed");
  try {
    const deactivateCommand = Object.freeze({
      kind: "codex.profile.deactivate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      idempotencyKey: "profile-deactivate-snapshot",
    });
    const deactivated = runtime.product.deactivateProfile(deactivateCommand);
    assert.equal(deactivated.ok, true, JSON.stringify(deactivated));
    const reactivated = runtime.product.activateProfile(Object.freeze({
      kind: "codex.profile.activate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 2,
      workspaceRootKey: "codex-workspace-root",
      workspaceRoot: runtime.workspaceRoot,
      codexHomeKey: "codex-home-root",
      codexHome: runtime.codexHome,
      gitExecutable: process.execPath,
      idempotencyKey: "profile-reactivate-snapshot",
    }));
    assert.equal(reactivated.ok, true, JSON.stringify(reactivated));
    assert.equal(reactivated.value.profileRevision, 3);
    assert.equal(reactivated.value.status, "active");

    const activationReplay = runtime.product.activateProfile(Object.freeze({
      kind: "codex.profile.activate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 0,
      workspaceRootKey: "codex-workspace-root",
      workspaceRoot: runtime.workspaceRoot,
      codexHomeKey: "codex-home-root",
      codexHome: runtime.codexHome,
      gitExecutable: process.execPath,
      idempotencyKey: "activate-profile",
    }));
    assert.equal(activationReplay.ok, true, JSON.stringify(activationReplay));
    assert.equal(activationReplay.value.profileRevision, 1);
    assert.equal(activationReplay.value.status, "active");
    assert.equal(activationReplay.value.replayed, true);

    const deactivationReplay = runtime.product.deactivateProfile(deactivateCommand);
    assert.equal(deactivationReplay.ok, true, JSON.stringify(deactivationReplay));
    assert.equal(deactivationReplay.value.profileRevision, 2);
    assert.equal(deactivationReplay.value.status, "deactivated");
    assert.equal(deactivationReplay.value.replayed, true);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("profile activation and deactivation reject actor changes during confirmation without lifecycle mutation", async () => {
  const runtime = await setup("codex-profile-confirmation-actor", "turn.completed");
  try {
    runtime.trusted.afterNextConfirmation(() => runtime.trusted.setActor("replacement-actor"));
    const deniedDeactivate = runtime.product.deactivateProfile(Object.freeze({
      kind: "codex.profile.deactivate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      idempotencyKey: "profile-deactivate-actor-race",
    }));
    assert.equal(deniedDeactivate.ok, false);
    assert.equal(deniedDeactivate.error.code, "AUTHORIZATION_DENIED");
    let state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProfiles[0].status, "active");
    assert.equal(state.codexProfiles[0].revision, 1);
    assert.equal(state.codexProfileOperations.length, 1);

    runtime.trusted.setActor(ACTOR);
    const deactivated = runtime.product.deactivateProfile(Object.freeze({
      kind: "codex.profile.deactivate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      idempotencyKey: "profile-deactivate-after-race",
    }));
    assert.equal(deactivated.ok, true, JSON.stringify(deactivated));
    runtime.trusted.afterNextConfirmation(() => runtime.trusted.setActor("replacement-actor"));
    const deniedActivate = runtime.product.activateProfile(Object.freeze({
      kind: "codex.profile.activate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 2,
      workspaceRootKey: "codex-workspace-root",
      workspaceRoot: runtime.workspaceRoot,
      codexHomeKey: "codex-home-root",
      codexHome: runtime.codexHome,
      gitExecutable: process.execPath,
      idempotencyKey: "profile-activate-actor-race",
    }));
    assert.equal(deniedActivate.ok, false);
    assert.equal(deniedActivate.error.code, "AUTHORIZATION_DENIED");
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProfiles[0].status, "deactivated");
    assert.equal(state.codexProfiles[0].revision, 2);
    assert.equal(state.codexProfileOperations.length, 2);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex start rejects grant expiry during T1 confirmation before product or effect mutation", async () => {
  const runtime = await setup("codex-start-confirmation-expiry", "turn.completed");
  try {
    runtime.trusted.afterNextConfirmation(() => runtime.trusted.setNow("2026-09-26T00:00:00.000Z"));
    const denied = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-start-confirmation-expiry",
      leaseDurationSeconds: 300,
    }));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations.length, 0);
    assert.equal(state.codexEffectAuthorizations.length, 0);
    assert.equal(state.dispatcherRuns.length, 0);
    assert.equal(state.executions.length, 0);
    assert.equal(state.executionIntents.length, 0);
    assert.equal(state.domain.tasks[0].state, "ready");
    assert.equal(runtime.credential.configuredCalls, 0);
    assert.equal(runtime.credential.resolveCalls, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex start rejects grant revocation during T1 confirmation before product or effect mutation", async () => {
  const runtime = await setup("codex-start-confirmation-revocation", "turn.completed");
  try {
    runtime.trusted.afterNextConfirmation(() => {
      const grant = readApplicationStateForOwner(runtime.store).grants.find((candidate) =>
        candidate.action === "codex.execution.invoke" && candidate.revokedAt === null
      );
      assert.ok(grant);
      const revoked = runtime.application.execute(Object.freeze({
        kind: "authorization.grant.revoke",
        grantId: grant.grantId,
        expectedGrantRevision: grant.revision,
      }));
      assert.equal(revoked.ok, true, JSON.stringify(revoked));
    });
    const denied = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-start-confirmation-revocation",
      leaseDurationSeconds: 300,
    }));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    const state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.codexProductOperations.length, 0);
    assert.equal(state.codexEffectAuthorizations.length, 0);
    assert.equal(state.dispatcherRuns.length, 0);
    assert.equal(state.executions.length, 0);
    assert.equal(state.domain.tasks[0].state, "ready");
    assert.equal(runtime.credential.configuredCalls, 0);
    assert.equal(runtime.credential.resolveCalls, 0);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex continuation rejects actor change during T1 confirmation without successor mutation", async () => {
  const runtime = await setup("codex-continuation-confirmation-actor", "turn.failed");
  try {
    const start = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-continuation-confirmation-source",
      leaseDurationSeconds: 300,
    }));
    assert.equal(start.ok, true, JSON.stringify(start));
    const before = readApplicationStateForOwner(runtime.store);
    const task = before.domain.tasks[0];
    const execution = before.executions[0];
    runtime.trusted.afterNextConfirmation(() => runtime.trusted.setActor("replacement-actor"));
    const denied = await runtime.product.retry(Object.freeze({
      kind: "execution.retry",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: task.revision,
      executionId: execution.executionId,
      expectedExecutionRevision: execution.revision,
      expectedAttemptNumber: execution.attemptNumber,
      expectedFencingToken: execution.fencingToken,
      idempotencyKey: "codex-continuation-confirmation-actor",
      continuationReference: "continue-after-failure",
      requiredActionReceiptId: "accepted-required-action",
    }));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    const after = readApplicationStateForOwner(runtime.store);
    assert.equal(after.codexProductOperations.length, 1);
    assert.equal(after.dispatcherRuns.length, 1);
    assert.equal(after.executions.length, 1);
    assert.equal(after.workspaceGenerations.length, 1);
    assert.equal(after.executionIntents.length, 1);
    assert.equal(after.domain.tasks[0].state, "waiting");
    assert.equal(runtime.sdkCalls.length, 1);
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("historical Codex inspect and cancellation remain credential-free after profile deactivation", async () => {
  const runtime = await setup("codex-historical-control", "turn.completed");
  try {
    const started = await runtime.product.dispatchRun(Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-historical-start",
      leaseDurationSeconds: 300,
    }));
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(runtime.sdkCalls.length, 1);
    const initialResolveCalls = runtime.credential.resolveCalls;

    const deactivated = runtime.product.deactivateProfile(Object.freeze({
      kind: "codex.profile.deactivate",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      idempotencyKey: "deactivate-historical-profile",
    }));
    assert.equal(deactivated.ok, true, JSON.stringify(deactivated));
    runtime.credential.configured = () => { throw new Error("credential probe is forbidden"); };
    runtime.credential.resolve = () => { throw new Error("credential resolution is forbidden"); };

    let state = readApplicationStateForOwner(runtime.store);
    let task = state.domain.tasks[0];
    let execution = state.executions[0];
    const inspected = await runtime.product.inspect(Object.freeze({
      kind: "execution.inspect",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: task.revision,
      executionId: execution.executionId,
      expectedExecutionRevision: execution.revision,
      expectedAttemptNumber: execution.attemptNumber,
      expectedFencingToken: execution.fencingToken,
      idempotencyKey: "inspect-historical-codex",
    }));
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    assert.equal(inspected.value.lifecycle, "turn_succeeded");
    assert.equal(runtime.sdkCalls.length, 1);
    assert.equal(runtime.credential.resolveCalls, initialResolveCalls);

    state = readApplicationStateForOwner(runtime.store);
    task = state.domain.tasks[0];
    execution = state.executions[0];
    const cancelled = await runtime.product.requestCancel(Object.freeze({
      kind: "execution.request-cancel",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      taskId: "task",
      expectedTaskRevision: task.revision,
      executionId: execution.executionId,
      expectedExecutionRevision: execution.revision,
      expectedAttemptNumber: execution.attemptNumber,
      expectedFencingToken: execution.fencingToken,
      idempotencyKey: "cancel-historical-codex",
      reasonCode: "operator-request",
    }));
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    assert.equal(cancelled.value.lifecycle, "turn_succeeded");
    assert.equal(runtime.sdkCalls.length, 1);
    assert.equal(runtime.credential.resolveCalls, initialResolveCalls);
    state = readApplicationStateForOwner(runtime.store);
    assert.equal(state.manualTurns.length, 0);
    assert.equal(state.codexTurns.length, 1);
    assert.equal(state.codexTurns[0].lifecycle, "turn_succeeded");
    const cancellationIntents = state.executionIntents.filter((item) => item.operationKind === "request_cancel");
    assert.equal(cancellationIntents.length, 1);
    assert.equal(cancellationIntents[0].state, "finalized");
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

for (const homeMutation of ["unavailable", "substituted", "structurally-changed"]) {
  test(`historical Codex control uses durable evidence when the deactivated home is ${homeMutation}`, async () => {
    const runtime = await setup(`codex-historical-home-${homeMutation}`, "turn.completed");
    try {
      const started = await runtime.product.dispatchRun(Object.freeze({
        kind: "codex.dispatch-run",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        expectedProjectConfigRevision: 1,
        profileId: "profile",
        expectedProfileRevision: 1,
        taskId: "task",
        expectedTaskRevision: 2,
        baseReference: "a".repeat(40),
        idempotencyKey: `codex-historical-home-start-${homeMutation}`,
        leaseDurationSeconds: 300,
      }));
      assert.equal(started.ok, true, JSON.stringify(started));
      const deactivated = runtime.product.deactivateProfile(Object.freeze({
        kind: "codex.profile.deactivate",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        expectedProjectConfigRevision: 1,
        profileId: "profile",
        expectedProfileRevision: 1,
        idempotencyKey: `codex-historical-home-deactivate-${homeMutation}`,
      }));
      assert.equal(deactivated.ok, true, JSON.stringify(deactivated));
      const initialResolveCalls = runtime.credential.resolveCalls;
      runtime.credential.configured = () => { throw new Error("credential probe is forbidden"); };
      runtime.credential.resolve = () => { throw new Error("credential resolution is forbidden"); };
      if (homeMutation === "unavailable" || homeMutation === "substituted") {
        renameSync(runtime.codexHome, path.join(runtime.fixture.generation, `displaced-home-${homeMutation}`));
      }
      if (homeMutation === "substituted") mkdirSync(runtime.codexHome);
      if (homeMutation === "structurally-changed") {
        writeFileSync(path.join(runtime.codexHome, "config.toml"), "refused = true\n");
      }

      let state = readApplicationStateForOwner(runtime.store);
      let task = state.domain.tasks[0];
      let execution = state.executions[0];
      const inspected = await runtime.product.inspect(Object.freeze({
        kind: "execution.inspect",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        expectedProjectConfigRevision: 1,
        taskId: "task",
        expectedTaskRevision: task.revision,
        executionId: execution.executionId,
        expectedExecutionRevision: execution.revision,
        expectedAttemptNumber: execution.attemptNumber,
        expectedFencingToken: execution.fencingToken,
        idempotencyKey: `inspect-historical-home-${homeMutation}`,
      }));
      assert.equal(inspected.ok, true, JSON.stringify(inspected));
      state = readApplicationStateForOwner(runtime.store);
      task = state.domain.tasks[0];
      execution = state.executions[0];
      const cancelled = await runtime.product.requestCancel(Object.freeze({
        kind: "execution.request-cancel",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        expectedProjectConfigRevision: 1,
        taskId: "task",
        expectedTaskRevision: task.revision,
        executionId: execution.executionId,
        expectedExecutionRevision: execution.revision,
        expectedAttemptNumber: execution.attemptNumber,
        expectedFencingToken: execution.fencingToken,
        idempotencyKey: `cancel-historical-home-${homeMutation}`,
        reasonCode: "operator-request",
      }));
      assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
      assert.equal(runtime.credential.resolveCalls, initialResolveCalls);
      assert.equal(runtime.sdkCalls.length, 1);
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

const PROFILE_HISTORY_CORRUPTIONS = Object.freeze([
  Object.freeze({
    name: "missing initial operation",
    sql: "DROP TRIGGER codex_profile_operations_no_delete; DELETE FROM codex_profile_operations",
  }),
  Object.freeze({
    name: "duplicate initial operation",
    sql: `INSERT INTO codex_profile_operations(
      operation_id,idempotency_key,request_id,decision_id,audit_id,confirmation_id,actor_id,action,project_id,
      expected_project_resource_revision,expected_project_config_revision,profile_id,expected_profile_revision,
      result,reason,policy_result,grant_id,grant_revision,configuration_sha256,resulting_profile_revision,
      resulting_status,created_at)
      SELECT 'duplicate-profile-operation','duplicate-profile-key','duplicate-profile-request',
        'duplicate-profile-decision','duplicate-profile-audit','duplicate-profile-confirmation',actor_id,action,
        project_id,expected_project_resource_revision,expected_project_config_revision,profile_id,
        expected_profile_revision,result,reason,policy_result,grant_id,grant_revision,configuration_sha256,
        resulting_profile_revision,resulting_status,created_at FROM codex_profile_operations LIMIT 1`,
  }),
  Object.freeze({
    name: "substituted configuration",
    sql: "DROP TRIGGER codex_profile_operations_no_update; UPDATE codex_profile_operations SET configuration_sha256='BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'",
  }),
  Object.freeze({
    name: "skipped profile revision",
    sql: "DROP TRIGGER codex_profiles_update_guard; UPDATE codex_profiles SET revision=3, updated_at='2026-09-05T01:30:00.000Z'",
  }),
  Object.freeze({
    name: "impossible initial deactivation",
    sql: "DROP TRIGGER codex_profile_operations_no_update; DROP TRIGGER codex_profiles_update_guard; UPDATE codex_profile_operations SET action='codex.profile.deactivate', resulting_status='deactivated'; UPDATE codex_profiles SET status='deactivated'",
  }),
  Object.freeze({
    name: "substituted creator operation",
    sql: "DROP TRIGGER codex_profiles_update_guard; UPDATE codex_profiles SET creator_operation_id='missing-profile-operation'",
  }),
  Object.freeze({
    name: "substituted profile actor",
    sql: "DROP TRIGGER codex_profiles_update_guard; UPDATE codex_profiles SET actor_id='substituted-profile-actor'",
  }),
]);

for (const [corruptionIndex, corruption] of PROFILE_HISTORY_CORRUPTIONS.entries()) {
  test(`Codex profile decoder rejects ${corruption.name}`, async () => {
    const runtime = await setup(`cpc-${corruptionIndex}`, "turn.completed");
    try {
      const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
      try { writable.exec(corruption.sql); } finally { writable.close(); }
      assert.throws(
        () => readApplicationStateForOwner(runtime.store),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      await runtime.store.close();
      cleanupPersistenceFixture(runtime.fixture);
    }
  });
}

test("Codex effect decoder rejects every missing, stale, substituted, or detached Act conjunct", async () => {
  const runtime = await setup("codex-effect-grant-set-corruption", "turn.completed");
  try {
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-effect-grant-set-corruption",
      leaseDurationSeconds: 300,
    });
    assert.equal((await runtime.product.dispatchRun(command)).ok, true);
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER codex_effect_authorizations_no_update");
      const original = writable.prepare(
        "SELECT required_grant_set_json AS json, required_grant_set_sha256 AS digest, core_authorization_decision_id AS coreDecision FROM codex_effect_authorizations WHERE phase='act'",
      ).get();
      assert.equal(typeof original?.json, "string");
      const originalSet = JSON.parse(original.json);
      assert.equal(originalSet.conjuncts.length, 7);
      const updateSet = writable.prepare(
        "UPDATE codex_effect_authorizations SET required_grant_set_json=?, required_grant_set_sha256=? WHERE phase='act'",
      );
      const restore = () => updateSet.run(original.json, original.digest);
      for (let index = 0; index < originalSet.conjuncts.length; index += 1) {
        const changed = JSON.parse(original.json);
        changed.conjuncts.splice(index, 1);
        const encoded = JSON.stringify(changed);
        updateSet.run(encoded, testSha256(encoded));
        assert.throws(
          () => readApplicationStateForOwner(runtime.store),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
          `missing conjunct ${index} was accepted`,
        );
        restore();
        readApplicationStateForOwner(runtime.store);
      }
      for (const mutate of [
        (changed) => { changed.conjuncts[0].grantRevision += 1; },
        (changed) => { changed.conjuncts[0].owner = "workspace"; },
        (changed) => { changed.conjuncts[4].policy = "deny"; },
        (changed) => { changed.conjuncts[2].projectId = "project"; changed.conjuncts[2].resourceRevision = 1; changed.conjuncts[2].configRevision = 1; },
      ]) {
        const changed = JSON.parse(original.json);
        mutate(changed);
        const encoded = JSON.stringify(changed);
        updateSet.run(encoded, testSha256(encoded));
        assert.throws(
          () => readApplicationStateForOwner(runtime.store),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
        );
        restore();
        readApplicationStateForOwner(runtime.store);
      }
      writable.prepare(
        "UPDATE codex_effect_authorizations SET core_authorization_decision_id='substituted-core-decision' WHERE phase='act'",
      ).run();
      assert.throws(
        () => readApplicationStateForOwner(runtime.store),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
      writable.prepare(
        "UPDATE codex_effect_authorizations SET core_authorization_decision_id=? WHERE phase='act'",
      ).run(original.coreDecision);
      readApplicationStateForOwner(runtime.store);
    } finally {
      writable.close();
    }
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});

test("Codex terminal decoder reconstructs every public success field and its exact core Act consumer", async () => {
  const runtime = await setup("codex-terminal-semantic-corruption", "turn.completed");
  try {
    const command = Object.freeze({
      kind: "codex.dispatch-run",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      profileId: "profile",
      expectedProfileRevision: 1,
      taskId: "task",
      expectedTaskRevision: 2,
      baseReference: "a".repeat(40),
      idempotencyKey: "codex-terminal-semantic-corruption",
      leaseDurationSeconds: 300,
    });
    assert.equal((await runtime.product.dispatchRun(command)).ok, true);
    const writable = new DatabaseSync(runtime.fixture.layout.databasePath);
    try {
      writable.exec("DROP TRIGGER codex_product_operations_update_guard");
      const original = writable.prepare(
        "SELECT result_json AS resultJson FROM codex_product_operations",
      ).get().resultJson;
      const updateResult = writable.prepare("UPDATE codex_product_operations SET result_json=?");
      const mutations = Object.freeze([
        ["runId", (value) => { value.runId = "substituted-run"; }],
        ["status", (value) => { value.status = value.status === "completed" ? "failed" : "completed"; }],
        ["memberId", (value) => { value.memberId = "substituted-member"; }],
        ["profileId", (value) => { value.profileId = "substituted-profile"; }],
        ["profileRevision", (value) => { value.profileRevision += 1; }],
        ["destination", (value) => { value.destination = "substituted-destination"; }],
        ["baseReference", (value) => { value.baseReference = "b".repeat(40); }],
        ["taskId", (value) => { value.taskId = "substituted-task"; }],
        ["taskState", (value) => { value.taskState = "completed"; }],
        ["taskRevision", (value) => { value.taskRevision += 1; }],
        ["executionId", (value) => { value.executionId = "substituted-execution"; }],
        ["executionRevision", (value) => { value.executionRevision += 1; }],
        ["attemptNumber", (value) => { value.attemptNumber += 1; }],
        ["fencingToken", (value) => { value.fencingToken += 1; }],
        ["workspaceId", (value) => { value.workspaceId = "substituted-workspace"; }],
        ["workspaceGeneration", (value) => { value.workspaceGeneration += 1; }],
        ["workspaceRevision", (value) => { value.workspaceRevision += 1; }],
        ["workspaceStatus", (value) => { value.workspaceStatus = "cleaned"; }],
        ["lifecycle", (value) => { value.lifecycle = "failed"; }],
        ["replayed", (value) => { value.replayed = true; }],
      ]);
      for (const [name, mutate] of mutations) {
        const changed = JSON.parse(original);
        mutate(changed.value);
        updateResult.run(JSON.stringify(changed));
        assert.throws(
          () => readApplicationStateForOwner(runtime.store),
          (error) => expectPersistenceError(error, "CORRUPT_ROW"),
          `${name} substitution was accepted`,
        );
        updateResult.run(original);
        readApplicationStateForOwner(runtime.store);
      }
      updateResult.run('{"error":{"code":"CODEX_ADAPTER_FAILURE","message":"The Codex execution adapter failed."},"ok":false}');
      assert.throws(
        () => readApplicationStateForOwner(runtime.store),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
      updateResult.run(original);

      writable.exec("DROP TRIGGER codex_effect_authorizations_no_update");
      const core = writable.prepare(
        "SELECT core_authorization_decision_id AS decision FROM codex_effect_authorizations WHERE phase='act'",
      ).get().decision;
      writable.prepare(
        "UPDATE codex_effect_authorizations SET core_authorization_decision_id='detached-core-act' WHERE phase='act'",
      ).run();
      assert.throws(
        () => readApplicationStateForOwner(runtime.store),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
      writable.prepare(
        "UPDATE codex_effect_authorizations SET core_authorization_decision_id=? WHERE phase='act'",
      ).run(core);
      readApplicationStateForOwner(runtime.store);
    } finally {
      writable.close();
    }
  } finally {
    await runtime.store.close();
    cleanupPersistenceFixture(runtime.fixture);
  }
});
