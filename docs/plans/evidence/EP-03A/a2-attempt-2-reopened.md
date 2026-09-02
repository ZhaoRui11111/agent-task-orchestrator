# EP-03A A2 attempt 2 — reopened

- Reviewer: `/root/ep03a_a2`
- Reviewed at: `2026-09-02 11:13:38+08:00`
- Reviewed material state: `git-sha1:dfeb457d01d34e02009c5f37299e61690da90957`
- Approval SHA-256: `CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929`
- Independence: fresh, independent and read-only; the reviewer did not implement or repair the change, edit files, run write-producing product tests, mutate Git or coordinator state, or perform an external action.
- Parent disposition: `reopened`
- Closure target set: `F-A1-01`, `F-A1-02`, `F-A1-03`, `F-A1-04`, `F-A1-05`, `F-A1-06`
- Closure-safe: no
- Completion-safe: no

The reviewer read the complete scoped diff, plan and prior audit evidence, the
authorization, persistence, reliability, adapter, workspace and security
contracts, and the implementation and tests. Two read-only traces reproduced
the exact reviewed state with `ok=true` and no warnings, outside-scope paths or
dirty overlap. The reviewer treated the parent-supplied focused and full-gate
results only as supplied evidence and did not claim an independent test run.

`F-A1-01`, `F-A1-03`, `F-A1-04`, `F-A1-05` and `F-A1-06` were closed by the
reviewed repairs. `F-A1-02` remained open because of the following direct,
same-family decoder residuals:

1. `F-A2-03` (`HIGH`): `validateWorkspaceState` required only the current
   finalize decision to allow a successful terminal chain. It did not require
   the complete prepare/act/finalize decision pattern to be allowed, and an
   observation did not prove that it referenced the exact allow Act decision.
   A valid chain whose Act row alone was changed to `deny/grant_missing` could
   still decode as successful authoritative evidence.
2. `F-A2-01` (`HIGH`, narrow residual): the recover projector followed
   `causationId` before proving a nonempty, existing, same-workspace,
   same-generation, durably ambiguous and acyclic causal chain. Missing,
   unrelated or cyclic causation could therefore project a forged recovery
   terminal status.

The prior `F-A2-02` contract-taxonomy finding was closed: the authoritative
adapter paragraph, table, implementation and tests now agree on all 15 failure
categories.

The reviewer routed both latest findings to a local decoder repair, focused
corruption regressions, full revalidation and a fresh rerun of the same A2.
This attempt does not create A3 or reopen A1.
