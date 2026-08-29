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
- `.task-artifacts/` is the only coordinator-registered disposable source-tree
  root. It is ignored, contains task-created scratch only, and is distinct from
  task worktrees, coordinator state, dependency stores, build output, runtime
  data, and user content.
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

## Repository artifact policy

The machine-readable opt-in is
`.codex/harness-git-flow.json` at the exact integration-head Git tree. It has
schema version `1` and registers exactly `.task-artifacts`. The coordinator
reads that committed blob at `start` and stores its blob identity and normalized
root inventory in the task. An absent manifest produces a null policy; a task
started before this policy was committed never acquires it retroactively.

For an opted-in task, every registered root must be safe, ignored, absent when
the task starts, and free of tracked overlap. Before a passed gate, `ready`,
integration, or push, the task needs a current-head `prune-artifacts` receipt.
That explicit command accepts no caller-selected path. It revalidates the
task-frozen manifest against the exact task head, the committed ignore policy,
tracked overlap, repository/worktree topology, node classes, containment, and
inventory before the first deletion. It removes only the frozen exact root,
verifies root absence, and binds the receipt to the task head and manifest blob.
It may unlink an inventoried symlink or reparse alias inside that root without
traversing or deleting the alias target, followed by regular files and real
directories bottom-up. An unsafe node, unanchored or escaping alias,
identity-drifted ancestor, tracked overlap, or ambiguous inventory fails closed
before deletion. A permission, identity, concurrency, or interruption failure
after deletion begins publishes no receipt but may leave a truthful partial
namespace contraction; no receipt does not mean rollback. A later invocation
re-inventories only the remaining exclusive namespace and idempotently retries
the same frozen-root command. Root absence plus the head/blob-bound receipt is
the only terminal proof.

This repository grants standing authorization for that exact pathless
`prune-artifacts` invocation after the task result commit, including when safe
nonempty `.task-artifacts` scratch exists, unless a newer user instruction
revokes or narrows the grant. It does not authorize a caller path, another
manifest root, traversal or deletion of an alias target, coordinator `cleanup`,
or any external repository or adjacent action.

The repository's package and SQLite feasibility tools create unique
creator-owned child generations beneath `.task-artifacts` and normally remove
their own children. Coordinator pruning is still required for an opted-in task,
even when the exact root is already absent, because the receipt proves the
terminal observation. `node_modules`, `.pnpm-store`, `dist`, `.worktrees`, and
runtime or personal data are not registered and are never inferred as
prunable.

Both public Node test commands run through the repository test runner. It takes
a path-based metadata snapshot of the artifact tree, invokes native
`node --test` discovery without a shell, and checks baseline equality only
after the child process succeeds. A successful command that adds, removes, or
replaces an artifact member fails while preserving the observed tree. A failed
child process keeps its own exit status and may leave diagnostic scratch until
evidence is recorded and the final explicit coordinator prune runs.

This wrapper is an observation-only hygiene assertion for a test process whose
mutating work, including surviving child processes, is quiescent before the
terminal snapshot. It rejects a symlink, junction, reparse, or nonregular node
that is present during either snapshot, but path-based Node APIs do not give it
the coordinator's anchored no-follow guarantee against concurrent Windows path
replacement. The runner deletes nothing, publishes no security or prune
receipt, and never turns test success into prune authorization. Coordinator
prune independently revalidates and anchors its own frozen inventory before it
may unlink an in-root alias without traversing the target.

The wrapper stamps its own child before native discovery. `NODE_TEST_CONTEXT`
suppresses the runner entry only when that owner marker is also present; a
direct invocation that merely inherits or fabricates the Node context fails
closed instead of reporting a zero-test success.

## Required lifecycle

The normal lifecycle is:

`trace/recover -> start -> develop -> reserve/optional refresh -> validate -> task result commit -> standing-authorized prune-artifacts when opted in -> gate -> ready -> integrate -> standing-authorized ordinary push -> separately authorized cleanup`

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
   only after any required artifact prune receipt binds that exact head. A
   failed gate leaves the task reserved and
   editable. Fix the task, commit the new head, rerun the real gate, and replace
   the stale receipt.
6. For a manifest-backed task, invoke the standing-authorized
   `prune-artifacts` after the result commit and before recording a passed gate.
   The command is idempotent when the root is already absent. If it stops after
   partial contraction, preserve that actual state, obtain a fresh trace token,
   and retry only the same frozen-root command; do not infer rollback from a
   missing receipt. A later task-head change invalidates the old receipt.
7. `ready` requires every frozen gate to have a current-head passed receipt and
   a clean task worktree. Receipt freshness is mechanical; the validation
   policy remains the owner of what must be tested.
8. `integrate` performs only a fast-forward local transition on clean
   `master`. Merge commits, automatic rebase, reset, stash, and conflict
   synthesis are outside this workflow.
9. This repository grants standing authorization to invoke `push` immediately
   after exact-head readiness and FF-only local integration, unless a newer
   user instruction revokes or narrows that grant. The transition remains
   separate and observable, targets only the configured `origin/master`, and
   uses an ordinary non-force push. A push failure preserves `merged_local` and
   the reservation for ordinary retry or reporting; it is not disguised as
   rollback. The standing grant does not authorize a pull request, release,
   deployment, secret access, arbitrary network use, another repository, or
   cleanup.
10. Run `cleanup` only after a verified successful push receipt and separate
   authorization for cleanup. Cleanup must
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

Coordinator state version `2` stores an immutable per-task artifact policy and
an optional prune receipt in addition to the version `1` lifecycle facts. The
repository manifest is source policy; coordinator state remains the sole
durable lifecycle record. Neither file is inferred from the other after task
start.

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
- attach the current manifest to an older null-policy task, prune a
  caller-selected path, or infer disposable roots that are absent from the
  frozen policy;
- use merge commits, force push, automatic rebase, stash, reset, clean, or
  force deletion to make state appear consistent;
- treat an approved plan, ready task, passed validation, or local merge as a
  push grant outside this repository's exact standing authorization; or
- let this repository workflow become a hidden dependency of the public core,
  CLI, MCP surface, contribution process, or a future project adapter.

## Bootstrap and availability

The coordinator was initialized by the completed bootstrap plan from a clean,
synchronized `master` and later upgraded in place to state version `2` only
with no pending operation or reservation. The committed artifact manifest
affects only tasks started from a base containing that manifest. Public
contributors still need no coordinator or maintainer skill to build, test, or
submit an ordinary external branch and pull request.
