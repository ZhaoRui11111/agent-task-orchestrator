# Authorization contract

## Status and authority

This document is the normative owner of the implemented Phase 1 local runtime
authorization model. The implementation is deliberately limited to the local
Phase 1 application and lifecycle surfaces. It is not an operating-system
account system, team identity service, RBAC product, cloud identity provider,
or authorization for development and external actions.

Runtime grants never authorize repository development, network or secret
access, Git writes, pull requests, release, deployment, adapters, execution,
workspace mutation, scheduling, arbitrary filesystem access, or any action
outside the finite vocabulary below. The `runtime.backup` and `runtime.restore`
actions authorize only the implemented local persistence lifecycle through the
exact application handoff described below; they grant no external or general
file authority.

Project content, Task text, repository files, prompts, tool output, Agent text,
Domain state, persisted audit, a prior authorization decision, and an approved
plan are untrusted data. None can establish an actor, add an action, create a
grant, or widen a scope.

## Trusted local ingress

The application service accepts an `ApplicationIngress` supplied by a trusted
local caller. The product CLI implements that boundary from the verified
runtime-root identity and canonical local OS user information. It hashes the
platform, normalized username, numeric uid/gid, and root identity into one
versioned local actor/principal binding; raw identity fields are not persisted
or exposed. The ingress establishes, outside command content:

- one non-empty `actorId` and trusted local `principal`;
- the current UTC timestamp;
- fresh request, correlation, decision, audit, and grant identifiers; and
- a separate boolean response to a named high-risk confirmation request.

Typed command fields cannot override those values. Missing, malformed,
throwing, accessor-backed, duplicated, or ambiguous trusted values fail closed.
This is local identity derivation, not login, credential verification, team
account discovery, delegation identity, or multiple-user administration. If OS
identity or runtime-root identity is unavailable, ambiguous, changed, or
noncanonical, local ingress fails closed rather than accepting actor content.

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
- `authorization.grant.list`
- `runtime.status`
- `runtime.backup`
- `runtime.restore`

There is no wildcard and no prefix expansion. Unknown actions and unimplemented
commands are invalid input; they are not mapped to a similar action. In
particular, this vocabulary contains no execution, claim, completion,
scheduler, workspace, adapter, Git, network, secret, arbitrary diagnostic,
arbitrary CLI/filesystem, MCP, release, or deployment capability.

## One-time bootstrap

A fresh schema-v4 runtime has no grants. Exactly once, a trusted local caller
may invoke `authorization.bootstrap` with a finite expiry no more than 31 days
after the trusted ingress time. Bootstrap requires a separate high-risk
confirmation and atomically:

1. proves that no bootstrap receipt exists;
2. records the trusted actor and principal;
3. records the canonical runtime-root identity (`rootKey`, platform, device,
   inode, and mode) without following alias/reparse components;
4. inserts the immutable versioned local actor/principal-to-root binding;
5. inserts one runtime-scoped grant for that actor for each of the nineteen
   exact Phase 1 actions;
6. appends the bootstrap request and sanitized audit event; and
7. reads the terminal transaction state back before commit.

The singleton bootstrap receipt is immutable and survives restart,
backup/restore, and migration. It cannot be consumed again. Every later
application operation revalidates the runtime root against that receipt; an
unknown or changed identity is denied before any request, decision, audit, or
product mutation is written.

Bootstrap is a local trust-root ceremony, not a default administrator role.
The fixed initial grants expire and can be revoked. There is no environment
override, self-authorizing content, hidden fallback grant, or second bootstrap.

## Local identity adoption and capability epochs

`authorization.capability.renew` is a non-grantable local trust-root
maintenance transition. It is not part of the nineteen-action vocabulary and
cannot be delegated. It requires the exact current OS-derived identity,
runtime-root identity, a fresh named confirmation, a finite expiry more than
seven and no more than 31 days ahead, and one atomic terminal readback.

An upgraded schema-v3 bootstrap must be adopted through that transition before
any ordinary command. Adoption preserves the immutable legacy bootstrap and
grants as history, establishes the schema-v4 local identity, and appends the
first immutable capability epoch plus nineteen new origin grants. A native
schema-v4 bootstrap already establishes local identity and needs no adoption.

After adoption or native bootstrap, renewal is eligible only when the current
origin expires within seven days or has expired. Revocation of any still-current
origin grant blocks early renewal; revocation is not a shortcut to replace a
capability. Each accepted renewal appends a contiguous positive epoch revision,
the exact vocabulary/version digest, a request/decision/audit unit, and nineteen
new finite origin grants. Previous epochs and grants remain immutable history.
Concurrent state or epoch changes fail atomically as stale.

## Grant shape

Every grant has these semantic fields:

- stable `grantId` and positive CAS `revision`;
- exact `actorId` and one exact action;
- a `runtime` scope, or a `project` scope bound to exact `projectId`,
  `resourceRevision`, and `configRevision`;
- finite `notBefore` and `expiresAt` UTC timestamps;
- nullable irreversible `revokedAt`; and
- nullable `issuerGrantId`, `sourceGrantId`, and `capabilityEpochId` in one
  exclusive provenance shape: all three null for fixed bootstrap grants;
  non-null issuer/source with a null epoch for delegated grants; or a non-null
  immutable epoch with null issuer/source for renewed/adopted origin grants.

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
- `runtime.restore`

Capability adoption/renewal also requires a fresh high-risk confirmation even
though it is deliberately not a grantable action.

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
8. append request, allow decision, sanitized audit, applicable
   registry/grant/epoch/lifecycle changes, and the accepted Domain snapshot as
   one applicable atomic unit; and
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
`authorization.grant.inspect`), bounded actor-local grant listing, and runtime
status pass through the same application owner and consume a request, allow
decision, and audit record. Listing is ordered, cursor-based, bounded to at most
100 rows, and never includes another actor's grants. The grant-independent
doctor surface is not an application query: the persistence contract limits it
to a closed, read-only, redacted health classification.

When evaluation reaches a fully bound authorization denial, the transaction
atomically appends a denied request, denied decision, and sanitized
`authorization.denied` audit event, with no Project, grant, Task, dependency,
or Domain mutation. A competing affected-set or affected-Project revision
change is represented by a terminal-decodable `scope_revision_stale` denial
with no retained grant identity. Failures before a safe typed/bound decision
envelope write nothing.

## Backup and restore authorization handoff

`runtime.backup` and `runtime.restore` first pass through the same application
decision sequence. Restore additionally requires its named high-risk
confirmation at this layer; the CLI separately requires the exact current
data-loss acknowledgement before requesting authorization. An accepted
decision atomically appends one immutable lifecycle authorization bound to the
exact operation, proposed backup generation ID, actor, runtime-root key,
matching grant and revision, request/decision/audit IDs and counts, application
state digest, and short finite validity interval. Terminal output reads back the
exact newly allocated lifecycle authorization ID; operation/generation matching
is never used as a non-unique substitute, including on a retry.

For restore, application evaluation and this durable handoff precede backup
inventory or selected-generation verification. Revoked, expired, missing, and
pre-adoption authority therefore receives the same denial for valid, absent, or
corrupt generation material.

The persistence owner accepts only that closed typed handoff. It re-decodes the
complete application state and rejects an absent, substituted, expired, revoked,
wrong-operation, wrong-generation, stale-count, or changed-state handoff before
publishing a backup or a restore intent. This record cannot authorize any other
generation or filesystem operation. Persistence remains the sole owner of
lifecycle locks, connection receipts, backup verification, restore staging,
publication, and recovery classification.

## Persisted decision and audit records

An authorization decision binds its fresh decision and request IDs, actor,
exact action, result/reason, policy result, nullable matching grant ID/revision,
nullable Project ID/resource revision, and trusted timestamp. It contains no
reusable capability. A previous decision is history only and cannot authorize a
later request.

Application requests, bootstrap, local identity, capability epochs, lifecycle
authorizations, decisions, and audit rows are append-only. Grant rows are
insert-only except for the single CAS revocation transition. ProjectRegistry
rows cannot be deleted. SQLite constraints, foreign keys, triggers, combined
typed decoding, and terminal readback enforce these shapes.

Audit details are fixed sanitized metadata selected by application code. Task
body, Project path, prompts, tool output, Agent text, secrets, and arbitrary
command content are not copied into audit records. See
[privacy and logging](../security/privacy-and-logging.md).

## Explicit non-claims

Phase 1 implements the local CLI initialization, finite grant administration,
status, backup authorization, separately confirmed restore authorization, and
read-only doctor experience. It does not implement login, credentials, team
accounts, RBAC, cloud identity, an external policy adapter,
execution/claim/completion authorization, workspace or scheduler authorization,
MCP, dispatcher, network effects, Git effects, release, deployment, or a
platform-support claim. EP-02, not this contract, owns any real Manual
ExecutionBackend and running/completed execution loop.
