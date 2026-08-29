import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  createDomainSnapshot,
  createTask,
  openPersistence,
  updateTaskBody,
} from "../src/index.ts";
import { readDomainSnapshot } from "../src/persistence/repository.ts";
import { initializeDomainSnapshot } from "../src/persistence/repository.ts";
import { loadMigrationRegistry } from "../src/persistence/migrations.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  emptySnapshot,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

function fullDomainSnapshot() {
  const result = createDomainSnapshot({
    projects: [
      { id: "project", enabled: true },
      { id: "disabled", enabled: false },
    ],
    tasks: [
      {
        id: "done",
        projectId: "project",
        state: "completed",
        revision: 2,
        body: "completed body",
        parentId: null,
        dependencyIds: [],
        waiting: null,
        completion: { decisionId: "decision", acceptedTaskRevision: 1 },
        cancellation: null,
        supersedesTaskId: null,
      },
      {
        id: "cancelled",
        projectId: "project",
        state: "cancelled",
        revision: 2,
        body: "cancelled body",
        parentId: null,
        dependencyIds: [],
        waiting: null,
        completion: null,
        cancellation: {
          event: "interruption_verified",
          reason: "operator",
          verificationId: "verification",
          acceptedTaskRevision: 1,
        },
        supersedesTaskId: null,
      },
      {
        id: "waiting",
        projectId: "project",
        state: "waiting",
        revision: 3,
        body: "waiting body",
        parentId: "done",
        dependencyIds: ["done"],
        waiting: {
          reason: "execution_failed",
          phase: "phase",
          requiredAction: "retry",
          lastErrorCode: "E_TEST",
          lastErrorSummary: "summary",
          retryable: true,
          retryCount: 2,
          retryAfter: 123,
          executionId: "execution",
          workspaceRevision: "workspace",
          backendThreadId: "thread",
          waitingTaskRevision: 3,
        },
        completion: null,
        cancellation: null,
        supersedesTaskId: "cancelled",
      },
      {
        id: "idea",
        projectId: "project",
        state: "idea",
        revision: 1,
        body: "idea body",
        parentId: "waiting",
        dependencyIds: ["done"],
        waiting: null,
        completion: null,
        cancellation: null,
        supersedesTaskId: null,
      },
    ],
  });
  assert.equal(result.ok, true);
  return result.value;
}

test("repository round-trips every frozen Domain Core persistence field exactly", async () => {
  const fixture = createPersistenceFixture("repository-roundtrip");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "repository" });
    const snapshot = fullDomainSnapshot();
    assert.deepEqual(store.initialize(snapshot), snapshot);
    assert.deepEqual(store.read(), snapshot);
    assert.equal(Object.isFrozen(store.read()), true);
    assert.throws(
      () => store.initialize(snapshot),
      (error) => expectPersistenceError(error, "REVISION_CONFLICT"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("an intentionally empty Domain snapshot initializes exactly once", async () => {
  const fixture = createPersistenceFixture("repository-empty-init");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "empty" });
    const empty = createDomainSnapshot({ projects: [], tasks: [] });
    assert.equal(empty.ok, true);
    assert.deepEqual(store.initialize(empty.value), empty.value);
    assert.throws(
      () => store.initialize(empty.value),
      (error) => expectPersistenceError(error, "REVISION_CONFLICT"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("repository compare-and-swap rejects a stale complete snapshot without partial write", async () => {
  const fixture = createPersistenceFixture("repository-cas");
  let first;
  let second;
  try {
    first = await openPersistence(fixture.layout, { applicationVersion: "first" });
    const initialResult = createDomainSnapshot(emptySnapshot());
    assert.equal(initialResult.ok, true);
    const initial = first.initialize(initialResult.value);
    second = await openPersistence(fixture.layout, { applicationVersion: "second" });
    const created = createTask(initial, {
      id: "task",
      projectId: "project",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const committed = first.commit(initial, created.value);
    assert.throws(
      () => second.commit(initial, created.value),
      (error) => expectPersistenceError(error, "REVISION_CONFLICT"),
    );
    assert.deepEqual(second.read(), committed);
  } finally {
    if (second) await second.close();
    if (first) await first.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("repository requires the exact trusted Domain mutation envelope and unchanged Projects", async () => {
  const fixture = createPersistenceFixture("repository-ingress");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "ingress" });
    const initialResult = createDomainSnapshot(emptySnapshot());
    assert.equal(initialResult.ok, true);
    const initial = store.initialize(initialResult.value);
    const created = createTask(initial, {
      id: "task",
      projectId: "project",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    assert.throws(
      () => store.commit(initial, { ...created.value, extra: true }),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
    assert.throws(
      () =>
        store.commit(initial, {
          snapshot: { ...created.value.snapshot, projects: [{ id: "project", enabled: false }] },
          changedTaskIds: ["task"],
        }),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
    assert.deepEqual(store.read(), initial);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("repository persists an ordinary Domain Core body mutation at exactly one next revision", async () => {
  const fixture = createPersistenceFixture("repository-mutation");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "mutation" });
    const initialResult = createDomainSnapshot(emptySnapshot());
    assert.equal(initialResult.ok, true);
    const initial = store.initialize(initialResult.value);
    const created = createTask(initial, {
      id: "task",
      projectId: "project",
      body: "first",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const persisted = store.commit(initial, created.value);
    const updated = updateTaskBody(persisted, { taskId: "task", body: "second" });
    assert.equal(updated.ok, true);
    const readback = store.commit(persisted, updated.value);
    assert.equal(readback.tasks[0].revision, 2);
    assert.equal(readback.tasks[0].body, "second");
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

const corruptionCases = [
  {
    name: "unknown enum",
    mutate(database) {
      database.exec("PRAGMA ignore_check_constraints=ON");
      database.prepare("UPDATE tasks SET state='unknown' WHERE task_id='waiting'").run();
    },
  },
  {
    name: "conditional waiting shape",
    mutate(database) {
      database.exec("PRAGMA ignore_check_constraints=ON");
      database.prepare("UPDATE tasks SET waiting_task_revision=NULL WHERE task_id='waiting'").run();
    },
  },
  {
    name: "cross-Project graph",
    mutate(database) {
      database.prepare("UPDATE tasks SET project_id='disabled' WHERE task_id='idea'").run();
    },
  },
];

for (const corruption of corruptionCases) {
  test(`typed decode refuses ${corruption.name} without defaults or skipped rows`, async () => {
    const fixture = createPersistenceFixture(`repository-corrupt-${corruption.name.replaceAll(" ", "-")}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "corrupt" });
      store.initialize(fullDomainSnapshot());
      await store.close();
      store = undefined;
      const database = new DatabaseSync(fixture.layout.databasePath);
      corruption.mutate(database);
      database.close();
      await assert.rejects(
        openPersistence(fixture.layout, { applicationVersion: "decode" }),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

test("decoder rejects a wrong SQLite storage class at its sole ingress", async () => {
  const database = new DatabaseSync(":memory:");
  try {
    const registry = loadMigrationRegistry();
    const metadataSql = registry[0].sql;
    const storageSql = registry[1].sql.replaceAll(" STRICT;", ";");
    database.exec("PRAGMA foreign_keys=ON");
    database.exec(metadataSql);
    database.exec(storageSql);
    database
      .prepare(
        "INSERT INTO schema_metadata(singleton, schema_version, domain_initialized, registry_identity, schema_fingerprint, updated_at) VALUES (1, 2, 0, ?, ?, 'test')",
      )
      .run("0".repeat(64), "0".repeat(64));
    initializeDomainSnapshot(database, fullDomainSnapshot());
    database.prepare("UPDATE tasks SET body=? WHERE task_id='idea'").run(new Uint8Array([0]));
    assert.throws(
      () => readDomainSnapshot(database),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    database.close();
  }
});

test("foreign-key failure rolls back the complete transaction", async () => {
  const fixture = createPersistenceFixture("repository-fk");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "fk" });
    store.initialize(fullDomainSnapshot());
    await store.close();
    store = undefined;
    const database = new DatabaseSync(fixture.layout.databasePath);
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("BEGIN IMMEDIATE");
    database.prepare("INSERT INTO task_dependencies(task_id, dependency_id) VALUES ('idea', 'missing')").run();
    assert.throws(() => database.exec("COMMIT"), /FOREIGN KEY constraint failed/u);
    assert.equal(database.isTransaction, true);
    database.exec("ROLLBACK");
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM task_dependencies WHERE dependency_id='missing'").get().count,
      0,
    );
    database.close();
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});
