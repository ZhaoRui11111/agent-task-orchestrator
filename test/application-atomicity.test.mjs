import assert from "node:assert/strict";
import { mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApplicationService, openPersistence } from "../src/index.ts";
import { createApplicationServiceWithHooks } from "../src/application.ts";
import { readApplicationStateForOwner } from "../src/persistence/application-repository.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  createVersionThreeDatabase,
} from "./persistence-test-helpers.mjs";

const TEST_PRINCIPAL_SHA256 = "A".repeat(64);

function ingress(label = "atomic") {
  let sequence = 0;
  return {
    currentActor: () => ({ actorId: "atomic-actor", principal: TEST_PRINCIPAL_SHA256 }),
    now: () => "2026-08-29T12:00:00.000Z",
    nextId: (kind) => `${kind}-${label}-${++sequence}`,
    confirmHighRisk: () => true,
  };
}

function expectFailpoint(error, stage) {
  assert.equal(error?.name, "PersistenceError");
  assert.equal(error?.cause?.message, `failpoint:${stage}`);
  return true;
}

async function expectApplicationOperationRollback(label, stage, prepare) {
  const fixture = createPersistenceFixture(`${label}-${stage}`);
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "atomic" });
    const trusted = ingress(label);
    const setup = createApplicationService(store, trusted);
    assert.equal(setup.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    const command = prepare(setup, fixture);
    const before = readApplicationStateForOwner(store);
    const service = createApplicationServiceWithHooks(store, trusted, {
      afterStage(current) {
        if (current === stage) throw new Error(`failpoint:${stage}`);
      },
    });
    assert.throws(() => service.execute(command), (error) => expectFailpoint(error, stage));
    assert.deepEqual(readApplicationStateForOwner(store), before);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
}

const bootstrapStages = [
  "request",
  "bootstrap",
  ...[
    "authorization.grant.issue", "authorization.grant.inspect", "authorization.grant.revoke",
    "policy.evaluate", "project.register", "project.update", "project.disable", "project.inspect",
    "task.create", "task.update", "task.mark_ready", "task.cancel", "task.inspect",
    "dependency.add", "dependency.remove", "authorization.grant.list", "runtime.status",
    "runtime.backup", "runtime.restore",
  ].map((action) => `grant:${action}`),
  "audit",
];

for (const stage of bootstrapStages) {
  test(`bootstrap failpoint after ${stage} rolls back request, bootstrap, grants, and audit`, async () => {
    const fixture = createPersistenceFixture(`bootstrap-${stage.replaceAll(/[^a-z]/gu, "-")}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "atomic" });
      const service = createApplicationServiceWithHooks(store, ingress(), {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      assert.throws(
        () => service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }),
        (error) => expectFailpoint(error, stage),
      );
      const state = readApplicationStateForOwner(store);
      assert.equal(state.bootstrap, null);
      assert.deepEqual(state.grants, []);
      assert.deepEqual(state.requests, []);
      assert.deepEqual(state.decisions, []);
      assert.deepEqual(state.audit, []);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

const renewalStages = [
  "request",
  "epoch",
  ...[
    "authorization.grant.issue", "authorization.grant.inspect", "authorization.grant.revoke",
    "policy.evaluate", "project.register", "project.update", "project.disable", "project.inspect",
    "task.create", "task.update", "task.mark_ready", "task.cancel", "task.inspect",
    "dependency.add", "dependency.remove", "authorization.grant.list", "runtime.status",
    "runtime.backup", "runtime.restore",
  ].map((action) => `grant:${action}`),
  "decision",
  "audit",
];

for (const stage of renewalStages) {
  test(`capability renewal failpoint after ${stage} leaves the prior origin exact`, async () => {
    const fixture = createPersistenceFixture(`renewal-${stage.replaceAll(/[^a-z]/gu, "-")}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "atomic-renewal" });
      const trusted = ingress(`renewal-${stage}`);
      const setup = createApplicationService(store, trusted);
      assert.equal(setup.bootstrap({
        kind: "authorization.bootstrap",
        expiresAt: "2026-09-04T12:00:00.000Z",
      }).ok, true);
      const before = readApplicationStateForOwner(store);
      const service = createApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      assert.throws(() => service.renew({
        kind: "authorization.capability.renew",
        expiresAt: "2026-09-20T12:00:00.000Z",
      }), (error) => expectFailpoint(error, stage));
      assert.deepEqual(readApplicationStateForOwner(store), before);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

for (const stage of ["request", "identity", "epoch", "grant:runtime.restore", "decision", "audit"]) {
  test(`legacy adoption failpoint after ${stage} leaves no local identity or epoch`, async () => {
    const fixture = createPersistenceFixture(`adoption-${stage.replaceAll(/[^a-z]/gu, "-")}`);
    let store;
    try {
      createVersionThreeDatabase(fixture.layout);
      store = await openPersistence(fixture.layout, { applicationVersion: "atomic-adoption" });
      const trusted = ingress(`adoption-${stage}`);
      const before = readApplicationStateForOwner(store);
      const service = createApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      assert.throws(() => service.renew({
        kind: "authorization.capability.renew",
        expiresAt: "2026-09-20T12:00:00.000Z",
      }), (error) => expectFailpoint(error, stage));
      assert.deepEqual(readApplicationStateForOwner(store), before);
      assert.equal(readApplicationStateForOwner(store).identity, null);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

test("a competing capability renewal wins once and makes the stale preflight a no-write rejection", async () => {
  const fixture = createPersistenceFixture("renewal-cas-winner");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "atomic-renewal-cas" });
    const trusted = ingress("renewal-cas");
    const winner = createApplicationService(store, trusted);
    assert.equal(winner.bootstrap({
      kind: "authorization.bootstrap",
      expiresAt: "2026-09-04T12:00:00.000Z",
    }).ok, true);
    let competitorResult;
    const stale = createApplicationServiceWithHooks(store, trusted, {
      beforeTransaction() {
        competitorResult = winner.renew({
          kind: "authorization.capability.renew",
          expiresAt: "2026-09-20T12:00:00.000Z",
        });
      },
    }).renew({
      kind: "authorization.capability.renew",
      expiresAt: "2026-09-21T12:00:00.000Z",
    });
    assert.equal(competitorResult.ok, true);
    assert.equal(stale.ok, false);
    assert.equal(stale.error.code, "STALE_REVISION");
    const state = readApplicationStateForOwner(store);
    assert.equal(state.epochs.length, 1);
    assert.equal(state.grants.length, 38);
    assert.equal(state.requests.filter((request) => request.action === "authorization.capability.renew").length, 1);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

for (const stage of ["request", "decision", "audit", "lifecycle"]) {
  test(`lifecycle authorization failpoint after ${stage} leaves no backup handoff fragment`, async () => {
    await expectApplicationOperationRollback("lifecycle-backup", stage, () => ({
      kind: "runtime.backup",
      backupGenerationId: "11111111-1111-4111-8111-111111111111",
    }));
  });
}

for (const stage of ["request", "domain", "decision", "audit"]) {
  test(`accepted Task mutation failpoint after ${stage} leaves no partial operation shape`, async () => {
    const fixture = createPersistenceFixture(`task-atomic-${stage}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "atomic" });
      const trusted = ingress();
      const setup = createApplicationService(store, trusted);
      assert.equal(setup.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
      assert.equal(setup.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
      const before = readApplicationStateForOwner(store);
      const service = createApplicationServiceWithHooks(store, trusted, {
        afterStage(current) {
          if (current === stage) throw new Error(`failpoint:${stage}`);
        },
      });
      assert.throws(() => service.execute({
        kind: "task.create",
        projectId: "project",
        expectedProjectResourceRevision: 1,
        taskId: "task",
        body: "body",
        supersedesTaskId: null,
      }), (error) => expectFailpoint(error, stage));
      assert.deepEqual(readApplicationStateForOwner(store), before);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

for (const stage of ["request", "domain", "registry", "decision", "audit"]) {
  test(`Project registration failpoint after ${stage} leaves no Domain, registry, decision, or audit fragment`, async () => {
    await expectApplicationOperationRollback("project-register", stage, (_service, fixture) => ({
      kind: "project.register",
      projectId: "project",
      root: fixture.projectRoot,
    }));
  });
}

for (const stage of ["request", "grant", "decision", "audit"]) {
  test(`grant issue failpoint after ${stage} leaves no capability or operation fragment`, async () => {
    await expectApplicationOperationRollback("grant-issue", stage, (service, fixture) => {
      assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
      return {
        kind: "authorization.grant.issue",
        actorId: "delegate",
        action: "task.create",
        scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
        notBefore: "2026-08-29T12:00:00.000Z",
        expiresAt: "2026-09-01T12:00:00.000Z",
      };
    });
  });

  test(`grant revocation failpoint after ${stage} preserves the exact live grant`, async () => {
    await expectApplicationOperationRollback("grant-revoke", stage, (service, fixture) => {
      assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
      const issued = service.execute({
        kind: "authorization.grant.issue",
        actorId: "delegate",
        action: "task.create",
        scope: { kind: "project", projectId: "project", resourceRevision: 1, configRevision: 1 },
        notBefore: "2026-08-29T12:00:00.000Z",
        expiresAt: "2026-09-01T12:00:00.000Z",
      });
      assert.equal(issued.ok, true);
      return {
        kind: "authorization.grant.revoke",
        grantId: issued.value.grantId,
        expectedGrantRevision: 1,
      };
    });
  });
}

for (const stage of ["request", "decision", "audit"]) {
  test(`Project query failpoint after ${stage} leaves no partial query audit shape`, async () => {
    await expectApplicationOperationRollback("project-query", stage, (service, fixture) => {
      assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
      return { kind: "project.inspect", projectId: "project", expectedResourceRevision: 1 };
    });
  });
}

test("fully bound authorization denial appends only one deny request, decision, and audit", async () => {
  const fixture = createPersistenceFixture("application-deny-shape");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "atomic" });
    const trusted = ingress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const before = readApplicationStateForOwner(store);
    let outsiderSequence = 0;
    const outsider = createApplicationService(store, {
      currentActor: () => ({ actorId: "outsider", principal: TEST_PRINCIPAL_SHA256 }),
      now: () => "2026-08-29T12:00:00.000Z",
      nextId: (kind) => `${kind}-outsider-${++outsiderSequence}`,
      confirmHighRisk: () => true,
    });
    const denied = outsider.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "task",
      body: "body",
      supersedesTaskId: null,
    });
    assert.equal(denied.ok, false);
    const after = readApplicationStateForOwner(store);
    assert.deepEqual(after.domain, before.domain);
    assert.deepEqual(after.projects, before.projects);
    assert.deepEqual(after.grants, before.grants);
    assert.equal(after.requests.length, before.requests.length + 1);
    assert.equal(after.decisions.length, before.decisions.length + 1);
    assert.equal(after.audit.length, before.audit.length + 1);
    assert.equal(after.requests.at(-1).result, "deny");
    assert.equal(after.audit.at(-1).eventKind, "authorization.denied");
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("request replay rolls back and append-only request, decision, and audit rows reject mutation", async () => {
  const fixture = createPersistenceFixture("application-replay");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "atomic" });
    const trusted = ingress();
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const beforeReplay = readApplicationStateForOwner(store);
    const replay = createApplicationService(store, {
      currentActor: () => ({ actorId: "atomic-actor", principal: TEST_PRINCIPAL_SHA256 }),
      now: () => "2026-08-29T12:00:00.000Z",
      nextId: (kind) => ({
        request: "request-atomic-24",
        correlation: "correlation-replay",
        decision: "decision-replay",
        audit: "audit-replay",
        grant: "grant-replay",
      })[kind],
      confirmHighRisk: () => true,
    });
    assert.throws(() => replay.execute({
      kind: "project.inspect",
      projectId: "project",
      expectedResourceRevision: 1,
    }), (error) => error?.name === "PersistenceError");
    assert.deepEqual(readApplicationStateForOwner(store), beforeReplay);
    await store.close();
    store = undefined;

    const database = new DatabaseSync(fixture.layout.databasePath);
    database.exec("PRAGMA foreign_keys=ON");
    for (const sql of [
      "UPDATE application_requests SET actor_id='changed'",
      "DELETE FROM application_requests",
      "UPDATE authorization_decisions SET result='deny'",
      "DELETE FROM authorization_decisions",
      "UPDATE application_audit SET reason='changed'",
      "DELETE FROM application_audit",
    ]) {
      assert.throws(() => database.exec(sql), /append-only/u);
    }
    database.close();
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("high-risk confirmation runs before the authoritative writer transaction", async () => {
  const fixture = createPersistenceFixture("confirmation-outside-transaction");
  let primary;
  let competitor;
  try {
    let sequence = 0;
    let confirmationOperation = null;
    let confirmationResult = null;
    const primaryIngress = {
      currentActor: () => ({ actorId: "owner", principal: TEST_PRINCIPAL_SHA256 }),
      now: () => "2026-08-29T12:00:00.000Z",
      nextId: (kind) => `${kind}-primary-${++sequence}`,
      confirmHighRisk(request) {
        if (request.action === "project.disable" && confirmationOperation !== null) {
          confirmationResult = confirmationOperation();
        }
        return true;
      },
    };
    primary = await openPersistence(fixture.layout, { applicationVersion: "confirmation-primary" });
    const service = createApplicationService(primary, primaryIngress);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);

    competitor = await openPersistence(fixture.layout, { applicationVersion: "confirmation-competitor" });
    let competitorSequence = 0;
    const competingService = createApplicationService(competitor, {
      currentActor: () => ({ actorId: "owner", principal: TEST_PRINCIPAL_SHA256 }),
      now: () => "2026-08-29T12:00:00.000Z",
      nextId: (kind) => `${kind}-confirmation-competitor-${++competitorSequence}`,
      confirmHighRisk: () => true,
    });
    confirmationOperation = () => competingService.execute({
      kind: "project.inspect",
      projectId: "project",
      expectedResourceRevision: 1,
    });
    const disabled = service.execute({
      kind: "project.disable",
      projectId: "project",
      expectedResourceRevision: 1,
      expectedConfigRevision: 1,
    });
    assert.equal(confirmationResult?.ok, true);
    assert.equal(disabled.ok, true);
    assert.equal(readApplicationStateForOwner(primary).domain.projects[0].enabled, false);
  } finally {
    if (competitor) await competitor.close();
    if (primary) await primary.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("registered Project identity is revalidated after confirmation and before the writer transaction", async () => {
  const fixture = createPersistenceFixture("project-revalidate-after-confirmation");
  let store;
  try {
    let sequence = 0;
    let replaceDuringConfirmation = false;
    const moved = path.join(fixture.generation, "project-before-confirmation");
    const trusted = {
      currentActor: () => ({ actorId: "owner", principal: TEST_PRINCIPAL_SHA256 }),
      now: () => "2026-08-29T12:00:00.000Z",
      nextId: (kind) => `${kind}-revalidate-${++sequence}`,
      confirmHighRisk(request) {
        if (replaceDuringConfirmation && request.action === "project.update") {
          renameSync(fixture.projectRoot, moved);
          mkdirSync(fixture.projectRoot);
        }
        return true;
      },
    };
    store = await openPersistence(fixture.layout, { applicationVersion: "revalidate" });
    const service = createApplicationService(store, trusted);
    assert.equal(service.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const before = readApplicationStateForOwner(store);
    replaceDuringConfirmation = true;
    const rejected = service.execute({
      kind: "project.update",
      projectId: "project",
      expectedResourceRevision: 1,
      expectedConfigRevision: 1,
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, "PROJECT_REGISTRY_REJECTED");
    assert.equal(rejected.error.details.registryCode, "PROJECT_IDENTITY_CHANGED");
    assert.deepEqual(readApplicationStateForOwner(store), before);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

for (const raceKind of ["affected-set", "affected-project-revision"]) {
  test(`cross-Project cancellation turns a competing ${raceKind} change into a durable typed denial`, async () => {
    const fixture = createPersistenceFixture(`cancel-${raceKind}-race`);
    let primary;
    let competitor;
    try {
      const secondRoot = path.join(fixture.generation, "project-b");
      mkdirSync(secondRoot);
      primary = await openPersistence(fixture.layout, { applicationVersion: `cancel-${raceKind}-primary` });
      const trusted = ingress(`cancel-${raceKind}-primary`);
      const setup = createApplicationService(primary, trusted);
      assert.equal(setup.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
      assert.equal(setup.execute({ kind: "project.register", projectId: "project-a", root: fixture.projectRoot }).ok, true);
      assert.equal(setup.execute({ kind: "project.register", projectId: "project-b", root: secondRoot }).ok, true);
      assert.equal(setup.execute({
        kind: "task.create",
        projectId: "project-a",
        expectedProjectResourceRevision: 1,
        taskId: "dependency-a",
        body: "dependency",
        supersedesTaskId: null,
      }).ok, true);
      assert.equal(setup.execute({
        kind: "task.create",
        projectId: "project-b",
        expectedProjectResourceRevision: 1,
        taskId: "dependent-b",
        body: "dependent",
        supersedesTaskId: null,
      }).ok, true);
      assert.equal(setup.execute({
        kind: "task.mark_ready",
        projectId: "project-b",
        expectedProjectResourceRevision: 1,
        taskId: "dependent-b",
        expectedTaskRevision: 1,
      }).ok, true);
      assert.equal(setup.execute({
        kind: "dependency.add",
        projectId: "project-b",
        expectedProjectResourceRevision: 1,
        taskId: "dependent-b",
        expectedTaskRevision: 2,
        dependencyId: "dependency-a",
        expectedDependencyRevision: 1,
      }).ok, true);

      competitor = await openPersistence(fixture.layout, { applicationVersion: `cancel-${raceKind}-competitor` });
      const competingService = createApplicationService(competitor, ingress(`cancel-${raceKind}-competitor`));
      let competingWrite = null;
      let competingResult = null;
      let afterCompeting = null;
      const racingService = createApplicationServiceWithHooks(primary, trusted, {
        beforeTransaction() {
          if (competingWrite === null) return;
          const operation = competingWrite;
          competingWrite = null;
          competingResult = operation();
          afterCompeting = readApplicationStateForOwner(competitor);
        },
      });
      competingWrite = raceKind === "affected-set"
        ? () => competingService.execute({
          kind: "dependency.remove",
          projectId: "project-b",
          expectedProjectResourceRevision: 1,
          taskId: "dependent-b",
          expectedTaskRevision: 3,
          dependencyId: "dependency-a",
          expectedDependencyRevision: 1,
        })
        : () => competingService.execute({
          kind: "project.update",
          projectId: "project-b",
          expectedResourceRevision: 1,
          expectedConfigRevision: 1,
        });

      const denied = racingService.execute({
        kind: "task.cancel",
        projectId: "project-a",
        expectedProjectResourceRevision: 1,
        taskId: "dependency-a",
        expectedTaskRevision: 1,
        reason: "competing writer must fail closed",
      });
      assert.equal(competingResult?.ok, true);
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, "AUTHORIZATION_DENIED");
      assert.equal(denied.error.details.reason, "scope_revision_stale");
      const after = readApplicationStateForOwner(primary);
      assert.deepEqual(after.domain, afterCompeting.domain);
      assert.deepEqual(after.projects, afterCompeting.projects);
      assert.deepEqual(after.grants, afterCompeting.grants);
      assert.equal(after.requests.length, afterCompeting.requests.length + 1);
      assert.equal(after.decisions.length, afterCompeting.decisions.length + 1);
      assert.equal(after.audit.length, afterCompeting.audit.length + 1);
      const denialDecision = after.decisions.at(-1);
      assert.equal(denialDecision.reason, "scope_revision_stale");
      assert.equal(denialDecision.grantId, null);
      assert.equal(after.audit.at(-1).eventKind, "authorization.denied");
      assert.equal(after.domain.tasks.find((task) => task.id === "dependency-a").state, "idea");
      if (raceKind === "affected-set") {
        assert.equal(after.domain.tasks.find((task) => task.id === "dependent-b").state, "ready");
        assert.deepEqual(after.domain.tasks.find((task) => task.id === "dependent-b").dependencyIds, []);
      } else {
        assert.equal(after.domain.tasks.find((task) => task.id === "dependent-b").state, "ready");
        assert.deepEqual(after.domain.tasks.find((task) => task.id === "dependent-b").dependencyIds, ["dependency-a"]);
        assert.equal(after.projects.find((project) => project.projectId === "project-b").resourceRevision, 2);
      }
      await competitor.close();
      competitor = undefined;
      await primary.close();
      primary = undefined;
      const reopened = await openPersistence(fixture.layout, { applicationVersion: `cancel-${raceKind}-restart` });
      assert.deepEqual(readApplicationStateForOwner(reopened), after);
      await reopened.close();
    } finally {
      if (competitor) await competitor.close();
      if (primary) await primary.close();
      cleanupPersistenceFixture(fixture);
    }
  });
}

test("a competing application writer cannot leave a partial request or snapshot", async () => {
  const fixture = createPersistenceFixture("application-competing-writer");
  let primary;
  let competitor;
  try {
    primary = await openPersistence(fixture.layout, { applicationVersion: "atomic-primary" });
    const trusted = ingress();
    const setup = createApplicationService(primary, trusted);
    assert.equal(setup.bootstrap({ kind: "authorization.bootstrap", expiresAt: "2026-09-20T12:00:00.000Z" }).ok, true);
    assert.equal(setup.execute({ kind: "project.register", projectId: "project", root: fixture.projectRoot }).ok, true);
    const before = readApplicationStateForOwner(primary);

    competitor = await openPersistence(fixture.layout, { applicationVersion: "atomic-competitor" });
    const competingService = createApplicationService(competitor, ingress("competitor"));
    let competingError;
    const winningService = createApplicationServiceWithHooks(primary, trusted, {
      afterStage(stage) {
        if (stage !== "request") return;
        try {
          competingService.execute({
            kind: "task.create",
            projectId: "project",
            expectedProjectResourceRevision: 1,
            taskId: "loser",
            body: "must not commit",
            supersedesTaskId: null,
          });
        } catch (error) {
          competingError = error;
        }
      },
    });
    const winner = winningService.execute({
      kind: "task.create",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "winner",
      body: "committed",
      supersedesTaskId: null,
    });
    assert.equal(winner.ok, true);
    assert.equal(competingError?.name, "PersistenceError");
    assert.equal(competingError?.code, "BUSY");
    const after = readApplicationStateForOwner(primary);
    assert.deepEqual(after.domain.tasks.map((task) => task.id), ["winner"]);
    assert.equal(after.requests.length, before.requests.length + 1);
    assert.equal(after.decisions.length, before.decisions.length + 1);
    assert.equal(after.audit.length, before.audit.length + 1);
  } finally {
    if (competitor) await competitor.close();
    if (primary) await primary.close();
    cleanupPersistenceFixture(fixture);
  }
});
