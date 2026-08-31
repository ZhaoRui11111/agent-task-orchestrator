# Reliability protocol

## Status and authority

This file is the sole normative owner of the durable operation protocol:
semantic identity, claims, leases, fencing, idempotency, revision CAS,
intent/receipt/finalization, publication, recovery, retry propagation, and
observable fan-out. The current library implements execution claims, ordered
attempts, leases, per-Task fencing, exact CAS, restart readback, the corrected
`ato.execution/v1` port, one durable local Manual backend/control, and the
ordered intent/observation/verified-receipt/finalization protocol for start,
inspect, resume, retry, cancellation, Manual outcome reporting, verified
interruption, reconcile-first expired execution, and separately accepted Manual
completion. It also implements one explicit-Manual dispatcher with
durable run ownership/heartbeat/takeover, complete pre-claim reconciliation,
immutable finite membership, one terminal outcome per member, and
completeness-gated summaries. One typed product facade exposes only these
existing owners to explicit `ato.api/v2`, deriving non-public operation lineage
from current durable state. It has no SchedulerBackend or scheduled trigger,
workspace/publication, Codex/Git effect, ProjectPolicy, CompletionBackend, or
completion gate; those sections remain requirements for their implementing
plans.

Task-state meaning comes from the [domain contract](domain-contract.md), record
layout from the [persistence contract](persistence-contract.md), permission from
the [authorization contract](authorization-contract.md), and port shapes from
the [adapter contracts](adapter-contracts.md).

## Operation semantic identity and policy binding

Every operation that can cross a process, database transaction, or external
side-effect boundary has one persisted semantic identity tuple:

1. `operation_kind`;
2. `task_id` and expected Task revision, when Task-bound;
3. `execution_id` and attempt number, when execution-bound;
4. target `resource_kind`, stable resource ID, and expected resource revision;
5. semantic input revision or immutable input reference;
6. policy binding kind plus Project policy ID, policy contract version, and
   policy/config revision when Project-bound, or the canonical
   `system_not_applicable` binding from the final authorization decision when
   the action is proven system-scoped with no registered Project target;
7. adapter ID and adapter contract version; and
8. workspace generation and repository/HEAD identity when the effect consumes a
   workspace.

The canonical serialization of this tuple is the `semantic_key`. An indexed
digest may accelerate lookup, but the stored tuple remains authoritative and
MUST be compared before reuse. A change to any member creates a new semantic
identity and cannot reuse an earlier success.

Authorization decision ID is deliberately not a semantic member. The intent
stores its current allow reference and a binding revision. An immutable binding
chain begins with `prepare`; each adapter mutation requires a new `act` binding
immediately before invocation, and each result mutation requires a new
`finalize` binding in the finalization transaction. The same semantic operation
may CAS-bind such a fresh allow only when its request, decision, audit, actor,
action, Project resource/config revision and execution revision independently
match the entire tuple and name the same intent as their one consumer. The
Manual journal operation records the consumed `act` decision and the
finalization records the consumed `finalize` decision. Prior bindings,
decisions, and attempt evidence remain immutable. Every authorization
evaluation has a fresh attempt identity independent of the next successful
binding revision: denial does not advance the binding, and recovery after
authority changes must append a new evaluation rather than collide with or
reuse the denied row. A refreshed allow cannot change policy, input, target,
adapter, workspace, or any other semantic member under the old key.

An `idempotency_key` is allocated once for a semantic identity and persists
across safe retries of that same operation. Reusing a key with a different tuple
or payload is an integrity conflict. Policy results, source revisions, adapter
versions, or ignored external state MUST NOT be omitted merely because the
human-readable request looks the same.

The original claim tuple has no adapter, workspace, or external resource
identity to bind. Its persisted authoritative tuple therefore binds
operation kind, Task and expected revision, Project resource/config revisions,
trusted actor and lease owner, requested lease duration, and—only for
takeover—the exact predecessor execution, execution revision, lease revision,
and fencing token. The newly allocated execution ID and ordered attempt number
are the outcome. Claim/takeover reuse returns that persisted outcome only when
the complete applicable tuple and actor match; otherwise it is an integrity
conflict.

Current Manual-loop intents bind their operation kind and action, Project
resource/config revisions, Task/input revision, execution revision, attempt and
fence, local Manual policy binding, adapter/contract versions,
`workspace_mode=none`, authorization binding, requested deadline, and every
operation-specific backend/thread/continuation/cancellation/report identity.
Retry or expired safe continuation additionally binds the exact predecessor
execution/attempt/fence/observation. The stored tuple remains authoritative;
the semantic key and idempotency key cannot hide drift. The implementation
stores no workspace receipt, working directory, environment, prompt, source
content, path, or credential value.

## Claim, lease, and fencing

### Atomic claim

A claim transaction MUST, against one database snapshot:

1. re-evaluate domain eligibility;
2. obtain a current allow decision from the authorization envelope;
3. prove there is no valid active execution and no unfinished conflicting
   operation for the Task;
4. compare the caller's expected Task revision;
5. allocate the next attempt number and a strictly greater per-Task fencing
   token;
6. create the execution, lease owner, lease expiry, lease revision, and stable
   idempotency key; and
7. move the Task to `running` and append its audit event.

All seven effects commit or none do. At most one execution per Task can hold the
current valid claim. A query result obtained before this transaction confers no
claim.

The implemented initial claim performs this unit through the typed application
owner: request and final authorization decision, sequence/fence allocation,
attempt insertion, Domain `claim_accepted`, sanitized audit, and terminal
readback share one short transaction. Competing claims can produce only one
winner. No adapter call occurs in that transaction; a later explicit
`execution.start` operation must first commit its own intent.

### Lease rules

- A lease identifies `execution_id`, `claim_owner`, `lease_revision`,
  `fencing_token`, and an absolute UTC expiry.
- Renewal is a short CAS transaction matching all five current values. Its new
  expiry is exactly trusted operation time plus the bounded requested duration;
  it never accumulates duration from the old expiry or changes the fencing
  token. A request whose derived expiry would not move forward is rejected.
- Long-running work MUST NOT hold a process-long file lock or database
  transaction. A short OS lock may serialize a local publication step, but the
  durable lease and CAS remain authoritative.
- Expiry means the old owner may no longer mutate. It does not by itself prove
  that an external effect stopped or authorize a replacement execution.
- Takeover first reconciles every unfinished intent and external identity. Only
  a proven safe state may receive a strictly greater fencing token. Ambiguous
  state moves the Task to `waiting` rather than guessing.
- Every heartbeat, receipt, finalization, workspace mutation, and completion
  decision from a worker carries its execution ID and fencing token. A value
  lower than or different from the current token is rejected before mutation.

The direct effect-free takeover shortcut is unavailable when reliable-loop state
contains an unfinished intent, Manual journal operation, or terminal evidence.
The typed claim service returns `RECONCILIATION_REQUIRED`; the Manual loop first
performs authorized independent inspection and persists the result. Only a
proven safe continuation may atomically supersede the predecessor and create
the next attempt/fence while preserving source lineage. Unknown state moves the
Task to complete `waiting/ambiguous_external_state` metadata. The old
attempt/owner/fence remains immutable history and every late write is refused.

## Revision CAS

Every Task or owned-resource mutation carries an expected revision obtained
from authoritative ingress. The accepting transaction compares that revision
and increments the resource according to its owner. On mismatch it performs no
partial mutation, no audit success, and no external effect, and returns a typed
stale-revision conflict. Retrying requires a fresh read and a new semantic
decision; blindly substituting the latest revision is prohibited.

A verified receipt cannot bypass CAS. Finalization compares the current intent,
Task, execution, fence, policy revision, and target resource identity. An
identical already-finalized outcome is an idempotent success; any different
current state is reconciled explicitly.

## Intent, receipt, verification, and finalization

The local Manual execution loop implements this section. Other
adapters, publication, workspace, completion gates, and dispatcher fan-out do
not inherit that evidence.

### Intent state set

The complete durable intent state set is:

`pending`, `executing`, `observed`, `verified`, `finalized`, `retry_wait`,
`ambiguous`, and `failed`.

- `finalized` and `failed` are terminal for that semantic identity.
- `ambiguous` may leave only after new authoritative observation or an explicit
  user decision permitted by policy; it is never auto-converted to success.
- `retry_wait` may return to `executing` only with the same semantic tuple and
  idempotency key and after its retry condition is satisfied. It durably keeps
  the exact closed adapter category/code, retryable/ambiguous flags, nullable
  `retry_after`, and monotonically increasing retry count; it is not immediately
  finalized or converted to Task success/waiting.

### Ordered protocol

1. **Prepare:** inside a transaction, run all pre-mutation checks, persist the
   complete intent as `pending`, and commit.
2. **Mark possible effect:** CAS `pending` or eligible `retry_wait` to
   `executing` and commit before invoking the adapter. From this point a crash is
   treated as though the effect may have occurred.
3. **Act:** recheck the current final allow and invoke the adapter outside a
   database transaction with its decision reference, the persisted idempotency
   key, expected resource identity, policy binding, and fencing token. If the
   decision is no longer current, obtain and CAS-bind a matching fresh allow or
   do not call.
4. **Observe:** independently inspect the authoritative external post-state.
   Every invocation appends a fresh current `execution.inspect` evaluation;
   an earlier allow whose adapter response was lost and an earlier denial are
   immutable history, not reusable or permanently cached authority.
   Persist an immutable receipt containing exact pre/post identity, observation
   number and time, adapter receipt, and a verification verdict; move to
   `observed`.
5. **Verify:** compare the observation with the intent, policy, adapter contract,
   inventory, and expected postcondition. A positive match moves to `verified`;
   unknown or conflicting evidence moves to `ambiguous` or `failed`.
6. **Finalize:** in one CAS transaction, re-check revision, fence, receipt
   freshness, and the current bound authorization; apply the domain/result
   mutation, append audit evidence, and move the intent to `finalized`. An
   expired authorization requires a matching fresh allow to be CAS-bound first;
   it never permits replay of the external effect.

An adapter return value is evidence to inspect, not automatic proof. A receipt
proves only what its verification verdict and bound identity say. An external
effect is never performed before its durable intent, and a terminal domain
result is never accepted before verified finalization.

## Private staging and publication

This section is a later-phase requirement and is not implemented by the
execution-claim foundation.

Any replaceable artifact or shared publication uses a run/generation namespace
not visible as the current result:

1. allocate an unambiguous private stage bound to operation ID, creator ID, and
   generation;
2. write only within that stage and record a complete inventory of expected
   files, tables, keys, or partitions plus their authoritative identities;
3. close writers, validate every inventory member, and persist a verified stage
   receipt;
4. acquire only the short publication coordination required by the owner;
5. compare the expected current generation/resource revision;
6. publish through one atomic replace or pointer CAS; and
7. reopen the published identity and persist terminal publication evidence.

A stage path, completed writer, or atomic rename alone is not terminal evidence.
Terminal evidence binds the operation identity, complete inventory, published
generation, expected prior identity, observed new identity, and successful
readback. Readers consume the published manifest/pointer, never a guessed latest
directory or glob.

Only the creator may remove its private, unpublished stage, and only after
revalidating creator and generation identity. Unknown residue is quarantined or
reported; it is not adopted or deleted.

## Recovery matrix

| Observed recovery point | Required outcome |
| --- | --- |
| No committed intent | No external call is assumed or replayed. Re-run begins with a new or deterministically recovered intent. |
| `pending` | CAS to `executing` and call once, or abandon with an audited terminal failure before any call. |
| `executing`, no receipt, current live owner/fence | Inspect Manual state first. The same semantic operation may use its unchanged idempotency key only when the port's idempotency rule makes response-loss replay safe; otherwise enter `ambiguous`. |
| `pending` or `executing`, expired/foreign owner fence | Do not invoke the old-fence mutation. Reconcile by inspection only; an absent local Manual start journal is terminal no-effect evidence, while any unprovable state becomes `ambiguous`. Only after every intent is finalized may takeover allocate a higher attempt/fence. |
| External effect present, no receipt | Construct a new observation from authoritative external state, verify it, and continue; do not repeat the effect. |
| `observed` | Re-run verification against the bound tuple and current policy. |
| `verified`, not finalized | Re-run finalization CAS. A conflict leaves the effect recorded and routes reconciliation; it does not fake rollback. |
| `finalized` | Revalidate the persisted actor/principal and current runtime-root identity, then return the persisted outcome without another effect. |
| Expired lease | Fence the old worker, reconcile its intents, then either take over with a higher token or enter `waiting`. |
| Ambiguous observation | Preserve receipts and actual external state, enter `waiting/ambiguous_external_state`, and require new evidence or an authorized user decision. |

## Mandatory failure handling

- **Lock or lease loss:** stop mutation immediately, close private writers, and
  let the current owner/reconciler observe durable state. A late result cannot
  write through the lost fence.
- **Partial stage:** never publish it. Validate the creator receipt before
  creator-owned cleanup; otherwise retain and report it.
- **Publication CAS conflict:** keep the prior publication current, persist the
  conflict and stage identity, and re-read the winner. Do not overwrite or
  delete the winner.
- **Interrupted reader:** discard the interrupted snapshot, reopen the current
  manifest/pointer, and validate its complete inventory. It sees either the old
  or new complete generation, never a mixed reconstruction.
- **Receipt or policy staleness:** do not finalize. Re-observe and obtain a new
  decision under current identity.
- **Exception propagation:** adapter, storage, verification, and finalization
  failures become typed outcomes with correlation IDs. They are not swallowed,
  converted to empty success, or used to unlock dependencies.

## Retry and failure propagation

A response-loss retry of one existing operation is allowed only when policy
permits it, the complete semantic identity is unchanged, and authoritative
inspection or exact adapter idempotency makes replay safe. It keeps the same
idempotency key and effect. An explicit Task `retry` after verified waiting is a
new semantic operation: the current Manual loop creates the next execution
attempt and fence, binds the exact predecessor evidence, and allocates its own
idempotency key. A changed input, policy, adapter contract, expected revision,
or replacement execution likewise requires a new semantic identity. A
retryable, non-ambiguous adapter refusal first persists `retry_wait`; calls
before its nullable due time return that durable state without another adapter
call, and a due retry reauthorizes and invokes the same operation/key. The
adapter's exact bounded category, code, flags, retry time, and count remain
observable in durable intent evidence.

Non-retryable failures move the intent to `failed` and the owning Task to the
appropriate domain outcome. Resource, rate, disk, authorization, compatibility,
and ambiguity outcomes are propagated to complete waiting metadata rather than
hidden inside logs. Retry exhaustion is an observable failure; it is never a
successful finalization.

## Observable fan-out

The explicit-Manual dispatcher implements this section. The
reliable Manual loop remains the sole owner of each claimed
member's adapter effect and receipt/finalization path; the dispatcher owns only
ordering, durable run recovery, and complete member accounting.

After reconciliation and before any candidate claim or candidate-bound external
action, each dispatcher sweep atomically seals its complete finite candidate
membership. The seal stores an immutable snapshot revision, expected member
count, and one `pending` row per candidate with a distinct contiguous ordinal,
Task ID, and candidate Task revision. The empty set is an explicit sealed
snapshot with expected count zero. Until that transaction commits, the run
cannot process a candidate; an in-memory query result is not membership
evidence. A sealed set is immutable and cannot be replaced by a later
eligibility query.

Each sealed member reaches exactly one terminal outcome from this finite set:

- `claimed`;
- `already_claimed`;
- `ineligible_at_cas`;
- `authorization_denied`;
- `policy_deferred`;
- `resource_deferred`;
- `reconciliation_required`; or
- `failed`.

The member transition CAS-matches run ID, snapshot revision, current run-worker
identity and owner revision, ordinal, Task ID/revision, pending lifecycle, and
candidate-row revision. The successful claim transaction also records
`claimed`; a no-claim path records its terminal outcome atomically with any
related domain/audit mutation. Thus a crash cannot leave an effective claim
without its outcome, and a stale worker cannot resolve a member after ownership
changes. Every terminal row binds one closed reason code and any applicable
created execution/intent ID; the run's immutable trigger/decision/audit lineage
carries the correlation identity.

A fully bound `execution.start` denial is a no-effect member outcome with its
own immutable request/decision/audit triple. That evidence binds the proposed
execution identity without creating it and commits atomically with the denied
member; Task state remains `ready` and no intent or adapter call exists. The
combined decoder rejects a missing, orphaned, mismatched, duplicated, or
unknown denial record after restart.

While reconciliation and fan-out are in progress, the owner performs
forward-only heartbeat CAS before and after each potentially long resource or
member operation and carries the new run revision forward. This permits a live
owner to finish work lasting longer than one requested lease window without
banking expiry. An operation that reaches expiry before its next checkpoint
fails closed; only a different current worker identity may take over at the
exact expiry boundary.

Crash recovery takes run ownership with a higher owner revision, enumerates the
sealed rows rather than repeating the eligibility query, and treats every
`pending` row as unresolved. It reconciles any bound execution, intent, receipt,
and Task state, then CAS-records one explicit outcome above; ambiguous underlying
work uses `reconciliation_required` rather than inferred success. Recovery never
drops, adds, reorders, or silently treats a member as processed. If the worker
died before the seal committed, no candidate work was permitted and there is no
fan-out summary to reconstruct.

The terminal run summary is generated from durable rows only when the stored
expected count equals total rows and distinct Tasks, ordinals are unique and
contiguous from zero, every row matches the sealed snapshot revision, and every
member is terminal. Summary publication and terminal run status share a
run-owner/revision CAS. A mismatch leaves the summary absent, produces an
integrity/recovery failure, and cannot claim successful or complete fan-out.
The summary counts each finite outcome and retains the member reason/error
accounting from which those counts were derived.
Resource exhaustion may defer Tasks, but a sweep MUST NOT silently stop after
the first success or leave later candidates without an observable terminal
outcome.
