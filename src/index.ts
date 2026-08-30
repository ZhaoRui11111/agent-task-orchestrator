export interface ScaffoldStatus {
  readonly packageName: "agent-task-orchestrator";
  readonly phase: "phase1-local-product-cli";
  readonly domainCoreImplemented: true;
  readonly persistenceFoundationImplemented: true;
  readonly projectRegistryImplemented: true;
  readonly runtimeAuthorizationImplemented: true;
  readonly applicationServiceImplemented: true;
  readonly localPhase1ProductCliImplemented: true;
  readonly backupRestoreDoctorImplemented: true;
  readonly productRuntimeImplemented: false;
  readonly executionRuntimeImplemented: false;
  readonly supportedAdapters: readonly [];
}

const STATUS: ScaffoldStatus = Object.freeze({
  packageName: "agent-task-orchestrator",
  phase: "phase1-local-product-cli",
  domainCoreImplemented: true,
  persistenceFoundationImplemented: true,
  projectRegistryImplemented: true,
  runtimeAuthorizationImplemented: true,
  applicationServiceImplemented: true,
  localPhase1ProductCliImplemented: true,
  backupRestoreDoctorImplemented: true,
  productRuntimeImplemented: false,
  executionRuntimeImplemented: false,
  supportedAdapters: Object.freeze([] as const),
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
  ConfirmationRequest,
  TrustedActorAssertion,
} from "./application.ts";
export * from "./persistence/index.ts";
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
