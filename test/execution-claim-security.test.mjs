import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  createApplicationService,
  createExecutionApplicationService,
  openPersistence,
} from "../src/index.ts";
import {
  readApplicationState,
  readApplicationStateForOwner,
} from "../src/persistence/application-repository.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const ACTOR = "local-v1:execution-security-owner";
const PRINCIPAL = "B".repeat(64);
const NOW = "2026-08-29T12:00:00.000Z";
const EXPIRES = "2026-09-20T12:00:00.000Z";

function ingress(label, actorId = ACTOR) {
  let sequence = 0;
  let now = NOW;
  let ownerId = "security-worker";
  return {
    currentActor: () => ({ actorId, principal: PRINCIPAL }),
    now: () => now,
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
    currentLeaseOwner: () => ownerId,
    setNow: (value) => { now = value; },
    setOwner: (value) => { ownerId = value; },
  };
}

function createTask(application, taskId, body, ready = true) {
  assert.equal(application.execute({
    kind: "task.create",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    taskId,
    body,
    supersedesTaskId: null,
  }).ok, true);
  if (ready) {
    assert.equal(application.execute({
      kind: "task.mark_ready",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId,
      expectedTaskRevision: 1,
    }).ok, true);
  }
}

function setup(store, trusted, fixture, body = "SENSITIVE_TASK_BODY") {
  const application = createApplicationService(store, trusted);
  assert.equal(application.bootstrap({ kind: "authorization.bootstrap", expiresAt: EXPIRES }).ok, true);
  assert.equal(application.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
  createTask(application, "task", body);
  assert.equal(application.upgrade({ kind: "authorization.capability.upgrade", expiresAt: EXPIRES }).ok, true);
  return application;
}

function claim(taskId = "task", expectedTaskRevision = 2, overrides = {}) {
  return {
    kind: "execution.claim",
    projectId: "project",
    expectedProjectResourceRevision: 1,
    expectedProjectConfigRevision: 1,
    taskId,
    expectedTaskRevision,
    idempotencyKey: `claim-${taskId}`,
    leaseDurationSeconds: 60,
    ...overrides,
  };
}

test("malformed Phase 2 envelopes use neither trusted ingress nor persistence", () => {
  let trustedCalls = 0;
  let storeReads = 0;
  const inaccessibleStore = new Proxy({}, {
    get() {
      storeReads += 1;
      throw new Error("malformed command reached persistence");
    },
  });
  const trusted = {
    currentActor() {
      trustedCalls += 1;
      return { actorId: ACTOR, principal: PRINCIPAL };
    },
    now() {
      trustedCalls += 1;
      return NOW;
    },
    nextId(kind) {
      trustedCalls += 1;
      return `${kind}-malformed`;
    },
    confirmHighRisk() {
      trustedCalls += 1;
      return true;
    },
    currentLeaseOwner() {
      trustedCalls += 1;
      return "malformed-owner";
    },
  };
  const execution = createExecutionApplicationService(inaccessibleStore, trusted);
  const rejected = [
    execution.claim({ kind: "execution.claim" }),
    execution.inspect({ kind: "execution.claim.inspect" }),
    execution.renew({ kind: "execution.lease.renew" }),
    execution.takeover({ kind: "execution.lease.takeover" }),
    createApplicationService(inaccessibleStore, trusted).upgrade({
      kind: "authorization.capability.upgrade",
      expiresAt: "not-a-timestamp",
    }),
  ];
  for (const result of rejected) {
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_INPUT");
    assert.equal(result.requestId, null);
    assert.equal(result.correlationId, null);
  }
  assert.equal(trustedCalls, 0);
  assert.equal(storeReads, 0);
});

test("malformed input and reused trusted identities have no effect, while execution observables stay bounded and redacted", async () => {
  const fixture = createPersistenceFixture("execution-security-input");
  const trusted = ingress("security-input");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-security-input" });
    const application = setup(store, trusted, fixture);
    const service = createExecutionApplicationService(store, trusted);
    const before = readApplicationStateForOwner(store);
    let getterCalls = 0;
    const accessor = { ...claim() };
    Object.defineProperty(accessor, "idempotencyKey", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "accessor-key";
      },
    });
    const invalid = [
      { ...claim(), authority: "accepted" },
      claim("task", 2, { idempotencyKey: "x".repeat(129) }),
      claim("task", 2, { leaseDurationSeconds: 29 }),
      accessor,
      new Proxy(claim(), { ownKeys() { throw new Error("must remain internal"); } }),
    ];
    for (const command of invalid) {
      const result = service.claim(command);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, "INVALID_INPUT");
      assert.equal("stack" in result.error, false);
      assert.deepEqual(readApplicationStateForOwner(store), before);
    }
    assert.equal(getterCalls, 0);

    const duplicateIdentityService = createExecutionApplicationService(store, {
      currentActor: () => ({ actorId: ACTOR, principal: PRINCIPAL }),
      now: () => NOW,
      nextId: () => "duplicate-operation-id",
      confirmHighRisk: () => true,
      currentLeaseOwner: () => "security-worker",
    });
    const duplicate = duplicateIdentityService.claim(claim("task", 2, { idempotencyKey: "duplicate-ids" }));
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.error.code, "INVALID_INPUT");
    assert.deepEqual(readApplicationStateForOwner(store), before);

    const claimed = service.claim(claim());
    assert.equal(claimed.ok, true);
    const beforeUnsafeCancel = readApplicationStateForOwner(store);
    const unsafeCancel = application.execute({
      kind: "task.cancel",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "task",
      expectedTaskRevision: 3,
      reason: "must require verified interruption",
    });
    assert.equal(unsafeCancel.ok, false);
    assert.equal(unsafeCancel.error.code, "DOMAIN_REJECTED");
    assert.equal(unsafeCancel.error.details.domainCode, "EXTERNAL_PRECONDITION_FAILED");
    assert.deepEqual(readApplicationStateForOwner(store), beforeUnsafeCancel);
    const renewalGrant = readApplicationStateForOwner(store).grants.find(
      (grant) => grant.actorId === ACTOR && grant.action === "execution.lease.renew" && grant.revokedAt === null,
    );
    assert.ok(renewalGrant);
    assert.equal(application.execute({
      kind: "authorization.grant.revoke",
      grantId: renewalGrant.grantId,
      expectedGrantRevision: renewalGrant.revision,
    }).ok, true);
    trusted.setNow("2026-08-29T12:00:30.000Z");
    const revoked = service.renew({
      kind: "execution.lease.renew",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision: 1,
      expectedLeaseRevision: 1,
      expectedFencingToken: 1,
      expectedTaskRevision: 3,
      leaseDurationSeconds: 60,
    });
    assert.equal(revoked.ok, false);
    assert.equal(revoked.error.code, "AUTHORIZATION_DENIED");
    assert.equal(readApplicationStateForOwner(store).executions[0]?.revision, 1);

    trusted.setNow("2026-09-21T12:00:00.000Z");
    const expired = service.inspect({
      kind: "execution.claim.inspect",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      expectedProjectConfigRevision: 1,
      executionId: claimed.value.executionId,
      expectedExecutionRevision: 1,
      expectedTaskRevision: 3,
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.error.code, "AUTHORIZATION_DENIED");

    const state = readApplicationStateForOwner(store);
    const observable = JSON.stringify({
      result: claimed,
      requests: state.requests.filter((request) => request.action.startsWith("execution.")),
      decisions: state.decisions.filter((decision) => decision.action.startsWith("execution.")),
      audit: state.audit.filter((event) => event.eventKind.startsWith("execution.") || event.eventKind === "authorization.denied"),
    });
    for (const forbidden of ["SENSITIVE_TASK_BODY", fixture.projectRoot, PRINCIPAL, "SELECT ", "Error:", "stack"]) {
      assert.equal(observable.includes(forbidden), false, `execution observable disclosed ${forbidden}`);
    }
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("stale Project bindings, ineligible Tasks, and disabled Projects cannot create execution state", async () => {
  const fixture = createPersistenceFixture("execution-security-eligibility");
  const trusted = ingress("security-eligibility");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-security-eligibility" });
    const application = setup(store, trusted, fixture, "eligible body");
    createTask(application, "idea-task", "not ready", false);
    const service = createExecutionApplicationService(store, trusted);
    const stale = service.claim(claim("task", 2, { expectedProjectResourceRevision: 2, idempotencyKey: "stale-project" }));
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_REVISION");
    const ineligible = service.claim(claim("idea-task", 1, { idempotencyKey: "idea-task" }));
    assert.equal(ineligible.ok, false);
    assert.equal(ineligible.error.code, "TASK_NOT_ELIGIBLE");
    assert.equal(application.execute({
      kind: "project.disable",
      projectId: "project",
      expectedResourceRevision: 1,
      expectedConfigRevision: 1,
    }).ok, true);
    const disabled = service.claim(claim("task", 2, {
      expectedProjectResourceRevision: 2,
      expectedProjectConfigRevision: 2,
      idempotencyKey: "disabled-project",
    }));
    assert.equal(disabled.ok, false);
    assert.equal(disabled.error.code, "PROJECT_DISABLED");
    const state = readApplicationStateForOwner(store);
    assert.deepEqual(state.executionSequences, []);
    assert.deepEqual(state.executions, []);
    assert.equal(state.domain.tasks.find((task) => task.id === "task")?.state, "ready");
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("a delegated execution grant for another exact Project scope cannot claim this Project", async () => {
  const fixture = createPersistenceFixture("execution-security-scope");
  const trusted = ingress("security-scope-owner");
  let store;
  try {
    const otherRoot = path.join(fixture.generation, "other-project");
    mkdirSync(otherRoot);
    store = await openPersistence(fixture.layout, { applicationVersion: "execution-security-scope" });
    const application = setup(store, trusted, fixture, "scope-bound body");
    assert.equal(application.execute({
      kind: "project.register",
      projectId: "other-project",
      root: otherRoot,
    }).ok, true);
    const delegated = application.execute({
      kind: "authorization.grant.issue",
      actorId: "execution-delegate",
      action: "execution.claim",
      scope: {
        kind: "project",
        projectId: "other-project",
        resourceRevision: 1,
        configRevision: 1,
      },
      notBefore: NOW,
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(delegated.ok, true);
    const delegateIngress = ingress("security-scope-delegate", "execution-delegate");
    const denied = createExecutionApplicationService(store, delegateIngress).claim(claim("task", 2, {
      idempotencyKey: "wrong-project-scope",
    }));
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    const state = readApplicationStateForOwner(store);
    assert.deepEqual(state.executions, []);
    assert.deepEqual(state.executionSequences, []);
    assert.equal(state.domain.tasks.find((task) => task.id === "task")?.state, "ready");
    assert.equal(
      state.decisions.find((decision) => decision.requestId === denied.requestId)?.reason,
      "scope_mismatch",
    );
  } finally {
    if (store !== undefined) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

const executionCorruptions = [
  {
    name: "claim request target substitution",
    mutate(database) {
      database.exec("DROP TRIGGER application_requests_no_update");
      database.prepare(
        "UPDATE application_requests SET target_id='substituted-execution' WHERE action='execution.claim' AND result='allow'",
      ).run();
    },
  },
  {
    name: "sequence fence jump",
    mutate(database) {
      database.exec("DROP TRIGGER task_execution_sequences_increment_only");
      database.prepare(
        "UPDATE task_execution_sequences SET current_fencing_token=current_fencing_token+1",
      ).run();
    },
  },
  {
    name: "claim lease semantic drift",
    mutate(database) {
      database.exec("DROP TRIGGER execution_attempts_update_guard");
      database.prepare(
        "UPDATE execution_attempts SET requested_lease_seconds=requested_lease_seconds+1",
      ).run();
    },
  },
  {
    name: "self-superseded sole attempt",
    mutate(database) {
      database.exec("DROP TRIGGER execution_attempts_update_guard");
      database.prepare(
        `UPDATE execution_attempts
         SET status='superseded', superseded_by_execution_id=execution_id,
             revision=revision+1, updated_at=lease_expires_at`,
      ).run();
    },
  },
];

for (const corruption of executionCorruptions) {
  test(`current decoder rejects ${corruption.name} execution corruption`, async () => {
    const fixture = createPersistenceFixture(`execution-corrupt-${corruption.name.replaceAll(" ", "-")}`);
    const trusted = ingress(`corrupt-${corruption.name.replaceAll(" ", "-")}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "execution-corruption" });
      setup(store, trusted, fixture, "corruption sentinel");
      assert.equal(createExecutionApplicationService(store, trusted).claim(claim()).ok, true);
      await store.close();
      store = undefined;
      const database = new DatabaseSync(fixture.layout.databasePath);
      database.exec("PRAGMA foreign_keys=ON");
      corruption.mutate(database);
      assert.throws(
        () => readApplicationState(database),
        (error) => expectPersistenceError(error, "CORRUPT_ROW"),
      );
      database.close();
    } finally {
      if (store !== undefined) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}
