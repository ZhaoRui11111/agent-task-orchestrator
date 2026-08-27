# Authorization contract

## Status and authority

This file is the sole normative owner of the planned runtime grant model and
every fail-closed pre-mutation decision that combines actor, action, scope,
resource revision, domain eligibility, resource ownership, and Project policy.
No runtime authorization service, identity provider, or grant store exists
today.

This runtime contract does not authorize repository development, network
access, secrets, Git publication, release, deployment, or modification of any
external repository. Those actions still require the user's explicit authority
at the time they are performed.

## Actor identity

An `actor_id` is a stable, non-empty identity established by a trusted local
ingress before application code runs. Actor kinds are `human`, `scheduler`,
`service`, and `adapter`. A display name, prompt text, Task author, operating
system process name, adapter payload, or Project content cannot assert an actor
identity.

Delegation is explicit: a service acting for a human records both service
`actor_id` and `delegated_by_actor_id`, and its effective permissions are the
intersection of the service grant and delegation grant. Unknown, missing,
conflicting, or unverifiable identity is denied.

## Action vocabulary

The initial exact action vocabulary is:

`authorization.grant.issue`, `authorization.grant.revoke`, `policy.evaluate`,
`project.register`, `project.update`, `project.disable`, `task.create`,
`task.update`, `task.mark_ready`, `task.cancel`, `dependency.add`,
`dependency.remove`, `scheduler.register`, `scheduler.inspect`,
`scheduler.remove`, `dispatch.run`, `execution.claim`, `execution.resume`,
`execution.retry`, `execution.inspect`, `execution.cancel`,
`workspace.reserve`, `workspace.create`, `workspace.inspect`,
`workspace.recover`, `workspace.cleanup`, `completion.gate.run`,
`completion.gate.inspect`, `completion.gate.cancel`, `completion.evaluate`,
`completion.accept`, `integration.reserve`, `integration.finalize`,
`backup.create`, `backup.restore`, `migration.apply`, `diagnostic.read`,
`diagnostic.export`, `external.merge`, `external.push`, `external.release`, and
`external.deploy`.

There is no wildcard action. Adding or renaming an action is a versioned public
contract change. An unknown action is denied rather than mapped to a similar
one.

## Trusted bootstrap authority

The first grant cannot authorize itself. On a newly initialized database with
no grant, one non-recursive bootstrap authority is established from an
interactive local actor whose operating-system principal owns the protected
runtime root. The persistence owner records that actor, OS-principal identity,
runtime-root identity, creation/expiry, consumption, and resulting grant IDs in
the singleton `authorization_bootstrap` record.

Bootstrap is not a grant or ProjectPolicy decision. It has exactly one power:
before expiry, issue to that same actor a bounded initial system-scoped set of
`authorization.grant.issue`, `authorization.grant.revoke`, and
`policy.evaluate` grants. One atomic bootstrap operation proves the database has
no grants, matches the interactive actor/OS/runtime-root identities, inserts
that fixed set, records audit events, and marks bootstrap consumed under the
[persistence transaction boundary](persistence-contract.md#transaction-boundaries).
It performs no adapter, network, filesystem-target, Project, Task, or external
mutation.

After that transaction, bootstrap can never be used again, including after a
process restart; backup/restore preserves its consumed state. If any identity
is unknown, the record is expired/consumed, or grants already exist, bootstrap
fails closed. There is no default administrator, self-issued grant, environment
variable override, or policy-adapter route around this trust root.

All later issuance requires `authorization.grant.issue`; its constraints
enumerate the actions/scopes it may delegate and maximum expiry, and an issuer
cannot delegate beyond its own current authority. Revocation requires
`authorization.grant.revoke` bound to the exact target grant identity/revision.

## Read and inspection authorization

Before `scheduler.inspect`, `execution.inspect`, `workspace.inspect`,
`completion.gate.inspect`, or `diagnostic.read`, the application creates a
side-effect-free read decision. It verifies request schema, trusted
actor/delegation, the exact read action and scope, target identity/revision, a
current matching grant, correlation/query identity, and any credential or
network authority needed to observe the target. Missing, stale, ambiguous, or
denied input prevents the read.

The allow record binds those identities, decision/expiry time, and a stable
reason code to exactly one bounded query. It carries no mutating intent and
cannot reserve, create, update, remove, finalize, or authorize a later mutation.
ProjectPolicy is not called for this read-only decision because the current
ProjectPolicy port returns decision inputs for requested mutations and
completion; a read grant cannot be broadened by omitting any privacy,
diagnostic-access, or external-authority rule owned elsewhere.

## Grant shape and semantics

Every grant contains exactly these semantic fields:

- unique `grant_id`;
- positive `grant_revision`, initialized to `1`;
- trusted `actor_id` and nullable `delegated_by_actor_id`;
- one exact `action`;
- `scope_kind` and stable `scope_id`;
- exact `resource_revision` to which the decision applies;
- `issued_by`, `issued_at`, and mandatory finite `expires_at`;
- versioned, canonical `constraints`;
- nullable `revoked_at`; and
- an audit correlation ID.

Scopes are `system`, `project`, `task`, `execution`, or `resource`. A scope
matches exactly unless its constraints explicitly enumerate descendant stable
IDs; textual prefixes, filesystem prefixes, parent hierarchy, dependency edges,
and Project membership do not imply authorization inheritance. A create action
binds `resource_revision` to the current revision of its owning Project or
parent resource. Other mutations bind the exact target revision.

A grant is usable only after `issued_at`, strictly before `expires_at`, while
not revoked, for its exact actor/action/scope/revision and satisfied constraints.
Clock uncertainty, malformed constraints, absent target revision, or a changed
resource makes it unusable. Grant authority fields are immutable. Revocation is
the only record transition: it CAS-matches `grant_revision`, sets `revoked_at`,
increments that revision exactly once, and appends audit history. A revoked
grant cannot be restored; changed authority requires a new grant.

## Preliminary ProjectPolicy query

For a requested mutation whose exact target is a registered Project or a
Project-owned resource, ProjectPolicy evaluation is a pre-final, non-mutating
decision-input query. It uses a distinct preliminary authorization that verifies
only:

1. request schema, actor/delegation identity, correlation ID, Project identity,
   exact Project config revision, and requested mutation action/scope;
2. a current `policy.evaluate` grant for that actor and Project scope; and
3. the identity/freshness of any read-only domain, ownership, or external
   observation supplied as policy input.

This preliminary authorization does not call ProjectPolicy, require the
requested mutation's full authorization decision, or persist a mutating
external-effect intent. With that preliminary allow record, the application may
make exactly one side-effect-free ProjectPolicy call using the operation shape
owned by the [adapter contract](adapter-contracts.md#projectpolicy-ato-project-policyv1).
The adapter may read the supplied immutable decision context but MUST NOT write
core or external state, issue/revoke a grant, invoke another mutating adapter,
or reserve a resource.

The result is a policy receipt bound to the query, requested action, subject and
config revisions. It is only input to the final decision: `allow` cannot mutate
anything, `deny|defer` blocks the requested mutation, and missing/stale/error
results fail closed. This two-stage rule is the only ProjectPolicy bootstrap;
policy never authorizes its own query.

A system-scoped action with no registered Project target—including initial
Project registration and authorization administration—has no ProjectPolicy to
query. Its final decision records policy as `not_applicable/system_scope` and
still requires every other action-specific check. Unknown Project ownership or
an unresolved scope is denied, not treated as system scope.

## Pre-mutation decision envelope

The fixed one-time bootstrap transaction above is the sole exception to this
ProjectPolicy sequence; it can issue only its named initial grant set and has no
adapter or external effect.

After the applicable preliminary policy receipt exists—or exact system scope
has been established—and before the first requested mutation, including an
external-effect intent write, workspace creation, cleanup, grant administration,
or domain write, the application service evaluates all applicable steps below
against one current final-decision context:

1. **Request integrity:** schema, action, canonical resource identity, expected
   revision, idempotency identity, and correlation identity are present and
   internally consistent.
2. **Actor:** trusted ingress establishes the exact actor and any delegation.
3. **Grant:** an unexpired, unrevoked grant matches the exact action, scope,
   resource revision, and constraints.
4. **Domain eligibility:** when the command requires a state transition or
   claim, the current result from the [domain owner](domain-contract.md) allows
   it.
5. **Ownership:** when an operation mutates or removes an external resource, a
   current ownership receipt from the
   [completion/workspace owner](completion-workspace-contract.md) matches that
   exact resource and generation.
6. **Policy:** for a Project-bound action, the preliminary ProjectPolicy receipt
   returns `allow` for the exact requested action, subject revision,
   policy/config revision, and external target and remains fresh. For a proven
   system-scoped action, the decision records `not_applicable/system_scope`.
7. **External authority:** credentials, login state, network permission, and
   user authorization required for an external action are independently
   present. A stored runtime grant cannot manufacture any of them.
8. **Transactional recheck:** immediately before commit or external-effect
   intent creation, the transaction rechecks grant expiry/revocation, resource
   revision, eligibility, ownership identity, and policy freshness.

Every required step must return a positive, current result. `deny`, `defer`,
unknown, stale, ambiguous, missing, or evaluation error fails closed before the
mutation. Policy may narrow an existing grant but cannot broaden it. Domain
readiness, a completed test, a receipt, an approved development plan, or a prior
similar operation is not a grant.

Only after all eight checks yield the final `allow` may a domain mutation commit
or a persisted external-effect intent be created. Only after that intent commits
may its mutating adapter call occur. The preliminary query record and policy
receipt cannot substitute for either the final decision or intent.

A final Project-bound decision records the exact ProjectPolicy binding. A
proven system-scoped action with no registered Project target records the
canonical `system_not_applicable` policy binding instead; it never invents a
policy ID or revision. Either binding is part of the operation semantic
identity and must match the persisted intent.

## Decision record

A request that has not established a trusted actor, known action, canonical
scope/resource identity, and expected revision is rejected at typed ingress and
records only sanitized audit evidence; it cannot manufacture a partially bound
authorization decision. Every evaluation after that boundary produces an
authorization decision record with:

- decision ID, decision kind `read|preliminary_policy_query|final_mutation`,
  correlation ID, and nullable bounded query ID;
- actor and delegation identity;
- action, scope, resource identity, and expected revision;
- nullable grant ID/revision and expiry, present exactly when a matching grant
  was found and absent for a `grant_missing` or pre-grant validation denial;
- domain-eligibility evidence reference when applicable;
- ownership-receipt reference when applicable;
- `policy_binding_kind`; for `project_policy`, the policy ID, contract version,
  config revision, and nullable policy-receipt reference (required for the
  final Project-bound allow, absent while recording a failed preliminary query
  or missing-receipt denial); for a read decision the canonical
  `read_not_applicable` binding; or for proven system scope the canonical
  `system_not_applicable` binding. Both not-applicable bindings have no policy
  identity fields and neither can be used by the other decision kind;
- external-authority requirement status;
- `allow`, `deny`, or `defer` result plus a stable reason code; and
- decision time and validity end, which cannot exceed grant or policy expiry.

Only `allow` may be consumed, once, by its exact bounded query or mutation whose
identities still match. A final mutation allow and its external-effect intent
may be inserted in the same transaction, but the decision record is inserted
first and the intent references it; neither may commit without the other. A
later fresh allow for that exact semantic intent may commit only with the
intent's authorization-binding CAS; it changes no semantic member and retains
all prior decision records. A read or preliminary-policy allow is consumed only
by its named query and cannot
be referenced by a mutation intent. The record contains no secret values and
is persisted with the query, mutation, or failed attempt's audit evidence.
Replaying it after consumption or any bound revision, policy, ownership, or
expiry change is denied.

The preliminary policy-query allow is a separate record with action
`policy.evaluate`, query ID, actor/grant, Project/config revision, requested
mutation identity, expiry, and result. It never carries the final decision ID
and is not consumable by a mutation.

## External and destructive actions

`external.merge`, `external.push`, `external.release`, `external.deploy`,
workspace cleanup, backup restore, and migration are distinct actions and need
distinct grants. Permission for an earlier step never implies a later step.
Destructive or externally visible work also requires the ProjectPolicy allow
decision and the caller's current real-world authority. Partial external success
is recorded as actual state and routed through reconciliation; authorization
does not permit reset, force, deletion, or fabricated rollback.
