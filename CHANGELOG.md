# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

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
- Added Phase 1 schema v3 with a canonical local ProjectRegistry, one-time
  runtime-root-bound authorization bootstrap, finite inspectable/revocable
  grants, exact revision-aware application commands and queries, atomic Domain
  snapshot/registry/authorization/audit commits, typed combined-state
  corruption refusal, restart readback, and failure/concurrency evidence.
- Added Phase 1 schema v4 and the local `ato` product CLI with OS-derived local
  identity, finite capability adoption/renewal and grant listing, strict
  versioned human/JSON ingress, Project/Task/dependency workflows, authorized
  online backup, separately confirmed provenance-bound restore, read-only
  doctor, packaged-entry parity, and fail-closed lifecycle evidence.
- Made all four released migration identities reproducible across LF and CRLF
  checkouts by freezing their historical canonical bytes in the sole registry,
  adding explicit per-file checkout EOL policy, and rejecting malformed or
  content-drifted sources before SQLite mutation without rewriting history.
- Made concurrent maintenance-test artifact generations share a stable
  `.task-artifacts` root: creators bind generation identity before post-issue
  seams, workers remove only receipt-bound generations, nested SQLite defers
  shared-root contraction to the globally quiescent test parent, and standalone
  package/SQLite owners retain deterministic empty-root contraction evidence.
- Added the Phase 2 durable execution-claim foundation: additive schema v5,
  explicit confirmation-bound capability upgrade, atomic ready-to-running
  claims, ordered attempts, one active execution per Task, leases, per-Task
  fencing, exact idempotent replay, renewal, expiry observation, safe
  effect-free takeover, stale-fence refusal, restart/corruption/concurrency
  evidence, and typed package exports. This adds no execution backend, external
  effect protocol, dispatcher, completion loop, or public Phase 2 CLI.
- Added the Phase 2 reliable Manual execution library: additive schema v6,
  explicit one-step vocabulary-6 upgrade, the corrected-before-first-release
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
- Added the Phase 2 reconcile-first Manual dispatcher library: additive schema
  v7, explicit one-step vocabulary-7 upgrade with the exact 23+6+1 physical
  grant partition, durable Manual trigger authorization, run ownership,
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
- Closed the local explicit-Manual Phase 2 product surface without changing
  schema v7, `ato.execution/v1`, or the default closed `ato.api/v1`: added an
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
application services, local schema-v7 persistence, the versioned local product
CLI and facade, reliable Manual execution loop, and explicit-Manual
reconcile-first dispatcher. Scheduler/SchedulerBackend, MCP,
Codex/Git/workspace adapters, ProjectPolicy, CompletionBackend/gates, external
Task-content execution, release, and deployment remain unimplemented.
