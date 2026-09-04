# Scheduler contract

## Status and authority

This file is the sole normative owner of the implemented explicit-Manual and
scheduled-ingress reconcile-first dispatcher order, durable schedule lifecycle,
duplicate scheduled-trigger, missed-trigger, and dispatcher-worker-death
semantics. The package implements the pure exact `ato.scheduler/v1`, one typed
injected scheduler application owner, and scheduled delivery into the existing
dispatcher. No concrete SchedulerBackend, platform registration, cadence
parser, real scheduled task, daemon, or supported platform behavior exists.
Current `ato.api/v1` `dispatch run` and `dispatch resume` remain the only product
triggers; scheduler operations and delivery are library-only.

The scheduler delivers hints; it is not the owner of Task eligibility or
exactly-once correctness. Trigger shapes are defined by the
[adapter contracts](adapter-contracts.md#schedulerbackend-atoschedulerv1), and
claims, fencing, recovery, and fan-out outcomes by the
[reliability protocol](reliability-protocol.md).

## Trigger and run identity

- For scheduled delivery, the authoritative deduplication identity is exactly
  (`schedule_id`, schedule config revision, intended `scheduled_for` instant).
  Core derives it after typed ingress; an adapter-provided trigger ID or claimed
  deduplication string is observation data and cannot replace the tuple.
- A delivered scheduled trigger creates a durable trigger-observation record with its
  configured scheduler-source adapter/contract identity, configured receiving
  dispatcher target, delivery time, sanitized fields,
  `attachment_role=canonical|duplicate|none`, and disposition
  `accepted|authorization_denied|rejected_stale_config|malformed`.
  Repeated delivery of the same external trigger ID remains a new observation.
- The first allowed, schema-valid, current-config observation for one scheduled
  tuple creates exactly one canonical `dispatcher_run`, bound to its final
  `dispatch.run` allow decision and left `starting`. Every later allowed
  observation for that tuple references that same run while retaining its own
  decision/disposition. A valid duplicate never creates another run or restarts
  a terminal one. A denied observation is recorded unattached and creates no
  tuple, run, Task, or external effect; a later allowed delivery may still
  create the tuple's canonical run.
- The implemented Manual trigger has no scheduled tuple. Each allowed
  schema-valid Manual
  observation creates its own `starting` canonical run bound to its final allow
  decision. Denial records only an unattached observation and no run. A manual
  trigger is never deduplicated merely because it arrived near a scheduled one.
- A run has status `starting`, `reconciling`, `sweeping`, `completed`, `partial`,
  `failed`, or `interrupted`.
- Schedule cadence affects latency only. It does not grant permissions, reserve
  a Task, or change Task state.

Scheduled ingress derives the scheduler actor and evaluates `dispatch.run` before
the ingress transaction. Tuple ownership, the allow/deny canonical run record,
and every delivery observation then follow the schema/index/transaction rules in the
[persistence contract](persistence-contract.md#transaction-and-repository-boundary) before
dispatcher work begins. Acceptance revalidates, in that transaction, the exact
active registration, its owning scheduler-source adapter ID/version, the
configured receiving dispatcher target, any current enabled Project binding and
both Project revisions, and `scheduled_for <= observed_at <= trusted received_at`.
The scheduler-source identity never replaces the separately configured Manual
execution adapter identity used by the resulting dispatcher run. A malformed or
stale-config delivery is still observed but cannot derive a current tuple and
creates no run.

## Schedule lifecycle

The exact lifecycle operations are `register`, `inspect`, and `remove` under
`ato.scheduler/v1`. A configuration binds the schedule ID and positive config
revision to an exact runtime or Project scope, bounded schedule expression,
timezone, and dispatcher target. Core does not parse cadence, compute a future
instant, normalize timezones, or let those values select an executable,
credential, path, adapter, or authority.

`scheduler.register` and `scheduler.remove` are separately confirmed high-risk
mutations. Each obtains a current exact grant, persists its semantic intent and
prepare authorization before backend access, and obtains a fresh named
confirmation while re-evaluating current authority at the final point-of-use
Act. It calls only the injected backend outside every
writer transaction, independently parses/observes/verifies the result, and then
CAS-finalizes the registration projection by consuming that bound allowed Act
decision under the current intent/registration tuple. The operation request
durably binds the nullable/non-null external registration identity used by
inspect/remove, and a result may not substitute it. Every durable inspect or
remove observation whose request has a non-null identity repeats that exact
identity, including absent, ambiguous, and failure observations. The durable
observation is an application projection rather than the raw adapter object, so
an accepted absent response retains the request identity while its external
state remains `absent`. An ambiguous remove projection retains the same identity,
and reconciliation derives it from the immutable original remove request rather
than from the mutable registration projection. Response loss or an
effect-possible failure is ambiguous until an exact later inspect proves present
or absent state; a retryable but non-ambiguous no-effect failure is terminal and
never becomes replay authority. Adapter `observedAt` is retained only as bounded
external evidence; trusted lifecycle times come from ingress. Idempotent replay
must match the full operation tuple.

`scheduler.inspect` is a distinct authorized read. It records a fresh request,
decision, bounded backend observation, and event, but creates no mutation
intent, effect idempotency key, verified mutation receipt, finalization, or
registration-state write. It may be used by reconciliation of a prior ambiguous
register/remove intent; the resulting proof remains bound to that original
intent before finalization.

The package exports this injected application surface but no backend factory.
The only implementation used by tests is an unexported deterministic no-effect
Fake. Default product/runtime/API/CLI code cannot construct a scheduler backend
or invoke these operation methods.

## Reconcile-first run order

Every allowed explicit-Manual or scheduled dispatcher run that enters
`starting` performs these phases in order:

1. verify the canonical run and its trigger observation are durably linked;
2. reconcile unfinished external intents, verified-but-unfinalized receipts,
   expired leases, stale runs, and partial publications;
3. persist a complete reconciliation summary;
4. only then atomically seal the complete finite candidate membership before
   any candidate claim or candidate-bound external action;
5. resolve every sealed member through the reliability fan-out protocol; and
6. persist the per-candidate summary and terminal run status only after durable
   completeness checks pass.

A reconciliation failure affecting one resource prevents a new claim for that
resource and yields an observable outcome, but does not silently suppress
independent candidates. A process restart never skips reconciliation based on
an in-memory clean flag.

## Duplicate triggers

Manual triggers intentionally create distinct runs, subject only to exact
request idempotency replay for the same observation identity. Scheduled
deliveries use the tuple rule below.

The scheduler provides at-least-once delivery semantics. Concurrent deliveries
of one scheduled tuple race only to create its unique persisted tuple row and
canonical run. The unique winner is reused inside the ingress transaction; all
losers persist observations with `attachment_role=duplicate` referencing it.
Even a race cannot create a second run for the same tuple.

Suppressing a duplicate MUST NOT suppress reconciliation evidence. Each
delivered trigger has its own attachment role and accepted, authorization-
denied, stale-config, or malformed disposition. Denied, stale, or malformed
input creates no run and stores no unbounded raw payload. An allowed observation
for an existing tuple references its canonical run but cannot restart it.
Exactly-once scheduler delivery is neither required nor claimed; uniqueness
applies to the canonical scheduled run, not delivery.

## Missed triggers and clock changes

The durable handling below is implemented; production cadence calculation and
platform clock/timezone behavior remain unselected because no concrete adapter
exists.

A missed, delayed, disabled, or lost trigger leaves durable Task, lease, intent,
and receipt state unchanged. The next scheduled or manual run performs the full
reconcile-first sequence and may claim every then-eligible Task. Correctness
does not depend on replaying every missed wall-clock interval.

Clock jumps or timezone changes cannot manufacture a prior run completion. The
adapter reports scheduled and observed instants separately; deduplication uses
the bound schedule config revision and intended instant. An unresolvable clock
or config mismatch is recorded and deferred rather than guessed.

## Worker death

The run-owner heartbeat, exact-expiry takeover, stale-owner fencing, and sealed
member recovery rules below apply identically to explicit Manual and scheduled
runs.

- A live run performs forward-only heartbeat CAS at bounded checkpoints around
  each reconciliation resource and sealed-member reliable-loop operation,
  carrying the resulting run revision into the next mutation. Task executions
  use their separate durable leases and fences. A checkpoint at or after run
  expiry cannot renew or resurrect the same owner.
- If a worker dies, no in-memory callback or process cleanup is treated as
  evidence of external failure or cancellation.
- A later worker observes an expired heartbeat and CAS-takes recovery ownership
  of the old run with a higher owner revision, fencing the former worker. It
  reconciles every operation/lease and, when a candidate snapshot was sealed,
  every durable `pending` member before the later run sweeps new candidates.
- The old run becomes `interrupted` only after its sealed membership has no
  unresolved member and the summary completeness CAS succeeds. If death
  preceded the atomic membership seal, no candidate action was permitted; the
  old run may become `interrupted` without a fan-out summary after its other
  durable work is reconciled.
- Existing valid execution leases remain valid even when the scheduling worker
  dies. Expired execution leases follow the reliability takeover rules.
- A run killed after membership sealing but before summary publication is
  rebuilt from durable member rows. Recovery explicitly terminalizes every
  unresolved row; a missing or inconsistent member blocks the summary and is
  never inferred as success.

Any concrete cadence or platform scheduler becomes a support claim only with
the exact adapter and environment evidence required by the
[compatibility contract](versioning-compatibility-contract.md). The current
Fake/library evidence explicitly records `adapterImplemented=false`,
`externalE2E=not_run`, and `supportClaim=false`.
