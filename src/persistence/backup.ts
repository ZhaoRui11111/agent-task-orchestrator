import { randomUUID } from "node:crypto";
import {
  readdirSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import { backup } from "node:sqlite";
import {
  normalizeStandaloneDatabase,
  openReadOnlyDatabase,
  type SqliteDatabase,
  sqliteInteger,
  verifyDatabaseIntegrity,
} from "./database.ts";
import { persistenceFailure, type PersistenceError } from "./errors.ts";
import {
  inspectSchemaEvidence,
  type MigrationHistoryEntry,
  type SchemaEvidence,
} from "./migrations.ts";
import { readApplicationState } from "./application-repository.ts";
import { readDomainSnapshot } from "./repository.ts";
import {
  assertOwnedRuntimeDirectory,
  assertRuntimeLayout,
  captureOwnedRuntimeDirectory,
  createOwnedRuntimeDirectory,
  ensureNoConnectionReceipts,
  hasRestoreIntent,
  type DirectoryIdentity,
  type LifecycleLockToken,
  type OwnedRuntimeDirectory,
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
const PRIMARY_MEMBER_NAMES = Object.freeze([
  "state.sqlite3",
  "state.sqlite3-wal",
  "state.sqlite3-shm",
] as const);

export type BackupKind = "manual" | "pre_upgrade";

export interface BackupManifest {
  readonly schemaVersion: 1;
  readonly generationId: string;
  readonly kind: BackupKind;
  readonly databaseFile: "state.sqlite3";
  readonly databaseLength: number;
  readonly databaseSha256: string;
  readonly sourceSchemaVersion: number;
  readonly sourceRegistryIdentity: string;
  readonly sourceSchemaFingerprint: string;
  readonly sourceHistory: readonly MigrationHistoryEntry[];
  readonly applicationVersion: string;
  readonly createdAt: string;
}

export interface BackupGeneration {
  readonly generationId: string;
  readonly manifest: BackupManifest;
}

export interface PrimaryFileMember {
  readonly fileName: (typeof PRIMARY_MEMBER_NAMES)[number];
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
}

export interface RestoreReceipt {
  readonly schemaVersion: 1;
  readonly restoreId: string;
  readonly backupGenerationId: string;
  readonly restoredAt: string;
  readonly applicationVersion: string;
  readonly previousIdentitySha256: string;
  readonly targetDatabaseSha256: string;
  readonly targetSchemaVersion: number;
  readonly retainedDirectory: string;
  readonly retainedDirectoryIdentity: DirectoryIdentity;
}

interface RestoreIntent {
  readonly schemaVersion: 1;
  readonly restoreId: string;
  readonly backupGenerationId: string;
  readonly backupManifestSha256: string;
  readonly applicationVersion: string;
  readonly expectedCurrent: PrimaryIdentity;
  readonly stageIdentity: PrimaryFileMember;
  readonly retainedDirectoryIdentity: DirectoryIdentity;
  readonly targetSchemaVersion: number;
  readonly createdAt: string;
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
  readonly afterClone?: () => void;
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
    ],
    "backup manifest",
  );
  assertUuid(record.generationId, "Backup generationId");
  if (
    record.schemaVersion !== 1 ||
    (record.kind !== "manual" && record.kind !== "pre_upgrade") ||
    record.databaseFile !== BACKUP_DATABASE_FILE ||
    typeof record.databaseLength !== "number" ||
    !Number.isSafeInteger(record.databaseLength) ||
    record.databaseLength <= 0 ||
    !isSha256(record.databaseSha256) ||
    typeof record.sourceSchemaVersion !== "number" ||
    !Number.isSafeInteger(record.sourceSchemaVersion) ||
    record.sourceSchemaVersion < 1 ||
    !isSha256(record.sourceRegistryIdentity) ||
    !isSha256(record.sourceSchemaFingerprint) ||
    !isNonemptyString(record.applicationVersion) ||
    !isCanonicalUtcTimestamp(record.createdAt)
  ) {
    throw persistenceFailure("BACKUP_INVALID", "Backup manifest contains an invalid field");
  }
  return Object.freeze({
    schemaVersion: 1,
    generationId: record.generationId,
    kind: record.kind,
    databaseFile: BACKUP_DATABASE_FILE,
    databaseLength: record.databaseLength,
    databaseSha256: record.databaseSha256,
    sourceSchemaVersion: record.sourceSchemaVersion,
    sourceRegistryIdentity: record.sourceRegistryIdentity,
    sourceSchemaFingerprint: record.sourceSchemaFingerprint,
    sourceHistory: parseHistory(record.sourceHistory),
    applicationVersion: record.applicationVersion,
    createdAt: record.createdAt,
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
    if (evidence.schemaVersion >= 3) readApplicationState(database);
    else if (evidence.schemaVersion >= 2) readDomainSnapshot(database);
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
      (error as PersistenceError).code === "BACKUP_INVALID"
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

export async function createBackupUnderLock(
  database: SqliteDatabase,
  layout: RuntimeLayout,
  applicationVersion: string,
  kind: BackupKind,
  token: LifecycleLockToken,
  hooks: BackupTestHooks = {},
): Promise<BackupGeneration> {
  assertRuntimeLayout(layout);
  token.assertHeld();
  if (!isNonemptyString(applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "applicationVersion must be nonempty");
  }
  const generationId = randomUUID();
  const stageDirectory = createPrivateDirectory(layout, layout.backupStagingRoot, generationId);
  const sourceIdentity = inspectRegularFile(layout.databasePath);
  const assertSource = (): void => {
    assertRuntimeLayout(layout);
    const observed = inspectRegularFile(layout.databasePath);
    if (!sameFileObjectIdentity(sourceIdentity, observed)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup source database identity changed");
    }
  };
  const stageDatabasePath = path.join(stageDirectory.path, BACKUP_DATABASE_FILE);
  await cloneDatabase(
    database,
    stageDatabasePath,
    () => assertOwnedRuntimeDirectory(layout, stageDirectory),
    assertSource,
    hooks.afterClone,
  );
  token.assertHeld();
  assertSource();
  assertOwnedRuntimeDirectory(layout, stageDirectory);
  const verified = verifyStandaloneDatabase(stageDatabasePath);
  assertOwnedRuntimeDirectory(layout, stageDirectory);
  const evidence = verified.evidence;
  const manifest: BackupManifest = Object.freeze({
    schemaVersion: 1,
    generationId,
    kind,
    databaseFile: BACKUP_DATABASE_FILE,
    databaseLength: verified.identity.size,
    databaseSha256: verified.checksumSha256,
    sourceSchemaVersion: evidence.schemaVersion,
    sourceRegistryIdentity: evidence.registryIdentity,
    sourceSchemaFingerprint: evidence.schemaFingerprint,
    sourceHistory: evidence.history,
    applicationVersion,
    createdAt: new Date().toISOString(),
  });
  const manifestPath = path.join(stageDirectory.path, BACKUP_MANIFEST_FILE);
  const manifestBytes = canonicalJson(manifest);
  token.assertHeld();
  assertSource();
  assertOwnedRuntimeDirectory(layout, stageDirectory);
  const manifestIdentity = writeExclusiveFile(manifestPath, manifestBytes);
  const enforcedManifest = enforcePrivateRegularFile(manifestPath);
  if (!sameFileIdentity(manifestIdentity, enforcedManifest)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup manifest identity changed during publication");
  }
  assertOwnedRuntimeDirectory(layout, stageDirectory);
  const generationDirectory = path.join(layout.backupGenerationsRoot, generationId);
  if (pathEntryExistsNoFollow(generationDirectory)) {
    throw persistenceFailure("BACKUP_CONFLICT", "Backup generation destination already exists");
  }
  hooks.beforePublish?.();
  token.assertHeld();
  assertSource();
  assertOwnedRuntimeDirectory(layout, stageDirectory);
  assertBackupInventory(layout, stageDirectory);
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
  assertBackupInventory(layout, stageDirectory);
  if (pathEntryExistsNoFollow(generationDirectory)) {
    throw persistenceFailure("BACKUP_CONFLICT", "Backup generation destination appeared before publication");
  }
  try {
    renameSync(stageDirectory.path, generationDirectory);
  } catch (error) {
    throw persistenceFailure("BACKUP_CONFLICT", "Backup generation could not be published", {}, error);
  }
  token.assertHeld();
  assertSource();
  const publishedDirectory = captureOwnedRuntimeDirectory(
    layout,
    layout.backupGenerationsRoot,
    generationId,
  );
  if (!sameDirectoryIdentity(stageDirectory.identity, publishedDirectory.identity)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup generation identity changed during publication");
  }
  if (pathEntryExistsNoFollow(stageDirectory.path)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Backup stage remained after publication");
  }
  hooks.afterPublish?.();
  assertOwnedRuntimeDirectory(layout, publishedDirectory);
  return verifyBackupGeneration(layout, generationId);
}

function memberPath(layout: RuntimeLayout, fileName: string): string {
  return path.join(layout.root, fileName);
}

function inspectPrimaryMember(layout: RuntimeLayout, fileName: (typeof PRIMARY_MEMBER_NAMES)[number]): PrimaryFileMember {
  const read = readRegularFile(memberPath(layout, fileName));
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
  const members = PRIMARY_MEMBER_NAMES.filter((fileName) => pathEntryExistsNoFollow(memberPath(layout, fileName))).map(
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
    !PRIMARY_MEMBER_NAMES.includes(record.fileName as (typeof PRIMARY_MEMBER_NAMES)[number]) ||
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
    fileName: record.fileName as (typeof PRIMARY_MEMBER_NAMES)[number],
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
      canonicalJson(PRIMARY_MEMBER_NAMES.filter((name) => expectedNames.includes(name)))
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
    ["acknowledgeDataLoss", "applicationVersion", "expectedCurrent", "generationId"],
    "restore request",
  );
  assertUuid(record.generationId, "Restore generationId");
  if (record.acknowledgeDataLoss !== true) {
    throw persistenceFailure("RESTORE_ACK_REQUIRED", "Restore requires explicit data-loss acknowledgement");
  }
  if (!isNonemptyString(record.applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "Restore applicationVersion must be nonempty");
  }
  return Object.freeze({
    generationId: record.generationId,
    expectedCurrent: parsePrimaryIdentity(record.expectedCurrent),
    acknowledgeDataLoss: true,
    applicationVersion: record.applicationVersion,
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
    ],
    "restore intent",
  );
  assertUuid(record.restoreId, "Restore intent restoreId");
  assertUuid(record.backupGenerationId, "Restore intent backupGenerationId");
  if (
    record.schemaVersion !== 1 ||
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
  return Object.freeze({
    schemaVersion: 1,
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
    ],
    "restore receipt",
  );
  assertUuid(record.restoreId, "Restore receipt restoreId");
  assertUuid(record.backupGenerationId, "Restore receipt backupGenerationId");
  if (
    record.schemaVersion !== 1 ||
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
  return Object.freeze({
    schemaVersion: 1,
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

function inspectMemberAt(filePath: string, fileName: (typeof PRIMARY_MEMBER_NAMES)[number]): PrimaryFileMember {
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
  if (
    sha256(canonicalJson(generation.manifest)) !== intent.backupManifestSha256 ||
    generation.manifest.sourceSchemaVersion !== intent.targetSchemaVersion
  ) {
    throw persistenceFailure("RESTORE_BLOCKED", "Restore intent no longer matches the backup generation");
  }
  return generation;
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
      if (!allowed.has(name as (typeof PRIMARY_MEMBER_NAMES)[number])) {
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
  for (const fileName of PRIMARY_MEMBER_NAMES) {
    assertRuntimeLayout(layout);
    assertOwnedRuntimeDirectory(layout, retainedDirectory);
    const primaryPath = memberPath(layout, fileName);
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
  const receipt: RestoreReceipt = Object.freeze({
    schemaVersion: 1,
    restoreId: intent.restoreId,
    backupGenerationId: intent.backupGenerationId,
    restoredAt: new Date().toISOString(),
    applicationVersion: intent.applicationVersion,
    previousIdentitySha256: intent.expectedCurrent.identitySha256,
    targetDatabaseSha256: intent.stageIdentity.sha256,
    targetSchemaVersion: evidence.schemaVersion,
    retainedDirectory: intent.restoreId,
    retainedDirectoryIdentity: intent.retainedDirectoryIdentity,
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
    if (hasRestoreIntent(layout)) {
      throw persistenceFailure("RESTORE_RECOVERY_REQUIRED", "A prior restore intent requires explicit recovery");
    }
    assertExpectedPrimaryIdentity(layout, request.expectedCurrent);
    const generation = verifyBackupGeneration(layout, request.generationId);
    const restoreId = randomUUID();
    const stage = await stageRestoreTarget(layout, restoreId, generation, hooks);
    token.assertHeld();
    hooks.beforeIntent?.();
    token.assertHeld();
    assertExpectedPrimaryIdentity(layout, request.expectedCurrent);
    const retainedDirectory = createPrivateDirectory(layout, layout.restoreRetainedRoot, restoreId);
    if (path.basename(retainedDirectory.path) !== restoreId) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Restore retained directory identity changed");
    }
    const intent: RestoreIntent = Object.freeze({
      schemaVersion: 1,
      restoreId,
      backupGenerationId: generation.generationId,
      backupManifestSha256: sha256(canonicalJson(generation.manifest)),
      applicationVersion: request.applicationVersion,
      expectedCurrent: request.expectedCurrent,
      stageIdentity: stage.identity,
      retainedDirectoryIdentity: retainedDirectory.identity,
      targetSchemaVersion: stage.evidence.schemaVersion,
      createdAt: new Date().toISOString(),
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
    assertExpectedPrimaryIdentity(layout, request.expectedCurrent);
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
