# EP-03A A2 attempt 4 — reopened

- Reviewer: `/root/ep03a_a2`
- Reviewed at: `2026-09-02 12:02:29+08:00`
- Reviewed material state: `git-sha1:e1ca97cbfc55e131952d6b15a3abb4d8e76e70c2`
- Approval SHA-256: `CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929`
- Independence: fresh, independent and strictly read-only; the reviewer did not implement or repair the change, edit files, run write-producing product tests, mutate Git or coordinator state, or perform an external action.
- Parent disposition: `reopened`
- Closure target set: `F-A1-01`, `F-A1-02`, `F-A1-03`, `F-A1-04`, `F-A1-05`, `F-A1-06`
- Closure-safe: no
- Completion-safe: no

The independent trace reproduced the exact reviewed material state with
`ok=true`, no errors, outside-scope paths, dirty overlap, or pre-existing dirty
content. The sole convergence warning was reviewed as another local residual of
the same F-A1-02 decoder/causation root, implementation owners, repair strategy,
and approved envelope. The reviewer inspected the parent-supplied focused and
full-gate receipts without representing them as an independent test run.

`F-A1-01`, `F-A1-03`, `F-A1-04`, `F-A1-05`, and `F-A1-06` remained closed.
The earlier receipt, authorization-pattern, failure-taxonomy, effect-capable-root,
and inspect-root repairs remained correct. `F-A2-02`, `F-A2-03`, and
`F-A2-04` were closed. `F-A1-02` and the causation portion of `F-A2-01` could
not close because of one direct residual:

- `F-A2-05` (`HIGH`): an effect-capable causal root was not bound to the
  current unresolved `recovery_required` generation revision. A historical
  ambiguous `reserve`, `create`, or `cleanup` intent remains ambiguous after a
  successful recovery and could be named again after a newer effect made the
  same generation recovery-required. The application and combined decoder both
  accepted this stale root. In the reserve/cleanup reproduction, a cleanup
  response loss followed by recovery against an old reserve root projected
  recovered absence to `allocated`, which could then admit same-generation
  reserve reuse and bypass the required `cleaned` to generation-plus-one edge.

The parent reproduced the finding before repair. The new behavior regression
returned `true` where a pre-backend `RECONCILIATION_REQUIRED` refusal was
required, and the same-operation corruption regression reported a missing
expected `CORRUPT_ROW`; the same-revision nested-recover positive passed. The
repair route is one internal current-causation proof: bind every ambiguous node
to the recover prepare/Act generation revision and `recovery_required` status,
retain monotonic time and acyclic same-generation checks, and terminate only in
`reserve`, `create`, or `cleanup`. Application prepare, decoder, final projector,
and same-generation reserve proof must consume that validation. This remains a
fresh rerun of the same A2; it neither creates A3 nor reopens A1.
