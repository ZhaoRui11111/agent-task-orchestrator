import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  createDomainSnapshot,
  createTask,
  inspectPrimaryIdentity,
  inspectRuntimeDoctor,
  openPersistence,
  prepareLocalRuntime,
  recoverInterruptedRestore,
  restoreBackup,
  trustedApplicationDataRoot,
  verifyBackupGeneration,
} from "../src/index.ts";
import {
  createBackupUnderLock,
  restoreBackupForTesting,
  verifyBackupGenerationForTesting,
} from "../src/persistence/backup.ts";
import { openPrimaryDatabase } from "../src/persistence/database.ts";
import {
  commitDomainForOwner,
  initializeDomainForOwner,
  readDomainForOwner,
} from "../src/persistence/application-repository.ts";
import { withLifecycleLock } from "../src/persistence/runtime.ts";
import { createBackupForTesting } from "../src/persistence/store.ts";
import { canonicalJson, readRegularFile, sha256 } from "../src/persistence/values.ts";
import {
  cleanupPersistenceFixture,
  authorizeTestLifecycle,
  createAuthorizedTestBackup,
  createPersistenceFixture,
  emptySnapshot,
  expectPersistenceError,
} from "./persistence-test-helpers.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCli = path.join(repoRoot, "src", "cli.ts");
const CURRENT_BACKUP_MANIFEST_FIELDS = Object.freeze([
  "applicationVersion",
  "createdAt",
  "databaseFile",
  "databaseLength",
  "databaseSha256",
  "generationId",
  "kind",
  "lifecycleAuthorizationId",
  "lifecycleAuthorizationSha256",
  "provenanceKind",
  "schemaVersion",
  "sourceApplicationStateSha256",
  "sourceHistory",
  "sourceRegistryIdentity",
  "sourceSchemaFingerprint",
  "sourceSchemaVersion",
].sort());
const CURRENT_RESTORE_INTENT_FIELDS = Object.freeze([
  "applicationVersion",
  "backupAuthorizationId",
  "backupAuthorizationSha256",
  "backupGenerationId",
  "backupManifestSchemaVersion",
  "backupManifestSha256",
  "createdAt",
  "expectedCurrent",
  "retainedDirectoryIdentity",
  "restoreAuthorizationId",
  "restoreAuthorizationSha256",
  "restoreAuthorizedStateSha256",
  "restoreId",
  "schemaVersion",
  "stageIdentity",
  "targetSchemaVersion",
].sort());
const CURRENT_RESTORE_RECEIPT_FIELDS = Object.freeze([
  "applicationVersion",
  "backupAuthorizationId",
  "backupAuthorizationSha256",
  "backupGenerationId",
  "backupManifestSha256",
  "previousIdentitySha256",
  "retainedDirectory",
  "retainedDirectoryIdentity",
  "restoredAt",
  "restoreAuthorizationId",
  "restoreAuthorizationSha256",
  "restoreAuthorizedStateSha256",
  "restoreId",
  "schemaVersion",
  "targetDatabaseSha256",
  "targetSchemaVersion",
].sort());

async function seedTask(store, body = "first") {
  const initialResult = createDomainSnapshot(emptySnapshot());
  assert.equal(initialResult.ok, true);
  const initial = initializeDomainForOwner(store, initialResult.value);
  const created = createTask(initial, {
    id: "task",
    projectId: "project",
    body,
    supersedesTaskId: null,
  });
  assert.equal(created.ok, true);
  return commitDomainForOwner(store, initial, created.value);
}

function runtimeInventory(root) {
  const entries = [];
  const visit = (current, relative) => {
    const stats = lstatSync(current, { bigint: true });
    const entry = {
      path: relative,
      kind: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
      mode: Number(stats.mode),
      mtimeNs: String(stats.mtimeNs),
      size: String(stats.size),
    };
    if (stats.isFile()) entry.sha256 = sha256(readFileSync(current));
    entries.push(entry);
    if (!stats.isDirectory()) return;
    for (const name of readdirSync(current).sort()) {
      visit(path.join(current, name), relative === "." ? name : `${relative}/${name}`);
    }
  };
  visit(root, ".");
  return entries;
}

function createCliPersistenceFixture(prefix) {
  const safePrefix = prefix.toLowerCase().replaceAll(/[^a-z0-9-]/gu, "-").slice(0, 12);
  const generation = mkdtempSync(path.join(tmpdir(), `${safePrefix}-`));
  const projectRoot = path.join(generation, "project");
  const applicationDataRoot = trustedApplicationDataRoot();
  mkdirSync(applicationDataRoot, { recursive: true });
  const trustedRoot = path.join(applicationDataRoot, `${safePrefix}-${randomUUID()}`);
  mkdirSync(projectRoot);
  const { layout } = prepareLocalRuntime(trustedRoot, repoRoot, [projectRoot]);
  return Object.freeze({ generation, layout, projectRoot, sourceCheckoutRoot: repoRoot });
}

function cleanupCliPersistenceFixture(fixture) {
  const applicationDataRoot = trustedApplicationDataRoot();
  assert.equal(
    path.resolve(path.dirname(fixture.layout.root)).toLowerCase(),
    path.resolve(realpathSync.native(applicationDataRoot)).toLowerCase(),
  );
  const stat = lstatSync(fixture.layout.root);
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true);
  rmSync(fixture.layout.root, { recursive: true, force: true });
  rmSync(fixture.generation, { recursive: true, force: true });
}

function invokeCli(fixture, args) {
  const child = spawnSync(process.execPath, [sourceCli, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
    timeout: 30_000,
  });
  assert.ifError(child.error);
  assert.equal(child.stderr, "");
  assert.match(child.stdout, /\n$/u);
  return Object.freeze({ status: child.status, body: JSON.parse(child.stdout) });
}

function initializeCliPersistenceFixture(fixture) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const initialized = invokeCli(fixture, [
    "--format", "json",
    "--runtime-root", fixture.layout.root,
    "init", "--expires-at", expiresAt,
    "--confirm", "INITIALIZE LOCAL RUNTIME",
  ]);
  assert.equal(initialized.status, 0, JSON.stringify(initialized.body));
}

function killBackupChild(fixture, authorization, hookName) {
  const payload = JSON.stringify({
    runtimeRoot: fixture.layout.root,
    sourceCheckoutRoot: fixture.sourceCheckoutRoot,
    projectRoot: fixture.projectRoot,
    authorization,
    hookName,
  });
  const script = `
    import { inspectExistingRuntimeLayout } from ${JSON.stringify(new URL("../src/persistence/runtime.ts", import.meta.url).href)};
    import { createBackupForTesting, openPersistence } from ${JSON.stringify(new URL("../src/persistence/store.ts", import.meta.url).href)};
    const input = JSON.parse(process.argv[1]);
    const layout = inspectExistingRuntimeLayout({
      runtimeRoot: input.runtimeRoot,
      sourceCheckoutRoot: input.sourceCheckoutRoot,
      projectRoots: [input.projectRoot],
    });
    const store = await openPersistence(layout, { applicationVersion: "backup-child" });
    const hooks = {
      [input.hookName]: () => process.kill(process.pid, "SIGKILL"),
    };
    await createBackupForTesting(store, input.authorization, hooks);
    await store.close();
    process.exitCode = 99;
  `;
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--input-type=module", "-e", script, payload],
    { cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: "utf8", timeout: 30_000 },
  );
}

function killOpenChild(fixture) {
  const payload = JSON.stringify({
    runtimeRoot: fixture.layout.root,
    sourceCheckoutRoot: fixture.sourceCheckoutRoot,
    projectRoot: fixture.projectRoot,
  });
  const script = `
    import { inspectExistingRuntimeLayout } from ${JSON.stringify(new URL("../src/persistence/runtime.ts", import.meta.url).href)};
    import { openPersistence } from ${JSON.stringify(new URL("../src/persistence/store.ts", import.meta.url).href)};
    const input = JSON.parse(process.argv[1]);
    const layout = inspectExistingRuntimeLayout({
      runtimeRoot: input.runtimeRoot,
      sourceCheckoutRoot: input.sourceCheckoutRoot,
      projectRoots: [input.projectRoot],
    });
    await openPersistence(layout, { applicationVersion: "open-child" });
    process.kill(process.pid, "SIGKILL");
  `;
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--input-type=module", "-e", script, payload],
    { cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: "utf8", timeout: 30_000 },
  );
}

test("manual backup refuses another reader, then publishes an exact authorized generation", async () => {
  const fixture = createPersistenceFixture("backup-online");
  let first;
  let second;
  try {
    first = await openPersistence(fixture.layout, { applicationVersion: "backup" });
    const snapshot = await seedTask(first);
    second = await openPersistence(fixture.layout, { applicationVersion: "reader" });
    await assert.rejects(createAuthorizedTestBackup(first), (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"));
    assert.deepEqual(readDomainForOwner(second), snapshot);
    await second.close();
    second = undefined;
    const generation = await createAuthorizedTestBackup(first);
    const verified = verifyBackupGeneration(fixture.layout, generation.generationId);
    assert.deepEqual(verified, generation);
    assert.equal(verified.manifest.schemaVersion, 2);
    assert.equal(verified.manifest.kind, "manual");
    assert.equal(verified.manifest.provenanceKind, "application");
    assert.equal(typeof verified.manifest.lifecycleAuthorizationId, "string");
    assert.match(verified.manifest.lifecycleAuthorizationSha256, /^[0-9A-F]{64}$/u);
    assert.match(verified.manifest.sourceApplicationStateSha256, /^[0-9A-F]{64}$/u);
    assert.equal(verified.manifest.sourceSchemaVersion, 1);
    assert.equal(verified.manifest.sourceHistory.length, 1);
    const directory = path.join(fixture.layout.backupGenerationsRoot, generation.generationId);
    assert.deepEqual(readdirSync(directory).sort(), ["manifest.json", "state.sqlite3"]);
    const manifestPath = path.join(directory, "manifest.json");
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(manifestPath, "utf8"))).sort(), CURRENT_BACKUP_MANIFEST_FIELDS);
    assert.equal(readFileSync(manifestPath, "utf8"), canonicalJson(verified.manifest));
    const database = new DatabaseSync(path.join(directory, "state.sqlite3"), { readOnly: true });
    assert.equal(String(Object.values(database.prepare("PRAGMA journal_mode").get())[0]).toLowerCase(), "delete");
    database.close();
  } finally {
    if (second) await second.close();
    if (first) await first.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("caught backup failures before rename remove only their owned stage", async () => {
  const failpoints = [
    "beforeStage",
    "afterStage",
    "beforeClone",
    "afterClone",
    "beforeAuthorizationRecheck",
    "beforeAuthorizationCommit",
    "afterAuthorizationCommit",
    "afterManifest",
    "beforePublish",
  ];
  for (const failpoint of failpoints) {
    const fixture = createPersistenceFixture(`backup-caught-${failpoint}`);
    let store;
    const generationId = randomUUID();
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "caught" });
      await seedTask(store);
      const authorization = authorizeTestLifecycle(store, "runtime.backup", generationId);
      await assert.rejects(
        createBackupForTesting(
          store,
          authorization,
          { [failpoint]: () => { throw new Error(`caught ${failpoint}`); } },
        ),
      );
      assert.deepEqual(readdirSync(fixture.layout.backupStagingRoot), []);
      assert.equal(
        existsSync(path.join(fixture.layout.backupGenerationsRoot, generationId)),
        false,
      );
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
      assert.equal(readdirSync(fixture.layout.connectionsRoot).length, 1);
      await store.close();
      store = undefined;
      assert.deepEqual(readdirSync(fixture.layout.connectionsRoot), []);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("real pre-rename process termination preserves lock, receipt, stage, and every route outcome", async () => {
  const failpoints = [
    "afterStage",
    "afterClone",
    "afterAuthorizationCommit",
    "afterManifest",
    "beforePublish",
  ];
  for (const failpoint of failpoints) {
    const fixture = createCliPersistenceFixture(`backup-kill-${failpoint}`);
    let store;
    const generationId = randomUUID();
    try {
      initializeCliPersistenceFixture(fixture);
      store = await openPersistence(fixture.layout, { applicationVersion: "kill" });
      const restorable = await createAuthorizedTestBackup(store);
      const backupAuthorization = authorizeTestLifecycle(store, "runtime.backup", generationId);
      await store.close();
      store = undefined;
      const primaryBefore = readRegularFile(fixture.layout.databasePath);

      const child = killBackupChild(fixture, backupAuthorization, failpoint);
      assert.notEqual(child.status, 0, `${failpoint} child unexpectedly returned: ${child.stderr}`);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), true);
      assert.equal(readdirSync(fixture.layout.connectionsRoot).length, 1);
      assert.deepEqual(readdirSync(fixture.layout.backupStagingRoot), [generationId]);
      assert.equal(
        existsSync(path.join(fixture.layout.backupGenerationsRoot, generationId)),
        false,
      );

      const residueInventory = runtimeInventory(fixture.layout.root);
      const assertResidueUnchanged = () =>
        assert.deepEqual(runtimeInventory(fixture.layout.root), residueInventory);
      assert.equal(
        inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).health,
        "runtime_active",
      );
      assertResidueUnchanged();

      const primaryAfter = readRegularFile(fixture.layout.databasePath);
      assert.deepEqual(primaryAfter.identity, primaryBefore.identity);
      assert.equal(sha256(primaryAfter.bytes), sha256(primaryBefore.bytes));
      assertResidueUnchanged();

      await assert.rejects(
        openPersistence(fixture.layout, { applicationVersion: "blocked-open" }),
        (error) => expectPersistenceError(error, "LIFECYCLE_BUSY"),
      );
      assertResidueUnchanged();

      const cliStatus = invokeCli(fixture, [
        "--format", "json", "--runtime-root", fixture.layout.root, "status",
      ]);
      assert.notEqual(cliStatus.status, 0);
      assert.equal(cliStatus.body.error.code, "RUNTIME_ACTIVE");
      assertResidueUnchanged();

      const cliBackup = invokeCli(fixture, [
        "--format", "json", "--runtime-root", fixture.layout.root, "backup", "create",
      ]);
      assert.notEqual(cliBackup.status, 0);
      assert.equal(cliBackup.body.error.code, "RUNTIME_ACTIVE");
      assertResidueUnchanged();

      const cliRestore = invokeCli(fixture, [
        "--format", "json", "--runtime-root", fixture.layout.root,
        "restore", "--generation-id", restorable.generationId,
        "--confirm", "RESTORE LOCAL BACKUP",
        "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
      ]);
      assert.notEqual(cliRestore.status, 0);
      assert.equal(cliRestore.body.error.code, "RUNTIME_ACTIVE");
      assertResidueUnchanged();

      await assert.rejects(
        inspectPrimaryIdentity(fixture.layout),
        (error) => expectPersistenceError(error, "LIFECYCLE_BUSY"),
      );
      assertResidueUnchanged();
      assert.deepEqual(readdirSync(fixture.layout.backupStagingRoot), [generationId]);
      assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), true);
    } finally {
      if (store) await store.close();
      cleanupCliPersistenceFixture(fixture);
    }
  }
});

test("receipt-only crash residue has one isolated exact outcome for every route", async () => {
  for (const route of ["doctor", "store", "cli", "backup", "restore", "identity"]) {
    const fixture = createCliPersistenceFixture(`receipt-only-${route}`);
    let store;
    const blockedGenerationId = randomUUID();
    try {
      initializeCliPersistenceFixture(fixture);
      store = await openPersistence(fixture.layout, { applicationVersion: "receipt-setup" });
      const restorable = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(
        store,
        "runtime.restore",
        restorable.generationId,
      );
      const backupAuthorization = authorizeTestLifecycle(
        store,
        "runtime.backup",
        blockedGenerationId,
      );
      await store.close();
      store = undefined;
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);

      const child = killOpenChild(fixture);
      assert.notEqual(child.status, 0, `${route} open child unexpectedly returned: ${child.stderr}`);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
      const receiptNames = readdirSync(fixture.layout.connectionsRoot);
      assert.equal(receiptNames.length, 1);
      const crashReceipt = path.join(fixture.layout.connectionsRoot, receiptNames[0]);
      const receiptEvidence = runtimeInventory(crashReceipt);

      if (route === "doctor") {
        assert.equal(
          inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).health,
          "runtime_active",
        );
      } else if (route === "store") {
        store = await openPersistence(fixture.layout, { applicationVersion: "receipt-reader" });
        assert.equal(readdirSync(fixture.layout.connectionsRoot).length, 2);
        await store.close();
        store = undefined;
      } else if (route === "cli") {
        const status = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root, "status",
        ]);
        assert.equal(status.status, 0, JSON.stringify(status.body));
        assert.equal(status.body.result.initialized, true);
      } else if (route === "backup") {
        store = await openPersistence(fixture.layout, { applicationVersion: "receipt-backup" });
        await assert.rejects(
          store.createBackup(backupAuthorization),
          (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
        );
        await store.close();
        store = undefined;
        const publicBackup = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root, "backup", "create",
        ]);
        assert.notEqual(publicBackup.status, 0);
        assert.equal(publicBackup.body.error.code, "RUNTIME_ACTIVE");
      } else if (route === "restore") {
        await assert.rejects(
          restoreBackup(fixture.layout, {
            generationId: restorable.generationId,
            expectedCurrent,
            acknowledgeDataLoss: true,
            applicationVersion: "receipt-restore",
            authorization: restoreAuthorization,
          }),
          (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
        );
        const publicRestore = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root,
          "restore", "--generation-id", restorable.generationId,
          "--confirm", "RESTORE LOCAL BACKUP",
          "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
        ]);
        assert.notEqual(publicRestore.status, 0);
        assert.equal(publicRestore.body.error.code, "RUNTIME_ACTIVE");
      } else {
        await assert.rejects(
          inspectPrimaryIdentity(fixture.layout),
          (error) => expectPersistenceError(error, "ACTIVE_CONNECTIONS"),
        );
      }

      assert.deepEqual(readdirSync(fixture.layout.connectionsRoot), receiptNames);
      assert.deepEqual(runtimeInventory(crashReceipt), receiptEvidence);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
      assert.deepEqual(readdirSync(fixture.layout.backupStagingRoot), []);
      assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
    } finally {
      if (store) await store.close();
      cleanupCliPersistenceFixture(fixture);
    }
  }
});

test("safe stage without lock or receipt preserves exact bytes across every route", async () => {
  for (const route of ["doctor", "store", "cli", "backup", "restore", "identity"]) {
    const fixture = createCliPersistenceFixture(`safe-stage-${route}`);
    let store;
    const blockedGenerationId = randomUUID();
    try {
      initializeCliPersistenceFixture(fixture);
      store = await openPersistence(fixture.layout, { applicationVersion: "stage-setup" });
      const restorable = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(
        store,
        "runtime.restore",
        restorable.generationId,
      );
      const backupAuthorization = authorizeTestLifecycle(
        store,
        "runtime.backup",
        blockedGenerationId,
      );
      await store.close();
      store = undefined;
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
      const residue = path.join(fixture.layout.backupStagingRoot, blockedGenerationId);
      mkdirSync(residue);
      writeFileSync(path.join(residue, "state.sqlite3"), "partial-backup");
      const residueEvidence = runtimeInventory(residue);
      assert.deepEqual(readdirSync(fixture.layout.connectionsRoot), []);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);

      if (route === "doctor") {
        assert.equal(
          inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).health,
          "backup_invalid",
        );
      } else if (route === "store") {
        store = await openPersistence(fixture.layout, { applicationVersion: "stage-reader" });
        await store.close();
        store = undefined;
      } else if (route === "cli") {
        const status = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root, "status",
        ]);
        assert.equal(status.status, 0, JSON.stringify(status.body));
        assert.equal(status.body.result.initialized, true);
      } else if (route === "backup") {
        store = await openPersistence(fixture.layout, { applicationVersion: "stage-backup" });
        await assert.rejects(
          store.createBackup(backupAuthorization),
          (error) => expectPersistenceError(error, "BACKUP_INVALID"),
        );
        await store.close();
        store = undefined;
        const publicBackup = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root, "backup", "create",
        ]);
        assert.notEqual(publicBackup.status, 0);
        assert.equal(publicBackup.body.error.code, "BACKUP_INVALID");
      } else if (route === "restore") {
        await assert.rejects(
          restoreBackup(fixture.layout, {
            generationId: restorable.generationId,
            expectedCurrent,
            acknowledgeDataLoss: true,
            applicationVersion: "stage-restore",
            authorization: restoreAuthorization,
          }),
          (error) => expectPersistenceError(error, "BACKUP_INVALID"),
        );
        const publicRestore = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root,
          "restore", "--generation-id", restorable.generationId,
          "--confirm", "RESTORE LOCAL BACKUP",
          "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
        ]);
        assert.notEqual(publicRestore.status, 0);
        assert.equal(publicRestore.body.error.code, "BACKUP_INVALID");
      } else {
        assert.deepEqual(await inspectPrimaryIdentity(fixture.layout), expectedCurrent);
      }

      assert.deepEqual(runtimeInventory(residue), residueEvidence);
      assert.deepEqual(readdirSync(fixture.layout.connectionsRoot), []);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
      assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
    } finally {
      if (store) await store.close();
      cleanupCliPersistenceFixture(fixture);
    }
  }
});

test("post-rename backup outcomes preserve immutable terminal generations", async () => {
  for (const outcome of ["caught-valid", "caught-invalid", "killed-valid"]) {
    const fixture = outcome === "killed-valid"
      ? createCliPersistenceFixture(`backup-post-rename-${outcome}`)
      : createPersistenceFixture(`backup-post-rename-${outcome}`);
    let store;
    const generationId = randomUUID();
    try {
      if (outcome === "killed-valid") initializeCliPersistenceFixture(fixture);
      store = await openPersistence(fixture.layout, { applicationVersion: "post-rename" });
      if (outcome !== "killed-valid") await seedTask(store);
      const restorable = outcome === "killed-valid"
        ? await createAuthorizedTestBackup(store)
        : null;
      const authorization = authorizeTestLifecycle(store, "runtime.backup", generationId);
      if (outcome === "killed-valid") {
        await store.close();
        store = undefined;
        const primaryBefore = readRegularFile(fixture.layout.databasePath);
        const child = killBackupChild(fixture, authorization, "afterPublish");
        assert.notEqual(child.status, 0, `post-rename child unexpectedly returned: ${child.stderr}`);
        assert.equal(existsSync(fixture.layout.lifecycleLockPath), true);
        assert.equal(readdirSync(fixture.layout.connectionsRoot).length, 1);
        assert.deepEqual(readdirSync(fixture.layout.backupStagingRoot), []);
        const residueInventory = runtimeInventory(fixture.layout.root);
        const assertResidueUnchanged = () =>
          assert.deepEqual(runtimeInventory(fixture.layout.root), residueInventory);

        assert.equal(verifyBackupGeneration(fixture.layout, generationId).generationId, generationId);
        assertResidueUnchanged();
        assert.equal(
          inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).health,
          "runtime_active",
        );
        assertResidueUnchanged();
        const primaryAfter = readRegularFile(fixture.layout.databasePath);
        assert.deepEqual(primaryAfter.identity, primaryBefore.identity);
        assert.equal(sha256(primaryAfter.bytes), sha256(primaryBefore.bytes));
        assertResidueUnchanged();
        await assert.rejects(
          openPersistence(fixture.layout, { applicationVersion: "post-kill-open" }),
          (error) => expectPersistenceError(error, "LIFECYCLE_BUSY"),
        );
        assertResidueUnchanged();
        const status = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root, "status",
        ]);
        assert.notEqual(status.status, 0);
        assert.equal(status.body.error.code, "RUNTIME_ACTIVE");
        assertResidueUnchanged();
        const publicBackup = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root, "backup", "create",
        ]);
        assert.notEqual(publicBackup.status, 0);
        assert.equal(publicBackup.body.error.code, "RUNTIME_ACTIVE");
        assertResidueUnchanged();
        const publicRestore = invokeCli(fixture, [
          "--format", "json", "--runtime-root", fixture.layout.root,
          "restore", "--generation-id", restorable.generationId,
          "--confirm", "RESTORE LOCAL BACKUP",
          "--acknowledge-data-loss", "DISCARD CURRENT LOCAL DATA",
        ]);
        assert.notEqual(publicRestore.status, 0);
        assert.equal(publicRestore.body.error.code, "RUNTIME_ACTIVE");
        assertResidueUnchanged();
        await assert.rejects(
          inspectPrimaryIdentity(fixture.layout),
          (error) => expectPersistenceError(error, "LIFECYCLE_BUSY"),
        );
        assertResidueUnchanged();
        continue;
      }

      const generation = outcome === "caught-valid"
        ? await createBackupForTesting(
            store,
            authorization,
            { afterPublish: () => { throw new Error("caught after publish"); } },
          )
        : null;
      if (outcome === "caught-valid") {
        assert.equal(generation.generationId, generationId);
        assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
        assert.equal(readdirSync(fixture.layout.connectionsRoot).length, 1);
        assert.equal(verifyBackupGeneration(fixture.layout, generationId).generationId, generationId);
        const retry = await createAuthorizedTestBackup(store);
        assert.notEqual(retry.generationId, generationId);
        continue;
      }

      await assert.rejects(
        createBackupForTesting(
          store,
          authorization,
          {
            afterPublish: () => {
              writeFileSync(
                path.join(fixture.layout.backupGenerationsRoot, generationId, "manifest.json"),
                "{}\n",
              );
              throw new Error("caught corrupt generation");
            },
          },
        ),
        (error) => expectPersistenceError(error, "BACKUP_INVALID"),
      );
      assert.equal(existsSync(path.join(fixture.layout.backupGenerationsRoot, generationId)), true);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
      assert.equal(readdirSync(fixture.layout.connectionsRoot).length, 1);
      await store.close();
      store = undefined;
      assert.equal(
        inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).health,
        "backup_invalid",
      );
    } finally {
      if (store) await store.close();
      if (outcome === "killed-valid") cleanupCliPersistenceFixture(fixture);
      else cleanupPersistenceFixture(fixture);
    }
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
      const generationId = randomUUID();
      const authorization = authorizeTestLifecycle(store, "runtime.backup", generationId);
      await store.close();
      store = undefined;
      database = openPrimaryDatabase(fixture.layout.databasePath);
      await assert.rejects(
        withLifecycleLock(fixture.layout, `backup-${boundary}`, (token) =>
          createBackupUnderLock(
            database,
            fixture.layout,
            "boundary",
            authorization,
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
    const generation = await createAuthorizedTestBackup(store);
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
      (error) => expectPersistenceError(error, "PATH_IDENTITY_CHANGED"),
    );
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("backup verification refuses missing, changed, extra, newer, or wrong-application material", async () => {
  for (const corruption of [
    "missing",
    "manifest",
    "noncanonical",
    "database",
    "inventory",
    "newer",
    "wrong-application",
  ]) {
    const fixture = createPersistenceFixture(`backup-corrupt-${corruption}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "corrupt" });
      await seedTask(store);
      const generation = await createAuthorizedTestBackup(store);
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
        database.prepare("UPDATE schema_metadata SET schema_version=6 WHERE singleton=1").run();
        database.exec("PRAGMA user_version=5");
        database.close();
        const databaseBytes = readFileSync(databasePath);
        const manifestPath = path.join(directory, "manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.databaseLength = databaseBytes.byteLength;
        manifest.databaseSha256 = sha256(databaseBytes);
        manifest.sourceSchemaVersion = 5;
        writeFileSync(manifestPath, canonicalJson(manifest));
      }
      if (corruption === "wrong-application") {
        const manifestPath = path.join(directory, "manifest.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.lifecycleAuthorizationId = "wrong-application-authorization";
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

test("schema-one and pre-upgrade backup artifacts are immutable invalid input", async () => {
  for (const provenance of ["schema-one", "pre-upgrade"]) {
    const fixture = createPersistenceFixture(`backup-history-${provenance}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "history" });
      await seedTask(store);
      const backup = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(
        store,
        "runtime.restore",
        backup.generationId,
      );
      await store.close();
      store = undefined;
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
      const manifestPath = path.join(
        fixture.layout.backupGenerationsRoot,
        backup.generationId,
        "manifest.json",
      );
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (provenance === "schema-one") {
        manifest.schemaVersion = 1;
        delete manifest.provenanceKind;
        delete manifest.lifecycleAuthorizationId;
        delete manifest.lifecycleAuthorizationSha256;
        delete manifest.sourceApplicationStateSha256;
      } else {
        manifest.kind = "pre_upgrade";
        manifest.provenanceKind = "pre_upgrade_internal";
        manifest.lifecycleAuthorizationId = null;
        manifest.lifecycleAuthorizationSha256 = null;
        manifest.sourceApplicationStateSha256 = null;
      }
      writeFileSync(manifestPath, canonicalJson(manifest));
      const generationDirectory = path.dirname(manifestPath);
      const generationBefore = runtimeInventory(generationDirectory);
      const primaryBefore = readRegularFile(fixture.layout.databasePath);

      assert.throws(
        () => verifyBackupGeneration(fixture.layout, backup.generationId),
        (error) => expectPersistenceError(error, "BACKUP_INVALID"),
      );
      await assert.rejects(
        restoreBackup(fixture.layout, {
          generationId: backup.generationId,
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: "history-restore",
          authorization: restoreAuthorization,
        }),
        (error) => expectPersistenceError(error, "BACKUP_INVALID"),
      );
      assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
      assert.deepEqual(runtimeInventory(generationDirectory), generationBefore);
      const primaryAfter = readRegularFile(fixture.layout.databasePath);
      assert.deepEqual(primaryAfter.identity, primaryBefore.identity);
      assert.equal(sha256(primaryAfter.bytes), sha256(primaryBefore.bytes));
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("restore rejects every substituted lifecycle handoff field before publishing intent", async () => {
  const fixture = createPersistenceFixture("restore-handoff-substitution");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "handoff" });
    await seedTask(store);
    const backup = await createAuthorizedTestBackup(store);
    const authorization = authorizeTestLifecycle(
      store,
      "runtime.restore",
      backup.generationId,
    );
    await store.close();
    store = undefined;
    const substitutions = Object.freeze({
      authorizationId: "substituted-authorization",
      operation: "runtime.backup",
      backupGenerationId: "22222222-2222-4222-8222-222222222222",
      actorId: "substituted-actor",
      runtimeRootKey: "substituted-root",
      grantId: "substituted-grant",
      grantRevision: authorization.grantRevision + 1,
      requestId: "substituted-request",
      decisionId: "substituted-decision",
      auditId: "substituted-audit",
      authorizedStateSha256: "B".repeat(64),
      expectedRequestCount: authorization.expectedRequestCount + 1,
      expectedDecisionCount: authorization.expectedDecisionCount + 1,
      expectedAuditCount: authorization.expectedAuditCount + 1,
      issuedAt: new Date(Date.parse(authorization.issuedAt) + 1).toISOString(),
      expiresAt: new Date(Date.parse(authorization.expiresAt) - 1).toISOString(),
    });
    for (const [field, value] of Object.entries(substitutions)) {
      const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
      const primaryBefore = readRegularFile(fixture.layout.databasePath);
      await assert.rejects(
        restoreBackup(fixture.layout, {
          generationId: backup.generationId,
          expectedCurrent,
          acknowledgeDataLoss: true,
          applicationVersion: "handoff-restore",
          authorization: { ...authorization, [field]: value },
        }),
        (error) => {
          assert.equal(error?.name, "PersistenceError", field);
          assert.equal(error?.code, "AUTHORIZATION_DENIED", field);
          return true;
        },
        field,
      );
      assert.equal(existsSync(fixture.layout.restoreIntentPath), false);
      assert.deepEqual(readdirSync(fixture.layout.restoreStagingRoot), []);
      assert.deepEqual(readdirSync(fixture.layout.restoreRetainedRoot), []);
      assert.deepEqual(readdirSync(fixture.layout.restoreReceiptsRoot), []);
      assert.equal(existsSync(fixture.layout.lifecycleLockPath), false);
      const primaryAfter = readRegularFile(fixture.layout.databasePath);
      assert.deepEqual(primaryAfter.identity, primaryBefore.identity);
      assert.equal(sha256(primaryAfter.bytes), sha256(primaryBefore.bytes));
    }
  } finally {
    if (store) await store.close();
    cleanupPersistenceFixture(fixture);
  }
});

test("restore requires acknowledgement, exact current file-set CAS, and zero connection receipts", async () => {
  const fixture = createPersistenceFixture("restore-preconditions");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
    const snapshot = await seedTask(store);
    const generation = await createAuthorizedTestBackup(store);
    const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
    await store.close();
    store = undefined;
    const originalIdentity = await inspectPrimaryIdentity(fixture.layout);
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: generation.generationId,
        expectedCurrent: originalIdentity,
        acknowledgeDataLoss: false,
        applicationVersion: "restore",
        authorization: restoreAuthorization,
      }),
      (error) => expectPersistenceError(error, "RESTORE_ACK_REQUIRED"),
    );
    store = await openPersistence(fixture.layout, { applicationVersion: "mutate" });
    const nextRestoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
    await store.close();
    store = undefined;
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: generation.generationId,
        expectedCurrent: originalIdentity,
        acknowledgeDataLoss: true,
        applicationVersion: "restore",
        authorization: nextRestoreAuthorization,
      }),
      (error) => expectPersistenceError(error, "RESTORE_CONFLICT"),
    );
    store = await openPersistence(fixture.layout, { applicationVersion: "active" });
    assert.deepEqual(readDomainForOwner(store), snapshot);
    const currentIdentity = originalIdentity;
    await assert.rejects(
      restoreBackup(fixture.layout, {
        generationId: generation.generationId,
        expectedCurrent: currentIdentity,
        acknowledgeDataLoss: true,
        applicationVersion: "restore",
        authorization: nextRestoreAuthorization,
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
    const generation = await createAuthorizedTestBackup(store);
    const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
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
          authorization: restoreAuthorization,
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
    assert.deepEqual(readDomainForOwner(store), backedUp);
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
      const generation = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
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
            authorization: restoreAuthorization,
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
    const generation = await createAuthorizedTestBackup(store);
    const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
    await store.close();
    store = undefined;
    const expectedCurrent = await inspectPrimaryIdentity(fixture.layout);
    assert.deepEqual(
      expectedCurrent.members.map((member) => member.fileName),
      ["state.sqlite3"],
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
          authorization: restoreAuthorization,
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
    assert.deepEqual(readDomainForOwner(store), backedUp);
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
      const generation = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
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
            authorization: restoreAuthorization,
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
      assert.deepEqual(readDomainForOwner(store), backedUp);
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

test("current restore intent is exact and retired or malformed intents remain blocked evidence", async () => {
  for (const corruption of ["schema-one", "missing-field", "extra-field", "noncanonical"]) {
    const fixture = createPersistenceFixture(`restore-intent-${corruption}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
      await seedTask(store);
      const generation = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
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
            authorization: restoreAuthorization,
          },
          { afterRetain: () => { throw new Error("interrupt"); } },
        ),
        (error) => expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED"),
      );
      const currentIntentBytes = readFileSync(fixture.layout.restoreIntentPath, "utf8");
      const intent = JSON.parse(currentIntentBytes);
      assert.equal(intent.schemaVersion, 2);
      assert.equal(intent.backupManifestSchemaVersion, 2);
      assert.deepEqual(Object.keys(intent).sort(), CURRENT_RESTORE_INTENT_FIELDS);
      assert.equal(currentIntentBytes, canonicalJson(intent));
      if (corruption === "schema-one") {
        intent.schemaVersion = 1;
        delete intent.backupAuthorizationId;
        delete intent.backupAuthorizationSha256;
        delete intent.backupManifestSchemaVersion;
        delete intent.restoreAuthorizationId;
        delete intent.restoreAuthorizationSha256;
        delete intent.restoreAuthorizedStateSha256;
      } else if (corruption === "missing-field") {
        delete intent.restoreAuthorizationId;
      } else if (corruption === "extra-field") {
        intent.unsupported = true;
      }
      writeFileSync(
        fixture.layout.restoreIntentPath,
        corruption === "noncanonical" ? `${JSON.stringify(intent, null, 2)}\n` : canonicalJson(intent),
      );
      const restoreBefore = runtimeInventory(fixture.layout.restoreRoot);
      await assert.rejects(
        recoverInterruptedRestore(fixture.layout),
        (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
      );
      assert.equal(inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).restoreState, "ambiguous");
      assert.deepEqual(runtimeInventory(fixture.layout.restoreRoot), restoreBefore);
      assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("current restore receipt is exact and retired or malformed receipts remain blocked evidence", async () => {
  for (const corruption of ["schema-one", "missing-field", "extra-field", "noncanonical"]) {
    const fixture = createPersistenceFixture(`restore-receipt-${corruption}`);
    let store;
    try {
      store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
      await seedTask(store);
      const generation = await createAuthorizedTestBackup(store);
      const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
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
            authorization: restoreAuthorization,
          },
          { afterReceipt: () => { throw new Error("interrupt"); } },
        ),
        (error) => {
          expectPersistenceError(error, "RESTORE_RECOVERY_REQUIRED");
          restoreId = error.details.restoreId;
          return true;
        },
      );
      assert.ok(restoreId);
      const receiptPath = path.join(fixture.layout.restoreReceiptsRoot, `${restoreId}.json`);
      const currentReceiptBytes = readFileSync(receiptPath, "utf8");
      const receipt = JSON.parse(currentReceiptBytes);
      assert.equal(receipt.schemaVersion, 2);
      assert.deepEqual(Object.keys(receipt).sort(), CURRENT_RESTORE_RECEIPT_FIELDS);
      assert.equal(currentReceiptBytes, canonicalJson(receipt));
      if (corruption === "schema-one") {
        receipt.schemaVersion = 1;
        delete receipt.backupAuthorizationId;
        delete receipt.backupAuthorizationSha256;
        delete receipt.backupManifestSha256;
        delete receipt.restoreAuthorizationId;
        delete receipt.restoreAuthorizationSha256;
        delete receipt.restoreAuthorizedStateSha256;
      } else if (corruption === "missing-field") {
        delete receipt.restoreAuthorizationId;
      } else if (corruption === "extra-field") {
        receipt.unsupported = true;
      }
      writeFileSync(
        receiptPath,
        corruption === "noncanonical" ? `${JSON.stringify(receipt, null, 2)}\n` : canonicalJson(receipt),
      );
      const restoreBefore = runtimeInventory(fixture.layout.restoreRoot);
      await assert.rejects(
        recoverInterruptedRestore(fixture.layout),
        (error) => expectPersistenceError(error, "RESTORE_BLOCKED"),
      );
      assert.equal(inspectRuntimeDoctor(fixture.layout.root, fixture.sourceCheckoutRoot).restoreState, "ambiguous");
      assert.deepEqual(runtimeInventory(fixture.layout.restoreRoot), restoreBefore);
      assert.equal(existsSync(fixture.layout.restoreIntentPath), true);
    } finally {
      if (store) await store.close();
      cleanupPersistenceFixture(fixture);
    }
  }
});

test("mixed or substituted recovery topology remains blocked for explicit inspection", async () => {
  const fixture = createPersistenceFixture("restore-mixed-topology");
  let store;
  try {
    store = await openPersistence(fixture.layout, { applicationVersion: "restore" });
    const backedUp = await seedTask(store);
    const generation = await createAuthorizedTestBackup(store);
    const restoreAuthorization = authorizeTestLifecycle(store, "runtime.restore", generation.generationId);
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
          authorization: restoreAuthorization,
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
