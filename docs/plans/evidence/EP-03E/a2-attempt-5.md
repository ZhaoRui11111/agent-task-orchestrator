# EP-03E A2 attempt 5

```yaml
report_status: complete
reviewer: Codex /root/ep03d_a0_2 — fresh independent EP-03E A2 attempt 5
reviewed_at: 2026-09-04 22:35:23+08:00
reviewed_state_id: git-sha1:f3575ee428e65d31522449092fff56ead7527c46
approval_contract_bytes: 23706
approval_sha256: 761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981
base_and_head: e2b5da560577ec91590531d64249eefef6da3a4e
closure_safe: false
a2_accepted: false
remaining_findings: 1
```

## Independence and scope

This was a fresh, independent, strictly read-only audit of the exact supplied
candidate. The reviewer did not draft or repair EP-03E. Prior reports were used
only as closure targets; conclusions were rebuilt from the frozen source,
contracts, tests, trace, and a fresh disposable-fixture reproduction. No
repository material, Git/index, coordinator, dependency, network, credential,
real scheduler, or external state was changed.

The review covered the active EP-03E plan, `F-A1-EP03E-001` through
`F-A1-EP03E-010`, `F-A2-EP03E-001` through `F-A2-EP03E-010`, request-bound
external identity, historical authorization replay, physical Project binding,
terminal no-effect semantics, SQL/decoder lifecycle, scheduled delivery, and
the package/library boundary.

## Evidence

- A fresh trace returned `ok=true` at the exact reviewed state, approval hash,
  material base, and HEAD with empty errors, outside-scope paths, overlaps, and
  pre-existing-dirty mismatches. Its sole warning was
  `W_PREFLIGHT_A2_CONVERGENCE`.
- Focused scheduler, application-service, authorization, migration,
  architecture, and package-boundary tests passed 133/133. Lint passed 318 files
  and 60 source files; docs check passed 162 Markdown files, 268 local links,
  and 22 fragments; the scheduler probe retained `boundaryStatus=passed`,
  `adapterImplemented=false`, `externalE2E=not_run`, and
  `supportClaim=false`; `git diff --check` exited zero with line-ending
  advisories only.
- Typecheck remained not claimable because the local locked
  `@openai/codex-sdk` dependency was absent (`TS2307`). The reviewer performed
  no installation or network access.
- The exact repairs for request-bound identity, physical Project receipts,
  explicit no-effect failure decoding, and the package boundary were present
  and independently confirmed. All historical findings except the complete
  equal-timestamp closure of `F-A2-EP03E-010` were closed.
- A fresh disposable fixture reproduced the remaining finding below and was
  removed after the read-only review.

## Finding

### F-A2-EP03E-011 — MEDIUM

The combined decoder's four global same-time creation/revocation snapshots
cannot represent a valid per-grant causal boundary. At one trusted timestamp the
reviewer issued same-action scheduler grant A, revoked the original origin
grant, persisted a scheduler Prepare that selected A, and then attempted to
issue equivalent grant B with a lexically earlier ID. The B issuance threw
`CORRUPT_ROW: Scheduler request authorization lineage is inconsistent` and
rolled back. Including every equal-time creation makes the sole authorization
evaluator select B; excluding every equal-time creation also removes A, so
neither global boundary reproduces the durable Prepare decision.

Closure must keep `evaluateAuthorization` as the sole authorization owner and
the current schema/strategy, while reconstructing valid per-grant same-time
causal-boundary interpretations. Regression coverage must reproduce the exact
A/Prepare/B sequence and show equal-time B issuance succeeds and remains
readable, the historical Prepare still reproduces A exactly, strictly earlier
authorization mutation time fails before any write, and equal/slightly later
controls remain readable. The matrix must cover capability upgrade/renewal and
grant issue/revoke with successful grant-backed scheduler decisions, not only a
grantless denial or one revocation.

## Parent disposition

The parent accepted the report as complete and finding-bearing, kept A2 and
completion blocked, and reopened only the same-strategy historical-boundary
repair. No schema change, new authorization owner, A3, or approval-contract
revision is planned; another fresh A2 is required at the repaired exact state.
