# Local agent Git workflow

This document is the authoritative repository-development contract for
maintainer agents working on `agent-task-orchestrator`. It governs task
branches, linked worktrees, integration serialization, gate receipts, push
retry, recovery, and cleanup. It is not an implementation or specification of
the product's planned `WorkspaceBackend` or `CompletionBackend`.

The workflow becomes operational only after the bootstrap plan has initialized
and verified coordinator state. Until then, coordinator state is `ABSENT`, and
no task may be represented as having started under this workflow. The
bootstrap itself is the one authorized direct-on-`master` exception.

## Authority and tool boundary

- This file owns the durable repository policy. [AGENTS.md](../../AGENTS.md)
  routes agents to it, and the [validation policy](validation-policy.md) owns
  the required validation routes and evidence criteria.
- The installed `harness-git-flow` script is the sole writer of coordinator
  state under the repository's Git common directory. Do not hand-edit that
  state or let another tool infer and publish competing lifecycle state.
- The installed automation implements mechanics but does not decide task
  scope, semantic approval, test sufficiency, ExecPlan audit outcomes, or
  authorization for external writes.
- Public contributors are not required to install a maintainer skill. The
  durable rules remain readable in this repository, and an ordinary external
  branch and pull request may be used when maintainers have not placed the
  contribution under the local coordinator.

## Topology and ownership

After bootstrap:

- The repository root is the clean integration checkout on `master`; it is not
  a development workspace.
- One coordinated task owns one `task/<task-id>` branch, one
  `.worktrees/<task-id>` linked worktree, and one primary agent thread.
- Subagents working on the same task use that task's existing worktree. They do
  not create sibling branches or worktrees for the same task.
- `.worktrees/` is repository-local ignored storage. Coordinator state stays
  under the Git common directory and is not source content.
- Existing branches, worktrees, files, or directories are never adopted merely
  because their names match. Creation and later cleanup require an exact
  ownership receipt.

Caller paths are canonicalized before mutation and must resolve to the exact
configured repository, worktree, branch, and resource identity. An equivalent
case or spelling alias that resolves to that same identity is not rejected for
its spelling alone. At protected coordinator-state, lock, namespace, worktree,
and inventoried-file seams, the coordinator checks the expected node class,
rejects nonregular or reparse nodes, and matches open-handle identity to the
inspected contained path. Boundary escape, resource ambiguity, or identity
drift fails closed.

## Required lifecycle

The normal lifecycle is:

`trace/recover -> start -> develop -> reserve/optional refresh -> validate -> task result commit -> gate -> ready -> integrate -> separately authorized push -> cleanup`

1. Run `trace` before a lifecycle decision. If it reports a pending operation,
   run only `recover` with the fresh state token before continuing.
2. `start` freezes the required gate names, creates the owned task branch and
   linked worktree, and binds the primary thread. The gate set comes from the
   impact routes in the validation policy. An ExecPlan audit is included only
   when the change independently requires an ExecPlan.
3. Develop only in the task worktree. Preserve pre-existing and out-of-scope
   content, and keep commits limited to task-owned paths.
4. Obtain the exclusive integration reservation before the final review
   sequence. If `master` advanced while the task has no task commit, `refresh`
   may fast-forward the task base only through the coordinator's guarded
   operation. Its reported base delta still requires the applicable semantic
   review; refresh does not grant approval.
5. Run the real validations, create the reviewed task-result commit when the
   applicable plan and review order permits it, and record actual gate results
   against that exact head. A failed gate leaves the task reserved and
   editable. Fix the task, commit the new head, rerun the real gate, and replace
   the stale receipt.
6. `ready` requires every frozen gate to have a current-head passed receipt and
   a clean task worktree. Receipt freshness is mechanical; the validation
   policy remains the owner of what must be tested.
7. `integrate` performs only a fast-forward local transition on clean
   `master`. Merge commits, automatic rebase, reset, stash, and conflict
   synthesis are outside this workflow.
8. `push` is an external write and always requires authorization distinct from
   task readiness, local integration, and commit authorization. Use an ordinary
   non-force push. A push failure preserves `merged_local` and the reservation
   for observable retry; it is not disguised as rollback.
9. Run `cleanup` only after a verified successful push receipt. Cleanup must
   find no tracked, untracked, or ignored material in the task worktree and may
   remove only resources created by this coordinator. Refusal is safer than
   force cleanup.

## State, concurrency, and crash recovery

Coordinator updates use stable OS locking only for short critical sections.
Long-lived exclusivity is represented by durable state and the integration
reservation, not by holding a process lock.

Every returned `state_sha256` is a single-use compare-and-swap token. A caller
must obtain a fresh token after success, failure, or concurrent change. Stale
tokens, revision drift, identity drift, or a missing reservation refuse the
mutation.

Every state publication uses a same-directory exclusive temporary file, file
`fsync`, atomic replacement, and exact canonical-byte readback. A Git-mutating
transition that will move external state normally follows:

`persisted intent -> external transition -> observed exact receipt -> atomic state publication`

The intent contains complete pre-state and target-state task and ref snapshots.
A moving-base refresh also records the same authoritative dirty inventory in
both its pre and target receipts, and recovery re-observes that exact inventory.
Recovery may clear an operation only when the live repository exactly matches
its durable pre-state, or finalize it only when the live repository exactly
matches its durable target-state. Mixed refs or worktrees, unreadable state,
malformed state, identity drift, reparse traversal, inventory drift, or
ambiguous partial success retain the intent and require explicit human
resolution.

Three idempotent paths deliberately publish no intent. A same-base `refresh`
validates the authoritative inventory but performs no Git command or state
publication and returns the unchanged CAS. A same-head `integrate` and an
already-target `push` each run the idempotent Git command and then publish one
terminal state. A crash before that publication leaves the task at `ready` or
`merged_local`; after a fresh trace, retry the ordinary `integrate` or `push`
command rather than calling `recover` without a pending operation.

## Prohibited shortcuts

Do not:

- develop in the integration checkout after bootstrap;
- bypass coordinator state with direct branch/worktree lifecycle commands;
- hand-write a passed gate without running and observing the real gate;
- use merge commits, force push, automatic rebase, stash, reset, clean, or
  force deletion to make state appear consistent;
- treat an approved plan, ready task, passed validation, or local merge as push
  authorization; or
- let this repository workflow become a hidden dependency of the public core,
  CLI, MCP surface, contribution process, or a future project adapter.

## Bootstrap and availability

Coordinator initialization is permitted only when the repository root is the
sole clean integration checkout on `master`, local `master` equals
`origin/master`, repository identity is exact, coordinator state is absent,
and `.worktrees` is either absent or an ordinary directory. If those facts or
the necessary authorization are missing, state remains `ABSENT`.

The current bootstrap work does not create a task worktree. Once its
task-owned commit is pushed and the clean/synchronized preconditions hold, the
coordinator can be initialized and traced as the final bootstrap verification.
