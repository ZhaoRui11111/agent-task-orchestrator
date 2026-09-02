# EP-03A A2 attempt 1 — reopened

- Reviewer: `/root/ep03a_a2`
- Independence: fresh independent read-only A2; no implementation, repair,
  file/Git/Git-flow mutation, product test, authorization, or external action.
- Reviewed material state:
  `git-sha1:69be0f48308e690dcd06b376eeb311ea07080667`
- Report completed: 2026-09-02 10:33:17+08:00
- Exact closes reviewed: `F-A1-01`, `F-A1-02`, `F-A1-03`, `F-A1-04`,
  `F-A1-05`, and `F-A1-06`
- Disposition: reopened for a same-family local repair and fresh rerun of A2.

The reviewer independently reproduced two warning-free traces at the exact
state above, inspected the complete repair diff and relevant contracts, and
confirmed that `F-A1-01`, `F-A1-03`, and `F-A1-06` were closed. The direct
trigger paths for the other three A1 findings were repaired, but two adjacent
residuals prevented closure-safe acceptance.

## F-A2-01 — HIGH

The combined workspace decoder compared observation and verified-receipt rows
for equality but did not revalidate the port-owned operation/code/outcome/
external-state matrix or its resulting generation status. Failure category and
flags also remained open persisted strings/booleans, while same-generation
reserve reuse trusted `last_failure_ambiguous=false`. A cross-row-consistent but
operation-impossible receipt could therefore fabricate a terminal status, and
a forged non-ambiguous failure could become unsafe no-effect evidence.

The parent reproduced both paths. The repair now uses one pure semantic owner
from `workspace-port.ts` for adapter receipt combinations, exact failure flags,
ambiguity projection, and receipt/failure generation outcomes. Persistence
readers close receipt codes and failure categories; combined readback validates
the terminal status, code and event projection. Internal post-effect authority
loss now uses `ambiguous_external_state` rather than an invalid ambiguous form
of `stale_revision` or `unauthorized`. Direct corruption regressions cover an
operation-incompatible receipt, an impossible resulting status, an unknown
failure category, and forged non-ambiguous integrity evidence before generation
reuse.

## F-A2-02 — MEDIUM

The workspace-v1 failure-category paragraph listed twelve values while the same
contract's authoritative table, implementation and tests contained fifteen.
The parent confirmed the omission of `policy_denied`, `rate_limited`, and
`cancelled`; the paragraph now enumerates the exact same fifteen-category set.

This attempt does not claim A2 closure. The repaired state passed strict
typecheck, the focused application suite 10/10, and all four workspace groups
53/53. Repository full validation and a fresh same-A2 review remain required.
