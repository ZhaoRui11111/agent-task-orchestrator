# EP-03C A0 attempt 2 — revision required

Reviewer: `/root/ep03a_a0_3`

Reviewed at: `2026-09-02 21:38:50+08:00`

Reviewed material base: `2485608a1684ea6430adcb8d004979a90d689a69`

Reviewed material state: `git-sha1:2308925df7bb7d1ba89b7b90a03e7960323a369a`

Approval contract: 54,425 canonical UTF-8 bytes, SHA-256 `6D796B6CEE46BBE48C7A0AA10A421B81FAE9CCDA0086B090D3D998C101DA26F3`

Independence: fresh independent, non-author, non-implementer, strictly read-only, non-fail-fast A0 reviewer. No file, Git, ExecPlan, coordinator, fixture, product, integration, cleanup, push, release, deployment, network, credential, external-repository, or `D:\quant` mutation was performed; no Node, pnpm, npm, npx, test, build, fixture, or ignored-artifact inspection was run.

Scope: the complete ExecPlan skill/schema/A0/Tier-2 persistence instructions; repository authority; complete revised proposal and attempt-1 evidence; current trace and EP-03B chain; relevant authorization, adapter, completion/workspace, Domain, persistence, reliability, versioning, validation, Git-flow, observability, privacy, and threat owners; and targeted current migration/source/test/package inventory.

Evidence: independent canonicalization reproduced the exact byte count and digest. Trace was clean and bound base/HEAD to `2485608a1684ea6430adcb8d004979a90d689a69`; terminal-resolve and chain-check agreed, and local master/origin tracking matched. The reviewer confirmed that attempt-1 findings 001, 002, 004, and 006 were materially closed, that the revised gate-evidence and generic completion designs were reachable, and that V15's gate-stale/rerun, integration, completion, release, cleanup, retained-evidence, and fixture-teardown order was coherent. The Tier-2 writer/reader, intent-before-effect, fence, immutable receipt, ambiguity, and restart strategy otherwise remained closed.

Parent disposition: all four findings are confirmed, in scope, and approval-contract material. The proposal remains inactive. The parent will enumerate the complete integration receipt matrix; define exact sorted-key compact UTF-8 SHA-256 projections for cleanup attestation and quiescence; repair task scope; and distinguish the standing-authorized final coordinator `origin/master` push as the sole real-network exception from prohibited product, fixture, dependency, credential, and arbitrary network activity. This attempt is superseded and another fresh independent A0 is required.

## Findings

### F-A0-EP03C-007 — HIGH — integration receipt codes and legal matrix remain open

C17 listed operations, fields, bounds, local/remote states, and outcomes but left the code as merely “operation-specific closed”. It did not enumerate the inspect/apply/push code sets or the operation × outcome × before/after nullability × local/remote state × code × evidence/retry/finalization matrix. V2 and V10 therefore had no unique oracle.

Minimum closure: enumerate all receipt codes and the complete legal matrix, then bind C18 recovery and hostile-shape tests to it.

### F-A0-EP03C-008 — HIGH — cleanup attestation and quiescence digest projections are not deterministic

C20 named a canonical `attestationSha256` without defining whether the digest field is excluded or the exact serialization. The quiescence digest likewise lacked an input projection.

Minimum closure: define the exact attestation object and field names; compute uppercase SHA-256 over sorted-key compact UTF-8 JSON excluding only the digest field. Define quiescence identically over a named exact zero-owner/count projection, and require fixed positive/negative vectors plus receipt echo.

### F-A0-EP03C-009 — HIGH — required task paths are missing and one duplicate lifecycle path is spurious

`test/execution-claim-foundation.test.mjs` hard-codes the 35-action count; `test/cli-phase2-e2e.test.mjs` advances only through the old current stage; and `test/fixtures/fake-workspace-backend.mjs` emits workspace v1 without cleanup-attestation echo. All must change but were outside scope. The nonexistent singular `docs/plans/proposal/...` path was unnecessarily included beside the real plural proposals path.

Minimum closure: add those three existing paths and remove the singular typo.

### F-A0-EP03C-010 — HIGH — no-network prohibition conflicts with required final push

The proposal required the standing-authorized ordinary `origin/master` push while prohibiting every real network endpoint and remote URL. The configured origin is an SSH GitHub remote, so both rules could not be satisfied.

Minimum closure: preserve the required Git-flow outcome by naming its one standing-authorized coordinator push as the sole real-network exception. Keep product, fixture, dependency-audit, credential, arbitrary remote, and all other network access prohibited.
