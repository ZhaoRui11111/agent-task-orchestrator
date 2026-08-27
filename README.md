# agent-task-orchestrator

`agent-task-orchestrator` is intended to become a local-first, agent-native task orchestrator for coding agents. It will manage project-bound tasks, hierarchy and dependencies, durable execution linkage, isolated workspaces, and human recovery without turning into a generic Todo or Jira clone.

This is an independent community project. It is not made, sponsored, or endorsed by OpenAI.

## Current status

The repository currently contains only its governance and documentation baseline. There is no executable orchestrator, CLI, MCP server, plugin, database schema, scheduler, or supported adapter yet.

Planned capabilities are not current capabilities. Design proposals and roadmaps must remain clearly labeled until their implementations and validation evidence exist.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the public contribution workflow and [SECURITY.md](SECURITY.md) for security reporting and data-handling boundaries.

## Data boundary

Future runtime databases, task prompts, project paths, execution or thread identifiers, worktrees, logs, backups, credentials, and other user data belong in a user data directory. They must not be committed to this source repository.

## License

No license has been selected yet. Until a `LICENSE` file is added, no license is granted for reuse, modification, or redistribution. License selection is a required gate before the project is presented as an open-source release.
