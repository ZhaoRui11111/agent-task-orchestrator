# Persistence contract

## Status and authority

This file is the sole normative owner of the planned SQLite persistence model,
connection and transaction policy, authoritative storage ingress, migration and
backup mechanics, corruption and downgrade handling, and runtime data location.
No database, migration runner, repository implementation, or validated Windows
behavior exists yet.

Domain values referenced here are defined by the
[domain contract](domain-contract.md). Durable operation semantics are defined
by the [reliability protocol](reliability-protocol.md); this file owns how those
records are stored, not what an external result means.

## Runtime location

Runtime data MUST be outside the source checkout and outside every registered
Project root by default.

- On Windows, the default runtime root is the operating-system local application
  data directory plus `agent-task-orchestrator`.
- `TASK_ORCHESTRATOR_DATA_DIR` may override the root only with an absolute,
  canonicalizable, non-filesystem-root path.
- The process rejects a root that is the source checkout, lies below a
  registered Project, contains an unresolved path component, or aliases either
  through a link or reparse point.
- The primary database is `<runtime-root>/state.sqlite3`; backups, logs, and
  diagnostic bundles use distinct child directories. None is source material or
  eligible for Git staging.
- Directory creation uses user-only permissions when the host supports them and
  fails closed when the resolved target changes during creation.

The completion/workspace owner defines safety for managed workspaces; these
rules apply to the persistence runtime root only.

## SQLite logical schema

The initial physical migration MUST implement the following logical records.
Identifiers are opaque non-empty `TEXT`; timestamps are UTC epoch milliseconds
stored as `INTEGER`; booleans are constrained `INTEGER` values `0` or `1`;
version and revision counters are positive `INTEGER`; structured payloads are
canonical UTF-8 JSON `TEXT` with an explicitly named schema version. Nullable
fields below are marked `?`; every other field is non-null.

| Table | Primary/unique identity | Required fields |
| --- | --- | --- |
| `schema_metadata` | singleton key `1` | `current_version`, `minimum_reader_version`, `last_migration_id`, `updated_at` |
| `migration_history` | `version`; unique `migration_id` | `checksum`, `application_version`, `applied_at` |
| `projects` | `project_id`; unique `canonical_root` and unique `repository_identity` | `canonical_root`, `repository_identity`, `enabled`, `execution_backend_ref`, `execution_backend_contract_version`, `workspace_backend_ref`, `workspace_backend_contract_version`, `scheduler_backend_ref`, `scheduler_backend_contract_version`, `project_policy_ref`, `project_policy_contract_version`, `completion_backend_ref`, `completion_backend_contract_version`, `config_revision`, `revision`, `created_at`, `updated_at` |
| `schedules` | `schedule_id`; unique `registration_identity` when non-null | `project_id?`, `scope_kind`, `scope_id`, `scheduler_actor_id`, `scheduler_ref`, `scheduler_contract_version`, `expression`, `timezone`, `dispatcher_target_identity`, `config_revision`, `registration_identity?`, `enabled`, `revision`, `created_at`, `updated_at` |
| `tasks` | `task_id`; unique (`project_id`, `task_id`) | `project_id`, `parent_id?`, `supersedes_task_id?`, `state`, `title`, `body`, `waiting_reason?`, `waiting_phase?`, `required_action?`, `last_error_code?`, `last_error_summary?`, `retryable?`, `retry_count?`, `retry_after?`, `waiting_execution_id?`, `workspace_revision?`, `backend_thread_id?`, `waiting_task_revision?`, `revision`, `created_at`, `updated_at`, `terminal_at?` |
| `task_dependencies` | (`task_id`, `depends_on_task_id`) | `created_at`; both Task references are foreign keys and a self-edge is rejected |
| `executions` | `execution_id`; unique (`task_id`, `attempt_number`) and unique `idempotency_key` | `task_id`, `run_id`, `attempt_number`, `idempotency_key`, `backend_ref`, `backend_contract_version`, `backend_thread_id?`, `phase`, `status`, `semantic_input_revision`, `authorization_decision_ref`, `policy_ref`, `policy_version`, `policy_revision`, `workspace_id?`, `claim_owner?`, `lease_expires_at?`, `lease_revision`, `fencing_token`, `created_at`, `updated_at`, `terminal_at?` |
| `workspaces` | `workspace_id`; unique (`execution_id`, `generation`) and unique (`canonical_path`, `generation`) | `project_id`, `task_id`, `execution_id`, `run_id`, `creator_operation_id`, `fencing_token`, `adapter_ref`, `adapter_contract_version`, `trusted_workspace_root_identity`, `canonical_path`, `generation`, `repository_identity`, `git_common_directory_identity`, `worktree_registration_identity`, `branch_ref?`, `base_oid`, `head_oid`, `policy_ref`, `policy_version`, `policy_revision`, `creation_intent_id`, `creation_receipt_id`, `ownership_receipt_schema_version`, `ownership_receipt_json`, `inventory_schema_version`, `inventory_json`, `lifecycle`, `revision`, `created_at`, `updated_at` |
| `authorization_decisions` | `decision_id`; unique non-null (`decision_kind`, `query_id`) | `decision_kind`, `query_id?`, `correlation_id`, `actor_id`, `delegated_by_actor_id?`, `action`, `scope_kind`, `scope_id`, `resource_kind`, `resource_id`, `expected_resource_revision`, `grant_id?`, `grant_revision?`, `grant_expires_at?`, `domain_evidence_ref?`, `ownership_receipt_ref?`, `policy_binding_kind`, `policy_ref?`, `policy_version?`, `policy_revision?`, `policy_receipt_ref?`, `external_authority_status`, `result`, `reason_code`, `decided_at`, `valid_until`, `consumed_at?`, `consumer_kind?`, `consumer_id?` |
| `adapter_query_receipts` | `query_receipt_id`; unique (`query_id`, `observation_number`) | `query_id`, `query_kind`, `authorization_decision_ref`, `correlation_id`, `contract_id`, `adapter_ref`, `adapter_version`, `observed_endpoint_version?`, `operation_name`, `subject_resource_identity_json`, `input_identity_json`, `outcome`, `reason_code`, `observation_number`, `evidence_ref`, `observed_at`, `valid_until?`, `payload_schema_version`, `payload_json` |
| `operation_intents` | `intent_id`; unique `semantic_key` and unique `idempotency_key` | `semantic_key`, `idempotency_key`, `operation_kind`, `task_id?`, `expected_task_revision?`, `execution_id?`, `execution_attempt_number?`, `resource_kind`, `resource_id`, `expected_resource_revision`, `semantic_input_identity`, `authorization_decision_ref`, `authorization_binding_revision`, `policy_binding_kind`, `policy_ref?`, `policy_version?`, `policy_revision?`, `adapter_ref`, `adapter_contract_version`, `workspace_id?`, `workspace_generation?`, `repository_identity?`, `head_oid?`, `state`, `retry_count`, `retry_after?`, `created_at`, `updated_at` |
| `operation_receipts` | `receipt_id`; unique (`intent_id`, `observation_number`) | `intent_id`, `observation_number`, `correlation_id`, `adapter_ref`, `adapter_contract_version`, `observed_endpoint_version?`, `outcome`, `reason_code`, `pre_identity_json`, `post_identity_json`, `verification_verdict`, `evidence_ref`, `observed_at`, `payload_schema_version`, `payload_json` |
| `gate_receipts` | `gate_receipt_id`; unique complete gate identity defined below | `task_id`, `task_revision`, `execution_id`, `fencing_token`, `workspace_id`, `workspace_generation`, `workspace_revision`, `repository_identity`, `head_oid`, `policy_ref`, `policy_version`, `policy_revision`, `gate_id`, `gate_version`, `gate_input_identity`, `completion_adapter_ref`, `completion_adapter_version`, `tool_environment_identity`, `verdict`, `evidence_ref`, `started_at`, `completed_at`, `valid_until?` |
| `integration_reservations` | `reservation_id` | `project_id`, `repository_identity`, `target_ref`, `expected_target_oid`, `source_workspace_id`, `source_workspace_generation`, `source_head_oid`, `owner_execution_id`, `owner_operation_id`, `lease_owner`, `lease_revision`, `fencing_token`, `expires_at`, `policy_ref`, `policy_version`, `policy_revision`, `authorization_decision_ref`, `intent_id`, `current_observation_ref?`, `status`, `revision`, `created_at`, `updated_at`, `terminal_at?` |
| `authorization_bootstrap` | singleton key `1` | `bootstrap_actor_id`, `os_principal_identity`, `runtime_root_identity`, `created_at`, `expires_at`, `consumed_at?`, `initial_grant_ids_json?`, `revision` |
| `authorization_grants` | `grant_id` | `grant_revision`, `actor_id`, `delegated_by_actor_id?`, `action`, `scope_kind`, `scope_id`, `resource_revision`, `issued_by`, `issued_at`, `expires_at`, `constraints_schema_version`, `constraints_json`, `correlation_id`, `revoked_at?` |
| `audit_events` | monotonic `sequence`; unique `event_id` | `event_type`, `actor_id`, `action`, `aggregate_kind`, `aggregate_id`, `before_revision?`, `after_revision?`, `correlation_id`, `payload_schema_version`, `payload_json`, `occurred_at` |
| `scheduled_dispatches` | `scheduled_dispatch_id`; unique (`schedule_id`, `schedule_config_revision`, `scheduled_for`) and unique `canonical_run_id` | `schedule_id`, `schedule_config_revision`, `scheduled_for`, `canonical_run_id`, `created_at` |
| `scheduler_trigger_observations` | `trigger_observation_id` | `trigger_kind`, `correlation_id`, `scheduler_ref`, `scheduler_contract_version`, `registration_identity?`, `derived_actor_id`, `trigger_id?`, `schedule_id?`, `schedule_config_revision?`, `scheduled_for?`, `observed_delivery_at`, `scheduled_dispatch_id?`, `canonical_run_id?`, `attachment_role`, `disposition`, `authorization_decision_ref?`, `reason_code`, `payload_schema_version`, `redacted_payload_json` |
| `dispatcher_runs` | `run_id` | `trigger_kind`, `correlation_id`, `authorization_decision_ref`, `status`, `worker_id?`, `owner_revision`, `revision`, `heartbeat_at?`, `reconciliation_summary_json?`, `candidate_snapshot_revision?`, `candidate_expected_count?`, `candidate_snapshot_at?`, `fanout_summary_json?`, `created_at`, `started_at?`, `finished_at?` |
| `dispatcher_candidate_outcomes` | `candidate_outcome_id`; unique (`run_id`, `candidate_ordinal`) and unique (`run_id`, `task_id`) | `run_id`, `candidate_snapshot_revision`, `candidate_ordinal`, `task_id`, `candidate_task_revision`, `lifecycle`, `outcome?`, `correlation_id`, `reason_code?`, `execution_id?`, `intent_id?`, `revision`, `created_at`, `terminal_at?` |

Foreign keys from schedules, Tasks, executions, workspaces, authorization
decisions, query receipts, intents, operation receipts, gates, reservations,
scheduled dispatches, trigger observations, runs, and candidate outcomes to
their owning records are mandatory. Every `authorization_decision_ref` resolves
to a decision of the operation-appropriate kind, and every ProjectPolicy
receipt reference resolves to a `project_policy` query receipt. `audit_events`
is append-only during normal runtime: application code has no update or delete
operation for it.

The gate-receipt unique constraint contains every column in the authoritative
freshness identity: (`task_id`, `task_revision`, `execution_id`, `fencing_token`,
`workspace_id`, `workspace_generation`, `workspace_revision`,
`repository_identity`, `head_oid`, `policy_ref`, `policy_version`,
`policy_revision`, `gate_id`, `gate_version`, `gate_input_identity`,
`completion_adapter_ref`, `completion_adapter_version`,
`tool_environment_identity`). The
[completion/workspace owner](completion-workspace-contract.md#gate-identity-and-freshness)
defines the tuple's meaning; this constraint ensures distinct authoritative
identities cannot collide in storage.

Physical indexes MUST cover foreign-key columns, domain eligibility reads,
lease expiry, unfinished intents, run heartbeat, receipt lookup by bound
identity, reservation lookup by Project/repository/target ref, the exact
scheduled-dispatch tuple, and trigger observations by scheduled dispatch,
canonical run, and external trigger ID. Candidate membership indexes cover
run/snapshot/lifecycle, run/ordinal, and run/Task; the latter two keys are also
unique.

An operation intent has exactly one policy-binding shape. A Project-bound intent
uses `policy_binding_kind='project_policy'` and requires all three policy
identity fields. Proven system scope uses
`policy_binding_kind='system_not_applicable'` and requires all three to be null.
Both shapes require the final authorization-decision reference, and the
semantic key contains the binding kind plus every applicable policy identity;
a null Project policy is never interpreted as an omitted check.

The operation-intent columns represent every applicable member of the semantic
tuple owned by the
[reliability protocol](reliability-protocol.md#operation-semantic-identity-and-policy-binding).
Task-, execution-, and workspace-specific columns are all null only when that
owner says the operation is independent of that identity; otherwise the whole
applicable set is non-null and must reproduce the stored canonical
`semantic_key`. A digest alone is never accepted as the tuple.

The current authorization-decision reference is not a semantic-key member. The
initial allow is bound at revision `1`; when the same semantic operation needs a
fresh allow before a retry or finalization, a CAS may replace only that pointer
and increment `authorization_binding_revision`. The new decision must name the
same intent as consumer and match the complete semantic tuple and policy
binding. All prior decision rows and audit events remain immutable, so refresh
does not erase which authority covered an earlier attempt.

An authorization decision has one of the three exact shapes owned by the
[authorization contract](authorization-contract.md#decision-record). A
`read|preliminary_policy_query` allow requires a query ID and may be consumed
only by that query. A `final_mutation` allow has no query ID and may be consumed
only by its exact domain mutation or intent. Deny/defer rows have no consumer.
An allow requires a complete current grant identity; `grant_missing` and other
pre-grant denials require all three grant columns to be null, while a denial
against an observed stale, revoked, or mismatched grant records all three.
Final-mutation decisions use the same Project-policy versus
`system_not_applicable` conditional shape as intents; a Project-bound allow
requires its policy-receipt reference, while a denial may omit the missing or
invalid receipt and records the reason. Preliminary policy-query decisions are
Project-bound to action `policy.evaluate`, bind the configured policy identity,
and carry no policy-receipt reference. Read decisions instead require
`policy_binding_kind='read_not_applicable'` with all policy fields null. That
binding is invalid for a preliminary or final mutation decision.

`adapter_query_receipts` stores only read/inspection and ProjectPolicy receipts;
it is never an operation receipt or mutating intent. `query_kind='read'` binds a
read decision and `query_kind='project_policy'` binds a preliminary-policy
decision. Its exact typed payload must pass the current adapter receipt schema
before insertion, and its identity columns must agree with that payload.

Exact enum meanings remain with their semantic owners. The physical migration
MUST constrain known enum values or use a versioned decode that rejects unknown
values; silently coercing an unknown value is prohibited.

The `tasks` waiting columns are physically nullable because they are absent in
every non-waiting state. A table constraint enforces this exact conditional
shape:

- when `state='waiting'`, `waiting_reason`, `waiting_phase`, `required_action`,
  `last_error_code`, `retryable`, `retry_count`, and `waiting_task_revision` are
  non-null, `waiting_task_revision=revision`, and the retry fields are in their
  valid numeric/boolean ranges;
- `last_error_summary`, `retry_after`, `waiting_execution_id`,
  `workspace_revision`, and `backend_thread_id` remain nullable while waiting
  and are populated only when that identity/fact exists; and
- when state is not `waiting`, every waiting column is null.

This represents, without strengthening, the nullable metadata owned by the
[domain waiting envelope](domain-contract.md#waiting-taxonomy).

A schedule has exactly one scope shape: `scope_kind='system'` requires a null
Project ID and the canonical system scope ID; `scope_kind='project'` requires a
matching non-null Project ID and exact Project scope ID. Its registered
scheduler actor and adapter/config identities are immutable for one config
revision. Registration identity is null before a verified registration receipt
and thereafter changes only through a separately authorized lifecycle intent;
trigger ingress rejects a registration/config/actor mismatch.

A committed workspace row represents a complete ownership receipt, not an
unverified directory. Its explicit identity columns must reproduce the
versioned ownership receipt and inventory JSON; their Project/Task/execution/run,
creator operation, fence, repository/common-directory, registration, path,
generation, HEAD, policy, intent, and receipt references must all resolve.
Partial or ambiguous creates remain operation intents/receipts until recovery
proves a complete row or records a terminal failure.

A partial unique index permits at most one current integration reservation for
(`project_id`, `repository_identity`, `target_ref`) where status is `active` or
`ambiguous`. Acquisition cannot insert around an ambiguous row. Reservation
status meaning and target-ref exclusivity are owned by the
[completion/workspace contract](completion-workspace-contract.md#integration-reservation).

The unique `scheduled_dispatches` tuple is the persisted scheduled
deduplication identity. Every delivered trigger, including a duplicate or a
sanitized rejected/malformed delivery, has a separate
`scheduler_trigger_observations` row; attached scheduled observations reference
the tuple row and its one `canonical_run_id`. The
[scheduler contract](scheduler-contract.md#trigger-and-run-identity) owns the
delivery semantics.

Trigger-observation constraints require `accepted` or `authorization_denied`
to carry an authorization-decision reference. Only `accepted` may use
`attachment_role=canonical|duplicate`; either role requires a canonical run
reference, and a scheduled attached observation also requires its
scheduled-dispatch reference. `authorization_denied`, malformed, and
stale-config deliveries use role `none` with no run/dispatch reference; raw
unbounded payload is never stored.

Every observation has an actor derived by trusted ingress. A scheduled
observation additionally requires its registered scheduler identity, schedule
ID/config revision, and scheduled instant whenever the bounded inner payload
validated; malformed inner fields may be null but the authenticated outer
registration and derived actor remain present. A manual observation has no
scheduler registration or scheduled tuple and derives its human/service actor
from the manual ingress. No payload field may assert either actor identity.

Every dispatcher run carries its final `dispatch.run` allow decision. A `starting`
run may have no worker or start time yet; worker, heartbeat, phase summaries,
start, and finish fields become non-null only at the lifecycle phases that own
them. `owner_revision` is the run-worker fencing epoch: assigning or replacing
`worker_id` increments it, and a former worker cannot write through an older
epoch. `revision` is the CAS revision for run lifecycle, sealed-snapshot, and
summary mutations. Both revisions begin at `1`; heartbeat renewal matches the
current worker and owner revision without granting a new ownership epoch.

Candidate-outcome values and their meaning are owned by the
[reliability fan-out contract](reliability-protocol.md#observable-fan-out).
The rows first represent the durable finite candidate snapshot membership and
only then its outcomes. A sealed snapshot has one immutable positive
`candidate_snapshot_revision`, non-negative `candidate_expected_count`, and
snapshot time on the run. It has exactly that many rows carrying the same
snapshot revision, distinct Task IDs, and distinct contiguous zero-based
ordinals. Count zero is represented by sealed run metadata and no member rows.
Before sealing, all three run snapshot fields are null and no member row exists;
sealing writes them once, and neither the metadata nor membership may later be
replaced, appended, removed, or reordered.

A member is created as `lifecycle='pending'` with null outcome, reason,
execution, intent, and terminal time. Its run, snapshot, ordinal, Task, candidate
Task revision, correlation ID, and creation time are immutable. Its only
lifecycle transition is a revision-CAS to `terminal`, which requires exactly one
finite owner-defined outcome, a reason code, terminal time, and only the
execution/intent identities applicable to that outcome. A summary JSON is never
the membership owner or the only copy of results.

Physical constraints also enforce at most one nonterminal claim-holding
execution per Task; reliability remains the semantic owner of what makes that
claim valid.

## Writer and reader closure

Adapters, CLI, MCP, and schedulers never open SQLite directly. All access goes
through the planned persistence repositories and transaction coordinator.

| Records | Only writer | Readers |
| --- | --- | --- |
| `schema_metadata`, `migration_history` | Migration runner | Startup compatibility check, doctor, backup/restore |
| `projects`, `schedules`, `tasks`, `task_dependencies` | Application transaction coordinator through typed repositories | Application queries, scheduler ingress, dispatcher eligibility query, diagnostics |
| `executions`, `operation_intents`, `operation_receipts` | Dispatcher/application transaction coordinator through typed repositories | Reconciler, application queries, diagnostics |
| `workspaces`, `gate_receipts` | Application transaction coordinator after verifying adapter receipts | Dispatcher, completion flow, diagnostics |
| `integration_reservations` | Integration application service through the transaction coordinator | Authorization evaluator, reconciler, completion flow, diagnostics |
| `authorization_bootstrap`, `authorization_grants` | Authorization bootstrap/application service through its repository | Preliminary/final authorization evaluators, doctor with restricted fields |
| `authorization_decisions`, `adapter_query_receipts` | Authorization/application transaction coordinator through typed repositories | Authorization evaluator, application services, reconciler, diagnostics with restricted fields |
| `scheduled_dispatches`, `scheduler_trigger_observations`, `dispatcher_runs`, `dispatcher_candidate_outcomes` | Scheduler ingress/dispatcher application transaction coordinator | Dispatcher candidate worker, crash reconciler, scheduler queries, diagnostics |
| `audit_events` | The same transaction that accepts the audited mutation | Audit query and redacted diagnostics |

An adapter returns a receipt; it does not become a second database writer.
Future changes MUST update this closure when adding a table or reader, rather
than introducing direct SQL or a parallel schema validator.

## Authoritative ingress and decode

- The repository responsible for a row decodes its SQLite storage classes and
  versioned JSON exactly once, rejects missing/unknown/invalid fields, and then
  invokes the owning domain or protocol constructor.
- A successful decode returns a typed value plus the schema version and row
  revision needed for later CAS. Trusted downstream code reuses that value; it
  does not reparse the JSON or reinterpret enum strings.
- External adapter payloads are not trusted rows. Their receipt schema is first
  validated by the adapter-contract ingress, then persisted in canonical form;
  reads still pass through this repository decode.
- Decode failure is an integrity error. It cannot be converted to a default
  value, skipped row, empty collection, or successful terminal result.
- There is one migration registry and one repository mapping per table. Test
  fixtures use those owners instead of hand-maintained duplicate DDL.

## Connection policy

Every opened connection MUST establish and verify:

- `foreign_keys=ON`;
- `journal_mode=WAL` for the primary writable database;
- `synchronous=FULL`;
- `read_uncommitted=OFF`; and
- `busy_timeout=5000` milliseconds.

Failure to obtain or verify these settings prevents mutation. Writers use short
`BEGIN IMMEDIATE` transactions and never wait indefinitely; exhausted busy
handling returns a typed busy failure to the reliability owner. Readers use a
bounded snapshot transaction and MUST NOT hold it across an adapter call,
filesystem operation, user interaction, or other external effect. WAL
checkpointing is explicit and cannot truncate a WAL still needed by a reader.

## Transaction boundaries

- A domain command, its aggregate revision update, related edge changes, and
  audit event commit atomically in one transaction.
- A read or preliminary-policy allow is inserted and marked consumed for exactly
  one bounded adapter query. Its validated query receipt commits separately and
  references that decision. A final Project-bound decision transaction reads
  the current policy receipt; stale, missing, differently bound, or invalid
  evidence yields no final allow.
- A final mutation decision and a direct domain mutation commit atomically. For
  an external effect, the final allow and complete `pending` intent insert
  atomically, with the intent referencing that decision; a denial may append
  sanitized attempt evidence but creates neither intent nor external effect.
- Initial authorization bootstrap uses one `BEGIN IMMEDIATE` transaction that
  verifies the singleton is current and unconsumed and no grant exists, inserts
  the fixed initial grants, appends their audit events, records their IDs, and
  marks the singleton consumed. Constraint or identity conflict rolls back the
  complete bootstrap operation.
- Claim creation, the active-execution constraint, lease/fencing increment,
  expected Task revision check, and claim audit event commit atomically.
- An operation intent commits before its external effect. External work occurs
  with no database transaction held. Receipt observation commits separately.
  Verified finalization and its domain/audit changes form a final transaction.
- Lease renewal and integration-reservation renewal are isolated CAS
  transactions.
- Integration-reservation acquisition uses one `BEGIN IMMEDIATE` transaction:
  inspect the exact Project/repository/target-ref key, reject an `active` or
  `ambiguous` row, compare target/policy revisions, allocate the next fence,
  insert the sole current row, and append its audit event. Acquisition never
  converts an expired lease as a shortcut; reconciliation must already have
  CAS-transitioned the prior row to terminal `expired` or `released`. The
  partial unique index is the final concurrent-writer guard; a conflict creates
  no second reservation. Release, expiry, and takeover are revision/fence CAS
  writes.
- Scheduled-trigger ingress uses one `BEGIN IMMEDIATE` transaction after typed
  ingress and the applicable final `dispatch.run` decision. On allow for a
  schema-valid, current-config scheduled tuple it first reads the unique
  `scheduled_dispatches` key. If absent, it allocates both IDs, inserts exactly
  one `starting` canonical `dispatcher_runs` row bound to the allow decision,
  then inserts the tuple row referencing that run. If present, it reuses the
  stored canonical run. It inserts that allowed delivery's observation with
  `attachment_role=canonical|duplicate` before commit. A duplicate race reads
  the unique winner and attaches its observation; it cannot create another run.
  Denial inserts only a sanitized `authorization_denied`, role-`none`
  observation with the decision reference and creates no tuple or run. A manual
  allow atomically creates its own starting run and canonical observation
  without a scheduled tuple; manual denial creates only the unattached
  observation. Malformed or stale-config delivery likewise stores a sanitized
  unattached observation and no run.
- Run-worker assignment and stale-worker takeover CAS-match `run_id`, status,
  current worker, `owner_revision`, `revision`, and heartbeat condition. A
  successful assignment installs the new worker, increments `owner_revision`
  and `revision`, and thereby fences every prior candidate writer.
- After reconciliation and before any candidate claim or candidate-bound
  external action, a dispatcher sweep uses one `BEGIN IMMEDIATE` transaction.
  It matches the run's
  current worker/owner revision and expected run revision, reads the complete
  finite domain-eligible set from that same database snapshot, inserts every
  member as `pending` with its immutable Task revision and contiguous ordinal,
  stores the new snapshot revision, exact expected count, and snapshot time,
  moves the run to `sweeping`, and increments the run revision. All membership
  rows and sealing metadata commit or none do; no candidate work may begin from
  an uncommitted or unsealed in-memory list.
- Each member resolution CAS-matches the sealed snapshot identity, current run
  worker and owner revision, immutable member identity, `lifecycle='pending'`,
  and candidate-row revision. A successful claim and its `claimed` terminal
  member transition share the claim transaction. Every non-claim outcome and
  any accompanying domain/audit mutation likewise commit atomically. The CAS
  permits exactly one `pending` to `terminal` transition and rejects a stale
  run owner before candidate mutation or external action.
- Fan-out summary publication is a run-revision/owner-revision CAS transaction.
  It requires the stored expected count to equal both total and distinct Task
  counts; distinct ordinals must be exactly the contiguous range from zero to
  expected count minus one when the count is positive, while zero requires no
  row; every row must match the sealed snapshot revision and be terminal. Only
  then is the summary derived from those rows and committed with the terminal
  run status. A failed completeness check leaves the summary null and cannot
  claim run success.
- Migration application and migration-history insertion share one transaction
  per migration.

The semantic ordering and recovery outcomes of the multi-transaction external
flow are owned by the [reliability protocol](reliability-protocol.md).

## Migration identity and atomicity

Migration files use immutable names `NNNN-short-name.sql`, where `NNNN` is a
strictly increasing four-digit schema version. `migration_id` is the complete
file stem. `checksum` is uppercase SHA-256 over the exact committed file bytes.
An already recorded migration ID, version, or checksum mismatch blocks startup
before application writes.

The migration runner performs this sequence under exclusive migration
coordination:

1. open with the verified connection policy and read the complete applied
   history;
2. reject an unknown, missing, reordered, or checksum-mismatched migration;
3. create and verify the required pre-upgrade backup;
4. apply each unapplied migration and insert its history row in the same SQLite
   transaction;
5. run `foreign_key_check` and the migration's declared postconditions before
   commit; and
6. update the singleton metadata only in the transaction that establishes that
   version.

A process interruption leaves a migration wholly absent or wholly committed.
On restart, the runner re-reads history and resumes at the first absent version;
it never marks a failed migration as applied. A migration requiring a
non-transactional database rewrite must stage a new database and use the
publication protocol rather than weakening this atomicity rule.

## Backup before upgrade

Every upgrade that could write a database first creates a backup with SQLite's
online backup API; copying the live main file is not sufficient in WAL mode.
The backup is written to a private generation and is not published until a
separate connection verifies:

- it opens read-only;
- `quick_check` succeeds;
- `foreign_key_check` returns no row;
- schema metadata and every migration checksum match the source pre-upgrade
  state; and
- a manifest binds database identity, schema version, source application
  version, byte length, creation time, and inventory entry.

Publication and interrupted-reader safety use the private-stage, inventory, and
atomic/CAS rules in the
[reliability protocol](reliability-protocol.md#private-staging-and-publication).
Upgrade does not begin unless the published backup can be reopened and its
manifest revalidated.

## Corruption, incompatible versions, and recovery

- A failed SQLite integrity check, impossible row shape, broken foreign key,
  migration-history mismatch, or unverifiable manifest puts the database into a
  read-only diagnostic condition. Normal writes and automatic repair stop.
- Doctor may inspect and report redacted facts but MUST NOT edit pages, delete
  rows, disable constraints, or fabricate migration history.
- Recovery restores a verified backup into a new private database, validates it
  through the same ingress, and publishes it with an expected-current-database
  CAS. The corrupt source remains untouched until separately authorized
  retention or cleanup.
- A runtime whose maximum reader version is lower than the database version
  refuses to open it for mutation. There are no reverse migrations.
- Downgrade is performed only by restoring a compatible pre-upgrade backup, as
  required by the
  [versioning and compatibility contract](versioning-compatibility-contract.md#downgrade-by-restore).
- If no verified backup exists, the system reports a blocked recovery. It does
  not claim data recovery, continue with a partially decoded database, or
  initialize a replacement over the same path.
