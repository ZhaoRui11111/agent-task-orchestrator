import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  createApplicationService,
  createDomainSnapshot,
  createTask,
  openPersistence,
  updateTaskBody,
} from "../src/index.ts";
import { readDomainSnapshot } from "../src/persistence/repository.ts";
import {
  commitDomainForOwner,
  initializeDomainForOwner,
  readApplicationState,
  readDomainForOwner,
} from "../src/persistence/application-repository.ts";
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
    assert.deepEqual(initializeDomainForOwner(store, snapshot), snapshot);
    assert.deepEqual(readDomainForOwner(store), snapshot);
    assert.equal(Object.isFrozen(readDomainForOwner(store)), true);
    assert.throws(
      () => initializeDomainForOwner(store, snapshot),
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
    assert.deepEqual(initializeDomainForOwner(store, empty.value), empty.value);
    assert.throws(
      () => initializeDomainForOwner(store, empty.value),
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
    const initial = initializeDomainForOwner(first, initialResult.value);
    second = await openPersistence(fixture.layout, { applicationVersion: "second" });
    const created = createTask(initial, {
      id: "task",
      projectId: "project",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const committed = commitDomainForOwner(first, initial, created.value);
    assert.throws(
      () => commitDomainForOwner(second, initial, created.value),
      (error) => expectPersistenceError(error, "REVISION_CONFLICT"),
    );
    assert.deepEqual(readDomainForOwner(second), committed);
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
    const initial = initializeDomainForOwner(store, initialResult.value);
    const created = createTask(initial, {
      id: "task",
      projectId: "project",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    assert.throws(
      () => commitDomainForOwner(store, initial, { ...created.value, extra: true }),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
    assert.throws(
      () =>
        commitDomainForOwner(store, initial, {
          snapshot: { ...created.value.snapshot, projects: [{ id: "project", enabled: false }] },
          changedTaskIds: ["task"],
        }),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
    assert.deepEqual(readDomainForOwner(store), initial);
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
    const initial = initializeDomainForOwner(store, initialResult.value);
    const created = createTask(initial, {
      id: "task",
      projectId: "project",
      body: "first",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const persisted = commitDomainForOwner(store, initial, created.value);
    const updated = updateTaskBody(persisted, { taskId: "task", body: "second" });
    assert.equal(updated.ok, true);
    const readback = commitDomainForOwner(store, persisted, updated.value);
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
      initializeDomainForOwner(store, fullDomainSnapshot());
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
    initializeDomainForOwner(store, fullDomainSnapshot());
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

test("authoritative v3 open refuses an incomplete consumed request relation", async () => {
  const fixture = createPersistenceFixture("application-corrupt-relation");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "corrupt-v3" });
    await store.close();
    store = undefined;
    const database = new DatabaseSync(fixture.layout.databasePath);
    database.prepare(
      `INSERT INTO application_requests(
        request_id, correlation_id, actor_id, action, target_kind, target_id,
        target_revision, result, created_at
      ) VALUES ('request', 'correlation', 'actor', 'task.inspect', 'task', 'task', 1, 'allow', '2026-08-29T12:00:00.000Z')`,
    ).run();
    database.close();
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "refuse-v3" }),
      (error) => expectPersistenceError(error, "CORRUPT_ROW"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("authoritative v3 decoder refuses unknown action and malformed canonical audit details", async () => {
  for (const corruption of ["action", "details"]) {
    const fixture = createPersistenceFixture(`application-corrupt-${corruption}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "corrupt-v3" });
      await store.close();
      store = undefined;
      const database = new DatabaseSync(fixture.layout.databasePath);
      database.exec("PRAGMA foreign_keys=ON");
      if (corruption === "action") {
        database.exec("PRAGMA ignore_check_constraints=ON");
        database.prepare(
          `INSERT INTO application_requests(
            request_id, correlation_id, actor_id, action, target_kind, target_id,
            target_revision, result, created_at
          ) VALUES ('request', 'correlation', 'actor', 'unknown.action', 'runtime', 'runtime', NULL, 'bootstrap', '2026-08-29T12:00:00.000Z')`,
        ).run();
        database.prepare(
          `INSERT INTO application_audit(
            audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
            target_kind, target_id, target_revision, reason, details_json, created_at
          ) VALUES ('audit', 'request', NULL, 'bootstrap', 'accepted', 'actor', 'correlation',
            'runtime', 'runtime', NULL, 'bootstrap', '{"action":"unknown.action","reason":"bootstrap","targetKind":"runtime","targetRevision":null}\n',
            '2026-08-29T12:00:00.000Z')`,
        ).run();
      } else {
        database.prepare(
          `INSERT INTO application_requests(
            request_id, correlation_id, actor_id, action, target_kind, target_id,
            target_revision, result, created_at
          ) VALUES ('request', 'correlation', 'actor', 'task.inspect', 'task', 'task', 1, 'deny', '2026-08-29T12:00:00.000Z')`,
        ).run();
        database.prepare(
          `INSERT INTO authorization_decisions(
            decision_id, request_id, actor_id, action, result, reason, policy_result,
            grant_id, grant_revision, project_id, resource_revision, created_at
          ) VALUES ('decision', 'request', 'actor', 'task.inspect', 'deny', 'grant_missing',
            'read_not_applicable', NULL, NULL, NULL, NULL, '2026-08-29T12:00:00.000Z')`,
        ).run();
        database.prepare(
          `INSERT INTO application_audit(
            audit_id, request_id, decision_id, event_kind, result, actor_id, correlation_id,
            target_kind, target_id, target_revision, reason, details_json, created_at
          ) VALUES ('audit', 'request', 'decision', 'authorization.denied', 'denied', 'actor',
            'correlation', 'task', 'task', 1, 'grant_missing', '{}', '2026-08-29T12:00:00.000Z')`,
        ).run();
      }
      assert.throws(() => readApplicationState(database), (error) => expectPersistenceError(error, "CORRUPT_ROW"));
      database.close();
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

const applicationRelationCorruptions = [
  {
    name: "bootstrap fixed-grant actor",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        "UPDATE authorization_grants SET actor_id='wrong-actor' WHERE issuer_grant_id IS NULL AND action='task.create'",
      ).run();
    },
  },
  {
    name: "delegated grant create provenance",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        `UPDATE authorization_grants
         SET created_request_id=(
           SELECT request_id FROM application_requests
           WHERE action='project.register' AND result='allow'
         )
         WHERE actor_id='delegate'`,
      ).run();
    },
  },
  {
    name: "delegated grant source action expansion",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        "UPDATE authorization_grants SET action='task.update' WHERE actor_id='delegate'",
      ).run();
    },
  },
  {
    name: "delegated grant source scope expansion",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        "UPDATE authorization_grants SET scope_resource_revision=2 WHERE actor_id='delegate'",
      ).run();
    },
  },
  {
    name: "delegated grant source expiry expansion",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        "UPDATE authorization_grants SET expires_at='2026-09-21T12:00:00.000Z' WHERE actor_id='delegate'",
      ).run();
    },
  },
  {
    name: "delegated Project grant changed to runtime outside its issue decision",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        `UPDATE authorization_grants
         SET scope_kind='runtime', scope_project_id=NULL,
             scope_resource_revision=NULL, scope_config_revision=NULL
         WHERE actor_id='delegate'`,
      ).run();
    },
  },
  {
    name: "delegated Project grant changed to another Project outside its issue decision",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_grants_revoke_only");
      database.prepare(
        `UPDATE authorization_grants
         SET scope_project_id='other-project', scope_resource_revision=1, scope_config_revision=1
         WHERE actor_id='delegate'`,
      ).run();
    },
  },
  {
    name: "decision grant action",
    mutate(database) {
      database.exec("DROP TRIGGER authorization_decisions_no_update");
      database.prepare(
        `UPDATE authorization_decisions
         SET grant_id=(SELECT grant_id FROM authorization_grants WHERE actor_id='owner' AND action='task.create'),
             grant_revision=1
         WHERE action='project.register'`,
      ).run();
    },
  },
  {
    name: "action-specific request target",
    mutate(database) {
      database.exec("DROP TRIGGER application_requests_no_update");
      database.prepare(
        `UPDATE application_requests
         SET target_kind='runtime', target_id='runtime', target_revision=NULL
         WHERE action='project.inspect'`,
      ).run();
    },
  },
  {
    name: "audit event and canonical details binding",
    mutate(database) {
      database.exec("DROP TRIGGER application_audit_no_update");
      database.prepare(
        `UPDATE application_audit
         SET event_kind='grant.revoked',
             details_json=?
         WHERE request_id=(SELECT request_id FROM application_requests WHERE action='project.inspect')`,
      ).run('{"action":"task.create","reason":"accepted","targetKind":"project","targetRevision":1}');
    },
  },
];

for (const corruption of applicationRelationCorruptions) {
  test(`combined decoder rejects ${corruption.name} semantic corruption`, async () => {
    const fixture = createPersistenceFixture(`application-relation-${corruption.name.replaceAll(" ", "-")}`);
    let store;
    try {
      const otherProjectRoot = path.join(fixture.generation, "other-project");
      mkdirSync(otherProjectRoot);
      store = await openPersistence(fixture.layout, { applicationVersion: "relation-setup" });
      let sequence = 0;
      const service = createApplicationService(store, {
        currentActor: () => ({ actorId: "owner", principal: "A".repeat(64) }),
        now: () => "2026-08-29T12:00:00.000Z",
        nextId: (kind) => `${kind}-relation-${++sequence}`,
        confirmHighRisk: () => true,
      });
      assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
      assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
      assert.equal(service.execute({ kind: "project.register", projectId: "other-project", root: otherProjectRoot }).ok, true);
      assert.equal(service.execute({
        kind: "authorization.grant.issue",
        actorId: "delegate",
        action: "task.inspect",
        scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
        notBefore: "2026-08-29T12:00:00.000Z",
        expiresAt: "2026-09-01T12:00:00.000Z",
      }).ok, true);
      assert.equal(service.execute({ kind: "project.inspect", projectId: "project", expectedResourceRevision: 1 }).ok, true);
      await store.close();
      store = undefined;

      const database = new DatabaseSync(fixture.layout.databasePath);
      database.exec("PRAGMA foreign_keys=ON");
      corruption.mutate(database);
      assert.throws(() => readApplicationState(database), (error) => expectPersistenceError(error, "CORRUPT_ROW"));
      database.close();
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}
