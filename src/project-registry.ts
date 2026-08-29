import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export const PROJECT_REGISTRY_ERROR_CODES = Object.freeze([
  "INVALID_PROJECT_ROOT",
  "PROJECT_ROOT_MISSING",
  "PROJECT_ROOT_REPARSE",
  "PROJECT_IDENTITY_UNCERTAIN",
  "PROJECT_RUNTIME_OVERLAP",
  "PROJECT_IDENTITY_CHANGED",
] as const);

export type ProjectRegistryErrorCode = (typeof PROJECT_REGISTRY_ERROR_CODES)[number];

export class ProjectRegistryError extends Error {
  readonly code: ProjectRegistryErrorCode;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;

  constructor(
    code: ProjectRegistryErrorCode,
    message: string,
    details: Readonly<Record<string, string | number | boolean | null>> = {},
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ProjectRegistryError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export interface ProjectRootIdentity {
  readonly canonicalRoot: string;
  readonly rootKey: string;
  readonly platform: string;
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
}

function registryFailure(
  code: ProjectRegistryErrorCode,
  message: string,
  details: Readonly<Record<string, string | number | boolean | null>> = {},
  cause?: unknown,
): ProjectRegistryError {
  return new ProjectRegistryError(code, message, details, cause);
}

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function overlaps(left: string, right: string): boolean {
  const first = comparablePath(left);
  const second = comparablePath(right);
  return first === second || first.startsWith(`${second}${path.sep}`) || second.startsWith(`${first}${path.sep}`);
}

function rejectLexicalRoot(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.indexOf("\0") !== -1 || !path.isAbsolute(value)) {
    throw registryFailure("INVALID_PROJECT_ROOT", "Project root must be a nonempty absolute local path");
  }
  if (process.platform === "win32" && (/^\\\\/u.test(value) || !/^[A-Za-z]:[\\/]/u.test(value))) {
    throw registryFailure("INVALID_PROJECT_ROOT", "Project root must be drive-qualified and local");
  }
  const parsed = path.parse(value);
  const segments = value
    .slice(parsed.root.length)
    .split(/[\\/]+/u)
    .filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw registryFailure("INVALID_PROJECT_ROOT", "Project root contains a traversal component");
  }
  if (comparablePath(value) === comparablePath(parsed.root) || comparablePath(value) !== comparablePath(path.resolve(value))) {
    throw registryFailure("INVALID_PROJECT_ROOT", "Project root is a filesystem root or is not normalized");
  }
}

function inspectEveryComponent(value: string): void {
  const parsed = path.parse(value);
  let current = parsed.root;
  const segments = value
    .slice(parsed.root.length)
    .split(/[\\/]+/u)
    .filter((segment) => segment.length > 0);
  try {
    for (const segment of segments) {
      current = path.join(current, segment);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw registryFailure("PROJECT_ROOT_REPARSE", "Project root contains a reparse or symbolic-link component");
      }
    }
  } catch (error) {
    if (error instanceof ProjectRegistryError) throw error;
    const code = error instanceof Error && "code" in error ? String(error.code) : "unknown";
    if (code === "ENOENT") {
      throw registryFailure("PROJECT_ROOT_MISSING", "Project root does not exist", {}, error);
    }
    throw registryFailure("PROJECT_IDENTITY_UNCERTAIN", "Project root components could not be inspected", {}, error);
  }
}

export function inspectProjectRoot(projectRootInput: unknown, runtimeRootInput: unknown): ProjectRootIdentity {
  rejectLexicalRoot(projectRootInput);
  rejectLexicalRoot(runtimeRootInput);
  inspectEveryComponent(projectRootInput);
  inspectEveryComponent(runtimeRootInput);
  try {
    const rootStat = lstatSync(projectRootInput);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw registryFailure("PROJECT_ROOT_REPARSE", "Project root must be a real directory");
    }
    const canonicalRoot = realpathSync.native(projectRootInput);
    const canonicalRuntimeRoot = realpathSync.native(runtimeRootInput);
    if (comparablePath(canonicalRoot) !== comparablePath(projectRootInput)) {
      throw registryFailure("PROJECT_ROOT_REPARSE", "Project root resolves through an alias or reparse point");
    }
    if (overlaps(canonicalRoot, canonicalRuntimeRoot)) {
      throw registryFailure("PROJECT_RUNTIME_OVERLAP", "Project root and runtime root must not overlap");
    }
    const device = String(rootStat.dev);
    const inode = String(rootStat.ino);
    if (device.length === 0 || inode.length === 0 || !Number.isSafeInteger(rootStat.mode)) {
      throw registryFailure("PROJECT_IDENTITY_UNCERTAIN", "Project root has no stable local identity receipt");
    }
    return Object.freeze({
      canonicalRoot,
      rootKey: comparablePath(canonicalRoot),
      platform: process.platform,
      device,
      inode,
      mode: rootStat.mode,
    });
  } catch (error) {
    if (error instanceof ProjectRegistryError) throw error;
    throw registryFailure("PROJECT_IDENTITY_UNCERTAIN", "Project root identity could not be established", {}, error);
  }
}

export function inspectTrustedRuntimeRoot(runtimeRootInput: unknown): ProjectRootIdentity {
  rejectLexicalRoot(runtimeRootInput);
  inspectEveryComponent(runtimeRootInput);
  try {
    const rootStat = lstatSync(runtimeRootInput);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw registryFailure("PROJECT_ROOT_REPARSE", "Runtime root must be a real directory");
    }
    const canonicalRoot = realpathSync.native(runtimeRootInput);
    if (comparablePath(canonicalRoot) !== comparablePath(runtimeRootInput)) {
      throw registryFailure("PROJECT_ROOT_REPARSE", "Runtime root resolves through an alias or reparse point");
    }
    return Object.freeze({
      canonicalRoot,
      rootKey: comparablePath(canonicalRoot),
      platform: process.platform,
      device: String(rootStat.dev),
      inode: String(rootStat.ino),
      mode: rootStat.mode,
    });
  } catch (error) {
    if (error instanceof ProjectRegistryError) throw error;
    throw registryFailure("PROJECT_IDENTITY_UNCERTAIN", "Runtime root identity could not be established", {}, error);
  }
}

export function revalidateProjectRoot(
  receipt: ProjectRootIdentity,
  runtimeRoot: string,
): ProjectRootIdentity {
  const current = inspectProjectRoot(receipt.canonicalRoot, runtimeRoot);
  if (
    current.rootKey !== receipt.rootKey ||
    current.platform !== receipt.platform ||
    current.device !== receipt.device ||
    current.inode !== receipt.inode ||
    current.mode !== receipt.mode
  ) {
    throw registryFailure("PROJECT_IDENTITY_CHANGED", "Project root identity changed since registration");
  }
  return current;
}
