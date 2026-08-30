# EP-02C validation evidence

Status: the stable candidate implementation and documentation pass the complete
offline route after the two confirmed A1 repairs. Fresh independent A2,
terminal commit, artifact prune, exact-head gates, FF-only integration, and
ordinary push are pending. This record makes no integration, release,
deployment, platform-support, public Phase 2 interface, scheduler, or
successor-plan claim.

## Bound predecessor and plan

- The active schema-v3 ExecPlan is
  `docs/plans/active/EP-02C-reconcile-first-dispatcher.md`.
- The accepted material base and task start are
  `fcbd537bfcc0ba41f037031790a3f487c05e7378`, after the verified and pushed
  EP-02B terminal plus its preserved migration-checksum correction.
- Fresh independent A0 attempt 5 accepted the final approval contract with no
  findings. Earlier attempts and their closures remain preserved in this
  evidence directory.
- Fresh independent A1 found two MEDIUM gaps: missing fully bound
  `execution.start` denial lineage and missing orchestration-loop heartbeat
  checkpoints. The parent confirmed both in scope; their repairs and
  post-repair validation are complete, while independent A2 remains pending.
- EP-02D has not been created or activated.

## Current candidate boundary

- Additive migration `0007-phase2-dispatcher.sql` currently has canonical LF
  SHA-256
  `7AB43795AE91C9825E6851393C690144246AFCD14D00C916D978AA708F387987`.
  It allocates vocabulary-7/digest-v4 lineage and only the records required by
  the library-only explicit-Manual dispatcher.
- Vocabulary 7 is available only through its own fresh identity- and
  confirmation-bound upgrade. Bootstrap, migration, and vocabulary-6 renewal
  do not create `dispatch.run`; the v7 epoch is exactly 23 linked legacy + 6
  linked v6 + 1 physical v7 grant.
- The candidate implements trusted Manual trigger authorization, run
  ownership/forward-only checkpoint heartbeat/exact-expiry takeover, durable
  reconcile-before-seal ordering, immutable finite membership, atomic
  claim/start-intent preparation, one closed terminal outcome per member,
  restart recovery, and completeness-gated summaries. A fully bound denied
  start atomically persists its dedicated no-execution request/decision/audit
  triple with the denied member and no Task transition, intent, or effect.
- Trigger idempotency is persisted only as a stable digest. Dispatcher audit,
  reconciliation and member codes are closed in TypeScript, SQLite checks, and
  the combined decoder; arbitrary Task/path/prompt/credential/SQL/stack/error
  text is excluded.
- `ato.api/v1` and `ato.execution/v1` remain unchanged. There is no
  SchedulerBackend or scheduled trigger, public Phase 2 CLI/API, daemon, MCP,
  Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend/gate, release,
  deployment, or support claim.

## Current validation

- The post-repair migration plus dispatcher application/recovery/security
  selection passed 37/37. A final dispatcher-only rerun passed 17/17, including
  response-loss/replay/restart and corruption rejection for the no-execution
  denial lineage plus same-owner completion beyond both exact 30-second and
  3600-second lease windows.
- The canonical `pnpm verify:offline` route exited zero: lint passed 181 files
  and 27 source files; strict typecheck and build emitted no diagnostics; the
  complete Node suite passed 401/401 with no failure, cancellation, skip, or
  todo and preserved the registered artifact baseline 76-to-76; docs checked
  84 Markdown files, 251 exact local links, 21 fragments, and zero forbidden
  artifact; dependency shape retained zero production dependencies and only
  TypeScript 5.9.3; packed-install smoke passed with 114 exact files,
  declaration-consumer typecheck, export/persistence/source-build-install CLI
  parity and uninstall; the real Windows SQLite matrix passed with zero
  surviving generation member; and the Codex boundary remained explicitly
  blocked with `externalE2E=not_run` and `supportClaim=false`.
- An earlier pre-A1 invocation passed lint, typecheck, build, all 400 tests, docs, and
  dependency shape but stopped before package smoke because this worktree lacked
  its local offline pnpm store. That nonzero route is preserved as an
  environment/precondition failure, not a passing gate. Read-only evidence then
  found an exact lockfile-hash match and zero reparse entries in the same
  repository's EP-02B frozen store; copying that seed into this worktree's
  ignored `.pnpm-store` allowed the complete canonical route above to pass
  without network access.
- Schema-v3 state reports no outside-scope, overlap, pre-existing-dirty, base,
  or approval error after restoring the unnecessary out-of-scope
  `package.json` description edit to its exact baseline value.

Fresh independent A2 and any resulting post-review rerun remain required before
this evidence can become terminal.
