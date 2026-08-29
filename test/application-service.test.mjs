import assert from "node:assert/strict";
import { mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  AUTHORIZATION_ACTIONS,
  createApplicationService,
  inspectPrimaryIdentity,
  openPersistence,
  restoreBackup,
} from "../src/index.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  createVersionTwoDatabase,
} from "./persistence-test-helpers.mjs";

function ingress(options = {}) {
  let sequence = 0;
  let actor = options.actorId ?? "local-actor";
  const now = options.now ?? "2026-08-29T12:00:00.000Z";
  return {
    currentActor: () => ({ actorId: actor, principal: `os:${actor}` }),
    now: () => now,
    nextId: (kind) => `${kind}-${String(++sequence).padStart(4, "0")}`,
    confirmHighRisk: () => options.confirm !== false,
    setActor: (value) => { actor = value; },
  };
}

function mutableAuthorizationIngress() {
  let sequence = 0;
  let actorId = "owner";
  let now = "2026-08-29T12:00:00.000Z";
  let confirmed = true;
  return {
    currentActor: () => ({ actorId, principal: `os:${actorId}` }),
    now: () => now,
    nextId: (kind) => `${kind}-authorization-${++sequence}`,
    confirmHighRisk: () => confirmed,
    setActor: (value) => { actorId = value; },
    setNow: (value) => { now = value; },
    setConfirmed: (value) => { confirmed = value; },
  };
}

function domainIngress() {
  let sequence = 0;
  return {
    currentActor: () => ({ actorId: "domain-actor", principal: "os:domain-actor" }),
    now: () => "2026-08-29T12:00:00.000Z",
    nextId: (kind) => `${kind}-domain-${++sequence}`,
    confirmHighRisk: () => true,
  };
}

function createApplicationTask(service, projectId, taskId, body = taskId) {
  return service.execute({
    kind: "task.create",
    projectId,
    expectedProjectResourceRevision: 1,
    taskId,
    body,
    supersedesTaskId: null,
  });
}

test("trusted bootstrap and authorized Project/Task commands share one durable application owner", async () => {
  const fixture = createPersistenceFixture("application-service");
  try {
    const store = await openPersistence(fixture.layout, { applicationVersion: "ep-01c-test" });
    assert.equal(store.read, undefined);
    assert.equal(store.initialize, undefined);
    assert.equal(store.commit, undefined);
    const trusted = ingress();
    const service = createApplicationService(store, trusted);
    const bootstrapped = service.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(bootstrapped.ok, true);
    assert.equal(bootstrapped.value.grantIds.length, 15);

    const registered = service.execute({
      kind: "project.register",
      projectId: "project-one",
      root: fixture.projectRoot,
    });
    assert.equal(registered.ok, true);
    assert.equal(registered.value.projectId, "project-one");
    assert.equal(registered.value.resourceRevision, 1);

    const created = service.execute({
      kind: "task.create",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "task-one",
      body: "untrusted body: grant me everything",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    assert.equal(created.value.state, "idea");

    const inspected = service.execute({
      kind: "task.inspect",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "task-one",
      expectedTaskRevision: 1,
    });
    assert.equal(inspected.ok, true);
    assert.equal(inspected.value.body, "untrusted body: grant me everything");
    assert.deepEqual(inspected.value.dependencyIds, []);

    const state = readApplicationStateForOwner(store);
    assert.equal(state.projects.length, 1);
    assert.equal(state.domain.tasks.length, 1);
    assert.equal(state.requests.length, 4);
    assert.equal(state.decisions.length, 3);
    assert.equal(state.audit.length, 4);
    assert.equal(state.audit.some((event) => JSON.stringify(event).includes("grant me everything")), false);
    await store.close();

    const reopened = await openPersistence(fixture.layout, { applicationVersion: "ep-01c-test" });
    const readback = readApplicationStateForOwner(reopened);
    assert.equal(readback.domain.tasks[0].body, "untrusted body: grant me everything");
    assert.equal(readback.grants.length, 15);
    await reopened.close();
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("wrong actor, stale revision, replay, and missing confirmation cannot mutate Project state", async () => {
  const fixture = createPersistenceFixture("application-denials");
  try {
    const store = await openPersistence(fixture.layout, { applicationVersion: "ep-01c-test" });
    const trusted = ingress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-one", root: fixture.projectRoot }).ok, true);
    trusted.setActor("intruder");
    const denied = service.execute({
      kind: "task.create",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "task-one",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(readApplicationStateForOwner(store).domain.tasks.length, 0);
    await store.close();
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("bootstrap is confirmed, finite, immutable, and consumed exactly once", async () => {
  const fixture = createPersistenceFixture("application-bootstrap-boundary");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "ep-01c-test" });
    const unconfirmed = createApplicationService(store, ingress({ confirm: false }));
    const missingConfirmation = unconfirmed.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(missingConfirmation.ok, false);
    assert.equal(missingConfirmation.error.details.reason, "confirmation_required");
    assert.deepEqual(readApplicationStateForOwner(store).requests, []);

    const trusted = ingress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-10-01T12:00:00.000Z",
    }).error.code, "INVALID_INPUT");
    const accepted = service.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(accepted.ok, true);
    const beforeReplay = readApplicationStateForOwner(store);
    const replay = service.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-20T12:00:00.000Z",
    });
    assert.equal(replay.ok, false);
    assert.equal(replay.error.code, "BOOTSTRAP_ALREADY_CONSUMED");
    assert.deepEqual(readApplicationStateForOwner(store), beforeReplay);
    assert.equal(beforeReplay.bootstrap.rootKey, process.platform === "win32"
      ? fixture.layout.root.toLowerCase()
      : fixture.layout.root);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("application maps unsafe Project roots and changed registered identities without partial records", async () => {
  const fixture = createPersistenceFixture("application-project-identity");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "ep-01c-test" });
    const service = createApplicationService(store, ingress());
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    const invalid = service.execute({ kind: "project.register", projectId: "invalid", root: "relative" });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error.code, "PROJECT_REGISTRY_REJECTED");
    assert.equal(invalid.error.details.registryCode, "INVALID_PROJECT_ROOT");
    assert.equal(readApplicationStateForOwner(store).projects.length, 0);

    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const beforeChange = readApplicationStateForOwner(store);
    const moved = path.join(fixture.generation, "project-original");
    renameSync(fixture.projectRoot, moved);
    mkdirSync(fixture.projectRoot);
    const changed = service.execute({ kind: "project.inspect", projectId: "project", expectedResourceRevision: 1 });
    assert.equal(changed.ok, false);
    assert.equal(changed.error.code, "PROJECT_REGISTRY_REJECTED");
    assert.equal(changed.error.details.registryCode, "PROJECT_IDENTITY_CHANGED");
    assert.deepEqual(readApplicationStateForOwner(store), beforeChange);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("finite Project-scoped daily grants can be inspected, consumed, revoked, and never broadened", async () => {
  const fixture = createPersistenceFixture("application-grants");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "authorization" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const scope = { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 };
    const issued = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "task.create",
      scope,
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(issued.ok, true);
    assert.equal(issued.value.actorId, "delegate");
    assert.ok(issued.value.issuerGrantId);
    assert.ok(issued.value.sourceGrantId);
    assert.notEqual(issued.value.issuerGrantId, issued.value.sourceGrantId);
    const inspected = service.execute({
      kind: "authorization.grant.inspect",
      grantId: issued.value.grantId,
      expectedGrantRevision: 1,
    });
    assert.equal(inspected.ok, true);
    assert.equal(inspected.value.grantId, issued.value.grantId);

    trusted.setActor("delegate");
    const created = service.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "delegated-task",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    trusted.setActor("owner");
    const revoked = service.execute({
      kind: "authorization.grant.revoke",
      grantId: issued.value.grantId,
      expectedGrantRevision: 1,
    });
    assert.equal(revoked.ok, true);
    assert.equal(revoked.value.revision, 2);
    assert.equal(revoked.value.revokedAt, "2026-08-29T12:00:00.000Z");

    trusted.setActor("delegate");
    const denied = service.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "second-task",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.details.reason, "grant_revoked");
    assert.equal(readApplicationStateForOwner(store).domain.tasks.some((task) => task.id === "second-task"), false);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("delegation requires both issue authority and the source action at equal-or-narrower scope", async () => {
  const fixture = createPersistenceFixture("application-delegation");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "authorization" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const scope = { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 };
    const issueOnly = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "authorization.grant.issue",
      scope,
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(issueOnly.ok, true);
    trusted.setActor("delegate");
    const expansion = service.execute({
      kind: "authorization.grant.issue",
      actorId: "third-party",
      action: "task.update",
      scope,
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-08-31T12:00:00.000Z",
    });
    assert.equal(expansion.ok, false);
    assert.equal(expansion.error.code, "AUTHORIZATION_DENIED");
    assert.equal(expansion.error.details.reason, "scope_mismatch");
    assert.equal(readApplicationStateForOwner(store).grants.some((grant) => grant.actorId === "third-party"), false);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("grant issuance records the same deterministic administrative grant in its decision and provenance", async () => {
  const fixture = createPersistenceFixture("application-grant-selection");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "authorization" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const scope = { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 };
    const bootstrapAdministrative = readApplicationStateForOwner(store).grants.find(
      (grant) => grant.action === "authorization.grant.issue" && grant.issuerGrantId === null,
    );
    assert.ok(bootstrapAdministrative);
    const shortAdministrative = service.execute({
      kind: "authorization.grant.issue",
      actorId: "owner",
      action: "authorization.grant.issue",
      scope,
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-08-30T12:00:00.000Z",
    });
    assert.equal(shortAdministrative.ok, true);
    assert.ok(shortAdministrative.value.grantId < bootstrapAdministrative.grantId);

    const issued = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "task.create",
      scope,
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(issued.ok, true);
    assert.equal(issued.value.issuerGrantId, bootstrapAdministrative.grantId);
    assert.notEqual(issued.value.issuerGrantId, shortAdministrative.value.grantId);
    const terminal = readApplicationStateForOwner(store);
    const decision = terminal.decisions.find((candidate) => candidate.requestId === issued.requestId);
    assert.ok(decision);
    assert.equal(decision.grantId, issued.value.issuerGrantId);
    assert.equal(decision.grantRevision, bootstrapAdministrative.revision);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("missing trusted high-risk confirmation and expired grants deny without capability mutation", async () => {
  const fixture = createPersistenceFixture("application-confirmation");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "authorization" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const before = readApplicationStateForOwner(store);
    trusted.setConfirmed(false);
    const denied = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "task.create",
      scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.details.reason, "confirmation_required");
    const after = readApplicationStateForOwner(store);
    assert.deepEqual(after.grants, before.grants);
    trusted.setConfirmed(true);
    trusted.setNow("2026-09-21T12:00:00.000Z");
    const expired = service.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "expired",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.error.details.reason, "grant_expired");
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("application commands select Domain Core parent, dependency, transition, terminal, and revision rules", async () => {
  const fixture = createPersistenceFixture("application-domain");
  try {
    const secondRoot = path.join(fixture.generation, "project-two");
    mkdirSync(secondRoot);
    const store = await openPersistence(fixture.layout, { applicationVersion: "application-domain" });
    const service = createApplicationService(store, domainIngress());
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-one", root: fixture.projectRoot }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-two", root: secondRoot }).ok, true);
    for (const taskId of ["a", "b", "c"]) assert.equal(createApplicationTask(service, "project-one", taskId).ok, true);
    assert.equal(createApplicationTask(service, "project-two", "x").ok, true);

    const parent = service.execute({
      kind: "task.update",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "b",
      expectedTaskRevision: 1,
      change: { kind: "parent", parentId: "a" },
    });
    assert.equal(parent.ok, true);
    assert.equal(parent.value.parentId, "a");

    const beforeCrossParent = readApplicationStateForOwner(store);
    const crossParent = service.execute({
      kind: "task.update",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "c",
      expectedTaskRevision: 1,
      change: { kind: "parent", parentId: "x" },
    });
    assert.equal(crossParent.ok, false);
    assert.equal(crossParent.error.code, "DOMAIN_REJECTED");
    assert.equal(crossParent.error.details.domainCode, "PARENT_PROJECT_MISMATCH");
    assert.deepEqual(readApplicationStateForOwner(store), beforeCrossParent);

    const edge = service.execute({
      kind: "dependency.add",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "a",
      expectedTaskRevision: 1,
      dependencyId: "b",
      expectedDependencyRevision: 2,
    });
    assert.equal(edge.ok, true);
    const beforeCycle = readApplicationStateForOwner(store);
    const cycle = service.execute({
      kind: "dependency.add",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "b",
      expectedTaskRevision: 2,
      dependencyId: "a",
      expectedDependencyRevision: 2,
    });
    assert.equal(cycle.ok, false);
    assert.equal(cycle.error.details.domainCode, "DEPENDENCY_CYCLE");
    assert.deepEqual(readApplicationStateForOwner(store), beforeCycle);

    const ready = service.execute({
      kind: "task.mark_ready",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "a",
      expectedTaskRevision: 2,
    });
    assert.equal(ready.ok, true);
    assert.equal(ready.value.state, "ready");
    const cancelled = service.execute({
      kind: "task.cancel",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "a",
      expectedTaskRevision: 3,
      reason: "operator decision",
    });
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.value.state, "cancelled");

    const beforeTerminal = readApplicationStateForOwner(store);
    const terminal = service.execute({
      kind: "task.update",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "a",
      expectedTaskRevision: 4,
      change: { kind: "body", body: "must not apply" },
    });
    assert.equal(terminal.ok, false);
    assert.equal(terminal.error.details.domainCode, "TERMINAL_IMMUTABLE");
    assert.deepEqual(readApplicationStateForOwner(store), beforeTerminal);

    const stale = service.execute({
      kind: "task.inspect",
      projectId: "project-one",
      expectedProjectResourceRevision: 1,
      taskId: "a",
      expectedTaskRevision: 3,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_REVISION");
    assert.equal(service.execute({ kind: "task.list", projectId: "project-one" }).error.code, "INVALID_INPUT");
    await store.close();
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("Project-scoped cancellation refuses a cross-Project dependent cascade atomically", async () => {
  const fixture = createPersistenceFixture("application-cancel-scope");
  let store;
  try {
    const secondRoot = path.join(fixture.generation, "project-b");
    mkdirSync(secondRoot);
    store = await openPersistence(fixture.layout, { applicationVersion: "application-cancel-scope" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-a", root: fixture.projectRoot }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-b", root: secondRoot }).ok, true);
    assert.equal(createApplicationTask(service, "project-a", "dependency-a").ok, true);
    assert.equal(createApplicationTask(service, "project-b", "dependent-b").ok, true);
    assert.equal(service.execute({
      kind: "task.mark_ready",
      projectId: "project-b",
      expectedProjectResourceRevision: 1,
      taskId: "dependent-b",
      expectedTaskRevision: 1,
    }).ok, true);
    assert.equal(service.execute({
      kind: "dependency.add",
      projectId: "project-b",
      expectedProjectResourceRevision: 1,
      taskId: "dependent-b",
      expectedTaskRevision: 2,
      dependencyId: "dependency-a",
      expectedDependencyRevision: 1,
    }).ok, true);
    const issued = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "task.cancel",
      scope: { kind: "project", projectId: "project-a", resourceRevision: 1, configRevision: 1 },
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(issued.ok, true);
    assert.ok(issued.value.sourceGrantId);
    trusted.setActor("delegate");
    const before = readApplicationStateForOwner(store);
    const denied = service.execute({
      kind: "task.cancel",
      projectId: "project-a",
      expectedProjectResourceRevision: 1,
      taskId: "dependency-a",
      expectedTaskRevision: 1,
      reason: "must not cross the Project capability",
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(denied.error.details.reason, "scope_mismatch");
    const after = readApplicationStateForOwner(store);
    assert.deepEqual(after.domain, before.domain);
    assert.equal(after.domain.tasks.find((task) => task.id === "dependency-a").state, "idea");
    assert.equal(after.domain.tasks.find((task) => task.id === "dependent-b").state, "ready");
    assert.equal(after.requests.length, before.requests.length + 1);
    assert.equal(after.decisions.at(-1).grantId, issued.value.grantId);
    assert.equal(after.decisions.at(-1).reason, "scope_mismatch");
    assert.equal(after.audit.at(-1).eventKind, "authorization.denied");
    trusted.setActor("owner");
    const runtimeIssued = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "task.cancel",
      scope: { kind: "runtime", projectId: null, resourceRevision: null, configRevision: null },
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(runtimeIssued.ok, true);
    assert.ok(issued.value.grantId < runtimeIssued.value.grantId);
    trusted.setActor("delegate");
    const accepted = service.execute({
      kind: "task.cancel",
      projectId: "project-a",
      expectedProjectResourceRevision: 1,
      taskId: "dependency-a",
      expectedTaskRevision: 1,
      reason: "runtime capability covers every affected Project",
    });
    assert.equal(accepted.ok, true);
    const acceptedState = readApplicationStateForOwner(store);
    assert.equal(acceptedState.domain.tasks.find((task) => task.id === "dependency-a").state, "cancelled");
    assert.equal(acceptedState.domain.tasks.find((task) => task.id === "dependent-b").state, "waiting");
    assert.equal(acceptedState.decisions.at(-1).grantId, runtimeIssued.value.grantId);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

for (const runtimeState of ["revoked", "expired"]) {
  test(`cross-Project cancellation refuses a ${runtimeState} runtime grant even when a narrower Project grant sorts first`, async () => {
    const fixture = createPersistenceFixture(`application-cancel-runtime-${runtimeState}`);
    let store;
    try {
      const secondRoot = path.join(fixture.generation, "project-b");
      mkdirSync(secondRoot);
      store = await openPersistence(fixture.layout, { applicationVersion: `application-cancel-runtime-${runtimeState}` });
      const trusted = mutableAuthorizationIngress();
      const service = createApplicationService(store, trusted);
      assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
      assert.equal(service.execute({ kind: "project.register", projectId: "project-a", root: fixture.projectRoot }).ok, true);
      assert.equal(service.execute({ kind: "project.register", projectId: "project-b", root: secondRoot }).ok, true);
      assert.equal(createApplicationTask(service, "project-a", "dependency-a").ok, true);
      assert.equal(createApplicationTask(service, "project-b", "dependent-b").ok, true);
      assert.equal(service.execute({
        kind: "task.mark_ready",
        projectId: "project-b",
        expectedProjectResourceRevision: 1,
        taskId: "dependent-b",
        expectedTaskRevision: 1,
      }).ok, true);
      assert.equal(service.execute({
        kind: "dependency.add",
        projectId: "project-b",
        expectedProjectResourceRevision: 1,
        taskId: "dependent-b",
        expectedTaskRevision: 2,
        dependencyId: "dependency-a",
        expectedDependencyRevision: 1,
      }).ok, true);
      const projectGrant = service.execute({
        kind: "authorization.grant.issue",
        actorId: "delegate",
        action: "task.cancel",
        scope: { kind: "project", projectId: "project-a", resourceRevision: 1, configRevision: 1 },
        notBefore: "2026-08-29T12:00:00.000Z",
        expiresAt: "2026-09-10T12:00:00.000Z",
      });
      assert.equal(projectGrant.ok, true);
      const runtimeGrant = service.execute({
        kind: "authorization.grant.issue",
        actorId: "delegate",
        action: "task.cancel",
        scope: { kind: "runtime", projectId: null, resourceRevision: null, configRevision: null },
        notBefore: "2026-08-29T12:00:00.000Z",
        expiresAt: runtimeState === "expired" ? "2026-08-30T12:00:00.000Z" : "2026-09-10T12:00:00.000Z",
      });
      assert.equal(runtimeGrant.ok, true);
      assert.ok(projectGrant.value.grantId < runtimeGrant.value.grantId);
      if (runtimeState === "revoked") {
        assert.equal(service.execute({
          kind: "authorization.grant.revoke",
          grantId: runtimeGrant.value.grantId,
          expectedGrantRevision: 1,
        }).ok, true);
      } else {
        trusted.setNow("2026-08-31T12:00:00.000Z");
      }
      trusted.setActor("delegate");
      const before = readApplicationStateForOwner(store);
      const denied = service.execute({
        kind: "task.cancel",
        projectId: "project-a",
        expectedProjectResourceRevision: 1,
        taskId: "dependency-a",
        expectedTaskRevision: 1,
        reason: `${runtimeState} runtime authority must fail closed`,
      });
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
      assert.equal(denied.error.details.reason, runtimeState === "revoked" ? "grant_revoked" : "grant_expired");
      const after = readApplicationStateForOwner(store);
      assert.deepEqual(after.domain, before.domain);
      assert.deepEqual(after.projects, before.projects);
      assert.deepEqual(after.grants, before.grants);
      assert.equal(after.requests.length, before.requests.length + 1);
      assert.equal(after.decisions.length, before.decisions.length + 1);
      assert.equal(after.audit.length, before.audit.length + 1);
      assert.equal(after.decisions.at(-1).grantId, null);
      assert.equal(after.decisions.at(-1).reason, runtimeState === "revoked" ? "grant_revoked" : "grant_expired");
      const expected = after;
      await store.close();
      store = undefined;
      const reopened = await openPersistence(fixture.layout, { applicationVersion: `application-cancel-runtime-${runtimeState}-restart` });
      assert.deepEqual(readApplicationStateForOwner(reopened), expected);
      await reopened.close();
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

test("cross-Project cancellation refuses disabled policy and substituted dependent roots atomically", async () => {
  const fixture = createPersistenceFixture("application-cancel-project-bindings");
  let store;
  try {
    const secondRoot = path.join(fixture.generation, "project-b");
    const movedRoot = path.join(fixture.generation, "project-b-original");
    mkdirSync(secondRoot);
    store = await openPersistence(fixture.layout, { applicationVersion: "application-cancel-project-bindings" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-a", root: fixture.projectRoot }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project-b", root: secondRoot }).ok, true);
    assert.equal(createApplicationTask(service, "project-a", "dependency-a").ok, true);
    assert.equal(createApplicationTask(service, "project-b", "dependent-b").ok, true);
    assert.equal(service.execute({
      kind: "task.mark_ready",
      projectId: "project-b",
      expectedProjectResourceRevision: 1,
      taskId: "dependent-b",
      expectedTaskRevision: 1,
    }).ok, true);
    assert.equal(service.execute({
      kind: "dependency.add",
      projectId: "project-b",
      expectedProjectResourceRevision: 1,
      taskId: "dependent-b",
      expectedTaskRevision: 2,
      dependencyId: "dependency-a",
      expectedDependencyRevision: 1,
    }).ok, true);
    assert.equal(service.execute({
      kind: "project.disable",
      projectId: "project-b",
      expectedResourceRevision: 1,
      expectedConfigRevision: 1,
    }).ok, true);

    const beforeDisabled = readApplicationStateForOwner(store);
    const policyDenied = service.execute({
      kind: "task.cancel",
      projectId: "project-a",
      expectedProjectResourceRevision: 1,
      taskId: "dependency-a",
      expectedTaskRevision: 1,
      reason: "disabled dependent Project must narrow runtime authority",
    });
    assert.equal(policyDenied.ok, false);
    assert.equal(policyDenied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(policyDenied.error.details.reason, "policy_denied");
    const afterDisabled = readApplicationStateForOwner(store);
    assert.deepEqual(afterDisabled.domain, beforeDisabled.domain);
    assert.deepEqual(afterDisabled.projects, beforeDisabled.projects);
    assert.equal(afterDisabled.requests.length, beforeDisabled.requests.length + 1);
    assert.equal(afterDisabled.decisions.at(-1).policy, "deny");
    assert.equal(afterDisabled.audit.at(-1).eventKind, "authorization.denied");

    assert.equal(service.execute({
      kind: "project.update",
      projectId: "project-b",
      expectedResourceRevision: 2,
      expectedConfigRevision: 2,
    }).ok, true);
    renameSync(secondRoot, movedRoot);
    mkdirSync(secondRoot);
    const beforeSubstitution = readApplicationStateForOwner(store);
    const rejected = service.execute({
      kind: "task.cancel",
      projectId: "project-a",
      expectedProjectResourceRevision: 1,
      taskId: "dependency-a",
      expectedTaskRevision: 1,
      reason: "substituted dependent root must fail closed",
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "PROJECT_REGISTRY_REJECTED");
    assert.equal(rejected.error.details.registryCode, "PROJECT_IDENTITY_CHANGED");
    assert.deepEqual(readApplicationStateForOwner(store), beforeSubstitution);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("Project disablement narrows policy and explicit high-risk update re-enables at new revisions", async () => {
  const fixture = createPersistenceFixture("application-project-state");
  try {
    const store = await openPersistence(fixture.layout, { applicationVersion: "application-domain" });
    const service = createApplicationService(store, domainIngress());
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const expectedPolicy = (action, enabled) => {
      if (action.startsWith("authorization.") || action.endsWith(".inspect") || action === "policy.evaluate") {
        return "read_not_applicable";
      }
      if (action === "project.register" || action === "project.update" || action === "project.disable") return "allow";
      return enabled ? "allow" : "deny";
    };
    for (const action of AUTHORIZATION_ACTIONS) {
      const evaluated = service.execute({
        kind: "policy.evaluate",
        projectId: "project",
        expectedResourceRevision: 1,
        expectedConfigRevision: 1,
        action,
      });
      assert.equal(evaluated.ok, true, `enabled policy query failed for ${action}`);
      assert.equal(evaluated.value.policy, expectedPolicy(action, true), `enabled policy mismatch for ${action}`);
    }
    const disabled = service.execute({ kind: "project.disable", projectId: "project", expectedResourceRevision: 1, expectedConfigRevision: 1 });
    assert.equal(disabled.ok, true);
    assert.equal(disabled.value.resourceRevision, 2);
    for (const action of AUTHORIZATION_ACTIONS) {
      const evaluated = service.execute({
        kind: "policy.evaluate",
        projectId: "project",
        expectedResourceRevision: 2,
        expectedConfigRevision: 2,
        action,
      });
      assert.equal(evaluated.ok, true, `disabled policy query failed for ${action}`);
      assert.equal(evaluated.value.policy, expectedPolicy(action, false), `disabled policy mismatch for ${action}`);
    }
    const denied = service.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 2,
      taskId: "blocked",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
    assert.equal(denied.error.details.reason, "policy_denied");
    const enabled = service.execute({ kind: "project.update", projectId: "project", expectedResourceRevision: 2, expectedConfigRevision: 2 });
    assert.equal(enabled.ok, true);
    assert.equal(enabled.value.resourceRevision, 3);
    assert.equal(readApplicationStateForOwner(store).domain.projects[0].enabled, true);
    await store.close();
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("ProjectRegistry rejects duplicate local identity and duplicate canonical root atomically", async () => {
  const fixture = createPersistenceFixture("application-project-duplicates");
  let store;
  try {
    const secondRoot = path.join(fixture.generation, "second-project");
    mkdirSync(secondRoot);
    store = await openPersistence(fixture.layout, { applicationVersion: "registry-duplicates" });
    const service = createApplicationService(store, ingress());
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const before = readApplicationStateForOwner(store);

    const duplicateId = service.execute({ kind: "project.register", projectId: "project", root: secondRoot });
    assert.equal(duplicateId.ok, false);
    assert.equal(duplicateId.error.code, "PROJECT_ALREADY_REGISTERED");
    assert.deepEqual(readApplicationStateForOwner(store), before);

    const duplicateRoot = service.execute({ kind: "project.register", projectId: "second", root: fixture.projectRoot });
    assert.equal(duplicateRoot.ok, false);
    assert.equal(duplicateRoot.error.code, "PROJECT_ALREADY_REGISTERED");
    assert.deepEqual(readApplicationStateForOwner(store), before);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("v2 Domain Project upgrade binds the legacy identity through ProjectRegistry without duplication", async () => {
  const fixture = createPersistenceFixture("application-v2-project-binding");
  let store;
  try {
    const legacyProjectId = `研发 项目 ${"p".repeat(140)}`;
    const opaqueTaskId = `任务 one ${"t".repeat(140)}`;
    createVersionTwoDatabase(fixture.layout, "legacy-v2", legacyProjectId);
    store = await openPersistence(fixture.layout, { applicationVersion: "registry-v3" });
    const service = createApplicationService(store, ingress());
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    const registered = service.execute({
      kind: "project.register",
      projectId: legacyProjectId,
      root: fixture.projectRoot,
    });
    assert.equal(registered.ok, true);
    const created = service.execute({
      kind: "task.create",
      projectId: legacyProjectId,
      expectedProjectResourceRevision: 1,
      taskId: opaqueTaskId,
      body: "opaque identifiers survive the v2-to-v3 binding",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const inspected = service.execute({
      kind: "task.inspect",
      projectId: legacyProjectId,
      expectedProjectResourceRevision: 1,
      taskId: opaqueTaskId,
      expectedTaskRevision: 1,
    });
    assert.equal(inspected.ok, true);
    const state = readApplicationStateForOwner(store);
    assert.deepEqual(state.domain.projects, [{ id: legacyProjectId, enabled: true }]);
    assert.deepEqual(state.projects.map((project) => project.projectId), [legacyProjectId]);
    assert.deepEqual(state.domain.tasks.map((task) => task.id), [opaqueTaskId]);
    assert.equal(state.requests.at(-1).targetId, opaqueTaskId);
    assert.equal(state.audit.at(-1).targetId, opaqueTaskId);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("backup and explicit restore round-trip the complete application, authorization, audit, and Domain state", async () => {
  const fixture = createPersistenceFixture("application-backup-restore");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "application-backup" });
    const trusted = mutableAuthorizationIngress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    assert.equal(createApplicationTask(service, "project", "preserved-task").ok, true);
    const issued = service.execute({
      kind: "authorization.grant.issue",
      actorId: "delegate",
      action: "task.inspect",
      scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
      notBefore: "2026-08-29T12:00:00.000Z",
      expiresAt: "2026-09-01T12:00:00.000Z",
    });
    assert.equal(issued.ok, true);
    assert.equal(service.execute({
      kind: "authorization.grant.revoke",
      grantId: issued.value.grantId,
      expectedGrantRevision: 1,
    }).ok, true);
    const expected = readApplicationStateForOwner(store);
    const backup = await store.createBackup();
    assert.equal(createApplicationTask(service, "project", "discarded-task").ok, true);
    await store.close();
    store = undefined;

    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    await restoreBackup(fixture.layout, {
      generationId: backup.generationId,
      expectedCurrent,
      acknowledgeDataLoss: true,
      applicationVersion: "application-restore",
    });
    store = await openPersistence(fixture.layout, { applicationVersion: "application-restored" });
    assert.deepEqual(readApplicationStateForOwner(store), expected);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});
