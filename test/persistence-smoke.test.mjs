import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createDomainSnapshot,
  createApplicationService,
  createTask,
  inspectPrimaryIdentity,
  openPersistence,
  prepareRuntimeLayout,
  restoreBackup,
} from "../src/index.ts";
import {
  commitDomainForOwner,
  initializeDomainForOwner,
  readDomainForOwner,
} from "../src/persistence/application-repository.ts";
import { createOwnedGeneration, removeOwnedGeneration } from "../scripts/repo-utils.mjs";
import { authorizeTestLifecycle, createAuthorizedTestBackup } from "./persistence-test-helpers.mjs";

function fixture() {
  const generation = createOwnedGeneration("persistence-smoke");
  const sourceCheckoutRoot = path.join(generation, "source");
  const projectRoot = path.join(generation, "project");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(projectRoot);
  const layout = prepareRuntimeLayout({
    runtimeRoot: path.join(generation, "runtime"),
    sourceCheckoutRoot,
    projectRoots: [projectRoot],
  });
  return { generation, layout, projectRoot };
}

test("persistence foundation round-trips, backs up, and restores Domain Core state", async () => {
  const { generation, layout, projectRoot } = fixture();
  let store;
  try {
    store = await openPersistence(layout, { applicationVersion: "test" });
    assert.deepEqual(store.migration.appliedVersions, [1]);
    assert.equal(store.migration.createdFresh, true);
    const initial = createDomainSnapshot({ projects: [{ id: "project", enabled: true }], tasks: [] });
    assert.equal(initial.ok, true);
    const initialized = initializeDomainForOwner(store, initial.value);
    const created = createTask(initialized, {
      id: "task",
      projectId: "project",
      body: "first",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const persisted = commitDomainForOwner(store, initialized, created.value);
    const backup = await createAuthorizedTestBackup(store);
    await store.close();
    store = undefined;

    store = await openPersistence(layout, { applicationVersion: "test" });
    const service = createApplicationService(store, {
      currentActor: () => ({ actorId: "test-lifecycle-owner", principal: "A".repeat(64) }),
      now: () => new Date().toISOString(),
      nextId: () => randomUUID(),
      confirmHighRisk: () => true,
    });
    assert.equal(service.execute({ kind: "project.register", projectId: "project", root: projectRoot }).ok, true);
    assert.equal(service.execute({
      kind: "task.update",
      projectId: "project",
      expectedProjectResourceRevision: 1,
      taskId: "task",
      expectedTaskRevision: 1,
      change: { kind: "body", body: "second" },
    }).ok, true);
    const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", backup.generationId);
    await store.close();
    store = undefined;

    const expectedCurrent = await inspectPrimaryIdentity(layout);
    const receipt = await restoreBackup(layout, {
      generationId: backup.generationId,
      expectedCurrent,
      acknowledgeDataLoss: true,
      applicationVersion: "test",
      authorization: restoreAuthorization,
    });
    assert.equal(receipt.backupGenerationId, backup.generationId);

    store = await openPersistence(layout, { applicationVersion: "test" });
    assert.deepEqual(readDomainForOwner(store), persisted);
  } finally {
    if (store !== undefined) await store.close();
    removeOwnedGeneration(generation);
  }
});
