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

These entries do not announce a release or supported runtime. The executable
material is limited to the development package, feasibility harness, pure
in-memory Domain Core, and narrow local persistence foundation; application,
authorization, product CLI, execution/completion, dispatcher, adapter,
scheduler, MCP, and orchestration runtime behavior remain unimplemented.
