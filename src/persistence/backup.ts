import { randomUUID } from "node:crypto";
import {
  readdirSync,
  renameSync,
  rmdirSync,
} from "node:fs";
import path from "node:path";
import { backup } from "node:sqlite";
import {
  normalizeStandaloneDatabase,
  openReadOnlyDatabase,
  runWriteTransaction,
  type SqliteDatabase,
  verifyDatabaseIntegrity,
} from "./database.ts";
import { PersistenceError, persistenceFailure } from "./errors.ts";
import {
  currentSchemaVersion,
  inspectSchemaEvidence,
  type MigrationHistoryEntry,
  type SchemaEvidence,
} from "./migrations.ts";
import {
  applicationStateSha256,
  lifecycleAuthorizationSha256,
  parseApplicationLifecycleAuthorization,
  readApplicationState,
  validateLifecycleAuthorizationForUse,
  validateLifecycleAuthorizationForUseUntransactional,
  type ApplicationLifecycleAuthorization,
} from "./application-repository.ts";
import {
  assertOwnedRuntimeDirectory,
  assertRuntimeLayout,
  captureOwnedRuntimeDirectory,
  createOwnedRuntimeDirectory,
  ensureNoConnectionReceipts,
  hasRestoreIntent,
  PRIMARY_RUNTIME_MEMBER_NAMES,
  primaryRuntimeMemberPath,
  type DirectoryIdentity,
  type LifecycleLockToken,
  type OwnedRuntimeDirectory,
  type PrimaryRuntimeMemberName,
  type RuntimeLayout,
  sameDirectoryIdentity,
  withLifecycleLock,
} from "./runtime.ts";
import {
  canonicalArray,
  canonicalJson,
  decodeUtf8,
  enforcePrivateRegularFile,
  exactRecord,
  type FileIdentity,
  inspectRegularFile,
  isCanonicalUtcTimestamp,
  isNonemptyString,
  pathEntryExistsNoFollow,
  readRegularFile,
  reservePrivateRegularFile,
  sameFileIdentity,
  sameFileObjectIdentity,
  sha256,
  unlinkOwnedFile,
  writeExclusiveFile,
} from "./values.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BACKUP_DATABASE_FILE = "state.sqlite3" as const;
const BACKUP_MANIFEST_FILE = "manifest.json" as const;
export type BackupKind = "manual";

export interface BackupManifest {
  readonly schemaVersion: 2;
  readonly generationId: string;
  readonly kind: "manual";
  readonly databaseFile: "state.sqlite3";
  readonly databaseLength: number;
  readonly databaseSha256: string;
  readonly sourceSchemaVersion: number;
  readonly sourceRegistryIdentity: string;
  readonly sourceSchemaFingerprint: string;
  readonly sourceHistory: readonly MigrationHistoryEntry[];
  readonly applicationVersion: string;
  readonly createdAt: string;
  readonly provenanceKind: "application";
  readonly lifecycleAuthorizationId: string;
  readonly lifecycleAuthorizationSha256: string;
  readonly sourceApplicationStateSha256: string;
}

export interface BackupGeneration {
  readonly generationId: string;
  readonly manifest: BackupManifest;
}

export interface PrimaryFileMember {
  readonly fileName: PrimaryRuntimeMemberName;
  readonly dev: string;
  readonly ino: string;
  readonly mode: number;
  readonly length: number;
  readonly sha256: string;
}

export interface PrimaryIdentity {
  readonly schemaVersion: 1;
  readonly members: readonly PrimaryFileMember[];
  readonly identitySha256: string;
}

export interface RestoreRequest {
  readonly generationId: string;
  readonly expectedCurrent: PrimaryIdentity;
  readonly acknowledgeDataLoss: true;
  readonly applicationVersion: string;
  readonly authorization: ApplicationLifecycleAuthorization;
}

export interface RestoreReceipt {
  readonly schemaVersion: 2;
  readonly restoreId: string;
  readonly backupGenerationId: string;
  readonly restoredAt: string;
  readonly applicationVersion: string;
  readonly previousIdentitySha256: string;
  readonly targetDatabaseSha256: string;
  readonly targetSchemaVersion: number;
  readonly retainedDirectory: string;
  readonly retainedDirectoryIdentity: DirectoryIdentity;
  readonly backupManifestSha256: string;
  readonly backupAuthorizationId: string;
  readonly backupAuthorizationSha256: string;
  readonly restoreAuthorizationId: string;
  readonly restoreAuthorizationSha256: string;
  readonly restoreAuthorizedStateSha256: string;
}

interface RestoreIntent {
  readonly schemaVersion: 2;
  readonly restoreId: string;
  readonly backupGenerationId: string;
  readonly backupManifestSha256: string;
  readonly applicationVersion: string;
  readonly expectedCurrent: PrimaryIdentity;
  readonly stageIdentity: PrimaryFileMember;
  readonly retainedDirectoryIdentity: DirectoryIdentity;
  readonly targetSchemaVersion: number;
  readonly createdAt: string;
  readonly backupManifestSchemaVersion: 2;
  readonly backupAuthorizationId: string;
  readonly backupAuthorizationSha256: string;
  readonly restoreAuthorizationId: string;
  readonly restoreAuthorizationSha256: string;
  readonly restoreAuthorizedStateSha256: string;
}

export interface RestoreTestHooks {
  readonly afterStage?: () => void;
  readonly beforeIntent?: () => void;
  readonly afterIntent?: () => void;
  readonly beforeRetainMember?: (fileName: string) => void;
  readonly beforeTargetPublish?: () => void;
  readonly afterRetain?: () => void;
  readonly afterPublish?: () => void;
  readonly afterReceipt?: () => void;
}

export interface BackupTestHooks {
  readonly beforeStage?: () => void;
  readonly afterStage?: () => void;
  readonly beforeClone?: () => void;
  readonly afterClone?: () => void;
  readonly beforeAuthorizationRecheck?: () => void;
  readonly beforeAuthorizationCommit?: () => void;
  readonly afterAuthorizationCommit?: () => void;
  readonly afterManifest?: () => void;
  readonly beforePublish?: () => void;
  readonly afterPublish?: () => void;
}

export interface BackupVerificationTestHooks {
  readonly afterDatabaseRead?: () => void;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
}

function assertUuid(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw persistenceFailure("INVALID_INPUT", `${label} is not a canonical generation identifier`);
  }
}

function createPrivateDirectory(
  layout: RuntimeLayout,
  parent: string,
  identifier: string,
): OwnedRuntimeDirectory {
  assertUuid(identifier, "Directory identifier");
  try {
    return createOwnedRuntimeDirectory(layout, parent, identifier);
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("BACKUP_CONFLICT", "Private generation directory could not be created exclusively", {}, error);
  }
}

function parseDirectoryIdentity(value: unknown, label: string): DirectoryIdentity {
  const record = exactRecord(value, ["dev", "ino", "mode"], label);
  if (
    !isNonemptyString(record.dev) ||
    !isNonemptyString(record.ino) ||
    typeof record.mode !== "number" ||
    !Number.isSafeInteger(record.mode)
  ) {
    throw persistenceFailure("INVALID_INPUT", `${label} is invalid`);
  }
  return Object.freeze({ dev: record.dev, ino: record.ino, mode: record.mode });
}

function parseHistory(value: unknown): readonly MigrationHistoryEntry[] {
  const entries = canonicalArray(value, "backup sourceHistory");
  return Object.freeze(
    entries.map((entry, index) => {
      const record = exactRecord(
        entry,
        ["applicationVersion", "appliedAt", "checksumSha256", "migrationId", "version"],
        `backup sourceHistory[${index}]`,
      );
      if (
        record.version !== index + 1 ||
        !isNonemptyString(record.migrationId) ||
        !isSha256(record.checksumSha256) ||
        !isCanonicalUtcTimestamp(record.appliedAt) ||
        !isNonemptyString(record.applicationVersion)
      ) {
        throw persistenceFailure("BACKUP_INVALID", "Backup history entry is invalid", { index });
      }
      return Object.freeze({
        version: record.version,
        migrationId: record.migrationId,
        checksumSha256: record.checksumSha256,
        appliedAt: record.appliedAt,
        applicationVersion: record.applicationVersion,
      });
    }),
  );
}

function parseBackupManifest(value: unknown): BackupManifest {
  const record = exactRecord(
    value,
    [
      "applicationVersion",
      "createdAt",
      "databaseFile",
      "databaseLength",
      "databaseSha256",
      "generationId",
      "kind",
      "schemaVersion",
      "sourceHistory",
      "sourceRegistryIdentity",
      "sourceSchemaFingerprint",
      "sourceSchemaVersion",
      "lifecycleAuthorizationId",
      "lifecycleAuthorizationSha256",
      "provenanceKind",
      "sourceApplicationStateSha256",
    ],
    "backup manifest",
  );
  assertUuid(record.generationId, "Backup generationId");
  if (
    record.schemaVersion !== 2 ||
    record.kind !== "manual" ||
    record.databaseFile !== BACKUP_DATABASE_FILE ||
    typeof record.databaseLength !== "number" ||
    !Number.isSafeInteger(record.databaseLength) ||
    record.databaseLength <= 0 ||
    !isSha256(record.databaseSha256) ||
    typeof record.sourceSchemaVersion !== "number" ||
    !Number.isSafeInteger(record.sourceSchemaVersion) ||
    record.sourceSchemaVersion !== currentSchemaVersion() ||
    !isSha256(record.sourceRegistryIdentity) ||
    !isSha256(record.sourceSchemaFingerprint) ||
    !isNonemptyString(record.applicationVersion) ||
    !isCanonicalUtcTimestamp(record.createdAt) ||
    record.provenanceKind !== "application" ||
    !isNonemptyString(record.lifecycleAuthorizationId) ||
    !isSha256(record.lifecycleAuthorizationSha256) ||
    !isSha256(record.sourceApplicationStateSha256)
  ) {
    throw persistenceFailure("BACKUP_INVALID", "Backup manifest contains an invalid field");
  }
  return Object.freeze({
    schemaVersion: 2 as const,
    generationId: record.generationId,
    kind: "manual" as const,
    databaseFile: BACKUP_DATABASE_FILE,
    databaseLength: record.databaseLength,
    databaseSha256: record.databaseSha256,
    sourceSchemaVersion: record.sourceSchemaVersion,
    sourceRegistryIdentity: record.sourceRegistryIdentity,
    sourceSchemaFingerprint: record.sourceSchemaFingerprint,
    sourceHistory: parseHistory(record.sourceHistory),
    applicationVersion: record.applicationVersion,
    createdAt: record.createdAt,
    provenanceKind: "application" as const,
    lifecycleAuthorizationId: record.lifecycleAuthorizationId,
    lifecycleAuthorizationSha256: record.lifecycleAuthorizationSha256,
    sourceApplicationStateSha256: record.sourceApplicationStateSha256,
  });
}

function decodeBackupManifest(value: unknown): BackupManifest {
  try {
    return parseBackupManifest(value);
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "PersistenceError" &&
      (error as PersistenceError).code === "BACKUP_INVALID"
    ) {
      throw error;
    }
    throw persistenceFailure("BACKUP_INVALID", "Backup manifest schema is invalid", {}, error);
  }
}

function readJsonFile(
  filePath: string,
  label: string,
  errorCode: "BACKUP_INVALID" | "RESTORE_BLOCKED" = "BACKUP_INVALID",
): Readonly<{ value: unknown; identity: FileIdentity; bytes: Uint8Array }> {
  const read = readRegularFile(filePath);
  let value: unknown;
  try {
    const text = decodeUtf8(read.bytes, label);
    value = JSON.parse(text);
    if (text !== canonicalJson(value)) {
      throw persistenceFailure(errorCode, `${label} is not in canonical JSON form`);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "PersistenceError" &&
      (error as PersistenceError).code === errorCode
    ) {
      throw error;
    }
    throw persistenceFailure(errorCode, `${label} is not canonical JSON`, {}, error);
  }
  return Object.freeze({ value, identity: read.identity, bytes: read.bytes });
}

interface VerifiedStandaloneDatabase {
  readonly evidence: SchemaEvidence;
  readonly identity: FileIdentity;
  readonly checksumSha256: string;
}

function verifyStandaloneDatabase(
  databasePath: string,
  expected?: Readonly<{ identity: FileIdentity; checksumSha256: string }>,
): VerifiedStandaloneDatabase {
  const before = readRegularFile(databasePath);
  const beforeChecksum = sha256(before.bytes);
  if (
    expected !== undefined &&
    (!sameFileIdentity(before.identity, expected.identity) || beforeChecksum !== expected.checksumSha256)
  ) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Standalone database binding changed before readback");
  }
  const database = openReadOnlyDatabase(databasePath);
  let evidence: SchemaEvidence;
  try {
    evidence = inspectSchemaEvidence(database);
    verifyDatabaseIntegrity(database);
    readApplicationState(database);
  } finally {
    database.close();
  }
  const after = readRegularFile(databasePath);
  const afterChecksum = sha256(after.bytes);
  if (!sameFileIdentity(before.identity, after.identity) || beforeChecksum !== afterChecksum) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Standalone database binding changed during readback");
  }
  return Object.freeze({ evidence, identity: after.identity, checksumSha256: afterChecksum });
}

function assertBackupInventory(layout: RuntimeLayout, directory: OwnedRuntimeDirectory): void {
  assertOwnedRuntimeDirectory(layout, directory);
  const names = readdirSync(directory.path).sort();
  if (canonicalJson(names) !== canonicalJson([BACKUP_MANIFEST_FILE, BACKUP_DATABASE_FILE].sort())) {
    throw persistenceFailure("BACKUP_INVALID", "Backup generation inventory is not exact");
  }
  assertOwnedRuntimeDirectory(layout, directory);
}

interface BackupBinding {
  readonly directory: OwnedRuntimeDirectory;
  readonly manifestIdentity: FileIdentity;
  readonly manifestChecksumSha256: string;
  readonly databaseIdentity: FileIdentity;
  readonly databaseChecksumSha256: string;
}

const backupBindings = new WeakMap<object, BackupBinding>();

function assertBackupBinding(layout: RuntimeLayout, generation: BackupGeneration): BackupBinding {
  const binding = backupBindings.get(generation as object);
  if (binding === undefined) {
    throw persistenceFailure("BACKUP_INVALID", "Backup generation was not issued by the verifier");
  }
  assertBackupInventory(layout, binding.directory);
  const manifest = readRegularFile(path.join(binding.directory.path, BACKUP_MANIFEST_FILE));
  const database = readRegularFile(path.join(binding.directory.path, BACKUP_DATABASE_FILE));
  if (
    !sameFileIdentity(manifest.identity, binding.manifestIdentity) ||
    sha256(manifest.bytes) !== binding.manifestChecksumSha256 ||
    !sameFileIdentity(database.identity, binding.databaseIdentity) ||
    sha256(database.bytes) !== binding.databaseChecksumSha256
  ) {
    throw persistenceFailure("BACKUP_INVALID", "Backup generation binding changed after verification");
  }
  assertBackupInventory(layout, binding.directory);
  return binding;
}

function verifyBackupGenerationWithHooks(
  layout: RuntimeLayout,
  generationId: string,
  hooks: BackupVerificationTestHooks,
): BackupGeneration {
  assertRuntimeLayout(layout);
  assertUuid(generationId, "Backup generationId");
  try {
    if (!pathEntryExistsNoFollow(path.join(layout.backupGenerationsRoot, generationId))) {
      throw persistenceFailure("NOT_FOUND", "Backup generation is absent");
    }
    const directory = captureOwnedRuntimeDirectory(layout, layout.backupGenerationsRoot, generationId);
    assertBackupInventory(layout, directory);
    const manifestRead = readJsonFile(path.join(directory.path, BACKUP_MANIFEST_FILE), "backup manifest");
    const manifest = decodeBackupManifest(manifestRead.value);
    if (manifest.generationId !== generationId) {
      throw persistenceFailure("BACKUP_INVALID", "Backup directory and manifest identities differ");
    }
    const databasePath = path.join(directory.path, BACKUP_DATABASE_FILE);
    const databaseRead = readRegularFile(databasePath);
    if (
      databaseRead.bytes.byteLength !== manifest.databaseLength ||
      sha256(databaseRead.bytes) !== manifest.databaseSha256
    ) {
      throw persistenceFailure("BACKUP_INVALID", "Backup database bytes do not match the manifest");
    }
    hooks.afterDatabaseRead?.();
    assertOwnedRuntimeDirectory(layout, directory);
    const verified = verifyStandaloneDatabase(databasePath, {
      identity: databaseRead.identity,
      checksumSha256: manifest.databaseSha256,
    });
    const evidence = verified.evidence;
    if (
      evidence.schemaVersion !== manifest.sourceSchemaVersion ||
      evidence.registryIdentity !== manifest.sourceRegistryIdentity ||
      evidence.schemaFingerprint !== manifest.sourceSchemaFingerprint ||
      canonicalJson(evidence.history) !== canonicalJson(manifest.sourceHistory)
    ) {
      throw persistenceFailure("BACKUP_INVALID", "Backup database readback does not match its manifest");
    }
    const provenanceDatabase = openReadOnlyDatabase(databasePath);
    try {
      const state = readApplicationState(provenanceDatabase);
      const authorization = state.lifecycle.find(
        (candidate) => candidate.authorizationId === manifest.lifecycleAuthorizationId,
      );
      const stateSha256 = authorization === undefined
        ? null
        : applicationStateSha256(state);
      if (
        authorization === undefined ||
        authorization.operation !== "runtime.backup" ||
        authorization.backupGenerationId !== generationId ||
        lifecycleAuthorizationSha256(authorization) !== manifest.lifecycleAuthorizationSha256 ||
        authorization.authorizedStateSha256 !== manifest.sourceApplicationStateSha256 ||
        stateSha256 !== manifest.sourceApplicationStateSha256
      ) {
        throw persistenceFailure("BACKUP_INVALID", "Backup application provenance does not match the cloned state");
      }
    } finally {
      provenanceDatabase.close();
    }
    assertBackupInventory(layout, directory);
    const terminalManifest = readRegularFile(path.join(directory.path, BACKUP_MANIFEST_FILE));
    const terminalDatabase = readRegularFile(databasePath);
    if (
      !sameFileIdentity(manifestRead.identity, terminalManifest.identity) ||
      sha256(manifestRead.bytes) !== sha256(terminalManifest.bytes) ||
      !sameFileIdentity(verified.identity, terminalDatabase.identity) ||
      verified.checksumSha256 !== sha256(terminalDatabase.bytes)
    ) {
      throw persistenceFailure("BACKUP_INVALID", "Backup generation changed during terminal readback");
    }
    const generation = Object.freeze({ generationId, manifest });
    backupBindings.set(generation, Object.freeze({
      directory,
      manifestIdentity: manifestRead.identity,
      manifestChecksumSha256: sha256(manifestRead.bytes),
      databaseIdentity: verified.identity,
      databaseChecksumSha256: verified.checksumSha256,
    }));
    assertBackupBinding(layout, generation);
    return generation;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "PersistenceError" &&
      ["BACKUP_INVALID", "NOT_FOUND", "PATH_IDENTITY_CHANGED", "UNSAFE_RUNTIME_ROOT"].includes(
        (error as PersistenceError).code,
      )
    ) {
      throw error;
    }
    throw persistenceFailure("BACKUP_INVALID", "Backup generation could not be verified", {}, error);
  }
}

export function verifyBackupGeneration(layout: RuntimeLayout, generationId: string): BackupGeneration {
  return verifyBackupGenerationWithHooks(layout, generationId, {});
}

export function verifyBackupGenerationForTesting(
  layout: RuntimeLayout,
  generationId: string,
  hooks: BackupVerificationTestHooks,
): BackupGeneration {
  return verifyBackupGenerationWithHooks(layout, generationId, hooks);
}

export type RestoreInventoryState = "none" | "pending" | "ambiguous";

export function inspectRestoreInventory(layout: RuntimeLayout): RestoreInventoryState {
  assertRuntimeLayout(layout);
  const stageNames = readdirSync(layout.restoreStagingRoot).sort();
  const retainedNames = readdirSync(layout.restoreRetainedRoot).sort();
  const receiptNames = readdirSync(layout.restoreReceiptsRoot).sort();
  assertRuntimeLayout(layout);
  if (hasRestoreIntent(layout)) {
    try {
      const pending = readRestoreIntent(layout).intent;
      const expectedStage = `${pending.restoreId}.sqlite3`;
      const expectedReceipt = `${pending.restoreId}.json`;
      if (
        !retainedNames.includes(pending.restoreId) ||
        retainedNames.some((name) => name !== pending.restoreId) ||
        stageNames.some((name) => name !== expectedStage) ||
        receiptNames.some((name) => name !== expectedReceipt)
      ) {
        return "ambiguous";
      }
      assertRetainedDirectory(layout, pending);
      existingReceipt(layout, pending);
      return "pending";
    } catch (error) {
      if (error instanceof PersistenceError &&
          (error.code === "PATH_IDENTITY_CHANGED" || error.code === "UNSAFE_RUNTIME_ROOT")) throw error;
      return "ambiguous";
    }
  }
  if (stageNames.length !== 0) return "ambiguous";
  if (retainedNames.length === 0 && receiptNames.length === 0) return "none";
  if (retainedNames.length !== receiptNames.length) return "ambiguous";
  try {
    for (const restoreId of retainedNames) {
      assertUuid(restoreId, "Retained restore identifier");
      const expectedReceiptName = `${restoreId}.json`;
      if (!receiptNames.includes(expectedReceiptName)) return "ambiguous";
      const directory = captureOwnedRuntimeDirectory(layout, layout.restoreRetainedRoot, restoreId);
      const names = readdirSync(directory.path).sort();
      if (
        !names.includes(BACKUP_DATABASE_FILE) ||
        names.some((name) => !PRIMARY_RUNTIME_MEMBER_NAMES.includes(name as PrimaryRuntimeMemberName))
      ) {
        return "ambiguous";
      }
      for (const name of names) readRegularFile(path.join(directory.path, name));
      assertOwnedRuntimeDirectory(layout, directory);
      const receiptRead = readJsonFile(
        path.join(layout.restoreReceiptsRoot, expectedReceiptName),
        "restore receipt",
        "RESTORE_BLOCKED",
      );
      const receipt = parseRestoreReceipt(receiptRead.value);
      if (
        receipt.restoreId !== restoreId ||
        receipt.retainedDirectory !== restoreId ||
        !sameDirectoryIdentity(receipt.retainedDirectoryIdentity, directory.identity)
      ) {
        return "ambiguous";
      }
    }
    assertRuntimeLayout(layout);
    return "none";
  } catch (error) {
    if (error instanceof PersistenceError &&
        (error.code === "PATH_IDENTITY_CHANGED" || error.code === "UNSAFE_RUNTIME_ROOT")) throw error;
    return "ambiguous";
  }
}

async function cloneDatabase(
  source: SqliteDatabase,
  targetPath: string,
  assertContainer: () => void,
  assertSource: () => void,
  afterClone?: () => void,
): Promise<FileIdentity> {
  assertContainer();
  assertSource();
  if (pathEntryExistsNoFollow(targetPath)) {
    throw persistenceFailure("BACKUP_CONFLICT", "SQLite backup target already exists");
  }
  const reserved = reservePrivateRegularFile(targetPath);
  assertContainer();
  if (!sameFileIdentity(reserved, inspectRegularFile(targetPath))) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "SQLite backup reservation identity changed");
  }
  try {
    await backup(source, targetPath);
    afterClone?.();
    assertSource();
    assertContainer();
    const cloned = enforcePrivateRegularFile(targetPath);
    if (!sameFileObjectIdentity(reserved, cloned) || cloned.size <= 0) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "SQLite backup target identity changed during clone");
    }
    normalizeStandaloneDatabase(targetPath);
    assertSource();
    assertContainer();
    const normalized = enforcePrivateRegularFile(targetPath);
    if (!sameFileObjectIdentity(reserved, normalized) || normalized.size <= 0) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "SQLite backup target identity changed during normalization");
    }
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("BACKUP_INVALID", "SQLite online backup did not complete", {}, error);
  }
}

function assertNoBackupStagingResidue(layout: RuntimeLayout): void {
  assertRuntimeLayout(layout);
  const names = readdirSync(layout.backupStagingRoot);
  assertRuntimeLayout(layout);
  if (names.length !== 0) {
    throw persistenceFailure("BACKUP_INVALID", "Backup staging inventory contains unpublished residue");
  }
}

function cleanupOwnedBackupStage(layout: RuntimeLayout, directory: OwnedRuntimeDirectory): void {
  try {
    assertOwnedRuntimeDirectory(layout, directory);
    const names = readdirSync(directory.path).sort();
    if (names.some((name) => name !== BACKUP_DATABASE_FILE && name !== BACKUP_MANIFEST_FILE)) return;
    const members = names.map((name) => {
      const filePath = path.join(directory.path, name);
      const read = readRegularFile(filePath);
      return Object.freeze({ filePath, identity: read.identity, checksumSha256: sha256(read.bytes) });
    });
    assertOwnedRuntimeDirectory(layout, directory);
    if (canonicalJson(readdirSync(directory.path).sort()) !== canonicalJson(names)) return;
    for (const member of members) {
      assertOwnedRuntimeDirectory(layout, directory);
      unlinkOwnedFile(member.filePath, member.identity, member.checksumSha256);
    }
    assertOwnedRuntimeDirectory(layout, directory);
    if (readdirSync(directory.path).length !== 0) return;
    rmdirSync(directory.path);
    if (pathEntryExistsNoFollow(directory.path)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned backup stage remained after cleanup");
    }
    assertRuntimeLayout(layout);
  } catch {
    // Fail closed: an ownership or inventory ambiguity preserves the residue for doctor.
  }
}

export async function createBackupUnderLock(
  database: SqliteDatabase,
  layout: RuntimeLayout,
  applicationVersion: string,
  authorization: ApplicationLifecycleAuthorization,
  token: LifecycleLockToken,
  hooks: BackupTestHooks = {},
): Promise<BackupGeneration> {
  assertRuntimeLayout(layout);
  token.assertHeld();
  if (!isNonemptyString(applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "applicationVersion must be nonempty");
  }
  const generationId = authorization.backupGenerationId;
  assertUuid(generationId, "Backup generationId");
  let stageDirectory: OwnedRuntimeDirectory | null = null;
  let published = false;
  try {
    assertNoBackupStagingResidue(layout);
    validateLifecycleAuthorizationForUse(
      database,
      authorization,
      "runtime.backup",
      generationId,
      new Date().toISOString(),
    );
    hooks.beforeStage?.();
    stageDirectory = createPrivateDirectory(layout, layout.backupStagingRoot, generationId);
    const ownedStage = stageDirectory;
  hooks.afterStage?.();
  const sourceIdentity = inspectRegularFile(layout.databasePath);
  const assertSource = (): void => {
    assertRuntimeLayout(layout);
    const observed = inspectRegularFile(layout.databasePath);
    if (!sameFileObjectIdentity(sourceIdentity, observed)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup source database identity changed");
    }
  };
  const stageDatabasePath = path.join(ownedStage.path, BACKUP_DATABASE_FILE);
  hooks.beforeClone?.();
  await cloneDatabase(
    database,
    stageDatabasePath,
    () => assertOwnedRuntimeDirectory(layout, ownedStage),
    assertSource,
    hooks.afterClone,
  );
  token.assertHeld();
  assertSource();
  assertOwnedRuntimeDirectory(layout, ownedStage);
  const verified = verifyStandaloneDatabase(stageDatabasePath);
  assertOwnedRuntimeDirectory(layout, ownedStage);
  const evidence = verified.evidence;
  const terminalAuthorization = runWriteTransaction(database, () => {
    hooks.beforeAuthorizationRecheck?.();
    const currentAuthorization = validateLifecycleAuthorizationForUseUntransactional(
      database,
      authorization,
      "runtime.backup",
      generationId,
      new Date().toISOString(),
    );
    hooks.beforeAuthorizationCommit?.();
    return currentAuthorization;
  });
  hooks.afterAuthorizationCommit?.();
  const clonedDatabase = openReadOnlyDatabase(stageDatabasePath);
  try {
    const clonedState = readApplicationState(clonedDatabase);
    const clonedStateSha256 = applicationStateSha256(clonedState);
    if (clonedStateSha256 !== terminalAuthorization.stateSha256) {
      throw persistenceFailure("BACKUP_CONFLICT", "Cloned state does not match lifecycle authorization");
    }
  } finally {
    clonedDatabase.close();
  }
  const manifest: BackupManifest = Object.freeze({
    schemaVersion: 2,
    generationId,
    kind: "manual",
    databaseFile: BACKUP_DATABASE_FILE,
    databaseLength: verified.identity.size,
    databaseSha256: verified.checksumSha256,
    sourceSchemaVersion: evidence.schemaVersion,
    sourceRegistryIdentity: evidence.registryIdentity,
    sourceSchemaFingerprint: evidence.schemaFingerprint,
    sourceHistory: evidence.history,
    applicationVersion,
    createdAt: new Date().toISOString(),
    provenanceKind: "application",
    lifecycleAuthorizationId: authorization.authorizationId,
    lifecycleAuthorizationSha256: lifecycleAuthorizationSha256(authorization),
    sourceApplicationStateSha256: terminalAuthorization.stateSha256,
  });
  const manifestPath = path.join(stageDirectory.path, BACKUP_MANIFEST_FILE);
  const manifestBytes = canonicalJson(manifest);
  token.assertHeld();
  assertSource();
  assertOwnedRuntimeDirectory(layout, ownedStage);
  const manifestIdentity = writeExclusiveFile(manifestPath, manifestBytes);
  const enforcedManifest = enforcePrivateRegularFile(manifestPath);
  if (!sameFileIdentity(manifestIdentity, enforcedManifest)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup manifest identity changed during publication");
  }
  hooks.afterManifest?.();
  assertOwnedRuntimeDirectory(layout, ownedStage);
  const generationDirectory = path.join(layout.backupGenerationsRoot, generationId);
  if (pathEntryExistsNoFollow(generationDirectory)) {
    throw persistenceFailure("BACKUP_CONFLICT", "Backup generation destination already exists");
  }
  hooks.beforePublish?.();
  token.assertHeld();
  assertSource();
  assertOwnedRuntimeDirectory(layout, ownedStage);
  assertBackupInventory(layout, ownedStage);
  const terminalStageDatabase = readRegularFile(stageDatabasePath);
  const terminalStageManifest = readRegularFile(manifestPath);
  if (
    !sameFileIdentity(verified.identity, terminalStageDatabase.identity) ||
    verified.checksumSha256 !== sha256(terminalStageDatabase.bytes) ||
    !sameFileIdentity(enforcedManifest, terminalStageManifest.identity) ||
    sha256(manifestBytes) !== sha256(terminalStageManifest.bytes)
  ) {
    throw persistenceFailure("BACKUP_INVALID", "Backup stage binding changed before publication");
  }
  assertBackupInventory(layout, ownedStage);
  if (pathEntryExistsNoFollow(generationDirectory)) {
    throw persistenceFailure("BACKUP_CONFLICT", "Backup generation destination appeared before publication");
  }
  try {
    renameSync(ownedStage.path, generationDirectory);
  } catch (error) {
    throw persistenceFailure("BACKUP_CONFLICT", "Backup generation could not be published", {}, error);
  }
  published = true;
  token.assertHeld();
  assertSource();
  const publishedDirectory = captureOwnedRuntimeDirectory(
    layout,
    layout.backupGenerationsRoot,
    generationId,
  );
  if (!sameDirectoryIdentity(ownedStage.identity, publishedDirectory.identity)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup generation identity changed during publication");
  }
  if (pathEntryExistsNoFollow(ownedStage.path)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup stage remained after publication");
  }
  hooks.afterPublish?.();
  assertOwnedRuntimeDirectory(layout, publishedDirectory);
    return verifyBackupGeneration(layout, generationId);
  } catch (error) {
    if (!published && stageDirectory !== null) cleanupOwnedBackupStage(layout, stageDirectory);
    if (published) {
      try {
        return verifyBackupGeneration(layout, generationId);
      } catch (verificationError) {
        if (verificationError instanceof Error && verificationError.name === "PersistenceError") {
          throw verificationError;
        }
        throw persistenceFailure("BACKUP_INVALID", "Published backup generation could not be reverified", {}, verificationError);
      }
    }
    throw error;
  }
}

function inspectPrimaryMember(layout: RuntimeLayout, fileName: PrimaryRuntimeMemberName): PrimaryFileMember {
  const read = readRegularFile(primaryRuntimeMemberPath(layout, fileName));
  return Object.freeze({
    fileName,
    dev: read.identity.dev,
    ino: read.identity.ino,
    mode: read.identity.mode,
    length: read.bytes.byteLength,
    sha256: sha256(read.bytes),
  });
}

function capturePrimaryIdentity(layout: RuntimeLayout): PrimaryIdentity {
  assertRuntimeLayout(layout);
  const members = PRIMARY_RUNTIME_MEMBER_NAMES.filter((fileName) =>
    pathEntryExistsNoFollow(primaryRuntimeMemberPath(layout, fileName))
  ).map(
    (fileName) => inspectPrimaryMember(layout, fileName),
  );
  const identitySha256 = sha256(canonicalJson({ members, schemaVersion: 1 }));
  assertRuntimeLayout(layout);
  return Object.freeze({ schemaVersion: 1, members: Object.freeze(members), identitySha256 });
}

function assertExpectedPrimaryIdentity(layout: RuntimeLayout, expected: PrimaryIdentity): void {
  const observed = capturePrimaryIdentity(layout);
  if (canonicalJson(observed) !== canonicalJson(expected)) {
    throw persistenceFailure("RESTORE_CONFLICT", "Current primary file set does not match restore CAS");
  }
}

function parsePrimaryMember(value: unknown, index: number): PrimaryFileMember {
  const record = exactRecord(
    value,
    ["dev", "fileName", "ino", "length", "mode", "sha256"],
    `primary identity member ${index}`,
  );
  if (
    !PRIMARY_RUNTIME_MEMBER_NAMES.includes(record.fileName as PrimaryRuntimeMemberName) ||
    !isNonemptyString(record.dev) ||
    !isNonemptyString(record.ino) ||
    typeof record.mode !== "number" ||
    !Number.isSafeInteger(record.mode) ||
    typeof record.length !== "number" ||
    !Number.isSafeInteger(record.length) ||
    record.length < 0 ||
    !isSha256(record.sha256)
  ) {
    throw persistenceFailure("INVALID_INPUT", "Primary identity member is invalid", { index });
  }
  return Object.freeze({
    fileName: record.fileName as PrimaryRuntimeMemberName,
    dev: record.dev,
    ino: record.ino,
    mode: record.mode,
    length: record.length,
    sha256: record.sha256,
  });
}

function parsePrimaryIdentity(value: unknown): PrimaryIdentity {
  const record = exactRecord(value, ["identitySha256", "members", "schemaVersion"], "primary identity");
  const values = canonicalArray(record.members, "primary identity members");
  const members = values.map((item, index) => parsePrimaryMember(item, index));
  const expectedNames = [...members.map((member) => member.fileName)].sort();
  if (
    record.schemaVersion !== 1 ||
    !isSha256(record.identitySha256) ||
    new Set(expectedNames).size !== expectedNames.length ||
    canonicalJson(members.map((member) => member.fileName)) !==
      canonicalJson(PRIMARY_RUNTIME_MEMBER_NAMES.filter((name) => expectedNames.includes(name)))
  ) {
    throw persistenceFailure("INVALID_INPUT", "Primary identity is not canonical");
  }
  const expectedHash = sha256(canonicalJson({ members, schemaVersion: 1 }));
  if (record.identitySha256 !== expectedHash) {
    throw persistenceFailure("INVALID_INPUT", "Primary identity checksum is invalid");
  }
  return Object.freeze({ schemaVersion: 1, members: Object.freeze(members), identitySha256: expectedHash });
}

function samePrimaryMember(left: PrimaryFileMember, right: PrimaryFileMember): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

export async function inspectPrimaryIdentity(layout: RuntimeLayout): Promise<PrimaryIdentity> {
  return withLifecycleLock(layout, "inspect-primary", (token) => {
    token.assertHeld();
    ensureNoConnectionReceipts(layout);
    if (hasRestoreIntent(layout)) {
      throw persistenceFailure("RESTORE_RECOVERY_REQUIRED", "A pending restore must be recovered first");
    }
    return capturePrimaryIdentity(layout);
  });
}

function stageMember(stagePath: string): PrimaryFileMember {
  const read = readRegularFile(stagePath);
  return Object.freeze({
    fileName: BACKUP_DATABASE_FILE,
    dev: read.identity.dev,
    ino: read.identity.ino,
    mode: read.identity.mode,
    length: read.bytes.byteLength,
    sha256: sha256(read.bytes),
  });
}

function parseRestoreRequest(value: unknown): RestoreRequest {
  const record = exactRecord(
    value,
    ["acknowledgeDataLoss", "applicationVersion", "authorization", "expectedCurrent", "generationId"],
    "restore request",
  );
  assertUuid(record.generationId, "Restore generationId");
  if (record.acknowledgeDataLoss !== true) {
    throw persistenceFailure("RESTORE_ACK_REQUIRED", "Restore requires explicit data-loss acknowledgement");
  }
  if (!isNonemptyString(record.applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "Restore applicationVersion must be nonempty");
  }
  const authorization = parseApplicationLifecycleAuthorization(record.authorization);
  if (authorization.operation !== "runtime.restore" || authorization.backupGenerationId !== record.generationId) {
    throw persistenceFailure("AUTHORIZATION_DENIED", "Restore lifecycle authorization does not bind this generation");
  }
  return Object.freeze({
    generationId: record.generationId,
    expectedCurrent: parsePrimaryIdentity(record.expectedCurrent),
    acknowledgeDataLoss: true,
    applicationVersion: record.applicationVersion,
    authorization,
  });
}

function parseRestoreIntent(value: unknown): RestoreIntent {
  const record = exactRecord(
    value,
    [
      "applicationVersion",
      "backupGenerationId",
      "backupManifestSha256",
      "createdAt",
      "expectedCurrent",
      "retainedDirectoryIdentity",
      "restoreId",
      "schemaVersion",
      "stageIdentity",
      "targetSchemaVersion",
      "backupAuthorizationId",
      "backupAuthorizationSha256",
      "backupManifestSchemaVersion",
      "restoreAuthorizationId",
      "restoreAuthorizationSha256",
      "restoreAuthorizedStateSha256",
    ],
    "restore intent",
  );
  assertUuid(record.restoreId, "Restore intent restoreId");
  assertUuid(record.backupGenerationId, "Restore intent backupGenerationId");
  if (
    record.schemaVersion !== 2 ||
    !isSha256(record.backupManifestSha256) ||
    !isNonemptyString(record.applicationVersion) ||
    !isCanonicalUtcTimestamp(record.createdAt) ||
    typeof record.targetSchemaVersion !== "number" ||
    !Number.isSafeInteger(record.targetSchemaVersion) ||
    record.targetSchemaVersion < 1
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore intent contains an invalid field");
  }
  const stageIdentity = parsePrimaryMember(record.stageIdentity, 0);
  if (stageIdentity.fileName !== BACKUP_DATABASE_FILE) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore stage identity has an invalid member name");
  }
  if (
    record.backupManifestSchemaVersion !== 2 ||
    !isNonemptyString(record.backupAuthorizationId) ||
    !isSha256(record.backupAuthorizationSha256) ||
    !isNonemptyString(record.restoreAuthorizationId) ||
    !isSha256(record.restoreAuthorizationSha256) ||
    !isSha256(record.restoreAuthorizedStateSha256)
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore intent authorization binding is invalid");
  }
  return Object.freeze({
    schemaVersion: 2 as const,
    restoreId: record.restoreId,
    backupGenerationId: record.backupGenerationId,
    backupManifestSha256: record.backupManifestSha256,
    applicationVersion: record.applicationVersion,
    expectedCurrent: parsePrimaryIdentity(record.expectedCurrent),
    stageIdentity,
    retainedDirectoryIdentity: parseDirectoryIdentity(
      record.retainedDirectoryIdentity,
      "restore intent retainedDirectoryIdentity",
    ),
    targetSchemaVersion: record.targetSchemaVersion,
    createdAt: record.createdAt,
    backupManifestSchemaVersion: 2 as const,
    backupAuthorizationId: record.backupAuthorizationId,
    backupAuthorizationSha256: record.backupAuthorizationSha256,
    restoreAuthorizationId: record.restoreAuthorizationId,
    restoreAuthorizationSha256: record.restoreAuthorizationSha256,
    restoreAuthorizedStateSha256: record.restoreAuthorizedStateSha256,
  });
}

function parseRestoreReceipt(value: unknown): RestoreReceipt {
  const record = exactRecord(
    value,
    [
      "applicationVersion",
      "backupGenerationId",
      "previousIdentitySha256",
      "retainedDirectoryIdentity",
      "restoredAt",
      "restoreId",
      "retainedDirectory",
      "schemaVersion",
      "targetDatabaseSha256",
      "targetSchemaVersion",
      "backupAuthorizationId",
      "backupAuthorizationSha256",
      "backupManifestSha256",
      "restoreAuthorizationId",
      "restoreAuthorizationSha256",
      "restoreAuthorizedStateSha256",
    ],
    "restore receipt",
  );
  assertUuid(record.restoreId, "Restore receipt restoreId");
  assertUuid(record.backupGenerationId, "Restore receipt backupGenerationId");
  if (
    record.schemaVersion !== 2 ||
    !isNonemptyString(record.applicationVersion) ||
    !isCanonicalUtcTimestamp(record.restoredAt) ||
    !isSha256(record.previousIdentitySha256) ||
    !isSha256(record.targetDatabaseSha256) ||
    typeof record.targetSchemaVersion !== "number" ||
    !Number.isSafeInteger(record.targetSchemaVersion) ||
    record.targetSchemaVersion < 1 ||
    record.retainedDirectory !== record.restoreId
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore receipt contains an invalid field");
  }
  if (
    !isSha256(record.backupManifestSha256) ||
    !isNonemptyString(record.backupAuthorizationId) ||
    !isSha256(record.backupAuthorizationSha256) ||
    !isNonemptyString(record.restoreAuthorizationId) ||
    !isSha256(record.restoreAuthorizationSha256) ||
    !isSha256(record.restoreAuthorizedStateSha256)
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore receipt authorization binding is invalid");
  }
  return Object.freeze({
    schemaVersion: 2 as const,
    restoreId: record.restoreId,
    backupGenerationId: record.backupGenerationId,
    restoredAt: record.restoredAt,
    applicationVersion: record.applicationVersion,
    previousIdentitySha256: record.previousIdentitySha256,
    targetDatabaseSha256: record.targetDatabaseSha256,
    targetSchemaVersion: record.targetSchemaVersion,
    retainedDirectory: record.retainedDirectory,
    retainedDirectoryIdentity: parseDirectoryIdentity(
      record.retainedDirectoryIdentity,
      "restore receipt retainedDirectoryIdentity",
    ),
    backupManifestSha256: record.backupManifestSha256,
    backupAuthorizationId: record.backupAuthorizationId,
    backupAuthorizationSha256: record.backupAuthorizationSha256,
    restoreAuthorizationId: record.restoreAuthorizationId,
    restoreAuthorizationSha256: record.restoreAuthorizationSha256,
    restoreAuthorizedStateSha256: record.restoreAuthorizedStateSha256,
  });
}

function readRestoreIntent(
  layout: RuntimeLayout,
): Readonly<{ intent: RestoreIntent; identity: FileIdentity; checksumSha256: string }> {
  assertRuntimeLayout(layout);
  if (!pathEntryExistsNoFollow(layout.restoreIntentPath)) {
    throw persistenceFailure("RESTORE_BLOCKED", "No restore intent is available for recovery");
  }
  const read = readJsonFile(layout.restoreIntentPath, "restore intent", "RESTORE_BLOCKED");
  try {
    const result = Object.freeze({
      intent: parseRestoreIntent(read.value),
      identity: read.identity,
      checksumSha256: sha256(read.bytes),
    });
    assertRuntimeLayout(layout);
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "PersistenceError" &&
      (error as PersistenceError).code === "RESTORE_BLOCKED"
    ) {
      throw error;
    }
    throw persistenceFailure("RESTORE_BLOCKED", "Restore intent schema is invalid", {}, error);
  }
}

function retainedMemberPath(layout: RuntimeLayout, restoreId: string, fileName: string): string {
  return path.join(layout.restoreRetainedRoot, restoreId, fileName);
}

function inspectMemberAt(filePath: string, fileName: PrimaryRuntimeMemberName): PrimaryFileMember {
  const read = readRegularFile(filePath);
  return Object.freeze({
    fileName,
    dev: read.identity.dev,
    ino: read.identity.ino,
    mode: read.identity.mode,
    length: read.bytes.byteLength,
    sha256: sha256(read.bytes),
  });
}

function validateBackupBinding(layout: RuntimeLayout, intent: RestoreIntent): BackupGeneration {
  const generation = verifyBackupGeneration(layout, intent.backupGenerationId);
  const manifest = generation.manifest;
  if (
    sha256(canonicalJson(manifest)) !== intent.backupManifestSha256 ||
    manifest.sourceSchemaVersion !== intent.targetSchemaVersion ||
    manifest.lifecycleAuthorizationId !== intent.backupAuthorizationId ||
    manifest.lifecycleAuthorizationSha256 !== intent.backupAuthorizationSha256
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore intent no longer matches the backup generation");
  }
  if (manifest.sourceSchemaVersion !== currentSchemaVersion()) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore intent application provenance is inconsistent");
  }
  return generation;
}

function requireRestorableGeneration(generation: BackupGeneration): BackupManifest {
  const manifest = generation.manifest;
  if (manifest.sourceSchemaVersion !== currentSchemaVersion()) {
    throw persistenceFailure("BACKUP_INVALID", "Only current-schema application-authorized manual backups are restorable");
  }
  return manifest;
}

function validateCurrentRestoreAuthorization(
  layout: RuntimeLayout,
  authorization: ApplicationLifecycleAuthorization,
  generationId: string,
  now: string,
): Readonly<{ authorization: ApplicationLifecycleAuthorization; stateSha256: string }> {
  const database = openReadOnlyDatabase(layout.databasePath);
  try {
    return validateLifecycleAuthorizationForUse(database, authorization, "runtime.restore", generationId, now);
  } finally {
    database.close();
    assertRuntimeLayout(layout);
  }
}

function validateRetainedRestoreAuthorization(layout: RuntimeLayout, intent: RestoreIntent): void {
  const retainedPath = retainedMemberPath(layout, intent.restoreId, BACKUP_DATABASE_FILE);
  const database = openReadOnlyDatabase(retainedPath);
  try {
    const state = readApplicationState(database);
    const authorization = state.lifecycle.find((candidate) => candidate.authorizationId === intent.restoreAuthorizationId);
    if (
      authorization === undefined ||
      lifecycleAuthorizationSha256(authorization) !== intent.restoreAuthorizationSha256 ||
      authorization.authorizedStateSha256 !== intent.restoreAuthorizedStateSha256 ||
      authorization.operation !== "runtime.restore" ||
      authorization.backupGenerationId !== intent.backupGenerationId
    ) {
      throw persistenceFailure("RESTORE_BLOCKED", "Retained restore authorization does not match the durable intent");
    }
    validateLifecycleAuthorizationForUse(
      database,
      authorization,
      "runtime.restore",
      intent.backupGenerationId,
      intent.createdAt,
    );
  } finally {
    database.close();
  }
}

function validatePublishedBackupAuthorization(layout: RuntimeLayout, intent: RestoreIntent): void {
  const generation = validateBackupBinding(layout, intent);
  const manifest = requireRestorableGeneration(generation);
  const database = openReadOnlyDatabase(layout.databasePath);
  try {
    const state = readApplicationState(database);
    const authorization = state.lifecycle.find((candidate) => candidate.authorizationId === manifest.lifecycleAuthorizationId);
    if (
      authorization === undefined ||
      authorization.operation !== "runtime.backup" ||
      authorization.backupGenerationId !== intent.backupGenerationId ||
      lifecycleAuthorizationSha256(authorization) !== manifest.lifecycleAuthorizationSha256 ||
      authorization.authorizedStateSha256 !== manifest.sourceApplicationStateSha256 ||
      applicationStateSha256(state) !==
        manifest.sourceApplicationStateSha256
    ) {
      throw persistenceFailure("RESTORE_BLOCKED", "Published target does not retain the backup authorization lineage");
    }
  } finally {
    database.close();
  }
}

function receiptPath(layout: RuntimeLayout, restoreId: string): string {
  return path.join(layout.restoreReceiptsRoot, `${restoreId}.json`);
}

function existingReceipt(layout: RuntimeLayout, intent: RestoreIntent): RestoreReceipt | null {
  assertRuntimeLayout(layout);
  const filePath = receiptPath(layout, intent.restoreId);
  if (!pathEntryExistsNoFollow(filePath)) return null;
  const read = readJsonFile(filePath, "restore receipt", "RESTORE_BLOCKED");
  let receipt: RestoreReceipt;
  try {
    receipt = parseRestoreReceipt(read.value);
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "PersistenceError" &&
      (error as PersistenceError).code === "RESTORE_BLOCKED"
    ) {
      throw error;
    }
    throw persistenceFailure("RESTORE_BLOCKED", "Restore receipt schema is invalid", {}, error);
  }
  if (
    receipt.restoreId !== intent.restoreId ||
    receipt.backupGenerationId !== intent.backupGenerationId ||
    receipt.applicationVersion !== intent.applicationVersion ||
    receipt.previousIdentitySha256 !== intent.expectedCurrent.identitySha256 ||
    receipt.targetDatabaseSha256 !== intent.stageIdentity.sha256 ||
    receipt.targetSchemaVersion !== intent.targetSchemaVersion ||
    canonicalJson(receipt.retainedDirectoryIdentity) !== canonicalJson(intent.retainedDirectoryIdentity)
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Existing restore receipt conflicts with the pending intent");
  }
  if (
    receipt.backupManifestSha256 !== intent.backupManifestSha256 ||
    receipt.backupAuthorizationId !== intent.backupAuthorizationId ||
    receipt.backupAuthorizationSha256 !== intent.backupAuthorizationSha256 ||
    receipt.restoreAuthorizationId !== intent.restoreAuthorizationId ||
    receipt.restoreAuthorizationSha256 !== intent.restoreAuthorizationSha256 ||
    receipt.restoreAuthorizedStateSha256 !== intent.restoreAuthorizedStateSha256
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Existing restore receipt authorization links conflict with the intent");
  }
  assertRuntimeLayout(layout);
  return receipt;
}

function assertRetainedDirectory(layout: RuntimeLayout, intent: RestoreIntent): OwnedRuntimeDirectory {
  const directory = Object.freeze({
    path: path.join(layout.restoreRetainedRoot, intent.restoreId),
    parent: layout.restoreRetainedRoot,
    identity: intent.retainedDirectoryIdentity,
  });
  try {
    assertOwnedRuntimeDirectory(layout, directory);
    const allowed = new Set(intent.expectedCurrent.members.map((member) => member.fileName));
    for (const name of readdirSync(directory.path)) {
      if (!allowed.has(name as PrimaryRuntimeMemberName)) {
        throw persistenceFailure("RESTORE_BLOCKED", "Restore retained inventory contains an unknown member");
      }
    }
    assertOwnedRuntimeDirectory(layout, directory);
    return directory;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "PersistenceError" &&
      (error as PersistenceError).code === "RESTORE_BLOCKED"
    ) {
      throw error;
    }
    throw persistenceFailure("RESTORE_BLOCKED", "Restore retained directory could not be verified", {}, error);
  }
}

function assertCompleteRetainedDirectory(layout: RuntimeLayout, intent: RestoreIntent): void {
  const directory = assertRetainedDirectory(layout, intent);
  const expectedNames = intent.expectedCurrent.members.map((member) => member.fileName);
  const observedNames = readdirSync(directory.path).sort();
  if (canonicalJson(observedNames) !== canonicalJson([...expectedNames].sort())) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore retained inventory is incomplete");
  }
  for (const expected of intent.expectedCurrent.members) {
    if (!samePrimaryMember(inspectMemberAt(path.join(directory.path, expected.fileName), expected.fileName), expected)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore retained member identity changed", {
        fileName: expected.fileName,
      });
    }
  }
  assertOwnedRuntimeDirectory(layout, directory);
}

function currentTargetPublished(layout: RuntimeLayout, intent: RestoreIntent): boolean {
  assertRuntimeLayout(layout);
  if (!pathEntryExistsNoFollow(layout.databasePath)) return false;
  const current = inspectMemberAt(layout.databasePath, BACKUP_DATABASE_FILE);
  const published = samePrimaryMember(current, intent.stageIdentity);
  assertRuntimeLayout(layout);
  return published;
}

function retainExpectedCurrent(
  layout: RuntimeLayout,
  intent: RestoreIntent,
  hooks: RestoreTestHooks,
): void {
  const retainedDirectory = assertRetainedDirectory(layout, intent);
  const expectedByName = new Map(intent.expectedCurrent.members.map((member) => [member.fileName, member]));
  const published = currentTargetPublished(layout, intent);
  for (const fileName of PRIMARY_RUNTIME_MEMBER_NAMES) {
    assertRuntimeLayout(layout);
    assertOwnedRuntimeDirectory(layout, retainedDirectory);
    const primaryPath = primaryRuntimeMemberPath(layout, fileName);
    const retainedPath = retainedMemberPath(layout, intent.restoreId, fileName);
    const primaryExists = pathEntryExistsNoFollow(primaryPath);
    const retainedExists = pathEntryExistsNoFollow(retainedPath);
    const expected = expectedByName.get(fileName);
    if (expected === undefined) {
      if (retainedExists || (primaryExists && !(fileName === BACKUP_DATABASE_FILE && published))) {
        throw persistenceFailure("RESTORE_BLOCKED", "Restore topology contains an unexpected primary member", {
          fileName,
        });
      }
      continue;
    }
    if (retainedExists) {
      if (!samePrimaryMember(inspectMemberAt(retainedPath, fileName), expected)) {
        throw persistenceFailure("RESTORE_BLOCKED", "Retained primary member identity changed", { fileName });
      }
      if (primaryExists && !(fileName === BACKUP_DATABASE_FILE && published)) {
        throw persistenceFailure("RESTORE_BLOCKED", "Primary member exists in both source and retained topology", {
          fileName,
        });
      }
      continue;
    }
    if (!primaryExists || (fileName === BACKUP_DATABASE_FILE && published)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Expected primary member is missing during recovery", { fileName });
    }
    if (!samePrimaryMember(inspectMemberAt(primaryPath, fileName), expected)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Current primary member no longer matches restore CAS", { fileName });
    }
    hooks.beforeRetainMember?.(fileName);
    assertRuntimeLayout(layout);
    assertOwnedRuntimeDirectory(layout, retainedDirectory);
    if (
      !pathEntryExistsNoFollow(primaryPath) ||
      pathEntryExistsNoFollow(retainedPath) ||
      !samePrimaryMember(inspectMemberAt(primaryPath, fileName), expected)
    ) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore topology changed immediately before retention", {
        fileName,
      });
    }
    renameSync(primaryPath, retainedPath);
    assertRuntimeLayout(layout);
    assertOwnedRuntimeDirectory(layout, retainedDirectory);
    if (pathEntryExistsNoFollow(primaryPath)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Primary member remained after retention", { fileName });
    }
    if (!samePrimaryMember(inspectMemberAt(retainedPath, fileName), expected)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Retained primary member failed terminal readback", { fileName });
    }
  }
  assertOwnedRuntimeDirectory(layout, retainedDirectory);
}

function verifyPublishedTarget(layout: RuntimeLayout, intent: RestoreIntent): SchemaEvidence {
  assertRuntimeLayout(layout);
  if (!currentTargetPublished(layout, intent)) {
    throw persistenceFailure("RESTORE_BLOCKED", "Published restore target identity is absent or changed");
  }
  const verified = verifyStandaloneDatabase(layout.databasePath, {
    identity: Object.freeze({
      dev: intent.stageIdentity.dev,
      ino: intent.stageIdentity.ino,
      mode: intent.stageIdentity.mode,
      size: intent.stageIdentity.length,
    }),
    checksumSha256: intent.stageIdentity.sha256,
  });
  const evidence = verified.evidence;
  if (evidence.schemaVersion !== intent.targetSchemaVersion) {
    throw persistenceFailure("RESTORE_BLOCKED", "Published restore target schema differs from the intent");
  }
  if (!samePrimaryMember(inspectMemberAt(layout.databasePath, BACKUP_DATABASE_FILE), intent.stageIdentity)) {
    throw persistenceFailure("RESTORE_BLOCKED", "Published restore target changed after readback");
  }
  assertRuntimeLayout(layout);
  return evidence;
}

async function continueRestore(
  layout: RuntimeLayout,
  intent: RestoreIntent,
  intentIdentity: FileIdentity,
  intentChecksumSha256: string,
  token: LifecycleLockToken,
  hooks: RestoreTestHooks = {},
): Promise<RestoreReceipt> {
  token.assertHeld();
  validateBackupBinding(layout, intent);
  assertRetainedDirectory(layout, intent);
  const priorReceipt = existingReceipt(layout, intent);
  if (priorReceipt !== null) {
    assertCompleteRetainedDirectory(layout, intent);
    verifyPublishedTarget(layout, intent);
    validateRetainedRestoreAuthorization(layout, intent);
    validatePublishedBackupAuthorization(layout, intent);
    token.assertHeld();
    assertRetainedDirectory(layout, intent);
    unlinkOwnedFile(layout.restoreIntentPath, intentIdentity, intentChecksumSha256);
    assertRuntimeLayout(layout);
    token.assertHeld();
    return priorReceipt;
  }

  const stagePath = path.join(layout.restoreStagingRoot, `${intent.restoreId}.sqlite3`);
  let published = currentTargetPublished(layout, intent);
  if (!published) {
    if (!pathEntryExistsNoFollow(stagePath) || !samePrimaryMember(stageMember(stagePath), intent.stageIdentity)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore stage identity is absent or changed");
    }
    retainExpectedCurrent(layout, intent, hooks);
    assertCompleteRetainedDirectory(layout, intent);
    hooks.afterRetain?.();
    token.assertHeld();
    assertRetainedDirectory(layout, intent);
    if (!samePrimaryMember(stageMember(stagePath), intent.stageIdentity)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore stage changed before publication");
    }
    hooks.beforeTargetPublish?.();
    token.assertHeld();
    assertRetainedDirectory(layout, intent);
    if (!pathEntryExistsNoFollow(stagePath) || !samePrimaryMember(stageMember(stagePath), intent.stageIdentity)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore stage changed immediately before publication");
    }
    if (pathEntryExistsNoFollow(layout.databasePath)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Primary database path was repopulated before publication");
    }
    renameSync(stagePath, layout.databasePath);
    token.assertHeld();
    assertRetainedDirectory(layout, intent);
    if (
      pathEntryExistsNoFollow(stagePath) ||
      !pathEntryExistsNoFollow(layout.databasePath) ||
      !samePrimaryMember(inspectMemberAt(layout.databasePath, BACKUP_DATABASE_FILE), intent.stageIdentity)
    ) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore target failed terminal publication readback");
    }
    published = true;
    hooks.afterPublish?.();
    token.assertHeld();
    assertRetainedDirectory(layout, intent);
    if (!currentTargetPublished(layout, intent)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Published restore target changed after publication hook");
    }
  } else {
    retainExpectedCurrent(layout, intent, hooks);
    assertCompleteRetainedDirectory(layout, intent);
    if (pathEntryExistsNoFollow(stagePath)) {
      throw persistenceFailure("RESTORE_BLOCKED", "Restore stage and published target both exist");
    }
  }
  if (!published) throw persistenceFailure("RESTORE_BLOCKED", "Restore target was not published");
  const evidence = verifyPublishedTarget(layout, intent);
  validateRetainedRestoreAuthorization(layout, intent);
  validatePublishedBackupAuthorization(layout, intent);
  const receipt: RestoreReceipt = Object.freeze({
    schemaVersion: 2,
    restoreId: intent.restoreId,
    backupGenerationId: intent.backupGenerationId,
    restoredAt: new Date().toISOString(),
    applicationVersion: intent.applicationVersion,
    previousIdentitySha256: intent.expectedCurrent.identitySha256,
    targetDatabaseSha256: intent.stageIdentity.sha256,
    targetSchemaVersion: evidence.schemaVersion,
    retainedDirectory: intent.restoreId,
    retainedDirectoryIdentity: intent.retainedDirectoryIdentity,
    backupManifestSha256: intent.backupManifestSha256,
    backupAuthorizationId: intent.backupAuthorizationId,
    backupAuthorizationSha256: intent.backupAuthorizationSha256,
    restoreAuthorizationId: intent.restoreAuthorizationId,
    restoreAuthorizationSha256: intent.restoreAuthorizationSha256,
    restoreAuthorizedStateSha256: intent.restoreAuthorizedStateSha256,
  });
  const publishedReceiptPath = receiptPath(layout, intent.restoreId);
  const receiptBytes = canonicalJson(receipt);
  token.assertHeld();
  assertRetainedDirectory(layout, intent);
  const publishedReceiptIdentity = writeExclusiveFile(publishedReceiptPath, receiptBytes);
  const enforcedReceiptIdentity = enforcePrivateRegularFile(publishedReceiptPath);
  const receiptReadback = readRegularFile(publishedReceiptPath);
  if (
    !sameFileIdentity(publishedReceiptIdentity, enforcedReceiptIdentity) ||
    !sameFileIdentity(publishedReceiptIdentity, receiptReadback.identity) ||
    sha256(receiptReadback.bytes) !== sha256(receiptBytes)
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore receipt identity changed during publication");
  }
  assertRuntimeLayout(layout);
  assertRetainedDirectory(layout, intent);
  hooks.afterReceipt?.();
  token.assertHeld();
  assertRetainedDirectory(layout, intent);
  verifyPublishedTarget(layout, intent);
  validateRetainedRestoreAuthorization(layout, intent);
  validatePublishedBackupAuthorization(layout, intent);
  const terminalReceipt = readRegularFile(publishedReceiptPath);
  if (
    !sameFileIdentity(publishedReceiptIdentity, terminalReceipt.identity) ||
    sha256(terminalReceipt.bytes) !== sha256(receiptBytes)
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore receipt changed after publication");
  }
  token.assertHeld();
  assertRetainedDirectory(layout, intent);
  unlinkOwnedFile(layout.restoreIntentPath, intentIdentity, intentChecksumSha256);
  assertRuntimeLayout(layout);
  token.assertHeld();
  return receipt;
}

async function stageRestoreTarget(
  layout: RuntimeLayout,
  restoreId: string,
  generation: BackupGeneration,
  hooks: RestoreTestHooks,
): Promise<Readonly<{ path: string; identity: PrimaryFileMember; evidence: SchemaEvidence }>> {
  const binding = assertBackupBinding(layout, generation);
  const sourcePath = path.join(binding.directory.path, BACKUP_DATABASE_FILE);
  const source = openReadOnlyDatabase(sourcePath);
  const stagePath = path.join(layout.restoreStagingRoot, `${restoreId}.sqlite3`);
  try {
    if (pathEntryExistsNoFollow(stagePath)) {
      throw persistenceFailure("RESTORE_CONFLICT", "Restore stage already exists");
    }
    await cloneDatabase(
      source,
      stagePath,
      () => assertRuntimeLayout(layout),
      () => {
        assertBackupBinding(layout, generation);
      },
      hooks.afterStage,
    );
  } finally {
    source.close();
  }
  assertBackupBinding(layout, generation);
  assertRuntimeLayout(layout);
  const verified = verifyStandaloneDatabase(stagePath);
  assertRuntimeLayout(layout);
  return Object.freeze({ path: stagePath, identity: stageMember(stagePath), evidence: verified.evidence });
}

async function restoreBackupWithHooks(
  layout: RuntimeLayout,
  requestInput: unknown,
  hooks: RestoreTestHooks,
): Promise<RestoreReceipt> {
  const request = parseRestoreRequest(requestInput);
  return withLifecycleLock(layout, "restore", async (token) => {
    ensureNoConnectionReceipts(layout);
    assertNoBackupStagingResidue(layout);
    if (hasRestoreIntent(layout)) {
      throw persistenceFailure("RESTORE_RECOVERY_REQUIRED", "A prior restore intent requires explicit recovery");
    }
    assertExpectedPrimaryIdentity(layout, request.expectedCurrent);
    const generation = verifyBackupGeneration(layout, request.generationId);
    const manifest = requireRestorableGeneration(generation);
    validateCurrentRestoreAuthorization(
      layout,
      request.authorization,
      generation.generationId,
      new Date().toISOString(),
    );
    const validatedPrimary = capturePrimaryIdentity(layout);
    const restoreId = randomUUID();
    const stage = await stageRestoreTarget(layout, restoreId, generation, hooks);
    token.assertHeld();
    hooks.beforeIntent?.();
    token.assertHeld();
    assertExpectedPrimaryIdentity(layout, validatedPrimary);
    const retainedDirectory = createPrivateDirectory(layout, layout.restoreRetainedRoot, restoreId);
    if (path.basename(retainedDirectory.path) !== restoreId) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Restore retained directory identity changed");
    }
    const intentCreatedAt = new Date().toISOString();
    const terminalAuthorization = validateCurrentRestoreAuthorization(
      layout,
      request.authorization,
      generation.generationId,
      intentCreatedAt,
    );
    const terminalPrimary = capturePrimaryIdentity(layout);
    const intent: RestoreIntent = Object.freeze({
      schemaVersion: 2,
      restoreId,
      backupGenerationId: generation.generationId,
      backupManifestSha256: sha256(canonicalJson(generation.manifest)),
      applicationVersion: request.applicationVersion,
      expectedCurrent: terminalPrimary,
      stageIdentity: stage.identity,
      retainedDirectoryIdentity: retainedDirectory.identity,
      targetSchemaVersion: stage.evidence.schemaVersion,
      createdAt: intentCreatedAt,
      backupManifestSchemaVersion: 2,
      backupAuthorizationId: manifest.lifecycleAuthorizationId,
      backupAuthorizationSha256: manifest.lifecycleAuthorizationSha256,
      restoreAuthorizationId: request.authorization.authorizationId,
      restoreAuthorizationSha256: lifecycleAuthorizationSha256(request.authorization),
      restoreAuthorizedStateSha256: terminalAuthorization.stateSha256,
    });
    const intentBytes = canonicalJson(intent);
    assertRuntimeLayout(layout);
    assertOwnedRuntimeDirectory(layout, retainedDirectory);
    if (!samePrimaryMember(stageMember(stage.path), stage.identity)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Restore stage changed before intent publication");
    }
    token.assertHeld();
    assertOwnedRuntimeDirectory(layout, retainedDirectory);
    if (!samePrimaryMember(stageMember(stage.path), stage.identity)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Restore stage changed at intent publication");
    }
    assertExpectedPrimaryIdentity(layout, terminalPrimary);
    let intentIdentity: FileIdentity;
    try {
      intentIdentity = writeExclusiveFile(layout.restoreIntentPath, intentBytes);
    } catch (error) {
      if (pathEntryExistsNoFollow(layout.restoreIntentPath)) {
        throw persistenceFailure(
          "RESTORE_RECOVERY_REQUIRED",
          "Restore intent publication left durable state requiring explicit recovery",
          { restoreId },
          error,
        );
      }
      throw error;
    }
    try {
      hooks.afterIntent?.();
      const enforcedIntent = enforcePrivateRegularFile(layout.restoreIntentPath);
      const intentReadback = readRegularFile(layout.restoreIntentPath);
      if (
        !sameFileIdentity(intentIdentity, enforcedIntent) ||
        !sameFileIdentity(intentIdentity, intentReadback.identity) ||
        sha256(intentReadback.bytes) !== sha256(intentBytes)
      ) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Restore intent changed during publication");
      }
      token.assertHeld();
      assertOwnedRuntimeDirectory(layout, retainedDirectory);
      if (!samePrimaryMember(stageMember(stage.path), stage.identity)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Restore stage changed after intent publication");
      }
      return await continueRestore(layout, intent, intentIdentity, sha256(intentBytes), token, hooks);
    } catch (error) {
      if (error instanceof Error && error.name === "PersistenceError") {
        throw persistenceFailure(
          "RESTORE_RECOVERY_REQUIRED",
          "Restore crossed its durable intent boundary and requires explicit recovery",
          { restoreId },
          error,
        );
      }
      throw persistenceFailure(
        "RESTORE_RECOVERY_REQUIRED",
        "Restore crossed its durable intent boundary and requires explicit recovery",
        { restoreId },
        error,
      );
    }
  });
}

export async function restoreBackup(layout: RuntimeLayout, requestInput: unknown): Promise<RestoreReceipt> {
  return restoreBackupWithHooks(layout, requestInput, {});
}

export async function restoreBackupForTesting(
  layout: RuntimeLayout,
  requestInput: unknown,
  hooks: RestoreTestHooks,
): Promise<RestoreReceipt> {
  return restoreBackupWithHooks(layout, requestInput, hooks);
}

export async function recoverInterruptedRestore(layout: RuntimeLayout): Promise<RestoreReceipt> {
  return withLifecycleLock(layout, "recover-restore", async (token) => {
    ensureNoConnectionReceipts(layout);
    const pending = readRestoreIntent(layout);
    try {
      return await continueRestore(
        layout,
        pending.intent,
        pending.identity,
        pending.checksumSha256,
        token,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "PersistenceError") throw error as PersistenceError;
      throw persistenceFailure("RESTORE_BLOCKED", "Interrupted restore recovery could not prove its topology", {}, error);
    }
  });
}
