# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Replaced the unreleased schema-1-through-7 migration chain with one immutable
  `0001-current-baseline.sql` at schema version 1. Fresh bootstrap still starts
  at authorization vocabulary 4 and requires three separately confirmed,
  contiguous upgrades to reach vocabulary 7. The current runtime has one
  epoch/grant model and lifecycle state-digest version 4; it refuses every
  pre-baseline, noncurrent, newer, corrupt, and pre-existing zero-length
  database before writable open and preserves no pre-Phase-3 data migration
  path.
- Replaced the backup manifest, restore intent, and restore receipt V1/V2
  compatibility unions with one exact current schema-2 format for each
  artifact. Backup creation now has only the application-authorized `manual`
  writer, restore recovery validates both authorization lineages
  unconditionally, and schema-1, pre-upgrade, missing, extra, or malformed
  artifacts remain invalid or ambiguous read-only evidence without changing
  the public `ato.api/v1` or `ato.api/v2` product behavior.
- Initialized repository governance and documentation boundaries.
- Selected the Apache License 2.0 and documented contribution and attribution policy.
- Added accepted architecture decisions and authoritative Phase 0 domain, persistence, reliability, adapter, scheduler, completion/workspace, security, observability, compatibility, and validation contracts.
- Added a private-by-default TypeScript/Node toolchain scaffold, repeatable
  local validation entry points, a least-privilege Windows CI skeleton, and
  dependency update/security-reporting mechanics.
- Added reproducible Windows SQLite and fail-closed Codex public-contract
  feasibility harnesses without adding Phase 1 runtime behavior or a support
  claim.
- Added the pure TypeScript Project/Task Domain Core with exact lifecycle,
  hierarchy, dependency, eligibility, waiting-continuation, revision,
  structured-error, and structured-event behavior plus deterministic unit and
  seeded state-machine evidence.
- Added the zero-production-dependency SQLite persistence foundation with a
  validated runtime root, staged immutable migrations for metadata and exact
  Domain Core Project/Task storage, typed repository CAS/readback, bounded
  WAL transactions, verified online backup generations, and explicit
  identity-bound restore recovery.
- Added the Phase 1 application foundation with a canonical local ProjectRegistry, one-time
  runtime-root-bound authorization bootstrap, finite inspectable/revocable
  grants, exact revision-aware application commands and queries, atomic Domain
  snapshot/registry/authorization/audit commits, typed combined-state
  corruption refusal, restart readback, and failure/concurrency evidence.
- Added the local `ato` product CLI with OS-derived local identity, finite
  capability renewal and grant listing, strict
  versioned human/JSON ingress, Project/Task/dependency workflows, authorized
  online backup, separately confirmed provenance-bound restore, read-only
  doctor, packaged-entry parity, and fail-closed lifecycle evidence.
- Made the then-current unreleased staged migration identities reproducible
  across LF and CRLF checkouts. Those intermediate files are now superseded by
  the single current baseline above; their committed history remains in Git.
- Made concurrent maintenance-test artifact generations share a stable
  `.task-artifacts` root: creators bind generation identity before post-issue
  seams, workers remove only receipt-bound generations, nested SQLite defers
  shared-root contraction to the globally quiescent test parent, and standalone
  package/SQLite owners retain deterministic empty-root contraction evidence.
- Added the Phase 2 durable execution-claim foundation with explicit
  confirmation-bound capability upgrade, atomic ready-to-running
  claims, ordered attempts, one active execution per Task, leases, per-Task
  fencing, exact idempotent replay, renewal, expiry observation, safe
  effect-free takeover, stale-fence refusal, restart/corruption/concurrency
  evidence, and typed package exports. This adds no execution backend, external
  effect protocol, dispatcher, completion loop, or public Phase 2 CLI.
- Added the Phase 2 reliable Manual execution library with an explicit one-step
  vocabulary-6 upgrade, the corrected-before-first-release
  `ato.execution/v1` contract kit, one production local no-workspace Manual
  backend/control and test-only Fake, durable semantic intents, independent
  prepare/act/finalize authorization bindings, observations, verified receipts,
  CAS finalizations, durable due-gated retry metadata, restart-safe
  start/inspect/resume/retry/cancel/outcome paths, reconcile-first expired
  execution handling, authoritative receipt/journal verification, verified
  interruption from running or waiting, terminal-journal immutability, complete
  waiting metadata, stale-fence refusal, and a separate authorization- and confirmation-bound Manual
  completion decision. The Phase 1 `ato.api/v1` CLI remains unchanged; this
  adds no dispatcher, scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy,
  CompletionBackend/gate, release, deployment, or platform-support claim.
- Added the Phase 2 reconcile-first Manual dispatcher library with an explicit
  one-step vocabulary-7 upgrade, durable Manual trigger authorization, run ownership,
  bounded heartbeat and exact-expiry takeover, complete pre-claim
  reconciliation, immutable finite candidate membership, atomic
  claim/start-intent binding, one terminal outcome per sealed member, restart
  and stale-worker recovery, and completeness-gated durable summaries. Trigger
  idempotency is persisted only as a stable hash and all dispatcher audit,
  reconciliation, member, and summary fields are closed bounded metadata. The
  Phase 1 `ato.api/v1` CLI and `ato.execution/v1` port remain unchanged; this
  adds no SchedulerBackend or scheduled trigger, MCP, Codex/Git/workspace
  adapter, ProjectPolicy, CompletionBackend/gate, product execution runtime,
  release, deployment, or platform-support claim.
- Closed the local explicit-Manual Phase 2 product surface while preserving
  `ato.execution/v1` and the default closed `ato.api/v1`: added an
  explicit `ato.api/v2`, trusted OS/runtime-root product ingress, one typed
  product facade over the existing application/dispatcher/reliable-loop owners,
  sequential capability upgrade, Manual dispatch/resume, execution inspect/
  resume/retry/cancel, trusted Manual outcome reporting, separately confirmed
  Manual completion acceptance, fixed redacted projections/errors, and source/
  build/packed-install/restart/migration evidence. The local Manual backend
  records no-workspace lifecycle facts and still does not execute Task content.

These entries do not announce a release or supported platform. The executable
material is limited to the development package, feasibility harness, pure
in-memory Domain Core, ProjectRegistry, runtime authorization, typed
application services, local current schema-version-1 persistence, the versioned local product
CLI and facade, reliable Manual execution loop, and explicit-Manual
reconcile-first dispatcher. Scheduler/SchedulerBackend, MCP,
Codex/Git/workspace adapters, ProjectPolicy, CompletionBackend/gates, external
Task-content execution, release, and deployment remain unimplemented.
