import type {
  AuthorizationAction,
  AuthorizationEvaluation,
  GrantIssueProof,
  AuthorizationScope,
} from "./authorization.ts";
import type { ProjectRootIdentity } from "./project-registry.ts";
import type {
  ApplicationAuditRecord,
  ApplicationAction,
  ApplicationRequestRecord,
  RegisteredProject,
} from "./persistence/application-repository.ts";

export const APPLICATION_ERROR_CODES = Object.freeze([
  "INVALID_INPUT",
  "BOOTSTRAP_ALREADY_CONSUMED",
  "BOOTSTRAP_REQUIRED",
  "AUTHORIZATION_DENIED",
  "PROJECT_NOT_FOUND",
  "PROJECT_ALREADY_REGISTERED",
  "PROJECT_REGISTRY_REJECTED",
  "TASK_NOT_FOUND",
  "GRANT_NOT_FOUND",
  "STALE_REVISION",
  "DOMAIN_REJECTED",
  "SCOPE_EXPANSION_DENIED",
  "CAPABILITY_RENEWAL_NOT_DUE",
  "CAPABILITY_UPGRADE_NOT_ELIGIBLE",
] as const);

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];
export type ApplicationDetail = string | number | boolean | null;

export interface ApplicationError {
  readonly code: ApplicationErrorCode;
  readonly message: string;
  readonly details: Readonly<Record<string, ApplicationDetail>>;
}

export interface ApplicationSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ApplicationFailure {
  readonly ok: false;
  readonly error: ApplicationError;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}

export type ApplicationResult<T> = ApplicationSuccess<T> | ApplicationFailure;

export interface TrustedActorAssertion {
  readonly actorId: string;
  readonly principal: string;
}

export interface ConfirmationRequest {
  readonly actorId: string;
  readonly action: ApplicationAction;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ApplicationIngress {
  currentActor(): TrustedActorAssertion;
  now(): string;
  nextId(kind: "request" | "correlation" | "decision" | "audit" | "grant" | "epoch" | "lifecycle"): string;
  confirmHighRisk(request: ConfirmationRequest): boolean;
}

export interface ApplicationTestHooks {
  beforeTransaction?(): void;
  afterStage?(stage: string): void;
}

export interface BootstrapCommand {
  readonly kind: "authorization.bootstrap";
  readonly expiresAt: string;
}

export interface RenewalCommand {
  readonly kind: "authorization.capability.renew";
  readonly expiresAt: string;
}

export interface CapabilityUpgradeCommand {
  readonly kind: "authorization.capability.upgrade";
  readonly expiresAt: string;
}

export interface CapabilityEpochResult {
  readonly mode: "initialized" | "renewed" | "upgraded";
  readonly expiresAt: string;
  readonly capabilityCount: number;
  readonly epochRevision: number;
}

export interface ProjectCommandResult {
  readonly projectId: string;
  readonly enabled: boolean;
  readonly configRevision: number;
  readonly resourceRevision: number;
}

export type ApplicationCommand =
  | { readonly kind: "authorization.grant.issue"; readonly actorId: string; readonly action: AuthorizationAction; readonly scope: AuthorizationScope; readonly notBefore: string; readonly expiresAt: string }
  | { readonly kind: "authorization.grant.inspect"; readonly grantId: string; readonly expectedGrantRevision: number }
  | { readonly kind: "authorization.grant.revoke"; readonly grantId: string; readonly expectedGrantRevision: number }
  | { readonly kind: "policy.evaluate"; readonly projectId: string; readonly expectedResourceRevision: number; readonly expectedConfigRevision: number; readonly action: AuthorizationAction }
  | { readonly kind: "project.register"; readonly projectId: string; readonly root: string }
  | { readonly kind: "project.update"; readonly projectId: string; readonly expectedResourceRevision: number; readonly expectedConfigRevision: number }
  | { readonly kind: "project.disable"; readonly projectId: string; readonly expectedResourceRevision: number; readonly expectedConfigRevision: number }
  | { readonly kind: "project.inspect"; readonly projectId: string; readonly expectedResourceRevision: number }
  | { readonly kind: "task.create"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly body: string; readonly supersedesTaskId: string | null }
  | { readonly kind: "task.update"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly change: { readonly kind: "body"; readonly body: string } | { readonly kind: "parent"; readonly parentId: string | null } }
  | { readonly kind: "task.mark_ready"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number }
  | { readonly kind: "task.cancel"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly reason: string }
  | { readonly kind: "task.inspect"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number }
  | { readonly kind: "dependency.add"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly dependencyId: string; readonly expectedDependencyRevision: number }
  | { readonly kind: "dependency.remove"; readonly projectId: string; readonly expectedProjectResourceRevision: number; readonly taskId: string; readonly expectedTaskRevision: number; readonly dependencyId: string; readonly expectedDependencyRevision: number }
  | { readonly kind: "authorization.grant.list"; readonly limit: number; readonly afterGrantId: string | null }
  | { readonly kind: "runtime.status" }
  | { readonly kind: "runtime.backup" | "runtime.restore"; readonly backupGenerationId: string };

export type ExistingProjectCommand = Extract<ApplicationCommand, {
  readonly kind: "project.update" | "project.disable" | "project.inspect";
}>;
export type DomainApplicationCommand = Extract<ApplicationCommand, {
  readonly kind:
    | "task.create"
    | "task.update"
    | "task.mark_ready"
    | "task.cancel"
    | "task.inspect"
    | "dependency.add"
    | "dependency.remove";
}>;

type TargetKind = ApplicationRequestRecord["targetKind"];
export type AuditKind = ApplicationAuditRecord["eventKind"];
export type UnknownRecord = Record<string, unknown>;

export interface OperationIdentity {
  readonly actor: TrustedActorAssertion;
  readonly now: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly decisionId: string;
  readonly auditId: string;
}

export interface BoundTarget {
  readonly kind: TargetKind;
  readonly id: string;
  readonly revision: number | null;
  readonly project: RegisteredProject | null;
}

export interface CommandAuthorization {
  readonly evaluation: AuthorizationEvaluation;
  readonly issuanceProof: GrantIssueProof | null;
}

export interface AffectedProjectPreflight {
  readonly project: RegisteredProject;
  readonly identity: ProjectRootIdentity;
}

export interface ApplicationService {
  bootstrap(command: BootstrapCommand): ApplicationResult<Readonly<{ actorId: string; grantIds: readonly string[] }>>;
  upgrade(command: CapabilityUpgradeCommand): ApplicationResult<CapabilityEpochResult>;
  renew(command: RenewalCommand): ApplicationResult<CapabilityEpochResult>;
  execute(command: ApplicationCommand): ApplicationResult<unknown>;
}
