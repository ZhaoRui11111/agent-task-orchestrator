# EP-01A validation evidence

This log records observed candidate results. Terminal state bindings live in the EP-01A ExecPlan, and coordinator gate receipts bind only the final task commit.

## Environment

- Date: 2026-08-28
- Host: Windows kernel `10.0.22631`, `x64`, NTFS task worktree
- Node.js: bundled `v24.19.0`
- Node executable:
  `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- No network access succeeded; secrets, external accounts, external
  repositories, and `D:\quant` were not used

## Current targeted observations

| Surface | Command from the canonical task worktree | Binary criterion | Observed result |
| --- | --- | --- | --- |
| Domain unit | `<bundled-node> --test test/domain-unit.test.mjs` | All exact transition, revision, terminal, hierarchy, dependency, eligibility, waiting, and malformed-input assertions pass | `passed`; exit `0`; 13/13 tests |
| Domain property/state machine | `<bundled-node> --test test/domain-property-state-machine.test.mjs` | Four fixed seeds, 240 commands per history, repeated deterministically, preserve every checked invariant and exercise accepted plus rejected commands | `passed`; exit `0`; seed test passed |
| Domain architecture | `<bundled-node> --test test/domain-architecture.test.mjs` | Exact public exports, zero infrastructure/I/O/ambient dependency, deterministic frozen results, caller preservation, and structured invalid-input behavior pass | `passed`; exit `0`; 6/6 tests |
| Complete Node tests | `<bundled-node> --test` | Existing and new Node tests all pass, including real Windows SQLite and Codex blocked/no-support boundaries | `passed`; exit `0`; 38/38 tests |
| Lint/inventory | `<bundled-node> scripts/lint.mjs` | Repository lint, tracked inventory, and diff checks pass | `passed`; exit `0`; 85 files and 3 production source files |
| Documentation | `<bundled-node> scripts/docs-check.mjs` | Every repository-relative Markdown link resolves and forbidden capability wording is absent | `passed`; exit `0`; 52 Markdown files, 228 links, 0 forbidden findings |
| Dependency shape | `<bundled-node> scripts/dependency-security.mjs` | Zero production dependencies and exactly `typescript@5.9.3` as the development dependency | `passed`; exit `0`; online audit remains a separately authorized network gate |
| SQLite boundary | `<bundled-node> scripts/sqlite-feasibility.mjs --json` | The complete real Windows feasibility matrix passes with no surviving generation member | `passed`; exit `0`; `survivingGenerationMembers=0` |
| Codex boundary | `<bundled-node> scripts/codex-contract.mjs --json` | Blocked/no-support evidence remains fail closed | `passed`; exit `0`; external E2E `not_run`, support claim `false` |
| Whitespace | `git diff --check` | Exit `0` with no whitespace error | `passed`; exit `0`; only normal working-copy line-ending notices were emitted |

The fixed property seeds are `0x1a2b3c4d`, `0x5eedc0de`, `0x7f4a7c15`, and `0xc001d00d`. A failure reports its seed, first failing step, and exact command.

## A1 and A2 repair observations

Fresh independent A1 bound `git-sha1:651cfad60f3fe85602502bc36ac98b178634b398`
and reported `F-A1-01`, `F-A1-02`, and `F-A1-03`, all `MEDIUM`,
confirmed, in scope, and requiring A2. The repair candidate now:

- validates parent/supersession references and parent/dependency cycles for
  decision snapshots while still returning explicit reasons for the
  contract-owned missing Project or direct-dependency facts;
- rejects accessor-backed records and arrays and normalizes any remaining
  exceptional public-input access to a static structured failure; and
- exhausts every non-authoritative state/target/event tuple and runs fixed-seed
  histories against independent command, transition, graph, terminal,
  revision, event, and direct-cancellation oracles with a replayable first-fail
  prefix.

Fresh independent A2 attempt 1 bound
`git-sha1:b3427caf0175457914a6c9983a739196dc3cfcb0`. Passing targeted suites did
not close the A1 findings: focused probes confirmed `F-A2-01`, `F-A2-02`, and
`F-A2-03`, all `MEDIUM`, in scope, and requiring the same A2 to repeat. The
probes showed that unrelated Tasks could still carry missing Project or
dependency references during a positive decision; noncanonical arrays could
dispatch caller-supplied or inherited methods and mutate caller input; and the
property suite did not compare exact event types/details or complete
direct-cancellation waiting envelopes.

The second repair candidate now:

- limits decision-mode missing Project/direct-dependency facts to the queried
  Task and rejects the same missing facts on every unrelated Task;
- snapshots exact record data through descriptors, accepts only dense arrays
  with the canonical Array prototype and no extra string, symbol,
  non-enumerable, accessor, or method properties, and traverses copied values
  without dispatching caller `entries`, `every`, or iterator behavior; and
- uses hard-coded state/event inventories plus an independent per-operation
  event oracle that compares exact type, Task, before/after revision, details,
  ordering, cancellation facts, and complete direct-dependent waiting
  envelopes.

After this second repair, domain unit `13/13`, property/state-machine `1/1`,
domain architecture `6/6`, complete Node `38/38`, lint, documentation,
dependency shape, SQLite, Codex blocked-boundary, and `git diff --check`
observations all exited `0`. A read-only TypeScript 5.6.3/ES2023 compiler-API
diagnostic also reported zero diagnostics. These remain repair-candidate
observations; A1 and A2 residuals remain open until fresh independent A2 binds
the final repaired material state.

Fresh independent A2 attempt 2 then bound
`git-sha1:2c73652b0e1fbd149117c39f8412eca5acf05786`. It independently closed
the structural decision and canonical-array residuals, but left `F-A1-03`
open through `F-A2-04`: the standalone `task.waiting_changed` oracle derived
its expected reason/action from the implementation-produced Task and did not
compare the complete outcome with the command. The third repair derives those
event details directly from `command.waiting` and independently requires the
returned envelope to equal that command envelope plus the exact incremented
`waitingTaskRevision`. Fresh property and A2 evidence remain required for this
latest candidate.

## Non-passing environment attempt

`pnpm typecheck` was invoked before a worktree-local compiler installation
existed. The local wrapper attempted dependency repair and a registry tarball
request, which the sandbox denied with `EACCES`; no TypeScript package was
installed and no typecheck result was produced. Later direct `pnpm <script>`
attempts exposed the same automatic repair behavior and were terminated during
their denied retries. They left only ignored pnpm install/store scaffolding,
not a compiler or tracked repository change. These are environment failures,
not passing validation or dependency-audit results. The final gates must use
the explicit offline frozen-install route or remain blocked.

The default pnpm store path was subsequently found to resolve to the
integration-root store rather than an EP-01A-owned store. That path is outside
this task's allowed dependency-bootstrap resources; it was not inspected or
used after discovery. All future dependency commands must specify the
EP-01A-worktree-local store explicitly.

A diagnostic-only compile with the locally installed VS Code TypeScript 5.6.3
engine, temporarily lowered to ES2023 and configured without emit, reported
zero strict diagnostics. That observation is useful only for implementation
debugging: it does not satisfy, substitute for, or weaken the frozen
TypeScript 5.9.3 / ES2024 typecheck or build criteria.

## Pending terminal evidence

Strict TypeScript 5.9.3 typecheck/build, package smoke, full offline, fresh A2,
final repeated validation, staged inventory, terminal
commit, and exact-head coordinator receipts remain pending until observed
against their required material states.
