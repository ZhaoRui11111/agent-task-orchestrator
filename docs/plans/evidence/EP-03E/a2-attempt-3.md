# EP-03E A2 attempt 3

```yaml
report_status: complete
reviewer: Codex /root/ep03d_a0_2 — fresh independent EP-03E A2 attempt 3
reviewed_at: 2026-09-04 21:40:13+08:00
reviewed_state_id: git-sha1:4f3c6a90d803f52b9e68229d3ac815317ff79561
approval_sha256: 761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981
base_and_head: e2b5da560577ec91590531d64249eefef6da3a4e
closure_safe: false
a2_acceptance: false
remaining_findings: 4
```

## Independence and scope

This was a fresh, independent, strictly read-only A2. The reviewer did not
draft or repair EP-03E. Earlier reports were used only to identify closure
targets; all conclusions were independently re-established at the supplied
candidate. No repository file, Git/index, coordinator, dependency, network,
credential, real scheduler, or external state was modified.

The review covered all current A1 `a2_required` findings
`F-A1-EP03E-001` through `F-A1-EP03E-010`, prior residuals
`F-A2-EP03E-001` through `F-A2-EP03E-004`, the explicit scheduler package-root
and probe repair, and adjacent Project identity, authorization-decision,
receipt-reconstruction, and scheduler-lifecycle decoder risks.

## Evidence

- A fresh trace returned `ok=true` at the reviewed state with the approval
  identity above and empty errors, warnings, outside-scope paths, overlaps, and
  pre-existing-dirty mismatches.
- Focused scheduler/application/dispatcher/package-surface tests passed 72/72;
  vocabulary-v7 focused tests passed 2/2.
- The scheduler probe reported `boundaryStatus=passed`,
  `adapterImplemented=false`, `externalE2E=not_run`, and
  `supportClaim=false`.
- `git diff --check` exited zero with only line-ending advisories.
- Four disposable-fixture reproductions confirmed the findings below.

## Closure assessment

The reviewer independently closed `F-A1-EP03E-001`, `-002`, `-003`, `-005`,
`-006`, and `-010`, and closed prior residuals `F-A2-EP03E-001`, `-002`, and
`-004` at their repaired boundary. Original findings `-004`, `-007`, `-008`,
and `-009` were not yet closure-safe because the adjacent residuals below
remained. Prior `F-A2-EP03E-003` was also not fully closed.

## Findings

### F-A2-EP03E-005 — HIGH

Project-scoped scheduler effects and delivery accept a replaced physical
Project root. Database revision revalidation is present, but neither the
post-confirmation Act transaction nor scheduled delivery is bound to a fresh
physical-root receipt. Reproduction: the root was replaced while its persisted
Project row remained unchanged; register/remove still reached the mutation
backend, and delivery created an accepted tuple/run.

Closure requires a fresh physical Project-root receipt after final confirmation
and before Act, exact comparison with the Project row inside Act, and equivalent
proof before scheduled delivery acceptance. Register/remove root-replacement
tests must durably deny with zero new mutation-backend calls; delivery must
record a stale disposition and create no tuple/run.

### F-A2-EP03E-006 — HIGH

The combined decoder accepts an ambiguous receipt observation that substitutes
a request-bound external registration identity when its digest is recomputed.
The decoder currently applies the identity rule only to `externalState=present`.

Closure requires rejecting every different non-null observation identity for
inspect/remove with a non-null request identity, regardless of external state,
outcome, receipt presence, or recomputed digest. Successful- and failure-form
ambiguous corruption tests must fail with `CORRUPT_ROW`.

### F-A2-EP03E-007 — MEDIUM

The decoder accepts `grant_missing` for a denied Act after both grant fields are
cleared even though an exact usable scheduler grant existed at decision time.

Closure requires validating grantless denial reasons against deterministic
historical authorization inputs. A forged `confirmation_required` decision
rewritten to `grant_missing`, with linked finalization/event codes rewritten
and the usable exact grant retained, must fail with `CORRUPT_ROW`.

### F-A2-EP03E-008 — HIGH

The decoder permits effect-ambiguous evidence to be forged into a terminal
`failed`/no-effect state. Reproduction converted a response-loss register from
ambiguous intent/registration state to failed/removed and added a matching
failed finalization with `ambiguous_external_state`; the combined decoder
accepted it.

Closure requires the allowed-effect failed path to be backed only by an
operation-compatible, explicitly non-ambiguous no-effect refusal. Ambiguous or
integrity evidence must remain ambiguous until proving reconciliation, while
genuine retryable non-ambiguous no-effect failures remain valid.

## Parent disposition

The parent accepted this report as complete and finding-bearing, reopened the
four same-envelope repairs, and requires another fresh A2 at a newly traced
exact state. No A3 or approval-contract revision is required unless the repair
strategy expands materially.
