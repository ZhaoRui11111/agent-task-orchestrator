# Codex terminal integrity repair evidence

The unique `repair-codex-terminal-integrity` ExecPlan owns current binary
validation results, observation times, independent reports and exact Git
material-state bindings. This record describes the reproducible procedures,
earlier failures and evidence boundaries. It is not a substitute for those
results or for the subsequent coordinator commit/prune/gate/integration/push
receipts.

The reviewed base is `6a4dfa041e24520af54c0b822f0a1e84364c27e3`. All candidate
commands run in the coordinator-owned
`D:\agent-task-orchestrator\.worktrees\repair-codex-terminal-integrity`
worktree. The runner is the parent maintainer agent on 2026-09-08, using Windows,
Node `24.19.0`, pnpm `11.19.0`, TypeScript `5.9.3`, pinned Codex SDK `0.153.2`
and Git `2.53.0.windows.1`. Dependencies were installed from the existing local
cache with zero downloads:

```text
pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir=.pnpm-store --registry=https://registry.npmjs.org/
```

## Behavioral regression and acceptance

On the unmodified production backend, the ten new regression cases failed:
the callback published a terminal before the driver could reject a later
event. The reliable loop and product could then inspect that terminal as
success. The pre-repair command exited 1 with 0 passed and 10 failed:

```text
pnpm test --test-name-pattern='publishes .* complete resume|duplicate terminal callbacks|remains ambiguous through SQLite|cannot promote contradictory' test/codex-execution-backend.test.mjs test/codex-execution-loop.test.mjs test/codex-product-application.test.mjs
```

The following assertions define V1's binary acceptance. All are exercised
through the three existing test files; the complete offline route also retains
the broader SDK, journal, authorization, fencing, workspace and public-boundary
suites.

| Case | Required observation |
| --- | --- |
| Valid completed or failed resume stream held open after its terminal | Journal remains active, terminal signal and terminal operation are absent until the driver accepts the complete stream. |
| Duplicate direct terminal callbacks | Bounded ambiguity and no terminal publication. |
| Duplicate completed, completed then failed, or failed then completed in the pinned driver | SQLite journal has no terminal operation; reliable execution remains ambiguous and Task waits. |
| Changed thread, late error event, or stream exception after a terminal | The same absence/ambiguity holds through independent inspection and SQLite reopen. |
| Restart of each invalid stream | No second SDK call and no execution completion record. |
| Contradictory terminal stream through the authorized product composition | Task waits, the core intent retains ambiguity, no terminal operation exists, and exact product replay after SQLite reopen performs no further credential resolution or SDK call. The product lifecycle may report the finalized intent; it is not terminal success. |
| Valid completed/failed streams and persisted-thread continuation | Existing bounded terminal receipts, waiting failure and same-thread successor semantics remain valid; turn success alone does not complete the Task. |
| Existing crash stages from executing through finalized | A committed terminal recovers by durable inspection without duplicate SDK effect; an absent pre-effect turn permits only the established first-call path. |

The targeted acceptance command is:

```text
pnpm test test/codex-execution-backend.test.mjs test/codex-execution-loop.test.mjs test/codex-product-application.test.mjs
```

## Fixture environment recovery

The first expanded run passed the new backend and SQLite cases but failed
several existing fixture initializations. A temporary read-only module-loader
diagnostic exposed the underlying SQLite error:
`CHECK constraint failed: length(project_root_key) BETWEEN 1 AND 128`.
That diagnostic changed no repository source. In this worktree a 40-character
fixture prefix gives a 141-character Project path; a 12-character prefix gives
113. The helper adjustment changes only that diagnostic prefix. The random
suffix, fixed `.task-artifacts` root, immediate identity binding, creator
receipts and cleanup owner are unchanged. No production constraint is relaxed.

The first complete test route then reached 741 tests: 696 passed and 45 failed
in shared Windows Git fixture setup. Long generated paths hit the existing
`unsafe_tree_path` guard. The shared Git fixture now also caps only the directory
prefix at 12 characters; its complete descriptive label still contributes to
the ownership binding. Unicode/space roots, file content, random suffix and
cleanup are unchanged. In this worktree the resulting target directory is 211
characters, `nested/data.bin` is 227 and the ownership manifest path is 240,
within the existing 240-character bound. Explicit excessive-path negatives
continue to construct their own exact-length paths. This failure is preserved
as an environment attempt, not a passing full route.

Failed initialization diagnostics remain in the task-frozen `.task-artifacts`
root. Before the primary full run, 35 creator-generated fixture directories
were retained; after that failed run the inventory contained 52 top-level
fixtures and 1,407 entries. The subsequent Codex target suite passed all 68
tests with that same baseline inventory. These retained fixtures are not
passing validation evidence and are not tracked.
V4 records their inventory; the coordinator must explicitly prune the frozen
root after the result commit, and obtain an exact-head receipt before passed
Git gates or readiness. No worktree cleanup is authorized by this task.

## Full route and contract review

V3 requires the unchanged public entry point to exit 0:

```text
pnpm verify:offline
```

This runs lint, strict types, build, all Node tests, documentation links and
fragments, dependency shape, packed-consumer smoke, SQLite feasibility, and
Codex/scheduler boundary probes. V2 also manually compares the changed current
documents with `execution-port.ts`, the product input-reference constructor,
the backend's input/lineage verifier, the product workspace factory and the
lint Node-import allowlist. The terminal protocol remains owned by the
reliability contract, exact reference shapes by the adapter contract, storage
by persistence, and disclosure by privacy policy. Historical evidence is
unchanged. V4 additionally checks ExecPlan schema/scope, `git diff --check`,
`git diff --cached --check`, declared staged paths and retained scratch inventory.

Raw diagnostic and validation logs are retained outside the repository in the
calling thread's `full-inspection` artifact directory. Relevant names are
`repair-regression-confirmed-before.log`, `repair-targeted.log`,
`repair-targeted-final.log`, `repair-verify-offline.log` and the complete current
`repair-plan-trace.json`. Actual exits, counts and current state are recorded in
the ExecPlan instead of duplicating mutable results here.
The superseded full-run log is
`repair-verify-offline-before-workspace-prefix.log`; the read-only retained
inventory is `repair-retained-artifact-inventory.json`.

Online dependency audit, real Codex account/credential E2E, administrator-managed
effective-configuration attestation, hosted CI and platform support validation
are not run. The task uses injected fake SDK streams and disposable local
fixtures; `externalE2E=not_run`, `administratorPolicyAttestation=not_run` and
`supportClaim=false` remain required. No new scheduler, Phase 3 CLI route,
schema migration or retroactive historical terminal repair is claimed.
