import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  createOwnedGeneration,
  removeOwnedGeneration,
  repoRoot,
  taskArtifactsRoot,
} from "../scripts/repo-utils.mjs";

async function withIsolatedRepo(prefix, callback) {
  const owner = createOwnedGeneration(prefix);
  try {
    const isolatedRoot = path.join(owner, "isolated-repository");
    const scriptsRoot = path.join(isolatedRoot, "scripts");
    mkdirSync(scriptsRoot, { recursive: true });
    const copiedModule = path.join(scriptsRoot, "repo-utils.mjs");
    copyFileSync(path.join(repoRoot, "scripts", "repo-utils.mjs"), copiedModule);
    const utilities = await import(`${pathToFileURL(copiedModule).href}?fixture=${randomUUID()}`);
    await callback({ isolatedRoot, utilities });
  } finally {
    removeOwnedGeneration(owner);
  }
}

function codedError(code) {
  const error = new Error(`injected ${code}`);
  error.code = code;
  return error;
}

test("generation issue distinguishes stable EEXIST from disappearance and identity replacement", async () => {
  await withIsolatedRepo("concurrency-issue", async ({ isolatedRoot, utilities }) => {
    const root = utilities.taskArtifactsRoot;
    const first = utilities.createOwnedGenerationAt(root, "absent-root");
    const second = utilities.createOwnedGenerationAt(root, "existing-root");
    assert.notEqual(first, second);
    assert.equal(path.dirname(first), root);
    assert.equal(path.dirname(second), root);
    rmdirSync(first);
    rmdirSync(second);
    rmdirSync(root);

    const ownedFirst = utilities.createOwnedGeneration("owned-first");
    const ownedSecond = utilities.createOwnedGeneration("owned-second");
    utilities.removeOwnedGeneration(ownedFirst);
    assert.equal(existsSync(ownedFirst), false);
    assert.equal(existsSync(ownedSecond), true);
    assert.equal(existsSync(root), true);
    utilities.removeOwnedGeneration(ownedSecond);
    assert.equal(existsSync(root), true);
    assert.deepEqual(readdirSync(root), []);
    assert.deepEqual(utilities.reclaimEmptyTaskArtifactsRoot(), { status: "reclaimed" });

    const missingParentRoot = path.join(isolatedRoot, "absent-parent", "artifact-root");
    assert.throws(
      () => utilities.createOwnedGenerationAt(missingParentRoot, "missing-parent"),
      (error) => error?.code === "ENOENT",
    );
    assert.equal(existsSync(path.dirname(missingParentRoot)), false);

    const disappearingRoot = path.join(isolatedRoot, "disappearing-root");
    assert.throws(
      () => utilities.createOwnedGenerationAt(disappearingRoot, "disappears", {
        afterRootInspection() {
          rmdirSync(disappearingRoot);
        },
      }),
      (error) => error?.code === "ENOENT",
    );
    assert.equal(existsSync(disappearingRoot), false);

    const replacedRoot = path.join(isolatedRoot, "replaced-root");
    const displacedRoot = `${replacedRoot}-displaced`;
    let issuedGeneration;
    assert.throws(
      () => utilities.createOwnedGenerationAt(replacedRoot, "replaced", {
        afterGenerationIssue(context) {
          issuedGeneration = context.generation;
          renameSync(replacedRoot, displacedRoot);
          mkdirSync(replacedRoot);
          writeFileSync(path.join(replacedRoot, "replacement.txt"), "replacement-survives", {
            encoding: "utf8",
            flag: "wx",
          });
        },
      }),
      /artifact root identity changed during generation creation/u,
    );
    const displacedGeneration = path.join(displacedRoot, path.basename(issuedGeneration));
    assert.equal(existsSync(displacedGeneration), true);
    assert.equal(readFileSync(path.join(replacedRoot, "replacement.txt"), "utf8"), "replacement-survives");

    const generationSwapRoot = path.join(isolatedRoot, "generation-swap-root");
    let originalGeneration;
    let displacedGenerationOnly;
    assert.throws(
      () => utilities.createOwnedGenerationAt(generationSwapRoot, "swapped", {
        afterGenerationIssue(context) {
          originalGeneration = context.generation;
          displacedGenerationOnly = `${context.generation}-displaced`;
          writeFileSync(path.join(context.generation, "original.txt"), "original-survives", {
            encoding: "utf8",
            flag: "wx",
          });
          renameSync(context.generation, displacedGenerationOnly);
          mkdirSync(context.generation);
          writeFileSync(path.join(context.generation, "replacement.txt"), "replacement-survives", {
            encoding: "utf8",
            flag: "wx",
          });
        },
      }),
      /created generation identity changed during generation creation/u,
    );
    assert.equal(readFileSync(path.join(displacedGenerationOnly, "original.txt"), "utf8"), "original-survives");
    assert.equal(readFileSync(path.join(originalGeneration, "replacement.txt"), "utf8"), "replacement-survives");
  });
});

test("quiescent fixed-root reclaim handles only regular empty state and narrow terminal races", async () => {
  await withIsolatedRepo("concurrency-reclaim", async ({ isolatedRoot, utilities }) => {
    const root = utilities.taskArtifactsRoot;
    assert.deepEqual(utilities.reclaimEmptyTaskArtifactsRoot(), { status: "absent" });

    mkdirSync(root);
    assert.deepEqual(utilities.reclaimEmptyTaskArtifactsRoot(), { status: "reclaimed" });
    assert.equal(existsSync(root), false);

    mkdirSync(root);
    const marker = path.join(root, "member.txt");
    writeFileSync(marker, "must-survive", { encoding: "utf8", flag: "wx" });
    assert.deepEqual(utilities.reclaimEmptyTaskArtifactsRoot(), { status: "nonempty" });
    assert.equal(readFileSync(marker, "utf8"), "must-survive");
    unlinkSync(marker);
    rmdirSync(root);

    mkdirSync(root);
    assert.deepEqual(
      utilities.reclaimEmptyTaskArtifactsRoot({
        afterInitialInspection() {
          writeFileSync(marker, "late-member-survives", { encoding: "utf8", flag: "wx" });
        },
      }),
      { status: "nonempty" },
    );
    assert.equal(readFileSync(marker, "utf8"), "late-member-survives");
    unlinkSync(marker);
    rmdirSync(root);

    const displacedRoot = `${root}-displaced`;
    mkdirSync(root);
    assert.throws(
      () => utilities.reclaimEmptyTaskArtifactsRoot({
        afterInitialInspection() {
          renameSync(root, displacedRoot);
          mkdirSync(root);
        },
      }),
      /artifact root identity changed before quiescent reclaim/u,
    );
    assert.equal(existsSync(root), true);
    assert.equal(existsSync(displacedRoot), true);
    rmdirSync(root);
    rmdirSync(displacedRoot);

    const target = path.join(isolatedRoot, "reclaim-target");
    mkdirSync(target);
    writeFileSync(path.join(target, "target.txt"), "target-survives", { encoding: "utf8", flag: "wx" });
    symlinkSync(target, root, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => utilities.reclaimEmptyTaskArtifactsRoot(), /reparse point or non-directory/u);
    assert.equal(readFileSync(path.join(target, "target.txt"), "utf8"), "target-survives");
    unlinkSync(root);

    for (const [code, status] of [["ENOENT", "absent"], ["ENOTEMPTY", "nonempty"]]) {
      mkdirSync(root);
      const error = codedError(code);
      assert.deepEqual(
        utilities.reclaimEmptyTaskArtifactsRoot({ removeRoot() { throw error; } }),
        { status },
      );
      assert.equal(existsSync(root), true);
      rmdirSync(root);
    }

    for (const code of ["EACCES", "EPERM", "EIO"]) {
      mkdirSync(root);
      const error = codedError(code);
      assert.throws(
        () => utilities.reclaimEmptyTaskArtifactsRoot({ removeRoot() { throw error; } }),
        (observed) => observed === error,
      );
      assert.equal(existsSync(root), true);
      rmdirSync(root);
    }

    mkdirSync(root);
    assert.throws(
      () => utilities.reclaimEmptyTaskArtifactsRoot(
        utilities.artifactRootReclaimTestOptions({ ATO_TEST_TASK_ARTIFACT_RECLAIM_ERROR: "EACCES" }),
      ),
      (error) => error?.code === "EACCES",
    );
    assert.equal(existsSync(root), true);
    rmdirSync(root);
    assert.throws(
      () => utilities.artifactRootReclaimTestOptions({ ATO_TEST_TASK_ARTIFACT_RECLAIM_ERROR: "ENOENT" }),
      /must be EACCES, EPERM, or EIO/u,
    );
  });
});

function runWorker(workerId, barrierPath, cycles) {
  const fixture = path.join(repoRoot, "test", "fixtures", "artifact-concurrency-worker.mjs");
  const child = spawn(process.execPath, [fixture, String(workerId), barrierPath, String(cycles)], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

function runCapturedChild(script, args = [], options = {}) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? { ...process.env },
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 60_000,
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
  return { child, completion, stdout: () => stdout, stderr: () => stderr };
}

test("nested SQLite defers fixed-root reclaim while a sibling creator is active", async () => {
  const fixture = path.join(repoRoot, "test", "fixtures", "artifact-concurrency-worker.mjs");
  const paused = runCapturedChild(fixture, ["pause-after-root-inspection"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let released = false;
  try {
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`paused creator timed out: ${paused.stderr()}`)), 30_000);
      const observe = () => {
        if (!paused.stdout().includes("ROOT_INSPECTED\n")) return;
        clearTimeout(deadline);
        resolve();
      };
      paused.child.stdout.on("data", observe);
      observe();
    });
    assert.equal(existsSync(taskArtifactsRoot), true);

    const sqlite = runCapturedChild(path.join(repoRoot, "scripts", "sqlite-feasibility.mjs"), ["--json"], {
      env: { ...process.env, NODE_TEST_CONTEXT: "" },
    });
    const sqliteResult = await sqlite.completion;
    assert.equal(
      sqliteResult.status,
      0,
      `nested SQLite failed (${sqliteResult.signal}): ${sqliteResult.stderr || sqliteResult.stdout}`,
    );
    assert.equal(existsSync(taskArtifactsRoot), true, "nested SQLite reclaimed the shared root before global quiescence");

    paused.child.stdin.end("R");
    released = true;
    const creatorResult = await paused.completion;
    assert.equal(
      creatorResult.status,
      0,
      `paused creator failed (${creatorResult.signal}): ${creatorResult.stderr || creatorResult.stdout}`,
    );
    assert.match(creatorResult.stdout, /"status":"created-and-removed"/u);
    assert.equal(existsSync(taskArtifactsRoot), true);
  } finally {
    if (!released && !paused.child.stdin.destroyed) paused.child.stdin.end("R");
    await paused.completion;
  }
});

test("independent workers keep a stable shared root across repeated generation cycles", async () => {
  const workerCount = 8;
  const cycles = 25;
  const controller = createOwnedGeneration("concurrency-controller");
  const barrierPath = path.join(controller, "start.barrier");
  try {
    const workers = Array.from({ length: workerCount }, (_, workerId) => runWorker(workerId, barrierPath, cycles));
    writeFileSync(barrierPath, "start", { encoding: "utf8", flag: "wx" });
    const results = await Promise.all(workers);
    const names = [];
    for (const [workerId, result] of results.entries()) {
      assert.equal(result.status, 0, `worker ${workerId} failed (${result.signal}): ${result.stderr || result.stdout}`);
      const parsed = JSON.parse(result.stdout.trim());
      assert.equal(parsed.workerId, String(workerId));
      assert.equal(parsed.generations.length, cycles);
      names.push(...parsed.generations);
    }
    assert.equal(names.length, workerCount * cycles);
    assert.equal(new Set(names).size, names.length);
    assert.equal(
      readdirSync(taskArtifactsRoot).some((name) => name.startsWith("concurrency-w")),
      false,
    );
  } finally {
    if (existsSync(barrierPath)) unlinkSync(barrierPath);
    removeOwnedGeneration(controller);
  }
});
