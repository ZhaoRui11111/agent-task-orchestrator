# EP-00A A2 attempt 1

## Report identity

- Reviewer: independent subagent `ep00a_a2_review`
- Review time: `2026-08-28 03:02:48+08:00`
- Reviewed material state: `git-sha1:19426e8560cb23c6f4ab53cfb3671b35d568e0bb`
- Independence: fresh read-only reviewer; it did not implement or repair EP-00A and changed no file, index, ref, worktree, permission, network, secret, or external state.
- Scope: the complete schema-v3 plan, A1 findings and dispositions, all 42 staged task-owned paths, the complete staged diff, V1-V8 evidence, all implicated authoritative owners, and all applicable Tier-2 persistence lenses.

The reviewer's helper trace had `errors=[]`, `warnings=[]`, and `outside_scope=[]`; it bound the report to the reviewed state above, 42 staged task-owned paths, base and HEAD `dfb4fd3fcf67d45bbf1a4c3b345260798c3ff28a`, `master`, and one current checkout. It independently recomputed the 14,405-byte canonical approval contract as SHA-256 `E77956C8160E46A2D39D11665EEA239257A5E2554499770537E47EB9642D22E7`, reran the exact V1-V8 support commands successfully, and confirmed that the original roots of F-A1-001 through F-A1-006 were repaired.

## Finding and parent disposition

The parent independently inspected the cited persistence, reliability, and scheduler contracts and confirmed the finding as in-scope and task-diff-changing. Because it is HIGH severity in the same closure family, this A2 attempt is reopened: EP-00A remains active, the affected V3/V7 results require replacement at the repaired material state, and the same A2 must be rerun freshly after repair.

### F-A2-001 — HIGH — durable fan-out cannot prove a complete candidate snapshot

- Evidence: `dispatcher_candidate_outcomes` had a mandatory terminal `outcome` but no separate membership record, pending lifecycle, expected candidate count, row revision, or transaction that persisted the complete candidate set before processing. The transaction text only required one eventual outcome per in-memory snapshot member. If a worker died before inserting a later candidate row, durable state could not distinguish an omitted member from a Task that never belonged to the snapshot.
- Impact: a crashed sweep could silently lose candidate membership, preventing truthful per-candidate accounting and making the terminal summary's no-missing-candidate assertion unverifiable.
- Required repair: atomically persist and seal the complete finite membership before any claim or external action; retain expected count and immutable member identities; CAS each pending member under current run ownership to exactly one terminal outcome; recover every unresolved member explicitly; publish a summary only after durable count, uniqueness, snapshot, and terminality checks pass.

## Required closure sequence

1. Repair the persistence representation, writer/reader/index/transaction closure, reliability fan-out protocol, and scheduler crash semantics without changing the approved scope or outcomes.
2. Rebuild all material-bound evidence at one repaired state, including fresh manual V3 and V7 reviews.
3. Run a fresh independent A2 that closes exactly F-A1-001 through F-A1-006 and finds no residual HIGH or MEDIUM defect.
