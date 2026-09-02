# EP-03A A0 attempt 2 (stale after lifecycle-scope revision)

- Report status: `complete`
- Reviewed readiness: `ready_for_activation`
- Historical disposition: `stale`
- Reviewer: `/root/ep03a_a0_3`
- Independence: fresh independent read-only reviewer with no proposal drafting,
  implementation, file mutation, Git/coordinator mutation, product test, or
  external-action role
- Reviewed at: `2026-09-01 23:18:42+08:00`
- Approval SHA-256: `44C5EF454C1398423BE14320EDE11A34ED99276AF0304B783BB53B5F86AC77BD`
- Approval contract bytes: `29006`
- Reviewed material base: `fc42a2ead9698e2e25341b014526d4b348fc016c`
- Trace state: `git-sha1:7b6143014e545296c95a479786d59b33fee52769`
- Findings: none

The reviewer read the repository and plan authorities, the complete proposal,
the archived non-ready A0 attempt, both approval revisions, and the relevant
authorization, persistence, reliability, workspace, adapter, security,
compatibility, validation, toolchain, and Git-flow contracts. Independent
sorted-key compact UTF-8 canonicalization reproduced the exact approval byte
count and digest. Trace was schema-v3 clean with the exact branch/base, no
warning, outside-scope path, dirty overlap, EP-03B plan, or EP-03C plan.

The review confirmed closure of every prior finding and applied the full Tier-2
persistence lens. In particular, allocation is distinct from the effect-capable
reserve operation; the status/CAS graph closes operation-specific success,
verified no-effect/refusal, ambiguity, observation, recovery, terminal replay,
replacement, stale revision/fence, concurrency, failpoint, and corruption
paths. `ApplicationTransaction` and the combined decoder/digest remain the
single writer and reader owners, backend calls stay outside writer
transactions, authorization remains finite and source-correct, and dedicated
evidence remains bounded and redacted. The reviewer performed no product test
or mutation.

Parent disposition at review time: the report was accepted as complete with no
finding. The first active trace then exposed helper warning
`W_PREFLIGHT_LIFECYCLE_SCOPE`: repository convention stores proposals under
plural `proposals/`, while the lifecycle helper additionally requires the
singular `proposal/` form in task scope. Adding that exact path expanded the
approval contract, so this otherwise-passing report became stale immediately.
It grants no current activation or implementation readiness; a fresh A0 is
required on the revised digest.
