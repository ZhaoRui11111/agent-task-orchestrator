# Contributing

Thank you for helping build `agent-task-orchestrator`. The project currently
has governance and architecture contracts plus a toolchain/feasibility
scaffold, but no supported runtime.

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

The exact executable entry points are owned by the
[toolchain contract](docs/reference/toolchain-contract.md). A normal local
candidate runs:

```powershell
pnpm install --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store --registry=https://registry.npmjs.org/
pnpm verify:offline
```

Run `pnpm dependency:audit` separately when registry access is authorized.
Dependency update proposals must preserve exact pins, update the lockfile, and
pass every impact-selected route; an automated update is not pre-approved.

## Git and external actions

Commits must contain only task-owned paths. Commit, push, pull-request creation, merge, release, and deployment are separate actions and may require separate authorization.

Do not use destructive Git operations to remove unrelated user state or conceal a partial external operation.

## Maintainer agent workflow

Maintainer-agent tasks follow the
[local task branch and worktree contract](docs/reference/local-agent-git-flow.md)
after its bootstrap has completed. The repository root on `master` is then
integration-only, while implementation occurs in the task's owned linked
worktree. Gate receipts apply only to the exact reviewed head; local integration
is FF-only; and push still requires separate authorization.

External contributors do not need the installed maintainer automation. They
may use a conventional branch and pull request, provided the contribution
respects repository authority, scope, validation, and authorization rules.
Maintainers decide whether and how an external contribution is brought under
the local coordinator; matching branch names never imply coordinator
ownership.

## License and contribution terms

The project is licensed under the [Apache License 2.0](LICENSE). Unless you explicitly state otherwise, a contribution intentionally submitted for inclusion in this project is provided under Apache-2.0 without additional terms, consistent with section 5 of the license.

By submitting a contribution, you represent that you have the right to do so. Preserve applicable copyright, patent, trademark, and attribution notices. If a future distribution includes a `NOTICE` file, follow the preservation requirements in section 4 of Apache-2.0. This project policy is not legal advice.
