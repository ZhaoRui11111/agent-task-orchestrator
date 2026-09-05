# Authorization contract

## Status and authority

This document is the normative owner of the implemented local runtime
authorization model through the sole current `ato.api/v1` Manual and authorized
Codex product facade, reconcile-first dispatcher, workspace foundation, and injected Phase 3
library. The implementation is deliberately limited to nineteen base local
application/lifecycle actions, four database-local execution claim/lease
actions, six Manual-loop actions, one dispatcher action, five workspace actions,
and twelve completion/integration actions plus three scheduler lifecycle
actions plus five Codex actions across contiguous vocabulary versions 1 through
8. It is not an operating-system
account system, team identity service, RBAC product, cloud identity provider,
or authorization for development and external actions. Codex never
reinterprets an existing Manual, dispatcher, workspace, or scheduler grant.

Runtime grants never authorize repository development, network or secret
access, pull requests, release, deployment, arbitrary filesystem access, or any action outside the finite
vocabulary below. The four claim actions authorize only claim, claim inspection,
lease renewal, and reconcile-gated takeover. The six Manual-loop actions
authorize only the exact local no-workspace port/journal, inspection,
continuation, cancellation-request, and verified-completion operations defined
below; they grant no network, Project filesystem, Codex, Git, workspace,
scheduler or completion-gate authority. In particular, the existence of the
internal `ato.execution/v2` Codex branch creates no authority to select its
destination, resolve a credential, disclose Task input, or perform a Project/
workspace effect. Operational composition additionally requires the closed
Codex profile and invocation decisions below. `dispatch.run` authorizes only one
bounded dispatcher trigger/run ownership and continuation; it does not imply
execution claim/start/takeover, adapter, Project, filesystem, network, or
completion authority. The `runtime.backup` and `runtime.restore`
actions authorize only the implemented local persistence lifecycle through the
exact application handoff described below; they grant no external or general
file authority.

The five `workspace.*` actions authorize only their exact typed workspace
application operation against the complete current Project/Task/run/member/
execution/fence/generation tuple and configured `ato.workspace/v2` backend.
They do not authorize caller-selected paths, arbitrary Git or filesystem use,
repository development, integration, push, or cleanup outside that tuple.
`workspace.cleanup` additionally requires one fresh named high-risk
confirmation plus the current application-issued cleanup attestation. The
twelve Phase 3 actions authorize only their exact policy-bound gate,
completion, reservation, inspection, lease, apply, local-file push, recovery,
or release operation. `completion.accept`, `integration.apply`, and
`integration.push` also require fresh named high-risk confirmation. No grant
selects an adapter, executable, root, ref, destination, or policy; these come
only from trusted injected configuration. The default product runtime and CLI
construct no Phase 3 adapter or operation route.

The three `scheduler.*` actions authorize only the exact injected library
operations `register`, read-only `inspect`, and `remove` for one bound runtime or
Project schedule configuration. Register and remove each require a fresh named
high-risk confirmation. No scheduler grant selects a backend, platform,
executable, task definition, cadence, credential, path, or dispatcher target;
those identities are bounded command/configuration data and trusted injection.
Inbound `dispatch_trigger` does not consume a scheduler lifecycle grant: it
derives a trusted scheduler actor and independently requires current
`dispatch.run` authority before creating a scheduled tuple or dispatcher run.
The default product runtime and CLI expose generic grant management for these
labels but no scheduler operation route.

The five `codex.*` actions authorize only the closed Project-profile and
targeted execution paths. Profile activation/deactivation and execution invoke
are high risk and require fresh named confirmation. A profile binds the fixed
`openai-codex-api` product destination, the opaque
`process-env:CODEX_API_KEY` reference, and exact trusted filesystem/executable
identities; it is configuration, not effect authority. Every start/resume/retry
requires `codex.execution.invoke` plus the exact current dispatcher, execution,
claim/takeover, and workspace grants for that operation, a fresh confirmation,
and one persisted Act consumed by one pending intent before credential value or
Task input access. Cancellation separately requires
`codex.execution.cancel`. Manual and scheduled routes cannot select a profile.

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

The typed claim application service uses a narrower `ExecutionIngress`. It
obtains the same trusted actor/principal and UTC time, fresh request,
correlation, decision, audit, operation, and execution identities, and a trusted
lease-owner identity outside command content. The reliable Manual loop uses a
separate `ReliableExecutionIngress` for the same trusted facts plus fresh
operation/intent/observation/receipt/finalization identities. Only its named
`manual.turn.report` and `execution.completion.accept` paths request a fresh
confirmation. Capability upgrade still uses `ApplicationIngress`; every
execution operation independently requires its current explicit grant.
Invalid, throwing, repeated, accessor-backed, or ambiguous values fail closed.

The dispatcher uses a narrower trusted ingress for the same actor/principal and
runtime-root binding, trusted UTC time, fresh bounded identities, and one
worker-owner identity supplied outside command content. Every trigger and every
run continuation independently evaluates current `dispatch.run`. A command
cannot select or replace the worker owner, actor, principal, time, or
authorization evidence. Dispatcher idempotency content is parsed as a bounded
identifier and persisted only as its stable digest identity.

The workspace application owner uses `WorkspaceIngress` for the same trusted
actor/principal binding, current UTC time, fresh request/correlation/decision/
event/operation/intent/observation/receipt/finalization identities, and the
separate cleanup confirmation. Adapter/root configuration is trusted injected
configuration, not command content. Prepare, act, and finalize each revalidate
the applicable current identity, tuple, and authority; observation and
verification remain exactly bound to that durable tuple and receipt. Trusted
callbacks and the injected backend never run inside a writer transaction.

The Phase 3 application owner uses `Phase3Ingress` for the same trusted local
actor/principal/runtime-root identity, monotonic UTC time, fresh operation-
specific identities, a trusted reservation lease owner, and fresh named
confirmation for `completion.accept`, `integration.apply`, `integration.push`,
and `workspace.cleanup`. It first obtains a current `policy.evaluate` decision,
persists the exact bounded ProjectPolicy receipt, and then evaluates the
requested action against that narrowing receipt. Adapter-observed time is
evidence only; application lifecycle timestamps and expiry/fence decisions use
fresh trusted ingress time. Policy, Completion, Integration, and Workspace
calls remain outside every writer transaction.

The scheduler application owner uses `SchedulerIngress` for the same trusted
actor/principal/runtime-root identity, trusted UTC time, fresh request,
correlation, decision, event, operation, intent, observation, receipt, and
finalization identities, plus separate register/remove confirmations. Adapter
identity/version is trusted injected configuration. Register/remove prepare,
Act, observe, verify, Finalize, and reconcile each revalidate their applicable
tuple. Current authority is checked at prepare and again at the final point-of-
use Act; Finalize consumes that bound allowed Act decision under current CAS.
Inspect obtains its own fresh read decision and cannot create a mutation intent. The inbound delivery path obtains the same
trusted identity/time and current `dispatch.run` decision without accepting an
actor or authorization from trigger content. No trusted callback or injected
backend runs inside a writer transaction.

The Codex product owner uses `CodexProductIngress` for the same trusted actor,
principal, runtime-root identity, time, fresh bounded identities, dispatcher/
workspace trusted facts, and named profile/invocation/cancellation
confirmations. It parses the complete public command first. Profile inspection
uses a fresh `codex.profile.inspect` read decision. Activation/deactivation
persist one immutable request/decision/audit/operation unit. Each execution
first persists a Prepare decision; after the exact pending core intent exists,
the point-of-use transaction obtains a distinct fresh Act, recomputes every
required grant conjunct, binds that Act as the intent's sole consumer, and
advances it to `executing`. A denial is immutable history and leaves the intent
pending. Credential resolution, Task disclosure, SDK work, and every adapter or
workspace call occur outside writer transactions.

The combined decoder reproduces every scheduler authorization decision through
the sole current authorization evaluator. Because the schema records timestamps
rather than a total order among events at an identical instant, it constructs
global before/after boundaries plus provenance-closed, creation-request-atomic
focused witnesses for the decision grant and per-grant creation/revocation
boundary. One such witness must reproduce the complete stored decision tuple
exactly. Before capability upgrade/renewal or grant issue/revocation, the
application rejects a trusted mutation time strictly earlier than the latest
durable scheduler authorization decision, before writing anything. Equal or
later trusted time is permitted, and no decoder path invents a second
authorization algorithm.

## Exact action vocabulary

The complete grantable implemented vocabulary begins with the nineteen base
local actions:

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

plus the four claim-foundation actions:

- `execution.claim`
- `execution.claim.inspect`
- `execution.lease.renew`
- `execution.lease.takeover`

plus the six reliable Manual-loop actions:

- `execution.start`
- `execution.inspect`
- `execution.resume`
- `execution.retry`
- `execution.cancel`
- `execution.completion.accept`

plus the one reconcile-first Manual dispatcher action:

- `dispatch.run`

plus the five workspace-foundation actions:

- `workspace.reserve`
- `workspace.create`
- `workspace.inspect`
- `workspace.recover`
- `workspace.cleanup`

plus the twelve Phase 3 completion/integration actions:

- `completion.gate.run`
- `completion.gate.inspect`
- `completion.gate.cancel`
- `completion.accept`
- `integration.reserve`
- `integration.inspect`
- `integration.lease.renew`
- `integration.lease.takeover`
- `integration.apply`
- `integration.push`
- `integration.recover`
- `integration.release`

plus the three scheduler lifecycle actions:

- `scheduler.register`
- `scheduler.inspect`
- `scheduler.remove`

plus the five Codex profile/effect actions:

- `codex.profile.activate`
- `codex.profile.inspect`
- `codex.profile.deactivate`
- `codex.execution.invoke`
- `codex.execution.cancel`

There is no wildcard and no prefix expansion. Unknown actions and unimplemented
commands are invalid input; they are not mapped to a similar action. These
actions do not imply a concrete scheduler adapter, real scheduled task,
arbitrary Git/filesystem/network access, arbitrary secret source, diagnostic,
MCP, release, or deployment capability. The five Codex labels grant only the
closed product route and do not attest administrator-managed effective
configuration or platform support. `execution.completion.accept` accepts only exact current
verified Manual-turn evidence; it is distinct from Phase 3
`completion.accept` and grants no CompletionBackend or gate authority.
`authorization.capability.renew` and `authorization.capability.upgrade` are
implemented local trust-root transitions but are deliberately non-grantable.

## One-time bootstrap

A fresh current schema-version-1 runtime has no grants. Exactly once, a trusted local caller
may invoke `authorization.bootstrap` with a finite expiry no more than 31 days
after the trusted ingress time. Bootstrap requires a separate high-risk
confirmation and atomically:

1. proves that no bootstrap receipt exists;
2. records the trusted actor and principal;
3. records the canonical runtime-root identity (`rootKey`, platform, device,
   inode, and mode) without following alias/reparse components;
4. inserts the immutable versioned local actor/principal-to-root binding;
5. inserts one runtime-scoped grant for that actor for each of the nineteen
   exact base actions;
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

## Local identity, upgrade, renewal, and capability epochs

`authorization.capability.renew` is a non-grantable local trust-root
maintenance transition. It is not part of the grantable vocabulary and
cannot be delegated. It requires the exact current OS-derived identity,
runtime-root identity, a fresh named confirmation, a finite expiry more than
seven and no more than 31 days ahead, and one atomic terminal readback.

Fresh bootstrap establishes the immutable local identity, a vocabulary-version-1
bootstrap and only the nineteen base origin grants. It creates no capability
epoch and no later-vocabulary authority. There is no identity-adoption mode or
historical-schema transition.

`authorization.capability.upgrade` is the only transition that creates a newer
execution vocabulary. It is non-grantable and requires the exact current
OS-derived actor, principal and runtime-root binding, a fresh named high-risk
confirmation, a finite expiry more than seven and no more than 31 days ahead,
and an eligible current origin. Each call advances exactly one contiguous step:
version 1 to 2 appends one origin grant for each of the twenty-three
claim-capable actions, version 2 to 3 appends one origin grant for each of the
twenty-nine Manual-capable actions, version 3 to 4 appends one origin grant for
each of the thirty dispatcher-capable actions, version 4 to 5 appends one
origin grant for each of the thirty-five workspace-capable actions, version
5 to 6 appends one origin grant for each of the forty-seven Phase 3-capable
actions, version 6 to 7 appends one origin grant for each of the fifty
scheduler-capable actions, and version 7 to 8 appends one origin grant for each
of all fifty-five current actions. A runtime cannot skip
any intermediate version or combine two upgrades in one ceremony.
The epoch, exact grant set, request/allow-decision/audit unit, and terminal
readback commit together. Migration, bootstrap, an earlier decision, Task
readiness, ordinary grant issue, and renewal cannot substitute for either
ceremony. Repetition or concurrent lineage change fails without a partial epoch
or grant set.

After bootstrap, renewal is eligible only when the current
origin expires within seven days or has expired. Revocation of any still-current
origin grant blocks early renewal; revocation is not a shortcut to replace a
capability. Each accepted renewal appends a contiguous positive epoch revision,
the exact vocabulary/version digest, a request/decision/audit unit, and one new
finite origin grant for every action in the already-current vocabulary:
nineteen for vocabulary version 1, twenty-three for version 2, twenty-nine for
version 3, thirty for version 4, thirty-five for version 5, forty-seven for
version 6, fifty for version 7, or fifty-five for version 8. Every epoch and current origin grant
uses the single `authorization_capability_epochs` and `authorization_grants`
relations with direct `capability_epoch_id` provenance. Renewal never changes a vocabulary version. Previous epochs and
grants remain immutable history.
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
  immutable epoch with null issuer/source for renewed or upgraded origin grants.

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
- `execution.completion.accept`
- `completion.accept`
- `integration.apply`
- `integration.push`
- `workspace.cleanup`
- `scheduler.register`
- `scheduler.remove`
- `codex.profile.activate`
- `codex.profile.deactivate`
- `codex.execution.invoke`

Capability renewal and each capability upgrade also require a fresh
high-risk confirmation even though they are deliberately not grantable actions.
The trusted Manual outcome ingress separately requires a fresh named
`manual.turn.report` confirmation after a current exact `execution.inspect`
grant is found. That confirmation is not an action or a reusable capability.

Confirmation is bound to actor, action, request, and correlation identities. A
command field, Project/Task content, or a prior confirmation cannot supply or
replay it. Missing, false, or throwing confirmation denies the operation.

## Application decision sequence

The application owner first parses the complete typed command envelope before
using any trusted ingress provider or reading Application state. For
`task.cancel`, it applies the exact Domain-owned cancellation-reason predicate: a
well-formed NFC string with no Unicode `Cc`/`Cf` code point and 1 through 4,096
encoded UTF-8 bytes. Malformed typed input returns `INVALID_INPUT` with null
request and correlation identities and creates no request, decision, audit,
Domain, registry, grant, or persistence mutation. The same pure predicate is
authoritative for Domain transitions and complete snapshot reconstruction;
persistence therefore refuses a current stored Task whose cancellation reason
violates it as typed corruption, without normalizing or rewriting data.

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

The claim application owner follows the same preflight/revalidation/short
transaction pattern with its narrower trusted ingress. An initial claim
atomically records request and allow decision, advances the Task execution
sequence/fence, inserts the active attempt, invokes the Domain
`ready`-to-`running` transition, appends sanitized audit, and reads back the
terminal state. Inspect, renewal, and takeover re-evaluate their exact grant and
Project binding inside the transaction. Inspect uses
`read_not_applicable`; claim, renewal, and takeover require an enabled Project.
No execution operation consumes a prior decision as authority.

The reliable Manual-loop owner extends that sequence without widening it. Each
operation parses its complete closed command, obtains trusted identities and a
current exact grant, and persists an authorization-bound semantic intent in a
short transaction. That prepare decision is evidence, not standing authority.
Before every mutation call the owner revalidates the persisted local
actor/principal and runtime-root identity, evaluates the grant again, and CAS
binds a fresh `act` decision to the same immutable intent tuple. Before every
finalization it repeats that process and binds a fresh `finalize` decision in
the same transaction as the result mutation. The immutable
prepare/act/finalize binding chain, its revision, the journal operation and the
finalization all name the decision they consumed; revocation or expiry between
any two stages therefore prevents the next effect or result mutation. The
authorization-attempt identity is separate from the successful binding
revision: a denied attempt remains immutable without advancing the binding,
and a later retry allocates new request/decision/audit identities and evaluates
then-current authority. The adapter remains outside SQLite, and every
independent observation attempt obtains and evaluates a distinct current
`execution.inspect` allow; neither a prior allow nor a prior denial is cached as
current authority. Observation, verification, and finalization use separate
short transactions and exact Task/execution/attempt/fence/Project CAS. Resume,
retry, cancellation, expired-lease recovery, and old-fence refusal therefore
never derive authority from a prior decision, adapter receipt, Task text, or
lease expiry. Even an exact finalized idempotent replay revalidates the persisted
actor/principal and current runtime-root identity before returning its bounded
result.

Manual outcome reporting additionally requires the current OS/runtime-derived
actor, principal, and runtime-root key to equal the persisted local runtime
identity, current `execution.inspect` authority for the exact scope, and one
fresh `manual.turn.report` confirmation. No actor name is privileged and CLI
text cannot assert or replace any identity member. The owner commits that
decision and report intent before calling the injected outcome control, then
observes the result through `ato.execution/v2`. A `turn_succeeded` finalization
leaves the Task running. Only a distinct `execution.completion.accept`
evaluation with a different fresh confirmation and the exact current verified
receipt/finalization can atomically record the Manual completion decision,
invoke Domain `completion_accepted`, terminalize the execution, append audit,
and read the completed Task back.

The dispatcher application owner follows the same fail-closed pattern without
borrowing execution authority. An explicit Manual trigger atomically records
one sanitized request, final `dispatch.run` decision/audit, and—only on allow—
one `starting` run. Every reconciliation, seal, member-resolution, heartbeat,
takeover, and terminal-summary transition revalidates the trusted runtime and
actor, evaluates current `dispatch.run`, and CAS-matches the run owner/revision.
Candidate claim and start preparation then consume their own current
`execution.claim` and `execution.start` decisions in the application-owned
atomic unit; `dispatch.run` cannot substitute for either. Revocation or expiry
may therefore stop run coordination without retroactively invalidating its
immutable historical decisions or permitting a new effect.

The workspace application owner first parses the complete closed command and
then binds current Project resource/config revisions, Task revision,
dispatcher run/member/membership revisions, execution revision/attempt/fence,
workspace ID/generation/revision, trusted workspace-root identity, adapter
version, creator operation, and optional cleaned predecessor. Reserve allocates
the system workspace identity/generation in its prepared transaction; later
operations may address only that exact generation. Each operation persists a
prepare authorization decision and intent, CAS-binds a fresh act decision,
calls the injected backend outside the transaction, persists one ordered
observation, semantically verifies its receipt, and CAS-binds a fresh finalize
decision. `workspace.inspect` uses the same durable evidence chain but its port
call is read-only and cannot change backend state. Cleanup obtains its separate
trusted confirmation before the writer and cannot consume a confirmation from
another operation or generation.

The generation row freezes the creation-time lower bounds for Project
resource/config, Task, run, member, and execution revisions. Those owners may
advance their revisions without changing the generation identity. Every later
command must nevertheless name the exact current revisions, and its act and
finalize decisions bind those exact current values; none may precede the frozen
lower bound. Project/Task/run/member/execution identities, membership revision,
attempt, fence, workspace ID, and positive generation remain exact for the
generation and cannot be substituted.

An effect-possible reserve, create, or cleanup whose response or final state is
not provable becomes `recovery_required`/ambiguous evidence; the old operation
is never blindly replayed. Explicit recover must causally name that ambiguous
operation at the exact current unresolved generation revision; every nested
ambiguous recover and final effect-capable root must remain bound to that same
revision, so an older resolved root grants no later recovery authority. Current
grant, Project/run/member/execution revisions, generation
revision, and fence are re-evaluated before act and finalization, so expiry,
revocation, substitution, or a late worker prevents the next transition without
fabricating rollback. Exact finalized replay revalidates the current trusted
identity/root and returns only the bounded durable result.

The Phase 3 owner keeps policy evaluation and final requested-action authority
separate. It first records a preliminary `policy.evaluate` decision and exact
ProjectPolicy receipt; deny/defer can never create an effect intent. Gate,
integration, completion, and cleanup operations then independently revalidate
the receipt, Project/Task/execution/workspace/HEAD tuple, current grant, and
applicable confirmation. Gate and integration effects use durable prepare and
fresh Act/Finalize decisions around out-of-transaction adapter calls.
Integration reservation acquire/renew/takeover/release uses exact owner,
revision, lease and target fencing. Policy-gated completion atomically records
one generic plus policy-gated decision, invokes the existing Domain completion
transition, and inserts the unique execution-terminal fact; policy receipt,
gate exit, local ref update, push, or cleanup alone does none of those things.
Cleanup prepares its unique intent before the final authorization transaction,
which both issues the exact attestation and advances that intent to executing;
the backend receives no authority beyond that narrowing proof.

If claim authorization allows but the fully bound `execution.start`
authorization denies, the same member-resolution transaction records one
dedicated sanitized denied request, denied decision, and
`authorization.denied` audit event. The triple binds the run/member, actor,
exact sealed Project resource/config revisions, proposed execution identity,
and closed reason. It terminalizes that member as `authorization_denied` but
creates no execution attempt, Task transition, operation intent, or adapter
effect; replay and restart return the same immutable lineage.

When one Domain command would mutate Tasks owned by more than one Project,
every affected Project must be covered. In the base stage the only such implemented
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
state digest version 4 from the sole complete non-lifecycle
`applicationStateProjection`, and short finite validity interval. Terminal output reads back the
exact newly allocated lifecycle authorization ID; operation/generation matching
is never used as a non-unique substitute, including on a retry.

For restore, application evaluation and this durable handoff precede backup
inventory or selected-generation verification. Revoked, expired, or missing
current authority therefore receives the same denial for valid, absent, or
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
authorizations, execution attempts, operation evidence, generic/Manual/
policy-gated completion decisions, dispatcher trigger/decision/audit/
reconciliation/membership/summary evidence, scheduler configuration/
registration/operation/delivery/tuple evidence, Codex profile/product/effect-
authorization evidence, workspace generations/
authorization/intent/observation/verified-receipt/finalization/event evidence,
ProjectPolicy receipts, completion-gate evidence, integration reservations/
effects/events, cleanup attestations, authorization decisions, and audit rows
are append-only apart from
the narrowly constrained lease/attempt, intent-state, and Manual-turn CAS
transitions. Package-private Codex turn/terminal rows and product-composed
profile/operation/Act rows are subject to the same immutable authorization and
narrow revision-CAS rules; their presence is evidence rather than reusable
authority. Grant rows are
insert-only except for the single CAS revocation transition. ProjectRegistry
rows cannot be deleted. SQLite constraints, foreign keys, triggers, combined
typed decoding, and terminal readback enforce these shapes.

Audit details are fixed sanitized metadata selected by application code. Task
body, Project path, prompts, tool output, Agent text, secrets, and arbitrary
command content are not copied into audit records. See
[privacy and logging](../security/privacy-and-logging.md).

## Explicit non-claims

The base stage implements local CLI initialization, finite grant administration,
status, backup authorization, separately confirmed restore authorization, and
the read-only doctor experience. The claim stage adds the four local
claim/lease grants; the Manual stage adds one separately confirmed version-3
step and the six exact Manual-loop grants and decisions described above. The
current dispatcher stage adds one separately confirmed version-4 step and the
exact `dispatch.run` decision path for the explicit-Manual dispatcher. The
workspace-foundation stage adds one separately confirmed version-5 step and the
five exact workspace decisions above. The Phase 3 stage adds one separately
confirmed version-6 step and the twelve completion/integration actions above.
The scheduler stage adds one separately confirmed version-7 step and the three
exact lifecycle actions above; register/remove are high risk, while inbound
delivery still consumes `dispatch.run`.
The Codex stage adds one separately confirmed version-8 step and the five exact
actions above. Profile activation/deactivation and invoke are high risk; an
invoke decision is usable only as the one-consumer Act for its exact pending
intent and required grant conjunction.
The listed high-risk actions each require their own fresh confirmation. The
current product API exposes the existing Manual/dispatcher decisions and the
closed Codex profile/targeted-execution subset through `ato.api/v1`; Phase 3
and scheduler operation services remain package-library-only. The CLI upgrade
command may reach vocabulary version 8 and manage all fifty-five finite grants,
but adds no Phase 3 or scheduler operation command or alternate authorization
owner. This implementation does not provide login, a general credential
broker, team accounts, RBAC, cloud identity, concrete SchedulerBackend or real
scheduled task, MCP, product-wired scheduler, general network effects, release,
deployment, administrator-managed effective-policy attestation, real Codex
account E2E, or a platform-support claim.
