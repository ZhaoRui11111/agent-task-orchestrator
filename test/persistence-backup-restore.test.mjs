import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  createDomainSnapshot,
  createTask,
  inspectPrimaryIdentity,
  openPersistence,
  recoverInterruptedRestore,
  restoreBackup,
  updateTaskBody,
  verifyBackupGeneration,
} from "../src/index.ts";
import {
  createBackupUnderLock,
  restoreBackupForTesting,
  verifyBackupGenerationForTesting,
} from "../src/persistence/backup.ts";
import { openPrimaryDatabase } from "../src/persistence/database.ts";
import { withLifecycleLock } from "../src/persistence/runtime.ts";
import { canonicalJson, sha256 } from "../src/persistence/values.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  emptySnapshot,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

async function seedTask(store, body = "first") {
  const initialResult = createDomainSnapshot(emptySnapshot());
  assert.equal(initialResult.ok, true);
  const initial = store.initialize(initialResult.value);
  const created = createTask(initial, {
    id: "task",
    projectId: "project",
    body,
    supersedesTaskId: null,
  });
  assert.equal(created.ok, true);
  return store.commit(initial, created.value);
}

async function mutateTask(store, expected, body) {
  const mutation = updateTaskBody(expected, { taskId: "task", body });
  assert.equal(mutation.ok, true);
  return store.commit(expected, mutation.value);
}

test("online backup publishes an exact verified immutable generation while another reader is open", async () => {
  const fixture = createPersistenceFixture("backup-online");
  let first;
  let second;
  try {
    first = await openPersistence(fixture.layout, { applicationVersion: "backup" });
    const snapshot = await seedTask(first);
    second = await openPersistence(fixture.layout, { applicationVersion: "reader" });
    const generation = await first.createBackup();
    assert.deepEqual(second.read(), snapshot);
    const verified = verifyBackupGeneration(fixture.layout, generation.generationId);
    assert.deepEqual(verified, generation);
    assert.equal(verified.manifest.kind, "manual");
    assert.equal(verified.manifest.sourceSchemaVersion, 2);
    assert.equal(verified.manifest.sourceHistory.length, 2);
    const directory = path.join(fixture.layout.backupGenerationsRoot, generation.generationId);
    assert.deepEqual(readdirSync(directory).sort(), ["manifest.json", "state.sqlite3"]);
    const database = new DatabaseSync(path.join(directory, "state.sqlite3"), { readOnly: true });
    assert.equal(String(Object.values(database.prepare("PRAGMA journal_mode").get())[0]).toLowerCase(), "delete");
    database.close();
  } finally {
    if (second) await second.close();
    if (first) await first.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("backup revalidates clone identities, sidecars, exact inventory, and publication boundaries", async () => {
  for (const boundary of ["stage", "source", "sidecar", "inventory", "publish"]) {
    const fixture = createPersistenceFixture(`backup-boundary-${boundary}`);
    let store;
    let database;
    let attemptedGeneration;
    let movedSidecarTarget;
    let sidecarTarget;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "boundary" });
      await seedTask(store);
      await store.close();
      store = undefined;
      database = openPrimaryDatabase(fixture.layout.databasePath);
      await assert.rejects(
        withLifecycleLock(fixture.layout, `backup-${boundary}`, (token) =>
          createBackupUnderLock(
            database,
            fixture.layout,
            "boundary",
            "manual",
            token,
            {
              afterClone: boundary === "publish" || boundary === "inventory" ? undefined : () => {
                if (boundary === "stage") {
                  const name = readdirSync(fixture.layout.backupStagingRoot)[0];
                  assert.ok(name);
                  const stage = path.join(fixture.layout.backupStagingRoot, name);
                  renameSync(stage, `${stage}.owned`);
                  mkdirSync(stage);
                } else if (boundary === "source") {
                  const original = readFileSync(fixture.layout.databasePath);
                  renameSync(fixture.layout.databasePath, `${fixture.layout.databasePath}.owned`);
                  writeFileSync(fixture.layout.databasePath, original);
                } else {
                  const name = readdirSync(fixture.layout.backupStagingRoot)[0];
                  assert.ok(name);
                  attemptedGeneration = name;
                  const stage = path.join(fixture.layout.backupStagingRoot, name);
                  sidecarTarget = path.join(fixture.generation, "backup-sidecar-target");
                  mkdirSync(sidecarTarget);
                  writeFileSync(path.join(sidecarTarget, "outside-marker"), "unchanged");
                  symlinkSync(
                    sidecarTarget,
                    path.join(stage, "state.sqlite3-wal"),
                    process.platform === "win32" ? "junction" : "dir",
                  );
                  movedSidecarTarget = `${sidecarTarget}.moved`;
                  renameSync(sidecarTarget, movedSidecarTarget);
                }
              },
              beforePublish: boundary === "publish" ? () => {
                const name = readdirSync(fixture.layout.backupStagingRoot)[0];
                assert.ok(name);
                attemptedGeneration = name;
                mkdirSync(path.join(fixture.layout.backupGenerationsRoot, name));
              } : boundary === "inventory" ? () => {
                const name = readdirSync(fixture.layout.backupStagingRoot)[0];
                assert.ok(name);
                attemptedGeneration = name;
                writeFileSync(path.join(fixture.layout.backupStagingRoot, name, "unexpected"), "blocked");
              } : undefined,
            },
          ),
        ),
        (error) => {
          assert.equal(
            error.code,
            boundary === "publish"
              ? "BACKUP_CONFLICT"
              : boundary === "inventory"
                ? "BACKUP_INVALID"
              : boundary === "source" && process.platform === "win32"
                ? "BACKUP_INVALID"
                : "PATH_IDENTITY_CHANGED",
            `${boundary} boundary returned ${error.code}: ${error.message}`,
          );
          return true;
        },
      );
      if (boundary === "inventory") {
        assert.ok(attemptedGeneration);
        assert.equal(
          existsSync(path.join(fixture.layout.backupGenerationsRoot, attemptedGeneration)),
          false,
        );
      } else if (boundary === "sidecar") {
        assert.ok(attemptedGeneration);
        assert.ok(movedSidecarTarget);
        assert.equal(readFileSync(path.join(movedSidecarTarget, "outside-marker"), "utf8"), "unchanged");
        assert.equal(
          existsSync(path.join(fixture.layout.backupGenerationsRoot, attemptedGeneration)),
          false,
        );
      }
    } finally {
      if (database?.isOpen) database.close();
      if (store) await store.close();
      if (movedSidecarTarget && sidecarTarget && existsSync(movedSidecarTarget)) {
        renameSync(movedSidecarTarget, sidecarTarget);
      }
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("backup verification binds hashed bytes to terminal SQLite readback", async () => {
  const fixture = createPersistenceFixture("backup-terminal-binding");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "binding" });
    await seedTask(store);
    const generation = await store.createBackup();
    const generationDirectory = path.join(
      fixture.layout.backupGenerationsRoot,
      generation.generationId,
    );
    const databasePath = path.join(generationDirectory, "state.sqlite3");
    const original = readFileSync(databasePath);
    assert.throws(
      () =>
        verifyBackupGenerationForTesting(fixture.layout, generation.generationId, {
          afterDatabaseRead: () => {
            renameSync(
              databasePath,
              path.join(fixture.layout.backupsRoot, `${generation.generationId}.owned.sqlite3`),
            );
            writeFileSync(databasePath, original);
          },
        }),
      (error) => expectPersistenceError(error, "BACKUP_INVALID"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("backup verification refuses missing, changed, extra, or newer material", async () => {
  for (const corruption of ["missing", "manifest", "noncanonical", "database", "inventory", "newer"]) {
    const fixture = createPersistenceFixture(`backup-corrupt-${corruption}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "corrupt" });
      await seedTask(store);
      const generation = await store.createBackup();
      const directory = path.join(fixture.layout.backupGenerationsRoot, generation.generationId);
      if (corruption === "missing") {
        renameSync(
          path.join(directory, "manifest.json"),
          path.join(fixture.layout.backupsRoot, `${generation.generationId}.missing-manifest`),
        );
      }
      if (corruption === "manifest") writeFileSync(path.join(directory, "manifest.json"), "{}\n");
      if (corruption === "noncanonical") {
        const manifestPath = path.join(directory, "manifest.json");
        writeFileSync(
          manifestPath,
          `${JSON.stringify(JSON.parse(readFileSync(manifestPath, "utf8")), null, 2)}\n`,
        );
      }
      if (corruption === "database") writeFileSync(path.join(directory, "state.sqlite3"), "changed");
      if (corruption === "inventory") writeFileSync(path.join(directory, "unknown"), "changed");
      if (corruption === "newer") {
        const databasePath = path.join(directory, "state.sqlite3");
        const database = new DatabaseSync(databasePath);
        database.prepare("UPDATE schema_metadata SET schema_version=3 WHERE singleton=1").run();
        database.exec("PRAGMA user_version=3");
        database.close();
        const databaseBytes = readFileSync(databasePath);
        const manifestPath = path.join(directory, "manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.databaseLength = databaseBytes.byteLength;
        manifest.databaseSha256 = sha256(databaseBytes);
        manifest.sourceSchemaVersion = 3;
        writeFileSync(manifestPath, canonicalJson(manifest));
      }
      assert.throws(
        () => verifyBackupGeneration(fixture.layout, generation.generationId),
        (error) => expectPersistenceError(error, "BACKUP_INVALID"),
      );
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("restore requires acknowledgement, exact current file-set CAS, and zero connection receipts", async () => {
  const fixture = createPersistenceFixture("restore-preconditions");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
    const snapshot = await seedTask(store);
    const generation = await store.createBackup();
    await store.close();
    store = undefined;
    const originalIdentity = await inspectPrimaryIdentity(fixture.layout);
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: generation.generationId,
        expectedCurrent: originalIdentity,
        acknowledgeDataLoss: false,
        applicationVersion: "restore",
      }),
      (error) => expectPersistenceError(error, "RESTORE_ACK_REQUIRED"),
    );
    store = await openPersistence(fixture.layout, { applicationVersion: "mutate" });
    const changed = await mutateTask(store, snapshot, "changed");
    await store.close();
    store = undefined;
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: generation.generationId,
        expectedCurrent: originalIdentity,
        acknowledgeDataLoss: true,
        applicationVersion: "restore",
      }),
      (error) => expectPersistenceError(error, "RESTORE_CONFLICT"),
    );
    store = await openPersistence(fixture.layout, { applicationVersion: "active" });
    assert.deepEqual(store.read(), changed);
    const currentIdentity = originalIdentity;
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: generation.generationId,
        expectedCurrent: currentIdentity,
        acknowledgeDataLoss: true,
        applicationVersion: "restore",
      }),
      (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("every failure after durable intent publication requires explicit restore recovery", async () => {
  const fixture = createPersistenceFixture("restore-after-intent");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "intent" });
    const backedUp = await seedTask(store);
    const generation = await store.createBackup();
    await mutateTask(store, backedUp, "changed");
    await store.close();
    store = undefined;
    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    let restoreId;
    await assert.rejects(
      restoreBackupForTesting(
        fixture.layout,
        {
          generationId: generation.generationId,
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: "intent",
        },
        { afterIntent: () => { throw new Error("after intent"); } },
      ),
      (error) => {
        expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED");
        restoreId = error.details.restoreId;
        return true;
      },
    );
    assert.ok(restoreId);
    assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
    const receipt = await recoverInterruptedRestore(fixture.layout);
    assert.equal(receipt.restoreId, restoreId);
    store = await openPersistence(fixture.layout, { applicationVersion: "readback" });
    assert.deepEqual(store.read(), backedUp);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("restore revalidates primary CAS, stage, and retained identities at their real mutation boundaries", async () => {
  for (const boundary of ["stage", "primary-after-stage", "primary-before-intent", "retained"]) {
    const fixture = createPersistenceFixture(`restore-boundary-${boundary}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "boundary" });
      const backedUp = await seedTask(store);
      const generation = await store.createBackup();
      await mutateTask(store, backedUp, "changed");
      await store.close();
      store = undefined;
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
      await assert.rejects(
        restoreBackupForTesting(
          fixture.layout,
          {
            generationId: generation.generationId,
            expectedCurrent,
            acknowledgeDataLoss: true,
            applicationVersion: "boundary",
          },
          boundary === "stage"
            ? {
                afterStage: () => {
                  const name = readdirSync(fixture.layout.restoreStagingRoot)[0];
                  assert.ok(name);
                  const stagePath = path.join(fixture.layout.restoreStagingRoot, name);
                  const original = readFileSync(stagePath);
                  renameSync(stagePath, `${stagePath}.owned`);
                  writeFileSync(stagePath, original);
                },
              }
            : boundary === "primary-after-stage"
              ? {
                  afterStage: () => {
                    const original = readFileSync(fixture.layout.databasePath);
                    renameSync(fixture.layout.databasePath, `${fixture.layout.databasePath}.owned`);
                    writeFileSync(fixture.layout.databasePath, original);
                  },
                }
              : boundary === "primary-before-intent"
                ? {
                    beforeIntent: () => {
                      const original = readFileSync(fixture.layout.databasePath);
                      renameSync(fixture.layout.databasePath, `${fixture.layout.databasePath}.owned`);
                      writeFileSync(fixture.layout.databasePath, original);
                    },
                  }
            : {
                beforeRetainMember: () => {
                  const name = readdirSync(fixture.layout.restoreRetainedRoot)[0];
                  assert.ok(name);
                  const retainedPath = path.join(fixture.layout.restoreRetainedRoot, name);
                  renameSync(retainedPath, `${retainedPath}.owned`);
                  mkdirSync(retainedPath);
                },
              },
        ),
        (error) =>
          expectPersistenceError(
            error,
            boundary === "stage"
              ? "PATH_IDENTITY_CHANGED"
              : boundary.startsWith("primary-")
                ? "RESTORE_CONFLICT"
                : "RESTORE_RECOVERY_REQUIRED",
          ),
      );
      if (boundary === "stage" || boundary.startsWith("primary-")) {
        assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
        if (boundary.startsWith("primary-")) {
          assert.equal(readdirSync(fixture.layout.restoreRetainedRoot).length, 0);
        }
      } else {
        assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
        await assert.rejects(
          recoverInterruptedRestore(fixture.layout),
          (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
        );
      }
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("interruption after retention preserves old bytes, blocks open, and recovers deterministically", async () => {
  const fixture = createPersistenceFixture("restore-after-retain");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
    const backedUp = await seedTask(store);
    const generation = await store.createBackup();
    const changed = await mutateTask(store, backedUp, "changed");
    assert.equal(changed.tasks[0].body, "changed");
    await store.close();
    store = undefined;
    writeFileSync(`${fixture.layout.databasePath}-wal`, "retained-wal");
    writeFileSync(`${fixture.layout.databasePath}-shm`, "retained-shm");
    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    assert.deepEqual(
      expectedCurrent.members.map((member) => member.fileName),
      ["state.sqlite3", "state.sqlite3-wal", "state.sqlite3-shm"],
    );
    let restoreId;
    await assert.rejects(
      restoreBackupForTesting(
        fixture.layout,
        {
          generationId: generation.generationId,
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: "restore",
        },
        { afterRetain: () => { throw new Error("deliberate interruption"); } },
      ),
      (error) => {
        expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED");
        restoreId = error.details.restoreId;
        return true;
      },
    );
    assert.ok(restoreId);
    assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
    for (const expected of expectedCurrent.members) {
      const retainedPath = path.join(
        fixture.layout.restoreRetainedRoot,
        restoreId,
        expected.fileName,
      );
      assert.equal(sha256(readFileSync(retainedPath)), expected.sha256);
    }
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "blocked" }),
      (error) => expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED"),
    );
    const receipt = await recoverInterruptedRestore(fixture.layout);
    assert.equal(receipt.restoreId, restoreId);
    assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
    for (const expected of expectedCurrent.members) {
      assert.equal(
        existsSync(path.join(fixture.layout.restoreRetainedRoot, restoreId, expected.fileName)),
        true,
      );
    }
    store = await openPersistence(fixture.layout, { applicationVersion: "readback" });
    assert.deepEqual(store.read(), backedUp);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("interruption after publication or receipt resumes without fabricating rollback", async () => {
  for (const boundary of ["publish", "receipt"]) {
    const fixture = createPersistenceFixture(`restore-after-${boundary}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
      const backedUp = await seedTask(store);
      const generation = await store.createBackup();
      await mutateTask(store, backedUp, "changed");
      await store.close();
      store = undefined;
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
      const hooks = boundary === "publish"
        ? { afterPublish: () => { throw new Error("after publish"); } }
        : { afterReceipt: () => { throw new Error("after receipt"); } };
      let restoreId;
      await assert.rejects(
        restoreBackupForTesting(
          fixture.layout,
          {
            generationId: generation.generationId,
            expectedCurrent,
            acknowledgeDataLoss: true,
            applicationVersion: "restore",
          },
          hooks,
        ),
        (error) => {
          expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED");
          restoreId = error.details.restoreId;
          return true;
        },
      );
      assert.ok(restoreId);
      if (boundary === "receipt") {
        const retainedMain = path.join(
          fixture.layout.restoreRetainedRoot,
          restoreId,
          "state.sqlite3",
        );
        const displacedMain = path.join(fixture.layout.restoreRoot, `${restoreId}.retained-main`);
        renameSync(retainedMain, displacedMain);
        await assert.rejects(
          recoverInterruptedRestore(fixture.layout),
          (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
        );
        renameSync(displacedMain, retainedMain);
      }
      const receipt = await recoverInterruptedRestore(fixture.layout);
      assert.equal(receipt.backupGenerationId, generation.generationId);
      store = await openPersistence(fixture.layout, { applicationVersion: "readback" });
      assert.deepEqual(store.read(), backedUp);
      await store.close();
      store = undefined;
      await assert.rejects(
        recoverInterruptedRestore(fixture.layout),
        (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
      );
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("corrupt durable restore intent blocks recovery without adopting state", async () => {
  const fixture = createPersistenceFixture("restore-corrupt-intent");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
    const backedUp = await seedTask(store);
    const generation = await store.createBackup();
    await mutateTask(store, backedUp, "changed");
    await store.close();
    store = undefined;
    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    await assert.rejects(
      restoreBackupForTesting(
        fixture.layout,
        {
          generationId: generation.generationId,
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: "restore",
        },
        { afterRetain: () => { throw new Error("interrupt"); } },
      ),
      (error) => expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED"),
    );
    writeFileSync(fixture.layout.restoreIntentPath, "{}\n");
    await assert.rejects(
      recoverInterruptedRestore(fixture.layout),
      (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
    );
    assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("mixed or substituted recovery topology remains blocked for explicit inspection", async () => {
  const fixture = createPersistenceFixture("restore-mixed-topology");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
    const backedUp = await seedTask(store);
    const generation = await store.createBackup();
    await mutateTask(store, backedUp, "changed");
    await store.close();
    store = undefined;
    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    let restoreId;
    await assert.rejects(
      restoreBackupForTesting(
        fixture.layout,
        {
          generationId: generation.generationId,
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: "restore",
        },
        { afterRetain: () => { throw new Error("interrupt"); } },
      ),
      (error) => {
        expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED");
        restoreId = error.details.restoreId;
        return true;
      },
    );
    const stagePath = path.join(fixture.layout.restoreStagingRoot, `${restoreId}.sqlite3`);
    renameSync(stagePath, `${stagePath}.owned`);
    writeFileSync(stagePath, "substituted");
    await assert.rejects(
      recoverInterruptedRestore(fixture.layout),
      (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
    );
    assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});
