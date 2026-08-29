import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createDomainSnapshot,
  createTask,
  inspectPrimaryIdentity,
  openPersistence,
  prepareRuntimeLayout,
  restoreBackup,
  updateTaskBody,
} from "../src/index.ts";
import { createOwnedGeneration, removeOwnedGeneration } from "../scripts/repo-utils.mjs";

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
  return { generation, layout };
}

test("persistence foundation round-trips, backs up, and restores Domain Core state", async () => {
  const { generation, layout } = fixture();
  let store;
  try {
    store = await openPersistence(layout, { applicationVersion: "test" });
    assert.deepEqual(store.migration.appliedVersions, [1, 2]);
    const initial = createDomainSnapshot({ projects: [{ id: "project", enabled: true }], tasks: [] });
    assert.equal(initial.ok, true);
    const initialized = store.initialize(initial.value);
    const created = createTask(initialized, {
      id: "task",
      projectId: "project",
      body: "first",
      supersedesTaskId: null,
    });
    assert.equal(created.ok, true);
    const persisted = store.commit(initialized, created.value);
    const backup = await store.createBackup();
    await store.close();
    store = undefined;

    store = await openPersistence(layout, { applicationVersion: "test" });
    const changed = updateTaskBody(persisted, { taskId: "task", body: "second" });
    assert.equal(changed.ok, true);
    store.commit(persisted, changed.value);
    await store.close();
    store = undefined;

    const expectedCurrent = await inspectPrimaryIdentity(layout);
    const receipt = await restoreBackup(layout, {
      generationId: backup.generationId,
      expectedCurrent,
      acknowledgeDataLoss: true,
      applicationVersion: "test",
    });
    assert.equal(receipt.backupGenerationId, backup.generationId);

    store = await openPersistence(layout, { applicationVersion: "test" });
    assert.deepEqual(store.read(), persisted);
  } finally {
    if (store !== undefined) await store.close();
    removeOwnedGeneration(generation);
  }
});
