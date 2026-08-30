# Scheduler contract

## Status and authority

This file is the sole normative owner of planned reconcile-first scheduling and
duplicate-trigger, missed-trigger, and dispatcher-worker-death semantics. No
scheduler registration, hourly trigger, daemon, or supported platform behavior
exists today.

The scheduler delivers hints; it is not the owner of Task eligibility or
exactly-once correctness. Trigger shapes are defined by the
[adapter contracts](adapter-contracts.md#schedulerbackend-atoschedulerv1), and
claims, fencing, recovery, and fan-out outcomes by the
[reliability protocol](reliability-protocol.md).

## Trigger and run identity

- The authoritative scheduled deduplication identity is exactly
  (`schedule_id`, schedule config revision, intended `scheduled_for` instant).
  Core derives it after typed ingress; an adapter-provided trigger ID or claimed
  deduplication string is observation data and cannot replace the tuple.
- Every delivered trigger creates a durable trigger-observation record with its
  adapter/contract identity, delivery time, sanitized fields,
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
- A manual trigger has no scheduled tuple. Each allowed schema-valid manual
  observation creates its own `starting` canonical run bound to its final allow
  decision. Denial records only an unattached observation and no run. A manual
  trigger is never deduplicated merely because it arrived near a scheduled one.
- A run has status `starting`, `reconciling`, `sweeping`, `completed`, `partial`,
  `failed`, or `interrupted`.
- Schedule cadence affects latency only. It does not grant permissions, reserve
  a Task, or change Task state.

Trusted ingress derives the scheduler actor and evaluates `dispatch.run` before
the ingress transaction. Tuple ownership, the allow/deny canonical run record,
and every delivery observation then follow the schema/index/transaction rules in the
[persistence contract](persistence-contract.md#transaction-and-repository-boundary) before
dispatcher work begins. A malformed or stale-config delivery is still observed
but cannot derive a current tuple and creates no run.

## Reconcile-first run order

Every allowed dispatcher run that enters `starting` performs these phases in
order:

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

A missed, delayed, disabled, or lost trigger leaves durable Task, lease, intent,
and receipt state unchanged. The next scheduled or manual run performs the full
reconcile-first sequence and may claim every then-eligible Task. Correctness
does not depend on replaying every missed wall-clock interval.

Clock jumps or timezone changes cannot manufacture a prior run completion. The
adapter reports scheduled and observed instants separately; deduplication uses
the bound schedule config revision and intended instant. An unresolvable clock
or config mismatch is recorded and deferred rather than guessed.

## Worker death

- A live run updates a durable heartbeat while it owns dispatcher work; Task
  executions use their separate durable leases and fences.
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

An hourly schedule is a planned v0.1 target only. It becomes a support claim
only with the exact platform and scheduler evidence required by the
[compatibility contract](versioning-compatibility-contract.md).
