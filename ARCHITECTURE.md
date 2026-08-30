# Architecture

## Current system

The repository has a governance and architecture-contract baseline, an
executable toolchain and feasibility harness, a pure in-memory TypeScript
Domain Core, a filesystem-identity ProjectRegistry, a finite local runtime
authorization owner, a typed Project/Task/dependency application service, a
local SQLite persistence foundation, and a composable local Phase 1 product
CLI. Schema versions `1` through `4` own metadata, exact Domain snapshots,
ProjectRegistry, local identity and authorization epochs, grants, requests,
authorization decisions, lifecycle coordination, and append-only application
audit. The application service orchestrates business owners in one
transaction; persistence never selects a Domain command or grants authority.
The CLI is only typed ingress, trusted local identity/confirmation setup,
presentation, and public error mapping. These Phase 1 components are not an
execution runtime. The repository still implements no dispatcher, port,
adapter, scheduler, MCP component, execution claim/completion loop, supported
platform integration, or product safety claim.

## Authority and ownership

| Concern | Current authoritative owner |
| --- | --- |
| Repository agent rules and authorization boundaries | [AGENTS.md](AGENTS.md) |
| Current architecture and dependency constraints | This document |
| Documentation roles and navigation | [docs/README.md](docs/README.md) |
| Repository governance invariants | [docs/reference/repository-governance.md](docs/reference/repository-governance.md) |
| Executable toolchain, package boundary, and local validation entry points | [docs/reference/toolchain-contract.md](docs/reference/toolchain-contract.md) |
| Product CLI grammar, output, and public error/exit contract | [docs/reference/cli-contract.md](docs/reference/cli-contract.md) |
| Local maintainer task branches, worktrees, integration, and Git recovery | [docs/reference/local-agent-git-flow.md](docs/reference/local-agent-git-flow.md) |
| Validation routing and evidence | [docs/reference/validation-policy.md](docs/reference/validation-policy.md) |
| Development plan lifecycle | [docs/plans/README.md](docs/plans/README.md) |
| Normative contract inventory | [docs/reference/contract-ownership.md](docs/reference/contract-ownership.md) |
| Architecture decisions and rationale | [docs/adr/README.md](docs/adr/README.md) |

This document owns module responsibility and dependency direction. The contract inventory names the sole owners of state, persistence, protocols, authorization, ports, scheduling, completion/workspace, security, observability, compatibility, and validation. ADRs retain rationale but do not duplicate live normative rules.

## Implemented and planned boundaries

The architecture separates:

- `domain`: the implemented pure Task state, hierarchy, dependency,
  Project enablement, eligibility, waiting-continuation, revision, error, and
  event owner.
- `project-registry`: the implemented canonical local-root identity,
  no-alias/reparse, runtime-overlap, and revalidation owner; it never writes a
  registered Project directory.
- `authorization`: the implemented pure finite-action grant evaluator,
  narrowing local policy inputs, issuance-subset rule, expiry/revocation, and
  high-risk classification owner.
- `application`: the implemented typed Project/Task/dependency command and
  exact-query owner, including trusted ingress, authorization decisions,
  Domain command selection, transaction orchestration, and result mapping.
- `persistence`: the implemented SQLite runtime-root, connection, staged
  migration, combined schema-v4 repository, transaction, lifecycle handoff,
  backup, restore, read-only doctor, and typed-corruption owner; later records
  are added only by their implementing phase.
- `dispatcher`: durable claim, launch, reconciliation, and recovery workflows.
- `ports`: execution, workspace, scheduler, project-policy, and completion contracts.
- `adapters`: replaceable implementations, including Manual and Codex execution backends.
- `interfaces`: the implemented local product CLI, plus a planned MCP surface;
  every business operation shares the application layer.

Only `domain`, `project-registry`, `authorization`, `application`,
`persistence`, and the local CLI portion of `interfaces` as narrowly described
above are implemented. Every later name in this list remains accepted design
direction rather than a current runtime component. No implemented boundary
authorizes an external action.

## Cross-module dependency constraints

- `domain` may depend only on language/runtime primitives; it must not import application, persistence, dispatcher, ports, adapters, interfaces, or observability modules.
- `project-registry` may inspect only local filesystem identity and depends on
  neither application nor persistence; it must not mutate registered targets.
- `authorization` is a pure decision owner and depends on neither application,
  persistence, content, nor concrete adapters.
- `application` orchestrates domain, ProjectRegistry, authorization, and
  persistence owners but does not copy Domain judgments or depend on concrete
  adapters.
- `persistence` depends inward on `domain`, owns SQLite/filesystem storage
  mechanics and typed application records, and neither invokes authorization
  policy nor performs external Project effects.
- `dispatcher` coordinates application services and ports without embedding project-specific policy.
- `ports` expose contracts without importing vendor SDKs; `adapters` depend inward on ports and application contracts.
- `interfaces` call the application layer, and `observability` consumes structured events without becoming a state owner.

The exact behavior behind these boundaries belongs to the
[contract ownership inventory](docs/reference/contract-ownership.md). Domain
behavior is current only to the extent implemented and validated by its owner;
the same rule applies to ProjectRegistry, authorization, application, and
persistence, and every later behavior remains a design requirement rather than
an implemented guarantee until matching code and validation evidence land.

The repository's current
[local agent Git workflow](docs/reference/local-agent-git-flow.md) coordinates
how maintainers develop and integrate this source tree. It is operational
governance outside the planned runtime dependency graph. It neither implements
nor constrains a future project's `WorkspaceBackend`, `CompletionBackend`, or
project-specific Git policy beyond the adapter contracts that will be designed
and validated separately.
