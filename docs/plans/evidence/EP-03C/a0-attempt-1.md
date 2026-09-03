# EP-03C A0 attempt 1 — revision required

Reviewer: `/root/ep03b_a0_7`

Reviewed at: `2026-09-02 21:13:16+08:00`

Reviewed material base: `2485608a1684ea6430adcb8d004979a90d689a69`

Reviewed material state: `git-sha1:44cea23c92ba201de1541d396fb5778c0f904ce1`

Approval contract: 42,937 canonical UTF-8 bytes, SHA-256 `230C110FAFCDFE0180EBE06D31BC08B22103CD9DDC8C897F3343D2508BF3806C`

Independence: fresh independent, non-author, non-implementer, strictly read-only, non-fail-fast A0 reviewer. The reviewer did not edit files or mutate Git, ExecPlan, coordinator, fixture, product, external, network, credential, cleanup, integration, push, release, deployment, or `D:\quant` state and did not run Node, pnpm, npm, npx, tests, builds, or fixtures.

Scope: the complete `harness-exec-plan` skill and its plan-schema, A0, and Tier-2 persistence lenses; repository authority; the complete schema-v3 proposal; relevant ADRs and adapter, authorization, completion/workspace, Domain, persistence, reliability, observability, toolchain, validation, versioning, CLI, privacy, threat, and Git-flow contracts; and the current schema, application-state writer/reader/digest, Manual-completion, workspace-v1, authorization-v5, package/export, and test inventory.

Evidence: one required read-only trace returned `ok=true`, empty errors/warnings/outside-scope/overlap/pre-existing-dirty, exact approval/current material base and HEAD `2485608a1684ea6430adcb8d004979a90d689a69`, and the state above. Independent sorted-key compact UTF-8 canonicalization reproduced the exact byte count and digest. EP-03B terminal resolution and chain check both matched the same commit; local `master` and `origin/master` also resolved there. Current facts were `ato.workspace/v1`, authorization stages 1–5, application-state digest version 1, no Phase 3 ports/application/tests, private `0.0.0-development`, zero production dependencies, and TypeScript as the sole development dependency. The current terminal-execution row can reference only a Manual completion decision, and the Manual completion owner atomically writes its decision, Domain completion, and execution terminal state.

Parent disposition: all six findings are confirmed, in scope, and approval-contract material. The proposal remains inactive. The parent will freeze a separate owned gate-evidence namespace, one generic completion-decision parent plus closed Manual/Phase-3 subtypes and atomic terminal-execution convergence, the complete integration-v1 envelope/state machine, ref-only checked-out-target-excluding apply plus hostile-config-safe local bare push, one exact workspace-v2 cleanup attestation, and application-state digest version 2. This attempt is superseded; fresh independent A0 is required after the revision.

## Findings

### A0-EP03C-001 — HIGH — gate evidence and cleanup topology conflict

Gate result evidence must remain reopenable, but the proposal did not freeze whether its manifest lives inside or outside the workspace. If it is inside and uncommitted, the stated cleanup rule rejects it as untracked/ignored/extra; if committed, the HEAD change immediately stales the receipt. The proposed end-to-end gate, completion, and cleanup path therefore was not provably reachable.

Minimum closure: freeze one exact gate-evidence parent/topology, ownership digest, exclusive-create and no-follow/single-link identity rules, reader, retention, cleanup inventory classification, and success/negative tests. Either explicitly allow a closed creator-owned disposable inventory or place evidence outside the target Git inventory without changing source HEAD.

### A0-EP03C-002 — HIGH — Phase 3 completion has no closed terminal lineage

The proposal did not define how a new Phase 3 completion decision relates to `manual_completion_decisions`, `tasks.completion_decision_id`, `execution_terminal_states`, verified execution evidence, the still-active attempt/lease, or Manual/Phase-3 mutual exclusion. The current terminal-state foreign key accepts only Manual decisions, while the current Manual owner atomically writes the terminal execution fact.

Minimum closure: freeze one complete decision/FK/check/trigger model, require Phase 3 completion to atomically write its accepted decision, Domain `running -> completed`, execution terminal fact, audit, and readback, and define replay, lease authority loss, stale-fence rejection, and Manual/Phase-3 exclusivity. Scope `src/execution-loop.ts` if the shared model changes its writer.

### A0-EP03C-003 — HIGH — integration-v1 contract and durable state machine are underspecified

The proposal named `inspect`, `apply`, and `push` but did not freeze their exact common and per-operation fields, closed receipt/failure/status/code sets, bounds, semantic idempotency identity, object/ref format, local/remote observations, operation class, or durable legal transitions. There was therefore no unique binary oracle for the proposed exact-envelope and partial-success tests.

Minimum closure: freeze the complete port union and application persistence state machine, including authorization/policy/reservation/fence binding, before/after local and remote observations, response-loss handling, replay, recovery, and one-field hostile-shape/restart/partial-success validation.

### A0-EP03C-004 — HIGH — Git apply/push primitive and hostile repository configuration are not closed

Updating a checked-out target ref without its index/worktree creates inconsistency, while checkout/materialization may execute repository-selected hooks, filters, submodules, sparse/alternate/replace behavior. A local-path push may execute receive-side hooks/config. The proposal did not choose an exact topology/primitive or require observable sentinel negatives.

Minimum closure: restrict apply to an exact expected-object CAS on a target ref not checked out by any worktree, with no index/worktree materialization, and freeze all repository/config/topology exclusions. Bind a canonical local bare destination beneath the trusted fixture root, reject hooks/config/alternates/helpers/proxy and unsafe paths, use an explicit non-force refspec and minimal trusted Git environment, re-observe after push, and prove hostile sentinels never execute or write externally.

### A0-EP03C-005 — HIGH — workspace-v2 cleanup attestation has no exact shape

The proposal required an application-issued policy/authorization/integration/no-live-owner attestation but did not define its fields, version, digest, validity, issuer, resource bindings, request placement, or receipt echo. The principal safety difference between workspace v1 and v2 was therefore not binary-auditable.

Minimum closure: freeze one cleanup-only versioned record binding policy receipt/config, cleanup grant/decision/confirmation, terminal Task/completion, gate/preservation digest, execution quiescence, terminal or absent integration reservation, expected HEAD/ref, workspace identity/revision/ownership, operation/intent, issue/valid times, and canonical digest. The application alone issues and revalidates it; the adapter consumes narrowing proof and echoes its digest; other operations require null. Add per-field substitution/staleness/expiry tests.

### A0-EP03C-006 — MEDIUM — application-state digest version is not exact

The current digest version is 1, but the proposal only said that it would advance. That allowed more than one implementation while also claiming old/future versions would be rejected.

Minimum closure: freeze `APPLICATION_STATE_DIGEST_VERSION = 2`, the complete v2 projection and canonicalization, and rejection of version 1, future, unknown, or malformed lifecycle state before writable open/effect while preserving bytes.
