# EP-02D validation evidence

This record binds the repaired pre-repeat-A2 material evidence. It is not yet
terminal or exact-head Git-flow evidence. No entry below is a release,
platform-support, scheduler, external-backend, or deployment claim.

## Environment and commands

- Windows `10.0.22631` x64; Node `24.19.0`; pnpm `11.19.0`; TypeScript `5.9.3`;
  SQLite `3.53.3`.
- `node --check scripts/package-smoke.mjs` exited `0`.
- `pnpm run package:smoke` exited `0` after the repaired installed-boundary
  realpath resolution. It packed `118` files and passed consumer types, root
  export, persistence, complete source/build/installed Phase 2 console parity,
  restart/replay, denial, human output and uninstall.
- After A2 attempt 1, `node scripts/test-runner.mjs test/cli-contract.test.mjs`
  passed `8/8` with artifact hygiene and an absent terminal root, and
  `pnpm docs:check` passed `92/252/21/0`.
- `pnpm verify:offline` exited `0` end to end after the A2 repair: lint `193/28`,
  strict typecheck,
  build, `431/431` discovered tests with zero failure/skip/todo, artifact hygiene
  with an empty terminal inventory, documentation `92/252/21/0`, zero production
  dependencies, the `118`-file package smoke, the complete Windows SQLite
  feasibility matrix with zero surviving generation member, and the Codex
  blocked boundary with `externalE2E=not_run` and `supportClaim=false`.
- `git diff --check` exited `0`. ExecPlan trace and scope reported no error,
  warning, outside-scope path, overlap or pre-existing dirty path; the index is
  empty and all current changes are task-owned.

## Repaired A1 findings

- Dispatcher runs now derive a fresh bounded worker owner while claimed Manual
  executions retain the stable actor/root lease owner. Exact same-actor trigger
  replay is canonical across workers; expiry takeover increments owner revision;
  old-worker writes fail the existing fence/CAS. Existing optional-seam callers
  retain their historical single-owner behavior.
- Public `--reason-code` and Manual outcome `--code` accept the closed 64-byte
  execution-code boundary and reject 65 bytes; other operational identities
  retain their 128-byte boundary.
- Real v2 CLI workflows now migrate every shipped schema prefix through the
  frozen chain to exactly schema v7, preserve historical migration rows and
  checksums, perform explicit capability upgrades, restart, dispatch, Manual
  report and separately accepted completion, and prove that no schema v8 exists.
- Product-facade recovery now covers every reliable-loop checkpoint, committed
  response loss, cross-worker dispatcher replay, expired-run takeover,
  pending-member recovery, Manual-report and completion replay, old-fence late
  rejection, lost Manual-start response and explicit ambiguous external state
  without a duplicate intent, observation, receipt, finalization or effect.
- The package smoke now executes the same complete Phase 2 success, denial,
  malformed, restart, replay and human-output scenario through isolated source,
  built and packed-installed consoles. Test-only home isolation remains inside
  the creator-owned package generation; no product cleanup path was added.
- The two A1 documentation wording inconsistencies were corrected without an
  adjacent contract change.

Fresh independent A0 attempt 5 approved the repair envelope. The preserved A1
report contains five MEDIUM findings and one LOW finding, all accepted and
routed to fresh independent A2. Read-only A2 attempt 1 independently closed five
findings and found F-EP02D-A2-001: the authoritative CLI contract's typed-bound
summary still assigned 128 bytes to both code fields despite the approved,
implemented and tested 64-byte exception. That non-closure-safe result is
preserved in `a2-attempt-1.md`, and the earlier complete route remains factual
but superseded evidence.

The sole repair now states 128 bytes for v2 IDs/references and the closed 64-byte
execution-code grammar only for `--reason-code` and Manual outcome `--code`.
ato.api/v1, ato.execution/v1, implementation behavior, schema v7 and every other
bound are unchanged. Targeted and complete current validation above pass, and
the resulting material diff is stable for fresh repeat A2. Final material
identity, closure-safe A2, terminal plan state, result commit, current-head
artifact-prune receipt, exact-head gates, integration and push are still pending
and must not be inferred from this record.
