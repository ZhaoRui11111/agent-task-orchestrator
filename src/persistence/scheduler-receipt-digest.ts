import type {
  SchedulerExternalState,
  SchedulerFailureCategory,
  SchedulerReceiptCode,
  SchedulerReceiptOutcome,
} from "../scheduler-port.ts";
import { canonicalJson, sha256 } from "./values.ts";

export interface SchedulerConfigurationProjection {
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly scopeKind: "runtime" | "project";
  readonly projectId: string | null;
  readonly projectResourceRevision: number | null;
  readonly projectConfigRevision: number | null;
  readonly scheduleExpression: string;
  readonly timeZone: string;
  readonly dispatcherTarget: string;
}

export interface SchedulerReceiptProjection {
  readonly requestId: string;
  readonly intentId: string | null;
  readonly observationNumber: number;
  readonly operation: "register" | "inspect" | "remove";
  readonly operationId: string;
  readonly scheduleId: string;
  readonly configRevision: number;
  readonly externalState: SchedulerExternalState;
  readonly externalRegistrationId: string | null;
  readonly enabled: boolean | null;
  readonly nextTriggerAt: string | null;
  readonly outcome: SchedulerReceiptOutcome;
  readonly code: SchedulerReceiptCode | SchedulerFailureCategory;
  readonly receiptId: string | null;
  readonly evidenceReference: string | null;
  readonly observedAt: string;
}

export function schedulerConfigurationSha256(value: SchedulerConfigurationProjection): string {
  return sha256(canonicalJson(value));
}

export function schedulerReceiptSha256(value: SchedulerReceiptProjection): string {
  return sha256(canonicalJson(value));
}

export function schedulerDeliveryIdentitySha256(kind: "trigger" | "claimed_deduplication", value: string): string {
  return sha256(canonicalJson(Object.freeze({ kind, value })));
}
