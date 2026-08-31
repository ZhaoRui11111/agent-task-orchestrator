# Versioning and compatibility contract

## Status and authority

This file is the sole normative owner of schema, planned public API, and adapter
versioning; forward migration and downgrade-by-restore policy; and the evidence
required for a platform or external API support claim. The project now has one
internal current SQLite baseline at schema version `1`, a provisional package-root
  Domain/ProjectRegistry/authorization/application/claim/Manual-loop/dispatcher/
  persistence surface, an implemented closed `ato.execution/v1` local port, and
one implemented provisional `ato.api/v1` local explicit-Manual product CLI major.
It still has no released product,
validated platform, or supported external API.

The [v0.1 matrix](../compatibility/v0.1.md) records evidence only. It cannot
create or change this policy.

## Version namespaces

- Product releases use Semantic Versioning `MAJOR.MINOR.PATCH`. Before `1.0.0`,
  product-level public surfaces may evolve, subject to the explicit migration
  notes and versioned wire contracts below.
- SQLite schema versions are strictly increasing non-negative integers, where
  `0` means a genuinely fresh database with no application object and shipped
  versions begin at `1`. The current and only accepted target is `1`.
  `0001-current-baseline.sql` directly owns the complete implemented local
  explicit-Manual Phase 2 storage shape, including lifecycle state-digest
  version 4 and authorization vocabularies 4 through 7. Schema version and
  authorization vocabulary are independent counters. Exact migration
  identity, checksum, allocation, and mechanics are owned by the
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
It contains exactly the complete local explicit-Manual Phase 2 product documented
there. Omitting the version and selecting `ato.api/v1` explicitly are identical;
all other majors are unsupported before runtime construction or protected state
evaluation. This major is not a released stability or platform-support promise.

### Unreleased current-v1 reset

RC03 consumes one explicitly authorized pre-release exception to the normal
same-major stability rule above. The package is private and remains
`0.0.0-development`; no release, supported external caller, or durable artifact
stores a product API major. RC03 therefore retires both the old limited
`ato.api/v1` tree and the explicit `ato.api/v2` tree without a compatibility,
translation, deprecation, or migration window, and redefines the complete
existing Phase 2 product as the sole current `ato.api/v1`.

The old trees survive only in immutable historical plans, audit evidence, and
changelog entries. They are not readers, aliases, fallback branches, or support
claims. A request naming retired `ato.api/v2` receives the sole current
`CLI_UNSUPPORTED_VERSION` failure envelope and cannot create/open a runtime or
mutate protected state. After this reset, the normal public-API evolution rules
apply to the new current-v1 baseline; another same-major semantic reset requires
new explicit approval and updated compatibility evidence.

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

- The current runtime may initialize only an absent primary that it has safely
  reserved. It applies the sole baseline and its metadata/history as one SQLite
  transaction.
- A pre-existing zero-length primary, a nonempty database without the exact
  current baseline identity, checksum, fingerprint and one-row history, an
  earlier prototype schema, and a newer schema are all incompatible. They are
  refused during read-only inspection before writable open, backup creation,
  migration SQL, metadata change, or database-byte mutation.
- The repository ships no forward-upgrade chain and claims no compatibility
  with a pre-baseline runtime database. Table resemblance, edited metadata, an
  old migration checksum, or an old application-state projection cannot create
  compatibility.
- A future schema change must define its supported source identities, atomic
  transition and recovery in an approved plan, add immutable migration
  identity, and test every source for which compatibility is explicitly
  claimed. Earlier prototypes remain unsupported unless that future evidence
  names them.
- Forward compatibility is not promised: an older runtime refuses a newer
  schema or wire major unless that exact reader combination has explicit
  evidence and policy.

## Downgrade by restore

In-place reverse migrations are unsupported. A future released downgrade route
would mean stopping the newer runtime,
selecting a verified backup created by the target older schema/application,
restoring it to a private location, validating it with that target reader, and
atomically publishing it under the persistence recovery rules. The current
product restore accepts only current manifest-schema-2 application-authorized
manual backups whose source database is the current schema version `1`, and
therefore provides data rollback, not schema downgrade support. Manifest,
restore-intent, and restore-receipt schema `1` artifacts have no current reader;
they remain untouched incompatible evidence rather than an implicit migration
or repair source.

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
