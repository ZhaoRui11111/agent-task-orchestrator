# Contributing

Thank you for helping build `agent-task-orchestrator`. The project currently has governance and architecture contracts but no supported runtime.

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

Run every validation route selected by the changed surface. Documentation changes always verify links, capability wording, whitespace, and the staged file inventory.

## Git and external actions

Commits must contain only task-owned paths. Commit, push, pull-request creation, merge, release, and deployment are separate actions and may require separate authorization.

Do not use destructive Git operations to remove unrelated user state or conceal a partial external operation.

## License and contribution terms

The project is licensed under the [Apache License 2.0](LICENSE). Unless you explicitly state otherwise, a contribution intentionally submitted for inclusion in this project is provided under Apache-2.0 without additional terms, consistent with section 5 of the license.

By submitting a contribution, you represent that you have the right to do so. Preserve applicable copyright, patent, trademark, and attribution notices. If a future distribution includes a `NOTICE` file, follow the preservation requirements in section 4 of Apache-2.0. This project policy is not legal advice.
