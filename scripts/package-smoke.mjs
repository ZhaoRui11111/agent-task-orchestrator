import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  artifactRootReclaimTestOptions,
  createOwnedGeneration,
  invariant,
  reclaimEmptyTaskArtifactsRoot,
  removeOwnedGeneration,
  repoRoot,
} from "./repo-utils.mjs";

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

function invokeNodeCli(entryPath, args, cwd, extraEnv = {}, nodeArgs = []) {
  const result = spawnSync(process.execPath, [...nodeArgs, entryPath, ...args], {
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

function readCliBoundaryState(entryPath, runtimeRoot, environment, nodeArgs) {
  const extension = path.extname(entryPath) === ".ts" ? ".ts" : ".js";
  const moduleRoot = path.dirname(realpathSync.native(entryPath));
  const sourceCheckoutRoot = path.resolve(moduleRoot, "..");
  const publicModule = pathToFileURL(path.join(moduleRoot, `index${extension}`)).href;
  const stateModule = pathToFileURL(path.join(moduleRoot, "persistence", `application-repository${extension}`)).href;
  const script = `const m = await import(process.env.ATO_SMOKE_PUBLIC_MODULE);
const repository = await import(process.env.ATO_SMOKE_STATE_MODULE);
const selection = m.loadLocalRuntime(process.env.ATO_SMOKE_RUNTIME, process.env.ATO_SMOKE_SOURCE_ROOT);
const store = await m.openPersistence(selection.layout, { applicationVersion: "package-cli-parity-read" });
try {
  const state = repository.readApplicationStateForOwner(store);
  const project = state.projects.find((candidate) => candidate.projectId === "parity-project");
  const task = state.domain.tasks.find((candidate) => candidate.id === "parity-task");
  const execution = state.executions.find((candidate) => candidate.taskId === "parity-task" && candidate.status === "active");
  console.log(JSON.stringify({
    schemaVersion: store.migration.schemaVersion,
    project,
    task,
    execution,
    completionDecisionCount: state.manualCompletionDecisions.length,
    dispatcherRunCount: state.dispatcherRuns.length
  }));
} finally {
  await store.close();
}`;
  const result = spawnSync(process.execPath, [...nodeArgs, "--input-type=module", "--eval", script], {
    cwd: sourceCheckoutRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...environment,
      ATO_SMOKE_PUBLIC_MODULE: publicModule,
      ATO_SMOKE_STATE_MODULE: stateModule,
      ATO_SMOKE_RUNTIME: runtimeRoot,
      ATO_SMOKE_SOURCE_ROOT: sourceCheckoutRoot,
    },
    windowsHide: true,
  });
  invariant(result.status === 0 && result.stderr === "", `package CLI parity state read failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function cliExecutionCommon(entryPath, runtimeRoot, idempotencyKey, environment, nodeArgs) {
  const state = readCliBoundaryState(entryPath, runtimeRoot, environment, nodeArgs);
  const row = state.project && state.task && state.execution ? state : null;
  invariant(row, "package CLI parity execution tuple is absent");
  return Object.freeze([
    "--project-id", row.project.projectId,
    "--expected-project-resource-revision", String(row.project.resourceRevision),
    "--expected-project-config-revision", String(row.project.configRevision),
    "--task-id", row.task.id,
    "--expected-task-revision", String(row.task.revision),
    "--execution-id", row.execution.executionId,
    "--expected-execution-revision", String(row.execution.revision),
    "--expected-attempt-number", String(row.execution.attemptNumber),
    "--expected-fencing-token", String(row.execution.fencingToken),
    "--idempotency-key", idempotencyKey,
  ]);
}

function normalizeCliBody(value, key = "") {
  if (Array.isArray(value)) return value.map((item) => normalizeCliBody(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, normalizeCliBody(child, childKey)]));
  }
  if (["runId", "executionId", "heartbeatAt", "leaseExpiresAt"].includes(key)) return `<${key}>`;
  return value;
}

function runPhase2CliBoundary(entryPath, label, runtimeRoot, projectRoot, cwd, expiry, environment, nodeArgs) {
  const transcript = [];
  const invokeJson = (args, expectedStatus = 0) => {
    const observed = invokeNodeCli(entryPath, [
      "--format", "json", "--runtime-root", runtimeRoot, ...args,
    ], cwd, environment, nodeArgs);
    invariant(observed.status === expectedStatus && observed.stderr === "", `${label} CLI command failed: ${observed.stderr || observed.stdout}`);
    invariant(observed.stdout.endsWith("\n") && observed.stdout.indexOf("\n") === observed.stdout.length - 1,
      `${label} CLI command was not one-line JSON`);
    const body = JSON.parse(observed.stdout);
    transcript.push(normalizeCliBody(body));
    return Object.freeze({ observed, body });
  };

  const initialized = invokeJson(["init", "--expires-at", expiry, "--confirm", "INITIALIZE LOCAL RUNTIME"]);
  invariant(initialized.body.ok && initialized.body.result.capabilityCount === 19, `${label} CLI init drifted`);
  const denied = invokeJson([
    "dispatch", "run", "--idempotency-key", "parity-denied", "--lease-duration-seconds", "300",
  ], 4);
  invariant(!denied.body.ok && denied.body.error.code === "AUTHORIZATION_DENIED", `${label} CLI denial drifted`);
  const deniedReplay = invokeJson([
    "dispatch", "run", "--idempotency-key", "parity-denied", "--lease-duration-seconds", "300",
  ], 4);
  invariant(deniedReplay.observed.stdout === denied.observed.stdout, `${label} denied response-loss replay drifted`);
  invariant(invokeJson([
    "project", "register", "--project-id", "parity-project", "--root", projectRoot,
    "--confirm", "REGISTER LOCAL PROJECT",
  ]).body.ok, `${label} CLI project registration drifted`);
  invariant(invokeJson([
    "task", "create", "--project-id", "parity-project", "--expected-project-resource-revision", "1",
    "--task-id", "parity-task", "--body", "PACKAGE_PARITY_SECRET_BODY",
  ]).body.ok, `${label} CLI task creation drifted`);
  invariant(invokeJson([
    "task", "mark-ready", "--project-id", "parity-project", "--expected-project-resource-revision", "1",
    "--task-id", "parity-task", "--expected-task-revision", "1",
  ]).body.ok, `${label} CLI task readiness drifted`);
  for (const expected of [23, 29, 30]) {
    const upgraded = invokeJson([
      "authorization", "upgrade", "--expires-at", expiry, "--confirm", "UPGRADE LOCAL CAPABILITIES",
    ]);
    invariant(upgraded.body.ok && upgraded.body.result.capabilityCount === expected, `${label} CLI upgrade drifted`);
  }
  const dispatched = invokeJson([
    "dispatch", "run", "--idempotency-key", "parity-dispatch", "--lease-duration-seconds", "300",
  ]);
  invariant(dispatched.body.ok && dispatched.body.result.terminalStatus === "completed", `${label} CLI dispatch drifted`);
  const dispatchReplay = invokeJson([
    "dispatch", "run", "--idempotency-key", "parity-dispatch", "--lease-duration-seconds", "300",
  ]);
  invariant(dispatchReplay.body.ok && dispatchReplay.body.result.replayed, `${label} CLI dispatch replay drifted`);
  let common = cliExecutionCommon(entryPath, runtimeRoot, "parity-inspect", environment, nodeArgs);
  const inspected = invokeJson(["execution", "inspect", ...common]);
  invariant(inspected.body.ok && inspected.body.result.lifecycle === "queued", `${label} CLI inspect drifted`);
  common = cliExecutionCommon(entryPath, runtimeRoot, "parity-report", environment, nodeArgs);
  const reported = invokeJson([
    "manual", "outcome-report", ...common,
    "--report-id", "parity-report", "--outcome", "succeed", "--code", "manual-success",
    "--confirm", "RECORD MANUAL OUTCOME",
  ]);
  invariant(reported.body.ok && reported.body.result.taskState === "running", `${label} CLI Manual report drifted`);
  common = cliExecutionCommon(entryPath, runtimeRoot, "parity-completion", environment, nodeArgs);
  const completionArgs = [
    "execution", "accept-manual-completion", ...common, "--confirm", "ACCEPT MANUAL COMPLETION",
  ];
  const completed = invokeJson(completionArgs);
  invariant(completed.body.ok && completed.body.result.taskState === "completed", `${label} CLI completion drifted`);
  const completionReplay = invokeJson(completionArgs);
  invariant(completionReplay.body.ok && completionReplay.body.result.replayed, `${label} CLI completion replay drifted`);
  const human = invokeNodeCli(entryPath, [
    "--format", "human", "--runtime-root", runtimeRoot, ...completionArgs,
  ], cwd, environment, nodeArgs);
  invariant(human.status === 0 && human.stderr === "" && human.stdout.startsWith("OK execution.accept-manual-completion ") &&
    human.stdout.endsWith("\n") && human.stdout.indexOf("\n") === human.stdout.length - 1,
  `${label} CLI human result drifted`);
  const normalizedHuman = human.stdout.replaceAll(completionReplay.body.result.executionId, "<executionId>");

  const finalState = readCliBoundaryState(entryPath, runtimeRoot, environment, nodeArgs);
  invariant(finalState.schemaVersion === 1, `${label} CLI schema drifted`);
  invariant(finalState.task?.state === "completed", `${label} CLI Task did not complete`);
  invariant(finalState.completionDecisionCount === 1, `${label} CLI completion replay duplicated a decision`);
  invariant(finalState.dispatcherRunCount === 1, `${label} CLI dispatch replay duplicated a run`);
  const raw = transcript.map((body) => JSON.stringify(body)).join("\n") + normalizedHuman;
  for (const secret of [
    "PACKAGE_PARITY_SECRET_BODY", projectRoot, runtimeRoot, "RECORD MANUAL OUTCOME", "ACCEPT MANUAL COMPLETION",
    "parity-dispatch", "parity-report", "owner-v1:", "dispatcher-v1:", "backend_execution:", "thread:",
  ]) invariant(!raw.includes(secret), `${label} CLI parity transcript leaked ${secret}`);
  return Object.freeze({ transcript: Object.freeze(transcript), human: normalizedHuman });
}

const expectedEntries = [
  "package/LICENSE",
  "package/README.md",
  "package/dist/application-domain.d.ts",
  "package/dist/application-domain.d.ts.map",
  "package/dist/application-domain.js",
  "package/dist/application-domain.js.map",
  "package/dist/application-input.d.ts",
  "package/dist/application-input.d.ts.map",
  "package/dist/application-input.js",
  "package/dist/application-input.js.map",
  "package/dist/application-model.d.ts",
  "package/dist/application-model.d.ts.map",
  "package/dist/application-model.js",
  "package/dist/application-model.js.map",
  "package/dist/application-policy.d.ts",
  "package/dist/application-policy.d.ts.map",
  "package/dist/application-policy.js",
  "package/dist/application-policy.js.map",
  "package/dist/application-service.d.ts",
  "package/dist/application-service.d.ts.map",
  "package/dist/application-service.js",
  "package/dist/application-service.js.map",
  "package/dist/application.d.ts",
  "package/dist/application.d.ts.map",
  "package/dist/application.js",
  "package/dist/application.js.map",
  "package/dist/authorization.d.ts",
  "package/dist/authorization.d.ts.map",
  "package/dist/authorization.js",
  "package/dist/authorization.js.map",
  "package/dist/cli-api-model.d.ts",
  "package/dist/cli-api-model.d.ts.map",
  "package/dist/cli-api-model.js",
  "package/dist/cli-api-model.js.map",
  "package/dist/cli-api-parser.d.ts",
  "package/dist/cli-api-parser.d.ts.map",
  "package/dist/cli-api-parser.js",
  "package/dist/cli-api-parser.js.map",
  "package/dist/cli-api-presentation.d.ts",
  "package/dist/cli-api-presentation.d.ts.map",
  "package/dist/cli-api-presentation.js",
  "package/dist/cli-api-presentation.js.map",
  "package/dist/cli-api-runtime.d.ts",
  "package/dist/cli-api-runtime.d.ts.map",
  "package/dist/cli-api-runtime.js",
  "package/dist/cli-api-runtime.js.map",
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
  "package/dist/dispatcher-application.d.ts",
  "package/dist/dispatcher-application.d.ts.map",
  "package/dist/dispatcher-application.js",
  "package/dist/dispatcher-application.js.map",
  "package/dist/dispatcher.d.ts",
  "package/dist/dispatcher.d.ts.map",
  "package/dist/dispatcher.js",
  "package/dist/dispatcher.js.map",
  "package/dist/execution-application.d.ts",
  "package/dist/execution-application.d.ts.map",
  "package/dist/execution-application.js",
  "package/dist/execution-application.js.map",
  "package/dist/execution-loop.d.ts",
  "package/dist/execution-loop.d.ts.map",
  "package/dist/execution-loop.js",
  "package/dist/execution-loop.js.map",
  "package/dist/execution-port.d.ts",
  "package/dist/execution-port.d.ts.map",
  "package/dist/execution-port.js",
  "package/dist/execution-port.js.map",
  "package/dist/index.d.ts",
  "package/dist/index.d.ts.map",
  "package/dist/index.js",
  "package/dist/index.js.map",
  "package/dist/manual-execution-backend.d.ts",
  "package/dist/manual-execution-backend.d.ts.map",
  "package/dist/manual-execution-backend.js",
  "package/dist/manual-execution-backend.js.map",
  "package/dist/persistence/application-repository-digest.d.ts",
  "package/dist/persistence/application-repository-digest.d.ts.map",
  "package/dist/persistence/application-repository-digest.js",
  "package/dist/persistence/application-repository-digest.js.map",
  "package/dist/persistence/application-repository-lifecycle.d.ts",
  "package/dist/persistence/application-repository-lifecycle.d.ts.map",
  "package/dist/persistence/application-repository-lifecycle.js",
  "package/dist/persistence/application-repository-lifecycle.js.map",
  "package/dist/persistence/application-repository-model.d.ts",
  "package/dist/persistence/application-repository-model.d.ts.map",
  "package/dist/persistence/application-repository-model.js",
  "package/dist/persistence/application-repository-model.js.map",
  "package/dist/persistence/application-repository-readers.d.ts",
  "package/dist/persistence/application-repository-readers.d.ts.map",
  "package/dist/persistence/application-repository-readers.js",
  "package/dist/persistence/application-repository-readers.js.map",
  "package/dist/persistence/application-repository-state.d.ts",
  "package/dist/persistence/application-repository-state.d.ts.map",
  "package/dist/persistence/application-repository-state.js",
  "package/dist/persistence/application-repository-state.js.map",
  "package/dist/persistence/application-repository-transaction.d.ts",
  "package/dist/persistence/application-repository-transaction.d.ts.map",
  "package/dist/persistence/application-repository-transaction.js",
  "package/dist/persistence/application-repository-transaction.js.map",
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
  "package/dist/persistence/manual-backend-repository.d.ts",
  "package/dist/persistence/manual-backend-repository.d.ts.map",
  "package/dist/persistence/manual-backend-repository.js",
  "package/dist/persistence/manual-backend-repository.js.map",
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
  "package/dist/product-runtime.d.ts",
  "package/dist/product-runtime.d.ts.map",
  "package/dist/product-runtime.js",
  "package/dist/product-runtime.js.map",
  "package/dist/project-registry.d.ts",
  "package/dist/project-registry.d.ts.map",
  "package/dist/project-registry.js",
  "package/dist/project-registry.js.map",
  "package/dist/workspace-application.d.ts",
  "package/dist/workspace-application.d.ts.map",
  "package/dist/workspace-application.js",
  "package/dist/workspace-application.js.map",
  "package/dist/workspace-port.d.ts",
  "package/dist/workspace-port.d.ts.map",
  "package/dist/workspace-port.js",
  "package/dist/workspace-port.js.map",
  "package/migrations/0001-current-baseline.sql",
  "package/package.json",
].sort();

invariant(expectedEntries.length === 180, `packed expected inventory count drifted: ${expectedEntries.length}`);

const packageManagerVersion = pnpm(["--version"], repoRoot).stdout.trim();
invariant(packageManagerVersion === "11.19.0", `pnpm version drifted: ${packageManagerVersion}`);

const generation = createOwnedGeneration("package");
try {
  const isolatedHome = path.join(generation, "isolated-home");
  mkdirSync(isolatedHome);
  const isolatedOsModule = path.join(generation, "isolated-os.mjs");
  const isolatedOsLoader = path.join(generation, "isolated-os-loader.mjs");
  writeFileSync(
    isolatedOsModule,
    `import { createRequire } from "node:module";
const realOs = createRequire(import.meta.url)("node:os");
export function userInfo(options) {
  return Object.freeze({ ...realOs.userInfo(options), homedir: process.env.ATO_SMOKE_HOME });
}
`,
    "utf8",
  );
  const isolatedSourceRoot = path.join(generation, "source-boundary");
  const isolatedBuiltRoot = path.join(generation, "built-boundary");
  mkdirSync(isolatedSourceRoot);
  mkdirSync(isolatedBuiltRoot);
  cpSync(path.join(repoRoot, "src"), path.join(isolatedSourceRoot, "src"), { recursive: true });
  cpSync(path.join(repoRoot, "migrations"), path.join(isolatedSourceRoot, "migrations"), { recursive: true });
  copyFileSync(path.join(repoRoot, "package.json"), path.join(isolatedSourceRoot, "package.json"));
  cpSync(path.join(repoRoot, "dist"), path.join(isolatedBuiltRoot, "dist"), { recursive: true });
  cpSync(path.join(repoRoot, "migrations"), path.join(isolatedBuiltRoot, "migrations"), { recursive: true });
  copyFileSync(path.join(repoRoot, "package.json"), path.join(isolatedBuiltRoot, "package.json"));
  writeFileSync(
    isolatedOsLoader,
    `const isolatedOs = new URL("./isolated-os.mjs", import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  return specifier === "node:os"
    ? { url: isolatedOs, shortCircuit: true }
    : nextResolve(specifier, context);
}
`,
    "utf8",
  );
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
  const backupDeclarations = readFileSync(path.join(repoRoot, "dist", "persistence", "backup.d.ts"), "utf8");
  invariant(backupDeclarations.includes('export type BackupKind = "manual";'), "backup kind declaration drifted");
  invariant(backupDeclarations.includes("export interface BackupManifest"), "current backup manifest declaration is absent");
  invariant(backupDeclarations.includes("export interface RestoreReceipt"), "current restore receipt declaration is absent");
  invariant(
    backupDeclarations.includes("declare const BACKUP_MANIFEST_SCHEMA_VERSION: 1;") &&
      backupDeclarations.includes("declare const RESTORE_RECEIPT_SCHEMA_VERSION: 1;") &&
      backupDeclarations.includes("readonly schemaVersion: typeof BACKUP_MANIFEST_SCHEMA_VERSION;") &&
      backupDeclarations.includes("readonly schemaVersion: typeof RESTORE_RECEIPT_SCHEMA_VERSION;"),
    "current schema-1 backup or restore declaration drifted",
  );
  invariant(
    !/BackupManifestV[12]|RestoreIntentV[12]|RestoreReceiptV[12]|pre_upgrade|pre_upgrade_internal|SCHEMA_VERSION: 2|readonly schemaVersion: 2/u.test(
      backupDeclarations,
    ),
    "packed declarations retain an obsolete backup or restore format surface",
  );
  const cliFacadeDeclarations = readFileSync(path.join(repoRoot, "dist", "cli-api.d.ts"), "utf8");
  const cliModelDeclarations = readFileSync(path.join(repoRoot, "dist", "cli-api-model.d.ts"), "utf8");
  const cliDeclarations = [
    "cli-api-model.d.ts",
    "cli-api-parser.d.ts",
    "cli-api-presentation.d.ts",
    "cli-api-runtime.d.ts",
    "cli-api.d.ts",
  ].map((relative) => readFileSync(path.join(repoRoot, "dist", relative), "utf8")).join("\n");
  const indexDeclarations = readFileSync(path.join(repoRoot, "dist", "index.d.ts"), "utf8");
  invariant(
    cliFacadeDeclarations.includes("CLI_API_VERSION") &&
      cliFacadeDeclarations.includes("PUBLIC_ERROR_TABLE") &&
      cliFacadeDeclarations.includes('from "./cli-api-model.ts"'),
    "current CLI facade declaration exports are absent",
  );
  invariant(cliModelDeclarations.includes('CLI_API_VERSION: "ato.api/v1"'), "current CLI API declaration is absent");
  invariant(cliModelDeclarations.includes("PUBLIC_ERROR_TABLE"), "current public error table declaration is absent");
  invariant(cliModelDeclarations.includes("export type PublicErrorCode"), "current public error type declaration is absent");
  invariant(
    !/ato\.api\/v2|CLI_API_V2_VERSION|PUBLIC_ERROR_TABLE_V2|PublicErrorCodeV2|AnyPublicErrorCode/u.test(
      `${cliDeclarations}\n${indexDeclarations}`,
    ),
    "packed declarations retain an obsolete product API surface",
  );
  invariant(
    !/ScaffoldStatus|getScaffoldStatus|localProductCliImplemented|localPhase[12]ProductCliImplemented/u.test(
      indexDeclarations,
    ),
    "packed declarations retain a synthetic capability-status surface",
  );

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
  WORKSPACE_CONTRACT_ID,
  createApplicationService,
  createExecutionApplicationService,
  createManualExecutionBackend,
  createProductRuntime,
  createReliableExecutionService,
  createWorkspaceApplicationService,
  currentSchemaVersion,
  inspectProjectRoot,
  parseWorkspaceBackendRequest,
  parseWorkspaceBackendResult,
  type ApplicationIngress,
  type ExecutionClaimCommand,
  type ExecutionIngress,
  type ExecutionBackend,
  type ManualOutcomeControl,
  type ReliableExecutionIngress,
  type BackupManifest,
  type OpenPersistenceOptions,
  type ProductRuntime,
  type WorkspaceBackend,
  type WorkspaceBackendRequest,
  type RestoreReceipt,
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
const backupManifest = null as unknown as BackupManifest;
const restoreReceipt = null as unknown as RestoreReceipt;
void backupManifest;
void restoreReceipt;
void currentSchemaVersion();
void AUTHORIZATION_ACTIONS;
void WORKSPACE_CONTRACT_ID;
void createApplicationService;
void createExecutionApplicationService;
void createManualExecutionBackend;
void createProductRuntime;
void createReliableExecutionService;
void createWorkspaceApplicationService;
void inspectProjectRoot;
void parseWorkspaceBackendRequest;
void parseWorkspaceBackendResult;
const ingress = null as unknown as ApplicationIngress;
void ingress;
const executionIngress = null as unknown as ExecutionIngress;
const executionClaim = null as unknown as ExecutionClaimCommand;
void executionIngress;
void executionClaim;
const reliableIngress = null as unknown as ReliableExecutionIngress;
const backend = null as unknown as ExecutionBackend;
const outcomeControl = null as unknown as ManualOutcomeControl;
const productRuntime = null as unknown as ProductRuntime;
const workspaceBackend = null as unknown as WorkspaceBackend;
const workspaceRequest = null as unknown as WorkspaceBackendRequest;
void reliableIngress;
void backend;
void outcomeControl;
void productRuntime;
void workspaceBackend;
void workspaceRequest;
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
        let store = await m.openPersistence(layout, { applicationVersion: "package-smoke" });
        const issuedAt = new Date().toISOString();
        const expiresAt = new Date(Date.parse(issuedAt) + 30 * 24 * 60 * 60 * 1000).toISOString();
        let trustedMilliseconds = Date.parse(issuedAt);
        const generated = Object.create(null);
        const trusted = {
          currentActor: () => ({ actorId: "package-product-actor", principal: "A".repeat(64) }),
          currentRuntimeRootKey: () => m.inspectTrustedRuntimeRoot(layout.root).rootKey,
          now: () => new Date(trustedMilliseconds++).toISOString(),
          nextId: (kind) => {
            const value = kind + ":" + randomUUID();
            (generated[kind] ??= []).push(value);
            return value;
          },
          confirmHighRisk: () => true,
          currentLeaseOwner: () => "package-worker",
          confirmOperation: ({ action }) => ({ confirmationId: action + ":" + randomUUID() }),
        };
        let service = m.createApplicationService(store, trusted);
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
        const ready = service.execute({
          kind: "task.mark_ready",
          projectId: "project",
          expectedProjectResourceRevision: 1,
          taskId: "task",
          expectedTaskRevision: 1,
        });
        if (!ready.ok) throw new Error("package Task readiness was rejected");
        trustedMilliseconds = Date.parse(issuedAt) + 1000;
        const claimUpgrade = service.upgrade({ kind: "authorization.capability.upgrade", expiresAt });
        if (!claimUpgrade.ok || claimUpgrade.value.epochRevision !== 1 ||
            claimUpgrade.value.capabilityCount !== m.CLAIM_AUTHORIZATION_ACTIONS.length) {
          throw new Error("package claim capability upgrade was rejected");
        }
        trustedMilliseconds = Date.parse(issuedAt) + 2000;
        const manualUpgrade = service.upgrade({ kind: "authorization.capability.upgrade", expiresAt });
        if (!manualUpgrade.ok || manualUpgrade.value.epochRevision !== 2 ||
            manualUpgrade.value.capabilityCount !== m.MANUAL_AUTHORIZATION_ACTIONS.length) {
          throw new Error("package Manual capability upgrade was rejected");
        }
        trustedMilliseconds = Date.parse(issuedAt) + 3000;
        const dispatcherUpgrade = service.upgrade({ kind: "authorization.capability.upgrade", expiresAt });
        if (!dispatcherUpgrade.ok || dispatcherUpgrade.value.epochRevision !== 3 ||
            dispatcherUpgrade.value.capabilityCount !== m.DISPATCHER_AUTHORIZATION_ACTIONS.length) {
          throw new Error("package dispatcher capability upgrade was rejected");
        }
        trustedMilliseconds = Date.parse(issuedAt) + 4000;
        const workspaceUpgrade = service.upgrade({ kind: "authorization.capability.upgrade", expiresAt });
        if (!workspaceUpgrade.ok || workspaceUpgrade.value.epochRevision !== 4 ||
            workspaceUpgrade.value.capabilityCount !== m.AUTHORIZATION_ACTIONS.length) {
          throw new Error("package workspace capability upgrade was rejected");
        }
        trustedMilliseconds = Date.parse(issuedAt) + 5000;
        let manualBackend = m.createManualExecutionBackend(store, { ingress: trusted });
        let product = m.createProductRuntime(store, trusted, manualBackend, manualBackend);
        const dispatched = product.dispatchRun({
          kind: "dispatch.run",
          idempotencyKey: "package-dispatch",
          leaseDurationSeconds: 60,
        });
        if (!dispatched.ok || dispatched.value.terminalStatus !== "completed") {
          throw new Error("package product dispatch was rejected");
        }
        const publicCommon = (executionId, idempotencyKey) => ({
          projectId: "project",
          expectedProjectResourceRevision: 1,
          expectedProjectConfigRevision: 1,
          taskId: "task",
          expectedTaskRevision: 3,
          executionId,
          expectedExecutionRevision: 1,
          expectedAttemptNumber: 1,
          expectedFencingToken: 1,
          idempotencyKey,
        });
        let inspected = null;
        for (const candidate of [...(generated.operation ?? [])]) {
          const result = product.inspect({ kind: "execution.inspect", ...publicCommon(candidate, "package-inspect-" + candidate) });
          if (result.ok) {
            inspected = result;
            break;
          }
        }
        if (inspected === null || inspected.value.lifecycle !== "queued") {
          throw new Error("package product inspection did not bind the dispatched execution");
        }
        const executionId = inspected.value.executionId;
        trustedMilliseconds = Date.parse(issuedAt) + 6000;
        const reportCommand = {
          kind: "manual.outcome-report",
          ...publicCommon(executionId, "package-report"),
          idempotencyKey: "package-report",
          reportId: "package-report",
          outcome: "succeed",
          code: "manual_turn_succeeded",
          evidenceReference: "package-evidence",
        };
        const reported = product.recordManualOutcome(reportCommand);
        if (!reported.ok || reported.value.lifecycle !== "turn_succeeded" || reported.value.taskState !== "running") {
          throw new Error("package Manual outcome was not finalized as a running Task turn fact");
        }
        await store.close();
        store = await m.openPersistence(layout, { applicationVersion: "package-smoke-restart" });
        service = m.createApplicationService(store, trusted);
        manualBackend = m.createManualExecutionBackend(store, { ingress: trusted });
        product = m.createProductRuntime(store, trusted, manualBackend, manualBackend);
        const reportReplay = product.recordManualOutcome(reportCommand);
        if (!reportReplay.ok || !reportReplay.value.replayed) throw new Error("package Manual restart replay was not stable");
        trustedMilliseconds = Date.parse(issuedAt) + 7000;
        const completed = product.acceptManualCompletion({
          kind: "execution.accept-manual-completion",
          ...publicCommon(executionId, "package-completion"),
          idempotencyKey: "package-completion",
        });
        if (!completed.ok || completed.value.taskState !== "completed") throw new Error("package Manual completion was rejected");
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
          states: m.TASK_STATES,
          snapshot: project.value.projectId === "project" && task.value.id === "task",
          claim: inspected.value.fencingToken === 1 && inspected.value.taskRevision === 3,
          manual: inspected.value.lifecycle === "queued" && reported.value.lifecycle === "turn_succeeded" && completed.value.lifecycle === "completed",
          dispatcherExport: typeof m.createManualDispatcher === "function",
          workspaceExport: m.WORKSPACE_CONTRACT_ID === "ato.workspace/v1" &&
            typeof m.createWorkspaceApplicationService === "function" &&
            typeof m.parseWorkspaceBackendRequest === "function" &&
            typeof m.parseWorkspaceBackendResult === "function",
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
    JSON.stringify(imported.states) === JSON.stringify(["idea", "ready", "running", "waiting", "completed", "cancelled"]) &&
      imported.snapshot === true &&
      imported.claim === true &&
      imported.manual === true &&
      imported.dispatcherExport === true &&
      imported.workspaceExport === true &&
      imported.schema === 1 &&
      imported.backup === true,
    "package operational export surface drifted",
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
  const explicitCurrentArgs = ["--format", "json", "--api-version", "ato.api/v1", "--runtime-root", parityRoot, "doctor"];
  const retiredMajorArgs = ["--format", "json", "--api-version", "ato.api/v2", "--runtime-root", parityRoot, "doctor"];
  const sourceCli = path.join(repoRoot, "src", "cli.ts");
  const builtCli = path.join(repoRoot, "dist", "cli.js");
  const installedCli = path.join(consumer, "node_modules", "agent-task-orchestrator", "dist", "cli.js");
  const positiveResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, positiveArgs, consumer, cliEnvironment));
  const humanResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, humanArgs, consumer, cliEnvironment));
  const negativeResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, negativeArgs, consumer, cliEnvironment));
  const explicitCurrentResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, explicitCurrentArgs, consumer, cliEnvironment));
  const retiredMajorResults = [sourceCli, builtCli, installedCli].map((entry) =>
    invokeNodeCli(entry, retiredMajorArgs, consumer, cliEnvironment));
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
  const expectedRetiredMajor = {
    status: 2,
    stdout: '{"apiVersion":"ato.api/v1","command":"doctor","ok":false,"error":{"code":"CLI_UNSUPPORTED_VERSION","message":"The requested API version is unsupported."}}\n',
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
  for (const observed of explicitCurrentResults) {
    invariant(
      JSON.stringify(observed) === JSON.stringify(expectedPositive),
      `explicit current CLI parity drifted: ${JSON.stringify(observed)}`,
    );
  }
  for (const observed of retiredMajorResults) {
    invariant(
      JSON.stringify(observed) === JSON.stringify(expectedRetiredMajor),
      `retired-major CLI parity drifted: ${JSON.stringify(observed)}`,
    );
  }
  const phase2ParityEnvironment = { ATO_SMOKE_HOME: isolatedHome };
  const phase2ParityNodeArgs = ["--no-warnings", "--experimental-loader", pathToFileURL(isolatedOsLoader).href];
  const phase2ParityExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const phase2Boundaries = [
    ["source", path.join(isolatedSourceRoot, "src", "cli.ts")],
    ["built", path.join(isolatedBuiltRoot, "dist", "cli.js")],
    ["installed", installedCli],
  ];
  const phase2Transcripts = phase2Boundaries.map(([label, entry]) => {
    const project = path.join(generation, `cli-${label}-project`);
    mkdirSync(project);
    const runtime = path.join(
      isolatedHome,
      "AppData",
      "Local",
      "agent-task-orchestrator",
      `cli-${label}-runtime`,
    );
    return runPhase2CliBoundary(
      entry,
      label,
      runtime,
      project,
      consumer,
      phase2ParityExpiry,
      phase2ParityEnvironment,
      phase2ParityNodeArgs,
    );
  });
  for (const transcript of phase2Transcripts.slice(1)) {
    invariant(
      JSON.stringify(transcript) === JSON.stringify(phase2Transcripts[0]),
      `Phase-2 source/build/installed CLI parity drifted: ${JSON.stringify(transcript)}`,
    );
  }
  invariant(!existsSync(parityRoot), "read-only doctor created the absent runtime root");
  const installedBin = pnpm(["exec", "ato", ...positiveArgs], consumer, undefined, cliEnvironment);
  invariant(installedBin.stdout === expectedPositive.stdout && installedBin.stderr === "", "installed package bin drifted from direct CLI entry");
  const installedExplicitBin = pnpm(["exec", "ato", ...explicitCurrentArgs], consumer, undefined, cliEnvironment);
  invariant(installedExplicitBin.stdout === expectedPositive.stdout && installedExplicitBin.stderr === "", "installed package explicit-current bin drifted from direct CLI entry");

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
  reclaimEmptyTaskArtifactsRoot(artifactRootReclaimTestOptions());
}
