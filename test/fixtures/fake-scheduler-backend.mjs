import {
  SCHEDULER_CONTRACT_ID,
  parseSchedulerBackendRequest,
} from "../../src/scheduler-port.ts";

function key(scheduleId, configRevision) {
  return `${scheduleId}:${configRevision}`;
}

function failure(category, code, evidenceReference = null) {
  const retryable = new Set(["busy", "rate_limited", "resource_exhausted", "transient_external"]).has(category);
  const ambiguous = new Set(["ambiguous_external_state", "integrity_failure"]).has(category);
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      category,
      code,
      retryable,
      ambiguous,
      retryAfter: null,
      evidenceReference,
    }),
  });
}

let backendSequence = 0;

export function createFakeSchedulerBackend() {
  const backendId = ++backendSequence;
  const registrations = new Map();
  const calls = [];
  let sequence = 0;
  let nextBehavior = null;

  function receipt(request, externalState, outcome, code) {
    sequence += 1;
    const present = externalState === "present";
    const registration = registrations.get(key(request.scheduleId, request.configRevision));
    return Object.freeze({
      ok: true,
      receipt: Object.freeze({
        contractId: SCHEDULER_CONTRACT_ID,
        receiptId: `scheduler-receipt-${backendId}-${sequence}`,
        operation: request.operation,
        operationId: request.operationId,
        scheduleId: request.scheduleId,
        configRevision: request.configRevision,
        externalRegistrationId: present ? registration?.externalRegistrationId ?? `external-${request.scheduleId}-${request.configRevision}` : null,
        externalState,
        outcome,
        code,
        enabled: present ? registration?.enabled ?? true : null,
        nextTriggerAt: present ? registration?.nextTriggerAt ?? "2026-09-04T20:00:00.000Z" : null,
        evidenceReference: `scheduler-evidence-${backendId}-${sequence}`,
        observedAt: new Date(Date.parse("2026-09-04T19:00:00.000Z") + sequence).toISOString(),
      }),
    });
  }

  function invoke(value, operation) {
    const request = parseSchedulerBackendRequest(value);
    if (request === null || request.operation !== operation) return failure("invalid_request", "fake_invalid_request");
    calls.push(Object.freeze({ operation, operationId: request.operationId, scheduleId: request.scheduleId, configRevision: request.configRevision }));
    const behavior = nextBehavior;
    nextBehavior = null;
    if (behavior === "malformed") return Object.freeze({ ok: true, receipt: Object.freeze({ secret: "must-not-persist" }) });
    if (behavior === "ambiguous") return receipt(request, "ambiguous", "ambiguous", "ambiguous");
    if (behavior === "transient") return failure("transient_external", "fake_transient", `scheduler-evidence-${backendId}-${sequence + 1}`);
    if (behavior === "refused") {
      return operation === "register"
        ? receipt(request, "absent", "refused", "refused")
        : operation === "remove"
          ? receipt(request, "present", "refused", "still_present")
          : failure("permanent_external", "fake_inspect_refused", `scheduler-evidence-${backendId}-${sequence + 1}`);
    }
    return Object.freeze({ request, behavior });
  }

  return Object.freeze({
    register(value) {
      const invoked = invoke(value, "register");
      if (!("request" in invoked)) return invoked;
      const { request, behavior } = invoked;
      const stateKey = key(request.scheduleId, request.configRevision);
      const existed = registrations.has(stateKey);
      registrations.set(stateKey, Object.freeze({
        externalRegistrationId: `external-${request.scheduleId}-${request.configRevision}`,
        enabled: true,
        nextTriggerAt: "2026-09-04T20:00:00.000Z",
      }));
      if (behavior === "response_loss") throw new Error("fake scheduler response loss");
      return receipt(request, "present", "succeeded", existed ? "already_registered" : "registered");
    },
    inspect(value) {
      const invoked = invoke(value, "inspect");
      if (!("request" in invoked)) return invoked;
      const { request } = invoked;
      const present = registrations.has(key(request.scheduleId, request.configRevision));
      return present
        ? receipt(request, "present", "succeeded", "inspected_present")
        : receipt(request, "absent", "succeeded", "inspected_absent");
    },
    remove(value) {
      const invoked = invoke(value, "remove");
      if (!("request" in invoked)) return invoked;
      const { request, behavior } = invoked;
      const existed = registrations.delete(key(request.scheduleId, request.configRevision));
      if (behavior === "response_loss") throw new Error("fake scheduler response loss");
      return receipt(request, "absent", "succeeded", existed ? "removed" : "already_absent");
    },
    failNext(behavior) {
      if (!new Set(["ambiguous", "malformed", "refused", "response_loss", "transient"]).has(behavior)) {
        throw new TypeError("Unsupported fake scheduler behavior");
      }
      nextBehavior = behavior;
    },
    setPresent(scheduleId, configRevision, present) {
      const stateKey = key(scheduleId, configRevision);
      if (!present) registrations.delete(stateKey);
      else registrations.set(stateKey, Object.freeze({
        externalRegistrationId: `external-${scheduleId}-${configRevision}`,
        enabled: true,
        nextTriggerAt: "2026-09-04T20:00:00.000Z",
      }));
    },
    calls: () => Object.freeze([...calls]),
    isPresent: (scheduleId, configRevision) => registrations.has(key(scheduleId, configRevision)),
  });
}
