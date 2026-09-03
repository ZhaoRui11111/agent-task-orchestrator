import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  COMPLETION_CONTRACT_ID,
  parseCompletionBackendRequest,
  parseCompletionBackendResult,
  type CancelGateRequest,
  type CompletionBackend,
  type CompletionBackendRequest,
  type CompletionBackendResult,
  type CompletionGateSubject,
  type CompletionOperation,
  type InspectGateRequest,
  type RunGateRequest,
} from "./completion-port.ts";

export const LOCAL_COMPLETION_ADAPTER_ID = "local-completion" as const;
export const LOCAL_COMPLETION_ADAPTER_VERSION = "1.0.0" as const;

export interface LocalCompletionWorkspaceBinding {
  readonly projectRootKey: string;
  readonly projectPath: string;
  readonly repositoryIdentity: string;
  readonly workspaceId: string;
  readonly generation: number;
  readonly workspaceRevision: number;
  readonly workspaceRootKey: string;
  readonly workspacePath: string;
  readonly ownershipBindingSha256: string;
  readonly headObjectId: string;
}

export interface LocalCompletionEvidenceRootBinding {
  readonly rootKey: string;
  readonly path: string;
}

export interface LocalCompletionGateConfiguration {
  readonly commandKey: string;
  readonly commandIdentitySha256: string;
  readonly toolEnvironmentSha256: string;
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly maximumOutputBytes: number;
  readonly passExitCodes: readonly number[];
  readonly passValiditySeconds: number | null;
}

export interface LocalCompletionBackendConfiguration {
  readonly gitExecutable: string;
  readonly workspaces: readonly LocalCompletionWorkspaceBinding[];
  readonly evidenceRoots: readonly LocalCompletionEvidenceRootBinding[];
  readonly gates: readonly LocalCompletionGateConfiguration[];
}

export interface LocalCompletionBackendIngress {
  now(): string;
  beforeEvidenceReadOpen?(): void;
  beforeEvidencePublishOpen?(): void;
  beforeGateEffect?(): void;
}

export interface LocalCompletionBackend extends CompletionBackend {
  readonly description: Readonly<{
    readonly contractId: typeof COMPLETION_CONTRACT_ID;
    readonly adapterId: typeof LOCAL_COMPLETION_ADAPTER_ID;
    readonly adapterVersion: typeof LOCAL_COMPLETION_ADAPTER_VERSION;
    readonly workspaceCount: number;
    readonly evidenceRootCount: number;
    readonly gateCount: number;
  }>;
}

interface FileIdentity {
  readonly realPath: string;
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
}

interface TrustedWorkspace extends LocalCompletionWorkspaceBinding {
  readonly projectIdentity: FileIdentity;
  readonly workspaceIdentity: FileIdentity;
  readonly gitFileIdentity: FileIdentity;
  readonly gitFileSha256: string;
  readonly gitDirectoryIdentity: FileIdentity;
  readonly commonDirectoryIdentity: FileIdentity;
  readonly objectDirectoryIdentity: FileIdentity;
  readonly headFileIdentity: FileIdentity;
  readonly headFileSha256: string;
  readonly lockedFileIdentity: FileIdentity;
  readonly lockedFileSha256: string;
  readonly manifestIdentity: FileIdentity;
  readonly manifestSha256: string;
}

interface TrustedEvidenceRoot extends LocalCompletionEvidenceRootBinding {
  readonly identity: FileIdentity;
}

interface TrustedGate extends LocalCompletionGateConfiguration {
  readonly executableRealPath: string;
  readonly executableIdentity: FileIdentity;
}

interface GateEvidenceBody {
  readonly schemaVersion: 1;
  readonly semanticSha256: string;
  readonly gateOperationId: string;
  readonly creatorOperationId: string;
  readonly subjectSha256: string;
  readonly evidenceRootKey: string;
  readonly lifecycle: "completed" | "cancelled";
  readonly verdict: "pass" | "fail" | "indeterminate";
  readonly code: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly validUntil: string | null;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdoutSha256: string;
  readonly stderrSha256: string;
}

interface GateEvidence extends GateEvidenceBody {
  readonly evidenceDirectoryIdentitySha256: string;
  readonly resultFileIdentitySha256: string;
}

interface ActiveGate {
  readonly semanticSha256: string;
  readonly request: RunGateRequest;
  readonly child: ChildProcess;
  readonly startedAt: string;
  readonly evidenceReference: string;
  readonly evidenceDirectoryIdentity: FileIdentity;
  cancelRequested: boolean;
}

const EVIDENCE_KEYS = Object.freeze([
  "schemaVersion", "semanticSha256", "gateOperationId", "creatorOperationId", "subjectSha256",
  "evidenceRootKey", "lifecycle", "verdict", "code", "startedAt", "endedAt", "validUntil",
  "exitCode", "signal", "stdoutSha256", "stderrSha256", "evidenceDirectoryIdentitySha256",
  "resultFileIdentitySha256",
] as const);

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value, typeof value === "string" ? "utf8" : undefined).digest("hex").toUpperCase();
}

function identifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function containedBy(parent: string, child: string): boolean {
  const relative = path.relative(normalizedPath(parent), normalizedPath(child));
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function identityFromStats(
  realPath: string,
  stats: Readonly<{ dev: bigint; ino: bigint; mode: bigint }>,
): FileIdentity {
  const mode = Number(stats.mode);
  if (!Number.isSafeInteger(mode)) throw new TypeError("Completion file mode is invalid");
  return Object.freeze({ realPath, device: String(stats.dev), inode: String(stats.ino), mode });
}

function directDirectoryIdentity(value: unknown): FileIdentity {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new TypeError("Completion root path must be absolute");
  const resolved = path.resolve(value);
  const direct = lstatSync(resolved, { bigint: true });
  const realPath = realpathSync.native(resolved);
  const stats = lstatSync(realPath, { bigint: true });
  if (!direct.isDirectory() || direct.isSymbolicLink() || !stats.isDirectory() || stats.isSymbolicLink() ||
      normalizedPath(resolved) !== normalizedPath(realPath)) {
    throw new TypeError("Completion root is not a direct directory");
  }
  return identityFromStats(realPath, stats);
}

function directFileIdentity(value: unknown): FileIdentity {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new TypeError("Completion file must be absolute");
  const resolved = path.resolve(value);
  const direct = lstatSync(resolved, { bigint: true });
  const realPath = realpathSync.native(resolved);
  const stats = lstatSync(realPath, { bigint: true });
  if (!direct.isFile() || direct.isSymbolicLink() || direct.nlink !== 1n || !stats.isFile() || stats.isSymbolicLink() ||
      stats.nlink !== 1n || normalizedPath(resolved) !== normalizedPath(realPath)) {
    throw new TypeError("Completion file is not a direct single-link regular file");
  }
  return identityFromStats(realPath, stats);
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return normalizedPath(left.realPath) === normalizedPath(right.realPath) &&
    left.device === right.device && left.inode === right.inode && left.mode === right.mode;
}

function directoryIdentityCurrent(expected: FileIdentity): boolean {
  try { return sameIdentity(directDirectoryIdentity(expected.realPath), expected); } catch { return false; }
}

function fileIdentityCurrent(expected: FileIdentity): boolean {
  try { return sameIdentity(directFileIdentity(expected.realPath), expected); } catch { return false; }
}

function descriptorMatches(fileDescriptor: number, expected: FileIdentity): boolean {
  const stats = fstatSync(fileDescriptor, { bigint: true });
  const mode = Number(stats.mode);
  return stats.isFile() && !stats.isSymbolicLink() && stats.nlink === 1n &&
    Number.isSafeInteger(mode) && String(stats.dev) === expected.device && String(stats.ino) === expected.inode &&
    mode === expected.mode;
}

function evidenceIdentitySha256(identity: FileIdentity): string {
  return sha256(canonicalJson({ device: identity.device, inode: identity.inode, mode: identity.mode }));
}

function readStableFile(target: string, maximumBytes: number): Readonly<{ identity: FileIdentity; bytes: Uint8Array }> {
  const before = directFileIdentity(target);
  const beforeStats = lstatSync(before.realPath, { bigint: true });
  if (beforeStats.size < 1n || beforeStats.size > BigInt(maximumBytes)) throw new TypeError("Completion file size is invalid");
  let descriptor: number | null = null;
  try {
    descriptor = openSync(before.realPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if (!descriptorMatches(descriptor, before)) throw new TypeError("Completion file identity changed before read");
    const bytes = readFileSync(descriptor);
    if (BigInt(bytes.byteLength) !== beforeStats.size || !descriptorMatches(descriptor, before) ||
        !fileIdentityCurrent(before)) throw new TypeError("Completion file identity changed during read");
    return Object.freeze({ identity: before, bytes });
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function safeGitEnvironment(gitExecutable: string): Readonly<Record<string, string>> {
  const windowsRoot = process.env.SystemRoot ?? "C:\\Windows";
  return Object.freeze({
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "Never",
    GIT_PROTOCOL_FROM_USER: "0",
    LC_ALL: "C",
    LANG: "C",
    PATH: process.platform === "win32"
      ? `${path.dirname(gitExecutable)};${path.join(windowsRoot, "System32")}`
      : path.dirname(gitExecutable),
    SystemRoot: windowsRoot,
  });
}

function runGit(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  cwd: string,
  arguments_: readonly string[],
): Readonly<{ status: number | null; stdout: string; error: boolean }> {
  const result = spawnSync(gitExecutable, arguments_, {
    cwd,
    env: environment,
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    shell: false,
    stdio: "pipe",
  });
  return Object.freeze({
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : new TextDecoder().decode(result.stdout),
    error: result.error !== undefined,
  });
}

function singleLine(value: string): string | null {
  const normalized = value.replaceAll("\r\n", "\n");
  return normalized.endsWith("\n") && !normalized.slice(0, -1).includes("\n") ? normalized.slice(0, -1) : null;
}

function gitLine(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  cwd: string,
  arguments_: readonly string[],
): string | null {
  const result = runGit(gitExecutable, environment, cwd, arguments_);
  return result.status === 0 && !result.error ? singleLine(result.stdout) : null;
}

function workspaceIdentityProjection(identity: FileIdentity): Readonly<Record<string, unknown>> {
  return Object.freeze({ realPath: identity.realPath, dev: identity.device, ino: identity.inode, mode: identity.mode });
}

function expectedRepositoryIdentity(
  project: FileIdentity,
  common: FileIdentity,
  object: FileIdentity,
  objectFormat: string,
): string {
  return `sha256:${createHash("sha256").update(`${canonicalJson({
    common: workspaceIdentityProjection(common),
    object: workspaceIdentityProjection(object),
    objectFormat,
    project: workspaceIdentityProjection(project),
  })}\n`, "utf8").digest("hex").toUpperCase()}`;
}

function linkedWorktreeRegistrationIsCurrent(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  projectPath: string,
  workspacePath: string,
  headObjectId: string,
): boolean {
  const result = runGit(gitExecutable, environment, projectPath, ["worktree", "list", "--porcelain", "-z"]);
  if (result.status !== 0 || result.error) return false;
  const records: Array<Readonly<{ path: string; head: string | null; detached: boolean; locked: boolean; prunable: boolean }>> = [];
  let current: { path: string; head: string | null; detached: boolean; locked: boolean; prunable: boolean } | null = null;
  for (const token of result.stdout.split("\0")) {
    if (token === "") {
      if (current !== null) records.push(Object.freeze(current));
      current = null;
    } else if (token.startsWith("worktree ")) {
      if (current !== null) return false;
      current = { path: token.slice(9), head: null, detached: false, locked: false, prunable: false };
    } else if (current === null) return false;
    else if (token.startsWith("HEAD ")) current.head = token.slice(5);
    else if (token === "detached") current.detached = true;
    else if (token.startsWith("locked")) current.locked = true;
    else if (token.startsWith("prunable")) current.prunable = true;
    else if (!token.startsWith("branch ") && token !== "bare") return false;
  }
  if (current !== null) records.push(Object.freeze(current));
  const matches = records.filter((record) => normalizedPath(record.path) === normalizedPath(workspacePath));
  return matches.length === 1 && matches[0]?.head === headObjectId && matches[0].detached &&
    matches[0].locked && !matches[0].prunable;
}

function repositoryStateIsSafe(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  repositoryPath: string,
  commonDirectory: FileIdentity,
  objectDirectory: FileIdentity,
): boolean {
  try {
    const config = runGit(gitExecutable, environment, repositoryPath, ["config", "--local", "--name-only", "--list"]);
    if (config.status !== 0 || config.error) return false;
    const unsafeConfig = config.stdout.replaceAll("\r\n", "\n").split("\n").filter(Boolean).some((key) => {
      const lower = key.toLowerCase();
      return lower === "core.hookspath" || lower === "credential.helper" || lower.startsWith("credential.") ||
        lower.startsWith("http.") || lower.startsWith("https.") || lower.startsWith("url.") ||
        lower.startsWith("remote.") || lower.startsWith("filter.") || lower.startsWith("submodule.") ||
        lower.includes("promisor") || lower.includes("partialclone") || lower.startsWith("include.") ||
        lower.startsWith("protocol.") || lower === "core.sparsecheckout" || lower === "core.sparsecheckoutcone" ||
        lower === "core.fsmonitor" || lower === "core.worktree" || lower === "core.gitproxy" ||
        lower === "core.sshcommand" || lower === "remote.pushdefault" || lower === "push.default" ||
        lower === "receivepack" || lower === "uploadpack";
    });
    const hookDirectories = new Set([
      path.join(commonDirectory.realPath, "hooks"),
    ]);
    const unsafeHooks = [...hookDirectories].some((hooks) => existsSync(hooks) &&
      readdirSync(hooks).some((name) => !name.endsWith(".sample")));
    return !unsafeConfig && !unsafeHooks &&
      !existsSync(path.join(objectDirectory.realPath, "info", "alternates")) &&
      !existsSync(path.join(objectDirectory.realPath, "info", "http-alternates")) &&
      !existsSync(path.join(commonDirectory.realPath, "info", "grafts")) &&
      !existsSync(path.join(commonDirectory.realPath, "info", "attributes")) &&
      !existsSync(path.join(commonDirectory.realPath, "shallow")) &&
      !existsSync(path.join(commonDirectory.realPath, "refs", "replace")) &&
      !existsSync(path.join(repositoryPath, ".gitmodules"));
  } catch {
    return false;
  }
}

function pathsOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizedPath(left);
  const normalizedRight = normalizedPath(right);
  if (normalizedLeft === normalizedRight) return true;
  const leftRelative = path.relative(normalizedLeft, normalizedRight);
  const rightRelative = path.relative(normalizedRight, normalizedLeft);
  return (!leftRelative.startsWith("..") && !path.isAbsolute(leftRelative)) ||
    (!rightRelative.startsWith("..") && !path.isAbsolute(rightRelative));
}

function copyWorkspace(
  value: LocalCompletionWorkspaceBinding,
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
): TrustedWorkspace {
  if (!identifier(value.projectRootKey) || !identifier(value.workspaceId) || !Number.isSafeInteger(value.generation) ||
      value.generation < 1 || !Number.isSafeInteger(value.workspaceRevision) || value.workspaceRevision < 1 ||
      !identifier(value.workspaceRootKey) || !identifier(value.repositoryIdentity) ||
      !/^[0-9A-F]{64}$/u.test(value.ownershipBindingSha256) ||
      !/^[0-9a-f]{40}$/u.test(value.headObjectId)) throw new TypeError("Completion workspace binding is invalid");
  const projectIdentity = directDirectoryIdentity(value.projectPath);
  const workspaceIdentity = directDirectoryIdentity(value.workspacePath);
  if (pathsOverlap(projectIdentity.realPath, workspaceIdentity.realPath)) {
    throw new TypeError("Completion Project and workspace roots overlap");
  }
  const gitFile = readStableFile(path.join(workspaceIdentity.realPath, ".git"), 4096);
  const gitPointer = decodeUtf8(gitFile.bytes).replaceAll("\r\n", "\n");
  if (!gitPointer.startsWith("gitdir: ") || !gitPointer.endsWith("\n") || gitPointer.slice(0, -1).includes("\n")) {
    throw new TypeError("Completion workspace Git pointer is invalid");
  }
  const pointerTarget = path.resolve(workspaceIdentity.realPath, gitPointer.slice(8, -1));
  const gitDirectoryIdentity = directDirectoryIdentity(pointerTarget);
  if (!containedBy(projectIdentity.realPath, gitDirectoryIdentity.realPath)) {
    throw new TypeError("Completion workspace Git directory escapes the Project root");
  }
  const reportedGitDirectory = gitLine(gitExecutable, environment, workspaceIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-dir"]);
  const reportedCommonDirectory = gitLine(gitExecutable, environment, workspaceIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const reportedObjectDirectory = gitLine(gitExecutable, environment, workspaceIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-path", "objects"]);
  const reportedWorktree = gitLine(gitExecutable, environment, workspaceIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--show-toplevel"]);
  if (reportedGitDirectory === null || reportedCommonDirectory === null || reportedObjectDirectory === null ||
      reportedWorktree === null || normalizedPath(reportedGitDirectory) !== normalizedPath(gitDirectoryIdentity.realPath) ||
      normalizedPath(reportedWorktree) !== normalizedPath(workspaceIdentity.realPath)) {
    throw new TypeError("Completion workspace Git topology is invalid");
  }
  const commonDirectoryIdentity = directDirectoryIdentity(reportedCommonDirectory);
  const objectDirectoryIdentity = directDirectoryIdentity(reportedObjectDirectory);
  if (!containedBy(projectIdentity.realPath, commonDirectoryIdentity.realPath) ||
      !containedBy(projectIdentity.realPath, objectDirectoryIdentity.realPath)) {
    throw new TypeError("Completion workspace Git namespace escapes the Project root");
  }
  const projectTopLevel = gitLine(gitExecutable, environment, projectIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--show-toplevel"]);
  const projectCommonDirectory = gitLine(gitExecutable, environment, projectIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const projectObjectDirectory = gitLine(gitExecutable, environment, projectIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-path", "objects"]);
  const objectFormat = gitLine(gitExecutable, environment, workspaceIdentity.realPath,
    ["rev-parse", "--show-object-format"]);
  if (projectTopLevel === null || projectCommonDirectory === null || projectObjectDirectory === null ||
      objectFormat !== "sha1" || normalizedPath(projectTopLevel) !== normalizedPath(projectIdentity.realPath) ||
      normalizedPath(projectCommonDirectory) !== normalizedPath(commonDirectoryIdentity.realPath) ||
      normalizedPath(projectObjectDirectory) !== normalizedPath(objectDirectoryIdentity.realPath) ||
      expectedRepositoryIdentity(projectIdentity, commonDirectoryIdentity, objectDirectoryIdentity, objectFormat) !==
        value.repositoryIdentity) {
    throw new TypeError("Completion repository identity is invalid");
  }
  if (!repositoryStateIsSafe(gitExecutable, environment, workspaceIdentity.realPath,
    commonDirectoryIdentity, objectDirectoryIdentity)) {
    throw new TypeError("Completion repository configuration is unsafe");
  }
  const headFile = readStableFile(path.join(gitDirectoryIdentity.realPath, "HEAD"), 256);
  const lockedFile = readStableFile(path.join(gitDirectoryIdentity.realPath, "locked"), 4096);
  if (decodeUtf8(headFile.bytes).replaceAll("\r\n", "\n") !== `${value.headObjectId}\n` ||
      decodeUtf8(lockedFile.bytes).replaceAll("\r\n", "\n") !== "ato.workspace/v2 ownership\n" ||
      !linkedWorktreeRegistrationIsCurrent(gitExecutable, environment, projectIdentity.realPath,
        workspaceIdentity.realPath, value.headObjectId)) {
    throw new TypeError("Completion workspace registration is invalid");
  }
  const manifest = readStableFile(path.join(gitDirectoryIdentity.realPath, "ato-workspace-ownership-v1.json"), 16 * 1024);
  const manifestText = decodeUtf8(manifest.bytes);
  const manifestValue = JSON.parse(manifestText) as unknown;
  if (typeof manifestValue !== "object" || manifestValue === null || Array.isArray(manifestValue)) {
    throw new TypeError("Completion workspace ownership manifest is invalid");
  }
  const manifestRecord = manifestValue as Readonly<Record<string, unknown>>;
  if (manifestRecord.workspaceId !== undefined || manifestRecord.schema !== "ato.workspace-ownership/v1" ||
      manifestRecord.repositoryIdentity !== value.repositoryIdentity || manifestRecord.generation !== value.generation ||
      manifestRecord.ownershipBindingSha256 !== value.ownershipBindingSha256) {
    throw new TypeError("Completion workspace ownership manifest is invalid");
  }
  const head = gitLine(gitExecutable, environment, workspaceIdentity.realPath, ["rev-parse", "--verify", "HEAD^{commit}"]);
  const status = runGit(gitExecutable, environment, workspaceIdentity.realPath,
    ["-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching", "--ignore-submodules=all"]);
  if (head !== value.headObjectId || status.status !== 0 || status.error || status.stdout.length !== 0) {
    throw new TypeError("Completion workspace HEAD or inventory is not current");
  }
  return Object.freeze({
    ...value,
    projectPath: projectIdentity.realPath,
    workspacePath: workspaceIdentity.realPath,
    projectIdentity,
    workspaceIdentity,
    gitFileIdentity: gitFile.identity,
    gitFileSha256: sha256(gitFile.bytes),
    gitDirectoryIdentity,
    commonDirectoryIdentity,
    objectDirectoryIdentity,
    headFileIdentity: headFile.identity,
    headFileSha256: sha256(headFile.bytes),
    lockedFileIdentity: lockedFile.identity,
    lockedFileSha256: sha256(lockedFile.bytes),
    manifestIdentity: manifest.identity,
    manifestSha256: sha256(manifest.bytes),
  });
}

function copyEvidenceRoot(value: LocalCompletionEvidenceRootBinding): TrustedEvidenceRoot {
  if (!identifier(value.rootKey)) throw new TypeError("Completion evidence-root key is invalid");
  const identity = directDirectoryIdentity(value.path);
  return Object.freeze({ rootKey: value.rootKey, path: identity.realPath, identity });
}

function workspaceIdentityCurrent(
  workspace: TrustedWorkspace,
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
): boolean {
  try {
    if (!directoryIdentityCurrent(workspace.projectIdentity) || !directoryIdentityCurrent(workspace.workspaceIdentity) ||
        !directoryIdentityCurrent(workspace.gitDirectoryIdentity) ||
        !directoryIdentityCurrent(workspace.commonDirectoryIdentity) ||
        !directoryIdentityCurrent(workspace.objectDirectoryIdentity)) return false;
    const gitFile = readStableFile(workspace.gitFileIdentity.realPath, 4096);
    const headFile = readStableFile(workspace.headFileIdentity.realPath, 256);
    const lockedFile = readStableFile(workspace.lockedFileIdentity.realPath, 4096);
    const manifest = readStableFile(workspace.manifestIdentity.realPath, 16 * 1024);
    if (!sameIdentity(gitFile.identity, workspace.gitFileIdentity) || sha256(gitFile.bytes) !== workspace.gitFileSha256 ||
        !sameIdentity(headFile.identity, workspace.headFileIdentity) || sha256(headFile.bytes) !== workspace.headFileSha256 ||
        decodeUtf8(headFile.bytes).replaceAll("\r\n", "\n") !== `${workspace.headObjectId}\n` ||
        !sameIdentity(lockedFile.identity, workspace.lockedFileIdentity) || sha256(lockedFile.bytes) !== workspace.lockedFileSha256 ||
        decodeUtf8(lockedFile.bytes).replaceAll("\r\n", "\n") !== "ato.workspace/v2 ownership\n" ||
        !sameIdentity(manifest.identity, workspace.manifestIdentity) || sha256(manifest.bytes) !== workspace.manifestSha256) return false;
    const pointer = decodeUtf8(gitFile.bytes).replaceAll("\r\n", "\n");
    if (!pointer.startsWith("gitdir: ") || !pointer.endsWith("\n") || pointer.slice(0, -1).includes("\n") ||
        normalizedPath(path.resolve(workspace.workspaceIdentity.realPath, pointer.slice(8, -1))) !==
          normalizedPath(workspace.gitDirectoryIdentity.realPath)) return false;
    const reportedGitDirectory = gitLine(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--git-dir"]);
    const reportedCommonDirectory = gitLine(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const reportedObjectDirectory = gitLine(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--git-path", "objects"]);
    const reportedWorktree = gitLine(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--show-toplevel"]);
    const projectTopLevel = gitLine(gitExecutable, environment, workspace.projectIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--show-toplevel"]);
    const projectCommonDirectory = gitLine(gitExecutable, environment, workspace.projectIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const projectObjectDirectory = gitLine(gitExecutable, environment, workspace.projectIdentity.realPath,
      ["rev-parse", "--path-format=absolute", "--git-path", "objects"]);
    const objectFormat = gitLine(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["rev-parse", "--show-object-format"]);
    const head = gitLine(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["rev-parse", "--verify", "HEAD^{commit}"]);
    const status = runGit(gitExecutable, environment, workspace.workspaceIdentity.realPath,
      ["-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching", "--ignore-submodules=all"]);
    return reportedGitDirectory !== null && reportedCommonDirectory !== null && reportedObjectDirectory !== null &&
      reportedWorktree !== null && normalizedPath(reportedGitDirectory) === normalizedPath(workspace.gitDirectoryIdentity.realPath) &&
      normalizedPath(reportedCommonDirectory) === normalizedPath(workspace.commonDirectoryIdentity.realPath) &&
      normalizedPath(reportedObjectDirectory) === normalizedPath(workspace.objectDirectoryIdentity.realPath) &&
      normalizedPath(reportedWorktree) === normalizedPath(workspace.workspaceIdentity.realPath) &&
      projectTopLevel !== null && projectCommonDirectory !== null && projectObjectDirectory !== null &&
      normalizedPath(projectTopLevel) === normalizedPath(workspace.projectIdentity.realPath) &&
      normalizedPath(projectCommonDirectory) === normalizedPath(workspace.commonDirectoryIdentity.realPath) &&
      normalizedPath(projectObjectDirectory) === normalizedPath(workspace.objectDirectoryIdentity.realPath) &&
      objectFormat === "sha1" && expectedRepositoryIdentity(workspace.projectIdentity,
        workspace.commonDirectoryIdentity, workspace.objectDirectoryIdentity, objectFormat) === workspace.repositoryIdentity &&
      repositoryStateIsSafe(gitExecutable, environment, workspace.workspaceIdentity.realPath,
        workspace.commonDirectoryIdentity, workspace.objectDirectoryIdentity) &&
      head === workspace.headObjectId && status.status === 0 && !status.error && status.stdout.length === 0 &&
      linkedWorktreeRegistrationIsCurrent(gitExecutable, environment, workspace.projectIdentity.realPath,
        workspace.workspaceIdentity.realPath, workspace.headObjectId) &&
      directoryIdentityCurrent(workspace.projectIdentity) && directoryIdentityCurrent(workspace.workspaceIdentity) &&
      directoryIdentityCurrent(workspace.gitDirectoryIdentity) && directoryIdentityCurrent(workspace.commonDirectoryIdentity) &&
      directoryIdentityCurrent(workspace.objectDirectoryIdentity) && fileIdentityCurrent(workspace.gitFileIdentity) &&
      fileIdentityCurrent(workspace.headFileIdentity) && fileIdentityCurrent(workspace.lockedFileIdentity) &&
      fileIdentityCurrent(workspace.manifestIdentity);
  } catch {
    return false;
  }
}

function copyGate(value: LocalCompletionGateConfiguration): TrustedGate {
  if (!identifier(value.commandKey) || !/^[0-9A-F]{64}$/u.test(value.commandIdentitySha256) ||
      !/^[0-9A-F]{64}$/u.test(value.toolEnvironmentSha256) || !Array.isArray(value.arguments) ||
      value.arguments.length > 64 || value.arguments.some((argument) => typeof argument !== "string" || argument.length > 1024 || /\u0000/u.test(argument)) ||
      typeof value.environment !== "object" || value.environment === null || Array.isArray(value.environment) ||
      Object.keys(value.environment).length > 64 || Object.entries(value.environment).some(([key, child]) =>
        !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(key) || typeof child !== "string" || child.length > 4096 || /\u0000/u.test(child)) ||
      !Number.isSafeInteger(value.maximumOutputBytes) || value.maximumOutputBytes < 0 || value.maximumOutputBytes > 16 * 1024 * 1024 ||
      !Array.isArray(value.passExitCodes) || value.passExitCodes.length === 0 || value.passExitCodes.length > 16 ||
      value.passExitCodes.some((code) => !Number.isSafeInteger(code) || code < 0 || code > 255) ||
      !(value.passValiditySeconds === null || (Number.isSafeInteger(value.passValiditySeconds) && value.passValiditySeconds > 0 && value.passValiditySeconds <= 86_400))) {
    throw new TypeError("Completion gate configuration is invalid");
  }
  const executableIdentity = directFileIdentity(value.executable);
  const executableRealPath = executableIdentity.realPath;
  return Object.freeze({
    ...value,
    executable: executableRealPath,
    executableRealPath,
    executableIdentity,
    arguments: Object.freeze([...value.arguments]),
    environment: Object.freeze({ ...value.environment }),
    passExitCodes: Object.freeze([...new Set(value.passExitCodes)]),
  });
}

function failure(category: "invalid_request" | "incompatible_contract" | "not_found" | "conflict" | "integrity_failure", code: string): CompletionBackendResult {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      category, code, retryable: false, ambiguous: category === "integrity_failure",
      retryAfter: null, evidenceReference: null,
    }),
  });
}

function exactRecord(value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))) return null;
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      copy[key] = descriptor.value;
    }
    return Object.freeze(copy);
  } catch {
    return null;
  }
}

function semanticSha256(subject: CompletionGateSubject, gateOperationId: string): string {
  return sha256(canonicalJson({
    adapterId: LOCAL_COMPLETION_ADAPTER_ID,
    adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
    contractId: COMPLETION_CONTRACT_ID,
    gateOperationId,
    subject,
  }));
}

function evidenceLocation(root: TrustedEvidenceRoot, semantic: string): Readonly<{
  directory: string;
  resultFile: string;
  evidenceReference: string;
}> {
  const suffix = semantic.toLowerCase();
  return Object.freeze({
    directory: path.join(root.identity.realPath, `g-${suffix}`),
    resultFile: path.join(root.identity.realPath, `g-${suffix}`, "result.json"),
    evidenceReference: `gate:${suffix}`,
  });
}

function parseEvidence(value: unknown, semantic: string, rootKey: string): GateEvidence | null {
  const record = exactRecord(value, EVIDENCE_KEYS);
  if (record === null || record.schemaVersion !== 1 || record.semanticSha256 !== semantic ||
      record.subjectSha256 !== semantic || record.evidenceRootKey !== rootKey || !identifier(record.gateOperationId) ||
      !identifier(record.creatorOperationId) || (record.lifecycle !== "completed" && record.lifecycle !== "cancelled") ||
      (record.verdict !== "pass" && record.verdict !== "fail" && record.verdict !== "indeterminate") ||
      !identifier(record.code) || !canonicalTimestamp(record.startedAt) || !canonicalTimestamp(record.endedAt) ||
      record.endedAt < record.startedAt || !(record.validUntil === null || canonicalTimestamp(record.validUntil)) ||
      !(record.exitCode === null || (typeof record.exitCode === "number" && Number.isSafeInteger(record.exitCode))) ||
      !(record.signal === null || identifier(record.signal)) || !/^[0-9A-F]{64}$/u.test(String(record.stdoutSha256)) ||
      !/^[0-9A-F]{64}$/u.test(String(record.stderrSha256)) ||
      !/^[0-9A-F]{64}$/u.test(String(record.evidenceDirectoryIdentitySha256)) ||
      !/^[0-9A-F]{64}$/u.test(String(record.resultFileIdentitySha256)) ||
      (record.verdict !== "pass" && record.validUntil !== null)) return null;
  return Object.freeze(record) as unknown as GateEvidence;
}

function readEvidence(
  root: TrustedEvidenceRoot,
  semantic: string,
  ingress: LocalCompletionBackendIngress,
): GateEvidence | "absent" | "ambiguous" {
  const location = evidenceLocation(root, semantic);
  if (!directoryIdentityCurrent(root.identity)) return "ambiguous";
  let directoryIdentity: FileIdentity;
  try {
    directoryIdentity = directDirectoryIdentity(location.directory);
  } catch (error) {
    return (error as Readonly<{ code?: unknown }>).code === "ENOENT" ? "absent" : "ambiguous";
  }
  let descriptor: number | null = null;
  try {
    const entries = readdirSync(location.directory);
    if (entries.length !== 1 || entries[0] !== "result.json") return "ambiguous";
    const before = directFileIdentity(location.resultFile);
    const beforeStats = lstatSync(location.resultFile, { bigint: true });
    if (beforeStats.size < 2n || beforeStats.size > 64n * 1024n) return "ambiguous";
    ingress.beforeEvidenceReadOpen?.();
    if (!directoryIdentityCurrent(root.identity) || !directoryIdentityCurrent(directoryIdentity) ||
        !fileIdentityCurrent(before)) return "ambiguous";
    descriptor = openSync(location.resultFile, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    if (!descriptorMatches(descriptor, before)) return "ambiguous";
    const bytes = readFileSync(descriptor);
    if (BigInt(bytes.byteLength) !== beforeStats.size || !descriptorMatches(descriptor, before) ||
        !fileIdentityCurrent(before) || !directoryIdentityCurrent(directoryIdentity) ||
        !directoryIdentityCurrent(root.identity)) return "ambiguous";
    const finalEntries = readdirSync(location.directory);
    if (finalEntries.length !== 1 || finalEntries[0] !== "result.json") return "ambiguous";
    const text = decodeUtf8(bytes);
    const parsed = parseEvidence(JSON.parse(text) as unknown, semantic, root.rootKey);
    return parsed !== null &&
      parsed.evidenceDirectoryIdentitySha256 === evidenceIdentitySha256(directoryIdentity) &&
      parsed.resultFileIdentitySha256 === evidenceIdentitySha256(before)
      ? parsed : "ambiguous";
  } catch {
    return "ambiguous";
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function publishEvidence(
  root: TrustedEvidenceRoot,
  directoryIdentity: FileIdentity,
  evidence: GateEvidenceBody,
  ingress: LocalCompletionBackendIngress,
): GateEvidence | null {
  const location = evidenceLocation(root, evidence.semanticSha256);
  let descriptor: number | null = null;
  try {
    ingress.beforeEvidencePublishOpen?.();
    if (!directoryIdentityCurrent(root.identity) || !directoryIdentityCurrent(directoryIdentity) ||
        readdirSync(location.directory).length !== 0) return null;
    descriptor = openSync(location.resultFile,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    const openedStats = fstatSync(descriptor, { bigint: true });
    const openedIdentity = identityFromStats(location.resultFile, openedStats);
    if (!openedStats.isFile() || openedStats.isSymbolicLink() || openedStats.nlink !== 1n ||
        !directoryIdentityCurrent(directoryIdentity) || !directoryIdentityCurrent(root.identity)) return null;
    const persisted: GateEvidence = Object.freeze({
      ...evidence,
      evidenceDirectoryIdentitySha256: evidenceIdentitySha256(directoryIdentity),
      resultFileIdentitySha256: evidenceIdentitySha256(openedIdentity),
    });
    writeFileSync(descriptor, `${canonicalJson(persisted)}\n`, { encoding: "utf8" });
    fsyncSync(descriptor);
    return descriptorMatches(descriptor, openedIdentity) && fileIdentityCurrent(openedIdentity) &&
      directoryIdentityCurrent(directoryIdentity) && directoryIdentityCurrent(root.identity) &&
      readdirSync(location.directory).length === 1 && readdirSync(location.directory)[0] === "result.json"
      ? persisted : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function receipt(
  request: CompletionBackendRequest,
  operation: CompletionOperation,
  gateOperationId: string,
  observationNumber: number,
  evidenceReference: string,
  evidence: GateEvidence | null,
  live: "running" | "cancel_requested" | "unknown" | null,
  observedAt: string,
): CompletionBackendResult {
  const lifecycle = live ?? evidence?.lifecycle ?? "unknown";
  const verdict = evidence?.verdict ?? "indeterminate";
  const code = live === "running" ? "gate_running"
    : live === "cancel_requested" ? "gate_cancel_requested"
      : evidence?.code ?? "gate_evidence_ambiguous";
  const common = {
    contractId: COMPLETION_CONTRACT_ID,
    receiptId: `gate-receipt:${sha256(canonicalJson({ gateOperationId, observationNumber, operation, observedAt }))}`,
    operation,
    correlationId: request.correlationId,
    adapterId: LOCAL_COMPLETION_ADAPTER_ID,
    adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
    subject: request.subject,
    gateOperationId,
    observationNumber,
    lifecycle,
    verdict,
    code,
    startedAt: evidence?.startedAt ?? null,
    endedAt: evidence?.endedAt ?? null,
    validUntil: evidence?.validUntil ?? null,
    evidenceReference,
    observedAt,
  } as const;
  const candidate = operation === "inspect_gate"
    ? Object.freeze({ ok: true as const, receipt: Object.freeze({
        ...common, operation: "inspect_gate" as const,
        queryId: (request as InspectGateRequest).queryId,
        readAuthorizationDecisionId: (request as InspectGateRequest).readAuthorizationDecisionId,
      }) })
    : Object.freeze({ ok: true as const, receipt: Object.freeze({
        ...common, operation,
        operationId: (request as RunGateRequest | CancelGateRequest).operationId,
        intentId: (request as RunGateRequest | CancelGateRequest).intentId,
        idempotencyKey: (request as RunGateRequest | CancelGateRequest).idempotencyKey,
      }) });
  return parseCompletionBackendResult(candidate, request) ?? failure("integrity_failure", "completion_receipt_invalid");
}

export function createLocalCompletionBackend(
  configuration: LocalCompletionBackendConfiguration,
  ingress: LocalCompletionBackendIngress = Object.freeze({ now: () => new Date().toISOString() }),
): LocalCompletionBackend {
  if (typeof configuration !== "object" || configuration === null || !Array.isArray(configuration.workspaces) ||
      !Array.isArray(configuration.evidenceRoots) || !Array.isArray(configuration.gates) ||
      configuration.workspaces.length === 0 || configuration.evidenceRoots.length === 0 ||
      configuration.gates.length === 0 || typeof ingress.now !== "function" ||
      (ingress.beforeEvidenceReadOpen !== undefined && typeof ingress.beforeEvidenceReadOpen !== "function") ||
      (ingress.beforeEvidencePublishOpen !== undefined && typeof ingress.beforeEvidencePublishOpen !== "function") ||
      (ingress.beforeGateEffect !== undefined && typeof ingress.beforeGateEffect !== "function")) {
    throw new TypeError("Local completion configuration is invalid");
  }
  const gitExecutableIdentity = directFileIdentity(configuration.gitExecutable);
  const gitExecutable = gitExecutableIdentity.realPath;
  const gitEnvironment = safeGitEnvironment(gitExecutable);
  const workspaces = Object.freeze(configuration.workspaces.map((workspace) =>
    copyWorkspace(workspace, gitExecutable, gitEnvironment)));
  const evidenceRoots = Object.freeze(configuration.evidenceRoots.map(copyEvidenceRoot));
  const gates = Object.freeze(configuration.gates.map(copyGate));
  if (new Set(workspaces.map((item) => `${item.workspaceId}\u0000${item.generation}`)).size !== workspaces.length ||
      new Set(evidenceRoots.map((item) => item.rootKey)).size !== evidenceRoots.length ||
      new Set(gates.map((item) => `${item.commandKey}\u0000${item.commandIdentitySha256}\u0000${item.toolEnvironmentSha256}`)).size !== gates.length) {
    throw new TypeError("Local completion configuration identity is duplicated");
  }
  for (const root of evidenceRoots) {
    for (const workspace of workspaces) {
      if (pathsOverlap(root.identity.realPath, workspace.projectIdentity.realPath) ||
          pathsOverlap(root.identity.realPath, workspace.workspaceIdentity.realPath) ||
          pathsOverlap(root.identity.realPath, workspace.gitDirectoryIdentity.realPath) ||
          pathsOverlap(root.identity.realPath, workspace.commonDirectoryIdentity.realPath) ||
          pathsOverlap(root.identity.realPath, workspace.objectDirectoryIdentity.realPath)) {
        throw new TypeError("Completion evidence root overlaps Project or workspace state");
      }
    }
    for (const other of evidenceRoots) {
      if (root !== other && pathsOverlap(root.identity.realPath, other.identity.realPath)) {
        throw new TypeError("Completion evidence roots overlap");
      }
    }
  }
  const active = new Map<string, ActiveGate>();

  const resolve = (request: CompletionBackendRequest): Readonly<{
    workspace: TrustedWorkspace;
    evidenceRoot: TrustedEvidenceRoot;
    gate: TrustedGate;
    semantic: string;
    evidenceReference: string;
  }> | CompletionBackendResult => {
    const workspace = workspaces.find((candidate) => candidate.workspaceId === request.subject.workspaceId &&
      candidate.generation === request.subject.generation && candidate.workspaceRevision === request.subject.workspaceRevision &&
      candidate.workspaceRootKey === request.subject.workspaceRootKey && candidate.projectRootKey === request.subject.projectRootKey &&
      candidate.repositoryIdentity === request.subject.repositoryIdentity &&
      candidate.ownershipBindingSha256 === request.subject.ownershipBindingSha256 && candidate.headObjectId === request.subject.headObjectId);
    const evidenceRoot = evidenceRoots.find((candidate) => candidate.rootKey === request.subject.completionEvidenceRootKey);
    const gate = gates.find((candidate) => candidate.commandKey === request.subject.commandKey &&
      candidate.commandIdentitySha256 === request.subject.commandIdentitySha256 &&
      candidate.toolEnvironmentSha256 === request.subject.toolEnvironmentSha256);
    if (workspace === undefined || evidenceRoot === undefined || gate === undefined) return failure("not_found", "completion_binding_absent");
    if (!fileIdentityCurrent(gitExecutableIdentity) || !fileIdentityCurrent(gate.executableIdentity) ||
        !directoryIdentityCurrent(evidenceRoot.identity) ||
        !workspaceIdentityCurrent(workspace, gitExecutable, gitEnvironment)) {
      return failure("integrity_failure", "completion_binding_drift");
    }
    const gateOperationId = request.operation === "run_gate" ? request.operationId : request.gateOperationId;
    const semantic = semanticSha256(request.subject, gateOperationId);
    return Object.freeze({ workspace, evidenceRoot, gate, semantic, evidenceReference: evidenceLocation(evidenceRoot, semantic).evidenceReference });
  };

  const runGate = (value: RunGateRequest): Promise<CompletionBackendResult> | CompletionBackendResult => {
    const request = parseCompletionBackendRequest(value);
    if (request === null || request.operation !== "run_gate") return failure("invalid_request", "completion_request_invalid");
    if (request.adapterId !== LOCAL_COMPLETION_ADAPTER_ID || request.adapterVersion !== LOCAL_COMPLETION_ADAPTER_VERSION) {
      return failure("incompatible_contract", "completion_adapter_mismatch");
    }
    const resolved = resolve(request);
    if ("ok" in resolved) return resolved;
    const prior = readEvidence(resolved.evidenceRoot, resolved.semantic, ingress);
    const now = ingress.now();
    if (!canonicalTimestamp(now)) return failure("integrity_failure", "completion_clock_invalid");
    if (prior !== "absent") {
      return receipt(request, "run_gate", request.operationId, 1, resolved.evidenceReference,
        prior === "ambiguous" ? null : prior, prior === "ambiguous" ? "unknown" : null, now);
    }
    try {
      mkdirSync(evidenceLocation(resolved.evidenceRoot, resolved.semantic).directory, { recursive: false, mode: 0o700 });
    } catch {
      return failure("conflict", "completion_evidence_acquire_failed");
    }
    let evidenceDirectoryIdentity: FileIdentity;
    try {
      evidenceDirectoryIdentity = directDirectoryIdentity(evidenceLocation(resolved.evidenceRoot, resolved.semantic).directory);
      ingress.beforeGateEffect?.();
      if (!directoryIdentityCurrent(resolved.evidenceRoot.identity) ||
          !directoryIdentityCurrent(evidenceDirectoryIdentity) ||
          !fileIdentityCurrent(gitExecutableIdentity) || !fileIdentityCurrent(resolved.gate.executableIdentity) ||
          !workspaceIdentityCurrent(resolved.workspace, gitExecutable, gitEnvironment)) {
        return receipt(request, "run_gate", request.operationId, 1, resolved.evidenceReference, null, "unknown", now);
      }
    } catch {
      return receipt(request, "run_gate", request.operationId, 1, resolved.evidenceReference, null, "unknown", now);
    }
    let child: ChildProcess;
    try {
      child = spawn(resolved.gate.executableRealPath, resolved.gate.arguments, {
        cwd: resolved.workspace.workspaceIdentity.realPath,
        env: resolved.gate.environment,
        windowsHide: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      return receipt(request, "run_gate", request.operationId, 1, resolved.evidenceReference, null, "unknown", now);
    }
    const activeGate: ActiveGate = {
      semanticSha256: resolved.semantic,
      request,
      child,
      startedAt: now,
      evidenceReference: resolved.evidenceReference,
      evidenceDirectoryIdentity,
      cancelRequested: false,
    };
    active.set(request.operationId, activeGate);
    return new Promise<CompletionBackendResult>((resolveResult) => {
      const stdoutHash = createHash("sha256");
      const stderrHash = createHash("sha256");
      let outputBytes = 0;
      let outputExceeded = false;
      let timedOut = false;
      let settled = false;
      const consume = (hash: ReturnType<typeof createHash>, chunk: Uint8Array): void => {
        outputBytes += chunk.byteLength;
        if (outputBytes <= resolved.gate.maximumOutputBytes) hash.update(chunk);
        else if (!outputExceeded) {
          outputExceeded = true;
          activeGate.child.kill();
        }
      };
      child.stdout?.on("data", (chunk) => consume(stdoutHash, chunk));
      child.stderr?.on("data", (chunk) => consume(stderrHash, chunk));
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, request.timeoutMs);
      const finish = (exitCode: number | null, signal: string | null, startFailed: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        active.delete(request.operationId);
        const endedAtCandidate = ingress.now();
        const endedAt = canonicalTimestamp(endedAtCandidate) && endedAtCandidate >= now ? endedAtCandidate : now;
        const cancelled = activeGate.cancelRequested;
        const verdict = cancelled || timedOut || outputExceeded || startFailed
          ? "indeterminate" as const
          : resolved.gate.passExitCodes.includes(exitCode ?? -1) ? "pass" as const : "fail" as const;
        const code = cancelled ? "gate_cancelled" : timedOut ? "gate_timed_out" : outputExceeded
          ? "gate_output_exceeded" : startFailed ? "gate_start_failed" : verdict === "pass" ? "gate_passed" : "gate_failed";
        const validUntil = verdict === "pass" && resolved.gate.passValiditySeconds !== null
          ? new Date(new Date(endedAt).valueOf() + resolved.gate.passValiditySeconds * 1000).toISOString()
          : null;
        const evidence: GateEvidenceBody = Object.freeze({
          schemaVersion: 1,
          semanticSha256: resolved.semantic,
          gateOperationId: request.operationId,
          creatorOperationId: request.operationId,
          subjectSha256: resolved.semantic,
          evidenceRootKey: resolved.evidenceRoot.rootKey,
          lifecycle: cancelled ? "cancelled" : "completed",
          verdict,
          code,
          startedAt: now,
          endedAt,
          validUntil,
          exitCode,
          signal,
          stdoutSha256: stdoutHash.digest("hex").toUpperCase(),
          stderrSha256: stderrHash.digest("hex").toUpperCase(),
        });
        const published = publishEvidence(resolved.evidenceRoot, activeGate.evidenceDirectoryIdentity, evidence, ingress);
        resolveResult(receipt(request, "run_gate", request.operationId, 1, resolved.evidenceReference,
          published, published === null ? "unknown" : null, endedAt));
      };
      child.on("error", () => finish(null, null, true));
      child.on("close", (code, signal) => finish(code, signal, false));
    });
  };

  const inspectGate = (value: InspectGateRequest): CompletionBackendResult => {
    const request = parseCompletionBackendRequest(value);
    if (request === null || request.operation !== "inspect_gate") return failure("invalid_request", "completion_request_invalid");
    if (request.adapterId !== LOCAL_COMPLETION_ADAPTER_ID || request.adapterVersion !== LOCAL_COMPLETION_ADAPTER_VERSION) {
      return failure("incompatible_contract", "completion_adapter_mismatch");
    }
    const resolved = resolve(request);
    if ("ok" in resolved) return resolved;
    const now = ingress.now();
    if (!canonicalTimestamp(now)) return failure("integrity_failure", "completion_clock_invalid");
    const live = active.get(request.gateOperationId);
    if (live !== undefined && live.semanticSha256 === resolved.semantic) {
      return receipt(request, "inspect_gate", request.gateOperationId, request.lastObservationNumber + 1,
        resolved.evidenceReference, null, live.cancelRequested ? "cancel_requested" : "running", now);
    }
    const evidence = readEvidence(resolved.evidenceRoot, resolved.semantic, ingress);
    return receipt(request, "inspect_gate", request.gateOperationId, request.lastObservationNumber + 1,
      resolved.evidenceReference, evidence === "absent" || evidence === "ambiguous" ? null : evidence,
      evidence === "absent" || evidence === "ambiguous" ? "unknown" : null, now);
  };

  const cancelGate = (value: CancelGateRequest): CompletionBackendResult => {
    const request = parseCompletionBackendRequest(value);
    if (request === null || request.operation !== "cancel_gate") return failure("invalid_request", "completion_request_invalid");
    if (request.adapterId !== LOCAL_COMPLETION_ADAPTER_ID || request.adapterVersion !== LOCAL_COMPLETION_ADAPTER_VERSION) {
      return failure("incompatible_contract", "completion_adapter_mismatch");
    }
    const resolved = resolve(request);
    if ("ok" in resolved) return resolved;
    const now = ingress.now();
    if (!canonicalTimestamp(now)) return failure("integrity_failure", "completion_clock_invalid");
    const live = active.get(request.gateOperationId);
    if (live !== undefined && live.semanticSha256 === resolved.semantic) {
      live.cancelRequested = true;
      live.child.kill();
      return receipt(request, "cancel_gate", request.gateOperationId, request.expectedObservationNumber + 1,
        resolved.evidenceReference, null, "cancel_requested", now);
    }
    const evidence = readEvidence(resolved.evidenceRoot, resolved.semantic, ingress);
    return receipt(request, "cancel_gate", request.gateOperationId, request.expectedObservationNumber + 1,
      resolved.evidenceReference, evidence === "absent" || evidence === "ambiguous" ? null : evidence,
      evidence === "absent" || evidence === "ambiguous" ? "unknown" : null, now);
  };

  return Object.freeze({
    description: Object.freeze({
      contractId: COMPLETION_CONTRACT_ID,
      adapterId: LOCAL_COMPLETION_ADAPTER_ID,
      adapterVersion: LOCAL_COMPLETION_ADAPTER_VERSION,
      workspaceCount: workspaces.length,
      evidenceRootCount: evidenceRoots.length,
      gateCount: gates.length,
    }),
    runGate,
    inspectGate,
    cancelGate,
  });
}
