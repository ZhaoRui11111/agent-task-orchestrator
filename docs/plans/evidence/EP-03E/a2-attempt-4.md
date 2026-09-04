# EP-03E A2 attempt 4

```yaml
report_status: complete
reviewer: Codex /root/ep03d_a0_2 — fresh independent EP-03E A2 attempt 4
reviewed_at: 2026-09-04 22:09:30+08:00
reviewed_state_id: git-sha1:b6a86542ff6de3de032fdcad58d2ab7b66c4c1e5
approval_sha256: 761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981
base_and_head: e2b5da560577ec91590531d64249eefef6da3a4e
closure_safe: false
a2_accepted: false
remaining_findings: 2
```

## Independence and scope

This was a fresh, independent, strictly read-only audit of the exact supplied
candidate. The reviewer did not draft or repair EP-03E. Earlier reports were
used only as closure targets; every conclusion was re-established from current
source, contracts, tests, trace, and fresh reproductions. No task material,
Git/index, coordinator, dependency, network, credential, real scheduler, or
external state was changed; disposable focused-test fixtures were cleaned.

The review covered `F-A1-EP03E-001` through `F-A1-EP03E-010`, historical
residuals `F-A2-EP03E-001` through `F-A2-EP03E-008`, final-confirmation and
scheduled-delivery physical Project binding, historical grant replay,
request-bound external identity, terminal no-effect semantics, SQL-owned
lifecycle integrity, and the package-root public surface.

## Evidence

- A fresh trace returned `ok=true` at the reviewed state with empty errors,
  outside-scope paths, overlaps, and pre-existing-dirty mismatches. Its sole
  warning was the expected `W_PREFLIGHT_A2_CONVERGENCE` advisory.
- Scheduler port/application/dispatcher/package-surface focused tests passed
  80/80; vocabulary tests passed 2/2.
- The scheduler probe reported `boundaryStatus=passed`,
  `adapterImplemented=false`, `externalE2E=not_run`, and
  `supportClaim=false`; `git diff --check` exited zero with line-ending
  advisories only.
- Fresh disposable-fixture reproductions confirmed both findings below.

All exact predicates from prior findings `F-A1-EP03E-001..010` and
`F-A2-EP03E-001..008` were repaired at their stated boundaries. Physical
Project binding, explicit non-ambiguous terminal failure, and package-surface
closure were independently confirmed.

## Findings

### F-A2-EP03E-009 — HIGH

The combined decoder permits an inspect/remove request's bound external
registration identity to be erased to `null` in ambiguous evidence and the
ambiguous registration projection. A response-loss removal observation and its
registration projection were changed from the original ID to `null`, the
receipt digest was recomputed, and the decoder accepted the state.

Closure requires every durable inspect/remove observation with a non-null
request identity to carry exactly that ID, including ambiguous/failure forms;
an ambiguous remove projection must retain it; and reconciliation must derive
the remove identity from the immutable origin request, not the mutable
registration projection. Different-ID and null-erasure corruption variants
must both fail with `CORRUPT_ROW`.

### F-A2-EP03E-010 — MEDIUM

Timestamp-only historical grant reconstruction cannot distinguish same-instant
grant creation/revocation from an earlier scheduler decision. A pre-v7
`action_mismatch` denial followed by v7 upgrade at the identical trusted time
became `CORRUPT_ROW`. A successful scheduler Act synthesized one millisecond
beyond ingress time; an immediate revoke using the unchanged ingress time then
threw `CORRUPT_ROW`, rolled back, and left the grant current.

Closure must retain the sole `evaluateAuthorization` owner while accepting
legitimate equal-timestamp causal-boundary interpretations and rejecting a
trusted authorization mutation time that precedes already-durable scheduler
authorization evidence before any write. Equal/strictly later controls must
remain readable and exact.

## Parent disposition

The parent accepted this finding-bearing report, kept completion blocked, and
reopened only these two same-envelope repairs. No schema change, new
authorization owner, A3, or approval-contract revision is planned; another
fresh A2 is required at the repaired exact state.
