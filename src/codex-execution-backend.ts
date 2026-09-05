import { randomUUID } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  CODEX_EXECUTION_ENDPOINT_VERSION,
  EXECUTION_CONTRACT_ID,
  parseExecutionRequest,
  type ExecutionAdapterError,
  type ExecutionBackend,
  type ExecutionCancelReceipt,
  type ExecutionCancelRequest,
  type ExecutionInspectReceipt,
  type ExecutionInspectRequest,
  type ExecutionPortResult,
  type ExecutionResumeRequest,
  type ExecutionSemanticIdentity,
  type ExecutionStartReceipt,
  type ExecutionStartRequest,
} from "./execution-port.ts";
import { readApplicationStateForOwner } from "./persistence/application-repository.ts";
import { codexTerminalReceiptProjection } from "./persistence/codex-receipt-digest.ts";
import { codexProductTaskInputReference } from "./persistence/codex-product-digest.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, sha256 } from "./persistence/values.ts";
import {
  CodexJournalError,
  createCodexTurnJournal,
  type CodexPreparedTurn,
  type CodexTurnJournal,
} from "./persistence/codex-backend-repository.ts";
import {
  CodexSdkDriverError,
  PINNED_CODEX_SDK_VERSION,
  createPinnedCodexSdkDriver,
  type CodexSdkDriver,
  type CodexSdkObservedEvent,
  type CodexSdkTerminalEvent,
} from "./codex-sdk-worker.ts";
import {
  WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  createWindowsGitWorkspaceBackend,
} from "./workspace-git-adapter.ts";
import {
  WORKSPACE_CONTRACT_ID,
  parseWorkspaceBackendResult,
  type WorkspaceSubject,
} from "./workspace-port.ts";

export const CODEX_EXECUTION_ADAPTER_ID = "openai-codex-sdk-local" as const;
export const CODEX_EXECUTION_ADAPTER_VERSION = PINNED_CODEX_SDK_VERSION;

interface RootIdentity {
  readonly path: string;
  readonly realPath: string;
  readonly device: string;
  readonly inode: string;
  readonly mode: number;
}

interface TrustedRoot extends RootIdentity {
  readonly key: string;
  readonly rootKey: string;
}

export interface CodexExecutionRootBinding {
  readonly key: string;
  readonly path: string;
}

export interface CodexExecutionProjectBinding {
  readonly projectId: string;
  readonly rootKey: string;
  readonly path: string;
}

export interface CodexExecutionBackendConfiguration {
  readonly gitExecutable: string;
  readonly projectBindings: readonly CodexExecutionProjectBinding[];
  readonly workspaceRoots: readonly CodexExecutionRootBinding[];
}

export interface CodexExecutionBackendIngress {
  now(): string;
  nextId(kind: "backend-execution" | "receipt"): string;
}

export type CodexDriverPreparationFailureCode =
  | "credential_unavailable"
  | "configuration_changed"
  | "adapter_failure";

export type CodexDriverPreparationResult =
  | Readonly<{ readonly ok: true; readonly driver: CodexSdkDriver }>
  | Readonly<{ readonly ok: false; readonly code: CodexDriverPreparationFailureCode }>;

export interface VerifiedCodexWorkspace {
  readonly workingDirectory: string;
}

export interface CodexWorkspaceVerifier {
  verify(
    semantic: Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }>,
    input: string | null,
  ): VerifiedCodexWorkspace;
}

class WorkspaceRefusal extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Configured Codex workspace did not satisfy its durable ownership binding");
    this.name = "WorkspaceRefusal";
    this.code = code;
  }
}

function operationalIdentifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left).replaceAll("/", "\\").replace(/\\+$/u, "");
  const normalizedRight = path.resolve(right).replaceAll("/", "\\").replace(/\\+$/u, "");
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

function containedBy(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function directDirectoryIdentity(value: string): RootIdentity {
  if (!path.isAbsolute(value)) throw new WorkspaceRefusal("root_not_absolute");
  const resolved = path.resolve(value);
  const stat = lstatSync(resolved, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new WorkspaceRefusal("root_not_direct_directory");
  const realPath = realpathSync.native(resolved);
  if (!samePath(resolved, realPath)) throw new WorkspaceRefusal("root_alias_refused");
  return Object.freeze({
    path: resolved,
    realPath,
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: Number(stat.mode),
  });
}

function identityMatches(expected: RootIdentity): boolean {
  try {
    const actual = directDirectoryIdentity(expected.path);
    return samePath(actual.realPath, expected.realPath) && actual.device === expected.device &&
      actual.inode === expected.inode && actual.mode === expected.mode;
  } catch {
    return false;
  }
}

function parseConfiguration(value: CodexExecutionBackendConfiguration): Readonly<{
  gitExecutable: string;
  projects: ReadonlyMap<string, TrustedRoot>;
  workspaceRoots: ReadonlyMap<string, TrustedRoot>;
}> {
  if (!operationalIdentifier(value.gitExecutable, 1024) && !path.isAbsolute(value.gitExecutable)) {
    throw new TypeError("Codex Git executable identity is invalid");
  }
  const projects = new Map<string, TrustedRoot>();
  const workspaceRoots = new Map<string, TrustedRoot>();
  for (const binding of value.projectBindings) {
    if (!operationalIdentifier(binding.projectId) || !operationalIdentifier(binding.rootKey) ||
      projects.has(binding.projectId)) {
      throw new TypeError("Codex Project binding is invalid or duplicated");
    }
    projects.set(binding.projectId, Object.freeze({
      key: binding.projectId,
      rootKey: binding.rootKey,
      ...directDirectoryIdentity(binding.path),
    }));
  }
  for (const binding of value.workspaceRoots) {
    if (!operationalIdentifier(binding.key) || workspaceRoots.has(binding.key)) {
      throw new TypeError("Codex workspace root binding is invalid or duplicated");
    }
    workspaceRoots.set(binding.key, Object.freeze({
      key: binding.key,
      rootKey: binding.key,
      ...directDirectoryIdentity(binding.path),
    }));
  }
  if (projects.size === 0 || workspaceRoots.size === 0) throw new TypeError("Codex roots are absent");
  for (const project of projects.values()) {
    for (const workspace of workspaceRoots.values()) {
      if (containedBy(project.realPath, workspace.realPath) || containedBy(workspace.realPath, project.realPath)) {
        throw new TypeError("Codex Project and workspace roots overlap");
      }
    }
  }
  return Object.freeze({ gitExecutable: value.gitExecutable, projects, workspaceRoots });
}

class LocalGitCodexWorkspaceVerifier implements CodexWorkspaceVerifier {
  readonly #configuration: ReturnType<typeof parseConfiguration>;
  readonly #store: PersistenceStore | null;

  constructor(configuration: CodexExecutionBackendConfiguration, store: PersistenceStore | null) {
    this.#configuration = parseConfiguration(configuration);
    this.#store = store;
  }

  #durableRepositoryIdentity(
    semantic: Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }>,
    project: TrustedRoot,
  ): string | null {
    if (this.#store === null) return null;
    const state = readApplicationStateForOwner(this.#store);
    const registeredProject = state.projects.find((candidate) => candidate.projectId === semantic.projectId);
    const generation = state.workspaceGenerations.find((candidate) =>
      candidate.workspaceId === semantic.workspaceId && candidate.generation === semantic.workspaceGeneration
    );
    const receipt = state.workspaceReceipts.find((candidate) => {
      const finalization = state.workspaceFinalizations.find((record) =>
        record.intentId === candidate.intentId && record.verifiedReceiptId === candidate.verifiedReceiptId &&
        record.outcome === "succeeded" && record.resultingGenerationStatus === "ready" &&
        record.resultingGenerationRevision === semantic.workspaceRevision
      );
      return candidate.workspaceId === semantic.workspaceId && candidate.generation === semantic.workspaceGeneration &&
        candidate.outcome === "succeeded" && candidate.externalState === "complete" &&
        candidate.headObjectId === semantic.workspaceHeadObjectId &&
        candidate.ownershipBindingSha256 === semantic.ownershipBindingSha256 && finalization !== undefined;
    });
    if (
      registeredProject === undefined || registeredProject.rootKey !== project.rootKey ||
      !samePath(registeredProject.canonicalRoot, project.realPath) ||
      registeredProject.resourceRevision !== semantic.projectResourceRevision ||
      registeredProject.configRevision !== semantic.projectConfigRevision || generation === undefined ||
      generation.status !== "ready" || generation.revision !== semantic.workspaceRevision ||
      generation.contractId !== WORKSPACE_CONTRACT_ID ||
      generation.adapterId !== WINDOWS_GIT_WORKSPACE_ADAPTER_ID ||
      generation.adapterVersion !== WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION ||
      generation.projectId !== semantic.projectId ||
      generation.projectResourceRevision !== semantic.projectResourceRevision ||
      generation.projectConfigRevision !== semantic.projectConfigRevision || generation.taskId !== semantic.taskId ||
      generation.taskRevision > semantic.taskRevision || generation.executionId !== semantic.executionId ||
      generation.executionRevision > semantic.executionRevision || generation.attemptNumber !== semantic.attemptNumber ||
      generation.fencingToken !== semantic.fencingToken || generation.workspaceRootKey !== semantic.workspaceRootKey ||
      receipt?.repositoryIdentity === null || receipt?.repositoryIdentity === undefined
    ) throw new WorkspaceRefusal("durable_workspace_identity_mismatch");
    return receipt.repositoryIdentity;
  }

  #productTaskInputMatches(
    semantic: Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }>,
    input: string,
  ): boolean {
    if (this.#store === null || !/^codex-task-binding:[0-9A-F]{64}$/u.test(semantic.inputReference)) return false;
    const state = readApplicationStateForOwner(this.#store);
    const task = state.domain.tasks.find((candidate) => candidate.id === semantic.taskId);
    const execution = state.executions.find((candidate) => candidate.executionId === semantic.executionId);
    const operations = state.codexProductOperations.filter((candidate) =>
      candidate.taskId === semantic.taskId && candidate.executionId === semantic.executionId &&
      codexProductTaskInputReference(candidate.operationId, semantic.taskId, semantic.taskRevision) === semantic.inputReference
    );
    if (task === undefined || execution === undefined || operations.length !== 1 ||
      task.revision !== semantic.taskRevision || task.state !== "running" || task.body !== input ||
      task.body.length === 0 || new TextEncoder().encode(task.body).byteLength > 1_048_576 ||
      execution.taskId !== task.id || execution.status !== "active" ||
      execution.revision !== semantic.executionRevision || execution.attemptNumber !== semantic.attemptNumber ||
      execution.fencingToken !== semantic.fencingToken) return false;
    const operation = operations[0]!;
    const intent = state.executionIntents.find((candidate) => candidate.intentId === operation.intentId);
    return operation.stage === "effect_possible" && operation.lifecycle === "active" &&
      operation.projectId === semantic.projectId &&
      operation.expectedProjectResourceRevision === semantic.projectResourceRevision &&
      operation.expectedProjectConfigRevision === semantic.projectConfigRevision &&
      operation.workspaceId === semantic.workspaceId && operation.workspaceGeneration === semantic.workspaceGeneration &&
      operation.workspaceRevision === semantic.workspaceRevision && operation.workspaceHeadObjectId === semantic.workspaceHeadObjectId &&
      intent !== undefined && intent.state === "executing" && intent.executionId === semantic.executionId &&
      intent.executionRevision === semantic.executionRevision && intent.attemptNumber === semantic.attemptNumber &&
      intent.fencingToken === semantic.fencingToken && intent.taskId === semantic.taskId &&
      intent.taskRevision === semantic.taskRevision && intent.inputReference === semantic.inputReference &&
      intent.workspaceId === semantic.workspaceId && intent.workspaceGeneration === semantic.workspaceGeneration &&
      intent.workspaceRevision === semantic.workspaceRevision && intent.workspaceRootKey === semantic.workspaceRootKey &&
      intent.ownershipBindingSha256 === semantic.ownershipBindingSha256 &&
      intent.workspaceHeadObjectId === semantic.workspaceHeadObjectId;
  }

  verify(
    semantic: Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }>,
    input: string | null,
  ): VerifiedCodexWorkspace {
    if (input !== null) {
      const legacyReference = `task-sha256:${sha256(input).toLocaleLowerCase("en-US")}`;
      const inputMatches = /^task-sha256:[0-9a-f]{64}$/u.test(semantic.inputReference)
        ? legacyReference === semantic.inputReference
        : this.#productTaskInputMatches(semantic, input);
      if (!inputMatches) throw new WorkspaceRefusal("task_input_digest_mismatch");
    }
    const project = this.#configuration.projects.get(semantic.projectId);
    const workspaceRoot = this.#configuration.workspaceRoots.get(semantic.workspaceRootKey);
    if (project === undefined || workspaceRoot === undefined) throw new WorkspaceRefusal("configured_root_absent");
    if (!identityMatches(project) || !identityMatches(workspaceRoot)) throw new WorkspaceRefusal("configured_root_changed");
    const beforeRepositoryIdentity = this.#durableRepositoryIdentity(semantic, project);
    const subject: WorkspaceSubject = Object.freeze({
      projectId: semantic.projectId,
      projectResourceRevision: semantic.projectResourceRevision,
      projectConfigRevision: semantic.projectConfigRevision,
      projectRootKey: project.rootKey,
      taskId: semantic.taskId,
      taskRevision: semantic.taskRevision,
      runId: "codex-workspace-verifier",
      runRevision: 1,
      memberId: "codex-workspace-verifier",
      membershipRevision: 1,
      memberRevision: 1,
      executionId: semantic.executionId,
      executionRevision: semantic.executionRevision,
      attemptNumber: semantic.attemptNumber,
      fencingToken: semantic.fencingToken,
      workspaceId: semantic.workspaceId,
      generation: semantic.workspaceGeneration,
      workspaceRevision: semantic.workspaceRevision,
      workspaceRootKey: semantic.workspaceRootKey,
      ownershipBindingSha256: semantic.ownershipBindingSha256,
      creatorOperationId: "codex-workspace-verifier",
      baseReference: semantic.workspaceHeadObjectId,
    });
    const backend = createWindowsGitWorkspaceBackend(Object.freeze({
      gitExecutable: this.#configuration.gitExecutable,
      projectRoots: Object.freeze([Object.freeze({ rootKey: project.rootKey, path: project.realPath })]),
      workspaceRoots: Object.freeze([Object.freeze({ rootKey: workspaceRoot.rootKey, path: workspaceRoot.realPath })]),
    }));
    const result = parseWorkspaceBackendResult(backend.inspect(Object.freeze({
      contractId: WORKSPACE_CONTRACT_ID,
      operation: "inspect" as const,
      operationId: "codex-workspace-physical-inspect",
      idempotencyKey: "codex-workspace-physical-inspect",
      correlationId: "codex-workspace-physical-inspect",
      causationId: null,
      adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
      adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
      subject,
      cleanupAttestation: null,
    })));
    if (result === null || !result.ok) throw new WorkspaceRefusal("workspace_physical_inspection_failed");
    const receipt = result.receipt;
    const expectedPath = path.join(
      workspaceRoot.realPath,
      "ato-workspaces",
      `w-${sha256(semantic.workspaceId).toLocaleLowerCase("en-US")}-g${semantic.workspaceGeneration}`,
    );
    if (
      receipt.externalState !== "complete" || receipt.outcome !== "succeeded" ||
      receipt.code !== "inspected_complete" || receipt.canonicalPath === null ||
      !samePath(receipt.canonicalPath, expectedPath) || receipt.repositoryIdentity === null ||
      receipt.registrationIdentity === null || receipt.baseObjectId !== semantic.workspaceHeadObjectId ||
      receipt.headObjectId !== semantic.workspaceHeadObjectId || receipt.pathSafety !== "safe" ||
      receipt.ownershipMatch !== true || receipt.ownershipBindingSha256 !== semantic.ownershipBindingSha256 ||
      receipt.inventory.modifiedCount !== 0 || receipt.inventory.untrackedCount !== 0 ||
      receipt.inventory.ignoredCount !== 0 ||
      (beforeRepositoryIdentity !== null && receipt.repositoryIdentity !== beforeRepositoryIdentity)
    ) throw new WorkspaceRefusal("workspace_physical_identity_mismatch");
    const afterRepositoryIdentity = this.#durableRepositoryIdentity(semantic, project);
    if (afterRepositoryIdentity !== beforeRepositoryIdentity || !identityMatches(project) || !identityMatches(workspaceRoot)) {
      throw new WorkspaceRefusal("workspace_identity_changed");
    }
    return Object.freeze({ workingDirectory: receipt.canonicalPath });
  }
}

function defaultIngress(): CodexExecutionBackendIngress {
  return Object.freeze({
    now: () => new Date().toISOString(),
    nextId: (kind: "backend-execution" | "receipt") => `${kind}:${randomUUID()}`,
  });
}

function integrity<T extends Readonly<Record<string, unknown>>>(projection: T): string {
  return sha256(canonicalJson(projection));
}

function adapterError(
  correlationId: string,
  category: ExecutionAdapterError["category"],
  code: string,
): ExecutionPortResult<never> {
  const retryable = ["busy", "rate_limited", "resource_exhausted", "transient_external"].includes(category);
  const ambiguous = category === "ambiguous_external_state" || category === "integrity_failure";
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      code,
      category,
      retryable,
      ambiguous,
      message: "Codex SDK backend refused or could not prove the bounded operation",
      correlationId,
      externalReference: null,
      retryAfter: null,
    }),
  });
}

function journalError(correlationId: string, error: CodexJournalError): ExecutionPortResult<never> {
  switch (error.code) {
    case "INVALID_INPUT": return adapterError(correlationId, "invalid_request", "codex_journal_invalid");
    case "NOT_FOUND": return adapterError(correlationId, "not_found", "codex_turn_absent");
    case "CONFLICT": return adapterError(correlationId, "conflict", "codex_journal_conflict");
    case "STALE_REVISION": return adapterError(correlationId, "stale_revision", "codex_tuple_stale");
    case "INTEGRITY_FAILURE": return adapterError(correlationId, "integrity_failure", "codex_journal_integrity");
  }
}

function effectProjection(
  request: ExecutionStartRequest | ExecutionResumeRequest,
  turn: CodexPreparedTurn["turn"],
  receiptId: string,
): Omit<ExecutionStartReceipt, "integritySha256"> {
  return codexTerminalReceiptProjection(Object.freeze({
    receiptId,
    correlationId: request.correlationId,
    adapterId: CODEX_EXECUTION_ADAPTER_ID,
    adapterVersion: CODEX_EXECUTION_ADAPTER_VERSION,
    observedExecutionId: request.semantic.executionId,
    operationId: request.operationId,
    intentId: request.intentId,
    idempotencyKey: request.idempotencyKey,
    operation: request.operation,
    turn,
  }));
}

function terminalEvidence(event: CodexSdkTerminalEvent): string {
  const projection = event.type === "turn.completed"
    ? Object.freeze({ terminal: event.type, usage: event.usage })
    : Object.freeze({ terminal: event.type });
  return `codex-event-sha256:${sha256(canonicalJson(projection)).toLocaleLowerCase("en-US")}`;
}

class CodexExecutionBackend implements ExecutionBackend {
  readonly contractId = EXECUTION_CONTRACT_ID;
  readonly backendKind = "codex-sdk" as const;
  readonly adapterId = CODEX_EXECUTION_ADAPTER_ID;
  readonly adapterVersion = CODEX_EXECUTION_ADAPTER_VERSION;
  readonly #journal: CodexTurnJournal;
  readonly #driver: CodexSdkDriver | null;
  readonly #driverFactory: (() => CodexDriverPreparationResult) | null;
  readonly #workspaceVerifier: CodexWorkspaceVerifier;
  readonly #ingress: CodexExecutionBackendIngress;
  readonly #active = new Map<string, AbortController>();

  constructor(
    journal: CodexTurnJournal,
    driver: CodexSdkDriver | null,
    driverFactory: (() => CodexDriverPreparationResult) | null,
    workspaceVerifier: CodexWorkspaceVerifier,
    ingress: CodexExecutionBackendIngress,
  ) {
    this.#journal = journal;
    this.#driver = driver;
    this.#driverFactory = driverFactory;
    this.#workspaceVerifier = workspaceVerifier;
    this.#ingress = ingress;
  }

  #now(): string {
    const value = this.#ingress.now();
    if (!timestamp(value)) throw new TypeError("Codex backend clock is invalid");
    return value;
  }

  #nextId(kind: "backend-execution" | "receipt"): string {
    const value = this.#ingress.nextId(kind);
    if (!operationalIdentifier(value)) throw new TypeError("Codex backend identity is invalid");
    return value;
  }

  #validAdapter(request: ExecutionStartRequest | ExecutionResumeRequest | ExecutionInspectRequest | ExecutionCancelRequest): boolean {
    return request.contractId === this.contractId && request.adapterId === this.adapterId &&
      request.adapterVersion === this.adapterVersion && request.semantic.backendKind === this.backendKind &&
      request.semantic.workspaceMode === "owned";
  }

  async #run(
    request: ExecutionStartRequest | ExecutionResumeRequest,
    prepared: CodexPreparedTurn,
    workspace: VerifiedCodexWorkspace,
  ): Promise<ExecutionPortResult<ExecutionStartReceipt>> {
    if (prepared.replayed) {
      if (prepared.operation === null) {
        return adapterError(request.correlationId, "ambiguous_external_state", "codex_prepared_state_unproved");
      }
      const projection = effectProjection(request, prepared.turn, prepared.operation.receiptId);
      const receipt = Object.freeze({ ...projection, integritySha256: integrity(projection) });
      return receipt.integritySha256 === prepared.operation.receiptSha256
        ? Object.freeze({ ok: true as const, receipt })
        : adapterError(request.correlationId, "integrity_failure", "codex_receipt_replay_mismatch");
    }
    // Close the prepare-to-effect race: filesystem identity and Task digest are checked again
    // after the durable backend turn exists and immediately before the SDK is invoked.
    this.#workspaceVerifier.verify(codexSemantic(request.semantic), request.input);
    const controller = new AbortController();
    this.#active.set(prepared.turn.backendExecutionId, controller);
    let terminalReceipt: ExecutionStartReceipt | null = null;
    let sawTerminal = false;
    try {
      if (request.operation === "resume") {
        if (prepared.turn.threadId === null) throw new CodexJournalError("INTEGRITY_FAILURE", "Continuation thread is absent");
        this.#journal.markActive(prepared.turn.backendExecutionId, prepared.turn.threadId, this.#now());
      }
      const preparedDriver: CodexDriverPreparationResult = this.#driverFactory === null
        ? this.#driver === null
          ? Object.freeze({ ok: false as const, code: "adapter_failure" as const })
          : Object.freeze({ ok: true as const, driver: this.#driver })
        : this.#driverFactory();
      if (!preparedDriver.ok) {
        return preparedDriver.code === "credential_unavailable"
          ? adapterError(request.correlationId, "unauthorized", "codex_credential_unavailable")
          : preparedDriver.code === "configuration_changed"
            ? adapterError(request.correlationId, "conflict", "codex_profile_configuration_changed")
            : adapterError(request.correlationId, "permanent_external", "codex_driver_construction_failed");
      }
      const driver = preparedDriver.driver;
      await driver.run(Object.freeze({
        operation: request.operation === "start" ? "start" : "resume",
        threadId: request.operation === "start" ? null : prepared.turn.threadId,
        workingDirectory: workspace.workingDirectory,
        input: request.input!,
        signal: controller.signal,
      }), (event: CodexSdkObservedEvent) => {
        if (event.type === "thread.started") {
          this.#journal.markActive(prepared.turn.backendExecutionId, event.threadId, this.#now());
          return;
        }
        if (event.type !== "turn.completed" && event.type !== "turn.failed") return;
        if (sawTerminal) throw new CodexSdkDriverError("terminal_duplicated");
        sawTerminal = true;
        const receiptId = this.#nextId("receipt");
        const evidenceReference = terminalEvidence(event);
        const code = event.type === "turn.completed" ? "codex_turn_completed" : "codex_turn_failed";
        const terminal = this.#journal.recordTerminal(
          prepared.turn.backendExecutionId,
          event.type,
          code,
          evidenceReference,
          this.#now(),
          (turn) => {
            const projection = effectProjection(request, turn, receiptId);
            const receipt = Object.freeze({ ...projection, integritySha256: integrity(projection) });
            terminalReceipt = receipt;
            return Object.freeze({ receiptId, receiptSha256: receipt.integritySha256 });
          },
        );
        if (terminalReceipt === null || terminal.operation.receiptId !== receiptId) {
          throw new CodexJournalError("INTEGRITY_FAILURE", "Codex terminal receipt was not committed");
        }
      });
      return terminalReceipt === null
        ? adapterError(request.correlationId, "ambiguous_external_state", "codex_terminal_unproved")
        : Object.freeze({ ok: true as const, receipt: terminalReceipt });
    } catch (error) {
      if (error instanceof CodexJournalError) return journalError(request.correlationId, error);
      return adapterError(request.correlationId, "ambiguous_external_state", "codex_sdk_state_unproved");
    } finally {
      this.#active.delete(prepared.turn.backendExecutionId);
    }
  }

  async start(value: ExecutionStartRequest): Promise<ExecutionPortResult<ExecutionStartReceipt>> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "start" || !this.#validAdapter(request) || request.input === null) {
      return adapterError("unknown-correlation", "invalid_request", "codex_start_invalid");
    }
    try {
      const semantic = codexSemantic(request.semantic);
      const workspace = this.#workspaceVerifier.verify(semantic, request.input);
      const prepared = this.#journal.prepareStart(request, Object.freeze({
        backendExecutionId: this.#nextId("backend-execution"),
        observedAt: this.#now(),
      }));
      return await this.#run(request, prepared, workspace);
    } catch (error) {
      if (error instanceof CodexJournalError) return journalError(request.correlationId, error);
      if (error instanceof WorkspaceRefusal) return adapterError(request.correlationId, "conflict", error.code);
      return adapterError(request.correlationId, "invalid_request", "codex_start_refused");
    }
  }

  async resume(value: ExecutionResumeRequest): Promise<ExecutionPortResult<ExecutionStartReceipt>> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "resume" || !this.#validAdapter(request) || request.input === null) {
      return adapterError("unknown-correlation", "invalid_request", "codex_resume_invalid");
    }
    try {
      const semantic = codexSemantic(request.semantic);
      const workspace = this.#workspaceVerifier.verify(semantic, request.input);
      const prepared = this.#journal.prepareResume(request, Object.freeze({
        backendExecutionId: this.#nextId("backend-execution"),
        observedAt: this.#now(),
      }));
      return await this.#run(request, prepared, workspace);
    } catch (error) {
      if (error instanceof CodexJournalError) return journalError(request.correlationId, error);
      if (error instanceof WorkspaceRefusal) return adapterError(request.correlationId, "conflict", error.code);
      return adapterError(request.correlationId, "invalid_request", "codex_resume_refused");
    }
  }

  async inspect(value: ExecutionInspectRequest): Promise<ExecutionPortResult<ExecutionInspectReceipt>> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "inspect" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "codex_inspect_invalid");
    }
    try {
      const semantic = codexSemantic(request.semantic);
      this.#workspaceVerifier.verify(semantic, null);
      let turn = this.#journal.inspect(request);
      if ((turn.lifecycle === "active" || turn.lifecycle === "unknown") &&
        !this.#active.has(turn.backendExecutionId)) {
        turn = this.#journal.markUnproved(request, this.#now());
      }
      const projection = Object.freeze({
        receiptId: this.#nextId("receipt"),
        contractId: EXECUTION_CONTRACT_ID,
        correlationId: request.correlationId,
        adapterId: this.adapterId,
        adapterVersion: this.adapterVersion,
        backendKind: this.backendKind,
        observedEndpointVersion: CODEX_EXECUTION_ENDPOINT_VERSION,
        operation: "inspect" as const,
        observedExecutionId: request.semantic.executionId,
        outcome: turn.lifecycle === "unknown" ? "deferred" as const : "succeeded" as const,
        code: turn.code,
        observedAt: this.#now(),
        validUntil: null,
        evidenceReference: turn.evidenceReference,
        observationNumber: turn.revision,
        queryId: request.queryId,
        authorizationDecisionId: request.authorizationDecisionId,
        backendExecutionId: turn.backendExecutionId,
        threadId: turn.threadId,
        lifecycle: turn.lifecycle,
        resultReference: turn.evidenceReference,
      });
      if (turn.threadId === null) {
        return adapterError(request.correlationId, "ambiguous_external_state", "codex_thread_identity_unproved");
      }
      const receipt = Object.freeze({ ...projection, threadId: turn.threadId, integritySha256: integrity(projection) });
      // Recompute after replacing the nullable projection field with the proven thread ID.
      const { integritySha256: _ignored, ...exactProjection } = receipt;
      return Object.freeze({
        ok: true as const,
        receipt: Object.freeze({ ...exactProjection, integritySha256: integrity(exactProjection) }),
      });
    } catch (error) {
      if (error instanceof CodexJournalError) return journalError(request.correlationId, error);
      if (error instanceof WorkspaceRefusal) return adapterError(request.correlationId, "conflict", error.code);
      return adapterError(request.correlationId, "ambiguous_external_state", "codex_inspect_unproved");
    }
  }

  async requestCancel(value: ExecutionCancelRequest): Promise<ExecutionPortResult<ExecutionCancelReceipt>> {
    const request = parseExecutionRequest(value);
    if (request === null || request.operation !== "request_cancel" || !this.#validAdapter(request)) {
      return adapterError("unknown-correlation", "invalid_request", "codex_cancel_invalid");
    }
    try {
      const semantic = codexSemantic(request.semantic);
      this.#workspaceVerifier.verify(semantic, null);
      if (request.expectedLifecycle === "turn_succeeded" || request.expectedLifecycle === "failed") {
        const turn = this.#journal.recordCancellationRequest(request, this.#now());
        if (turn.threadId === null || turn.lifecycle !== request.expectedLifecycle) {
          return adapterError(request.correlationId, "conflict", "codex_cancel_terminal_changed");
        }
        const projection = Object.freeze({
          receiptId: this.#nextId("receipt"),
          contractId: EXECUTION_CONTRACT_ID,
          correlationId: request.correlationId,
          adapterId: this.adapterId,
          adapterVersion: this.adapterVersion,
          backendKind: this.backendKind,
          observedEndpointVersion: CODEX_EXECUTION_ENDPOINT_VERSION,
          operation: "request_cancel" as const,
          observedExecutionId: request.semantic.executionId,
          outcome: "succeeded" as const,
          code: turn.code,
          observedAt: this.#now(),
          validUntil: null,
          evidenceReference: turn.evidenceReference,
          observationNumber: turn.revision,
          operationId: request.operationId,
          intentId: request.intentId,
          idempotencyKey: request.idempotencyKey,
          observedPreRevision: turn.revision,
          observedPostRevision: turn.revision,
          backendExecutionId: turn.backendExecutionId,
          threadId: turn.threadId,
          lifecycle: "already_terminal" as const,
        });
        return Object.freeze({
          ok: true as const,
          receipt: Object.freeze({ ...projection, integritySha256: integrity(projection) }),
        });
      }
      const controller = this.#active.get(request.backendExecutionId);
      if (controller !== undefined) {
        this.#journal.recordCancellationRequest(request, this.#now());
        controller.abort();
      }
      return adapterError(request.correlationId, "ambiguous_external_state", "codex_cancel_terminal_unproved");
    } catch (error) {
      if (error instanceof CodexJournalError) return journalError(request.correlationId, error);
      if (error instanceof WorkspaceRefusal) return adapterError(request.correlationId, "conflict", error.code);
      return adapterError(request.correlationId, "ambiguous_external_state", "codex_cancel_unproved");
    }
  }
}

function codexSemantic(
  semantic: ExecutionSemanticIdentity,
): Extract<ExecutionSemanticIdentity, { backendKind: "codex-sdk" }> {
  if (semantic.backendKind !== "codex-sdk" || semantic.workspaceMode !== "owned") {
    throw new TypeError("Codex semantic identity is invalid");
  }
  return semantic;
}

export function createCodexWorkspaceVerifier(
  configuration: CodexExecutionBackendConfiguration,
  store: PersistenceStore | null = null,
): CodexWorkspaceVerifier {
  return new LocalGitCodexWorkspaceVerifier(configuration, store);
}

export function createCodexExecutionBackend(
  store: PersistenceStore,
  configuration: CodexExecutionBackendConfiguration,
  options: Readonly<{
    driver?: CodexSdkDriver;
    driverFactory?: () => CodexDriverPreparationResult;
    journal?: CodexTurnJournal;
    workspaceVerifier?: CodexWorkspaceVerifier;
    ingress?: CodexExecutionBackendIngress;
  }> = Object.freeze({}),
): ExecutionBackend {
  if (options.driver !== undefined && options.driverFactory !== undefined) {
    throw new TypeError("Codex execution backend accepts one driver source");
  }
  return new CodexExecutionBackend(
    options.journal ?? createCodexTurnJournal(store),
    options.driver ?? (options.driverFactory === undefined ? createPinnedCodexSdkDriver() : null),
    options.driverFactory ?? null,
    options.workspaceVerifier ?? createCodexWorkspaceVerifier(configuration, store),
    options.ingress ?? defaultIngress(),
  );
}
