import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as packageSurface from "../src/index.ts";
import { repoRoot } from "../scripts/repo-utils.mjs";

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "APPLICATION_ERROR_CODES",
  "AUTHORIZATION_ACTIONS",
  "DOMAIN_ERROR_CODES",
  "HIGH_RISK_ACTIONS",
  "PERSISTENCE_ERROR_CODES",
  "PROJECT_REGISTRY_ERROR_CODES",
  "PersistenceError",
  "ProjectRegistryError",
  "RUNTIME_DIRECTORY_NAME",
  "RUNTIME_ENVIRONMENT_VARIABLE",
  "TASK_STATES",
  "TASK_TRANSITIONS",
  "WAITING_REASONS",
  "addTaskDependency",
  "canIssueGrant",
  "createApplicationService",
  "createDomainSnapshot",
  "createTask",
  "currentSchemaVersion",
  "evaluateAuthorization",
  "evaluateTaskEligibility",
  "evaluateWaitingContinuation",
  "getScaffoldStatus",
  "inspectPrimaryIdentity",
  "inspectProjectRoot",
  "inspectTrustedRuntimeRoot",
  "isAuthorizationAction",
  "isHighRiskAction",
  "openPersistence",
  "parseAuthorizationGrant",
  "prepareRuntimeLayout",
  "recoverInterruptedRestore",
  "registerProject",
  "removeTaskDependency",
  "restoreBackup",
  "revalidateProjectRoot",
  "setProjectEnabled",
  "setTaskParent",
  "setTaskSupersession",
  "transitionTask",
  "updateTaskBody",
  "updateTaskWaiting",
  "verifyBackupGeneration",
]);

function baseInput() {
  return {
    projects: [{ id: "project", enabled: true }],
    tasks: [
      {
        id: "task",
        projectId: "project",
        state: "idea",
        revision: 1,
        body: "body",
        parentId: null,
        dependencyIds: [],
        waiting: null,
        completion: null,
        cancellation: null,
        supersedesTaskId: null,
      },
    ],
  };
}

test("the package exposes only the intended Phase 1 Domain, persistence, registry, authorization, and application surface", () => {
  assert.deepEqual(Object.keys(packageSurface).sort(), [...EXPECTED_RUNTIME_EXPORTS].sort());
  assert.deepEqual(packageSurface.getScaffoldStatus(), {
    packageName: "agent-task-orchestrator",
    phase: "phase1-application-service",
    domainCoreImplemented: true,
    persistenceFoundationImplemented: true,
    projectRegistryImplemented: true,
    runtimeAuthorizationImplemented: true,
    applicationServiceImplemented: true,
    productRuntimeImplemented: false,
    supportedAdapters: [],
  });
  assert.deepEqual(packageSurface.TASK_STATES, [
    "idea",
    "ready",
    "running",
    "waiting",
    "completed",
    "cancelled",
  ]);
});

test("the Domain Core production owner has no module, I/O, clock, random, process, or vendor dependency", () => {
  const source = readFileSync(path.join(repoRoot, "src", "domain.ts"), "utf8");
  assert.doesNotMatch(source, /^\s*(?:import|export\s+.+\s+from)\s/mu);
  assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s*\(/u);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/u);
  assert.doesNotMatch(source, /\b(?:Date\.now|new\s+Date|Math\.random|crypto\.)/u);
  assert.doesNotMatch(source, /\b(?:process|console|Deno|Bun)\b/u);
  assert.doesNotMatch(
    source,
    /node:|sqlite|persistence|dispatcher|ports?\/|adapters?\/|codex|openai|\bgit\b|\bcli\b|\bmcp\b|scheduler|observability|harness/iu,
  );

  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.dependencies, undefined);
  assert.deepEqual(packageJson.devDependencies, { typescript: "5.9.3" });
});

test("equal explicit inputs produce equal frozen outputs without mutating caller-owned values", () => {
  const firstInput = baseInput();
  const secondInput = structuredClone(firstInput);
  const firstBefore = structuredClone(firstInput);
  const secondBefore = structuredClone(secondInput);
  const first = packageSurface.createDomainSnapshot(firstInput);
  const second = packageSurface.createDomainSnapshot(secondInput);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first, second);
  assert.deepEqual(firstInput, firstBefore);
  assert.deepEqual(secondInput, secondBefore);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.value), true);
  assert.equal(Object.isFrozen(first.value.projects), true);
  assert.equal(Object.isFrozen(first.value.tasks), true);

  const firstMutation = packageSurface.updateTaskBody(first.value, { taskId: "task", body: "changed" });
  const secondMutation = packageSurface.updateTaskBody(second.value, { taskId: "task", body: "changed" });
  assert.deepEqual(firstMutation, secondMutation);
  assert.deepEqual(firstInput, firstBefore);
  assert.equal(first.value.tasks[0].body, "body");
});

test("malformed public values return structured failures instead of throwing or performing fallback work", () => {
  assert.doesNotThrow(() => packageSurface.createDomainSnapshot(null));
  const malformedSnapshot = packageSurface.createDomainSnapshot(null);
  assert.equal(malformedSnapshot.ok, false);
  assert.deepEqual(Object.keys(malformedSnapshot.error).sort(), ["code", "details", "message"]);
  assert.equal(Object.isFrozen(malformedSnapshot.error), true);
  assert.equal(Object.isFrozen(malformedSnapshot.error.details), true);

  const valid = packageSurface.createDomainSnapshot(baseInput());
  assert.equal(valid.ok, true);
  assert.doesNotThrow(() => packageSurface.transitionTask(valid.value, null));
  const malformedCommand = packageSurface.transitionTask(valid.value, null);
  assert.equal(malformedCommand.ok, false);
  assert.equal(malformedCommand.error.code, "INVALID_INPUT");
});

test("accessors and exceptional proxies fail closed without escaping or running getters", () => {
  let snapshotGetterCalls = 0;
  const accessorSnapshot = {};
  Object.defineProperties(accessorSnapshot, {
    projects: {
      enumerable: true,
      get() {
        snapshotGetterCalls += 1;
        throw new Error("snapshot getter must not run");
      },
    },
    tasks: { enumerable: true, value: [] },
  });
  assert.doesNotThrow(() => packageSurface.createDomainSnapshot(accessorSnapshot));
  const accessorFailure = packageSurface.createDomainSnapshot(accessorSnapshot);
  assert.equal(accessorFailure.ok, false);
  assert.equal(accessorFailure.error.code, "INVALID_SNAPSHOT");
  assert.equal(snapshotGetterCalls, 0);

  let nestedGetterCalls = 0;
  const nestedTask = { ...baseInput().tasks[0] };
  Object.defineProperty(nestedTask, "body", {
    enumerable: true,
    get() {
      nestedGetterCalls += 1;
      throw new Error("nested getter must not run");
    },
  });
  const nestedFailure = packageSurface.createDomainSnapshot({
    projects: [{ id: "project", enabled: true }],
    tasks: [nestedTask],
  });
  assert.equal(nestedFailure.ok, false);
  assert.equal(nestedFailure.error.code, "INVALID_SNAPSHOT");
  assert.equal(nestedGetterCalls, 0);

  let commandGetterCalls = 0;
  const accessorCommand = {};
  Object.defineProperties(accessorCommand, {
    taskId: {
      enumerable: true,
      get() {
        commandGetterCalls += 1;
        throw new Error("command getter must not run");
      },
    },
    body: { enumerable: true, value: "changed" },
  });
  const valid = packageSurface.createDomainSnapshot(baseInput());
  assert.equal(valid.ok, true);
  assert.doesNotThrow(() => packageSurface.updateTaskBody(valid.value, accessorCommand));
  const commandFailure = packageSurface.updateTaskBody(valid.value, accessorCommand);
  assert.equal(commandFailure.ok, false);
  assert.equal(commandFailure.error.code, "INVALID_INPUT");
  assert.equal(commandGetterCalls, 0);

  const exceptionalProxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error("proxy trap");
      },
    },
  );
  assert.doesNotThrow(() => packageSurface.createDomainSnapshot(exceptionalProxy));
  const proxyFailure = packageSurface.createDomainSnapshot(exceptionalProxy);
  assert.equal(proxyFailure.ok, false);
  assert.equal(proxyFailure.error.code, "INVALID_SNAPSHOT");

  let arrayGetterCalls = 0;
  const accessorProjects = [];
  Object.defineProperty(accessorProjects, 0, {
    enumerable: true,
    get() {
      arrayGetterCalls += 1;
      throw new Error("array getter must not run");
    },
  });
  const arrayFailure = packageSurface.createDomainSnapshot({ projects: accessorProjects, tasks: [] });
  assert.equal(arrayFailure.ok, false);
  assert.equal(arrayFailure.error.code, "INVALID_SNAPSHOT");
  assert.equal(arrayGetterCalls, 0);
});

test("every public array surface rejects noncanonical shape before caller methods or inherited getters run", () => {
  const symbolProjects = [{ id: "project", enabled: true }];
  symbolProjects[Symbol("extra")] = true;
  const symbolFailure = packageSurface.createDomainSnapshot({ projects: symbolProjects, tasks: [] });
  assert.equal(symbolFailure.ok, false);
  assert.equal(symbolFailure.error.code, "INVALID_SNAPSHOT");

  const extraTasks = [];
  extraTasks.extra = true;
  const extraFailure = packageSurface.createDomainSnapshot({ projects: [], tasks: extraTasks });
  assert.equal(extraFailure.ok, false);
  assert.equal(extraFailure.error.code, "INVALID_SNAPSHOT");

  const nonEnumerableProjects = [];
  Object.defineProperty(nonEnumerableProjects, 0, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: { id: "project", enabled: true },
  });
  const nonEnumerableFailure = packageSurface.createDomainSnapshot({
    projects: nonEnumerableProjects,
    tasks: [],
  });
  assert.equal(nonEnumerableFailure.ok, false);
  assert.equal(nonEnumerableFailure.error.code, "INVALID_SNAPSHOT");

  let entriesCalls = 0;
  const mutatingProjects = [{ id: "project", enabled: true }];
  mutatingProjects.entries = () => {
    entriesCalls += 1;
    mutatingProjects.push({ id: "mutated", enabled: true });
    throw new Error("caller entries must not run");
  };
  const originalLength = mutatingProjects.length;
  const mutatingFailure = packageSurface.createDomainSnapshot({ projects: mutatingProjects, tasks: [] });
  assert.equal(mutatingFailure.ok, false);
  assert.equal(mutatingFailure.error.code, "INVALID_SNAPSHOT");
  assert.equal(entriesCalls, 0);
  assert.equal(mutatingProjects.length, originalLength);

  let inheritedEntriesGetterCalls = 0;
  const inheritedProjects = [{ id: "project", enabled: true }];
  Object.setPrototypeOf(
    inheritedProjects,
    Object.create(Array.prototype, {
      entries: {
        get() {
          inheritedEntriesGetterCalls += 1;
          throw new Error("inherited entries getter must not run");
        },
      },
    }),
  );
  const inheritedFailure = packageSurface.createDomainSnapshot({ projects: inheritedProjects, tasks: [] });
  assert.equal(inheritedFailure.ok, false);
  assert.equal(inheritedFailure.error.code, "INVALID_SNAPSHOT");
  assert.equal(inheritedEntriesGetterCalls, 0);

  let dependencyEveryCalls = 0;
  const dependencyIds = [];
  dependencyIds.every = () => {
    dependencyEveryCalls += 1;
    throw new Error("caller every must not run");
  };
  const dependencyInput = baseInput();
  dependencyInput.tasks[0].dependencyIds = dependencyIds;
  const dependencyFailure = packageSurface.createDomainSnapshot(dependencyInput);
  assert.equal(dependencyFailure.ok, false);
  assert.equal(dependencyFailure.error.code, "INVALID_SNAPSHOT");
  assert.equal(dependencyEveryCalls, 0);

  const valid = packageSurface.createDomainSnapshot(baseInput());
  assert.equal(valid.ok, true);
  let dependentEntriesCalls = 0;
  const dependentWaiting = [];
  dependentWaiting.entries = () => {
    dependentEntriesCalls += 1;
    dependentWaiting.push({ taskId: "mutated", waiting: {} });
    throw new Error("dependentWaiting entries must not run");
  };
  const dependentLength = dependentWaiting.length;
  const transitionFailure = packageSurface.transitionTask(valid.value, {
    taskId: "task",
    event: "cancel",
    targetState: "cancelled",
    payload: { reason: "declined", executionDisposition: null, dependentWaiting },
  });
  assert.equal(transitionFailure.ok, false);
  assert.equal(transitionFailure.error.code, "INVALID_INPUT");
  assert.equal(dependentEntriesCalls, 0);
  assert.equal(dependentWaiting.length, dependentLength);
});
