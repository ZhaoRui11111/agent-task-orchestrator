export interface ScaffoldStatus {
  readonly packageName: "agent-task-orchestrator";
  readonly phase: "domain-core";
  readonly domainCoreImplemented: true;
  readonly productRuntimeImplemented: false;
  readonly supportedAdapters: readonly [];
}

const STATUS: ScaffoldStatus = Object.freeze({
  packageName: "agent-task-orchestrator",
  phase: "domain-core",
  domainCoreImplemented: true,
  productRuntimeImplemented: false,
  supportedAdapters: Object.freeze([] as const),
});

export function getScaffoldStatus(): ScaffoldStatus {
  return STATUS;
}

export * from "./domain.ts";
