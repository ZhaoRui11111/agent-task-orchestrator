# Standing artifact prune validation evidence

This record retains the implementation and environment evidence for the
repository-only standing prune authorization and Node test artifact-baseline
gate. Exact material identity, audit dispositions, terminal commit identity,
coordinator prune, gate, integration, and push receipts remain owned by the
ExecPlan and coordinator state rather than being predicted here.

## Environment and scope

- Repository/task worktree:
  `D:\agent-task-orchestrator\.worktrees\standing-artifact-prune`
- Base: `a2a898e13b5231a1dd061ad1a6bb77df146383ce`
- Host: Windows `10.0.22631` x64
- Node.js: `24.19.0`
- pnpm: `11.19.0`
- TypeScript: `5.9.3`
- Network repair, dependency update, secret access, external repository
  mutation, global skill mutation, and coordinator cleanup were not used.

## Historical implementation results used to plan repairs

| Surface | Command or procedure | Result |
| --- | --- | --- |
| Artifact hygiene, authorization, package configuration, and creator cleanup | `node --test test/artifact-hygiene.test.mjs test/artifact-policy.test.mjs test/configuration.test.mjs test/repo-utils.test.mjs` | The 21-test repaired route passed before A2. A2 then found one same-family inherited-context gap; its fail-closed regression and all affected state-bound reruns are recorded in the ExecPlan rather than predicted here. |
| Complete Node suite through the repaired wrapper | `pnpm test` with the bundled Node/pnpm paths and offline environment | Passed before A2: 110 tests. Native `node --test` recursive discovery included the runner module without recursively launching another suite; the wrapper reported `artifactHygiene=passed`, `baselineEntries=0`, `terminalEntries=0`. |
| Targeted persistence suite through the new wrapper | `pnpm test:persistence` under the same offline environment | Passed before A2: 56 tests; wrapper reported the same 0-to-0 baseline. |

The final repaired material state is subjected to the documentation,
whitespace, full offline, artifact-absence, and independent A2 checks recorded
in the ExecPlan. The older full-gate figures below remain historical evidence,
not a substitute for those state-bound results.

The authorization review found one normative workflow owner. The grant is
repository-local, pathless, frozen-root/head/blob bound, revocable, and covers
safe nonempty scratch plus anchored no-follow unlink of an inventoried in-root
alias.
Pre-delete refusal and mid-prune partial contraction are distinct; a missing
receipt never claims rollback. Coordinator cleanup, alias-target traversal,
caller-selected deletion, the global skill, and `D:\quant` remain excluded.
The test wrapper has the deliberately different behavior of rejecting a
reparse node that is statically present during a path-based snapshot and
deleting nothing. Its result assumes the test process and surviving mutators
are quiescent; it is not handle-bound against concurrent Windows path
replacement, is not a security boundary, and is not a prune receipt.

Independent A1 confirmed two MEDIUM findings. `F-A1-001` removed the unsupported
handle-bound/no-follow race claim from the wrapper while leaving coordinator
prune unchanged. `F-A1-002` removed the fixed top-level selector: an empty
wrapper selector now delegates to native recursive `node --test` discovery,
and the runner suppresses its executable entry only when Node sets
`NODE_TEST_CONTEXT` and the wrapper-owned child marker is also present. A
direct runner with an unowned inherited context now fails nonzero rather than
silently reporting zero tests.
Both repairs require the fresh state-bound validation and independent A2
closure recorded in the ExecPlan.

## Superseded or invalid attempts

- The first targeted command did not execute because the ambient shell lacked
  `node` on `PATH`; the bundled `24.19.0` executable was then used explicitly.
- A direct fallback `pnpm test` attempted dependency/bootstrap registry access
  before tests. The sandbox denied it. No capability evidence was claimed; a
  verified reparse-free 391-entry store from the pushed EP-01B worktree was
  copied into this task's ignored `.pnpm-store`, followed by an explicit frozen
  offline install with one reused package and zero downloads.
- `pnpm --offline test` was an invalid pnpm invocation, and the first valid
  script invocation lacked the bundled Node directory on the child `PATH`.
  Neither reached project tests.
- The first wrapper integration run discovered `scripts/test-runner.mjs` as a
  test and recursively invoked it, producing 108 passes and 1 failure while
  leaving `.task-artifacts` absent. A temporary `test/*.test.mjs` restriction
  removed that recursion but incorrectly narrowed native discovery and was
  rejected by A1. An intermediate `node --test test` directory selector was
  also rejected by Node on Windows. The final repair keeps native discovery and
  suppresses the runner entry only when that file is loaded as a Node test.
- The first nested-runner unit attempt inherited `NODE_TEST_CONTEXT`, so Node
  skipped the recursive fixtures. The wrapper now removes only that test-runner
  marker for its independent child process. Those pre-A2 targeted, nested
  discovery, complete wrapper, and targeted persistence routes passed; the
  final fail-closed repair and reruns are recorded in the ExecPlan.

The pre-A1 full offline run passed lint, strict typecheck/build, the then-current
107-test suite, documentation checks, dependency-shape checks, package smoke,
real Windows SQLite with no surviving generation, and the explicitly blocked
Codex boundary. It is retained only as historical environment evidence because
the A1 repair changed material state.

These attempts are retained because they explain the offline execution route
and the discovery/diagnostic behavior. None is represented as a passed gate.
