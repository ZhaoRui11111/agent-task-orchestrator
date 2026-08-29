# Persistence contract

## Status and authority

This file is the sole normative owner of the implemented SQLite persistence
foundation: runtime-root selection, physical schema allocation, connection and
transaction policy, authoritative Domain/application storage ingress,
migration identity, backup publication, restore recovery, and
incompatible/corrupt-state handling.

The current implementation stores exact Project/Task Domain snapshots plus the
Phase 1 ProjectRegistry, runtime grants, application requests, authorization
decisions, and sanitized audit. It exposes lifecycle operations and the typed
application transaction owner; it does not authorize a mutation or select or
invoke a Domain command. It provides no product CLI and implements no
execution, workspace, scheduler, intent/effect, claim, lease, fence, gate,
completion, adapter, MCP, or dispatcher record. Those records receive physical
schema only in the later ExecPlan that owns their behavior.

Domain values are owned by the [domain contract](domain-contract.md). Future
external-effect semantics remain owned by the
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

Later plans append migrations for their own approved records. Phase 2 or Phase
3 execution, workspace, scheduling, intent/effect, claim/lease/fence,
gate, completion, adapter, MCP, and dispatcher records are not allocated by
these migrations and are not current persistence capabilities.

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
schema-v3 `project_registry` owner. Adapter configuration and later lifecycle
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

Every schema-v3 table is `STRICT`. Requests, bootstrap, decisions, and audit
are append-only; grants are insert-only except for one revision-incrementing
revocation. There are still no execution, intent/effect, workspace, scheduler,
claim/lease/fence, gate, completion, adapter, MCP, or dispatcher tables.

## Writer and reader closure

| Records | Only writer | Readers |
| --- | --- | --- |
| `schema_metadata.schema_version`, registry identity/fingerprint, `updated_at`, and `migration_history` | `src/persistence/migrations.ts` | startup compatibility, backup/restore verification, future doctor surface |
| `schema_metadata.domain_initialized` one-time `0` to `1` transition | `src/persistence/repository.ts` inside the initial snapshot transaction | startup compatibility, repository decoder, backup/restore verification |
| `projects`, `tasks`, `task_dependencies` | `src/persistence/repository.ts`, invoked only through the internal schema-v3 application transaction after initialization | the same repository decoder, combined application decoder, backup verification |
| `project_registry` | `src/persistence/application-repository.ts` in the accepted application transaction | the combined decoder and application service |
| `authorization_bootstrap`, `authorization_grants` | `src/persistence/application-repository.ts` in bootstrap or authorized grant transactions | the combined decoder and application authorization owner |
| `application_requests`, `authorization_decisions`, `application_audit` | `src/persistence/application-repository.ts` in the same decision/operation transaction | the combined decoder, application result mapping, backup verification, and later operational surfaces |
| backup generation and manifest | `src/persistence/backup.ts` under the lifecycle lock | the same verifier and later user surfaces |
| lifecycle lock and connection receipts | `src/persistence/runtime.ts` | persistence lifecycle operations only |
| restore intent, retained generation, and restore receipt | `src/persistence/backup.ts` under the lifecycle lock | explicit recovery and later doctor/user surfaces |

No product surface opens SQLite or writes these paths directly. An adapter,
CLI, MCP server, scheduler, or Agent output cannot become a second writer.
Future schema additions update this closure in the migration and ExecPlan that
introduces their implementation.

## Runtime root and path ownership

Runtime data is outside the source checkout and every supplied Project root.

- An explicit root takes precedence. Otherwise
  `TASK_ORCHESTRATOR_DATA_DIR` selects an untrusted candidate. On Windows only,
  the default is the operating-system local application-data directory plus
  `agent-task-orchestrator`; another platform has no default in this phase.
- The candidate must be absolute, non-root, lexically traversal-free, and
  non-overlapping in either direction with the canonical source checkout or
  any supplied Project root.
- Every existing or created ancestor and target is a real directory, not a
  symlink, junction, or reparse alias. Creation validates parent identity
  before and after the mutation. A resolved alias or identity change fails
  closed.
- The issued runtime layout owns all descendant names: `state.sqlite3`,
  `backups`, `connections`, `restore`, the lifecycle lock, staging roots,
  retained roots, and receipts. Callers cannot supply those descendant paths.
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
checks SQLite storage classes, and invokes `createDomainSnapshot`. The
schema-v3 application decoder then reads every registry, bootstrap, grant,
request, decision, and audit row, checks exact storage classes/enums/JSON/time
shapes and all cross-record bindings, and returns one combined immutable state.
For every accepted delegated `authorization.grant.issue`, it also requires the
new grant's runtime-versus-Project scope, Project identity, and resource
revision to match the persisted issue decision target; provenance authority
alone cannot broaden or redirect that issued scope after the fact.
Missing, unknown, impossible, or corrupt state is a typed failure: no default,
skipped row, empty replacement, or partial success is returned.

The foundation retains internal one-time Domain initialization and trusted
Domain mutation primitives, but `PersistenceStore` exposes no public
`read`/`initialize`/`commit` product bypass. The application transaction is the
only current product command/query path. It compares the complete expected
snapshot/revisions, applies the trusted Domain or Project mutation and
applicable registry/grant changes, appends the request/decision/audit records,
then decodes terminal combined state before commit.

Accepted bootstrap commits request, immutable bootstrap receipt, all fifteen
initial grants, and audit atomically. Accepted application mutation or exact
read commits request, allow decision, audit, and every applicable snapshot,
registry, dependency, or grant change atomically. A fully bound authorization
denial commits only its deny request/decision/audit. Domain rejection, stale or
uncertain identity before a safe decision, duplicate/replayed request,
corruption, CAS conflict, or injected exception commits no partial operation.
Persistence does not choose a Domain command, evaluate grants/policy, perform
trusted confirmation, or expose direct SQL.

## Migration identity and atomicity

Migration files use immutable names `NNNN-short-name.sql`. `NNNN` is the
strictly increasing four-digit version, `migration_id` is the registry's
non-empty semantic ID, and `checksum_sha256` is uppercase SHA-256 of the exact
committed UTF-8 file bytes. One lazily loaded registry is used by source,
tests, build, and the packed `migrations/` inventory.

Before writable open, an existing database is inspected read-only. The runner
rejects an absent/incomplete metadata owner, unknown or newer version,
non-contiguous/missing/reordered history, ID or checksum mismatch, registry
identity mismatch, live schema-fingerprint mismatch, failed integrity/FK
check, or bad Domain/combined application decode. It never initializes a replacement over an
existing empty, corrupt, or incompatible database.

Fresh version `0` initialization applies the registry without a pre-upgrade
backup because no prior database state exists. An existing recognized earlier
prefix must have zero connection receipts and a verified pre-upgrade backup
before the next migration starts. Each migration's SQL, history insert,
metadata/fingerprint update, `user_version`, integrity checks, and declared
postcondition establish one SQLite transaction. Failure or interruption leaves
that migration wholly absent or wholly committed; restart begins at the first
absent registry member.

Released migration bytes are never edited, reordered, or skipped. Later plans
append new files and must test every shipped earlier prefix they claim to
upgrade.

## Backup generations

Backup uses Node's SQLite online backup API; it never copies a live WAL-mode
main file. The owner allocates an unguessable private stage and publishes the
whole two-member directory by same-parent rename only after all checks pass.
The published inventory is exactly `state.sqlite3` and `manifest.json`.

Manifest schema version `1` binds:

- generation ID and `manual` or `pre_upgrade` kind;
- database filename, byte length, and uppercase SHA-256;
- source schema version, registry identity, schema fingerprint, and complete
  migration history; and
- source application version and creation time.

Verification rejects any extra/missing/reparse member, changed byte, malformed
manifest, incompatible history/schema, integrity/FK failure, or current-schema
combined application decode failure. It binds the generation directory,
manifest, and database identities,
hashes the database, reopens that same object read-only, and repeats exact
identity/content/inventory readback before issuing the generation. A generation
is immutable by contract and is reverified at every use; filesystem write
permission alone is not proof of validity.

## Restore and explicit recovery

Restore is a lower-level persistence mechanism, not a product CLI command. It
requires the store to be closed, zero connection receipts, a verified backup
generation ID, `acknowledgeDataLoss: true`, a non-empty application version,
and an exact expected-current raw primary file-set identity. The raw identity
binds the present main/WAL/SHM member names, no-follow file identities, modes,
lengths, and SHA-256 values. A stale or caller-fabricated identity fails before
protected mutation.

The owner clones and verifies the selected generation into an exclusively
reserved restore stage, creates a private retained generation, and writes one
identity-bound restore intent before moving primary bytes. The intent binds
the retained directory identity as well as the backup, expected primary set,
and stage. It then:

1. moves every exact prior primary member into the retained generation without
   overwriting or deleting it;
2. publishes the verified staged database at `state.sqlite3`;
3. performs schema, integrity, history, and typed readback on the published
   target;
4. writes one immutable restore receipt binding the backup, prior identity,
   target checksum/schema, retained generation identity, application version,
   and time;
   and
5. removes only the exact owned intent.

There is no automatic reverse migration, overwrite of retained bytes, or
cleanup API. Once the intent exists, failure returns
`RESTORE_RECOVERY_REQUIRED`; normal open remains blocked. Explicit recovery
revalidates the backup, intent, stage/published identity, and the complete
partition of prior members between primary and retained paths. It completes a
recognized pre-publication, post-publication, or post-receipt state. Missing,
duplicated, mixed, substituted, or unknown topology remains
`RESTORE_BLOCKED` for a later doctor/user decision.

The current failpoint evidence covers process interruption at these logical
boundaries. It is not a power-loss durability, hardware recovery, backup
retention, or supported-platform claim.

## Corruption, incompatible versions, and non-claims

Integrity, FK, schema/history/checksum, storage-class, Domain-shape, backup, or
path-identity failure stops normal access. The foundation does not edit pages,
delete rows, disable constraints, fabricate history, silently retry an
external effect, or initialize a replacement at the same path. A database
newer than the binary is refused. In-place downgrade does not exist; only the
separately acknowledged verified-backup mechanism can publish older data.

The current repository proves a local schema-v3 persistence and application
foundation on the observed development host. It does not establish a release,
Windows support, a running/completed execution loop,
Manual/Codex/Git/Scheduler adapter, claim/completion protocol, product CLI,
`backup`/`restore`/`doctor` user surface, MCP server, plugin, deployment, or
external Project operation. ProjectRegistry inspection never authorizes or
performs a mutation inside a registered Project.
