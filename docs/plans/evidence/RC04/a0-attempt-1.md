# RC04 A0 attempt 1

- Review status: complete
- Readiness: blocked
- Reviewer: `/root/rc01_a0_final`
- Reviewed at: `2026-09-01T02:18:28+08:00`
- Approval bytes: `15,892`
- Approval SHA-256: `931A48EFF9F4528C38C5B77A9703303297D819ED947CBAB4E772E7D62B5B2392`
- Reviewed material base: `58aac50d3bed8d831c24b0169872384f54ae47d0`
- Trace state: `git-sha1:9b5cc408df87fd98ce0a674ab5d943d1af7482d2`
- Parent disposition: confirmed; approval contract revised; attempt superseded; fresh A0 required

## Independence and scope

The reviewer was fresh and independent: it did not draft RC04, enumerate its scope, participate in implementation, edit repository content, run tests, mutate Git/index/coordinator/runtime/external state or grant authority. It invoked the required read-only `exec_plan.py trace` exactly once and independently canonicalized the approval contract.

The audit covered the complete schema-v3 proposal, plan/audit rules, Tier-2 persistence requirements, repository instructions and architecture, the terminal RC03 chain, adjacent persistence/ownership/toolchain/validation/security/reliability/authorization contracts, all 4,320 lines of `application-repository.ts`, backup and Domain transaction callers, exact source/package inventories and all 16 declared task paths. Trace returned `ok=true`, `errors=[]`, `warnings=[]`, no outside-scope/overlap/pre-existing-dirty paths, and the expected base/HEAD.

The reviewer confirmed that the six-module decomposition is feasible and acyclic, the declared scope closes the persistence and inventory obligations, current callers can retain the facade import, and RC05 plus future adapters remain excluded. No test or mutation-capable command was run.

## Findings

### F-RC04-A0-001 — MEDIUM — approval contract internal conflict

`approval_contract.authorization.allowed[0]` authorized moving code into “the five approved modules”, while the goal, C3, task paths, milestones and V2 consistently declared six modules: model, readers, digest, state, lifecycle and transaction. This left the sixth module''s mutation authorization ambiguous and required activation to fail closed.

Required change: authorize exactly the six named implementation modules, recompute the approval digest and obtain fresh independent A0.

Parent disposition: confirmed. The authorization now names all six modules exactly.

### F-RC04-A0-002 — MEDIUM — owner boundary and binary validation ambiguity

C5 named nonexistent `application-transaction.ts`, while the scoped owner is `src/persistence/application-repository-transaction.ts`. C5/V2/R3 also stated transaction-owner uniqueness without limiting it to the application-repository module family, even though out-of-scope `backup.ts` legitimately retains a separate backup binding and terminal lifecycle-authorization writer barrier and `repository.ts` retains Domain transaction owners.

Required change: name the scoped owner exactly; limit uniqueness and static-scan assertions to the six application-repository implementation modules and facade; explicitly preserve the backup and Domain transaction owners unchanged and out of scope; recompute the approval digest and obtain fresh independent A0.

Parent disposition: confirmed. C5, V2, R3 and adjacent summary language now express the exact application-family boundary and preserve the separate owners.

## Outcome

Attempt 1 is preserved as superseded evidence. It grants no authority. RC04 remains a proposal and implementation stays frozen until a fresh independent A0 accepts the revised approval contract.
