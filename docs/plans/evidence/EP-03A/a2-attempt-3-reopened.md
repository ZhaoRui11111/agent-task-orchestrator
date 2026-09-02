# EP-03A A2 attempt 3 — reopened

- Reviewer: `/root/ep03a_a2`
- Reviewed at: `2026-09-02 11:38:54+08:00`
- Reviewed material state: `git-sha1:eea8c0eff9f30081165e1ddfd33ae9a251096009`
- Approval SHA-256: `CFE9076E78B3B3679F0461EFCCB676FA7FC1600CF05ACBEBEE86ACE9BA4E6929`
- Independence: fresh, independent and strictly read-only; the reviewer did not implement or repair the change, edit files, run write-producing product tests, mutate Git or coordinator state, or perform an external action.
- Parent disposition: `reopened`
- Closure target set: `F-A1-01`, `F-A1-02`, `F-A1-03`, `F-A1-04`, `F-A1-05`, `F-A1-06`
- Closure-safe: no
- Completion-safe: no

The reviewer reproduced the exact material state twice with read-only trace.
Both traces were `ok=true`, with no errors, outside-scope paths or dirty
overlap. The sole convergence warning was explicitly reviewed: the residual
remained within the same decoder/causation/status-projector root cause, owner,
strategy and approved envelope. The parent-supplied focused and full-gate
results were inspected but were not represented as an independent reviewer
test run.

`F-A1-01`, `F-A1-03`, `F-A1-04`, `F-A1-05` and `F-A1-06` remained closed.
The complete allow/deny authorization pattern, exact allow-Act observation
binding and structural same-generation ambiguous acyclic causal-chain repairs
closed `F-A2-03` and the prior portion of `F-A2-01`; `F-A2-02` also remained
closed. `F-A1-02` could not yet close because of one direct residual:

- `F-A2-04` (`MEDIUM`): recovery accepted any non-recover ambiguous intent as
  its ultimate causal root. An ambiguous `inspect` performed while a generation
  was already `recovery_required` could therefore replace the true
  effect-possible `reserve`, `create`, or `cleanup` root. A later
  `recovered_absent` receipt with `recoveredOperation=inspect` fell through to
  `allocated`, losing the original operation's required projection (`reserved`
  for create or `cleaned` for cleanup) and persisting an incorrect or wedged
  generation status.

The reviewer routed the finding to a shared application/decoder/projector
restriction that permits only `reserve`, `create`, or `cleanup` as the final
recovery root, plus behavior-level create/cleanup ambiguity, ambiguous-inspect
and recovery projection regressions. This remains a local rerun of the same A2;
it neither creates A3 nor reopens A1.
