# RC04 A0 attempt 2

- Review status: complete
- Readiness: blocked
- Reviewer: `/root/rc01_a0_final`
- Reviewed at: `2026-09-01 02:38:13+08:00`
- Approval bytes: `16,959`
- Approval SHA-256: `3AF44EE366BC0BB9C786D00F19C82429C9B947A194437A3ACE83B76371AA1F45`
- Reviewed material base: `58aac50d3bed8d831c24b0169872384f54ae47d0`
- Trace state: `git-sha1:8d0b633eed6c37f753e5a362851d4d52022b5b70`
- Parent disposition: confirmed; approval contract revised; attempt superseded; fresh A0 required

## Independence and scope

This was a fresh independent read-only schema-v3 A0. The reviewer did not draft or edit the revised contract, enumerate its revised scope, implement RC04, run tests, edit repository content, mutate Git/index/coordinator/runtime/external state or grant authority. Attempt 1's conclusion was not inherited. The complete revised proposal, preserved attempt-1 report, contract history, plan/audit/Tier-2 rules, repository authorities, RC03 terminal chain, adjacent contracts, the full 4,320-line repository source, callers, backup and Domain transaction owners, exact inventories, six-module graph, 16 paths and RC05 exclusions were reread.

The reviewer invoked the required read-only `exec_plan.py trace` exactly once and independently reproduced 16,959 canonical bytes and the recorded SHA-256. Trace returned `ok=true`, `errors=[]`, `warnings=[]`, the expected base/HEAD, no outside-scope/overlap/pre-existing-dirty paths and the expected scoped proposal/evidence material. No test or mutation-capable command was run.

## Prior finding closure

F-RC04-A0-001 is closed because authorization now names exactly all six implementation modules. F-RC04-A0-002 is closed because C5 names the exact transaction file, limits uniqueness to the application-repository family and preserves the separate backup and Domain transaction owners; V2 and R3 carry the same boundary.

## Finding

### F-RC04-A0-003 — MEDIUM — dependency contract gap

C6 said the transaction module composes only model/state, but the preserved implementation necessarily needs transaction-to-digest and transaction-to-readers dependencies under the proposal's own ownership rules. `ApplicationTransaction.stateSha256()` directly calls `applicationStateSha256()`, assigned to the digest module. ApplicationTransaction also contains per-table request and execution-sequence readback SELECT/typed decoding, which C3/M1 assign to the sole readers module.

Without the missing edges, implementation would have to violate C6, leave or duplicate reader/digest ownership contrary to C3/M1, or alter preserved SQL/readback behavior. V2 therefore could not prove one exact approved graph.

Required change: authorize and assert the acyclic lower-level transaction dependencies on model, readers, digest and state; retain exclusive transaction ownership of application-family binding, ApplicationTransaction, writes/CAS and runWriteTransaction; keep SELECT/typed decoding in readers and hashing in digest; recompute the approval digest and obtain fresh independent A0.

Parent disposition: confirmed. C6, M1 and V2 now encode the full graph and delegation boundaries.

## Outcome

Attempt 2 is preserved as superseded evidence. It grants no authority. RC04 remains a proposal and implementation stays frozen until a fresh independent A0 accepts the revised approval contract.
