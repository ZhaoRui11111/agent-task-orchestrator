# Architecture

## Current system

The repository has a governance and architecture-contract baseline, executable
toolchain and feasibility harness, pure in-memory TypeScript Domain Core,
filesystem-identity ProjectRegistry, finite local authorization owner, typed
application services, local SQLite persistence, the complete explicit-Manual
Phase 2 product plus the explicitly authorized Codex subset through the sole
current `ato.api/v1`, and fresh-only injected Phase 3 and scheduler libraries.
One immutable schema-version-1 baseline directly owns metadata
and exact Domain snapshots; ProjectRegistry; local identity;
vocabulary-version-1-through-8 epochs and grants; application requests,
authorization decisions, lifecycle handoffs and audit; execution attempts,
Manual-loop evidence and journal state; Codex profile, product-operation,
effect-authorization, turn, and operation evidence; dispatcher runs and
membership;
workspace generations and operation evidence; and Phase 3 policy receipts,
completion gate evidence/decisions, integration reservations/effects, cleanup
attestations, and bounded transition events; plus scheduler configurations,
registrations, operation evidence, delivery observations, and scheduled tuples.
Lifecycle authorization uses the sole complete non-lifecycle application-state
projection at digest version 4.
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
  from current schema-version-1 state and composes the existing application,
  dispatcher, and reliable-loop owners. A separate typed execution application
service retains claim, inspection, and renewal. The typed
`ReliableExecutionLoop` owns prepare/execute/observe/verify/finalize and
reconcile-first continuation against the pure `ato.execution/v2` port. The
production `manual-local` adapter implements a durable, independently
inspectable no-workspace turn journal; a distinct trusted Manual outcome
control supplies bounded lifecycle facts, and a separately authorized and
confirmed application decision alone may complete a Task from verified
`turn_succeeded` evidence. The Manual dispatcher coordinates those
owners after one explicit trigger: it durably reconciles old work, seals a
finite candidate set, resolves every member, and publishes a summary only after
complete readback. A separate Codex product application composes the
package-private SDK implementation through the same v2 protocol with an exact
owned workspace, verified ephemeral Task input, and a durable bounded
thread/turn journal. Its package-root factory and four CLI paths expose only
profile activate/inspect/deactivate and targeted one-member dispatch; existing
execution inspect/resume/retry/request-cancel discriminate the durable backend.
The fixed destination and opaque credential reference are configuration, not
authority: every effect additionally requires the exact active profile, fresh
v8 grants and confirmation, and an atomic one-consumer Act before disclosure.

The package root also exports pure `ato.project-policy/v1`,
`ato.completion/v1`, `ato.integration/v1`, and sole current `ato.workspace/v2`
contract kits. `createPhase3ProductRuntime` requires explicitly injected policy,
completion, integration, and workspace backends plus trusted configuration; it
is not a default product-runtime branch. Its application owner evaluates
preliminary policy authority, persists intents before effects, invokes adapters
outside writer transactions, independently records and verifies observations,
and alone coordinates gate freshness, policy-gated completion, integration
reservation/recovery/release, and cleanup attestation issuance.

The package root additionally exports the pure exact `ato.scheduler/v1` kit and
one typed scheduler application owner that accepts only an injected backend.
Register/remove use durable prepare, effect, observation, verification,
finalization, and reconciliation; inspect uses a distinct read-only decision/
query/observation path. Scheduled delivery is an ingress on the existing
dispatcher owner: it records bounded observations, checks current configuration
and `dispatch.run`, creates one unique scheduled tuple and canonical run, and
attaches later duplicates without restarting that run. No concrete scheduler
backend or default product/API/CLI scheduler operation route exists.

The concrete local adapters are one immutable configured ProjectPolicy, one
bounded non-shell gate runner with separate retained evidence, one local Git
fast-forward/local-file-push backend, and the existing Windows linked-worktree
backend extended with attestation-bound cleanup, plus the package-private Codex
SDK backend selected only by the Codex product owner. They write no SQLite state and
are validated only against disposable repositories. The default Manual product
and CLI construct none of them, expose no Phase 3 command, and still do not
execute Task content or perform a Project/workspace effect. The Codex route is
the sole exception and is callable only under its explicit profile/effect
authorization and trusted-host-administrator precondition. The repository
implements no concrete SchedulerBackend, real scheduled task, or platform
scheduler effect, MCP component, product-wired scheduler route, daemon/service,
supported platform integration, release, or deployment. No real Codex account
E2E, administrator-managed effective-policy attestation, or platform-support
claim exists.

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
  acceptance. A separate typed workspace coordinator owns the exact
  Project/Task/run/member/execution/fence/generation binding and the durable
  reserve/create/inspect/recover/cleanup protocol. The Phase 3 application
  coordinator owns policy evaluation, gate lifecycle/freshness,
  completion-decision convergence, integration reservation/effects/recovery,
  cleanup attestation, and all corresponding authorization/revision/fence CAS.
  A distinct scheduler application owner coordinates register/remove mutation
  lifecycle and read-only inspect against an injected `ato.scheduler/v1`
  backend; no adapter call occurs inside a writer transaction.
  Application owners depend on injected port/control interfaces, never a
  concrete backend. The physical
  `application-model`, `application-input`,
  `application-policy`, `application-domain`, and `application-service`
  modules preserve that one semantic owner behind the stable facade.
  `application-input` consumes the Domain Core's exported pure canonical
  cancellation-reason predicate instead of defining a second text invariant.
- `persistence`: the implemented SQLite runtime-root, connection, single
  current-baseline migration, combined schema-version-1 repository, transaction, lifecycle handoff,
  execution attempt/sequence, Manual-loop, Codex profile/product/effect and
  package-private backend journal,
  dispatcher and scheduler record storage,
  workspace generation/operation/evidence storage, Phase 3 policy/gate/
  completion/integration/cleanup evidence, backup, restore, read-only doctor,
  and typed-corruption owner. Backup
  manifest, restore intent, and restore receipt each have an independent exact
  current JSON format at schema version 1; those format identities are not the
  database schema. Later records are added only by their implementing phase.
- `dispatcher`: the implemented explicit-Manual, targeted one-member Codex,
  and scheduled-ingress reconcile-first run, ownership/takeover, finite fan-out, and recovery
  coordinator. It calls
  application and reliable owners rather than duplicating their decisions.
- `ports`: the implemented pure `ato.execution/v2`, `ato.scheduler/v1`,
  `ato.project-policy/v1`, `ato.completion/v1`, `ato.integration/v1`, and sole
  current `ato.workspace/v2` contract kits.
- `adapters`: the implemented local Manual execution backend/control, the
  product-selected package-private Codex SDK backend/driver, configured local
  ProjectPolicy, bounded local CompletionBackend, local Git
  integration backend, and Windows Git workspace backend. The Phase 3 adapters
  are explicitly injected library surfaces tested only in disposable fixtures;
  test Fakes are unexported. No concrete scheduler adapter exists.
- `product-runtime`: the implemented typed local Manual facade, Codex product
  application, and a separate injected Phase 3 facade. The Manual facade
  validates the closed public CAS tuple and returns only bounded redacted
  product views. The Codex owner validates profile/configuration identity,
  C19 replay identity, targeted ownership, Prepare/Act sequencing, and stored
  terminal results. The Phase 3 facade
  requires all four trusted adapters/configuration, derives non-public durable
  tuples, and is never constructed by the default CLI runtime.
- `interfaces`: the implemented sole current `ato.api/v1` product CLI, plus a
  planned MCP surface; every business operation shares the
  application layer or product facade. The physical `cli-api-model`,
  `cli-api-parser`, `cli-api-presentation`, and `cli-api-runtime` modules split
  types, pure parsing, rendering/mapping, and effects without splitting this
  interface ownership.

The package root is an explicit re-export facade for these implemented
operational owners. It does not duplicate their truth in a hand-maintained
scaffold or capability-status registry.

Only the boundaries explicitly described above are implemented. The Manual
adapter mutates only its persistence-owned local journal and does not execute
Task content, invoke a vendor, or touch a Project/workspace. Phase 3 adapters
perform only their closed policy, gate, local Git, or owner-attested workspace
operation, write no SQLite state, and are exercised only with disposable
repositories. The local-file push path is not a general remote-network route,
and the cleanup path is not caller-selected or automatic. The default product
execution runtime contains the explicit local Manual control/recovery surface
and the closed Codex profile/targeted-dispatch subset; it has no generic backend
selector. The scheduler contract/application and scheduled ingress are
separately injected library components; concrete scheduler/platform effects
and every other later name remain design direction rather than a current
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
- the workspace application coordinator calls its injected backend outside
  writer transactions; trusted ingress, confirmation, runtime/root validation,
  semantic verification, and authorization decisions remain application-owned,
  while the backend neither writes SQLite nor selects a lifecycle transition.
- the Phase 3 application coordinator calls only injected ProjectPolicy,
  Completion, Integration, and Workspace ports outside writer transactions;
  policy receipts narrow but never create authority, and only the application
  owner chooses persistence/Domain transitions.
- the scheduler application coordinator calls only an injected scheduler port
  outside writer transactions; it owns authorization, durable intent/read
  evidence, semantic verification, and registration projection. Scheduled
  delivery enters the existing dispatcher owner and never grants Task mutation.
- `dispatcher` coordinates application services and the reliable execution
  loop without embedding authorization, Domain eligibility/state transitions,
  adapter verification, or project-specific policy.
- `ports` expose contracts without importing vendor SDKs; `adapters` depend inward on ports and application contracts.
- `product-runtime` depends on typed application/dispatcher/reliable/Phase 3
  owners and persistence readback, never on CLI parsing or presentation; it
  neither selects Domain transitions nor reimplements authorization or
  reconciliation. The default constructor has no dependency on Phase 3
  concrete adapters.
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
governance outside the product runtime dependency graph. It neither implements
the product's current `WorkspaceBackend` contract nor the exported Windows Git
adapter. It also does not provide `CompletionBackend` or project-specific Git
policy. Those product concerns remain independent of maintainer worktree
governance.
