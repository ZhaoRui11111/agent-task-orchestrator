# Architecture

## Current system

The current repository is a documentation and governance baseline only. It has no runtime components and makes no executable compatibility or safety claim.

## Authority and ownership

| Concern | Current authoritative owner |
| --- | --- |
| Repository agent rules and authorization boundaries | [AGENTS.md](AGENTS.md) |
| Current architecture and dependency constraints | This document |
| Documentation roles and navigation | [docs/README.md](docs/README.md) |
| Repository governance invariants | [docs/reference/repository-governance.md](docs/reference/repository-governance.md) |
| Validation routing and evidence | [docs/reference/validation-policy.md](docs/reference/validation-policy.md) |
| Development plan lifecycle | [docs/plans/README.md](docs/plans/README.md) |

No runtime schema or implementation owner exists yet. A future implementation must establish those owners through reviewed architecture decisions before adding parallel copies of a contract.

## Planned boundaries, not current capabilities

The intended architecture separates:

- `domain`: task state, hierarchy, dependency, and eligibility rules.
- `application`: commands, queries, authorization checks, and transaction orchestration.
- `persistence`: SQLite schema, migrations, audit events, intents, receipts, leases, and backups.
- `dispatcher`: durable claim, launch, reconciliation, and recovery workflows.
- `ports`: execution, workspace, scheduler, project-policy, integration, and completion contracts.
- `adapters`: replaceable implementations, including Manual and Codex execution backends.
- `interfaces`: CLI and MCP surfaces sharing the application layer.

These names express design direction only. They do not authorize creating code before the corresponding contracts and acceptance gates are agreed.

## Cross-cutting invariants for future design

Future implementations are expected to preserve these constraints:

- Every task is bound to a registered project.
- Parent hierarchy and dependency DAG are distinct relationships.
- CLI, MCP, and adapters do not duplicate domain rules.
- Task readiness does not grant unrelated external permissions.
- SQLite-external effects use persisted intent, observed receipt, verification, and compare-and-swap finalization.
- Long-running ownership uses durable leases or reservations with fencing, not process-long file locks.
- Cleanup applies only to resources with verified system ownership.
- Project-specific Git and review rules enter through policy or adapter contracts, not generic core conditionals.
- Runtime and personal data remain outside the source repository.

Each invariant remains a design requirement, not an implemented guarantee, until code and validation evidence are present.
