import { createHash } from "node:crypto";
import {
  PROJECT_POLICY_CONTRACT_ID,
  PROJECT_POLICY_OPERATIONS,
  parseProjectPolicyRequest,
  parseProjectPolicyResult,
  type PolicyGateRequirement,
  type ProjectPolicy,
  type ProjectPolicyDecision,
  type ProjectPolicyFacts,
  type ProjectPolicyOperation,
  type ProjectPolicyRequest,
  type ProjectPolicyResult,
} from "./project-policy-port.ts";

export const LOCAL_PROJECT_POLICY_ADAPTER_ID = "local-project-policy" as const;
export const LOCAL_PROJECT_POLICY_ADAPTER_VERSION = "1.0.0" as const;

export interface LocalProjectPolicyDecisionConfiguration {
  readonly decision: ProjectPolicyDecision;
  readonly reasonCode: string;
}

export interface LocalProjectPolicyConfigurationEntry {
  readonly policyId: string;
  readonly policyKey: string;
  readonly configRevision: number;
  readonly decisions: Readonly<Record<ProjectPolicyOperation, LocalProjectPolicyDecisionConfiguration>>;
  readonly facts: ProjectPolicyFacts;
  readonly receiptValiditySeconds: number;
}

export interface LocalProjectPolicyConfiguration {
  readonly policies: readonly LocalProjectPolicyConfigurationEntry[];
}

export interface LocalProjectPolicyIngress {
  now(): string;
}

export interface LocalProjectPolicyAdapter extends ProjectPolicy {
  readonly description: Readonly<{
    readonly contractId: typeof PROJECT_POLICY_CONTRACT_ID;
    readonly adapterId: typeof LOCAL_PROJECT_POLICY_ADAPTER_ID;
    readonly adapterVersion: typeof LOCAL_PROJECT_POLICY_ADAPTER_VERSION;
    readonly policyCount: number;
  }>;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalValue(value)), "utf8").digest("hex").toUpperCase();
}

function identifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.normalize("NFC") && !/[\u0000-\u001f\u007f]/u.test(value);
}

function timestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function copyGate(value: PolicyGateRequirement): PolicyGateRequirement {
  if (!identifier(value.gateId) || !identifier(value.gateVersion) || !identifier(value.commandKey) ||
      !/^[0-9A-F]{64}$/u.test(value.commandIdentitySha256) ||
      !/^[0-9A-F]{64}$/u.test(value.toolEnvironmentSha256) ||
      !(value.validForSeconds === null || (Number.isSafeInteger(value.validForSeconds) && value.validForSeconds > 0 && value.validForSeconds <= 86_400))) {
    throw new TypeError("Local ProjectPolicy gate configuration is invalid");
  }
  return Object.freeze({ ...value });
}

function copyFacts(value: ProjectPolicyFacts): ProjectPolicyFacts {
  if (!Array.isArray(value.requiredGates) || value.requiredGates.length > 32 ||
      (value.integration !== "required" && value.integration !== "not_required") ||
      (value.preservation !== "required" && value.preservation !== "not_required") ||
      (value.cleanup !== "allowed_after_completion" && value.cleanup !== "prohibited") ||
      (value.preservation === "required" && value.integration !== "required")) {
    throw new TypeError("Local ProjectPolicy facts configuration is invalid");
  }
  const requiredGates = Object.freeze(value.requiredGates.map(copyGate));
  if (new Set(requiredGates.map((gate) => `${gate.gateId}\u0000${gate.gateVersion}`)).size !== requiredGates.length) {
    throw new TypeError("Local ProjectPolicy gate identity is duplicated");
  }
  return Object.freeze({ requiredGates, integration: value.integration, preservation: value.preservation, cleanup: value.cleanup });
}

function copyEntry(value: LocalProjectPolicyConfigurationEntry): LocalProjectPolicyConfigurationEntry {
  if (!identifier(value.policyId) || !identifier(value.policyKey) || !Number.isSafeInteger(value.configRevision) ||
      value.configRevision < 1 || !Number.isSafeInteger(value.receiptValiditySeconds) ||
      value.receiptValiditySeconds < 1 || value.receiptValiditySeconds > 300) {
    throw new TypeError("Local ProjectPolicy identity configuration is invalid");
  }
  const decisionEntries = PROJECT_POLICY_OPERATIONS.map((operation) => {
    const decision = value.decisions[operation];
    if (decision === undefined || !identifier(decision.reasonCode, 64) ||
        (decision.decision !== "allow" && decision.decision !== "deny" && decision.decision !== "defer")) {
      throw new TypeError("Local ProjectPolicy decision configuration is invalid");
    }
    return [operation, Object.freeze({ ...decision })] as const;
  });
  return Object.freeze({
    policyId: value.policyId,
    policyKey: value.policyKey,
    configRevision: value.configRevision,
    decisions: Object.freeze(Object.fromEntries(decisionEntries)) as Readonly<Record<ProjectPolicyOperation, LocalProjectPolicyDecisionConfiguration>>,
    facts: copyFacts(value.facts),
    receiptValiditySeconds: value.receiptValiditySeconds,
  });
}

function failure(category: "invalid_request" | "incompatible_contract" | "not_found" | "integrity_failure", code: string): ProjectPolicyResult {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      category,
      code,
      retryable: false,
      ambiguous: category === "integrity_failure",
      retryAfter: null,
      evidenceReference: null,
    }),
  });
}

export function createLocalProjectPolicy(
  configuration: LocalProjectPolicyConfiguration,
  ingress: LocalProjectPolicyIngress = Object.freeze({ now: () => new Date().toISOString() }),
): LocalProjectPolicyAdapter {
  if (typeof configuration !== "object" || configuration === null || !Array.isArray(configuration.policies) ||
      configuration.policies.length === 0 || configuration.policies.length > 32 || typeof ingress.now !== "function") {
    throw new TypeError("Local ProjectPolicy configuration is invalid");
  }
  const policies = Object.freeze(configuration.policies.map(copyEntry));
  if (new Set(policies.map((policy) => `${policy.policyId}\u0000${policy.policyKey}\u0000${policy.configRevision}`)).size !== policies.length) {
    throw new TypeError("Local ProjectPolicy configuration identity is duplicated");
  }

  const dispatch = (value: unknown, expectedOperation: ProjectPolicyOperation): ProjectPolicyResult => {
    const request = parseProjectPolicyRequest(value);
    if (request === null || request.operation !== expectedOperation) return failure("invalid_request", "policy_request_invalid");
    if (request.adapterId !== LOCAL_PROJECT_POLICY_ADAPTER_ID || request.adapterVersion !== LOCAL_PROJECT_POLICY_ADAPTER_VERSION) {
      return failure("incompatible_contract", "policy_adapter_mismatch");
    }
    const configured = policies.find((policy) => policy.policyId === request.policyId &&
      policy.policyKey === request.policyKey && policy.configRevision === request.policyConfigRevision);
    if (configured === undefined) return failure("not_found", "policy_configuration_absent");
    const observedAt = ingress.now();
    if (!timestamp(observedAt)) return failure("integrity_failure", "policy_clock_invalid");
    const decision = configured.decisions[request.operation];
    const identityDigest = sha256({ request, decision, facts: configured.facts, observedAt });
    const validUntil = decision.decision === "allow"
      ? new Date(new Date(observedAt).valueOf() + configured.receiptValiditySeconds * 1000).toISOString()
      : null;
    const candidate = Object.freeze({
      ok: true as const,
      receipt: Object.freeze({
        contractId: PROJECT_POLICY_CONTRACT_ID,
        receiptId: `policy-receipt:${identityDigest}`,
        operation: request.operation,
        policyQueryId: request.policyQueryId,
        correlationId: request.correlationId,
        actorId: request.actorId,
        preliminaryAuthorizationDecisionId: request.preliminaryAuthorizationDecisionId,
        requestedAction: request.requestedAction,
        policyId: request.policyId,
        policyKey: request.policyKey,
        policyConfigRevision: request.policyConfigRevision,
        adapterId: LOCAL_PROJECT_POLICY_ADAPTER_ID,
        adapterVersion: LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
        subject: request.subject,
        decision: decision.decision,
        reasonCode: decision.reasonCode,
        facts: configured.facts,
        validUntil,
        evidenceReference: `policy-evidence:${identityDigest}`,
        observedAt,
      }),
    });
    return parseProjectPolicyResult(candidate, request) ?? failure("integrity_failure", "policy_receipt_invalid");
  };

  return Object.freeze({
    description: Object.freeze({
      contractId: PROJECT_POLICY_CONTRACT_ID,
      adapterId: LOCAL_PROJECT_POLICY_ADAPTER_ID,
      adapterVersion: LOCAL_PROJECT_POLICY_ADAPTER_VERSION,
      policyCount: policies.length,
    }),
    evaluateMutation: (request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "evaluate_mutation" }>>) =>
      dispatch(request, "evaluate_mutation"),
    completionRequirements: (request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "completion_requirements" }>>) =>
      dispatch(request, "completion_requirements"),
    evaluateIntegration: (request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "evaluate_integration" }>>) =>
      dispatch(request, "evaluate_integration"),
    evaluateCleanup: (request: Extract<ProjectPolicyRequest, Readonly<{ readonly operation: "evaluate_cleanup" }>>) =>
      dispatch(request, "evaluate_cleanup"),
  });
}
