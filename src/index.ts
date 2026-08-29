export interface ScaffoldStatus {
  readonly packageName: "agent-task-orchestrator";
  readonly phase: "persistence-foundation";
  readonly domainCoreImplemented: true;
  readonly persistenceFoundationImplemented: true;
  readonly applicationServiceImplemented: false;
  readonly productRuntimeImplemented: false;
  readonly supportedAdapters: readonly [];
}

const STATUS: ScaffoldStatus = Object.freeze({
  packageName: "agent-task-orchestrator",
  phase: "persistence-foundation",
  domainCoreImplemented: true,
  persistenceFoundationImplemented: true,
  applicationServiceImplemented: false,
  productRuntimeImplemented: false,
  supportedAdapters: Object.freeze([] as const),
});

export function getScaffoldStatus(): ScaffoldStatus {
  return STATUS;
}

export * from "./domain.ts";
export * from "./persistence/index.ts";
