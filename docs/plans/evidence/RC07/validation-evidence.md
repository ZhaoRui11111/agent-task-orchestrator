# RC07 validation evidence

Status: implementation-complete and complete-route-passed candidate awaiting fresh independent stable-state A1.

Material base: `be07ede606c330ac398ec7f65fe6a58b503dee9e`

Current approval contract: 17,990 canonical bytes, SHA-256 `7DA4FDACC2341CAC3314970EEB26A826BE4C5841386776AA611DC702C82B2819`

Recorded through: `2026-09-01 12:24:19+08:00`

## Approval, scope and artifact boundary

- RC06 resolves uniquely at its pushed terminal commit, and the RC06-to-RC07 chain check binds RC07 to that exact predecessor.
- Fresh independent A0 attempt 3 reproduced the current approval identity, ran exactly one read-only trace, found no issue and returned `ready_for_activation`; parent disposition is complete. Attempts 1 and 2 remain preserved as reopened and stale history.
- The candidate changes 37 implementation/contract/test files plus this active plan and evidence file. Every path is declared task scope; completed plans, prior evidence and prior changelog facts have no diff.
- The registered ignored `.task-artifacts` root contains 16 retained failed decoder-test generations: 192 directories and 16 regular SQLite files totaling 12,328,960 bytes, with zero reparse node and zero tracked overlap. Successful test wrappers preserve the complete 208-entry baseline exactly. No manual or pre-commit deletion is claimed; root absence belongs only to the authorized post-result-commit coordinator pathless prune.
- Retained `.pnpm-store`, `node_modules` and `dist` are validation/toolchain material and are not staged, cleaned or deleted. The task-local store contains 133 copied regular cache files and zero reparse member.

## Implemented invariants

- One authorization owner exposes four cumulative semantic action sets containing exactly 19 base, 23 claim, 29 Manual and 30 dispatcher actions at vocabulary versions 1, 2, 3 and 4.
- Bootstrap writes only version 1, three separately confirmed upgrades advance exactly one version each, renewal retains its current version, and current decoding refuses every value outside 1 through 4 without migration or repair.
- `ApplicationState` stores direct epochs and grants without the synthetic `authorizationGrantEpochLinks` projection. The decoder still validates exact durable grant-to-epoch lineage at the SQL boundary.
- One exported `applicationStateProjection` enumerates every non-lifecycle state family exactly once. `applicationStateSha256` is its sole digest owner, `APPLICATION_STATE_DIGEST_VERSION` is 1, and upgrade, renewal, backup and restore authorization consume that direct digest.
- The sole fresh baseline accepts only bootstrap version 1, epoch versions 1 through 4 and digest version 1. Its canonical LF SHA-256 is `518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA` in the registry, contract and tests.
- The thirty actions, scopes, confirmations, finite lifetimes, revocation, delegation, policy, append-only provenance, public majors, public errors, Task/Project behavior, execution fences, reliable Manual loop, dispatcher and backup-family formats are unchanged.

## Successful validation

| Command or route | Acceptance criterion | Actual result |
| --- | --- | --- |
| Pinned `pnpm typecheck` | Strict TypeScript exits 0 | Passed with TypeScript 5.9.3 |
| Pinned `pnpm lint` | Repository lint exits 0 | Passed: 222 files and 43 source files before this evidence file was added |
| Focused authorization/Application/persistence/schema/architecture group | New vocabulary, digest, schema-refusal and ownership checks pass | Passed: 102/102, zero fail/cancel/skip/todo; artifact baseline 208-to-208 |
| `pnpm docs:check` | Exact-case links/fragments and forbidden claims pass | Passed before this evidence file was added: 110 Markdown files, 252 local links, 22 fragments, forbidden=0 |
| `pnpm test:persistence` | Complete persistence family passes | Passed: 104/104, zero failure; artifact baseline 208-to-208 |
| First complete pinned `pnpm verify:offline` with the required local store | Every local non-network gate passes | Passed: lint/typecheck/build; 432/432 tests with zero fail/cancel/skip/todo and artifact baseline 208-to-208; docs 110/252/22/0; zero production dependencies; 172-file package smoke; SQLite 3.53.3 with zero surviving generation member; Codex boundary passed with blocked evidence, external E2E not run and support claim false |
| Post-evidence complete pinned `pnpm verify:offline` | The exact candidate including this evidence file passes the same full route | The authoritative exact material-bound result is recorded in V8 of the active/completed plan; this file intentionally contains no self-referential material hash |
| `git diff --check` | No whitespace error | Passed before evidence creation and required again at terminal inventory |
| Live retired-symbol scan | No removed live action-set, synthetic-link, partition, wrapper or old current-version semantics | Passed across live source, current contracts and active tests; immutable completed history remains excluded and unchanged |

## Classified unsuccessful attempts

- The first focused decoder-corruption candidate passed 97 of 102 tests but five cases retained raw SQLite statements/triggers in the parent process long enough for Windows fixture cleanup to fail after the intended refusal assertions. The tests were corrected to perform trigger removal, raw corruption, read-only decoder refusal and raw-value readback inside isolated child processes; the immediate complete focused rerun passed 102/102. Classification: deterministic test-harness failure followed by an in-scope test repair.
- Earlier isolated decoder-test iterations retained their registered diagnostic generations. They remain explicit evidence and were not manually removed, rewritten or adopted.
- The first complete `verify:offline` attempt passed lint, typecheck, build, 432/432 tests, docs and dependency policy, then stopped before packing because the linked worktree lacked its required local `.pnpm-store`. Exactly 133 verified regular cache files were copied from the retained RC06 task store, with zero reparse member and no deletion or network access. The complete route was then rerun from the beginning and passed. Classification: environment/precondition failure.

## Pending terminal evidence

- Fresh independent stable-state A1 and parent disposition.
- Any fresh A2 required by a confirmed substantive A1 finding.
- Final trace/inventory, one result commit, current-head pathless artifact prune, fourteen exact-head gates, ready, FF-only integration and ordinary push.
