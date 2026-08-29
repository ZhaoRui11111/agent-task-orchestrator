import {
  createDomainSnapshot,
  type DomainMutation,
  type DomainSnapshot,
  type Project,
  type Task,
} from "../domain.ts";
import {
  runReadSnapshot,
  runWriteTransaction,
  type SqliteDatabase,
  sqliteNullableText,
  type SqliteStatement,
  sqliteText,
} from "./database.ts";
import { normalizeSqliteFailure, persistenceFailure } from "./errors.ts";
import { readDomainInitialized } from "./migrations.ts";
import { canonicalArray, canonicalJson, exactRecord, isNonemptyString } from "./values.ts";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sqliteRowInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not a safe SQLite INTEGER`);
  }
  return value;
}

function sqliteBoolean(value: unknown, label: string): boolean {
  const integer = sqliteRowInteger(value, label);
  if (integer !== 0 && integer !== 1) {
    throw persistenceFailure("CORRUPT_ROW", `${label} is not a stored boolean`);
  }
  return integer === 1;
}

function sqliteNullableInteger(value: unknown, label: string): number | null {
  if (value === null) return null;
  return sqliteRowInteger(value, label);
}

function validateDecodedSnapshot(value: DomainSnapshot): DomainSnapshot {
  const result = createDomainSnapshot(value);
  if (!result.ok) {
    throw persistenceFailure("CORRUPT_ROW", "Persisted Project/Task graph violates the Domain Core", {
      domainCode: result.error.code,
    });
  }
  return result.value;
}

function validateCallerSnapshot(value: DomainSnapshot, label: string): DomainSnapshot {
  const result = createDomainSnapshot(value);
  if (!result.ok) {
    throw persistenceFailure("INVALID_INPUT", `${label} violates the Domain Core`, {
      domainCode: result.error.code,
    });
  }
  return result.value;
}

function readDomainSnapshotUntransactional(database: SqliteDatabase): DomainSnapshot {
  let projectRows: readonly Record<string, unknown>[];
  let taskRows: readonly Record<string, unknown>[];
  let dependencyRows: readonly Record<string, unknown>[];
  try {
    projectRows = database
      .prepare("SELECT project_id, enabled FROM projects ORDER BY project_id")
      .all();
    taskRows = database
      .prepare(
        `SELECT
          task_id, project_id, state, revision, body, parent_id,
          waiting_reason, waiting_phase, waiting_required_action, waiting_last_error_code,
          waiting_last_error_summary, waiting_retryable, waiting_retry_count, waiting_retry_after,
          waiting_execution_id, waiting_workspace_revision, waiting_backend_thread_id, waiting_task_revision,
          completion_decision_id, completion_accepted_task_revision,
          cancellation_event, cancellation_reason, cancellation_verification_id,
          cancellation_accepted_task_revision, supersedes_task_id
        FROM tasks ORDER BY task_id`,
      )
      .all();
    dependencyRows = database
      .prepare("SELECT task_id, dependency_id FROM task_dependencies ORDER BY task_id, dependency_id")
      .all();
  } catch (error) {
    throw normalizeSqliteFailure(error, "CORRUPT_ROW");
  }

  const projects: Project[] = projectRows.map((row) =>
    Object.freeze({
      id: sqliteText(row.project_id, "projects.project_id"),
      enabled: sqliteBoolean(row.enabled, "projects.enabled"),
    }),
  );
  const dependencies = new Map<string, string[]>();
  for (const row of dependencyRows) {
    const taskId = sqliteText(row.task_id, "task_dependencies.task_id");
    const dependencyId = sqliteText(row.dependency_id, "task_dependencies.dependency_id");
    const existing = dependencies.get(taskId) ?? [];
    existing.push(dependencyId);
    dependencies.set(taskId, existing);
  }
  const taskIds = new Set(taskRows.map((row) => sqliteText(row.task_id, "tasks.task_id")));
  for (const taskId of dependencies.keys()) {
    if (!taskIds.has(taskId)) {
      throw persistenceFailure("CORRUPT_ROW", "Dependency edge refers to an absent Task", { taskId });
    }
  }

  const tasks = taskRows.map((row) => {
    const taskId = sqliteText(row.task_id, "tasks.task_id");
    const waitingReason = sqliteNullableText(row.waiting_reason, "tasks.waiting_reason");
    const completionDecisionId = sqliteNullableText(
      row.completion_decision_id,
      "tasks.completion_decision_id",
    );
    const cancellationEvent = sqliteNullableText(row.cancellation_event, "tasks.cancellation_event");
    const waiting =
      waitingReason === null
        ? null
        : Object.freeze({
            reason: waitingReason,
            phase: sqliteText(row.waiting_phase, "tasks.waiting_phase"),
            requiredAction: sqliteText(row.waiting_required_action, "tasks.waiting_required_action"),
            lastErrorCode: sqliteText(row.waiting_last_error_code, "tasks.waiting_last_error_code"),
            lastErrorSummary: sqliteNullableText(
              row.waiting_last_error_summary,
              "tasks.waiting_last_error_summary",
            ),
            retryable: sqliteBoolean(row.waiting_retryable, "tasks.waiting_retryable"),
            retryCount: sqliteRowInteger(row.waiting_retry_count, "tasks.waiting_retry_count"),
            retryAfter: sqliteNullableInteger(row.waiting_retry_after, "tasks.waiting_retry_after"),
            executionId: sqliteNullableText(row.waiting_execution_id, "tasks.waiting_execution_id"),
            workspaceRevision: sqliteNullableText(
              row.waiting_workspace_revision,
              "tasks.waiting_workspace_revision",
            ),
            backendThreadId: sqliteNullableText(
              row.waiting_backend_thread_id,
              "tasks.waiting_backend_thread_id",
            ),
            waitingTaskRevision: sqliteRowInteger(
              row.waiting_task_revision,
              "tasks.waiting_task_revision",
            ),
          });
    const completion =
      completionDecisionId === null
        ? null
        : Object.freeze({
            decisionId: completionDecisionId,
            acceptedTaskRevision: sqliteRowInteger(
              row.completion_accepted_task_revision,
              "tasks.completion_accepted_task_revision",
            ),
          });
    const cancellation =
      cancellationEvent === null
        ? null
        : Object.freeze({
            event: cancellationEvent,
            reason: sqliteText(row.cancellation_reason, "tasks.cancellation_reason"),
            verificationId: sqliteNullableText(
              row.cancellation_verification_id,
              "tasks.cancellation_verification_id",
            ),
            acceptedTaskRevision: sqliteRowInteger(
              row.cancellation_accepted_task_revision,
              "tasks.cancellation_accepted_task_revision",
            ),
          });
    return Object.freeze({
      id: taskId,
      projectId: sqliteText(row.project_id, "tasks.project_id"),
      state: sqliteText(row.state, "tasks.state"),
      revision: sqliteRowInteger(row.revision, "tasks.revision"),
      body: sqliteText(row.body, "tasks.body"),
      parentId: sqliteNullableText(row.parent_id, "tasks.parent_id"),
      dependencyIds: Object.freeze([...(dependencies.get(taskId) ?? [])].sort(compareStrings)),
      waiting,
      completion,
      cancellation,
      supersedesTaskId: sqliteNullableText(row.supersedes_task_id, "tasks.supersedes_task_id"),
    });
  });
  return validateDecodedSnapshot({ projects, tasks } as DomainSnapshot);
}

export function readDomainSnapshot(database: SqliteDatabase): DomainSnapshot {
  return runReadSnapshot(database, () => readDomainSnapshotUntransactional(database));
}

function bindTask(task: Task): readonly (string | number | null)[] {
  const waiting = task.waiting;
  const completion = task.completion;
  const cancellation = task.cancellation;
  return Object.freeze([
    task.id,
    task.projectId,
    task.state,
    task.revision,
    task.body,
    task.parentId,
    waiting?.reason ?? null,
    waiting?.phase ?? null,
    waiting?.requiredAction ?? null,
    waiting?.lastErrorCode ?? null,
    waiting?.lastErrorSummary ?? null,
    waiting === null ? null : waiting.retryable ? 1 : 0,
    waiting?.retryCount ?? null,
    waiting?.retryAfter ?? null,
    waiting?.executionId ?? null,
    waiting?.workspaceRevision ?? null,
    waiting?.backendThreadId ?? null,
    waiting?.waitingTaskRevision ?? null,
    completion?.decisionId ?? null,
    completion?.acceptedTaskRevision ?? null,
    cancellation?.event ?? null,
    cancellation?.reason ?? null,
    cancellation?.verificationId ?? null,
    cancellation?.acceptedTaskRevision ?? null,
    task.supersedesTaskId,
  ]);
}

const TASK_COLUMNS = `
  task_id, project_id, state, revision, body, parent_id,
  waiting_reason, waiting_phase, waiting_required_action, waiting_last_error_code,
  waiting_last_error_summary, waiting_retryable, waiting_retry_count, waiting_retry_after,
  waiting_execution_id, waiting_workspace_revision, waiting_backend_thread_id, waiting_task_revision,
  completion_decision_id, completion_accepted_task_revision,
  cancellation_event, cancellation_reason, cancellation_verification_id,
  cancellation_accepted_task_revision, supersedes_task_id`;

function insertTask(statement: SqliteStatement, task: Task): void {
  statement.run(...bindTask(task));
}

function statementChanges(value: number | bigint): number {
  const changes = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(changes)) {
    throw persistenceFailure("INTEGRITY_ERROR", "SQLite change count is not a safe integer");
  }
  return changes;
}

function writeDependencies(database: SqliteDatabase, task: Task): void {
  const insert = database.prepare(
    "INSERT INTO task_dependencies(task_id, dependency_id) VALUES (?, ?)",
  );
  for (const dependencyId of task.dependencyIds) insert.run(task.id, dependencyId);
}

export function initializeDomainSnapshot(database: SqliteDatabase, snapshotInput: DomainSnapshot): DomainSnapshot {
  const snapshot = validateCallerSnapshot(snapshotInput, "Initial snapshot");
  return runWriteTransaction(database, () => {
    if (readDomainInitialized(database)) {
      throw persistenceFailure("REVISION_CONFLICT", "Persistence store is already initialized");
    }
    const current = readDomainSnapshotUntransactional(database);
    if (current.projects.length !== 0 || current.tasks.length !== 0) {
      throw persistenceFailure("INTEGRITY_ERROR", "Uninitialized persistence contains Domain rows");
    }
    const insertProject = database.prepare("INSERT INTO projects(project_id, enabled) VALUES (?, ?)");
    for (const project of snapshot.projects) insertProject.run(project.id, project.enabled ? 1 : 0);
    const placeholders = new Array(25).fill("?").join(", ");
    const insertTaskStatement = database.prepare(`INSERT INTO tasks(${TASK_COLUMNS}) VALUES (${placeholders})`);
    for (const task of snapshot.tasks) insertTask(insertTaskStatement, task);
    for (const task of snapshot.tasks) writeDependencies(database, task);
    const readback = readDomainSnapshotUntransactional(database);
    if (canonicalJson(readback) !== canonicalJson(snapshot)) {
      throw persistenceFailure("INTEGRITY_ERROR", "Initial snapshot terminal readback did not match input");
    }
    const marker = database
      .prepare("UPDATE schema_metadata SET domain_initialized=1 WHERE singleton=1 AND domain_initialized=0")
      .run();
    if (statementChanges(marker.changes) !== 1 || !readDomainInitialized(database)) {
      throw persistenceFailure("REVISION_CONFLICT", "Domain initialization marker compare-and-swap failed");
    }
    return readback;
  });
}

function parseMutation(value: DomainMutation): Readonly<{ snapshot: DomainSnapshot; changedTaskIds: readonly string[] }> {
  const record = exactRecord(value, ["snapshot", "changedTaskIds"], "Domain mutation");
  const changedValues = canonicalArray(record.changedTaskIds, "Domain mutation changedTaskIds");
  if (!changedValues.every((item) => isNonemptyString(item))) {
    throw persistenceFailure("INVALID_INPUT", "changedTaskIds must contain only nonempty identifiers");
  }
  const changedTaskIds = [...(changedValues as readonly string[])];
  const sorted = [...changedTaskIds].sort(compareStrings);
  if (new Set(sorted).size !== sorted.length || canonicalJson(sorted) !== canonicalJson(changedTaskIds)) {
    throw persistenceFailure("INVALID_INPUT", "changedTaskIds must be sorted and unique");
  }
  return Object.freeze({
    snapshot: validateCallerSnapshot(record.snapshot as DomainSnapshot, "Mutation snapshot"),
    changedTaskIds: Object.freeze(changedTaskIds),
  });
}

function taskMap(snapshot: DomainSnapshot): ReadonlyMap<string, Task> {
  return new Map(snapshot.tasks.map((task) => [task.id, task]));
}

function changedTaskIds(expected: DomainSnapshot, next: DomainSnapshot): readonly string[] {
  const expectedById = taskMap(expected);
  const nextById = taskMap(next);
  for (const taskId of expectedById.keys()) {
    if (!nextById.has(taskId)) {
      throw persistenceFailure("INVALID_INPUT", "Persistence mutation must not delete Tasks", { taskId });
    }
  }
  const changed: string[] = [];
  for (const task of next.tasks) {
    const previous = expectedById.get(task.id);
    if (previous === undefined) {
      if (task.revision !== 1) {
        throw persistenceFailure("REVISION_CONFLICT", "A new Task must start at revision 1", { taskId: task.id });
      }
      changed.push(task.id);
    } else if (canonicalJson(previous) !== canonicalJson(task)) {
      if (task.revision !== previous.revision + 1) {
        throw persistenceFailure("REVISION_CONFLICT", "A changed Task must increment its exact prior revision", {
          taskId: task.id,
        });
      }
      changed.push(task.id);
    }
  }
  return Object.freeze(changed.sort(compareStrings));
}

export function commitDomainMutation(
  database: SqliteDatabase,
  expectedInput: DomainSnapshot,
  mutationInput: DomainMutation,
): DomainSnapshot {
  const expected = validateCallerSnapshot(expectedInput, "Expected snapshot");
  const mutation = parseMutation(mutationInput);
  if (canonicalJson(expected.projects) !== canonicalJson(mutation.snapshot.projects)) {
    throw persistenceFailure("INVALID_INPUT", "Domain mutations must not change the Project registry");
  }
  const actualChanged = changedTaskIds(expected, mutation.snapshot);
  if (canonicalJson(actualChanged) !== canonicalJson(mutation.changedTaskIds) || actualChanged.length === 0) {
    throw persistenceFailure("INVALID_INPUT", "changedTaskIds does not exactly bind the Domain mutation");
  }

  return runWriteTransaction(database, () => {
    if (!readDomainInitialized(database)) {
      throw persistenceFailure("REVISION_CONFLICT", "Persistence store has not been initialized");
    }
    const current = readDomainSnapshotUntransactional(database);
    if (canonicalJson(current) !== canonicalJson(expected)) {
      throw persistenceFailure("REVISION_CONFLICT", "Persisted snapshot no longer matches the expected revision set");
    }
    const expectedById = taskMap(expected);
    const nextById = taskMap(mutation.snapshot);
    const placeholders = new Array(25).fill("?").join(", ");
    const insert = database.prepare(`INSERT INTO tasks(${TASK_COLUMNS}) VALUES (${placeholders})`);
    const update = database.prepare(
      `UPDATE tasks SET
        project_id = ?, state = ?, revision = ?, body = ?, parent_id = ?,
        waiting_reason = ?, waiting_phase = ?, waiting_required_action = ?, waiting_last_error_code = ?,
        waiting_last_error_summary = ?, waiting_retryable = ?, waiting_retry_count = ?, waiting_retry_after = ?,
        waiting_execution_id = ?, waiting_workspace_revision = ?, waiting_backend_thread_id = ?, waiting_task_revision = ?,
        completion_decision_id = ?, completion_accepted_task_revision = ?,
        cancellation_event = ?, cancellation_reason = ?, cancellation_verification_id = ?,
        cancellation_accepted_task_revision = ?, supersedes_task_id = ?
      WHERE task_id = ? AND revision = ?`,
    );
    const deleteDependencies = database.prepare("DELETE FROM task_dependencies WHERE task_id = ?");
    for (const taskId of mutation.changedTaskIds) {
      const next = nextById.get(taskId);
      if (next === undefined) {
        throw persistenceFailure("INVALID_INPUT", "Changed Task is absent from the mutation snapshot", { taskId });
      }
      const previous = expectedById.get(taskId);
      if (previous === undefined) {
        insertTask(insert, next);
      } else {
        const values = bindTask(next).slice(1);
        const result = update.run(...values, next.id, previous.revision);
        if (statementChanges(result.changes) !== 1) {
          throw persistenceFailure("REVISION_CONFLICT", "Task revision compare-and-swap failed", { taskId });
        }
      }
      deleteDependencies.run(taskId);
      writeDependencies(database, next);
    }
    const readback = readDomainSnapshotUntransactional(database);
    if (canonicalJson(readback) !== canonicalJson(mutation.snapshot)) {
      throw persistenceFailure("INTEGRITY_ERROR", "Mutation terminal readback did not match the Domain result");
    }
    return readback;
  });
}
