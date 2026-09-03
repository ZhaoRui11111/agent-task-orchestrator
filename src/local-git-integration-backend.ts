import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  INTEGRATION_CONTRACT_ID,
  parseIntegrationBackendRequest,
  parseIntegrationBackendResult,
  type ApplyIntegrationRequest,
  type InspectIntegrationRequest,
  type IntegrationBackend,
  type IntegrationBackendRequest,
  type IntegrationBackendResult,
  type IntegrationLocalState,
  type IntegrationReceiptCode,
  type IntegrationReceiptOutcome,
  type IntegrationRemoteState,
  type PushIntegrationRequest,
} from "./integration-port.ts";

export const LOCAL_GIT_INTEGRATION_ADAPTER_ID = "local-git-integration" as const;
export const LOCAL_GIT_INTEGRATION_ADAPTER_VERSION = "1.0.0" as const;

export interface LocalGitIntegrationBinding {
  readonly projectRootKey: string;
  readonly projectPath: string;
  readonly repositoryIdentity: string;
  readonly sourceWorkspaceId: string;
  readonly sourceGeneration: number;
  readonly sourceWorkspaceRevision: number;
  readonly sourceWorkspaceRootKey: string;
  readonly sourceWorkspacePath: string;
  readonly sourceOwnershipBindingSha256: string;
  readonly sourceHeadObjectId: string;
  readonly destinationIdentity: string;
  readonly destinationPath: string;
}

export interface LocalGitIntegrationConfiguration {
  readonly gitExecutable: string;
  readonly trustedDisposableRoot: string;
  readonly bindings: readonly LocalGitIntegrationBinding[];
}

export interface LocalGitIntegrationIngress {
  now(): string;
  beforeEffect?(operation: "apply" | "push"): void;
}

export interface LocalGitIntegrationBackend extends IntegrationBackend {
  readonly description: Readonly<{
    readonly contractId: typeof INTEGRATION_CONTRACT_ID;
    readonly adapterId: typeof LOCAL_GIT_INTEGRATION_ADAPTER_ID;
    readonly adapterVersion: typeof LOCAL_GIT_INTEGRATION_ADAPTER_VERSION;
    readonly bindingCount: number;
  }>;
}

interface FileIdentity {
  readonly realPath: string;
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
}

interface StableFileIdentity extends FileIdentity {
  readonly sha256: string;
  readonly text: string;
}

interface RepositoryTopology {
  readonly repositoryIdentity: FileIdentity;
  readonly bare: boolean;
  readonly controlFile: StableFileIdentity | null;
  readonly controlDirectory: FileIdentity | null;
  readonly gitDirectory: FileIdentity;
  readonly commonDirectory: FileIdentity;
  readonly objectDirectory: FileIdentity;
  readonly worktreeDirectory: FileIdentity | null;
}

interface TrustedBinding extends LocalGitIntegrationBinding {
  readonly projectIdentity: FileIdentity;
  readonly workspaceIdentity: FileIdentity;
  readonly destinationPhysicalIdentity: FileIdentity;
  readonly projectTopology: RepositoryTopology;
  readonly workspaceTopology: RepositoryTopology;
  readonly destinationTopology: RepositoryTopology;
  readonly ownershipManifest: StableFileIdentity;
  readonly sourceHeadFile: StableFileIdentity;
  readonly sourceLockedFile: StableFileIdentity;
}

interface RefObservation {
  readonly authoritative: boolean;
  readonly objectId: string | null;
}

interface ReceiptState {
  readonly localBeforeObjectId: string | null;
  readonly localAfterObjectId: string | null;
  readonly remoteBeforeObjectId: string | null;
  readonly remoteAfterObjectId: string | null;
  readonly localState: IntegrationLocalState;
  readonly remoteState: IntegrationRemoteState;
  readonly outcome: IntegrationReceiptOutcome;
  readonly code: IntegrationReceiptCode;
}

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

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex").toUpperCase();
}

function identifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function timestamp(value: unknown): value is string {
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

function pathsOverlap(left: string, right: string): boolean {
  return normalizedPath(left) === normalizedPath(right) || containedBy(left, right) || containedBy(right, left);
}

function localAbsolutePath(value: unknown): value is string {
  return typeof value === "string" && path.isAbsolute(value) && !value.startsWith("\\\\") &&
    !value.startsWith("//") && !value.startsWith("\\\\?\\") && !value.startsWith("\\\\.\\") &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value.replace(/^[A-Za-z]:[\\/]/u, ""));
}

function safeMode(value: bigint): number {
  const mode = Number(value);
  if (!Number.isSafeInteger(mode)) throw new TypeError("Integration file mode is invalid");
  return mode;
}

function directDirectoryIdentity(value: unknown): FileIdentity {
  if (!localAbsolutePath(value)) throw new TypeError("Integration directory is not an absolute local path");
  const resolved = path.resolve(value);
  const direct = lstatSync(resolved, { bigint: true });
  const realPath = realpathSync.native(resolved);
  const stats = lstatSync(realPath, { bigint: true });
  if (!direct.isDirectory() || direct.isSymbolicLink() || !stats.isDirectory() || stats.isSymbolicLink() ||
      normalizedPath(resolved) !== normalizedPath(realPath)) {
    throw new TypeError("Integration directory is not a direct directory");
  }
  return Object.freeze({ realPath, device: String(stats.dev), inode: String(stats.ino), mode: safeMode(stats.mode) });
}

function directFileIdentity(value: unknown): FileIdentity {
  if (!localAbsolutePath(value)) throw new TypeError("Integration file is not an absolute local path");
  const resolved = path.resolve(value);
  const direct = lstatSync(resolved, { bigint: true });
  const realPath = realpathSync.native(resolved);
  const stats = lstatSync(realPath, { bigint: true });
  if (!direct.isFile() || direct.isSymbolicLink() || direct.nlink !== 1n || !stats.isFile() || stats.isSymbolicLink() ||
      stats.nlink !== 1n || normalizedPath(resolved) !== normalizedPath(realPath)) {
    throw new TypeError("Integration file is not a direct single-link regular file");
  }
  return Object.freeze({ realPath, device: String(stats.dev), inode: String(stats.ino), mode: safeMode(stats.mode) });
}

function identityEqual(left: FileIdentity, right: FileIdentity): boolean {
  return normalizedPath(left.realPath) === normalizedPath(right.realPath) && left.device === right.device &&
    left.inode === right.inode && left.mode === right.mode;
}

function directoryIdentityCurrent(expected: FileIdentity): boolean {
  try {
    const current = directDirectoryIdentity(expected.realPath);
    return identityEqual(current, expected);
  } catch {
    return false;
  }
}

function fileIdentityCurrent(expected: FileIdentity): boolean {
  try { return identityEqual(directFileIdentity(expected.realPath), expected); } catch { return false; }
}

function stableFile(value: unknown, maximumBytes: number): StableFileIdentity {
  const before = directFileIdentity(value);
  const beforeStats = lstatSync(before.realPath, { bigint: true });
  if (beforeStats.size < 1n || beforeStats.size > BigInt(maximumBytes)) throw new TypeError("Integration control file size is invalid");
  let descriptor: number | null = null;
  try {
    descriptor = openSync(before.realPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || opened.isSymbolicLink() || opened.nlink !== 1n ||
        String(opened.dev) !== before.device || String(opened.ino) !== before.inode) {
      throw new TypeError("Integration control file identity changed");
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (BigInt(bytes.byteLength) !== beforeStats.size || !after.isFile() || after.isSymbolicLink() || after.nlink !== 1n ||
        String(after.dev) !== before.device || String(after.ino) !== before.inode || !fileIdentityCurrent(before)) {
      throw new TypeError("Integration control file changed during read");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return Object.freeze({ ...before, sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(), text });
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function stableFileCurrent(expected: StableFileIdentity, maximumBytes: number): boolean {
  try {
    const current = stableFile(expected.realPath, maximumBytes);
    return identityEqual(current, expected) && current.sha256 === expected.sha256;
  } catch {
    return false;
  }
}

function withinOrEqual(root: string, child: string): boolean {
  return normalizedPath(root) === normalizedPath(child) || containedBy(root, child);
}

function gitOutputLine(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  repositoryPath: string,
  arguments_: readonly string[],
): string | null {
  const result = runGit(gitExecutable, environment, repositoryPath, arguments_);
  return result.status === 0 && !result.error ? singleLine(result.stdout) : null;
}

function repositoryTopology(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  trustedRoot: FileIdentity,
  repositoryPath: string,
  requireBare: boolean,
): RepositoryTopology {
  const repositoryIdentity = directDirectoryIdentity(repositoryPath);
  if (!containedBy(trustedRoot.realPath, repositoryIdentity.realPath)) {
    throw new TypeError("Integration repository escapes the disposable root");
  }
  let controlFile: StableFileIdentity | null = null;
  let controlDirectory: FileIdentity | null = null;
  if (requireBare) {
    controlDirectory = repositoryIdentity;
  } else {
    const controlPath = path.join(repositoryIdentity.realPath, ".git");
    const controlStats = lstatSync(controlPath);
    if (controlStats.isFile() && !controlStats.isSymbolicLink()) {
      controlFile = stableFile(controlPath, 4096);
      const pointer = controlFile.text.replaceAll("\r\n", "\n");
      if (!pointer.startsWith("gitdir: ") || !pointer.endsWith("\n") || pointer.slice(0, -1).includes("\n")) {
        throw new TypeError("Integration gitdir pointer is invalid");
      }
      const pointed = directDirectoryIdentity(path.resolve(repositoryIdentity.realPath, pointer.slice(8, -1)));
      if (!containedBy(trustedRoot.realPath, pointed.realPath)) {
        throw new TypeError("Integration gitdir pointer escapes the disposable root");
      }
    } else {
      controlDirectory = directDirectoryIdentity(controlPath);
      if (!containedBy(trustedRoot.realPath, controlDirectory.realPath)) {
        throw new TypeError("Integration Git directory escapes the disposable root");
      }
    }
  }
  const gitDirectoryPath = gitOutputLine(gitExecutable, environment, repositoryIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-dir"]);
  const commonDirectoryPath = gitOutputLine(gitExecutable, environment, repositoryIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const objectDirectoryPath = gitOutputLine(gitExecutable, environment, repositoryIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--git-path", "objects"]);
  const bareValue = gitOutputLine(gitExecutable, environment, repositoryIdentity.realPath,
    ["rev-parse", "--is-bare-repository"]);
  const worktreePath = requireBare ? null : gitOutputLine(gitExecutable, environment, repositoryIdentity.realPath,
    ["rev-parse", "--path-format=absolute", "--show-toplevel"]);
  if (gitDirectoryPath === null || commonDirectoryPath === null || objectDirectoryPath === null ||
      bareValue !== (requireBare ? "true" : "false") || (!requireBare && worktreePath === null)) {
    throw new TypeError("Integration Git topology is unavailable");
  }
  const gitDirectory = directDirectoryIdentity(gitDirectoryPath);
  const commonDirectory = directDirectoryIdentity(commonDirectoryPath);
  const objectDirectory = directDirectoryIdentity(objectDirectoryPath);
  const worktreeDirectory = worktreePath === null ? null : directDirectoryIdentity(worktreePath);
  if (!withinOrEqual(trustedRoot.realPath, gitDirectory.realPath) ||
      !withinOrEqual(trustedRoot.realPath, commonDirectory.realPath) ||
      !withinOrEqual(trustedRoot.realPath, objectDirectory.realPath) ||
      (worktreeDirectory !== null && !withinOrEqual(trustedRoot.realPath, worktreeDirectory.realPath)) ||
      (worktreeDirectory !== null && normalizedPath(worktreeDirectory.realPath) !== normalizedPath(repositoryIdentity.realPath)) ||
      (controlDirectory !== null && normalizedPath(controlDirectory.realPath) !== normalizedPath(gitDirectory.realPath))) {
    throw new TypeError("Integration Git topology escapes or aliases the disposable root");
  }
  if (controlFile !== null) {
    const pointer = controlFile.text.replaceAll("\r\n", "\n");
    if (normalizedPath(path.resolve(repositoryIdentity.realPath, pointer.slice(8, -1))) !== normalizedPath(gitDirectory.realPath)) {
      throw new TypeError("Integration gitdir pointer disagrees with Git");
    }
  }
  return Object.freeze({ repositoryIdentity, bare: requireBare, controlFile, controlDirectory,
    gitDirectory, commonDirectory, objectDirectory, worktreeDirectory });
}

function workspaceIdentityProjection(identity: FileIdentity): Readonly<Record<string, unknown>> {
  return Object.freeze({ realPath: identity.realPath, dev: identity.device, ino: identity.inode, mode: identity.mode });
}

function expectedRepositoryIdentity(project: RepositoryTopology, workspace: RepositoryTopology): string | null {
  if (!identityEqual(project.commonDirectory, workspace.commonDirectory) ||
      !identityEqual(project.objectDirectory, workspace.objectDirectory)) return null;
  const projection = {
    common: workspaceIdentityProjection(project.commonDirectory),
    object: workspaceIdentityProjection(project.objectDirectory),
    objectFormat: "sha1",
    project: workspaceIdentityProjection(project.repositoryIdentity),
  };
  // ato.workspace/v2 owns this identity and hashes its canonical JSON with the
  // terminating newline used by the ownership manifest protocol.
  return `sha256:${createHash("sha256").update(`${canonicalJson(projection)}\n`, "utf8").digest("hex").toUpperCase()}`;
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

function gitReference(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 255 || value !== value.normalize("NFC") ||
      !value.startsWith("refs/heads/") || value.endsWith("/") || value.endsWith(".") ||
      value.includes("..") || value.includes("@{") || /[\u0000-\u0020\u007f~^:?*[\\]/u.test(value)) return false;
  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".." && !part.endsWith(".lock"));
}

function copyBinding(
  value: LocalGitIntegrationBinding,
  trustedRoot: FileIdentity,
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
): TrustedBinding {
  if (!identifier(value.projectRootKey) || !identifier(value.repositoryIdentity) || !identifier(value.sourceWorkspaceId) ||
      !Number.isSafeInteger(value.sourceGeneration) || value.sourceGeneration < 1 ||
      !Number.isSafeInteger(value.sourceWorkspaceRevision) || value.sourceWorkspaceRevision < 1 ||
      !identifier(value.sourceWorkspaceRootKey) || !/^[0-9A-F]{64}$/u.test(value.sourceOwnershipBindingSha256) ||
      !/^[0-9a-f]{40}$/u.test(value.sourceHeadObjectId) || !identifier(value.destinationIdentity)) {
    throw new TypeError("Integration binding identity is invalid");
  }
  const projectIdentity = directDirectoryIdentity(value.projectPath);
  const workspaceIdentity = directDirectoryIdentity(value.sourceWorkspacePath);
  const destinationPhysicalIdentity = directDirectoryIdentity(value.destinationPath);
  if (!containedBy(trustedRoot.realPath, projectIdentity.realPath) || !containedBy(trustedRoot.realPath, workspaceIdentity.realPath) ||
      !containedBy(trustedRoot.realPath, destinationPhysicalIdentity.realPath) ||
      pathsOverlap(projectIdentity.realPath, workspaceIdentity.realPath) ||
      normalizedPath(projectIdentity.realPath) === normalizedPath(destinationPhysicalIdentity.realPath) ||
      normalizedPath(workspaceIdentity.realPath) === normalizedPath(destinationPhysicalIdentity.realPath)) {
    throw new TypeError("Integration binding escapes or aliases the disposable root");
  }
  const projectTopology = repositoryTopology(gitExecutable, environment, trustedRoot, projectIdentity.realPath, false);
  const workspaceTopology = repositoryTopology(gitExecutable, environment, trustedRoot, workspaceIdentity.realPath, false);
  const destinationTopology = repositoryTopology(gitExecutable, environment, trustedRoot, destinationPhysicalIdentity.realPath, true);
  const computedRepositoryIdentity = expectedRepositoryIdentity(projectTopology, workspaceTopology);
  if (computedRepositoryIdentity !== value.repositoryIdentity ||
      identityEqual(destinationTopology.commonDirectory, projectTopology.commonDirectory) ||
      identityEqual(destinationTopology.objectDirectory, projectTopology.objectDirectory)) {
    throw new TypeError("Integration repository identity or topology is invalid");
  }
  if (!repositoryConfigIsSafe(gitExecutable, environment, projectIdentity.realPath, false) ||
      !repositoryConfigIsSafe(gitExecutable, environment, destinationPhysicalIdentity.realPath, true) ||
      !repositorySentinelsAreSafe(projectTopology) || !repositorySentinelsAreSafe(workspaceTopology) ||
      !repositorySentinelsAreSafe(destinationTopology)) {
    throw new TypeError("Integration repository configuration is unsafe");
  }
  const manifestPath = path.join(workspaceTopology.gitDirectory.realPath, "ato-workspace-ownership-v1.json");
  const ownershipManifest = stableFile(manifestPath, 16 * 1024);
  const manifestValue = JSON.parse(ownershipManifest.text) as unknown;
  if (typeof manifestValue !== "object" || manifestValue === null || Array.isArray(manifestValue)) {
    throw new TypeError("Integration ownership manifest is invalid");
  }
  const manifest = manifestValue as Readonly<Record<string, unknown>>;
  if (manifest.schema !== "ato.workspace-ownership/v1" || manifest.repositoryIdentity !== value.repositoryIdentity ||
      manifest.generation !== value.sourceGeneration || manifest.ownershipBindingSha256 !== value.sourceOwnershipBindingSha256) {
    throw new TypeError("Integration ownership manifest binding is invalid");
  }
  const sourceHeadFile = stableFile(path.join(workspaceTopology.gitDirectory.realPath, "HEAD"), 256);
  const sourceLockedFile = stableFile(path.join(workspaceTopology.gitDirectory.realPath, "locked"), 4096);
  if (sourceHeadFile.text.replaceAll("\r\n", "\n") !== `${value.sourceHeadObjectId}\n` ||
      sourceLockedFile.text.replaceAll("\r\n", "\n") !== "ato.workspace/v2 ownership\n" ||
      !linkedWorktreeRegistrationIsCurrent(gitExecutable, environment, projectIdentity.realPath,
        workspaceIdentity.realPath, value.sourceHeadObjectId)) {
    throw new TypeError("Integration source registration is invalid");
  }
  const sourceHead = gitOutputLine(gitExecutable, environment, workspaceIdentity.realPath,
    ["rev-parse", "--verify", "HEAD^{commit}"]);
  if (sourceHead !== value.sourceHeadObjectId || !sourceIsClean(gitExecutable, environment, workspaceIdentity.realPath)) {
    throw new TypeError("Integration source HEAD or inventory is not current");
  }
  return Object.freeze({
    ...value,
    projectPath: projectIdentity.realPath,
    sourceWorkspacePath: workspaceIdentity.realPath,
    destinationPath: destinationPhysicalIdentity.realPath,
    projectIdentity,
    workspaceIdentity,
    destinationPhysicalIdentity,
    projectTopology,
    workspaceTopology,
    destinationTopology,
    ownershipManifest,
    sourceHeadFile,
    sourceLockedFile,
  });
}

function topologyIdentityEqual(left: RepositoryTopology, right: RepositoryTopology): boolean {
  return left.bare === right.bare && identityEqual(left.repositoryIdentity, right.repositoryIdentity) &&
    identityEqual(left.gitDirectory, right.gitDirectory) && identityEqual(left.commonDirectory, right.commonDirectory) &&
    identityEqual(left.objectDirectory, right.objectDirectory) &&
    (left.worktreeDirectory === null ? right.worktreeDirectory === null
      : right.worktreeDirectory !== null && identityEqual(left.worktreeDirectory, right.worktreeDirectory)) &&
    (left.controlDirectory === null ? right.controlDirectory === null
      : right.controlDirectory !== null && identityEqual(left.controlDirectory, right.controlDirectory)) &&
    (left.controlFile === null ? right.controlFile === null
      : right.controlFile !== null && identityEqual(left.controlFile, right.controlFile) &&
        left.controlFile.sha256 === right.controlFile.sha256);
}

function repositoryTopologyCurrent(
  expected: RepositoryTopology,
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  trustedRoot: FileIdentity,
): boolean {
  try {
    if (!directoryIdentityCurrent(expected.repositoryIdentity) || !directoryIdentityCurrent(expected.gitDirectory) ||
        !directoryIdentityCurrent(expected.commonDirectory) || !directoryIdentityCurrent(expected.objectDirectory) ||
        (expected.worktreeDirectory !== null && !directoryIdentityCurrent(expected.worktreeDirectory)) ||
        (expected.controlDirectory !== null && !directoryIdentityCurrent(expected.controlDirectory)) ||
        (expected.controlFile !== null && !stableFileCurrent(expected.controlFile, 4096))) return false;
    const current = repositoryTopology(
      gitExecutable, environment, trustedRoot, expected.repositoryIdentity.realPath, expected.bare,
    );
    return topologyIdentityEqual(current, expected);
  } catch {
    return false;
  }
}

function bindingTopologyCurrent(
  binding: TrustedBinding,
  gitExecutable: string,
  gitExecutableIdentity: FileIdentity,
  environment: Readonly<Record<string, string>>,
  trustedRoot: FileIdentity,
): boolean {
  if (!fileIdentityCurrent(gitExecutableIdentity) || !directoryIdentityCurrent(trustedRoot) ||
      !directoryIdentityCurrent(binding.projectIdentity) || !directoryIdentityCurrent(binding.workspaceIdentity) ||
      !directoryIdentityCurrent(binding.destinationPhysicalIdentity) ||
      !stableFileCurrent(binding.ownershipManifest, 16 * 1024) ||
      !stableFileCurrent(binding.sourceHeadFile, 256) ||
      binding.sourceHeadFile.text.replaceAll("\r\n", "\n") !== `${binding.sourceHeadObjectId}\n` ||
      !stableFileCurrent(binding.sourceLockedFile, 4096) ||
      binding.sourceLockedFile.text.replaceAll("\r\n", "\n") !== "ato.workspace/v2 ownership\n" ||
      !repositoryTopologyCurrent(binding.projectTopology, gitExecutable, environment, trustedRoot) ||
      !repositoryTopologyCurrent(binding.workspaceTopology, gitExecutable, environment, trustedRoot) ||
      !repositoryTopologyCurrent(binding.destinationTopology, gitExecutable, environment, trustedRoot) ||
      expectedRepositoryIdentity(binding.projectTopology, binding.workspaceTopology) !== binding.repositoryIdentity) return false;
  const sourceHead = gitOutputLine(gitExecutable, environment, binding.sourceWorkspacePath,
    ["rev-parse", "--verify", "HEAD^{commit}"]);
  return sourceHead === binding.sourceHeadObjectId && sourceIsClean(gitExecutable, environment, binding.sourceWorkspacePath) &&
    linkedWorktreeRegistrationIsCurrent(gitExecutable, environment, binding.projectPath,
      binding.sourceWorkspacePath, binding.sourceHeadObjectId) &&
    stableFileCurrent(binding.ownershipManifest, 16 * 1024) &&
    stableFileCurrent(binding.sourceHeadFile, 256) && stableFileCurrent(binding.sourceLockedFile, 4096) &&
    directoryIdentityCurrent(binding.workspaceTopology.gitDirectory) &&
    directoryIdentityCurrent(binding.workspaceTopology.commonDirectory) &&
    directoryIdentityCurrent(binding.workspaceTopology.objectDirectory);
}

function safeEnvironment(gitExecutable: string): Readonly<Record<string, string>> {
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
  args: readonly string[],
): Readonly<{ status: number | null; stdout: string; stderr: string; error: boolean }> {
  const result = spawnSync(gitExecutable, args, {
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
    stderr: typeof result.stderr === "string" ? result.stderr : new TextDecoder().decode(result.stderr),
    error: result.error !== undefined,
  });
}

function singleLine(value: string): string | null {
  const normalized = value.replaceAll("\r\n", "\n");
  if (!normalized.endsWith("\n") || normalized.slice(0, -1).includes("\n")) return null;
  return normalized.slice(0, -1);
}

function readRef(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  repositoryPath: string,
  reference: string,
): RefObservation {
  const result = runGit(gitExecutable, environment, repositoryPath, ["rev-parse", "--verify", "--quiet", `${reference}^{commit}`]);
  if (result.status === 0 && !result.error) {
    const objectId = singleLine(result.stdout);
    return Object.freeze({ authoritative: objectId !== null && /^[0-9a-f]{40}$/u.test(objectId), objectId: objectId !== null && /^[0-9a-f]{40}$/u.test(objectId) ? objectId : null });
  }
  if (result.status === 1 && !result.error && result.stdout.length === 0) return Object.freeze({ authoritative: true, objectId: null });
  return Object.freeze({ authoritative: false, objectId: null });
}

function repositoryConfigIsSafe(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  repositoryPath: string,
  requireBare: boolean,
): boolean {
  const format = runGit(gitExecutable, environment, repositoryPath, ["rev-parse", "--show-object-format"]);
  if (format.status !== 0 || singleLine(format.stdout) !== "sha1") return false;
  const bare = runGit(gitExecutable, environment, repositoryPath, ["rev-parse", "--is-bare-repository"]);
  if (bare.status !== 0 || singleLine(bare.stdout) !== (requireBare ? "true" : "false")) return false;
  const config = runGit(gitExecutable, environment, repositoryPath, ["config", "--local", "--name-only", "--list"]);
  if (config.status !== 0 || config.error) return false;
  const unsafe = config.stdout.replaceAll("\r\n", "\n").split("\n").filter(Boolean).some((key) => {
    const lower = key.toLowerCase();
    return lower === "core.hookspath" || lower.startsWith("credential.") || lower === "credential.helper" ||
      lower.startsWith("http.") || lower.startsWith("https.") || lower.startsWith("url.") || lower.startsWith("remote.") ||
      lower.startsWith("filter.") || lower.startsWith("submodule.") || lower.includes("promisor") ||
      lower.includes("partialclone") || lower.startsWith("include.") || lower.startsWith("protocol.") ||
      lower === "core.sparsecheckout" || lower === "core.sparsecheckoutcone" || lower === "core.fsmonitor" ||
      lower === "core.worktree" || lower === "core.gitproxy" || lower === "core.sshcommand" ||
      lower === "remote.pushdefault" || lower === "push.default" || lower === "receivepack" || lower === "uploadpack";
  });
  return !unsafe;
}

function repositorySentinelsAreSafe(topology: RepositoryTopology): boolean {
  try {
    const hookDirectories = new Set([
      path.join(topology.gitDirectory.realPath, "hooks"),
      path.join(topology.commonDirectory.realPath, "hooks"),
    ]);
    if ([...hookDirectories].some((hooks) => existsSync(hooks) &&
        readdirSync(hooks).some((name) => !name.endsWith(".sample")))) return false;
    return !existsSync(path.join(topology.objectDirectory.realPath, "info", "alternates")) &&
      !existsSync(path.join(topology.commonDirectory.realPath, "info", "grafts")) &&
      !existsSync(path.join(topology.commonDirectory.realPath, "shallow")) &&
      (topology.worktreeDirectory === null ||
        !existsSync(path.join(topology.worktreeDirectory.realPath, ".gitmodules")));
  } catch {
    return false;
  }
}

function sourceIsClean(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  workspacePath: string,
): boolean {
  const result = runGit(gitExecutable, environment, workspacePath,
    ["-c", "core.fsmonitor=false", "status", "--porcelain=v2", "--untracked-files=all", "--ignored=matching", "--ignore-submodules=all"]);
  return result.status === 0 && !result.error && result.stdout.length === 0;
}

function targetIsCheckedOut(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  projectPath: string,
  targetReference: string,
): boolean | null {
  const result = runGit(gitExecutable, environment, projectPath, ["worktree", "list", "--porcelain"]);
  if (result.status !== 0 || result.error) return null;
  const lines = result.stdout.replaceAll("\r\n", "\n").split("\n");
  return lines.some((line) => line === `branch ${targetReference}`);
}

function ancestorIsValid(
  gitExecutable: string,
  environment: Readonly<Record<string, string>>,
  repositoryPath: string,
  expected: string,
  source: string,
): boolean | null {
  const result = runGit(gitExecutable, environment, repositoryPath, ["merge-base", "--is-ancestor", expected, source]);
  if (result.status === 0 && !result.error) return true;
  if (result.status === 1 && !result.error) return false;
  return null;
}

function failure(
  category: "invalid_request" | "incompatible_contract" | "not_found" | "conflict" | "integrity_failure",
  code: string,
): IntegrationBackendResult {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ category, code, retryable: false, ambiguous: category === "integrity_failure", retryAfter: null, evidenceReference: null }),
  });
}

function inspectClassification(request: IntegrationBackendRequest, local: RefObservation, remote: RefObservation): ReceiptState {
  const localAfter = local.objectId;
  const remoteAfter = remote.objectId;
  const localState: IntegrationLocalState = !local.authoritative ? "unknown"
    : localAfter === request.subject.sourceHeadObjectId ? "already_at_source"
      : localAfter === request.subject.expectedTargetObjectId ? "unchanged"
        : localAfter === null ? "unknown" : "foreign";
  const remoteState: IntegrationRemoteState = !remote.authoritative ? "unknown"
    : remoteAfter === request.subject.sourceHeadObjectId ? "already_at_source"
      : remoteAfter === null && request.subject.expectedRemoteHead === null ? "absent"
        : remoteAfter !== null && remoteAfter === request.subject.expectedRemoteHead ? "unchanged"
          : remoteAfter === null ? "unknown" : "foreign";
  if (localState === "unknown" || remoteState === "unknown") {
    return Object.freeze({ localBeforeObjectId: null, localAfterObjectId: localAfter, remoteBeforeObjectId: null,
      remoteAfterObjectId: remoteAfter, localState, remoteState, outcome: "ambiguous", code: "inspected_ambiguous" });
  }
  if (localState === "unchanged" && (remoteState === "absent" || remoteState === "unchanged")) {
    return Object.freeze({ localBeforeObjectId: null, localAfterObjectId: localAfter, remoteBeforeObjectId: null,
      remoteAfterObjectId: remoteAfter, localState, remoteState, outcome: "succeeded", code: "inspected_unchanged" });
  }
  if (localState === "already_at_source" && (remoteState === "absent" || remoteState === "unchanged")) {
    return Object.freeze({ localBeforeObjectId: null, localAfterObjectId: localAfter, remoteBeforeObjectId: null,
      remoteAfterObjectId: remoteAfter, localState, remoteState, outcome: "succeeded", code: "inspected_local_applied" });
  }
  if (localState === "already_at_source" && remoteState === "already_at_source") {
    return Object.freeze({ localBeforeObjectId: null, localAfterObjectId: localAfter, remoteBeforeObjectId: null,
      remoteAfterObjectId: remoteAfter, localState, remoteState, outcome: "succeeded", code: "inspected_pushed" });
  }
  return Object.freeze({ localBeforeObjectId: null, localAfterObjectId: localAfter, remoteBeforeObjectId: null,
    remoteAfterObjectId: remoteAfter, localState, remoteState, outcome: "refused", code: "inspected_foreign" });
}

function receipt(request: IntegrationBackendRequest, state: ReceiptState, observedAt: string): IntegrationBackendResult {
  const observationNumber = request.operation === "inspect" ? request.lastObservationNumber + 1 : request.expectedObservationNumber + 1;
  const digest = sha256({ operation: request.operation, subject: request.subject, state, observationNumber, observedAt });
  const common = {
    contractId: INTEGRATION_CONTRACT_ID,
    receiptId: `integration-receipt:${digest}`,
    operation: request.operation,
    correlationId: request.correlationId,
    causationId: request.causationId,
    actorId: request.actorId,
    adapterId: LOCAL_GIT_INTEGRATION_ADAPTER_ID,
    adapterVersion: LOCAL_GIT_INTEGRATION_ADAPTER_VERSION,
    subject: request.subject,
    observationNumber,
    ...state,
    evidenceReference: `integration-evidence:${digest}`,
    observedAt,
  } as const;
  const candidate = request.operation === "inspect"
    ? Object.freeze({ ok: true as const, receipt: Object.freeze({
        ...common, operation: "inspect" as const, queryId: request.queryId,
        readAuthorizationDecisionId: request.readAuthorizationDecisionId,
      }) })
    : Object.freeze({ ok: true as const, receipt: Object.freeze({
        ...common, operation: request.operation, operationId: request.operationId, intentId: request.intentId,
        idempotencyKey: request.idempotencyKey, finalAuthorizationDecisionId: request.finalAuthorizationDecisionId,
        expectedObservationNumber: request.expectedObservationNumber,
      }) });
  return parseIntegrationBackendResult(candidate, request) ?? failure("integrity_failure", "integration_receipt_invalid");
}

export function createLocalGitIntegrationBackend(
  configuration: LocalGitIntegrationConfiguration,
  ingress: LocalGitIntegrationIngress = Object.freeze({ now: () => new Date().toISOString() }),
): LocalGitIntegrationBackend {
  if (typeof configuration !== "object" || configuration === null || typeof ingress.now !== "function" ||
      (ingress.beforeEffect !== undefined && typeof ingress.beforeEffect !== "function") ||
      !Array.isArray(configuration.bindings) || configuration.bindings.length === 0 || configuration.bindings.length > 32) {
    throw new TypeError("Local Git integration configuration is invalid");
  }
  const gitExecutableIdentity = directFileIdentity(configuration.gitExecutable);
  const gitExecutable = gitExecutableIdentity.realPath;
  const trustedRoot = directDirectoryIdentity(configuration.trustedDisposableRoot);
  const environment = safeEnvironment(gitExecutable);
  const bindings = Object.freeze(configuration.bindings.map((binding) =>
    copyBinding(binding, trustedRoot, gitExecutable, environment)));
  if (new Set(bindings.map((binding) => `${binding.repositoryIdentity}\u0000${binding.sourceWorkspaceId}\u0000${binding.destinationIdentity}`)).size !== bindings.length) {
    throw new TypeError("Local Git integration binding identity is duplicated");
  }
  const resolve = (request: IntegrationBackendRequest): TrustedBinding | IntegrationBackendResult => {
    const binding = bindings.find((candidate) => candidate.projectRootKey === request.subject.projectRootKey &&
      candidate.repositoryIdentity === request.subject.repositoryIdentity &&
      candidate.sourceWorkspaceId === request.subject.sourceWorkspaceId &&
      candidate.sourceGeneration === request.subject.sourceGeneration &&
      candidate.sourceWorkspaceRevision === request.subject.sourceWorkspaceRevision &&
      candidate.sourceWorkspaceRootKey === request.subject.sourceWorkspaceRootKey &&
      candidate.sourceOwnershipBindingSha256 === request.subject.sourceOwnershipBindingSha256 &&
      candidate.sourceHeadObjectId === request.subject.sourceHeadObjectId &&
      candidate.destinationIdentity === request.subject.destinationIdentity);
    if (binding === undefined) return failure("not_found", "integration_binding_absent");
    if (!bindingTopologyCurrent(binding, gitExecutable, gitExecutableIdentity, environment, trustedRoot) ||
        !gitReference(request.subject.targetReference) ||
        !gitReference(request.subject.destinationReference)) return failure("integrity_failure", "integration_binding_drift");
    return binding;
  };

  const preflightSafe = (binding: TrustedBinding): boolean =>
    bindingTopologyCurrent(binding, gitExecutable, gitExecutableIdentity, environment, trustedRoot) &&
    repositoryConfigIsSafe(gitExecutable, environment, binding.projectPath, false) &&
    repositoryConfigIsSafe(gitExecutable, environment, binding.destinationPath, true) &&
    repositorySentinelsAreSafe(binding.projectTopology) && repositorySentinelsAreSafe(binding.workspaceTopology) &&
    repositorySentinelsAreSafe(binding.destinationTopology) && sourceIsClean(gitExecutable, environment, binding.sourceWorkspacePath);

  const inspect = (value: InspectIntegrationRequest): IntegrationBackendResult => {
    const request = parseIntegrationBackendRequest(value);
    if (request === null || request.operation !== "inspect") return failure("invalid_request", "integration_request_invalid");
    if (request.adapterId !== LOCAL_GIT_INTEGRATION_ADAPTER_ID || request.adapterVersion !== LOCAL_GIT_INTEGRATION_ADAPTER_VERSION) {
      return failure("incompatible_contract", "integration_adapter_mismatch");
    }
    const binding = resolve(request);
    if ("ok" in binding) return binding;
    const now = ingress.now();
    if (!timestamp(now)) return failure("integrity_failure", "integration_clock_invalid");
    const local = readRef(gitExecutable, environment, binding.projectPath, request.subject.targetReference);
    const remote = readRef(gitExecutable, environment, binding.destinationPath, request.subject.destinationReference);
    return receipt(request, inspectClassification(request, local, remote), now);
  };

  const apply = (value: ApplyIntegrationRequest): IntegrationBackendResult => {
    const request = parseIntegrationBackendRequest(value);
    if (request === null || request.operation !== "apply") return failure("invalid_request", "integration_request_invalid");
    if (request.adapterId !== LOCAL_GIT_INTEGRATION_ADAPTER_ID || request.adapterVersion !== LOCAL_GIT_INTEGRATION_ADAPTER_VERSION) {
      return failure("incompatible_contract", "integration_adapter_mismatch");
    }
    const binding = resolve(request);
    if ("ok" in binding) return binding;
    const now = ingress.now();
    if (!timestamp(now)) return failure("integrity_failure", "integration_clock_invalid");
    const before = readRef(gitExecutable, environment, binding.projectPath, request.subject.targetReference);
    const remoteBase = { remoteBeforeObjectId: null, remoteAfterObjectId: null, remoteState: "not_requested" as const };
    if (!before.authoritative || before.objectId === null) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: null,
        ...remoteBase, localState: "unknown", outcome: "ambiguous", code: "apply_ambiguous" }), now);
    }
    if (before.objectId === request.subject.sourceHeadObjectId) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: before.objectId,
        ...remoteBase, localState: "already_at_source", outcome: "succeeded", code: "already_applied" }), now);
    }
    if (before.objectId !== request.subject.expectedTargetObjectId) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: before.objectId,
        ...remoteBase, localState: "foreign", outcome: "refused", code: "apply_refused" }), now);
    }
    const checkedOut = targetIsCheckedOut(gitExecutable, environment, binding.projectPath, request.subject.targetReference);
    const ancestry = ancestorIsValid(gitExecutable, environment, binding.projectPath,
      request.subject.expectedTargetObjectId, request.subject.sourceHeadObjectId);
    if (!preflightSafe(binding) || checkedOut !== false || ancestry !== true) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: before.objectId,
        ...remoteBase, localState: "unchanged", outcome: "refused", code: "apply_refused" }), now);
    }
    try { ingress.beforeEffect?.("apply"); } catch {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: before.objectId,
        ...remoteBase, localState: "unchanged", outcome: "refused", code: "apply_refused" }), now);
    }
    const checkedOutAtEffect = targetIsCheckedOut(
      gitExecutable, environment, binding.projectPath, request.subject.targetReference,
    );
    const ancestryAtEffect = ancestorIsValid(
      gitExecutable, environment, binding.projectPath,
      request.subject.expectedTargetObjectId, request.subject.sourceHeadObjectId,
    );
    if (!preflightSafe(binding) || checkedOutAtEffect !== false || ancestryAtEffect !== true) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: before.objectId,
        ...remoteBase, localState: "unchanged", outcome: "refused", code: "apply_refused" }), now);
    }
    runGit(gitExecutable, environment, binding.projectPath, ["update-ref", request.subject.targetReference,
      request.subject.sourceHeadObjectId, request.subject.expectedTargetObjectId]);
    const after = readRef(gitExecutable, environment, binding.projectPath, request.subject.targetReference);
    if (after.authoritative && after.objectId === request.subject.sourceHeadObjectId) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: after.objectId,
        ...remoteBase, localState: "fast_forwarded", outcome: "succeeded", code: "applied" }), now);
    }
    if (after.authoritative && after.objectId === request.subject.expectedTargetObjectId) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: after.objectId,
        ...remoteBase, localState: "unchanged", outcome: "refused", code: "apply_refused" }), now);
    }
    if (after.authoritative && after.objectId !== null) {
      return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: after.objectId,
        ...remoteBase, localState: "foreign", outcome: "refused", code: "apply_refused" }), now);
    }
    return receipt(request, Object.freeze({ localBeforeObjectId: before.objectId, localAfterObjectId: null,
      ...remoteBase, localState: "unknown", outcome: "ambiguous", code: "apply_ambiguous" }), now);
  };

  const push = (value: PushIntegrationRequest): IntegrationBackendResult => {
    const request = parseIntegrationBackendRequest(value);
    if (request === null || request.operation !== "push") return failure("invalid_request", "integration_request_invalid");
    if (request.adapterId !== LOCAL_GIT_INTEGRATION_ADAPTER_ID || request.adapterVersion !== LOCAL_GIT_INTEGRATION_ADAPTER_VERSION) {
      return failure("incompatible_contract", "integration_adapter_mismatch");
    }
    const binding = resolve(request);
    if ("ok" in binding) return binding;
    const now = ingress.now();
    if (!timestamp(now)) return failure("integrity_failure", "integration_clock_invalid");
    const local = readRef(gitExecutable, environment, binding.projectPath, request.subject.targetReference);
    if (!local.authoritative || local.objectId !== request.subject.sourceHeadObjectId) {
      return failure("conflict", "integration_local_source_not_applied");
    }
    const remoteBefore = readRef(gitExecutable, environment, binding.destinationPath, request.subject.destinationReference);
    const localBase = { localBeforeObjectId: request.subject.sourceHeadObjectId,
      localAfterObjectId: request.subject.sourceHeadObjectId, localState: "already_at_source" as const };
    if (remoteBefore.authoritative && remoteBefore.objectId === request.subject.sourceHeadObjectId) {
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteBefore.objectId, remoteState: "already_at_source", outcome: "succeeded", code: "already_pushed" }), now);
    }
    if (!remoteBefore.authoritative ||
        (remoteBefore.objectId === null && request.subject.expectedRemoteHead !== null)) {
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: null, remoteState: "unknown", outcome: "ambiguous", code: "push_ambiguous" }), now);
    }
    if (remoteBefore.objectId !== request.subject.expectedRemoteHead) {
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteBefore.objectId, remoteState: "foreign", outcome: "refused", code: "push_rejected" }), now);
    }
    if (!preflightSafe(binding)) {
      const state: IntegrationRemoteState = remoteBefore.objectId === null ? "absent" : "unchanged";
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteBefore.objectId, remoteState: state, outcome: "refused", code: "push_rejected" }), now);
    }
    try { ingress.beforeEffect?.("push"); } catch {
      const state: IntegrationRemoteState = remoteBefore.objectId === null ? "absent" : "unchanged";
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteBefore.objectId, remoteState: state, outcome: "refused", code: "push_rejected" }), now);
    }
    if (!preflightSafe(binding)) {
      const state: IntegrationRemoteState = remoteBefore.objectId === null ? "absent" : "unchanged";
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteBefore.objectId, remoteState: state, outcome: "refused", code: "push_rejected" }), now);
    }
    const pushed = runGit(gitExecutable, environment, binding.projectPath, ["-c", "protocol.file.allow=always",
      "push", "--porcelain", "--no-verify", binding.destinationPath,
      `${request.subject.sourceHeadObjectId}:${request.subject.destinationReference}`]);
    const remoteAfter = readRef(gitExecutable, environment, binding.destinationPath, request.subject.destinationReference);
    if (remoteAfter.authoritative && remoteAfter.objectId === request.subject.sourceHeadObjectId) {
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteAfter.objectId, remoteState: "pushed", outcome: "succeeded", code: "pushed" }), now);
    }
    if (remoteAfter.authoritative && remoteAfter.objectId === request.subject.expectedRemoteHead) {
      const state: IntegrationRemoteState = remoteAfter.objectId === null ? "absent" : pushed.status === 0 ? "unchanged" : "rejected";
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteAfter.objectId, remoteState: state, outcome: "refused", code: "push_rejected" }), now);
    }
    if (remoteAfter.authoritative && remoteAfter.objectId !== null) {
      return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
        remoteAfterObjectId: remoteAfter.objectId, remoteState: "foreign", outcome: "refused", code: "push_rejected" }), now);
    }
    return receipt(request, Object.freeze({ ...localBase, remoteBeforeObjectId: remoteBefore.objectId,
      remoteAfterObjectId: null, remoteState: "unknown", outcome: "ambiguous", code: "push_ambiguous" }), now);
  };

  return Object.freeze({
    description: Object.freeze({
      contractId: INTEGRATION_CONTRACT_ID,
      adapterId: LOCAL_GIT_INTEGRATION_ADAPTER_ID,
      adapterVersion: LOCAL_GIT_INTEGRATION_ADAPTER_VERSION,
      bindingCount: bindings.length,
    }),
    inspect,
    apply,
    push,
  });
}
