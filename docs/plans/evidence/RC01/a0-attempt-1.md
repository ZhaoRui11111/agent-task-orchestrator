# RC01 A0 attempt 1

Fresh independent reviewer: `/root/rc01_a0`
Reviewed at: `2026-08-31 16:49:41+08:00`
Approval SHA-256: `44845FF57D53A0DA70D7AABC2CED1EAE397F5F0EF58BD044A62A0990D9032AEE`
Reviewed material base: `c95de33b104282292a0cd9203e66e5a1112cb3bd`
Readiness: `revision_required`

## Independence and scope

Fresh independent read-only schema-v3 A0. The reviewer did not draft the RC01 proposal or participate in its substantive design decisions, granted no authority, edited no file/Git/index/coordinator/ExecPlan/runtime/external state, ran no mutation-capable test, and invoked current `exec_plan.py trace` exactly once.

The review covered the unique RC01 proposal; repository `AGENTS.md`, `ARCHITECTURE.md` and `docs/plans/README.md`; PLAN-SCHEMA, A0-AUDIT and Tier-2 PERSISTENCE-AUDIT; current persistence, authorization, reliability, CLI/versioning and Git-flow contracts; and RC01-adjacent migration, application-repository, startup, backup/restore, doctor and validation-source facts. It checked goal/non-goals, explicit abandonment of pre-Phase-3 database prefixes/data, RC01 versus RC02-RC05 boundaries, authorization, scope, binary validation closure, writer/reader convergence, identity and pre-mutation refusal, staged capability semantics, backup/doctor intermediate states, risk/recovery, and execution-contract boundaries.

## Evidence

The single current trace exited 0 with `ok=true`, schema v3, proposal lifecycle, `errors=[]`, `warnings=[]`, `outside_scope=[]`, `overlap=[]`, `pre_existing_dirty=[]`, approval/current material base and actual HEAD all `c95de33b104282292a0cd9203e66e5a1112cb3bd`, only the untracked task-owned proposal, state `git-sha1:42db4ad5caec7ad520e245a1aff3abc6d8c1bdad`, and `next_action=run_a0`. Independent sorted-key compact UTF-8 canonicalization produced 18,889 bytes and the approval digest above.

Current sources confirmed seven migration-prefix readers, v6/v7 epoch/grant partitions and lifecycle-digest fallbacks, staged vocabulary 4-to-7 authorization, current-schema-gated backup/restore and read-only doctor recovery classification. The relayed current user directive explicitly authorizes abandoning pre-Phase-3 database prefixes/data but not weakening unrelated runtime identity safeguards.

## Findings

### F-RC01-A0-001 — MEDIUM contract_gap

`approval_contract.scope.task_paths` omitted `test/execution-loop-authorization.test.mjs`, which directly queries `authorization_grant_epoch_v6_links` and `authorization_grants_v6` and mutates their v6 triggers. Removing those approved tables makes the current test fail while V4/V5/V6/V9 require equivalent current-lineage evidence. Minimal closure: add exactly that test file and limit edits to equivalent single-table provenance, corruption and staged-upgrade assertions.

### F-RC01-A0-002 — MEDIUM contract_gap

C2, V2/V3 and D1 said an empty database may receive the baseline without distinguishing an owner-created fresh database from a pre-existing zero-length primary. The current boundary rejects a pre-existing empty primary before writable open; abandoning historical prefixes/data does not authorize weakening that topology safeguard. Minimal closure: allow only an absent primary newly reserved by the runtime owner and explicitly retain pre-existing-empty refusal before mutation.

### F-RC01-A0-003 — MEDIUM contract_gap

M4, V1, V10 and persistence wording required post-result-commit facts to be terminal inside the completed plan included in that sole result commit. Before the commit, `terminal-resolve`, clean-after-commit and coordinator prune cannot exist; after it, recording them would require a second commit. Minimal closure: make in-plan criteria completion-ready and pre-commit observable, while retaining commit, post-commit prune, exact-head gates, ready, integration and push as authorized coordinator receipts outside material-bound plan validation.

## Parent disposition

The parent independently reproduced all three findings and accepted them as in-scope MEDIUM contract gaps. Attempt 1 is superseded by the narrow contract revision recorded in the proposal; a fresh independent A0 is required before activation.
