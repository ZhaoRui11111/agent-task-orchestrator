export const TASK_STATES = Object.freeze([
  "idea",
  "ready",
  "running",
  "waiting",
  "completed",
  "cancelled",
] as const);

export const WAITING_REASONS = Object.freeze([
  "human_input",
  "authorization_required",
  "execution_failed",
  "policy_gate_failed",
  "resource_exhausted",
  "rate_limited",
  "disk_full",
  "workspace_conflict",
  "dependency_cancelled",
  "stale_lease",
  "ambiguous_external_state",
  "backend_incompatible",
] as const);

export const TASK_TRANSITIONS = Object.freeze([
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
] as const);

export const DOMAIN_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "INVALID_SNAPSHOT",
  "TASK_NOT_FOUND",
  "PROJECT_NOT_FOUND",
  "TASK_ALREADY_EXISTS",
  "ILLEGAL_TRANSITION",
  "TERMINAL_IMMUTABLE",
  "MUTATION_NOT_ALLOWED",
  "NO_OP",
  "REVISION_EXHAUSTED",
  "PROJECT_DISABLED",
  "TASK_NOT_ELIGIBLE",
  "DEPENDENCY_NOT_FOUND",
  "DEPENDENCY_CANCELLED",
  "DEPENDENCY_SELF",
  "DEPENDENCY_DUPLICATE",
  "DEPENDENCY_CYCLE",
  "PARENT_NOT_FOUND",
  "PARENT_SELF",
  "PARENT_PROJECT_MISMATCH",
  "PARENT_CYCLE",
  "SUPERSESSION_NOT_FOUND",
  "SUPERSESSION_SELF",
  "EXTERNAL_PRECONDITION_FAILED",
  "CONTINUATION_NOT_ELIGIBLE",
] as const);

export type TaskState = (typeof TASK_STATES)[number];
export type WaitingReason = (typeof WAITING_REASONS)[number];
export type TaskTransition = (typeof TASK_TRANSITIONS)[number];
export type TaskTransitionEvent = TaskTransition["event"];
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export type EligibilityReason =
  | "STATE_NOT_READY"
  | "PROJECT_NOT_REGISTERED"
  | "PROJECT_DISABLED"
  | "DEPENDENCY_NOT_REGISTERED"
  | "DEPENDENCY_NOT_COMPLETED";

export type ContinuationReason =
  | "STATE_NOT_WAITING"
  | "TASK_REVISION_STALE"
  | "PROJECT_NOT_REGISTERED"
  | "PROJECT_DISABLED"
  | "DEPENDENCY_NOT_REGISTERED"
  | "DEPENDENCY_NOT_COMPLETED"
  | "REQUIRED_ACTION_RECEIPT_STALE"
  | "IDENTITY_MISMATCH"
  | "EXECUTION_ID_REQUIRED"
  | "NOT_RETRYABLE"
  | "RETRY_TOO_EARLY";

type DetailValue = string | number | boolean | null;

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details: Readonly<Record<string, DetailValue>>;
}

export type DomainEventType =
  | "task.created"
  | "task.transitioned"
  | "task.body_changed"
  | "task.waiting_changed"
  | "task.parent_changed"
  | "task.dependency_added"
  | "task.dependency_removed"
  | "task.supersession_changed";

export interface DomainEvent {
  readonly type: DomainEventType;
  readonly taskId: string;
  readonly taskRevisionBefore: number | null;
  readonly taskRevisionAfter: number;
  readonly details: Readonly<Record<string, DetailValue>>;
}

export interface DomainSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly events: readonly DomainEvent[];
}

export interface DomainFailure {
  readonly ok: false;
  readonly error: DomainError;
}

export type DomainResult<T> = DomainSuccess<T> | DomainFailure;

export interface Project {
  readonly id: string;
  readonly enabled: boolean;
}

export interface WaitingMetadataInput {
  readonly reason: WaitingReason;
  readonly phase: string;
  readonly requiredAction: string;
  readonly lastErrorCode: string;
  readonly lastErrorSummary: string | null;
  readonly retryable: boolean;
  readonly retryCount: number;
  readonly retryAfter: number | null;
  readonly executionId: string | null;
  readonly workspaceRevision: string | null;
  readonly backendThreadId: string | null;
}

export interface WaitingMetadata extends WaitingMetadataInput {
  readonly waitingTaskRevision: number;
}

export interface CompletionFact {
  readonly decisionId: string;
  readonly acceptedTaskRevision: number;
}

export interface CancellationFact {
  readonly event: "cancel" | "interruption_verified";
  readonly reason: string;
  readonly verificationId: string | null;
  readonly acceptedTaskRevision: number;
}

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly state: TaskState;
  readonly revision: number;
  readonly body: string;
  readonly parentId: string | null;
  readonly dependencyIds: readonly string[];
  readonly waiting: WaitingMetadata | null;
  readonly completion: CompletionFact | null;
  readonly cancellation: CancellationFact | null;
  readonly supersedesTaskId: string | null;
}

export interface DomainSnapshot {
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
}

export interface DomainMutation {
  readonly snapshot: DomainSnapshot;
  readonly changedTaskIds: readonly string[];
}

export interface CreateTaskCommand {
  readonly id: string;
  readonly projectId: string;
  readonly body: string;
  readonly supersedesTaskId: string | null;
}

export interface UpdateTaskBodyCommand {
  readonly taskId: string;
  readonly body: string;
}

export interface UpdateTaskWaitingCommand {
  readonly taskId: string;
  readonly waiting: WaitingMetadataInput;
}

export interface SetTaskParentCommand {
  readonly taskId: string;
  readonly parentId: string | null;
}

export interface TaskDependencyCommand {
  readonly taskId: string;
  readonly dependencyId: string;
}

export interface SetTaskSupersessionCommand {
  readonly taskId: string;
  readonly supersedesTaskId: string | null;
}

export interface ExternalAcceptance {
  readonly taskId: string;
  readonly taskRevision: number;
  readonly authorization: "accepted";
  readonly reliability: "accepted";
}

export interface CompletionDecision {
  readonly decisionId: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly status: "accepted";
}

export interface ExecutionDisposition {
  readonly receiptId: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly executionId: string | null;
  readonly status: "absent" | "stopped";
}

export interface RequiredActionReceipt {
  readonly receiptId: string;
  readonly taskId: string;
  readonly taskRevision: number;
  readonly requiredAction: string;
  readonly status: "accepted";
}

export interface WaitingContinuationCommand {
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly readRevision: string;
  readonly kind: "resume" | "retry";
  readonly requiredActionReceipt: RequiredActionReceipt;
  readonly targetExecutionId: string | null;
  readonly targetWorkspaceRevision: string | null;
  readonly targetBackendThreadId: string | null;
  readonly trustedTime: number;
}

export interface TaskEligibilityCommand {
  readonly taskId: string;
  readonly readRevision: string;
}

export interface TaskEligibilityDecision {
  readonly taskId: string;
  readonly readRevision: string;
  readonly eligible: boolean;
  readonly reasons: readonly EligibilityReason[];
}

export interface WaitingContinuationDecision {
  readonly taskId: string;
  readonly readRevision: string;
  readonly kind: "resume" | "retry";
  readonly eligible: boolean;
  readonly reasons: readonly ContinuationReason[];
}

export interface DependentWaitingInput {
  readonly taskId: string;
  readonly waiting: WaitingMetadataInput;
}

export interface TransitionTaskCommand {
  readonly taskId: string;
  readonly event: TaskTransitionEvent;
  readonly targetState: TaskState;
  readonly payload: unknown;
}

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainError };
type UnknownRecord = Record<string, unknown>;

const TERMINAL_STATES = new Set<TaskState>(["completed", "cancelled"]);
const GRAPH_MUTABLE_STATES = new Set<TaskState>(["idea", "ready", "waiting"]);

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readExactRecord(value: unknown, expected: readonly string[]): Readonly<UnknownRecord> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expected.length) return null;
    const allowed = new Set(expected);
    const copy: UnknownRecord = Object.create(null) as UnknownRecord;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      Object.defineProperty(copy, key, {
        value: descriptor.value,
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(copy);
  } catch {
    return null;
  }
}

function readCanonicalArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const ownKeys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable ||
      !isNonnegativeInteger(lengthDescriptor.value) ||
      ownKeys.length !== lengthDescriptor.value + 1
    ) {
      return null;
    }
    const items: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      items.push(descriptor.value);
    }
    return Object.freeze(items);
  } catch {
    return null;
  }
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

function isTaskState(value: unknown): value is TaskState {
  return typeof value === "string" && (TASK_STATES as readonly string[]).includes(value);
}

function isWaitingReason(value: unknown): value is WaitingReason {
  return typeof value === "string" && (WAITING_REASONS as readonly string[]).includes(value);
}

function isTransitionEvent(value: unknown): value is TaskTransitionEvent {
  return (
    typeof value === "string" &&
    TASK_TRANSITIONS.some((transition) => transition.event === value)
  );
}

function domainError(
  code: DomainErrorCode,
  message: string,
  details: Readonly<Record<string, DetailValue>> = {},
): DomainError {
  return Object.freeze({ code, message, details: Object.freeze({ ...details }) });
}

function invalid<T>(
  code: DomainErrorCode,
  message: string,
  details: Readonly<Record<string, DetailValue>> = {},
): Parsed<T> {
  return Object.freeze({ ok: false, error: domainError(code, message, details) });
}

function parsed<T>(value: T): Parsed<T> {
  return Object.freeze({ ok: true, value });
}

function failure<T>(error: DomainError): DomainResult<T> {
  return Object.freeze({ ok: false, error });
}

function success<T>(value: T, events: readonly DomainEvent[] = []): DomainResult<T> {
  return Object.freeze({ ok: true, value, events: Object.freeze([...events]) });
}

function event(
  type: DomainEventType,
  taskId: string,
  taskRevisionBefore: number | null,
  taskRevisionAfter: number,
  details: Readonly<Record<string, DetailValue>> = {},
): DomainEvent {
  return Object.freeze({
    type,
    taskId,
    taskRevisionBefore,
    taskRevisionAfter,
    details: Object.freeze({ ...details }),
  });
}

function parseProject(value: unknown, path: string): Parsed<Project> {
  const record = readExactRecord(value, ["id", "enabled"]);
  if (record === null) {
    return invalid("INVALID_SNAPSHOT", "Project must have the exact domain shape", { path });
  }
  if (!isIdentifier(record.id) || typeof record.enabled !== "boolean") {
    return invalid("INVALID_SNAPSHOT", "Project identity or enablement is invalid", { path });
  }
  return parsed(Object.freeze({ id: record.id, enabled: record.enabled }));
}

function parseWaitingInput(value: unknown, path: string): Parsed<WaitingMetadataInput> {
  const keys = [
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
  ];
  const record = readExactRecord(value, keys);
  if (record === null) {
    return invalid("INVALID_INPUT", "Waiting metadata must contain every exact field", { path });
  }
  if (
    !isWaitingReason(record.reason) ||
    !isIdentifier(record.phase) ||
    !isIdentifier(record.requiredAction) ||
    !isIdentifier(record.lastErrorCode) ||
    !(record.lastErrorSummary === null || typeof record.lastErrorSummary === "string") ||
    typeof record.retryable !== "boolean" ||
    !isNonnegativeInteger(record.retryCount) ||
    !(record.retryAfter === null || isSafeInteger(record.retryAfter)) ||
    !isNullableIdentifier(record.executionId) ||
    !isNullableIdentifier(record.workspaceRevision) ||
    !isNullableIdentifier(record.backendThreadId)
  ) {
    return invalid("INVALID_INPUT", "Waiting metadata contains an invalid field", { path });
  }
  return parsed(
    Object.freeze({
      reason: record.reason,
      phase: record.phase,
      requiredAction: record.requiredAction,
      lastErrorCode: record.lastErrorCode,
      lastErrorSummary: record.lastErrorSummary,
      retryable: record.retryable,
      retryCount: record.retryCount,
      retryAfter: record.retryAfter,
      executionId: record.executionId,
      workspaceRevision: record.workspaceRevision,
      backendThreadId: record.backendThreadId,
    }),
  );
}

function parseWaiting(value: unknown, path: string): Parsed<WaitingMetadata> {
  const inputKeys = [
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
  ];
  const record = readExactRecord(value, [...inputKeys, "waitingTaskRevision"]);
  if (record === null) {
    return invalid("INVALID_SNAPSHOT", "Waiting metadata must contain every exact field", { path });
  }
  const input = Object.fromEntries(inputKeys.map((key) => [key, record[key]]));
  const parsedInput = parseWaitingInput(input, path);
  if (!parsedInput.ok) return parsedInput;
  if (!isPositiveInteger(record.waitingTaskRevision)) {
    return invalid("INVALID_SNAPSHOT", "waitingTaskRevision must be a positive integer", { path });
  }
  return parsed(Object.freeze({ ...parsedInput.value, waitingTaskRevision: record.waitingTaskRevision }));
}

function parseCompletion(value: unknown, path: string): Parsed<CompletionFact> {
  const record = readExactRecord(value, ["decisionId", "acceptedTaskRevision"]);
  if (record === null) {
    return invalid("INVALID_SNAPSHOT", "Completion fact must have the exact domain shape", { path });
  }
  if (!isIdentifier(record.decisionId) || !isPositiveInteger(record.acceptedTaskRevision)) {
    return invalid("INVALID_SNAPSHOT", "Completion fact is invalid", { path });
  }
  return parsed(Object.freeze({ decisionId: record.decisionId, acceptedTaskRevision: record.acceptedTaskRevision }));
}

function parseCancellation(value: unknown, path: string): Parsed<CancellationFact> {
  const record = readExactRecord(value, ["event", "reason", "verificationId", "acceptedTaskRevision"]);
  if (record === null) {
    return invalid("INVALID_SNAPSHOT", "Cancellation fact must have the exact domain shape", { path });
  }
  if (
    (record.event !== "cancel" && record.event !== "interruption_verified") ||
    !isIdentifier(record.reason) ||
    !isNullableIdentifier(record.verificationId) ||
    !isPositiveInteger(record.acceptedTaskRevision)
  ) {
    return invalid("INVALID_SNAPSHOT", "Cancellation fact is invalid", { path });
  }
  return parsed(
    Object.freeze({
      event: record.event,
      reason: record.reason,
      verificationId: record.verificationId,
      acceptedTaskRevision: record.acceptedTaskRevision,
    }),
  );
}

function parseTask(value: unknown, path: string): Parsed<Task> {
  const keys = [
    "id",
    "projectId",
    "state",
    "revision",
    "body",
    "parentId",
    "dependencyIds",
    "waiting",
    "completion",
    "cancellation",
    "supersedesTaskId",
  ];
  const record = readExactRecord(value, keys);
  if (record === null) {
    return invalid("INVALID_SNAPSHOT", "Task must have the exact domain shape", { path });
  }
  const dependencyValues = readCanonicalArray(record.dependencyIds);
  if (
    !isIdentifier(record.id) ||
    !isIdentifier(record.projectId) ||
    !isTaskState(record.state) ||
    !isPositiveInteger(record.revision) ||
    typeof record.body !== "string" ||
    !isNullableIdentifier(record.parentId) ||
    dependencyValues === null ||
    !isNullableIdentifier(record.supersedesTaskId)
  ) {
    return invalid("INVALID_SNAPSHOT", "Task contains an invalid scalar or collection", { path });
  }
  const dependencyIds: string[] = [];
  for (const dependencyId of dependencyValues) {
    if (!isIdentifier(dependencyId)) {
      return invalid("INVALID_SNAPSHOT", "Task contains an invalid scalar or collection", { path });
    }
    dependencyIds.push(dependencyId);
  }
  dependencyIds.sort(compareStrings);
  if (new Set(dependencyIds).size !== dependencyIds.length) {
    return invalid("INVALID_SNAPSHOT", "Task dependency identifiers must be unique", { path });
  }
  if (record.parentId === record.id) {
    return invalid("INVALID_SNAPSHOT", "Task cannot parent itself", { path });
  }
  if (dependencyIds.includes(record.id)) {
    return invalid("INVALID_SNAPSHOT", "Task cannot depend on itself", { path });
  }
  if (record.supersedesTaskId === record.id) {
    return invalid("INVALID_SNAPSHOT", "Task cannot supersede itself", { path });
  }

  let waiting: WaitingMetadata | null = null;
  let completion: CompletionFact | null = null;
  let cancellation: CancellationFact | null = null;
  if (record.waiting !== null) {
    const result = parseWaiting(record.waiting, `${path}.waiting`);
    if (!result.ok) return result;
    waiting = result.value;
  }
  if (record.completion !== null) {
    const result = parseCompletion(record.completion, `${path}.completion`);
    if (!result.ok) return result;
    completion = result.value;
  }
  if (record.cancellation !== null) {
    const result = parseCancellation(record.cancellation, `${path}.cancellation`);
    if (!result.ok) return result;
    cancellation = result.value;
  }

  if (record.state === "waiting") {
    if (waiting === null || waiting.waitingTaskRevision !== record.revision || completion !== null || cancellation !== null) {
      return invalid("INVALID_SNAPSHOT", "Waiting Task facts are incomplete or incoherent", { path });
    }
  } else if (record.state === "completed") {
    if (
      waiting !== null ||
      completion === null ||
      completion.acceptedTaskRevision !== record.revision - 1 ||
      cancellation !== null
    ) {
      return invalid("INVALID_SNAPSHOT", "Completed Task facts are incomplete or incoherent", { path });
    }
  } else if (record.state === "cancelled") {
    if (
      waiting !== null ||
      completion !== null ||
      cancellation === null ||
      cancellation.acceptedTaskRevision !== record.revision - 1
    ) {
      return invalid("INVALID_SNAPSHOT", "Cancelled Task facts are incomplete or incoherent", { path });
    }
  } else if (waiting !== null || completion !== null || cancellation !== null) {
    return invalid("INVALID_SNAPSHOT", "Non-waiting and non-terminal Task cannot carry waiting or terminal facts", {
      path,
    });
  }

  return parsed(
    Object.freeze({
      id: record.id,
      projectId: record.projectId,
      state: record.state,
      revision: record.revision,
      body: record.body,
      parentId: record.parentId,
      dependencyIds: Object.freeze(dependencyIds),
      waiting,
      completion,
      cancellation,
      supersedesTaskId: record.supersedesTaskId,
    }),
  );
}

function parentCycle(tasks: readonly Task[]): string | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    const seen = new Set<string>([task.id]);
    let parentId = task.parentId;
    while (parentId !== null) {
      if (seen.has(parentId)) return task.id;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }
  return null;
}

function dependencyCycle(tasks: readonly Task[]): string | null {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (taskId: string): string | null => {
    if (visiting.has(taskId)) return taskId;
    if (visited.has(taskId)) return null;
    visiting.add(taskId);
    for (const dependencyId of byId.get(taskId)?.dependencyIds ?? []) {
      const cycle = visit(dependencyId);
      if (cycle !== null) return cycle;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  };
  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle !== null) return cycle;
  }
  return null;
}

type SnapshotValidationMode = "complete" | "decision";

function parseSnapshot(
  value: unknown,
  mode: SnapshotValidationMode,
  decisionTaskId: string | null = null,
): Parsed<DomainSnapshot> {
  const record = readExactRecord(value, ["projects", "tasks"]);
  if (record === null) {
    return invalid("INVALID_SNAPSHOT", "DomainSnapshot must have exact projects and tasks collections");
  }
  const projectValues = readCanonicalArray(record.projects);
  const taskValues = readCanonicalArray(record.tasks);
  if (projectValues === null || taskValues === null) {
    return invalid("INVALID_SNAPSHOT", "DomainSnapshot collections must be arrays");
  }
  const projects: Project[] = [];
  for (let index = 0; index < projectValues.length; index += 1) {
    const projectValue = projectValues[index];
    const result = parseProject(projectValue, `projects[${index}]`);
    if (!result.ok) return result;
    projects.push(result.value);
  }
  projects.sort((left, right) => compareStrings(left.id, right.id));
  if (new Set(projects.map((project) => project.id)).size !== projects.length) {
    return invalid("INVALID_SNAPSHOT", "Project identifiers must be unique");
  }

  const tasks: Task[] = [];
  for (let index = 0; index < taskValues.length; index += 1) {
    const taskValue = taskValues[index];
    const result = parseTask(taskValue, `tasks[${index}]`);
    if (!result.ok) return result;
    tasks.push(result.value);
  }
  tasks.sort((left, right) => compareStrings(left.id, right.id));
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    return invalid("INVALID_SNAPSHOT", "Task identifiers must be unique");
  }

  const projectIndex = new Map(projects.map((project) => [project.id, project]));
  const taskIndex = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (!projectIndex.has(task.projectId) && (mode === "complete" || task.id !== decisionTaskId)) {
      return invalid("INVALID_SNAPSHOT", "Task Project is not registered", { taskId: task.id });
    }
    if (task.parentId !== null) {
      const parent = taskIndex.get(task.parentId);
      if (parent === undefined) {
        return invalid("INVALID_SNAPSHOT", "Task parent is not registered", { taskId: task.id });
      }
      if (parent.projectId !== task.projectId) {
        return invalid("INVALID_SNAPSHOT", "Task parent belongs to another Project", { taskId: task.id });
      }
    }
    for (const dependencyId of task.dependencyIds) {
      if (!taskIndex.has(dependencyId) && (mode === "complete" || task.id !== decisionTaskId)) {
        return invalid("INVALID_SNAPSHOT", "Task dependency is not registered", {
          taskId: task.id,
          dependencyId,
        });
      }
    }
    if (task.supersedesTaskId !== null && !taskIndex.has(task.supersedesTaskId)) {
      return invalid("INVALID_SNAPSHOT", "Superseded Task is not registered", { taskId: task.id });
    }
  }
  const parentCycleTask = parentCycle(tasks);
  if (parentCycleTask !== null) {
    return invalid("INVALID_SNAPSHOT", "Parent hierarchy contains a cycle", { taskId: parentCycleTask });
  }
  const dependencyCycleTask = dependencyCycle(tasks);
  if (dependencyCycleTask !== null) {
    return invalid("INVALID_SNAPSHOT", "Dependency graph contains a cycle", { taskId: dependencyCycleTask });
  }

  return parsed(
    Object.freeze({
      projects: Object.freeze(projects),
      tasks: Object.freeze(tasks),
    }),
  );
}

function mutation(snapshot: DomainSnapshot, changedTaskIds: readonly string[], events: readonly DomainEvent[]): DomainResult<DomainMutation> {
  return success(
    Object.freeze({
      snapshot,
      changedTaskIds: Object.freeze([...changedTaskIds].sort(compareStrings)),
    }),
    events,
  );
}

function replaceTasks(snapshot: DomainSnapshot, replacements: ReadonlyMap<string, Task>, additions: readonly Task[] = []): Parsed<DomainSnapshot> {
  const tasks = snapshot.tasks.map((task) => replacements.get(task.id) ?? task);
  tasks.push(...additions);
  return parseSnapshot({ projects: snapshot.projects, tasks }, "complete");
}

function nextTask(task: Task, patch: Readonly<Partial<Task>>): Parsed<Task> {
  if (task.revision === Number.MAX_SAFE_INTEGER) {
    return invalid("REVISION_EXHAUSTED", "Task revision cannot be incremented safely", { taskId: task.id });
  }
  const revision = task.revision + 1;
  const candidate = { ...task, ...patch, revision } as Task;
  const waiting =
    candidate.state === "waiting" && candidate.waiting !== null
      ? Object.freeze({ ...candidate.waiting, waitingTaskRevision: revision })
      : candidate.waiting;
  return parseTask({ ...candidate, waiting }, `task:${task.id}`);
}

function taskById(snapshot: DomainSnapshot, taskId: string): Task | undefined {
  return snapshot.tasks.find((task) => task.id === taskId);
}

function projectById(snapshot: DomainSnapshot, projectId: string): Project | undefined {
  return snapshot.projects.find((project) => project.id === projectId);
}

function requireMutableTask(snapshot: DomainSnapshot, taskId: string): Parsed<Task> {
  const task = taskById(snapshot, taskId);
  if (task === undefined) return invalid("TASK_NOT_FOUND", "Task is not registered", { taskId });
  if (TERMINAL_STATES.has(task.state)) {
    return invalid("TERMINAL_IMMUTABLE", "Terminal Task cannot be mutated", { taskId, state: task.state });
  }
  return parsed(task);
}

function parseTaskCommand(value: unknown, keys: readonly string[]): Parsed<UnknownRecord> {
  const record = readExactRecord(value, keys);
  if (record === null) {
    return invalid("INVALID_INPUT", "Command must contain the exact expected fields");
  }
  return parsed(record);
}

function readRevision(value: unknown): Parsed<string> {
  if (!isIdentifier(value)) return invalid("INVALID_INPUT", "readRevision must be a nonempty opaque label");
  return parsed(value);
}

function eligibilityReasons(snapshot: DomainSnapshot, task: Task): readonly EligibilityReason[] {
  const reasons = new Set<EligibilityReason>();
  if (task.state !== "ready") reasons.add("STATE_NOT_READY");
  const project = projectById(snapshot, task.projectId);
  if (project === undefined) reasons.add("PROJECT_NOT_REGISTERED");
  else if (!project.enabled) reasons.add("PROJECT_DISABLED");
  for (const dependencyId of task.dependencyIds) {
    const dependency = taskById(snapshot, dependencyId);
    if (dependency === undefined) reasons.add("DEPENDENCY_NOT_REGISTERED");
    else if (dependency.state !== "completed") reasons.add("DEPENDENCY_NOT_COMPLETED");
  }
  return Object.freeze([...reasons].sort(compareStrings));
}

function parseRequiredActionReceipt(value: unknown): Parsed<RequiredActionReceipt> {
  const record = readExactRecord(value, ["receiptId", "taskId", "taskRevision", "requiredAction", "status"]);
  if (record === null) {
    return invalid("INVALID_INPUT", "Required-action receipt must have the exact shape");
  }
  if (
    !isIdentifier(record.receiptId) ||
    !isIdentifier(record.taskId) ||
    !isPositiveInteger(record.taskRevision) ||
    !isIdentifier(record.requiredAction) ||
    record.status !== "accepted"
  ) {
    return invalid("INVALID_INPUT", "Required-action receipt contains an invalid field");
  }
  return parsed(
    Object.freeze({
      receiptId: record.receiptId,
      taskId: record.taskId,
      taskRevision: record.taskRevision,
      requiredAction: record.requiredAction,
      status: record.status,
    }),
  );
}

function parseContinuationCommand(value: unknown): Parsed<WaitingContinuationCommand> {
  const keys = [
    "taskId",
    "expectedTaskRevision",
    "readRevision",
    "kind",
    "requiredActionReceipt",
    "targetExecutionId",
    "targetWorkspaceRevision",
    "targetBackendThreadId",
    "trustedTime",
  ];
  const record = readExactRecord(value, keys);
  if (record === null) {
    return invalid("INVALID_INPUT", "Continuation command must contain every exact field");
  }
  const revision = readRevision(record.readRevision);
  if (!revision.ok) return revision;
  const receipt = parseRequiredActionReceipt(record.requiredActionReceipt);
  if (!receipt.ok) return receipt;
  if (
    !isIdentifier(record.taskId) ||
    !isPositiveInteger(record.expectedTaskRevision) ||
    (record.kind !== "resume" && record.kind !== "retry") ||
    !isNullableIdentifier(record.targetExecutionId) ||
    !isNullableIdentifier(record.targetWorkspaceRevision) ||
    !isNullableIdentifier(record.targetBackendThreadId) ||
    !isSafeInteger(record.trustedTime)
  ) {
    return invalid("INVALID_INPUT", "Continuation command contains an invalid field");
  }
  return parsed(
    Object.freeze({
      taskId: record.taskId,
      expectedTaskRevision: record.expectedTaskRevision,
      readRevision: revision.value,
      kind: record.kind,
      requiredActionReceipt: receipt.value,
      targetExecutionId: record.targetExecutionId,
      targetWorkspaceRevision: record.targetWorkspaceRevision,
      targetBackendThreadId: record.targetBackendThreadId,
      trustedTime: record.trustedTime,
    }),
  );
}

function continuationReasons(
  snapshot: DomainSnapshot,
  task: Task,
  command: WaitingContinuationCommand,
): readonly ContinuationReason[] {
  const reasons = new Set<ContinuationReason>();
  if (task.state !== "waiting" || task.waiting === null) {
    reasons.add("STATE_NOT_WAITING");
    return Object.freeze([...reasons]);
  }
  const waiting = task.waiting;
  if (task.revision !== command.expectedTaskRevision || waiting.waitingTaskRevision !== command.expectedTaskRevision) {
    reasons.add("TASK_REVISION_STALE");
  }
  const project = projectById(snapshot, task.projectId);
  if (project === undefined) reasons.add("PROJECT_NOT_REGISTERED");
  else if (!project.enabled) reasons.add("PROJECT_DISABLED");
  for (const dependencyId of task.dependencyIds) {
    const dependency = taskById(snapshot, dependencyId);
    if (dependency === undefined) reasons.add("DEPENDENCY_NOT_REGISTERED");
    else if (dependency.state !== "completed") reasons.add("DEPENDENCY_NOT_COMPLETED");
  }
  const receipt = command.requiredActionReceipt;
  if (
    receipt.taskId !== task.id ||
    receipt.taskRevision !== command.expectedTaskRevision ||
    receipt.requiredAction !== waiting.requiredAction ||
    receipt.status !== "accepted"
  ) {
    reasons.add("REQUIRED_ACTION_RECEIPT_STALE");
  }
  if (
    (waiting.executionId !== null && waiting.executionId !== command.targetExecutionId) ||
    (waiting.workspaceRevision !== null && waiting.workspaceRevision !== command.targetWorkspaceRevision) ||
    (waiting.backendThreadId !== null && waiting.backendThreadId !== command.targetBackendThreadId)
  ) {
    reasons.add("IDENTITY_MISMATCH");
  }
  if (command.kind === "resume") {
    if (waiting.executionId === null) reasons.add("EXECUTION_ID_REQUIRED");
  } else {
    if (!waiting.retryable) reasons.add("NOT_RETRYABLE");
    if (waiting.retryAfter !== null && waiting.retryAfter > command.trustedTime) reasons.add("RETRY_TOO_EARLY");
  }
  return Object.freeze([...reasons].sort(compareStrings));
}

function createDomainSnapshotUnchecked(input: DomainSnapshot): DomainResult<DomainSnapshot> {
  const snapshot = parseSnapshot(input, "complete");
  return snapshot.ok ? success(snapshot.value) : failure(snapshot.error);
}

function createTaskUnchecked(snapshotInput: DomainSnapshot, commandInput: CreateTaskCommand): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = parseTaskCommand(commandInput, ["id", "projectId", "body", "supersedesTaskId"]);
  if (!command.ok) return failure(command.error);
  if (
    !isIdentifier(command.value.id) ||
    !isIdentifier(command.value.projectId) ||
    typeof command.value.body !== "string" ||
    !isNullableIdentifier(command.value.supersedesTaskId)
  ) {
    return failure(domainError("INVALID_INPUT", "Create Task command contains an invalid field"));
  }
  if (taskById(snapshot.value, command.value.id) !== undefined) {
    return failure(domainError("TASK_ALREADY_EXISTS", "Task identity is already registered", { taskId: command.value.id }));
  }
  if (projectById(snapshot.value, command.value.projectId) === undefined) {
    return failure(domainError("PROJECT_NOT_FOUND", "Task Project is not registered", { projectId: command.value.projectId }));
  }
  if (command.value.supersedesTaskId === command.value.id) {
    return failure(domainError("SUPERSESSION_SELF", "Task cannot supersede itself", { taskId: command.value.id }));
  }
  if (
    command.value.supersedesTaskId !== null &&
    taskById(snapshot.value, command.value.supersedesTaskId) === undefined
  ) {
    return failure(
      domainError("SUPERSESSION_NOT_FOUND", "Superseded Task is not registered", {
        taskId: command.value.supersedesTaskId,
      }),
    );
  }
  const taskResult = parseTask(
    {
      id: command.value.id,
      projectId: command.value.projectId,
      state: "idea",
      revision: 1,
      body: command.value.body,
      parentId: null,
      dependencyIds: [],
      waiting: null,
      completion: null,
      cancellation: null,
      supersedesTaskId: command.value.supersedesTaskId,
    },
    `task:${command.value.id}`,
  );
  if (!taskResult.ok) return failure(taskResult.error);
  const next = replaceTasks(snapshot.value, new Map(), [taskResult.value]);
  if (!next.ok) return failure(next.error);
  return mutation(next.value, [taskResult.value.id], [event("task.created", taskResult.value.id, null, 1)]);
}

function updateTaskBodyUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: UpdateTaskBodyCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = parseTaskCommand(commandInput, ["taskId", "body"]);
  if (!command.ok) return failure(command.error);
  if (!isIdentifier(command.value.taskId) || typeof command.value.body !== "string") {
    return failure(domainError("INVALID_INPUT", "Body command contains an invalid field"));
  }
  const task = requireMutableTask(snapshot.value, command.value.taskId);
  if (!task.ok) return failure(task.error);
  if (task.value.body === command.value.body) {
    return failure(domainError("NO_OP", "Task body is unchanged", { taskId: task.value.id }));
  }
  const changed = nextTask(task.value, { body: command.value.body });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot.value, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [event("task.body_changed", changed.value.id, task.value.revision, changed.value.revision)],
  );
}

function sameWaitingInput(left: WaitingMetadata, right: WaitingMetadataInput): boolean {
  return (
    left.reason === right.reason &&
    left.phase === right.phase &&
    left.requiredAction === right.requiredAction &&
    left.lastErrorCode === right.lastErrorCode &&
    left.lastErrorSummary === right.lastErrorSummary &&
    left.retryable === right.retryable &&
    left.retryCount === right.retryCount &&
    left.retryAfter === right.retryAfter &&
    left.executionId === right.executionId &&
    left.workspaceRevision === right.workspaceRevision &&
    left.backendThreadId === right.backendThreadId
  );
}

function updateTaskWaitingUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: UpdateTaskWaitingCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = parseTaskCommand(commandInput, ["taskId", "waiting"]);
  if (!command.ok) return failure(command.error);
  if (!isIdentifier(command.value.taskId)) {
    return failure(domainError("INVALID_INPUT", "Waiting command contains an invalid Task identity"));
  }
  const task = requireMutableTask(snapshot.value, command.value.taskId);
  if (!task.ok) return failure(task.error);
  if (task.value.state !== "waiting" || task.value.waiting === null) {
    return failure(
      domainError("MUTATION_NOT_ALLOWED", "Waiting metadata can change only while the Task is waiting", {
        taskId: task.value.id,
      }),
    );
  }
  const waitingInput = parseWaitingInput(command.value.waiting, `task:${task.value.id}.waiting`);
  if (!waitingInput.ok) return failure(waitingInput.error);
  if (sameWaitingInput(task.value.waiting, waitingInput.value)) {
    return failure(domainError("NO_OP", "Task waiting metadata is unchanged", { taskId: task.value.id }));
  }
  const changed = nextTask(task.value, {
    waiting: Object.freeze({ ...waitingInput.value, waitingTaskRevision: task.value.revision }),
  });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot.value, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [
      event("task.waiting_changed", changed.value.id, task.value.revision, changed.value.revision, {
        waitingReason: changed.value.waiting?.reason ?? null,
        requiredAction: changed.value.waiting?.requiredAction ?? null,
      }),
    ],
  );
}

function setTaskParentUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: SetTaskParentCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = parseTaskCommand(commandInput, ["taskId", "parentId"]);
  if (!command.ok) return failure(command.error);
  if (!isIdentifier(command.value.taskId) || !isNullableIdentifier(command.value.parentId)) {
    return failure(domainError("INVALID_INPUT", "Parent command contains an invalid field"));
  }
  const task = requireMutableTask(snapshot.value, command.value.taskId);
  if (!task.ok) return failure(task.error);
  if (!GRAPH_MUTABLE_STATES.has(task.value.state)) {
    return failure(domainError("MUTATION_NOT_ALLOWED", "Parent can change only in idea, ready, or waiting", { taskId: task.value.id }));
  }
  if (task.value.parentId === command.value.parentId) {
    return failure(domainError("NO_OP", "Task parent is unchanged", { taskId: task.value.id }));
  }
  if (command.value.parentId === task.value.id) {
    return failure(domainError("PARENT_SELF", "Task cannot parent itself", { taskId: task.value.id }));
  }
  if (command.value.parentId !== null) {
    const parent = taskById(snapshot.value, command.value.parentId);
    if (parent === undefined) {
      return failure(domainError("PARENT_NOT_FOUND", "Proposed parent is not registered", { parentId: command.value.parentId }));
    }
    if (parent.projectId !== task.value.projectId) {
      return failure(domainError("PARENT_PROJECT_MISMATCH", "Parent and child must share a Project", { taskId: task.value.id }));
    }
    let cursor: Task | undefined = parent;
    const seen = new Set<string>();
    while (cursor !== undefined) {
      if (cursor.id === task.value.id) {
        return failure(domainError("PARENT_CYCLE", "Proposed parent creates a cycle", { taskId: task.value.id }));
      }
      if (cursor.parentId === null || seen.has(cursor.id)) break;
      seen.add(cursor.id);
      cursor = taskById(snapshot.value, cursor.parentId);
    }
  }
  const changed = nextTask(task.value, { parentId: command.value.parentId });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot.value, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [
      event("task.parent_changed", changed.value.id, task.value.revision, changed.value.revision, {
        parentId: changed.value.parentId,
      }),
    ],
  );
}

function dependencyCommand(value: unknown): Parsed<{ readonly taskId: string; readonly dependencyId: string }> {
  const command = parseTaskCommand(value, ["taskId", "dependencyId"]);
  if (!command.ok) return command;
  if (!isIdentifier(command.value.taskId) || !isIdentifier(command.value.dependencyId)) {
    return invalid("INVALID_INPUT", "Dependency command contains an invalid field");
  }
  return parsed(Object.freeze({ taskId: command.value.taskId, dependencyId: command.value.dependencyId }));
}

function dependencyReaches(snapshot: DomainSnapshot, fromTaskId: string, targetTaskId: string): boolean {
  const pending = [fromTaskId];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current === targetTaskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(taskById(snapshot, current)?.dependencyIds ?? []));
  }
  return false;
}

function addTaskDependencyUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: TaskDependencyCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = dependencyCommand(commandInput);
  if (!command.ok) return failure(command.error);
  const task = requireMutableTask(snapshot.value, command.value.taskId);
  if (!task.ok) return failure(task.error);
  if (!GRAPH_MUTABLE_STATES.has(task.value.state)) {
    return failure(domainError("MUTATION_NOT_ALLOWED", "Dependencies can change only in idea, ready, or waiting", { taskId: task.value.id }));
  }
  if (command.value.taskId === command.value.dependencyId) {
    return failure(domainError("DEPENDENCY_SELF", "Task cannot depend on itself", { taskId: task.value.id }));
  }
  if (taskById(snapshot.value, command.value.dependencyId) === undefined) {
    return failure(domainError("DEPENDENCY_NOT_FOUND", "Dependency is not registered", { dependencyId: command.value.dependencyId }));
  }
  if (task.value.dependencyIds.includes(command.value.dependencyId)) {
    return failure(domainError("DEPENDENCY_DUPLICATE", "Dependency edge already exists", { taskId: task.value.id }));
  }
  if (dependencyReaches(snapshot.value, command.value.dependencyId, task.value.id)) {
    return failure(domainError("DEPENDENCY_CYCLE", "Proposed dependency creates a cycle", { taskId: task.value.id }));
  }
  const dependencyIds = Object.freeze([...task.value.dependencyIds, command.value.dependencyId].sort(compareStrings));
  const changed = nextTask(task.value, { dependencyIds });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot.value, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [
      event("task.dependency_added", changed.value.id, task.value.revision, changed.value.revision, {
        dependencyId: command.value.dependencyId,
      }),
    ],
  );
}

function removeTaskDependencyUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: TaskDependencyCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = dependencyCommand(commandInput);
  if (!command.ok) return failure(command.error);
  const task = requireMutableTask(snapshot.value, command.value.taskId);
  if (!task.ok) return failure(task.error);
  if (!GRAPH_MUTABLE_STATES.has(task.value.state)) {
    return failure(domainError("MUTATION_NOT_ALLOWED", "Dependencies can change only in idea, ready, or waiting", { taskId: task.value.id }));
  }
  if (!task.value.dependencyIds.includes(command.value.dependencyId)) {
    return failure(domainError("NO_OP", "Dependency edge does not exist", { taskId: task.value.id }));
  }
  const dependencyIds = Object.freeze(
    task.value.dependencyIds.filter((dependencyId) => dependencyId !== command.value.dependencyId),
  );
  const changed = nextTask(task.value, { dependencyIds });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot.value, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [
      event("task.dependency_removed", changed.value.id, task.value.revision, changed.value.revision, {
        dependencyId: command.value.dependencyId,
      }),
    ],
  );
}

function setTaskSupersessionUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: SetTaskSupersessionCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = parseTaskCommand(commandInput, ["taskId", "supersedesTaskId"]);
  if (!command.ok) return failure(command.error);
  if (!isIdentifier(command.value.taskId) || !isNullableIdentifier(command.value.supersedesTaskId)) {
    return failure(domainError("INVALID_INPUT", "Supersession command contains an invalid field"));
  }
  const task = requireMutableTask(snapshot.value, command.value.taskId);
  if (!task.ok) return failure(task.error);
  if (task.value.supersedesTaskId === command.value.supersedesTaskId) {
    return failure(domainError("NO_OP", "Task supersession is unchanged", { taskId: task.value.id }));
  }
  if (command.value.supersedesTaskId === task.value.id) {
    return failure(domainError("SUPERSESSION_SELF", "Task cannot supersede itself", { taskId: task.value.id }));
  }
  if (
    command.value.supersedesTaskId !== null &&
    taskById(snapshot.value, command.value.supersedesTaskId) === undefined
  ) {
    return failure(domainError("SUPERSESSION_NOT_FOUND", "Superseded Task is not registered", { taskId: task.value.id }));
  }
  const changed = nextTask(task.value, { supersedesTaskId: command.value.supersedesTaskId });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot.value, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [
      event("task.supersession_changed", changed.value.id, task.value.revision, changed.value.revision, {
        supersedesTaskId: changed.value.supersedesTaskId,
      }),
    ],
  );
}

function evaluateTaskEligibilityUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: TaskEligibilityCommand,
): DomainResult<TaskEligibilityDecision> {
  const command = parseTaskCommand(commandInput, ["taskId", "readRevision"]);
  if (!command.ok) return failure(command.error);
  const revision = readRevision(command.value.readRevision);
  if (!revision.ok) return failure(revision.error);
  if (!isIdentifier(command.value.taskId)) {
    return failure(domainError("INVALID_INPUT", "Eligibility Task identity is invalid"));
  }
  const snapshot = parseSnapshot(snapshotInput, "decision", command.value.taskId);
  if (!snapshot.ok) return failure(snapshot.error);
  const task = taskById(snapshot.value, command.value.taskId);
  if (task === undefined) {
    return failure(domainError("TASK_NOT_FOUND", "Task is not registered", { taskId: command.value.taskId }));
  }
  const reasons = eligibilityReasons(snapshot.value, task);
  return success(
    Object.freeze({
      taskId: task.id,
      readRevision: revision.value,
      eligible: reasons.length === 0,
      reasons,
    }),
  );
}

function evaluateWaitingContinuationUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: WaitingContinuationCommand,
): DomainResult<WaitingContinuationDecision> {
  const command = parseContinuationCommand(commandInput);
  if (!command.ok) return failure(command.error);
  const snapshot = parseSnapshot(snapshotInput, "decision", command.value.taskId);
  if (!snapshot.ok) return failure(snapshot.error);
  const task = taskById(snapshot.value, command.value.taskId);
  if (task === undefined) {
    return failure(domainError("TASK_NOT_FOUND", "Task is not registered", { taskId: command.value.taskId }));
  }
  const reasons = continuationReasons(snapshot.value, task, command.value);
  return success(
    Object.freeze({
      taskId: task.id,
      readRevision: command.value.readRevision,
      kind: command.value.kind,
      eligible: reasons.length === 0,
      reasons,
    }),
  );
}

function parseExternalAcceptance(value: unknown, task: Task): Parsed<ExternalAcceptance> {
  const record = readExactRecord(value, ["taskId", "taskRevision", "authorization", "reliability"]);
  if (record === null) {
    return invalid("INVALID_INPUT", "External acceptance must have the exact shape");
  }
  if (
    record.taskId !== task.id ||
    record.taskRevision !== task.revision ||
    record.authorization !== "accepted" ||
    record.reliability !== "accepted"
  ) {
    return invalid("EXTERNAL_PRECONDITION_FAILED", "External acceptance is not current and positive", {
      taskId: task.id,
    });
  }
  return parsed(
    Object.freeze({
      taskId: task.id,
      taskRevision: task.revision,
      authorization: record.authorization,
      reliability: record.reliability,
    }),
  );
}

function parseCompletionDecision(value: unknown, task: Task): Parsed<CompletionDecision> {
  const record = readExactRecord(value, ["decisionId", "taskId", "taskRevision", "status"]);
  if (record === null) {
    return invalid("INVALID_INPUT", "Completion decision must have the exact shape");
  }
  if (
    !isIdentifier(record.decisionId) ||
    record.taskId !== task.id ||
    record.taskRevision !== task.revision ||
    record.status !== "accepted"
  ) {
    return invalid("EXTERNAL_PRECONDITION_FAILED", "Completion decision is not current and accepted", {
      taskId: task.id,
    });
  }
  return parsed(
    Object.freeze({
      decisionId: record.decisionId,
      taskId: task.id,
      taskRevision: task.revision,
      status: record.status,
    }),
  );
}

function parseExecutionDisposition(value: unknown, task: Task): Parsed<ExecutionDisposition> {
  const record = readExactRecord(value, ["receiptId", "taskId", "taskRevision", "executionId", "status"]);
  if (record === null) {
    return invalid("INVALID_INPUT", "Execution disposition must have the exact shape");
  }
  if (
    !isIdentifier(record.receiptId) ||
    record.taskId !== task.id ||
    record.taskRevision !== task.revision ||
    !isNullableIdentifier(record.executionId) ||
    (record.status !== "absent" && record.status !== "stopped")
  ) {
    return invalid("EXTERNAL_PRECONDITION_FAILED", "Execution disposition is not current and verified", {
      taskId: task.id,
    });
  }
  return parsed(
    Object.freeze({
      receiptId: record.receiptId,
      taskId: task.id,
      taskRevision: task.revision,
      executionId: record.executionId,
      status: record.status,
    }),
  );
}

function waitingFromInput(value: unknown, revision: number, path: string): Parsed<WaitingMetadata> {
  const input = parseWaitingInput(value, path);
  if (!input.ok) return input;
  return parseWaiting({ ...input.value, waitingTaskRevision: revision }, path);
}

function parseDependentWaiting(value: unknown): Parsed<readonly DependentWaitingInput[]> {
  const values = readCanonicalArray(value);
  if (values === null) {
    return invalid("INVALID_INPUT", "dependentWaiting must be an array");
  }
  const entries: DependentWaitingInput[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const item = readExactRecord(values[index], ["taskId", "waiting"]);
    if (item === null || !isIdentifier(item.taskId)) {
      return invalid("INVALID_INPUT", "Dependent waiting entry has an invalid shape", { path: `dependentWaiting[${index}]` });
    }
    const waiting = parseWaitingInput(item.waiting, `dependentWaiting[${index}].waiting`);
    if (!waiting.ok) return waiting;
    entries.push(Object.freeze({ taskId: item.taskId, waiting: waiting.value }));
  }
  entries.sort((left, right) => compareStrings(left.taskId, right.taskId));
  if (new Set(entries.map((entry) => entry.taskId)).size !== entries.length) {
    return invalid("INVALID_INPUT", "dependentWaiting Task identifiers must be unique");
  }
  return parsed(Object.freeze(entries));
}

function transitionPayload(value: unknown, keys: readonly string[]): Parsed<UnknownRecord> {
  const record = readExactRecord(value, keys);
  if (record === null) {
    return invalid("INVALID_INPUT", "Transition payload must contain the exact event fields");
  }
  return parsed(record);
}

function applySimpleTransition(
  snapshot: DomainSnapshot,
  task: Task,
  state: TaskState,
  patch: Readonly<Partial<Task>>,
  domainEvent: TaskTransitionEvent,
): DomainResult<DomainMutation> {
  const changed = nextTask(task, { ...patch, state });
  if (!changed.ok) return failure(changed.error);
  const next = replaceTasks(snapshot, new Map([[changed.value.id, changed.value]]));
  if (!next.ok) return failure(next.error);
  return mutation(
    next.value,
    [changed.value.id],
    [
      event("task.transitioned", changed.value.id, task.revision, changed.value.revision, {
        domainEvent,
        fromState: task.state,
        toState: state,
      }),
    ],
  );
}

function cancelWithDirectDependents(
  snapshot: DomainSnapshot,
  task: Task,
  cancellation: CancellationFact,
  dependentInputs: readonly DependentWaitingInput[],
  domainEvent: "cancel" | "interruption_verified",
): DomainResult<DomainMutation> {
  const affected = snapshot.tasks
    .filter((candidate) => candidate.state === "ready" && candidate.dependencyIds.includes(task.id))
    .sort((left, right) => compareStrings(left.id, right.id));
  if (
    affected.length !== dependentInputs.length ||
    affected.some((candidate, index) => candidate.id !== dependentInputs[index]?.taskId)
  ) {
    return failure(
      domainError("INVALID_INPUT", "dependentWaiting must exactly cover ready direct dependents", {
        taskId: task.id,
      }),
    );
  }
  const cancelled = nextTask(task, {
    state: "cancelled",
    waiting: null,
    completion: null,
    cancellation,
  });
  if (!cancelled.ok) return failure(cancelled.error);
  const replacements = new Map<string, Task>([[cancelled.value.id, cancelled.value]]);
  const events: DomainEvent[] = [
    event("task.transitioned", task.id, task.revision, cancelled.value.revision, {
      domainEvent,
      fromState: task.state,
      toState: "cancelled",
    }),
  ];
  for (const [index, dependent] of affected.entries()) {
    const input = dependentInputs[index];
    if (input === undefined || input.waiting.reason !== "dependency_cancelled") {
      return failure(
        domainError("INVALID_INPUT", "Direct dependent waiting reason must be dependency_cancelled", {
          taskId: dependent.id,
        }),
      );
    }
    if (dependent.revision === Number.MAX_SAFE_INTEGER) {
      return failure(domainError("REVISION_EXHAUSTED", "Dependent revision cannot be incremented safely", { taskId: dependent.id }));
    }
    const waiting = waitingFromInput(input.waiting, dependent.revision + 1, `dependent:${dependent.id}`);
    if (!waiting.ok) return failure(waiting.error);
    const changed = nextTask(dependent, { state: "waiting", waiting: waiting.value });
    if (!changed.ok) return failure(changed.error);
    replacements.set(changed.value.id, changed.value);
    events.push(
      event("task.transitioned", dependent.id, dependent.revision, changed.value.revision, {
        domainEvent: "dependency_cancelled",
        fromState: "ready",
        toState: "waiting",
      }),
    );
  }
  const next = replaceTasks(snapshot, replacements);
  if (!next.ok) return failure(next.error);
  return mutation(next.value, [...replacements.keys()], events);
}

function transitionTaskUnchecked(
  snapshotInput: DomainSnapshot,
  commandInput: TransitionTaskCommand,
): DomainResult<DomainMutation> {
  const snapshot = parseSnapshot(snapshotInput, "complete");
  if (!snapshot.ok) return failure(snapshot.error);
  const command = parseTaskCommand(commandInput, ["taskId", "event", "targetState", "payload"]);
  if (!command.ok) return failure(command.error);
  if (
    !isIdentifier(command.value.taskId) ||
    !isTransitionEvent(command.value.event) ||
    !isTaskState(command.value.targetState)
  ) {
    return failure(domainError("INVALID_INPUT", "Transition command contains an invalid field"));
  }
  const task = taskById(snapshot.value, command.value.taskId);
  if (task === undefined) {
    return failure(domainError("TASK_NOT_FOUND", "Task is not registered", { taskId: command.value.taskId }));
  }
  if (TERMINAL_STATES.has(task.state)) {
    return failure(domainError("TERMINAL_IMMUTABLE", "Terminal Task cannot transition", { taskId: task.id }));
  }
  const legal = TASK_TRANSITIONS.some(
    (transition) =>
      transition.from === task.state &&
      transition.to === command.value.targetState &&
      transition.event === command.value.event,
  );
  if (!legal) {
    return failure(
      domainError("ILLEGAL_TRANSITION", "Task transition is not in the authoritative relation", {
        taskId: task.id,
        fromState: task.state,
        toState: command.value.targetState,
      }),
    );
  }

  switch (command.value.event) {
    case "mark_ready": {
      const payload = transitionPayload(command.value.payload, []);
      if (!payload.ok) return failure(payload.error);
      const project = projectById(snapshot.value, task.projectId);
      if (project === undefined) return failure(domainError("PROJECT_NOT_FOUND", "Task Project is not registered"));
      if (!project.enabled) return failure(domainError("PROJECT_DISABLED", "Disabled Project cannot offer a Task"));
      if (task.dependencyIds.some((dependencyId) => taskById(snapshot.value, dependencyId)?.state === "cancelled")) {
        return failure(domainError("DEPENDENCY_CANCELLED", "Cancelled dependency prevents mark_ready", { taskId: task.id }));
      }
      return applySimpleTransition(snapshot.value, task, "ready", {}, "mark_ready");
    }
    case "claim_accepted": {
      const payload = transitionPayload(command.value.payload, ["externalAcceptance"]);
      if (!payload.ok) return failure(payload.error);
      const eligibility = eligibilityReasons(snapshot.value, task);
      if (eligibility.length > 0) {
        return failure(domainError("TASK_NOT_ELIGIBLE", "Task is not domain-eligible for claim", { taskId: task.id }));
      }
      const external = parseExternalAcceptance(payload.value.externalAcceptance, task);
      if (!external.ok) return failure(external.error);
      return applySimpleTransition(snapshot.value, task, "running", {}, "claim_accepted");
    }
    case "dependency_cancelled": {
      const payload = transitionPayload(command.value.payload, ["waiting"]);
      if (!payload.ok) return failure(payload.error);
      if (!task.dependencyIds.some((dependencyId) => taskById(snapshot.value, dependencyId)?.state === "cancelled")) {
        return failure(domainError("DEPENDENCY_CANCELLED", "No direct dependency is cancelled", { taskId: task.id }));
      }
      if (task.revision === Number.MAX_SAFE_INTEGER) {
        return failure(domainError("REVISION_EXHAUSTED", "Task revision cannot be incremented safely", { taskId: task.id }));
      }
      const waiting = waitingFromInput(payload.value.waiting, task.revision + 1, `task:${task.id}.waiting`);
      if (!waiting.ok) return failure(waiting.error);
      if (waiting.value.reason !== "dependency_cancelled") {
        return failure(domainError("INVALID_INPUT", "Waiting reason must be dependency_cancelled", { taskId: task.id }));
      }
      return applySimpleTransition(snapshot.value, task, "waiting", { waiting: waiting.value }, "dependency_cancelled");
    }
    case "execution_wait": {
      const payload = transitionPayload(command.value.payload, ["waiting"]);
      if (!payload.ok) return failure(payload.error);
      if (task.revision === Number.MAX_SAFE_INTEGER) {
        return failure(domainError("REVISION_EXHAUSTED", "Task revision cannot be incremented safely", { taskId: task.id }));
      }
      const waiting = waitingFromInput(payload.value.waiting, task.revision + 1, `task:${task.id}.waiting`);
      if (!waiting.ok) return failure(waiting.error);
      return applySimpleTransition(snapshot.value, task, "waiting", { waiting: waiting.value }, "execution_wait");
    }
    case "completion_accepted": {
      const payload = transitionPayload(command.value.payload, ["decision"]);
      if (!payload.ok) return failure(payload.error);
      const decision = parseCompletionDecision(payload.value.decision, task);
      if (!decision.ok) return failure(decision.error);
      const completion = Object.freeze({
        decisionId: decision.value.decisionId,
        acceptedTaskRevision: task.revision,
      });
      return applySimpleTransition(snapshot.value, task, "completed", { completion }, "completion_accepted");
    }
    case "resume_accepted":
    case "retry_accepted": {
      const payload = transitionPayload(command.value.payload, ["continuation", "externalAcceptance"]);
      if (!payload.ok) return failure(payload.error);
      const continuation = parseContinuationCommand(payload.value.continuation);
      if (!continuation.ok) return failure(continuation.error);
      const expectedKind = command.value.event === "resume_accepted" ? "resume" : "retry";
      if (continuation.value.taskId !== task.id || continuation.value.kind !== expectedKind) {
        return failure(domainError("INVALID_INPUT", "Continuation identity or kind does not match the transition"));
      }
      const reasons = continuationReasons(snapshot.value, task, continuation.value);
      if (reasons.length > 0) {
        return failure(
          domainError("CONTINUATION_NOT_ELIGIBLE", "Waiting continuation predicate did not pass", {
            taskId: task.id,
            firstReason: reasons[0] ?? null,
          }),
        );
      }
      const external = parseExternalAcceptance(payload.value.externalAcceptance, task);
      if (!external.ok) return failure(external.error);
      return applySimpleTransition(snapshot.value, task, "running", { waiting: null }, command.value.event);
    }
    case "cancel": {
      const payload = transitionPayload(command.value.payload, ["reason", "executionDisposition", "dependentWaiting"]);
      if (!payload.ok) return failure(payload.error);
      if (!isIdentifier(payload.value.reason)) {
        return failure(domainError("INVALID_INPUT", "Cancellation reason must be nonempty", { taskId: task.id }));
      }
      const dependents = parseDependentWaiting(payload.value.dependentWaiting);
      if (!dependents.ok) return failure(dependents.error);
      let verificationId: string | null = null;
      if (task.state === "waiting") {
        const executionId = task.waiting?.executionId ?? null;
        if (executionId === null) {
          if (payload.value.executionDisposition !== null) {
            return failure(domainError("INVALID_INPUT", "Waiting Task without an execution must not carry a disposition"));
          }
        } else {
          const disposition = parseExecutionDisposition(payload.value.executionDisposition, task);
          if (!disposition.ok) return failure(disposition.error);
          if (executionId !== disposition.value.executionId) {
            return failure(
              domainError("EXTERNAL_PRECONDITION_FAILED", "Execution disposition identity does not match waiting Task"),
            );
          }
          verificationId = disposition.value.receiptId;
        }
      } else if (payload.value.executionDisposition !== null) {
        return failure(domainError("INVALID_INPUT", "Idea or ready cancellation has no execution disposition"));
      }
      const cancellation = Object.freeze({
        event: "cancel" as const,
        reason: payload.value.reason,
        verificationId,
        acceptedTaskRevision: task.revision,
      });
      return cancelWithDirectDependents(snapshot.value, task, cancellation, dependents.value, "cancel");
    }
    case "interruption_verified": {
      const payload = transitionPayload(command.value.payload, ["reason", "verification", "dependentWaiting"]);
      if (!payload.ok) return failure(payload.error);
      if (!isIdentifier(payload.value.reason)) {
        return failure(domainError("INVALID_INPUT", "Cancellation reason must be nonempty", { taskId: task.id }));
      }
      const verification = parseExecutionDisposition(payload.value.verification, task);
      if (!verification.ok) return failure(verification.error);
      if (verification.value.status !== "stopped" || verification.value.executionId === null) {
        return failure(domainError("EXTERNAL_PRECONDITION_FAILED", "Running interruption must be verified stopped"));
      }
      const dependents = parseDependentWaiting(payload.value.dependentWaiting);
      if (!dependents.ok) return failure(dependents.error);
      const cancellation = Object.freeze({
        event: "interruption_verified" as const,
        reason: payload.value.reason,
        verificationId: verification.value.receiptId,
        acceptedTaskRevision: task.revision,
      });
      return cancelWithDirectDependents(
        snapshot.value,
        task,
        cancellation,
        dependents.value,
        "interruption_verified",
      );
    }
  }
}

function guardPublicResult<T>(
  code: "INVALID_INPUT" | "INVALID_SNAPSHOT",
  operation: () => DomainResult<T>,
): DomainResult<T> {
  try {
    return operation();
  } catch {
    return failure(
      domainError(code, "Public domain input could not be read safely", {
        reason: "input_access_failed",
      }),
    );
  }
}

export function createDomainSnapshot(input: DomainSnapshot): DomainResult<DomainSnapshot> {
  return guardPublicResult("INVALID_SNAPSHOT", () => createDomainSnapshotUnchecked(input));
}

export function createTask(
  snapshotInput: DomainSnapshot,
  commandInput: CreateTaskCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => createTaskUnchecked(snapshotInput, commandInput));
}

export function updateTaskBody(
  snapshotInput: DomainSnapshot,
  commandInput: UpdateTaskBodyCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => updateTaskBodyUnchecked(snapshotInput, commandInput));
}

export function updateTaskWaiting(
  snapshotInput: DomainSnapshot,
  commandInput: UpdateTaskWaitingCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => updateTaskWaitingUnchecked(snapshotInput, commandInput));
}

export function setTaskParent(
  snapshotInput: DomainSnapshot,
  commandInput: SetTaskParentCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => setTaskParentUnchecked(snapshotInput, commandInput));
}

export function addTaskDependency(
  snapshotInput: DomainSnapshot,
  commandInput: TaskDependencyCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => addTaskDependencyUnchecked(snapshotInput, commandInput));
}

export function removeTaskDependency(
  snapshotInput: DomainSnapshot,
  commandInput: TaskDependencyCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => removeTaskDependencyUnchecked(snapshotInput, commandInput));
}

export function setTaskSupersession(
  snapshotInput: DomainSnapshot,
  commandInput: SetTaskSupersessionCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => setTaskSupersessionUnchecked(snapshotInput, commandInput));
}

export function evaluateTaskEligibility(
  snapshotInput: DomainSnapshot,
  commandInput: TaskEligibilityCommand,
): DomainResult<TaskEligibilityDecision> {
  return guardPublicResult("INVALID_INPUT", () => evaluateTaskEligibilityUnchecked(snapshotInput, commandInput));
}

export function evaluateWaitingContinuation(
  snapshotInput: DomainSnapshot,
  commandInput: WaitingContinuationCommand,
): DomainResult<WaitingContinuationDecision> {
  return guardPublicResult("INVALID_INPUT", () =>
    evaluateWaitingContinuationUnchecked(snapshotInput, commandInput),
  );
}

export function transitionTask(
  snapshotInput: DomainSnapshot,
  commandInput: TransitionTaskCommand,
): DomainResult<DomainMutation> {
  return guardPublicResult("INVALID_INPUT", () => transitionTaskUnchecked(snapshotInput, commandInput));
}
