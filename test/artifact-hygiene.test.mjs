import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import { createOwnedGeneration, removeOwnedGeneration, repoRoot } from "../scripts/repo-utils.mjs";
import {
  assertArtifactSnapshotUnchanged,
  captureArtifactSnapshot,
  executeNodeTests,
} from "../scripts/test-runner.mjs";

function childTestSource(body) {
  return [
    'import test from "node:test";',
    'import { mkdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";',
    'import path from "node:path";',
    'const root = process.env.ATO_HYGIENE_FIXTURE_ROOT;',
    'const marker = path.join(root, "diagnostic.txt");',
    `test("nested fixture", () => { ${body} });`,
    "",
  ].join("\n");
}

test("artifact snapshots detect absent-root, addition, removal, and replacement without deleting evidence", () => {
  const generation = createOwnedGeneration("hygiene-snapshot");
  const root = path.join(generation, "artifacts");
  const marker = path.join(root, "diagnostic.txt");
  const displaced = path.join(root, "diagnostic.displaced.txt");
  try {
    const absent = captureArtifactSnapshot(root);
    assert.equal(absent.exists, false);
    assertArtifactSnapshotUnchanged(absent, root);

    mkdirSync(root);
    assert.throws(() => assertArtifactSnapshotUnchanged(absent, root), /changed the task-artifact baseline/u);
    writeFileSync(marker, "original-diagnostic", { encoding: "utf8", flag: "wx" });
    const baseline = captureArtifactSnapshot(root);

    const added = path.join(root, "added.txt");
    writeFileSync(added, "added-diagnostic", { encoding: "utf8", flag: "wx" });
    assert.throws(() => assertArtifactSnapshotUnchanged(baseline, root), /changed the task-artifact baseline/u);
    assert.equal(readFileSync(added, "utf8"), "added-diagnostic");
    unlinkSync(added);
    assertArtifactSnapshotUnchanged(baseline, root);

    renameSync(marker, displaced);
    writeFileSync(marker, "replacement-diagnostic", { encoding: "utf8", flag: "wx" });
    assert.throws(() => assertArtifactSnapshotUnchanged(baseline, root), /changed the task-artifact baseline/u);
    assert.equal(readFileSync(marker, "utf8"), "replacement-diagnostic");
    assert.equal(readFileSync(displaced, "utf8"), "original-diagnostic");

    unlinkSync(marker);
    unlinkSync(displaced);
    const empty = captureArtifactSnapshot(root);
    writeFileSync(marker, "removed-diagnostic", { encoding: "utf8", flag: "wx" });
    const removalBaseline = captureArtifactSnapshot(root);
    unlinkSync(marker);
    assert.throws(() => assertArtifactSnapshotUnchanged(removalBaseline, root), /changed the task-artifact baseline/u);
    assertArtifactSnapshotUnchanged(empty, root);
    rmdirSync(root);
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("successful child tests preserve an absent or nonempty diagnostic baseline", () => {
  const generation = createOwnedGeneration("hygiene-success");
  const root = path.join(generation, "artifacts");
  const child = path.join(generation, "success.test.mjs");
  try {
    writeFileSync(child, childTestSource(""), { encoding: "utf8", flag: "wx" });
    const childOptions = {
      artifactRoot: root,
      env: { ...process.env, ATO_HYGIENE_FIXTURE_ROOT: root },
      stdio: "pipe",
    };
    const absentResult = executeNodeTests([child], childOptions);
    assert.equal(absentResult.status, 0, absentResult.stderr || absentResult.stdout);
    assert.equal(absentResult.hygieneChecked, true);

    mkdirSync(root);
    writeFileSync(path.join(root, "earlier-failure.txt"), "retained", { encoding: "utf8", flag: "wx" });
    const retainedResult = executeNodeTests([child], childOptions);
    assert.equal(retainedResult.status, 0, retainedResult.stderr || retainedResult.stdout);
    assert.equal(retainedResult.baselineEntries, retainedResult.terminalEntries);
    assert.equal(readFileSync(path.join(root, "earlier-failure.txt"), "utf8"), "retained");
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("a passing child that leaks scratch fails hygiene and preserves the leak", () => {
  const generation = createOwnedGeneration("hygiene-leak");
  const root = path.join(generation, "artifacts");
  const child = path.join(generation, "leak.test.mjs");
  const marker = path.join(root, "diagnostic.txt");
  try {
    writeFileSync(
      child,
      childTestSource('mkdirSync(root); writeFileSync(marker, "successful-leak", { encoding: "utf8", flag: "wx" });'),
      { encoding: "utf8", flag: "wx" },
    );
    let result;
    let hygieneError;
    try {
      result = executeNodeTests([child], {
        artifactRoot: root,
        env: { ...process.env, ATO_HYGIENE_FIXTURE_ROOT: root },
        stdio: "pipe",
      });
    } catch (error) {
      hygieneError = error;
    }
    assert.match(hygieneError?.message ?? JSON.stringify(result), /changed the task-artifact baseline/u);
    assert.equal(readFileSync(marker, "utf8"), "successful-leak");
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("a failing child retains diagnostics and bypasses the success-only hygiene claim", () => {
  const generation = createOwnedGeneration("hygiene-failure");
  const root = path.join(generation, "artifacts");
  const child = path.join(generation, "failure.test.mjs");
  const marker = path.join(root, "diagnostic.txt");
  try {
    writeFileSync(
      child,
      childTestSource(
        'mkdirSync(root); writeFileSync(marker, "failed-diagnostic", { encoding: "utf8", flag: "wx" }); throw new Error("expected child failure");',
      ),
      { encoding: "utf8", flag: "wx" },
    );
    const result = executeNodeTests([child], {
      artifactRoot: root,
      env: { ...process.env, ATO_HYGIENE_FIXTURE_ROOT: root },
      stdio: "pipe",
    });
    assert.notEqual(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.hygieneChecked, false);
    assert.equal(readFileSync(marker, "utf8"), "failed-diagnostic");
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("artifact snapshots reject Windows root and descendant junctions without touching targets", { skip: process.platform !== "win32" }, () => {
  const generation = createOwnedGeneration("hygiene-reparse");
  const target = path.join(generation, "target");
  const rootJunction = path.join(generation, "root-junction");
  const regularRoot = path.join(generation, "regular-root");
  const childJunction = path.join(regularRoot, "child-junction");
  const targetMarker = path.join(target, "must-survive.txt");
  try {
    mkdirSync(target);
    writeFileSync(targetMarker, "target-survives", { encoding: "utf8", flag: "wx" });
    symlinkSync(target, rootJunction, "junction");
    assert.throws(() => captureArtifactSnapshot(rootJunction), /reparse point/u);
    assert.equal(readFileSync(targetMarker, "utf8"), "target-survives");
    unlinkSync(rootJunction);

    mkdirSync(regularRoot);
    symlinkSync(target, childJunction, "junction");
    assert.throws(() => captureArtifactSnapshot(regularRoot), /symlink or reparse point/u);
    assert.equal(readFileSync(targetMarker, "utf8"), "target-survives");
    unlinkSync(childJunction);
    rmdirSync(regularRoot);
  } finally {
    if (existsSync(rootJunction)) unlinkSync(rootJunction);
    if (existsSync(childJunction)) unlinkSync(childJunction);
    removeOwnedGeneration(generation);
  }
});

test("the hygiene runner defaults to the repository and does not depend on caller cwd", () => {
  const generation = createOwnedGeneration("hygiene-cwd");
  const root = path.join(generation, "artifacts");
  const child = path.join(generation, "cwd.test.mjs");
  try {
    writeFileSync(child, childTestSource('if (process.cwd() !== process.env.ATO_EXPECTED_CWD) throw new Error("wrong cwd");'), {
      encoding: "utf8",
      flag: "wx",
    });
    const result = executeNodeTests([child], {
      artifactRoot: root,
      cwd: repoRoot,
      env: {
        ...process.env,
        ATO_EXPECTED_CWD: repoRoot,
        ATO_HYGIENE_FIXTURE_ROOT: root,
      },
      stdio: "pipe",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("an empty runner selector preserves native recursive Node test discovery", () => {
  const generation = createOwnedGeneration("hygiene-discovery");
  const fixtureRoot = path.join(generation, "fixture");
  const nestedTests = path.join(fixtureRoot, "test", "nested");
  const child = path.join(nestedTests, "discovered.test.mjs");
  const marker = path.join(fixtureRoot, "discovered.txt");
  const artifactRoot = path.join(generation, "observed-artifacts");
  try {
    mkdirSync(nestedTests, { recursive: true });
    writeFileSync(
      child,
      [
        'import test from "node:test";',
        'import { writeFileSync } from "node:fs";',
        'test("native nested discovery", () => {',
        '  writeFileSync(process.env.ATO_DISCOVERY_MARKER, "discovered", { encoding: "utf8", flag: "wx" });',
        '});',
        "",
      ].join("\n"),
      { encoding: "utf8", flag: "wx" },
    );
    const result = executeNodeTests([], {
      artifactRoot,
      cwd: fixtureRoot,
      env: { ...process.env, ATO_DISCOVERY_MARKER: marker },
      stdio: "pipe",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.hygieneChecked, true);
    assert.equal(readFileSync(marker, "utf8"), "discovered");
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("a direct runner invocation fails closed on an unowned inherited test context", () => {
  const childEnv = { ...process.env, NODE_TEST_CONTEXT: "sentinel" };
  delete childEnv.ATO_TEST_RUNNER_CHILD;
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "test-runner.mjs")], {
    cwd: repoRoot,
    encoding: "utf8",
    env: childEnv,
    stdio: "pipe",
    windowsHide: true,
  });
  assert.notEqual(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stderr, /refuses an unowned inherited NODE_TEST_CONTEXT/u);
});
