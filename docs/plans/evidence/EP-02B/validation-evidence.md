# EP-02B validation evidence

Status: the implementation diff is a stable pre-A1 candidate and the complete
offline toolchain passes. Fresh independent A1/A2 disposition, result and
terminal commits, standing-authorized artifact prune, exact-head coordinator
receipts, integration, and push are still pending. This record makes no
integration, release, deployment, platform-support, or successor-plan claim.

## Bound predecessor and plan

- The task began from exact pushed predecessor
  `d8afb79090906c263c7b91eca5234e613e066d04`; task HEAD, `master`, and
  `origin/master` matched that identity at activation.
- After preserving four superseded review attempts and their exact contract
  revisions, the schema-v3 EP-02B ExecPlan has fresh independent A0 approval
  digest
  `0DDE3D4D2C6E7F006D3DDF0D0E2B239DF4D91F9F5E63E6EEEA2AF63EE076BFA8`
  and is active in the coordinator-owned `task/ep-02b` worktree. Current trace
  reports no error, warning, scope escape, overlap, or pre-existing dirty path.
- EP-02C has not been created or activated.

## Current implemented boundary

- Additive migration `0006-phase2-manual-execution.sql` has canonical LF
  SHA-256
  `5D072BF264E579F011D85FF017EF595B93D9CA6FD18400830AC1E0A1ACCFFD87`.
  It allocates vocabulary-6 lineage and bounded Manual-loop operation,
  observation, receipt, finalization, journal, terminal and completion records
  while creating no epoch, grant, effect or completion fact during migration.
- Vocabulary 4 upgrades separately to 5 and vocabulary 5 separately to 6.
  Bootstrap, migration and renewal do not create newer execution authority.
- The package implements the closed corrected `ato.execution/v1` contract kit,
  one durable local no-workspace Manual backend/control, and an injected
  reliable loop for start, independent inspect, Manual outcome reporting,
  resume, retry, cancellation, verified interruption, reconcile-first expired
  execution, and separately authorized/confirmed Manual completion. The Fake
  backend remains test-only and unpacked.
- `ato.api/v1` remains the Phase 1 CLI. No dispatcher, scheduler, MCP,
  Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend/gate, release,
  deployment, or platform-support capability is implemented or claimed.

## Stable-candidate validation

- Targeted Manual/port/scaffold regression passed 13 tests; the two corrected
  migration-EOL and package-status assertions passed 10 tests. Both had zero
  failure, skip, or todo.
- The complete Node suite passed 365/365 with zero failure, cancellation, skip,
  or todo. It includes every durable protocol checkpoint, response-loss and
  restart path, ambiguity handling, competing writer, old-fence rejection,
  completion separation, schema-prefix migration, backup/restore/recovery,
  doctor, redaction, CLI compatibility, and Windows SQLite route.
- The complete `pnpm verify:offline` route exited zero on the stable candidate:
  lint passed 168 files and 25 source files; strict typecheck and build emitted
  no diagnostics; the same 365 tests passed; docs checked 77 Markdown files,
  248 exact local links, 21 fragments, and zero forbidden artifact; dependency
  shape passed with zero production dependencies and only TypeScript 5.9.3;
  package smoke passed; the real Windows SQLite matrix passed with zero
  surviving generation member; and the Codex boundary remained explicitly
  blocked with `externalE2E=not_run` and `supportClaim=false`.
- The upgraded offline packed-install smoke passed with 105 exact packed files,
  declaration-consumer typecheck, two explicit capability upgrades, installed
  Manual start/outcome, store restart and exact replay, separate completion
  acceptance, schema-v6 backup verification, source/build/installed CLI parity,
  uninstall, and creator-owned artifact removal. The Fake backend was absent.
- `git diff --check` passed. Schema-v3 trace bound the pre-evidence-update
  candidate as `git-sha1:b6ab4af71ba2d47fc6b093a59278558949e8f8ad`
  with every one of 54 then-current tracked/untracked paths task-owned and
  `outside_scope=[]`. Exact material identity will be recomputed after this
  evidence record and bound to the result commit for A1.
- The first direct `pnpm test` invocation lacked the frozen Node directory on
  PATH, and the corrected sandboxed invocation was denied write access to the
  registered fixture root. Neither is validation evidence. The same command
  was immediately rerun with the frozen Node/pnpm runtime and permission only
  for the task-owned artifact root, producing the 365/365 passing result above.
- One diagnostic generation retained from the earlier deterministic assertion
  failure remains inside the frozen `.task-artifacts` policy root. Passing
  tests preserve that baseline by design. It will be removed only by the
  coordinator's standing-authorized pathless `prune-artifacts` transition after
  the result commit and before any passed exact-head gate receipt.
- The frozen local dependency seed was copied without network access from the
  same repository's EP-02A worktree after read-only evidence found zero reparse
  entries. It is ignored local validation material, not committed evidence.

The production dependency audit was not run because it requires a separate
network authorization and is not part of EP-02B's frozen offline criteria; the
dependency-shape gate proves the package still has zero production dependency.
All results above remain pre-result-commit observations until fresh A1 and the
exact-head coordinator gates bind their final commit identities.
