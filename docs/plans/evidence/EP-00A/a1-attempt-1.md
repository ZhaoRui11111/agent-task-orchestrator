# EP-00A A1 attempt 1

## Report identity

- Reviewer: independent subagent `ep00a_a1_review`
- Review time: `2026-08-28 01:30:03+08:00`
- Reviewed material state: `git-sha1:c3f1479b57f9b7098bfd615b78655e9139f95630`
- Independence: fresh read-only reviewer; it did not implement EP-00A and changed no file, index, ref, worktree, permission, network, or external state.
- Scope: the complete schema-v3 plan, all 40 staged paths, V1-V8 evidence, all ADRs and normative owners, Tier 2 persistence guarantees, `.gitignore` ownership, link and scope gates, and predecessor ordering.

The reviewer's single helper trace had `errors=[]`, `warnings=[]`, and `outside_scope=[]`. It independently reconstructed the 39-entry, 4651-byte material manifest and obtained the state above; independently serialized the 14176-byte approval contract and obtained SHA-256 `A6A67EC6C4CDE678D43C443A85FE75E0CFEA420E876A01B555C35BDD9785CB4F`; confirmed 40 staged task-owned paths, 178 resolving local links across 38 Markdown files, the `.gitignore` and snapshot SHA-256 `2E3D40CD11F3909974C6DEEE93B2677A8619B5E46FD3F5090BAA3F5659ADD989`, twelve ADRs, no indexed roadmap, no successor plan, and only the master checkout.

## Findings and parent disposition

The parent independently inspected the cited contracts and confirmed every finding as in-scope. Every repair changes the task diff. HIGH and MEDIUM findings require fresh A2; F-A1-005 also changes the approval contract and therefore requires fresh A0 before implementation review can continue.

### F-A1-001 — HIGH — persistence cannot represent required identities and states

- Evidence: the domain waiting envelope permits nullable error summary, retry time, execution, workspace, and backend-thread identities, while the persistence constraint makes every waiting field non-null. Gate uniqueness omits identities that the completion/workspace owner defines as freshness identity. No durable integration-reservation record or writer/reader closure exists. Dispatcher persistence stores only unique trigger ID and omits the scheduler's schedule/config/scheduled-time deduplication tuple and per-delivery observations.
- Impact: valid waiting states cannot be stored; distinct current gate evidence can collide; target-ref exclusion lacks a durable single-writer owner; duplicate triggers cannot attach atomically to one canonical run.
- Required repair: align nullability; use the complete gate tuple; add reservations, scheduler run identity, and trigger observations with explicit writer/reader/transaction/index rules.

### F-A1-002 — HIGH — authorization and ProjectPolicy form a pre-mutation cycle

- Evidence: the authorization owner requires a current ProjectPolicy receipt before any mutation, external call, or intent write, while the adapter owner requires every call—including ProjectPolicy evaluation—to carry a persisted intent and final authorization-decision reference.
- Impact: acquiring the policy input requires the final decision that itself requires that input.
- Required repair: define a non-mutating, pre-final policy-query envelope authorized by preliminary trusted context; require the final decision and intent only for the subsequent mutation/effect.

### F-A1-003 — MEDIUM — exact adapter envelope and action vocabulary omit required operations

- Evidence: every adapter call currently requires Task and dispatcher-run identity, but scheduler registration/inspection/removal are Task-independent. The deny-unknown action list has no grant issuance or revocation action even though grant change is a guarded mutation.
- Impact: valid scheduler lifecycle calls and authorization administration have no conforming route.
- Required repair: make identity fields operation-class-specific; add scheduler and authorization-administration actions plus an explicit non-recursive trusted bootstrap rule.

### F-A1-004 — MEDIUM — waiting resume uses an impossible ready-only predicate

- Evidence: `waiting -> running` requires eligibility, but the only exact domain-eligibility predicate is true if and only if state is `ready`; waiting is explicitly never dispatcher-eligible.
- Impact: resume/retry cannot conform without weakening or inventing a rule.
- Required repair: add a distinct exact domain resume/retry predicate and reference it from the waiting transition while preserving ready-only dispatcher eligibility.

### F-A1-005 — MEDIUM — V6 contains a post-commit circular criterion

- Evidence: V6 was marked passed before a terminal commit existed, although its criterion also required roadmap absence from that future commit. The recorded evidence proved only snapshot, ignore, and index facts.
- Impact: V6 was unsupported and completion depended on a post-completion artifact.
- Required repair: keep completion-readiness V6 limited to snapshot/ignore/index facts; require terminal commit inventory and roadmap exclusion after commit and before successor work under the serial-chain rule. This approval-contract change stales A0.

### F-A1-006 — MEDIUM — validation records omit authoritative binary-evidence fields

- Evidence: the validation owner requires the exact criterion/outcome, state, exact command or manual procedure and working directory, material environment, exit status/observation, durable evidence identifier, runner/reviewer, time, and all unrun gates. The V1-V8 records and earlier evidence summary omit several of those fields; V3/V7 also asserted no conflicts despite F-A1-001 through F-A1-004.
- Impact: the recorded pass results are not reproducible or compliant completion evidence.
- Required repair: replace every result with complete per-gate evidence at the repaired final state, retain exact commands/procedures and observations durably, and rerun all material-bound gates.

## Required closure sequence

1. Revise V6 and the post-commit serial-chain requirement, return the plan to proposal, and obtain fresh independent A0.
2. Repair F-A1-001 through F-A1-004 and rebuild exact V1-V8 evidence at one final material state.
3. Record the current A1 findings as confirmed, in-scope, task-diff-changing, and `a2_required` with concrete closure evidence.
4. Obtain fresh independent A2 that closes exactly F-A1-001 through F-A1-006. Do not complete or commit before helper completion-readiness succeeds.
