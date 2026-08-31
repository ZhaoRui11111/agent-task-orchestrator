# EP-02D A0 attempt 4

- Report status: complete
- Reviewer: `/root/ep02d_a0_reapproval2`
- Independence: fresh independent read-only A0; the reviewer did not draft EP-02D, implement its material diff, perform A1, or participate in the revised design decisions, and made no repository, Git, coordinator, runtime, artifact, network, permission, or external-state mutation.
- Reviewed at: `2026-08-31 13:01:04+08:00`
- Approval SHA-256: `D6C85C81225C6A716B48DA68977710F169110C74FB717440D94093AB0D5B574C`
- Reviewed material base: `0700d65e9c0db78626aa31baa56f15f009fef41e`
- Readiness: `revision_required`
- Parent disposition: accepted; all three findings are in scope and require a revised approval plus another fresh independent A0 before implementation repair.

The reviewer read the complete schema-v3 proposal and preserved A0/A1 history; the harness-exec-plan instructions and A0/Tier-2 persistence guidance; repository governance and authoritative architecture, CLI, versioning, authorization, persistence, reliability, adapter, scheduler, observability, privacy, threat, toolchain, validation and Git-flow contracts; the current dispatcher, dispatcher-application, execution, local ingress, product facade, CLI, authorization vocabulary and capability-status implementation; and the predecessor, Git base, task scope and canonical approval identity.

Fresh trace and scope both returned `ok=true`, `errors=[]`, `warnings=[]`, lifecycle `proposal`, approval bytes `35457`, approval/current material base and actual HEAD `0700d65e9c0db78626aa31baa56f15f009fef41e`, no base transition, empty index, `outside_scope=[]`, `overlap=[]`, `pre_existing_dirty=[]`, 40 task-owned worktree paths, and material state `git-sha1:96bb4d27cc181dcf970e852018037a5cd01d905f`. A separate canonical JSON computation reproduced the exact approval digest above. HEAD, local master and the local `origin/master` tracking ref matched the predecessor. The reason/manual-code correction was coherent with closed `ato.execution/v1`, and all six A1 findings remained preserved, confirmed, in scope, material-changing and routed to A2. `.task-artifacts` was absent. No tests or network access were used.

## Findings

### F-EP02D-A0-004 — MEDIUM — contract_gap

The approval cannot implement the owner repair through only `src/dispatcher.ts`. `DispatcherIngress.currentWorkerOwner()` currently owns the durable run, participates in exact trigger replay equality and becomes the atomically claimed execution owner. A fresh product worker therefore either makes the claimed execution unusable by later stable-owner Manual CLI processes and conflicts on same-key cross-process replay, or—if the stable owner is retained—continues to prevent expired-run takeover.

Resolution: include `src/dispatcher-application.ts` and the selected owner-level test path. Freeze a backward-compatible optional application seam separating run worker owner from execution lease owner. Existing callers without the seam retain the historical single-owner behavior. Product runs persist the fresh process worker only for run ownership/takeover, member claims persist the stable actor/root execution owner, and an equal trigger tuple for the same trusted actor may read/replay its canonical run across worker instances. Active expired continuation still requires the existing takeover CAS and old-worker fencing.

### F-EP02D-A0-005 — MEDIUM — fact_drift

V1 still required a proposal-only clean worktree even though this reapproval occurs after preserved A1 material exists. Trace showed 40 task-owned paths, an empty index and no outside-scope, overlap or pre-existing-dirty entry. Resetting, stashing or discarding that material is prohibited, so the criterion was no longer satisfiable.

Resolution: retain the historical coordinator-start clean receipt, but make every later reapproval require an empty index, complete task ownership, no outside-scope/overlap/pre-existing-dirty item, unchanged predecessor/base and preserved historical evidence.

### F-EP02D-A0-006 — MEDIUM — contract_gap

V12 incorrectly required actor/principal/owner and backend/thread/intent/receipt/finalization identities to disappear from durable audit. The authoritative privacy, authorization and schema-v7 contracts intentionally retain bounded opaque actor, correlation, target and protocol lineage. Removing it would exceed EP-02D's no-schema/no-reinterpretation boundary.

Resolution: keep sensitive sentinel content absent from both durable audit and public projections, but require identity/protocol lineage identifiers to be absent only from v2 JSON, human output, fixed errors and product projections. Preserve the existing bounded opaque audit identities and schema-v7 lineage.
