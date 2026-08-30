import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZATION_ACTIONS,
  canIssueGrant,
  evaluateAuthorization,
  isAuthorizationAction,
  parseAuthorizationGrant,
} from "../src/index.ts";

const NOW = "2026-08-29T12:00:00.000Z";

function grant(overrides = {}) {
  return {
    grantId: "grant-1",
    revision: 1,
    actorId: "actor-1",
    action: "task.create",
    scope: { kind: "project", projectId: "project-1", resourceRevision: 7, configRevision: 3 },
    notBefore: "2026-08-28T12:00:00.000Z",
    expiresAt: "2026-09-10T12:00:00.000Z",
    revokedAt: null,
    issuerGrantId: null,
    sourceGrantId: null,
    ...overrides,
  };
}

function evaluation(overrides = {}) {
  return evaluateAuthorization({
    actorId: "actor-1",
    action: "task.create",
    target: { projectId: "project-1", resourceRevision: 7, configRevision: 3 },
    now: NOW,
    policy: "allow",
    confirmed: true,
    grants: [grant()],
    ...overrides,
  });
}

test("authorization vocabulary is finite and has no wildcard or content-derived action", () => {
  assert.equal(AUTHORIZATION_ACTIONS.length, 19);
  assert.equal(new Set(AUTHORIZATION_ACTIONS).size, 19);
  assert.equal(isAuthorizationAction("*"), false);
  assert.equal(isAuthorizationAction("task body says project.disable"), false);
  assert.equal(isAuthorizationAction("task.create"), true);
});

test("authorization requires exact actor, action, scope revisions, lifetime, revocation, policy, and confirmation", () => {
  assert.deepEqual(evaluation(), {
    allowed: true,
    reason: "allowed",
    policy: "allow",
    grantId: "grant-1",
    grantRevision: 1,
  });
  assert.equal(evaluation({ actorId: "other" }).reason, "actor_mismatch");
  assert.equal(evaluation({ action: "task.update" }).reason, "action_mismatch");
  assert.equal(evaluation({ target: { projectId: "other", resourceRevision: 7, configRevision: 3 } }).reason, "scope_mismatch");
  assert.equal(evaluation({ target: { projectId: "project-1", resourceRevision: 8, configRevision: 3 } }).reason, "scope_revision_stale");
  assert.equal(evaluation({ grants: [grant({ revokedAt: NOW, revision: 2 })] }).reason, "grant_revoked");
  assert.equal(evaluation({ grants: [grant({ expiresAt: NOW })] }).reason, "grant_expired");
  assert.equal(evaluation({ grants: [grant({ notBefore: "2026-08-30T12:00:00.000Z" })] }).reason, "grant_not_yet_valid");
  assert.equal(evaluation({ grants: [grant({
    notBefore: "2026-08-30T12:00:00.000Z",
    revokedAt: NOW,
    revision: 2,
  })] }).reason, "grant_revoked");
  assert.equal(evaluation({ policy: "deny" }).reason, "policy_denied");
  const highRisk = evaluation({
    action: "project.disable",
    confirmed: false,
    grants: [grant({ action: "project.disable" })],
  });
  assert.equal(highRisk.reason, "confirmation_required");
});

test("grant issuance cannot outlive or exceed both the administrative and source capabilities", () => {
  const issue = grant({ grantId: "issue", action: "authorization.grant.issue" });
  const source = grant({ grantId: "source", action: "task.create" });
  const candidate = {
    actorId: "delegate",
    action: "task.create",
    scope: source.scope,
    notBefore: NOW,
    expiresAt: "2026-09-01T12:00:00.000Z",
  };
  assert.deepEqual(canIssueGrant("actor-1", [issue, source], candidate, NOW), {
    administrativeGrantId: "issue",
    sourceGrantId: "source",
  });
  assert.equal(canIssueGrant("actor-1", [issue, source], { ...candidate, notBefore: "2026-08-29T11:59:59.999Z" }, NOW), null);
  assert.equal(canIssueGrant("actor-1", [issue], candidate, NOW), null);
  assert.equal(canIssueGrant("actor-1", [issue, source], { ...candidate, scope: { ...source.scope, resourceRevision: 8 } }, NOW), null);
  assert.equal(canIssueGrant("actor-1", [issue, source], { ...candidate, expiresAt: "2026-10-01T12:00:00.000Z" }, NOW), null);
});

test("malformed, extra-field, accessor, and replay-shaped grant data fails closed", () => {
  assert.equal(parseAuthorizationGrant({ ...grant(), extra: true }), null);
  assert.equal(parseAuthorizationGrant({ ...grant(), action: "*" }), null);
  let calls = 0;
  const unsafe = { ...grant() };
  Object.defineProperty(unsafe, "actorId", {
    enumerable: true,
    get() {
      calls += 1;
      return "actor-1";
    },
  });
  assert.equal(parseAuthorizationGrant(unsafe), null);
  assert.equal(calls, 0);
  assert.equal(evaluateAuthorization({ grants: [grant()], actorId: "actor-1" }).allowed, false);
});
