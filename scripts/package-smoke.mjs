import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createOwnedGeneration, invariant, removeOwnedGeneration, repoRoot } from "./repo-utils.mjs";

function pnpm(args, cwd, storeDir = undefined) {
  const cli = process.env.npm_execpath;
  invariant(cli && existsSync(cli), "package smoke must run through the pinned pnpm command");
  const invocation = storeDir === undefined ? args : [`--store-dir=${storeDir}`, ...args];
  const result = spawnSync(process.execPath, [cli, ...invocation], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_offline: "true" },
    windowsHide: true,
  });
  invariant(result.status === 0, `pnpm ${invocation.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}

function copyOfflineStoreSeed(source, destination) {
  invariant(existsSync(source), "worktree-local pnpm store is absent; run the frozen install before offline verification");
  const copyRegularTree = (currentSource, currentDestination, relative) => {
    const stat = lstatSync(currentSource);
    invariant(!stat.isSymbolicLink(), `refusing reparse/symlink in pnpm store seed: ${relative}`);
    if (stat.isDirectory()) {
      mkdirSync(currentDestination);
      for (const name of readdirSync(currentSource).sort()) {
        const childRelative = relative ? `${relative}/${name}` : name;
        if (/^v\d+\/projects$/u.test(childRelative)) {
          continue;
        }
        copyRegularTree(
          path.join(currentSource, name),
          path.join(currentDestination, name),
          childRelative,
        );
      }
      return;
    }
    invariant(stat.isFile(), `refusing nonregular pnpm store seed member: ${relative}`);
    copyFileSync(currentSource, currentDestination);
  };
  copyRegularTree(source, destination, "");
}

function tarEntries(tgzPath) {
  const tar = gunzipSync(readFileSync(tgzPath));
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const readString = (start, length) => header.subarray(start, start + length).toString("utf8").replace(/\0.*$/su, "");
    const name = readString(0, 100);
    const prefix = readString(345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = readString(124, 12).trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const type = String.fromCharCode(header[156] || 0);
    if (type === "0" || type === "\0") entries.push(fullName);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries.filter((item) => item.startsWith("package/")).sort();
}

const expectedEntries = [
  "package/LICENSE",
  "package/README.md",
  "package/dist/cli.d.ts",
  "package/dist/cli.d.ts.map",
  "package/dist/cli.js",
  "package/dist/cli.js.map",
  "package/dist/domain.d.ts",
  "package/dist/domain.d.ts.map",
  "package/dist/domain.js",
  "package/dist/domain.js.map",
  "package/dist/index.d.ts",
  "package/dist/index.d.ts.map",
  "package/dist/index.js",
  "package/dist/index.js.map",
  "package/package.json",
].sort();

const packageManagerVersion = pnpm(["--version"], repoRoot).stdout.trim();
invariant(packageManagerVersion === "11.19.0", `pnpm version drifted: ${packageManagerVersion}`);

const generation = createOwnedGeneration("package");
try {
  const storeDir = path.join(generation, "pnpm-store");
  copyOfflineStoreSeed(path.join(repoRoot, ".pnpm-store"), storeDir);
  const frozenInstall = path.join(generation, "frozen-install");
  mkdirSync(frozenInstall);
  copyFileSync(path.join(repoRoot, "package.json"), path.join(frozenInstall, "package.json"));
  copyFileSync(path.join(repoRoot, "pnpm-lock.yaml"), path.join(frozenInstall, "pnpm-lock.yaml"));
  pnpm(
    ["install", "--offline", "--frozen-lockfile", "--ignore-scripts", "--registry=https://registry.npmjs.org/"],
    frozenInstall,
    storeDir,
  );
  const installedCompiler = JSON.parse(
    readFileSync(path.join(frozenInstall, "node_modules", "typescript", "package.json"), "utf8"),
  );
  invariant(installedCompiler.name === "typescript" && installedCompiler.version === "5.9.3", "frozen install compiler drifted");

  pnpm(["pack", "--pack-destination", generation], repoRoot);
  const tgz = readdirSync(generation).find((item) => item.endsWith(".tgz"));
  invariant(tgz, "pnpm pack did not create a tarball");
  const tgzPath = path.join(generation, tgz);
  const entries = tarEntries(tgzPath);
  invariant(JSON.stringify(entries) === JSON.stringify(expectedEntries), `packed inventory drifted: ${entries.join(", ")}`);

  const consumer = path.join(generation, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "ep00b-package-consumer", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  pnpm(["add", "--offline", "--ignore-scripts", tgzPath], consumer, storeDir);

  const importResult = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "import('agent-task-orchestrator').then((m) => console.log(JSON.stringify({status:m.getScaffoldStatus(),states:m.TASK_STATES,snapshot:m.createDomainSnapshot({projects:[],tasks:[]}).ok})))",
    ],
    { cwd: consumer, encoding: "utf8", windowsHide: true },
  );
  invariant(importResult.status === 0, `package export failed: ${importResult.stderr}`);
  const imported = JSON.parse(importResult.stdout.trim());
  invariant(
    imported.status.phase === "domain-core" &&
      imported.status.domainCoreImplemented === true &&
      imported.status.productRuntimeImplemented === false &&
      JSON.stringify(imported.states) === JSON.stringify(["idea", "ready", "running", "waiting", "completed", "cancelled"]) &&
      imported.snapshot === true,
    "package export Domain Core or capability status drifted",
  );

  const cliResult = pnpm(["exec", "ato"], consumer);
  invariant(JSON.parse(cliResult.stdout).productRuntimeImplemented === false, "console entry overstated runtime capability");

  pnpm(["remove", "agent-task-orchestrator"], consumer, storeDir);
  invariant(!existsSync(path.join(consumer, "node_modules", "agent-task-orchestrator")), "package uninstall left the installed package");
  console.log(
    JSON.stringify({
      status: "passed",
      packageManager: `pnpm@${packageManagerVersion}`,
      frozenInstall: "typescript@5.9.3",
      packedFiles: entries.length,
      export: "passed",
      console: "passed",
      uninstall: "passed",
    }),
  );
} finally {
  removeOwnedGeneration(generation);
}
