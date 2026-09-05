import path from "node:path";
import {
  evaluateAuthorization,
  type AuthorizationAction,
  type AuthorizationEvaluation,
  type AuthorizationPolicyResult,
} from "./authorization.ts";
import type { TrustedActorAssertion } from "./application.ts";
import {
  CODEX_PRODUCT_CREDENTIAL_REFERENCE,
  CODEX_PRODUCT_DESTINATION,
  CodexProfileConfigurationError,
  createProcessEnvironmentCodexCredentialResolver,
  inspectCodexProfileConfiguration,
  revalidateCodexProfileConfiguration,
  type CodexCredentialResolver,
  type CodexProfileConfigurationInput,
} from "./codex-product-configuration.ts";
import {
  createCodexExecutionBackend,
  type CodexExecutionBackendConfiguration,
  type CodexDriverPreparationResult,
} from "./codex-execution-backend.ts";
import {
  createProductCodexSdkDriver,
  type CodexSdkDriver,
} from "./codex-sdk-worker.ts";
import {
  createCodexTargetedDispatcherService,
  type DispatcherErrorCode,
  type DispatcherIngress,
} from "./dispatcher-application.ts";
import { validateTrustedRuntimeAndActor } from "./execution-application.ts";
import {
  createInjectedCodexReliableExecutionService,
  codexProductTaskInputReference,
  type CodexExecutionActGuard,
  type CodexExecutionActGuardInput,
  type CodexExecutionCancelCommand,
  type CodexExecutionContinuationCommand,
  type CodexExecutionInspectCommand,
  type CodexExecutionStartCommand,
  type ReliableExecutionView,
  type ReliableExecutionErrorCode,
  type ReliableExecutionIngress,
} from "./execution-loop.ts";
import type { ExecutionBackend } from "./execution-port.ts";
import { revalidateProjectRoot } from "./project-registry.ts";
import {
  readApplicationStateForOwner,
  withApplicationTransaction,
  type ApplicationState,
  type CodexProductOperationRecord,
  type CodexProfileRecord,
  type RegisteredProject,
  type WorkspaceGenerationRecord,
  type WorkspaceVerifiedReceiptRecord,
} from "./persistence/application-repository.ts";
import { PersistenceError } from "./persistence/errors.ts";
import {
  codexRequiredGrantSetJson,
  codexRequiredGrantSetSha256,
  compactCanonicalJson,
  type CodexRequiredGrantWitness,
} from "./persistence/codex-product-digest.ts";
import type { PersistenceStore } from "./persistence/store.ts";
import { canonicalJson, isCanonicalUtcTimestamp, sha256 } from "./persistence/values.ts";
import type {
  ProductExecutionCancelCommand,
  ProductExecutionContinuationCommand,
  ProductExecutionInspectCommand,
  ProductExecutionView,
  ProductWaitingView,
} from "./product-runtime.ts";
import {
  createWorkspaceApplicationService,
  type WorkspaceApplicationErrorCode,
  type WorkspaceApplicationService,
  type WorkspaceIngress,
} from "./workspace-application.ts";
import {
  WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
  WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  createWindowsGitWorkspaceBackend,
} from "./workspace-git-adapter.ts";
import type { WorkspaceBackend } from "./workspace-port.ts";

export const CODEX_PRODUCT_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "AUTHORIZATION_DENIED",
  "CONFIRMATION_REQUIRED",
  "PROJECT_NOT_FOUND",
  "PROJECT_DISABLED",
  "PROJECT_IDENTITY_CHANGED",
  "TASK_NOT_FOUND",
  "TASK_NOT_ELIGIBLE",
  "CODEX_PROFILE_NOT_FOUND",
  "CODEX_PROFILE_INACTIVE",
  "CODEX_CREDENTIAL_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
  "STALE_REVISION",
  "STALE_FENCE",
  "LEASE_EXPIRED",
  "RECONCILIATION_REQUIRED",
  "CODEX_ADAPTER_FAILURE",
  "PERSISTENCE_FAILURE",
] as const);

export type CodexProductErrorCode = (typeof CODEX_PRODUCT_ERROR_CODES)[number];

export interface CodexProductError {
  readonly code: CodexProductErrorCode;
  readonly message: string;
}

export interface CodexProductSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface CodexProductFailure {
  readonly ok: false;
  readonly error: CodexProductError;
}

export type CodexProductResult<T> = CodexProductSuccess<T> | CodexProductFailure;

export interface CodexProductConfirmationRequest {
  readonly actorId: string;
  readonly action: "codex.profile.activate" | "codex.profile.deactivate" | "codex.execution.invoke" | "codex.execution.cancel";
  readonly requestId: string;
  readonly correlationId: string;
}

export interface CodexProductIngress {
  currentActor(): TrustedActorAssertion;
  currentLeaseOwner(): string;
  now(): string;
  currentRuntimeRootKey(): string;
  currentDispatcherOwner?(): string;
  nextId(kind: string): string;
  confirmOperation(request: CodexProductConfirmationRequest): Readonly<{ confirmationId: string }> | null;
}

interface ProfileCommandBase {
  readonly projectId: string;
  readonly expectedProjectResourceRevision: number;
  readonly expectedProjectConfigRevision: number;
  readonly profileId: string;
  readonly expectedProfileRevision: number;
}

export interface CodexProfileActivateCommand extends ProfileCommandBase, CodexProfileConfigurationInput {
  readonly kind: "codex.profile.activate";
  readonly idempotencyKey: string;
}

export interface CodexProfileInspectCommand extends ProfileCommandBase {
  readonly kind: "codex.profile.inspect";
}

export interface CodexProfileDeactivateCommand extends ProfileCommandBase {
  readonly kind: "codex.profile.deactivate";
  readonly idempotencyKey: string;
}

export interface CodexDispatchRunCommand extends ProfileCommandBase {
  readonly kind: "codex.dispatch-run";
  readonly taskId: string;
  readonly expectedTaskRevision: number;
  readonly baseReference: string;
  readonly idempotencyKey: string;
  readonly leaseDurationSeconds: number;
}

export interface CodexProfileView {
  readonly profileId: string;
  readonly projectId: string;
  readonly projectResourceRevision: number;
  readonly projectConfigRevision: number;
  readonly profileRevision: number;
  readonly status: CodexProfileRecord["status"];
  readonly destination: typeof CODEX_PRODUCT_DESTINATION;
  readonly credentialConfigured: true;
  readonly configurationSha256: string;
  readonly replayed: boolean;
}

export interface CodexDispatchView {
  readonly runId: string;
  readonly status: "starting" | "reconciling" | "sweeping" | "completed" | "partial" | "failed" | "interrupted";
  readonly memberId: string;
  readonly profileId: string;
  readonly profileRevision: number;
  readonly destination: typeof CODEX_PRODUCT_DESTINATION;
  readonly baseReference: string;
  readonly taskId: string;
  readonly taskState: "ready" | "running" | "waiting" | "completed" | "cancelled";
  readonly taskRevision: number;
  readonly executionId: string;
  readonly executionRevision: number;
  readonly attemptNumber: number;
  readonly fencingToken: number;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly workspaceRevision: number;
  readonly workspaceStatus: WorkspaceGenerationRecord["status"];
  readonly lifecycle: string;
  readonly replayed: boolean;
}

export interface CodexProductApplicationService {
  activateProfile(value: unknown): CodexProductResult<CodexProfileView>;
  inspectProfile(value: unknown): CodexProductResult<CodexProfileView>;
  deactivateProfile(value: unknown): CodexProductResult<CodexProfileView>;
  dispatchRun(value: unknown): Promise<CodexProductResult<CodexDispatchView>>;
  inspect(value: unknown): Promise<CodexProductResult<ProductExecutionView>>;
  resume(value: unknown): Promise<CodexProductResult<ProductExecutionView>>;
  retry(value: unknown): Promise<CodexProductResult<ProductExecutionView>>;
  requestCancel(value: unknown): Promise<CodexProductResult<ProductExecutionView>>;
}

/** Internal deterministic seams; intentionally omitted from the supported package root. */
export interface CodexProductApplicationDependencies {
  readonly credentialResolver: CodexCredentialResolver;
  readonly workspaceBackend?: (
    profile: CodexProfileRecord,
    project: RegisteredProject,
  ) => Readonly<{ backend: WorkspaceBackend; adapterId: string; adapterVersion: string }>;
  readonly executionBackend?: (
    store: PersistenceStore,
    profile: CodexProfileRecord,
    project: RegisteredProject,
    driverFactory: () => unknown,
  ) => ExecutionBackend;
  readonly sdkDriver?: (apiKey: string, codexHome: string) => unknown;
}

export interface CodexProductApplicationHooks {
  afterStage?(stage: string): void;
}

type UnknownRecord = Readonly<Record<string, unknown>>;
type TrustedContext = Readonly<{ actor: TrustedActorAssertion; now: string }>;

const OPERATIONAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function exactRecord(value: unknown, keys: readonly string[]): UnknownRecord | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const expected = new Set(keys);
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !expected.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return null;
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function operationalId(value: unknown): value is string {
  return typeof value === "string" && OPERATIONAL_ID.test(value);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function failure(code: CodexProductErrorCode, message: string): CodexProductFailure {
  return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) });
}

function success<T>(value: T): CodexProductSuccess<T> {
  return Object.freeze({ ok: true as const, value });
}

function stableId(prefix: string, ...parts: readonly unknown[]): string {
  return `${prefix}:${sha256(canonicalJson(parts)).slice(0, 64)}`;
}

function laterTimestamp(previous: string, candidate: string): string {
  return new Date(Math.max(Date.parse(previous) + 1, Date.parse(candidate))).toISOString();
}

function trustedContext(ingress: CodexProductIngress): TrustedContext | null {
  try {
    const actor = ingress.currentActor();
    const now = ingress.now();
    if (!operationalId(actor.actorId) || typeof actor.principal !== "string" || !/^[0-9A-F]{64}$/u.test(actor.principal) ||
      !isCanonicalUtcTimestamp(now)) return null;
    return Object.freeze({ actor: Object.freeze({ actorId: actor.actorId, principal: actor.principal }), now });
  } catch {
    return null;
  }
}

function refreshedConfirmationContext(
  ingress: CodexProductIngress,
  prior: TrustedContext,
): TrustedContext | null {
  const current = trustedContext(ingress);
  return current !== null && current.actor.actorId === prior.actor.actorId &&
    current.actor.principal === prior.actor.principal
    ? current
    : null;
}

function nextIds(ingress: CodexProductIngress, kinds: readonly string[]): readonly string[] | null {
  try {
    const values = kinds.map((kind) => ingress.nextId(kind));
    return values.every(operationalId) && new Set(values).size === values.length ? Object.freeze(values) : null;
  } catch {
    return null;
  }
}

function runtimeFailure(store: PersistenceStore, state: ApplicationState, context: TrustedContext): CodexProductFailure | null {
  const validation = validateTrustedRuntimeAndActor(state, context.actor, store);
  if (validation.ok) return null;
  return validation.reason === "runtime_root_unavailable" || validation.reason === "runtime_root_mismatch"
    ? failure("PROJECT_IDENTITY_CHANGED", "The trusted runtime root identity changed.")
    : failure("AUTHORIZATION_DENIED", "The trusted local actor is not authorized for this runtime.");
}

function projectAuthorization(
  state: ApplicationState,
  context: TrustedContext,
  action: AuthorizationAction,
  project: RegisteredProject,
  confirmed: boolean,
  readOnly = false,
): AuthorizationEvaluation {
  const enabled = state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled === true;
  const policy: AuthorizationPolicyResult = readOnly ? "read_not_applicable" : enabled ? "allow" : "deny";
  return evaluateAuthorization({
    actorId: context.actor.actorId,
    action,
    target: {
      projectId: project.projectId,
      resourceRevision: project.resourceRevision,
      configRevision: project.configRevision,
    },
    now: context.now,
    policy,
    confirmed,
    grants: state.grants,
  });
}

function runtimeAuthorization(
  state: ApplicationState,
  context: TrustedContext,
  action: AuthorizationAction,
): AuthorizationEvaluation {
  return evaluateAuthorization({
    actorId: context.actor.actorId,
    action,
    target: { projectId: null, resourceRevision: null, configRevision: null },
    now: context.now,
    policy: "allow",
    confirmed: true,
    grants: state.grants,
  });
}

function grantWitness(
  owner: CodexRequiredGrantWitness["owner"],
  action: AuthorizationAction,
  evaluation: AuthorizationEvaluation,
  project: RegisteredProject | null,
): CodexRequiredGrantWitness {
  return Object.freeze({
    owner,
    action,
    projectId: project?.projectId ?? null,
    resourceRevision: project?.resourceRevision ?? null,
    configRevision: project?.configRevision ?? null,
    allowed: evaluation.allowed,
    reason: evaluation.reason,
    policy: evaluation.policy,
    grantId: evaluation.grantId,
    grantRevision: evaluation.grantRevision,
  });
}

function requiredGrantSet(
  witnesses: readonly CodexRequiredGrantWitness[],
): Readonly<{ json: string; sha256: string }> {
  const json = codexRequiredGrantSetJson(witnesses);
  return Object.freeze({ json, sha256: codexRequiredGrantSetSha256(json) });
}

function prepareGrantSet(
  project: RegisteredProject,
  evaluation: AuthorizationEvaluation,
): ReturnType<typeof requiredGrantSet> {
  return requiredGrantSet(Object.freeze([
    grantWitness("codex-product", "codex.execution.invoke", evaluation, project),
  ]));
}

function operationGrantSet(
  state: ApplicationState,
  context: TrustedContext,
  operation: CodexProductOperationRecord,
  project: RegisteredProject,
  codex: AuthorizationEvaluation,
  core: AuthorizationEvaluation,
): Readonly<{ set: ReturnType<typeof requiredGrantSet>; evaluations: readonly AuthorizationEvaluation[] }> {
  const action: "execution.start" | "execution.resume" | "execution.retry" = operation.commandKind === "codex.dispatch-run"
    ? "execution.start"
    : operation.commandKind;
  const dispatch = runtimeAuthorization(state, context, "dispatch.run");
  const claim = projectAuthorization(state, context, "execution.claim", project, true);
  const operationAction = projectAuthorization(state, context, action, project, true);
  const takeover = operation.commandKind === "codex.dispatch-run"
    ? null
    : projectAuthorization(state, context, "execution.lease.takeover", project, true);
  const reserve = projectAuthorization(state, context, "workspace.reserve", project, true);
  const create = projectAuthorization(state, context, "workspace.create", project, true);
  const evaluations = Object.freeze([
    codex,
    core,
    dispatch,
    claim,
    operationAction,
    ...(takeover === null ? [] : [takeover]),
    reserve,
    create,
  ]);
  const witnesses = Object.freeze([
    grantWitness("codex-product", "codex.execution.invoke", codex, project),
    grantWitness("execution-core", action, core, project),
    grantWitness("dispatcher", "dispatch.run", dispatch, null),
    grantWitness("execution-claim", "execution.claim", claim, project),
    grantWitness("execution-claim", action, operationAction, project),
    ...(takeover === null ? [] : [
      grantWitness("execution-claim", "execution.lease.takeover", takeover, project),
    ]),
    grantWitness("workspace", "workspace.reserve", reserve, project),
    grantWitness("workspace", "workspace.create", create, project),
  ]);
  return Object.freeze({ set: requiredGrantSet(witnesses), evaluations });
}

function reconstructedWorkspacePaths(
  state: ApplicationState,
  runtimeRoot: string,
  additional: Readonly<{ key: string; root: string }> | null = null,
): readonly string[] {
  const roots = new Map<string, string>();
  for (const profile of state.codexProfiles) {
    const prior = roots.get(profile.workspaceRootKey);
    if (prior !== undefined && prior !== profile.workspaceRoot) {
      throw new CodexProfileConfigurationError("identity_changed");
    }
    roots.set(profile.workspaceRootKey, profile.workspaceRoot);
  }
  if (additional !== null) {
    const prior = roots.get(additional.key);
    if (prior !== undefined && prior !== additional.root) {
      throw new CodexProfileConfigurationError("identity_changed");
    }
    roots.set(additional.key, additional.root);
  }
  const paths = new Set<string>(roots.values());
  for (const generation of state.workspaceGenerations) {
    const root = roots.get(generation.workspaceRootKey);
    if (root === undefined) {
      throw new CodexProfileConfigurationError("identity_changed");
    }
    paths.add(path.join(
      root,
      "ato-workspaces",
      `w-${sha256(generation.workspaceId).toLocaleLowerCase("en-US")}-g${generation.generation}`,
    ));
  }
  const inventory = Object.freeze([...paths]);
  for (const profile of state.codexProfiles) {
    const project = state.projects.find((candidate) => candidate.projectId === profile.projectId);
    if (project === undefined) throw new CodexProfileConfigurationError("identity_changed");
    revalidateCodexProfileConfiguration(profile, project, runtimeRoot, inventory);
  }
  return inventory;
}

function profileProjection(profile: CodexProfileRecord, replayed: boolean): CodexProfileView {
  return Object.freeze({
    profileId: profile.profileId,
    projectId: profile.projectId,
    projectResourceRevision: profile.projectResourceRevision,
    projectConfigRevision: profile.projectConfigRevision,
    profileRevision: profile.revision,
    status: profile.status,
    destination: profile.destination,
    credentialConfigured: true as const,
    configurationSha256: profile.constructorConfigSha256,
    replayed,
  });
}

function profileOperationProjection(
  profile: CodexProfileRecord,
  operation: ApplicationState["codexProfileOperations"][number],
): CodexProfileView {
  if (operation.result !== "allow" || operation.resultingProfileRevision === null) {
    throw new PersistenceError("CORRUPT_ROW", "Codex profile replay has no allowed result");
  }
  return Object.freeze({
    profileId: operation.profileId,
    projectId: operation.projectId,
    projectResourceRevision: operation.expectedProjectResourceRevision,
    projectConfigRevision: operation.expectedProjectConfigRevision,
    profileRevision: operation.resultingProfileRevision,
    status: operation.action === "codex.profile.activate" ? "active" as const : "deactivated" as const,
    destination: profile.destination,
    credentialConfigured: true as const,
    configurationSha256: profile.constructorConfigSha256,
    replayed: true,
  });
}

const PROFILE_BASE_KEYS = Object.freeze([
  "expectedProfileRevision", "expectedProjectConfigRevision", "expectedProjectResourceRevision",
  "kind", "profileId", "projectId",
] as const);

function parseProfileBase(record: UnknownRecord): ProfileCommandBase | null {
  return operationalId(record.projectId) && positive(record.expectedProjectResourceRevision) &&
    positive(record.expectedProjectConfigRevision) && operationalId(record.profileId) &&
    nonnegative(record.expectedProfileRevision)
    ? Object.freeze({
      projectId: record.projectId,
      expectedProjectResourceRevision: record.expectedProjectResourceRevision,
      expectedProjectConfigRevision: record.expectedProjectConfigRevision,
      profileId: record.profileId,
      expectedProfileRevision: record.expectedProfileRevision,
    }) : null;
}

function parseActivate(value: unknown): CodexProfileActivateCommand | null {
  const record = exactRecord(value, [
    ...PROFILE_BASE_KEYS, "codexHome", "codexHomeKey", "gitExecutable", "idempotencyKey",
    "workspaceRoot", "workspaceRootKey",
  ]);
  const base = record === null ? null : parseProfileBase(record);
  return base !== null && record?.kind === "codex.profile.activate" && operationalId(record.idempotencyKey) &&
    operationalId(record.workspaceRootKey) && operationalId(record.codexHomeKey) &&
    typeof record.workspaceRoot === "string" && typeof record.codexHome === "string" && typeof record.gitExecutable === "string"
    ? Object.freeze({
      kind: "codex.profile.activate" as const,
      ...base,
      workspaceRootKey: record.workspaceRootKey,
      workspaceRoot: record.workspaceRoot,
      codexHomeKey: record.codexHomeKey,
      codexHome: record.codexHome,
      gitExecutable: record.gitExecutable,
      idempotencyKey: record.idempotencyKey,
    }) : null;
}

function parseInspectProfile(value: unknown): CodexProfileInspectCommand | null {
  const record = exactRecord(value, PROFILE_BASE_KEYS);
  const base = record === null ? null : parseProfileBase(record);
  return base !== null && record?.kind === "codex.profile.inspect" && base.expectedProfileRevision > 0
    ? Object.freeze({ kind: "codex.profile.inspect" as const, ...base }) : null;
}

function parseDeactivate(value: unknown): CodexProfileDeactivateCommand | null {
  const record = exactRecord(value, [...PROFILE_BASE_KEYS, "idempotencyKey"]);
  const base = record === null ? null : parseProfileBase(record);
  return base !== null && record?.kind === "codex.profile.deactivate" && base.expectedProfileRevision > 0 &&
    operationalId(record.idempotencyKey)
    ? Object.freeze({ kind: "codex.profile.deactivate" as const, ...base, idempotencyKey: record.idempotencyKey }) : null;
}

function parseDispatch(value: unknown): CodexDispatchRunCommand | null {
  const record = exactRecord(value, [
    ...PROFILE_BASE_KEYS, "baseReference", "expectedTaskRevision", "idempotencyKey",
    "leaseDurationSeconds", "taskId",
  ]);
  const base = record === null ? null : parseProfileBase(record);
  return base !== null && record?.kind === "codex.dispatch-run" && base.expectedProfileRevision > 0 &&
    operationalId(record.taskId) && positive(record.expectedTaskRevision) &&
    typeof record.baseReference === "string" && /^[0-9a-f]{40}$/u.test(record.baseReference) &&
    operationalId(record.idempotencyKey) && positive(record.leaseDurationSeconds) &&
    record.leaseDurationSeconds >= 30 && record.leaseDurationSeconds <= 3_600
    ? Object.freeze({
      kind: "codex.dispatch-run" as const,
      ...base,
      taskId: record.taskId,
      expectedTaskRevision: record.expectedTaskRevision,
      baseReference: record.baseReference,
      idempotencyKey: record.idempotencyKey,
      leaseDurationSeconds: record.leaseDurationSeconds,
    }) : null;
}

const EXECUTION_COMMON_KEYS = Object.freeze([
  "expectedAttemptNumber", "expectedExecutionRevision", "expectedFencingToken",
  "expectedProjectConfigRevision", "expectedProjectResourceRevision", "expectedTaskRevision",
  "executionId", "idempotencyKey", "kind", "projectId", "taskId",
] as const);

function parseExecutionCommon(record: UnknownRecord): Omit<ProductExecutionInspectCommand, "kind"> | null {
  return operationalId(record.projectId) && positive(record.expectedProjectResourceRevision) &&
    positive(record.expectedProjectConfigRevision) && operationalId(record.taskId) &&
    positive(record.expectedTaskRevision) && operationalId(record.executionId) &&
    positive(record.expectedExecutionRevision) && positive(record.expectedAttemptNumber) &&
    positive(record.expectedFencingToken) && operationalId(record.idempotencyKey)
    ? Object.freeze({
      projectId: record.projectId,
      expectedProjectResourceRevision: record.expectedProjectResourceRevision,
      expectedProjectConfigRevision: record.expectedProjectConfigRevision,
      taskId: record.taskId,
      expectedTaskRevision: record.expectedTaskRevision,
      executionId: record.executionId,
      expectedExecutionRevision: record.expectedExecutionRevision,
      expectedAttemptNumber: record.expectedAttemptNumber,
      expectedFencingToken: record.expectedFencingToken,
      idempotencyKey: record.idempotencyKey,
    }) : null;
}

function parseExecutionInspect(value: unknown): ProductExecutionInspectCommand | null {
  const record = exactRecord(value, EXECUTION_COMMON_KEYS);
  const common = record === null ? null : parseExecutionCommon(record);
  return common !== null && record?.kind === "execution.inspect"
    ? Object.freeze({ kind: "execution.inspect" as const, ...common }) : null;
}

function parseExecutionContinuation(
  value: unknown,
  kind: "execution.resume" | "execution.retry",
): ProductExecutionContinuationCommand | null {
  const record = exactRecord(value, [...EXECUTION_COMMON_KEYS, "continuationReference", "requiredActionReceiptId"]);
  const common = record === null ? null : parseExecutionCommon(record);
  return common !== null && record?.kind === kind && operationalId(record.continuationReference) &&
    operationalId(record.requiredActionReceiptId)
    ? Object.freeze({
      kind,
      ...common,
      continuationReference: record.continuationReference,
      requiredActionReceiptId: record.requiredActionReceiptId,
    }) : null;
}

function parseExecutionCancel(value: unknown): ProductExecutionCancelCommand | null {
  const record = exactRecord(value, [...EXECUTION_COMMON_KEYS, "reasonCode"]);
  const common = record === null ? null : parseExecutionCommon(record);
  return common !== null && record?.kind === "execution.request-cancel" &&
    typeof record.reasonCode === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(record.reasonCode)
    ? Object.freeze({ kind: "execution.request-cancel" as const, ...common, reasonCode: record.reasonCode }) : null;
}

function boundProject(
  state: ApplicationState,
  command: ProfileCommandBase,
): RegisteredProject | CodexProductFailure {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failure("PROJECT_NOT_FOUND", "The Project was not found.");
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
    project.configRevision !== command.expectedProjectConfigRevision) {
    return failure("STALE_REVISION", "The Project revision is stale.");
  }
  if (state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled !== true) {
    return failure("PROJECT_DISABLED", "The Project is disabled.");
  }
  return project;
}

function mapConfigurationFailure(): CodexProductFailure {
  return failure("PROJECT_IDENTITY_CHANGED", "The Codex profile filesystem identity is invalid or changed.");
}

function mapDispatcher(code: DispatcherErrorCode): CodexProductFailure {
  switch (code) {
    case "AUTHORIZATION_DENIED": return failure("AUTHORIZATION_DENIED", "Current grants did not authorize Codex dispatch.");
    case "IDEMPOTENCY_CONFLICT": return failure("IDEMPOTENCY_CONFLICT", "The idempotency key is bound to another command.");
    case "LEASE_EXPIRED": return failure("LEASE_EXPIRED", "The dispatcher lease expired.");
    case "PROJECT_IDENTITY_CHANGED": return failure("PROJECT_IDENTITY_CHANGED", "The Project identity changed.");
    case "STALE_OWNER":
    case "STALE_REVISION": return failure("STALE_REVISION", "The dispatcher tuple is stale.");
    case "INVALID_INPUT": return failure("INVALID_INPUT", "The dispatcher input is invalid.");
    case "PERSISTENCE_FAILURE": return failure("PERSISTENCE_FAILURE", "Dispatcher persistence failed closed.");
    default: return failure("RECONCILIATION_REQUIRED", "The Codex dispatcher requires reconciliation.");
  }
}

function mapWorkspace(code: WorkspaceApplicationErrorCode): CodexProductFailure {
  switch (code) {
    case "AUTHORIZATION_DENIED": return failure("AUTHORIZATION_DENIED", "Current grants did not authorize the workspace operation.");
    case "PROJECT_NOT_FOUND": return failure("PROJECT_NOT_FOUND", "The Project was not found.");
    case "PROJECT_DISABLED": return failure("PROJECT_DISABLED", "The Project is disabled.");
    case "PROJECT_IDENTITY_CHANGED": return failure("PROJECT_IDENTITY_CHANGED", "The Project identity changed.");
    case "TASK_NOT_FOUND": return failure("TASK_NOT_FOUND", "The Task was not found.");
    case "STALE_FENCE": return failure("STALE_FENCE", "The execution fence is stale.");
    case "STALE_REVISION": return failure("STALE_REVISION", "The workspace owner tuple is stale.");
    case "IDEMPOTENCY_CONFLICT": return failure("IDEMPOTENCY_CONFLICT", "The workspace idempotency identity conflicts.");
    case "INVALID_INPUT": return failure("INVALID_INPUT", "The workspace command is invalid.");
    case "PERSISTENCE_FAILURE": return failure("PERSISTENCE_FAILURE", "Workspace persistence failed closed.");
    default: return failure("RECONCILIATION_REQUIRED", "The workspace requires reconciliation.");
  }
}

function mapReliable(code: ReliableExecutionErrorCode): CodexProductFailure {
  switch (code) {
    case "AUTHORIZATION_DENIED": return failure("AUTHORIZATION_DENIED", "Current grants did not authorize the execution operation.");
    case "CONFIRMATION_REQUIRED": return failure("CONFIRMATION_REQUIRED", "Fresh Codex confirmation is required.");
    case "PROJECT_NOT_FOUND": return failure("PROJECT_NOT_FOUND", "The Project was not found.");
    case "PROJECT_DISABLED": return failure("PROJECT_DISABLED", "The Project is disabled.");
    case "PROJECT_IDENTITY_CHANGED": return failure("PROJECT_IDENTITY_CHANGED", "The Project identity changed.");
    case "TASK_NOT_FOUND": return failure("TASK_NOT_FOUND", "The Task was not found.");
    case "TASK_NOT_ELIGIBLE": return failure("TASK_NOT_ELIGIBLE", "The Task is not eligible.");
    case "EXECUTION_NOT_FOUND": return failure("RECONCILIATION_REQUIRED", "The execution is absent.");
    case "IDEMPOTENCY_CONFLICT": return failure("IDEMPOTENCY_CONFLICT", "The execution idempotency identity conflicts.");
    case "STALE_REVISION": return failure("STALE_REVISION", "The execution tuple is stale.");
    case "STALE_FENCE": return failure("STALE_FENCE", "The execution fence is stale.");
    case "LEASE_EXPIRED": return failure("LEASE_EXPIRED", "The execution lease expired.");
    case "INVALID_INPUT": return failure("INVALID_INPUT", "The execution input is invalid.");
    case "PERSISTENCE_FAILURE": return failure("PERSISTENCE_FAILURE", "Execution persistence failed closed.");
    default: return failure("RECONCILIATION_REQUIRED", "The Codex execution requires reconciliation.");
  }
}

function defaultWorkspaceBackend(
  profile: CodexProfileRecord,
  project: RegisteredProject,
): Readonly<{ backend: WorkspaceBackend; adapterId: string; adapterVersion: string }> {
  return Object.freeze({
    backend: createWindowsGitWorkspaceBackend(Object.freeze({
      gitExecutable: profile.gitExecutable,
      projectRoots: Object.freeze([{ rootKey: project.rootKey, path: project.canonicalRoot }]),
      workspaceRoots: Object.freeze([{ rootKey: profile.workspaceRootKey, path: profile.workspaceRoot }]),
    })),
    adapterId: WINDOWS_GIT_WORKSPACE_ADAPTER_ID,
    adapterVersion: WINDOWS_GIT_WORKSPACE_ADAPTER_VERSION,
  });
}

function defaultExecutionBackend(
  store: PersistenceStore,
  profile: CodexProfileRecord,
  project: RegisteredProject,
  driverFactory: () => CodexDriverPreparationResult,
): ExecutionBackend {
  const configuration: CodexExecutionBackendConfiguration = Object.freeze({
    gitExecutable: profile.gitExecutable,
    projectBindings: Object.freeze([{
      projectId: project.projectId,
      rootKey: project.rootKey,
      path: project.canonicalRoot,
    }]),
    workspaceRoots: Object.freeze([{ key: profile.workspaceRootKey, path: profile.workspaceRoot }]),
  });
  return createCodexExecutionBackend(store, configuration, Object.freeze({ driverFactory }));
}

function dispatcherIngress(ingress: CodexProductIngress): DispatcherIngress {
  return Object.freeze({
    currentActor: () => ingress.currentActor(),
    // Targeted Codex runs are reopened by later CLI processes. Bind their worker
    // identity to the stable actor/runtime execution owner; the ordinary Manual
    // dispatcher continues to use its fresh process worker owner.
    currentWorkerOwner: () => ingress.currentLeaseOwner(),
    currentExecutionLeaseOwner: () => ingress.currentLeaseOwner(),
    currentRuntimeRootKey: () => ingress.currentRuntimeRootKey(),
    now: () => ingress.now(),
    nextId: (kind: string) => ingress.nextId(kind),
  });
}

function roleIngress(ingress: CodexProductIngress, operation: CodexProductOperationRecord, role: string): WorkspaceIngress {
  const ordinals = new Map<string, number>();
  return Object.freeze({
    currentActor: () => ingress.currentActor(),
    now: () => ingress.now(),
    nextId(kind: string): string {
      if (kind === "workspace") return operation.workspaceId;
      const ordinal = (ordinals.get(kind) ?? 0) + 1;
      ordinals.set(kind, ordinal);
      return stableId(kind, operation.operationId, role, ordinal);
    },
    confirmHighRisk: () => false,
  });
}

function reliableIngress(ingress: CodexProductIngress, operation: CodexProductOperationRecord): ReliableExecutionIngress {
  return Object.freeze({
    currentActor: () => ingress.currentActor(),
    currentLeaseOwner: () => ingress.currentLeaseOwner(),
    now: () => ingress.now(),
    nextId(kind: string): string {
      if (kind === "intent") return operation.intentId;
      return stableId(kind, operation.operationId, "execution-start-intent");
    },
    confirmOperation: () => null,
  });
}

function reliableRoleIngress(
  ingress: CodexProductIngress,
  operation: CodexProductOperationRecord,
  role: string,
): ReliableExecutionIngress {
  const ordinals = new Map<string, number>();
  return Object.freeze({
    currentActor: () => ingress.currentActor(),
    currentLeaseOwner: () => ingress.currentLeaseOwner(),
    now: () => ingress.now(),
    nextId(kind: string): string {
      const ordinal = (ordinals.get(kind) ?? 0) + 1;
      ordinals.set(kind, ordinal);
      return stableId(kind, operation.operationId, role, ordinal);
    },
    confirmOperation: () => null,
  });
}

function workspaceReceipt(
  state: ApplicationState,
  generation: WorkspaceGenerationRecord,
): WorkspaceVerifiedReceiptRecord | null {
  return state.workspaceReceipts.find((candidate) => {
    const finalization = state.workspaceFinalizations.find((record) =>
      record.intentId === candidate.intentId && record.verifiedReceiptId === candidate.verifiedReceiptId &&
      record.outcome === "succeeded" && record.resultingGenerationStatus === "ready" &&
      record.resultingGenerationRevision === generation.revision
    );
    return candidate.workspaceId === generation.workspaceId && candidate.generation === generation.generation &&
      candidate.outcome === "succeeded" && candidate.externalState === "complete" &&
      candidate.headObjectId !== null && finalization !== undefined;
  }) ?? null;
}

function codexEffectAbsent(
  state: ApplicationState,
  operation: CodexProductOperationRecord,
): boolean {
  return !state.codexTurns.some((candidate) => candidate.executionId === operation.executionId) &&
    !state.codexBackendOperations.some((candidate) => candidate.intentId === operation.intentId);
}

function productCommandJson(command: CodexDispatchRunCommand, actorId: string): string {
  return compactCanonicalJson({
    apiVersion: "ato.api/v1",
    command: "codex.dispatch-run",
    actorId,
    projectId: command.projectId,
    expectedProjectResourceRevision: command.expectedProjectResourceRevision,
    expectedProjectConfigRevision: command.expectedProjectConfigRevision,
    profileId: command.profileId,
    expectedProfileRevision: command.expectedProfileRevision,
    taskId: command.taskId,
    expectedTaskRevision: command.expectedTaskRevision,
    baseReference: command.baseReference,
    idempotencyKey: command.idempotencyKey,
    leaseDurationSeconds: command.leaseDurationSeconds,
    confirmationAction: "codex.execution.invoke",
  });
}

function continuationCommandJson(command: ProductExecutionContinuationCommand, actorId: string): string {
  return compactCanonicalJson({
    apiVersion: "ato.api/v1",
    command: command.kind,
    actorId,
    projectId: command.projectId,
    expectedProjectResourceRevision: command.expectedProjectResourceRevision,
    expectedProjectConfigRevision: command.expectedProjectConfigRevision,
    taskId: command.taskId,
    expectedTaskRevision: command.expectedTaskRevision,
    executionId: command.executionId,
    expectedExecutionRevision: command.expectedExecutionRevision,
    expectedAttemptNumber: command.expectedAttemptNumber,
    expectedFencingToken: command.expectedFencingToken,
    idempotencyKey: command.idempotencyKey,
    continuationReference: command.continuationReference,
    requiredActionReceiptId: command.requiredActionReceiptId,
    confirmationAction: "codex.execution.invoke",
  });
}

function waitingProjection(waiting: ApplicationState["domain"]["tasks"][number]["waiting"]): ProductWaitingView | null {
  return waiting === null ? null : Object.freeze({
    reason: waiting.reason,
    phase: waiting.phase,
    requiredAction: waiting.requiredAction,
    lastErrorCode: waiting.lastErrorCode,
    lastErrorSummary: waiting.lastErrorSummary,
    retryable: waiting.retryable,
    retryCount: waiting.retryCount,
    retryAfter: waiting.retryAfter,
    executionId: waiting.executionId,
    workspaceRevision: waiting.workspaceRevision,
    waitingTaskRevision: waiting.waitingTaskRevision,
  });
}

function reliableProjection(view: ReliableExecutionView): ProductExecutionView {
  return Object.freeze({
    executionId: view.executionId,
    taskId: view.taskId,
    taskState: view.taskState,
    taskRevision: view.taskRevision,
    executionRevision: view.executionRevision,
    attemptNumber: view.attemptNumber,
    fencingToken: view.fencingToken,
    lifecycle: view.lifecycle,
    observationNumber: view.observationNumber,
    waiting: waitingProjection(view.waiting),
    replayed: view.replayed,
  });
}

function productExecutionProjection(
  state: ApplicationState,
  operation: CodexProductOperationRecord,
  replayed: boolean,
): ProductExecutionView {
  const task = state.domain.tasks.find((candidate) => candidate.id === operation.taskId);
  const execution = state.executions.find((candidate) => candidate.executionId === operation.executionId);
  const intent = state.executionIntents.find((candidate) => candidate.intentId === operation.intentId);
  const observation = intent === undefined ? undefined : state.executionObservations
    .filter((candidate) => candidate.intentId === intent.intentId)
    .sort((left, right) => right.observationNumber - left.observationNumber)[0];
  if (task === undefined || execution === undefined || intent === undefined || intent.state !== "finalized") {
    throw new TypeError("Final Codex continuation projection is incomplete");
  }
  return Object.freeze({
    executionId: execution.executionId,
    taskId: task.id,
    taskState: task.state,
    taskRevision: task.revision,
    executionRevision: execution.revision,
    attemptNumber: execution.attemptNumber,
    fencingToken: execution.fencingToken,
    lifecycle: observation?.lifecycle ?? "ambiguous",
    observationNumber: observation?.observationNumber ?? null,
    waiting: waitingProjection(task.waiting),
    replayed,
  });
}

type CodexStoredTerminalValue = CodexDispatchView | ProductExecutionView;

function boundedText(value: unknown, maximum = 1024): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function storedTerminalJson(result: CodexProductResult<CodexStoredTerminalValue>): string {
  const encoded = compactCanonicalJson(result);
  if (new TextEncoder().encode(encoded).byteLength > 16_384) {
    throw new TypeError("Codex terminal result exceeds its persistence bound");
  }
  return encoded;
}

function decodeWaitingView(value: unknown): ProductWaitingView | null {
  const record = exactRecord(value, [
    "reason", "phase", "requiredAction", "lastErrorCode", "lastErrorSummary", "retryable",
    "retryCount", "retryAfter", "executionId", "workspaceRevision", "waitingTaskRevision",
  ]);
  const reasons = new Set([
    "human_input", "authorization_required", "execution_failed", "policy_gate_failed",
    "resource_exhausted", "rate_limited", "disk_full", "workspace_conflict",
    "dependency_cancelled", "stale_lease", "ambiguous_external_state", "backend_incompatible",
  ]);
  if (
    record === null || typeof record.reason !== "string" || !reasons.has(record.reason) ||
    !boundedText(record.phase, 128) || !boundedText(record.requiredAction, 1024) ||
    !boundedText(record.lastErrorCode, 128) ||
    (record.lastErrorSummary !== null && !boundedText(record.lastErrorSummary, 1024)) ||
    typeof record.retryable !== "boolean" || !nonnegative(record.retryCount) ||
    (record.retryAfter !== null && !nonnegative(record.retryAfter)) ||
    (record.executionId !== null && !boundedText(record.executionId, 128)) ||
    (record.workspaceRevision !== null && !boundedText(record.workspaceRevision, 128)) ||
    !positive(record.waitingTaskRevision)
  ) return null;
  return Object.freeze(record as unknown as ProductWaitingView);
}

function decodeStoredDispatchView(value: unknown): CodexDispatchView | null {
  const record = exactRecord(value, [
    "runId", "status", "memberId", "profileId", "profileRevision", "destination",
    "baseReference", "taskId", "taskState", "taskRevision", "executionId",
    "executionRevision", "attemptNumber", "fencingToken", "workspaceId",
    "workspaceGeneration", "workspaceRevision", "workspaceStatus", "lifecycle", "replayed",
  ]);
  const statuses = new Set(["starting", "reconciling", "sweeping", "completed", "partial", "failed", "interrupted"]);
  const taskStates = new Set(["ready", "running", "waiting", "completed", "cancelled"]);
  if (
    record === null || !boundedText(record.runId, 128) || !statuses.has(record.status as string) ||
    !boundedText(record.memberId, 128) || !boundedText(record.profileId, 128) ||
    !positive(record.profileRevision) || record.destination !== CODEX_PRODUCT_DESTINATION ||
    typeof record.baseReference !== "string" || !/^[0-9a-f]{40}$/u.test(record.baseReference) ||
    !boundedText(record.taskId) || !taskStates.has(record.taskState as string) || !positive(record.taskRevision) ||
    !boundedText(record.executionId, 128) || !positive(record.executionRevision) ||
    !positive(record.attemptNumber) || !positive(record.fencingToken) ||
    !boundedText(record.workspaceId, 128) || !positive(record.workspaceGeneration) ||
    !positive(record.workspaceRevision) || record.workspaceStatus !== "ready" ||
    !boundedText(record.lifecycle, 128) || record.replayed !== false
  ) return null;
  return Object.freeze(record as unknown as CodexDispatchView);
}

function decodeStoredExecutionView(value: unknown): ProductExecutionView | null {
  const record = exactRecord(value, [
    "executionId", "taskId", "taskState", "taskRevision", "executionRevision",
    "attemptNumber", "fencingToken", "lifecycle", "observationNumber", "waiting", "replayed",
  ]);
  const taskStates = new Set(["ready", "running", "waiting", "completed", "cancelled"]);
  const lifecycles = new Set([
    "unknown", "queued", "active", "waiting", "turn_succeeded", "failed", "cancelled", "completed", "ambiguous",
  ]);
  if (
    record === null || !boundedText(record.executionId, 128) || !boundedText(record.taskId) ||
    !taskStates.has(record.taskState as string) || !positive(record.taskRevision) ||
    !positive(record.executionRevision) || !positive(record.attemptNumber) || !positive(record.fencingToken) ||
    !lifecycles.has(record.lifecycle as string) ||
    (record.observationNumber !== null && !positive(record.observationNumber)) ||
    record.replayed !== false
  ) return null;
  const waiting = record.waiting === null ? null : decodeWaitingView(record.waiting);
  if (record.waiting !== null && waiting === null) return null;
  return Object.freeze({ ...record, waiting }) as unknown as ProductExecutionView;
}

function decodeStoredTerminal(
  operation: CodexProductOperationRecord,
  replayed: boolean,
): CodexProductResult<CodexStoredTerminalValue> {
  if (operation.resultJson === null) {
    throw new PersistenceError("CORRUPT_ROW", "Codex terminal operation has no stored result");
  }
  let decoded: unknown;
  try { decoded = JSON.parse(operation.resultJson); } catch {
    throw new PersistenceError("CORRUPT_ROW", "Codex terminal result is not JSON");
  }
  if (compactCanonicalJson(decoded) !== operation.resultJson) {
    throw new PersistenceError("CORRUPT_ROW", "Codex terminal result is not canonical");
  }
  const failedRecord = exactRecord(decoded, ["error", "ok"]);
  if (failedRecord !== null && failedRecord.ok === false) {
    if (operation.lifecycle !== "refused" && operation.lifecycle !== "finalized") {
      throw new PersistenceError("CORRUPT_ROW", "Codex failure result has a nonterminal lifecycle");
    }
    const error = exactRecord(failedRecord.error, ["code", "message"]);
    if (error === null || typeof error.code !== "string" ||
      !(CODEX_PRODUCT_ERROR_CODES as readonly string[]).includes(error.code) || !boundedText(error.message, 1024)) {
      throw new PersistenceError("CORRUPT_ROW", "Codex stored failure result is invalid");
    }
    return failure(error.code as CodexProductErrorCode, error.message);
  }
  const record = exactRecord(decoded, ["ok", "value"]);
  if (operation.lifecycle !== "finalized" || record === null || record.ok !== true) {
    throw new PersistenceError("CORRUPT_ROW", "Codex finalized result is invalid");
  }
  const value = operation.commandKind === "codex.dispatch-run"
    ? decodeStoredDispatchView(record.value)
    : decodeStoredExecutionView(record.value);
  if (value === null) throw new PersistenceError("CORRUPT_ROW", "Codex stored success view is invalid");
  return success(Object.freeze({ ...value, replayed }));
}

function dispatchTerminalResult(
  operation: CodexProductOperationRecord,
  replayed: boolean,
): CodexProductResult<CodexDispatchView> {
  if (operation.commandKind !== "codex.dispatch-run") {
    throw new PersistenceError("CORRUPT_ROW", "Codex dispatch terminal result has the wrong command kind");
  }
  return decodeStoredTerminal(operation, replayed) as CodexProductResult<CodexDispatchView>;
}

function continuationTerminalResult(
  operation: CodexProductOperationRecord,
  replayed: boolean,
): CodexProductResult<ProductExecutionView> {
  if (operation.commandKind === "codex.dispatch-run") {
    throw new PersistenceError("CORRUPT_ROW", "Codex continuation terminal result has the wrong command kind");
  }
  return decodeStoredTerminal(operation, replayed) as CodexProductResult<ProductExecutionView>;
}

function refuseProductOperation(
  store: PersistenceStore,
  operationId: string,
  now: string,
  resultCode: string,
  result: CodexProductFailure,
): CodexProductOperationRecord {
  return updateProductOperation(store, operationId, now, () => Object.freeze({
    lifecycle: "refused" as const,
    resultCode,
    resultJson: storedTerminalJson(result),
  }));
}

function persistCodexActDenial(
  store: PersistenceStore,
  operationId: string,
  now: string,
  ids: Readonly<{ requestId: string; decisionId: string; auditId: string }>,
  confirmationId: string | null,
  reason: AuthorizationEvaluation["reason"],
): CodexProductOperationRecord {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
    if (operation === undefined) throw new TypeError("Codex Act denial operation is absent");
    if (operation.lifecycle !== "active" && operation.lifecycle !== "recovery_required") return operation;
    const profile = state.codexProfiles.find((candidate) => candidate.profileId === operation.profileId);
    const project = state.projects.find((candidate) => candidate.projectId === operation.projectId);
    const intent = state.executionIntents.find((candidate) => candidate.intentId === operation.intentId);
    const identity = state.identity;
    const freshDenial = operation.stage === "intent_prepared" && intent?.state === "pending";
    const recoveryDenial = operation.stage === "effect_possible" && intent?.state === "executing" &&
      codexEffectAbsent(state, operation);
    if (profile === undefined || project === undefined || identity === null || identity.actorId !== operation.actorId ||
      intent === undefined || (!freshDenial && !recoveryDenial) ||
      operation.workspaceGeneration === null || operation.workspaceRevision === null) {
      throw new TypeError("Codex Act denial binding is incomplete");
    }
    const createdAt = laterTimestamp(operation.updatedAt, now);
    const denialContext: TrustedContext = Object.freeze({
      actor: Object.freeze({ actorId: identity.actorId, principal: identity.principalSha256 }),
      now: createdAt,
    });
    const confirmed = reason !== "confirmation_required";
    const codex = projectAuthorization(state, denialContext, "codex.execution.invoke", project, confirmed);
    const core = projectAuthorization(state, denialContext, intent.action, project, true);
    const grantSet = operationGrantSet(state, denialContext, operation, project, codex, core).set;
    const bindingRevision = state.codexEffectAuthorizations
      .filter((candidate) => candidate.productOperationId === operation.operationId).length + 1;
    transaction.insertCodexEffectAuthorization(Object.freeze({
      authorizationId: stableId("codex-authorization", operation.operationId, bindingRevision),
      productOperationId: operation.operationId,
      phase: "act" as const,
      bindingRevision,
      requestId: ids.requestId,
      decisionId: ids.decisionId,
      auditId: ids.auditId,
      confirmationId,
      actorId: operation.actorId,
      action: "codex.execution.invoke" as const,
      result: "deny" as const,
      reason,
      policy: "deny" as const,
      grantId: null,
      grantRevision: null,
      requiredGrantSetVersion: 1 as const,
      requiredGrantSetJson: grantSet.json,
      requiredGrantSetSha256: grantSet.sha256,
      coreAuthorizationDecisionId: null,
      coreAuthorizationBindingRevision: null,
      profileId: operation.profileId,
      profileRevision: profile.revision,
      constructorConfigSha256: operation.constructorConfigSha256,
      runId: operation.runId,
      memberId: operation.memberId,
      executionId: operation.executionId,
      intentId: operation.intentId,
      workspaceId: operation.workspaceId,
      workspaceGeneration: operation.workspaceGeneration,
      workspaceRevision: operation.workspaceRevision,
      createdAt,
    }));
    const updated = Object.freeze({
      ...operation,
      lifecycle: "recovery_required" as const,
      resultCode: reason,
      revision: operation.revision + 1,
      updatedAt: createdAt,
    });
    transaction.updateCodexProductOperation(updated, operation.revision);
    return transaction.read().codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
  });
}

interface ContinuationSource {
  readonly project: RegisteredProject;
  readonly task: ApplicationState["domain"]["tasks"][number];
  readonly execution: ApplicationState["executions"][number];
  readonly profile: CodexProfileRecord;
  readonly turn: ApplicationState["codexTurns"][number];
  readonly receipt: ApplicationState["executionReceipts"][number];
  readonly workspace: WorkspaceGenerationRecord;
  readonly workspaceReceipt: WorkspaceVerifiedReceiptRecord;
}

interface CodexExecutionBinding {
  readonly project: RegisteredProject;
  readonly task: ApplicationState["domain"]["tasks"][number];
  readonly execution: ApplicationState["executions"][number];
  readonly operation: CodexProductOperationRecord;
  readonly profile: CodexProfileRecord;
  readonly turn: ApplicationState["codexTurns"][number];
  readonly workspace: WorkspaceGenerationRecord;
  readonly workspaceReceipt: WorkspaceVerifiedReceiptRecord;
}

function codexExecutionBinding(
  state: ApplicationState,
  command: ProductExecutionInspectCommand | ProductExecutionCancelCommand,
): CodexExecutionBinding | CodexProductFailure {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failure("PROJECT_NOT_FOUND", "The Project was not found.");
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
    project.configRevision !== command.expectedProjectConfigRevision) {
    return failure("STALE_REVISION", "The Project revision is stale.");
  }
  const task = state.domain.tasks.find((candidate) => candidate.id === command.taskId);
  if (task === undefined || task.projectId !== command.projectId) return failure("TASK_NOT_FOUND", "The Task was not found.");
  if (task.revision !== command.expectedTaskRevision) return failure("STALE_REVISION", "The Task revision is stale.");
  const execution = state.executions.find((candidate) => candidate.executionId === command.executionId);
  if (execution === undefined || execution.taskId !== task.id) {
    return failure("RECONCILIATION_REQUIRED", "The execution was not found.");
  }
  if (execution.revision !== command.expectedExecutionRevision ||
    execution.attemptNumber !== command.expectedAttemptNumber) {
    return failure("STALE_REVISION", "The execution revision is stale.");
  }
  if (execution.fencingToken !== command.expectedFencingToken) {
    return failure("STALE_FENCE", "The execution fence is stale.");
  }
  const operations = state.codexProductOperations.filter((candidate) =>
    candidate.executionId === execution.executionId && candidate.stage !== "prepared" &&
    candidate.lifecycle !== "refused"
  );
  if (operations.length !== 1) {
    return failure("RECONCILIATION_REQUIRED", "The Codex execution ownership is not unique.");
  }
  const operation = operations[0]!;
  const profile = state.codexProfiles.find((candidate) => candidate.profileId === operation.profileId);
  if (profile === undefined || profile.projectId !== project.projectId ||
    profile.constructorConfigSha256 !== operation.constructorConfigSha256) {
    return failure("CODEX_PROFILE_NOT_FOUND", "The Codex profile was not found.");
  }
  const turns = state.codexTurns.filter((candidate) =>
    candidate.executionId === execution.executionId && candidate.attemptNumber === execution.attemptNumber &&
    candidate.fencingToken === execution.fencingToken
  );
  if (turns.length !== 1 || turns[0]!.threadId === null) {
    return failure("RECONCILIATION_REQUIRED", "The Codex execution turn is not uniquely inspectable.");
  }
  if (operation.workspaceGeneration === null) {
    return failure("RECONCILIATION_REQUIRED", "The Codex workspace binding is absent.");
  }
  const workspace = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === operation.workspaceId && candidate.generation === operation.workspaceGeneration
  );
  const receipt = workspace === undefined ? null : workspaceReceipt(state, workspace);
  if (workspace === undefined || receipt === null || receipt.headObjectId === null ||
    workspace.executionId !== execution.executionId || workspace.fencingToken !== execution.fencingToken) {
    return failure("RECONCILIATION_REQUIRED", "The Codex workspace evidence is not current.");
  }
  return Object.freeze({ project, task, execution, operation, profile, turn: turns[0]!, workspace, workspaceReceipt: receipt });
}

function continuationSource(
  state: ApplicationState,
  command: ProductExecutionContinuationCommand,
): ContinuationSource | CodexProductFailure {
  const project = state.projects.find((candidate) => candidate.projectId === command.projectId);
  if (project === undefined) return failure("PROJECT_NOT_FOUND", "The Project was not found.");
  if (project.resourceRevision !== command.expectedProjectResourceRevision ||
    project.configRevision !== command.expectedProjectConfigRevision) {
    return failure("STALE_REVISION", "The Project revision is stale.");
  }
  if (state.domain.projects.find((candidate) => candidate.id === project.projectId)?.enabled !== true) {
    return failure("PROJECT_DISABLED", "The Project is disabled.");
  }
  const task = state.domain.tasks.find((candidate) => candidate.id === command.taskId);
  if (task === undefined || task.projectId !== project.projectId) return failure("TASK_NOT_FOUND", "The Task was not found.");
  if (task.revision !== command.expectedTaskRevision) return failure("STALE_REVISION", "The Task revision is stale.");
  if (task.state !== "waiting" || task.waiting === null) return failure("TASK_NOT_ELIGIBLE", "The Task is not waiting.");
  const execution = state.executions.find((candidate) => candidate.executionId === command.executionId);
  if (execution === undefined || execution.taskId !== task.id) {
    return failure("RECONCILIATION_REQUIRED", "The Codex source execution is absent.");
  }
  if (execution.revision !== command.expectedExecutionRevision ||
    execution.attemptNumber !== command.expectedAttemptNumber) {
    return failure("STALE_REVISION", "The source execution revision is stale.");
  }
  if (execution.fencingToken !== command.expectedFencingToken) {
    return failure("STALE_FENCE", "The source execution fence is stale.");
  }
  if (execution.status !== "active") return failure("STALE_FENCE", "The source execution is no longer current.");
  const sourceOperations = state.codexProductOperations.filter((candidate) =>
    candidate.executionId === execution.executionId && candidate.lifecycle === "finalized" &&
    candidate.stage === "workspace_refreshed"
  );
  if (sourceOperations.length !== 1) {
    return failure("RECONCILIATION_REQUIRED", "The Codex source product lineage is not unique.");
  }
  const sourceOperation = sourceOperations[0]!;
  const profile = state.codexProfiles.find((candidate) => candidate.profileId === sourceOperation.profileId);
  if (profile === undefined) return failure("CODEX_PROFILE_NOT_FOUND", "The Codex profile was not found.");
  if (profile.status !== "active") return failure("CODEX_PROFILE_INACTIVE", "The Codex profile is not active.");
  if (profile.projectId !== project.projectId ||
    profile.constructorConfigSha256 !== sourceOperation.constructorConfigSha256) {
    return failure("STALE_REVISION", "The Codex profile configuration changed.");
  }
  const turns = state.codexTurns.filter((candidate) =>
    candidate.executionId === execution.executionId && candidate.attemptNumber === execution.attemptNumber &&
    candidate.fencingToken === execution.fencingToken
  );
  if (turns.length !== 1 || turns[0]!.threadId === null ||
    !["turn_succeeded", "failed"].includes(turns[0]!.lifecycle)) {
    return failure("RECONCILIATION_REQUIRED", "The Codex source turn is not terminal and unique.");
  }
  const turn = turns[0]!;
  if (command.kind === "execution.retry" && turn.lifecycle !== "failed") {
    return failure("TASK_NOT_ELIGIBLE", "Retry requires a failed Codex turn.");
  }
  const receipts = state.executionReceipts.filter((candidate) => {
    if (candidate.backendExecutionId !== turn.backendExecutionId || candidate.threadId !== turn.threadId ||
      candidate.observedRevision !== turn.revision || candidate.fencingToken !== execution.fencingToken) return false;
    const intent = state.executionIntents.find((item) => item.intentId === candidate.intentId);
    const finalization = state.executionFinalizations.find((item) =>
      item.intentId === candidate.intentId && item.verifiedReceiptId === candidate.verifiedReceiptId
    );
    return intent?.state === "finalized" && intent.executionId === execution.executionId &&
      finalization !== undefined;
  });
  if (receipts.length !== 1) {
    return failure("RECONCILIATION_REQUIRED", "The Codex source receipt is not unique.");
  }
  if (sourceOperation.workspaceGeneration === null) {
    return failure("RECONCILIATION_REQUIRED", "The Codex source workspace binding is absent.");
  }
  const workspace = state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === sourceOperation.workspaceId &&
    candidate.generation === sourceOperation.workspaceGeneration
  );
  const verifiedWorkspace = workspace === undefined ? null : workspaceReceipt(state, workspace);
  if (workspace === undefined || workspace.status !== "ready" || verifiedWorkspace === null ||
    verifiedWorkspace.headObjectId === null || workspace.executionId !== execution.executionId ||
    workspace.fencingToken !== execution.fencingToken) {
    return failure("RECONCILIATION_REQUIRED", "The Codex source workspace is not authoritatively clean.");
  }
  return Object.freeze({
    project,
    task,
    execution,
    profile,
    turn,
    receipt: receipts[0]!,
    workspace,
    workspaceReceipt: verifiedWorkspace,
  });
}

function updateProductOperation(
  store: PersistenceStore,
  operationId: string,
  now: string,
  update: (current: CodexProductOperationRecord) => Partial<CodexProductOperationRecord>,
): CodexProductOperationRecord {
  return withApplicationTransaction(store, (transaction) => {
    const state = transaction.read();
    const current = state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
    if (current === undefined) throw new TypeError("Codex product operation is absent");
    const next = Object.freeze({
      ...current,
      ...update(current),
      revision: current.revision + 1,
      updatedAt: laterTimestamp(current.updatedAt, now),
    });
    transaction.updateCodexProductOperation(next, current.revision);
    const readback = transaction.read().codexProductOperations.find((candidate) => candidate.operationId === operationId);
    if (readback === undefined || readback.revision !== current.revision + 1) {
      throw new TypeError("Codex product operation update readback failed");
    }
    return readback;
  });
}

function dispatchProjection(state: ApplicationState, operation: CodexProductOperationRecord, replayed: boolean): CodexDispatchView {
  const run = state.dispatcherRuns.find((candidate) => candidate.runId === operation.runId);
  const task = state.domain.tasks.find((candidate) => candidate.id === operation.taskId);
  const execution = state.executions.find((candidate) => candidate.executionId === operation.executionId);
  const workspace = operation.workspaceGeneration === null ? undefined : state.workspaceGenerations.find((candidate) =>
    candidate.workspaceId === operation.workspaceId && candidate.generation === operation.workspaceGeneration
  );
  const intent = state.executionIntents.find((candidate) => candidate.intentId === operation.intentId);
  const observation = intent === undefined ? undefined : state.executionObservations
    .filter((candidate) => candidate.intentId === intent.intentId)
    .sort((left, right) => right.observationNumber - left.observationNumber)[0];
  if (run === undefined || task === undefined || execution === undefined || workspace === undefined || intent === undefined) {
    throw new TypeError("Final Codex dispatch projection is incomplete");
  }
  if (task.state === "idea") throw new TypeError("A claimed Codex Task cannot remain in idea state");
  return Object.freeze({
    runId: run.runId,
    status: run.status,
    memberId: operation.memberId,
    profileId: operation.profileId,
    profileRevision: operation.profileRevision,
    destination: CODEX_PRODUCT_DESTINATION,
    baseReference: operation.baseReference!,
    taskId: task.id,
    taskState: task.state,
    taskRevision: task.revision,
    executionId: execution.executionId,
    executionRevision: execution.revision,
    attemptNumber: execution.attemptNumber,
    fencingToken: execution.fencingToken,
    workspaceId: workspace.workspaceId,
    workspaceGeneration: workspace.generation,
    workspaceRevision: workspace.revision,
    workspaceStatus: workspace.status,
    lifecycle: observation?.lifecycle ?? intent.state,
    replayed,
  });
}

function createCodexProductApplicationInternal(
  store: PersistenceStore,
  ingress: CodexProductIngress,
  dependencies: CodexProductApplicationDependencies,
  hooks: CodexProductApplicationHooks,
): CodexProductApplicationService {
  const prepareDriver = (operation: CodexProductOperationRecord): CodexDriverPreparationResult => {
    let current: ApplicationState;
    try {
      current = readApplicationStateForOwner(store);
    } catch {
      return Object.freeze({ ok: false as const, code: "adapter_failure" as const });
    }
    const currentProfile = current.codexProfiles.find((candidate) => candidate.profileId === operation.profileId);
    const currentProject = current.projects.find((candidate) => candidate.projectId === operation.projectId);
    if (currentProfile === undefined || currentProject === undefined || currentProfile.status !== "active" ||
      currentProfile.constructorConfigSha256 !== operation.constructorConfigSha256) {
      return Object.freeze({ ok: false as const, code: "configuration_changed" as const });
    }
    try {
      revalidateProjectRoot(currentProject, store.layout.root);
      revalidateCodexProfileConfiguration(
        currentProfile, currentProject, store.layout.root,
        reconstructedWorkspacePaths(current, store.layout.root),
      );
    } catch {
      return Object.freeze({ ok: false as const, code: "configuration_changed" as const });
    }
    let credential: string | null = null;
    try {
      try {
        credential = dependencies.credentialResolver.resolve(CODEX_PRODUCT_CREDENTIAL_REFERENCE);
      } catch {
        return Object.freeze({ ok: false as const, code: "adapter_failure" as const });
      }
      if (credential === null || credential.length === 0) {
        return Object.freeze({ ok: false as const, code: "credential_unavailable" as const });
      }
      try {
        const candidate = (dependencies.sdkDriver ?? ((apiKey, codexHome) =>
          createProductCodexSdkDriver(Object.freeze({ apiKey, codexHome }))))(
          credential, currentProfile.codexHome,
        );
        if (typeof candidate !== "object" || candidate === null ||
          typeof (candidate as Readonly<{ run?: unknown }>).run !== "function") {
          return Object.freeze({ ok: false as const, code: "adapter_failure" as const });
        }
        return Object.freeze({ ok: true as const, driver: candidate as CodexSdkDriver });
      } catch {
        return Object.freeze({ ok: false as const, code: "adapter_failure" as const });
      }
    } finally {
      credential = null;
    }
  };

  const activateProfile = (value: unknown): CodexProductResult<CodexProfileView> => {
    const command = parseActivate(value);
    if (command === null) return failure("INVALID_INPUT", "The Codex profile activation command is invalid.");
    const initialContext = trustedContext(ingress);
    if (initialContext === null) return failure("INVALID_INPUT", "The trusted Codex profile ingress is invalid.");
    let context: TrustedContext = initialContext;
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const replay = state.codexProfileOperations.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
      if (replay !== undefined) {
        if (replay.actorId !== context.actor.actorId || replay.action !== "codex.profile.activate" ||
          replay.projectId !== command.projectId || replay.profileId !== command.profileId ||
          replay.expectedProjectResourceRevision !== command.expectedProjectResourceRevision ||
          replay.expectedProjectConfigRevision !== command.expectedProjectConfigRevision ||
          replay.expectedProfileRevision !== command.expectedProfileRevision || replay.result !== "allow") {
          return failure("IDEMPOTENCY_CONFLICT", "The profile idempotency key is bound to another command.");
        }
        const profile = state.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
        if (profile === undefined || profile.revision < (replay.resultingProfileRevision ?? 0) ||
          profile.workspaceRoot !== command.workspaceRoot || profile.workspaceRootKey !== command.workspaceRootKey ||
          profile.codexHome !== command.codexHome || profile.codexHomeKey !== command.codexHomeKey ||
          profile.gitExecutable !== command.gitExecutable) {
          return failure("IDEMPOTENCY_CONFLICT", "The profile replay tuple does not match its durable result.");
        }
        return success(profileOperationProjection(profile, replay));
      }
      const project = boundProject(state, command);
      if ("ok" in project) return project;
      const prior = state.codexProfiles.find((candidate) => candidate.projectId === project.projectId) ?? null;
      if ((command.expectedProfileRevision === 0) !== (prior === null) ||
        (prior !== null && (prior.profileId !== command.profileId || prior.revision !== command.expectedProfileRevision ||
          prior.status !== "deactivated"))) {
        return failure("STALE_REVISION", "The Codex profile activation revision is stale.");
      }
      try { revalidateProjectRoot(project, store.layout.root); } catch { return mapConfigurationFailure(); }
      let inspected;
      try {
        inspected = inspectCodexProfileConfiguration(
          command,
          project,
          store.layout.root,
          prior,
          reconstructedWorkspacePaths(
            state, store.layout.root,
            Object.freeze({ key: command.workspaceRootKey, root: command.workspaceRoot }),
          ),
        );
      } catch (error) {
        if (error instanceof CodexProfileConfigurationError) return mapConfigurationFailure();
        throw error;
      }
      const baseEvaluation = projectAuthorization(state, context, "codex.profile.activate", project, true);
      if (!baseEvaluation.allowed) return failure("AUTHORIZATION_DENIED", "Current grants did not authorize profile activation.");
      const allocated = nextIds(ingress, ["profile-operation", "request", "correlation", "decision", "audit"]);
      if (allocated === null) return failure("INVALID_INPUT", "Trusted profile identities are invalid.");
      const [operationId, requestId, correlationId, decisionId, auditId] = allocated;
      const confirmation = ingress.confirmOperation(Object.freeze({
        actorId: context.actor.actorId,
        action: "codex.profile.activate" as const,
        requestId: requestId!,
        correlationId: correlationId!,
      }));
      if (confirmation === null || !operationalId(confirmation.confirmationId)) {
        return failure("CONFIRMATION_REQUIRED", "Fresh profile activation confirmation is required.");
      }
      const refreshed = refreshedConfirmationContext(ingress, context);
      if (refreshed === null) {
        return failure("AUTHORIZATION_DENIED", "The trusted profile actor changed during confirmation.");
      }
      const confirmedState = readApplicationStateForOwner(store);
      const confirmedRuntime = runtimeFailure(store, confirmedState, refreshed);
      if (confirmedRuntime !== null) return confirmedRuntime;
      const confirmedProject = boundProject(confirmedState, command);
      if ("ok" in confirmedProject) return confirmedProject;
      const confirmedPrior = confirmedState.codexProfiles.find(
        (candidate) => candidate.projectId === confirmedProject.projectId,
      ) ?? null;
      if ((command.expectedProfileRevision === 0) !== (confirmedPrior === null) ||
        (confirmedPrior !== null && (confirmedPrior.profileId !== command.profileId ||
          confirmedPrior.revision !== command.expectedProfileRevision || confirmedPrior.status !== "deactivated"))) {
        return failure("STALE_REVISION", "The Codex profile activation revision is stale.");
      }
      try {
        revalidateProjectRoot(confirmedProject, store.layout.root);
        inspected = inspectCodexProfileConfiguration(
          command,
          confirmedProject,
          store.layout.root,
          confirmedPrior,
          reconstructedWorkspacePaths(
            confirmedState, store.layout.root,
            Object.freeze({ key: command.workspaceRootKey, root: command.workspaceRoot }),
          ),
        );
      } catch {
        return mapConfigurationFailure();
      }
      if (!projectAuthorization(confirmedState, refreshed, "codex.profile.activate", confirmedProject, true).allowed) {
        return failure("AUTHORIZATION_DENIED", "Current grants did not authorize profile activation.");
      }
      context = refreshed;
      const profile = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = runtimeFailure(store, current, context);
        if (currentRuntime !== null) throw new TypeError("Trusted profile runtime changed");
        const currentProject = boundProject(current, command);
        if ("ok" in currentProject) throw new TypeError("Profile Project changed before activation");
        const currentPrior = current.codexProfiles.find((candidate) => candidate.projectId === command.projectId) ?? null;
        if ((command.expectedProfileRevision === 0) !== (currentPrior === null) ||
          (currentPrior !== null && (currentPrior.profileId !== command.profileId ||
            currentPrior.revision !== command.expectedProfileRevision || currentPrior.status !== "deactivated"))) {
          throw new PersistenceError("REVISION_CONFLICT", "Codex profile activation CAS failed");
        }
        const evaluation = projectAuthorization(current, context, "codex.profile.activate", currentProject, true);
        if (!evaluation.allowed) throw new TypeError("Profile activation authorization changed");
        const revision = command.expectedProfileRevision + 1;
        const record: CodexProfileRecord = Object.freeze({
          profileId: command.profileId,
          projectId: command.projectId,
          creatorOperationId: currentPrior?.creatorOperationId ?? operationId!,
          actorId: currentPrior?.actorId ?? context.actor.actorId,
          revision,
          status: "active" as const,
          projectResourceRevision: currentProject.resourceRevision,
          projectConfigRevision: currentProject.configRevision,
          projectRootKey: currentProject.rootKey,
          destination: inspected.destination,
          credentialReference: inspected.credentialReference,
          workspaceRoot: inspected.workspace.canonicalPath,
          workspaceRootKey: inspected.workspaceRootKey,
          workspacePlatform: inspected.workspace.platform,
          workspaceDevice: inspected.workspace.device,
          workspaceInode: inspected.workspace.inode,
          workspaceMode: inspected.workspace.mode,
          codexHome: inspected.codexHome.canonicalPath,
          codexHomeKey: inspected.codexHomeKey,
          codexHomePlatform: inspected.codexHome.platform,
          codexHomeDevice: inspected.codexHome.device,
          codexHomeInode: inspected.codexHome.inode,
          codexHomeMode: inspected.codexHome.mode,
          gitExecutable: inspected.gitExecutable.canonicalPath,
          gitExecutableKey: inspected.gitExecutable.canonicalPathKey,
          gitExecutablePlatform: inspected.gitExecutable.platform,
          gitExecutableDevice: inspected.gitExecutable.device,
          gitExecutableInode: inspected.gitExecutable.inode,
          gitExecutableMode: inspected.gitExecutable.mode,
          constructorConfigSha256: inspected.configurationSha256,
          createdAt: currentPrior?.createdAt ?? context.now,
          updatedAt: currentPrior === null ? context.now : laterTimestamp(currentPrior.updatedAt, context.now),
        });
        if (currentPrior === null) transaction.insertCodexProfile(record);
        else transaction.updateCodexProfile(record, currentPrior.revision);
        transaction.insertCodexProfileOperation(Object.freeze({
          operationId: operationId!,
          idempotencyKey: command.idempotencyKey,
          requestId: requestId!,
          decisionId: decisionId!,
          auditId: auditId!,
          confirmationId: confirmation.confirmationId,
          actorId: context.actor.actorId,
          action: "codex.profile.activate" as const,
          projectId: command.projectId,
          expectedProjectResourceRevision: command.expectedProjectResourceRevision,
          expectedProjectConfigRevision: command.expectedProjectConfigRevision,
          profileId: command.profileId,
          expectedProfileRevision: command.expectedProfileRevision,
          result: "allow" as const,
          reason: evaluation.reason,
          policy: evaluation.policy,
          grantId: evaluation.grantId,
          grantRevision: evaluation.grantRevision,
          configurationSha256: inspected.configurationSha256,
          resultingProfileRevision: revision,
          resultingStatus: "active" as const,
          createdAt: record.updatedAt,
        }));
        return transaction.read().codexProfiles.find((candidate) => candidate.profileId === record.profileId)!;
      });
      hooks.afterStage?.("profile-activated");
      return success(profileProjection(profile, false));
    } catch (error) {
      return error instanceof PersistenceError && error.code === "REVISION_CONFLICT"
        ? failure("STALE_REVISION", "The Codex profile activation revision is stale.")
        : failure("PERSISTENCE_FAILURE", "Codex profile activation failed closed.");
    }
  };

  const inspectProfile = (value: unknown): CodexProductResult<CodexProfileView> => {
    const command = parseInspectProfile(value);
    if (command === null) return failure("INVALID_INPUT", "The Codex profile inspection command is invalid.");
    const initialContext = trustedContext(ingress);
    if (initialContext === null) return failure("INVALID_INPUT", "The trusted Codex profile ingress is invalid.");
    let context: TrustedContext = initialContext;
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const project = boundProject(state, command);
      if ("ok" in project) return project;
      const profile = state.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
      if (profile === undefined || profile.projectId !== command.projectId) {
        return failure("CODEX_PROFILE_NOT_FOUND", "The Codex profile was not found.");
      }
      if (profile.revision !== command.expectedProfileRevision) {
        return failure("STALE_REVISION", "The Codex profile revision is stale.");
      }
      const evaluation = projectAuthorization(state, context, "codex.profile.inspect", project, true, true);
      if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Current grants did not authorize profile inspection.");
      try {
        revalidateProjectRoot(project, store.layout.root);
        revalidateCodexProfileConfiguration(
          profile, project, store.layout.root, reconstructedWorkspacePaths(state, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      return success(profileProjection(profile, false));
    } catch {
      return failure("PERSISTENCE_FAILURE", "Codex profile inspection failed closed.");
    }
  };

  const deactivateProfile = (value: unknown): CodexProductResult<CodexProfileView> => {
    const command = parseDeactivate(value);
    if (command === null) return failure("INVALID_INPUT", "The Codex profile deactivation command is invalid.");
    const initialContext = trustedContext(ingress);
    if (initialContext === null) return failure("INVALID_INPUT", "The trusted Codex profile ingress is invalid.");
    let context: TrustedContext = initialContext;
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const replay = state.codexProfileOperations.find((candidate) => candidate.idempotencyKey === command.idempotencyKey);
      if (replay !== undefined) {
        if (replay.actorId !== context.actor.actorId || replay.action !== "codex.profile.deactivate" ||
          replay.projectId !== command.projectId || replay.profileId !== command.profileId ||
          replay.expectedProjectResourceRevision !== command.expectedProjectResourceRevision ||
          replay.expectedProjectConfigRevision !== command.expectedProjectConfigRevision ||
          replay.expectedProfileRevision !== command.expectedProfileRevision || replay.result !== "allow") {
          return failure("IDEMPOTENCY_CONFLICT", "The profile idempotency key is bound to another command.");
        }
        const profile = state.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
        return profile === undefined || profile.revision < (replay.resultingProfileRevision ?? 0)
          ? failure("PERSISTENCE_FAILURE", "The durable profile result is absent.")
          : success(profileOperationProjection(profile, replay));
      }
      const project = boundProject(state, command);
      if ("ok" in project) return project;
      const profile = state.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
      if (profile === undefined || profile.projectId !== command.projectId) {
        return failure("CODEX_PROFILE_NOT_FOUND", "The Codex profile was not found.");
      }
      if (profile.revision !== command.expectedProfileRevision || profile.status !== "active") {
        return failure(profile.status === "deactivated" ? "CODEX_PROFILE_INACTIVE" : "STALE_REVISION",
          profile.status === "deactivated" ? "The Codex profile is not active." : "The Codex profile revision is stale.");
      }
      try {
        revalidateProjectRoot(project, store.layout.root);
        revalidateCodexProfileConfiguration(
          profile, project, store.layout.root, reconstructedWorkspacePaths(state, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      const baseEvaluation = projectAuthorization(state, context, "codex.profile.deactivate", project, true);
      if (!baseEvaluation.allowed) return failure("AUTHORIZATION_DENIED", "Current grants did not authorize profile deactivation.");
      const allocated = nextIds(ingress, ["profile-operation", "request", "correlation", "decision", "audit"]);
      if (allocated === null) return failure("INVALID_INPUT", "Trusted profile identities are invalid.");
      const [operationId, requestId, correlationId, decisionId, auditId] = allocated;
      const confirmation = ingress.confirmOperation(Object.freeze({
        actorId: context.actor.actorId,
        action: "codex.profile.deactivate" as const,
        requestId: requestId!,
        correlationId: correlationId!,
      }));
      if (confirmation === null || !operationalId(confirmation.confirmationId)) {
        return failure("CONFIRMATION_REQUIRED", "Fresh profile deactivation confirmation is required.");
      }
      const refreshed = refreshedConfirmationContext(ingress, context);
      if (refreshed === null) {
        return failure("AUTHORIZATION_DENIED", "The trusted profile actor changed during confirmation.");
      }
      const confirmedState = readApplicationStateForOwner(store);
      const confirmedRuntime = runtimeFailure(store, confirmedState, refreshed);
      if (confirmedRuntime !== null) return confirmedRuntime;
      const confirmedProject = boundProject(confirmedState, command);
      if ("ok" in confirmedProject) return confirmedProject;
      const confirmedProfile = confirmedState.codexProfiles.find(
        (candidate) => candidate.profileId === command.profileId && candidate.projectId === command.projectId,
      );
      if (confirmedProfile === undefined || confirmedProfile.revision !== command.expectedProfileRevision ||
        confirmedProfile.status !== "active") {
        return failure("STALE_REVISION", "The Codex profile deactivation revision is stale.");
      }
      try {
        revalidateProjectRoot(confirmedProject, store.layout.root);
        revalidateCodexProfileConfiguration(
          confirmedProfile, confirmedProject, store.layout.root,
          reconstructedWorkspacePaths(confirmedState, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      if (!projectAuthorization(confirmedState, refreshed, "codex.profile.deactivate", confirmedProject, true).allowed) {
        return failure("AUTHORIZATION_DENIED", "Current grants did not authorize profile deactivation.");
      }
      context = refreshed;
      const updated = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentProject = boundProject(current, command);
        if ("ok" in currentProject) throw new PersistenceError("REVISION_CONFLICT", "Project changed");
        const currentProfile = current.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
        if (currentProfile === undefined || currentProfile.revision !== command.expectedProfileRevision || currentProfile.status !== "active") {
          throw new PersistenceError("REVISION_CONFLICT", "Profile changed");
        }
        const evaluation = projectAuthorization(current, context, "codex.profile.deactivate", currentProject, true);
        if (!evaluation.allowed) throw new TypeError("Profile deactivation authorization changed");
        const record = Object.freeze({
          ...currentProfile,
          status: "deactivated" as const,
          revision: currentProfile.revision + 1,
          projectResourceRevision: currentProject.resourceRevision,
          projectConfigRevision: currentProject.configRevision,
          projectRootKey: currentProject.rootKey,
          updatedAt: laterTimestamp(currentProfile.updatedAt, context.now),
        });
        transaction.updateCodexProfile(record, currentProfile.revision);
        transaction.insertCodexProfileOperation(Object.freeze({
          operationId: operationId!, idempotencyKey: command.idempotencyKey,
          requestId: requestId!, decisionId: decisionId!, auditId: auditId!, confirmationId: confirmation.confirmationId,
          actorId: context.actor.actorId, action: "codex.profile.deactivate" as const,
          projectId: command.projectId, expectedProjectResourceRevision: command.expectedProjectResourceRevision,
          expectedProjectConfigRevision: command.expectedProjectConfigRevision, profileId: command.profileId,
          expectedProfileRevision: command.expectedProfileRevision, result: "allow" as const,
          reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
          grantRevision: evaluation.grantRevision, configurationSha256: currentProfile.constructorConfigSha256,
          resultingProfileRevision: record.revision, resultingStatus: "deactivated" as const,
          createdAt: record.updatedAt,
        }));
        return transaction.read().codexProfiles.find((candidate) => candidate.profileId === command.profileId)!;
      });
      hooks.afterStage?.("profile-deactivated");
      return success(profileProjection(updated, false));
    } catch (error) {
      return error instanceof PersistenceError && error.code === "REVISION_CONFLICT"
        ? failure("STALE_REVISION", "The Codex profile deactivation revision is stale.")
        : failure("PERSISTENCE_FAILURE", "Codex profile deactivation failed closed.");
    }
  };

  const createStartOperation = (
    command: CodexDispatchRunCommand,
    context: TrustedContext,
    commandJson: string,
  ): CodexProductResult<CodexProductOperationRecord> => {
    try {
      const state = readApplicationStateForOwner(store);
      const project = boundProject(state, command);
      if ("ok" in project) return project;
      const profile = state.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
      if (profile === undefined || profile.projectId !== command.projectId) {
        return failure("CODEX_PROFILE_NOT_FOUND", "The Codex profile was not found.");
      }
      if (profile.status !== "active") return failure("CODEX_PROFILE_INACTIVE", "The Codex profile is not active.");
      if (profile.revision !== command.expectedProfileRevision ||
        profile.projectResourceRevision !== command.expectedProjectResourceRevision ||
        profile.projectConfigRevision !== command.expectedProjectConfigRevision) {
        return failure("STALE_REVISION", "The Codex profile revision is stale.");
      }
      const task = state.domain.tasks.find((candidate) => candidate.id === command.taskId);
      if (task === undefined || task.projectId !== command.projectId) return failure("TASK_NOT_FOUND", "The Task was not found.");
      if (task.revision !== command.expectedTaskRevision) return failure("STALE_REVISION", "The Task revision is stale.");
      if (task.state !== "ready") return failure("TASK_NOT_ELIGIBLE", "The Task is not ready.");
      try {
        revalidateProjectRoot(project, store.layout.root);
        revalidateCodexProfileConfiguration(
          profile, project, store.layout.root, reconstructedWorkspacePaths(state, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      const evaluation = projectAuthorization(state, context, "codex.execution.invoke", project, true);
      if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Current grants did not authorize Codex invocation.");
      const allocated = nextIds(ingress, [
        "product-operation", "run", "member", "execution", "workspace", "intent",
        "request", "correlation", "decision", "audit",
      ]);
      if (allocated === null) return failure("INVALID_INPUT", "Trusted Codex product identities are invalid.");
      const [operationId, runId, memberId, executionId, workspaceId, intentId,
        requestId, correlationId, decisionId, auditId] = allocated;
      const confirmation = ingress.confirmOperation(Object.freeze({
        actorId: context.actor.actorId,
        action: "codex.execution.invoke" as const,
        requestId: requestId!,
        correlationId: correlationId!,
      }));
      if (confirmation === null || !operationalId(confirmation.confirmationId)) {
        return failure("CONFIRMATION_REQUIRED", "Fresh Codex invocation confirmation is required.");
      }
      const refreshed = refreshedConfirmationContext(ingress, context);
      if (refreshed === null) {
        return failure("AUTHORIZATION_DENIED", "The trusted Codex actor changed during confirmation.");
      }
      const confirmedState = readApplicationStateForOwner(store);
      const confirmedRuntime = runtimeFailure(store, confirmedState, refreshed);
      if (confirmedRuntime !== null) return confirmedRuntime;
      const confirmedProject = boundProject(confirmedState, command);
      if ("ok" in confirmedProject) return confirmedProject;
      const confirmedProfile = confirmedState.codexProfiles.find(
        (candidate) => candidate.profileId === command.profileId && candidate.projectId === command.projectId,
      );
      const confirmedTask = confirmedState.domain.tasks.find(
        (candidate) => candidate.id === command.taskId && candidate.projectId === command.projectId,
      );
      if (confirmedProfile === undefined || confirmedProfile.status !== "active" ||
        confirmedProfile.revision !== command.expectedProfileRevision ||
        confirmedProfile.constructorConfigSha256 !== profile.constructorConfigSha256 ||
        confirmedTask === undefined || confirmedTask.state !== "ready" ||
        confirmedTask.revision !== command.expectedTaskRevision) {
        return failure("STALE_REVISION", "The Codex prepared tuple changed during confirmation.");
      }
      try {
        revalidateProjectRoot(confirmedProject, store.layout.root);
        revalidateCodexProfileConfiguration(
          confirmedProfile, confirmedProject, store.layout.root,
          reconstructedWorkspacePaths(confirmedState, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      if (!projectAuthorization(confirmedState, refreshed, "codex.execution.invoke", confirmedProject, true).allowed) {
        return failure("AUTHORIZATION_DENIED", "Current grants did not authorize Codex invocation.");
      }
      context = refreshed;
      const operation = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = runtimeFailure(store, current, context);
        if (currentRuntime !== null) throw new TypeError("Trusted Codex runtime changed");
        if (current.codexProductOperations.some((candidate) => candidate.publicIdempotencyKey === command.idempotencyKey)) {
          throw new PersistenceError("REVISION_CONFLICT", "Codex product idempotency raced");
        }
        const currentProject = boundProject(current, command);
        if ("ok" in currentProject) throw new PersistenceError("REVISION_CONFLICT", "Project changed");
        const currentProfile = current.codexProfiles.find((candidate) => candidate.profileId === command.profileId);
        const currentTask = current.domain.tasks.find((candidate) => candidate.id === command.taskId);
        if (currentProfile === undefined || currentProfile.status !== "active" ||
          currentProfile.revision !== command.expectedProfileRevision ||
          currentProfile.constructorConfigSha256 !== profile.constructorConfigSha256 ||
          currentTask === undefined || currentTask.state !== "ready" || currentTask.revision !== command.expectedTaskRevision) {
          throw new PersistenceError("REVISION_CONFLICT", "Codex prepared tuple changed");
        }
        const currentEvaluation = projectAuthorization(current, context, "codex.execution.invoke", currentProject, true);
        if (!currentEvaluation.allowed) throw new TypeError("Codex Prepare authorization changed");
        const record: CodexProductOperationRecord = Object.freeze({
          operationId: operationId!, publicIdempotencyKey: command.idempotencyKey,
          commandKind: "codex.dispatch-run" as const, commandJson,
          commandSha256: sha256(commandJson), actorId: context.actor.actorId,
          profileId: currentProfile.profileId, profileRevision: currentProfile.revision,
          constructorConfigSha256: currentProfile.constructorConfigSha256,
          projectId: command.projectId,
          expectedProjectResourceRevision: command.expectedProjectResourceRevision,
          expectedProjectConfigRevision: command.expectedProjectConfigRevision,
          taskId: command.taskId, expectedTaskRevision: command.expectedTaskRevision,
          baseReference: command.baseReference, leaseDurationSeconds: command.leaseDurationSeconds,
          sourceExecutionId: null, sourceExecutionRevision: null, sourceAttemptNumber: null,
          sourceFencingToken: null, sourceBackendExecutionId: null, sourceThreadId: null,
          sourceObservationNumber: null, sourceVerifiedReceiptId: null,
          sourceWorkspaceId: null, sourceWorkspaceGeneration: null, sourceWorkspaceRevision: null,
          sourceWorkspaceRootKey: null, sourceWorkspaceOwnershipBindingSha256: null,
          sourceWorkspaceHeadObjectId: null, sourceWorkspaceVerifiedReceiptId: null,
          continuationReference: null, requiredActionReceiptId: null,
          runId: runId!, memberId: memberId!, executionId: executionId!, workspaceId: workspaceId!, intentId: intentId!,
          stage: "prepared" as const, lifecycle: "active" as const, revision: 1,
          workspaceGeneration: null, workspaceRevision: null, workspaceHeadObjectId: null,
          resultCode: null, resultJson: null, createdAt: context.now, updatedAt: context.now,
        });
        transaction.insertCodexProductOperation(record);
        const grantSet = prepareGrantSet(currentProject, currentEvaluation);
        transaction.insertCodexEffectAuthorization(Object.freeze({
          authorizationId: stableId("codex-authorization", record.operationId, 1),
          productOperationId: record.operationId, phase: "prepare" as const, bindingRevision: 1,
          requestId: requestId!, decisionId: decisionId!, auditId: auditId!, confirmationId: confirmation.confirmationId,
          actorId: context.actor.actorId, action: "codex.execution.invoke" as const, result: "allow" as const,
          reason: currentEvaluation.reason, policy: currentEvaluation.policy,
          grantId: currentEvaluation.grantId, grantRevision: currentEvaluation.grantRevision,
          requiredGrantSetVersion: 1 as const, requiredGrantSetJson: grantSet.json,
          requiredGrantSetSha256: grantSet.sha256,
          coreAuthorizationDecisionId: null, coreAuthorizationBindingRevision: null,
          profileId: currentProfile.profileId, profileRevision: currentProfile.revision,
          constructorConfigSha256: currentProfile.constructorConfigSha256,
          runId: record.runId, memberId: record.memberId, executionId: record.executionId,
          intentId: null, workspaceId: record.workspaceId, workspaceGeneration: null, workspaceRevision: null,
          createdAt: context.now,
        }));
        return transaction.read().codexProductOperations.find((candidate) => candidate.operationId === record.operationId)!;
      });
      hooks.afterStage?.("product-prepared");
      let configured = false;
      try { configured = dependencies.credentialResolver.configured(CODEX_PRODUCT_CREDENTIAL_REFERENCE); } catch { configured = false; }
      if (!configured) {
        const terminal = failure("CODEX_CREDENTIAL_UNAVAILABLE", "The configured Codex credential is unavailable.");
        refuseProductOperation(store, operation.operationId, ingress.now(), "credential_unavailable", terminal);
        hooks.afterStage?.("credential-unavailable");
        return terminal;
      }
      return success(operation);
    } catch (error) {
      return error instanceof PersistenceError && error.code === "REVISION_CONFLICT"
        ? failure("IDEMPOTENCY_CONFLICT", "The Codex product idempotency identity raced with another command.")
        : failure("PERSISTENCE_FAILURE", "Codex product preparation failed closed.");
    }
  };

  const createContinuationOperation = (
    command: ProductExecutionContinuationCommand,
    context: TrustedContext,
    commandJson: string,
  ): CodexProductResult<CodexProductOperationRecord> => {
    try {
      const state = readApplicationStateForOwner(store);
      const selected = continuationSource(state, command);
      if ("ok" in selected) return selected;
      try {
        revalidateProjectRoot(selected.project, store.layout.root);
        revalidateCodexProfileConfiguration(
          selected.profile, selected.project, store.layout.root,
          reconstructedWorkspacePaths(state, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      const evaluation = projectAuthorization(
        state, context, "codex.execution.invoke", selected.project, true,
      );
      if (!evaluation.allowed) return failure("AUTHORIZATION_DENIED", "Current grants did not authorize Codex invocation.");
      const allocated = nextIds(ingress, [
        "product-operation", "run", "member", "execution", "workspace", "intent",
        "request", "correlation", "decision", "audit",
      ]);
      if (allocated === null) return failure("INVALID_INPUT", "Trusted Codex continuation identities are invalid.");
      const [operationId, runId, memberId, executionId, workspaceId, intentId,
        requestId, correlationId, decisionId, auditId] = allocated;
      const confirmation = ingress.confirmOperation(Object.freeze({
        actorId: context.actor.actorId,
        action: "codex.execution.invoke" as const,
        requestId: requestId!,
        correlationId: correlationId!,
      }));
      if (confirmation === null || !operationalId(confirmation.confirmationId)) {
        return failure("CONFIRMATION_REQUIRED", "Fresh Codex continuation confirmation is required.");
      }
      const refreshed = refreshedConfirmationContext(ingress, context);
      if (refreshed === null) {
        return failure("AUTHORIZATION_DENIED", "The trusted Codex actor changed during continuation confirmation.");
      }
      const confirmedState = readApplicationStateForOwner(store);
      const confirmedRuntime = runtimeFailure(store, confirmedState, refreshed);
      if (confirmedRuntime !== null) return confirmedRuntime;
      const confirmedSource = continuationSource(confirmedState, command);
      if ("ok" in confirmedSource) return confirmedSource;
      if (confirmedSource.profile.profileId !== selected.profile.profileId ||
        confirmedSource.profile.constructorConfigSha256 !== selected.profile.constructorConfigSha256 ||
        confirmedSource.turn.backendExecutionId !== selected.turn.backendExecutionId ||
        confirmedSource.turn.threadId !== selected.turn.threadId ||
        confirmedSource.receipt.verifiedReceiptId !== selected.receipt.verifiedReceiptId ||
        confirmedSource.workspace.workspaceId !== selected.workspace.workspaceId ||
        confirmedSource.workspace.revision !== selected.workspace.revision ||
        confirmedSource.workspaceReceipt.verifiedReceiptId !== selected.workspaceReceipt.verifiedReceiptId) {
        return failure("STALE_REVISION", "The Codex continuation evidence changed during confirmation.");
      }
      try {
        revalidateProjectRoot(confirmedSource.project, store.layout.root);
        revalidateCodexProfileConfiguration(
          confirmedSource.profile,
          confirmedSource.project,
          store.layout.root,
          reconstructedWorkspacePaths(confirmedState, store.layout.root),
        );
      } catch {
        return mapConfigurationFailure();
      }
      if (!projectAuthorization(
        confirmedState, refreshed, "codex.execution.invoke", confirmedSource.project, true,
      ).allowed) {
        return failure("AUTHORIZATION_DENIED", "Current grants did not authorize Codex continuation.");
      }
      context = refreshed;
      const operation = withApplicationTransaction(store, (transaction) => {
        const current = transaction.read();
        const currentRuntime = runtimeFailure(store, current, context);
        if (currentRuntime !== null) throw new TypeError("Trusted Codex runtime changed");
        if (current.codexProductOperations.some((candidate) => candidate.publicIdempotencyKey === command.idempotencyKey)) {
          throw new PersistenceError("REVISION_CONFLICT", "Codex product idempotency raced");
        }
        const source = continuationSource(current, command);
        if ("ok" in source) throw new PersistenceError("REVISION_CONFLICT", "Codex continuation source changed");
        if (source.profile.profileId !== selected.profile.profileId ||
          source.profile.constructorConfigSha256 !== selected.profile.constructorConfigSha256 ||
          source.turn.backendExecutionId !== selected.turn.backendExecutionId ||
          source.turn.threadId !== selected.turn.threadId ||
          source.receipt.verifiedReceiptId !== selected.receipt.verifiedReceiptId ||
          source.workspace.workspaceId !== selected.workspace.workspaceId ||
          source.workspace.revision !== selected.workspace.revision ||
          source.workspaceReceipt.verifiedReceiptId !== selected.workspaceReceipt.verifiedReceiptId) {
          throw new PersistenceError("REVISION_CONFLICT", "Codex continuation evidence changed");
        }
        const currentEvaluation = projectAuthorization(
          current, context, "codex.execution.invoke", source.project, true,
        );
        if (!currentEvaluation.allowed) throw new TypeError("Codex continuation Prepare authorization changed");
        const record: CodexProductOperationRecord = Object.freeze({
          operationId: operationId!,
          publicIdempotencyKey: command.idempotencyKey,
          commandKind: command.kind,
          commandJson,
          commandSha256: sha256(commandJson),
          actorId: context.actor.actorId,
          profileId: source.profile.profileId,
          profileRevision: source.profile.revision,
          constructorConfigSha256: source.profile.constructorConfigSha256,
          projectId: command.projectId,
          expectedProjectResourceRevision: command.expectedProjectResourceRevision,
          expectedProjectConfigRevision: command.expectedProjectConfigRevision,
          taskId: command.taskId,
          expectedTaskRevision: command.expectedTaskRevision,
          baseReference: null,
          leaseDurationSeconds: null,
          sourceExecutionId: source.execution.executionId,
          sourceExecutionRevision: source.execution.revision,
          sourceAttemptNumber: source.execution.attemptNumber,
          sourceFencingToken: source.execution.fencingToken,
          sourceBackendExecutionId: source.turn.backendExecutionId,
          sourceThreadId: source.turn.threadId,
          sourceObservationNumber: source.turn.revision,
          sourceVerifiedReceiptId: source.receipt.verifiedReceiptId,
          sourceWorkspaceId: source.workspace.workspaceId,
          sourceWorkspaceGeneration: source.workspace.generation,
          sourceWorkspaceRevision: source.workspace.revision,
          sourceWorkspaceRootKey: source.workspace.workspaceRootKey,
          sourceWorkspaceOwnershipBindingSha256: source.workspaceReceipt.ownershipBindingSha256,
          sourceWorkspaceHeadObjectId: source.workspaceReceipt.headObjectId,
          sourceWorkspaceVerifiedReceiptId: source.workspaceReceipt.verifiedReceiptId,
          continuationReference: command.continuationReference,
          requiredActionReceiptId: command.requiredActionReceiptId,
          runId: runId!,
          memberId: memberId!,
          executionId: executionId!,
          workspaceId: workspaceId!,
          intentId: intentId!,
          stage: "prepared" as const,
          lifecycle: "active" as const,
          revision: 1,
          workspaceGeneration: null,
          workspaceRevision: null,
          workspaceHeadObjectId: null,
          resultCode: null,
          resultJson: null,
          createdAt: context.now,
          updatedAt: context.now,
        });
        transaction.insertCodexProductOperation(record);
        const grantSet = prepareGrantSet(source.project, currentEvaluation);
        transaction.insertCodexEffectAuthorization(Object.freeze({
          authorizationId: stableId("codex-authorization", record.operationId, 1),
          productOperationId: record.operationId,
          phase: "prepare" as const,
          bindingRevision: 1,
          requestId: requestId!,
          decisionId: decisionId!,
          auditId: auditId!,
          confirmationId: confirmation.confirmationId,
          actorId: context.actor.actorId,
          action: "codex.execution.invoke" as const,
          result: "allow" as const,
          reason: currentEvaluation.reason,
          policy: currentEvaluation.policy,
          grantId: currentEvaluation.grantId,
          grantRevision: currentEvaluation.grantRevision,
          requiredGrantSetVersion: 1 as const,
          requiredGrantSetJson: grantSet.json,
          requiredGrantSetSha256: grantSet.sha256,
          coreAuthorizationDecisionId: null,
          coreAuthorizationBindingRevision: null,
          profileId: source.profile.profileId,
          profileRevision: source.profile.revision,
          constructorConfigSha256: source.profile.constructorConfigSha256,
          runId: record.runId,
          memberId: record.memberId,
          executionId: record.executionId,
          intentId: null,
          workspaceId: record.workspaceId,
          workspaceGeneration: null,
          workspaceRevision: null,
          createdAt: context.now,
        }));
        return transaction.read().codexProductOperations.find((candidate) => candidate.operationId === record.operationId)!;
      });
      hooks.afterStage?.("continuation-product-prepared");
      let configured = false;
      try { configured = dependencies.credentialResolver.configured(CODEX_PRODUCT_CREDENTIAL_REFERENCE); } catch { configured = false; }
      if (!configured) {
        const terminal = failure("CODEX_CREDENTIAL_UNAVAILABLE", "The configured Codex credential is unavailable.");
        refuseProductOperation(store, operation.operationId, ingress.now(), "credential_unavailable", terminal);
        hooks.afterStage?.("continuation-credential-unavailable");
        return terminal;
      }
      return success(operation);
    } catch (error) {
      return error instanceof PersistenceError && error.code === "REVISION_CONFLICT"
        ? failure("IDEMPOTENCY_CONFLICT", "The Codex continuation idempotency identity raced with another command.")
        : failure("PERSISTENCE_FAILURE", "Codex continuation preparation failed closed.");
    }
  };

  const progressStart = async (
    original: CodexDispatchRunCommand,
    operationId: string,
    replayed: boolean,
  ): Promise<CodexProductResult<CodexDispatchView>> => {
    try {
      let state = readApplicationStateForOwner(store);
      let operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
      if (operation === undefined) return failure("PERSISTENCE_FAILURE", "The Codex product operation is absent.");
      if (operation.lifecycle === "refused" || operation.lifecycle === "finalized") {
        return dispatchTerminalResult(operation, replayed);
      }
      const targeted = createCodexTargetedDispatcherService(store, dispatcherIngress(ingress), Object.freeze({
        executionLeaseSeconds: original.leaseDurationSeconds,
      }));
      if (operation.stage === "prepared") {
        let configured = false;
        try { configured = dependencies.credentialResolver.configured(CODEX_PRODUCT_CREDENTIAL_REFERENCE); } catch { configured = false; }
        if (!configured && !state.dispatcherRuns.some((candidate) => candidate.runId === operation!.runId)) {
          const terminal = failure("CODEX_CREDENTIAL_UNAVAILABLE", "The configured Codex credential is unavailable.");
          refuseProductOperation(store, operation.operationId, ingress.now(), "credential_unavailable", terminal);
          return terminal;
        }
        const run = targeted.createStartRun(operation.operationId);
        if (!run.ok) {
          if (run.error.code === "AUTHORIZATION_DENIED") {
            const terminal = mapDispatcher(run.error.code);
            refuseProductOperation(store, operation.operationId, ingress.now(), "authorization_denied", terminal);
            return terminal;
          }
          return mapDispatcher(run.error.code);
        }
        hooks.afterStage?.("targeted-run-created");
        const member = targeted.claimStartMember(operation.operationId);
        if (!member.ok) return mapDispatcher(member.error.code);
        if (member.value.outcome !== "claimed") {
          const terminal = member.value.outcome === "authorization_denied"
            ? failure("AUTHORIZATION_DENIED", "Current grants did not authorize the Codex Task claim.")
            : failure("TASK_NOT_ELIGIBLE", "The requested Task could not be claimed.");
          const finalized = targeted.finalizeRun(operation.operationId);
          if (!finalized.ok) return mapDispatcher(finalized.error.code);
          refuseProductOperation(
            store, operation.operationId, ingress.now(), member.value.code ?? "member_refused", terminal,
          );
          return terminal;
        }
        hooks.afterStage?.("targeted-member-bound");
        state = readApplicationStateForOwner(store);
        operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
      }
      const profile = state.codexProfiles.find((candidate) => candidate.profileId === operation!.profileId);
      const project = state.projects.find((candidate) => candidate.projectId === operation!.projectId);
      const run = state.dispatcherRuns.find((candidate) => candidate.runId === operation!.runId);
      const member = state.dispatcherMembers.find((candidate) => candidate.memberId === operation!.memberId);
      const execution = state.executions.find((candidate) => candidate.executionId === operation!.executionId);
      const task = state.domain.tasks.find((candidate) => candidate.id === operation!.taskId);
      if (profile === undefined || project === undefined || run === undefined || member === undefined ||
        execution === undefined || task === undefined) {
        return failure("RECONCILIATION_REQUIRED", "The Codex product owner tuple is incomplete.");
      }
      if (operation.stage === "member_bound") {
        const adapter = (dependencies.workspaceBackend ?? defaultWorkspaceBackend)(profile, project);
        const backend = adapter.backend;
        const workspace: WorkspaceApplicationService = createWorkspaceApplicationService(
          store, backend, roleIngress(ingress, operation, "workspace"), Object.freeze({
            adapterId: adapter.adapterId,
            adapterVersion: adapter.adapterVersion,
            workspaceRootKey: profile.workspaceRootKey,
          }),
        );
        let generation = state.workspaceGenerations.find((candidate) => candidate.workspaceId === operation!.workspaceId);
        if (generation === undefined) {
          const reserved = workspace.reserve(Object.freeze({
            kind: "workspace.reserve" as const,
            projectId: project.projectId,
            expectedProjectResourceRevision: project.resourceRevision,
            expectedProjectConfigRevision: project.configRevision,
            taskId: task.id,
            expectedTaskRevision: task.revision,
            runId: run.runId,
            expectedRunRevision: run.runRevision,
            memberId: member.memberId,
            expectedMembershipRevision: member.membershipRevision,
            expectedMemberRevision: member.revision,
            executionId: execution.executionId,
            expectedExecutionRevision: execution.revision,
            expectedAttemptNumber: execution.attemptNumber,
            expectedFencingToken: execution.fencingToken,
            idempotencyKey: stableId("codex-workspace-reserve", operation.operationId),
            baseReference: operation.baseReference!,
            predecessorWorkspaceId: null,
            predecessorGeneration: null,
            predecessorRevision: null,
          }));
          if (!reserved.ok) return mapWorkspace(reserved.error.code);
          hooks.afterStage?.("workspace-reserved");
          generation = readApplicationStateForOwner(store).workspaceGenerations.find((candidate) =>
            candidate.workspaceId === operation!.workspaceId
          );
        }
        if (generation === undefined) return failure("RECONCILIATION_REQUIRED", "The reserved workspace is absent.");
        if (generation.status !== "ready") {
          const created = workspace.create(Object.freeze({
            kind: "workspace.create" as const,
            projectId: project.projectId,
            expectedProjectResourceRevision: project.resourceRevision,
            expectedProjectConfigRevision: project.configRevision,
            taskId: task.id,
            expectedTaskRevision: task.revision,
            runId: run.runId,
            expectedRunRevision: run.runRevision,
            memberId: member.memberId,
            expectedMembershipRevision: member.membershipRevision,
            expectedMemberRevision: member.revision,
            executionId: execution.executionId,
            expectedExecutionRevision: execution.revision,
            expectedAttemptNumber: execution.attemptNumber,
            expectedFencingToken: execution.fencingToken,
            idempotencyKey: stableId("codex-workspace-create", operation.operationId),
            workspaceId: generation.workspaceId,
            expectedGeneration: generation.generation,
            expectedGenerationRevision: generation.revision,
          }));
          if (!created.ok) return mapWorkspace(created.error.code);
          hooks.afterStage?.("workspace-created");
        }
        state = readApplicationStateForOwner(store);
        generation = state.workspaceGenerations.find((candidate) => candidate.workspaceId === operation!.workspaceId);
        const receipt = generation === undefined ? null : workspaceReceipt(state, generation);
        if (generation === undefined || generation.status !== "ready" || receipt?.headObjectId === null || receipt === null) {
          return failure("RECONCILIATION_REQUIRED", "The Codex workspace is not authoritatively ready.");
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "workspace_ready" as const,
          workspaceGeneration: generation!.generation,
          workspaceRevision: generation!.revision,
          workspaceHeadObjectId: receipt.headObjectId,
        }));
        hooks.afterStage?.("workspace-ready");
        state = readApplicationStateForOwner(store);
      }
      let generation = state.workspaceGenerations.find((candidate) =>
        candidate.workspaceId === operation!.workspaceId && candidate.generation === operation!.workspaceGeneration
      );
      let receipt = generation === undefined ? null : workspaceReceipt(state, generation);
      if (generation === undefined || receipt === null || receipt.headObjectId === null) {
        return failure("RECONCILIATION_REQUIRED", "The ready Codex workspace evidence is absent.");
      }
      const driverFactory = (): CodexDriverPreparationResult => prepareDriver(operation!);
      const executionBackend = (dependencies.executionBackend ?? defaultExecutionBackend)(
        store, profile, project, driverFactory,
      );
      const reliable = createInjectedCodexReliableExecutionService(
        store, reliableIngress(ingress, operation), executionBackend,
        Object.freeze({
          afterStage(stage: string) {
            if (stage === "executing") hooks.afterStage?.("effect-possible");
          },
        }),
      );
      const startCommand: CodexExecutionStartCommand = Object.freeze({
        kind: "execution.start" as const,
        projectId: operation.projectId,
        expectedProjectResourceRevision: operation.expectedProjectResourceRevision,
        expectedProjectConfigRevision: operation.expectedProjectConfigRevision,
        taskId: operation.taskId,
        expectedTaskRevision: task.revision,
        inputReference: codexProductTaskInputReference(operation.operationId, task.id, task.revision),
        executionId: execution.executionId,
        expectedExecutionRevision: execution.revision,
        expectedAttemptNumber: execution.attemptNumber,
        expectedFencingToken: execution.fencingToken,
        idempotencyKey: stableId("codex-execution-start", operation.operationId),
        policyBindingReference: stableId("codex-policy", operation.operationId),
        requestedDeadline: "9999-12-31T23:59:59.999Z",
        workspace: Object.freeze({
          workspaceContractId: "ato.workspace/v2" as const,
          workspaceId: generation.workspaceId,
          workspaceGeneration: generation.generation,
          workspaceRevision: generation.revision,
          workspaceRootKey: generation.workspaceRootKey,
          ownershipBindingSha256: receipt.ownershipBindingSha256,
          workspaceHeadObjectId: receipt.headObjectId,
        }),
      });
      if (operation.stage === "workspace_ready") {
        const prepared = reliable.prepareStart(startCommand);
        if (!prepared.ok) return mapReliable(prepared.error.code);
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "intent_prepared" as const,
        }));
        hooks.afterStage?.("intent-prepared");
        state = readApplicationStateForOwner(store);
      }
      const startIntentAtAct = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
      const recoveringStartBeforeJournal = operation.stage === "effect_possible" &&
        startIntentAtAct?.state === "executing" && codexEffectAbsent(state, operation);
      if (operation.stage === "intent_prepared" || recoveringStartBeforeJournal) {
        const t6 = nextIds(ingress, ["request", "correlation", "decision", "audit"]);
        if (t6 === null) return failure("INVALID_INPUT", "Trusted Codex Act identities are invalid.");
        const [requestId, correlationId, decisionId, auditId] = t6;
        let confirmationId: string | null = null;
        try {
          const candidate = exactRecord(ingress.confirmOperation(Object.freeze({
            actorId: operation.actorId,
            action: "codex.execution.invoke" as const,
            requestId: requestId!,
            correlationId: correlationId!,
          })), ["confirmationId"]);
          if (candidate !== null && operationalId(candidate.confirmationId)) confirmationId = candidate.confirmationId;
        } catch {
          confirmationId = null;
        }
        const actContext = trustedContext(ingress);
        if (actContext === null) {
          return failure("AUTHORIZATION_DENIED", "The trusted Codex context changed before Act.");
        }
        if (confirmationId === null) {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, null, "confirmation_required");
          return failure("CONFIRMATION_REQUIRED", "Fresh Codex invocation confirmation is required.");
        }
        if (actContext.actor.actorId !== operation.actorId) {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, confirmationId, "actor_mismatch");
          return failure("AUTHORIZATION_DENIED", "The trusted Codex actor changed before Act.");
        }
        const pointState = readApplicationStateForOwner(store);
        const pointProfile = pointState.codexProfiles.find((candidate) => candidate.profileId === operation!.profileId);
        const pointProject = pointState.projects.find((candidate) => candidate.projectId === operation!.projectId);
        const pointRuntime = runtimeFailure(store, pointState, actContext);
        if (pointRuntime !== null || pointProfile === undefined || pointProject === undefined ||
          pointProfile.status !== "active" ||
          pointProfile.constructorConfigSha256 !== operation.constructorConfigSha256) {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, confirmationId, "policy_denied");
          return pointRuntime ?? failure("CODEX_PROFILE_INACTIVE", "The Codex profile is not active.");
        }
        try {
          revalidateProjectRoot(pointProject, store.layout.root);
          revalidateCodexProfileConfiguration(
            pointProfile, pointProject, store.layout.root,
            reconstructedWorkspacePaths(pointState, store.layout.root),
          );
        } catch {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, confirmationId, "policy_denied");
          return mapConfigurationFailure();
        }
        const guard: CodexExecutionActGuard = Object.freeze({
          authorize(input: CodexExecutionActGuardInput) {
            const current = input.state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
            const currentProfile = input.state.codexProfiles.find((candidate) => candidate.profileId === operation!.profileId);
            const currentProject = input.state.projects.find((candidate) => candidate.projectId === operation!.projectId);
            if (current === undefined || currentProfile === undefined || currentProject === undefined ||
              current.intentId !== input.intent.intentId) {
              return Object.freeze({
                allowed: false as const,
                failure: Object.freeze({
                  ok: false as const,
                  error: Object.freeze({
                    code: "AUTHORIZATION_DENIED" as const,
                    message: "The Codex profile is not active",
                  }),
                  requestId: requestId!,
                  correlationId: correlationId!,
                }),
              });
            }
            const guardContext = Object.freeze({ actor: actContext.actor, now: input.now });
            const codex = projectAuthorization(input.state, guardContext,
              "codex.execution.invoke", currentProject, true);
            const coreDecision = input.transaction.read().executionAuthorizationDecisions.find(
              (candidate) => candidate.decisionId === input.executionDecisionId &&
                candidate.requestId === input.executionRequestId && candidate.action === input.intent.action,
            );
            if (coreDecision === undefined) throw new TypeError("Codex core Act decision is absent");
            const core: AuthorizationEvaluation = Object.freeze({
              allowed: coreDecision.result === "allow",
              reason: coreDecision.reason,
              policy: coreDecision.policy,
              grantId: coreDecision.grantId,
              grantRevision: coreDecision.grantRevision,
            });
            const currentExecution = input.state.executions.find((candidate) => candidate.executionId === current.executionId);
            const currentMember = input.state.dispatcherMembers.find((candidate) => candidate.memberId === current.memberId);
            const currentWorkspace = current.workspaceGeneration === null ? undefined : input.state.workspaceGenerations.find((candidate) =>
              candidate.workspaceId === current.workspaceId && candidate.generation === current.workspaceGeneration
            );
            const freshAct = current.stage === "intent_prepared" && input.intent.state === "pending";
            const recoveredAct = current.stage === "effect_possible" && input.intent.state === "executing" &&
              codexEffectAbsent(input.state, current);
            if (!freshAct && !recoveredAct) {
              return Object.freeze({
                allowed: false as const,
                failure: Object.freeze({
                  ok: false as const,
                  error: Object.freeze({ code: "RECONCILIATION_REQUIRED" as const, message: "Codex Act already progressed" }),
                  requestId: requestId!,
                  correlationId: correlationId!,
                }),
              });
            }
            const currentWorkspaceReceipt = currentWorkspace === undefined ? null : workspaceReceipt(input.state, currentWorkspace);
            const structural = (freshAct || recoveredAct) &&
              (current.lifecycle === "active" || current.lifecycle === "recovery_required") &&
              currentProfile.status === "active" &&
              currentProfile.constructorConfigSha256 === current.constructorConfigSha256 &&
              currentProfile.projectId === current.projectId && currentProfile.projectRootKey === currentProject.rootKey &&
              currentProject.resourceRevision === current.expectedProjectResourceRevision &&
              currentProject.configRevision === current.expectedProjectConfigRevision &&
              currentExecution !== undefined && currentExecution.status === "active" &&
              currentExecution.executionId === input.intent.executionId &&
              currentExecution.revision === input.intent.executionRevision &&
              currentExecution.fencingToken === input.intent.fencingToken &&
              currentMember?.ownerKind === "codex-product-operation" &&
              currentMember.productOperationId === current.operationId &&
              currentWorkspace !== undefined && currentWorkspace.status === "ready" &&
              currentWorkspace.generation === current.workspaceGeneration &&
              currentWorkspace.revision === current.workspaceRevision &&
              currentWorkspace.workspaceRootKey === input.intent.workspaceRootKey &&
              currentWorkspaceReceipt !== null &&
              currentWorkspaceReceipt.headObjectId === current.workspaceHeadObjectId &&
              (input.intent.state === "pending" || input.intent.state === "executing") &&
              input.intent.workspaceId === current.workspaceId &&
              input.intent.workspaceGeneration === current.workspaceGeneration &&
              input.intent.workspaceRevision === current.workspaceRevision &&
              input.intent.workspaceHeadObjectId === current.workspaceHeadObjectId &&
              input.intent.ownershipBindingSha256 === currentWorkspaceReceipt.ownershipBindingSha256;
            const grantSet = operationGrantSet(input.state, guardContext, current, currentProject, codex, core);
            const allowed = structural && input.executionAuthorized &&
              grantSet.evaluations.every((candidate) => candidate.allowed);
            const evaluation: AuthorizationEvaluation = allowed ? codex : Object.freeze({
              ...codex,
              allowed: false,
              reason: codex.allowed ? "policy_denied" as const : codex.reason,
              policy: codex.allowed ? "deny" as const : codex.policy,
            });
            const bindingRevision = input.state.codexEffectAuthorizations
              .filter((candidate) => candidate.productOperationId === current.operationId).length + 1;
            input.transaction.insertCodexEffectAuthorization(Object.freeze({
              authorizationId: stableId("codex-authorization", current.operationId, bindingRevision),
              productOperationId: current.operationId, phase: "act" as const, bindingRevision,
              requestId: requestId!, decisionId: decisionId!, auditId: auditId!, confirmationId,
              actorId: current.actorId, action: "codex.execution.invoke" as const,
              result: allowed ? "allow" as const : "deny" as const,
              reason: evaluation.reason, policy: evaluation.policy, grantId: evaluation.grantId,
              grantRevision: evaluation.grantRevision, profileId: currentProfile.profileId,
              requiredGrantSetVersion: 1 as const, requiredGrantSetJson: grantSet.set.json,
              requiredGrantSetSha256: grantSet.set.sha256,
              coreAuthorizationDecisionId: input.executionDecisionId,
              coreAuthorizationBindingRevision: input.bindingRevision,
              profileRevision: currentProfile.revision, constructorConfigSha256: current.constructorConfigSha256,
              runId: current.runId, memberId: current.memberId, executionId: current.executionId,
              intentId: current.intentId, workspaceId: current.workspaceId,
              workspaceGeneration: current.workspaceGeneration, workspaceRevision: current.workspaceRevision,
              createdAt: input.now,
            }));
            input.transaction.updateCodexProductOperation(Object.freeze({
              ...current,
              stage: allowed ? "effect_possible" as const : "intent_prepared" as const,
              lifecycle: allowed ? "active" as const : "recovery_required" as const,
              resultCode: allowed ? null : evaluation.reason,
              revision: current.revision + 1,
              updatedAt: laterTimestamp(current.updatedAt, input.now),
            }), current.revision);
            if (!allowed) {
              return Object.freeze({
                allowed: false as const,
                failure: Object.freeze({
                  ok: false as const,
                  error: Object.freeze({ code: "AUTHORIZATION_DENIED" as const, message: "Codex Act conjunction was denied" }),
                  requestId: requestId!,
                  correlationId: correlationId!,
                }),
              });
            }
            return Object.freeze({ allowed: true as const });
          },
        });
        const invoked = await reliable.invokePreparedStart(startCommand, guard);
        hooks.afterStage?.("effect-terminal-observed");
        state = readApplicationStateForOwner(store);
        operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
        const intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
        if (intent?.state !== "finalized") {
          return invoked.ok ? failure("RECONCILIATION_REQUIRED", "The Codex effect is not terminal.") : mapReliable(invoked.error.code);
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "effect_terminal" as const,
          lifecycle: "active" as const,
          resultCode: null,
        }));
        state = readApplicationStateForOwner(store);
      }
      if (operation.stage === "effect_possible") {
        state = readApplicationStateForOwner(store);
        let intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
        if (intent === undefined) return failure("RECONCILIATION_REQUIRED", "The effect-possible Codex intent is absent.");
        if (intent.state !== "finalized") {
          const turn = state.codexTurns.find((candidate) => candidate.executionId === intent!.executionId);
          if (turn === undefined || turn.threadId === null || intent.workspaceId === null ||
            intent.workspaceGeneration === null || intent.workspaceRevision === null || intent.workspaceRootKey === null ||
            intent.ownershipBindingSha256 === null || intent.workspaceHeadObjectId === null) {
            return failure("RECONCILIATION_REQUIRED", "The effect-possible Codex operation lacks inspectable thread evidence.");
          }
          const inspectCommand: CodexExecutionInspectCommand = Object.freeze({
            kind: "execution.inspect" as const,
            projectId: intent.projectId,
            expectedProjectResourceRevision: intent.projectResourceRevision,
            expectedProjectConfigRevision: intent.projectConfigRevision,
            taskId: intent.taskId,
            expectedTaskRevision: intent.taskRevision,
            inputReference: intent.inputReference,
            executionId: intent.executionId,
            expectedExecutionRevision: intent.executionRevision,
            expectedAttemptNumber: intent.attemptNumber,
            expectedFencingToken: intent.fencingToken,
            idempotencyKey: stableId("codex-effect-reconcile", operation.operationId),
            policyBindingReference: intent.policyBindingReference,
            requestedDeadline: intent.requestedDeadline,
            backendExecutionId: turn.backendExecutionId,
            threadId: turn.threadId,
            lastObservationNumber: intent.lastObservationNumber,
            workspace: Object.freeze({
              workspaceContractId: "ato.workspace/v2" as const,
              workspaceId: intent.workspaceId,
              workspaceGeneration: intent.workspaceGeneration,
              workspaceRevision: intent.workspaceRevision,
              workspaceRootKey: intent.workspaceRootKey,
              ownershipBindingSha256: intent.ownershipBindingSha256,
              workspaceHeadObjectId: intent.workspaceHeadObjectId,
            }),
          });
          const reconciled = await reliable.reconcile(inspectCommand);
          if (!reconciled.ok) return mapReliable(reconciled.error.code);
          state = readApplicationStateForOwner(store);
          intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
          if (intent?.state !== "finalized") {
            return failure("RECONCILIATION_REQUIRED", "The effect-possible Codex operation is not yet terminal.");
          }
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "effect_terminal" as const,
          lifecycle: "active" as const,
          resultCode: null,
        }));
        state = readApplicationStateForOwner(store);
      }
      if (operation.stage === "effect_terminal") {
        generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === operation!.workspaceId && candidate.generation === operation!.workspaceGeneration
        );
        if (generation === undefined) return failure("RECONCILIATION_REQUIRED", "The terminal Codex workspace is absent.");
        const currentTask = state.domain.tasks.find((candidate) => candidate.id === operation!.taskId);
        const currentExecution = state.executions.find((candidate) => candidate.executionId === operation!.executionId);
        const currentRun = state.dispatcherRuns.find((candidate) => candidate.runId === operation!.runId);
        const currentMember = state.dispatcherMembers.find((candidate) => candidate.memberId === operation!.memberId);
        if (currentTask === undefined || currentExecution === undefined || currentRun === undefined || currentMember === undefined) {
          return failure("RECONCILIATION_REQUIRED", "The terminal Codex owner tuple is absent.");
        }
        const adapter = (dependencies.workspaceBackend ?? defaultWorkspaceBackend)(profile, project);
        const backend = adapter.backend;
        const workspace = createWorkspaceApplicationService(
          store, backend, roleIngress(ingress, operation, "workspace-final-inspect"), Object.freeze({
            adapterId: adapter.adapterId, adapterVersion: adapter.adapterVersion, workspaceRootKey: profile.workspaceRootKey,
          }),
        );
        const inspected = workspace.inspect(Object.freeze({
          kind: "workspace.inspect" as const,
          projectId: project.projectId,
          expectedProjectResourceRevision: project.resourceRevision,
          expectedProjectConfigRevision: project.configRevision,
          taskId: currentTask.id,
          expectedTaskRevision: currentTask.revision,
          runId: currentRun.runId,
          expectedRunRevision: currentRun.runRevision,
          memberId: currentMember.memberId,
          expectedMembershipRevision: currentMember.membershipRevision,
          expectedMemberRevision: currentMember.revision,
          executionId: currentExecution.executionId,
          expectedExecutionRevision: currentExecution.revision,
          expectedAttemptNumber: currentExecution.attemptNumber,
          expectedFencingToken: currentExecution.fencingToken,
          idempotencyKey: stableId("codex-workspace-final-inspect", operation.operationId),
          workspaceId: generation.workspaceId,
          expectedGeneration: generation.generation,
          expectedGenerationRevision: generation.revision,
        }));
        if (!inspected.ok) return mapWorkspace(inspected.error.code);
        hooks.afterStage?.("workspace-refreshed");
        state = readApplicationStateForOwner(store);
        generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === operation!.workspaceId && candidate.generation === operation!.workspaceGeneration
        );
        receipt = generation === undefined ? null : workspaceReceipt(state, generation);
        if (generation === undefined || receipt === null || receipt.headObjectId === null) {
          return failure("RECONCILIATION_REQUIRED", "The final workspace HEAD is not authoritative.");
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "workspace_refreshed" as const,
          lifecycle: "active" as const,
          workspaceRevision: generation!.revision,
          workspaceHeadObjectId: receipt!.headObjectId,
          resultCode: null,
        }));
        state = readApplicationStateForOwner(store);
      }
      if (operation.stage === "workspace_refreshed" && operation.lifecycle === "active") {
        const finalizedRun = targeted.finalizeRun(operation.operationId);
        if (!finalizedRun.ok) return mapDispatcher(finalizedRun.error.code);
        state = readApplicationStateForOwner(store);
        operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
        const intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
        const observation = intent === undefined ? undefined : state.executionObservations
          .filter((candidate) => candidate.intentId === intent.intentId)
          .sort((left, right) => right.observationNumber - left.observationNumber)[0];
        const preparationFailure = intent?.lastErrorCode === "codex_credential_unavailable"
          ? Object.freeze({
            terminal: failure("CODEX_CREDENTIAL_UNAVAILABLE", "The configured Codex credential is unavailable."),
            resultCode: "credential_unavailable",
          })
          : intent?.lastErrorCode === "codex_profile_configuration_changed"
            ? Object.freeze({
              terminal: failure("PROJECT_IDENTITY_CHANGED", "The Project identity changed."),
              resultCode: "configuration_changed",
            })
            : intent?.lastErrorCode === "codex_driver_construction_failed"
              ? Object.freeze({
                terminal: failure("CODEX_ADAPTER_FAILURE", "The Codex execution adapter failed."),
                resultCode: "adapter_failure",
              })
              : null;
        const terminal: CodexProductResult<CodexStoredTerminalValue> = preparationFailure?.terminal ??
          success(dispatchProjection(state, operation, false));
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          lifecycle: "finalized" as const,
          resultCode: preparationFailure?.resultCode ?? observation?.lifecycle ?? "finalized",
          resultJson: storedTerminalJson(terminal),
        }));
      }
      return dispatchTerminalResult(operation, replayed);
    } catch (error) {
      return error instanceof PersistenceError
        ? failure("PERSISTENCE_FAILURE", "Codex product persistence failed closed.")
        : failure("CODEX_ADAPTER_FAILURE", "The Codex execution adapter failed.");
    }
  };

  const progressContinuation = async (
    operationId: string,
    replayed: boolean,
  ): Promise<CodexProductResult<ProductExecutionView>> => {
    try {
      let state = readApplicationStateForOwner(store);
      let operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
      if (operation === undefined) return failure("PERSISTENCE_FAILURE", "The Codex continuation operation is absent.");
      if (operation.lifecycle === "refused" || operation.lifecycle === "finalized") {
        return continuationTerminalResult(operation, replayed);
      }
      const targeted = createCodexTargetedDispatcherService(store, dispatcherIngress(ingress));
      if (operation.stage === "prepared") {
        let configured = false;
        try { configured = dependencies.credentialResolver.configured(CODEX_PRODUCT_CREDENTIAL_REFERENCE); } catch { configured = false; }
        if (!configured && !state.dispatcherRuns.some((candidate) => candidate.runId === operation!.runId)) {
          const terminal = failure("CODEX_CREDENTIAL_UNAVAILABLE", "The configured Codex credential is unavailable.");
          refuseProductOperation(store, operation.operationId, ingress.now(), "credential_unavailable", terminal);
          return terminal;
        }
        const run = targeted.createContinuationRun(operation.operationId);
        if (!run.ok) {
          if (run.error.code === "AUTHORIZATION_DENIED") {
            const terminal = mapDispatcher(run.error.code);
            refuseProductOperation(store, operation.operationId, ingress.now(), "authorization_denied", terminal);
            return terminal;
          }
          return mapDispatcher(run.error.code);
        }
        hooks.afterStage?.("continuation-targeted-run-created");
        const member = targeted.claimContinuationMember(operation.operationId);
        if (!member.ok) return mapDispatcher(member.error.code);
        if (member.value.outcome !== "claimed") {
          const terminal = member.value.outcome === "authorization_denied"
            ? failure("AUTHORIZATION_DENIED", "Current grants did not authorize the Codex continuation allocation.")
            : failure("TASK_NOT_ELIGIBLE", "The requested Codex continuation could not be allocated.");
          const finalized = targeted.finalizeRun(operation.operationId);
          if (!finalized.ok) return mapDispatcher(finalized.error.code);
          refuseProductOperation(
            store, operation.operationId, ingress.now(), member.value.code ?? "member_refused", terminal,
          );
          return terminal;
        }
        hooks.afterStage?.("continuation-targeted-member-bound");
        state = readApplicationStateForOwner(store);
        operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
      }
      const profile = state.codexProfiles.find((candidate) => candidate.profileId === operation!.profileId);
      const project = state.projects.find((candidate) => candidate.projectId === operation!.projectId);
      const run = state.dispatcherRuns.find((candidate) => candidate.runId === operation!.runId);
      const member = state.dispatcherMembers.find((candidate) => candidate.memberId === operation!.memberId);
      const execution = state.executions.find((candidate) => candidate.executionId === operation!.executionId);
      const task = state.domain.tasks.find((candidate) => candidate.id === operation!.taskId);
      if (profile === undefined || project === undefined || run === undefined || member === undefined ||
        execution === undefined || task === undefined) {
        return failure("RECONCILIATION_REQUIRED", "The Codex continuation owner tuple is incomplete.");
      }
      if (operation.stage === "member_bound") {
        const adapter = (dependencies.workspaceBackend ?? defaultWorkspaceBackend)(profile, project);
        const workspace = createWorkspaceApplicationService(
          store, adapter.backend, roleIngress(ingress, operation, "continuation-workspace"), Object.freeze({
            adapterId: adapter.adapterId,
            adapterVersion: adapter.adapterVersion,
            workspaceRootKey: profile.workspaceRootKey,
          }),
        );
        let generation = state.workspaceGenerations.find((candidate) => candidate.workspaceId === operation!.workspaceId);
        if (generation === undefined) {
          if (operation.sourceWorkspaceHeadObjectId === null) {
            return failure("RECONCILIATION_REQUIRED", "The Codex predecessor HEAD is absent.");
          }
          const reserved = workspace.reserve(Object.freeze({
            kind: "workspace.reserve" as const,
            projectId: project.projectId,
            expectedProjectResourceRevision: project.resourceRevision,
            expectedProjectConfigRevision: project.configRevision,
            taskId: task.id,
            expectedTaskRevision: task.revision,
            runId: run.runId,
            expectedRunRevision: run.runRevision,
            memberId: member.memberId,
            expectedMembershipRevision: member.membershipRevision,
            expectedMemberRevision: member.revision,
            executionId: execution.executionId,
            expectedExecutionRevision: execution.revision,
            expectedAttemptNumber: execution.attemptNumber,
            expectedFencingToken: execution.fencingToken,
            idempotencyKey: stableId("codex-continuation-workspace-reserve", operation.operationId),
            baseReference: operation.sourceWorkspaceHeadObjectId,
            predecessorWorkspaceId: null,
            predecessorGeneration: null,
            predecessorRevision: null,
          }));
          if (!reserved.ok) return mapWorkspace(reserved.error.code);
          hooks.afterStage?.("continuation-workspace-reserved");
          generation = readApplicationStateForOwner(store).workspaceGenerations.find((candidate) =>
            candidate.workspaceId === operation!.workspaceId
          );
        }
        if (generation === undefined) return failure("RECONCILIATION_REQUIRED", "The Codex continuation workspace is absent.");
        if (generation.status !== "ready") {
          const created = workspace.create(Object.freeze({
            kind: "workspace.create" as const,
            projectId: project.projectId,
            expectedProjectResourceRevision: project.resourceRevision,
            expectedProjectConfigRevision: project.configRevision,
            taskId: task.id,
            expectedTaskRevision: task.revision,
            runId: run.runId,
            expectedRunRevision: run.runRevision,
            memberId: member.memberId,
            expectedMembershipRevision: member.membershipRevision,
            expectedMemberRevision: member.revision,
            executionId: execution.executionId,
            expectedExecutionRevision: execution.revision,
            expectedAttemptNumber: execution.attemptNumber,
            expectedFencingToken: execution.fencingToken,
            idempotencyKey: stableId("codex-continuation-workspace-create", operation.operationId),
            workspaceId: generation.workspaceId,
            expectedGeneration: generation.generation,
            expectedGenerationRevision: generation.revision,
          }));
          if (!created.ok) return mapWorkspace(created.error.code);
          hooks.afterStage?.("continuation-workspace-created");
        }
        state = readApplicationStateForOwner(store);
        generation = state.workspaceGenerations.find((candidate) => candidate.workspaceId === operation!.workspaceId);
        const verified = generation === undefined ? null : workspaceReceipt(state, generation);
        if (generation === undefined || generation.status !== "ready" || verified === null || verified.headObjectId === null) {
          return failure("RECONCILIATION_REQUIRED", "The Codex continuation workspace is not authoritatively ready.");
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "workspace_ready" as const,
          workspaceGeneration: generation!.generation,
          workspaceRevision: generation!.revision,
          workspaceHeadObjectId: verified.headObjectId,
        }));
        hooks.afterStage?.("continuation-workspace-ready");
        state = readApplicationStateForOwner(store);
      }
      let generation = state.workspaceGenerations.find((candidate) =>
        candidate.workspaceId === operation!.workspaceId && candidate.generation === operation!.workspaceGeneration
      );
      let verifiedWorkspace = generation === undefined ? null : workspaceReceipt(state, generation);
      if (generation === undefined || verifiedWorkspace === null || verifiedWorkspace.headObjectId === null) {
        return failure("RECONCILIATION_REQUIRED", "The ready Codex continuation workspace evidence is absent.");
      }
      const sourceExecution = state.executions.find((candidate) => candidate.executionId === operation!.sourceExecutionId);
      if (sourceExecution === undefined || operation.sourceBackendExecutionId === null || operation.sourceThreadId === null ||
        operation.sourceVerifiedReceiptId === null || operation.sourceObservationNumber === null ||
        operation.continuationReference === null || operation.requiredActionReceiptId === null ||
        operation.sourceExecutionRevision === null || operation.sourceAttemptNumber === null ||
        operation.sourceFencingToken === null) {
        return failure("RECONCILIATION_REQUIRED", "The Codex continuation source tuple is incomplete.");
      }
      const driverFactory = (): CodexDriverPreparationResult => prepareDriver(operation!);
      const executionBackend = (dependencies.executionBackend ?? defaultExecutionBackend)(
        store, profile, project, driverFactory,
      );
      const reliable = createInjectedCodexReliableExecutionService(
        store, reliableIngress(ingress, operation), executionBackend,
        Object.freeze({
          afterStage(stage: string) {
            if (stage === "executing") hooks.afterStage?.("continuation-effect-possible");
          },
        }),
      );
      const continuationCommand: CodexExecutionContinuationCommand = Object.freeze({
        kind: operation.commandKind as "execution.resume" | "execution.retry",
        projectId: operation.projectId,
        expectedProjectResourceRevision: operation.expectedProjectResourceRevision,
        expectedProjectConfigRevision: operation.expectedProjectConfigRevision,
        taskId: operation.taskId,
        expectedTaskRevision: operation.expectedTaskRevision,
        inputReference: codexProductTaskInputReference(operation.operationId, task.id, task.revision),
        executionId: sourceExecution.executionId,
        expectedExecutionRevision: operation.sourceExecutionRevision,
        expectedAttemptNumber: operation.sourceAttemptNumber,
        expectedFencingToken: operation.sourceFencingToken,
        idempotencyKey: stableId("codex-execution-continuation", operation.operationId),
        policyBindingReference: stableId("codex-policy", operation.operationId),
        requestedDeadline: "9999-12-31T23:59:59.999Z",
        backendExecutionId: operation.sourceBackendExecutionId,
        threadId: operation.sourceThreadId,
        continuationReference: operation.continuationReference,
        previousTurnReceiptId: operation.sourceVerifiedReceiptId,
        requiredActionReceiptId: operation.requiredActionReceiptId,
        lastObservationNumber: operation.sourceObservationNumber,
        workspace: Object.freeze({
          workspaceContractId: "ato.workspace/v2" as const,
          workspaceId: generation.workspaceId,
          workspaceGeneration: generation.generation,
          workspaceRevision: generation.revision,
          workspaceRootKey: generation.workspaceRootKey,
          ownershipBindingSha256: verifiedWorkspace.ownershipBindingSha256,
          workspaceHeadObjectId: verifiedWorkspace.headObjectId,
        }),
        successor: Object.freeze({
          executionId: execution.executionId,
          executionRevision: execution.revision,
          attemptNumber: execution.attemptNumber,
          fencingToken: execution.fencingToken,
          taskRevision: task.revision,
        }),
      });
      if (operation.stage === "workspace_ready") {
        const prepared = reliable.prepareContinuation(continuationCommand);
        if (!prepared.ok) return mapReliable(prepared.error.code);
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "intent_prepared" as const,
        }));
        hooks.afterStage?.("continuation-intent-prepared");
        state = readApplicationStateForOwner(store);
      }
      const continuationIntentAtAct = state.executionIntents.find(
        (candidate) => candidate.intentId === operation!.intentId,
      );
      const recoveringContinuationBeforeJournal = operation.stage === "effect_possible" &&
        continuationIntentAtAct?.state === "executing" && codexEffectAbsent(state, operation);
      if (operation.stage === "intent_prepared" || recoveringContinuationBeforeJournal) {
        const t6 = nextIds(ingress, ["request", "correlation", "decision", "audit"]);
        if (t6 === null) return failure("INVALID_INPUT", "Trusted Codex continuation Act identities are invalid.");
        const [requestId, correlationId, decisionId, auditId] = t6;
        let confirmationId: string | null = null;
        try {
          const candidate = exactRecord(ingress.confirmOperation(Object.freeze({
            actorId: operation.actorId,
            action: "codex.execution.invoke" as const,
            requestId: requestId!,
            correlationId: correlationId!,
          })), ["confirmationId"]);
          if (candidate !== null && operationalId(candidate.confirmationId)) confirmationId = candidate.confirmationId;
        } catch {
          confirmationId = null;
        }
        const actContext = trustedContext(ingress);
        if (actContext === null) {
          return failure("AUTHORIZATION_DENIED", "The trusted Codex context changed before continuation Act.");
        }
        if (confirmationId === null) {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, null, "confirmation_required");
          return failure("CONFIRMATION_REQUIRED", "Fresh Codex continuation confirmation is required.");
        }
        if (actContext.actor.actorId !== operation.actorId) {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, confirmationId, "actor_mismatch");
          return failure("AUTHORIZATION_DENIED", "The trusted Codex actor changed before continuation Act.");
        }
        const pointState = readApplicationStateForOwner(store);
        const pointProfile = pointState.codexProfiles.find((candidate) => candidate.profileId === operation!.profileId);
        const pointProject = pointState.projects.find((candidate) => candidate.projectId === operation!.projectId);
        const pointRuntime = runtimeFailure(store, pointState, actContext);
        if (pointRuntime !== null || pointProfile === undefined || pointProject === undefined ||
          pointProfile.status !== "active" ||
          pointProfile.constructorConfigSha256 !== operation.constructorConfigSha256) {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, confirmationId, "policy_denied");
          return pointRuntime ?? failure("CODEX_PROFILE_INACTIVE", "The Codex profile is not active.");
        }
        try {
          revalidateProjectRoot(pointProject, store.layout.root);
          revalidateCodexProfileConfiguration(
            pointProfile, pointProject, store.layout.root,
            reconstructedWorkspacePaths(pointState, store.layout.root),
          );
        } catch {
          persistCodexActDenial(store, operation.operationId, actContext.now, {
            requestId: requestId!, decisionId: decisionId!, auditId: auditId!,
          }, confirmationId, "policy_denied");
          return mapConfigurationFailure();
        }
        const guard: CodexExecutionActGuard = Object.freeze({
          authorize(input: CodexExecutionActGuardInput) {
            const current = input.state.codexProductOperations.find((candidate) => candidate.operationId === operationId);
            const currentProfile = input.state.codexProfiles.find((candidate) => candidate.profileId === operation!.profileId);
            const currentProject = input.state.projects.find((candidate) => candidate.projectId === operation!.projectId);
            const currentExecution = current === undefined ? undefined
              : input.state.executions.find((candidate) => candidate.executionId === current.executionId);
            const currentSource = current === undefined ? undefined
              : input.state.executions.find((candidate) => candidate.executionId === current.sourceExecutionId);
            const currentMember = current === undefined ? undefined
              : input.state.dispatcherMembers.find((candidate) => candidate.memberId === current.memberId);
            const currentWorkspace = current?.workspaceGeneration === null || current === undefined ? undefined
              : input.state.workspaceGenerations.find((candidate) =>
                candidate.workspaceId === current.workspaceId && candidate.generation === current.workspaceGeneration
              );
            if (current === undefined || currentProfile === undefined || currentProject === undefined ||
              current.intentId !== input.intent.intentId || currentExecution === undefined || currentSource === undefined) {
              return Object.freeze({
                allowed: false as const,
                failure: Object.freeze({
                  ok: false as const,
                  error: Object.freeze({ code: "AUTHORIZATION_DENIED" as const, message: "Codex continuation owner is absent" }),
                  requestId: requestId!,
                  correlationId: correlationId!,
                }),
              });
            }
            const freshAct = current.stage === "intent_prepared" && input.intent.state === "pending";
            const recoveredAct = current.stage === "effect_possible" && input.intent.state === "executing" &&
              codexEffectAbsent(input.state, current);
            if (!freshAct && !recoveredAct) {
              return Object.freeze({
                allowed: false as const,
                failure: Object.freeze({
                  ok: false as const,
                  error: Object.freeze({ code: "RECONCILIATION_REQUIRED" as const, message: "Codex continuation Act already progressed" }),
                  requestId: requestId!,
                  correlationId: correlationId!,
                }),
              });
            }
            const currentWorkspaceReceipt = currentWorkspace === undefined ? null : workspaceReceipt(input.state, currentWorkspace);
            const guardContext = Object.freeze({ actor: actContext.actor, now: input.now });
            const codex = projectAuthorization(input.state, guardContext, "codex.execution.invoke", currentProject, true);
            const coreDecision = input.transaction.read().executionAuthorizationDecisions.find(
              (candidate) => candidate.decisionId === input.executionDecisionId &&
                candidate.requestId === input.executionRequestId && candidate.action === input.intent.action,
            );
            if (coreDecision === undefined) throw new TypeError("Codex continuation core Act decision is absent");
            const core: AuthorizationEvaluation = Object.freeze({
              allowed: coreDecision.result === "allow",
              reason: coreDecision.reason,
              policy: coreDecision.policy,
              grantId: coreDecision.grantId,
              grantRevision: coreDecision.grantRevision,
            });
            const structural = (freshAct || recoveredAct) &&
              (current.lifecycle === "active" || current.lifecycle === "recovery_required") &&
              (current.commandKind === "execution.resume" || current.commandKind === "execution.retry") &&
              currentProfile.status === "active" &&
              currentProfile.constructorConfigSha256 === current.constructorConfigSha256 &&
              currentProfile.projectId === current.projectId && currentProfile.projectRootKey === currentProject.rootKey &&
              currentProject.resourceRevision === current.expectedProjectResourceRevision &&
              currentProject.configRevision === current.expectedProjectConfigRevision &&
              currentSource.status === "superseded" && currentSource.supersededByExecutionId === currentExecution.executionId &&
              currentExecution.status === "active" && currentExecution.executionId === input.intent.executionId &&
              currentExecution.revision === input.intent.executionRevision &&
              currentExecution.fencingToken === input.intent.fencingToken &&
              currentMember?.ownerKind === "codex-product-operation" &&
              currentMember.productOperationId === current.operationId &&
              currentWorkspace !== undefined && currentWorkspace.status === "ready" &&
              currentWorkspace.generation === current.workspaceGeneration &&
              currentWorkspace.revision === current.workspaceRevision &&
              currentWorkspace.workspaceRootKey === input.intent.workspaceRootKey &&
              currentWorkspaceReceipt !== null &&
              currentWorkspaceReceipt.headObjectId === current.workspaceHeadObjectId &&
              (input.intent.state === "pending" || input.intent.state === "executing") &&
              input.intent.workspaceId === current.workspaceId &&
              input.intent.workspaceGeneration === current.workspaceGeneration &&
              input.intent.workspaceRevision === current.workspaceRevision &&
              input.intent.workspaceHeadObjectId === current.workspaceHeadObjectId &&
              input.intent.ownershipBindingSha256 === currentWorkspaceReceipt.ownershipBindingSha256 &&
              input.intent.sourceExecutionId === current.sourceExecutionId;
            const grantSet = operationGrantSet(input.state, guardContext, current, currentProject, codex, core);
            const allowed = structural && input.executionAuthorized &&
              grantSet.evaluations.every((candidate) => candidate.allowed);
            const evaluation: AuthorizationEvaluation = allowed ? codex : Object.freeze({
              ...codex,
              allowed: false,
              reason: codex.allowed ? "policy_denied" as const : codex.reason,
              policy: codex.allowed ? "deny" as const : codex.policy,
            });
            const bindingRevision = input.state.codexEffectAuthorizations
              .filter((candidate) => candidate.productOperationId === current.operationId).length + 1;
            input.transaction.insertCodexEffectAuthorization(Object.freeze({
              authorizationId: stableId("codex-authorization", current.operationId, bindingRevision),
              productOperationId: current.operationId,
              phase: "act" as const,
              bindingRevision,
              requestId: requestId!,
              decisionId: decisionId!,
              auditId: auditId!,
              confirmationId,
              actorId: current.actorId,
              action: "codex.execution.invoke" as const,
              result: allowed ? "allow" as const : "deny" as const,
              reason: evaluation.reason,
              policy: evaluation.policy,
              grantId: evaluation.grantId,
              grantRevision: evaluation.grantRevision,
              requiredGrantSetVersion: 1 as const,
              requiredGrantSetJson: grantSet.set.json,
              requiredGrantSetSha256: grantSet.set.sha256,
              coreAuthorizationDecisionId: input.executionDecisionId,
              coreAuthorizationBindingRevision: input.bindingRevision,
              profileId: currentProfile.profileId,
              profileRevision: currentProfile.revision,
              constructorConfigSha256: current.constructorConfigSha256,
              runId: current.runId,
              memberId: current.memberId,
              executionId: current.executionId,
              intentId: current.intentId,
              workspaceId: current.workspaceId,
              workspaceGeneration: current.workspaceGeneration,
              workspaceRevision: current.workspaceRevision,
              createdAt: input.now,
            }));
            input.transaction.updateCodexProductOperation(Object.freeze({
              ...current,
              stage: allowed ? "effect_possible" as const : "intent_prepared" as const,
              lifecycle: allowed ? "active" as const : "recovery_required" as const,
              resultCode: allowed ? null : evaluation.reason,
              revision: current.revision + 1,
              updatedAt: laterTimestamp(current.updatedAt, input.now),
            }), current.revision);
            if (!allowed) {
              return Object.freeze({
                allowed: false as const,
                failure: Object.freeze({
                  ok: false as const,
                  error: Object.freeze({ code: "AUTHORIZATION_DENIED" as const, message: "Codex continuation Act was denied" }),
                  requestId: requestId!,
                  correlationId: correlationId!,
                }),
              });
            }
            return Object.freeze({ allowed: true as const });
          },
        });
        const invoked = await reliable.invokePreparedContinuation(continuationCommand, guard);
        hooks.afterStage?.("continuation-effect-terminal-observed");
        state = readApplicationStateForOwner(store);
        operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
        const intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
        if (intent?.state !== "finalized") {
          return invoked.ok ? failure("RECONCILIATION_REQUIRED", "The Codex continuation effect is not terminal.")
            : mapReliable(invoked.error.code);
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "effect_terminal" as const,
          lifecycle: "active" as const,
          resultCode: null,
        }));
        state = readApplicationStateForOwner(store);
      }
      if (operation.stage === "effect_possible") {
        state = readApplicationStateForOwner(store);
        let intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
        if (intent === undefined) return failure("RECONCILIATION_REQUIRED", "The effect-possible continuation intent is absent.");
        if (intent.state !== "finalized") {
          const turn = state.codexTurns.find((candidate) => candidate.executionId === intent!.executionId);
          if (turn === undefined || turn.threadId === null || intent.workspaceId === null ||
            intent.workspaceGeneration === null || intent.workspaceRevision === null || intent.workspaceRootKey === null ||
            intent.ownershipBindingSha256 === null || intent.workspaceHeadObjectId === null) {
            return failure("RECONCILIATION_REQUIRED", "The effect-possible continuation lacks inspectable evidence.");
          }
          const inspectCommand: CodexExecutionInspectCommand = Object.freeze({
            kind: "execution.inspect" as const,
            projectId: intent.projectId,
            expectedProjectResourceRevision: intent.projectResourceRevision,
            expectedProjectConfigRevision: intent.projectConfigRevision,
            taskId: intent.taskId,
            expectedTaskRevision: intent.taskRevision,
            inputReference: intent.inputReference,
            executionId: intent.executionId,
            expectedExecutionRevision: intent.executionRevision,
            expectedAttemptNumber: intent.attemptNumber,
            expectedFencingToken: intent.fencingToken,
            idempotencyKey: stableId("codex-continuation-effect-reconcile", operation.operationId),
            policyBindingReference: intent.policyBindingReference,
            requestedDeadline: intent.requestedDeadline,
            backendExecutionId: turn.backendExecutionId,
            threadId: turn.threadId,
            lastObservationNumber: intent.lastObservationNumber,
            workspace: Object.freeze({
              workspaceContractId: "ato.workspace/v2" as const,
              workspaceId: intent.workspaceId,
              workspaceGeneration: intent.workspaceGeneration,
              workspaceRevision: intent.workspaceRevision,
              workspaceRootKey: intent.workspaceRootKey,
              ownershipBindingSha256: intent.ownershipBindingSha256,
              workspaceHeadObjectId: intent.workspaceHeadObjectId,
            }),
          });
          const reconciled = await reliable.reconcile(inspectCommand);
          if (!reconciled.ok) return mapReliable(reconciled.error.code);
          state = readApplicationStateForOwner(store);
          intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
          if (intent?.state !== "finalized") {
            return failure("RECONCILIATION_REQUIRED", "The effect-possible continuation is not yet terminal.");
          }
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "effect_terminal" as const,
          lifecycle: "active" as const,
          resultCode: null,
        }));
        state = readApplicationStateForOwner(store);
      }
      if (operation.stage === "effect_terminal") {
        generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === operation!.workspaceId && candidate.generation === operation!.workspaceGeneration
        );
        if (generation === undefined) return failure("RECONCILIATION_REQUIRED", "The terminal continuation workspace is absent.");
        const currentTask = state.domain.tasks.find((candidate) => candidate.id === operation!.taskId);
        const currentExecution = state.executions.find((candidate) => candidate.executionId === operation!.executionId);
        const currentRun = state.dispatcherRuns.find((candidate) => candidate.runId === operation!.runId);
        const currentMember = state.dispatcherMembers.find((candidate) => candidate.memberId === operation!.memberId);
        if (currentTask === undefined || currentExecution === undefined || currentRun === undefined || currentMember === undefined) {
          return failure("RECONCILIATION_REQUIRED", "The terminal continuation owner tuple is absent.");
        }
        const adapter = (dependencies.workspaceBackend ?? defaultWorkspaceBackend)(profile, project);
        const workspace = createWorkspaceApplicationService(
          store, adapter.backend, roleIngress(ingress, operation, "continuation-workspace-final-inspect"), Object.freeze({
            adapterId: adapter.adapterId,
            adapterVersion: adapter.adapterVersion,
            workspaceRootKey: profile.workspaceRootKey,
          }),
        );
        const inspected = workspace.inspect(Object.freeze({
          kind: "workspace.inspect" as const,
          projectId: project.projectId,
          expectedProjectResourceRevision: project.resourceRevision,
          expectedProjectConfigRevision: project.configRevision,
          taskId: currentTask.id,
          expectedTaskRevision: currentTask.revision,
          runId: currentRun.runId,
          expectedRunRevision: currentRun.runRevision,
          memberId: currentMember.memberId,
          expectedMembershipRevision: currentMember.membershipRevision,
          expectedMemberRevision: currentMember.revision,
          executionId: currentExecution.executionId,
          expectedExecutionRevision: currentExecution.revision,
          expectedAttemptNumber: currentExecution.attemptNumber,
          expectedFencingToken: currentExecution.fencingToken,
          idempotencyKey: stableId("codex-continuation-workspace-final-inspect", operation.operationId),
          workspaceId: generation.workspaceId,
          expectedGeneration: generation.generation,
          expectedGenerationRevision: generation.revision,
        }));
        if (!inspected.ok) return mapWorkspace(inspected.error.code);
        hooks.afterStage?.("continuation-workspace-refreshed");
        state = readApplicationStateForOwner(store);
        generation = state.workspaceGenerations.find((candidate) =>
          candidate.workspaceId === operation!.workspaceId && candidate.generation === operation!.workspaceGeneration
        );
        verifiedWorkspace = generation === undefined ? null : workspaceReceipt(state, generation);
        if (generation === undefined || verifiedWorkspace === null || verifiedWorkspace.headObjectId === null) {
          return failure("RECONCILIATION_REQUIRED", "The final continuation workspace HEAD is not authoritative.");
        }
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          stage: "workspace_refreshed" as const,
          lifecycle: "active" as const,
          workspaceRevision: generation!.revision,
          workspaceHeadObjectId: verifiedWorkspace!.headObjectId,
          resultCode: null,
        }));
        state = readApplicationStateForOwner(store);
      }
      if (operation.stage === "workspace_refreshed" && operation.lifecycle === "active") {
        const finalizedRun = targeted.finalizeRun(operation.operationId);
        if (!finalizedRun.ok) return mapDispatcher(finalizedRun.error.code);
        state = readApplicationStateForOwner(store);
        operation = state.codexProductOperations.find((candidate) => candidate.operationId === operationId)!;
        const intent = state.executionIntents.find((candidate) => candidate.intentId === operation!.intentId);
        const observation = intent === undefined ? undefined : state.executionObservations
          .filter((candidate) => candidate.intentId === intent.intentId)
          .sort((left, right) => right.observationNumber - left.observationNumber)[0];
        const preparationFailure = intent?.lastErrorCode === "codex_credential_unavailable"
          ? Object.freeze({
            terminal: failure("CODEX_CREDENTIAL_UNAVAILABLE", "The configured Codex credential is unavailable."),
            resultCode: "credential_unavailable",
          })
          : intent?.lastErrorCode === "codex_profile_configuration_changed"
            ? Object.freeze({
              terminal: failure("PROJECT_IDENTITY_CHANGED", "The Project identity changed."),
              resultCode: "configuration_changed",
            })
            : intent?.lastErrorCode === "codex_driver_construction_failed"
              ? Object.freeze({
                terminal: failure("CODEX_ADAPTER_FAILURE", "The Codex execution adapter failed."),
                resultCode: "adapter_failure",
              })
              : null;
        const terminal: CodexProductResult<CodexStoredTerminalValue> = preparationFailure?.terminal ??
          success(productExecutionProjection(state, operation, false));
        operation = updateProductOperation(store, operation.operationId, ingress.now(), () => Object.freeze({
          lifecycle: "finalized" as const,
          resultCode: preparationFailure?.resultCode ?? observation?.lifecycle ?? "finalized",
          resultJson: storedTerminalJson(terminal),
        }));
      }
      return continuationTerminalResult(operation, replayed);
    } catch (error) {
      return error instanceof PersistenceError
        ? failure("PERSISTENCE_FAILURE", "Codex continuation persistence failed closed.")
        : failure("CODEX_ADAPTER_FAILURE", "The Codex execution adapter failed.");
    }
  };

  const dispatchRun = async (value: unknown): Promise<CodexProductResult<CodexDispatchView>> => {
    const command = parseDispatch(value);
    if (command === null) return failure("INVALID_INPUT", "The Codex dispatch command is invalid.");
    const context = trustedContext(ingress);
    if (context === null) return failure("INVALID_INPUT", "The trusted Codex product ingress is invalid.");
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const commandJson = productCommandJson(command, context.actor.actorId);
      const replay = state.codexProductOperations.find((candidate) => candidate.publicIdempotencyKey === command.idempotencyKey);
      if (replay !== undefined) {
        if (replay.actorId !== context.actor.actorId || replay.commandKind !== "codex.dispatch-run" ||
          replay.commandJson !== commandJson || replay.commandSha256 !== sha256(commandJson)) {
          return failure("IDEMPOTENCY_CONFLICT", "The idempotency key is bound to another Codex command.");
        }
        return progressStart(command, replay.operationId, true);
      }
      const prepared = createStartOperation(command, context, commandJson);
      if (!prepared.ok) return prepared;
      return progressStart(command, prepared.value.operationId, false);
    } catch {
      return failure("PERSISTENCE_FAILURE", "Codex dispatch failed closed.");
    }
  };

  const continueExecution = async (
    value: unknown,
    kind: "execution.resume" | "execution.retry",
  ): Promise<CodexProductResult<ProductExecutionView>> => {
    const command = parseExecutionContinuation(value, kind);
    if (command === null) return failure("INVALID_INPUT", "The Codex continuation command is invalid.");
    const context = trustedContext(ingress);
    if (context === null) return failure("INVALID_INPUT", "The trusted Codex product ingress is invalid.");
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const commandJson = continuationCommandJson(command, context.actor.actorId);
      const replay = state.codexProductOperations.find((candidate) =>
        candidate.publicIdempotencyKey === command.idempotencyKey
      );
      if (replay !== undefined) {
        if (replay.actorId !== context.actor.actorId || replay.commandKind !== kind ||
          replay.commandJson !== commandJson || replay.commandSha256 !== sha256(commandJson)) {
          return failure("IDEMPOTENCY_CONFLICT", "The idempotency key is bound to another Codex command.");
        }
        return progressContinuation(replay.operationId, true);
      }
      const prepared = createContinuationOperation(command, context, commandJson);
      if (!prepared.ok) return prepared;
      return progressContinuation(prepared.value.operationId, false);
    } catch {
      return failure("PERSISTENCE_FAILURE", "Codex continuation failed closed.");
    }
  };

  const inspect = async (value: unknown): Promise<CodexProductResult<ProductExecutionView>> => {
    const command = parseExecutionInspect(value);
    if (command === null) return failure("INVALID_INPUT", "The Codex execution inspection command is invalid.");
    const context = trustedContext(ingress);
    if (context === null) return failure("INVALID_INPUT", "The trusted Codex inspection ingress is invalid.");
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const binding = codexExecutionBinding(state, command);
      if ("ok" in binding) return binding;
      try {
        revalidateProjectRoot(binding.project, store.layout.root);
      } catch {
        return mapConfigurationFailure();
      }
      const executionBackend = (dependencies.executionBackend ?? defaultExecutionBackend)(
        store, binding.profile, binding.project,
        () => Object.freeze({ ok: false as const, code: "adapter_failure" as const }),
      );
      const reliable = createInjectedCodexReliableExecutionService(
        store,
        reliableRoleIngress(ingress, binding.operation, `inspect:${command.idempotencyKey}`),
        executionBackend,
      );
      const internal: CodexExecutionInspectCommand = Object.freeze({
        kind: "execution.inspect" as const,
        projectId: command.projectId,
        expectedProjectResourceRevision: command.expectedProjectResourceRevision,
        expectedProjectConfigRevision: command.expectedProjectConfigRevision,
        taskId: command.taskId,
        expectedTaskRevision: command.expectedTaskRevision,
        inputReference: binding.turn.inputReference,
        executionId: command.executionId,
        expectedExecutionRevision: command.expectedExecutionRevision,
        expectedAttemptNumber: command.expectedAttemptNumber,
        expectedFencingToken: command.expectedFencingToken,
        idempotencyKey: stableId("codex-public-inspect", command.idempotencyKey),
        policyBindingReference: binding.turn.policyBindingReference,
        requestedDeadline: "9999-12-31T23:59:59.999Z",
        backendExecutionId: binding.turn.backendExecutionId,
        threadId: binding.turn.threadId!,
        lastObservationNumber: binding.turn.revision,
        workspace: Object.freeze({
          workspaceContractId: "ato.workspace/v2" as const,
          workspaceId: binding.workspace.workspaceId,
          workspaceGeneration: binding.workspace.generation,
          workspaceRevision: binding.workspace.revision,
          workspaceRootKey: binding.workspace.workspaceRootKey,
          ownershipBindingSha256: binding.workspaceReceipt.ownershipBindingSha256,
          workspaceHeadObjectId: binding.workspaceReceipt.headObjectId!,
        }),
      });
      const result = await reliable.reconcile(internal);
      return result.ok ? success(reliableProjection(result.value)) : mapReliable(result.error.code);
    } catch (error) {
      return error instanceof PersistenceError
        ? failure("PERSISTENCE_FAILURE", "Codex execution inspection failed closed.")
        : failure("CODEX_ADAPTER_FAILURE", "The Codex execution adapter failed.");
    }
  };

  const requestCancel = async (value: unknown): Promise<CodexProductResult<ProductExecutionView>> => {
    const command = parseExecutionCancel(value);
    if (command === null) return failure("INVALID_INPUT", "The Codex cancellation command is invalid.");
    const context = trustedContext(ingress);
    if (context === null) return failure("INVALID_INPUT", "The trusted Codex cancellation ingress is invalid.");
    try {
      const state = readApplicationStateForOwner(store);
      const runtime = runtimeFailure(store, state, context);
      if (runtime !== null) return runtime;
      const binding = codexExecutionBinding(state, command);
      if ("ok" in binding) return binding;
      const codexAuthorization = projectAuthorization(
        state, context, "codex.execution.cancel", binding.project, true,
      );
      if (!codexAuthorization.allowed) {
        return failure("AUTHORIZATION_DENIED", "Current grants did not authorize Codex cancellation.");
      }
      try {
        revalidateProjectRoot(binding.project, store.layout.root);
      } catch {
        return mapConfigurationFailure();
      }
      if (!["active", "turn_succeeded", "failed"].includes(binding.turn.lifecycle)) {
        return failure("RECONCILIATION_REQUIRED", "The Codex turn is not in a cancellable lifecycle.");
      }
      const executionBackend = (dependencies.executionBackend ?? defaultExecutionBackend)(
        store, binding.profile, binding.project,
        () => Object.freeze({ ok: false as const, code: "adapter_failure" as const }),
      );
      const reliable = createInjectedCodexReliableExecutionService(
        store,
        reliableRoleIngress(ingress, binding.operation, `cancel:${command.idempotencyKey}`),
        executionBackend,
      );
      const internal: CodexExecutionCancelCommand = Object.freeze({
        kind: "execution.cancel" as const,
        projectId: command.projectId,
        expectedProjectResourceRevision: command.expectedProjectResourceRevision,
        expectedProjectConfigRevision: command.expectedProjectConfigRevision,
        taskId: command.taskId,
        expectedTaskRevision: command.expectedTaskRevision,
        inputReference: binding.turn.inputReference,
        executionId: command.executionId,
        expectedExecutionRevision: command.expectedExecutionRevision,
        expectedAttemptNumber: command.expectedAttemptNumber,
        expectedFencingToken: command.expectedFencingToken,
        idempotencyKey: stableId("codex-public-cancel", command.idempotencyKey),
        policyBindingReference: binding.turn.policyBindingReference,
        requestedDeadline: "9999-12-31T23:59:59.999Z",
        backendExecutionId: binding.turn.backendExecutionId,
        threadId: binding.turn.threadId!,
        expectedLifecycle: binding.turn.lifecycle as "active" | "turn_succeeded" | "failed",
        reasonCode: command.reasonCode,
        lastObservationNumber: binding.turn.revision,
        workspace: Object.freeze({
          workspaceContractId: "ato.workspace/v2" as const,
          workspaceId: binding.workspace.workspaceId,
          workspaceGeneration: binding.workspace.generation,
          workspaceRevision: binding.workspace.revision,
          workspaceRootKey: binding.workspace.workspaceRootKey,
          ownershipBindingSha256: binding.workspaceReceipt.ownershipBindingSha256,
          workspaceHeadObjectId: binding.workspaceReceipt.headObjectId!,
        }),
      });
      const result = await reliable.requestCancel(internal);
      return result.ok ? success(reliableProjection(result.value)) : mapReliable(result.error.code);
    } catch (error) {
      return error instanceof PersistenceError
        ? failure("PERSISTENCE_FAILURE", "Codex cancellation failed closed.")
        : failure("CODEX_ADAPTER_FAILURE", "The Codex execution adapter failed.");
    }
  };

  const resume = (value: unknown): Promise<CodexProductResult<ProductExecutionView>> =>
    continueExecution(value, "execution.resume");
  const retry = (value: unknown): Promise<CodexProductResult<ProductExecutionView>> =>
    continueExecution(value, "execution.retry");

  return Object.freeze({
    activateProfile,
    inspectProfile,
    deactivateProfile,
    dispatchRun,
    inspect,
    resume,
    retry,
    requestCancel,
  });
}

export function createCodexProductApplication(
  store: PersistenceStore,
  ingress: CodexProductIngress,
): CodexProductApplicationService {
  return createCodexProductApplicationInternal(store, ingress, Object.freeze({
    credentialResolver: createProcessEnvironmentCodexCredentialResolver(),
  }), Object.freeze({}));
}

/** Package-private C19 lookup for the CLI; intentionally omitted from src/index.ts. */
export function lookupCodexContinuationReplayForCli(
  store: PersistenceStore,
  ingress: CodexProductIngress,
  value: unknown,
  kind: "execution.resume" | "execution.retry",
): CodexProductResult<Readonly<{ readonly found: boolean }>> {
  const command = parseExecutionContinuation(value, kind);
  if (command === null) return failure("INVALID_INPUT", "The Codex continuation command is invalid.");
  const context = trustedContext(ingress);
  if (context === null) return failure("INVALID_INPUT", "The trusted Codex product ingress is invalid.");
  try {
    const state = readApplicationStateForOwner(store);
    const runtime = runtimeFailure(store, state, context);
    if (runtime !== null) return runtime;
    const operation = state.codexProductOperations.find((candidate) =>
      candidate.publicIdempotencyKey === command.idempotencyKey
    );
    if (operation === undefined) return success(Object.freeze({ found: false }));
    const commandJson = continuationCommandJson(command, context.actor.actorId);
    if (operation.actorId !== context.actor.actorId || operation.commandKind !== kind ||
      operation.commandJson !== commandJson || operation.commandSha256 !== sha256(commandJson)) {
      return failure("IDEMPOTENCY_CONFLICT", "The idempotency key is bound to another Codex command.");
    }
    return success(Object.freeze({ found: true }));
  } catch {
    return failure("PERSISTENCE_FAILURE", "Codex continuation lookup failed closed.");
  }
}

/** Internal test factory; intentionally omitted from src/index.ts. */
export function createCodexProductApplicationWithDependencies(
  store: PersistenceStore,
  ingress: CodexProductIngress,
  dependencies: CodexProductApplicationDependencies,
  hooks: CodexProductApplicationHooks = Object.freeze({}),
): CodexProductApplicationService {
  return createCodexProductApplicationInternal(store, ingress, dependencies, hooks);
}
