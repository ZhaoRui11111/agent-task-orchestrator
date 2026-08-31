import assert from "node:assert/strict";
import test from "node:test";
import { createLocalProductIngress } from "../src/persistence/local-ingress.ts";

const identity = Object.freeze({
  identityVersion: 1,
  actorId: `local-v1:${"A".repeat(64)}`,
  principalSha256: "B".repeat(64),
  platform: "win32",
  runtimeRootKey: "runtime-root-key",
});

test("trusted local product ingress derives stable execution and fresh dispatcher owners and binds confirmations", () => {
  let sequence = 0;
  const ingress = createLocalProductIngress(identity, {
    confirmation: "RECORD MANUAL OUTCOME",
    expectedConfirmation: "RECORD MANUAL OUTCOME",
    expectedAction: null,
    expectedProductAction: "manual.turn.report",
    now: () => "2026-08-30T12:00:00.000Z",
    nextId: () => `trusted-id-${++sequence}`,
  });
  const restarted = createLocalProductIngress(identity, {
    confirmation: null,
    expectedConfirmation: null,
    expectedAction: null,
    expectedProductAction: null,
    now: () => "2026-08-30T12:00:00.000Z",
  });
  assert.match(ingress.currentLeaseOwner(), /^owner-v1:[0-9A-F]{64}$/u);
  assert.equal(ingress.currentLeaseOwner(), ingress.currentLeaseOwner());
  assert.equal(ingress.currentLeaseOwner(), restarted.currentLeaseOwner());
  assert.match(ingress.currentDispatcherOwner(), /^dispatcher-v1:[0-9A-F]{64}$/u);
  assert.equal(ingress.currentDispatcherOwner(), ingress.currentDispatcherOwner());
  assert.notEqual(ingress.currentDispatcherOwner(), restarted.currentDispatcherOwner());
  assert.equal(ingress.currentRuntimeRootKey(), identity.runtimeRootKey);
  assert.deepEqual(ingress.currentActor(), { actorId: identity.actorId, principal: identity.principalSha256 });
  assert.deepEqual(ingress.confirmOperation({
    actorId: identity.actorId,
    action: "manual.turn.report",
    requestId: "request-one",
    correlationId: "correlation-one",
  }), { confirmationId: "trusted-id-1" });
  assert.equal(ingress.confirmOperation({
    actorId: identity.actorId,
    action: "execution.completion.accept",
    requestId: "request-two",
    correlationId: "correlation-two",
  }), null);
  assert.equal(ingress.confirmOperation({
    actorId: "forged-actor",
    action: "manual.turn.report",
    requestId: "request-three",
    correlationId: "correlation-three",
  }), null);
});
