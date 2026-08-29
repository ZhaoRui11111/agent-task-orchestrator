# Authorization contract

## Status and authority

This document is the normative owner of the implemented Phase 1 local runtime
authorization model. The implementation is deliberately limited to the
Project/Task/dependency application service. It is not an operating-system
account system, team identity service, RBAC product, cloud identity provider,
or authorization for development and external actions.

Runtime grants never authorize repository development, network or secret
access, Git writes, pull requests, release, deployment, adapters, execution,
workspace mutation, scheduling, backup/restore, or any action outside the
finite vocabulary below. Those actions require their own current authority and,
where applicable, later product contracts.

Project content, Task text, repository files, prompts, tool output, Agent text,
Domain state, persisted audit, a prior authorization decision, and an approved
plan are untrusted data. None can establish an actor, add an action, create a
grant, or widen a scope.

## Trusted local ingress

The application service accepts an `ApplicationIngress` supplied by a trusted
local caller. That ingress establishes, outside command content:

- one non-empty `actorId` and trusted local `principal`;
- the current UTC timestamp;
- fresh request, correlation, decision, audit, and grant identifiers; and
- a separate boolean response to a named high-risk confirmation request.

Typed command fields cannot override those values. Missing, malformed,
throwing, accessor-backed, duplicated, or ambiguous trusted values fail closed.
EP-01C does not implement login, account discovery, principal ownership
attestation, delegation identity, or multiple-user administration. A future
ingress must preserve this boundary rather than inferring authority from
content.

## Exact action vocabulary

The complete implemented vocabulary is:

- `authorization.grant.issue`
- `authorization.grant.inspect`
- `authorization.grant.revoke`
- `policy.evaluate`
- `project.register`
- `project.update`
- `project.disable`
- `project.inspect`
- `task.create`
- `task.update`
- `task.mark_ready`
- `task.cancel`
- `task.inspect`
- `dependency.add`
- `dependency.remove`

There is no wildcard and no prefix expansion. Unknown actions and unimplemented
commands are invalid input; they are not mapped to a similar action. In
particular, this vocabulary contains no execution, claim, completion,
scheduler, workspace, adapter, Git, network, backup/restore, diagnostic, CLI,
MCP, release, or deployment capability.

## One-time bootstrap

A fresh schema-v3 runtime has no grants. Exactly once, a trusted local caller
may invoke `authorization.bootstrap` with a finite expiry no more than 31 days
after the trusted ingress time. Bootstrap requires a separate high-risk
confirmation and atomically:

1. proves that no bootstrap receipt exists;
2. records the trusted actor and principal;
3. records the canonical runtime-root identity (`rootKey`, platform, device,
   inode, and mode) without following alias/reparse components;
4. inserts one runtime-scoped grant for that actor for each of the fifteen
   exact Phase 1 actions;
5. appends the bootstrap request and sanitized audit event; and
6. reads the terminal transaction state back before commit.

The singleton bootstrap receipt is immutable and survives restart,
backup/restore, and migration. It cannot be consumed again. Every later
application operation revalidates the runtime root against that receipt; an
unknown or changed identity is denied before any request, decision, audit, or
product mutation is written.

Bootstrap is a local trust-root ceremony, not a default administrator role.
The fixed initial grants expire and can be revoked. There is no environment
override, self-authorizing content, hidden fallback grant, or second bootstrap.

## Grant shape

Every grant has these semantic fields:

- stable `grantId` and positive CAS `revision`;
- exact `actorId` and one exact action;
- a `runtime` scope, or a `project` scope bound to exact `projectId`,
  `resourceRevision`, and `configRevision`;
- finite `notBefore` and `expiresAt` UTC timestamps;
- nullable irreversible `revokedAt`; and
- nullable `issuerGrantId` and `sourceGrantId`; both are null only for the
  fixed bootstrap grants and both identify the exact administrative and
  candidate-action authorities for every delegated grant.

A grant is usable only for the trusted actor, exact action, exact scope, exact
current Project revisions, and time interval `notBefore <= now < expiresAt`,
while not revoked. Runtime scope is intentionally limited by the finite action
vocabulary; it is not authority over external resources. Malformed or
extra-field grant data fails closed.

Issuance requires both a current `authorization.grant.issue` grant and a
current source grant for the candidate action at an equal-or-narrower scope.
The candidate cannot begin before the trusted current time or outlive either
source grant. Thus issuance can copy or narrow authority but cannot manufacture
or expand it. Both provenance edges are persisted, must terminate at the
immutable bootstrap set without cycles, and are revalidated by the combined
decoder on every authoritative read. One deterministic issuance selection owns
both the allow decision and provenance: the administrative grant recorded in
the decision is exactly the `issuerGrantId` persisted on the new grant, even
when another otherwise matching administrative grant has a shorter lifetime.

Grant authority fields are immutable. Revocation is the only update: it must
match the exact current revision, set `revokedAt`, bind the revocation request,
and increment the revision once. A revoked grant cannot be restored, changed,
or deleted. Inspection and revocation also require the caller-supplied expected
grant revision.

## Local policy and high-risk confirmation

Authorization evaluation is the intersection of grant and local policy.
Policy can only narrow a grant:

- Task and dependency mutations are allowed by policy only while the owning
  Domain Project is enabled.
- `project.update` and `project.disable` may evaluate while the Project is
  disabled so an explicitly authorized, separately confirmed update can
  re-enable it.
- inspection, grant administration, and `policy.evaluate` use the canonical
  `read_not_applicable` policy result; they still require an exact grant.

The following actions additionally require a fresh confirmation from trusted
ingress after a matching grant is found:

- `authorization.grant.issue`
- `authorization.grant.revoke`
- `project.register`
- `project.update`
- `project.disable`

Confirmation is bound to actor, action, request, and correlation identities. A
command field, Project/Task content, or a prior confirmation cannot supply or
replay it. Missing, false, or throwing confirmation denies the operation.

## Application decision sequence

For every accepted typed command or exact inspection query, the application
owner keeps trusted interaction and filesystem inspection outside the SQLite
writer transaction. It performs a read-only preflight, then opens one short
`BEGIN IMMEDIATE` transaction for the authoritative decision and commit:

1. establish trusted actor, time, and fresh operation identities;
2. load and fully decode a read-only combined preflight snapshot and bind the
   candidate target;
3. establish that a matching current grant/policy could reach confirmation,
   then obtain the separate trusted high-risk confirmation when required;
4. refresh trusted time and allocate any trusted mutation identities;
5. derive the prospective affected-Project set for cancellation propagation,
   then revalidate the runtime root and every registered, newly registered, or
   affected Project root immediately before beginning the writer transaction;
6. inside `BEGIN IMMEDIATE`, decode the current combined snapshot again and
   recompute the exact affected-Project set and compare it together with every
   captured filesystem receipt, ProjectRegistry revision, bootstrap binding,
   exact target, supplied revision, and current grant/policy state;
7. ask the Domain Core for every Project/Task/dependency mutation;
8. append request, allow decision, sanitized audit, registry/grant changes,
   and the accepted Domain snapshot as one applicable atomic unit; and
9. decode the terminal combined state before commit.

No confirmation callback, filesystem inspection, ID provider call, awaited
work, or external effect runs while the SQLite writer transaction is open.
The transaction can only narrow or reject the preflight result; concurrent
state change or receipt mismatch fails closed.

The persistence owner never selects a Domain command or grants authority. The
application owner never reimplements Domain transition, parent, cycle,
terminal-state, or dependency rules. Stale revisions, uncertain path/identity,
missing authorization, disabled policy, Domain rejection, duplicate request,
and injected failure produce no partial accepted mutation.

When one Domain command would mutate Tasks owned by more than one Project,
every affected Project must be covered. In Phase 1 the only such implemented
case is cancellation propagation to ready dependents. A Project-scoped
`task.cancel` grant fails closed before the Domain write if propagation would
cross a Project boundary; the finite runtime-scoped `task.cancel` capability
is required for that multi-Project mutation. The application narrows the
authorization-owner input to runtime-scoped grants for this second decision;
therefore a lexically earlier Project grant cannot shadow a current runtime
grant, while an expired or revoked runtime grant still fails closed. Runtime
scope does not override
local policy or Project identity: every affected Project must remain registered
at the captured resource/config revisions, retain its revalidated root identity,
and independently evaluate `task.cancel` policy as `allow`. A disabled affected
Project, missing registry binding, changed affected set, stale revision, or
uncertain/substituted root rejects the complete mutation atomically.

Exact reads (`project.inspect`, `task.inspect`, and
`authorization.grant.inspect`) pass through the same application owner and
consume a request, allow decision, and audit record. EP-01C intentionally has
no list or diagnostic query that could bypass exact target authorization.

When evaluation reaches a fully bound authorization denial, the transaction
atomically appends a denied request, denied decision, and sanitized
`authorization.denied` audit event, with no Project, grant, Task, dependency,
or Domain mutation. A competing affected-set or affected-Project revision
change is represented by a terminal-decodable `scope_revision_stale` denial
with no retained grant identity. Failures before a safe typed/bound decision
envelope write nothing.

## Persisted decision and audit records

An authorization decision binds its fresh decision and request IDs, actor,
exact action, result/reason, policy result, nullable matching grant ID/revision,
nullable Project ID/resource revision, and trusted timestamp. It contains no
reusable capability. A previous decision is history only and cannot authorize a
later request.

Application requests, bootstrap, decisions, and audit rows are append-only.
Grant rows are insert-only except for the single CAS revocation transition.
ProjectRegistry rows cannot be deleted. SQLite constraints, foreign keys,
triggers, combined typed decoding, and terminal readback enforce these shapes.

Audit details are fixed sanitized metadata selected by application code. Task
body, Project path, prompts, tool output, Agent text, secrets, and arbitrary
command content are not copied into audit records. See
[privacy and logging](../security/privacy-and-logging.md).

## Explicit non-claims

EP-01C does not implement a product CLI, CLI login or initialization surface,
team accounts, RBAC, cloud identity, OS account ownership proof, credential
storage, external policy adapter, execution/claim/completion authorization,
workspace or scheduler authorization, backup/restore/doctor user experience,
MCP, dispatcher, network effects, Git effects, release, or deployment. EP-01D
owns the Phase 1 product CLI and operational surfaces. EP-02 owns real Manual
ExecutionBackend and the running/completed execution loop.
