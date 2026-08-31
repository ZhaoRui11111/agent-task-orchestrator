# Adapter contracts

## Status and direction

This file is the sole normative owner of port directions, current port
identifiers and versions, operation shapes, receipt envelopes, and adapter
error taxonomy. The package implements the pure `ato.execution/v1` contract
kit, one production `manual-local` adapter backed by the current schema-version-1 local Manual
journal, and its narrow `ato.manual-outcome-control/v1` control. The Fake
backend is test-only and unexported. The Manual dispatcher composes that
unchanged execution port and adds no adapter contract. The explicit
`ato.api/v2` product facade can invoke the dispatcher and reliable loop, but it
does not change `ato.execution/v1`, turn the local journal into Task-content
execution, or add an adapter. Workspace,
Scheduler, ProjectPolicy, and Completion ports remain planned. No vendor,
operating system, external API, or released product platform is currently
supported.

Business rules remain with their linked owners. An adapter translates a
versioned port and cannot change Task state semantics, authorize an operation,
declare an unverified external effect successful, or write SQLite directly.

| Port | Direction relative to core | Current contract ID | Responsibility boundary |
| --- | --- | --- | --- |
| Execution | Outbound: reliable application loop calls adapter; the implemented Manual dispatcher calls that loop | `ato.execution/v1` | Start, resume, inspect, or request cancellation of one no-workspace execution turn |
| Workspace | Outbound: dispatcher calls adapter | `ato.workspace/v1` | Reserve, create, inspect, recover, or request cleanup of an isolated workspace |
| Scheduler | Outbound lifecycle plus inbound trigger delivery | `ato.scheduler/v1` | Register/inspect/remove a schedule and deliver a bounded dispatch trigger |
| ProjectPolicy | Outbound: application calls adapter | `ato.project-policy/v1` | Evaluate mutation, completion requirements, integration, and cleanup policy |
| Completion | Outbound: application calls adapter | `ato.completion/v1` | Run and inspect named completion gates and return bound gate evidence |

The [versioning and compatibility contract](versioning-compatibility-contract.md)
owns how these versions evolve and which version combinations may be claimed as
compatible. This file owns the current shapes.

## Operation-class envelopes

Every call contains its exact `contract_id`, adapter ID/version, correlation ID,
requested deadline, and only opaque references to sensitive input. It then uses
exactly one class below; fields from another class are not required null
placeholders. Each operation section states which Project, Task, execution, run,
trigger, workspace, or schedule identities are applicable.

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

This shape remains planned; the implemented dispatcher accepts only its own
typed explicit-Manual trigger and does not implement `ato.scheduler/v1` or a
scheduled delivery channel.

An inbound trigger contains scheduler adapter/contract and registration
identity, trigger ID, schedule ID, scheduled instant, observed delivery instant,
config revision, and the adapter's claimed deduplication value. It contains no
caller-asserted actor, Task, execution, run, mutating intent, or final
authorization. Typed outer ingress bounds and authenticates the delivery
channel, derives the registered scheduler actor from that trusted identity, and
ensures a sanitized observation is persisted even when the inner trigger is
malformed. A valid inner shape derives the authoritative scheduled tuple and is
bound to a final `dispatch.run` allow/deny before the ingress transaction. That
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

## ExecutionBackend: `ato.execution/v1`

Before its first implementation, EP-02B corrected the planned `start` shape
from `execution.claim` plus workspace/working-directory/environment fields to
the distinct `execution.start` action and `workspace_mode=none`. Repository
evidence showed no earlier port implementation, export, negotiation, persisted
receipt, or consumer, so no shipped artifact was reinterpreted. The v1 shape
below is now implemented and closed: adding a required field, changing an
action/side effect, or changing receipt/error meaning requires a new major.

Every operation carries the exact contract/adapter/version/correlation/deadline
envelope and a semantic identity containing Project resource/config revisions,
Task/input/execution/attempt/fence revisions, local policy binding, and
`workspace_mode=none`. It contains no workspace receipt, working directory,
environment, prompt, source content, path, or credential value.

Operations are:

- `start` (mutating-effect, `execution.start`): input adds committed
  operation/intent/idempotency and final-allow identities to the common semantic
  tuple. Receipt adds backend execution ID, nullable durable thread ID,
  `workspace_mode=none`, and lifecycle `started|deferred|rejected`.
- `resume` (mutating-effect, `execution.resume` or `execution.retry`): input adds the existing backend execution/thread ID, continuation
  reference, previous turn receipt, and expected thread identity. Receipt adds
  observed thread ID and lifecycle. Returning a different thread is a conflict,
  not an implicit replacement.
- `inspect` (read/inspection, `execution.inspect`): input identifies the backend execution/thread and last observation.
  Receipt adds lifecycle `unknown|queued|active|waiting|turn_succeeded|failed|cancelled`
  and a redacted result/evidence reference. Shape and digest validity do not make
  it authoritative: the reliable owner must match the exact durable Manual turn
  identity, semantic tuple, revision, lifecycle, code, and evidence. A
  `cancelled` receipt additionally requires the exact durable request-cancel and
  `confirm_cancelled` operation lineage; a forged but well-shaped receipt cannot
  terminalize a Task.
- `request_cancel` (mutating-effect, `execution.cancel`): input adds expected backend lifecycle and cancellation
  reason code. Receipt reports `requested|already_terminal|rejected`; only a
  later inspection can prove interruption.

`turn_succeeded` is an execution-turn fact, never a Task completion decision.
Raw prompt, source content, and credentials follow the
[privacy and logging contract](../security/privacy-and-logging.md).

The implemented local Manual backend persists an exact idempotent turn and
operation journal and exposes independent `inspect`; it never authorizes an
operation, changes a Task, or executes Task content. Its separate
`ato.manual-outcome-control/v1` accepts only the closed
`activate|wait|succeed|fail|confirm_cancelled` report set through the
application-owned, trusted current OS/runtime-derived actor/principal/root path. Each report binds the
same semantic identity, current `execution.inspect` allow, a fresh
`manual.turn.report` confirmation, expected journal revision/lifecycle, and
bounded code/evidence reference. Terminal Manual lifecycles are immutable, and
`confirm_cancelled` additionally requires an exact prior cancellation-request
revision. The loop then inspects through `ato.execution/v1`; the control return
is not itself finalization or completion evidence. Immediately before every
journal mutation the backend requires the intent's current fresh Act binding
and rechecks its referenced finite grant; replay may return an already committed
operation, but a new mutation cannot consume a revoked, expired, stale, or
prepare-only decision.

## WorkspaceBackend: `ato.workspace/v1`

Operations are:

- `reserve` (mutating-effect, `workspace.reserve`): binds Project repository identity, execution, requested generation,
  base object ID, and trusted workspace-root identity;
- `create` (mutating-effect, `workspace.create`): consumes the reservation and returns canonical path, workspace ID,
  generation, repository identity, branch/ref, base/head object IDs, inventory,
  and ownership receipt;
- `inspect` (read/inspection, `workspace.inspect`): returns current canonical path, Git registration, branch/ref,
  base/head, dirty/untracked/ignored summary, path-safety verdict, and ownership
  match without mutation;
- `recover` (mutating-effect, `workspace.recover`): consumes an unfinished workspace intent and returns observed
  absent/partial/complete/ambiguous state plus the same identity fields; and
- `cleanup` (mutating-effect, `workspace.cleanup`): consumes a current cleanup allow decision and ownership receipt and
  reports refused/removed/partial with an exact observed inventory.

The [completion and workspace contract](completion-workspace-contract.md) owns
topology, receipt meaning, path/reparse checks, and cleanup eligibility.

## SchedulerBackend: `ato.scheduler/v1`

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

All three are Task-, execution-, dispatcher-run-, and trigger-independent. Their
scope is the exact system/Project schedule resource; `register` and `remove`
still require the full mutating envelope, while `inspect` requires the read
envelope.

The inbound `dispatch_trigger` shape contains contract ID, trigger ID, schedule
ID, scheduled time, observed delivery time, config revision, and the adapter's
claimed deduplication value. It contains no permission to mutate Tasks;
application ingress derives the authoritative tuple and separately
authorizes `dispatch.run` before any dispatcher work. Duplicate, missed-trigger, and worker-death semantics
belong to the [scheduler contract](scheduler-contract.md).

## ProjectPolicy: `ato.project-policy/v1`

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
