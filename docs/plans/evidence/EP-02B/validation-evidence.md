# EP-02B validation evidence

Status: the implementation diff includes the resolutions for all nine fresh
independent A1 findings, all three residuals found by A2 attempt 1, the package
route's schema compatibility defect, and the split-grant decoder residual found
by A2 attempt 2. The post-repair complete offline route passes; another fresh
independent A2 is pending. The terminal repair commit, standing-authorized
artifact prune, exact-head coordinator receipts, integration, and push are also
pending. This record makes no integration, release, deployment,
platform-support, or successor-plan claim.

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
  `3D27258B3C9FB4B11B56B989CA2F341CB4DC68C96168D864D3763D93A4799153`.
  It allocates vocabulary-6 lineage and bounded Manual-loop operation,
  observation, receipt, finalization, journal, terminal and completion records
  while creating no epoch, grant, effect or completion fact during migration.
- A vocabulary-6 epoch writes the twenty-three already-representable origin
  actions to the existing `authorization_grants` relation and binds them through
  immutable `authorization_grant_epoch_v6_links`; only the six new Manual
  actions use `authorization_grants_v6`. This preserves the released
  application-decision and lifecycle foreign keys without weakening the exact
  twenty-nine-action epoch, uniqueness, request, provenance, or revocation
  checks.
- The v6 physical relation accepts only those six Manual actions. Bidirectional
  insertion guards prevent cross-table grant-ID reuse; the combined decoder
  retains physical relation and action, rejects global grant/relation ID
  collisions, and proves each epoch's exact action inventory and physical
  partition instead of accepting count equality.
- Vocabulary 4 upgrades separately to 5 and vocabulary 5 separately to 6.
  Bootstrap, migration and renewal do not create newer execution authority.
- The package implements the closed corrected `ato.execution/v1` contract kit,
  one durable local no-workspace Manual backend/control, and an injected
  reliable loop for start, independent inspect, Manual outcome reporting,
  resume, retry, cancellation, verified interruption, reconcile-first expired
  execution, and separately authorized/confirmed Manual completion. The Fake
  backend remains test-only and unpacked.
- Prepare, Act, and Finalize each consume a fresh immutable authorization
  binding. Trusted principal and runtime-root identity are revalidated at every
  effect/finalization boundary; current Act authority is required by the
  Manual mutation journal itself.
- Durable failure category, code, retryability, ambiguity, retry-after, and
  retry count survive restart. Retry-wait is due-gated and reuses the exact
  operation, intent and idempotency key; expired old-fence reconciliation never
  invokes an effect and permits only a higher-fence takeover.
- Inspect receipts are accepted only after authoritative Manual-turn tuple,
  lifecycle, revision, code, evidence, and cancellation-lineage verification.
  Waiting cancellation closes only through an explicit stopped disposition,
  and terminal Manual rows reject every same-lifecycle rewrite.
- Historical execution decisions bind their decision-era Project config and
  remain readable after later Project revisions, restart, authorized backup,
  restore and reopen.
- `ato.api/v1` remains the Phase 1 CLI. No dispatcher, scheduler, MCP,
  Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend/gate, release,
  deployment, or platform-support capability is implemented or claimed.

## Review and validation history

- A1 reviewed `git-sha1:652319afa456ffbeec6c7175728485849ccec0c7`
  and reported nine findings. The first repaired candidate passed 96/96 focused
  tests and the complete 379/379 offline route, but A2 attempt 1 at
  `git-sha1:5e2f67f538835f39f265aad5e1e1839a81a2b40b` found three residuals:
  finalized replay preceded principal/root validation, inspection cached old
  authorization, and denied Act/Finalize identities blocked later recovery.
  That earlier passing validation is preserved as superseded.
- The three residuals were repaired with identity validation before finalized
  replay, a fresh decision for every independent inspection, and distinct
  authorization-attempt identity from successful binding revision. The focused
  migration/port/backend/authorization/recovery/security suite then passed
  98/98 and the complete Node phase passed 381/381.
- That post-residual `verify:offline` attempt nevertheless exited nonzero at
  package smoke. Repeated packed consumers isolated a committed request followed
  by `PERSISTENCE_FAILURE`: UUID ordering could select a vocabulary-6 origin
  grant stored outside the legacy decision foreign-key target. The failure is
  preserved in the ExecPlan as a deterministic implementation failure; it was
  not relabeled as environment noise.
- The additive epoch-link repair now has deterministic regression evidence:
  after every vocabulary-5 grant expires, a vocabulary-6-only `runtime.status`
  operation succeeds and its legacy decision binds the exact v6 origin grant.
  Physical inspection proves 23 immutable linked existing-action grants, six
  new-action v6 grants, and zero foreign-key failure. The expanded focused suite
  passed 106/106 with no failure, cancellation, skip, or todo.
- After a fresh build, the upgraded offline packed-install smoke passed five
  consecutive runs. Every run contained 105 exact packed files,
  declaration-consumer typecheck, two explicit capability upgrades, installed
  Manual start/outcome, store restart and exact replay, separate completion
  acceptance, schema-v6 backup verification, source/build/installed CLI parity,
  uninstall, and creator-owned artifact removal. The Fake backend was absent.
- The pre-A2-attempt-2 complete `verify:offline` route exited zero: lint passed 168 files
  and 25 source files; strict typecheck and build emitted no diagnostics; the
  complete Node suite passed 381/381; docs checked 77 Markdown files, 248 exact
  local links, 21 fragments, and zero forbidden artifact; dependency shape
  passed with zero production dependencies and only TypeScript 5.9.3; package
  smoke passed; the real Windows SQLite matrix passed with zero surviving
  generation member; and the Codex boundary remained explicitly blocked with
  `externalE2E=not_run` and `supportClaim=false`.
- Fresh independent A2 attempt 2 at
  `git-sha1:3f96209270651943ae6383339321ab1f110263bb` substantively closed all
  nine A1 findings and all three prior A2 residuals, then reported
  `F-EP02B-A2-004`: the split grant union erased physical origin and did not
  prove global ID uniqueness or the exact 23+6 epoch partition. The parent
  confirmed and accepted the MEDIUM in-scope finding.
- The repair narrows the v6 CHECK and adds bidirectional global-ID guards,
  physical-owner-aware decoding, exact per-epoch action/partition validation,
  and three negative corruption cases. Authorization plus migration tests pass
  24/24. A stable expanded recovery/security/adapter/migration/backup selection
  passes 115/115 with artifact hygiene preserving the registered baseline from
  14 entries to 14.
- An earlier run of that 115-test selection had every test pass but exited
  nonzero because an overlapping prior runner changed `.task-artifacts` during
  its observation window. It is preserved as an `environment_failure`, not a
  passing gate; after the overlap ended, the same selection and hygiene check
  passed deterministically.
- The post-A2-004-repair complete `verify:offline` route then exited zero: lint
  passed 168 files and 25 source files; strict typecheck and build emitted no
  diagnostics; the complete Node suite passed 384/384 with artifact hygiene
  preserving 14 entries; docs checked 77 Markdown files, 248 local links, 21
  fragments and zero forbidden artifact; dependency shape retained zero
  production dependencies and TypeScript 5.9.3 only; packed-install smoke
  passed with 105 exact files; the Windows SQLite matrix passed with zero
  surviving generation member; and the Codex boundary remained blocked with
  `externalE2E=not_run` and `supportClaim=false`.
- A standalone package-smoke invocation made before rebuilding the ignored
  `dist` tree correctly rejected the stale built migration checksum. It is an
  invalid standalone sequence, not product evidence; the canonical full route
  always performs build before package smoke and passed above.
- `git diff --check` and strict typecheck pass. Exact schema-v3 material identity
  is recomputed after this evidence update; the repeated complete offline route
  and fresh independent A2 will bind only that newer state.
- The first direct `pnpm test` invocation lacked the frozen Node directory on
  PATH, and the corrected sandboxed invocation was denied write access to the
  registered fixture root. Neither is validation evidence. The same command
  was immediately rerun with the frozen Node runtime and permission only for
  the task-owned artifact root, producing the passing results above.
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
All results above remain pre-terminal-commit observations until fresh A2 and
the exact-head coordinator gates bind their final commit identities.
