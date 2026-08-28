# Architecture

## Current system

The repository has a governance and architecture-contract baseline, a minimal
executable toolchain and feasibility harness, and a pure in-memory TypeScript
Domain Core. The Domain Core implements only Project/Task values and domain
rules; neither it nor the feasibility harness is an orchestrator runtime. The
repository still implements no application service, persistence repository,
dispatcher, port, adapter, scheduler, MCP component, product compatibility,
platform-integration, or product safety claim.

## Authority and ownership

| Concern | Current authoritative owner |
| --- | --- |
| Repository agent rules and authorization boundaries | [AGENTS.md](AGENTS.md) |
| Current architecture and dependency constraints | This document |
| Documentation roles and navigation | [docs/README.md](docs/README.md) |
| Repository governance invariants | [docs/reference/repository-governance.md](docs/reference/repository-governance.md) |
| Executable toolchain, package boundary, and local validation entry points | [docs/reference/toolchain-contract.md](docs/reference/toolchain-contract.md) |
| Local maintainer task branches, worktrees, integration, and Git recovery | [docs/reference/local-agent-git-flow.md](docs/reference/local-agent-git-flow.md) |
| Validation routing and evidence | [docs/reference/validation-policy.md](docs/reference/validation-policy.md) |
| Development plan lifecycle | [docs/plans/README.md](docs/plans/README.md) |
| Normative contract inventory | [docs/reference/contract-ownership.md](docs/reference/contract-ownership.md) |
| Architecture decisions and rationale | [docs/adr/README.md](docs/adr/README.md) |

This document owns module responsibility and dependency direction. The contract inventory names the sole owners of state, persistence, protocols, authorization, ports, scheduling, completion/workspace, security, observability, compatibility, and validation. ADRs retain rationale but do not duplicate live normative rules.

## Implemented and planned boundaries

The architecture separates:

- `domain`: the implemented pure Task state, hierarchy, dependency,
  eligibility, waiting-continuation, revision, error, and event owner.
- `application`: commands, queries, authorization checks, and transaction orchestration.
- `persistence`: SQLite schema, migrations, audit events, intents, receipts, leases, and backups.
- `dispatcher`: durable claim, launch, reconciliation, and recovery workflows.
- `ports`: execution, workspace, scheduler, project-policy, and completion contracts.
- `adapters`: replaceable implementations, including Manual and Codex execution backends.
- `interfaces`: CLI and MCP surfaces sharing the application layer.

Only `domain` is implemented. Every other name in this list remains accepted
design direction rather than a current runtime component. None of these
boundaries authorizes an external action.

## Cross-module dependency constraints

- `domain` may depend only on language/runtime primitives; it must not import application, persistence, dispatcher, ports, adapters, interfaces, or observability modules.
- `application` orchestrates domain rules and ports but does not copy domain judgments or depend on concrete adapters.
- `persistence` implements storage contracts without performing external side effects.
- `dispatcher` coordinates application services and ports without embedding project-specific policy.
- `ports` expose contracts without importing vendor SDKs; `adapters` depend inward on ports and application contracts.
- `interfaces` call the application layer, and `observability` consumes structured events without becoming a state owner.

The exact behavior behind these boundaries belongs to the
[contract ownership inventory](docs/reference/contract-ownership.md). Domain
behavior is current only to the extent implemented and validated by its owner;
every other behavior remains a design requirement, not an implemented
guarantee, until matching code and validation evidence land.

The repository's current
[local agent Git workflow](docs/reference/local-agent-git-flow.md) coordinates
how maintainers develop and integrate this source tree. It is operational
governance outside the planned runtime dependency graph. It neither implements
nor constrains a future project's `WorkspaceBackend`, `CompletionBackend`, or
project-specific Git policy beyond the adapter contracts that will be designed
and validated separately.
