# EP-03C A1 attempt 1 — unbindable report

- Reviewer: `/root/ep03b_a1_1`
- Review completed: `2026-09-03T03:26:28.1066050+08:00`
- Approval SHA-256: `35A308CAA02690A0832FC1C112A3BCD14ACD4259F4AEFE58B5519711BD617065`
- Reviewed base and HEAD: `2485608a1684ea6430adcb8d004979a90d689a69`
- Report status: `complete_with_findings`, but unusable as the current A1 gate
- Binding failure: the review-time ExecPlan trace returned `E_SCOPE` for the task-diff change to `docs/adr/README.md`, so no valid `reviewed_state_id` could be issued.

The parent preserved the findings, reverted the out-of-scope file through a task-owned remediation change, and required a fresh independent A1 on a valid material state. This report is historical evidence only and does not satisfy the current A1 gate.

## Findings

1. `F-A1-EP03C-001` (HIGH): `docs/adr/README.md` was outside the approved task paths. Revert the change or revise the approval and repeat A0.
2. `F-A1-EP03C-002` (HIGH): milestones M2–M6 and validation results V1–V19 were not recorded, so readiness was unproved.
3. `F-A1-EP03C-003` (HIGH): cleanup did not re-evaluate the exact current policy receipt and `workspace.cleanup` authorization immediately before the destructive backend effect.
4. `F-A1-EP03C-004` (HIGH): the local Git integration backend did not bind `.git`, common-dir, object storage, and worktree metadata to the trusted disposable root, permitting Git metadata escape and external mutation.
5. `F-A1-EP03C-005` (HIGH): completion trusted persisted gate-inspection receipts without reopening every required C7 evidence leaf immediately before final authorization and completion CAS.
6. `F-A1-EP03C-006` (HIGH): an arbitrary caller-provided `preservationStateSha256` was accepted as preservation proof without durable identity, freshness, or independent verification.
7. `F-A1-EP03C-007` (HIGH): local completion evidence used pathname `lstat` followed by pathname read/open without handle-level no-follow and identity revalidation, leaving directory, junction/reparse, leaf, and hardlink swap races.
8. `F-A1-EP03C-008` (MEDIUM): the Windows Phase-3 E2E test contained separate adapter smoke tests rather than the required composed SQLite-to-policy/gate/integration/completion/release/cleanup/restart lifecycle.

## Unverified items

- V1–V19 had no current plan results.
- The reviewer environment could not find Node, so its typecheck invocation did not run.
- Static review did not prove the declared architecture, persistence, authorization, recovery, security, packaging, or end-to-end validation claims.
