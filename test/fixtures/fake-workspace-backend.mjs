const ZERO_INVENTORY = Object.freeze({ trackedCount: 0, modifiedCount: 0, untrackedCount: 0, ignoredCount: 0 });

function key(request) {
  return `${request.subject.workspaceId}:${request.subject.generation}`;
}

function receipt(request, sequence, externalState, outcome, code) {
  const present = externalState === "reserved" || externalState === "partial" || externalState === "complete" || externalState === "ambiguous";
  const complete = externalState === "complete";
  return Object.freeze({
    contractId: "ato.workspace/v1",
    receiptId: `fake-receipt-${sequence}`,
    operation: request.operation,
    operationId: request.operationId,
    idempotencyKey: request.idempotencyKey,
    adapterId: request.adapterId,
    adapterVersion: request.adapterVersion,
    workspaceId: request.subject.workspaceId,
    generation: request.subject.generation,
    projectRootKey: request.subject.projectRootKey,
    workspaceRootKey: request.subject.workspaceRootKey,
    externalState,
    outcome,
    code,
    canonicalPath: present ? `fake-private-path-${request.subject.workspaceId}` : null,
    repositoryIdentity: complete ? `fake-repository-${request.subject.projectId}` : null,
    registrationIdentity: complete ? `fake-registration-${request.subject.workspaceId}` : null,
    branchReference: complete ? `fake-branch-${request.subject.workspaceId}` : null,
    baseObjectId: complete ? "A".repeat(40) : null,
    headObjectId: complete ? "B".repeat(40) : null,
    pathSafety: complete ? "safe" : present ? "unknown" : "safe",
    ownershipMatch: complete ? true : present ? null : false,
    inventory: ZERO_INVENTORY,
    evidenceReference: `fake-evidence-${sequence}`,
    observedAt: new Date(Date.parse("2026-08-30T12:00:20.000Z") + sequence).toISOString(),
  });
}

export function createFakeWorkspaceBackend() {
  const states = new Map();
  const calls = [];
  let sequence = 0;
  let nextBehavior = null;

  function run(request, normal) {
    sequence += 1;
    calls.push(Object.freeze({ operation: request.operation, operationId: request.operationId, key: key(request) }));
    const behavior = nextBehavior;
    nextBehavior = null;
    if (behavior === "ambiguous") {
      states.set(key(request), "partial");
      return Object.freeze({ ok: true, receipt: receipt(request, sequence, "partial", "ambiguous", "partial") });
    }
    if (behavior === "refused") {
      return Object.freeze({ ok: true, receipt: receipt(request, sequence, "refused", "refused", "refused") });
    }
    if (behavior === "transient") {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          category: "transient_external",
          code: "proven_no_effect",
          retryable: true,
          ambiguous: false,
          retryAfter: null,
          evidenceReference: `fake-evidence-${sequence}`,
        }),
      });
    }
    const result = normal();
    if (behavior === "response_loss") throw new Error("fake response loss");
    if (behavior === "malformed") return Object.freeze({ ok: true, receipt: Object.freeze({ secret: "must-not-persist" }) });
    return result;
  }

  return Object.freeze({
    reserve(request) {
      return run(request, () => {
        const current = states.get(key(request));
        states.set(key(request), "reserved");
        return Object.freeze({
          ok: true,
          receipt: receipt(request, sequence, "reserved", "succeeded", current === "reserved" ? "already_reserved" : "reserved"),
        });
      });
    },
    create(request) {
      return run(request, () => {
        const current = states.get(key(request));
        states.set(key(request), "complete");
        return Object.freeze({
          ok: true,
          receipt: receipt(request, sequence, "complete", "succeeded", current === "complete" ? "already_created" : "created"),
        });
      });
    },
    inspect(request) {
      return run(request, () => {
        const current = states.get(key(request)) ?? "absent";
        const mapping = {
          absent: ["absent", "inspected_absent"],
          reserved: ["reserved", "inspected_reserved"],
          partial: ["partial", "inspected_partial"],
          complete: ["complete", "inspected_complete"],
        };
        const [externalState, code] = mapping[current] ?? ["ambiguous", "ambiguous"];
        return Object.freeze({
          ok: true,
          receipt: receipt(request, sequence, externalState, externalState === "partial" || externalState === "ambiguous" ? "ambiguous" : "succeeded", code),
        });
      });
    },
    recover(request) {
      return run(request, () => {
        const current = states.get(key(request)) ?? "absent";
        const mapping = {
          absent: ["absent", "recovered_absent"],
          reserved: ["reserved", "recovered_reserved"],
          complete: ["complete", "recovered_complete"],
        };
        const [externalState, code] = mapping[current] ?? ["partial", "partial"];
        return Object.freeze({
          ok: true,
          receipt: receipt(request, sequence, externalState, externalState === "partial" ? "ambiguous" : "succeeded", code),
        });
      });
    },
    cleanup(request) {
      return run(request, () => {
        const existed = states.delete(key(request));
        return Object.freeze({
          ok: true,
          receipt: receipt(request, sequence, existed ? "removed" : "absent", "succeeded", existed ? "removed" : "already_absent"),
        });
      });
    },
    failNext(behavior) { nextBehavior = behavior; },
    setExternalState(workspaceId, generation, state) {
      if (!new Set(["absent", "reserved", "partial", "complete"]).has(state)) {
        throw new TypeError("Unsupported fake workspace state");
      }
      const stateKey = `${workspaceId}:${generation}`;
      if (state === "absent") states.delete(stateKey);
      else states.set(stateKey, state);
    },
    calls: () => Object.freeze([...calls]),
    externalState(workspaceId, generation) { return states.get(`${workspaceId}:${generation}`) ?? "absent"; },
  });
}
