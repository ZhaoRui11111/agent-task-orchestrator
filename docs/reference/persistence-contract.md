# Persistence contract

## Status and authority

This file is the sole normative owner of the implemented SQLite persistence
foundation: runtime-root selection, physical schema allocation, connection and
transaction policy, authoritative Domain/application storage ingress,
migration identity, backup publication, restore recovery, and
incompatible/corrupt-state handling.

The current implementation stores the complete local explicit-Manual Phase 2
model plus the fresh-only durable workspace foundation in one schema-version-1
baseline: exact Project/Task Domain snapshots, ProjectRegistry, local identity,
vocabulary-version-1-through-5 epochs and grants,
application requests, authorization decisions, lifecycle authorizations,
sanitized audit, execution attempts/sequences, reliable Manual-loop evidence
and journal records, reconcile-first Manual dispatcher records, and workspace
generation/authorization/intent/observation/verified-receipt/finalization/event
records. Lifecycle
authorization stores and verifies only application-state digest version 1.

Persistence exposes lifecycle operations, read-only doctor, and the typed
application transaction owner; it does not authorize a mutation or select or
invoke a Domain command. The local product facade and versioned CLI call these
owners. The CLI never opens SQLite directly, while the facade performs only
typed current-state reads needed to derive an existing owner command. The
schema stores no scheduler registration/delivery, gate, ProjectPolicy,
CompletionBackend, integration-reservation, or MCP record. A future
implementation receives physical allocation only through its own approved
schema change.

Domain values are owned by the [domain contract](domain-contract.md). Manual
effect and future external-effect semantics remain owned by the
[reliability protocol](reliability-protocol.md). This contract owns storage,
not permission or the meaning of an external result.

## Current schema allocation

The repository ships exactly one immutable migration:

| Version and file | Current physical allocation |
| --- | --- |
| `1`, `0001-current-baseline.sql` | The complete implemented local explicit-Manual Phase 2 plus durable workspace-foundation storage model described in this contract |

This baseline is for a genuinely fresh runtime only. It is not a forward path
from an earlier prototype database and does not preserve any previous migration
prefix, checksum, physical authorization partition, grant-link relation,
historical application-state projection, or lifecycle digest version. Schema
version and authorization vocabulary are independent: the database remains
schema version 1 while separately confirmed capability transitions advance
vocabulary version 1 to 2, 2 to 3, 3 to 4, and 4 to 5.

The baseline does not pre-allocate scheduling registration/delivery, gates,
ProjectPolicy, CompletionBackend, integration-reservation, or MCP records.

### Migration metadata

`schema_metadata` has the singleton key `1` and exactly these durable fields:

- `schema_version`: the current positive migration version;
- `domain_initialized`: constrained `0`/`1` marker owned by the one-time
  Domain snapshot initializer, so an intentionally empty initialized snapshot
  is distinguishable from an uninitialized store;
- `registry_identity`: uppercase SHA-256 of the sole current registry
  descriptor;
- `schema_fingerprint`: uppercase SHA-256 of the canonical live
  `sqlite_schema` inventory for that baseline; and
- `updated_at`: the non-empty UTC timestamp written by the migration owner.

`migration_history` is keyed by positive `version`, has a unique non-empty
`migration_id`, and stores `checksum_sha256`, canonical UTC `applied_at`, and
the non-empty `application_version`. The metadata `updated_at` must equal the
applied history timestamp. History contains exactly the one version-1
`current-baseline` row. It is not inferred from table shape.

### Domain Core storage

`projects` stores only:

- `project_id`: opaque non-empty `TEXT` primary key; and
- `enabled`: constrained `INTEGER` boolean `0` or `1`.

This row is the minimum Project value required to reconstruct the implemented
Domain Core. Canonical root and registry revisions live in the separate
current `project_registry` owner. Adapter configuration and later lifecycle
fields are not silently represented here.

`tasks` stores the complete current Domain Core Task shape:

- identity and scalar fields: `task_id`, `project_id`, `state`, `revision`,
  `body`, `parent_id`, and `supersedes_task_id`;
- waiting fields: `waiting_reason`, `waiting_phase`,
  `waiting_required_action`, `waiting_last_error_code`,
  `waiting_last_error_summary`, `waiting_retryable`, `waiting_retry_count`,
  `waiting_retry_after`, `waiting_execution_id`,
  `waiting_workspace_revision`, `waiting_backend_thread_id`, and
  `waiting_task_revision`;
- completion fields: `completion_decision_id` and
  `completion_accepted_task_revision`; and
- cancellation fields: `cancellation_event`, `cancellation_reason`,
  `cancellation_verification_id`, and
  `cancellation_accepted_task_revision`.

Identifiers are opaque non-empty `TEXT`, revisions are positive safe SQLite
`INTEGER` values, booleans are `0` or `1`, and the known state and cancellation
enums are constrained. Waiting fields are present only for `waiting` Tasks;
completion fields only for `completed` Tasks; cancellation fields only for
`cancelled` Tasks. A cancellation reason is a well-formed NFC string with no
Unicode `Cc`/`Cf` code point and 1 through 4,096 encoded UTF-8 bytes, as decided
by the Domain Core's sole exported predicate. The repository reconstructs the
complete graph through the Domain Core, which remains authoritative for this
text invariant and cross-row invariants such as same-Project parents and
acyclic relationships. A current stored reason that violates the predicate is
`CORRUPT_ROW`; the reader does not normalize, rewrite, migrate, or repair it.

`task_dependencies` is keyed by (`task_id`, `dependency_id`), rejects a
self-edge, and has deferred foreign keys to both Tasks. Foreign keys from Tasks
to Projects, parents, and superseded Tasks are also deferred so one atomic
snapshot mutation can insert a valid multi-row graph before commit. Indexes
cover Project, parent, supersession, and reverse-dependency lookup.

The Domain tables use SQLite `STRICT` mode. There is no durable title,
workspace, scheduler, gate, or external adapter field.

### Application, authorization, and execution storage

The current baseline directly allocates the records required by the implemented
local Project/Task/dependency application owner:

- `project_registry` binds one opaque Project ID to a unique canonical local
  root key, platform/device/inode/mode identity, positive config and resource
  revisions, and trusted creation/update times. Its Project row is FK-bound to
  the Domain `projects` row and cannot be deleted.
- `application_requests` binds each fresh request/correlation/actor/action to
  one exact runtime, Project, Task, or grant target and `bootstrap|allow|deny`
  result.
- singleton `authorization_bootstrap` binds the trusted actor/principal,
  immutable runtime-root identity/expiry, and initial vocabulary version 1 to its
  request.
- `authorization_local_identity` stores the immutable versioned
  actor/principal digest and runtime-root binding created by bootstrap.
- `authorization_capability_epochs` stores one immutable contiguous
  vocabulary-version-1-through-5 renewal/upgrade lineage bound to the exact action-set
  digest.
- `authorization_grants` stores the exact finite action, runtime or
  revision-bound Project scope, lifetime, administrative/source provenance,
  direct nullable `capability_epoch_id`, and single irreversible CAS
  revocation. Every vocabulary uses this one relation.
- `authorization_decisions` records the exact result/reason, policy result,
  nullable grant revision, and nullable Project revision for one request.
- `application_audit` stores one allowlisted event/result/reason with fixed
  sanitized JSON metadata; it does not store Task bodies, Project paths,
  prompts, tool output, Agent text, or secrets.
- `application_lifecycle_authorizations` stores immutable short-lived
  backup/restore handoffs bound to authorization evidence and exactly
  `state_digest_version = 1` of the complete current non-lifecycle application state.

Every application relation is `STRICT`. Requests, bootstrap, identity, epochs,
decisions, lifecycle authorizations, and audit are append-only; grants are
insert-only except for one revision-incrementing revocation.

Execution claim storage includes:

- `task_execution_sequences`, one row per ever-claimed Task with its exact last
  attempt number, current fencing token, and positive CAS revision; and
- `execution_attempts`, one immutable semantic claim/takeover record with Task,
  ordered attempt, operation kind, status, idempotency key, trusted lease owner,
  requested lease duration, lease revision/expiry, fence, execution revision,
  expected/pre/post Task revisions, Project resource/config revisions,
  authorization request/decision, predecessor revisions, supersession links,
  and trusted timestamps.

A partial unique index permits at most one `active` attempt for a Task. Deferred
self-foreign keys allow one atomic supersede-and-insert transaction. Sequence
advance must be exact `+1`; attempt updates are limited to a current-owner
lease-renewal CAS or an expired active-attempt supersession CAS. Attempts and
sequences cannot be deleted. Baseline creation inserts no capability epoch,
grant, execution row, or authority. Bootstrap creates only the fixed nineteen
version-1 base grants. A separately confirmed contiguous upgrade is the only
path that appends vocabulary-version-2, -3, -4, or -5 origin grants.

Reliable Manual-loop storage uses the same epoch/grant relations and the sole
current digest-version-1 `applicationStateProjection`. A confirmed
version-2-to-3 upgrade appends one epoch and exactly twenty-nine current origin
grants. The projection enumerates direct epochs and grants once under their
current property names and excludes only lifecycle authorizations to avoid a
self-reference; there is no physical vocabulary partition, grant-link relation,
compatibility projection, ignored-argument wrapper, or digest fallback.

The operation relations separate immutable request/decision/audit,
authorization-bound semantic intent, immutable prepare/act/finalize
authorization bindings, ordered independent observations, one verified
receipt, one finalization, and an optional immutable execution terminal fact.
Each execution decision stores its decision-era Project resource and config
revision; each journal mutation and finalization stores the fresh decision it
consumed. Intent updates are limited to the closed one-step state/binding CAS;
their tuple, adapter, Project/Task/execution/attempt/fence, predecessor, and
operation-specific identities are immutable. Their closed failure projection
alone may advance on executing-to-`retry_wait|ambiguous|failed`, retaining
category, code, retry/ambiguity flags, nullable retry time, and retry count.
`manual_backend_turns` is the sole narrowly mutable local adapter state and
allows only revision-incrementing, fence-preserving transitions; once a turn is
`turn_succeeded`, `failed`, or `cancelled`, every update is rejected, including
a same-lifecycle rewrite. Its operation journal and Manual completion decisions
are immutable. All evidence is bounded IDs, enums,
revisions, timestamps, hashes, and redacted references; no Task body, prompt,
path, environment, credential, raw adapter payload/error, SQL, or stack is
allocated.

The baseline itself inserts no epoch/grant, lifecycle authorization,
execution operation, Manual turn, receipt, finalization, terminal, or completion
row. Fresh schema creation does not bootstrap application state. A separately
confirmed version-3-to-4 upgrade or later version-4 renewal appends one
epoch and exactly thirty fresh origin grants in the same current relations;
baseline creation, bootstrap, and earlier-version renewal add no
`dispatch.run` authority.

A separately confirmed version-4-to-5 upgrade or later version-5 renewal
appends one epoch and exactly thirty-five current origin grants in those same
relations. Baseline creation, bootstrap, and versions 1 through 4 renewal add no
`workspace.*` authority.

The dispatcher relations separate bounded trigger observation, authorization
decision/audit, owned run and heartbeat lease, complete per-resource
reconciliation plus its immutable summary, one immutable membership seal,
one CAS-resolved member row per sealed Task, an immutable request/decision/audit
triple for a fully bound `execution.start` denial that creates no execution,
and one completeness-gated terminal run summary. Run status, outcomes,
dispositions, event kinds, and reason codes are closed enums. Trigger
idempotency is stored only as a stable digest identity. A member can bind an
execution and prepared start intent only for the `claimed` outcome; a
start-denied member instead binds exactly one sanitized denial triple to its
run, member, actor, Project revisions, unused proposed execution identity, and
authorization reason. The run summary cannot be inserted while membership is
incomplete, a member is pending, a claimed intent is not finalized, or a
start-denied member lacks that triple. The run/member update triggers require
exact owner, revision, status, and membership transitions and reject every
old-owner or stale-row write.

Fresh baseline creation inserts no dispatcher trigger, run, reconciliation,
member, member-denial, or summary row.

Workspace-foundation storage consists of exactly seven current relations:

- `workspace_generations` stores the system workspace ID, positive contiguous
  generation and revision, closed lifecycle status, creation-time revision
  lower bounds plus the frozen Project/Task/run/member/membership/execution/
  attempt/fence/root/adapter/base identity tuple, creator operation, and
  nullable exact cleaned predecessor;
- `workspace_authorization_decisions` stores immutable prepare/act/finalize
  evaluations with binding revision, grant/revision, exact Project/execution/
  fence/generation tuple, and allow/deny reason;
- `workspace_operation_intents` stores one exact reserve/create/inspect/recover/
  cleanup semantic operation, idempotency/correlation/causation, current
  authorization binding, nullable cleanup confirmation, expected generation
  state, bounded failure projection, and CAS state/revision;
- `workspace_observations` stores a positive contiguous observation number,
  adapter receipt identity/digest, the authorization decision bound to that
  backend call,
  external-state/outcome/code, path-safety/ownership verdict, bounded inventory
  counts, opaque redacted evidence reference, and observation time;
- `workspace_verified_receipts` stores at most one semantically verified
  observation for an intent and its exact generation revision/outcome;
- `workspace_finalizations` stores exactly one terminal outcome/resulting
  generation state and the finalize decision consumed; and
- `workspace_events` stores only the closed prepared/denied/executing/observed/
  verified/finalized/reconciled family with stable identities, revisions,
  observation number, closed result/reason, and nullable opaque evidence
  reference.

The generation status set is `allocated`, `reserved`, `creating`, `ready`,
`cleaning`, `recovery_required`, and `cleaned`; intent states are `pending`,
`executing`, `observed`, `verified`, `finalized`, `ambiguous`, and `failed`. A
partial unique index permits at most one
non-cleaned generation for each Project/Task/run/execution owner tuple. Update
triggers allow only forward exact revision/status transitions, and append-only
workspace evidence cannot be updated or deleted. The combined decoder requires
the creator intent, contiguous generations, exact predecessor, one current
owner, exact prepare/act/finalize chain, contiguous observations, receipt and
finalization consistency, event lineage, current Project/run/member/execution
binding at revisions no earlier than the generation's creation-time bounds, and
matching stable identities, membership revision, attempt, and fence. Each
decision binds the exact revisions current for its own protocol phase. Every
persisted intent starts from an allowed prepare; every backend observation binds
the exact allowed Act decision; and successful finalization requires the full
allowed prepare/act/finalize pattern. A denied Act or finalize remains only on
its closed failed or ambiguous terminal route. Recover additionally requires a
nonempty, existing, same-workspace/generation, durably ambiguous and acyclic
causal chain that terminates in the original effect-capable `reserve`, `create`,
or `cleanup` operation. The decoder derives one recovery revision `R` from the
immutable prepare decision, requires any existing Act decision to bind the same
`R`, and requires every ambiguous causal node to record `recovery_required` at
exactly `R`; an older already resolved root is corrupt even when its operation
kind matches. Missing, later, cross-generation, non-ambiguous, cross-revision,
or cyclic causation is corrupt. Canonical
workspace readback also revalidates the port-owned operation/code/outcome/
external-state matrix, the exact failure category/flag pair, the resulting
generation status, and its terminal event projection rather than trusting
cross-row equality alone. Canonical paths, branches, raw adapter payloads,
errors, credentials, Task bodies, source, SQL, and stacks are not stored; only
the receipt digest and bounded redacted facts survive.

Fresh baseline creation inserts no workspace generation, decision, intent,
observation, receipt, finalization, or event. These rows can be selected only
by the typed workspace application owner against an injected backend. The
current backend is a test-only Fake; this allocation is not a real Git or
filesystem-workspace claim.

## Writer and reader closure

| Records | Only writer | Readers |
| --- | --- | --- |
| `schema_metadata.schema_version`, registry identity/fingerprint, `updated_at`, and `migration_history` | `src/persistence/migrations.ts` | current startup validation, backup/restore verification, and read-only doctor |
| `schema_metadata.domain_initialized` one-time `0` to `1` transition | `src/persistence/repository.ts` inside the initial snapshot transaction | current startup validation, repository decoder, backup/restore verification |
| `projects`, `tasks`, `task_dependencies` | `src/persistence/repository.ts`, invoked only through the internal application transaction after initialization | the same repository decoder, combined application decoder, backup verification, and doctor |
| `project_registry` | `src/persistence/application-repository-transaction.ts` in the accepted application transaction | `application-repository-readers.ts` and the combined `application-repository-state.ts` decoder, then the application service through the stable `application-repository.ts` facade |
| `authorization_bootstrap`, `authorization_local_identity`, and all vocabulary-version-1-through-5 `authorization_capability_epochs`/`authorization_grants` | `src/persistence/application-repository-transaction.ts` in bootstrap, renewal/upgrade, or authorized grant transactions | `application-repository-readers.ts`, the combined `application-repository-state.ts` decoder, and the application authorization owner through the stable facade |
| `application_requests`, `authorization_decisions`, `application_audit`, `application_lifecycle_authorizations` | `src/persistence/application-repository-transaction.ts` in the same decision/operation transaction | `application-repository-readers.ts`, `application-repository-state.ts`, digest-version-1 `application-repository-digest.ts`, `application-repository-lifecycle.ts`, backup verification, and doctor |
| `task_execution_sequences`, `execution_attempts` | `src/persistence/application-repository-transaction.ts` only inside the typed execution application transaction | `application-repository-readers.ts`, `application-repository-state.ts`, the execution application owner, backup verification, and doctor |
| `execution_operation_requests`, `execution_authorization_decisions`, `execution_operation_audit`, `execution_operation_intents`, `execution_intent_authorization_bindings`, `execution_observations`, `execution_verified_receipts`, `execution_finalizations`, `execution_terminal_states`, `manual_completion_decisions` | `src/persistence/application-repository-transaction.ts` only inside reliable-loop transactions after the application owner selects and authorizes the exact operation | `application-repository-readers.ts`, `application-repository-state.ts`, the reliable execution owner, backup verification, and doctor |
| `manual_backend_turns`, `manual_backend_operations` | `src/persistence/manual-backend-repository.ts` remains the semantic journal writer through the injected production Manual backend/control after a matching committed core intent; physical writes use the same `ApplicationTransaction` from `application-repository-transaction.ts` | the same journal plus `application-repository-readers.ts`, `application-repository-state.ts`, the reliable execution owner, backup verification, and doctor |
| `dispatcher_trigger_requests`, `dispatcher_authorization_decisions`, `dispatcher_runs`, `dispatcher_audit`, `dispatcher_reconciliation_items`, `dispatcher_reconciliation_summaries`, `dispatcher_memberships`, `dispatcher_members`, `dispatcher_member_denial_requests`, `dispatcher_member_denial_decisions`, `dispatcher_member_denial_audit`, `dispatcher_run_summaries` | `src/persistence/application-repository-transaction.ts` only inside the typed dispatcher application transaction after the dispatcher application owner selects and authorizes the exact transition | `application-repository-readers.ts`, `application-repository-state.ts`, the dispatcher application/orchestration owners, backup verification, and doctor |
| `workspace_generations`, `workspace_authorization_decisions`, `workspace_operation_intents`, `workspace_observations`, `workspace_verified_receipts`, `workspace_finalizations`, `workspace_events` | `src/persistence/application-repository-transaction.ts` only inside the typed workspace application transaction after that application owner selects, authorizes, observes, verifies, and finalizes the exact transition | `application-repository-readers.ts`, `application-repository-state.ts`, digest-version-1 `application-repository-digest.ts`, the workspace application owner, backup verification, and doctor |
| backup generation and manifest | `src/persistence/backup.ts` under the lifecycle lock | the same verifier, restore, and current CLI/doctor surfaces |
| lifecycle lock and connection receipts | `src/persistence/runtime.ts` | persistence lifecycle operations only |
| restore intent, retained generation, and restore receipt | `src/persistence/backup.ts` under the lifecycle lock | explicit recovery and current doctor/CLI surfaces |

No product surface opens SQLite or writes these paths directly. The Manual
adapter reaches only its declared journal writer and cannot write core records;
the injected workspace backend never writes SQLite; a CLI, MCP server,
scheduler, adapter receipt, or Agent output cannot become a second writer.
Future schema additions update this closure in the migration and ExecPlan that
introduces their implementation.

## Runtime root and path ownership

Runtime data is outside the source checkout and every supplied Project root.

- An explicit root takes precedence. Otherwise
  `TASK_ORCHESTRATOR_DATA_DIR` selects an untrusted candidate. On Windows only,
  the default is the operating-system local application-data directory plus
  `agent-task-orchestrator`; another platform has no default in this phase.
- Product CLI ingress does not accept the environment variable as authority. It
  derives the Windows account home from `os.userInfo({encoding:'utf8'}).homedir`,
  constructs the per-user local application-data root from that OS account fact,
  and accepts only that exact root or one direct child through its bounded
  `--runtime-root` option before applying every persistence identity and overlap
  check below. `HOME`, `USERPROFILE`, `LOCALAPPDATA`, command content, and stored
  content never select this trust root.
- The candidate must be absolute, non-root, lexically traversal-free, and
  non-overlapping in either direction with the canonical source checkout or
  any supplied Project root.
- Every existing or created ancestor and target is a real directory, not a
  symlink, junction, or reparse alias. Creation validates parent identity
  before and after the mutation. A resolved alias or identity change fails
  closed. The only narrower Windows exception is OS package virtualization at
  the product local-ingress creation boundary: it is accepted only when every
  traversed component is still a non-reparse directory and both the requested
  logical root and resolved physical root remain descendants of the same
  canonical OS-account home. The issued layout then owns and revalidates the
  resolved physical identity; generic persistence root creation retains the
  unconditional alias rejection.
- The issued runtime layout owns all descendant names: `state.sqlite3`,
  `backups`, `connections`, `restore`, the lifecycle lock, staging roots,
  retained roots, and receipts. One Runtime-owned topology derivation supplies
  creation, existing-layout inspection, and Doctor's lexical required-directory
  projection; the Doctor projection performs no filesystem operation. Callers
  cannot supply those descendant paths.
- The Runtime owner also exposes one internal closed mapping for the live
  primary SQLite member family: `state.sqlite3`, `state.sqlite3-wal`, and
  `state.sqlite3-shm`. Store and backup/restore consume that mapping rather than
  rebuilding a live path from the runtime root. Backup still owns its distinct
  generation, stage, manifest, restore-intent, retained-generation, and receipt
  protocol member paths and inventories.
- Every issued directory identity is retained in process and revalidated
  before and after protected use. Each dynamic backup or retained directory
  also has an identity receipt that is checked after awaits, failpoint hooks,
  and every rename. SQLite targets are reserved as exclusive, no-follow,
  private empty files before SQLite can write sensitive bytes; terminal
  readback must retain the same file object and content binding. Newly created
  directories and regular files use user-only permissions on hosts where
  POSIX mode enforcement is meaningful. Windows mode observation is not an ACL
  or platform-support claim.
- Before any SQLite open, the owner no-follow inspects the complete present
  main/WAL/SHM set, rejects unsafe node or permission state, and binds every
  present object across the open. Newly created sidecars are checked before
  the connection is issued. Backup publication repeats exact stage inventory,
  object, and content checks immediately before the same-parent rename.

The primary database and its WAL/SHM members, backups, restore material, and
receipts are runtime data. They must not enter Git, a package, logs, or source
evidence.

## Lifecycle coordination and connections

Migration, backup publication, restore/recovery, primary identity inspection,
and connection-receipt creation or release use one short-lived exclusive
`lifecycle.lock`. The owner binds the lock to its no-follow regular-file
identity before and after work. Contention, a crash residue, substitution, or
loss of identity is a typed failure; there is no stale-lock deletion API.
Because ordinary store open and close also create or release connection receipts
under this lock, a present lock residue blocks those routes as well as migration,
backup, restore, and primary-identity capture. Read-only doctor never acquires or
removes the lock; it reports the runtime as active.

Each open `PersistenceStore` has an exact UUID connection receipt containing
its receipt-format version, application version, process ID, receipt ID, and
open time.
The store verifies the issued connections-directory identity and the receipt
object/content before every operation, and releases only that exact receipt
after closing SQLite. Creation and release revalidate the parent immediately
before and after mutation. Unknown, corrupt, substituted, active, or
crash-stale receipts block first initialization, migration, primary-identity
inspection, and restore. Multiple receipts may coexist only after the database
is already at the current schema; this is observation, not a claim that another
process is healthy.
An application-authorized manual backup may run only from the sole open store
whose one exact receipt is present. Any second, unknown, or crash-stale receipt
blocks manual backup. Restore and raw primary-identity capture require an empty
receipt inventory. A current-schema ordinary store open may coexist with receipt
residue under the multiple-reader rule, but it creates and later releases only
its own exact receipt; it neither validates, adopts, nor deletes another receipt.

Every writable connection establishes and verifies:

- `foreign_keys=ON`;
- `journal_mode=WAL` for the primary database;
- `synchronous=FULL`;
- `read_uncommitted=OFF`; and
- `busy_timeout=5000` milliseconds.

Standalone backup and preflight readers open read-only. Published backup files
are normalized to `journal_mode=DELETE` before verification.

## Transaction and repository boundary

`src/persistence/application-repository.ts` is the stable explicit re-export
facade. Its database-free model, per-table readers, digest projections, combined
state proof, lifecycle handoff verification, and application-family transaction
owner live respectively in `application-repository-model.ts`,
`application-repository-readers.ts`, `application-repository-digest.ts`,
`application-repository-state.ts`, `application-repository-lifecycle.ts`, and
`application-repository-transaction.ts`. Only the last module owns the
application-state binding, `ApplicationTransaction`, SQL writes/CAS, and the
application-family `runWriteTransaction` call. The separate backup binding and
terminal lifecycle-authorization writer barrier in `backup.ts`, and the Domain
transaction owners in `repository.ts`, remain distinct and unchanged.

Readers use a synchronous SQLite snapshot transaction. Writers use short
synchronous `BEGIN IMMEDIATE` transactions. A callback that returns a Promise
is rejected and rolled back so no database transaction spans awaited work,
user interaction, filesystem work, or an external effect. Busy exhaustion is
a typed result. Checkpoint results are explicit; a `TRUNCATE` checkpoint does
not claim success while an active reader still needs WAL frames.

The Domain repository decoder reads all Projects, Tasks, and dependency edges,
checks SQLite storage classes, and invokes `createDomainSnapshot`. The current
schema-version-1 application decoder then reads every registry, bootstrap, local
identity, capability epoch/grant lineage, application and execution request,
decision/audit/lifecycle record, execution sequence/attempt, operation stage,
Manual journal, terminal fact, completion decision, dispatcher record, and all
seven workspace record families. It checks exact storage
classes/enums/JSON/time shapes and all cross-record bindings and returns one
combined immutable state. It proves contiguous vocabularies, exact
sequence/attempt/fence order, at most one active attempt, complete
authorization/request identity, Project/Task revisions, lease/idempotency and
supersession semantics, contiguous prepare/act/finalize authorization binding
chains, exact intent-stage and durable retry evidence, independent inspect
authorization, Manual turn/operation lineage, unique confirmation consumption,
terminal Task/execution/receipt/finalization/completion consistency, plus exact
dispatcher trigger/run ownership, reconciliation completeness, sealed-member,
claim/intent, and terminal-summary lineage. It has no historical schema reader,
union reader, fallback projection, or compatibility decoder.

Grant identifiers are globally unique in the one current grant relation. Each
capability epoch has the exact inventory for its recorded vocabulary: nineteen,
twenty-three, twenty-nine, thirty, or thirty-five direct grants for vocabulary
versions 1, 2, 3, 4, or 5 respectively. Missing, substituted, duplicate-action, wrong-epoch, or
noncontiguous state is corruption. The decoder also requires each dispatcher request,
decision, audit, run, reconciliation summary, membership/member, bound
execution/intent, and run summary to form one exact lineage. Unknown enum/code,
wrong owner/revision, noncontiguous or substituted membership, incomplete
counts, unfinished claimed intent at terminal summary, or cross-run binding is
corruption.

For workspace state, the same decoder proves exact Project/Task/run/member/
membership/execution/attempt/fence ownership, one non-cleaned generation per
owner tuple, positive contiguous generation and predecessor lineage, creator
intent presence, operation/action/status compatibility, contiguous
prepare/act/finalize decisions and observations, verified-receipt/finalization
cardinality, exact allowed phase-to-observation bindings, bounded opaque
evidence references, and the same-generation durable ambiguous acyclic recover
causation chain. An unknown state/code/event, stale fence, denied Act bound to
an observation, missing or substituted receipt, noncontiguous observation,
invalid recover causation, unbounded evidence value, or impossible generation
transition is `CORRUPT_ROW`. The complete workspace family appears once in the
digest-version-1 application projection; backup, restore verification, and
lifecycle authorization therefore bind it without a second projection.

For every accepted delegated `authorization.grant.issue`, it also requires the
new grant's runtime-versus-Project scope, Project identity, and resource
revision to match the persisted issue decision target; provenance authority
alone cannot broaden or redirect that issued scope after the fact.
Historical execution decisions remain valid history after a later Project
config revision: their decision-era resource/config revision must not exceed
the current Project, and any Project-scoped grant is compared with that
decision-era revision rather than reinterpreted against the current config.
Restart, backup verification, and restore all apply this same rule.
Missing, unknown, impossible, or corrupt state is a typed failure: no default,
skipped row, empty replacement, or partial success is returned.

The foundation retains internal one-time Domain initialization and trusted
Domain mutation primitives, but `PersistenceStore` exposes no public
`read`/`initialize`/`commit` product bypass. The application transaction is the
only current product command/query path. It compares the complete expected
snapshot/revisions, applies the trusted Domain or Project mutation and applicable
registry/grant/epoch/lifecycle changes, appends the request/decision/audit
records, then decodes terminal combined state before commit.

Accepted current bootstrap commits request, immutable bootstrap and local
identity records, all nineteen initial grants, and audit atomically. Accepted
upgrade or renewal commits its epoch/grant lineage and
request/decision/audit unit atomically. Accepted application mutation, bounded
query, or lifecycle authorization commits request, allow decision, audit, and
every applicable snapshot, registry, dependency, grant, or handoff change
atomically. Initial execution claim additionally commits request/decision,
sequence/fence, active attempt, Domain `ready`-to-`running` snapshot, audit, and
terminal readback as one unit. Inspection is an audited read transaction;
renewal and only structurally effect-free takeover commit their exact
authorization, attempt/sequence CAS, audit, and readback together. Any
effect-capable state instead requires reliable-loop reconciliation.

Every reliable-loop prepare commits its execution request/decision/audit and
complete intent plus its first immutable authorization binding atomically before
a possible Manual journal call. Executing CAS-binds a fresh Act decision;
observation and verification are separate short transactions; finalization
CAS-binds a fresh Finalize decision with the result. The adapter/control call is
outside all writer transactions. A denied fresh stage commits only its bounded
deny request/decision/audit and cannot advance the binding, invoke a mutation,
or finalize. Verified interruption atomically records the exact terminal
execution fact with Domain cancellation, including the explicit stopped
execution disposition required when the Task is already `waiting`. Manual
completion atomically records its fresh request/decision/audit, immutable
completion decision and terminal execution fact with Domain completion and
terminal readback. A fully bound authorization
denial commits only its deny request/decision/audit. Domain rejection, stale or
uncertain identity before a safe decision, duplicate/replayed request,
corruption, CAS conflict, or injected exception commits no partial operation.
Persistence does not choose a Domain command, evaluate grants/policy, perform
trusted confirmation, or expose direct SQL.

An allowed Manual dispatcher trigger commits its bounded request, final
`dispatch.run` decision/audit, and starting run atomically. Each later run
transition reauthorizes and CAS-matches the trusted worker owner and run
revision. Reconciliation items and their complete summary commit together;
candidate membership seals in one immutable transaction; and each member
terminalizes once. A successful member transaction includes the current claim
and start decisions, Domain `ready`-to-`running` transition, execution
sequence/attempt/fence, complete prepared start intent, and claimed member row
before any adapter call. A fully bound start denial instead commits its separate
no-execution request/decision/audit triple and the terminal denied member in one
transaction, with no Task transition, execution attempt, intent, or adapter
call. Terminal summary and terminal run status commit only after every sealed
member, required denial lineage, and claimed intent pass current readback.
Persistence stores these facts but neither selects candidates nor evaluates
authorization, Domain eligibility, reliable receipt truth, or completion.

Every workspace prepare transaction records its exact authorization decision,
generation allocation when reserving, immutable semantic intent, and prepared
event before a possible backend call. A later short transaction revalidates the
current actor/root, exact current Project/run/member/execution revisions,
stable owner identities/membership/attempt/fence, generation revision, and
grant, binds the act decision, and moves the intent/generation to the
effect-possible state. The injected backend call, trusted callbacks, and receipt
shape/semantic validation occur outside writer transactions. Observation,
verification, and finalization are separate all-or-none transactions; the last
revalidates current authority and fence, applies one resulting generation
transition, inserts one finalization/event, and reads the complete state before
commit. Backend failure or unprovable response loss records explicit failure or
ambiguity without fabricating rollback or replay. Persistence stores and guards
the chosen facts but never calls the backend, authorizes cleanup, interprets a
path, or selects a recovery transition.

## Migration identity and atomicity

The sole migration is `0001-current-baseline.sql`, registry ID
`current-baseline`. Its immutable identity is:

| Version | Canonical line ending | Canonical `checksum_sha256` |
| --- | --- | --- |
| `1` | LF | `34440A65E9CC73BF8C6575F8563745D4FFDD71A9E065E6BD4A6062904174D8CA` |

The pre-EP-03A development baseline checksum
`518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA`
is a named noncurrent identity for refusal evidence only; it has no migration,
reader, adoption, or repair path.

The sole lazily loaded registry accepts a migration source only when it is the
complete exact logical content transported with uniformly LF or uniformly
CRLF line endings. Before any SQLite mutation, it rejects an empty or
BOM-prefixed source, invalid UTF-8, a missing terminal newline, mixed endings,
a lone carriage return, content drift, or a canonical checksum mismatch. It
then reconstructs the entry's declared line ending, verifies the frozen
checksum, and publishes that canonical SQL to every consumer. Source, tests,
build, and the packed `migrations/` inventory all use this registry; there is
no fallback identity.

The registry length is also the sole current schema-target projection: `1`.
Application status reports the migration evidence carried by its open store,
and Doctor reports the `SchemaEvidence` it actually inspected after comparing
it with that target. The independent schema versions of manifests, intents,
receipts, locks, connection receipts, and other persisted JSON are their own
format identities, not aliases for the database schema.

`.gitattributes` records the explicit LF checkout line ending for the baseline.
That checkout policy is a reproducibility guard, not an identity owner. A
future migration must add its own reviewed registry identity
and matching per-file attribute; no wildcard assigns identities to future
files.

Before writable open, any existing primary is inspected read-only. The runner
accepts only schema version 1 with exact `user_version`, the one metadata row,
the one current-baseline history row, exact ID/checksum/registry identity/live
fingerprint, integrity/FK success, and complete current Domain/application
decode. It rejects a zero-length file, absent or incomplete metadata, any other
schema version, extra/missing/reordered history, identity or checksum drift,
schema drift, failed integrity/FK checks, or corrupt typed state before opening
SQLite writable or creating a backup.

Only an absent primary reserved and created by the current runtime owner may
receive the baseline. Baseline SQL, history insert, metadata/fingerprint,
`user_version`, integrity checks, and postcondition form one SQLite transaction.
Failure leaves every baseline object absent. There is no prefix upgrade,
pre-upgrade backup hook, schema-shape inference, metadata repair, or historical
database reader. Existing unknown bytes are never replaced or rewritten.

The baseline Git blob, registry-declared canonical representation, ID, and
checksum are immutable. A future schema change must declare and test every
source identity for which it claims compatibility; no current pre-baseline
database has such a claim.

## Backup generations

Backup uses Node's SQLite online backup API; it never copies a live WAL-mode
main file. The owner allocates an unguessable private stage and publishes the
whole two-member directory by same-parent rename only after all checks pass.
The published inventory is exactly `state.sqlite3` and `manifest.json`.

Every accepted generation uses the one current manifest schema version `1` and
one exact field set. It binds:

- generation ID and the required `manual` kind;
- database filename, byte length, and uppercase SHA-256;
- source schema version, registry identity, schema fingerprint, and complete
  migration history; and
- source application version and creation time; and
- required `application` provenance, the non-null `runtime.backup` lifecycle
  authorization ID and digest, and the exact source application-state digest.

There is no noncurrent manifest reader, `pre_upgrade` kind,
`pre_upgrade_internal` provenance, nullable-authorization writer, or historical
generation success path. A schema-2, unknown-version, missing-field,
extra-field, substituted-provenance, noncanonical, or otherwise malformed
manifest is invalid immutable input. Verification and doctor do not rewrite,
adopt, delete, or repair it.

Verification rejects any extra/missing/reparse member, changed byte, malformed
manifest, incompatible history/schema, integrity/FK failure, or current-schema
combined application decode failure. It binds the generation directory,
manifest, and database identities,
hashes the database, reopens that same object read-only, and repeats exact
identity/content/inventory readback before issuing the generation. A generation
is immutable by contract and is reverified at every use; filesystem write
permission alone is not proof of validity.

Manual backup requires the calling store to hold the sole current connection
receipt and a current `runtime.backup` lifecycle handoff. The owner validates the
handoff before staging and again inside a short writer barrier, proves that the
online clone has the same authorized application-state digest, and revalidates
source/stage/manifest identities before and after publication. A caught
pre-publication failure removes only the exact owned stage; an interruption may
leave stage, lock, and connection evidence for doctor and fails closed. Once the
same-parent rename publishes a generation, the operation returns success only
if that exact generation verifies; invalid publication remains evidence rather
than being silently deleted or replaced.

## Restore and explicit recovery

Restore remains a persistence-owned mechanism exposed through the separately
confirmed product CLI command. The CLI must first obtain current
`runtime.restore` authorization and the exact data-loss acknowledgement; neither
is inferred by persistence from content. Backup inventory and the selected
generation's existence or validity are deliberately deferred until after that
application-owned authorization handoff, so absent or corrupt generation
material cannot become an oracle for revoked, expired, or missing
authority. The persistence request requires the
store to be closed, zero connection receipts, a restorable manifest-schema-1
application-authorized manual generation, the exact typed lifecycle handoff,
`acknowledgeDataLoss: true`, a non-empty application version, and an exact
expected-current raw primary file-set identity. The raw identity
binds the present main/WAL/SHM member names, no-follow file identities, modes,
lengths, and SHA-256 values. A stale or caller-fabricated identity fails before
protected mutation.

The owner clones and verifies the selected generation into an exclusively
reserved restore stage, creates a private retained generation, and writes the
one exact current identity-bound schema-1 restore intent before moving primary bytes. The intent
binds the retained directory identity as well as the backup manifest and backup
authorization digests, current restore authorization and authorized-state
digest, expected primary set, and stage. It then:

1. moves every exact prior primary member into the retained generation without
   overwriting or deleting it;
2. publishes the verified staged database at `state.sqlite3`;
3. performs schema, integrity, history, and typed readback on the published
   target;
4. writes the one exact current immutable schema-1 restore receipt binding the backup and both
   authorization lineages, prior identity, target checksum/schema, retained
   generation identity, application version, and time;
   and
5. removes only the exact owned intent.

There is no automatic reverse migration, overwrite of retained bytes, or
cleanup API. Once the intent exists, failure returns
`RESTORE_RECOVERY_REQUIRED`; normal open remains blocked. Explicit recovery
revalidates the backup, intent, stage/published identity, and the complete
partition of prior members between primary and retained paths. It completes a
recognized pre-publication, post-publication, or post-receipt state. Missing,
duplicated, mixed, substituted, or unknown topology remains
`RESTORE_BLOCKED` for current doctor classification and a later explicit user
decision.

There is no noncurrent restore-intent or restore-receipt reader and no
version-selected optional field set. Both current artifacts use schema version
`1` and always carry the complete backup and restore authorization lineage. A
schema-2, unknown-version, missing-field, extra-field, noncanonical, or
substituted intent or receipt blocks explicit recovery and remains untouched;
doctor reports the associated topology as ambiguous without performing a
recovery write.

The current failpoint evidence covers process interruption at these logical
boundaries. It is not a power-loss durability, hardware recovery, backup
retention, or supported-platform claim.

## Read-only doctor

`inspectRuntimeDoctor` is the sole diagnostic classifier. It never creates a
runtime, acquires or removes the lifecycle lock, creates or releases a
connection receipt, opens SQLite writable, applies a migration, repairs pages,
deletes evidence, changes a backup, completes restore recovery, or fabricates
history. An absent runtime remains absent after inspection.

The closed result is exactly `health`, nullable `initialized`, nullable
`schemaVersion`, nullable `activeUse`, `backupInventory`, and `restoreState`.
`backupInventory` is `not_checked|empty|valid|invalid`; `restoreState` is
`not_checked|none|pending|ambiguous`. Health is one of:

- `healthy` or `not_initialized` for safe readable current state;
- `partial_runtime`, `runtime_active`, `restore_pending`, or
  `restore_ambiguous` for lifecycle/topology state; or
- `runtime_unsafe`, `schema_newer`, `migration_invalid`, `state_corrupt`, or
  `backup_invalid` for a fail-closed diagnostic finding.

Classification first rejects unsafe or incomplete required topology, then
inspects restore and backup inventories without mutation. Ambiguous restore
precedes pending restore, which precedes active lock/receipt state. Only an
inactive runtime is opened read-only for schema/history/integrity and exact
typed-state checks. Newer schema, invalid migration identity, and corrupt state
remain their specific findings; an invalid backup/stage overrides only an
otherwise readable healthy or not-initialized result. The
product CLI serializes only this closed result and discards raw paths, SQLite
errors, rows, pages, and internal identities.

`upgrade_required` remains a closed public doctor enum value during the current
API-major lifecycle, but the current-only classifier has no database state that
emits it: every noncurrent database is `migration_invalid` or `schema_newer`.

## Corruption, incompatible versions, and non-claims

Integrity, FK, schema/history/checksum, storage-class, Domain-shape, backup, or
path-identity failure stops normal access. The foundation does not edit pages,
delete rows, disable constraints, fabricate history, silently retry an
external effect, or initialize a replacement at the same path. A database
newer than the binary is refused. In-place downgrade does not exist; only the
separately acknowledged verified-backup mechanism can publish older data.

The current repository proves a local schema-version-1 persistence/application
foundation, durable claims/leases/fences, reliable Manual-loop records, and
explicit-Manual dispatcher records, plus the durable Fake-only workspace
generation/operation/evidence foundation and versioned local product CLI backup,
separately confirmed restore, and read-only doctor surfaces on the observed
development host. The typed local product facade composes those records without
adding schema or a second writer. This does not establish a release, Windows
support, production Codex/Git/filesystem workspace or Scheduler adapter, scheduled
delivery, ProjectPolicy, CompletionBackend/gates, MCP server, plugin,
deployment, public workspace CLI, or external Project operation. The
Manual journal contains local no-workspace lifecycle facts only;
ProjectRegistry inspection never authorizes or performs a mutation inside a
registered Project.
