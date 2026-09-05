# Documentation index

Documentation has explicit roles so that current contracts, plans, and historical evidence do not overwrite one another.

## Authority entry points

- [Project overview](../README.md)
- [Agent instructions](../AGENTS.md)
- [Architecture](../ARCHITECTURE.md)
- [Contribution guide](../CONTRIBUTING.md)
- [Security policy](../SECURITY.md)

## Live authoritative references

- [Repository governance](reference/repository-governance.md)
- [Local agent Git workflow](reference/local-agent-git-flow.md)
- [Toolchain contract](reference/toolchain-contract.md)
- [CLI/API contract](reference/cli-contract.md)
- [Contract ownership inventory](reference/contract-ownership.md)
- [Domain contract](reference/domain-contract.md)
- [Persistence contract](reference/persistence-contract.md)
- [Reliability protocol](reference/reliability-protocol.md)
- [Authorization contract](reference/authorization-contract.md)
- [Adapter contracts](reference/adapter-contracts.md)
- [Scheduler contract](reference/scheduler-contract.md)
- [Completion and workspace contract](reference/completion-workspace-contract.md)
- [Observability contract](reference/observability-contract.md)
- [Versioning and compatibility contract](reference/versioning-compatibility-contract.md)
- [Validation policy](reference/validation-policy.md)

## Security and compatibility

- [Threat model](security/threat-model.md)
- [Privacy and logging](security/privacy-and-logging.md)
- [v0.1 compatibility evidence matrix](compatibility/v0.1.md)

## Feasibility evidence

- [Toolchain feasibility](feasibility/toolchain.md)
- [Windows SQLite feasibility](feasibility/sqlite-windows.md)
- [Codex stable public contract feasibility](feasibility/codex-stable-public-contract.md)
- [Scheduler local contract feasibility](feasibility/scheduler-local-contract.md)

## Architecture decisions

- [ADR index](adr/README.md)

## Development plans

- [Plan lifecycle](plans/README.md)

## Maintainer documentation scan

- [Repository-local doc-gardener policy](../.doc-gardener.json)

That optional maintainer policy excludes only private `.local` state and
generated/worktree trees, and classifies completed plans/evidence as
historical. It supplements rather than replaces the public `pnpm docs:check`
gate.

Plans describe proposed, active, or completed development work. They do not become current product capability without matching implementation, tests, and current documentation.

Current references distinguish the retained explicit-local-Manual behavior,
the explicitly authorized Codex product subset, and the separately injected
Phase 3 library within the sole `ato.api/v1` product. The Codex product composes
the package-private owned-workspace branch of `ato.execution/v2` through a
Project-scoped profile, targeted one-member dispatch, fresh v8 effect authority,
and bounded durable evidence; no real-account or platform-support evidence
exists. The Phase 3
library contains ProjectPolicy, completion gates, integration reservation/local
Git effects, and attestation-bound workspace cleanup but has no default product
or CLI wiring. The pure `ato.scheduler/v1` port, injected durable scheduler
application owner, and scheduled-dispatch ingress are implemented as a separate
library boundary with only a test Fake. Concrete SchedulerBackend/platform
effects, a default scheduler operation route, real scheduled tasks, MCP,
daemon/service, release, deployment, administrator-managed Codex effective-
configuration attestation, and any supported-platform claim remain unimplemented.

All links in authoritative documentation must be repository-relative and resolve to committed files.
