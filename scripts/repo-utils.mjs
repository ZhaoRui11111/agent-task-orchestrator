import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const repoRoot = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
export const tempRoot = path.join(repoRoot, ".ep00b-tmp");

export const EXPECTED_PACKAGE_SCRIPTS = Object.freeze({
  build: "tsc -p tsconfig.json",
  lint: "node scripts/lint.mjs",
  typecheck: "tsc -p tsconfig.json --noEmit",
  test: "node --test",
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
  ".ep00b-tmp",
  ".local",
  ".pnpm-store",
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

export function createOwnedGenerationAt(root, prefix) {
  invariant(/^[a-z0-9][a-z0-9-]{2,40}$/u.test(prefix), "generation prefix is invalid");
  if (!existsSync(root)) {
    mkdirSync(root);
  }
  const before = inspectRegularDirectory(root, "temp root");
  const generation = mkdtempSync(path.join(root, `${prefix}-`));
  const after = inspectRegularDirectory(root, "temp root");
  invariant(
    pathIdentity(before.resolved) === pathIdentity(after.resolved) && before.dev === after.dev && before.ino === after.ino,
    "temp root identity changed during generation creation",
  );
  const generationStat = lstatSync(generation);
  invariant(generationStat.isDirectory() && !generationStat.isSymbolicLink(), "created generation is not a regular directory");
  const resolved = realpathSync(generation);
  invariant(pathIdentity(path.dirname(resolved)) === pathIdentity(before.resolved), "generation escaped the validated temp root");
  return resolved;
}

export function createOwnedGeneration(prefix) {
  const resolved = createOwnedGenerationAt(tempRoot, prefix);
  assertDirectGeneration(resolved);
  return resolved;
}

function assertDirectGeneration(generation) {
  const resolved = path.resolve(generation);
  invariant(path.dirname(resolved) === path.resolve(tempRoot), "generation escaped the fixed temp root");
  invariant(path.basename(resolved).length > 8, "generation name is not specific enough");
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

export function removeOwnedGeneration(generation) {
  assertDirectGeneration(generation);
  invariant(existsSync(generation), "owned generation is absent before cleanup");
  const inventory = inventoryTree(generation);
  for (const member of inventory) {
    if (lstatSync(member).isSymbolicLink()) {
      unlinkSync(member);
    }
  }
  const removeRegularTree = (current) => {
    const stat = lstatSync(current);
    invariant(!stat.isSymbolicLink(), `reparse/symlink appeared during cleanup: ${current}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) {
        removeRegularTree(path.join(current, name));
      }
      rmdirSync(current);
      return;
    }
    invariant(stat.isFile(), `refusing nonregular cleanup member: ${current}`);
    unlinkSync(current);
  };
  removeRegularTree(generation);
  invariant(!existsSync(generation), "owned generation survived cleanup");
  if (existsSync(tempRoot) && readdirSync(tempRoot).length === 0) {
    const stat = lstatSync(tempRoot);
    invariant(stat.isDirectory() && !stat.isSymbolicLink(), "temp root identity changed");
    try {
      rmdirSync(tempRoot);
    } catch (error) {
      invariant(
        error?.code === "ENOENT" || error?.code === "ENOTEMPTY",
        `unexpected temp-root cleanup failure: ${error?.message ?? error}`,
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
