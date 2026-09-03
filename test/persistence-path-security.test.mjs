import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  openPersistence,
  prepareRuntimeLayout,
  restoreBackup,
  verifyBackupGeneration,
} from "../src/index.ts";
import {
  assertOwnedRuntimeDirectory,
  assertRuntimeLayout,
  createOwnedRuntimeDirectory,
  exactDirectoryFilesystemIdentity,
  PRIMARY_RUNTIME_MEMBER_NAMES,
  primaryRuntimeMemberPath,
  requiredRuntimeDirectoryPaths,
  selectConfiguredRuntimeRoot,
} from "../src/persistence/runtime.ts";
import { exactFileFilesystemIdentity } from "../src/persistence/values.ts";
import {
  cleanupPersistenceFixture,
  createAuthorizedTestBackup,
  createPersistenceFixture,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";
import { createOwnedGeneration, removeOwnedGeneration } from "../scripts/repo-utils.mjs";

test("persistence read length comparison remains BigInt until equality is decided", () => {
  const source = readFileSync(new URL("../src/persistence/values.ts", import.meta.url), "utf8");
  assert.match(source, /afterStats\.size !== BigInt\(bytes\.byteLength\)/u);
  assert.doesNotMatch(source, /after\.size !== bytes\.byteLength/u);
});

test("Windows default and environment override only select a candidate later subjected to full validation", () => {
  assert.equal(
    selectConfiguredRuntimeRoot(null, { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, "win32"),
    path.join("C:\\Users\\test\\AppData\\Local", "agent-task-orchestrator"),
  );
  assert.equal(
    selectConfiguredRuntimeRoot(
      null,
      { LOCALAPPDATA: "C:\\ignored", TASK_ORCHESTRATOR_DATA_DIR: "D:\\chosen" },
      "win32",
    ),
    "D:\\chosen",
  );
  assert.equal(
    selectConfiguredRuntimeRoot("E:\\explicit", { TASK_ORCHESTRATOR_DATA_DIR: "D:\\ignored" }, "win32"),
    "E:\\explicit",
  );
  assert.throws(
    () => selectConfiguredRuntimeRoot(null, {}, "linux"),
    (error) => expectPersistenceError(error, "UNSAFE_RUNTIME_ROOT"),
  );
});

test("the Runtime owner derives the fixed directory topology and closed live primary member paths", () => {
  const generation = createOwnedGeneration("path-topology-owner");
  const sourceCheckoutRoot = path.join(generation, "source");
  const projectRoot = path.join(generation, "project");
  const runtimeRoot = path.join(generation, "runtime");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(projectRoot);
  try {
    const expectedDirectories = [
      runtimeRoot,
      path.join(runtimeRoot, "backups"),
      path.join(runtimeRoot, "backups", ".staging"),
      path.join(runtimeRoot, "backups", "generations"),
      path.join(runtimeRoot, "connections"),
      path.join(runtimeRoot, "restore"),
      path.join(runtimeRoot, "restore", "staging"),
      path.join(runtimeRoot, "restore", "retained"),
      path.join(runtimeRoot, "restore", "receipts"),
    ];
    const derived = requiredRuntimeDirectoryPaths(runtimeRoot);
    assert.deepEqual(derived, expectedDirectories);
    assert.equal(Object.isFrozen(derived), true);
    assert.equal(existsSync(runtimeRoot), false);

    const layout = prepareRuntimeLayout({ runtimeRoot, sourceCheckoutRoot, projectRoots: [projectRoot] });
    assert.deepEqual(derived, [
      layout.root,
      layout.backupsRoot,
      layout.backupStagingRoot,
      layout.backupGenerationsRoot,
      layout.connectionsRoot,
      layout.restoreRoot,
      layout.restoreStagingRoot,
      layout.restoreRetainedRoot,
      layout.restoreReceiptsRoot,
    ]);
    assert.deepEqual(PRIMARY_RUNTIME_MEMBER_NAMES, [
      "state.sqlite3",
      "state.sqlite3-wal",
      "state.sqlite3-shm",
    ]);
    assert.equal(Object.isFrozen(PRIMARY_RUNTIME_MEMBER_NAMES), true);
    assert.deepEqual(
      PRIMARY_RUNTIME_MEMBER_NAMES.map((fileName) => primaryRuntimeMemberPath(layout, fileName)),
      [layout.databasePath, `${layout.databasePath}-wal`, `${layout.databasePath}-shm`],
    );
    assert.throws(
      () => primaryRuntimeMemberPath(layout, "manifest.json"),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("null runtime root uses the validated Windows local application-data child", () => {
  const generation = createOwnedGeneration("path-default-root");
  const sourceCheckoutRoot = path.join(generation, "source");
  const projectRoot = path.join(generation, "project");
  const localData = path.join(generation, "local-data");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(projectRoot);
  mkdirSync(localData);
  const previousOverride = process.env.TASK_ORCHESTRATOR_DATA_DIR;
  const previousLocalData = process.env.LOCALAPPDATA;
  try {
    delete process.env.TASK_ORCHESTRATOR_DATA_DIR;
    process.env.LOCALAPPDATA = localData;
    const layout = prepareRuntimeLayout({ runtimeRoot: null, sourceCheckoutRoot, projectRoots: [projectRoot] });
    assert.equal(layout.root, path.join(localData, "agent-task-orchestrator"));
    assert.equal(layout.privatePermissionsEnforced, process.platform !== "win32");
  } finally {
    if (previousOverride === undefined) delete process.env.TASK_ORCHESTRATOR_DATA_DIR;
    else process.env.TASK_ORCHESTRATOR_DATA_DIR = previousOverride;
    if (previousLocalData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previousLocalData;
    removeOwnedGeneration(generation);
  }
});

test("runtime permissions are enforced where meaningful and explicitly unavailable on Windows", async () => {
  const fixture = createPersistenceFixture("path-private-permissions");
  let store;
  try {
    assert.equal(fixture.layout.privatePermissionsEnforced, process.platform !== "win32");
    if (process.platform === "win32") return;

    for (const directory of [
      fixture.layout.root,
      fixture.layout.backupsRoot,
      fixture.layout.backupStagingRoot,
      fixture.layout.backupGenerationsRoot,
      fixture.layout.connectionsRoot,
      fixture.layout.restoreRoot,
      fixture.layout.restoreStagingRoot,
      fixture.layout.restoreRetainedRoot,
      fixture.layout.restoreReceiptsRoot,
    ]) {
      assert.equal(lstatSync(directory).mode & 0o077, 0, directory);
    }
    store = await openPersistence(fixture.layout, { applicationVersion: "permissions" });
    store.initialize({ projects: [{ id: "project", enabled: true }], tasks: [] });
    const backup = await createAuthorizedTestBackup(store);
    for (const filePath of [
      fixture.layout.databasePath,
      `${fixture.layout.databasePath}-wal`,
      `${fixture.layout.databasePath}-shm`,
      path.join(fixture.layout.backupGenerationsRoot, backup.generationId, "state.sqlite3"),
      path.join(fixture.layout.backupGenerationsRoot, backup.generationId, "manifest.json"),
    ]) {
      if (existsSync(filePath)) assert.equal(lstatSync(filePath).mode & 0o077, 0, filePath);
    }

    const unsafeRoot = path.join(fixture.generation, "existing-open-runtime");
    mkdirSync(unsafeRoot, { mode: 0o755 });
    chmodSync(unsafeRoot, 0o755);
    assert.throws(
      () =>
        prepareRuntimeLayout({
          runtimeRoot: unsafeRoot,
          sourceCheckoutRoot: fixture.sourceCheckoutRoot,
          projectRoots: [fixture.projectRoot],
        }),
      (error) => expectPersistenceError(error, "UNSAFE_RUNTIME_ROOT"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("untrusted runtime root rejects relative, root, traversal, non-directory, and protected overlaps", () => {
  const generation = createOwnedGeneration("path-negatives");
  const sourceCheckoutRoot = path.join(generation, "source");
  const projectRoot = path.join(generation, "project");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(projectRoot);
  const filePath = path.join(generation, "file");
  writeFileSync(filePath, "not a directory");
  const requests = [
    "relative-runtime",
    "\\drive-relative-runtime",
    "\\\\server\\share\\runtime",
    path.parse(generation).root,
    `${generation}${path.sep}candidate${path.sep}..${path.sep}runtime`,
    filePath,
    sourceCheckoutRoot,
    path.join(sourceCheckoutRoot, "child"),
    projectRoot,
    path.join(projectRoot, "child"),
    generation,
  ];
  try {
    for (const runtimeRoot of requests) {
      assert.throws(
        () => prepareRuntimeLayout({ runtimeRoot, sourceCheckoutRoot, projectRoots: [projectRoot] }),
        (error) => expectPersistenceError(error, "UNSAFE_RUNTIME_ROOT"),
        runtimeRoot,
      );
    }
    assert.throws(
      () =>
        prepareRuntimeLayout({
          runtimeRoot: path.join(generation, "valid"),
          sourceCheckoutRoot,
          projectRoots: [projectRoot],
          backupPath: path.join(generation, "caller-selected"),
        }),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("symlink, junction, and reparse ancestors or targets are refused", () => {
  const generation = createOwnedGeneration("path-reparse");
  const sourceCheckoutRoot = path.join(generation, "source");
  const projectRoot = path.join(generation, "project");
  const target = path.join(generation, "target");
  const targetLink = path.join(generation, "target-link");
  const ancestorLink = path.join(generation, "ancestor-link");
  mkdirSync(sourceCheckoutRoot);
  mkdirSync(projectRoot);
  mkdirSync(target);
  symlinkSync(target, targetLink, process.platform === "win32" ? "junction" : "dir");
  symlinkSync(target, ancestorLink, process.platform === "win32" ? "junction" : "dir");
  try {
    for (const runtimeRoot of [targetLink, path.join(ancestorLink, "child")]) {
      assert.throws(
        () => prepareRuntimeLayout({ runtimeRoot, sourceCheckoutRoot, projectRoots: [projectRoot] }),
        (error) => expectPersistenceError(error, "UNSAFE_RUNTIME_ROOT"),
      );
    }
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("every issued runtime directory identity is revalidated before later use", () => {
  const fixture = createPersistenceFixture("path-identity-swap");
  try {
    const owned = `${fixture.layout.connectionsRoot}.owned`;
    renameSync(fixture.layout.connectionsRoot, owned);
    mkdirSync(fixture.layout.connectionsRoot);
    assert.throws(
      () => assertRuntimeLayout(fixture.layout),
      (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
    );
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("owned runtime directory identity preserves BigInt device and inode before replacement checks", () => {
  const fixture = createPersistenceFixture("path-bigint-identity");
  try {
    const owned = createOwnedRuntimeDirectory(fixture.layout, fixture.layout.restoreStagingRoot, "owned-bigint");
    const stats = lstatSync(owned.path, { bigint: true });
    assert.equal(owned.identity.dev, String(stats.dev));
    assert.equal(owned.identity.ino, String(stats.ino));
    assert.equal(owned.identity.mode, Number(stats.mode));
    const highBitInode = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
    assert.notEqual(String(highBitInode), String(Number(highBitInode)));
    assert.deepEqual(
      exactDirectoryFilesystemIdentity({ dev: highBitInode + 2n, ino: highBitInode, mode: 0o40700n }),
      { dev: String(highBitInode + 2n), ino: String(highBitInode), mode: 0o40700 },
    );
    assert.deepEqual(
      exactFileFilesystemIdentity({ dev: highBitInode + 2n, ino: highBitInode, mode: 0o100600n, size: 17n }),
      { dev: String(highBitInode + 2n), ino: String(highBitInode), mode: 0o100600, size: 17 },
    );
    assert.throws(
      () => exactDirectoryFilesystemIdentity({
        dev: highBitInode + 2n,
        ino: highBitInode,
        mode: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }),
      (error) => expectPersistenceError(error, "UNSAFE_RUNTIME_ROOT"),
    );
    assert.throws(
      () => exactFileFilesystemIdentity({
        dev: highBitInode + 2n,
        ino: highBitInode,
        mode: 0o100600n,
        size: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }),
      (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
    );

    const displaced = `${owned.path}.displaced`;
    renameSync(owned.path, displaced);
    mkdirSync(owned.path);
    assert.throws(
      () => assertOwnedRuntimeDirectory(fixture.layout, owned),
      (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
    );
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("unknown connection and backup inventory members fail closed", async () => {
  const receiptFixture = createPersistenceFixture("path-receipt-inventory");
  try {
    writeFileSync(path.join(receiptFixture.layout.connectionsRoot, "unknown"), "unknown");
    await assert.rejects(
      openPersistence(receiptFixture.layout, { applicationVersion: "inventory" }),
      (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
    );
  } finally {
    cleanupPersistenceFixture(receiptFixture);
  }

  const backupFixture = createPersistenceFixture("path-backup-inventory");
  let store;
  try {
    store = await openPersistence(backupFixture.layout, { applicationVersion: "inventory" });
    const backup = await createAuthorizedTestBackup(store);
    writeFileSync(
      path.join(backupFixture.layout.backupGenerationsRoot, backup.generationId, "unexpected"),
      "unexpected",
    );
    assert.throws(
      () => verifyBackupGeneration(backupFixture.layout, backup.generationId),
      (error) => expectPersistenceError(error, "BACKUP_INVALID"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(backupFixture);
  }
});

test("restore ingress accepts an identity, never caller-selected descendant paths", async () => {
  const fixture = createPersistenceFixture("path-restore-ingress");
  try {
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: "00000000-0000-4000-8000-000000000000",
        expectedCurrent: { schemaVersion: 1, members: [], identitySha256: "0".repeat(64) },
        acknowledgeDataLoss: true,
        applicationVersion: "test",
        restorePath: path.join(fixture.generation, "caller-selected"),
      }),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});

test("persistence ingress rejects accessors, exceptional proxies, and noncanonical objects", async () => {
  const fixture = createPersistenceFixture("path-ingress-shapes");
  try {
    let getterCalls = 0;
    const accessorRequest = {};
    Object.defineProperties(accessorRequest, {
      runtimeRoot: {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error("must not run");
        },
      },
      sourceCheckoutRoot: { enumerable: true, value: fixture.sourceCheckoutRoot },
      projectRoots: { enumerable: true, value: [fixture.projectRoot] },
    });
    assert.throws(
      () => prepareRuntimeLayout(accessorRequest),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
    assert.equal(getterCalls, 0);

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    await assert.rejects(
      openPersistence(fixture.layout, revoked.proxy),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );

    class NoncanonicalRequest {
      applicationVersion = "test";
    }
    await assert.rejects(
      openPersistence(fixture.layout, new NoncanonicalRequest()),
      (error) => expectPersistenceError(error, "INVALID_INPUT"),
    );
  } finally {
    cleanupPersistenceFixture(fixture);
  }
});
