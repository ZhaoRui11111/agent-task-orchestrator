# Adapter contracts

## Status and direction

This file is the sole normative owner of port directions, current port
identifiers and versions, operation shapes, receipt envelopes, and adapter
error taxonomy. The package implements the pure `ato.execution/v2`,
`ato.scheduler/v1`, `ato.project-policy/v1`, `ato.completion/v1`,
`ato.integration/v1`, and sole current `ato.workspace/v2` contract kits.
Concrete local implementations are
the durable `manual-local` execution adapter/control, a package-private and
non-composed `openai-codex-sdk-local` execution adapter/driver, configured
`local-project-policy`, bounded `local-completion`,
`local-git-integration`, and `windows-git-local` workspace backend. Fake
backends are test-only and unexported. The Codex constructor, configuration,
driver, and injected service are absent from the supported package root and all
current product/application/dispatcher/CLI factories. The scheduler port and
typed injected application owner are implemented, but there is no concrete
scheduler adapter; its deterministic no-effect Fake is test-only and
unexported.

The Phase 3 ports and local adapters are direct injected library surfaces. The
default product runtime and sole current `ato.api/v1` CLI construct none of
them and add no Phase 3 command. The local Git integration adapter can mutate
only a validated expected-old target ref and an explicitly configured canonical
local bare destination; the workspace adapter performs cleanup only with the
exact current application-issued attestation. Disposable exact-host evidence
does not create a vendor, operating-system, external-API, release, or platform
support claim.

Business rules remain with their linked owners. An adapter translates a
versioned port and cannot change Task state semantics, authorize an operation,
declare an unverified external effect successful, or write SQLite directly.

| Port | Direction relative to core | Current contract ID | Responsibility boundary |
| --- | --- | --- | --- |
| Execution | Outbound: reliable application loop calls adapter; the implemented Manual dispatcher calls only its retained Manual branch | `ato.execution/v2` | Start, resume, inspect, or request cancellation of one discriminated Manual no-workspace or package-private Codex owned-workspace turn |
| Workspace | Outbound: workspace application coordinator calls injected backend | `ato.workspace/v2` | Reserve, create, inspect, recover, or attestation-bound cleanup of one exactly bound workspace generation |
| Scheduler | Outbound lifecycle plus inbound trigger delivery | `ato.scheduler/v1` | Register/inspect/remove a schedule and deliver a bounded dispatch trigger |
| ProjectPolicy | Outbound: application calls adapter | `ato.project-policy/v1` | Evaluate mutation, completion requirements, integration, and cleanup policy |
| Completion | Outbound: application calls adapter | `ato.completion/v1` | Run and inspect named completion gates and return bound gate evidence |
| Integration | Outbound: Phase 3 application coordinator calls injected backend | `ato.integration/v1` | Inspect, expected-old fast-forward, or ordinary configured local-file push for one fenced reservation |

The [versioning and compatibility contract](versioning-compatibility-contract.md)
owns how these versions evolve and which version combinations may be claimed as
compatible. This file owns the current shapes.

## Operation-class envelopes

Each implemented port section below owns one exact closed call shape; unknown,
missing, accessor-backed, or cross-class fields are rejected. The generic
classes describe responsibility boundaries shared by current and later ports,
not a field union that an implemented call may extend. In particular,
`ato.workspace/v2` and `ato.scheduler/v1` use the exact specialized envelopes
documented in their sections and keep actor, authorization-decision,
confirmation, intent, and policy facts inside the durable application owner
rather than forwarding them to the backend when their exact request does not
name those fields. Fields from another class are never accepted as nullable placeholders.
Each operation section states which Project, Task, execution, run, trigger,
workspace, or schedule identities are applicable.

### Mutating external-effect call

A call that can change adapter or external state contains:

- `operation_id`, committed `intent_id`, and `idempotency_key`;
- actor ID and the intent's current final mutation-authorization decision
  reference;
- exact action/scope, target resource identity, and expected revision;
- current policy-receipt reference and external-authority evidence when those
  checks apply; and
- only the Task, execution/fence, run/trigger, workspace, Project, or schedule
  identities declared by that operation.

The committed intent and final decision exist before the call. Missing or stale
required identity fails before the effect. A Task-independent operation does
not invent a Task/run identity to satisfy this envelope.

### Read or inspection call

A side-effect-free read contains `query_id`, actor ID, read-action authorization
reference, exact target identity/revision, correlation ID, and the identities
declared by that query. It has no mutating intent, idempotency key, or final
mutation-decision reference. It MUST NOT reserve, create, update, remove, or
finalize a resource. External credentials/network authority required to perform
the read remain separate fail-closed preconditions. The exact read decision is
owned by the [authorization contract](authorization-contract.md#application-decision-sequence).

### ProjectPolicy decision-input call

A ProjectPolicy call contains `policy_query_id`, actor ID, the preliminary
`policy.evaluate` authorization reference, requested mutation action/scope,
Project and config revision, exact subject/resource revision, supplied
read-only eligibility/ownership observations, correlation ID, and policy
adapter/version. It has no mutating intent, idempotency key, or final requested-
mutation decision because the returned policy receipt is an input to that final
decision.

This class is side-effect-free. It cannot mutate core/external state, issue a
grant, reserve a resource, or invoke a mutating port. Its preliminary
`policy.evaluate` authority and transaction sequencing are owned by the
[local-policy rules](authorization-contract.md#local-policy-and-high-risk-confirmation)
and [application decision sequence](authorization-contract.md#application-decision-sequence).

### Inbound scheduler trigger

Trusted outer ingress supplies the configured scheduler adapter ID/version,
actor, principal, runtime-root identity, worker owner, and current time. The
untrusted inner trigger contains only contract ID, trigger ID, schedule ID,
positive config revision, scheduled instant, observed delivery instant, and the
adapter's bounded claimed deduplication value. It contains no registration
identity, adapter identity, caller-asserted actor, Task, execution, run,
mutating intent, or authorization. Typed outer ingress bounds the delivery
channel and ensures a sanitized observation is persisted even when the inner
trigger is malformed. A valid inner shape resolves the authoritative current
registration and dispatcher target from durable state, derives the exact
scheduled tuple, and is bound to a current `dispatch.run` allow/deny. The same
transaction creates or attaches the tuple's one canonical run only on allow;
denial records a sanitized unattached observation with its decision reference
but creates no run, Task, or external effect.

Unknown fields are rejected unless the specific schema names an extension map;
an extension cannot alter a required field's meaning.

## Operation-class receipts

Every receipt contains unique `receipt_id`, contract ID, correlation ID, adapter
ID/version and observed endpoint/API version, operation/query name, exact
observed subject/resource identity, `succeeded|deferred|rejected` outcome and
stable code, observation time, nullable validity end, redacted evidence/inventory
references, and available integrity metadata.

- A mutating-effect receipt also carries operation ID, intent ID, idempotency
  key, observation number, and observed pre/post identities.
- A read/inspection receipt carries query ID, read-authorization reference,
  observation number, and observed identity/revision, but no mutating intent.
- A ProjectPolicy receipt carries policy query ID, preliminary-authorization
  reference, policy ID/contract/adapter/config revisions, exact input identities,
  decision and reason, required gates, and validity end, but no final mutation
  decision or intent.

Receipt schema validation proves shape only. The
[reliability protocol](reliability-protocol.md#intent-receipt-verification-and-finalization)
owns independent observation, semantic verification, freshness, and
finalization of mutating effects.

## ExecutionBackend: `ato.execution/v2`

EP-03D replaces the unreleased v1 shape with one fresh-only current major. V2
retains the Manual operation meanings, adds an exact backend/workspace
discriminant, and permits bounded Task input only for the Codex effect boundary.
`ato.execution/v1` and `local-manual/v1` are invalid: there is no reader, alias,
fallback, translation, migration, dual write, or negotiation path.

Every operation carries the exact contract/adapter/version/correlation/deadline
envelope and a semantic identity containing Project resource/config revisions,
Task/input/execution/attempt/fence revisions, and policy binding. The closed
semantic variants are:

- `backendKind=manual-local`, `workspaceMode=none`: no workspace field exists,
  and `start`/`resume` input is exactly null;
- `backendKind=codex-sdk`, `workspaceMode=owned`: the tuple additionally binds
  `ato.workspace/v2`, workspace ID/generation/revision, trusted workspace-root
  key, uppercase ownership-binding SHA-256, and exact lowercase 40-hex current
  workspace HEAD. Its input reference is exactly
  `task-sha256:<lowercase-64-hex>`; `start`/`resume` carries the matching
  nonempty Task body only for the immediate effect call, bounded to 1 MiB.

Unknown, accessor-backed, cross-variant, wrong-case, omitted, or extra fields
are rejected before adapter dispatch. Receipts echo the backend kind and exactly
`local-manual/v2` or `openai-codex-sdk/v1`; endpoint/backend/workspace mismatch
is incompatible evidence.

Operations are:

- `start` (mutating-effect, `execution.start`): adds committed
  operation/intent/idempotency and final-allow identities. Its receipt adds the
  backend execution ID, nullable durable thread ID, matching workspace mode, and
  lifecycle `started|deferred|rejected`.
- `resume` (mutating-effect, `execution.resume` or `execution.retry`): adds the
  predecessor backend execution/thread ID, continuation reference, previous
  turn receipt, and expected thread identity. A Codex continuation belongs to a
  new fenced successor execution and must use the same durable thread; a changed
  thread is a conflict, not implicit replacement.
- `inspect` (read/inspection, `execution.inspect`): identifies the backend turn
  and last observation. Its receipt adds lifecycle
  `unknown|queued|active|waiting|turn_succeeded|failed|cancelled` and a bounded
  result/evidence reference. Shape and digest validity are insufficient: the
  reliable owner matches the exact durable backend journal, semantic tuple,
  revision, lifecycle, code, and evidence lineage.
- `request_cancel` (mutating-effect, `execution.cancel`): adds expected backend
  lifecycle and a bounded reason code. Its receipt reports
  `requested|already_terminal|rejected`; only independently durable terminal
  evidence can prove interruption.

`turn_succeeded` is an execution-turn fact, never a Task completion decision.
Raw Task input, model output, commands, paths, SDK item payloads, external error
text, and credentials follow the
[privacy and logging contract](../security/privacy-and-logging.md).

The retained local Manual backend persists an exact idempotent turn and
operation journal and exposes independent `inspect`; it never authorizes an
operation, changes a Task, or executes Task content. Its separate
`ato.manual-outcome-control/v1` accepts only the closed
`activate|wait|succeed|fail|confirm_cancelled` report set through the
application-owned, trusted current OS/runtime-derived actor/principal/root path.
Each report binds the Manual semantic identity, current `execution.inspect`
allow, a fresh `manual.turn.report` confirmation, expected journal
revision/lifecycle, and bounded code/evidence reference. Terminal Manual
lifecycles are immutable, and `confirm_cancelled` additionally requires an
exact prior cancellation-request revision. The loop then inspects through v2;
the control return is not itself finalization or completion evidence.
Immediately before every journal mutation the backend requires the intent's
current fresh Act binding and rechecks its referenced finite grant; replay may
return an already committed operation, but a new mutation cannot consume a
revoked, expired, stale, or prepare-only decision.

The package-private Codex backend is `openai-codex-sdk-local` at adapter version
`0.153.2`, backed only by pinned `@openai/codex-sdk` `0.153.2`. Before SDK access
it requires each configured Project binding to include the registry `rootKey`
alongside `projectId` and path, and requires that identity to match the current
durable Project record. It reopens trusted disjoint Project/workspace roots and
delegates physical proof to the sole `windows-git-local` workspace inspection
owner, which derives the canonical generation path and verifies the complete
ownership manifest, authoritative Git worktree registration, repository
identity, detached HEAD, and clean inventory including ignored entries. The
Codex verifier compares that physical repository identity with the current
ready workspace receipt before and after inspection and independently
recomputes the Task-input digest. It runs the SDK with that exact working directory,
workspace-write sandbox, network and web search disabled, and approval policy
`never`. A journal row is committed before SDK invocation. New-thread identity
is accepted only from the first valid `thread.started`; continuation uses
`resumeThread` with the exact predecessor thread. Only `thread.started`,
`turn.started`, `turn.completed`, and `turn.failed` cross the driver boundary;
all item events and raw errors are dropped.

The SDK exposes no independent remote inspect or turn identifier. Therefore the
backend's `inspect` is a read of its own exact durable journal, and any crash or
lost response after SDK access but before trustworthy terminal persistence is
`unknown`/ambiguous rather than replay authority. `AbortSignal` requests active
in-process cancellation when such a controller is available, but is not terminal
cancellation proof. The current non-composed harness admits no concurrent second
intent while start is unfinished, so unavailable cancellation returns bounded
ambiguity rather than claiming the signal was sent. The backend does not
fabricate `cancelled`, retry an effect-possible start, or complete a Task. No
supported package-root or product factory exposes this adapter, and no real
account/platform support claim follows from package or fake-driver tests.

## WorkspaceBackend: `ato.workspace/v2`

This pure closed contract kit is implemented and exported. It contains no
filesystem, Git, child-process, vendor, scheduler, policy, or CLI code. The
concrete `windows-git-local` adapter version `1.0.0` lives in its own module and
depends inward on this port; an unexported disposable Fake remains available to
tests. The adapter supports the five closed operations including attestation-
bound cleanup, but is never default-constructed by the product runtime or CLI.
The concrete adapter and one-host fixtures do not turn the pure port into a
platform-support claim.

Every request has exactly `contractId`, `operation`, `operationId`,
`idempotencyKey`, `correlationId`, nullable `causationId`, `adapterId`,
`adapterVersion`, `subject`, and nullable `cleanupAttestation`. The attestation
is null for reserve/create/inspect/recover and is the exact current
`ato.workspace-cleanup-attestation/v1` record for cleanup. The exact subject
binds:

- Project ID, resource/config revisions, and opaque canonical root identity;
- Task ID/revision;
- dispatcher run ID/revision, member ID/revision, and membership revision;
- execution ID/revision, attempt number, and fencing token;
- workspace ID, positive generation/revision, trusted workspace-root identity,
  exact uppercase 64-hex `ownershipBindingSha256`, and creator operation ID;
  and
- one bounded base reference.

All identifiers and references are bounded NFC strings; all revisions,
generation, attempt, and fence values are positive safe integers. Unknown,
missing, accessor-backed, proxy-throwing, extra, or differently cased fields
fail before backend dispatch. The operation is exactly one of:

- `reserve` for `workspace.reserve`, binding the allocated generation and base
  reference;
- `create` for `workspace.create`, consuming that exact reserved generation;
- `inspect` for `workspace.inspect`, observing without backend mutation;
- `recover` for `workspace.recover`, causally reconciling one durable ambiguous
  operation; or
- `cleanup` for `workspace.cleanup`, requesting removal only after the
  application owner has obtained its separate confirmation and current allow,
  persisted the unique cleanup intent, proved completed execution and
  zero-owner quiescence, and issued the current attestation.

A successful backend result contains only `ok: true` plus one exact receipt.
The receipt repeats contract/operation/idempotency/adapter/workspace/root
identity and `ownershipBindingSha256`, reports external state `absent`,
`reserved`, `partial`, `complete`,
`ambiguous`, `removed`, or `refused`; outcome `succeeded`, `refused`, or
`ambiguous`; one operation-specific
closed code, nullable canonical path/repository/registration/branch/base/HEAD
observations, path-safety and ownership verdicts, bounded tracked/modified/
untracked/ignored counts, nullable opaque evidence reference, and canonical UTC
observation time. Complete state requires canonical path, repository and
registration identities, base/HEAD identities, `safe`, and ownership match;
absent, removed, and refused states cannot smuggle a path/registration/branch/
HEAD value. `cleanupAttestationSha256` is null for the four non-cleanup
operations and exactly echoes the verified attestation digest for a successful
cleanup receipt. Receipt code, outcome, and state must form one allowed
combination.

A failed result contains only `ok: false` plus category, bounded stable code,
retryable/ambiguous flags, nullable canonical retry time, and nullable opaque
evidence reference. The workspace-v1 category set is exactly
`invalid_request`, `incompatible_contract`, `unauthorized`, `policy_denied`,
`not_found`, `conflict`, `stale_revision`, `busy`, `rate_limited`,
`resource_exhausted`, `transient_external`, `permanent_external`,
`ambiguous_external_state`, `cancelled`, and `integrity_failure`; categories belonging only to
other ports are rejected. Evidence references are null or 1–128 characters
matching `[A-Za-z0-9][A-Za-z0-9._:-]*`; a raw path, URL credential, message,
payload, SQL, stack, or secret is invalid.

The [completion and workspace contract](completion-workspace-contract.md) owns
the implemented durable generation topology, cleanup-attestation and
quiescence rules, Windows adapter path/reparse and physical ownership rules,
and integration/cleanup eligibility.
The [reliability protocol](reliability-protocol.md) owns intent, observation,
verification, finalization, response-loss, and restart handling.

## SchedulerBackend: `ato.scheduler/v1`

This pure exact contract kit and typed injected application owner are
implemented and exported. No production scheduler adapter, platform-specific
grammar, executable, task definition, registration factory, or default
product/API/CLI construction path exists. The unexported test Fake performs no
filesystem, process, network, clock, scheduler, SQL, or other external effect.

Outbound lifecycle operations are:

- `register`: a `scheduler.register` mutating-effect call binding schedule ID,
  schedule expression/timezone, dispatcher target identity, config revision,
  and idempotency key; it returns external registration identity and next-known
  trigger time;
- `inspect`: a `scheduler.inspect` read/inspection call observing exact
  registration identity, config revision, enabled state, and next-known trigger
  time; and
- `remove`: a `scheduler.remove` mutating-effect call with its own final
  authorization and persisted intent; it reports observed
  absent/present/ambiguous external registration state.

The trusted outer scheduled-ingress context supplies the configured scheduler
source adapter ID/version, configured receiving dispatcher target, actor,
principal, runtime-root identity, and current time. Its untrusted inner trigger
has exactly `contractId`, `triggerId`,
`scheduleId`, positive `configRevision`, canonical `scheduledFor`, canonical
`observedAt`, and bounded `claimedDeduplication`. The application resolves the
durable registration and configured target itself and requires their owning
source adapter and target to equal that trusted ingress context; neither
registration identity, adapter identity, target, actor, authorization, nor
dispatcher membership is accepted from trigger content. This scheduler source
identity is independent of the Manual execution adapter identity used after a
run is created.

All three are Task-, execution-, dispatcher-run-, and trigger-independent. Each
exact backend request contains `contractId=ato.scheduler/v1`, operation and
operation/correlation identities, schedule ID, positive config revision, and an
exact runtime-or-Project scope. Register additionally carries its idempotency
key, bounded opaque schedule expression/timezone, and dispatcher target; inspect
carries nullable external registration identity; remove carries its own
idempotency key and non-null external registration identity. The application
persists that request-bound identity and rejects any successful present-state
receipt that substitutes it. Unknown, missing,
accessor-backed, proxy-throwing, cross-operation, platform-specific, or
differently cased fields fail before backend dispatch. Actor, grants,
confirmation, durable intent, and authorization bindings remain inside the
application owner rather than entering this pure port shape.

A successful result contains only `ok: true` and one exact receipt. The receipt
binds contract, receipt/operation/schedule/config identities; nullable external
registration ID; external state `present|absent|ambiguous`; outcome
`succeeded|refused|ambiguous`; one operation-compatible closed code; nullable
enabled and next-trigger observations; nullable bounded evidence reference; and
canonical observed time. Code/outcome/state/nullability combinations are
closed and semantically revalidated by the application owner. A failed result
contains only `ok: false` and the shared closed category, bounded stable code,
exact retryable/ambiguous flags, nullable retry time, and nullable bounded
evidence reference. Throws or invalid adapter output become a closed integrity
failure, not raw exception disclosure.

Receipt `observedAt` is external evidence only. Application state transitions,
verification, and finalization use trusted ingress time. A retryable result is
not automatically ambiguous: a closed non-ambiguous failure is terminal
no-effect evidence, while only effect-possible or integrity-ambiguous outcomes
enter reconciliation.

The inbound `dispatch_trigger` shape contains contract ID, trigger ID, schedule
ID, scheduled time, observed delivery time, config revision, and the adapter's
claimed deduplication value. It contains no permission to mutate Tasks;
application ingress derives the authoritative tuple and separately
authorizes `dispatch.run` before any dispatcher work. Duplicate, missed-trigger, and worker-death semantics
belong to the [scheduler contract](scheduler-contract.md).

## ProjectPolicy: `ato.project-policy/v1`

This pure closed contract kit and the configured `local-project-policy`
adapter version `1.0.0` are implemented and exported. The local adapter takes
an immutable trusted configuration snapshot and returns deterministic bounded
receipts; it performs no filesystem, Git, network, SQL, grant, or Domain
mutation. The default product runtime and CLI do not construct it.

Operations are:

- `evaluate_mutation(action, subject, current_revision, proposed_change,
  external_target?)`;
- `completion_requirements(task, execution, workspace, head)`;
- `evaluate_integration(task, execution, workspace, source_head, target_ref,
  target_head)`; and
- `evaluate_cleanup(resource, ownership_receipt, observed_inventory)`.

Every operation uses the ProjectPolicy decision-input class and is strictly
non-mutating. It needs preliminary `policy.evaluate` authorization, not the
requested mutation's final decision or external-effect intent. Every policy
receipt contains policy ID, contract version, adapter version, config revision,
exact input identities, decision `allow|deny|defer`, stable reason code,
required gate IDs/versions, nullable validity end, and redacted evidence
reference.

A policy decision can narrow authority but cannot create a grant or perform the
requested effect. Only after this receipt exists may the authorization owner
compute a final decision and, after that allow, permit a mutating intent.
Project-specific gate names, commands, branch rules, or domain rules stay inside
policy/configuration and do not enter generic core.

## CompletionBackend: `ato.completion/v1`

This pure closed contract kit and the `local-completion` adapter version
`1.0.0` are implemented and exported. Trusted construction binds a finite gate
configuration, canonical executable identity, exact argument/environment tuple,
workspace identity, and separate retained evidence root. The workspace binding
also fixes the direct Git executable, Project/workspace directories, `.git`
pointer, linked Git directory, common/object namespaces, detached `HEAD`, lock
file, ownership manifest, repository identity, and locked worktree-registration
identities. Construction and every operation reject an escaped or changed
topology, unsafe repository configuration, ownership substitution, symbolic or
changed `HEAD`, and dirty inventory; `run_gate` repeats that check immediately
before spawning. The adapter invokes the executable directly with `shell=false`,
applies timeout/output bounds, and persists only closed metadata and output
digests. Raw output is neither a receipt nor durable application evidence. The
default product runtime and CLI do not construct it.

Operations are:

- `run_gate` (mutating-effect, `completion.gate.run`): consume a policy-required gate ID/version, Task/execution/workspace
  identities, exact repository HEAD, command/config reference, timeout, and
  idempotency key; return a gate receipt;
- `inspect_gate` (read/inspection, `completion.gate.inspect`): re-observe an earlier gate's evidence and bound identities
  without rerunning it; and
- `cancel_gate` (mutating-effect, `completion.gate.cancel`): request interruption and return request evidence, followed by
  inspection for the terminal observation.

A gate receipt adds gate ID/version, Task/execution/workspace/generation,
repository identity and HEAD object ID, policy/config revision, start/end time,
verdict `pass|fail|indeterminate`, tool/environment evidence reference, and
nullable validity end. Gate identity and freshness are owned by the
[completion and workspace contract](completion-workspace-contract.md#gate-identity-and-freshness).
The local evidence record additionally persists hashes of the physical
directory and result-file device/inode/mode identities. Inspection acquires the
leaf through a no-follow read descriptor and compares descriptor, pathname,
parent-directory, retained-root, single-link, byte-count, and final inventory
identities before accepting those hashes. Publication uses exclusive no-follow
descriptor creation and the same parent/root checks. Every device/inode value is
read through lossless BigInt stats and canonicalized without a JavaScript number
round-trip. Exact-byte replacement,
hardlinking, leaf or directory swaps, and reparse substitution therefore become
indeterminate evidence rather than a reopened pass.

## IntegrationBackend: `ato.integration/v1`

This pure closed contract kit and the `local-git-integration` adapter version
`1.0.0` are implemented and exported. The default product runtime and CLI do
not construct them. Trusted construction binds one canonical non-bare Project
repository, source workspace, distinct expected target/source SHA-1 objects,
target ref, Git executable identity, and canonical local bare destination/ref.
Repository content cannot select an executable, target, destination, protocol,
credential helper, hook, filter, or configuration override.

The binding records and reopens the Project, source, and destination repository
directories plus each Git directory, common directory, object namespace,
worktree directory, and `.git` control file/directory. Every one must remain
inside the trusted disposable root, the source must share the Project's exact
common/object identity, and the destination must remain bare. The source
ownership manifest, direct detached `HEAD`, lock file, clean inventory, and
locked worktree registration are stable-file/identity checked at construction,
on every inspection/preflight, and again immediately after the pre-effect
interlock before `update-ref` or push. Pointer replacement, metadata-only HEAD
advance, symbolic HEAD, external common/object state, alternates, or topology
identity drift refuses before a ref effect.

Operations are exactly:

- `inspect` (read/inspection, `integration.inspect`): observe both configured
  refs without mutation and classify the source-first local/remote tuple;
- `apply` (mutating effect, `integration.apply`): require a clean repository,
  prove the target is not checked out by any worktree, prove source descends
  from expected target, and invoke expected-old `update-ref` only; and
- `push` (mutating effect, `integration.push`): require local source state and
  invoke one ordinary non-force object-to-ref refspec only against the already
  validated local bare path. File transport is enabled only for that bound
  invocation; network protocols and repository-selected remotes remain closed.

The exact receipt codes are `inspected_unchanged`,
`inspected_local_applied`, `inspected_pushed`, `inspected_foreign`,
`inspected_ambiguous`, `applied`, `already_applied`, `apply_refused`,
`apply_ambiguous`, `pushed`, `already_pushed`, `push_rejected`, and
`push_ambiguous`. Every receipt has one non-null opaque evidence reference and
reports closed local/remote states plus nullable before/after objects. The
[completion and workspace contract](completion-workspace-contract.md#git-partial-success-protocol)
owns the exhaustive source-first equality and recovery meaning; the
[reliability protocol](reliability-protocol.md) owns durable intent and
finalization.

## Adapter error taxonomy

Every adapter error has `code`, one category below, `retryable`, `ambiguous`,
redacted message, correlation ID, nullable external reference, and nullable
`retry_after`. Category and flags MUST agree with this table:

| Category | Retryable | Ambiguous | Meaning |
| --- | --- | --- | --- |
| `invalid_request` | no | no | Port input fails its current schema or invariant. |
| `incompatible_contract` | no | no | Contract/API version negotiation failed. |
| `unauthorized` | no | no | Required external credentials or authority are absent. |
| `policy_denied` | no | no | Current policy explicitly denies the operation. |
| `not_found` | no | no | Exact target identity is proven absent. |
| `conflict` | no | no | Observed target identity conflicts with the expected one. |
| `stale_revision` | no | no | A bound revision or fence is stale. |
| `busy` | yes | no | A bounded local contention window expired before any effect. |
| `rate_limited` | yes | no | The external service requested delayed retry. |
| `resource_exhausted` | yes | no | A bounded resource is temporarily unavailable. |
| `transient_external` | yes | no | Inspection proves the requested effect did not occur and retry is safe. |
| `permanent_external` | no | no | The target rejected the effect with a stable terminal result. |
| `ambiguous_external_state` | no | yes | The adapter cannot prove whether or which effect occurred. |
| `cancelled` | no | no | Inspection proves the operation was cancelled. |
| `integrity_failure` | no | yes | Receipt, inventory, path, or returned identity cannot be trusted. |

An adapter cannot label a timeout or disconnected response `transient_external`
without a subsequent inspection proving no effect. Unknown codes map to
`ambiguous_external_state`, never to a retryable success path.
