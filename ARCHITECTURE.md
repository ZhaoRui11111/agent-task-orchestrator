# Architecture

## Current system

The repository has a governance and architecture-contract baseline, an
executable toolchain and feasibility harness, a pure in-memory TypeScript
Domain Core, a filesystem-identity ProjectRegistry, a finite local runtime
authorization owner, a typed Project/Task/dependency application service, a
local SQLite persistence foundation, the closed local Phase 1 product, and the
complete explicit-Manual local Phase 2 product through the sole current `ato.api/v1`. One immutable
schema-version-1 baseline directly owns metadata and exact Domain snapshots;
ProjectRegistry; local identity; vocabulary-version-1-through-4 epochs and grants;
requests, authorization decisions, lifecycle authorizations and append-only
audit; ordered execution attempts, lease state and per-Task fencing; reliable
Manual-loop intents, authorization bindings, observations, verified receipts,
finalizations, terminal facts and journal records; and bounded dispatcher run,
reconciliation, membership, member-outcome and summary records. Lifecycle
authorization uses the sole complete non-lifecycle application-state projection
at state-digest version 1.
The application service orchestrates business owners in one transaction;
persistence never selects a Domain command or grants authority. Its physical
implementation is split into database-free model, input, policy, Domain
coordination, and service modules behind one explicit `application.ts` facade;
the service module remains the sole transaction-orchestration owner. The CLI
is only typed ingress, trusted local identity/confirmation setup,
presentation, and public error mapping. Its physical API implementation is
split into model, parser, presentation, and runtime modules behind one
explicit `cli-api.ts` facade; the runtime module alone opens and closes the
product runtime or performs command effects. A typed product facade derives the
current non-public Project/Task/execution/turn/intent/receipt/finalization tuple
from current schema-version-1 state and composes the existing application, dispatcher, and
reliable-loop owners. A separate typed execution application
service retains claim, inspection, and renewal. The typed
`ReliableExecutionLoop` owns prepare/execute/observe/verify/finalize and
reconcile-first continuation against the pure `ato.execution/v1` port. The
production `manual-local` adapter implements a durable, independently
inspectable no-workspace turn journal; a distinct trusted Manual outcome
control supplies bounded lifecycle facts, and a separately authorized and
confirmed application decision alone may complete a Task from verified
`turn_succeeded` evidence. The Manual dispatcher coordinates those
owners after one explicit trigger: it durably reconciles old work, seals a
finite candidate set, resolves every member, and publishes a summary only after
complete readback. The repository still implements no SchedulerBackend or
scheduled trigger, MCP component, Codex/Git/workspace adapter, ProjectPolicy,
CompletionBackend or gates, daemon/service, supported platform integration,
release, or deployment. The local Manual product records operator-supplied turn
facts; it does not execute Task content or perform Project/workspace effects.

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
  Domain command selection, transaction orchestration, and result mapping; it
  also owns typed execution claims/inspection/renewal, explicit
  confirmation-bound capability upgrades, the reliable Manual operation
  protocol, reconciliation, verified interruption, and Manual completion
  acceptance. It depends on injected port/control interfaces, never a concrete
  backend. The physical `application-model`, `application-input`,
  `application-policy`, `application-domain`, and `application-service`
  modules preserve that one semantic owner behind the stable facade.
  `application-input` consumes the Domain Core's exported pure canonical
  cancellation-reason predicate instead of defining a second text invariant.
- `persistence`: the implemented SQLite runtime-root, connection, single
  current-baseline migration, combined schema-version-1 repository, transaction, lifecycle handoff,
  execution attempt/sequence, Manual-loop and dispatcher record storage,
  backup, restore, read-only doctor, and typed-corruption owner; later records
  are added only by their implementing phase.
- `dispatcher`: the implemented explicit-Manual reconcile-first
  run, ownership/takeover, finite fan-out, and recovery coordinator. It calls
  application and reliable owners rather than duplicating their decisions.
- `ports`: the implemented pure `ato.execution/v1` contract kit, plus planned
  workspace, scheduler, project-policy, and completion contracts.
- `adapters`: the implemented local Manual execution backend and outcome
  control; the Fake is test-only, while Codex and every other adapter remain
  planned.
- `product-runtime`: the implemented typed local facade that validates the
  closed public CAS tuple, derives non-public durable lineage, composes the
  current application/dispatcher/reliable owners, and returns only bounded
  redacted product views.
- `interfaces`: the implemented sole current `ato.api/v1` product CLI, plus a
  planned MCP surface; every business operation shares the
  application layer or product facade. The physical `cli-api-model`,
  `cli-api-parser`, `cli-api-presentation`, and `cli-api-runtime` modules split
  types, pure parsing, rendering/mapping, and effects without splitting this
  interface ownership.

Only the boundaries explicitly described above are implemented. In particular,
the Manual adapter mutates only its persistence-owned local journal through a
committed, authorization-bound intent; it does not execute Task content, invoke
a vendor, or touch a Project/workspace. The product execution runtime is only
the explicit local Manual control/recovery surface described above.
Every other later name remains accepted design direction rather than a current
runtime component.

## Cross-module dependency constraints

- `domain` may depend only on language/runtime primitives; it must not import application, persistence, dispatcher, ports, adapters, interfaces, or observability modules.
- `project-registry` may inspect only local filesystem identity and depends on
  neither application nor persistence; it must not mutate registered targets.
- `authorization` is a pure decision owner and depends on neither application,
  persistence, content, nor concrete adapters.
- `application` orchestrates domain, ProjectRegistry, authorization, and
  persistence owners but does not copy Domain judgments or depend on concrete
  adapters. Within its physical family, model has no inward Application
  dependency; input depends only on model; policy depends only on model and
  input; Domain coordination depends only on model and policy; and service
  composes exactly model, input, policy, and Domain coordination. No internal
  module imports the facade.
- `persistence` depends inward on `domain`, owns SQLite/filesystem storage
  mechanics and typed application records, and neither invokes authorization
  policy nor performs external Project effects.
- the Manual-loop application coordinator calls injected execution and outcome
  ports outside writer transactions; it neither imports the concrete Manual
  adapter nor accepts adapter facts as authority or Domain decisions.
- `dispatcher` coordinates application services and the reliable execution
  loop without embedding authorization, Domain eligibility/state transitions,
  adapter verification, or project-specific policy.
- `ports` expose contracts without importing vendor SDKs; `adapters` depend inward on ports and application contracts.
- `product-runtime` depends on typed application/dispatcher/reliable owners and
  persistence readback, never on CLI parsing or presentation; it neither
  selects Domain transitions nor reimplements authorization/reconciliation.
- `interfaces` call the application layer or product facade, and `observability`
  consumes structured events without becoming a state owner. Within the CLI
  API family, model has no internal dependency, parser and presentation each
  depend only on model, and runtime composes exactly model, parser, and
  presentation. Parser and presentation do not import each other, and no
  internal module imports the facade.

The exact behavior behind these boundaries belongs to the
[contract ownership inventory](docs/reference/contract-ownership.md). Domain
behavior is current only to the extent implemented and validated by its owner;
the same rule applies to ProjectRegistry, authorization, application,
persistence, and dispatcher, and every later behavior remains a design
requirement rather than an implemented guarantee until matching code and
validation evidence land.

The repository's current
[local agent Git workflow](docs/reference/local-agent-git-flow.md) coordinates
how maintainers develop and integrate this source tree. It is operational
governance outside the planned runtime dependency graph. It neither implements
nor constrains a future project's `WorkspaceBackend`, `CompletionBackend`, or
project-specific Git policy beyond the adapter contracts that will be designed
and validated separately.
