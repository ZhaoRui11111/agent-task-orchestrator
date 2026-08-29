import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { persistenceFailure } from "./errors.ts";
import {
  canonicalArray,
  canonicalJson,
  decodeUtf8,
  exactRecord,
  type FileIdentity,
  inspectRegularFile,
  isCanonicalUtcTimestamp,
  isNonemptyString,
  readRegularFile,
  sameFileIdentity,
  sha256,
  unlinkOwnedFile,
  writeExclusiveFile,
} from "./values.ts";

export const RUNTIME_ENVIRONMENT_VARIABLE = "TASK_ORCHESTRATOR_DATA_DIR" as const;
export const RUNTIME_DIRECTORY_NAME = "agent-task-orchestrator" as const;

export interface RuntimeRootRequest {
  readonly runtimeRoot: string | null;
  readonly sourceCheckoutRoot: string;
  readonly projectRoots: readonly string[];
}

export interface RuntimeLayout {
  readonly root: string;
  readonly databasePath: string;
  readonly backupsRoot: string;
  readonly backupStagingRoot: string;
  readonly backupGenerationsRoot: string;
  readonly connectionsRoot: string;
  readonly restoreRoot: string;
  readonly restoreStagingRoot: string;
  readonly restoreRetainedRoot: string;
  readonly restoreReceiptsRoot: string;
  readonly restoreIntentPath: string;
  readonly lifecycleLockPath: string;
  readonly privatePermissionsEnforced: boolean;
}

export interface LifecycleLockToken {
  readonly operationId: string;
  readonly operation: string;
  assertHeld(): void;
}

export interface ConnectionReceipt {
  readonly receiptId: string;
  readonly path: string;
  readonly identity: FileIdentity;
  readonly checksumSha256: string;
}

export type DirectoryIdentity = Readonly<{ dev: string; ino: string; mode: number }>;
export interface OwnedRuntimeDirectory {
  readonly path: string;
  readonly parent: string;
  readonly identity: DirectoryIdentity;
}
const runtimeLayouts = new WeakMap<object, readonly Readonly<{ path: string; identity: DirectoryIdentity }>[] >();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function identityOfDirectory(value: string): DirectoryIdentity {
  try {
    const stats = lstatSync(value);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime path component is not a real directory");
    }
    return Object.freeze({ dev: String(stats.dev), ino: String(stats.ino), mode: stats.mode });
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime directory identity could not be established", {}, error);
  }
}

export function sameDirectoryIdentity(
  left: Readonly<{ dev: string; ino: string; mode: number }>,
  right: Readonly<{ dev: string; ino: string; mode: number }>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function comparablePath(value: string, platform: string): string {
  const resolved = path.resolve(value);
  return platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function pathsOverlap(left: string, right: string, platform: string): boolean {
  const first = comparablePath(left, platform);
  const second = comparablePath(right, platform);
  return (
    first === second ||
    first.startsWith(`${second}${path.sep}`) ||
    second.startsWith(`${first}${path.sep}`)
  );
}

function rejectLexicalAmbiguity(value: string): void {
  if (!path.isAbsolute(value)) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root must be absolute");
  }
  const parsed = path.parse(value);
  if (process.platform === "win32") {
    if (/^\\\\(?:[?.]\\|[^\\])/u.test(value) || !/^[A-Za-z]:[\\/]/u.test(value)) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root must be a drive-qualified local path");
    }
  }
  const remainder = value.slice(parsed.root.length);
  const segments = remainder.split(/[\\/]+/u).filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root contains a lexical traversal component");
  }
  if (path.resolve(value) === path.resolve(parsed.root)) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root must not be a filesystem root");
  }
}

function canonicalExistingRoot(value: string, label: string): string {
  rejectLexicalAmbiguity(value);
  try {
    const stats = lstatSync(value);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", `${label} must be a real directory`);
    }
    return realpathSync.native(value);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", `${label} does not exist`, {}, error);
    }
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", `${label} cannot be resolved safely`, {}, error);
  }
}

function createPrivateDirectoryTree(candidate: string, platform: string): string {
  const absolute = path.resolve(candidate);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  let parentIdentity = identityOfDirectory(current);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter((segment) => segment.length > 0);

  for (const segment of segments) {
    const next = path.join(current, segment);
    if (existsSync(next)) {
      const observed = identityOfDirectory(next);
      const parentAfter = identityOfDirectory(current);
      if (!sameDirectoryIdentity(parentIdentity, parentAfter)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime ancestor identity changed during traversal");
      }
      current = next;
      parentIdentity = observed;
      continue;
    }

    const parentBeforeCreate = identityOfDirectory(current);
    if (!sameDirectoryIdentity(parentIdentity, parentBeforeCreate)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime ancestor identity changed before creation");
    }
    try {
      mkdirSync(next, { mode: 0o700 });
    } catch (error) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime directory creation lost ownership", {}, error);
    }
    const created = identityOfDirectory(next);
    const parentAfterCreate = identityOfDirectory(current);
    if (!sameDirectoryIdentity(parentBeforeCreate, parentAfterCreate)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime ancestor identity changed during creation");
    }
    if (platform !== "win32" && (created.mode & 0o077) !== 0) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime directory permissions are not user-only");
    }
    current = next;
    parentIdentity = created;
  }

  const resolved = realpathSync.native(absolute);
  if (comparablePath(resolved, platform) !== comparablePath(absolute, platform)) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root resolves through an alias");
  }
  if (platform !== "win32" && (parentIdentity.mode & 0o077) !== 0) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime directory permissions are not user-only");
  }
  return resolved;
}

function parseRuntimeRequest(value: unknown): RuntimeRootRequest {
  const record = exactRecord(value, ["runtimeRoot", "sourceCheckoutRoot", "projectRoots"], "runtime root request");
  if (!(record.runtimeRoot === null || isNonemptyString(record.runtimeRoot))) {
    throw persistenceFailure("INVALID_INPUT", "runtimeRoot must be null or a nonempty absolute path");
  }
  if (!isNonemptyString(record.sourceCheckoutRoot)) {
    throw persistenceFailure("INVALID_INPUT", "sourceCheckoutRoot must be a nonempty absolute path");
  }
  const projectRoots = canonicalArray(record.projectRoots, "projectRoots");
  if (!projectRoots.every((item) => isNonemptyString(item))) {
    throw persistenceFailure("INVALID_INPUT", "projectRoots must contain only nonempty paths");
  }
  return Object.freeze({
    runtimeRoot: record.runtimeRoot,
    sourceCheckoutRoot: record.sourceCheckoutRoot,
    projectRoots: Object.freeze(projectRoots as string[]),
  });
}

export function selectConfiguredRuntimeRoot(
  explicitRoot: string | null,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  platform: string = process.platform,
): string {
  if (explicitRoot !== null) return explicitRoot;
  const override = environment[RUNTIME_ENVIRONMENT_VARIABLE];
  if (override !== undefined && override.length > 0) return override;
  if (platform !== "win32") {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "No default runtime root is defined for this platform");
  }
  const localApplicationData = environment.LOCALAPPDATA;
  if (!isNonemptyString(localApplicationData)) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Windows local application-data directory is unavailable");
  }
  return path.join(localApplicationData, RUNTIME_DIRECTORY_NAME);
}

export function prepareRuntimeLayout(value: unknown): RuntimeLayout {
  const request = parseRuntimeRequest(value);
  const selected = selectConfiguredRuntimeRoot(request.runtimeRoot);
  rejectLexicalAmbiguity(selected);
  const candidate = path.resolve(selected);
  const sourceCheckoutRoot = canonicalExistingRoot(request.sourceCheckoutRoot, "source checkout root");
  const projectRoots = request.projectRoots.map((root, index) =>
    canonicalExistingRoot(root, `Project root ${index}`),
  );
  for (const protectedRoot of [sourceCheckoutRoot, ...projectRoots]) {
    if (pathsOverlap(candidate, protectedRoot, process.platform)) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime root overlaps a protected checkout or Project root");
    }
  }

  const root = createPrivateDirectoryTree(candidate, process.platform);
  for (const protectedRoot of [sourceCheckoutRoot, ...projectRoots]) {
    if (pathsOverlap(root, protectedRoot, process.platform)) {
      throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Resolved runtime root overlaps a protected root");
    }
  }

  const backupsRoot = createPrivateDirectoryTree(path.join(root, "backups"), process.platform);
  const backupStagingRoot = createPrivateDirectoryTree(path.join(backupsRoot, ".staging"), process.platform);
  const backupGenerationsRoot = createPrivateDirectoryTree(path.join(backupsRoot, "generations"), process.platform);
  const connectionsRoot = createPrivateDirectoryTree(path.join(root, "connections"), process.platform);
  const restoreRoot = createPrivateDirectoryTree(path.join(root, "restore"), process.platform);
  const restoreStagingRoot = createPrivateDirectoryTree(path.join(restoreRoot, "staging"), process.platform);
  const restoreRetainedRoot = createPrivateDirectoryTree(path.join(restoreRoot, "retained"), process.platform);
  const restoreReceiptsRoot = createPrivateDirectoryTree(path.join(restoreRoot, "receipts"), process.platform);
  const layout = Object.freeze({
    root,
    databasePath: path.join(root, "state.sqlite3"),
    backupsRoot,
    backupStagingRoot,
    backupGenerationsRoot,
    connectionsRoot,
    restoreRoot,
    restoreStagingRoot,
    restoreRetainedRoot,
    restoreReceiptsRoot,
    restoreIntentPath: path.join(restoreRoot, "intent.json"),
    lifecycleLockPath: path.join(root, "lifecycle.lock"),
    privatePermissionsEnforced: process.platform !== "win32",
  });
  runtimeLayouts.set(
    layout,
    Object.freeze(
      [
        root,
        backupsRoot,
        backupStagingRoot,
        backupGenerationsRoot,
        connectionsRoot,
        restoreRoot,
        restoreStagingRoot,
        restoreRetainedRoot,
        restoreReceiptsRoot,
      ].map((directory) => Object.freeze({ path: directory, identity: identityOfDirectory(directory) })),
    ),
  );
  return layout;
}

export function assertRuntimeLayout(value: RuntimeLayout): void {
  const issuedIdentities = runtimeLayouts.get(value as object);
  if (issuedIdentities === undefined) {
    throw persistenceFailure("INVALID_INPUT", "Runtime layout was not issued by the persistence owner");
  }
  try {
    const resolved = realpathSync.native(value.root);
    if (comparablePath(resolved, process.platform) !== comparablePath(value.root, process.platform)) {
      throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime layout root identity changed");
    }
    for (const issued of issuedIdentities) {
      const observed = identityOfDirectory(issued.path);
      if (!sameDirectoryIdentity(issued.identity, observed)) {
        throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime directory identity changed after issuance");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "PersistenceError") throw error;
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime layout identity could not be revalidated", {}, error);
  }
}

function issuedDirectoryIdentity(layout: RuntimeLayout, directory: string): DirectoryIdentity {
  const issued = runtimeLayouts.get(layout as object)?.find((item) => item.path === directory);
  if (issued === undefined) {
    throw persistenceFailure("INVALID_INPUT", "Runtime child parent is not an issued directory");
  }
  return issued.identity;
}

function assertLeafIdentifier(identifier: string): void {
  if (
    !isNonemptyString(identifier) ||
    identifier === "." ||
    identifier === ".." ||
    path.basename(identifier) !== identifier ||
    identifier.includes("/") ||
    identifier.includes("\\")
  ) {
    throw persistenceFailure("INVALID_INPUT", "Runtime child identifier is not a canonical leaf name");
  }
}

export function captureOwnedRuntimeDirectory(
  layout: RuntimeLayout,
  parent: string,
  identifier: string,
): OwnedRuntimeDirectory {
  assertLeafIdentifier(identifier);
  assertRuntimeLayout(layout);
  const issuedParent = issuedDirectoryIdentity(layout, parent);
  const parentBefore = identityOfDirectory(parent);
  if (!sameDirectoryIdentity(issuedParent, parentBefore)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime child parent identity changed before capture");
  }
  const childPath = path.join(parent, identifier);
  const identity = identityOfDirectory(childPath);
  const parentAfter = identityOfDirectory(parent);
  if (!sameDirectoryIdentity(parentBefore, parentAfter)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime child parent identity changed during capture");
  }
  assertRuntimeLayout(layout);
  return Object.freeze({ path: childPath, parent, identity });
}

export function createOwnedRuntimeDirectory(
  layout: RuntimeLayout,
  parent: string,
  identifier: string,
): OwnedRuntimeDirectory {
  assertLeafIdentifier(identifier);
  assertRuntimeLayout(layout);
  const issuedParent = issuedDirectoryIdentity(layout, parent);
  const parentBefore = identityOfDirectory(parent);
  if (!sameDirectoryIdentity(issuedParent, parentBefore)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime child parent identity changed before creation");
  }
  const childPath = path.join(parent, identifier);
  try {
    mkdirSync(childPath, { mode: 0o700 });
  } catch (error) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime child directory could not be created exclusively", {}, error);
  }
  const identity = identityOfDirectory(childPath);
  const parentAfter = identityOfDirectory(parent);
  if (!sameDirectoryIdentity(parentBefore, parentAfter)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Runtime child parent identity changed during creation");
  }
  if (process.platform !== "win32" && (identity.mode & 0o077) !== 0) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Runtime child directory permissions are not user-only");
  }
  const owned = Object.freeze({ path: childPath, parent, identity });
  assertOwnedRuntimeDirectory(layout, owned);
  return owned;
}

export function assertOwnedRuntimeDirectory(
  layout: RuntimeLayout,
  owned: OwnedRuntimeDirectory,
): void {
  assertRuntimeLayout(layout);
  const issuedParent = issuedDirectoryIdentity(layout, owned.parent);
  const parent = identityOfDirectory(owned.parent);
  if (!sameDirectoryIdentity(issuedParent, parent)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned runtime directory parent identity changed");
  }
  const observed = identityOfDirectory(owned.path);
  if (!sameDirectoryIdentity(owned.identity, observed)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned runtime directory identity changed");
  }
  if (process.platform !== "win32" && (observed.mode & 0o077) !== 0) {
    throw persistenceFailure("UNSAFE_RUNTIME_ROOT", "Owned runtime directory permissions are not user-only");
  }
  const parentAfter = identityOfDirectory(owned.parent);
  if (!sameDirectoryIdentity(parent, parentAfter)) {
    throw persistenceFailure("PATH_IDENTITY_CHANGED", "Owned runtime directory parent changed during validation");
  }
}

export async function withLifecycleLock<T>(
  layout: RuntimeLayout,
  operation: string,
  callback: (token: LifecycleLockToken) => T | Promise<T>,
): Promise<T> {
  assertRuntimeLayout(layout);
  const operationId = randomUUID();
  const bytes = canonicalJson({ schemaVersion: 1, operation, operationId, processId: process.pid });
  const checksumSha256 = sha256(bytes);
  let identity: FileIdentity;
  try {
    identity = writeExclusiveFile(layout.lifecycleLockPath, bytes);
  } catch (error) {
    if (existsSync(layout.lifecycleLockPath)) {
      try {
        inspectRegularFile(layout.lifecycleLockPath);
      } catch (identityError) {
        throw persistenceFailure("LIFECYCLE_IDENTITY_CHANGED", "Lifecycle lock path is unsafe", {}, identityError);
      }
      throw persistenceFailure("LIFECYCLE_BUSY", "Another lifecycle operation or crash residue owns the lock", {}, error);
    }
    throw error;
  }

  const token = Object.freeze({
    operationId,
    operation,
    assertHeld(): void {
      assertRuntimeLayout(layout);
      const observed = readRegularFile(layout.lifecycleLockPath);
      if (
        !sameFileIdentity(identity, observed.identity) ||
        sha256(observed.bytes) !== checksumSha256
      ) {
        throw persistenceFailure("LIFECYCLE_IDENTITY_CHANGED", "Lifecycle lock identity changed");
      }
      assertRuntimeLayout(layout);
    },
  });

  let result: T | undefined;
  let callbackError: unknown;
  try {
    token.assertHeld();
    result = await callback(token);
    token.assertHeld();
  } catch (error) {
    callbackError = error;
  }

  let cleanupError: unknown;
  try {
    token.assertHeld();
    unlinkOwnedFile(layout.lifecycleLockPath, identity, checksumSha256);
  } catch (error) {
    cleanupError = error;
  }
  if (cleanupError !== undefined) {
    throw persistenceFailure("LIFECYCLE_IDENTITY_CHANGED", "Lifecycle lock could not be released safely", {}, cleanupError);
  }
  if (callbackError !== undefined) throw callbackError;
  return result as T;
}

function parseConnectionReceipt(
  pathValue: string,
): Readonly<{ receiptId: string; checksumSha256: string }> {
  try {
    const read = readRegularFile(pathValue);
    const text = decodeUtf8(read.bytes, "connection receipt");
    const value = JSON.parse(text) as unknown;
    if (text !== canonicalJson(value)) {
      throw persistenceFailure("ACTIVE_CONNECTIONS", "Connection receipt is not canonical JSON");
    }
    const record = exactRecord(
      value,
      ["applicationVersion", "openedAt", "processId", "receiptId", "schemaVersion"],
      "connection receipt",
    );
    if (
      record.schemaVersion !== 1 ||
      !isNonemptyString(record.applicationVersion) ||
      !isCanonicalUtcTimestamp(record.openedAt) ||
      typeof record.processId !== "number" ||
      !Number.isSafeInteger(record.processId) ||
      !isNonemptyString(record.receiptId) ||
      !UUID_PATTERN.test(record.receiptId)
    ) {
      throw persistenceFailure("ACTIVE_CONNECTIONS", "Connection receipt has an invalid schema");
    }
    return Object.freeze({ receiptId: record.receiptId, checksumSha256: sha256(read.bytes) });
  } catch (error) {
    throw persistenceFailure("ACTIVE_CONNECTIONS", "Connection receipt is corrupt", {}, error);
  }
}

export function listConnectionReceiptNames(layout: RuntimeLayout): readonly string[] {
  assertRuntimeLayout(layout);
  const names = readdirSync(layout.connectionsRoot).sort();
  for (const name of names) {
    if (!UUID_PATTERN.test(name.replace(/\.json$/u, "")) || !name.endsWith(".json")) {
      throw persistenceFailure("ACTIVE_CONNECTIONS", "Connection receipt inventory contains an unknown member");
    }
    const parsed = parseConnectionReceipt(path.join(layout.connectionsRoot, name));
    if (`${parsed.receiptId}.json` !== name) {
      throw persistenceFailure("ACTIVE_CONNECTIONS", "Connection receipt filename and content differ");
    }
  }
  assertRuntimeLayout(layout);
  return Object.freeze(names);
}

export function ensureNoConnectionReceipts(layout: RuntimeLayout): void {
  if (listConnectionReceiptNames(layout).length !== 0) {
    throw persistenceFailure("ACTIVE_CONNECTIONS", "Active or crash-stale connection receipts block this operation");
  }
}

export function createConnectionReceipt(
  layout: RuntimeLayout,
  applicationVersion: string,
  token: LifecycleLockToken,
): ConnectionReceipt {
  token.assertHeld();
  assertRuntimeLayout(layout);
  if (!isNonemptyString(applicationVersion)) {
    throw persistenceFailure("INVALID_INPUT", "applicationVersion must be nonempty");
  }
  const receiptId = randomUUID();
  const receiptPath = path.join(layout.connectionsRoot, `${receiptId}.json`);
  const bytes = canonicalJson({
    applicationVersion,
    openedAt: new Date().toISOString(),
    processId: process.pid,
    receiptId,
    schemaVersion: 1,
  });
  token.assertHeld();
  assertRuntimeLayout(layout);
  const identity = writeExclusiveFile(receiptPath, bytes);
  assertRuntimeLayout(layout);
  if (!sameFileIdentity(identity, inspectRegularFile(receiptPath))) {
    throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt identity changed during creation");
  }
  token.assertHeld();
  return Object.freeze({ receiptId, path: receiptPath, identity, checksumSha256: sha256(bytes) });
}

export function releaseConnectionReceipt(
  layout: RuntimeLayout,
  receipt: ConnectionReceipt,
  token: LifecycleLockToken,
): void {
  token.assertHeld();
  assertRuntimeLayout(layout);
  const expectedPath = path.join(layout.connectionsRoot, `${receipt.receiptId}.json`);
  if (expectedPath !== receipt.path) {
    throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt path changed");
  }
  try {
    const parsed = parseConnectionReceipt(receipt.path);
    if (
      parsed.receiptId !== receipt.receiptId ||
      parsed.checksumSha256 !== receipt.checksumSha256
    ) {
      throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt content changed");
    }
    token.assertHeld();
    assertRuntimeLayout(layout);
    unlinkOwnedFile(receipt.path, receipt.identity, receipt.checksumSha256);
    assertRuntimeLayout(layout);
  } catch (error) {
    throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt identity changed", {}, error);
  }
  token.assertHeld();
}

export function assertConnectionReceiptHeld(layout: RuntimeLayout, receipt: ConnectionReceipt): void {
  try {
    assertRuntimeLayout(layout);
    const expectedPath = path.join(layout.connectionsRoot, `${receipt.receiptId}.json`);
    if (receipt.path !== expectedPath) {
      throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt path changed");
    }
    const parsed = parseConnectionReceipt(receipt.path);
    const observed = inspectRegularFile(receipt.path);
    if (
      parsed.receiptId !== receipt.receiptId ||
      parsed.checksumSha256 !== receipt.checksumSha256 ||
      !sameFileIdentity(receipt.identity, observed)
    ) {
      throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt identity changed");
    }
    assertRuntimeLayout(layout);
  } catch (error) {
    throw persistenceFailure("CONNECTION_RECEIPT_CHANGED", "Connection receipt is absent or unsafe", {}, error);
  }
}

export function hasRestoreIntent(layout: RuntimeLayout): boolean {
  assertRuntimeLayout(layout);
  if (!existsSync(layout.restoreIntentPath)) return false;
  inspectRegularFile(layout.restoreIntentPath);
  assertRuntimeLayout(layout);
  return true;
}

export function readTextFileForDiagnostics(pathValue: string): string {
  return decodeUtf8(readFileSync(pathValue), "diagnostic file");
}
