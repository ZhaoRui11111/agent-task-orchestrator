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
import { openPersistence } from "../src/index.ts";
import {
  initializeDomainForOwner,
  readDomainForOwner,
} from "../src/persistence/application-repository.ts";
import {
  assertNewSqliteMemberBindingForTesting,
  checkpointWal,
  openPrimaryDatabase,
  openReadOnlyDatabase,
  runReadSnapshot,
  runWriteTransaction,
  SQLITE_BUSY_TIMEOUT_MS,
} from "../src/persistence/database.ts";
import {
  createConnectionReceipt,
  releaseConnectionReceipt,
  withLifecycleLock,
} from "../src/persistence/runtime.ts";
import {
  cleanupPersistenceFixture,
  createPersistenceFixture,
  emptySnapshot,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

test("read-only setup failure closes the constructed SQLite handle", () => {
  const fixture = createPersistenceFixture("concurrency-readonly-close");
  const malformedDirectory = path.join(fixture.layout.restoreStagingRoot, "malformed");
  const movedDirectory = `${malformedDirectory}.moved`;
  const malformedPath = path.join(malformedDirectory, "state.sqlite3");
  try {
    mkdirSync(malformedDirectory);
    writeFileSync(malformedPath, "not a sqlite database");
    assert.throws(
      () => openReadOnlyDatabase(malformedPath),
      (error) => expectPersistenceError(error, "SQLITE_OPEN_FAILED"),
    );
    renameSync(malformedDirectory, movedDirectory);
    renameSync(movedDirectory, malformedDirectory);
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("SQLite open rejects unsafe and dangling sidecars before issuing a connection", async () => {
  for (const boundary of ["directory", "dangling"]) {
    const fixture = createPersistenceFixture(`concurrency-sidecar-${boundary}`);
    let store;
    let movedMarkerDirectory;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "sidecar" });
      initializeDomainForOwner(store, emptySnapshot());
      await store.close();
      store = undefined;
      const primaryBefore = readFileSync(fixture.layout.databasePath);
      const unsafeSidecar = `${fixture.layout.databasePath}-wal`;
      const markerDirectory = boundary === "directory"
        ? unsafeSidecar
        : path.join(fixture.generation, "sidecar-target");
      mkdirSync(markerDirectory);
      writeFileSync(path.join(markerDirectory, "outside-marker"), "unchanged");
      if (boundary === "dangling") {
        symlinkSync(markerDirectory, unsafeSidecar, process.platform === "win32" ? "junction" : "dir");
        movedMarkerDirectory = `${markerDirectory}.moved`;
        renameSync(markerDirectory, movedMarkerDirectory);
      }
      await assert.rejects(
        openPersistence(fixture.layout, { applicationVersion: "blocked" }),
        (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
      );
      assert.deepEqual(readFileSync(fixture.layout.databasePath), primaryBefore);
      const preservedMarker = boundary === "directory"
        ? path.join(markerDirectory, "outside-marker")
        : path.join(movedMarkerDirectory, "outside-marker");
      assert.equal(readFileSync(preservedMarker, "utf8"), "unchanged");
      assert.deepEqual(readdirSync(fixture.layout.connectionsRoot), []);
    } finally {
      if (store) await store.close();
      if (movedMarkerDirectory && existsSync(movedMarkerDirectory)) {
        renameSync(movedMarkerDirectory, path.join(fixture.generation, "sidecar-target"));
      }
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("a sidecar first created during open is retained across terminal identity validation", () => {
  const fixture = createPersistenceFixture("concurrency-new-sidecar-binding");
  try {
    writeFileSync(fixture.layout.databasePath, "main");
    const sidecarPath = `${fixture.layout.databasePath}-wal`;
    const original = Buffer.from("sidecar");
    assert.throws(
      () => assertNewSqliteMemberBindingForTesting(
        fixture.layout.databasePath,
        () => writeFileSync(sidecarPath, original),
        () => {
          renameSync(sidecarPath, `${sidecarPath}.owned`);
          writeFileSync(sidecarPath, original);
        },
      ),
      (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
    );
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("every primary connection enforces FK, WAL, FULL sync, read isolation, and a 5 second busy bound", async () => {
  const fixture = createPersistenceFixture("concurrency-policy");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "policy" });
    assert.deepEqual(store.connectionPolicy, {
      foreignKeys: true,
      journalMode: "wal",
      synchronous: "FULL",
      readUncommitted: false,
      busyTimeoutMs: SQLITE_BUSY_TIMEOUT_MS,
    });
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("write contention fails with typed BUSY at the configured bounded timeout", async () => {
  const fixture = createPersistenceFixture("concurrency-busy");
  let store;
  let first;
  let second;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "busy" });
    initializeDomainForOwner(store, emptySnapshot());
    await store.close();
    store = undefined;
    first = openPrimaryDatabase(fixture.layout.databasePath);
    second = openPrimaryDatabase(fixture.layout.databasePath);
    first.exec("BEGIN IMMEDIATE");
    const started = performance.now();
    assert.throws(
      () => runWriteTransaction(second, () => undefined),
      (error) => expectPersistenceError(error, "BUSY"),
    );
    const elapsed = performance.now() - started;
    assert.ok(elapsed >= 4_500, `busy timeout returned too early: ${elapsed}`);
    assert.ok(elapsed < 8_000, `busy timeout exceeded its test bound: ${elapsed}`);
    first.exec("ROLLBACK");
  } finally {
    if (first?.isTransaction) first.exec("ROLLBACK");
    if (second?.isOpen) second.close();
    if (first?.isOpen) first.close();
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("transaction callbacks reject async work and roll it back", async () => {
  const fixture = createPersistenceFixture("concurrency-async");
  let store;
  let database;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "async" });
    initializeDomainForOwner(store, emptySnapshot());
    await store.close();
    store = undefined;
    database = openPrimaryDatabase(fixture.layout.databasePath);
    assert.throws(
      () =>
        runWriteTransaction(database, () => {
          database.prepare("UPDATE projects SET enabled=0 WHERE project_id='project'").run();
          return Promise.resolve();
        }),
      (error) => expectPersistenceError(error, "ASYNC_TRANSACTION_FORBIDDEN"),
    );
    assert.equal(database.prepare("SELECT enabled FROM projects WHERE project_id='project'").get().enabled, 1);
  } finally {
    if (database?.isOpen) database.close();
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("checkpoint mode is validated before interpolation", async () => {
  const fixture = createPersistenceFixture("concurrency-checkpoint-ingress");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "checkpoint" });
    assert.throws(
      () => store.checkpoint("TRUNCATE); DROP TABLE tasks; --"),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
    assert.deepEqual(readDomainForOwner(store), { projects: [], tasks: [] });
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("a read transaction retains its snapshot while a writer commits and blocks TRUNCATE checkpoint", async () => {
  const fixture = createPersistenceFixture("concurrency-snapshot");
  let store;
  let reader;
  let writer;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "snapshot" });
    initializeDomainForOwner(store, emptySnapshot());
    await store.close();
    store = undefined;
    reader = openPrimaryDatabase(fixture.layout.databasePath);
    writer = openPrimaryDatabase(fixture.layout.databasePath);
    let checkpoint;
    const observed = runReadSnapshot(reader, () => {
      const before = reader.prepare("SELECT enabled FROM projects WHERE project_id='project'").get().enabled;
      runWriteTransaction(writer, () => {
        writer.prepare("UPDATE projects SET enabled=0 WHERE project_id='project'").run();
      });
      checkpoint = checkpointWal(writer, "TRUNCATE");
      const during = reader.prepare("SELECT enabled FROM projects WHERE project_id='project'").get().enabled;
      return { before, during };
    });
    assert.deepEqual(observed, { before: 1, during: 1 });
    assert.ok(checkpoint.busy > 0);
    assert.equal(reader.prepare("SELECT enabled FROM projects WHERE project_id='project'").get().enabled, 0);
    assert.deepEqual(checkpointWal(writer, "TRUNCATE"), {
      busy: 0,
      logFrames: 0,
      checkpointedFrames: 0,
    });
  } finally {
    if (writer?.isOpen) writer.close();
    if (reader?.isOpen) reader.close();
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("lifecycle lock contention and crash residue fail closed without stale deletion", async () => {
  const fixture = createPersistenceFixture("concurrency-lifecycle");
  try {
    await withLifecycleLock(fixture.layout, "outer", async (token) => {
      await assert.rejects(
        withLifecycleLock(fixture.layout, "nested", () => undefined),
        (error) => expectPersistenceError(error, "LIFECYCLE_BUSY"),
      );
      token.assertHeld();
    });
    writeFileSync(fixture.layout.lifecycleLockPath, "crash-residue", { flag: "wx" });
    await assert.rejects(
      withLifecycleLock(fixture.layout, "blocked", () => undefined),
      (error) => expectPersistenceError(error, "LIFECYCLE_BUSY"),
    );
    assert.equal(existsSync(fixture.layout.lifecycleLockPath), true);
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("connection receipt owner revalidates its issued parent at create and release boundaries", async () => {
  const fixture = createPersistenceFixture("concurrency-receipt-parent");
  let receipt;
  try {
    receipt = await withLifecycleLock(fixture.layout, "create-receipt", (token) => {
      const owned = `${fixture.layout.connectionsRoot}.create-owned`;
      const replacement = `${fixture.layout.connectionsRoot}.create-replacement`;
      renameSync(fixture.layout.connectionsRoot, owned);
      mkdirSync(fixture.layout.connectionsRoot);
      assert.throws(
        () => createConnectionReceipt(fixture.layout, "parent", token),
        (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
      );
      renameSync(fixture.layout.connectionsRoot, replacement);
      renameSync(owned, fixture.layout.connectionsRoot);
      return createConnectionReceipt(fixture.layout, "parent", token);
    });
    await withLifecycleLock(fixture.layout, "release-receipt", (token) => {
      const owned = `${fixture.layout.connectionsRoot}.owned`;
      const replacement = `${fixture.layout.connectionsRoot}.replacement`;
      renameSync(fixture.layout.connectionsRoot, owned);
      mkdirSync(fixture.layout.connectionsRoot);
      assert.throws(
        () => releaseConnectionReceipt(fixture.layout, receipt, token),
        (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
      );
      renameSync(fixture.layout.connectionsRoot, replacement);
      renameSync(owned, fixture.layout.connectionsRoot);
      releaseConnectionReceipt(fixture.layout, receipt, token);
      receipt = undefined;
    });
  } finally {
    if (receipt) {
      await withLifecycleLock(fixture.layout, "release-after-parent-test", (token) =>
        releaseConnectionReceipt(fixture.layout, receipt, token),
      );
    }
    cleanupPersistenceFixture(fixture);
  }
});

test("lifecycle and connection receipt identity replacement is detected", async () => {
  const lifecycleFixture = createPersistenceFixture("concurrency-lock-swap");
  try {
    await assert.rejects(
      withLifecycleLock(lifecycleFixture.layout, "swap", (token) => {
        renameSync(lifecycleFixture.layout.lifecycleLockPath, `${lifecycleFixture.layout.lifecycleLockPath}.owned`);
        writeFileSync(lifecycleFixture.layout.lifecycleLockPath, "replacement", { flag: "wx" });
        assert.throws(
          () => token.assertHeld(),
          (error) => expectPersistenceError(error, "LIFECYCLE_IDENTITY_CHANGED"),
        );
      }),
      (error) => expectPersistenceError(error, "LIFECYCLE_IDENTITY_CHANGED"),
    );
  } finally {
    cleanupPersistenceFixture(lifecycleFixture);
  }

  const receiptFixture = createPersistenceFixture("concurrency-receipt-swap");
  let store;
  try {
    store = await openPersistence(receiptFixture.layout, { applicationVersion: "receipt" });
    const name = readdirSync(receiptFixture.layout.connectionsRoot)[0];
    assert.ok(name);
    const receiptPath = path.join(receiptFixture.layout.connectionsRoot, name);
    const ownedPath = `${receiptPath}.owned`;
    const replacementPath = `${receiptPath}.replacement`;
    renameSync(receiptPath, ownedPath);
    writeFileSync(receiptPath, "replacement", { flag: "wx" });
    assert.throws(
      () => readDomainForOwner(store),
      (error) => expectPersistenceError(error, "CONNECTION_RECEIPT_CHANGED"),
    );
    renameSync(receiptPath, replacementPath);
    renameSync(ownedPath, receiptPath);
    await store.close();
    store = undefined;
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(receiptFixture);
  }
});

test("same-file lifecycle and connection receipt content tampering is detected", async () => {
  const lifecycleFixture = createPersistenceFixture("concurrency-lock-content");
  try {
    await assert.rejects(
      withLifecycleLock(lifecycleFixture.layout, "tamper", (token) => {
        const original = readFileSync(lifecycleFixture.layout.lifecycleLockPath, "utf8");
        const changed = original.replace('"operation":"tamper"', '"operation":"tampEr"');
        assert.equal(changed.length, original.length);
        writeFileSync(lifecycleFixture.layout.lifecycleLockPath, changed);
        assert.throws(
          () => token.assertHeld(),
          (error) => expectPersistenceError(error, "LIFECYCLE_IDENTITY_CHANGED"),
        );
      }),
      (error) => expectPersistenceError(error, "LIFECYCLE_IDENTITY_CHANGED"),
    );
  } finally {
    cleanupPersistenceFixture(lifecycleFixture);
  }

  const receiptFixture = createPersistenceFixture("concurrency-receipt-content");
  let store;
  try {
    store = await openPersistence(receiptFixture.layout, { applicationVersion: "receipt" });
    const name = readdirSync(receiptFixture.layout.connectionsRoot)[0];
    assert.ok(name);
    const receiptPath = path.join(receiptFixture.layout.connectionsRoot, name);
    const original = readFileSync(receiptPath, "utf8");
    const changed = original.replace(
      '"applicationVersion":"receipt"',
      '"applicationVersion":"receipT"',
    );
    assert.equal(changed.length, original.length);
    writeFileSync(receiptPath, changed);
    assert.throws(
      () => readDomainForOwner(store),
      (error) => expectPersistenceError(error, "CONNECTION_RECEIPT_CHANGED"),
    );
    writeFileSync(receiptPath, original);
    await store.close();
    store = undefined;
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(receiptFixture);
  }
});

test("corrupt connection receipt content remains an active-state blocker", async () => {
  const fixture = createPersistenceFixture("concurrency-corrupt-receipt");
  try {
    writeFileSync(
      path.join(fixture.layout.connectionsRoot, "00000000-0000-4000-8000-000000000000.json"),
      "{}\n",
    );
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "blocked" }),
      (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
    );
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("a crash-stale connection receipt blocks first initialization until its exact owner releases it", async () => {
  const fixture = createPersistenceFixture("concurrency-upgrade-receipt");
  let receipt;
  try {
    receipt = await withLifecycleLock(fixture.layout, "test-receipt", (token) =>
      createConnectionReceipt(fixture.layout, "stale", token),
    );
    await assert.rejects(
      openPersistence(fixture.layout, { applicationVersion: "blocked" }),
      (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
    );
    await withLifecycleLock(fixture.layout, "release-test-receipt", (token) =>
      releaseConnectionReceipt(fixture.layout, receipt, token),
    );
    receipt = undefined;
    const store = await openPersistence(fixture.layout, { applicationVersion: "allowed" });
    await store.close();
  } finally {
    if (receipt) {
      await withLifecycleLock(fixture.layout, "release-after-failure", (token) =>
        releaseConnectionReceipt(fixture.layout, receipt, token),
      );
    }
    cleanupPersistenceFixture(fixture);
  }
});
