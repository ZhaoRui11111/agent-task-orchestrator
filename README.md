# agent-task-orchestrator

`agent-task-orchestrator` is intended to become a local-first, agent-native task orchestrator for coding agents. It will manage project-bound tasks, hierarchy and dependencies, durable execution linkage, isolated workspaces, and human recovery without turning into a generic Todo or Jira clone.

This is an independent community project. It is not made, sponsored, or endorsed by OpenAI.

## Current status

The repository contains a governance and architecture-contract baseline, an
executable TypeScript/Node toolchain and feasibility harness, a pure in-memory
Domain Core, ProjectRegistry, finite local authorization, typed application
services, and one current schema-version-1 SQLite baseline. The sole current
`ato.api/v1` CLI contains 37 commands and 41 public errors: it retains the exact
explicit-Manual Phase 2 Project, Task, dependency, authorization, backup/
restore, doctor, execution, and dispatcher behavior and adds a closed,
explicitly authorized Codex profile and targeted-dispatch subset.

The package's sole current execution port is `ato.execution/v2`. The retained
`manual-local` adapter uses `workspaceMode=none`; existing Manual and scheduled
dispatch routes remain byte-for-byte Manual-only. A package-private
`@openai/codex-sdk` `0.153.2` backend implements the owned-workspace branch with
verified ephemeral Task input and durable bounded thread/terminal evidence. The
exported Codex product factory and CLI select it only through an active trusted
Project profile, a targeted one-member run, and a fresh invocation Act bound to
the exact pending intent. Validation uses deterministic injected drivers and
disposable Git fixtures only; no real account turn, credential use, effective
administrator-policy attestation, Windows/Codex support claim, or automatic
Task completion follows from that evidence.

The package additionally exposes the fresh-only Phase 3 library closure. It
implements the exact `ato.project-policy/v1`, `ato.completion/v1`, and
`ato.integration/v1` ports; replaces the unreleased workspace boundary with
the sole current `ato.workspace/v2`; adds authorization vocabulary version 6;
and persists policy receipts, completion gates and decisions, integration
reservations/effects, cleanup attestations, and redacted transition evidence in
the same current baseline. One injected typed Phase 3 facade composes a
configured local policy adapter, bounded non-shell local gate backend, local
Git fast-forward/local-file-push backend, and the ownership-bound Windows
workspace backend. It performs adapters outside writer transactions and alone
coordinates current policy, authorization, observation, verification, fencing,
completion, reservation release, and cleanup state.

The package also exports the fresh-only pure `ato.scheduler/v1` contract and a
typed injected scheduler application owner. Authorization vocabulary version 7
adds exactly `scheduler.register`, `scheduler.inspect`, and `scheduler.remove`;
application-state digest version 4 covers their durable configuration,
registration, operation, delivery-observation, and scheduled-tuple records
together with Codex profile/product/effect state. Vocabulary version 8
cumulatively adds exactly five Codex actions after the scheduler stage.
Register/remove use intent-before-effect and restart reconciliation, inspect is
a separate read-only path, and scheduled delivery uses current `dispatch.run`
authority plus the existing dispatcher to create one canonical run per exact
`(schedule_id, config_revision, scheduled_for)` tuple. Tests use only an
unexported no-effect Fake.

These Phase 3 components are library-only and must be explicitly constructed
with trusted configuration. The default product runtime and CLI construct none
of them, add no Phase 3 command or public error, and retain the three independent
backup/restore JSON schema-version-1 formats unchanged. Local Git and filesystem
effects are validated only in disposable repository fixtures; no product
platform support is claimed. The repository still has no MCP server, concrete
SchedulerBackend, real scheduled task, product-wired scheduler route,
daemon/service, release, deployment, general network integration, real Codex
account E2E, or administrator-managed effective-configuration attestation.

Unimplemented planned capabilities are not current capabilities. Design
proposals and roadmaps must remain clearly labeled until their implementations
and validation evidence exist.

## Intended scope

- Local-first, single-user management of multiple local code projects.
- A central task model with project binding, parent hierarchy, and dependency DAGs.
- Replaceable execution, workspace, scheduler, project-policy, and completion adapters.
- A minimal CLI and structured MCP tools sharing one application layer.
- Windows-first validation before any broader platform support claim.

## Non-goals

- Team collaboration, cloud synchronization, RBAC, or billing.
- A generic web project-management interface.
- Unbounded shell execution through MCP.
- Project-specific Git, review, or release rules in the generic core.
- Automatic merge, push, deployment, or destructive cleanup without explicit authorization.

## Repository authority

Read these documents in order when working in this repository:

1. [AGENTS.md](AGENTS.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [Documentation index](docs/README.md)
4. [Repository governance](docs/reference/repository-governance.md)
5. [Validation policy](docs/reference/validation-policy.md)

The [contract ownership inventory](docs/reference/contract-ownership.md) points to each live normative contract. [Architecture decisions](docs/adr/README.md) record why those contracts were selected; they do not replace the contract owners or prove implementation.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the public contribution workflow and [SECURITY.md](SECURITY.md) for security reporting and data-handling boundaries.

## Development package

The frozen versions, package boundary, local commands, CI skeleton, and
dependency maintenance rules are owned by the
[toolchain contract](docs/reference/toolchain-contract.md); executable Domain
Core behavior is owned by the [domain contract](docs/reference/domain-contract.md),
the finite local grant model by the
[authorization contract](docs/reference/authorization-contract.md), and the
implemented storage boundary by the
[persistence contract](docs/reference/persistence-contract.md).
The exact product command grammar, output, redaction, and exit behavior are
owned by the [CLI/API contract](docs/reference/cli-contract.md).
With the exact toolchain installed, the local repository gate is:

```powershell
pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store --registry=https://registry.npmjs.org/
pnpm verify:offline
```

`pnpm dependency:audit` is a separate network-dependent query. Neither the CI
skeleton nor a command that was not run is evidence of a passing gate.

The repository-local [doc-gardener policy](.doc-gardener.json) is an optional
maintainer scan policy: it prunes only `.local`, `.worktrees`, `node_modules`,
`dist`, and `.pnpm-store`, and treats completed plans/evidence as historical.
It does not replace `pnpm docs:check` or make the public toolchain depend on a
private Codex skill.

## Reliable Manual execution and product facade

The package root exports the implemented typed operational owners directly; it
does not expose a second hand-maintained capability-status registry. The
package exports the provisional typed claim service and reliable Manual loop.
Fresh schema creation, bootstrap, and vocabulary-version-2 renewal do not create any of the six
Manual-loop grants. A version-2 claim-capable runtime must perform its own fresh,
identity- and confirmation-bound upgrade to version 3 before
`execution.start`, `execution.inspect`, `execution.resume`, `execution.retry`,
`execution.cancel`, or `execution.completion.accept` can authorize work.

Each effect-capable operation commits its exact semantic intent before calling
the injected adapter, CAS-binds a fresh Act allow immediately before mutation,
independently inspects durable Manual state, persists and verifies bounded
evidence, and CAS-binds a fresh Finalize allow with revision/fence finalization.
Retryable refusals retain exact bounded retry metadata and are due-gated. Recovery
inspects before uncertain replay; expiry alone cannot justify takeover or a
second effect. Manual `turn_succeeded` leaves the Task running until a distinct
current completion grant and fresh confirmation atomically accept the exact
verified evidence. The production Manual adapter records only no-workspace
turn state; it does not execute Task content or touch a Project repository.

Current Manual `ato.api/v1` commands reach this service only through the typed product
facade, which derives the non-public
turn, intent, receipt, and finalization tuple from current schema-version-1 state.
Neither the Manual facade nor the Manual backend invokes Codex, Git, workspace,
scheduler, policy, completion-gate, or Task-content effects, and local
development evidence is not a platform-support claim. The exact rules are owned by the
[authorization contract](docs/reference/authorization-contract.md),
[persistence contract](docs/reference/persistence-contract.md), and
[reliability protocol](docs/reference/reliability-protocol.md).

## Phase 3 policy-gated completion and safe integration library

The package root exports the exact four Phase 3 port kits and one injected
product-library facade. Workspace generations remain bound to the exact
Project, Task, dispatcher member, execution, fence, root, ownership digest, and
predecessor identity under `ato.workspace/v2`. ProjectPolicy receipts narrow
authority and freeze required gates plus integration, preservation, and cleanup
facts. Completion gates run only a trusted configured executable/argument/
environment tuple with `shell=false`; retained evidence contains bounded
identity and output digests rather than raw output. Only fresh passing evidence,
current policy, separate `completion.accept` authority and confirmation, and a
final revision/fence CAS can complete a running Task.

Integration uses one durable reservation per Project/repository/target ref,
monotonic fencing, source-first exact observation, an expected-old
fast-forward update, and an ordinary non-force push only to a configured
canonical local bare repository. Foreign or unknown effect state becomes
inspect-only ambiguity; authoritative recovery terminalizes the original
intent before releasing or expiring the reservation. Cleanup requires the
exact current `ato.workspace-cleanup-attestation/v1` proof, zero-owner
quiescence, completed execution, required gate/preservation evidence, terminal
integration disposition, and point-of-use ownership/inventory checks. It
removes only the bound disposable generation and never gate evidence.

Vocabulary version 6 cumulatively adds exactly twelve completion/integration
actions after the five workspace actions. `completion.accept`,
`integration.apply`, `integration.push`, and `workspace.cleanup` are high risk.
Every vocabulary step remains separately confirmed; bootstrap and renewal never
upgrade it. The Phase 3 library still has no CLI route, and no support, release,
remote-network, or automatic cleanup claim follows
from this library implementation.

## Durable scheduler ingress library

The exact `ato.scheduler/v1` port accepts only closed register, inspect, remove,
and inbound `dispatch_trigger` shapes. Register and remove each require their
own current scheduler grant and fresh named high-risk confirmation, persist the
semantic intent before backend access, and treat response loss as ambiguity
until independent inspection proves state. Inspect obtains a fresh
`scheduler.inspect` decision and records bounded read evidence without a
mutation intent or registration-state write. Every injected backend call runs
outside SQLite writer transactions.

For a schema-valid inbound delivery, authorization is evaluated before schedule
state is disclosed. Denied, stale-config, and malformed observations create no
tuple or run. The first allowed current-config observation owns the unique
scheduled tuple and one canonical dispatcher run; later allowed duplicates
attach to that run and cannot restart it. Scheduling is only a wake-up hint:
the dispatcher still reconciles, seals membership, claims, fences, and resolves
work through its existing owners. There is no concrete adapter, cadence parser,
platform registration, daemon, default product/API/CLI operation route, real
scheduler E2E, or support claim.

## Reconcile-first Manual dispatcher

Fresh schema creation, bootstrap, and vocabulary-version-3 renewal do not create
`dispatch.run`. A runtime must complete its own fresh identity- and
confirmation-bound version-3-to-4 upgrade before an explicit Manual trigger
can create or continue a dispatcher run. Each run has a trusted worker owner,
bounded non-banking heartbeat lease, owner/run revisions, and exact-expiry
takeover fencing.

Before any new claim, the dispatcher durably reconciles unfinished intents,
receipts, expired execution leases, and stale runs, then commits a complete
reconciliation summary. It atomically seals one deterministic finite candidate
membership and resolves every member to one closed terminal outcome. A claimed
member includes the execution claim, `ready`-to-`running` transition, current
`execution.claim` and `execution.start` decisions, and prepared start intent
before the real local Manual effect is invoked through the reliable loop.
Restart and takeover continue from those durable rows; a terminal run summary
is withheld until every sealed member and every claimed intent is complete.

The package root exposes the Manual dispatcher, its injected scheduled ingress,
and the internal targeted one-member Codex specialization. The sole current
`ato.api/v1` product surface exposes the Manual trigger/run resume plus the
closed Codex targeted-dispatch path; it adds no generic backend selector,
scheduler operation or cadence route, concrete SchedulerBackend, daemon, MCP,
Phase 3 completion gates,
release, or platform-support claim. The dispatcher—not CLI code—owns candidate
selection, reconciliation, fan-out, and summary completeness. Its ordering and
fan-out rules are owned by the
[scheduler contract](docs/reference/scheduler-contract.md) and
[reliability protocol](docs/reference/reliability-protocol.md).

## Local product CLI

The source, build, and packed-install entry points implement the same contract:

```powershell
node src/cli.ts doctor
pnpm build
node dist/cli.js doctor
ato doctor
```

Initialization is a one-time, explicitly confirmed operation. It creates only
the fixed local daily capability set; subsequent authorized Project, Task,
dependency, query, and backup operations do not prompt again. For example:

```powershell
$expiry = (Get-Date).ToUniversalTime().AddDays(30).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
ato init --expires-at $expiry --confirm "INITIALIZE LOCAL RUNTIME"
ato status
ato authorization list --limit 100
```

Restore always requires both current `runtime.restore` authority and its two
exact request-local confirmations. Doctor is grant-independent and read-only.
Omitting `--api-version` and passing `--api-version ato.api/v1` select the same
complete 37-command product tree, including one-step capability upgrade, Manual
dispatch/run resume, execution inspect/resume/retry/cancel, trusted Manual
outcome reporting, and separately confirmed Manual completion:

```powershell
ato authorization upgrade --expires-at $expiry --confirm "UPGRADE LOCAL CAPABILITIES"
ato dispatch run --idempotency-key manual-run-1 --lease-duration-seconds 300
```

Each later vocabulary requires its own confirmed upgrade invocation; migration
and renewal never advance the current authorization stage. Retired `ato.api/v2` and any other
unsupported major fail before runtime construction or protected mutation; no
compatibility fallback exists. Use `--format json` for the versioned single-line
machine surface. The exhaustive 37-command tree, `COMMON` execution tuple,
closed projections, and 41-code public error/exit table are in the
[CLI/API contract](docs/reference/cli-contract.md). The tree can perform six
sequential confirmed upgrades to version 7 and one further upgrade to
vocabulary version 8, managing all 55 actions. It exposes exactly
`codex profile activate|inspect|deactivate` and `codex dispatch-run`; existing
execution inspect/resume/retry/request-cancel select Manual or Codex only from
durable state. It exposes no scheduler, generic workspace, policy, gate,
integration, or cleanup operation command. This
development package is not a release or
platform-support claim.

## Maintainer development workflow

The repository adopts a task branch and linked-worktree workflow for local
maintainer agents. After bootstrap, `master` is the clean integration checkout;
each task develops in an owned `task/<task-id>` branch and
`.worktrees/<task-id>` worktree, passes exact-head gates, and reaches `master`
only through FF-only integration. Push is a separate authorized action, and
cleanup occurs only after verified push with no remaining task-worktree
material.

The authoritative lifecycle, recovery, and safety rules are in the
[local agent Git workflow](docs/reference/local-agent-git-flow.md). This is
current repository governance, not evidence for the independent product
workspace adapter or a CompletionBackend.

## Data boundary

Runtime databases, Task bodies, Project paths, execution or thread identifiers,
worktrees, logs, backups, credentials, and other user data belong below the
validated user-data root or their separately owned external location. They
must not be committed to this source repository.

## License and attribution

The project is licensed under the [Apache License 2.0](LICENSE). Contributions are submitted under the same license as described in [CONTRIBUTING.md](CONTRIBUTING.md).

Redistributions must preserve the license and applicable copyright, patent, trademark, and attribution notices as required by Apache-2.0. The project currently has no `NOTICE` file and makes no claim that dependency attribution or release inventory is complete; those are later release gates.
