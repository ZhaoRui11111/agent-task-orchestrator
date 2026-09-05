import { lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import type { CodexProfileRecord, RegisteredProject } from "./persistence/application-repository.ts";
import {
  CODEX_PRODUCT_CONSTRUCTOR_IDENTITY,
  CODEX_PRODUCT_CREDENTIAL_REFERENCE,
  CODEX_PRODUCT_DESTINATION,
  codexProfileConfigurationSha256,
} from "./persistence/codex-product-digest.ts";

export {
  CODEX_PRODUCT_CONSTRUCTOR_IDENTITY,
  CODEX_PRODUCT_CREDENTIAL_REFERENCE,
  CODEX_PRODUCT_DESTINATION,
};

const OPERATIONAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MAX_PATH_BYTES = 4_096;
const ALLOWED_REACTIVATION_MEMBERS = new Set(["sessions"]);
const PROHIBITED_CODEX_HOME_MEMBERS = new Set([
  "auth.json",
  "config.toml",
  "rules",
  "skills",
  "plugins",
  "plugin",
  "mcp",
  ".mcp",
]);

export type CodexProfileConfigurationErrorCode =
  | "invalid_path"
  | "path_missing"
  | "path_alias"
  | "path_type"
  | "identity_changed"
  | "path_overlap"
  | "codex_home_not_empty"
  | "codex_home_member_refused";

export class CodexProfileConfigurationError extends Error {
  readonly code: CodexProfileConfigurationErrorCode;

  constructor(code: CodexProfileConfigurationErrorCode) {
    super("Codex profile configuration did not satisfy the closed local identity contract");
    this.name = "CodexProfileConfigurationError";
    this.code = code;
  }
}

export interface CodexFilesystemIdentity {
  readonly canonicalPath: string;
  readonly canonicalPathKey: string;
  readonly platform: string;
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
}

export interface CodexProfileConfigurationInput {
  readonly workspaceRootKey: string;
  readonly workspaceRoot: string;
  readonly codexHomeKey: string;
  readonly codexHome: string;
  readonly gitExecutable: string;
}

export interface InspectedCodexProfileConfiguration {
  readonly destination: typeof CODEX_PRODUCT_DESTINATION;
  readonly credentialReference: typeof CODEX_PRODUCT_CREDENTIAL_REFERENCE;
  readonly projectRootKey: string;
  readonly workspaceRootKey: string;
  readonly workspace: CodexFilesystemIdentity;
  readonly codexHomeKey: string;
  readonly codexHome: CodexFilesystemIdentity;
  readonly gitExecutable: CodexFilesystemIdentity;
  readonly configurationSha256: string;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function comparablePath(value: string): string {
  const resolved = path.resolve(value).replace(/[\\/]+$/u, "");
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

function lexicalPath(value: unknown): asserts value is string {
  if (
    typeof value !== "string" || value.length === 0 || value.normalize("NFC") !== value ||
    utf8Length(value) > MAX_PATH_BYTES || /[\p{Cc}\p{Cf}]/u.test(value) || !path.isAbsolute(value) ||
    comparablePath(value) !== comparablePath(path.resolve(value))
  ) throw new CodexProfileConfigurationError("invalid_path");
  if (process.platform === "win32" && (/^\\\\/u.test(value) || !/^[A-Za-z]:[\\/]/u.test(value))) {
    throw new CodexProfileConfigurationError("invalid_path");
  }
  const parsed = path.parse(value);
  const segments = value.slice(parsed.root.length).split(/[\\/]+/u).filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new CodexProfileConfigurationError("invalid_path");
  }
}

function inspectComponents(value: string): void {
  const parsed = path.parse(value);
  let current = parsed.root;
  for (const segment of value.slice(parsed.root.length).split(/[\\/]+/u).filter((item) => item.length > 0)) {
    current = path.join(current, segment);
    let stat;
    try { stat = lstatSync(current); } catch {
      throw new CodexProfileConfigurationError("path_missing");
    }
    if (stat.isSymbolicLink()) throw new CodexProfileConfigurationError("path_alias");
  }
}

function inspectIdentity(value: unknown, kind: "directory" | "file"): CodexFilesystemIdentity {
  lexicalPath(value);
  inspectComponents(value);
  try {
    const stat = lstatSync(value, { bigint: true });
    if (stat.isSymbolicLink() || (kind === "directory" ? !stat.isDirectory() : !stat.isFile())) {
      throw new CodexProfileConfigurationError("path_type");
    }
    const canonicalPath = realpathSync.native(value);
    if (comparablePath(canonicalPath) !== comparablePath(value)) {
      throw new CodexProfileConfigurationError("path_alias");
    }
    const mode = Number(stat.mode);
    if (!Number.isSafeInteger(mode)) throw new CodexProfileConfigurationError("path_type");
    return Object.freeze({
      canonicalPath,
      canonicalPathKey: comparablePath(canonicalPath),
      platform: process.platform,
      device: String(stat.dev),
      inode: String(stat.ino),
      mode,
    });
  } catch (error) {
    if (error instanceof CodexProfileConfigurationError) throw error;
    throw new CodexProfileConfigurationError("path_missing");
  }
}

function overlaps(left: string, right: string): boolean {
  const first = comparablePath(left);
  const second = comparablePath(right);
  return first === second || first.startsWith(`${second}${path.sep}`) || second.startsWith(`${first}${path.sep}`);
}

function canonicalExistingWorkspacePath(value: string): string {
  lexicalPath(value);
  try {
    return inspectIdentity(value, "directory").canonicalPath;
  } catch (error) {
    if (!(error instanceof CodexProfileConfigurationError) || error.code !== "path_missing") throw error;
    // A historical cleaned generation, or an injected Fake generation, may no
    // longer exist. Every existing ancestor must still be direct; only ENOENT
    // permits the remaining deterministic suffix to stay lexical.
    const parsed = path.parse(value);
    let current = parsed.root;
    for (const segment of value.slice(parsed.root.length).split(/[\\/]+/u).filter((item) => item.length > 0)) {
      current = path.join(current, segment);
      try {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink()) throw new CodexProfileConfigurationError("path_alias");
      } catch (cause) {
        if (cause instanceof CodexProfileConfigurationError) throw cause;
        if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") break;
        throw new CodexProfileConfigurationError("path_missing");
      }
    }
    return path.resolve(value);
  }
}

function exactIdentity(
  actual: CodexFilesystemIdentity,
  expected: Readonly<{
    path: string;
    platform: string;
    device: string;
    inode: string;
    mode: number;
  }>,
): boolean {
  return comparablePath(actual.canonicalPath) === comparablePath(expected.path) &&
    actual.platform === expected.platform && actual.device === expected.device &&
    actual.inode === expected.inode && actual.mode === expected.mode;
}

function inspectCodexHomeMembers(root: CodexFilesystemIdentity, firstActivation: boolean): void {
  let members: string[];
  try { members = readdirSync(root.canonicalPath); } catch {
    throw new CodexProfileConfigurationError("path_missing");
  }
  if (firstActivation && members.length !== 0) {
    throw new CodexProfileConfigurationError("codex_home_not_empty");
  }
  for (const member of members) {
    const normalized = member.normalize("NFC").toLocaleLowerCase("en-US");
    if (PROHIBITED_CODEX_HOME_MEMBERS.has(normalized) || !ALLOWED_REACTIVATION_MEMBERS.has(normalized)) {
      throw new CodexProfileConfigurationError("codex_home_member_refused");
    }
    const child = inspectIdentity(path.join(root.canonicalPath, member), "directory");
    if (!overlaps(root.canonicalPath, child.canonicalPath)) {
      throw new CodexProfileConfigurationError("path_alias");
    }
  }
}

export function inspectCodexProfileConfiguration(
  input: CodexProfileConfigurationInput,
  project: RegisteredProject,
  runtimeRoot: string,
  priorProfile: CodexProfileRecord | null,
  existingWorkspacePaths: readonly string[] = Object.freeze([]),
): InspectedCodexProfileConfiguration {
  if (!OPERATIONAL_ID.test(input.workspaceRootKey) || !OPERATIONAL_ID.test(input.codexHomeKey) ||
    input.workspaceRootKey === input.codexHomeKey) {
    throw new CodexProfileConfigurationError("invalid_path");
  }
  const workspace = inspectIdentity(input.workspaceRoot, "directory");
  const codexHome = inspectIdentity(input.codexHome, "directory");
  const gitExecutable = inspectIdentity(input.gitExecutable, "file");
  const runtime = inspectIdentity(runtimeRoot, "directory");
  const projectRoot = inspectIdentity(project.canonicalRoot, "directory");
  const canonicalWorkspacePaths = existingWorkspacePaths.map(canonicalExistingWorkspacePath);
  const allDisjoint = [runtime.canonicalPath, projectRoot.canonicalPath];
  if (allDisjoint.some((candidate) => overlaps(candidate, workspace.canonicalPath)) ||
    [...allDisjoint, workspace.canonicalPath, ...canonicalWorkspacePaths]
      .some((candidate) => overlaps(candidate, codexHome.canonicalPath))) {
    throw new CodexProfileConfigurationError("path_overlap");
  }
  if (project.rootKey !== projectRoot.canonicalPathKey) {
    throw new CodexProfileConfigurationError("identity_changed");
  }
  if (priorProfile !== null && (
    priorProfile.workspaceRootKey !== input.workspaceRootKey || priorProfile.codexHomeKey !== input.codexHomeKey ||
    !exactIdentity(workspace, {
      path: priorProfile.workspaceRoot, platform: priorProfile.workspacePlatform,
      device: priorProfile.workspaceDevice, inode: priorProfile.workspaceInode, mode: priorProfile.workspaceMode,
    }) || !exactIdentity(codexHome, {
      path: priorProfile.codexHome, platform: priorProfile.codexHomePlatform,
      device: priorProfile.codexHomeDevice, inode: priorProfile.codexHomeInode, mode: priorProfile.codexHomeMode,
    }) || !exactIdentity(gitExecutable, {
      path: priorProfile.gitExecutable, platform: priorProfile.gitExecutablePlatform,
      device: priorProfile.gitExecutableDevice, inode: priorProfile.gitExecutableInode, mode: priorProfile.gitExecutableMode,
    })
  )) throw new CodexProfileConfigurationError("identity_changed");
  inspectCodexHomeMembers(codexHome, priorProfile === null);
  const digestInput = Object.freeze({
    projectRootKey: project.rootKey,
    workspaceRootKey: input.workspaceRootKey,
    codexHomeKey: input.codexHomeKey,
    gitExecutableKey: gitExecutable.canonicalPathKey,
  });
  const configurationSha256 = codexProfileConfigurationSha256(digestInput);
  if (priorProfile !== null && priorProfile.constructorConfigSha256 !== configurationSha256) {
    throw new CodexProfileConfigurationError("identity_changed");
  }
  return Object.freeze({
    destination: CODEX_PRODUCT_DESTINATION,
    credentialReference: CODEX_PRODUCT_CREDENTIAL_REFERENCE,
    projectRootKey: project.rootKey,
    workspaceRootKey: input.workspaceRootKey,
    workspace,
    codexHomeKey: input.codexHomeKey,
    codexHome,
    gitExecutable,
    configurationSha256,
  });
}

export function revalidateCodexProfileConfiguration(
  profile: CodexProfileRecord,
  project: RegisteredProject,
  runtimeRoot: string,
  existingWorkspacePaths: readonly string[] = Object.freeze([]),
): InspectedCodexProfileConfiguration {
  return inspectCodexProfileConfiguration(Object.freeze({
    workspaceRootKey: profile.workspaceRootKey,
    workspaceRoot: profile.workspaceRoot,
    codexHomeKey: profile.codexHomeKey,
    codexHome: profile.codexHome,
    gitExecutable: profile.gitExecutable,
  }), project, runtimeRoot, profile, existingWorkspacePaths);
}

export interface CodexCredentialResolver {
  configured(reference: typeof CODEX_PRODUCT_CREDENTIAL_REFERENCE): boolean;
  resolve(reference: typeof CODEX_PRODUCT_CREDENTIAL_REFERENCE): string | null;
}

export function createProcessEnvironmentCodexCredentialResolver(): CodexCredentialResolver {
  return Object.freeze({
    configured(reference: typeof CODEX_PRODUCT_CREDENTIAL_REFERENCE): boolean {
      if (reference !== CODEX_PRODUCT_CREDENTIAL_REFERENCE) return false;
      return Object.hasOwn(process.env, "CODEX_API_KEY");
    },
    resolve(reference: typeof CODEX_PRODUCT_CREDENTIAL_REFERENCE): string | null {
      if (reference !== CODEX_PRODUCT_CREDENTIAL_REFERENCE) return null;
      const value = process.env.CODEX_API_KEY;
      return typeof value === "string" && value.length > 0 ? value : null;
    },
  });
}
