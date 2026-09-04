import {
  CODEX_EXECUTION_ENDPOINT_VERSION,
  EXECUTION_CONTRACT_ID,
  type ExecutionStartReceipt,
} from "../execution-port.ts";
import type { CodexBackendTurnRecord } from "./application-repository-model.ts";
import { canonicalJson, sha256 } from "./values.ts";

export interface CodexTerminalReceiptSource {
  readonly receiptId: string;
  readonly correlationId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly observedExecutionId: string;
  readonly operationId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly operation: "start" | "resume";
  readonly turn: CodexBackendTurnRecord;
}

export function codexTerminalReceiptProjection(
  source: CodexTerminalReceiptSource,
): Omit<ExecutionStartReceipt, "integritySha256"> {
  return Object.freeze({
    receiptId: source.receiptId,
    contractId: EXECUTION_CONTRACT_ID,
    correlationId: source.correlationId,
    adapterId: source.adapterId,
    adapterVersion: source.adapterVersion,
    backendKind: "codex-sdk" as const,
    observedEndpointVersion: CODEX_EXECUTION_ENDPOINT_VERSION,
    observedExecutionId: source.observedExecutionId,
    outcome: "succeeded" as const,
    code: source.turn.code,
    observedAt: source.turn.updatedAt,
    validUntil: null,
    evidenceReference: source.turn.evidenceReference,
    observationNumber: source.turn.revision,
    operationId: source.operationId,
    intentId: source.intentId,
    idempotencyKey: source.idempotencyKey,
    observedPreRevision: null,
    observedPostRevision: source.turn.revision,
    operation: source.operation,
    backendExecutionId: source.turn.backendExecutionId,
    threadId: source.turn.threadId,
    lifecycle: "started" as const,
    workspaceMode: "owned" as const,
  });
}

export function codexTerminalReceiptSha256(source: CodexTerminalReceiptSource): string {
  return sha256(canonicalJson(codexTerminalReceiptProjection(source)));
}
