# EP-01C A0 attempt 2

- Reviewer: `/root/ep01c_a0`
- Reviewed at: `2026-08-29 19:40:30+08:00`
- Independence: fresh, independent, strictly read-only; no mutation or
  authorization grant.
- Approval SHA-256:
  `603B82F7B67CD2AA0C6866795CE5FC1EC522B3E819E770C4556344774B3DD231`
- Reviewed material base:
  `4594c859e4cb172353cc93298518b0a7eafb7fb3`
- Result: `revision_required`

The reviewer independently canonicalized 29,245 approval-contract bytes and
confirmed a clean trace at
`git-sha1:77156b860416482c66a6f86d3ccf01fa70fbcb54`. `F-A0-001`,
`F-A0-003`, and `F-A0-004` were closed. The exact inspect actions added for
`F-A0-002` were present, but the following adjacent gap remained.

## Finding and parent disposition

`F-A0-005` (`HIGH`, `contract_gap`) was confirmed in scope. C8 bound
`project.inspect` and `task.inspect` to one exact target/revision, but V6 still
included a Project collection list with no single target/revision; grant
inspection also lacked an exact inspected-grant binding. The revised contract
removes all Phase 1 collection-list queries and binds
`authorization.grant.inspect`, `project.inspect`, and `task.inspect` to one
exact grant/Project/Task identity and revision, `read_not_applicable`, one
consumed bounded query, and negative list/replay evidence.

Fresh independent A0 is required for the revised approval digest. This report
does not authorize implementation or any external action.
