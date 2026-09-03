import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createOwnedGeneration,
  removeOwnedGeneration,
} from "../../scripts/repo-utils.mjs";
import {
  WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  createWindowsGitWorkspaceBackend,
} from "../../src/index.ts";
import { workspaceCleanupAttestationSha256 } from "../../src/workspace-port.ts";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function gitEnvironment() {
  const result = Object.create(null);
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (systemRoot !== undefined) {
    result.SystemRoot = systemRoot;
    result.WINDIR = systemRoot;
  }
  result.GIT_CONFIG_NOSYSTEM = "1";
  result.GIT_CONFIG_GLOBAL = "NUL";
  result.GIT_TERMINAL_PROMPT = "0";
  result.GCM_INTERACTIVE = "Never";
  result.GIT_ASKPASS = "";
  result.SSH_ASKPASS = "";
  result.GIT_NO_REPLACE_OBJECTS = "1";
  result.GIT_OPTIONAL_LOCKS = "0";
  result.GIT_ATTR_NOSYSTEM = "1";
  result.LANG = "C";
  result.LC_ALL = "C";
  return result;
}

function locateGitExecutable() {
  const candidates = [
    "C:\\Program Files\\Git\\bin\\git.exe",
    "C:\\Program Files\\Git\\cmd\\git.exe",
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const stats = lstatSync(candidate);
    if (!stats.isFile() || stats.isSymbolicLink() || realpathSync.native(candidate).toLowerCase() !== candidate.toLowerCase()) {
      continue;
    }
    const result = spawnSync(candidate, ["--version"], {
      env: gitEnvironment(), encoding: "utf8", windowsHide: true, shell: false,
    });
    if (result.status === 0 && result.stdout.trim() === "git version 2.53.0.windows.1") return candidate;
  }
  throw new Error("Exact Git 2.53.0.windows.1 executable is unavailable");
}

export const TEST_GIT_EXECUTABLE = process.platform === "win32" ? locateGitExecutable() : "";

export function git(fixture, args, options = {}) {
  const result = spawnSync(TEST_GIT_EXECUTABLE, args, {
    cwd: options.cwd ?? fixture.projectRoot,
    env: gitEnvironment(),
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    shell: false,
    input: options.input,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, options.status ?? 0, `git ${args[0]} failed`);
  return result.stdout;
}

export function createWorkspaceGitFixture(label = "workspace-git") {
  assert.notEqual(TEST_GIT_EXECUTABLE, "", "Windows Git fixture requires the exact Windows Git executable");
  const generation = createOwnedGeneration(label);
  const projectRoot = path.join(generation, "Project Space café");
  const workspaceRoot = path.join(generation, "Workspace Space café");
  mkdirSync(projectRoot);
  mkdirSync(workspaceRoot);
  const fixture = { generation, projectRoot, workspaceRoot };
  git(fixture, ["init", "--quiet", "--initial-branch=main"]);
  writeFileSync(path.join(projectRoot, "README.txt"), "workspace adapter fixture\n", { flag: "wx" });
  mkdirSync(path.join(projectRoot, "nested"));
  writeFileSync(path.join(projectRoot, "nested", "data.bin"), Buffer.from([0, 1, 2, 3, 254, 255]), { flag: "wx" });
  git(fixture, ["add", "--", "README.txt", "nested/data.bin"]);
  git(fixture, [
    "-c", "user.name=ato-fixture",
    "-c", "user.email=ato-fixture.invalid",
    "commit", "--quiet", "-m", "fixture",
  ]);
  const baseObjectId = git(fixture, ["rev-parse", "HEAD"]).trim();
  assert.match(baseObjectId, /^[0-9a-f]{40}$/u);
  assert.equal(git(fixture, ["remote"]).trim(), "");
  const ownershipBindingSha256 = sha256(`binding:${label}:${baseObjectId}`);
  const configuration = Object.freeze({
    gitExecutable: TEST_GIT_EXECUTABLE,
    projectRoots: Object.freeze([Object.freeze({ rootKey: "project-root-key", path: projectRoot })]),
    workspaceRoots: Object.freeze([Object.freeze({ rootKey: "workspace-root-key", path: workspaceRoot })]),
  });
  const adapter = createWindowsGitWorkspaceBackend(configuration);
  return Object.freeze({
    generation,
    projectRoot,
    workspaceRoot,
    baseObjectId,
    ownershipBindingSha256,
    configuration,
    adapter,
  });
}

export function freshWorkspaceGitAdapter(fixture) {
  return createWindowsGitWorkspaceBackend(fixture.configuration);
}

export function workspaceRequest(fixture, operation, overrides = {}) {
  const subject = {
    projectId: "project",
    projectResourceRevision: 1,
    projectConfigRevision: 1,
    projectRootKey: "project-root-key",
    taskId: "task",
    taskRevision: 2,
    runId: "run",
    runRevision: 3,
    memberId: "member",
    membershipRevision: 1,
    memberRevision: 2,
    executionId: "execution",
    executionRevision: 4,
    attemptNumber: 1,
    fencingToken: 7,
    workspaceId: "workspace",
    generation: 1,
    workspaceRevision: operation === "create" ? 2 : 1,
    workspaceRootKey: "workspace-root-key",
    ownershipBindingSha256: fixture.ownershipBindingSha256,
    creatorOperationId: "operation-reserve",
    baseReference: fixture.baseObjectId,
    ...overrides.subject,
  };
  return Object.freeze({
    contractId: "ato.workspace/v2",
    operation,
    operationId: `operation-${operation}`,
    idempotencyKey: `idempotency-${operation}`,
    correlationId: `correlation-${operation}`,
    causationId: operation === "recover" ? "operation-create" : null,
    adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
    adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
    subject: Object.freeze(subject),
    cleanupAttestation: null,
    ...overrides.request,
  });
}

export function workspaceCleanupRequest(fixture, ownershipReceipt, overrides = {}) {
  const request = workspaceRequest(fixture, "cleanup", {
    subject: { workspaceRevision: 3, ...overrides.subject },
    request: { ...overrides.request, cleanupAttestation: null },
  });
  const issuedAt = overrides.issuedAt ?? new Date(Date.now() - 1_000).toISOString();
  const validUntil = overrides.validUntil ?? new Date(Date.now() + 120_000).toISOString();
  const unsigned = Object.freeze({
    contractId: "ato.workspace-cleanup-attestation/v1",
    attestationId: "cleanup-attestation",
    operationId: request.operationId,
    intentId: "cleanup-intent",
    projectId: request.subject.projectId,
    projectResourceRevision: request.subject.projectResourceRevision,
    projectConfigRevision: request.subject.projectConfigRevision,
    projectRootKey: request.subject.projectRootKey,
    repositoryIdentity: ownershipReceipt.repositoryIdentity,
    taskId: request.subject.taskId,
    taskCompletedRevision: request.subject.taskRevision,
    completionDecisionId: "completion-decision",
    executionId: request.subject.executionId,
    executionRevision: request.subject.executionRevision,
    attemptNumber: request.subject.attemptNumber,
    fencingToken: request.subject.fencingToken,
    executionTerminalCreatedAt: issuedAt,
    workspaceId: request.subject.workspaceId,
    generation: request.subject.generation,
    workspaceRevision: request.subject.workspaceRevision,
    workspaceRootKey: request.subject.workspaceRootKey,
    ownershipBindingSha256: request.subject.ownershipBindingSha256,
    policyReceiptId: "cleanup-policy-receipt",
    policyReceiptSha256: sha256("cleanup-policy-receipt"),
    policyConfigRevision: request.subject.projectConfigRevision,
    cleanupAuthorizationDecisionId: "cleanup-authorization",
    cleanupAuthorizationBindingRevision: 2,
    grantId: "cleanup-grant",
    grantRevision: 1,
    confirmationId: "cleanup-confirmation",
    gateSetSha256: sha256("cleanup-gates"),
    preservationStateSha256: sha256("cleanup-preservation"),
    integrationDisposition: "not_required",
    integrationReservationId: null,
    integrationReservationRevision: null,
    integrationReservationFencingToken: null,
    expectedBranchReference: "refs/heads/main",
    expectedHeadObjectId: ownershipReceipt.headObjectId,
    quiescenceSha256: sha256("cleanup-quiescence"),
    issuedAt,
    validUntil,
    ...overrides.attestation,
  });
  const attestation = Object.freeze({
    ...unsigned,
    attestationSha256: workspaceCleanupAttestationSha256(unsigned),
  });
  return Object.freeze({ ...request, cleanupAttestation: attestation });
}

export function workspacePaths(fixture, request) {
  const targetDirectory = path.join(
    fixture.workspaceRoot,
    "ato-workspaces",
    `w-${sha256(request.subject.workspaceId).toLowerCase()}-g${request.subject.generation}`,
  );
  const adminDirectory = path.join(
    fixture.projectRoot,
    ".git",
    "worktrees",
    `ato-${request.subject.ownershipBindingSha256.toLowerCase()}`,
  );
  return Object.freeze({
    targetDirectory,
    adminDirectory,
    manifestPath: path.join(adminDirectory, "ato-workspace-ownership-v1.json"),
  });
}

export function workspaceCapabilityProbePaths(parent, request) {
  assert.match(request.subject.ownershipBindingSha256, /^[0-9A-F]{64}$/u);
  const digest = request.subject.ownershipBindingSha256.toLowerCase();
  return Object.freeze({
    source: path.join(parent, `p-${digest}`),
    destination: path.join(parent, `q-${digest}`),
  });
}

export function exactLengthChildPath(parent, exactLength, stem) {
  assert.equal(Number.isSafeInteger(exactLength), true);
  assert.match(stem, /^[a-z0-9-]+$/u);
  const segmentLength = exactLength - parent.length - 1;
  assert.equal(segmentLength >= stem.length, true, `cannot create length ${exactLength} below ${parent}`);
  assert.equal(segmentLength <= 255, true, `exact-length child segment exceeds 255: ${segmentLength}`);
  const target = path.join(parent, `${stem}${"x".repeat(segmentLength - stem.length)}`);
  assert.equal(target.length, exactLength);
  return target;
}

function inventoryDirectory(root, current = root, output = []) {
  for (const name of readdirSync(current).sort()) {
    const absolute = path.join(current, name);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    const stats = lstatSync(absolute);
    assert.equal(stats.isSymbolicLink(), false);
    if (stats.isDirectory()) {
      output.push(`d:${relative}`);
      inventoryDirectory(root, absolute, output);
    } else {
      assert.equal(stats.isFile(), true);
      output.push(`f:${relative}:${sha256(readFileSync(absolute))}`);
    }
  }
  return output;
}

export function fixtureDigest(fixture) {
  return sha256(JSON.stringify({
    project: inventoryDirectory(fixture.projectRoot),
    workspace: inventoryDirectory(fixture.workspaceRoot),
  }));
}

export function fixtureScopeDigest(fixture) {
  return sha256(JSON.stringify(inventoryDirectory(fixture.generation)));
}

export function cleanupWorkspaceGitFixture(fixture) {
  removeOwnedGeneration(fixture.generation);
}
