# Completion and workspace contract

## Status and authority

This file is the sole normative owner of current durable workspace-generation
topology, implemented local creation/inspection ownership, and planned
completion-gate identity/freshness, physical worktree
ownership receipts, integration reservation, Git partial-success observation,
contained regular-path/no-follow/reparse checks, and cleanup eligibility. The
pure `ato.workspace/v1` contract, typed application coordinator, durable
generation/operation/evidence lifecycle, and an exported Windows local Git
backend are implemented. The backend is not wired into the product runtime or
CLI; its cleanup route always refuses. No gate runner, Git integration/ref/push
operation, product cleanup effect, release, or platform-support claim exists
today.

The implemented Phase 2B Manual completion decision is deliberately outside
this planned gate owner. It consumes only a current verified local Manual
`turn_succeeded` receipt plus distinct authorization and fresh confirmation; it
does not evaluate ProjectPolicy, run or inspect a CompletionBackend gate, bind a
workspace/HEAD, or make the planned gate/physical-workspace rules in this file
current implementation.

The presence of the planned physical sections in this product contract does not
authorize this repository's development process to create a worktree. Adapter call shapes are
owned by the [adapter contracts](adapter-contracts.md), durable external effects
by the [reliability protocol](reliability-protocol.md), and permission by the
[authorization contract](authorization-contract.md).

## Implemented durable workspace foundation

The current schema allocates one workspace generation to exactly one frozen
Project resource/config/root identity, Task revision, dispatcher run/member/
membership revisions, execution revision/attempt/fence, trusted workspace-root
identity, adapter/contract version, creator operation, base reference, the
application-derived immutable ownership-binding digest, and optional cleaned
predecessor generation/revision. The workspace ID is
system-issued and stable; its positive generations are contiguous. A current
generation is unique for one Project/Task/run/execution owner tuple, and only a
cleaned predecessor may create generation `n+1` with the exact predecessor
revision. Similar paths, branches, or content never establish identity.

The complete durable generation status set is `allocated`, `reserved`,
`creating`, `ready`, `cleaning`, `recovery_required`, and `cleaned`. Operation
intents use `pending`, `executing`, `observed`, `verified`, `finalized`,
`ambiguous`, or `failed`. Each operation has its own exact idempotency key and
prepare/act/finalize authorization chain, ordered observation, optional verified
receipt, one finalization, and bounded transition events. Reserve begins with
an allocated generation; create requires reserved; cleanup requires ready;
recover requires `recovery_required` and an exact nonempty, existing,
same-workspace/generation, durably ambiguous, acyclic causal chain terminating
in the original effect-capable `reserve`, `create`, or `cleanup` operation.
The recover prepare and existing Act decision bind one revision `R`; every
ambiguous node in that chain must record `recovery_required` at exactly `R`.
An already resolved root from an older recovery episode is therefore invalid,
while nested ambiguous recover nodes remain valid only within the same `R`.
Inspect does not change the backend generation.

An effect-possible reserve/create/cleanup state is never blindly replayed after
restart or response loss. Known Fake state or the Windows adapter's matching
physical manifest plus authoritative Git/filesystem state may be observed and
finalized; unknown or conflicting state remains `recovery_required`/ambiguous
until an explicit recover operation proves a current postcondition. A verified refusal
or recovered absence can permit the same allocated generation to retry without
allocating a duplicate; a cleaned predecessor is the only route to the next
generation. These are current durable-library guarantees only. The exact-host
Windows adapter tests establish local development evidence for canonical path,
Git registration, HEAD, inventory, ownership, and path safety; they do not
establish a supported platform or any cleanup claim.

## Run and workspace topology

The durable identity/generation rules and the Windows adapter path layout in
this list are current library behavior. They are not evidence that the product
constructs a workspace or that another host is supported.

- A trusted configured `workspace_root` contains the exact adapter-owned path
  `ato-workspaces/w-<lowercase SHA-256(workspace_id)>-g<generation>`.
- The matching linked administration directory is exactly
  `<Project>/.git/worktrees/ato-<lowercase ownershipBindingSha256>`; the
  adapter constructs this registration itself and never invokes `git worktree
  add` or checkout.
- The complete target path and linked administration path are each limited to
  at most 240 UTF-16 code units. The generation suffix is the canonical positive
  decimal representation with no sign or leading zero. A longer path is refused
  before registration, target creation, or any Git mutation.
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
- The configured workspace root, its exact `ato-workspaces` child, and the exact
  generation target are resolved and checked as separate containment/identity
  boundaries. Run identity exists in `ownershipBindingSha256`; it is not a path
  level. Containment of one workspace confers no ownership of a sibling or
  ancestor.

## Worktree ownership receipt

The Windows adapter implements this section for one closed local topology: a
non-bare main worktree whose Git directory and common directory are the same
real contained `<Project>/.git`, with contained ordinary objects and linked
administration directories. The test Fake still provides contract-only
evidence. Other Git layouts and hosts remain unverified.

Creation is not complete until the durable generation/request, adapter receipt,
direct-exclusive physical manifest, and current Git/filesystem observation
agree. `ownershipBindingSha256` is derived from the immutable Project/Task/run/
member/execution/fence/workspace/generation/creator/base/adapter tuple and is
required in both request and receipt. The manifest binds that digest plus:

- workspace generation;
- canonical repository identity, including Project, Git common-directory, and
  object-directory identity hashes;
- canonical workspace path and trusted workspace-root identity;
- worktree registration identity from Git's authoritative worktree inventory;
- detached base/HEAD object ID and object format;
- adapter/contract versions; and
- target/admin identity hashes and registration identity.

The durable database stores only the existing receipt digest and closed
projection, not the raw manifest or path. The current request digest, reopened
canonical manifest, and current Git/filesystem observations must all match. A
directory, branch, marker file, Git registration, manifest, receipt, or database row by
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

This section remains planned; EP-03A allocates no integration-reservation row
or Git mutation authority.

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
[persistence contract](persistence-contract.md#transaction-and-repository-boundary). The
reservation authorizes no merge, push, release, deployment, or cleanup; each is
a separate policy and authorization decision. Loss or expiry stops further Git
mutation and routes observation/reconciliation.

## Git partial-success protocol

This section remains planned for integration/ref/remote operations. The current
Windows adapter implements only local linked-worktree creation and read-only
observation under the durable workspace protocol; it performs no integration
or remote step.

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

This section is implemented for create/inspect/recover by the Windows adapter
and remains mandatory for any future cleanup implementation. The pure port and
Fake themselves perform no filesystem mutation. Current host evidence is
limited to the exact recorded development environment and is not a support
claim.

Before every filesystem mutation or cleanup, the workspace adapter MUST:

1. obtain a canonical no-reparse device/inode/mode identity for each trusted
   root and hold each mutation namespace and its ancestors as a verified worker
   current directory for the relevant write window;
2. before acquiring either registration leaf, run a production capability
   attestation below both the exact `.git/worktrees` parent and exact
   `ato-workspaces` parent: a fresh ownership-bound empty child must pass a
   rename-and-restore positive control, then a nested worker holding that child
   as its current directory must make the same rename fail with exactly
   `EBUSY` or `EPERM`; verify same-device/identity facts and remove only that
   exact empty probe with non-recursive removal, otherwise fail closed;
3. reject empty/root targets, `.`/`..` traversal, drive or share changes,
   alternate data-stream syntax, device paths, and normalization ambiguity;
4. walk every existing path component without following symbolic links,
   junctions, mount points, or any other reparse point;
5. require expected directories to be directories and every control, ownership,
   manifest, index, receipt, and materialized content leaf to be a single-link
   regular file, never a hardlink, symbolic link, or special file; retain and
   revalidate the linked-admin index identity across Git status inspection;
6. atomically acquire each new directory, pass the parent-observed identity to
   the child current-directory guard, acquire every final regular file with
   exclusive create, verify the open descriptor, and compare identities and
   containment again after the operation; and
7. compare paths with the target filesystem's case and normalization rules,
   while retaining the exact opened identity rather than trusting a string
   prefix.

An unsupported no-follow or reparse inspection capability is a failed safety
precondition, not permission to fall back to recursive string-based deletion.
Git command output and repository content are untrusted input and cannot supply
the trusted root or ownership identity. Creation propagates the logical OR of
every parent/probe/downstream effect: once a namespace was acquired or a probe
mutated it, any later failure is ambiguous even when the intended linked-admin
and target leaves were not reached. A successful atomic directory acquisition
is an effect before its identity read: if that read cannot prove the newly
created identity, the adapter retains the effect fact and does not attempt to
remove the unproven object. A capability conflict detected before any probe
creation is a proved no-effect refusal.

## Cleanup refusal

The current application layer requires an exact ready generation, current
workspace grant, fresh cleanup confirmation, current owner/revisions/fence, and
verified port receipt. The exported Windows adapter nevertheless returns the
same non-retryable `policy_denied`/`cleanup_policy_unavailable` failure for
every valid cleanup request before any root, worker, or Git access. The
additional real worktree checks below remain mandatory before any cleanup
effect can be implemented or claimed.

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
