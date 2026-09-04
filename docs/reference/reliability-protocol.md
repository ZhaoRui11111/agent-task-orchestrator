# Reliability protocol

## Status and authority

This file is the sole normative owner of the durable operation protocol:
semantic identity, claims, leases, fencing, idempotency, revision CAS,
intent/receipt/finalization, publication, recovery, retry propagation, and
observable fan-out. The current library implements execution claims, ordered
attempts, leases, per-Task fencing, exact CAS, restart readback, the sole current
`ato.execution/v2` port, one durable local Manual backend/control, one
package-private non-composed Codex SDK backend/journal, and the
ordered intent/observation/verified-receipt/finalization protocol for start,
inspect, resume, retry, cancellation, Manual outcome reporting, verified
interruption, reconcile-first expired execution, and separately accepted Manual
completion. The Codex branch adds exact owned-workspace/HEAD/cwd and verified
ephemeral-input binding, durable thread/terminal evidence, and ambiguity without
blind replay; it is not exposed through a supported package-root or product
factory and does not add operational authorization. It also implements one
explicit-Manual dispatcher with
durable run ownership/heartbeat/takeover, complete pre-claim reconciliation,
immutable finite membership, one terminal outcome per member, and
completeness-gated summaries. One typed product facade exposes only these
existing owners to the sole current `ato.api/v1`, deriving non-public operation
lineage from current durable state. The fresh-only Phase 3 library additionally
implements pure `ato.project-policy/v1`, `ato.completion/v1`,
`ato.integration/v1`, and sole current `ato.workspace/v2` ports; durable policy
receipts, completion gates and decisions, integration reservations/effects/
recovery, cleanup attestations, and generic completion/terminal-execution
convergence. Its configured local adapters perform bounded gate, expected-old
local ref, configured local-file push, and owner-attested cleanup effects
outside writer transactions. The default product runtime and CLI construct none
of them. There is still no SchedulerBackend or scheduled trigger, MCP,
product-wired Codex route or Codex credential/destination authority, general
network integration, release, deployment, real Codex account E2E, or
platform-support claim.

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
backend journal operation records the consumed `act` decision and the
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

Current package-private Codex intents bind the same common tuple plus
`backend_kind=codex-sdk`, `workspace_mode=owned`, the exact current
`ato.workspace/v2` workspace ID/generation/revision/root key, ownership-binding
digest and HEAD object, and `task-sha256` input reference. The raw Task body is
rederived only at the effect boundary, bounded to 1 MiB, compared with that
reference before intent/effect and again by the backend, and never stored in an
intent, journal, receipt, audit row, or default result. Start/resume also bind
the exact SDK backend/endpoint, and continuation binds the predecessor
execution/thread/receipt while requiring a new fenced successor execution.

Current workspace intents bind the exact reserve/create/inspect/recover/cleanup
action, Project resource/config/root identity, Task revision, dispatcher run/
member/membership revisions, execution revision/attempt/fence, system workspace
ID/generation/revision, trusted workspace-root identity, creator operation,
base reference, application-derived immutable ownership-binding digest,
nullable cleaned predecessor, adapter/contract versions, correlation/causation,
expected generation status, and a null cleanup attestation for every
non-cleanup operation. Cleanup additionally binds the exact current
application-issued `ato.workspace-cleanup-attestation/v1` record. A stable workspace ID
does not weaken this tuple: reuse requires the same positive generation and
revision, while replacement requires the exact cleaned predecessor and
generation `n+1`. The backend receives this frozen subject, not an inferred path
or a prior authorization decision.

Phase 3 policy receipts bind their exact query/action, actor, Project resource/
config/root/repository identity, subject revisions, policy/config/adapter
identity, decision, finite required facts, observation time and validity. Gate
intents additionally bind Task/execution/fence/workspace/generation/HEAD,
gate/command/tool/evidence-root identities. Integration reservations bind the
exact Project/repository/target ref, distinct expected target/source objects,
source workspace, destination identity/ref/expected remote, policy receipt,
lease owner/revision/fence/expiry, and owner execution/operation. A change to
any member is a new operation or a stale/conflicting receipt; a key, similar
content, descendant commit, or later observation cannot collapse two tuples.

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
contains an unfinished intent, Manual or Codex journal operation, or terminal evidence.
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

The local Manual execution loop and package-private Codex execution service
implement the generic state set and ordered protocol in this section. Their
backend journals remain distinct: Manual inspection reads the Manual control
state, while Codex inspection reads only its locally durable thread/terminal
evidence because the pinned SDK exposes no independent remote inspect. The
workspace foundation uses the same durable
prepare/effect-possible/observe/verify/finalize ownership rule through its
specialized generation protocol below; it does not reuse Manual rows or invent
Manual-only `retry_wait`. Publication, completion gates, and dispatcher fan-out
do not inherit either evidence family.

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

## Package-private Codex turn protocol

This section is implemented only by the internal injected Codex path. It adds no
supported package-root factory, product/backend selector, dispatcher/API/CLI
route, credential broker, or destination authority.

Before any SDK access, the reliable owner reopens the current Task and exact
owned ready workspace tuple, verifies the Task body's SHA-256 reference, commits
the core intent, moves it to `executing` with a fresh Act binding, and calls the
backend outside every SQLite writer transaction. The backend then reopens its
trusted disjoint Project/workspace roots and requires the configured Project
`rootKey` to match ProjectRegistry. It delegates physical proof to the sole
`windows-git-local` workspace inspection owner, including the canonical
generation path, complete ownership manifest, authoritative worktree
registration, repository identity, no alias/reparse substitution, matching
ownership receipt, exact detached HEAD, and clean inventory including ignored
entries. The verifier compares the observed repository identity with the
current durable ready receipt before and after that check, then recomputes the
input digest.
It commits `codex_backend_turns` with lifecycle `unknown` before invoking the
pinned SDK. That ordering makes absence of the exact turn row durable proof that
the SDK driver was not reached by this operation.

A new turn obtains its durable thread identity only from one valid
`thread.started` event and moves the journal to `active`. A continuation calls
the SDK's same-thread resume surface only for the exact predecessor thread and a
new fenced successor execution. Replacing or omitting the thread is a conflict.
The driver accepts only `thread.started`, `turn.started`, `turn.completed`, and
`turn.failed`; item content and raw error text never cross into durable state.
One terminal event atomically advances the turn and appends its immutable
terminal operation/receipt identity. Duplicate, missing, malformed, or changed
terminal/thread evidence is not success.

One execution attempt may own a Manual turn or a Codex turn, never both. Both
start paths refuse a turn already owned by either backend family before a new
intent or adapter access, and the combined persistence decoder rejects any
cross-family overlap as corruption.

The SDK provides no external turn ID or authoritative remote inspection. The
subsequent independent `execution.inspect` therefore reopens the exact local
Codex journal and verifies its intent, workspace, input, thread, terminal,
receipt, revision, and fence lineage. The core observation, verified receipt,
and finalization then use the ordinary ordered protocol. A verified
`turn.completed` maps only to `turn_succeeded`; it leaves the Task running until
the separate existing completion owner accepts all required evidence.

Restart behavior is exact:

| Durable point | Codex outcome |
| --- | --- |
| No core intent | No SDK call is inferred. |
| `pending` | Reauthorize, CAS to `executing`, commit the backend turn before SDK access, and call once. |
| `executing`, exact Codex turn absent | Journal absence proves the backend did not reach the SDK; reauthorize and perform the first call. |
| `executing`, turn `unknown` or `active` without a terminal operation | The SDK may have run; do not call or resume blindly. Persist/return explicit unknown or ambiguity and require new evidence or an authorized successor. |
| `executing`, exact terminal operation present | Reconstruct the bounded receipt from durable thread/terminal evidence and continue by inspection; do not invoke the SDK again. |
| `observed` | Verify the persisted observation only. |
| `verified` | Re-run only current-authorized finalization CAS. |
| `finalized` | Revalidate trusted identity and return the bounded durable result without SDK access. |

Cancellation of an already terminal `turn_succeeded` or `failed` Codex turn is
a verified no-effect result: the backend returns `already_terminal`, leaves the
turn revision unchanged, and the reliable owner still records fresh inspect,
receipt, and finalization evidence for that cancellation intent. If a future
authorized composition can prepare a valid cancellation intent while
the same process still owns an active controller, the backend marks the turn's
cancellation request before signaling its `AbortController`. The current
non-composed harness does not admit a concurrent second intent while start is
unfinished, so its cancellation surface normally reports the unavailable state
as bounded ambiguity. In either case a signal is a request, not proof of
interruption. Only subsequently durable SDK terminal evidence may terminalize
the turn; absence after abort remains unknown/ambiguous, and the backend never
fabricates `cancelled` or replays the effect to discover the answer.

## Durable workspace generation protocol

The current workspace coordinator owns a distinct closed intent set:
`pending`, `executing`, `observed`, `verified`, `finalized`, `ambiguous`, and
`failed`. Its generation state set is `allocated`, `reserved`, `creating`,
`ready`, `cleaning`, `recovery_required`, and `cleaned`. Each reserve operation
allocates its system workspace ID/generation and creator intent in the same
prepare transaction; every later operation addresses that exact generation.
The generation preserves creation-time lower bounds for the Project
resource/config, Task, run, member, and execution revisions. A later operation
uses exact current revisions that are no earlier than those bounds; its stable
owner identities, membership revision, attempt, fence, workspace ID, and
generation still match exactly. This permits ordinary owner revision advance
without adopting a different owner or stranding the generation.

The ordered workspace protocol is:

1. **Prepare:** parse the complete command before trusted ingress, resolve the
   current frozen owner tuple, evaluate the exact `workspace.*` grant, obtain a
   cleanup confirmation when applicable, allocate reserve identity when
   applicable, and atomically persist the prepare decision, intent, generation,
   and prepared event.
2. **Mark possible effect:** in a fresh short transaction, revalidate current
   actor/root, Project/run/member/execution/fence/generation state and grant;
   bind the `act` decision and CAS the intent to `executing`. Create moves the
   generation to `creating`, cleanup to `cleaning`, and the other operations
   retain their current generation status.
3. **Call and observe:** invoke exactly one backend method outside every writer
   transaction. Parse the exact hostile-input-safe result and semantically
   compare contract/operation/idempotency/adapter/workspace/generation/root/
   state/code/inventory relationships before persisting the next positive
   observation number and receipt digest. For the Windows backend, an adapter
   namespace acquisition or production capability-probe mutation is an effect
   even if the exact transient empty probe is subsequently removed; a later
   failure cannot discard that upstream fact and is returned as ambiguous. In
   particular, successful directory creation is effect-possible before the
   post-create identity read; an unreadable or unprovable new identity is not
   cleanup authority and remains an ambiguous effect.
4. **Verify:** for a non-ambiguous success or refusal, persist at most one
   verified receipt bound to the exact observation and generation revision.
   Ambiguous or malformed evidence never becomes verified success.
5. **Finalize:** revalidate current authority, owner revisions, generation
   revision, and fence in a final short transaction; bind `finalize`, write one
   finalization/event, and transition reserve to `reserved` or `allocated`,
   create to `ready` or `reserved`, cleanup to `cleaned` or `ready`, recover to
   the independently proven state, and inspect without changing generation
   state.

Recover prepare names the current `recovery_required` generation revision `R`.
Its prepare and existing Act decisions bind that same `R`, and every ambiguous
node in its acyclic same-generation causal chain must also record
`recovery_required` at `R` before the chain terminates in `reserve`, `create`,
or `cleanup`. A nested ambiguous recover may extend the chain only at the same
`R`; a root already resolved at an older revision cannot authorize a later
recovery or same-generation reserve proof.

Every transaction performs terminal combined-state readback before commit.
Trusted identity/time/ID/confirmation providers, backend calls, receipt parsing,
and external validation run outside writer transactions. An exception at any
write seam rolls back that entire seam, leaving restart to resume from the last
committed boundary.

Workspace restart/recovery is exact:

| Durable point | Current outcome |
| --- | --- |
| No intent | No backend call is inferred. |
| `pending` | Reauthorize, CAS to `executing`, and call once. |
| `executing` reserve/create/cleanup | The effect may have happened; record explicit ambiguity and require causal recovery rather than replaying the mutation. |
| `executing` inspect/recover | Resume the read/reconciliation call with the same exact key; these operations cannot create the primary workspace effect. |
| `observed` | Verify the already persisted receipt without a second backend call. |
| `verified` | Re-run only current-authorized finalization CAS. |
| `finalized` | Revalidate trusted identity/root and return the bounded durable result. |
| Lost backend response | Independently known Fake state or a matching Windows-adapter manifest plus authoritative Git/filesystem state may be observed; otherwise the generation remains `recovery_required`/ambiguous. |

A verified reserve refusal or recover-absent proof may return the same generation
to `allocated` for an exact retry. A partial or conflicting observation cannot.
The same narrow reuse is available after a terminal receipt-free reserve
failure only when the failed intent has zero observations, explicitly records a
non-ambiguous no-effect result, has one failed finalization with no verified
receipt, leaves the generation `allocated` at the recorded revision, and no
unfinished intent exists for that generation. The retry still creates fresh
operation/request/decision/event identities and revalidates the complete current
owner, root, generation, and authorization tuple before any backend call.
Only `cleaned` may be the predecessor of generation `n+1`; no retry, restart,
path discovery, or branch similarity allocates a duplicate or adopts external
state. These guarantees cover the durable coordinator and the exact injected
backend. The Windows Git implementation supplies local
create/inspect/recover/attested-cleanup evidence; it adds no default product
wiring, general remote effect, or platform-support claim.

## Phase 3 gate, completion, integration, and cleanup protocol

ProjectPolicy evaluation is read-only and precedes final mutation authority. A
successful evaluation stores the exact bounded receipt and facts; a policy
allow is evidence, never a grant, intent, reservation, Domain transition, or
adapter effect. A later operation reopens and verifies the receipt, exact
subject/configuration tuple, decision, and validity before using it.

Completion-gate intents use `pending`, `executing`, `observed`, `verified`,
`finalized`, `ambiguous`, or `failed`. Run and cancel persist intent and final
authorization before the effect; inspect is a separately authorized read.
Adapter calls occur outside writer transactions. Ordered observations,
verified receipts, finalizations, and events are committed in separate short
transactions with fresh application time and exact Task/execution/fence/
workspace/HEAD/policy/gate CAS. Response loss or untrusted evidence becomes
ambiguity and is inspected rather than rerun. A pass is completion evidence
only after its retained evidence is independently reopened and every freshness
identity still matches.

One generic `completion_decisions` parent has exactly one `manual` or
`policy_gated` child. The Manual path preserves its existing evidence contract.
The Phase 3 path, in one final transaction, proves execution success, exact
fresh required passing gates, current workspace/HEAD/policy/integration/
preservation state, current `completion.accept` grant and confirmation, and the
Task/execution/fence CAS; it inserts parent and child, applies the existing
Domain running-to-completed transition, inserts the unique terminal-execution
fact, appends audit, and reads back. Turn success, a gate result, ref update,
push, policy allow, or cleanup alone never performs that unit.

Integration apply/push intents use the same seven-state set. `pending` moves to
`executing` before Git access, then to `observed`, `verified`, and `finalized`
for a normal success. Only the exact authoritative nonforeign no-effect
`apply_refused` or `push_rejected` row moves to `failed` while preserving an
active reservation for a new separately authorized operation. A foreign or
unknown effect observation atomically makes the intent and reservation
`ambiguous`; no new effect is allowed. Recovery performs only a separately
authorized `inspect`. `inspected_ambiguous` retains both rows. Any authoritative
inspection finalizes the original intent with exactly
`recovered_no_effect|recovered_local_applied|recovered_pushed|recovered_inconsistent`
and only then terminalizes the reservation as `released` before stored expiry
or `expired` at/after expiry. No higher fence exists until both rows are
terminal.

Cleanup begins with the unique durable `pending` workspace intent. The final
authorization transaction recomputes zero-owner quiescence while excluding only
that exact pending row, issues the current cleanup attestation through its
intent FK, and advances the same intent to `executing`. Immediate point-of-use
revalidation excludes only that executing row and rereads the trusted actor,
exact current grant and expiry, cleanup-policy receipt/configuration and expiry,
attested authorization, resource tuple, Project identity, and cleaning
revision. The policy subject remains bound to the immediately preceding ready
revision; intent, attestation, and quiescence separately bind the durable
cleaning revision. Any authority or identity drift refuses before adapter
access. The adapter then quarantines and removes only the verified closed
inventory. A returned digest is observed and verified before finalization;
response loss or post-effect uncertainty remains `recovery_required` rather
than fabricating rollback or deleting more data.

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
| `executing`, no receipt, current live owner/fence | Inspect the selected backend journal first. For Manual, apply its exact local idempotency rule. For Codex, only absence of the pre-SDK turn row proves the first call is still safe; any present nonterminal row forbids replay and becomes explicit unknown/ambiguity. |
| `pending` or `executing`, expired/foreign owner fence | Do not invoke the old-fence mutation. Reconcile by inspection only; an absent local Manual start journal or absent pre-SDK Codex turn row is terminal no-effect evidence, while any unprovable state becomes `ambiguous`. Only after every intent is finalized may takeover allocate a higher attempt/fence. |
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
observable in durable intent evidence. Codex does not inherit blind replay
permission: a continuation/retry requires a new fenced successor execution and
the exact predecessor thread, while an effect-possible unproved start remains
ambiguous.

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
