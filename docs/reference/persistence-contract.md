# Persistence contract

## Status and authority

This file is the sole normative owner of the implemented SQLite persistence
foundation: runtime-root selection, physical schema allocation, connection and
transaction policy, authoritative Domain/application storage ingress,
migration identity, backup publication, restore recovery, and
incompatible/corrupt-state handling.

The current implementation stores exact Project/Task Domain snapshots plus the
Phase 1 ProjectRegistry, local identity, capability epochs, runtime grants,
application requests, authorization decisions, lifecycle authorizations,
sanitized audit, execution attempts/sequences, and the schema-v6 reliable
Manual-loop records. It
exposes lifecycle operations, read-only doctor, and the typed application
transaction owner; it does not authorize a mutation or select or invoke a
Domain command. The separate Phase 1 product CLI calls these owners and never
opens SQLite directly. Persistence implements the local claim/lease/fence,
authorization vocabulary lineage, operation request/decision/audit,
intent/observation/verified-receipt/finalization, execution terminal, Manual
journal, and Manual completion records described below. It stores no workspace,
scheduler, gate, MCP, or dispatcher-run record. Those later records receive
physical schema only in the ExecPlan that implements their behavior.

Domain values are owned by the [domain contract](domain-contract.md). Manual
effect and future external-effect semantics remain owned by the
[reliability protocol](reliability-protocol.md). This contract owns storage,
not permission or the meaning of an external result.

## Staged schema allocation

SQLite schema allocation is additive and phase-scoped. A migration may add
only records required by its approved implementation phase. A planned field or
table in another contract is not a reservation, and migration `0001` is not a
synonym for the eventual complete product schema.

The repository ships exactly these immutable migrations:

| Version and file | Current physical allocation |
| --- | --- |
| `1`, `0001-persistence-metadata.sql` | `schema_metadata` and `migration_history` only |
| `2`, `0002-phase1-task-storage.sql` | `projects`, `tasks`, `task_dependencies`, and their indexes only |
| `3`, `0003-phase1-application.sql` | `project_registry`, `application_requests`, `authorization_bootstrap`, `authorization_grants`, `authorization_decisions`, `application_audit`, their indexes, and append-only/revoke-only triggers only |
| `4`, `0004-phase1-cli.sql` | Schema-v4 local identity, capability epochs, lifecycle authorization handoffs, expanded finite application vocabulary/audit shapes, provenance-aware grants, indexes, and immutable/revoke-only triggers only |
| `5`, `0005-phase2-execution-claim.sql` | Closed-check expansion for non-grantable capability upgrade and four execution actions, plus `task_execution_sequences`, `execution_attempts`, their indexes, foreign keys, and immutable/CAS transition triggers only |
| `6`, `0006-phase2-manual-execution.sql` | Vocabulary-6 epoch/grant and lifecycle-digest lineage, bounded execution operation request/decision/audit, intent/observation/verified-receipt/finalization/terminal records, durable Manual turn/operation journal, Manual completion decisions, indexes, foreign keys, and exact immutable/CAS triggers only |

Later plans append migrations for their own approved records. Schema v6 does
not pre-allocate workspace, scheduling, gates, ProjectPolicy,
CompletionBackend, MCP, or dispatcher-run records; those are not current
persistence capabilities.

### Migration metadata

`schema_metadata` has the singleton key `1` and exactly these durable fields:

- `schema_version`: the current positive migration version;
- `domain_initialized`: constrained `0`/`1` marker owned by the one-time
  Domain snapshot initializer, so an intentionally empty initialized snapshot
  is distinguishable from an uninitialized store;
- `registry_identity`: uppercase SHA-256 of the ordered applied registry
  prefix;
- `schema_fingerprint`: uppercase SHA-256 of the canonical live
  `sqlite_schema` inventory for that prefix; and
- `updated_at`: the non-empty UTC timestamp written by the migration owner.

`migration_history` is keyed by positive `version`, has a unique non-empty
`migration_id`, and stores `checksum_sha256`, canonical UTC `applied_at`, and
the non-empty `application_version`. The metadata `updated_at` must equal the
last applied history timestamp. History contains exactly one contiguous row per
applied registry member. It is not inferred from table shape.

### Phase 1 Domain Core storage

`projects` stores only:

- `project_id`: opaque non-empty `TEXT` primary key; and
- `enabled`: constrained `INTEGER` boolean `0` or `1`.

This row is the minimum Project value required to reconstruct the implemented
Domain Core. Canonical root and registry revisions live in the separate
Phase 1 `project_registry` owner. Adapter configuration and later lifecycle
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
`cancelled` Tasks. The repository reconstructs the complete graph through the
Domain Core, which remains authoritative for cross-row invariants such as
same-Project parents and acyclic relationships.

`task_dependencies` is keyed by (`task_id`, `dependency_id`), rejects a
self-edge, and has deferred foreign keys to both Tasks. Foreign keys from Tasks
to Projects, parents, and superseded Tasks are also deferred so one atomic
snapshot mutation can insert a valid multi-row graph before commit. Indexes
cover Project, parent, supersession, and reverse-dependency lookup.

All schema-v2 tables use SQLite `STRICT` mode. There is no durable title,
execution, workspace, scheduler, adapter, lease, fence, gate, or external
intent/receipt field in that prefix.

### Phase 1 application storage

Schema version `3` adds only records required by the implemented local
Project/Task/dependency application owner:

- `project_registry` binds one opaque Project ID to a unique canonical local
  root key, platform/device/inode/mode identity, positive config and resource
  revisions, and trusted creation/update times. Its Project row is FK-bound to
  the Domain `projects` row and cannot be deleted.
- `application_requests` binds each fresh request/correlation/actor/action to
  one exact runtime, Project, Task, or grant target and `bootstrap|allow|deny`
  result.
- singleton `authorization_bootstrap` binds the trusted actor/principal and
  immutable runtime-root identity/expiry to its request.
- `authorization_grants` stores the exact finite action, runtime or
  revision-bound Project scope, lifetime, administrative/source provenance,
  and single irreversible CAS revocation.
- `authorization_decisions` records the exact result/reason, policy result,
  nullable grant revision, and nullable Project revision for one request.
- `application_audit` stores one allowlisted event/result/reason with fixed
  sanitized JSON metadata; it does not store Task bodies, Project paths,
  prompts, tool output, Agent text, or secrets.

Schema version `4` rebuilds only the five schema-v3 tables whose closed checks
or provenance shape must expand. It preserves all schema-v3 rows and adds:

- `authorization_local_identity`, the immutable versioned actor/principal digest
  and runtime-root binding used by local ingress;
- `authorization_capability_epochs`, an immutable contiguous renewal/adoption
  lineage bound to the exact vocabulary digest; and
- `application_lifecycle_authorizations`, immutable short-lived backup/restore
  handoffs bound to authorization evidence and the application-state digest.

The rebuilt request, bootstrap, grant, decision, and audit tables add only the
finite Phase 1 CLI actions, capability-renewal record shape, epoch provenance,
and lifecycle event/target shapes. Every schema-v3/v4 application table is
`STRICT`. Requests, bootstrap, identity, epochs, decisions, lifecycle
authorizations, and audit are append-only; grants are insert-only except for one
revision-incrementing revocation. There are still no execution, intent/effect,
workspace, scheduler, claim/lease/fence, gate, completion, adapter, MCP, or
dispatcher tables.

Schema version `5` rebuilds only the closed-check application relations that
must admit the non-grantable upgrade action and four grantable execution
actions. Bidirectional row-set assertions preserve every prior request,
bootstrap, grant, decision, audit, and lifecycle-authorization row. Existing
lifecycle rows receive internal `state_digest_version = 1`, which continues the
exact schema-v4 application-state projection; schema-v5 lifecycle writers use
version `2`, whose projection additionally binds execution sequences and
attempts. The version is persistence provenance and does not alter the closed
public handoff or its digest. Schema version `5` then adds only:

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
sequences cannot be deleted. The migration creates neither capability epoch nor
grant nor execution row, so upgrade authority is never a migration side effect.
Every prior vocabulary-3/4 row and every version-1 lifecycle digest remains
strictly readable. Doctor, pre-migration decode, manual-backup verification and
post-migration decode select the exact recorded projection; they never
reinterpret a historical digest with the version-2 execution fields.

Schema version `6` leaves migrations 0001-0005 and their records unchanged. It
adds an immutable vocabulary-6 epoch, a vocabulary-6 grant relation for the six
new Manual actions, and an immutable epoch-link relation for the twenty-three
already-representable actions whose grants remain in `authorization_grants` so
existing application decision and lifecycle foreign keys remain exact. Migration,
bootstrap, and renewal create no new authority. A successful, separately
confirmed vocabulary-5-to-6 upgrade alone appends one epoch and exactly
twenty-nine current origin grants. `application_lifecycle_digest_v6` records
digest provenance version `3`; lifecycle digest versions 1 and 2 retain their
exact historical projections, while version 3 additionally binds every
schema-v6 operation/journal/completion relation.

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

The migration itself inserts no vocabulary-6 epoch/grant, lifecycle digest,
execution operation, Manual turn, receipt, finalization, terminal, or completion
row. Its final row-set assertion proves that zero-allocation property and that
foreign-key validation is empty.

## Writer and reader closure

| Records | Only writer | Readers |
| --- | --- | --- |
| `schema_metadata.schema_version`, registry identity/fingerprint, `updated_at`, and `migration_history` | `src/persistence/migrations.ts` | startup compatibility, backup/restore verification, and current read-only doctor |
| `schema_metadata.domain_initialized` one-time `0` to `1` transition | `src/persistence/repository.ts` inside the initial snapshot transaction | startup compatibility, repository decoder, backup/restore verification |
| `projects`, `tasks`, `task_dependencies` | `src/persistence/repository.ts`, invoked only through the internal Phase 1 application transaction after initialization | the same repository decoder, combined application decoder, backup verification, and doctor |
| `project_registry` | `src/persistence/application-repository.ts` in the accepted application transaction | the combined decoder and application service |
| `authorization_bootstrap`, `authorization_local_identity`, vocabulary-4/5 `authorization_capability_epochs`/`authorization_grants`, vocabulary-6 `authorization_capability_epochs_v6`/`authorization_grants_v6`, and `authorization_grant_epoch_v6_links` for vocabulary-6 origins of already-representable actions | `src/persistence/application-repository.ts` in bootstrap, adoption/renewal/upgrade, or authorized grant transactions | the combined decoder and application authorization owner |
| `application_requests`, `authorization_decisions`, `application_audit`, `application_lifecycle_authorizations`, `application_lifecycle_digest_v6` | `src/persistence/application-repository.ts` in the same decision/operation transaction | the combined decoder, application result mapping, lifecycle verifier, backup verification, and doctor |
| `task_execution_sequences`, `execution_attempts` | `src/persistence/application-repository.ts` only inside the typed execution application transaction | the combined decoder, execution application owner, backup verification, and doctor |
| `execution_operation_requests`, `execution_authorization_decisions`, `execution_operation_audit`, `execution_operation_intents`, `execution_intent_authorization_bindings`, `execution_observations`, `execution_verified_receipts`, `execution_finalizations`, `execution_terminal_states`, `manual_completion_decisions` | `src/persistence/application-repository.ts` only inside reliable-loop transactions after the application owner selects and authorizes the exact operation | the combined decoder, reliable execution owner, backup verification, and doctor |
| `manual_backend_turns`, `manual_backend_operations` | `src/persistence/manual-backend-repository.ts` through the injected production Manual backend/control after a matching committed core intent | the same journal, combined decoder, reliable execution owner, backup verification, and doctor |
| backup generation and manifest | `src/persistence/backup.ts` under the lifecycle lock | the same verifier, restore, and current CLI/doctor surfaces |
| lifecycle lock and connection receipts | `src/persistence/runtime.ts` | persistence lifecycle operations only |
| restore intent, retained generation, and restore receipt | `src/persistence/backup.ts` under the lifecycle lock | explicit recovery and current doctor/CLI surfaces |

No product surface opens SQLite or writes these paths directly. The Manual
adapter reaches only its declared journal writer and cannot write core records;
a CLI, MCP server, scheduler, or Agent output cannot become a second writer.
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

Readers use a synchronous SQLite snapshot transaction. Writers use short
synchronous `BEGIN IMMEDIATE` transactions. A callback that returns a Promise
is rejected and rolled back so no database transaction spans awaited work,
user interaction, filesystem work, or an external effect. Busy exhaustion is
a typed result. Checkpoint results are explicit; a `TRUNCATE` checkpoint does
not claim success while an active reader still needs WAL frames.

The Domain repository decoder reads all Projects, Tasks, and dependency edges,
checks SQLite storage classes, and invokes `createDomainSnapshot`. The current
schema-v6 application decoder then reads every registry, bootstrap, local
identity, capability epoch/grant lineage, application and execution request,
decision/audit/lifecycle record, execution sequence/attempt, operation stage,
Manual journal, terminal fact, and completion decision. It checks exact storage
classes/enums/JSON/time shapes and all cross-record bindings and returns one
combined immutable state. It proves contiguous vocabularies, exact
sequence/attempt/fence order, at most one active attempt, complete
authorization/request identity, Project/Task revisions, lease/idempotency and
supersession semantics, contiguous prepare/act/finalize authorization binding
chains, exact intent-stage and durable retry evidence, independent inspect
authorization, Manual turn/operation lineage, unique confirmation consumption,
and terminal Task/execution/receipt/finalization/completion consistency. It also
retains exact legacy schema-v5, schema-v4, and schema-v3 decoders needed for
upgrade and read-only doctor
classification. Those readers consume the exact released physical shapes and
apply their complete historical cross-record validation without manufacturing
new vocabulary, identity, lifecycle, or execution rows.

For schema version `6`, the combined authorization decoder preserves each
grant's physical relation instead of erasing it during union. Grant identifiers
and grant-relation identifiers are globally unique across the legacy and v6
relations. Every vocabulary-6 epoch has the exact twenty-nine-action inventory:
the twenty-three already-representable actions are legacy grants with immutable
epoch links, and the six Manual actions are v6 grants. Missing, substituted,
wrong-relation, duplicate-ID, or cross-relation-collision state is corruption.

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

Accepted schema-v6 bootstrap commits request, immutable bootstrap and local
identity records, all nineteen initial grants, and audit atomically. Accepted
adoption/upgrade/renewal commits its identity/epoch/grant lineage and
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

## Migration identity and atomicity

Migration files use immutable names `NNNN-short-name.sql`. `NNNN` is the
strictly increasing four-digit version, `migration_id` is the registry's
non-empty semantic ID, and `checksum_sha256` is uppercase SHA-256 of the
registry-declared canonical UTF-8 representation. It is not derived from the
checkout transport or Git's normalized storage representation. Each registry
entry freezes both that checksum and one canonical line ending:

| Version | Canonical line ending | Canonical `checksum_sha256` |
| --- | --- | --- |
| `1` | CRLF | `E31C5A3D24E4DB99620635A9CE83F752978C5FD2AF7A15C84CE13BEECAC9C34F` |
| `2` | CRLF | `0FC2DEECBC8ABBA31F9E5063A870706320F66C5AEE882E4A05DA0CADCF9CEC7E` |
| `3` | CRLF | `58D428B10198B7483ECB6CED2F88D8DA81A97B052CF650ED4CD012D7183F0702` |
| `4` | LF | `3446455B4A49C2339EC22E6B99FFF5DD43908D0BEB45EFCE099A79D732CF6557` |
| `5` | LF | `27AB1730F5A56A2127479C02570068E6BA1CA3DB565147FB0325AAA412CD5C81` |
| `6` | LF | `5D072BF264E579F011D85FF017EF595B93D9CA6FD18400830AC1E0A1ACCFFD87` |

The sole lazily loaded registry accepts a migration source only when it is the
complete exact logical content transported with uniformly LF or uniformly
CRLF line endings. Before any SQLite mutation, it rejects an empty or
BOM-prefixed source, invalid UTF-8, a missing terminal newline, mixed endings,
a lone carriage return, content drift, or a canonical checksum mismatch. It
then reconstructs the entry's declared line ending, verifies the frozen
checksum, and publishes that canonical SQL to every consumer. Source, tests,
build, and the packed `migrations/` inventory all use this registry; there is
no fallback identity.

The registry length is also the sole current schema-target projection.
Application status reports the migration evidence carried by its open store,
and Doctor reports the `SchemaEvidence` it actually inspected after comparing
it with that target. Explicit released database-reader thresholds and the
independent schema versions of manifests, intents, receipts, locks, connection
receipts, and other persisted JSON are compatibility identities, not aliases
for the mutable current target.

`.gitattributes` records one explicit historical checkout line ending for each
shipped migration. That checkout policy is a reproducibility guard, not an
identity owner. A future migration must add its own reviewed registry identity
and matching per-file attribute; no wildcard assigns identities to future
files.

Before writable open, an existing database is inspected read-only. The runner
rejects an absent/incomplete metadata owner, unknown or newer version,
non-contiguous/missing/reordered history, ID or checksum mismatch, registry
identity mismatch, live schema-fingerprint mismatch, failed integrity/FK
check, or bad Domain/combined application decode. A schema-v3 application prefix
must pass the shared complete schema-v3 decoder before any writable open,
pre-upgrade backup, migration statement, or database-byte change. It never
initializes a replacement over an existing empty, corrupt, or incompatible
database.

Fresh version `0` initialization applies the registry without a pre-upgrade
backup because no prior database state exists. An existing recognized earlier
prefix must have zero connection receipts and a verified pre-upgrade backup
before the next migration starts. Each migration's SQL, history insert,
metadata/fingerprint update, `user_version`, integrity checks, and declared
postcondition establish one SQLite transaction. Failure or interruption leaves
that migration wholly absent or wholly committed; restart begins at the first
absent registry member.

Released migration Git blobs, registry-declared canonical representations,
IDs, and checksums are never edited, reordered, or skipped. Existing history
is never rewritten or repaired to accommodate an unknown checksum or registry
identity. Later plans append new files and must test every shipped earlier
prefix they claim to upgrade.

## Backup generations

Backup uses Node's SQLite online backup API; it never copies a live WAL-mode
main file. The owner allocates an unguessable private stage and publishes the
whole two-member directory by same-parent rename only after all checks pass.
The published inventory is exactly `state.sqlite3` and `manifest.json`.

New generations use manifest schema version `2`. Its common fields bind:

- generation ID and `manual` or `pre_upgrade` kind;
- database filename, byte length, and uppercase SHA-256;
- source schema version, registry identity, schema fingerprint, and complete
  migration history; and
- source application version and creation time.

Schema `2` additionally binds one exact provenance form:

- an application-authorized `manual` backup records the lifecycle authorization
  ID and digest plus the exact source application-state digest; or
- an internal `pre_upgrade` backup records `pre_upgrade_internal` provenance and
  no lifecycle authorization.

Manifest schema `1` remains readable only as immutable historical verification
evidence. A pre-upgrade generation, schema-1 generation, non-manual generation,
or manual generation without current schema-2 application provenance is not a
product restore source.

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
material cannot become an oracle for revoked, expired, missing, or pre-adoption
authority. The persistence request requires the
store to be closed, zero connection receipts, a restorable schema-2
application-authorized manual generation, the exact typed lifecycle handoff,
`acknowledgeDataLoss: true`, a non-empty application version, and an exact
expected-current raw primary file-set identity. The raw identity
binds the present main/WAL/SHM member names, no-follow file identities, modes,
lengths, and SHA-256 values. A stale or caller-fabricated identity fails before
protected mutation.

The owner clones and verifies the selected generation into an exclusively
reserved restore stage, creates a private retained generation, and writes one
identity-bound schema-2 restore intent before moving primary bytes. The intent
binds the retained directory identity as well as the backup manifest and backup
authorization digests, current restore authorization and authorized-state
digest, expected primary set, and stage. It then:

1. moves every exact prior primary member into the retained generation without
   overwriting or deleting it;
2. publishes the verified staged database at `state.sqlite3`;
3. performs schema, integrity, history, and typed readback on the published
   target;
4. writes one immutable schema-2 restore receipt binding the backup and both
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

- `healthy`, `not_initialized`, or `upgrade_required` for safe readable state;
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
otherwise readable healthy, not-initialized, or upgrade-required result. The
product CLI serializes only this closed result and discards raw paths, SQLite
errors, rows, pages, and internal identities.

## Corruption, incompatible versions, and non-claims

Integrity, FK, schema/history/checksum, storage-class, Domain-shape, backup, or
path-identity failure stops normal access. The foundation does not edit pages,
delete rows, disable constraints, fabricate history, silently retry an
external effect, or initialize a replacement at the same path. A database
newer than the binary is refused. In-place downgrade does not exist; only the
separately acknowledged verified-backup mechanism can publish older data.

The current repository proves a local schema-v6 persistence/application
foundation, library-only durable claims/leases/fences and reliable Manual-loop
records, plus Phase 1 CLI backup, separately confirmed restore, and read-only
doctor surfaces on the observed development host. It does not establish a
release, Windows support, public or executable execution runtime, Codex/Git/
workspace/Scheduler adapter, ProjectPolicy, CompletionBackend/gates,
dispatcher, MCP server, plugin, deployment, or external Project operation. The
Manual journal contains local no-workspace lifecycle facts only;
ProjectRegistry inspection never authorizes or performs a mutation inside a
registered Project.
