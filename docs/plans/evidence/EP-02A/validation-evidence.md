# EP-02A validation evidence

Status: both localized A2 residual repairs and complete offline implementation
validation passed; fresh independent A2 rerun and terminal Git-flow remain pending. This record makes no
integration, push, release, deployment, or support claim. The completed
ExecPlan will bind the final exact-head receipts.

## Environment and dependency boundary

- Windows development host, `win32 x64`; repository-frozen Node `24.19.0`;
  pnpm `11.19.0`; TypeScript `5.9.3`; zero production dependencies.
- Validation uses the repository-local frozen dependency store. No adapter,
  external effect, external repository, secret, account, or hosted service is
  part of EP-02A.
- The separately authorized dependency fetch was limited to the exact
  lockfile-pinned TypeScript package needed to restore the local offline test
  seed. It did not change `package.json` or `pnpm-lock.yaml`.

## Plan and reviewed base

- Read-only startup evidence bound `master` and `origin/master` to
  `c5c584e7570420a2d627f3c08296e74cc4c58235`, with a clean coordinator and the
  verified Phase 1 terminal as material predecessor.
- The schema-v3 ExecPlan records the user-authorized umbrella refinement
  `EP-01D -> EP-02A -> EP-02B -> EP-02C -> EP-02D -> Phase 3` without changing
  historical completed plans.
- Fresh independent A0 approved the exact proposal contract with digest
  `DF60CD8EE144D5D064E7B1FD892A8CC2305D23E6F95928C47B4D908DE14960C4`
  before activation. Historical attempts and findings remain in the active plan.
- Fresh independent A1 bound stable state
  `git-sha1:75947b383b5b1c1548e27dc3434dbfe6ffc137a6`, reported two HIGH,
  four MEDIUM and one LOW finding, and routed all seven confirmed in-scope
  repairs to fresh A2. The plan preserves the complete report and parent
  dispositions.
- The first fresh independent A2 bound repaired state
  `git-sha1:ef56af48fcfbf59260d6e9d954d05949e08ebd20`, confirmed six repair
  roots, and found one bounded residual in the historical lifecycle-digest
  writer/verifier closure. The localized repair now carries the decoded digest
  version through validation and recomputes cloned/verified state with that
  exact provenance; a fresh A2 rerun remains required.
- The second fresh A2 bound state
  `git-sha1:514ed34668a8478464a8ffaecebb8352741f07f2`, accepted the backup
  writer/verifier repair, and found the same provenance was still ignored by
  confirmed restore terminal readback. That adjacent reader now uses the
  decoded lifecycle record's digest version; direct restore and explicit
  recovery after publication are both covered before the next A2 rerun.

## Implemented boundary

- Migration `0005-phase2-execution-claim.sql` appends schema v5 with canonical
  LF SHA-256
  `27AB1730F5A56A2127479C02570068E6BA1CA3DB565147FB0325AAA412CD5C81`.
  It preserves released schema-v3/v4 authorization rows, marks historical
  lifecycle digests as version 1, writes current execution-aware lifecycle
  digests as version 2, creates no grant or attempt during migration, and
  allocates only execution sequences and attempts.
- Native and migrated runtimes retain the nineteen Phase 1 grants until the
  exact local trust root performs the separate fresh-confirmation-bound
  capability upgrade. Upgrade creates the vocabulary-5 epoch and exactly four
  additional grantable execution actions; ordinary renewal preserves the
  already-current vocabulary and cannot upgrade it. A migrated vocabulary-3
  bootstrap can adopt into vocabulary 4 and then explicitly upgrade without
  rewriting its immutable bootstrap or fifteen historical grants.
- The typed package-root service implements atomic ready-to-running claim,
  exact Task/Project-bound idempotent replay, audited inspection, lease renewal
  bounded to trusted time plus the requested duration, expiry
  observation, effect-free expired takeover with a higher per-Task fence, and
  stale owner/fence/revision refusal.
- Malformed Phase 2 envelopes return before any trusted ingress or persistence
  call. Claim, renewal and takeover each have staged failpoint, close, reopen and
  exact unchanged-state recovery evidence.
- A lifecycle authorization created on schema v4 retains digest version 1 after
  migration to schema v5; current manual backup creation and later standalone
  verification, confirmed restore publication, and interrupted-restore
  recovery all consume that recorded provenance instead of inferring a digest
  algorithm from the current schema version.
- `ato.api/v1` and the `ato` CLI remain the closed Phase 1 surface. EP-02A has no
  port, adapter, backend call, effect intent/receipt/finalization, dispatcher,
  scheduler, completion/cancellation loop, workspace, MCP, Git integration,
  log file, diagnostic bundle, telemetry, release, or deployment.

## Observed implementation checks

The following checks passed on the stable repaired implementation before A2:

- frozen Node `24.19.0` `pnpm typecheck`: exit `0`;
- frozen Node `24.19.0` `pnpm lint`: exit `0`, `155` repository files and `21`
  production source files accepted;
- affected application/execution routes: `39/39` tests passed, including
  adopted-v3 upgrade, Project-ID idempotency drift, no lease banking, malformed
  ingress ordering and restart failpoint matrices;
- post-A2 migration route: `20/20` tests passed, including a
  populated schema-v4 lifecycle, independent literal v4 digest projection,
  application-authorized v4 manual backup verification, v5 readback, and real
  v4 authorization -> v5 migration -> current manual backup creation and
  verification -> direct confirmed restore or publication-interruption
  recovery;
- unchanged CLI contract: `5/5` tests passed;
- schema migration matrix: `19/19` tests passed;
- focused application/domain/authorization routes passed after the current
  compatibility repairs; and
- frozen Node `24.19.0` `pnpm build`: exit `0`;
- frozen Node `24.19.0` `pnpm test:persistence`: exit `0`; `95/95` pass with
  `0` fail/skip/todo and artifact baseline/terminal `65/65`;
- frozen Node `24.19.0` `pnpm test`: exit `0`; `302/302` pass with `0`
  fail/skip/todo and artifact baseline/terminal `65/65`;
- frozen Node `24.19.0` `pnpm docs:check`: exit `0`; `75` Markdown files,
  `246` exact-case local links, `21` fragments, and `0` forbidden references;
  and
- frozen Node `24.19.0` `pnpm package:smoke`: exit `0`; frozen
  `typescript@5.9.3` install, exact `88`-file package, public declaration
  consumer, export, schema-v5 persistence/claim, source-built-installed Phase 1
  CLI parity, and uninstall all passed;
- frozen Node `24.19.0` `pnpm dependency:check`: exit `0`, zero production
  dependencies and only frozen `typescript@5.9.3` in development;
- frozen Node `24.19.0` SQLite feasibility spike: exit `0`, schema/connection,
  claim contention, private backup, publication CAS, corruption and restart
  ambiguity checks passed with zero surviving generation members;
- Codex boundary spike: exit `0`, explicit blocked evidence, external E2E not
  run and no support claim; and
- aggregate frozen Node `24.19.0` `pnpm verify:offline`: exit `0`, subsuming
  lint, typecheck, build, the `302/302` full suite, docs, dependency shape,
  package smoke and both feasibility boundaries.

One earlier full-gate attempt on this same restore repair reached `301/302` and
failed the pre-existing artifact-concurrency disappearance/identity race with a
raw Windows `ENOENT`. It changed no material path. The exact isolated route
then passed `4/4`, and the subsequent complete frozen-Node rerun passed
`302/302`; only that complete rerun is accepted as terminal validation.

## Pending terminal evidence

Fresh independent A2, final staged-inventory review, result commit,
standing-authorized artifact prune, exact-head Git-flow receipts, FF-only
integration, and ordinary `origin/master` push are not yet claimed here.
Coordinator cleanup is not authorized and will not be invoked.
