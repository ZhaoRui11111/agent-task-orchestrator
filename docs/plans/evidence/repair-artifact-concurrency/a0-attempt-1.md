# A0 attempt 1

- Reviewer: `/root/a0_artifact_concurrency`
- Reviewed at: `2026-08-30 13:05:40+08:00`
- Independence: fresh-context, read-only, no proposal authorship or mutation authority
- Approval SHA-256: `F625FEA72C98989EF780780F26DEF78645AC9360C93E62E580D9CA41648CCEEF`
- Reviewed material base: `039f81b7ae01708a74bda2f40ec0a543978f46c7`
- Result: `revision_required`

The reviewer independently recomputed the 13,451-byte canonical approval
contract and matched both the digest and material base reported by `trace`.
Schema, scope, existing authorization, and repository facts had no other
error, warning, or outside-scope path.

## Findings and parent disposition

`F-A0-01` (`HIGH`, `contract_gap`) was confirmed in scope. A bounded
`EEXIST`/`ENOENT` retry does not close the three-process transition where one
worker observes root X, another removes X, a third creates root Y, and the
first worker creates a generation under Y before detecting X/Y identity drift.
That sequence can leave an issued directory without a creator receipt. A
path-based final `rmdir` also cannot promise anchored deletion against an
actively replacing process.

`F-A0-02` (`MEDIUM`, `contract_gap`) was confirmed in scope. Scheduling stress
alone does not prove the exact root-creation, root-disappearance,
identity-replacement, `ENOTEMPTY`, or unexpected-error branches.

The parent accepts both findings. The contract is revised so concurrent
workers never reclaim the shared root: they remove only their exact
receipt-bound generation. A higher-level owner may reclaim an empty fixed root
only after its worker process set is quiescent, with no security or active-race
claim. Deterministic hook/failpoint tests must cover every allowed and rejected
transition; multi-process stress remains supplementary. The changed approval
contract requires fresh independent A0.
