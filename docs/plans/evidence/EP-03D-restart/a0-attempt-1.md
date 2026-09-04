# EP-03D A0 attempt 1 — revision required

Reviewer: `/root/ep03d_a0`

Reviewed at: `2026-09-04 10:56:12+08:00`

Reviewed material base: `9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33`

Approval contract: 17,407 canonical UTF-8 bytes, SHA-256 `12E8440C8DF91AC09759EF1361CE0C59E16537F284B3615F2FA98DD9FC0F08C6`

Independence: fresh independent non-drafter, non-reviser, non-implementer, strictly read-only, non-fail-fast A0 reviewer. The reviewer did not edit files, Git, the ExecPlan, coordinator state, fixtures, network state, credentials, external repositories, cleanup, integration, push, release, deployment, Codex account state, scheduler/MCP state, or `D:\quant`, and did not inspect or derive from the superseded `ep-03d` task.

Scope: activation readiness for the complete schema-v3 proposal under the A0 and Tier-2 persistence lenses; repository authority; relevant adapter, versioning, authorization, persistence, reliability, completion/workspace, toolchain, validation, privacy, threat, and current implementation owners; the Codex feasibility contract/checker; and current official OpenAI Codex SDK/App Server documentation. It excluded implementation quality, A1/A2, account-backed execution, dependency download, secrets, and external effects.

Evidence: one current trace exited zero with schema version 3, proposal status, HEAD/actual HEAD/approval material base/current material base all equal to the reviewed base, no error, outside-scope path, overlap, or pre-existing dirty path, and only `W_PREFLIGHT_LIFECYCLE_CYCLE` at V14. Independent canonical sorted-key compact UTF-8 serialization reproduced 17,407 bytes and the digest above. `terminal-resolve` uniquely returned the EP-03C terminal and `chain-check` succeeded. Final Git status remained exactly the task-owned untracked proposal. Official documentation establishes SDK thread start/continue/resume and `finalResponse`, while the App Server owns deeper authentication, history, approvals, and event surfaces; it does not prove the omitted thread-identity timing or terminal-evidence semantics.

Parent disposition: all three findings are confirmed, in scope, and approval-contract material. Revision 1 keeps the plan inactive, narrows EP-03D to a package-private non-composed adapter whose supported package/product routes remain Manual-only, strengthens the pinned-package hard gate, distinguishes Manual `workspaceMode=none` from Codex owned-workspace context, and removes the terminal lifecycle self-dependency. This attempt is superseded and a different fresh independent A0 is required.

## Findings

### F-A0-EP03D-001 — HIGH — current authorization cannot invoke Codex

The current vocabulary-v6 authorization contract limits execution operations to the local no-workspace Manual port and grants no Codex destination, credential, network, or Project-filesystem authority. Privacy rules also require current authorization naming the credential reference and destination. The original proposal nevertheless required operational Codex calls and authorization closure while forbidding vocabulary v7 and omitting authorization-owner implementation paths; activation would silently broaden existing grants or create an unlawful current route.

Minimum closure: narrow EP-03D to a non-composed adapter/contract result with no supported package-root or product/application construction route, and remove current-runtime Codex authorization claims. Any operational composition must obtain a later explicit authorization result binding destination, credential reference, and workspace effect; do not reinterpret vocabulary-v6 grants.

### F-A0-EP03D-002 — MEDIUM — SDK hard gate omitted identity timing and turn evidence

The original V2 could pass after proving only start, continuation, resume-by-ID, and cwd. It did not require proof that a new SDK thread exposes a readable durable identity at the required response-loss boundary or that completion/inspection evidence is bound to the exact awaited turn and distinct from raw model text. These are required by the goal, V6, the reliability owner, and the repository Codex feasibility contract; fake-driver tests cannot establish the production SDK surface.

Minimum closure: make pinned-package inspection prove the exact readable new-thread identity/timing and non-model-text terminal evidence for the awaited turn, or narrow the goal to the surface the package actually proves. Preserve no-account execution and `supportClaim=false`.

### F-A0-EP03D-003 — MEDIUM — V14 and M6 form a terminal lifecycle cycle

V14 originally required `completion_ready=true` and the completed plan/evidence already present in the clean terminal task commit. Completion readiness itself requires V14 and M6 terminal, while repository policy requires readiness before staging and only then creates the terminal commit. No honest pre-commit state could satisfy the criterion; the trace warning was therefore a real cycle, not a benign chain check.

Minimum closure: limit V14/M6 to pre-terminal audit and validation closure. Run the already authorized completed-plan, terminal-commit, chain, Git-flow gate, FF-only integration, and ordinary push lifecycle only after completion readiness.
