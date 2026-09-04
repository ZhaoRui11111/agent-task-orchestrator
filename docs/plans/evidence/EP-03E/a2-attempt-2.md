# EP-03E A2 attempt 2

```json
{
  "report_status": "complete",
  "reviewer": "Codex /root/ep03d_a0_2 — fresh independent EP-03E A2 attempt 2",
  "independence": "Fresh independent read-only A2 over the exact replacement candidate. The reviewer did not draft, implement, or repair EP-03E. Attempt 1 was interrupted before report after the parent found a public-export residual; attempt 2 rebound trace and independently reviewed the replacement. No task material, Git/index, coordinator, dependency, network, credential, real scheduler, or external state was modified.",
  "scope": "F-A1-EP03E-001 through F-A1-EP03E-010, the package-root scheduler export repair, and adjacent scheduler authorization, Project binding, external-registration identity, persistence decoder, lifecycle, recovery, source/target, and public-boundary risks.",
  "reviewed_at": "2026-09-04 21:13:32+08:00",
  "reviewed_state_id": "git-sha1:87b5c4001c225f0a71f3a27055d4359f7a659a5c",
  "parent_disposition": "complete",
  "closes": [
    "F-A1-EP03E-001",
    "F-A1-EP03E-002",
    "F-A1-EP03E-003",
    "F-A1-EP03E-004",
    "F-A1-EP03E-005",
    "F-A1-EP03E-006",
    "F-A1-EP03E-007",
    "F-A1-EP03E-008",
    "F-A1-EP03E-009",
    "F-A1-EP03E-010"
  ],
  "findings": [
    "F-A2-EP03E-001",
    "F-A2-EP03E-002",
    "F-A2-EP03E-003",
    "F-A2-EP03E-004"
  ]
}
```

## Evidence

Fresh trace was exact and clean at the reviewed state, approval SHA-256
`761096EA9D5E7AC7347B0B8B9B5B68AF4F48C44AB0FDCB44F75E739202858981`,
and base/HEAD `e2b5da560577ec91590531d64249eefef6da3a4e`. Focused
scheduler port/application/dispatcher plus package-surface tests passed 68/68;
`git diff --check` exited zero. The explicit root export correctly kept
`schedulerReceiptSemanticsAreValid` internal and no concrete/test backend became
public.

## Residual findings

### F-A2-EP03E-001 — HIGH — Project scope can change inside Act confirmation

The application checked Project revisions before calling the fresh confirmation
callback but not again inside the subsequent Act transaction. A direct
reproduction advanced a Project from 1/1 to 2/2 inside the second register
confirmation; Act still allowed and called the backend once. Closure requires
an exact current enabled Project/revision check in the Act transaction for both
register and remove, before allow/effect-possible state.

### F-A2-EP03E-002 — HIGH — ambiguous receipts can substitute external identity

The port rejected a bound inspect/remove identity mismatch only for
`externalState=present`. An ambiguous receipt with a different non-null ID was
accepted and the application wrote it into the ambiguous projection. Closure
requires rejecting every different non-null receipt ID, converting it to
bounded integrity ambiguity with the original projection, and testing direct
plus reconciliation cases.

### F-A2-EP03E-003 — HIGH — denied Act reason/grant semantics remain open

The decoder accepted any deny reason with either no grant or an exact usable
grant. A forged `grant_missing` decision retaining its usable non-null grant and
linked finalization decoded successfully. Closure requires the closed relation:
only `policy_denied`/`confirmation_required` are grant-backed; their policy and
high-risk semantics are exact; other denial reasons carry no grant.

### F-A2-EP03E-004 — MEDIUM — ambiguous mutation can omit Act authorization

The ambiguous-state predicate required observations but did not require the
single allowed Act decision that made an effect possible. Deleting that decision
from an otherwise valid ambiguous register still decoded. Closure requires one
semantically valid allowed Act for every effect-possible lifecycle, retaining
only the separate denied-Act no-effect terminal path.

Parent disposition: complete. The report is accepted as a finding-bearing A2
and keeps implementation completion blocked pending same-strategy repair and a
fresh A2 attempt.
