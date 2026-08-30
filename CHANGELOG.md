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

These entries do not announce a release or supported runtime. The executable
material is limited to the development package, feasibility harness, pure
in-memory Domain Core, ProjectRegistry, runtime authorization, typed
application services, local schema-v5 persistence, the Phase 1 product CLI, and
the library-only durable execution-claim foundation; execution backends,
effect intent/receipt/finalization, completion, dispatcher, adapter, scheduler,
MCP, and orchestration runtime behavior remain unimplemented.
