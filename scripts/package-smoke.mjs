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
import { userInfo } from "node:os";
import { gunzipSync } from "node:zlib";
import { createOwnedGeneration, invariant, removeOwnedGeneration, repoRoot } from "./repo-utils.mjs";

function pnpm(args, cwd, storeDir = undefined, extraEnv = {}) {
  const cli = process.env.npm_execpath;
  invariant(cli && existsSync(cli), "package smoke must run through the pinned pnpm command");
  const invocation = storeDir === undefined ? args : [`--store-dir=${storeDir}`, ...args];
  const result = spawnSync(process.execPath, [cli, ...invocation], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv, npm_config_offline: "true" },
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

function invokeNodeCli(entryPath, args, cwd, extraEnv = {}) {
  const result = spawnSync(process.execPath, [entryPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    windowsHide: true,
  });
  return Object.freeze({
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

const expectedEntries = [
  "package/LICENSE",
  "package/README.md",
  "package/dist/application.d.ts",
  "package/dist/application.d.ts.map",
  "package/dist/application.js",
  "package/dist/application.js.map",
  "package/dist/authorization.d.ts",
  "package/dist/authorization.d.ts.map",
  "package/dist/authorization.js",
  "package/dist/authorization.js.map",
  "package/dist/cli-api.d.ts",
  "package/dist/cli-api.d.ts.map",
  "package/dist/cli-api.js",
  "package/dist/cli-api.js.map",
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
  "package/dist/persistence/application-repository.d.ts",
  "package/dist/persistence/application-repository.d.ts.map",
  "package/dist/persistence/application-repository.js",
  "package/dist/persistence/application-repository.js.map",
  "package/dist/persistence/backup.d.ts",
  "package/dist/persistence/backup.d.ts.map",
  "package/dist/persistence/backup.js",
  "package/dist/persistence/backup.js.map",
  "package/dist/persistence/database.d.ts",
  "package/dist/persistence/database.d.ts.map",
  "package/dist/persistence/database.js",
  "package/dist/persistence/database.js.map",
  "package/dist/persistence/doctor.d.ts",
  "package/dist/persistence/doctor.d.ts.map",
  "package/dist/persistence/doctor.js",
  "package/dist/persistence/doctor.js.map",
  "package/dist/persistence/errors.d.ts",
  "package/dist/persistence/errors.d.ts.map",
  "package/dist/persistence/errors.js",
  "package/dist/persistence/errors.js.map",
  "package/dist/persistence/index.d.ts",
  "package/dist/persistence/index.d.ts.map",
  "package/dist/persistence/index.js",
  "package/dist/persistence/index.js.map",
  "package/dist/persistence/local-ingress.d.ts",
  "package/dist/persistence/local-ingress.d.ts.map",
  "package/dist/persistence/local-ingress.js",
  "package/dist/persistence/local-ingress.js.map",
  "package/dist/persistence/migrations.d.ts",
  "package/dist/persistence/migrations.d.ts.map",
  "package/dist/persistence/migrations.js",
  "package/dist/persistence/migrations.js.map",
  "package/dist/persistence/repository.d.ts",
  "package/dist/persistence/repository.d.ts.map",
  "package/dist/persistence/repository.js",
  "package/dist/persistence/repository.js.map",
  "package/dist/persistence/runtime.d.ts",
  "package/dist/persistence/runtime.d.ts.map",
  "package/dist/persistence/runtime.js",
  "package/dist/persistence/runtime.js.map",
  "package/dist/persistence/store.d.ts",
  "package/dist/persistence/store.d.ts.map",
  "package/dist/persistence/store.js",
  "package/dist/persistence/store.js.map",
  "package/dist/persistence/values.d.ts",
  "package/dist/persistence/values.d.ts.map",
  "package/dist/persistence/values.js",
  "package/dist/persistence/values.js.map",
  "package/dist/project-registry.d.ts",
  "package/dist/project-registry.d.ts.map",
  "package/dist/project-registry.js",
  "package/dist/project-registry.js.map",
  "package/migrations/0001-persistence-metadata.sql",
  "package/migrations/0002-phase1-task-storage.sql",
  "package/migrations/0003-phase1-application.sql",
  "package/migrations/0004-phase1-cli.sql",
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
    `${JSON.stringify({ name: "ato-package-consumer", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  pnpm(["add", "--offline", "--ignore-scripts", tgzPath], consumer, storeDir);

  writeFileSync(
    path.join(consumer, "index.ts"),
    `import {
  AUTHORIZATION_ACTIONS,
  createApplicationService,
  currentSchemaVersion,
  getScaffoldStatus,
  inspectProjectRoot,
  type ApplicationIngress,
  type OpenPersistenceOptions,
  type RuntimeRootRequest,
} from "agent-task-orchestrator";

const options: OpenPersistenceOptions = { applicationVersion: "package-smoke" };
const request: RuntimeRootRequest = {
  runtimeRoot: "C:/package-smoke/runtime",
  sourceCheckoutRoot: "C:/package-smoke/checkout",
  projectRoots: ["C:/package-smoke/project"],
};
void options;
void request;
void currentSchemaVersion();
void getScaffoldStatus();
void AUTHORIZATION_ACTIONS;
void createApplicationService;
void inspectProjectRoot;
const ingress = null as unknown as ApplicationIngress;
void ingress;
`,
    "utf8",
  );
  writeFileSync(
    path.join(consumer, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2024",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["ES2024", "DOM"],
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        files: ["index.ts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const consumerTypecheck = spawnSync(
    process.execPath,
    [path.join(frozenInstall, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
    { cwd: consumer, encoding: "utf8", windowsHide: true },
  );
  invariant(
    consumerTypecheck.status === 0,
    `packed declaration consumer failed: ${consumerTypecheck.stderr || consumerTypecheck.stdout}`,
  );

  const runtimeRoot = path.join(generation, "runtime");
  const checkoutRoot = path.join(generation, "checkout");
  const projectRoot = path.join(generation, "project");
  mkdirSync(checkoutRoot);
  mkdirSync(projectRoot);

  const importResult = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { randomUUID } from "node:crypto";
      import("agent-task-orchestrator").then(async (m) => {
        const layout = m.prepareRuntimeLayout({
          runtimeRoot: process.env.ATO_SMOKE_RUNTIME,
          sourceCheckoutRoot: process.env.ATO_SMOKE_CHECKOUT,
          projectRoots: [process.env.ATO_SMOKE_PROJECT],
        });
        const store = await m.openPersistence(layout, { applicationVersion: "package-smoke" });
        const issuedAt = new Date().toISOString();
        const expiresAt = new Date(Date.parse(issuedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
        const service = m.createApplicationService(store, {
          currentActor: () => ({ actorId: "package-actor", principal: "A".repeat(64) }),
          now: () => issuedAt,
          nextId: () => randomUUID(),
          confirmHighRisk: () => true,
        });
        const bootstrap = service.bootstrap({ kind: "authorization.bootstrap", expiresAt });
        if (!bootstrap.ok) throw new Error("package bootstrap was rejected");
        const project = service.execute({ kind: "project.register", projectId: "project", root: process.env.ATO_SMOKE_PROJECT });
        if (!project.ok) throw new Error("package Project registration was rejected");
        const task = service.execute({
          kind: "task.create",
          projectId: "project",
          expectedProjectResourceRevision: 1,
          taskId: "task",
          body: "body",
          supersedesTaskId: null,
        });
        if (!task.ok) throw new Error("package Task creation was rejected");
        const generationId = randomUUID();
        const backupAuthorization = service.execute({
          kind: "runtime.backup",
          backupGenerationId: generationId,
        });
        if (!backupAuthorization.ok) throw new Error("package backup authorization was rejected");
        const backup = await store.createBackup(backupAuthorization.value);
        const verified = m.verifyBackupGeneration(layout, backup.generationId);
        await store.close();
        console.log(JSON.stringify({
          status: m.getScaffoldStatus(),
          states: m.TASK_STATES,
          snapshot: project.value.projectId === "project" && task.value.id === "task",
          schema: m.currentSchemaVersion(),
          backup: verified.generationId === backup.generationId,
        }));
      }).catch((error) => { console.error(error); process.exitCode = 1; })`,
    ],
    {
      cwd: consumer,
      encoding: "utf8",
      env: {
        ...process.env,
        ATO_SMOKE_RUNTIME: runtimeRoot,
        ATO_SMOKE_CHECKOUT: checkoutRoot,
        ATO_SMOKE_PROJECT: projectRoot,
      },
      windowsHide: true,
    },
  );
  invariant(importResult.status === 0, `package export failed: ${importResult.stderr}`);
  const imported = JSON.parse(importResult.stdout.trim());
  invariant(
    imported.status.phase === "phase1-local-product-cli" &&
      imported.status.domainCoreImplemented === true &&
      imported.status.persistenceFoundationImplemented === true &&
      imported.status.projectRegistryImplemented === true &&
      imported.status.runtimeAuthorizationImplemented === true &&
      imported.status.applicationServiceImplemented === true &&
      imported.status.localPhase1ProductCliImplemented === true &&
      imported.status.backupRestoreDoctorImplemented === true &&
      imported.status.productRuntimeImplemented === false &&
      imported.status.executionRuntimeImplemented === false &&
      JSON.stringify(imported.states) === JSON.stringify(["idea", "ready", "running", "waiting", "completed", "cancelled"]) &&
      imported.snapshot === true &&
      imported.schema === 4 &&
      imported.backup === true,
    "package export Domain Core, persistence registry, or capability status drifted",
  );

  const cliEnvironment = {};
  const parityRoot = path.join(
    userInfo({ encoding: "utf8" }).homedir,
    "AppData",
    "Local",
    "agent-task-orchestrator",
    `package-smoke-${path.basename(generation)}`,
  );
  const positiveArgs = ["--format", "json", "--runtime-root", parityRoot, "doctor"];
  const humanArgs = ["--format", "human", "--runtime-root", parityRoot, "doctor"];
  const negativeArgs = ["--format", "json", "unknown", "private-input-must-not-echo"];
  const sourceCli = path.join(repoRoot, "src", "cli.ts");
  const builtCli = path.join(repoRoot, "dist", "cli.js");
  const installedCli = path.join(consumer, "node_modules", "agent-task-orchestrator", "dist", "cli.js");
  const positiveResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, positiveArgs, consumer, cliEnvironment));
  const humanResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, humanArgs, consumer, cliEnvironment));
  const negativeResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, negativeArgs, consumer, cliEnvironment));
  const expectedPositive = {
    status: 0,
    stdout: '{"apiVersion":"ato.api/v1","command":"doctor","ok":true,"result":{"health":"not_initialized","initialized":false,"schemaVersion":null,"activeUse":false,"backupInventory":"empty","restoreState":"none"}}\n',
    stderr: "",
  };
  const expectedNegative = {
    status: 2,
    stdout: '{"apiVersion":"ato.api/v1","command":"unknown","ok":false,"error":{"code":"CLI_INVALID_INPUT","message":"The command input is invalid."}}\n',
    stderr: "",
  };
  const expectedHuman = {
    status: 0,
    stdout: 'OK doctor health="not_initialized" initialized=false schemaVersion=null activeUse=false backupInventory="empty" restoreState="none"\n',
    stderr: "",
  };
  for (const observed of positiveResults) {
    invariant(JSON.stringify(observed) === JSON.stringify(expectedPositive), `positive CLI parity drifted: ${JSON.stringify(observed)}`);
  }
  for (const observed of negativeResults) {
    invariant(JSON.stringify(observed) === JSON.stringify(expectedNegative), `negative CLI parity drifted: ${JSON.stringify(observed)}`);
    invariant(!observed.stdout.includes("private-input-must-not-echo"), "CLI reflected private input");
  }
  for (const observed of humanResults) {
    invariant(
      JSON.stringify(observed) === JSON.stringify(expectedHuman),
      `human CLI parity drifted: ${JSON.stringify(observed)}`,
    );
  }
  invariant(!existsSync(parityRoot), "read-only doctor created the absent runtime root");
  const installedBin = pnpm(["exec", "ato", ...positiveArgs], consumer, undefined, cliEnvironment);
  invariant(installedBin.stdout === expectedPositive.stdout && installedBin.stderr === "", "installed package bin drifted from direct CLI entry");

  pnpm(["remove", "agent-task-orchestrator"], consumer, storeDir);
  invariant(!existsSync(path.join(consumer, "node_modules", "agent-task-orchestrator")), "package uninstall left the installed package");
  console.log(
    JSON.stringify({
      status: "passed",
      packageManager: `pnpm@${packageManagerVersion}`,
      frozenInstall: "typescript@5.9.3",
      packedFiles: entries.length,
      consumerTypes: "passed",
      export: "passed",
      persistence: "passed",
      console: "source-built-installed parity passed",
      uninstall: "passed",
    }),
  );
} finally {
  removeOwnedGeneration(generation);
}
