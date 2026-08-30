# Versioning and compatibility contract

## Status and authority

This file is the sole normative owner of schema, planned public API, and adapter
versioning; forward migration and downgrade-by-restore policy; and the evidence
required for a platform or external API support claim. The project now has an
internal staged SQLite schema at version `6`, a provisional package-root
Domain/ProjectRegistry/authorization/application/claim/Manual-loop/persistence
surface, an implemented closed `ato.execution/v1` local port, and an implemented
provisional `ato.api/v1` local Phase 1 CLI. It still has no released product,
validated platform, or supported external API.

The [v0.1 matrix](../compatibility/v0.1.md) records evidence only. It cannot
create or change this policy.

## Version namespaces

- Product releases use Semantic Versioning `MAJOR.MINOR.PATCH`. Before `1.0.0`,
  product-level public surfaces may evolve, subject to the explicit migration
  notes and versioned wire contracts below.
- SQLite schema versions are strictly increasing non-negative integers, where
  `0` means a genuinely fresh database with no application table and shipped
  versions begin at `1`. The current target is `6`: version `1` owns migration
  metadata/history, version `2` owns only Phase 1 Domain Core
  Project/Task/dependency storage, and version `3` owns only the Phase 1
  ProjectRegistry, runtime-grant, application-request/decision, and audit
  records; version `4` owns only Phase 1 local identity/capability epochs,
  lifecycle authorization handoffs, and the finite CLI vocabulary/storage-shape
  expansion; version `5` owns only the closed authorization-vocabulary upgrade
  and Phase 2A execution attempt, sequence, lease, fence, idempotency, and CAS
  foundation; version `6` owns only vocabulary-6 lineage and the reliable local
  Manual-loop operation/evidence/journal/completion records. Exact migration
  identity, checksum, staged allocation, and mechanics
  are owned by the
  [persistence contract](persistence-contract.md#migration-identity-and-atomicity).
- Each CLI/MCP or other machine-readable public request and response carries
  `ato.api/vN`, where `N` is a positive major contract version.
- Port contracts carry the exact IDs in the
  [adapter contract](adapter-contracts.md#status-and-direction), and adapter
  implementations have an independent Semantic Version.
- Project-policy configuration and every persisted JSON payload carry their own
  positive schema version; a product version is not a substitute.

Version numbers from different namespaces are never compared as though they
were the same counter.

## Public API evolution

Within one `ato.api/vN`:

- request schemas reject unknown or malformed fields unless a named extension
  map exists;
- responses may add documented optional fields only when older consumers are
  required and tested to ignore them;
- existing field meaning, units, default, nullability, error code, authorization
  requirement, or state effect cannot change; and
- removing/renaming a field or changing behavior requires `vN+1` and a migration
  note.

Every request is dispatched by its declared version before domain evaluation.
There is no best-effort guessing or silent coercion between majors. A deprecated
major remains available only for an explicitly documented window with contract
tests; otherwise it returns a typed incompatibility error.

The current `ato.api/v1` request and response shapes are closed, have no
extension map, and reject unknown input. Its exact grammar, fields, key order,
redaction, errors, and exits are owned by the [CLI/API contract](cli-contract.md).
EP-02B adds no command or response field to that public major.

## Adapter evolution and negotiation

An adapter declares the exact port contract IDs it implements, its adapter
version, external API/SDK version, and validated environment dimensions. Core
selects an exact mutually supported contract ID. It does not infer compatibility
from method names, product versions, or a higher adapter version.

An additive optional receipt field may remain in a port major only when old
readers safely ignore it and contract tests cover both shapes. A changed
operation, required field, receipt identity, error meaning, side effect, or
authorization boundary requires a new port major. Adapters for different majors
may coexist behind explicit selection; they cannot reinterpret one another's
persisted receipts.

Before the first `ato.execution/v1` implementation, EP-02B corrected its
unshipped planned `start` operation from `execution.claim` plus workspace/
working-directory/environment requirements to `execution.start` with
`workspace_mode=none`. No implementation, export, negotiation, persisted
receipt, or consumer existed, so no compatible reader or artifact was changed.
The corrected v1 is now implemented and closed. A later required-field,
authorization, side-effect, lifecycle, receipt, or error-meaning change requires
`ato.execution/v2`; an adapter version bump alone cannot reinterpret v1.

## Forward migration

- A runtime may mutate a database only when it recognizes the current schema
  and has a contiguous verified forward-migration chain to its target schema.
- Physical allocation is staged by approved implementation phase. A future
  contract or roadmap does not reserve a table or column; the plan that
  implements that owner appends a migration. Versions `1` through `5`
  remain byte-identical, and version `4` does not pre-allocate execution,
  intent/effect, workspace, scheduler, claim/lease/fence, gate, completion,
  adapter, MCP, or dispatcher records. Version `5` allocates only its named
  execution-claim foundation. Version `6` adds only its Manual-loop records and
  does not pre-allocate workspace, scheduler, gate, ProjectPolicy,
  CompletionBackend, MCP, or dispatcher-run state.
- The current migration matrix proves fresh `0` to `6` and shipped prefixes
  `1`, `2`, `3`, `4`, and `5` to `6`, including failed/interrupted migration,
  checksum drift, historical row and vocabulary preservation, zero automatic
  authority expansion, and newer-schema refusal. Adding version `7` or later
  requires tests from every earlier prefix for which compatibility is claimed.
- Every released schema in the v0.1 series MUST have a tested forward path to
  the latest v0.1 schema before that release can claim upgrade compatibility.
- A future v0.2 release must test upgrade from the latest published v0.1 schema;
  additional older sources are supported only when the evidence matrix names
  them.
- No migration is skipped, reordered, edited after publication, or inferred
  from table shape. The required pre-upgrade backup and atomic recovery follow
  the persistence owner.
- Forward compatibility is not promised: an older runtime refuses a newer
  schema or wire major unless that exact reader combination has explicit
  evidence and policy.

## Downgrade by restore

In-place reverse migrations are unsupported. Before upgrade, the old runtime's
verified database backup and its application/schema identity are preserved.
A future released downgrade route would mean stopping the newer runtime,
selecting a verified backup created by the target older schema/application,
restoring it to a private location, validating it with that target reader, and
atomically publishing it under the persistence recovery rules. The current
product restore accepts only schema-v6 application-authorized manual
backups and therefore provides data rollback, not schema downgrade support.

Data accepted after the backup is not present after downgrade. The operator
must receive that consequence before restore authorization. Opening a newer
database with an older binary, editing schema metadata, deleting migrations, or
copying tables into an older database is not downgrade support.

## Evidence-bound support claims

A platform, runtime, Git, SQLite, scheduler, adapter, SDK, API, or external
service is `supported` only when a current matrix row has status `validated` and
binds all of:

- exact product commit/release and relevant contract/schema versions;
- operating system edition/version/build, architecture, and filesystem;
- runtime, package manager, Git, and SQLite versions where applicable;
- adapter version plus exact external API/SDK/server version and selected
  capability surface;
- real or fixture environment classification and required permissions;
- exact binary validation criteria, commands/procedure, result, evidence
  reference, and observation date; and
- known limits, excluded capabilities, and evidence expiry/revalidation trigger.

Allowed row statuses are `unverified`, `validated`, `unsupported`, and
`deprecated`. Only `validated` is a support claim. A documentation target,
mock/fake contract test, successful install, vendor statement, or result from a
different version/environment cannot be relabeled as real support evidence.

Any material version/environment change makes the row stale until the affected
route is rerun. An unavailable account, secret, network, permission, or external
repository is recorded as missing evidence, not simulated proof. Unlisted
combinations are unsupported rather than assumed compatible.

## Planned release boundaries

- v0.1 is intended to be Windows local-first with forward-migratable published
  schemas and explicitly versioned provisional APIs/adapters.
- v0.2 may claim additional Project policies or platforms only when their own
  evidence rows validate; it must preserve the stated v0.1 upgrade path.
- v1.0 may claim stable public contracts only with Semantic Versioning,
  deprecation/migration documentation, and a validated supported-platform
  matrix.

These are design obligations and release gates, not evidence that any release
or platform support currently exists.
