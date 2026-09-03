import assert from "node:assert/strict";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  inspectProjectRoot,
  revalidateProjectRoot,
} from "../src/index.ts";
import {
  exactProjectFilesystemIdentity,
  inspectTrustedRuntimeRoot,
} from "../src/project-registry.ts";
import { createOwnedGeneration, removeOwnedGeneration } from "../scripts/repo-utils.mjs";

function assertExactBigIntIdentity(receipt, target) {
  const stats = lstatSync(target, { bigint: true });
  assert.equal(receipt.device, String(stats.dev));
  assert.equal(receipt.inode, String(stats.ino));
  assert.equal(receipt.mode, Number(stats.mode));
  return stats;
}

function expectRegistryError(error, code) {
  assert.equal(error?.name, "ProjectRegistryError");
  assert.equal(error?.code, code);
  return true;
}

test("ProjectRegistry issues a canonical no-follow identity receipt without changing Project content", () => {
  const generation = createOwnedGeneration("project-registry");
  try {
    const projectRoot = path.join(generation, "project");
    const runtimeRoot = path.join(generation, "runtime");
    mkdirSync(projectRoot);
    mkdirSync(runtimeRoot);
    const marker = path.join(projectRoot, "marker.txt");
    writeFileSync(marker, "unchanged");
    const receipt = inspectProjectRoot(projectRoot, runtimeRoot);
    const runtimeReceipt = inspectTrustedRuntimeRoot(runtimeRoot);
    assert.equal(receipt.canonicalRoot, projectRoot);
    assert.equal(receipt.rootKey, process.platform === "win32" ? projectRoot.toLowerCase() : projectRoot);
    const projectStats = assertExactBigIntIdentity(receipt, projectRoot);
    const runtimeStats = assertExactBigIntIdentity(runtimeReceipt, runtimeRoot);
    assert.equal(projectStats.isDirectory(), true);
    assert.equal(runtimeStats.isDirectory(), true);
    const highBitInode = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
    assert.notEqual(String(highBitInode), String(Number(highBitInode)));
    assert.deepEqual(
      exactProjectFilesystemIdentity({ dev: highBitInode + 2n, ino: highBitInode, mode: 0o40755n }),
      { device: String(highBitInode + 2n), inode: String(highBitInode), mode: 0o40755 },
    );
    assert.throws(
      () => exactProjectFilesystemIdentity({
        dev: highBitInode + 2n,
        ino: highBitInode,
        mode: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      }),
      (error) => expectRegistryError(error, "PROJECT_IDENTITY_UNCERTAIN"),
    );
    assert.equal(readFileSync(marker, "utf8"), "unchanged");
    assert.deepEqual(revalidateProjectRoot(receipt, runtimeRoot), receipt);
    assert.equal(Object.isFrozen(receipt), true);
  } finally {
    removeOwnedGeneration(generation);
  }
});

test("ProjectRegistry rejects lexical ambiguity, missing roots, runtime overlap, aliases, and identity substitution", () => {
  const generation = createOwnedGeneration("project-registry-negative");
  try {
    const projectRoot = path.join(generation, "project");
    const runtimeRoot = path.join(generation, "runtime");
    mkdirSync(projectRoot);
    mkdirSync(runtimeRoot);
    assert.throws(() => inspectProjectRoot("relative", runtimeRoot), (error) => expectRegistryError(error, "INVALID_PROJECT_ROOT"));
    assert.throws(() => inspectProjectRoot(path.parse(projectRoot).root, runtimeRoot), (error) => expectRegistryError(error, "INVALID_PROJECT_ROOT"));
    assert.throws(() => inspectProjectRoot(path.join(generation, "missing"), runtimeRoot), (error) => expectRegistryError(error, "PROJECT_ROOT_MISSING"));
    assert.throws(() => inspectProjectRoot(runtimeRoot, runtimeRoot), (error) => expectRegistryError(error, "PROJECT_RUNTIME_OVERLAP"));
    assert.throws(() => inspectProjectRoot(generation, runtimeRoot), (error) => expectRegistryError(error, "PROJECT_RUNTIME_OVERLAP"));

    const alias = path.join(generation, "alias");
    symlinkSync(projectRoot, alias, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => inspectProjectRoot(alias, runtimeRoot), (error) => expectRegistryError(error, "PROJECT_ROOT_REPARSE"));

    const receipt = inspectProjectRoot(projectRoot, runtimeRoot);
    const moved = path.join(generation, "project-original");
    renameSync(projectRoot, moved);
    mkdirSync(projectRoot);
    assert.throws(() => revalidateProjectRoot(receipt, runtimeRoot), (error) => expectRegistryError(error, "PROJECT_IDENTITY_CHANGED"));
  } finally {
    removeOwnedGeneration(generation);
  }
});
