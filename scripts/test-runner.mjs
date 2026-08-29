import { spawnSync } from "node:child_process";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { invariant, repoRoot, taskArtifactsRoot } from "./repo-utils.mjs";

const TEST_LOADER_MARKER = "agent-task-orchestrator:test-runner-child:v1";

function pathIdentity(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function lstatIfPresent(value) {
  try {
    return lstatSync(value, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function nodeKind(stat) {
  if (stat.isSymbolicLink()) return "link";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "nonregular";
}

function identityRecord(relative, stat) {
  return Object.freeze({
    relative,
    kind: nodeKind(stat),
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
  });
}

function containedRelative(root, candidate) {
  const relative = path.relative(root, candidate);
  invariant(
    relative === "" || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)),
    `artifact snapshot member escaped the observed root: ${candidate}`,
  );
  return relative.split(path.sep).join("/");
}

function inspectSnapshotTree(root, current, entries) {
  const initial = lstatIfPresent(current);
  invariant(initial, `artifact snapshot member disappeared during observation: ${current}`);
  const kind = nodeKind(initial);
  invariant(kind !== "link", `artifact snapshot refuses a symlink or reparse point: ${current}`);
  invariant(kind !== "nonregular", `artifact snapshot refuses a nonregular member: ${current}`);

  const resolved = realpathSync(current);
  const relative = containedRelative(root, resolved);
  invariant(
    pathIdentity(resolved) === pathIdentity(current),
    `artifact snapshot member real path drifted: ${current}`,
  );

  let initialNames = null;
  if (kind === "directory") {
    initialNames = readdirSync(current).sort();
    for (const name of initialNames) {
      inspectSnapshotTree(root, path.join(current, name), entries);
    }
    const finalNames = readdirSync(current).sort();
    invariant(
      JSON.stringify(finalNames) === JSON.stringify(initialNames),
      `artifact snapshot directory inventory changed during observation: ${current}`,
    );
  }

  const final = lstatIfPresent(current);
  invariant(final, `artifact snapshot member disappeared during observation: ${current}`);
  invariant(nodeKind(final) === kind, `artifact snapshot member node class changed: ${current}`);
  invariant(
    final.dev === initial.dev && final.ino === initial.ino,
    `artifact snapshot member identity changed: ${current}`,
  );
  if (relative !== "") entries.push(identityRecord(relative, final));
  return final;
}

export function captureArtifactSnapshot(root = taskArtifactsRoot) {
  const exactRoot = path.resolve(root);
  const first = lstatIfPresent(exactRoot);
  if (!first) {
    invariant(!lstatIfPresent(exactRoot), "artifact root appeared during absent-baseline observation");
    return Object.freeze({
      version: 1,
      root: pathIdentity(exactRoot),
      exists: false,
      rootIdentity: null,
      entries: Object.freeze([]),
    });
  }

  invariant(
    nodeKind(first) === "directory",
    "artifact snapshot root is a symlink, reparse point, or non-directory",
  );
  const resolved = realpathSync(exactRoot);
  invariant(pathIdentity(resolved) === pathIdentity(exactRoot), "artifact snapshot root real path drifted");
  const entries = [];
  const final = inspectSnapshotTree(resolved, resolved, entries);
  entries.sort((left, right) => left.relative.localeCompare(right.relative));
  return Object.freeze({
    version: 1,
    root: pathIdentity(exactRoot),
    exists: true,
    rootIdentity: Object.freeze({ dev: final.dev.toString(), ino: final.ino.toString() }),
    entries: Object.freeze(entries),
  });
}

export function assertArtifactSnapshotUnchanged(baseline, root = taskArtifactsRoot) {
  invariant(
    baseline && baseline.version === 1 && baseline.root === pathIdentity(root),
    "artifact baseline does not belong to the requested root",
  );
  const terminal = captureArtifactSnapshot(root);
  invariant(
    JSON.stringify(terminal) === JSON.stringify(baseline),
    "successful Node tests changed the task-artifact baseline; diagnostics were preserved for explicit coordinator prune",
  );
  return terminal;
}

export function executeNodeTests(testArgs = [], options = {}) {
  invariant(Array.isArray(testArgs) && testArgs.every((item) => typeof item === "string"), "test arguments must be strings");
  const artifactRoot = options.artifactRoot ?? taskArtifactsRoot;
  const baseline = captureArtifactSnapshot(artifactRoot);
  const childEnv = { ...(options.env ?? process.env) };
  delete childEnv.NODE_TEST_CONTEXT;
  childEnv.ATO_TEST_RUNNER_CHILD = TEST_LOADER_MARKER;
  const result = spawnSync(process.execPath, ["--test", ...testArgs], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: childEnv,
    stdio: options.stdio ?? "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  const status = result.status ?? 1;
  if (status !== 0) {
    return Object.freeze({
      status,
      hygieneChecked: false,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    });
  }
  const terminal = assertArtifactSnapshotUnchanged(baseline, artifactRoot);
  return Object.freeze({
    status: 0,
    hygieneChecked: true,
    baselineEntries: baseline.entries.length,
    terminalEntries: terminal.entries.length,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  });
}

function isMainModule() {
  if (!process.argv[1]) return false;
  if (pathIdentity(process.argv[1]) !== pathIdentity(fileURLToPath(import.meta.url))) return false;
  if (!process.env.NODE_TEST_CONTEXT) return true;
  invariant(
    process.env.ATO_TEST_RUNNER_CHILD === TEST_LOADER_MARKER,
    "test runner refuses an unowned inherited NODE_TEST_CONTEXT",
  );
  return false;
}

if (isMainModule()) {
  try {
    const result = executeNodeTests(process.argv.slice(2));
    process.exitCode = result.status;
    if (result.status === 0) {
      console.log(JSON.stringify({
        artifactHygiene: "passed",
        baselineEntries: result.baselineEntries,
        terminalEntries: result.terminalEntries,
      }));
    }
  } catch (error) {
    console.error(`test artifact hygiene failed: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}
