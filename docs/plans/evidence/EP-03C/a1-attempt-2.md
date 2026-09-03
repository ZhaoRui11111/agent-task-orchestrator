# EP-03C A1 attempt 2

- Report status: `complete`
- Conclusion: `not_ready_for_parent_completion`
- Reviewer: `/root/ep03b_a1_1`
- Independence: fresh independent non-implementer; strictly read-only and non-fail-fast; the previous unbound conclusion was not reused.
- Reviewed at: `2026-09-03T03:34:01.9556796+08:00`
- Approval SHA-256: `35A308CAA02690A0832FC1C112A3BCD14ACD4259F4AEFE58B5519711BD617065`
- Approval bytes: `65478`
- Reviewed material base and HEAD: `2485608a1684ea6430adcb8d004979a90d689a69`
- Reviewed material state: `git-sha1:2ec992d569f2f88ab2e148699f1898443b4aac2c`
- A1 closes: none

The reviewer ran exactly one correctly targeted fresh trace. It returned `ok=true` with empty errors, warnings, outside-scope paths, overlap, and pre-existing dirty state. The former `docs/adr/README.md` scope issue was independently confirmed absent. The reviewer inspected the current task-owned schema, authorization, application, completion/integration/workspace ports and adapters, product/export, documentation, and tests through the Tier-2 writer/reader, identity, no-follow, CAS, terminal-evidence, and recovery lens. It did not run tests, builds, fixtures, network operations, or mutations.

## Confirmed findings

### F-A1-EP03C-002 — HIGH — validation/readiness

Only M1 is complete and V1–V19 have no primary, state-bound results. After repairing the implementation findings, run every required validation, record exact commands and outcomes with the correct state binding, and obtain fresh trace and closure review.

### F-A1-EP03C-003 — HIGH — cleanup point-of-use authority

`cleanupWorkspace` validates policy and authorization during attestation issuance but does not re-evaluate the current `evaluate_cleanup` receipt or `workspace.cleanup` grant immediately before calling the destructive backend. Revalidate the exact actor, grant/revision/expiry, policy receipt/config/expiry, attestation, and resource tuple at point of use; add deterministic revocation, expiry, configuration-drift, and substitution tests.

### F-A1-EP03C-004 — HIGH — Git metadata containment

The Git integration adapter contains only outer paths. A contained `.git` file can point to Git admin/common/object state outside the trusted disposable root and `update-ref` can then mutate it. Bind the Git dir, common dir, object namespace, worktree metadata, and destination topology at configuration and each use; reject external/relative escapes, alternates, pointer swaps, and identity drift before effect.

### F-A1-EP03C-005 — HIGH — gate evidence reopening

`completion.accept` consumes durable gate rows without reopening each required C7 evidence leaf. Reinspect every required gate outside the writer transaction immediately before the final completion authorization/CAS and bind the exact fresh receipts; cover deletion, replacement, hardlink, reparse, and digest mismatch after the earlier inspection.

### F-A1-EP03C-006 — HIGH — preservation evidence

A syntactically valid configured `preservationStateSha256` is currently treated as proof. Replace the bare digest with current identity-bound durable evidence, or explicitly derive preservation from independently verified terminal integration/publication evidence; test required-preservation success plus absent, forged, stale, and substituted evidence.

### F-A1-EP03C-007 — HIGH — evidence path swaps

The completion backend `lstat`s then reopens evidence by pathname; publication also opens after a separately acquired parent directory. Use no-follow descriptor acquisition plus parent/leaf pre/post identity and single-link checks, failing closed on any drift. Add deterministic directory/leaf swap, junction/reparse, and hardlink tests.

### F-A1-EP03C-008 — MEDIUM — Windows composed E2E

The declared Windows Phase-3 test contains independent adapter smoke tests, not the V15 real-SQLite composed facade lifecycle. Add the complete policy → gate → source-HEAD staleness/rerun → integration → completion → release → attested cleanup → retained evidence → restart path beneath `.task-artifacts`.

### F-A1-EP03C-009 — HIGH — live source identity

The completion backend configuration omits repository identity and does not reopen ownership/repository/branch/HEAD state before spawn. The integration backend validates configured identifiers and cleanliness but does not prove the source worktree's live HEAD still equals `sourceHeadObjectId`. Reopen the exact trusted ownership/Git identity before every gate or integration effect and refuse metadata-only commit, detached/symbolic HEAD, ownership substitution, or source-HEAD drift.

## Unverified

- V1–V19 remain pending for this reviewed state.
- No typecheck, unit, persistence, Windows fixture, build, lint, or package-smoke result was produced by the reviewer.
- Schema/FK/trigger closure, 47-action/v6 exactness, 33-command/37-error CLI stability, backup-v1 stability, and C17/C18/C21 exhaustiveness still require executable evidence.
