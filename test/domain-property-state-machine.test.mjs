import assert from "node:assert/strict";
import test from "node:test";
import {
  addTaskDependency,
  createDomainSnapshot,
  createTask,
  removeTaskDependency,
  setTaskParent,
  setTaskSupersession,
  transitionTask,
  updateTaskBody,
  updateTaskWaiting,
} from "../src/index.ts";

const SEEDS = Object.freeze([0x1a2b3c4d, 0x5eedc0de, 0x7f4a7c15, 0xc001d00d]);
const STEPS = 240;
const ORACLE_STATES = Object.freeze(["idea", "ready", "running", "waiting", "completed", "cancelled"]);
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
const ORACLE_TRANSITION_KEYS = new Set(
  ORACLE_TRANSITIONS.map(({ from, to, event }) => `${from}:${to}:${event}`),
);
const ORACLE_EVENTS = Object.freeze([...new Set(ORACLE_TRANSITIONS.map(({ event }) => event))]);

function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function choose(next, values) {
  return values[next() % values.length];
}

function waitingInput(tag, overrides = {}) {
  return {
    reason: "execution_failed",
    phase: `phase-${tag}`,
    requiredAction: `action-${tag}`,
    lastErrorCode: "EXECUTION_FAILED",
    lastErrorSummary: null,
    retryable: true,
    retryCount: 0,
    retryAfter: 20,
    executionId: `execution-${tag}`,
    workspaceRevision: `workspace-${tag}`,
    backendThreadId: `thread-${tag}`,
    ...overrides,
  };
}

function taskValue(state, id, overrides = {}) {
  const revision = overrides.revision ?? (state === "idea" ? 1 : 2);
  return {
    id,
    projectId: overrides.projectId ?? "p",
    state,
    revision,
    body: overrides.body ?? `body-${id}`,
    parentId: overrides.parentId ?? null,
    dependencyIds: overrides.dependencyIds ?? [],
    waiting:
      state === "waiting"
        ? { ...waitingInput(id, overrides.waiting ?? {}), waitingTaskRevision: revision }
        : null,
    completion:
      state === "completed" ? { decisionId: `decision-${id}`, acceptedTaskRevision: revision - 1 } : null,
    cancellation:
      state === "cancelled"
        ? { event: "cancel", reason: `cancel-${id}`, verificationId: null, acceptedTaskRevision: revision - 1 }
        : null,
    supersedesTaskId: overrides.supersedesTaskId ?? null,
  };
}

function canonical(input) {
  const result = createDomainSnapshot(input);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.error));
  return result.value;
}

function byId(snapshot, taskId) {
  return snapshot.tasks.find((task) => task.id === taskId);
}

function external(task) {
  return {
    taskId: task.id,
    taskRevision: task.revision,
    authorization: "accepted",
    reliability: "accepted",
  };
}

function continuation(task, kind, step) {
  return {
    taskId: task.id,
    expectedTaskRevision: task.revision,
    readRevision: `seed-read-${step}`,
    kind,
    requiredActionReceipt: {
      receiptId: `receipt-${step}`,
      taskId: task.id,
      taskRevision: task.revision,
      requiredAction: task.waiting?.requiredAction ?? `action-${task.id}`,
      status: "accepted",
    },
    targetExecutionId: task.waiting?.executionId ?? null,
    targetWorkspaceRevision: task.waiting?.workspaceRevision ?? null,
    targetBackendThreadId: task.waiting?.backendThreadId ?? null,
    trustedTime: 100,
  };
}

function transitionCommand(snapshot, task, transition, step) {
  let payload;
  switch (transition.event) {
    case "mark_ready":
      payload = {};
      break;
    case "claim_accepted":
      payload = { externalAcceptance: external(task) };
      break;
    case "dependency_cancelled":
      payload = { waiting: waitingInput(step, { reason: "dependency_cancelled" }) };
      break;
    case "execution_wait":
      payload = { waiting: waitingInput(step) };
      break;
    case "completion_accepted":
      payload = {
        decision: {
          decisionId: `decision-${step}`,
          taskId: task.id,
          taskRevision: task.revision,
          status: "accepted",
        },
      };
      break;
    case "resume_accepted":
      payload = { continuation: continuation(task, "resume", step), externalAcceptance: external(task) };
      break;
    case "retry_accepted":
      payload = { continuation: continuation(task, "retry", step), externalAcceptance: external(task) };
      break;
    case "cancel": {
      const directReady = snapshot.tasks
        .filter((candidate) => candidate.state === "ready" && candidate.dependencyIds.includes(task.id))
        .map((candidate) => ({
          taskId: candidate.id,
          waiting: waitingInput(`${step}-${candidate.id}`, {
            reason: "dependency_cancelled",
            executionId: null,
            workspaceRevision: null,
            backendThreadId: null,
          }),
        }));
      payload = {
        reason: `cancel-${step}`,
        executionDisposition:
          task.state === "waiting"
            ? {
                receiptId: `stop-${step}`,
                taskId: task.id,
                taskRevision: task.revision,
                executionId: task.waiting.executionId,
                status: "stopped",
              }
            : null,
        dependentWaiting: directReady,
      };
      break;
    }
    case "interruption_verified": {
      const directReady = snapshot.tasks
        .filter((candidate) => candidate.state === "ready" && candidate.dependencyIds.includes(task.id))
        .map((candidate) => ({
          taskId: candidate.id,
          waiting: waitingInput(`${step}-${candidate.id}`, {
            reason: "dependency_cancelled",
            executionId: null,
            workspaceRevision: null,
            backendThreadId: null,
          }),
        }));
      payload = {
        reason: `interrupt-${step}`,
        verification: {
          receiptId: `interrupt-receipt-${step}`,
          taskId: task.id,
          taskRevision: task.revision,
          executionId: `running-${task.id}`,
          status: "stopped",
        },
        dependentWaiting: directReady,
      };
      break;
    }
    default:
      assert.fail(`unknown transition event ${transition.event}`);
  }
  return { taskId: task.id, event: transition.event, targetState: transition.to, payload };
}

function terminalProjection(task) {
  return {
    state: task.state,
    revision: task.revision,
    projectId: task.projectId,
    body: task.body,
    parentId: task.parentId,
    dependencyIds: task.dependencyIds,
    completion: task.completion,
    cancellation: task.cancellation,
    supersedesTaskId: task.supersedesTaskId,
  };
}

function verifyIndependentSnapshot(snapshot) {
  const projects = new Set(snapshot.projects.map(({ id }) => id));
  const tasks = new Map(snapshot.tasks.map((task) => [task.id, task]));
  assert.equal(tasks.size, snapshot.tasks.length);
  for (const task of snapshot.tasks) {
    assert(projects.has(task.projectId), `missing project for ${task.id}`);
    assert.equal(new Set(task.dependencyIds).size, task.dependencyIds.length, `duplicate dependency for ${task.id}`);
    assert(!task.dependencyIds.includes(task.id), `self dependency for ${task.id}`);
    for (const dependencyId of task.dependencyIds) {
      assert(tasks.has(dependencyId), `missing dependency ${dependencyId} for ${task.id}`);
    }
    if (task.parentId !== null) {
      const parent = tasks.get(task.parentId);
      assert(parent, `missing parent ${task.parentId} for ${task.id}`);
      assert.equal(parent.projectId, task.projectId, `cross-project parent for ${task.id}`);
    }
    if (task.supersedesTaskId !== null) {
      assert(tasks.has(task.supersedesTaskId), `missing superseded Task for ${task.id}`);
      assert.notEqual(task.supersedesTaskId, task.id, `self supersession for ${task.id}`);
    }

    if (task.state === "waiting") {
      assert(task.waiting, `missing waiting envelope for ${task.id}`);
      assert.equal(task.waiting.waitingTaskRevision, task.revision, `stale waiting revision for ${task.id}`);
      assert.equal(task.completion, null);
      assert.equal(task.cancellation, null);
    } else if (task.state === "completed") {
      assert.equal(task.waiting, null);
      assert(task.completion, `missing completion for ${task.id}`);
      assert.equal(task.completion.acceptedTaskRevision, task.revision - 1);
      assert.equal(task.cancellation, null);
    } else if (task.state === "cancelled") {
      assert.equal(task.waiting, null);
      assert.equal(task.completion, null);
      assert(task.cancellation, `missing cancellation for ${task.id}`);
      assert.equal(task.cancellation.acceptedTaskRevision, task.revision - 1);
    } else {
      assert.equal(task.waiting, null);
      assert.equal(task.completion, null);
      assert.equal(task.cancellation, null);
    }

    const parentSeen = new Set([task.id]);
    let parentId = task.parentId;
    while (parentId !== null) {
      assert(!parentSeen.has(parentId), `parent cycle through ${task.id}`);
      parentSeen.add(parentId);
      parentId = tasks.get(parentId)?.parentId ?? null;
    }
  }

  const colors = new Map();
  const visit = (taskId) => {
    const color = colors.get(taskId);
    assert.notEqual(color, "visiting", `dependency cycle through ${taskId}`);
    if (color === "visited") return;
    colors.set(taskId, "visiting");
    for (const dependencyId of tasks.get(taskId).dependencyIds) visit(dependencyId);
    colors.set(taskId, "visited");
  };
  for (const taskId of tasks.keys()) visit(taskId);
}

function verifyTransitionOracle(before, result, command) {
  const task = byId(before, command.taskId);
  assert(task, `transition Task ${command.taskId} is absent`);
  const relationAllows = ORACLE_TRANSITION_KEYS.has(`${task.state}:${command.targetState}:${command.event}`);
  if (!relationAllows) {
    assert.equal(result.ok, false, `implementation accepted forbidden ${task.state}->${command.targetState}/${command.event}`);
  }
  if (result.ok) {
    assert(relationAllows, `successful transition is absent from the independent relation oracle`);
  }
}

function oracleEvent(type, taskId, taskRevisionBefore, taskRevisionAfter, details = {}) {
  return { type, taskId, taskRevisionBefore, taskRevisionAfter, details };
}

function verifyExactEventOracle(before, result, commandSummary) {
  if (!result.ok) return;
  const [operation, command] = commandSummary;
  const after = result.value.snapshot;
  const current = "taskId" in command ? byId(before, command.taskId) : undefined;
  let expected;
  switch (operation) {
    case "create":
      expected = [oracleEvent("task.created", command.id, null, 1)];
      break;
    case "body":
      expected = [oracleEvent("task.body_changed", command.taskId, current.revision, current.revision + 1)];
      break;
    case "parent":
      expected = [
        oracleEvent("task.parent_changed", command.taskId, current.revision, current.revision + 1, {
          parentId: command.parentId,
        }),
      ];
      break;
    case "dependency-add":
      expected = [
        oracleEvent("task.dependency_added", command.taskId, current.revision, current.revision + 1, {
          dependencyId: command.dependencyId,
        }),
      ];
      break;
    case "dependency-remove":
      expected = [
        oracleEvent("task.dependency_removed", command.taskId, current.revision, current.revision + 1, {
          dependencyId: command.dependencyId,
        }),
      ];
      break;
    case "supersession":
      expected = [
        oracleEvent("task.supersession_changed", command.taskId, current.revision, current.revision + 1, {
          supersedesTaskId: command.supersedesTaskId,
        }),
      ];
      break;
    case "waiting": {
      const changed = byId(after, command.taskId);
      assert.deepEqual(changed.waiting, {
        ...command.waiting,
        waitingTaskRevision: current.revision + 1,
      });
      expected = [
        oracleEvent("task.waiting_changed", command.taskId, current.revision, current.revision + 1, {
          waitingReason: command.waiting.reason,
          requiredAction: command.waiting.requiredAction,
        }),
      ];
      break;
    }
    case "transition": {
      expected = [
        oracleEvent("task.transitioned", command.taskId, current.revision, current.revision + 1, {
          domainEvent: command.event,
          fromState: current.state,
          toState: command.targetState,
        }),
      ];
      if (command.event === "cancel" || command.event === "interruption_verified") {
        const dependents = before.tasks
          .filter((task) => task.state === "ready" && task.dependencyIds.includes(command.taskId))
          .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
        expected.push(
          ...dependents.map((dependent) =>
            oracleEvent("task.transitioned", dependent.id, dependent.revision, dependent.revision + 1, {
              domainEvent: "dependency_cancelled",
              fromState: "ready",
              toState: "waiting",
            }),
          ),
        );
      }
      break;
    }
    default:
      assert.fail(`successful operation has no exact event oracle: ${operation}`);
  }
  assert.deepEqual(result.events, expected, `exact event mismatch for ${JSON.stringify(commandSummary)}`);
}

function verifyTransitionOutcomeOracle(before, result, command) {
  if (!result.ok) return;
  const previous = byId(before, command.taskId);
  const changed = byId(result.value.snapshot, command.taskId);
  assert(previous);
  assert(changed);
  assert.equal(changed.state, command.targetState);
  switch (command.event) {
    case "dependency_cancelled":
    case "execution_wait":
      assert.deepEqual(changed.waiting, {
        ...command.payload.waiting,
        waitingTaskRevision: previous.revision + 1,
      });
      break;
    case "completion_accepted":
      assert.deepEqual(changed.completion, {
        decisionId: command.payload.decision.decisionId,
        acceptedTaskRevision: previous.revision,
      });
      break;
    case "cancel":
      assert.deepEqual(changed.cancellation, {
        event: "cancel",
        reason: command.payload.reason,
        verificationId: command.payload.executionDisposition?.receiptId ?? null,
        acceptedTaskRevision: previous.revision,
      });
      break;
    case "interruption_verified":
      assert.deepEqual(changed.cancellation, {
        event: "interruption_verified",
        reason: command.payload.reason,
        verificationId: command.payload.verification.receiptId,
        acceptedTaskRevision: previous.revision,
      });
      break;
    case "resume_accepted":
    case "retry_accepted":
      assert.equal(changed.waiting, null);
      break;
    case "mark_ready":
    case "claim_accepted":
      break;
    default:
      assert.fail(`missing transition outcome oracle for ${command.event}`);
  }
}

function isMutable(task) {
  return task !== undefined && task.state !== "completed" && task.state !== "cancelled";
}

function isGraphMutable(task) {
  return isMutable(task) && ["idea", "ready", "waiting"].includes(task.state);
}

function oracleParentCycle(snapshot, taskId, parentId) {
  let cursor = parentId;
  const seen = new Set();
  while (cursor !== null) {
    if (cursor === taskId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = byId(snapshot, cursor)?.parentId ?? null;
  }
  return false;
}

function oracleDependencyReaches(snapshot, fromTaskId, targetTaskId) {
  const pending = [fromTaskId];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === targetTaskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...byId(snapshot, current).dependencyIds);
  }
  return false;
}

function oracleDependenciesCompleted(snapshot, task) {
  return task.dependencyIds.every((dependencyId) => byId(snapshot, dependencyId)?.state === "completed");
}

function oracleWaitingEqual(current, proposed) {
  return [
    "reason",
    "phase",
    "requiredAction",
    "lastErrorCode",
    "lastErrorSummary",
    "retryable",
    "retryCount",
    "retryAfter",
    "executionId",
    "workspaceRevision",
    "backendThreadId",
  ].every((key) => current[key] === proposed[key]);
}

function oracleTransitionSuccess(snapshot, command) {
  const task = byId(snapshot, command.taskId);
  if (!task) return false;
  if (!ORACLE_TRANSITION_KEYS.has(`${task.state}:${command.targetState}:${command.event}`)) return false;
  if (task.revision === Number.MAX_SAFE_INTEGER) return false;
  const project = snapshot.projects.find(({ id }) => id === task.projectId);
  switch (command.event) {
    case "mark_ready":
      return project?.enabled === true &&
        !task.dependencyIds.some((dependencyId) => byId(snapshot, dependencyId)?.state === "cancelled");
    case "claim_accepted":
      return project?.enabled === true && oracleDependenciesCompleted(snapshot, task);
    case "dependency_cancelled":
      return task.dependencyIds.some((dependencyId) => byId(snapshot, dependencyId)?.state === "cancelled");
    case "execution_wait":
    case "completion_accepted":
    case "interruption_verified":
      return true;
    case "resume_accepted":
      return (
        task.waiting !== null &&
        project?.enabled === true &&
        oracleDependenciesCompleted(snapshot, task) &&
        task.waiting.executionId !== null
      );
    case "retry_accepted":
      return (
        task.waiting !== null &&
        project?.enabled === true &&
        oracleDependenciesCompleted(snapshot, task) &&
        task.waiting.retryable &&
        (task.waiting.retryAfter === null || task.waiting.retryAfter <= 100)
      );
    case "cancel":
      return task.state !== "waiting" || task.waiting?.executionId !== null;
    default:
      assert.fail(`missing transition oracle for ${command.event}`);
  }
}

function oracleExpectedSuccess(snapshot, commandSummary) {
  const [operation, command] = commandSummary;
  const task = "taskId" in command ? byId(snapshot, command.taskId) : undefined;
  switch (operation) {
    case "create":
      return (
        !byId(snapshot, command.id) &&
        snapshot.projects.some(({ id }) => id === command.projectId) &&
        command.supersedesTaskId === null
      );
    case "forced-no-op":
      return false;
    case "body":
      return isMutable(task) && task.body !== command.body;
    case "parent": {
      if (!isGraphMutable(task) || task.parentId === command.parentId || command.parentId === task.id) return false;
      if (command.parentId === null) return true;
      const parent = byId(snapshot, command.parentId);
      return parent !== undefined && parent.projectId === task.projectId && !oracleParentCycle(snapshot, task.id, parent.id);
    }
    case "dependency-add":
      return (
        isGraphMutable(task) &&
        command.dependencyId !== task.id &&
        byId(snapshot, command.dependencyId) !== undefined &&
        !task.dependencyIds.includes(command.dependencyId) &&
        !oracleDependencyReaches(snapshot, command.dependencyId, task.id)
      );
    case "dependency-remove":
      return isGraphMutable(task) && task.dependencyIds.includes(command.dependencyId);
    case "supersession":
      return (
        isMutable(task) &&
        task.supersedesTaskId !== command.supersedesTaskId &&
        command.supersedesTaskId !== task.id &&
        (command.supersedesTaskId === null || byId(snapshot, command.supersedesTaskId) !== undefined)
      );
    case "waiting":
      return task?.state === "waiting" && task.waiting !== null && !oracleWaitingEqual(task.waiting, command.waiting);
    case "transition":
      return oracleTransitionSuccess(snapshot, command);
    default:
      assert.fail(`missing command oracle for ${operation}`);
  }
}

function verifyDirectCancellationOracle(before, result, command) {
  if (!result.ok || (command.event !== "cancel" && command.event !== "interruption_verified")) return;
  const prerequisite = byId(before, command.taskId);
  assert(prerequisite);
  const expectedDependents = before.tasks
    .filter((task) => task.state === "ready" && task.dependencyIds.includes(prerequisite.id))
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const expectedChanged = [prerequisite.id, ...expectedDependents.map(({ id }) => id)].sort();
  assert.deepEqual(result.value.changedTaskIds, expectedChanged);
  assert.equal(byId(result.value.snapshot, prerequisite.id).state, "cancelled");
  for (const dependent of expectedDependents) {
    const changed = byId(result.value.snapshot, dependent.id);
    const supplied = command.payload.dependentWaiting.find((entry) => entry.taskId === dependent.id);
    assert(supplied, `missing supplied waiting envelope for ${dependent.id}`);
    assert.equal(changed.state, "waiting", dependent.id);
    assert.deepEqual(
      changed.waiting,
      { ...supplied.waiting, waitingTaskRevision: dependent.revision + 1 },
      dependent.id,
    );
    assert.equal(changed.revision, dependent.revision + 1, dependent.id);
  }
  for (const task of before.tasks) {
    if (!expectedChanged.includes(task.id)) {
      assert.deepEqual(byId(result.value.snapshot, task.id), task, `unrelated cancellation change: ${task.id}`);
    }
  }
}

function verifyStep(before, result, terminalFacts, commandSummary) {
  if (!result.ok) {
    return before;
  }
  const after = result.value.snapshot;
  const validated = createDomainSnapshot(after);
  assert.equal(validated.ok, true, validated.ok ? "" : JSON.stringify(validated.error));
  assert.deepEqual(validated.value, after);
  assert(after.tasks.every((task) => ORACLE_STATES.includes(task.state)));
  assert(
    after.tasks.every(
      (task) => task.state !== "waiting" || task.waiting?.waitingTaskRevision === task.revision,
    ),
  );
  verifyIndependentSnapshot(after);

  const changed = new Set(result.value.changedTaskIds);
  const beforeMap = new Map(before.tasks.map((task) => [task.id, task]));
  const afterMap = new Map(after.tasks.map((task) => [task.id, task]));
  const actualChanged = [];
  for (const task of after.tasks) {
    const previous = beforeMap.get(task.id);
    if (previous === undefined) {
      assert.equal(task.revision, 1);
      actualChanged.push(task.id);
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(task)) {
      assert.equal(task.revision, previous.revision + 1, task.id);
      actualChanged.push(task.id);
    }
  }
  assert.deepEqual([...changed].sort(), actualChanged.sort());
  verifyExactEventOracle(before, result, commandSummary);
  assert.equal(result.events.length, changed.size);
  for (const domainEvent of result.events) {
    assert(changed.has(domainEvent.taskId));
    const current = afterMap.get(domainEvent.taskId);
    assert.equal(domainEvent.taskRevisionAfter, current.revision);
    const previous = beforeMap.get(domainEvent.taskId);
    assert.equal(domainEvent.taskRevisionBefore, previous?.revision ?? null);
  }
  for (const [taskId, previous] of beforeMap) {
    if (!changed.has(taskId)) assert.deepEqual(afterMap.get(taskId), previous);
  }

  for (const task of after.tasks) {
    if (task.state === "completed" || task.state === "cancelled") {
      if (!terminalFacts.has(task.id)) terminalFacts.set(task.id, terminalProjection(task));
      assert.deepEqual(terminalProjection(task), terminalFacts.get(task.id));
    }
  }
  return after;
}

function runHistory(seed) {
  const next = prng(seed);
  let snapshot = canonical({
    projects: [{ id: "p", enabled: true }, { id: "q", enabled: true }],
    tasks: [
      taskValue("idea", "a"),
      taskValue("ready", "b"),
      taskValue("waiting", "c"),
      taskValue("completed", "done", { projectId: "q" }),
      taskValue("cancelled", "stopped", { projectId: "q" }),
    ],
  });
  verifyIndependentSnapshot(snapshot);
  const terminalFacts = new Map(
    snapshot.tasks
      .filter((task) => task.state === "completed" || task.state === "cancelled")
      .map((task) => [task.id, terminalProjection(task)]),
  );
  let accepted = 0;
  let rejected = 0;
  const trace = [];

  for (let step = 0; step < STEPS; step += 1) {
    const beforeText = JSON.stringify(snapshot);
    let result;
    let commandSummary;
    try {
      if (step % 17 === 0) {
        const command = {
          id: `created-${step}`,
          projectId: step % 34 === 0 ? "p" : "q",
          body: `created-body-${step}`,
          supersedesTaskId: null,
        };
        commandSummary = ["create", command];
        result = createTask(snapshot, command);
      } else if (step % 19 === 0) {
        const task = choose(next, snapshot.tasks);
        const command = { taskId: task.id, body: task.body };
        commandSummary = ["forced-no-op", command];
        result = updateTaskBody(snapshot, command);
      } else {
        const task = choose(next, snapshot.tasks);
        const operation = next() % 7;
        if (operation === 0) {
          const command = { taskId: task.id, body: `body-${seed.toString(16)}-${step}-${next()}` };
          commandSummary = ["body", command];
          result = updateTaskBody(snapshot, command);
        } else if (operation === 1) {
          const candidates = [null, ...snapshot.tasks.map((candidate) => candidate.id)];
          const command = { taskId: task.id, parentId: choose(next, candidates) };
          commandSummary = ["parent", command];
          result = setTaskParent(snapshot, command);
        } else if (operation === 2) {
          const dependency = choose(next, snapshot.tasks);
          const command = { taskId: task.id, dependencyId: dependency.id };
          commandSummary = ["dependency-add", command];
          result = addTaskDependency(snapshot, command);
        } else if (operation === 3) {
          const candidates = task.dependencyIds.length > 0 ? task.dependencyIds : snapshot.tasks.map((candidate) => candidate.id);
          const command = { taskId: task.id, dependencyId: choose(next, candidates) };
          commandSummary = ["dependency-remove", command];
          result = removeTaskDependency(snapshot, command);
        } else if (operation === 4) {
          const candidates = [null, ...snapshot.tasks.map((candidate) => candidate.id)];
          const command = { taskId: task.id, supersedesTaskId: choose(next, candidates) };
          commandSummary = ["supersession", command];
          result = setTaskSupersession(snapshot, command);
        } else if (operation === 5) {
          const command = {
            taskId: task.id,
            waiting: waitingInput(`${seed.toString(16)}-${step}`, {
              retryCount: next() % 5,
              retryable: (next() & 1) === 0,
            }),
          };
          commandSummary = ["waiting", command];
          result = updateTaskWaiting(snapshot, command);
        } else {
          const transition = {
            event: choose(next, ORACLE_EVENTS),
            to: choose(next, ORACLE_STATES),
          };
          const command = transitionCommand(snapshot, task, transition, step);
          commandSummary = ["transition", command];
          result = transitionTask(snapshot, command);
        }
      }
      trace.push(commandSummary);
      const expectedSuccess = oracleExpectedSuccess(snapshot, commandSummary);
      assert.equal(
        result.ok,
        expectedSuccess,
        `command oracle mismatch for ${JSON.stringify(commandSummary)}`,
      );
      if (commandSummary[0] === "transition") {
        verifyTransitionOracle(snapshot, result, commandSummary[1]);
        verifyDirectCancellationOracle(snapshot, result, commandSummary[1]);
      }
      if (result.ok) accepted += 1;
      else rejected += 1;
      const before = snapshot;
      if (commandSummary[0] === "transition") {
        verifyTransitionOutcomeOracle(before, result, commandSummary[1]);
      }
      snapshot = verifyStep(before, result, terminalFacts, commandSummary);
      if (!result.ok) assert.equal(JSON.stringify(snapshot), beforeText);
    } catch (error) {
      const prefix =
        trace.at(-1) === commandSummary
          ? trace
          : [...trace, ...(commandSummary === undefined ? [] : [commandSummary])];
      throw new Error(
        `domain property failure seed=0x${seed.toString(16)} step=${step} prefixLength=${prefix.length} prefix=${JSON.stringify(prefix)}: ${error.stack ?? error}`,
      );
    }
  }

  assert(accepted > 0, `seed 0x${seed.toString(16)} had no accepted command`);
  assert(rejected > 0, `seed 0x${seed.toString(16)} had no rejected command`);
  return {
    seed: `0x${seed.toString(16)}`,
    accepted,
    rejected,
    steps: trace.length,
    snapshot,
  };
}

test("fixed-seed randomized command histories preserve all Domain Core invariants", () => {
  for (const seed of SEEDS) {
    const first = runHistory(seed);
    const second = runHistory(seed);
    assert.deepEqual(second, first, `seed 0x${seed.toString(16)} was not deterministic`);
    assert.equal(first.steps, STEPS);
  }
});
