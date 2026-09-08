import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX_EXECUTION_ADAPTER_ID,
  CODEX_EXECUTION_ADAPTER_VERSION,
  createCodexExecutionBackend,
} from "../src/codex-execution-backend.ts";
import { PinnedCodexSdkDriver } from "../src/codex-sdk-worker.ts";
import { CodexJournalError } from "../src/persistence/codex-backend-repository.ts";

const USAGE = Object.freeze({
  input_tokens: 2,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 1,
  reasoning_output_tokens: 0,
});

function resumeRequest(threadId = "persisted-thread") {
  return Object.freeze({
    contractId: "ato.execution/v2",
    adapterId: CODEX_EXECUTION_ADAPTER_ID,
    adapterVersion: CODEX_EXECUTION_ADAPTER_VERSION,
    correlationId: `correlation-${threadId}`,
    requestedDeadline: "2026-09-10T12:00:00.000Z",
    semantic: Object.freeze({
      backendKind: "codex-sdk",
      workspaceMode: "owned",
      workspaceContractId: "ato.workspace/v2",
      projectId: "project",
      projectResourceRevision: 1,
      projectConfigRevision: 1,
      taskId: "task",
      taskRevision: 4,
      inputReference: `task-sha256:${"a".repeat(64)}`,
      executionId: "successor-execution",
      executionRevision: 1,
      attemptNumber: 2,
      fencingToken: 2,
      policyBindingReference: "codex-policy-binding",
      workspaceId: "successor-workspace",
      workspaceGeneration: 1,
      workspaceRevision: 3,
      workspaceRootKey: "workspace-root",
      ownershipBindingSha256: "B".repeat(64),
      workspaceHeadObjectId: "c".repeat(40),
    }),
    operationId: `operation-${threadId}`,
    intentId: `intent-${threadId}`,
    idempotencyKey: `idempotency-${threadId}`,
    actorId: "local_manual_operator",
    authorizationDecisionId: `decision-${threadId}`,
    action: "execution.resume",
    operation: "resume",
    backendExecutionId: "predecessor-backend-execution",
    threadId,
    continuationReference: "continuation-reference",
    previousTurnReceiptId: "predecessor-receipt",
    expectedThreadId: threadId,
    input: "ephemeral successor input",
  });
}

function terminalCancelRequest(resume) {
  return Object.freeze({
    contractId: resume.contractId,
    adapterId: resume.adapterId,
    adapterVersion: resume.adapterVersion,
    correlationId: "correlation-terminal-cancel",
    requestedDeadline: resume.requestedDeadline,
    semantic: resume.semantic,
    operationId: "operation-terminal-cancel",
    intentId: "intent-terminal-cancel",
    idempotencyKey: "idempotency-terminal-cancel",
    actorId: resume.actorId,
    authorizationDecisionId: "decision-terminal-cancel",
    action: "execution.cancel",
    operation: "request_cancel",
    backendExecutionId: resume.backendExecutionId,
    threadId: resume.threadId,
    expectedLifecycle: "turn_succeeded",
    reasonCode: "operator_requested",
  });
}

function durableResumeJournal() {
  const state = {
    sourceThreadId: "persisted-thread",
    turn: null,
    operation: null,
    prepareCalls: [],
  };
  return Object.freeze({
    state,
    journal: Object.freeze({
      prepareStart() {
        throw new Error("start is outside this continuation fixture");
      },
      prepareResume(request, identity) {
        state.prepareCalls.push(Object.freeze({ request, identity }));
        if (request.threadId !== state.sourceThreadId || request.expectedThreadId !== state.sourceThreadId) {
          throw new CodexJournalError("CONFLICT", "replacement thread refused");
        }
        if (state.turn !== null) {
          return Object.freeze({ turn: state.turn, operation: state.operation, replayed: true });
        }
        state.turn = Object.freeze({
          backendExecutionId: identity.backendExecutionId,
          threadId: state.sourceThreadId,
          lifecycle: "unknown",
          terminalSignal: null,
          code: "codex_continuation_prepared",
          evidenceReference: null,
          revision: 1,
          updatedAt: identity.observedAt,
        });
        return Object.freeze({ turn: state.turn, operation: null, replayed: false });
      },
      markActive(backendExecutionId, threadId, observedAt) {
        assert.equal(backendExecutionId, state.turn.backendExecutionId);
        assert.equal(threadId, state.sourceThreadId);
        state.turn = Object.freeze({
          ...state.turn,
          lifecycle: "active",
          code: "codex_turn_started",
          revision: 2,
          updatedAt: observedAt,
        });
        return state.turn;
      },
      recordTerminal(backendExecutionId, terminalSignal, code, evidenceReference, observedAt, receiptIdentity) {
        assert.equal(backendExecutionId, state.turn.backendExecutionId);
        assert.ok(terminalSignal === "turn.completed" || terminalSignal === "turn.failed");
        state.turn = Object.freeze({
          ...state.turn,
          lifecycle: terminalSignal === "turn.completed" ? "turn_succeeded" : "failed",
          terminalSignal,
          code,
          evidenceReference,
          revision: 3,
          updatedAt: observedAt,
        });
        const receipt = receiptIdentity(state.turn);
        state.operation = Object.freeze({ receiptId: receipt.receiptId, receiptSha256: receipt.receiptSha256 });
        return Object.freeze({ turn: state.turn, operation: state.operation });
      },
      inspect() {
        return state.turn;
      },
      markUnproved() {
        return state.turn;
      },
      recordCancellationRequest() {
        return state.turn;
      },
    }),
  });
}

function backendWithJournal(journal, driver, label) {
  let sequence = 0;
  return createCodexExecutionBackend(null, {
    gitExecutable: "git",
    projectBindings: [],
    workspaceRoots: [],
  }, {
    journal,
    driver,
    workspaceVerifier: Object.freeze({
      verify() {
        return Object.freeze({ workingDirectory: "D:\\exact-successor-workspace" });
      },
    }),
    ingress: Object.freeze({
      now: () => `2026-09-04T12:00:0${sequence++}.000Z`,
      nextId: (kind) => `${kind}-${label}-${sequence}`,
    }),
  });
}

test("Codex backend resumes only the persisted thread and replays durable terminal evidence after restart", async () => {
  const durable = durableResumeJournal();
  const driverCalls = [];
  const first = backendWithJournal(durable.journal, Object.freeze({
    async run(request, observe) {
      driverCalls.push(request);
      assert.equal(request.operation, "resume");
      assert.equal(request.threadId, durable.state.sourceThreadId);
      observe(Object.freeze({ type: "turn.started" }));
      observe(Object.freeze({ type: "turn.completed", usage: USAGE }));
    },
  }), "first-process");
  const request = resumeRequest();
  const completed = await first.resume(request);
  assert.equal(completed.ok, true, JSON.stringify(completed));
  assert.equal(completed.receipt.threadId, durable.state.sourceThreadId);
  assert.equal(driverCalls.length, 1);
  assert.equal(durable.state.turn.lifecycle, "turn_succeeded");

  const restarted = backendWithJournal(durable.journal, Object.freeze({
    async run() {
      throw new Error("durable terminal replay must not invoke the SDK");
    },
  }), "restarted-process");
  const replay = await restarted.resume(request);
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.equal(replay.receipt.threadId, durable.state.sourceThreadId);
  assert.equal(replay.receipt.integritySha256, completed.receipt.integritySha256);
  assert.equal(driverCalls.length, 1);

  const terminalRevision = durable.state.turn.revision;
  const cancelled = await restarted.requestCancel(Object.freeze({
    ...terminalCancelRequest(request),
    backendExecutionId: durable.state.turn.backendExecutionId,
  }));
  assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
  assert.equal(cancelled.receipt.lifecycle, "already_terminal");
  assert.equal(cancelled.receipt.observedPreRevision, terminalRevision);
  assert.equal(cancelled.receipt.observedPostRevision, terminalRevision);
  assert.equal(durable.state.turn.revision, terminalRevision);
  assert.equal(driverCalls.length, 1);

  const replaced = await restarted.resume(resumeRequest("replacement-thread"));
  assert.equal(replaced.ok, false);
  assert.equal(replaced.error.category, "conflict");
  assert.equal(driverCalls.length, 1);
});

for (const terminal of ["turn.completed", "turn.failed"]) {
  test(`Codex backend publishes ${terminal} only after the complete resume stream is accepted`, async () => {
    const durable = durableResumeJournal();
    const observed = Promise.withResolvers();
    const finish = Promise.withResolvers();
    const driver = new PinnedCodexSdkDriver({
      startThread() { throw new Error("continuation must not create a thread"); },
      resumeThread(threadId) {
        assert.equal(threadId, durable.state.sourceThreadId);
        return {
          async runStreamed() {
            return {
              events: (async function* () {
                yield { type: "turn.started" };
                yield terminal === "turn.completed" ? { type: terminal, usage: USAGE } : { type: terminal };
                observed.resolve();
                await finish.promise;
              })(),
            };
          },
        };
      },
    });
    const backend = backendWithJournal(durable.journal, driver, `withheld-${terminal}`);
    const pending = backend.resume(resumeRequest());
    try {
      await observed.promise;
      assert.equal(durable.state.turn.lifecycle, "active");
      assert.equal(durable.state.turn.terminalSignal, null);
      assert.equal(durable.state.operation, null);
    } finally {
      finish.resolve();
      await pending;
    }
    const result = await pending;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(durable.state.turn.terminalSignal, terminal);
    assert.equal(durable.state.operation.receiptSha256, result.receipt.integritySha256);
  });
}

test("Codex backend refuses duplicate terminal callbacks without publishing the first candidate", async () => {
  const durable = durableResumeJournal();
  const backend = backendWithJournal(durable.journal, {
    async run(_request, observe) {
      observe({ type: "turn.started" });
      observe({ type: "turn.completed", usage: USAGE });
      observe({ type: "turn.completed", usage: USAGE });
    },
  }, "duplicate-terminal");
  const result = await backend.resume(resumeRequest());
  assert.equal(result.ok, false);
  assert.equal(result.error.category, "ambiguous_external_state");
  assert.equal(durable.state.turn.terminalSignal, null);
  assert.equal(durable.state.operation, null);
});
