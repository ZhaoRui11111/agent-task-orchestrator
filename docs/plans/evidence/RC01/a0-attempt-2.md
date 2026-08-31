# RC01 A0 attempt 2

Fresh independent reviewer: `/root/rc01_a0_repeat`
Reviewed at: `2026-08-31 17:04:41+08:00`
Approval SHA-256: `35A9F659B4FC2DE0BCF6DB8B44D07482BB80087B9D8C7BB0D88510128E49F554`
Reviewed material base: `c95de33b104282292a0cd9203e66e5a1112cb3bd`
Readiness: `revision_required`

## Independence and scope

Fresh independent read-only schema-v3 repeat A0. The reviewer did not draft the proposal, participate in the first A0 or disposition/revise its findings, implement RC01, grant authority, or modify files, Git/index/refs/worktrees, coordinator, ExecPlan, runtime, permissions, network, test artifacts, or external state.

The review covered the complete revised proposal and attempt-1 report; repository guidance; PLAN-SCHEMA, A0-AUDIT and Tier-2 persistence guidance; current persistence, authorization, reliability, CLI/versioning, toolchain, validation, governance and Git-flow contracts; and current migration, database-open, repository, backup/restore, doctor, capability-upgrade and adjacent validation sources.

## Evidence

The current trace exited 0 with `errors=[]`, `warnings=[]`, `outside_scope=[]`, `overlap=[]`, `pre_existing_dirty=[]`, state `git-sha1:1592f137b78d23e9f0bf208bc86fe421ebe808a0`, and the expected base/HEAD. Independent canonicalization produced 19,559 approval bytes and reproduced the approval digest above.

F-RC01-A0-001 was closed by adding `test/execution-loop-authorization.test.mjs`. F-RC01-A0-002 was closed by allowing initialization only for an absent owner-created primary and preserving pre-existing empty/zero-length refusal. F-RC01-A0-003 was closed by separating pre-commit material completion from post-result-commit coordinator receipts. The remaining contract was otherwise coherent.

## Finding

### F-RC01-A0-004 — MEDIUM contract_gap

`test/application-atomicity.test.mjs`, `test/application-service.test.mjs` and `test/cli-security.test.mjs` still imported and executed the exact historical prefix/adoption fixtures that C8/M3 require deleting, but none was task-owned. Removing those helpers would break the complete test route; retaining them would violate fresh-only convergence; editing callers would exceed scope. Minimal closure: add exactly those three files and limit changes to retiring or re-expressing the obsolete prefix/adoption cases under already-approved fresh-current/refusal, atomicity and authorization-oracle outcomes.

## Parent disposition

The parent independently enumerated every `createVersion*Database` caller and confirmed that these were the only omitted callers; all other callers were already in scope. The finding is accepted as an in-scope MEDIUM contract gap. Attempt 2 is superseded by the narrow scope-only revision, and a fresh independent A0 is required.
