# agent-task-orchestrator

`agent-task-orchestrator` is intended to become a local-first, agent-native task orchestrator for coding agents. It will manage project-bound tasks, hierarchy and dependencies, durable execution linkage, isolated workspaces, and human recovery without turning into a generic Todo or Jira clone.

This is an independent community project. It is not made, sponsored, or endorsed by OpenAI.

## Current status

The repository contains a governance and architecture-contract baseline, an
executable TypeScript/Node toolchain and feasibility harness, a pure in-memory
Domain Core for Project/Task rules, a safe local ProjectRegistry, a finite
runtime authorization model, one typed Project/Task/dependency application
service, schema-v4 SQLite persistence, and a composable local Phase 1 `ato`
product CLI. The application service remains the sole business command/query
owner and atomically coordinates Domain snapshots, registry/grant changes,
authorization decisions, and sanitized audit. The CLI provides initialization,
finite grant management, Project/Task/dependency management, status, backup,
confirmed restore, and read-only doctor surfaces without copying those rules.
It still has no executable orchestrator, MCP server, plugin, dispatcher,
scheduler, execution backend or claim/completion loop, supported adapter,
supported release, or validated product platform integration.

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

## Local Phase 1 CLI

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
Use `--format json --api-version ato.api/v1` for the versioned single-line
machine surface. The exhaustive command tree and stable public error/exit table
are in the [CLI/API contract](docs/reference/cli-contract.md). This development
package is not a release or platform-support claim.

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
current repository governance, not evidence that the planned orchestrator has
implemented worktree or completion adapters.

## Data boundary

Runtime databases, Task bodies, Project paths, execution or thread identifiers,
worktrees, logs, backups, credentials, and other user data belong below the
validated user-data root or their separately owned external location. They
must not be committed to this source repository.

## License and attribution

The project is licensed under the [Apache License 2.0](LICENSE). Contributions are submitted under the same license as described in [CONTRIBUTING.md](CONTRIBUTING.md).

Redistributions must preserve the license and applicable copyright, patent, trademark, and attribution notices as required by Apache-2.0. The project currently has no `NOTICE` file and makes no claim that dependency attribution or release inventory is complete; those are later release gates.
