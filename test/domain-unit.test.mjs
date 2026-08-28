import assert from "node:assert/strict";
import test from "node:test";
import {
  TASK_STATES,
  TASK_TRANSITIONS,
  WAITING_REASONS,
  addTaskDependency,
  createDomainSnapshot,
  createTask,
  evaluateTaskEligibility,
  evaluateWaitingContinuation,
  removeTaskDependency,
  setTaskParent,
  setTaskSupersession,
  transitionTask,
  updateTaskBody,
  updateTaskWaiting,
} from "../src/index.ts";

const ORACLE_TASK_STATES = Object.freeze(["idea", "ready", "running", "waiting", "completed", "cancelled"]);
const ORACLE_TRANSITIONS = Object.freeze([
  Object.freeze({ from: "idea", to: "ready", event: "mark_ready" }),
  Object.freeze({ from: "idea", to: "cancelled", event: "cancel" }),
  Object.freeze({ from: "ready", to: "running", event: "claim_accepted" }),
  Object.freeze({ from: "ready", to: "waiting", event: "dependency_cancelled" }),
  Object.freeze({ from: "ready", to: "cancelled", event: "cancel" }),
  Object.freeze({ from: "running", to: "waiting", event: "execution_wait" }),
  Object.freeze({ from: "running", to: "completed", event: "completion_accepted" }),
  Object.freeze({ from: "running", to: "cancelled", event: "interruption_verified" }),
  Object.freeze({ from: "waiting", to: "running", event: "resume_accepted" }),
  Object.freeze({ from: "waiting", to: "running", event: "retry_accepted" }),
  Object.freeze({ from: "waiting", to: "cancelled", event: "cancel" }),
]);
const ORACLE_TRANSITION_EVENTS = Object.freeze([
  "mark_ready",
  "cancel",
  "claim_accepted",
  "dependency_cancelled",
  "execution_wait",
  "completion_accepted",
  "interruption_verified",
  "resume_accepted",
  "retry_accepted",
]);

const project = (id = "p", enabled = true) => ({ id, enabled });

const waitingInput = (overrides = {}) => ({
  reason: "human_input",
  phase: "execution",
  requiredAction: "answer-question",
  lastErrorCode: "WAITING",
  lastErrorSummary: null,
  retryable: true,
  retryCount: 0,
  retryAfter: 50,
  executionId: "execution-1",
  workspaceRevision: "workspace-1",
  backendThreadId: "thread-1",
  ...overrides,
});

function taskValue(state, overrides = {}) {
  const revision = overrides.revision ?? (state === "idea" ? 1 : 2);
  const terminalFactRevision = revision - 1;
  return {
    id: overrides.id ?? "task",
    projectId: overrides.projectId ?? "p",
    state,
    revision,
    body: overrides.body ?? "body",
    parentId: overrides.parentId ?? null,
    dependencyIds: overrides.dependencyIds ?? [],
    waiting:
      state === "waiting"
        ? { ...waitingInput(overrides.waiting ?? {}), waitingTaskRevision: revision }
        : null,
    completion:
      state === "completed"
        ? { decisionId: overrides.decisionId ?? "decision-1", acceptedTaskRevision: terminalFactRevision }
        : null,
    cancellation:
      state === "cancelled"
        ? {
            event: overrides.cancellationEvent ?? "cancel",
            reason: overrides.cancellationReason ?? "cancelled",
            verificationId: overrides.verificationId ?? null,
            acceptedTaskRevision: terminalFactRevision,
          }
        : null,
    supersedesTaskId: overrides.supersedesTaskId ?? null,
  };
}

function snapshot(tasks, projects = [project()]) {
  const result = createDomainSnapshot({ projects, tasks });
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.error));
  return result.value;
}

function getTask(domainSnapshot, id = "task") {
  const value = domainSnapshot.tasks.find((candidate) => candidate.id === id);
  assert(value, `missing ${id}`);
  return value;
}

function expectFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  return result.error;
}

function external(task) {
  return {
    taskId: task.id,
    taskRevision: task.revision,
    authorization: "accepted",
    reliability: "accepted",
  };
}

function completion(task) {
  return { decisionId: "decision-current", taskId: task.id, taskRevision: task.revision, status: "accepted" };
}

function executionDisposition(task, status = "stopped") {
  return {
    receiptId: "execution-receipt",
    taskId: task.id,
    taskRevision: task.revision,
    executionId: task.waiting?.executionId ?? "execution-1",
    status,
  };
}

function continuation(task, kind, overrides = {}) {
  return {
    taskId: task.id,
    expectedTaskRevision: task.revision,
    readRevision: "read-1",
    kind,
    requiredActionReceipt: {
      receiptId: "action-receipt",
      taskId: task.id,
      taskRevision: task.revision,
      requiredAction: task.waiting?.requiredAction ?? "answer-question",
      status: "accepted",
    },
    targetExecutionId: task.waiting?.executionId ?? null,
    targetWorkspaceRevision: task.waiting?.workspaceRevision ?? null,
    targetBackendThreadId: task.waiting?.backendThreadId ?? null,
    trustedTime: 100,
    ...overrides,
  };
}

function legalFixture(transition) {
  if (transition.event === "dependency_cancelled") {
    const subject = taskValue("ready", { dependencyIds: ["dependency"] });
    const domainSnapshot = snapshot([subject, taskValue("cancelled", { id: "dependency" })]);
    return {
      snapshot: domainSnapshot,
      command: {
        taskId: subject.id,
        event: transition.event,
        targetState: transition.to,
        payload: { waiting: waitingInput({ reason: "dependency_cancelled" }) },
      },
    };
  }
  const subject = taskValue(transition.from);
  const domainSnapshot = snapshot([subject]);
  const current = getTask(domainSnapshot);
  let payload;
  switch (transition.event) {
    case "mark_ready":
      payload = {};
      break;
    case "claim_accepted":
      payload = { externalAcceptance: external(current) };
      break;
    case "execution_wait":
      payload = { waiting: waitingInput() };
      break;
    case "completion_accepted":
      payload = { decision: completion(current) };
      break;
    case "resume_accepted":
      payload = { continuation: continuation(current, "resume"), externalAcceptance: external(current) };
      break;
    case "retry_accepted":
      payload = { continuation: continuation(current, "retry"), externalAcceptance: external(current) };
      break;
    case "interruption_verified":
      payload = {
        reason: "interrupted",
        verification: executionDisposition(current),
        dependentWaiting: [],
      };
      break;
    case "cancel":
      payload = {
        reason: "cancelled",
        executionDisposition: current.state === "waiting" ? executionDisposition(current, "absent") : null,
        dependentWaiting: [],
      };
      break;
    default:
      assert.fail(`unexpected event ${transition.event}`);
  }
  return {
    snapshot: domainSnapshot,
    command: { taskId: current.id, event: transition.event, targetState: transition.to, payload },
  };
}

function commandForTarget(subject, targetState) {
  switch (targetState) {
    case "idea":
      return { taskId: subject.id, event: "mark_ready", targetState, payload: {} };
    case "ready":
      return { taskId: subject.id, event: "mark_ready", targetState, payload: {} };
    case "running":
      return {
        taskId: subject.id,
        event: "claim_accepted",
        targetState,
        payload: { externalAcceptance: external(subject) },
      };
    case "waiting":
      return {
        taskId: subject.id,
        event: "execution_wait",
        targetState,
        payload: { waiting: waitingInput() },
      };
    case "completed":
      return {
        taskId: subject.id,
        event: "completion_accepted",
        targetState,
        payload: { decision: completion(subject) },
      };
    case "cancelled":
      return {
        taskId: subject.id,
        event: "cancel",
        targetState,
        payload: {
          reason: "cancelled",
          executionDisposition: subject.state === "waiting" ? executionDisposition(subject) : null,
          dependentWaiting: [],
        },
      };
    default:
      assert.fail(`unknown state ${targetState}`);
  }
}

test("the exact transition relation accepts every legal edge and event", () => {
  assert.deepEqual(TASK_STATES, ORACLE_TASK_STATES);
  assert.deepEqual(
    TASK_TRANSITIONS.map(({ from, to, event }) => [from, to, event]),
    ORACLE_TRANSITIONS.map(({ from, to, event }) => [from, to, event]),
  );
  for (const transition of ORACLE_TRANSITIONS) {
    const fixture = legalFixture(transition);
    const before = getTask(fixture.snapshot).revision;
    const result = transitionTask(fixture.snapshot, fixture.command);
    assert.equal(result.ok, true, `${transition.from}->${transition.to}/${transition.event}`);
    const after = getTask(result.value.snapshot);
    assert.equal(after.state, transition.to);
    assert.equal(after.revision, before + 1);
    assert.equal(result.events[0].details.domainEvent, transition.event);
  }
});

test("every other state pair, including every same-state pair, is illegal", () => {
  const legalPairs = new Set(ORACLE_TRANSITIONS.map(({ from, to }) => `${from}:${to}`));
  for (const from of ORACLE_TASK_STATES) {
    for (const to of ORACLE_TASK_STATES) {
      if (legalPairs.has(`${from}:${to}`)) continue;
      const domainSnapshot = snapshot([taskValue(from)]);
      const subject = getTask(domainSnapshot);
      const result = transitionTask(domainSnapshot, commandForTarget(subject, to));
      assert.equal(result.ok, false, `${from}->${to}`);
      assert(["ILLEGAL_TRANSITION", "TERMINAL_IMMUTABLE"].includes(result.error.code), result.error.code);
      assert.deepEqual(getTask(domainSnapshot), subject);
    }
  }
});

test("every non-authoritative state, target, and event tuple is illegal", () => {
  const legalTuples = new Set(ORACLE_TRANSITIONS.map(({ from, to, event }) => `${from}:${to}:${event}`));
  for (const from of ORACLE_TASK_STATES) {
    for (const to of ORACLE_TASK_STATES) {
      for (const event of ORACLE_TRANSITION_EVENTS) {
        if (legalTuples.has(`${from}:${to}:${event}`)) continue;
        const domainSnapshot = snapshot([taskValue(from)]);
        const before = structuredClone(domainSnapshot);
        const result = transitionTask(domainSnapshot, {
          taskId: "task",
          event,
          targetState: to,
          payload: {},
        });
        assert.equal(result.ok, false, `${from}->${to}/${event}`);
        assert(["ILLEGAL_TRANSITION", "TERMINAL_IMMUTABLE"].includes(result.error.code), result.error.code);
        assert.deepEqual(domainSnapshot, before);
      }
    }
  }
});

test("successful mutations increment exactly once while rejected and no-op commands do not mutate", () => {
  const originalInput = { projects: [project()], tasks: [taskValue("idea")] };
  const canonical = createDomainSnapshot(originalInput);
  assert.equal(canonical.ok, true);
  assert.equal(Object.isFrozen(canonical.value), true);
  assert.equal(Object.isFrozen(canonical.value.tasks), true);
  assert.equal(Object.isFrozen(getTask(canonical.value)), true);
  assert.equal(Object.isFrozen(getTask(canonical.value).dependencyIds), true);
  assert.equal(Object.isFrozen(originalInput), false);

  const body = updateTaskBody(canonical.value, { taskId: "task", body: "changed" });
  assert.equal(body.ok, true);
  assert.equal(getTask(body.value.snapshot).revision, 2);
  assert.equal(getTask(canonical.value).revision, 1);
  expectFailure(updateTaskBody(body.value.snapshot, { taskId: "task", body: "changed" }), "NO_OP");
  assert.equal(getTask(body.value.snapshot).revision, 2);

  const created = createTask(body.value.snapshot, {
    id: "new-task",
    projectId: "p",
    body: "new",
    supersedesTaskId: null,
  });
  assert.equal(created.ok, true);
  assert.equal(getTask(created.value.snapshot, "new-task").revision, 1);
  expectFailure(
    createTask(created.value.snapshot, { id: "new-task", projectId: "p", body: "duplicate", supersedesTaskId: null }),
    "TASK_ALREADY_EXISTS",
  );

  const waitingSnapshot = snapshot([taskValue("waiting")]);
  const waitingBody = updateTaskBody(waitingSnapshot, { taskId: "task", body: "waiting changed" });
  assert.equal(waitingBody.ok, true);
  const changedWaiting = getTask(waitingBody.value.snapshot);
  assert.equal(changedWaiting.revision, 3);
  assert.equal(changedWaiting.waiting.waitingTaskRevision, 3);

  const waitingChanged = updateTaskWaiting(waitingBody.value.snapshot, {
    taskId: "task",
    waiting: waitingInput({
      requiredAction: "answer-follow-up",
      retryCount: 1,
      retryAfter: 75,
    }),
  });
  assert.equal(waitingChanged.ok, true);
  const refreshedWaiting = getTask(waitingChanged.value.snapshot);
  assert.equal(refreshedWaiting.revision, 4);
  assert.equal(refreshedWaiting.waiting.waitingTaskRevision, 4);
  assert.equal(refreshedWaiting.waiting.requiredAction, "answer-follow-up");
  assert.equal(waitingChanged.events[0].type, "task.waiting_changed");
  expectFailure(
    updateTaskWaiting(waitingChanged.value.snapshot, {
      taskId: "task",
      waiting: waitingInput({
        requiredAction: "answer-follow-up",
        retryCount: 1,
        retryAfter: 75,
      }),
    }),
    "NO_OP",
  );
  assert.equal(getTask(waitingChanged.value.snapshot).revision, 4);
  expectFailure(
    updateTaskWaiting(canonical.value, { taskId: "task", waiting: waitingInput() }),
    "MUTATION_NOT_ALLOWED",
  );
});

test("terminal Tasks and terminal facts are immutable", () => {
  for (const state of ["completed", "cancelled"]) {
    const domainSnapshot = snapshot([taskValue(state)]);
    const terminal = getTask(domainSnapshot);
    assert.equal(Object.isFrozen(terminal), true);
    assert.equal(Object.isFrozen(terminal.completion ?? terminal.cancellation), true);
    expectFailure(updateTaskBody(domainSnapshot, { taskId: terminal.id, body: "rewrite" }), "TERMINAL_IMMUTABLE");
    expectFailure(setTaskParent(domainSnapshot, { taskId: terminal.id, parentId: null }), "TERMINAL_IMMUTABLE");
    expectFailure(
      addTaskDependency(domainSnapshot, { taskId: terminal.id, dependencyId: "missing" }),
      "TERMINAL_IMMUTABLE",
    );
    expectFailure(setTaskSupersession(domainSnapshot, { taskId: terminal.id, supersedesTaskId: null }), "TERMINAL_IMMUTABLE");
    expectFailure(updateTaskWaiting(domainSnapshot, { taskId: terminal.id, waiting: waitingInput() }), "TERMINAL_IMMUTABLE");
    expectFailure(transitionTask(domainSnapshot, commandForTarget(terminal, "idea")), "TERMINAL_IMMUTABLE");
    assert.deepEqual(getTask(domainSnapshot), terminal);
  }
});

test("parent operations form one same-Project forest and have no dependency semantics", () => {
  let current = snapshot(
    [
      taskValue("idea", { id: "a" }),
      taskValue("ready", { id: "b" }),
      taskValue("waiting", { id: "c" }),
      taskValue("idea", { id: "x", projectId: "other" }),
    ],
    [project(), project("other")],
  );
  const bUnderA = setTaskParent(current, { taskId: "b", parentId: "a" });
  assert.equal(bUnderA.ok, true);
  current = bUnderA.value.snapshot;
  const cUnderB = setTaskParent(current, { taskId: "c", parentId: "b" });
  assert.equal(cUnderB.ok, true);
  current = cUnderB.value.snapshot;
  expectFailure(setTaskParent(current, { taskId: "a", parentId: "c" }), "PARENT_CYCLE");
  expectFailure(setTaskParent(current, { taskId: "b", parentId: "b" }), "PARENT_SELF");
  expectFailure(setTaskParent(current, { taskId: "x", parentId: "a" }), "PARENT_PROJECT_MISMATCH");

  const reparent = setTaskParent(current, { taskId: "c", parentId: "a" });
  assert.equal(reparent.ok, true);
  assert.equal(getTask(reparent.value.snapshot, "c").parentId, "a");
  assert.deepEqual(getTask(reparent.value.snapshot, "c").dependencyIds, []);
  assert.equal(getTask(reparent.value.snapshot, "c").waiting.waitingTaskRevision, 4);

  const parentCancelled = taskValue("cancelled", { id: "parent" });
  const readyChild = taskValue("ready", { id: "child", parentId: "parent" });
  const grouped = snapshot([parentCancelled, readyChild]);
  const eligibility = evaluateTaskEligibility(grouped, { taskId: "child", readRevision: "grouped-read" });
  assert.equal(eligibility.ok, true);
  assert.equal(eligibility.value.eligible, true);
  assert.deepEqual(eligibility.value.reasons, []);

  const running = snapshot([taskValue("running")]);
  expectFailure(setTaskParent(running, { taskId: "task", parentId: null }), "MUTATION_NOT_ALLOWED");
});

test("dependency operations form a cross-Project DAG and reject self, duplicate, and multi-hop cycles", () => {
  let current = snapshot(
    [
      taskValue("idea", { id: "a" }),
      taskValue("idea", { id: "b", projectId: "other" }),
      taskValue("idea", { id: "c" }),
    ],
    [project(), project("other")],
  );
  const crossProject = addTaskDependency(current, { taskId: "a", dependencyId: "b" });
  assert.equal(crossProject.ok, true);
  current = crossProject.value.snapshot;
  assert.deepEqual(getTask(current, "a").dependencyIds, ["b"]);
  expectFailure(addTaskDependency(current, { taskId: "a", dependencyId: "a" }), "DEPENDENCY_SELF");
  expectFailure(addTaskDependency(current, { taskId: "a", dependencyId: "b" }), "DEPENDENCY_DUPLICATE");

  const bToC = addTaskDependency(current, { taskId: "b", dependencyId: "c" });
  assert.equal(bToC.ok, true);
  current = bToC.value.snapshot;
  expectFailure(addTaskDependency(current, { taskId: "c", dependencyId: "a" }), "DEPENDENCY_CYCLE");
  const removed = removeTaskDependency(current, { taskId: "a", dependencyId: "b" });
  assert.equal(removed.ok, true);
  assert.deepEqual(getTask(removed.value.snapshot, "a").dependencyIds, []);
  expectFailure(removeTaskDependency(removed.value.snapshot, { taskId: "a", dependencyId: "b" }), "NO_OP");
});

test("only completed dependencies satisfy eligibility and cancellation affects ready direct dependents only", () => {
  for (const dependencyState of TASK_STATES) {
    const domainSnapshot = snapshot([
      taskValue("ready", { id: "dependent", dependencyIds: ["dependency"] }),
      taskValue(dependencyState, { id: "dependency" }),
    ]);
    const result = evaluateTaskEligibility(domainSnapshot, { taskId: "dependent", readRevision: dependencyState });
    assert.equal(result.ok, true);
    assert.equal(result.value.eligible, dependencyState === "completed", dependencyState);
  }

  const prerequisite = taskValue("ready", { id: "prerequisite" });
  const directReady = taskValue("ready", { id: "direct", dependencyIds: ["prerequisite"] });
  const indirectReady = taskValue("ready", { id: "indirect", dependencyIds: ["direct"] });
  const ideaDependent = taskValue("idea", { id: "idea-dependent", dependencyIds: ["prerequisite"] });
  const runningDependent = taskValue("running", { id: "running-dependent", dependencyIds: ["prerequisite"] });
  const domainSnapshot = snapshot([prerequisite, directReady, indirectReady, ideaDependent, runningDependent]);
  const result = transitionTask(domainSnapshot, {
    taskId: "prerequisite",
    event: "cancel",
    targetState: "cancelled",
    payload: {
      reason: "declined",
      executionDisposition: null,
      dependentWaiting: [
        { taskId: "direct", waiting: waitingInput({ reason: "dependency_cancelled", executionId: null }) },
      ],
    },
  });
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.error));
  assert.equal(getTask(result.value.snapshot, "prerequisite").state, "cancelled");
  assert.equal(getTask(result.value.snapshot, "direct").state, "waiting");
  assert.equal(getTask(result.value.snapshot, "direct").waiting.reason, "dependency_cancelled");
  assert.equal(getTask(result.value.snapshot, "indirect").state, "ready");
  assert.equal(getTask(result.value.snapshot, "idea-dependent").state, "idea");
  assert.equal(getTask(result.value.snapshot, "running-dependent").state, "running");
  assert.deepEqual(result.value.changedTaskIds, ["direct", "prerequisite"]);
});

test("eligibility is the exact ready, registered enabled Project, completed-dependency predicate", () => {
  for (const state of TASK_STATES) {
    for (const enabled of [false, true]) {
      for (const dependencyState of ["ready", "completed"]) {
        const domainSnapshot = snapshot(
          [taskValue(state, { id: "subject", dependencyIds: ["dependency"] }), taskValue(dependencyState, { id: "dependency" })],
          [project("p", enabled)],
        );
        const result = evaluateTaskEligibility(domainSnapshot, { taskId: "subject", readRevision: "cartesian" });
        assert.equal(result.ok, true);
        assert.equal(result.value.eligible, state === "ready" && enabled && dependencyState === "completed");
        assert.equal(result.value.readRevision, "cartesian");
      }
    }
  }

  const unregisteredProject = {
    projects: [],
    tasks: [taskValue("ready")],
  };
  const missingProject = evaluateTaskEligibility(unregisteredProject, { taskId: "task", readRevision: "missing-project" });
  assert.equal(missingProject.ok, true);
  assert.deepEqual(missingProject.value.reasons, ["PROJECT_NOT_REGISTERED"]);

  const unregisteredDependency = {
    projects: [project()],
    tasks: [taskValue("ready", { dependencyIds: ["missing"] })],
  };
  const missingDependency = evaluateTaskEligibility(unregisteredDependency, {
    taskId: "task",
    readRevision: "missing-dependency",
  });
  assert.equal(missingDependency.ok, true);
  assert.deepEqual(missingDependency.value.reasons, ["DEPENDENCY_NOT_REGISTERED"]);

  const unrelatedMissingProject = {
    projects: [project()],
    tasks: [taskValue("ready", { id: "subject" }), taskValue("idea", { id: "unrelated", projectId: "missing" })],
  };
  expectFailure(
    evaluateTaskEligibility(unrelatedMissingProject, { taskId: "subject", readRevision: "unrelated-project" }),
    "INVALID_SNAPSHOT",
  );

  const unrelatedMissingDependency = {
    projects: [project()],
    tasks: [
      taskValue("ready", { id: "subject" }),
      taskValue("idea", { id: "unrelated", dependencyIds: ["missing"] }),
    ],
  };
  expectFailure(
    evaluateTaskEligibility(unrelatedMissingDependency, {
      taskId: "subject",
      readRevision: "unrelated-dependency",
    }),
    "INVALID_SNAPSHOT",
  );

  const parentCycle = {
    projects: [project()],
    tasks: [
      taskValue("ready", { id: "a", parentId: "b" }),
      taskValue("ready", { id: "b", parentId: "a" }),
    ],
  };
  expectFailure(
    evaluateTaskEligibility(parentCycle, { taskId: "a", readRevision: "invalid-parent-cycle" }),
    "INVALID_SNAPSHOT",
  );

  const dependencyCycle = {
    projects: [project()],
    tasks: [
      taskValue("ready", { id: "a", dependencyIds: ["b"] }),
      taskValue("completed", { id: "b", dependencyIds: ["a"] }),
    ],
  };
  expectFailure(
    evaluateTaskEligibility(dependencyCycle, { taskId: "a", readRevision: "invalid-dependency-cycle" }),
    "INVALID_SNAPSHOT",
  );

  const clean = snapshot([taskValue("ready")]);
  expectFailure(
    evaluateTaskEligibility(clean, {
      taskId: "task",
      readRevision: "read",
      authorization: true,
      resourceAvailable: false,
    }),
    "INVALID_INPUT",
  );
});

test("waiting resume and retry predicates fail closed on every freshness and identity boundary", () => {
  const completedDependency = taskValue("completed", { id: "dependency" });
  const subject = taskValue("waiting", { dependencyIds: ["dependency"] });
  const base = snapshot([subject, completedDependency]);
  const current = getTask(base);

  for (const kind of ["resume", "retry"]) {
    const result = evaluateWaitingContinuation(base, continuation(current, kind));
    assert.equal(result.ok, true);
    assert.equal(result.value.eligible, true, `${kind}: ${result.value.reasons.join(",")}`);
    assert.equal(result.value.readRevision, "read-1");
  }
  const ordinary = evaluateTaskEligibility(base, { taskId: "task", readRevision: "ordinary" });
  assert.equal(ordinary.ok, true);
  assert.equal(ordinary.value.eligible, false);
  assert.deepEqual(ordinary.value.reasons, ["STATE_NOT_READY"]);

  const cases = [
    ["stale revision", { expectedTaskRevision: current.revision + 1 }, "TASK_REVISION_STALE"],
    [
      "stale receipt revision",
      {
        requiredActionReceipt: {
          ...continuation(current, "resume").requiredActionReceipt,
          taskRevision: current.revision - 1,
        },
      },
      "REQUIRED_ACTION_RECEIPT_STALE",
    ],
    [
      "stale receipt",
      {
        requiredActionReceipt: {
          ...continuation(current, "resume").requiredActionReceipt,
          requiredAction: "different-action",
        },
      },
      "REQUIRED_ACTION_RECEIPT_STALE",
    ],
    ["execution mismatch", { targetExecutionId: "different" }, "IDENTITY_MISMATCH"],
    ["workspace mismatch", { targetWorkspaceRevision: "different" }, "IDENTITY_MISMATCH"],
    ["thread mismatch", { targetBackendThreadId: "different" }, "IDENTITY_MISMATCH"],
  ];
  for (const [name, override, reason] of cases) {
    const result = evaluateWaitingContinuation(base, continuation(current, "resume", override));
    assert.equal(result.ok, true, name);
    assert.equal(result.value.eligible, false, name);
    assert(result.value.reasons.includes(reason), `${name}: ${result.value.reasons.join(",")}`);
  }

  const disabled = snapshot([subject, completedDependency], [project("p", false)]);
  const disabledResult = evaluateWaitingContinuation(disabled, continuation(getTask(disabled), "resume"));
  assert.equal(disabledResult.ok, true);
  assert(disabledResult.value.reasons.includes("PROJECT_DISABLED"));

  const unregisteredProject = {
    projects: [project("registered")],
    tasks: [subject, taskValue("completed", { id: "dependency", projectId: "registered" })],
  };
  const unregisteredResult = evaluateWaitingContinuation(unregisteredProject, continuation(subject, "resume"));
  assert.equal(unregisteredResult.ok, true);
  assert(unregisteredResult.value.reasons.includes("PROJECT_NOT_REGISTERED"));

  const invalidParent = {
    projects: [project()],
    tasks: [
      { ...subject, parentId: "parent" },
      taskValue("idea", { id: "parent", parentId: "task" }),
      completedDependency,
    ],
  };
  expectFailure(evaluateWaitingContinuation(invalidParent, continuation(subject, "resume")), "INVALID_SNAPSHOT");

  const incomplete = snapshot([subject, taskValue("ready", { id: "dependency" })]);
  const incompleteResult = evaluateWaitingContinuation(incomplete, continuation(getTask(incomplete), "resume"));
  assert.equal(incompleteResult.ok, true);
  assert(incompleteResult.value.reasons.includes("DEPENDENCY_NOT_COMPLETED"));

  const missingDependency = { projects: [project()], tasks: [subject] };
  const missingDependencyResult = evaluateWaitingContinuation(
    missingDependency,
    continuation(subject, "resume"),
  );
  assert.equal(missingDependencyResult.ok, true);
  assert(missingDependencyResult.value.reasons.includes("DEPENDENCY_NOT_REGISTERED"));

  const unrelatedMissingFacts = {
    projects: [project()],
    tasks: [
      subject,
      completedDependency,
      taskValue("idea", { id: "unrelated", projectId: "missing", dependencyIds: ["absent"] }),
    ],
  };
  expectFailure(
    evaluateWaitingContinuation(unrelatedMissingFacts, continuation(subject, "resume")),
    "INVALID_SNAPSHOT",
  );

  const early = evaluateWaitingContinuation(base, continuation(current, "retry", { trustedTime: 49 }));
  assert.equal(early.ok, true);
  assert(early.value.reasons.includes("RETRY_TOO_EARLY"));

  const notRetryableSnapshot = snapshot([
    taskValue("waiting", { dependencyIds: ["dependency"], waiting: { retryable: false } }),
    completedDependency,
  ]);
  const notRetryable = evaluateWaitingContinuation(
    notRetryableSnapshot,
    continuation(getTask(notRetryableSnapshot), "retry"),
  );
  assert.equal(notRetryable.ok, true);
  assert(notRetryable.value.reasons.includes("NOT_RETRYABLE"));

  const noExecutionSnapshot = snapshot([
    taskValue("waiting", { dependencyIds: ["dependency"], waiting: { executionId: null } }),
    completedDependency,
  ]);
  const noExecution = evaluateWaitingContinuation(
    noExecutionSnapshot,
    continuation(getTask(noExecutionSnapshot), "resume"),
  );
  assert.equal(noExecution.ok, true);
  assert(noExecution.value.reasons.includes("EXECUTION_ID_REQUIRED"));

  expectFailure(
    evaluateWaitingContinuation(base, {
      ...continuation(current, "resume"),
      requiredActionReceipt: undefined,
    }),
    "INVALID_INPUT",
  );
});

test("waiting transitions consume the exact continuation predicate and preserve recorded identities", () => {
  const domainSnapshot = snapshot([taskValue("waiting")]);
  const current = getTask(domainSnapshot);
  const command = continuation(current, "resume");
  const result = transitionTask(domainSnapshot, {
    taskId: current.id,
    event: "resume_accepted",
    targetState: "running",
    payload: { continuation: command, externalAcceptance: external(current) },
  });
  assert.equal(result.ok, true);
  const running = getTask(result.value.snapshot);
  assert.equal(running.state, "running");
  assert.equal(running.waiting, null);
  assert.equal(command.targetExecutionId, "execution-1");
  assert.equal(command.targetWorkspaceRevision, "workspace-1");
  assert.equal(command.targetBackendThreadId, "thread-1");

  expectFailure(
    transitionTask(domainSnapshot, {
      taskId: current.id,
      event: "resume_accepted",
      targetState: "running",
      payload: {
        continuation: continuation(current, "resume", { targetBackendThreadId: "replacement" }),
        externalAcceptance: external(current),
      },
    }),
    "CONTINUATION_NOT_ELIGIBLE",
  );
  expectFailure(
    transitionTask(domainSnapshot, {
      taskId: current.id,
      event: "claim_accepted",
      targetState: "running",
      payload: { externalAcceptance: external(current) },
    }),
    "ILLEGAL_TRANSITION",
  );
});

test("waiting cancellation verifies a referenced execution and needs no receipt when none is recorded", () => {
  const noExecution = snapshot([taskValue("waiting", { waiting: { executionId: null } })]);
  const withoutReceipt = transitionTask(noExecution, {
    taskId: "task",
    event: "cancel",
    targetState: "cancelled",
    payload: { reason: "declined", executionDisposition: null, dependentWaiting: [] },
  });
  assert.equal(withoutReceipt.ok, true, withoutReceipt.ok ? "" : JSON.stringify(withoutReceipt.error));
  assert.equal(getTask(withoutReceipt.value.snapshot).cancellation.verificationId, null);

  const withExecution = snapshot([taskValue("waiting")]);
  expectFailure(
    transitionTask(withExecution, {
      taskId: "task",
      event: "cancel",
      targetState: "cancelled",
      payload: { reason: "declined", executionDisposition: null, dependentWaiting: [] },
    }),
    "INVALID_INPUT",
  );
});

test("structured invalid inputs and boundary revisions fail without mutation", () => {
  expectFailure(createDomainSnapshot({ projects: [], tasks: [], extra: true }), "INVALID_SNAPSHOT");
  expectFailure(
    createDomainSnapshot({ projects: [project()], tasks: [{ ...taskValue("idea"), state: "unknown" }] }),
    "INVALID_SNAPSHOT",
  );
  expectFailure(
    createDomainSnapshot({ projects: [project()], tasks: [{ ...taskValue("idea"), revision: 0 }] }),
    "INVALID_SNAPSHOT",
  );
  expectFailure(
    createDomainSnapshot({ projects: [project()], tasks: [taskValue("idea"), taskValue("idea")] }),
    "INVALID_SNAPSHOT",
  );
  expectFailure(
    createDomainSnapshot({
      projects: [project()],
      tasks: [taskValue("idea", { id: "a", parentId: "b" }), taskValue("idea", { id: "b", parentId: "a" })],
    }),
    "INVALID_SNAPSHOT",
  );

  const domainSnapshot = snapshot([taskValue("idea")]);
  expectFailure(updateTaskBody(domainSnapshot, { taskId: "task", body: "x", extra: true }), "INVALID_INPUT");
  expectFailure(setTaskParent(domainSnapshot, { taskId: "", parentId: null }), "INVALID_INPUT");
  expectFailure(
    transitionTask(domainSnapshot, { taskId: "task", event: "mark_ready", targetState: "ready", payload: { extra: true } }),
    "INVALID_INPUT",
  );

  const running = snapshot([taskValue("running")]);
  const incompleteWaiting = waitingInput();
  delete incompleteWaiting.backendThreadId;
  expectFailure(
    transitionTask(running, {
      taskId: "task",
      event: "execution_wait",
      targetState: "waiting",
      payload: { waiting: incompleteWaiting },
    }),
    "INVALID_INPUT",
  );
  assert.equal(getTask(running).revision, 2);

  const exhausted = snapshot([taskValue("idea", { revision: Number.MAX_SAFE_INTEGER })]);
  expectFailure(updateTaskBody(exhausted, { taskId: "task", body: "cannot increment" }), "REVISION_EXHAUSTED");
  assert.equal(getTask(exhausted).revision, Number.MAX_SAFE_INTEGER);
  const exhaustedWaiting = snapshot([taskValue("waiting", { revision: Number.MAX_SAFE_INTEGER })]);
  expectFailure(
    updateTaskWaiting(exhaustedWaiting, {
      taskId: "task",
      waiting: waitingInput({ requiredAction: "new-action" }),
    }),
    "REVISION_EXHAUSTED",
  );
  assert.equal(getTask(exhaustedWaiting).revision, Number.MAX_SAFE_INTEGER);
  assert.equal(Object.isFrozen(TASK_STATES), true);
  assert.equal(Object.isFrozen(TASK_TRANSITIONS), true);
  assert.equal(Object.isFrozen(WAITING_REASONS), true);
});
