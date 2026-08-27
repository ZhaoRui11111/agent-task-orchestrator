# Contributing

Thank you for helping build `agent-task-orchestrator`. The project is currently establishing its repository contracts before implementing the runtime.

## Start with the authority chain

Before changing the repository, read:

1. [AGENTS.md](AGENTS.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [docs/README.md](docs/README.md)
4. The reference or plan relevant to the change

## Scope and ownership

- Define a bounded task and its owned paths.
- Preserve pre-existing or unrelated changes.
- Do not commit runtime data, prompts, local project paths, execution identifiers, logs, secrets, databases, backups, or worktrees.
- Do not require contributors to have access to a private repository or a maintainer-only skill.
- Keep project-specific policies behind explicit adapter or policy boundaries.

## Plans and proposals

Architecture, persistence, security, concurrency, destructive cleanup, and compatibility changes may require a self-contained development plan. See [docs/plans/README.md](docs/plans/README.md).

A proposal is not a current capability. Documentation must keep proposal, active work, completed history, and current evidence distinguishable.

## Validation

Use the impact-based routes in [docs/reference/validation-policy.md](docs/reference/validation-policy.md). Report:

- Commands run.
- Binary pass/fail criteria.
- Actual results.
- Relevant gates not run and why.

At the current stage, verify links, capability wording, whitespace, and the staged file inventory.

## Git and external actions

Commits must contain only task-owned paths. Commit, push, pull-request creation, merge, release, and deployment are separate actions and may require separate authorization.

Do not use destructive Git operations to remove unrelated user state or conceal a partial external operation.

## License status

The project has not selected a license yet. Contributions should not be accepted for redistribution until a `LICENSE` and contribution terms have been established.
