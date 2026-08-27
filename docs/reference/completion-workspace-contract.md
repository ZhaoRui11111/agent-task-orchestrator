# Completion and workspace contract

## Status and authority

This file is the sole normative owner of planned completion-gate identity and
freshness, run/workspace topology isolation, worktree ownership receipts,
integration reservation, Git partial-success observation, contained regular
path and no-follow/reparse checks, and cleanup refusal. No workspace, worktree,
gate runner, Git integration, or cleanup implementation exists today.

The presence of this future product contract does not authorize this
repository's development process to create a worktree. Adapter call shapes are
owned by the [adapter contracts](adapter-contracts.md), durable external effects
by the [reliability protocol](reliability-protocol.md), and permission by the
[authorization contract](authorization-contract.md).

## Run and workspace topology

- A trusted configured `workspace_root` contains logical paths
  `runs/<run_id>/workspaces/<workspace_id>/g<generation>`.
- `run_id`, `workspace_id`, and `generation` are system-generated identities,
  not Task titles, branch names, prompt text, or user-provided relative paths.
- A workspace generation belongs to exactly one Project, Task, execution, run,
  and creator operation. It is never shared across active executions or reused
  after terminal cleanup/recovery.
- A new retry that legitimately reuses a workspace retains its exact workspace
  ID/generation and ownership receipt. A replacement workspace uses a greater
  generation and a new receipt.
- Stages, gate output, and diagnostic material have named children of that
  generation. Code never discovers them by globbing siblings or choosing the
  lexicographically latest path.
- The configured root, run root, and workspace generation are resolved and
  checked independently. Containment of one workspace confers no ownership of a
  sibling or ancestor.

## Worktree ownership receipt

Creation is not complete until an immutable ownership receipt binds:

- workspace ID and generation;
- creator operation ID, execution ID, fencing token, and run ID;
- Project ID and canonical repository identity, including Git common-directory
  identity;
- canonical workspace path and trusted workspace-root identity;
- worktree registration identity from Git's authoritative worktree inventory;
- branch/ref identity, base object ID, and observed HEAD object ID;
- creation intent and adapter receipt IDs;
- creation time, adapter/contract versions, and policy/config revision; and
- a complete initial filesystem/Git inventory.

The durable database receipt and current Git/filesystem observations must both
match. A directory, branch, marker file, Git registration, or database row by
itself is insufficient. Recovery of a partial create inspects all of them; a
conflict is `workspace_conflict` or `ambiguous_external_state`, not implicit
adoption.

## Gate identity and freshness

A gate receipt is uniquely identified by this complete tuple:

`task_id`, Task revision, `execution_id`, fencing token, `workspace_id`,
workspace generation/revision, canonical repository identity, exact HEAD object
ID, Project policy ID/version/config revision, gate ID/version, gate input or
command identity, completion-adapter ID/version, and tool/environment evidence
identity.

It also records start/end times, `pass|fail|indeterminate`, redacted evidence
reference, and nullable `valid_until`.

A receipt is fresh if and only if:

1. every identity above exactly matches the current completion request;
2. verdict is `pass`;
3. its gate ID/version remains in the current policy-required gate set;
4. its evidence inventory reopens and validates;
5. current time is before `valid_until` when one exists; and
6. no newer policy, Task, execution, workspace, repository HEAD, adapter, or
   gate-input revision supersedes it.

Any HEAD change, including a metadata-only commit, stales the receipt. Similar
content, a descendant commit, a repeated command, or another workspace does not
preserve freshness.

Completion evaluation obtains the current required-gate set from ProjectPolicy,
verifies every required receipt, obtains a current completion decision, and
passes that evidence through authorization and finalization CAS. A backend turn
ending, local commit existing, gate command exiting, or some gates passing does
not itself complete a Task.

## Integration reservation

Execution workspaces may run concurrently. Mutation of one Project target ref
is serialized by a durable integration reservation with:

- reservation ID, Project ID, canonical repository identity, and exact target
  ref;
- expected target object ID and proposed source workspace/HEAD identity;
- owner execution/operation, lease revision, fencing token, and expiry;
- policy/config revision and authorization-decision reference; and
- integration intent and current observation references.

The complete reservation status set is `active`, `ambiguous`, `released`, and
`expired`. `active` and `ambiguous` are current; `released` and `expired` are
terminal for that reservation. An `ambiguous` reservation permits no mutation
and continues to block a replacement until reconciliation resolves the target
to a terminal reservation state.

At most one current reservation exists per Project repository/target-ref tuple.
Acquisition uses one storage transaction that compares the expected target and
policy revisions, proves no current row, allocates the next per-target fencing
token, inserts `active`, and records audit evidence. The persistence owner's
partial unique index is the final concurrent-writer guard, so a racing acquire
cannot create a second current row.

Renewal matches reservation ID, revision, owner, fence, target tuple, and
expected target object ID. Passing expiry immediately removes mutation authority
but does not silently make the row replaceable: reconciliation first observes
unfinished Git/external effects, then CAS-transitions it to `expired` or
`ambiguous`. A clean release likewise requires the current owner/fence and no
unfinished integration intent. Only after a terminal row exists may takeover
create a new reservation with a greater per-target fence.

Acquisition, renewal, takeover, and stale-writer rejection use the generic
lease/fencing mechanics, while this contract owns the status meanings and
target-ref exclusivity. The durable schema, writer/reader closure, transaction,
and unique-index rules are in the
[persistence contract](persistence-contract.md#transaction-boundaries). The
reservation authorizes no merge, push, release, deployment, or cleanup; each is
a separate policy and authorization decision. Loss or expiry stops further Git
mutation and routes observation/reconciliation.

## Git partial-success protocol

Every Git or remote step has its own persisted intent and observation. The
system records actual state rather than pretending a multi-step sequence is
atomic:

| Observed state | Required handling |
| --- | --- |
| No local ref change and no remote change | A policy-authorized retry may use the same semantic operation. |
| Local target ref advanced, remote not requested | Record the exact new local object ID; the next action requires its own authorization. |
| Local target ref advanced, push rejected | Preserve the local success, record the remote rejection, and retry only an ordinary policy-permitted push after re-observation. |
| Push response lost or timed out | Inspect the exact remote ref. Matching expected object is observed success; prior object permits bounded ordinary retry; any other/unknown object is ambiguous. |
| Remote advanced, local finalization missing | Persist the remote observation and reconcile finalization without pushing again. |
| Target ref changed by another actor | Stop on CAS conflict, preserve both observations, and obtain a new policy decision. |

Reset, force push, forced worktree removal, history rewriting, or deletion cannot
be used to disguise partial success. Remote inspection itself may require
network permission; without it, the state remains explicitly blocked or
ambiguous.

## Contained-path and no-follow checks

Before every filesystem mutation or cleanup, the workspace adapter MUST:

1. obtain a handle-backed canonical identity for the trusted root;
2. reject empty/root targets, `.`/`..` traversal, drive or share changes,
   alternate data-stream syntax, device paths, and normalization ambiguity;
3. walk every existing path component without following symbolic links,
   junctions, mount points, or any other reparse point;
4. require expected directories to be directories and ownership markers,
   manifests, and receipts to be regular files, never links or special files;
5. open the target with no-follow semantics where the platform exposes them,
   then compare the opened identity and containment again to close path-swap
   races; and
6. compare paths with the target filesystem's case and normalization rules,
   while retaining the exact opened identity rather than trusting a string
   prefix.

An unsupported no-follow or reparse inspection capability is a failed safety
precondition, not permission to fall back to recursive string-based deletion.
Git command output and repository content are untrusted input and cannot supply
the trusted root or ownership identity.

## Cleanup refusal

Cleanup proceeds only when all of these are proven current:

- a separate `workspace.cleanup` grant and ProjectPolicy allow decision;
- exact workspace ownership receipt, creator/generation identity, and Git
  worktree registration match;
- contained-path/no-follow checks pass at point of use;
- no valid execution lease, integration reservation, unfinished intent, or gate
  writer still owns the workspace;
- current branch/ref and HEAD match the expected terminal observation;
- the inventory contains no modified tracked file and no untracked or ignored
  item outside an explicitly creator-owned disposable inventory; and
- every policy-required integration/preservation condition has current evidence.

Unknown, stale, dirty, untracked, ignored, reparse, unowned, multiply owned,
partially published, or ambiguously integrated state refuses cleanup. The
adapter may use Git's ordinary non-force worktree removal after the checks and
then remove only empty creator-owned directories. Refusal is an observable safe
terminal outcome; it is not an error to bypass with recursive or forced cleanup.
