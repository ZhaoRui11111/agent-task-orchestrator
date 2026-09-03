# Domain contract

## Status and scope

This is the sole normative owner of Project/Task domain semantics. The
repository implements these rules as the pure in-memory TypeScript
[Domain Core](../../src/domain.ts). `MUST`, `MUST NOT`, and `SHOULD` below
constrain that implementation and its evidence. The implemented Phase 1
application service invokes this owner for Project registration/enablement and
Task/dependency mutations; the execution application owners invoke it for
accepted `ready`-to-`running` claims and the reliable Manual loop invokes it for
accepted waiting, continuation, verified interruption, and Manual completion
transitions. The injected Phase 3 application owner invokes the same
`completion_accepted` transition only after its policy/gate/integration checks.
The contract does not itself authorize those calls or imply a dispatcher,
product execution CLI, workspace, scheduler, adapter, gate, or executable
orchestration runtime.

This contract deliberately contains no SQLite, Git, Codex, CLI, MCP, scheduler,
or development-plan state. Storage is owned by the
[persistence contract](persistence-contract.md), operational concurrency by the
[reliability protocol](reliability-protocol.md), and pre-mutation permission by
the [authorization contract](authorization-contract.md).

## Project binding

- `registerProject` is the sole pure Domain command that adds a Project. It
  rejects duplicate IDs and initializes the Project enabled without inventing
  a filesystem, adapter, or authorization identity.
- `setProjectEnabled` is the sole pure Domain command that changes the enabled
  flag. The application owner supplies current registry revisions and
  authorization; Domain returns a complete trusted Project mutation.
- Every Task has exactly one `project_id`, referring to a registered Project.
- `project_id` is immutable after Task creation. Moving work between Projects
  requires a new Task that explicitly supersedes the old one.
- A disabled Project retains its Tasks but none of its Tasks is domain-eligible
  for a new claim.
- Project enablement and Task readiness are necessary conditions only. Neither
  is authorization for an external action.

## Task states

The complete Task state set is:

| State | Meaning |
| --- | --- |
| `idea` | Recorded work that has not been offered for execution. |
| `ready` | Offered for execution; dependency and Project conditions still determine eligibility. |
| `running` | Bound to the currently valid execution claim. |
| `waiting` | Unable to proceed until an explicit resume or retry command satisfies the recorded required action. |
| `completed` | Terminal; accepted completion evidence satisfied the dependency. |
| `cancelled` | Terminal; work was declined or a running execution was verified stopped. |

No other value is a Task state. In particular, execution phases such as a
cancellation request are not additional Task states.

## Exact transition relation

Only the following directed transitions are legal:

| From | To | Domain event and required input |
| --- | --- | --- |
| `idea` | `ready` | `mark_ready`; the Project is enabled and no dependency is cancelled. |
| `idea` | `cancelled` | `cancel`; the caller supplies a cancellation reason. |
| `ready` | `running` | `claim_accepted`; current domain eligibility plus the external authorization and reliability checks have succeeded. |
| `ready` | `waiting` | `dependency_cancelled`; a direct prerequisite became `cancelled`. |
| `ready` | `cancelled` | `cancel`; there is no valid active execution. |
| `running` | `waiting` | `execution_wait`; a waiting reason and complete waiting metadata are supplied. |
| `running` | `completed` | `completion_accepted`; a current accepted completion decision is supplied by the completion owner. |
| `running` | `cancelled` | `interruption_verified`; a prior cancellation request has been externally verified as stopped. |
| `waiting` | `running` | `resume_accepted` or `retry_accepted`; the corresponding [waiting continuation predicate](#waiting-resume-and-retry-eligibility) plus authorization and reliability checks have succeeded. |
| `waiting` | `cancelled` | `cancel`; any referenced active execution has been verified stopped or absent. |

Every other pair, including same-state updates presented as transitions, is
illegal. A cancellation request while `running` records an execution phase and
leaves the Task `running`; only `interruption_verified` changes it to
`cancelled`. A backend turn ending is not `completion_accepted`.

The Phase 1 `task.cancel` application command refuses any Task that has an
active execution attempt. The reliable Manual loop is the implemented verified
interruption owner for its own exact cancellation-request/inspection evidence;
the Phase 1 command cannot substitute for it or bypass the transition relation
above. If verified interruption arrives after the Task has already entered
`waiting`, the loop invokes the ordinary `cancel` event with an exact stopped
execution disposition bound to the verified receipt, Task revision and
execution ID; it does not reuse the running-only `interruption_verified` event
or leave the verified cancellation unfinalizable.

### Cancellation reason invariant

Every cancellation fact has one exact reason accepted by the exported pure
`isCanonicalCancellationReason` predicate. The value MUST be a well-formed
Unicode string in NFC, contain no code point in Unicode general category `Cc`
or `Cf`, and encode to 1 through 4,096 UTF-8 bytes inclusive. This single
predicate governs `cancel`, `interruption_verified`, and complete Domain
snapshot reconstruction. Invalid transition input returns `INVALID_INPUT`; an
invalid complete snapshot returns `INVALID_SNAPSHOT`. The Domain Core neither
normalizes nor rewrites a reason and defines no historical compatibility rule.

### Terminal immutability

`completed` and `cancelled` are terminal. Their state, Project binding, parent,
dependencies, body, and completion/cancellation facts MUST NOT be changed in
place. Correction requires a new Task with a `supersedes_task_id` link and
preserved audit history. Only `completed` satisfies a dependency; `cancelled`
never does. There is no reopen transition in this contract.

## Parent hierarchy

- `parent_id` is optional and identifies at most one parent Task.
- Parent and child MUST have the same `project_id`.
- A Task cannot parent itself, and following parent links MUST form an acyclic
  forest.
- Parent hierarchy expresses grouping only. It does not create a dependency,
  execution order, completion propagation, cancellation propagation, or
  authorization inheritance.
- A parent change is allowed only while the child is `idea`, `ready`, or
  `waiting`. The complete proposed change, including removal of the old edge,
  insertion of the new edge, and cycle check, is one atomic domain mutation.

## Dependency DAG

An edge `task_id -> depends_on_task_id` means the first Task requires the second
Task to be `completed`.

- Dependency edges are distinct from parent links and may cross Project
  boundaries.
- Self-edges and duplicate edges are rejected.
- The complete dependency graph MUST remain acyclic. Adding an edge is rejected
  if the prerequisite already reaches the dependent by zero or more dependency
  edges. The check and insertion are one atomic mutation against the same
  revision.
- Dependency changes are allowed only while the dependent is `idea`, `ready`,
  or `waiting`. A running or terminal Task's dependency set is immutable.
- Removing or replacing a dependency never changes another Task automatically.
- When a direct prerequisite becomes `cancelled`, a `ready` dependent moves to
  `waiting` with reason `dependency_cancelled` in the same logical command. An
  `idea` dependent remains `idea` but cannot be marked ready until the cancelled
  edge is removed or replaced. Cancellation does not otherwise propagate.

## Domain eligibility

A Task is domain-eligible if and only if all of these facts are true at the same
read revision:

1. its state is `ready`;
2. its bound Project is registered and enabled; and
3. every direct dependency is `completed`.

Parent state has no effect. Domain eligibility does not assert that resources,
authorization, policy, adapter compatibility, or a reliable claim is available.
The current execution application owner, and any later dispatcher that invokes
it, MUST re-evaluate these facts in the claim transaction; a prior query is
advisory.

## Waiting taxonomy

`waiting_reason` is exactly one of the following values:

| Reason | Required-action meaning |
| --- | --- |
| `human_input` | A person must supply a decision or missing content. |
| `authorization_required` | A named action lacks a current grant or external permission. |
| `execution_failed` | The execution backend failed and retry or replacement must be chosen. |
| `policy_gate_failed` | A required policy or completion gate did not pass. |
| `resource_exhausted` | A bounded compute, process, or service resource is unavailable. |
| `rate_limited` | A backend requested delayed retry. |
| `disk_full` | Required durable storage cannot be completed. |
| `workspace_conflict` | Workspace or repository state cannot be safely reconciled. |
| `dependency_cancelled` | A direct prerequisite is terminal `cancelled`. |
| `stale_lease` | An expired claim requires reconciliation before takeover. |
| `ambiguous_external_state` | Observation cannot prove whether an external effect occurred. |
| `backend_incompatible` | No configured adapter contract version can perform the operation. |

Every entry into `waiting` records this complete metadata envelope:

- non-null `waiting_reason`, `phase`, `required_action`, and redacted
  `last_error_code`;
- a redacted `last_error_summary`, which may be null when no error occurred;
- `retryable`, `retry_count`, and nullable `retry_after`;
- nullable `execution_id`, `workspace_revision`, and `backend_thread_id`, each
  populated when that identity exists; and
- the Task revision at which the waiting facts were accepted.

`waiting` is never ordinary dispatcher-eligible. Only an explicit resume,
retry, or cancel command can leave it. In the implemented Manual loop, same-turn
resume preserves the exact execution/thread, while retry or expired safe
continuation creates the next attempt/fence bound to its verified predecessor.
The reliability owner governs those identities; this contract governs the
resulting Task transition.

Any successful body, parent, dependency, or waiting-metadata mutation that
leaves the Task in `waiting` MUST revalidate the complete waiting envelope and
set `waiting_task_revision` to the post-mutation Task revision in the same
atomic command. This reaccepts the still-unresolved required action at the new
revision; it is not evidence that the action has been satisfied. If the
envelope cannot be revalidated, the mutation is rejected.

## Waiting resume and retry eligibility

Waiting continuation is distinct from ready-only domain eligibility. It is
evaluated only for an explicit `resume` or `retry` command and never by an
ordinary dispatcher sweep.

A waiting Task satisfies the common continuation predicate if and only if all
of these facts hold at one read revision:

1. state is `waiting` and `waiting_task_revision` equals the current Task
   revision supplied as the command's expected revision;
2. the bound Project is registered and enabled;
3. every direct dependency is `completed`;
4. current, owner-verified evidence bound to that Task revision satisfies the
   exact recorded `required_action`; and
5. every non-null recorded execution, workspace, and backend-thread identity
   equals the continuation target supplied by the command.

`resume` is domain-resume-eligible if and only if the common predicate holds,
`execution_id` is non-null, and the command targets that same execution. Non-null
workspace and backend-thread identities must therefore be preserved; replacing
one is not resume.

`retry` is domain-retry-eligible if and only if the common predicate holds,
`retryable` is true, and `retry_after` is null or no later than the command's
trusted evaluation time. Whether retry reuses an operation/execution, consumes
remaining budget, or requires a replacement is then decided by the reliability
and policy owners; their positive results do not alter this domain predicate.

Failure of either predicate leaves the Task `waiting` and records no transition.
A stale required-action receipt, disabled Project, incomplete dependency,
identity mismatch, early retry, or ordinary ready-only eligibility result cannot
be treated as continuation eligibility.

## Task revision

- A Task is created at revision `1`.
- Every successful mutation of its state, body, waiting metadata, parent,
  dependency set, or supersession metadata increments the revision by exactly
  one in the same atomic command.
- A rejected or no-op command does not increment the revision.
- Revisions are positive, monotonically increasing integers and are never
  reused, decremented, or copied to another Task.
- Audit append operations do not independently increment a Task revision; they
  record the before and after revisions of the domain mutation.

The use of this revision as a compare-and-swap precondition is owned by the
[reliability protocol](reliability-protocol.md#revision-cas).
