export interface ScaffoldStatus {
  readonly packageName: "agent-task-orchestrator";
  readonly phase: "phase2-local-manual-product";
  readonly domainCoreImplemented: true;
  readonly persistenceFoundationImplemented: true;
  readonly projectRegistryImplemented: true;
  readonly runtimeAuthorizationImplemented: true;
  readonly applicationServiceImplemented: true;
  readonly localProductCliImplemented: true;
  readonly backupRestoreDoctorImplemented: true;
  readonly durableExecutionClaimFoundationImplemented: true;
  readonly reliableManualExecutionLoopImplemented: true;
  readonly reconcileFirstManualDispatcherImplemented: true;
  readonly productRuntimeImplemented: true;
  readonly executionRuntimeImplemented: true;
  readonly supportedAdapters: readonly ["manual-local"];
}

const STATUS: ScaffoldStatus = Object.freeze({
  packageName: "agent-task-orchestrator",
  phase: "phase2-local-manual-product",
  domainCoreImplemented: true,
  persistenceFoundationImplemented: true,
  projectRegistryImplemented: true,
  runtimeAuthorizationImplemented: true,
  applicationServiceImplemented: true,
  localProductCliImplemented: true,
  backupRestoreDoctorImplemented: true,
  durableExecutionClaimFoundationImplemented: true,
  reliableManualExecutionLoopImplemented: true,
  reconcileFirstManualDispatcherImplemented: true,
  productRuntimeImplemented: true,
  executionRuntimeImplemented: true,
  supportedAdapters: Object.freeze(["manual-local"] as const),
});

export function getScaffoldStatus(): ScaffoldStatus {
  return STATUS;
}

export * from "./domain.ts";
export * from "./authorization.ts";
export * from "./project-registry.ts";
export {
  APPLICATION_ERROR_CODES,
  createApplicationService,
} from "./application.ts";
export type {
  ApplicationCommand,
  ApplicationDetail,
  ApplicationError,
  ApplicationErrorCode,
  ApplicationFailure,
  ApplicationIngress,
  ApplicationResult,
  ApplicationService,
  ApplicationSuccess,
  BootstrapCommand,
  CapabilityEpochResult,
  CapabilityUpgradeCommand,
  ConfirmationRequest,
  TrustedActorAssertion,
} from "./application.ts";
export {
  EXECUTION_APPLICATION_ERROR_CODES,
  createExecutionApplicationService,
} from "./execution-application.ts";
export type {
  ExecutionApplicationError,
  ExecutionApplicationErrorCode,
  ExecutionApplicationFailure,
  ExecutionApplicationResult,
  ExecutionApplicationService,
  ExecutionApplicationSuccess,
  ExecutionClaimCommand,
  ExecutionClaimView,
  ExecutionIngress,
  ExecutionInspectCommand,
  ExecutionLeaseRenewCommand,
  ExecutionTakeoverCommand,
} from "./execution-application.ts";
export * from "./execution-port.ts";
export * from "./manual-execution-backend.ts";
export * from "./execution-loop.ts";
export * from "./dispatcher-application.ts";
export * from "./dispatcher.ts";
export * from "./product-runtime.ts";
export * from "./persistence/index.ts";
export {
  createLocalProductIngress,
  type LocalProductConfirmationAction,
  type LocalProductConfirmationRequest,
  type LocalProductIngress,
  type LocalProductIngressOptions,
} from "./persistence/local-ingress.ts";
export {
  CLI_API_VERSION,
  PUBLIC_ERROR_TABLE,
  parseCliArguments,
  runCli,
} from "./cli-api.ts";
export type {
  CliFormat,
  CliRunOptions,
  CliRunResult,
  PublicErrorCode,
} from "./cli-api.ts";
