import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const repoRoot = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
export const taskArtifactsRoot = path.join(repoRoot, ".task-artifacts");
const ownedGenerationReceipts = new Map();

export const EXPECTED_PRODUCTION_SOURCE_FILES = Object.freeze([
  "src/application.ts",
  "src/authorization.ts",
  "src/cli-api.ts",
  "src/cli.ts",
  "src/domain.ts",
  "src/index.ts",
  "src/node-builtins.d.ts",
  "src/persistence/application-repository.ts",
  "src/persistence/backup.ts",
  "src/persistence/database.ts",
  "src/persistence/doctor.ts",
  "src/persistence/errors.ts",
  "src/persistence/index.ts",
  "src/persistence/local-ingress.ts",
  "src/persistence/migrations.ts",
  "src/persistence/repository.ts",
  "src/persistence/runtime.ts",
  "src/persistence/store.ts",
  "src/persistence/values.ts",
  "src/project-registry.ts",
]);

export const EXPECTED_MIGRATION_FILES = Object.freeze([
  "migrations/0001-persistence-metadata.sql",
  "migrations/0002-phase1-task-storage.sql",
  "migrations/0003-phase1-application.sql",
  "migrations/0004-phase1-cli.sql",
]);

const ALLOWED_PERSISTENCE_BUILTINS = new Set([
  "node:crypto",
  "node:fs",
  "node:os",
  "node:path",
  "node:sqlite",
  "node:url",
]);

export const EXPECTED_PACKAGE_SCRIPTS = Object.freeze({
  build: "tsc -p tsconfig.json",
  lint: "node scripts/lint.mjs",
  typecheck: "tsc -p tsconfig.json --noEmit",
  test: "node scripts/test-runner.mjs",
  "test:persistence": "node scripts/test-runner.mjs test/persistence-*.test.mjs",
  "docs:check": "node scripts/docs-check.mjs",
  "dependency:check": "node scripts/dependency-security.mjs",
  "dependency:audit": "pnpm audit --prod --audit-level high --registry=https://registry.npmjs.org/",
  "package:smoke": "node scripts/package-smoke.mjs",
  "spike:sqlite": "node scripts/sqlite-feasibility.mjs --json",
  "spike:codex": "node scripts/codex-contract.mjs --json",
  "verify:offline":
    "pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm docs:check && pnpm dependency:check && pnpm package:smoke && pnpm spike:sqlite && pnpm spike:codex",
});

export const EXPECTED_NPMRC_LINES = Object.freeze([
  "engine-strict=true",
  "ignore-scripts=true",
  "registry=https://registry.npmjs.org/",
  "save-exact=true",
  "store-dir=.pnpm-store",
  "strict-peer-dependencies=true",
  "verify-deps-before-run=false",
]);

const FORBIDDEN_DIRECTORY_SEGMENTS = new Set([
  ".local",
  ".pnpm-store",
  ".task-artifacts",
  ".worktrees",
  "backup",
  "backups",
  "build",
  "coverage",
  "dist",
  "htmlcov",
  "log",
  "logs",
  "node_modules",
  "runtime",
  "secret",
  "secrets",
  "state",
  "worktree",
  "worktrees",
]);

export function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function productionBoundaryFailures(inventory, readSource) {
  const failures = [];
  const productionFiles = inventory.filter((item) => item.startsWith("src/")).sort();
  if (JSON.stringify(productionFiles) !== JSON.stringify(EXPECTED_PRODUCTION_SOURCE_FILES)) {
    failures.push("production source inventory drifted");
  }
  const migrationFiles = inventory.filter((item) => item.startsWith("migrations/")).sort();
  if (JSON.stringify(migrationFiles) !== JSON.stringify(EXPECTED_MIGRATION_FILES)) {
    failures.push("production migration inventory drifted");
  }

  for (const relative of productionFiles.filter((item) => item.endsWith(".ts"))) {
    const source = readSource(relative);
    if (/codex|openai|@openai|scripts\//iu.test(source)) {
      failures.push(`${relative}: production source depends on feasibility/vendor code`);
    }
    if (relative.endsWith(".d.ts")) continue;
    const builtins = [
      ...source.matchAll(/\bfrom\s+["'](node:[^"']+)["']/gu),
      ...source.matchAll(/\bimport\s*["'](node:[^"']+)["']/gu),
      ...source.matchAll(/\bimport\s*\(\s*["'](node:[^"']+)["']\s*\)/gu),
    ].map((match) => match[1]);
    for (const builtin of builtins) {
    const registryBuiltin = relative === "src/project-registry.ts" && (builtin === "node:fs" || builtin === "node:path");
    const cliBuiltin = (relative === "src/cli.ts" || relative === "src/cli-api.ts") &&
      (builtin === "node:crypto" || builtin === "node:path" || builtin === "node:url");
    if (!relative.startsWith("src/persistence/") && !registryBuiltin && !cliBuiltin) {
        failures.push(`${relative}: Node built-in escaped the persistence owner boundary`);
      } else if (!ALLOWED_PERSISTENCE_BUILTINS.has(builtin)) {
        failures.push(`${relative}: undeclared persistence built-in ${builtin}`);
      }
    }
  }
  return failures;
}

function normalizedObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

export function packagePolicyFailures(packageJson, npmrc) {
  const failures = [];
  const actualScripts = normalizedObject(packageJson?.scripts);
  const expectedScripts = normalizedObject(EXPECTED_PACKAGE_SCRIPTS);
  if (JSON.stringify(actualScripts) !== JSON.stringify(expectedScripts)) {
    failures.push("package script command inventory drifted");
  }

  const normalizedNpmrc = typeof npmrc === "string" ? npmrc.replaceAll("\r\n", "\n") : "";
  const npmrcLines = normalizedNpmrc.endsWith("\n")
    ? normalizedNpmrc.slice(0, -1).split("\n")
    : normalizedNpmrc.split("\n");
  if (JSON.stringify(npmrcLines) !== JSON.stringify(EXPECTED_NPMRC_LINES)) {
    failures.push(".npmrc exact line inventory drifted");
  }
  if (npmrcLines.some((line) => /(?:^|[._-])(?:auth|token|password|secret|credential)(?:[._-]|$)/iu.test(line))) {
    failures.push(".npmrc credential-shaped configuration is prohibited");
  }
  return failures;
}

export function isForbiddenRepositoryPath(relative) {
  if (typeof relative !== "string" || relative.length === 0) return true;
  const normalized = relative.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    path.posix.isAbsolute(normalized) ||
    /^[a-z]:/iu.test(normalized) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return true;
  }
  const lowered = segments.map((segment) => segment.toLowerCase());
  if (lowered.some((segment) => FORBIDDEN_DIRECTORY_SEGMENTS.has(segment))) return true;
  const basename = lowered.at(-1);
  if (basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) return true;
  if (/^(?:credentials?|id_ed25519|id_rsa)(?:\.|$)/iu.test(basename)) return true;
  return (
    /\.(?:db|sqlite|sqlite3)(?:-(?:journal|shm|wal))?$/iu.test(basename) ||
    /\.(?:bak|key|log|p12|pem|pfx|temp|tgz|tmp)$/iu.test(basename) ||
    /^(?:\.coverage|coverage\.xml|lcov\.info)$/iu.test(basename)
  );
}

function inventoryEntryIdentityFailure(root, relative) {
  const normalized = relative.replaceAll("\\", "/");
  let current = path.resolve(root);
  try {
    const rootStat = lstatSync(current);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return "repository inventory root is not a regular directory";
    const segments = normalized.split("/");
    for (const [index, segment] of segments.entries()) {
      if (!readdirSync(current).includes(segment)) return "path case or inventory identity does not match the filesystem";
      current = path.join(current, segment);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) return "reparse/symlink inventory member is prohibited";
      if (index < segments.length - 1 && !stat.isDirectory()) return "inventory parent is not a directory";
      if (index === segments.length - 1 && !stat.isFile()) return "inventory member is not a regular file";
    }
    return null;
  } catch (error) {
    return `inventory member cannot be inspected without following links: ${error?.code ?? error?.message ?? error}`;
  }
}

export function repositoryInventoryFailures(inventory, root = repoRoot) {
  const failures = [];
  if (!Array.isArray(inventory) || new Set(inventory).size !== inventory.length) {
    return ["repository inventory is not a unique path array"];
  }
  for (const relative of inventory) {
    if (isForbiddenRepositoryPath(relative)) {
      failures.push(`${relative}: forbidden committed artifact shape`);
      continue;
    }
    const identityFailure = inventoryEntryIdentityFailure(root, relative);
    if (identityFailure) failures.push(`${relative}: ${identityFailure}`);
  }
  return failures;
}

export function gitInventory() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot, encoding: "utf8", windowsHide: true },
  );
  invariant(result.status === 0, `git inventory failed: ${result.stderr}`);
  return result.stdout.split("\0").filter(Boolean).sort();
}

function pathIdentity(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function inspectRegularDirectory(root, label) {
  const stat = lstatSync(root);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), `${label} is a reparse point or non-directory`);
  const resolved = realpathSync(root);
  invariant(pathIdentity(resolved) === pathIdentity(root), `${label} real path drifted`);
  return { resolved, dev: stat.dev, ino: stat.ino };
}

function inspectOwnedGeneration(generation, receipt, expectedPath = receipt.generation.resolved) {
  const root = inspectRegularDirectory(taskArtifactsRoot, "artifact root");
  invariant(
    pathIdentity(root.resolved) === pathIdentity(receipt.root.resolved) &&
      root.dev === receipt.root.dev &&
      root.ino === receipt.root.ino,
    "artifact root identity changed since generation creation",
  );
  const stat = lstatSync(generation);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), "owned generation is a reparse point or non-directory");
  const resolved = realpathSync(generation);
  invariant(pathIdentity(resolved) === pathIdentity(expectedPath), "owned generation real path changed");
  invariant(stat.dev === receipt.generation.dev && stat.ino === receipt.generation.ino, "owned generation identity changed");
  invariant(pathIdentity(path.dirname(resolved)) === pathIdentity(root.resolved), "owned generation escaped artifact root");
  return { root, generation: { resolved, dev: stat.dev, ino: stat.ino } };
}

function nodeKind(stat) {
  if (stat.isSymbolicLink()) return "link";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "nonregular";
}

function captureOwnedInventory(generation) {
  const paths = inventoryTree(generation);
  return paths.map((member) => {
    const relative = path.relative(generation, member);
    const stat = lstatSync(member);
    const kind = nodeKind(stat);
    invariant(kind !== "nonregular", `refusing nonregular inventory member: ${member}`);
    return { relative, dev: stat.dev, ino: stat.ino, kind };
  });
}

function entryPath(root, entry) {
  return entry.relative === "" ? root : path.join(root, entry.relative);
}

function assertEntryIdentity(root, entry) {
  const member = entryPath(root, entry);
  const relative = path.relative(root, member);
  invariant(
    relative === "" || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)),
    `inventory entry escaped owned generation: ${member}`,
  );
  const stat = lstatSync(member);
  invariant(nodeKind(stat) === entry.kind, `inventory entry node class changed: ${member}`);
  invariant(stat.dev === entry.dev && stat.ino === entry.ino, `inventory entry identity changed: ${member}`);
  if (entry.kind !== "link") {
    const resolved = realpathSync(member);
    const resolvedRelative = path.relative(root, resolved);
    invariant(
      resolvedRelative === "" ||
        (!resolvedRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(resolvedRelative)),
      `inventory entry escaped owned generation: ${member}`,
    );
  }
  return member;
}

function uniqueTombstone(parent) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = path.join(parent, `.ato-delete-${randomUUID()}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error("could not allocate an absent cleanup tombstone");
}

function restoreUnexpectedRename(source, tombstone, movedEntry) {
  if (existsSync(source) || !existsSync(tombstone)) return false;
  const stat = lstatSync(tombstone);
  if (nodeKind(stat) !== movedEntry.kind || stat.dev !== movedEntry.dev || stat.ino !== movedEntry.ino) return false;
  renameSync(tombstone, source);
  const restored = lstatSync(source);
  return nodeKind(restored) === movedEntry.kind && restored.dev === movedEntry.dev && restored.ino === movedEntry.ino;
}

function moveEntryToTombstone(root, entry) {
  const source = assertEntryIdentity(root, entry);
  const tombstone = uniqueTombstone(path.dirname(source));
  renameSync(source, tombstone);
  const moved = lstatSync(tombstone);
  const movedEntry = { ...entry, dev: moved.dev, ino: moved.ino, kind: nodeKind(moved) };
  if (movedEntry.kind !== entry.kind || movedEntry.dev !== entry.dev || movedEntry.ino !== entry.ino) {
    restoreUnexpectedRename(source, tombstone, movedEntry);
    throw new Error(`inventory entry changed during quarantine rename: ${source}`);
  }
  return { source, tombstone, movedEntry };
}

function deleteQuarantinedEntry(root, entry) {
  const moved = moveEntryToTombstone(root, entry);
  const stat = lstatSync(moved.tombstone);
  invariant(
    nodeKind(stat) === entry.kind && stat.dev === entry.dev && stat.ino === entry.ino,
    `quarantined inventory entry identity changed: ${moved.tombstone}`,
  );
  try {
    if (entry.kind === "directory") {
      invariant(readdirSync(moved.tombstone).length === 0, `quarantined directory is not empty: ${moved.tombstone}`);
      rmdirSync(moved.tombstone);
    } else {
      unlinkSync(moved.tombstone);
    }
  } catch (error) {
    restoreUnexpectedRename(moved.source, moved.tombstone, moved.movedEntry);
    throw error;
  }
}

function normalizeCleanupHooks(options) {
  if (options === undefined) return {};
  invariant(options && typeof options === "object" && !Array.isArray(options), "cleanup options must be an object");
  const allowed = new Set(["afterInventory", "afterQuarantine", "beforeMemberRemoval"]);
  for (const key of Object.keys(options)) {
    invariant(allowed.has(key), `unknown cleanup option: ${key}`);
    invariant(typeof options[key] === "function", `cleanup option ${key} must be a function`);
  }
  return options;
}

export function createOwnedGenerationAt(root, prefix) {
  invariant(/^[a-z0-9][a-z0-9-]{2,40}$/u.test(prefix), "generation prefix is invalid");
  if (!existsSync(root)) {
    mkdirSync(root);
  }
  const before = inspectRegularDirectory(root, "artifact root");
  const generation = mkdtempSync(path.join(root, `${prefix}-`));
  const after = inspectRegularDirectory(root, "artifact root");
  invariant(
    pathIdentity(before.resolved) === pathIdentity(after.resolved) && before.dev === after.dev && before.ino === after.ino,
    "artifact root identity changed during generation creation",
  );
  const generationStat = lstatSync(generation);
  invariant(generationStat.isDirectory() && !generationStat.isSymbolicLink(), "created generation is not a regular directory");
  const resolved = realpathSync(generation);
  invariant(pathIdentity(path.dirname(resolved)) === pathIdentity(before.resolved), "generation escaped the validated temp root");
  return resolved;
}

export function createOwnedGeneration(prefix) {
  const resolved = createOwnedGenerationAt(taskArtifactsRoot, prefix);
  assertDirectGeneration(resolved);
  const root = inspectRegularDirectory(taskArtifactsRoot, "artifact root");
  const stat = lstatSync(resolved);
  invariant(stat.isDirectory() && !stat.isSymbolicLink(), "created generation is not a regular directory");
  const key = pathIdentity(resolved);
  invariant(!ownedGenerationReceipts.has(key), "owned generation receipt already exists");
  ownedGenerationReceipts.set(key, {
    root,
    generation: { resolved: key, dev: stat.dev, ino: stat.ino },
  });
  return resolved;
}

function assertDirectGeneration(generation) {
  const resolved = path.resolve(generation);
  invariant(path.dirname(resolved) === path.resolve(taskArtifactsRoot), "generation escaped the fixed artifact root");
  invariant(path.basename(resolved).length > 8, "generation name is not specific enough");
}

function quarantineOwnedGeneration(generation, quarantine, receipt) {
  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(generation, quarantine);
      return;
    } catch (error) {
      const retryableWindowsRelease = process.platform === "win32" &&
        error instanceof Error && "code" in error &&
        (error.code === "EPERM" || error.code === "EBUSY") && attempt < 200;
      if (!retryableWindowsRelease) throw error;
      invariant(existsSync(generation) && !existsSync(quarantine), "cleanup rename has an ambiguous result");
      inspectOwnedGeneration(generation, receipt);
      Atomics.wait(waitCell, 0, 0, 10);
    }
  }
}

export function inventoryTree(root) {
  const resolvedRoot = path.resolve(root);
  const result = [];
  const visit = (current) => {
    const stat = lstatSync(current);
    result.push(current);
    if (stat.isSymbolicLink()) {
      const target = realpathSync(current);
      const relativeTarget = path.relative(resolvedRoot, target);
      invariant(
        relativeTarget !== "" && !relativeTarget.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeTarget),
        `refusing reparse/symlink target outside owned generation: ${current}`,
      );
      return;
    }
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) {
        visit(path.join(current, name));
      }
    } else {
      invariant(stat.isFile(), `refusing nonregular inventory member: ${current}`);
    }
  };
  visit(root);
  return result;
}

export function removeOwnedGeneration(generation, options = undefined) {
  const hooks = normalizeCleanupHooks(options);
  assertDirectGeneration(generation);
  const key = pathIdentity(generation);
  const receipt = ownedGenerationReceipts.get(key);
  invariant(receipt, "owned generation has no creator receipt");
  invariant(existsSync(generation), "owned generation is absent before cleanup");
  inspectOwnedGeneration(generation, receipt);
  const inventory = captureOwnedInventory(generation);
  hooks.afterInventory?.(Object.freeze({ generation }));
  inspectOwnedGeneration(generation, receipt);
  const quarantine = uniqueTombstone(taskArtifactsRoot);
  let quarantined = false;
  try {
    quarantineOwnedGeneration(generation, quarantine, receipt);
    quarantined = true;
    inspectOwnedGeneration(quarantine, receipt, quarantine);
    hooks.afterQuarantine?.(Object.freeze({ generation, quarantine }));
    inspectOwnedGeneration(quarantine, receipt, quarantine);

    const members = inventory.filter((entry) => entry.relative !== "");
    const links = members.filter((entry) => entry.kind === "link");
    const files = members.filter((entry) => entry.kind === "file");
    const directories = members
      .filter((entry) => entry.kind === "directory")
      .sort((left, right) => right.relative.split(path.sep).length - left.relative.split(path.sep).length);
    for (const entry of [...links, ...files, ...directories]) {
      hooks.beforeMemberRemoval?.(Object.freeze({ relative: entry.relative, kind: entry.kind }));
      inspectOwnedGeneration(quarantine, receipt, quarantine);
      assertEntryIdentity(quarantine, entry);
      deleteQuarantinedEntry(quarantine, entry);
    }
    inspectOwnedGeneration(quarantine, receipt, quarantine);
    invariant(readdirSync(quarantine).length === 0, "owned generation gained an uninventoried member during cleanup");
    rmdirSync(quarantine);
    quarantined = false;
  } catch (error) {
    if (quarantined && !existsSync(generation) && existsSync(quarantine)) {
      try {
        inspectOwnedGeneration(quarantine, receipt, quarantine);
        renameSync(quarantine, generation);
        inspectOwnedGeneration(generation, receipt);
        quarantined = false;
      } catch {
        // Preserve ambiguous quarantine state for inspection rather than deleting it.
      }
    }
    throw error;
  }
  invariant(!quarantined && !existsSync(generation) && !existsSync(quarantine), "owned generation survived cleanup");
  ownedGenerationReceipts.delete(key);
  if (existsSync(taskArtifactsRoot) && readdirSync(taskArtifactsRoot).length === 0) {
    const root = inspectRegularDirectory(taskArtifactsRoot, "artifact root");
    invariant(
      pathIdentity(root.resolved) === pathIdentity(receipt.root.resolved) &&
        root.dev === receipt.root.dev &&
        root.ino === receipt.root.ino,
      "artifact root identity changed before empty-root cleanup",
    );
    try {
      rmdirSync(taskArtifactsRoot);
    } catch (error) {
      invariant(
        error?.code === "ENOENT" || error?.code === "ENOTEMPTY",
        `unexpected artifact-root cleanup failure: ${error?.message ?? error}`,
      );
    }
  }
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    windowsHide: true,
    env: options.env ?? process.env,
  });
  if (options.expectStatus === undefined) {
    invariant(
      result.status === 0,
      `${command} ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  } else {
    invariant(result.status === options.expectStatus, `${command} returned ${result.status}`);
  }
  return result;
}
