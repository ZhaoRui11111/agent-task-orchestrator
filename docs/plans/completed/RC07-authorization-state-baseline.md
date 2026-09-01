# ExecPlan：重建当前授权状态基线

RC07 在没有历史运行时数据需要保留的前提下，把四个现行能力阶段、epoch/grant 状态和生命周期状态摘要重建为一套从 1 开始的当前模型。它保留逐次确认、有限能力、原子升级和拒绝未知状态的安全语义，不提供旧编号、旧摘要或旧投影兼容。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 11:08:18+08:00",
    "updated_at": "2026-09-01 12:47:27+08:00",
    "authorization": {
      "implementation": {"authorized": true, "by": "current user directive requiring strict serial completion of RC06, RC07 and RC08", "at": "2026-09-01 11:08:18+08:00"},
      "persistence": {"authorized": true, "by": "current user directive plus repository standing grants for commit, pathless prune, FF-only integration and ordinary push", "at": "2026-09-01 11:08:18+08:00"}
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Replace the historical authorization phase names, vocabulary versions 4/5/6/7, synthetic authorizationGrantEpochLinks state, preDispatcher/vocabularySeven digest partitions, authorization-ignoring digest wrapper, and state-digest version 4 with one clean current baseline: four semantically named cumulative finite action sets at vocabulary versions 1/2/3/4, one contiguous separately confirmed upgrade at a time, one exact epoch/grant model, and one canonical complete application-state projection/digest owner at digest version 1. Apply the same current-only model to fresh schema creation, Application behavior, lifecycle backup/restore authorization, restart decoding, documentation, package surface and tests; accept no prior vocabulary or digest format and add no migration or compatibility reader.",
    "non_goals": [
      "Do not change the current thirty authorization actions, their scopes, confirmation rules, finite expiry, revocation, delegation, policy evaluation, append-only request/decision/audit semantics, transaction ownership, or the requirement for three separate contiguous upgrades after bootstrap.",
      "Do not migrate, rewrite, normalize, repair, import, retain or read a database using vocabulary 4/5/6/7, state-digest version 4, the former partitioned digest shape, or any other noncurrent authorization summary.",
      "Do not change Task/Project semantics, execution claim/lease/fence behavior, Manual operation protocol, dispatcher behavior, backup manifest/restore intent/restore receipt schema version 2, public ato.api/v1 or ato.execution/v1 majors, or error-code meaning.",
      "Do not rewrite completed plans, historical audit evidence, prior changelog facts or Git history; do not disguise historical names in immutable records.",
      "Do not implement Phase 3 behavior, scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or platform-support claims.",
      "Do not delete or clean any existing worktree, branch, node_modules, dist, .pnpm-store, .local, external Codex worktree or user/runtime data."
    ],
    "constraints": [
      {"id": "C1", "statement": "RC06 terminal commit be07ede606c330ac398ec7f65fe6a58b503dee9e is the unique pushed predecessor; master and origin/master match it, coordinator state has no reservation or pending operation, and RC07 starts from that exact base.", "source": "current user directive; fresh terminal-resolve, scope, Git and harness-git-flow traces"},
      {"id": "C2", "statement": "The four cumulative authorization vocabularies are current semantic stages only: base local operations at version 1, claim/lease operations at version 2, reliable Manual operations at version 3, and dispatcher operation at version 4. The action inventory remains exactly 19, 23, 29 and 30 respectively.", "source": "current user directive; authorization contract; current action inventory"},
      {"id": "C3", "statement": "Bootstrap creates only version-1 origin grants. Each separately confirmed authorization.capability.upgrade advances exactly one version; renewal retains the current version; schema creation and restart never upgrade. Versions outside 1..4 and noncontiguous lineage are current-state corruption.", "source": "current user directive; Application and persistence authorization contracts"},
      {"id": "C4", "statement": "One epoch/grant model owns every current stage. Remove the ApplicationState authorizationGrantEpochLinks synthesis and all vocabulary-seven-specific state handling. Exact SQL capability_epoch_id lineage remains validated through the sole grant/epoch decoder and is never exposed as a compatibility projection.", "source": "current user directive; persistence model and decoder"},
      {"id": "C5", "statement": "One applicationStateProjection owner enumerates the complete current application state except lifecycle authorizations, whose digest would be self-referential. applicationStateSha256 hashes only that projection. It includes epochs and grants directly, uses current property names, has no pre-dispatch partition, and is the sole state digest consumed by upgrade/renewal CAS and lifecycle backup/restore authorization.", "source": "current user directive; lifecycle state-summary and persistence contracts"},
      {"id": "C6", "statement": "APPLICATION_STATE_DIGEST_VERSION is exactly 1. The schema inserts and accepts only state_digest_version=1; readers reject 4 and every other value. Remove applicationStateSha256ForLifecycleAuthorization and route all backup/restore callers directly to the one digest owner.", "source": "current user directive; clean-slate no-history decision"},
      {"id": "C7", "statement": "The current user's explicit no-deployed-data clean-slate directive is the narrow pre-release exception that replaces the presently immutable schema-version-1 baseline SQL and its registered LF checksum together. There is still one migration descriptor named current-baseline, no second migration, no compatibility table/view/trigger and no old-state reader. RC07 updates the scoped current contracts to make the replacement baseline the sole terminal immutable rule; it does not derive this exception from the pre-RC07 persistence, toolchain or versioning contracts.", "source": "current user directive; AGENTS.md authority order and conflict rule; scoped persistence, toolchain and versioning contracts after convergence"},
      {"id": "C8", "statement": "Confirmation binding, finite grants, one-step upgrades, stale-preflight CAS, append-only provenance, no wildcard/content-derived authority, redaction, backup/restore authorization freshness, and all execution/dispatcher fences remain exact.", "source": "authorization, reliability, CLI and privacy contracts"},
      {"id": "C9", "statement": "Remove historical phase/vocabulary/digest naming only from live source, the current baseline, authoritative current contracts and active tests. Completed plans/evidence and prior changelog entries remain byte-unchanged; add one new changelog fact for RC07.", "source": "current user directive; repository governance"},
      {"id": "C10", "statement": "Use only task/rc07-authorization-state-baseline and its coordinator worktree. Fresh independent A0 precedes activation; fresh independent A1 follows stable validation; required A2 is independent. Then one result commit, pathless prune, fourteen exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, reset, rebase, stash, clean and force are prohibited.", "source": "current user directive; harness skills; local-agent-git-flow"},
      {"id": "C11", "statement": "This is a clean-slate durable schema and state-summary convergence with no deployed data. Validation must prove writer/reader parity, unknown/old format refusal before mutation, exact summary sensitivity to every current state family, restart/backup/restore closure and truthful absence of migration behavior.", "source": "harness-exec-plan persistence lens"}
    ],
    "authorization": {
      "allowed": [
        "Create/update this schema-v3 plan and evidence; edit declared paths; semantically rename cumulative authorization stages; renumber current vocabularies to 1..4; reset the current application-state digest to version 1; remove the synthetic link, partitioned projection and ignored-argument wrapper; update the sole baseline SQL/checksum and current contracts/tests.",
        "Run impact-selected authorization, Application, persistence, lifecycle, reliability, dispatcher, CLI, package, SQLite, documentation and complete offline validation using only validation-owned disposable .task-artifacts.",
        "Use independent read-only A0/A1/required A2; create one task-owned result commit; invoke standing-authorized pathless prune; record fourteen exact-head gates; mark ready; FF-only integrate; and use standing-authorized ordinary origin/master push."
      ],
      "requires_reapproval": [
        "Any change to the thirty actions, scope/confirmation/expiry/revocation/delegation/policy semantics, number or order of upgrade steps, request/decision/audit meaning, transaction owner, Task/Project state, execution/dispatcher protocol, backup family format version, public major, or error meaning.",
        "Any migration, legacy reader, old digest compatibility branch, repair tool, retained-data promise, new dependency/module, unrelated public capability or out-of-scope file.",
        "Any network/secret action beyond standing push, PR, non-FF integration, release, deployment, destructive cleanup or user/runtime-data mutation."
      ],
      "prohibited": [
        "Delete, clean, adopt or impersonate any existing branch, worktree, generated store, external Codex worktree, runtime, backup or user data.",
        "Rewrite completed plans, evidence, prior changelog history or Git history to hide the former numbering and projection.",
        "Implement Phase 3 or any explicitly unimplemented product/integration capability."
      ],
      "persistence": {
        "required": true,
        "action": "one terminal RC07 result commit followed by coordinator pathless prune, fourteen exact-head gates, ready, FF-only integration and standing-authorized ordinary origin/master push",
        "source": "current user directive; AGENTS.md; local-agent-git-flow"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC07-authorization-state-baseline.md", "kind": "file"},
        {"path": "docs/plans/active/RC07-authorization-state-baseline.md", "kind": "file"},
        {"path": "docs/plans/completed/RC07-authorization-state-baseline.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC07", "kind": "directory"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "migrations/0001-current-baseline.sql", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "src/authorization.ts", "kind": "file"},
        {"path": "src/application-input.ts", "kind": "file"},
        {"path": "src/application-policy.ts", "kind": "file"},
        {"path": "src/application-service.ts", "kind": "file"},
        {"path": "src/cli-api-runtime.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-digest.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-lifecycle.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-model.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-readers.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-state.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-transaction.ts", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/authorization.test.mjs", "kind": "file"},
        {"path": "test/cli-phase2-e2e.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-application.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-security.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-foundation.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-authorization.test.mjs", "kind": "file"},
        {"path": "test/persistence-module-architecture.test.mjs", "kind": "file"},
        {"path": "test/persistence-repository.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {"id": "M1", "outcome": "Freeze the four semantic stages, versions 1..4, single state projection/digest owner, current-only schema boundary, predecessor, scope, authorization and binary evidence.", "validation_ids": ["V1", "V2"]},
      {"id": "M2", "outcome": "Application bootstrap, renewal and separately confirmed contiguous upgrades consume the renamed 1..4 vocabulary owner with unchanged finite authorization behavior.", "validation_ids": ["V2", "V3"]},
      {"id": "M3", "outcome": "The sole fresh baseline and decoder persist only versions 1..4 and digest version 1, remove synthetic state, and reject all prior/unknown durable formats without repair.", "validation_ids": ["V4", "V5"]},
      {"id": "M4", "outcome": "One direct canonical state projection/digest drives CAS and lifecycle backup/restore while current reliability, dispatcher, CLI and package behavior stay exact.", "validation_ids": ["V5", "V6", "V7"]},
      {"id": "M5", "outcome": "Stable material passes focused/full gates, independent A1/required A2, exact inventory and completion-ready checks before terminal persistence.", "validation_ids": ["V8", "V9"]}
    ],
    "validations": [
      {"id": "V1", "type": "manual", "target": "RC06 continuity and activation readiness", "criterion": "RC06 terminal-resolve/scope pass at be07ede606c330ac398ec7f65fe6a58b503dee9e; RC06-to-RC07 chain-check passes; current trace has errors=[], warnings=[], outside_scope=[]; fresh independent A0 reproduces approval digest/base and returns ready_for_activation with no unresolved finding."},
      {"id": "V2", "type": "automated", "target": "Single semantic vocabulary owner", "criterion": "Static and export checks find exactly four cumulative current action sets with counts 19/23/29/30 and versions 1/2/3/4; live source/current contracts/active tests contain none of PHASE1_AUTHORIZATION_ACTIONS, PHASE2A_AUTHORIZATION_ACTIONS, PHASE2B_AUTHORIZATION_ACTIONS or vocabulary 5/6/7 current semantics; exact action inventory and high-risk set remain unchanged."},
      {"id": "V3", "type": "automated", "target": "Authorization Application behavior", "criterion": "Bootstrap creates only version 1; three separately confirmed calls advance 1-to-2, 2-to-3 and 3-to-4; renewal retains its current version; skip/replay/stale preflight/revoked/expired/wrong identity/failpoint paths reject or roll back atomically; grant counts, provenance, decision/audit and public capability counts stay exact."},
      {"id": "V4", "type": "automated", "target": "Fresh schema and current-only decode", "criterion": "Baseline SQL accepts only bootstrap version 1, epoch versions 1..4 and state_digest_version 1; its registered checksum/fingerprint/history pass. Raw old/unknown vocabulary and digest values are rejected as typed current-state corruption before writable mutation and remain byte-exact; no migration, view, trigger, branch or fallback accepts them."},
      {"id": "V5", "type": "automated", "target": "Canonical state projection and lifecycle digest", "criterion": "One exported projection enumerates every current non-lifecycle ApplicationState family exactly once using direct epochs/grants and projects; authorizationGrantEpochLinks, preDispatcher/vocabularySeven partitions and the authorization-ignoring wrapper are absent. Digest changes for each representative authorization, execution, Manual and dispatcher state mutation; upgrade/renewal and lifecycle backup/restore CAS use only that owner at version 1."},
      {"id": "V6", "type": "automated", "target": "Persistence, backup/restore and reliability regression", "criterion": "Application/persistence atomicity, execution claim/lease/fence, reliable Manual loop, dispatcher authorization/takeover/replay, lifecycle backup/restore/doctor, schema-corruption and restart suites pass without semantic drift or duplicate effect."},
      {"id": "V7", "type": "automated", "target": "CLI and package surface regression", "criterion": "Source and installed ato.api/v1 flows require one confirmed contiguous upgrade per call, report exact capability counts, preserve fixed public errors/redaction and expose the intended renamed current symbols with no removed historical export or compatibility wrapper."},
      {"id": "V8", "type": "automated", "target": "Complete repository regression and documentation", "criterion": "Pinned typecheck/build, full tests, test:persistence, package smoke, SQLite feasibility, docs check and pnpm verify:offline exit zero with no dependency drift, support expansion or omitted applicable route; current docs state only the clean model and immutable history has no diff. Before the result commit, any present registered .task-artifacts root is safe, ignored, untracked, free of tracked overlap and explicitly inventoried as retained failed-run diagnostics; the final successful wrapper preserves its observed baseline exactly and introduces no new residue. Root absence and its exact-head security receipt are exclusively post-result-commit coordinator prune evidence, not a material-bound pre-commit result, and no manual or pre-commit deletion is performed."},
      {"id": "V9", "type": "manual", "target": "Stable review, inventory and terminal workflow", "criterion": "Fresh independent A1/required A2 complete; diff checks pass; staged inventory contains only declared regular paths; final pre-commit trace has errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false and no derived blocker before exact-head Git-flow transitions."}
    ],
    "risks": [
      {"id": "R1", "risk": "Mechanical renaming may leave a second historical action-set owner or an incorrect cumulative inventory."},
      {"id": "R2", "risk": "Renumbering may accidentally permit a skipped upgrade, upgrade on renewal or altered grant/confirmation semantics."},
      {"id": "R3", "risk": "Changing the baseline without every decoder/writer/checksum update may create an inconsistent or silently accepted durable format."},
      {"id": "R4", "risk": "A simplified digest may omit a current state family, retain a compatibility partition, or become self-referential through lifecycle records."},
      {"id": "R5", "risk": "Removing the ignored-argument wrapper may weaken backup/restore provenance or stale-state refusal at one call site."},
      {"id": "R6", "risk": "Current-document cleanup may rewrite immutable historical evidence or overclaim Phase 3/support behavior."},
      {"id": "R7", "risk": "Focused success may miss package, SQLite, dispatcher, backup or complete-suite regressions and validation residue."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Name the cumulative stages BASE_AUTHORIZATION_ACTIONS, CLAIM_AUTHORIZATION_ACTIONS, MANUAL_AUTHORIZATION_ACTIONS and AUTHORIZATION_ACTIONS; retain semantic extension inventories for claim, Manual and dispatch actions.", "rationale": "Names describe current authority rather than retired product phases while preserving one finite action owner."},
      {"id": "D2", "statement": "Define AuthorizationVocabularyVersion as 1|2|3|4 and map versions to the four cumulative sets through one actionsForVocabulary owner.", "rationale": "A fresh current baseline needs contiguous numbering without altering the number or order of explicit upgrade steps."},
      {"id": "D3", "statement": "Remove authorizationGrantEpochLinks from ApplicationState and digest direct epochs and grants without vocabulary-specific partitions.", "rationale": "The decoder already validates SQL epoch/grant lineage; a synthetic last-stage projection exists only for historical digest compatibility that is now prohibited."},
      {"id": "D4", "statement": "Add APPLICATION_STATE_DIGEST_VERSION=1 and applicationStateProjection as the only current state-summary owner; applicationStateSha256 hashes it and all CAS/lifecycle callers use that function directly.", "rationale": "One named projection makes completeness testable and removes ignored arguments and partitioned history."},
      {"id": "D5", "statement": "Under the current user's explicit narrow pre-release clean-slate exception, replace the sole current baseline constraints and registered checksum in place, then reject every noncurrent vocabulary/digest value as corruption with no migration or repair.", "rationale": "No deployed runtime data exists; RC07 replaces the pre-RC07 immutable baseline under higher-authority user authorization and makes the resulting fresh schema-version-1 baseline the only terminal immutable contract."},
      {"id": "D6", "statement": "Edit only current contracts/new changelog evidence; leave completed artifacts and prior changelog bullets unchanged.", "rationale": "Current truth converges without falsifying history."},
      {"id": "D7", "statement": "Complete one reviewed result commit, pathless prune, fourteen gates, ready, FF-only integration and ordinary push; never cleanup.", "rationale": "This is the authorized serial Git-flow."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep proposal status and obtain fresh A0 after any approval correction."},
      {"id": "M2", "recovery": "Restore one semantic action owner and exact one-step upgrade behavior; do not retain aliases for removed stage names."},
      {"id": "M3", "recovery": "Keep invalid database evidence, correct the current baseline/decoder/checksum together and never migrate or repair the fixture."},
      {"id": "M4", "recovery": "Enumerate the complete current state once, remove any partition/wrapper fallback and rerun lifecycle/reliability closure."},
      {"id": "M5", "recovery": "A failed gate remains reserved/editable; repair, revalidate and refresh review/receipts without reset, rebase, stash, clean or force."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "approval"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"},
      {"id": "V8", "state_binding": "material"},
      {"id": "V9", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Assert exact export names, counts, deduplication, cumulative membership and live-zero historical symbols.", "recovery": "Remove alias/duplicate arrays and restore exact cumulative inventories."},
      {"id": "R2", "mitigation": "Table-drive all bootstrap/renew/upgrade versions, confirmations, failpoints and CAS competitors.", "recovery": "Restore the one-step assessment and transaction boundary before any further state change."},
      {"id": "R3", "mitigation": "Bind SQL constraints, reader types, writer literals, checksum, schema fingerprint and raw corruption fixtures in one validation state.", "recovery": "Preserve fixture bytes and fix the sole baseline path; never add a migration."},
      {"id": "R4", "mitigation": "Test the projection's exact keys against ApplicationState and perturb representative records from every state family.", "recovery": "Add the missing current field to the sole projection or remove the duplicate/legacy field; never partition by version."},
      {"id": "R5", "mitigation": "Replace every wrapper call with applicationStateSha256 and run backup creation, verification, restore, crash and stale-state suites.", "recovery": "Repair the direct call site without restoring the ignored parameter wrapper."},
      {"id": "R6", "mitigation": "Search only live source/current contracts/active tests for zero assertions and separately verify completed history blobs have no diff.", "recovery": "Restore accidental historical edits and correct only current/new material."},
      {"id": "R7", "mitigation": "Run focused routes, stable A1, then package/SQLite/full offline at one state and coordinator pathless prune after commit.", "recovery": "Keep active/reserved, retain failed diagnostics and rerun the complete affected route without manual cleanup."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "be07ede606c330ac398ec7f65fe6a58b503dee9e",
      "current_material_base": "be07ede606c330ac398ec7f65fe6a58b503dee9e",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 12:24:19+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 12:31:37+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 12:31:37+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 12:31:37+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-01 12:47:27+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Resolve the completed RC06 terminal and scope, run RC06-to-RC07 chain-check, inspect the current proposal trace, and obtain a fresh independent read-only A0 attempt 3 with independent canonical approval-digest reproduction after preserving both earlier A0 states as reopened/stale history.",
        "evidence": "RC06 resolves uniquely and completion-ready at be07ede606c330ac398ec7f65fe6a58b503dee9e; RC06-to-RC07 chain-check binds RC07 to that exact predecessor. The current trace returns errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true and state git-sha1:32f16ef1d95538c4794d0e798f5a378db60f7b2d. Fresh independent /root/rc07_a0 attempt 3 independently reproduced 17990 canonical approval bytes and SHA-256 7DA4FDACC2341CAC3314970EEB26A826BE4C5841386776AA611DC702C82B2819 at the exact base, verified both earlier revision histories and the satisfiable result-commit-to-prune artifact boundary, and returned ready_for_activation with findings=[]. The parent independently accepted the report.",
        "state_id": "approval-sha256:7DA4FDACC2341CAC3314970EEB26A826BE4C5841386776AA611DC702C82B2819"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Inspect the sole authorization owner and exact architecture exports, run focused authorization/architecture tests and scan live source, current contracts and active tests for every retired stage/link/partition/wrapper identifier.",
        "evidence": "BASE_AUTHORIZATION_ACTIONS, CLAIM_AUTHORIZATION_ACTIONS, MANUAL_AUTHORIZATION_ACTIONS and AUTHORIZATION_ACTIONS contain exactly 19, 23, 29 and 30 duplicate-free cumulative actions; versions are exactly 1, 2, 3 and 4 through one actionsForVocabulary owner. Exact export/identity tests pass. The live retired-identifier scan returns zero for all former phase arrays, authorizationGrantEpochLinks, preDispatcher/vocabularySeven partitions and applicationStateSha256ForLifecycleAuthorization; the exact thirty-action and high-risk inventories remain unchanged.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run the focused Application/authorization/claim/Manual/dispatcher authorization tests and the complete repository suite under pinned Node 24.19.0.",
        "evidence": "Bootstrap creates only version 1; three separately confirmed calls advance exactly 1-to-2, 2-to-3 and 3-to-4; renewal retains the current version. Skip, replay, stale preflight, wrong identity, expiry, revocation and every staged failpoint remain typed no-write or atomic rollback paths. Grant counts, direct epoch lineage, provenance, decision/audit and public capability counts are exact in the 102/102 focused and 432/432 complete passes.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Validate canonical baseline bytes/checksum/schema constraints and run table-driven read-only raw corruption cases in isolated Node processes.",
        "evidence": "The 93965-byte LF baseline accepts only bootstrap version 1, epoch versions 1..4 and state_digest_version 1; its SHA-256 518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA matches the registry, persistence contract and migration test. Unsupported bootstrap 4, epoch 5, unknown epoch 99, digest 4 and unknown digest 99 are each injected after dropping only the fixed immutable trigger inside an isolated child; readApplicationState returns typed CORRUPT_ROW and raw readback proves the stored value is unchanged. No migration, view, compatibility branch or repair accepts them.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Inspect the direct digest owner and run projection-key, per-family perturbation, lifecycle-exclusion, architecture and lifecycle authorization tests.",
        "evidence": "applicationStateProjection has exact key equality with every ApplicationState property except lifecycleAuthorizations, includes direct epochs/grants/projects and contains no historical partition or synthetic link. Representative changes in every projected authorization, Domain, execution, Manual and dispatcher family alter applicationStateSha256; lifecycle-only drift does not create self-reference. APPLICATION_STATE_DIGEST_VERSION is 1, and upgrade, renewal, backup and restore authorization call only the direct digest owner.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run the complete persistence route and the full repository regression under the pinned runtime.",
        "evidence": "pnpm test:persistence passes 104/104. The post-evidence complete route passes 432/432 with zero fail/cancel/skip/todo. Coverage includes Application transaction atomicity, claim/lease/fence and stale writers, every reliable Manual checkpoint, dispatcher reconciliation/takeover/replay, restart, lifecycle backup/restore/doctor, schema corruption, raw current-only refusal and no duplicate external effect. Both accepted wrappers preserve artifact baseline 208-to-208.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run CLI source/restart/security coverage and the full offline package smoke from the retained regular-file task-local store.",
        "evidence": "Source and installed ato.api/v1 paths preserve the exact three separately confirmed contiguous upgrades, capability counts, fixed errors and redaction while ato.execution/v1 remains independent. Package smoke passes with pnpm 11.19.0, TypeScript 5.9.3, 172 packed files, consumer types, exports, persistence, source-built-installed console parity and uninstall. The retained .pnpm-store contains 133 regular files and zero reparse member; no store, node_modules or dist directory was deleted.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Invoke pnpm verify:offline from the beginning after the evidence file was present, then inspect current documentation/history boundaries, diff hygiene and the registered artifact inventory.",
        "evidence": "The exact candidate passes lint 223/43, strict typecheck, build, tests 432/432, docs 111 Markdown files/252 links/22 fragments/forbidden=0, dependency policy with zero production dependencies, 172-file package smoke, Windows 10.0.22631 x64 Node 24.19.0 SQLite 3.53.3 feasibility with survivingGenerationMembers=0, and Codex boundaryStatus=passed/evidenceMode=blocked/externalE2E=not_run/supportClaim=false. git diff --check passes. Current docs describe only the clean model and historical completed material has no diff. The safe ignored diagnostic root is untracked with zero tracked overlap and zero reparse member; 208 baseline entries equal 208 terminal entries, so the successful run introduced no residue. Root absence remains reserved for the post-result-commit pathless prune.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Accept the fresh independent stable-state A1, determine that no A2 is required, verify exact staged regular-file inventory and perform the terminal schema-v3 lifecycle transition and completion trace.",
        "evidence": "Fresh independent /root/rc07_a1 reviewed the exact git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86 candidate, independently reproduced the 17990-byte approval digest, audited the complete 39-path diff and registered diagnostics, and returned findings=[] with closure_required=false and A2 not required; parent disposition is complete. Before lifecycle migration, the index contained exactly 39 declared paths, each a regular non-reparse 100644 file, with unstaged=0, tracked artifact overlap=0 and cached diff check passing. The lifecycle move replaces only the declared active plan with its declared completed path. The final pre-commit trace is run immediately after staging that move and must return errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false, completion_ready=true and no blocker at the same material state.",
        "state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc07_a0",
        "independence": "Fresh independent read-only schema-v3 A0 attempt 3. Prior A0 conclusions were treated only as historical evidence. The reviewer did not author or disposition either revision, implement RC07, mutate repository/Git/index/ref/worktree/coordinator/runtime/network/permission/external state, run mutation-capable validation, or grant authority.",
        "scope": "Complete current RC07 proposal; AGENTS.md; ARCHITECTURE.md; authorization, persistence, reliability, CLI, toolchain, versioning, validation and local Git-flow contracts; prior A0 attempts and both contract revisions; full 37-path frozen implementation diff; schema, source and active tests; current registered .task-artifacts inventory; and the complete Tier-2 persistence transition lens.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 12:24:19+08:00",
        "approval_sha256": "7DA4FDACC2341CAC3314970EEB26A826BE4C5841386776AA611DC702C82B2819",
        "reviewed_material_base": "be07ede606c330ac398ec7f65fe6a58b503dee9e",
        "evidence": "Independent compact sorted-key UTF-8 canonicalization reproduced exactly 17990 bytes and the stored digest. Exactly one current read-only trace exited 0 with errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true, base_transition_count=0, exact base/HEAD be07ede606c330ac398ec7f65fe6a58b503dee9e and state git-sha1:32f16ef1d95538c4794d0e798f5a378db60f7b2d. All 37 implementation paths are task-owned. The reviewer confirmed the V8 revision changes only evidence timing: the ignored, untracked diagnostic root has zero tracked overlap, sixteen retained generations, 192 directories, sixteen regular sqlite files totaling 12328960 bytes, and zero reparse nodes; the wrapper preserves a nonempty baseline exactly, while root absence/security receipt remain exclusively post-result-commit coordinator prune evidence. The exact Git-flow ordering, no-manual-delete rule, scope and runtime/external authority remain unchanged. Tier-2 writer/reader/refusal/projection/digest/restart/backup/restore closure is complete; the 93965-byte LF baseline SHA-256 518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA matches all owners; removed live symbols/partitions/wrapper/old current versions are absent; exact actions, confirmations, public majors, fencing and future-capability non-claims remain intact. Read-only diff check passed and findings=[].",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc07_a1",
        "independence": "Fresh independent read-only schema-v3 A1. The reviewer did not participate in RC07 A0, planning, implementation, repair, validation execution, authorization or parent disposition; made no filesystem, Git/index/ref/worktree, coordinator, runtime, network, secret, permission or external-state mutation; and ran no test, build or package command.",
        "scope": "Complete 39-path RC07 candidate: all 37 implementation/contract/test paths, the active ExecPlan and RC07 validation evidence; complete diff from be07ede606c330ac398ec7f65fe6a58b503dee9e; AGENTS.md and ARCHITECTURE.md; authorization, persistence, reliability, CLI, toolchain, versioning, validation and local Git-flow contracts; both approval revisions and all A0 history; baseline SQL/checksum; affected source owners, callers, tests, package surface, documentation/history boundary and registered ignored artifact inventory.",
        "reviewed_at": "2026-09-01 12:45:12+08:00",
        "evidence": "Exactly one read-only trace exited 0 with errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true, exact base/HEAD be07ede606c330ac398ec7f65fe6a58b503dee9e and state git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86. Independent canonicalization reproduced 17990 approval bytes and SHA-256 7DA4FDACC2341CAC3314970EEB26A826BE4C5841386776AA611DC702C82B2819. The reviewer confirmed the exact 19/23/29/30 cumulative actions and 1..4 upgrade semantics; removal of synthetic link/partitions/wrapper/compatibility branches; complete non-lifecycle projection and direct digest-version-1 consumers; raw bootstrap 4, epoch 5/99 and digest 4/99 refusal without rewrite; exact 93965-byte baseline SHA-256 518E84129E6753E7D0E5078223DCCB43E155AA2FD2120DD2A4C3F5F633FCEBFA; claim/Manual/dispatcher/restart/backup/restore/public-major/error/fence/redaction/non-Phase-3 closure; unchanged completed history; and an internally consistent final 223/43, 432/432, 111/252/22/0, 172-file, SQLite 3.53.3 and blocked-Codex result. The registered manifest blob 49507c5e7c2cb284457e29e5e7014324bc5dcf9d owns only .task-artifacts; its 208 entries are ignored, untracked, zero-overlap, zero-reparse and successful-wrapper invariant 208-to-208, with absence correctly deferred to post-result-commit pathless prune. Read-only diff check passed and findings=[].",
        "reviewed_state_id": "git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86",
        "parent_disposition": "complete",
        "closes": [],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-RC07-A0-001",
          "F-RC07-A0-002"
        ],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-09-01 11:24:46+08:00 found two MEDIUM approval gaps under digest 45DD370045247997A83B009A934326D1AC917CC62060DE06F17950854F23653A: the live compatibility matrix remained outside scope while naming vocabulary 7 as current, and C7/D5 incorrectly attributed the clean-slate baseline replacement to contracts that presently require immutability. Scope and the narrow higher-authority exception were corrected; fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent read-only A0 at 2026-09-01 11:29:45+08:00 accepted digest 7C8FA26191FE179E4DD8584D5D7619CDDADC3356A2509A3EDD2DE9B4E4F8C822 with no finding and activated RC07. Later failed decoder-test attempts left registered diagnostics that the current user forbids deleting manually and that the standing Git-flow grant permits pruning only after the result commit. Parent inspection found V8 still required pre-commit absence, so the parent reopened only that artifact-timing clause and requires fresh A0 before relying on the revised approval contract."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V4",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-01 12:31:37+08:00",
        "evidence": "Recorded after the stable rerun: the first focused decoder-corruption candidate passed 97/102 but five cases left raw SQLite statements/triggers live in the parent process long enough for Windows fixture cleanup to fail after the intended assertions. The tests were repaired in scope by performing trigger removal, corruption, read-only decoder refusal and raw readback inside isolated child processes. The immediate focused rerun passed 102/102; retained failed-run diagnostics were preserved for coordinator prune rather than manually deleted.",
        "state_id": null
      },
      {
        "validation_id": "V8",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 12:31:37+08:00",
        "evidence": "Recorded after the accepted rerun: the first complete route passed lint, typecheck, build, 432/432 tests, docs and dependency policy, then package smoke stopped before packing because the linked worktree lacked its required local .pnpm-store. Exactly 133 verified regular cache files were copied from the retained RC06 task store with zero reparse member, no deletion and no network access. The complete route was rerun from the beginning and passed; adding this evidence file later triggered one further complete post-evidence pass at the final material state.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-01 11:26:44+08:00",
        "summary": "Added the live compatibility matrix to scope and corrected C7/D5 to record the current user's narrow no-deployed-data pre-release exception to the pre-RC07 immutable baseline contracts.",
        "previous_approval_sha256": "45DD370045247997A83B009A934326D1AC917CC62060DE06F17950854F23653A"
      },
      {
        "at": "2026-09-01 12:12:42+08:00",
        "summary": "Made V8's pre-commit material gate require safe ignored retained-diagnostic inventory and successful-wrapper baseline equality, while reserving registered-root absence and its security receipt exclusively for the already authorized post-result-commit coordinator pathless prune; implementation, scope and runtime behavior are unchanged.",
        "previous_approval_sha256": "7C8FA26191FE179E4DD8584D5D7619CDDADC3356A2509A3EDD2DE9B4E4F8C822"
      }
    ],
    "final_summary": "RC07 replaces the unreleased historical authorization vocabulary 4/5/6/7 and state-digest version 4 model with four semantically named cumulative finite action sets at versions 1/2/3/4, one direct epoch/grant model and one complete non-lifecycle ApplicationState projection hashed by the sole digest-version-1 owner. Bootstrap, renewal and three separately confirmed contiguous upgrades retain exact finite authorization semantics; the synthetic link, partitioned digest, ignored-argument wrapper and old-format readers are absent. The single canonical LF baseline and all current readers accept only the new current values, while raw prior and unknown values fail typed read-only decoding without rewrite, migration or repair. Exact material state git-sha1:a69d9b5e2d640725e7844effa6a3ca46cd51dd86 passes focused authorization/persistence routes and the pinned complete offline route with lint 223/43, tests 432/432, docs 111/252/22/0, package smoke across 172 files, SQLite 3.53.3 and truthful blocked Codex evidence. Fresh independent A0 and A1 close with findings=[] and no A2 required. Retained failed-run diagnostics remain safe, ignored, untracked, zero-overlap and zero-reparse with successful-wrapper equality 208-to-208; their absence is reserved exclusively for the authorized post-result-commit pathless coordinator prune before fourteen exact-head gates, readiness, FF-only integration and ordinary push. Public majors, actions, errors, execution/Manual/dispatcher behavior, backup family formats and all Phase-3/support non-claims remain unchanged."
  }
}
```

## Context

RC06 is the unique pushed predecessor and closed the task.cancel invariant. RC07 intentionally invalidates every former authorization vocabulary and state-digest representation because no deployed runtime state must survive. RC08 cannot start until RC07 is completed, integrated and pushed.
