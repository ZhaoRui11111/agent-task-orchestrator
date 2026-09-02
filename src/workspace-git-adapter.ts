import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKSPACE_CONTRACT_ID,
  parseWorkspaceBackendRequest,
  parseWorkspaceBackendResult,
  type WorkspaceBackend,
  type WorkspaceBackendFailure,
  type WorkspaceBackendReceipt,
  type WorkspaceBackendRequest,
  type WorkspaceBackendResult,
  type WorkspaceFailureCategory,
  type WorkspaceOperation,
  type WorkspaceReceiptCode,
} from "./workspace-port.ts";

export const WINDOWS_GIT_WORKSPACE_ADAPTER_ID = "windows-git-local" as const;
export const WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION = "1.0.0" as const;

export interface WindowsGitWorkspaceRootBinding {
  readonly rootKey: string;
  readonly path: string;
}

export interface WindowsGitWorkspaceAdapterConfiguration {
  readonly gitExecutable: string;
  readonly projectRoots: readonly WindowsGitWorkspaceRootBinding[];
  readonly workspaceRoots: readonly WindowsGitWorkspaceRootBinding[];
}

export interface WindowsGitWorkspaceAdapterDescription {
  readonly adapterId: typeof WINDOWS_GIT_WORKSPACE_ADAPTER_ID;
  readonly adapterVersion: typeof WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION;
  readonly contractId: typeof WORKSPACE_CONTRACT_ID;
  readonly projectRootCount: number;
  readonly workspaceRootCount: number;
}

export interface WindowsGitWorkspaceBackend extends WorkspaceBackend {
  readonly description: WindowsGitWorkspaceAdapterDescription;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

interface FileIdentity {
  readonly realPath: string;
  readonly dev: string;
  readonly ino: string;
  readonly mode: number;
}

interface TrustedRoot {
  readonly rootKey: string;
  readonly path: string;
  readonly identity: FileIdentity;
}

interface TreeEntry {
  readonly mode: "100644" | "100755";
  readonly objectId: string;
  readonly size: number;
  readonly relativePath: string;
  readonly segments: readonly string[];
  readonly dataBase64: string;
}

interface RepositorySnapshot {
  readonly gitExecutable: string;
  readonly nodeExecutable: string;
  readonly modulePath: string;
  readonly projectRoot: TrustedRoot;
  readonly workspaceRoot: TrustedRoot;
  readonly commonDirectory: string;
  readonly commonIdentity: FileIdentity;
  readonly objectDirectory: string;
  readonly objectIdentity: FileIdentity;
  readonly worktreesDirectory: string;
  readonly targetDirectory: string;
  readonly targetComponents: readonly string[];
  readonly adminName: string;
  readonly adminDirectory: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly baseObjectId: string;
  readonly repositoryIdentity: string;
  readonly tree: readonly TreeEntry[];
}

interface PhysicalObservation {
  readonly state: "absent" | "partial" | "complete";
  readonly canonicalPath: string | null;
  readonly registrationIdentity: string | null;
  readonly baseObjectId: string | null;
  readonly headObjectId: string | null;
  readonly trackedCount: number;
}

interface WorkerPayload {
  readonly snapshot: RepositorySnapshot;
  readonly request: WorkspaceBackendRequest;
  readonly remainingComponents?: readonly string[];
  readonly treePrefix?: readonly string[];
  readonly guardPath?: string;
  readonly guardIdentity?: FileIdentity;
}

interface WorkerResult {
  readonly ok: boolean;
  readonly effectStarted: boolean;
  readonly code: string;
}

interface DirectoryAcquisitionSuccess {
  readonly ok: true;
  readonly path: string;
  readonly identity: FileIdentity;
  readonly created: boolean;
}

interface DirectoryAcquisitionFailure {
  readonly ok: false;
  readonly effectStarted: boolean;
}

type DirectoryAcquisitionResult = DirectoryAcquisitionSuccess | DirectoryAcquisitionFailure;
type DirectoryIdentityReader = (target: string) => FileIdentity;
type CreateWorkerRunner = (
  snapshot: RepositorySnapshot,
  request: WorkspaceBackendRequest,
) => WorkerResult;

class AdapterRefusal extends Error {
  readonly category: WorkspaceFailureCategory;
  readonly code: string;
  readonly ambiguous: boolean;

  constructor(category: WorkspaceFailureCategory, code: string, ambiguous = false) {
    super(code);
    this.name = "AdapterRefusal";
    this.category = category;
    this.code = code;
    this.ambiguous = ambiguous;
  }
}

const MAX_GIT_OUTPUT = 16 * 1024 * 1024;
const MAX_TREE_BYTES = 8 * 1024 * 1024;
const MAX_TREE_ENTRIES = 256;
const MAX_CHILD_NAME_LENGTH = 96;
const MAX_OBJECT_STORE_ENTRIES = 16 * 1024;
const MAX_WORKER_INPUT = 24 * 1024 * 1024;
const MAX_PATH_LENGTH = 240;
const EXPECTED_NODE_VERSION = "24.19.0";
const EXPECTED_GIT_VERSION = "git version 2.53.0.windows.1";
const WORKER_MARKER = "--ato-workspace-worker";
const MANIFEST_NAME = "ato-workspace-ownership-v1.json";
const LOCK_REASON = "ato.workspace/v1 ownership\n";
const WORKSPACE_PARENT_NAME = "ato-workspaces";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value))}\n`;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function hashReference(value: unknown): string {
  return `sha256:${sha256(canonicalJson(value))}`;
}

function exactRecord(value: unknown, keys: readonly string[]): UnknownRecord | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const expected = new Set(keys);
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !expected.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function decodeUtf8(value: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw new AdapterRefusal("integrity_failure", "non_utf8_external_output", true);
  }
}

function samePath(left: string, right: string): boolean {
  const comparable = (value: string): string => {
    const withoutExtendedPrefix = value.startsWith("\\\\?\\") ? value.slice(4) : value;
    return path.resolve(withoutExtendedPrefix).toLocaleLowerCase("en-US");
  };
  return comparable(left) === comparable(right);
}

function processCwd(value: string): string {
  return process.platform === "win32" && value.length >= 240 && !value.startsWith("\\\\?\\")
    ? `\\\\?\\${value}`
    : value;
}

function pathContains(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function identityFor(target: string, kind: "directory" | "file"): FileIdentity {
  let stats: ReturnType<typeof lstatSync>;
  try {
    stats = lstatSync(target);
  } catch {
    throw new AdapterRefusal("conflict", "path_identity_unavailable");
  }
  if (stats.isSymbolicLink() || (kind === "directory" ? !stats.isDirectory() : !stats.isFile())) {
    throw new AdapterRefusal("conflict", "unsafe_path_component");
  }
  let realPath: string;
  try {
    realPath = realpathSync.native(target);
  } catch {
    throw new AdapterRefusal("conflict", "path_identity_unavailable");
  }
  if (!samePath(realPath, target)) throw new AdapterRefusal("conflict", "aliased_path_component");
  return Object.freeze({
    realPath,
    dev: String(stats.dev),
    ino: String(stats.ino),
    mode: stats.mode,
  });
}

function identityMatches(target: string, expected: FileIdentity, kind: "directory" | "file" = "directory"): boolean {
  try {
    const current = identityFor(target, kind);
    return samePath(current.realPath, expected.realPath) && current.dev === expected.dev &&
      current.ino === expected.ino && current.mode === expected.mode;
  } catch {
    return false;
  }
}

function sameObjectIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function lstatIfPresent(target: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(target);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as Readonly<{ code?: unknown }>).code
      : null;
    if (code === "ENOENT") return null;
    throw new AdapterRefusal("conflict", "path_identity_unavailable");
  }
}

function pathExistsNoFollow(target: string): boolean {
  return lstatIfPresent(target) !== null;
}

function validateComponentChain(target: string, finalKind: "directory" | "file"): FileIdentity {
  if (process.platform !== "win32") throw new TypeError("Windows Git workspace adapter requires win32");
  if (
    typeof target !== "string" || target.length === 0 || target.length > MAX_PATH_LENGTH ||
    target !== target.normalize("NFC") || /[\u0000-\u001f\u007f]/u.test(target) ||
    !/^[A-Za-z]:\\/u.test(target) || target.startsWith("\\\\") || !path.isAbsolute(target) ||
    path.normalize(target) !== target || samePath(path.parse(target).root, target)
  ) throw new TypeError("Trusted Windows path is invalid");
  const root = path.parse(target).root;
  const relative = path.relative(root, target);
  const segments = relative.split(path.sep);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined || segment.length === 0) throw new TypeError("Trusted Windows path is invalid");
    current = path.join(current, segment);
    identityFor(current, index === segments.length - 1 ? finalKind : "directory");
  }
  return identityFor(target, finalKind);
}

function rootKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function parseRootBindings(value: unknown, label: string): ReadonlyMap<string, TrustedRoot> {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length === 0) {
    throw new TypeError(`${label} must be a nonempty canonical array`);
  }
  const result = new Map<string, TrustedRoot>();
  for (const item of value) {
    const record = exactRecord(item, ["rootKey", "path"]);
    if (record === null || !rootKey(record.rootKey) || typeof record.path !== "string") {
      throw new TypeError(`${label} contains an invalid root binding`);
    }
    if (result.has(record.rootKey)) throw new TypeError(`${label} contains a duplicate root key`);
    const identity = validateComponentChain(record.path, "directory");
    for (const existing of result.values()) {
      if (samePath(existing.path, record.path)) throw new TypeError(`${label} contains an aliased root`);
    }
    result.set(record.rootKey, Object.freeze({ rootKey: record.rootKey, path: record.path, identity }));
  }
  return result;
}

function parseConfiguration(value: unknown): Readonly<{
  gitExecutable: string;
  gitIdentity: FileIdentity;
  projectRoots: ReadonlyMap<string, TrustedRoot>;
  workspaceRoots: ReadonlyMap<string, TrustedRoot>;
}> {
  const record = exactRecord(value, ["gitExecutable", "projectRoots", "workspaceRoots"]);
  if (record === null || typeof record.gitExecutable !== "string" || !/\.exe$/iu.test(record.gitExecutable)) {
    throw new TypeError("Windows Git workspace adapter configuration is invalid");
  }
  const gitIdentity = validateComponentChain(record.gitExecutable, "file");
  const nodeIdentity = identityFor(process.execPath, "file");
  if (process.versions.node !== EXPECTED_NODE_VERSION) {
    throw new TypeError("Windows Git workspace adapter Node version is unsupported");
  }
  if (!identityMatches(process.execPath, nodeIdentity, "file")) throw new TypeError("Node executable identity changed");
  const projectRoots = parseRootBindings(record.projectRoots, "projectRoots");
  const workspaceRoots = parseRootBindings(record.workspaceRoots, "workspaceRoots");
  for (const project of projectRoots.values()) {
    for (const workspace of workspaceRoots.values()) {
      if (pathContains(project.path, workspace.path) || pathContains(workspace.path, project.path)) {
        throw new TypeError("Project and workspace roots must be disjoint");
      }
    }
  }
  return Object.freeze({ gitExecutable: record.gitExecutable, gitIdentity, projectRoots, workspaceRoots });
}

function minimalEnvironment(kind: "git" | "node"): Readonly<Record<string, string | undefined>> {
  const environment: Record<string, string | undefined> = Object.create(null) as Record<string, string | undefined>;
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (systemRoot !== undefined) {
    environment.SystemRoot = systemRoot;
    environment.WINDIR = systemRoot;
  }
  if (kind === "git") {
    environment.GIT_CONFIG_NOSYSTEM = "1";
    environment.GIT_CONFIG_GLOBAL = "NUL";
    environment.GIT_TERMINAL_PROMPT = "0";
    environment.GCM_INTERACTIVE = "Never";
    environment.GIT_ASKPASS = "";
    environment.SSH_ASKPASS = "";
    environment.GIT_NO_REPLACE_OBJECTS = "1";
    environment.GIT_OPTIONAL_LOCKS = "0";
    environment.GIT_ATTR_NOSYSTEM = "1";
    environment.LANG = "C";
    environment.LC_ALL = "C";
  }
  return Object.freeze(environment);
}

const GIT_PREFIX = Object.freeze([
  "--no-pager",
  "-c", "credential.helper=",
  "-c", "core.hooksPath=NUL",
  "-c", "core.fsmonitor=false",
  "-c", "core.untrackedCache=false",
  "-c", "core.longpaths=true",
  "-c", "maintenance.auto=false",
  "-c", "gc.auto=0",
] as const);

function runCommandBytes(
  executable: string,
  cwd: string,
  args: readonly string[],
  kind: "git" | "node",
  timeout = 15_000,
  maxBuffer = MAX_GIT_OUTPUT,
): Uint8Array {
  const result = spawnSync(executable, args, {
    cwd: processCwd(cwd),
    env: minimalEnvironment(kind),
    timeout,
    maxBuffer,
    windowsHide: true,
    shell: false,
    stdio: "pipe",
  });
  if (result.error !== undefined || result.status !== 0 || result.signal !== null) {
    throw new AdapterRefusal("permanent_external", `${kind}_command_failed`);
  }
  return typeof result.stdout === "string" ? Buffer.from(result.stdout, "utf8") : result.stdout;
}

function runGitBytes(gitExecutable: string, cwd: string, args: readonly string[], maxBuffer = MAX_GIT_OUTPUT): Uint8Array {
  return runCommandBytes(gitExecutable, cwd, [...GIT_PREFIX, ...args], "git", 15_000, maxBuffer);
}

function runGitText(gitExecutable: string, cwd: string, args: readonly string[], maxBuffer = MAX_GIT_OUTPUT): string {
  return decodeUtf8(runGitBytes(gitExecutable, cwd, args, maxBuffer));
}

function singleLine(value: string, code: string): string {
  const lines = value.replace(/\r\n/gu, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length !== 1 || lines[0] === undefined || lines[0].length === 0) {
    throw new AdapterRefusal("integrity_failure", code, true);
  }
  return lines[0];
}

function readBounded(target: string, maximum: number): Uint8Array {
  const identity = identityFor(target, "file");
  let bytes: Uint8Array;
  try {
    if (lstatSync(target).size > maximum) throw new AdapterRefusal("conflict", "bounded_file_too_large");
    bytes = readFileSync(target);
  } catch (error) {
    if (error instanceof AdapterRefusal) throw error;
    throw new AdapterRefusal("conflict", "bounded_file_unreadable");
  }
  if (!identityMatches(target, identity, "file") || bytes.length > maximum) {
    throw new AdapterRefusal("conflict", "bounded_file_identity_changed");
  }
  return bytes;
}

function validateRepositoryConfiguration(commonDirectory: string): void {
  const configPath = path.join(commonDirectory, "config");
  const text = decodeUtf8(readBounded(configPath, 64 * 1024)).replace(/\r\n/gu, "\n");
  let section = "";
  const allowed: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
    core: new Set(["repositoryformatversion", "filemode", "bare", "logallrefupdates", "symlinks", "ignorecase"]),
    extensions: new Set(["objectformat", "compatobjectformat"]),
  });
  for (const sourceLine of text.split("\n")) {
    const line = sourceLine.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = /^\[([A-Za-z0-9.-]+)\]$/u.exec(line);
    if (sectionMatch !== null) {
      section = sectionMatch[1]?.toLocaleLowerCase("en-US") ?? "";
      if (!(section in allowed)) throw new AdapterRefusal("permanent_external", "unsupported_repository_config");
      continue;
    }
    const keyMatch = /^([A-Za-z0-9.-]+)\s*=\s*(.*)$/u.exec(line);
    const key = keyMatch?.[1]?.toLocaleLowerCase("en-US");
    if (key === undefined || section === "" || !allowed[section]?.has(key)) {
      throw new AdapterRefusal("permanent_external", "unsupported_repository_config");
    }
    const value = keyMatch?.[2]?.trim().toLocaleLowerCase("en-US") ?? "";
    if (section === "core" && key === "bare" && value !== "false") {
      throw new AdapterRefusal("permanent_external", "bare_repository_refused");
    }
    if (section === "core" && key === "filemode" && value !== "false") {
      throw new AdapterRefusal("permanent_external", "filemode_repository_refused");
    }
  }
  const infoDirectory = path.join(commonDirectory, "info");
  if (pathExistsNoFollow(infoDirectory)) {
    identityFor(infoDirectory, "directory");
    if (pathExistsNoFollow(path.join(infoDirectory, "attributes"))) {
      throw new AdapterRefusal("permanent_external", "repository_checkout_extensions_refused");
    }
    const excludePath = path.join(infoDirectory, "exclude");
    if (pathExistsNoFollow(excludePath)) identityFor(excludePath, "file");
  }
}

function validateObjectStoreDescendants(objectDirectory: string): void {
  const pending = [objectDirectory];
  let observedEntries = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    const held = identityFor(current, "directory");
    let names: readonly string[];
    try {
      names = readdirSync(current).sort();
    } catch {
      throw new AdapterRefusal("conflict", "object_store_inventory_unavailable");
    }
    observedEntries += names.length;
    if (observedEntries > MAX_OBJECT_STORE_ENTRIES) {
      throw new AdapterRefusal("resource_exhausted", "object_store_entry_limit");
    }
    for (const name of names) {
      const child = path.join(current, name);
      if (!pathContains(objectDirectory, child)) {
        throw new AdapterRefusal("permanent_external", "external_object_store_refused");
      }
      let stats: ReturnType<typeof lstatSync>;
      try {
        stats = lstatSync(child);
      } catch {
        throw new AdapterRefusal("conflict", "object_store_identity_unavailable");
      }
      if (stats.isSymbolicLink()) {
        throw new AdapterRefusal("permanent_external", "external_object_store_refused");
      }
      if (stats.isDirectory()) {
        identityFor(child, "directory");
        pending.push(child);
      } else if (stats.isFile()) {
        identityFor(child, "file");
      } else {
        throw new AdapterRefusal("permanent_external", "external_object_store_refused");
      }
    }
    if (!identityMatches(current, held)) {
      throw new AdapterRefusal("conflict", "object_store_identity_changed");
    }
  }
}

function validateObjectTopology(commonDirectory: string, objectDirectory: string): void {
  validateObjectStoreDescendants(objectDirectory);
  for (const relative of ["info/alternates", "info/http-alternates"] as const) {
    if (pathExistsNoFollow(path.join(objectDirectory, ...relative.split("/")))) {
      throw new AdapterRefusal("permanent_external", "alternate_object_store_refused");
    }
  }
  const packDirectory = path.join(objectDirectory, "pack");
  if (pathExistsNoFollow(packDirectory)) {
    identityFor(packDirectory, "directory");
    if (readdirSync(packDirectory).some((name) => name.toLocaleLowerCase("en-US").endsWith(".promisor"))) {
      throw new AdapterRefusal("permanent_external", "promisor_object_store_refused");
    }
  }
  if (pathExistsNoFollow(path.join(commonDirectory, "refs", "replace"))) {
    throw new AdapterRefusal("permanent_external", "replacement_objects_refused");
  }
  const packedRefs = path.join(commonDirectory, "packed-refs");
  if (pathExistsNoFollow(packedRefs) && decodeUtf8(readBounded(packedRefs, 4 * 1024 * 1024)).includes(" refs/replace/")) {
    throw new AdapterRefusal("permanent_external", "replacement_objects_refused");
  }
}

const WINDOWS_RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;

function validateTreePath(relativePath: string, targetDirectory: string): readonly string[] {
  if (
    relativePath.length === 0 || relativePath !== relativePath.normalize("NFC") ||
    /[\u0000-\u001f\u007f\\:*?"<>|]/u.test(relativePath) || relativePath.startsWith("/")
  ) throw new AdapterRefusal("permanent_external", "unsafe_tree_path");
  const segments = relativePath.split("/");
  if (segments.some((segment) =>
    segment.length === 0 || segment.length > MAX_CHILD_NAME_LENGTH || segment === "." || segment === ".." ||
    segment.endsWith(".") || segment.endsWith(" ") ||
    WINDOWS_RESERVED.test(segment) || segment.toLocaleLowerCase("en-US") === ".git"
  )) throw new AdapterRefusal("permanent_external", "unsafe_tree_path");
  const finalPath = path.join(targetDirectory, ...segments);
  if (!pathContains(targetDirectory, finalPath) || finalPath.length > MAX_PATH_LENGTH) {
    throw new AdapterRefusal("permanent_external", "unsafe_tree_path");
  }
  return Object.freeze(segments);
}

function parseTree(
  gitExecutable: string,
  projectRoot: string,
  targetDirectory: string,
  objectFormat: "sha1" | "sha256",
  baseObjectId: string,
): readonly TreeEntry[] {
  const output = runGitText(gitExecutable, projectRoot, ["ls-tree", "-r", "-l", "-z", "--full-tree", baseObjectId]);
  const records = output.split("\0");
  if (records.at(-1) === "") records.pop();
  if (records.length > MAX_TREE_ENTRIES) throw new AdapterRefusal("resource_exhausted", "tree_entry_limit");
  const expectedOidLength = objectFormat === "sha1" ? 40 : 64;
  const folded = new Set<string>();
  const directoryFolded = new Map<string, string>();
  const entries: TreeEntry[] = [];
  let total = 0;
  for (const record of records) {
    const match = /^(100644|100755) blob ([0-9a-f]+)\s+([0-9]+)\t([\s\S]+)$/u.exec(record);
    if (match === null) throw new AdapterRefusal("permanent_external", "unsupported_tree_entry");
    const mode = match[1] as "100644" | "100755";
    const objectId = match[2] ?? "";
    const size = Number(match[3]);
    const relativePath = match[4] ?? "";
    if (objectId.length !== expectedOidLength || !Number.isSafeInteger(size) || size < 0) {
      throw new AdapterRefusal("permanent_external", "unsupported_tree_entry");
    }
    const segments = validateTreePath(relativePath, targetDirectory);
    const foldedPath = relativePath.toLocaleLowerCase("en-US");
    if (folded.has(foldedPath) || directoryFolded.has(foldedPath)) {
      throw new AdapterRefusal("permanent_external", "case_colliding_tree");
    }
    for (let index = 1; index < segments.length; index += 1) {
      const originalDirectory = segments.slice(0, index).join("/");
      const directory = originalDirectory.toLocaleLowerCase("en-US");
      if (folded.has(directory)) throw new AdapterRefusal("permanent_external", "tree_prefix_collision");
      const priorSpelling = directoryFolded.get(directory);
      if (priorSpelling !== undefined && priorSpelling !== originalDirectory) {
        throw new AdapterRefusal("permanent_external", "case_colliding_tree");
      }
      directoryFolded.set(directory, originalDirectory);
    }
    folded.add(foldedPath);
    total += size;
    if (!Number.isSafeInteger(total) || total > MAX_TREE_BYTES) {
      throw new AdapterRefusal("resource_exhausted", "tree_byte_limit");
    }
    if (segments.some((segment) => segment.toLocaleLowerCase("en-US") === ".gitattributes") ||
        relativePath.toLocaleLowerCase("en-US") === ".gitmodules") {
      throw new AdapterRefusal("permanent_external", "repository_checkout_extensions_refused");
    }
    const data = runGitBytes(gitExecutable, projectRoot, ["cat-file", "blob", objectId], size + 1);
    if (data.length !== size) throw new AdapterRefusal("integrity_failure", "blob_size_mismatch", true);
    entries.push(Object.freeze({
      mode,
      objectId,
      size,
      relativePath,
      segments,
      dataBase64: Buffer.from(data).toString("base64"),
    }));
  }
  return Object.freeze(entries);
}

function revalidateRoot(root: TrustedRoot): void {
  if (!identityMatches(root.path, root.identity)) throw new AdapterRefusal("conflict", "trusted_root_changed");
}

function validateExistingDirectoryChain(root: string, components: readonly string[]): void {
  let current = root;
  for (const component of components) {
    current = path.join(current, component);
    if (!pathExistsNoFollow(current)) return;
    identityFor(current, "directory");
  }
}

function preflight(
  configuration: ReturnType<typeof parseConfiguration>,
  request: WorkspaceBackendRequest,
): RepositorySnapshot {
  if (!identityMatches(configuration.gitExecutable, configuration.gitIdentity, "file")) {
    throw new AdapterRefusal("conflict", "git_executable_changed");
  }
  const projectRoot = configuration.projectRoots.get(request.subject.projectRootKey);
  const workspaceRoot = configuration.workspaceRoots.get(request.subject.workspaceRootKey);
  if (projectRoot === undefined || workspaceRoot === undefined) {
    throw new AdapterRefusal("not_found", "trusted_root_key_unknown");
  }
  revalidateRoot(projectRoot);
  revalidateRoot(workspaceRoot);
  const gitVersion = singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["--version"]),
    "git_version_output_invalid",
  );
  if (gitVersion !== EXPECTED_GIT_VERSION) {
    throw new AdapterRefusal("permanent_external", "git_version_unsupported");
  }
  const commonDirectory = path.join(projectRoot.path, ".git");
  const commonIdentity = identityFor(commonDirectory, "directory");
  validateRepositoryConfiguration(commonDirectory);
  const objectDirectory = path.join(commonDirectory, "objects");
  const objectIdentity = identityFor(objectDirectory, "directory");
  validateObjectTopology(commonDirectory, objectDirectory);
  const gitDirectory = path.resolve(projectRoot.path, singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["rev-parse", "--absolute-git-dir"]),
    "git_directory_output_invalid",
  ));
  const reportedCommon = path.resolve(projectRoot.path, singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["rev-parse", "--git-common-dir"]),
    "git_common_directory_output_invalid",
  ));
  const topLevel = singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["rev-parse", "--show-toplevel"]),
    "git_top_level_output_invalid",
  );
  if (!samePath(gitDirectory, commonDirectory) || !samePath(reportedCommon, commonDirectory) ||
      !samePath(topLevel, projectRoot.path)) {
    throw new AdapterRefusal("permanent_external", "unsupported_repository_topology");
  }
  const bare = singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["rev-parse", "--is-bare-repository"]),
    "git_bare_output_invalid",
  );
  if (bare !== "false") throw new AdapterRefusal("permanent_external", "bare_repository_refused");
  const objectFormatValue = singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["rev-parse", "--show-object-format"]),
    "git_object_format_invalid",
  );
  if (objectFormatValue !== "sha1" && objectFormatValue !== "sha256") {
    throw new AdapterRefusal("permanent_external", "git_object_format_unsupported");
  }
  const objectFormat = objectFormatValue;
  const oidLength = objectFormat === "sha1" ? 40 : 64;
  if (!new RegExp(`^[0-9a-f]{${oidLength}}$`, "u").test(request.subject.baseReference)) {
    throw new AdapterRefusal("invalid_request", "base_object_id_invalid");
  }
  const verifiedBase = singleLine(
    runGitText(configuration.gitExecutable, projectRoot.path, ["rev-parse", "--verify", `${request.subject.baseReference}^{commit}`]),
    "base_object_verification_invalid",
  );
  if (verifiedBase !== request.subject.baseReference) {
    throw new AdapterRefusal("not_found", "base_commit_not_local");
  }
  const workspaceDigest = sha256(request.subject.workspaceId).toLocaleLowerCase("en-US");
  const targetComponents = Object.freeze([
    WORKSPACE_PARENT_NAME,
    `w-${workspaceDigest}-g${request.subject.generation}`,
  ]);
  const targetDirectory = path.join(workspaceRoot.path, ...targetComponents);
  if (!pathContains(workspaceRoot.path, targetDirectory) || targetDirectory.length > MAX_PATH_LENGTH) {
    throw new AdapterRefusal("permanent_external", "workspace_target_too_long");
  }
  const adminName = `ato-${request.subject.ownershipBindingSha256.toLocaleLowerCase("en-US")}`;
  const worktreesDirectory = path.join(commonDirectory, "worktrees");
  const adminDirectory = path.join(worktreesDirectory, adminName);
  if (!pathContains(commonDirectory, adminDirectory) || adminDirectory.length > MAX_PATH_LENGTH) {
    throw new AdapterRefusal("permanent_external", "workspace_admin_too_long");
  }
  validateExistingDirectoryChain(workspaceRoot.path, targetComponents);
  if (pathExistsNoFollow(worktreesDirectory)) {
    identityFor(worktreesDirectory, "directory");
    validateExistingDirectoryChain(worktreesDirectory, [adminName]);
  }
  const repositoryIdentity = hashReference({
    common: commonIdentity,
    object: objectIdentity,
    objectFormat,
    project: projectRoot.identity,
  });
  const tree = parseTree(
    configuration.gitExecutable,
    projectRoot.path,
    targetDirectory,
    objectFormat,
    request.subject.baseReference,
  );
  revalidateRoot(projectRoot);
  revalidateRoot(workspaceRoot);
  if (!identityMatches(commonDirectory, commonIdentity) || !identityMatches(objectDirectory, objectIdentity)) {
    throw new AdapterRefusal("conflict", "repository_identity_changed");
  }
  return Object.freeze({
    gitExecutable: configuration.gitExecutable,
    nodeExecutable: process.execPath,
    modulePath: fileURLToPath(import.meta.url),
    projectRoot,
    workspaceRoot,
    commonDirectory,
    commonIdentity,
    objectDirectory,
    objectIdentity,
    worktreesDirectory,
    targetDirectory,
    targetComponents,
    adminName,
    adminDirectory,
    objectFormat,
    baseObjectId: request.subject.baseReference,
    repositoryIdentity,
    tree,
  });
}

function forwardPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function exclusiveRegularFile(target: string, bytes: Uint8Array): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(target, "wx", 0o600);
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.isSymbolicLink()) throw new AdapterRefusal("conflict", "exclusive_leaf_not_regular");
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
  } catch (error) {
    if (descriptor !== null) {
      try { closeSync(descriptor); } catch { /* best effort descriptor release only */ }
    }
    if (error instanceof AdapterRefusal) throw error;
    throw new AdapterRefusal("conflict", "exclusive_leaf_create_failed");
  }
  const createdIdentity = identityFor(target, "file");
  if (lstatSync(target).nlink !== 1) {
    throw new AdapterRefusal("integrity_failure", "exclusive_leaf_hardlink_refused", true);
  }
  let reopened: Uint8Array;
  try {
    reopened = readBounded(target, bytes.length);
  } catch {
    throw new AdapterRefusal("integrity_failure", "exclusive_leaf_reopen_failed", true);
  }
  if (!identityMatches(target, createdIdentity, "file") || !bytesEqual(reopened, bytes)) {
    throw new AdapterRefusal("integrity_failure", "exclusive_leaf_byte_mismatch", true);
  }
}

function exclusiveUtf8File(target: string, value: string): void {
  exclusiveRegularFile(target, Buffer.from(value, "utf8"));
}

function exactFileText(target: string, expected: string, maximum = 4096): boolean {
  try {
    if (lstatSync(target).nlink !== 1) return false;
    const actual = decodeUtf8(readBounded(target, maximum));
    return actual === expected;
  } catch {
    return false;
  }
}

function singleLinkFileIdentity(target: string): FileIdentity {
  const identity = identityFor(target, "file");
  let stats: ReturnType<typeof lstatSync>;
  try {
    stats = lstatSync(target);
  } catch {
    throw new AdapterRefusal("conflict", "single_link_file_unavailable");
  }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 ||
      !identityMatches(target, identity, "file")) {
    throw new AdapterRefusal("conflict", "single_link_file_unprovable");
  }
  return identity;
}

function singleLinkFileMatches(target: string, expected: FileIdentity): boolean {
  try {
    const current = singleLinkFileIdentity(target);
    return sameObjectIdentity(current, expected) && samePath(current.realPath, expected.realPath);
  } catch {
    return false;
  }
}

function materializedDirectoryMatches(
  snapshot: RepositorySnapshot,
  prefix: readonly string[],
  current: string,
): boolean {
  const held = identityFor(current, "directory");
  const descendants = snapshot.tree.filter((entry) =>
    entry.segments.length > prefix.length &&
    prefix.every((segment, index) => entry.segments[index] === segment)
  );
  const directoryNames = [...new Set(descendants
    .filter((entry) => entry.segments.length > prefix.length + 1)
    .map((entry) => entry.segments[prefix.length]!))].sort();
  const directEntries = descendants
    .filter((entry) => entry.segments.length === prefix.length + 1)
    .sort((left, right) => left.segments.at(-1)!.localeCompare(right.segments.at(-1)!));
  const expectedNames = [
    ...(prefix.length === 0 ? [".git"] : []),
    ...directoryNames,
    ...directEntries.map((entry) => entry.segments.at(-1)!),
  ].sort();
  const actualNames = readdirSync(current).sort();
  if (actualNames.length > MAX_TREE_ENTRIES + 1 ||
      JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) return false;
  for (const name of directoryNames) {
    const child = path.join(current, name);
    if (!pathContains(snapshot.targetDirectory, child) ||
        !materializedDirectoryMatches(snapshot, Object.freeze([...prefix, name]), child)) return false;
  }
  for (const entry of directEntries) {
    const name = entry.segments.at(-1);
    if (name === undefined) return false;
    const child = path.join(current, name);
    if (!pathContains(snapshot.targetDirectory, child)) return false;
    const stats = lstatSync(child);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) return false;
    const expected = Buffer.from(entry.dataBase64, "base64");
    if (expected.length !== entry.size || !bytesEqual(readBounded(child, entry.size), expected)) return false;
  }
  return identityMatches(current, held);
}

function materializedTreeMatches(snapshot: RepositorySnapshot): boolean {
  try {
    return materializedDirectoryMatches(snapshot, Object.freeze([]), snapshot.targetDirectory);
  } catch {
    return false;
  }
}

function registrationIdentity(
  snapshot: RepositorySnapshot,
  request: WorkspaceBackendRequest,
  adminIdentity: FileIdentity,
  targetIdentity: FileIdentity,
): string {
  return hashReference({
    admin: adminIdentity,
    baseObjectId: snapshot.baseObjectId,
    binding: request.subject.ownershipBindingSha256,
    common: snapshot.commonIdentity,
    contractId: WORKSPACE_CONTRACT_ID,
    target: targetIdentity,
    targetGitFile: `gitdir: ${forwardPath(snapshot.adminDirectory)}\n`,
  });
}

function manifestValue(
  snapshot: RepositorySnapshot,
  request: WorkspaceBackendRequest,
  adminIdentity: FileIdentity,
  targetIdentity: FileIdentity,
): Readonly<Record<string, unknown>> {
  const registration = registrationIdentity(snapshot, request, adminIdentity, targetIdentity);
  return Object.freeze({
    adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
    adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
    adminIdentitySha256: hashReference(adminIdentity),
    baseObjectId: snapshot.baseObjectId,
    commonIdentitySha256: hashReference(snapshot.commonIdentity),
    contractId: WORKSPACE_CONTRACT_ID,
    generation: request.subject.generation,
    headObjectId: snapshot.baseObjectId,
    objectFormat: snapshot.objectFormat,
    objectIdentitySha256: hashReference(snapshot.objectIdentity),
    ownershipBindingSha256: request.subject.ownershipBindingSha256,
    projectIdentitySha256: hashReference(snapshot.projectRoot.identity),
    registrationIdentity: registration,
    repositoryIdentity: snapshot.repositoryIdentity,
    schema: "ato.workspace-ownership/v1",
    targetIdentitySha256: hashReference(targetIdentity),
    workspaceRootIdentitySha256: hashReference(snapshot.workspaceRoot.identity),
  });
}

interface WorktreeInventoryRecord {
  readonly path: string;
  readonly head: string | null;
  readonly detached: boolean;
  readonly locked: boolean;
  readonly prunable: boolean;
}

function worktreeInventory(snapshot: RepositorySnapshot): readonly WorktreeInventoryRecord[] {
  const output = runGitText(
    snapshot.gitExecutable,
    snapshot.projectRoot.path,
    ["worktree", "list", "--porcelain", "-z"],
  );
  const tokens = output.split("\0");
  const records: WorktreeInventoryRecord[] = [];
  let current: { path: string; head: string | null; detached: boolean; locked: boolean; prunable: boolean } | null = null;
  for (const token of tokens) {
    if (token === "") {
      if (current !== null) {
        records.push(Object.freeze(current));
        current = null;
      }
      continue;
    }
    if (token.startsWith("worktree ")) {
      if (current !== null) throw new AdapterRefusal("integrity_failure", "worktree_inventory_malformed", true);
      const worktreePath = token.slice("worktree ".length);
      if (worktreePath.length === 0 || worktreePath.length > MAX_PATH_LENGTH || !path.isAbsolute(worktreePath)) {
        throw new AdapterRefusal("integrity_failure", "worktree_inventory_malformed", true);
      }
      current = { path: worktreePath, head: null, detached: false, locked: false, prunable: false };
      continue;
    }
    if (current === null) throw new AdapterRefusal("integrity_failure", "worktree_inventory_malformed", true);
    if (token.startsWith("HEAD ")) current.head = token.slice("HEAD ".length);
    else if (token === "detached") current.detached = true;
    else if (token.startsWith("locked")) current.locked = true;
    else if (token.startsWith("prunable")) current.prunable = true;
    else if (token.startsWith("branch ") || token === "bare") {
      // Known authoritative inventory facts that do not describe the detached target.
    } else throw new AdapterRefusal("integrity_failure", "worktree_inventory_malformed", true);
  }
  if (current !== null) records.push(Object.freeze(current));
  return Object.freeze(records);
}

function partialObservation(snapshot: RepositorySnapshot): PhysicalObservation {
  return Object.freeze({
    state: "partial",
    canonicalPath: pathExistsNoFollow(snapshot.targetDirectory) ? snapshot.targetDirectory : null,
    registrationIdentity: null,
    baseObjectId: snapshot.baseObjectId,
    headObjectId: null,
    trackedCount: 0,
  });
}

function inspectPhysical(snapshot: RepositorySnapshot, request: WorkspaceBackendRequest): PhysicalObservation {
  revalidateRoot(snapshot.projectRoot);
  revalidateRoot(snapshot.workspaceRoot);
  if (!identityMatches(snapshot.commonDirectory, snapshot.commonIdentity) ||
      !identityMatches(snapshot.objectDirectory, snapshot.objectIdentity)) {
    throw new AdapterRefusal("ambiguous_external_state", "repository_identity_changed", true);
  }
  const targetExists = pathExistsNoFollow(snapshot.targetDirectory);
  const adminExists = pathExistsNoFollow(snapshot.adminDirectory);
  let inventory: readonly WorktreeInventoryRecord[];
  try {
    inventory = worktreeInventory(snapshot);
  } catch {
    throw new AdapterRefusal("ambiguous_external_state", "worktree_inventory_unavailable", true);
  }
  const targetRecords = inventory.filter((record) => samePath(record.path, snapshot.targetDirectory));
  if (!targetExists && !adminExists && targetRecords.length === 0) {
    return Object.freeze({
      state: "absent",
      canonicalPath: null,
      registrationIdentity: null,
      baseObjectId: null,
      headObjectId: null,
      trackedCount: 0,
    });
  }
  if (!targetExists || !adminExists || targetRecords.length !== 1) return partialObservation(snapshot);
  try {
    validateRepositoryConfiguration(snapshot.commonDirectory);
    validateObjectTopology(snapshot.commonDirectory, snapshot.objectDirectory);
    if (pathExistsNoFollow(snapshot.worktreesDirectory)) identityFor(snapshot.worktreesDirectory, "directory");
    const adminIdentity = identityFor(snapshot.adminDirectory, "directory");
    const targetIdentity = identityFor(snapshot.targetDirectory, "directory");
    const expectedAdminEntries = ["HEAD", "commondir", "gitdir", "index", "locked", MANIFEST_NAME].sort();
    const actualAdminEntries = readdirSync(snapshot.adminDirectory).sort();
    if (JSON.stringify(actualAdminEntries) !== JSON.stringify(expectedAdminEntries)) return partialObservation(snapshot);
    const expectedTargetGit = `gitdir: ${forwardPath(snapshot.adminDirectory)}\n`;
    const indexPath = path.join(snapshot.adminDirectory, "index");
    let indexIdentity: FileIdentity;
    try {
      indexIdentity = singleLinkFileIdentity(indexPath);
    } catch {
      return partialObservation(snapshot);
    }
    if (
      !exactFileText(path.join(snapshot.adminDirectory, "HEAD"), `${snapshot.baseObjectId}\n`) ||
      !exactFileText(path.join(snapshot.adminDirectory, "commondir"), "../..\n") ||
      !exactFileText(path.join(snapshot.adminDirectory, "gitdir"), `${forwardPath(path.join(snapshot.targetDirectory, ".git"))}\n`) ||
      !exactFileText(path.join(snapshot.adminDirectory, "locked"), LOCK_REASON) ||
      !exactFileText(path.join(snapshot.targetDirectory, ".git"), expectedTargetGit)
    ) return partialObservation(snapshot);
    const record = targetRecords[0];
    if (record === undefined || record.head !== snapshot.baseObjectId || !record.detached || !record.locked || record.prunable) {
      return partialObservation(snapshot);
    }
    const manifest = canonicalJson(manifestValue(snapshot, request, adminIdentity, targetIdentity));
    if (!exactFileText(path.join(snapshot.adminDirectory, MANIFEST_NAME), manifest, 16 * 1024)) {
      return partialObservation(snapshot);
    }
    if (!materializedTreeMatches(snapshot)) return partialObservation(snapshot);
    validateObjectTopology(snapshot.commonDirectory, snapshot.objectDirectory);
    const resolvedAdmin = singleLine(
      runGitText(snapshot.gitExecutable, snapshot.targetDirectory, ["rev-parse", "--absolute-git-dir"]),
      "linked_git_directory_invalid",
    );
    const resolvedCommon = path.resolve(snapshot.targetDirectory, singleLine(
      runGitText(snapshot.gitExecutable, snapshot.targetDirectory, ["rev-parse", "--git-common-dir"]),
      "linked_common_directory_invalid",
    ));
    const head = singleLine(
      runGitText(snapshot.gitExecutable, snapshot.targetDirectory, ["rev-parse", "HEAD"]),
      "linked_head_invalid",
    );
    if (!samePath(resolvedAdmin, snapshot.adminDirectory) || !samePath(resolvedCommon, snapshot.commonDirectory) ||
        head !== snapshot.baseObjectId) return partialObservation(snapshot);
    const status = runGitBytes(snapshot.gitExecutable, snapshot.targetDirectory, [
      "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", "--no-renames",
    ]);
    if (status.length !== 0) return partialObservation(snapshot);
    if (!materializedTreeMatches(snapshot)) return partialObservation(snapshot);
    if (!singleLinkFileMatches(indexPath, indexIdentity) ||
        !identityMatches(snapshot.adminDirectory, adminIdentity) || !identityMatches(snapshot.targetDirectory, targetIdentity) ||
        !identityMatches(snapshot.commonDirectory, snapshot.commonIdentity) ||
        !identityMatches(snapshot.objectDirectory, snapshot.objectIdentity)) return partialObservation(snapshot);
    return Object.freeze({
      state: "complete",
      canonicalPath: snapshot.targetDirectory,
      registrationIdentity: registrationIdentity(snapshot, request, adminIdentity, targetIdentity),
      baseObjectId: snapshot.baseObjectId,
      headObjectId: head,
      trackedCount: snapshot.tree.length,
    });
  } catch {
    return partialObservation(snapshot);
  }
}

function fixedWorkerResult(ok: boolean, effectStarted: boolean, code: string): WorkerResult {
  return Object.freeze({ ok, effectStarted, code });
}

function workerRefusal(error: unknown, effectStarted: boolean, fallback: string): WorkerResult {
  const code = error instanceof AdapterRefusal && /^[a-z][a-z0-9_]{0,63}$/u.test(error.code)
    ? error.code
    : fallback;
  return fixedWorkerResult(false, effectStarted, code);
}

function parseWorkerResult(value: unknown): WorkerResult | null {
  const record = exactRecord(value, ["ok", "effectStarted", "code"]);
  if (
    record === null || typeof record.ok !== "boolean" || typeof record.effectStarted !== "boolean" ||
    typeof record.code !== "string" || !/^[a-z][a-z0-9_]{0,63}$/u.test(record.code)
  ) return null;
  return fixedWorkerResult(record.ok, record.effectStarted, record.code);
}

function workerInput(payload: WorkerPayload): string {
  const value = JSON.stringify(payload);
  if (value.length > MAX_WORKER_INPUT) throw new AdapterRefusal("resource_exhausted", "worker_input_limit");
  return value;
}

function runNestedWorker(stage: string, cwd: string, payload: WorkerPayload): WorkerResult {
  const stageCode = stage === "target-chain"
    ? `target_chain_${payload.remainingComponents?.length ?? 99}`
    : stage.replaceAll("-", "_");
  const result = spawnSync(payload.snapshot.nodeExecutable, [payload.snapshot.modulePath, WORKER_MARKER, stage], {
    cwd: processCwd(cwd),
    env: minimalEnvironment("node"),
    input: workerInput(payload),
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 4096,
    windowsHide: true,
    shell: false,
    stdio: "pipe",
  });
  if (
    result.error !== undefined || (result.status !== 0 && result.status !== 2) ||
    result.signal !== null || typeof result.stdout !== "string"
  ) {
    return fixedWorkerResult(false, true, `${stageCode}_worker_unavailable`);
  }
  try {
    const parsed = parseWorkerResult(JSON.parse(result.stdout));
    return parsed ?? fixedWorkerResult(false, true, `${stageCode}_worker_malformed`);
  } catch {
    return fixedWorkerResult(false, true, `${stageCode}_worker_malformed`);
  }
}

function workerPayloadFromStdin(): WorkerPayload {
  const bytes = readFileSync(0);
  if (bytes.length === 0 || bytes.length > MAX_WORKER_INPUT) throw new TypeError("worker input invalid");
  const value: unknown = JSON.parse(decodeUtf8(bytes));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("worker input invalid");
  const candidate = value as Partial<WorkerPayload>;
  if (typeof candidate.snapshot !== "object" || candidate.snapshot === null) throw new TypeError("worker snapshot invalid");
  const parsedRequest = parseWorkspaceBackendRequest(candidate.request);
  if (parsedRequest === null) throw new TypeError("worker request invalid");
  const snapshot = candidate.snapshot as RepositorySnapshot;
  if (
    typeof snapshot.gitExecutable !== "string" || typeof snapshot.nodeExecutable !== "string" ||
    typeof snapshot.modulePath !== "string" || typeof snapshot.commonDirectory !== "string" ||
    typeof snapshot.objectDirectory !== "string" || typeof snapshot.worktreesDirectory !== "string" ||
    typeof snapshot.adminDirectory !== "string" || typeof snapshot.targetDirectory !== "string" ||
    !Array.isArray(snapshot.targetComponents) || !Array.isArray(snapshot.tree)
  ) throw new TypeError("worker snapshot invalid");
  const guardIdentityRecord = candidate.guardIdentity === undefined
    ? null
    : exactRecord(candidate.guardIdentity, ["realPath", "dev", "ino", "mode"]);
  const guardIdentity = guardIdentityRecord === null
    ? null
    : typeof guardIdentityRecord.realPath === "string" && typeof guardIdentityRecord.dev === "string" &&
        typeof guardIdentityRecord.ino === "string" && typeof guardIdentityRecord.mode === "number" &&
        Number.isSafeInteger(guardIdentityRecord.mode)
      ? Object.freeze({
          realPath: guardIdentityRecord.realPath,
          dev: guardIdentityRecord.dev,
          ino: guardIdentityRecord.ino,
          mode: guardIdentityRecord.mode,
        })
      : null;
  if (
    (candidate.guardPath === undefined) !== (candidate.guardIdentity === undefined) ||
    (candidate.guardPath !== undefined && (typeof candidate.guardPath !== "string" || guardIdentity === null))
  ) throw new TypeError("worker guard invalid");
  return Object.freeze({
    snapshot,
    request: parsedRequest,
    ...(Array.isArray(candidate.remainingComponents)
      ? { remainingComponents: Object.freeze([...candidate.remainingComponents]) as readonly string[] }
      : {}),
    ...(Array.isArray(candidate.treePrefix)
      ? { treePrefix: Object.freeze([...candidate.treePrefix]) as readonly string[] }
      : {}),
    ...(candidate.guardPath === undefined ? {} : {
      guardPath: candidate.guardPath,
      guardIdentity: guardIdentity!,
    }),
  });
}

function assertWorkerCwd(expectedPath: string, expectedIdentity?: FileIdentity): FileIdentity {
  const currentPath = process.cwd();
  if (!samePath(currentPath, expectedPath)) throw new AdapterRefusal("conflict", "worker_cwd_mismatch");
  const identity = identityFor(currentPath, "directory");
  if (expectedIdentity !== undefined && !identityMatches(currentPath, expectedIdentity)) {
    throw new AdapterRefusal("conflict", "worker_cwd_identity_mismatch");
  }
  return identity;
}

function assertPayloadGuard(payload: WorkerPayload, expectedPath: string): FileIdentity {
  if (
    payload.guardPath === undefined || payload.guardIdentity === undefined ||
    !samePath(payload.guardPath, expectedPath)
  ) throw new AdapterRefusal("conflict", "worker_guard_missing");
  return assertWorkerCwd(payload.guardPath, payload.guardIdentity);
}

function safeChildName(value: string): boolean {
  return value.length > 0 && value.length <= MAX_CHILD_NAME_LENGTH && value !== "." && value !== ".." &&
    !value.includes("/") && !value.includes("\\") && !/[\u0000-:*?"<>|]/u.test(value);
}

function directoryAcquisitionFailure(effectStarted: boolean): DirectoryAcquisitionFailure {
  return Object.freeze({ ok: false, effectStarted });
}

function directoryIdentity(target: string): FileIdentity {
  return identityFor(target, "directory");
}

function ensureDirectoryChild(
  parent: string,
  name: string,
  requireAbsent: boolean,
  readIdentity: DirectoryIdentityReader = directoryIdentity,
): DirectoryAcquisitionResult {
  if (!safeChildName(name)) return directoryAcquisitionFailure(false);
  const target = path.join(parent, name);
  if (!pathContains(parent, target)) return directoryAcquisitionFailure(false);
  let created = false;
  try {
    if (pathExistsNoFollow(target)) {
      if (requireAbsent) return directoryAcquisitionFailure(false);
    } else {
      mkdirSync(target);
      created = true;
    }
  } catch {
    return directoryAcquisitionFailure(false);
  }
  try {
    return Object.freeze({ ok: true, path: target, identity: readIdentity(target), created });
  } catch {
    return directoryAcquisitionFailure(created);
  }
}

function capabilityProbePaths(parent: string, payload: WorkerPayload): Readonly<{
  source: string;
  destination: string;
}> {
  const digest = payload.request.subject.ownershipBindingSha256.toLocaleLowerCase("en-US");
  const source = path.join(parent, `p-${digest}`);
  const destination = path.join(parent, `q-${digest}`);
  if (!pathContains(parent, source) || !pathContains(parent, destination) ||
      source.length > MAX_PATH_LENGTH || destination.length > MAX_PATH_LENGTH) {
    throw new AdapterRefusal("conflict", "capability_probe_path_invalid");
  }
  return Object.freeze({ source, destination });
}

function expectedProbeDevice(payload: WorkerPayload, parent: string): string | null {
  if (samePath(parent, payload.snapshot.worktreesDirectory)) return payload.snapshot.commonIdentity.dev;
  const workspaceParent = path.join(payload.snapshot.workspaceRoot.path, WORKSPACE_PARENT_NAME);
  if (samePath(parent, workspaceParent)) return payload.snapshot.workspaceRoot.identity.dev;
  return null;
}

function removeExactCapabilityProbe(
  source: string,
  destination: string,
  expected: FileIdentity,
): boolean {
  try {
    const sourcePresent = pathExistsNoFollow(source);
    const destinationPresent = pathExistsNoFollow(destination);
    if (sourcePresent === destinationPresent) return false;
    if (destinationPresent) {
      const displaced = identityFor(destination, "directory");
      if (!sameObjectIdentity(displaced, expected)) return false;
      renameSync(destination, source);
    }
    if (!identityMatches(source, expected) || pathExistsNoFollow(destination) || readdirSync(source).length !== 0) {
      return false;
    }
    rmdirSync(source);
    return !pathExistsNoFollow(source) && !pathExistsNoFollow(destination);
  } catch {
    return false;
  }
}

function workerStageCapabilityLeaf(payload: WorkerPayload): WorkerResult {
  const source = process.cwd();
  const held = assertPayloadGuard(payload, source);
  const parent = path.dirname(source);
  const paths = capabilityProbePaths(parent, payload);
  if (!samePath(paths.source, source)) return fixedWorkerResult(false, false, "capability_probe_source_mismatch");
  try {
    renameSync(paths.source, paths.destination);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as Readonly<{ code?: unknown }>).code
      : null;
    if ((code === "EBUSY" || code === "EPERM") && identityMatches(paths.source, held) &&
        !pathExistsNoFollow(paths.destination)) {
      return fixedWorkerResult(true, false, "cwd_rename_blocked");
    }
    return fixedWorkerResult(false, false, "cwd_rename_probe_inconclusive");
  }
  try {
    const displaced = identityFor(paths.destination, "directory");
    if (!sameObjectIdentity(displaced, held) || pathExistsNoFollow(paths.source)) {
      return fixedWorkerResult(false, true, "cwd_rename_probe_changed");
    }
    renameSync(paths.destination, paths.source);
    if (!identityMatches(paths.source, held) || pathExistsNoFollow(paths.destination)) {
      return fixedWorkerResult(false, true, "cwd_rename_probe_restore_failed");
    }
    return fixedWorkerResult(false, true, "cwd_rename_permitted");
  } catch {
    return fixedWorkerResult(false, true, "cwd_rename_probe_restore_failed");
  }
}

function workerStageCapabilityParent(payload: WorkerPayload): WorkerResult {
  const parent = process.cwd();
  const held = assertPayloadGuard(payload, parent);
  const expectedDevice = expectedProbeDevice(payload, parent);
  if (expectedDevice === null || held.dev !== expectedDevice) {
    return fixedWorkerResult(false, false, "capability_probe_device_mismatch");
  }
  const paths = capabilityProbePaths(parent, payload);
  if (pathExistsNoFollow(paths.source) || pathExistsNoFollow(paths.destination)) {
    return fixedWorkerResult(false, false, "capability_probe_conflict");
  }
  const probe = ensureDirectoryChild(parent, path.basename(paths.source), true);
  if (!probe.ok) return fixedWorkerResult(false, probe.effectStarted, "capability_probe_create_failed");
  if (probe.identity.dev !== expectedDevice) {
    const removed = removeExactCapabilityProbe(paths.source, paths.destination, probe.identity);
    return fixedWorkerResult(false, true, removed ? "capability_probe_device_mismatch" : "capability_probe_cleanup_failed");
  }
  try {
    renameSync(paths.source, paths.destination);
    const displaced = identityFor(paths.destination, "directory");
    if (!sameObjectIdentity(displaced, probe.identity) || pathExistsNoFollow(paths.source)) {
      throw new AdapterRefusal("conflict", "capability_positive_control_changed");
    }
    renameSync(paths.destination, paths.source);
    if (!identityMatches(paths.source, probe.identity) || pathExistsNoFollow(paths.destination)) {
      throw new AdapterRefusal("conflict", "capability_positive_control_changed");
    }
  } catch {
    const removed = removeExactCapabilityProbe(paths.source, paths.destination, probe.identity);
    return fixedWorkerResult(false, true, removed ? "capability_positive_control_failed" : "capability_probe_cleanup_failed");
  }
  const result = runNestedWorker("capability-leaf", paths.source, Object.freeze({
    ...payload,
    guardPath: paths.source,
    guardIdentity: probe.identity,
  }));
  const removed = removeExactCapabilityProbe(paths.source, paths.destination, probe.identity);
  if (!removed || !identityMatches(parent, held)) {
    return fixedWorkerResult(false, true, "capability_probe_cleanup_failed");
  }
  return result.ok
    ? fixedWorkerResult(true, true, "capability_attested")
    : fixedWorkerResult(false, true, result.code);
}

function workerStageWorkspaceCapabilityRoot(payload: WorkerPayload): WorkerResult {
  const held = assertWorkerCwd(payload.snapshot.workspaceRoot.path, payload.snapshot.workspaceRoot.identity);
  if (payload.snapshot.targetComponents[0] !== WORKSPACE_PARENT_NAME) {
    return fixedWorkerResult(false, false, "workspace_parent_invalid");
  }
  const parent = ensureDirectoryChild(process.cwd(), WORKSPACE_PARENT_NAME, false);
  if (!parent.ok) return fixedWorkerResult(false, parent.effectStarted, "workspace_parent_unavailable");
  const expectedPath = path.join(payload.snapshot.workspaceRoot.path, WORKSPACE_PARENT_NAME);
  if (!samePath(parent.path, expectedPath) || parent.identity.dev !== payload.snapshot.workspaceRoot.identity.dev) {
    return fixedWorkerResult(false, parent.created, "workspace_parent_mismatch");
  }
  const result = runNestedWorker("capability-parent", parent.path, Object.freeze({
    ...payload,
    guardPath: parent.path,
    guardIdentity: parent.identity,
  }));
  const effectStarted = parent.created || result.effectStarted;
  if (!identityMatches(process.cwd(), held) || !identityMatches(parent.path, parent.identity)) {
    return fixedWorkerResult(false, effectStarted, "workspace_capability_guard_changed");
  }
  return fixedWorkerResult(result.ok, effectStarted, result.code);
}

function workerStageCommon(payload: WorkerPayload): WorkerResult {
  const held = assertWorkerCwd(payload.snapshot.commonDirectory, payload.snapshot.commonIdentity);
  try {
    validateRepositoryConfiguration(payload.snapshot.commonDirectory);
  } catch (error) {
    return workerRefusal(error, false, "repository_configuration_unavailable");
  }
  const result = runNestedWorker("objects", payload.snapshot.objectDirectory, payload);
  if (!identityMatches(process.cwd(), held)) return fixedWorkerResult(false, result.effectStarted, "common_guard_changed");
  return result;
}

function workerStageObjects(payload: WorkerPayload): WorkerResult {
  const held = assertWorkerCwd(payload.snapshot.objectDirectory, payload.snapshot.objectIdentity);
  const common = payload.snapshot.commonDirectory;
  if (!identityMatches(common, payload.snapshot.commonIdentity)) {
    return fixedWorkerResult(false, false, "common_guard_changed");
  }
  try {
    validateObjectTopology(common, payload.snapshot.objectDirectory);
  } catch (error) {
    return workerRefusal(error, false, "object_topology_unavailable");
  }
  const worktrees = ensureDirectoryChild(common, "worktrees", false);
  if (!worktrees.ok) {
    return fixedWorkerResult(false, worktrees.effectStarted, "worktrees_directory_unavailable");
  }
  if (!samePath(worktrees.path, payload.snapshot.worktreesDirectory)) {
    return fixedWorkerResult(false, worktrees.created, "worktrees_directory_mismatch");
  }
  if (worktrees.identity.dev !== payload.snapshot.commonIdentity.dev) {
    return fixedWorkerResult(false, worktrees.created, "worktrees_directory_device_mismatch");
  }
  const projectCapability = runNestedWorker("capability-parent", worktrees.path, Object.freeze({
    ...payload,
    guardPath: worktrees.path,
    guardIdentity: worktrees.identity,
  }));
  let effectStarted = worktrees.created || projectCapability.effectStarted;
  if (!identityMatches(process.cwd(), held) || !identityMatches(worktrees.path, worktrees.identity)) {
    return fixedWorkerResult(false, effectStarted, "object_guard_changed");
  }
  if (!projectCapability.ok) return fixedWorkerResult(false, effectStarted, projectCapability.code);
  const workspaceCapability = runNestedWorker(
    "workspace-capability-root",
    payload.snapshot.workspaceRoot.path,
    payload,
  );
  effectStarted ||= workspaceCapability.effectStarted;
  if (!identityMatches(process.cwd(), held) || !identityMatches(worktrees.path, worktrees.identity) ||
      !identityMatches(payload.snapshot.commonDirectory, payload.snapshot.commonIdentity) ||
      !identityMatches(payload.snapshot.workspaceRoot.path, payload.snapshot.workspaceRoot.identity)) {
    return fixedWorkerResult(false, effectStarted, "object_guard_changed");
  }
  if (!workspaceCapability.ok) return fixedWorkerResult(false, effectStarted, workspaceCapability.code);
  const result = runNestedWorker("worktrees", worktrees.path, Object.freeze({
    ...payload,
    guardPath: worktrees.path,
    guardIdentity: worktrees.identity,
  }));
  if (!identityMatches(process.cwd(), held) || !identityMatches(worktrees.path, worktrees.identity)) {
    return fixedWorkerResult(false, effectStarted || result.effectStarted, "object_guard_changed");
  }
  return fixedWorkerResult(result.ok, effectStarted || result.effectStarted, result.code);
}

function workerStageWorktrees(payload: WorkerPayload): WorkerResult {
  const held = assertPayloadGuard(payload, payload.snapshot.worktreesDirectory);
  const admin = ensureDirectoryChild(process.cwd(), payload.snapshot.adminName, true);
  if (!admin.ok) return fixedWorkerResult(false, admin.effectStarted, "admin_directory_conflict");
  if (!samePath(admin.path, payload.snapshot.adminDirectory)) {
    return fixedWorkerResult(false, true, "admin_directory_mismatch");
  }
  const result = runNestedWorker("admin", admin.path, Object.freeze({
    ...payload,
    guardPath: admin.path,
    guardIdentity: admin.identity,
  }));
  if (!identityMatches(process.cwd(), held) || !identityMatches(admin.path, admin.identity)) {
    return fixedWorkerResult(false, true, "admin_guard_changed");
  }
  return result.ok ? fixedWorkerResult(true, true, result.code) : fixedWorkerResult(false, true, result.code);
}

function workerStageAdmin(payload: WorkerPayload): WorkerResult {
  const held = assertPayloadGuard(payload, payload.snapshot.adminDirectory);
  if (readdirSync(process.cwd()).length !== 0) return fixedWorkerResult(false, true, "admin_not_empty");
  const result = runNestedWorker("workspace-root", payload.snapshot.workspaceRoot.path, payload);
  if (!identityMatches(process.cwd(), held)) return fixedWorkerResult(false, true, "admin_guard_changed");
  return result.ok ? fixedWorkerResult(true, true, result.code) : fixedWorkerResult(false, true, result.code);
}

function workerStageWorkspaceRoot(payload: WorkerPayload): WorkerResult {
  const held = assertWorkerCwd(payload.snapshot.workspaceRoot.path, payload.snapshot.workspaceRoot.identity);
  const result = runNestedWorker("target-chain", process.cwd(), Object.freeze({
    snapshot: payload.snapshot,
    request: payload.request,
    remainingComponents: payload.snapshot.targetComponents,
    guardPath: payload.snapshot.workspaceRoot.path,
    guardIdentity: payload.snapshot.workspaceRoot.identity,
  }));
  if (!identityMatches(process.cwd(), held)) return fixedWorkerResult(false, true, "workspace_root_guard_changed");
  return result.ok ? fixedWorkerResult(true, true, result.code) : fixedWorkerResult(false, true, result.code);
}

function workerStageTargetChain(payload: WorkerPayload): WorkerResult {
  const held = assertPayloadGuard(payload, process.cwd());
  const remaining = payload.remainingComponents;
  if (remaining === undefined) return fixedWorkerResult(false, true, "target_chain_invalid");
  if (remaining.length === 0) {
    if (!samePath(process.cwd(), payload.snapshot.targetDirectory)) {
      return fixedWorkerResult(false, true, "target_directory_mismatch");
    }
    const result = workerStageMutate(payload);
    if (!identityMatches(process.cwd(), held)) return fixedWorkerResult(false, true, "target_guard_changed");
    return result;
  }
  const nextName = remaining[0];
  if (nextName === undefined) return fixedWorkerResult(false, true, "target_chain_invalid");
  const final = remaining.length === 1;
  const next = ensureDirectoryChild(process.cwd(), nextName, final);
  if (!next.ok) {
    return fixedWorkerResult(false, true, final ? "target_generation_conflict" : "target_parent_unavailable");
  }
  const result = runNestedWorker("target-chain", next.path, Object.freeze({
    snapshot: payload.snapshot,
    request: payload.request,
    remainingComponents: Object.freeze(remaining.slice(1)),
    guardPath: next.path,
    guardIdentity: next.identity,
  }));
  if (!identityMatches(process.cwd(), held) || !identityMatches(next.path, next.identity)) {
    return fixedWorkerResult(false, true, "target_parent_guard_changed");
  }
  return result.ok ? fixedWorkerResult(true, true, result.code) : fixedWorkerResult(false, true, result.code);
}

function workerStageTree(payload: WorkerPayload): WorkerResult {
  const held = assertPayloadGuard(payload, process.cwd());
  const prefix = payload.treePrefix;
  if (prefix === undefined || !samePath(process.cwd(), path.join(payload.snapshot.targetDirectory, ...prefix))) {
    return fixedWorkerResult(false, true, "tree_payload_invalid");
  }
  const descendants = payload.snapshot.tree.filter((entry) =>
    entry.segments.length > prefix.length &&
    prefix.every((segment, index) => entry.segments[index] === segment)
  );
  const childNames = [...new Set(descendants
    .filter((entry) => entry.segments.length > prefix.length + 1)
    .map((entry) => entry.segments[prefix.length]!))].sort();
  for (const childName of childNames) {
    const next = ensureDirectoryChild(process.cwd(), childName, true);
    if (!next.ok) {
      return fixedWorkerResult(false, true, "tree_directory_unavailable");
    }
    const result = runNestedWorker("tree", next.path, Object.freeze({
      snapshot: payload.snapshot,
      request: payload.request,
      treePrefix: Object.freeze([...prefix, childName]),
      guardPath: next.path,
      guardIdentity: next.identity,
    }));
    if (!identityMatches(process.cwd(), held) || !identityMatches(next.path, next.identity)) {
      return fixedWorkerResult(false, true, "tree_parent_guard_changed");
    }
    if (!result.ok) return result;
  }
  const directEntries = descendants.filter((entry) => entry.segments.length === prefix.length + 1);
  for (const entry of directEntries) {
    const name = entry.segments.at(-1);
    if (name === undefined || !safeChildName(name)) return fixedWorkerResult(false, true, "tree_leaf_name_invalid");
    try {
      const bytes = Buffer.from(entry.dataBase64, "base64");
      if (bytes.length !== entry.size) return fixedWorkerResult(false, true, "tree_leaf_size_invalid");
      exclusiveRegularFile(path.join(process.cwd(), name), bytes);
    } catch {
      return fixedWorkerResult(false, true, "tree_leaf_write_failed");
    }
  }
  if (!identityMatches(process.cwd(), held)) return fixedWorkerResult(false, true, "tree_guard_changed");
  return fixedWorkerResult(true, true, "tree_materialized");
}

function workerStageMutate(payload: WorkerPayload): WorkerResult {
  const snapshot = payload.snapshot;
  const request = payload.request;
  const targetIdentity = assertPayloadGuard(payload, snapshot.targetDirectory);
  let adminIdentity: FileIdentity;
  try {
    adminIdentity = identityFor(snapshot.adminDirectory, "directory");
    if (readdirSync(snapshot.adminDirectory).length !== 0 || readdirSync(snapshot.targetDirectory).length !== 0) {
      return fixedWorkerResult(false, true, "generation_not_empty");
    }
    validateRepositoryConfiguration(snapshot.commonDirectory);
    validateObjectTopology(snapshot.commonDirectory, snapshot.objectDirectory);
    exclusiveUtf8File(path.join(snapshot.adminDirectory, "HEAD"), `${snapshot.baseObjectId}\n`);
    exclusiveUtf8File(path.join(snapshot.adminDirectory, "commondir"), "../..\n");
    exclusiveUtf8File(
      path.join(snapshot.adminDirectory, "gitdir"),
      `${forwardPath(path.join(snapshot.targetDirectory, ".git"))}\n`,
    );
    exclusiveUtf8File(path.join(snapshot.adminDirectory, "locked"), LOCK_REASON);
    exclusiveUtf8File(
      path.join(snapshot.targetDirectory, ".git"),
      `gitdir: ${forwardPath(snapshot.adminDirectory)}\n`,
    );
    const records = worktreeInventory(snapshot).filter((record) => samePath(record.path, snapshot.targetDirectory));
    const record = records[0];
    if (
      records.length !== 1 || record === undefined || record.head !== snapshot.baseObjectId ||
      !record.detached || !record.locked || record.prunable
    ) return fixedWorkerResult(false, true, "registration_validation_failed");
    const manifest = canonicalJson(manifestValue(snapshot, request, adminIdentity, targetIdentity));
    exclusiveUtf8File(path.join(snapshot.adminDirectory, MANIFEST_NAME), manifest);
    const materialized = workerStageTree(Object.freeze({
      snapshot,
      request,
      treePrefix: Object.freeze([]),
      guardPath: snapshot.targetDirectory,
      guardIdentity: targetIdentity,
    }));
    if (!materialized.ok) return fixedWorkerResult(false, true, materialized.code);
    if (!materializedTreeMatches(snapshot)) return fixedWorkerResult(false, true, "materialized_tree_unprovable");
    validateObjectTopology(snapshot.commonDirectory, snapshot.objectDirectory);
    runGitBytes(snapshot.gitExecutable, snapshot.targetDirectory, ["read-tree", snapshot.baseObjectId]);
    const status = runGitBytes(snapshot.gitExecutable, snapshot.targetDirectory, [
      "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", "--no-renames",
    ]);
    if (status.length !== 0) return fixedWorkerResult(false, true, "materialized_tree_not_clean");
    if (!materializedTreeMatches(snapshot)) return fixedWorkerResult(false, true, "materialized_tree_unprovable");
    if (!identityMatches(snapshot.targetDirectory, targetIdentity) ||
        !identityMatches(snapshot.adminDirectory, adminIdentity) ||
        !identityMatches(snapshot.commonDirectory, snapshot.commonIdentity) ||
        !identityMatches(snapshot.objectDirectory, snapshot.objectIdentity)) {
      return fixedWorkerResult(false, true, "final_guard_changed");
    }
    return fixedWorkerResult(true, true, "created");
  } catch {
    return fixedWorkerResult(false, true, "mutation_failed");
  }
}

function executeWorker(stage: string): void {
  let result = fixedWorkerResult(false, false, "worker_internal_failure");
  try {
    const payload = workerPayloadFromStdin();
    if (stage === "common") result = workerStageCommon(payload);
    else if (stage === "objects") result = workerStageObjects(payload);
    else if (stage === "capability-parent") result = workerStageCapabilityParent(payload);
    else if (stage === "capability-leaf") result = workerStageCapabilityLeaf(payload);
    else if (stage === "workspace-capability-root") result = workerStageWorkspaceCapabilityRoot(payload);
    else if (stage === "worktrees") result = workerStageWorktrees(payload);
    else if (stage === "admin") result = workerStageAdmin(payload);
    else if (stage === "workspace-root") result = workerStageWorkspaceRoot(payload);
    else if (stage === "target-chain") result = workerStageTargetChain(payload);
    else if (stage === "tree") result = workerStageTree(payload);
  } catch {
    result = fixedWorkerResult(false, true, "worker_internal_failure");
  }
  process.stdout.write(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 2;
}

function runCreateWorker(snapshot: RepositorySnapshot, request: WorkspaceBackendRequest): WorkerResult {
  return runNestedWorker("common", snapshot.commonDirectory, Object.freeze({ snapshot, request }));
}

function runPostMkdirIdentityFailureForTesting(
  snapshot: RepositorySnapshot,
  _request: WorkspaceBackendRequest,
): WorkerResult {
  const acquisition = ensureDirectoryChild(
    snapshot.commonDirectory,
    "worktrees",
    false,
    () => {
      throw new AdapterRefusal("conflict", "injected_post_mkdir_identity_failure");
    },
  );
  if (acquisition.ok) {
    return fixedWorkerResult(false, acquisition.created, "post_mkdir_identity_failure_not_reached");
  }
  return fixedWorkerResult(false, acquisition.effectStarted, "worktrees_directory_unavailable");
}

const FAILURE_FLAGS: Readonly<Record<WorkspaceFailureCategory, Readonly<{
  retryable: boolean;
  ambiguous: boolean;
}>>> = Object.freeze({
  invalid_request: Object.freeze({ retryable: false, ambiguous: false }),
  incompatible_contract: Object.freeze({ retryable: false, ambiguous: false }),
  unauthorized: Object.freeze({ retryable: false, ambiguous: false }),
  policy_denied: Object.freeze({ retryable: false, ambiguous: false }),
  not_found: Object.freeze({ retryable: false, ambiguous: false }),
  conflict: Object.freeze({ retryable: false, ambiguous: false }),
  stale_revision: Object.freeze({ retryable: false, ambiguous: false }),
  busy: Object.freeze({ retryable: true, ambiguous: false }),
  rate_limited: Object.freeze({ retryable: true, ambiguous: false }),
  resource_exhausted: Object.freeze({ retryable: true, ambiguous: false }),
  transient_external: Object.freeze({ retryable: true, ambiguous: false }),
  permanent_external: Object.freeze({ retryable: false, ambiguous: false }),
  ambiguous_external_state: Object.freeze({ retryable: false, ambiguous: true }),
  cancelled: Object.freeze({ retryable: false, ambiguous: false }),
  integrity_failure: Object.freeze({ retryable: false, ambiguous: true }),
});

function backendFailure(
  category: WorkspaceFailureCategory,
  code: string,
  request: WorkspaceBackendRequest | null,
): WorkspaceBackendResult {
  const flags = FAILURE_FLAGS[category];
  const error: WorkspaceBackendFailure = Object.freeze({
    category,
    code,
    retryable: flags.retryable,
    ambiguous: flags.ambiguous,
    retryAfter: null,
    evidenceReference: request === null ? null : hashReference({
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      binding: request.subject.ownershipBindingSha256,
      category,
      code,
      operation: request.operation,
    }),
  });
  const result = parseWorkspaceBackendResult(Object.freeze({ ok: false as const, error }));
  if (result === null) {
    return Object.freeze({
      ok: false as const,
      error: Object.freeze({
        category: "integrity_failure" as const,
        code: "adapter_failure_shape_invalid",
        retryable: false,
        ambiguous: true,
        retryAfter: null,
        evidenceReference: null,
      }),
    });
  }
  return result;
}

function requestForOperation(value: unknown, operation: WorkspaceOperation): WorkspaceBackendRequest | null {
  const parsed = parseWorkspaceBackendRequest(value);
  if (
    parsed === null || parsed.operation !== operation ||
    parsed.adapterId !== WINDOWS_GIT_WORKSPACE_ADAPTER_ID ||
    parsed.adapterVersion !== WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION
  ) return null;
  return parsed;
}

function receiptFor(
  request: WorkspaceBackendRequest,
  snapshot: RepositorySnapshot,
  observation: PhysicalObservation,
  code: WorkspaceReceiptCode,
): WorkspaceBackendResult {
  const externalState = code === "reserved" || code === "already_reserved"
    ? "reserved"
    : code === "created" || code === "already_created" || code === "inspected_complete" || code === "recovered_complete"
      ? "complete"
      : code === "inspected_absent" || code === "recovered_absent" || code === "already_absent"
        ? "absent"
        : code === "inspected_partial" || code === "partial"
          ? "partial"
          : code === "removed" ? "removed" : code === "refused" ? "refused" : "ambiguous";
  const outcome = code === "inspected_partial" || code === "partial" || code === "ambiguous"
    ? "ambiguous"
    : code === "refused" ? "refused" : "succeeded";
  const reserved = externalState === "reserved";
  const complete = externalState === "complete";
  const observedAt = new Date().toISOString();
  const receipt: WorkspaceBackendReceipt = Object.freeze({
    contractId: WORKSPACE_CONTRACT_ID,
    receiptId: hashReference({
      binding: request.subject.ownershipBindingSha256,
      code,
      operation: request.operation,
      operationId: request.operationId,
      registration: observation.registrationIdentity,
    }),
    operation: request.operation,
    operationId: request.operationId,
    idempotencyKey: request.idempotencyKey,
    adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
    adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
    workspaceId: request.subject.workspaceId,
    generation: request.subject.generation,
    projectRootKey: request.subject.projectRootKey,
    workspaceRootKey: request.subject.workspaceRootKey,
    ownershipBindingSha256: request.subject.ownershipBindingSha256,
    externalState,
    outcome,
    code,
    canonicalPath: complete || reserved || externalState === "partial" ?
      observation.canonicalPath ?? snapshot.targetDirectory : null,
    repositoryIdentity: snapshot.repositoryIdentity,
    registrationIdentity: complete ? observation.registrationIdentity : null,
    branchReference: null,
    baseObjectId: complete || reserved || externalState === "partial" ? snapshot.baseObjectId : null,
    headObjectId: complete ? observation.headObjectId : null,
    pathSafety: complete || reserved ? "safe" : externalState === "absent" ? "safe" : "unknown",
    ownershipMatch: complete ? true : reserved ? false : externalState === "absent" ? false : null,
    inventory: Object.freeze({
      trackedCount: complete ? observation.trackedCount : 0,
      modifiedCount: 0,
      untrackedCount: 0,
      ignoredCount: 0,
    }),
    evidenceReference: hashReference({
      binding: request.subject.ownershipBindingSha256,
      code,
      repository: snapshot.repositoryIdentity,
      state: externalState,
    }),
    observedAt,
  });
  const result = parseWorkspaceBackendResult(Object.freeze({ ok: true as const, receipt }));
  return result ?? backendFailure("integrity_failure", "adapter_receipt_shape_invalid", request);
}

function executeReadOperation(
  configuration: ReturnType<typeof parseConfiguration>,
  value: unknown,
  operation: "inspect" | "recover",
): WorkspaceBackendResult {
  const request = requestForOperation(value, operation);
  if (request === null) return backendFailure("invalid_request", "request_shape_invalid", null);
  try {
    const snapshot = preflight(configuration, request);
    const observation = inspectPhysical(snapshot, request);
    if (operation === "inspect") {
      if (observation.state === "absent") return receiptFor(request, snapshot, observation, "inspected_absent");
      if (observation.state === "complete") return receiptFor(request, snapshot, observation, "inspected_complete");
      return receiptFor(request, snapshot, observation, "inspected_partial");
    }
    if (observation.state === "absent") return receiptFor(request, snapshot, observation, "recovered_absent");
    if (observation.state === "complete") return receiptFor(request, snapshot, observation, "recovered_complete");
    return receiptFor(request, snapshot, observation, "partial");
  } catch (error) {
    if (error instanceof AdapterRefusal) return backendFailure(error.category, error.code, request);
    return backendFailure("integrity_failure", "adapter_read_failed", request);
  }
}

function executeReserve(
  configuration: ReturnType<typeof parseConfiguration>,
  value: unknown,
): WorkspaceBackendResult {
  const request = requestForOperation(value, "reserve");
  if (request === null) return backendFailure("invalid_request", "request_shape_invalid", null);
  try {
    const snapshot = preflight(configuration, request);
    const observation = inspectPhysical(snapshot, request);
    if (observation.state !== "absent") {
      return backendFailure(
        observation.state === "partial" ? "ambiguous_external_state" : "conflict",
        observation.state === "partial" ? "workspace_state_unprovable" : "workspace_already_created",
        request,
      );
    }
    return receiptFor(request, snapshot, Object.freeze({
      ...observation,
      canonicalPath: snapshot.targetDirectory,
      baseObjectId: snapshot.baseObjectId,
    }), "reserved");
  } catch (error) {
    if (error instanceof AdapterRefusal) return backendFailure(error.category, error.code, request);
    return backendFailure("integrity_failure", "adapter_reserve_failed", request);
  }
}

function executeCreate(
  configuration: ReturnType<typeof parseConfiguration>,
  value: unknown,
  createWorker: CreateWorkerRunner,
): WorkspaceBackendResult {
  const request = requestForOperation(value, "create");
  if (request === null) return backendFailure("invalid_request", "request_shape_invalid", null);
  try {
    const snapshot = preflight(configuration, request);
    const before = inspectPhysical(snapshot, request);
    if (before.state === "complete") return receiptFor(request, snapshot, before, "already_created");
    if (before.state !== "absent") {
      return backendFailure("ambiguous_external_state", "workspace_state_unprovable", request);
    }
    const worker = createWorker(snapshot, request);
    if (!worker.ok) {
      return backendFailure(
        worker.effectStarted ? "ambiguous_external_state" : "conflict",
        worker.code,
        request,
      );
    }
    const after = inspectPhysical(snapshot, request);
    if (after.state !== "complete") {
      return backendFailure("ambiguous_external_state", "workspace_create_unverified", request);
    }
    return receiptFor(request, snapshot, after, "created");
  } catch (error) {
    if (error instanceof AdapterRefusal) return backendFailure(error.category, error.code, request);
    return backendFailure("integrity_failure", "adapter_create_failed", request);
  }
}

function executeCleanup(value: unknown): WorkspaceBackendResult {
  const request = requestForOperation(value, "cleanup");
  if (request === null) return backendFailure("invalid_request", "request_shape_invalid", null);
  return backendFailure("policy_denied", "cleanup_policy_unavailable", request);
}

function createWindowsGitWorkspaceBackendWithRunner(
  configurationValue: WindowsGitWorkspaceAdapterConfiguration,
  createWorker: CreateWorkerRunner,
): WindowsGitWorkspaceBackend {
  const configuration = parseConfiguration(configurationValue);
  const description: WindowsGitWorkspaceAdapterDescription = Object.freeze({
    adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
    adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
    contractId: WORKSPACE_CONTRACT_ID,
    projectRootCount: configuration.projectRoots.size,
    workspaceRootCount: configuration.workspaceRoots.size,
  });
  const backend: WindowsGitWorkspaceBackend = Object.freeze({
    description,
    reserve: (request: WorkspaceBackendRequest & Readonly<{ readonly operation: "reserve" }>) =>
      executeReserve(configuration, request),
    create: (request: WorkspaceBackendRequest & Readonly<{ readonly operation: "create" }>) =>
      executeCreate(configuration, request, createWorker),
    inspect: (request: WorkspaceBackendRequest & Readonly<{ readonly operation: "inspect" }>) =>
      executeReadOperation(configuration, request, "inspect"),
    recover: (request: WorkspaceBackendRequest & Readonly<{ readonly operation: "recover" }>) =>
      executeReadOperation(configuration, request, "recover"),
    cleanup: (request: WorkspaceBackendRequest & Readonly<{ readonly operation: "cleanup" }>) =>
      executeCleanup(request),
  });
  return backend;
}

export function createWindowsGitWorkspaceBackend(
  configurationValue: WindowsGitWorkspaceAdapterConfiguration,
): WindowsGitWorkspaceBackend {
  return createWindowsGitWorkspaceBackendWithRunner(configurationValue, runCreateWorker);
}

export function createWindowsGitWorkspacePostMkdirIdentityFailureBackendForTesting(
  configurationValue: WindowsGitWorkspaceAdapterConfiguration,
): WindowsGitWorkspaceBackend {
  return createWindowsGitWorkspaceBackendWithRunner(
    configurationValue,
    runPostMkdirIdentityFailureForTesting,
  );
}

function isDirectWorkerInvocation(): boolean {
  const entryModule = process.argv[1];
  return typeof entryModule === "string" && process.argv[2] === WORKER_MARKER &&
    samePath(entryModule, fileURLToPath(import.meta.url));
}

if (isDirectWorkerInvocation()) executeWorker(process.argv[3] ?? "");
