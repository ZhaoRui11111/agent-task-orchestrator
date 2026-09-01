# ExecPlan：重建当前备份格式与包根基线

RC08 在没有已部署运行时数据或外部包兼容承诺需要保留的前提下，把三种当前备份/恢复 JSON 工件重建为从 1 开始的单一精确格式，移除包根的合成 scaffold 状态 API，并为维护者文档巡检加入只排除已知生成物和工作树的仓库本地策略。数据库 schema、备份/恢复安全协议、CLI/API major 和已完成历史都保持不变。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 13:00:06+08:00",
    "updated_at": "2026-09-01 14:19:25+08:00",
    "authorization": {
      "implementation": {"authorized": true, "by": "current user directive requiring strict serial completion of RC06, RC07 and RC08", "at": "2026-09-01 13:00:06+08:00"},
      "persistence": {"authorized": true, "by": "current user directive plus repository standing grants for commit, pathless prune, FF-only integration and ordinary push", "at": "2026-09-01 13:00:06+08:00"}
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Replace the unreleased backup manifest, restore intent and restore receipt schema-version-2 baseline with one exact current schema-version-1 format for each artifact, including backupManifestSchemaVersion=1; accept only those current exact canonical shapes and reject every noncurrent version or malformed shape without mutation, repair or compatibility dispatch. Remove ScaffoldStatus/getScaffoldStatus and every package/test/documentation dependency on that synthetic package-root capability registry, leaving the package root as the explicit operational export facade. Add one strict repository-local doc-gardener policy that explicitly excludes only .worktrees, node_modules, dist and .pnpm-store trees from maintainer scans and classifies only completed plans and plan evidence as historical evidence, while every live document remains gated and the public repository documentation gate stays independent of the private skill. Converge current contracts, README/architecture, compatibility evidence, package smoke and tests, then complete the authorized serial review, commit, prune, exact-head gates, FF-only integration and ordinary push workflow.",
    "non_goals": [
      "Do not change database schema version 1, baseline SQL, migration identity/checksum, stored application state, authorization vocabulary/digest, Task/Project semantics, execution/Manual/dispatcher records, or any SQLite table.",
      "Do not add a schema-version-2 reader, version union, legacy type, migration, conversion, repair, import, fallback branch, old-artifact adoption path or retained-data promise for backup manifests, restore intents or restore receipts.",
      "Do not remove or weaken any current backup/restore authorization lineage, lifecycle lock, expected-current binding, canonical JSON, identity, checksum, topology, failpoint, recovery, doctor, no-follow or pre-mutation refusal rule.",
      "Do not change the sole ato.api/v1 or independent ato.execution/v1 major, CLI command grammar/output/error mapping, runtime product behavior, or add a replacement capability-status registry.",
      "Do not make the core, CLI, package scripts, public contribution workflow or required pnpm validation depend on a private Codex skill; the repository-local doc-gardener policy is maintainer-only configuration and pnpm docs:check remains the public executable documentation gate.",
      "Do not rewrite completed plans, historical audit evidence, prior changelog facts or Git history; add only a new current changelog fact and update live current contracts.",
      "Do not implement Phase 3 behavior, scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or platform-support claims.",
      "Do not delete or clean any existing worktree, branch, node_modules, dist, .pnpm-store, .local, external Codex worktree, backup, runtime or user data."
    ],
    "constraints": [
      {"id": "C1", "statement": "RC07 terminal commit 4777a7dd51256c45cc2478c11ef6835330785d2c is the unique pushed predecessor; master, origin/master and RC08 HEAD match it, the RC07 plan is completion-ready, and the coordinator has no pending operation or integration reservation.", "source": "current user directive; fresh terminal-resolve, scope, Git and harness-git-flow traces"},
      {"id": "C2", "statement": "BackupManifest, RestoreIntent and RestoreReceipt each have one current format identity starting at schemaVersion 1. RestoreIntent binds backupManifestSchemaVersion 1. Their existing exact field sets remain unchanged and required; only the current format number and current-language descriptions reset.", "source": "current user clean-slate directive; persistence contract; src/persistence/backup.ts"},
      {"id": "C3", "statement": "The single persistence owner uses current-format constants consistently across TypeScript types, writers and parsers. Every artifact with version 2, an unknown version, missing/extra field, noncanonical JSON, substituted provenance/authorization or invalid topology is rejected before protected mutation and remains untouched evidence. No version-selected union or branch exists.", "source": "current user directive; persistence Tier-2 writer/reader and pre-mutation lens"},
      {"id": "C4", "statement": "Backup creation remains application-authorized manual-only; restore remains separately authorized and data-loss acknowledged; verification, doctor and recovery retain exact identity/checksum/inventory/topology and both authorization lineages. Resetting artifact format identities cannot change database schema version 1 or downgrade support.", "source": "AGENTS.md; persistence, authorization and versioning contracts"},
      {"id": "C5", "statement": "Remove ScaffoldStatus, its frozen value and getScaffoldStatus completely from live source, declarations, package consumers, exact export inventories, current docs and active tests. Add no replacement status function or capability registry; the real typed operational exports and ato CLI status command remain unchanged.", "source": "current user directive; toolchain and CLI contracts"},
      {"id": "C6", "statement": "The repository-local .doc-gardener.json is strict JSON with exactly two top-level keys: ignore_globs_add contains exactly .worktrees/**, node_modules/**, dist/** and .pnpm-store/**; document_role_globs contains only historical_evidence with exactly docs/plans/completed/**/*.md and docs/plans/evidence/**/*.md. No Markdown is ignored, every unmatched document remains live_derived, and the policy changes only maintainer scan selection/role treatment, not Markdown authority, product behavior, Git-flow artifact policy or public validation dependencies.", "source": "current user directive; harness-doc-gardener policy contract; docs/plans/README.md historical boundary; AGENTS.md public contribution boundary"},
      {"id": "C7", "statement": "Targeted and full doc-gardener runs must report the exact repository root, policy identity/effective exclusions, requested/policy/context/gated/scanned/excluded coverage and all three issue/review-candidate/unverified channels. A zero exit is not treated as semantic proof; current source/config/tests and authoritative owners receive manual freshness review.", "source": "harness-doc-gardener SKILL.md and policy-config.md"},
      {"id": "C8", "statement": "Historical version-specific negative test names are replaced in live tests with generic unsupported-version, unknown-version and malformed-shape cases. Prior completed plans/evidence and historical changelog statements remain byte-unchanged and are not used as current contract owners.", "source": "current user directive; repository governance"},
      {"id": "C9", "statement": "Use only task/rc08-backup-scaffold-baseline and its coordinator worktree. Fresh independent A0 precedes activation; fresh independent A1 follows stable validation; any required A2 is independent. Then create one result commit, invoke pathless prune, record fourteen exact-head gates, mark ready, FF-only integrate and ordinary non-force push. Cleanup, reset, rebase, stash, clean and force are prohibited.", "source": "current user directive; harness skills; local-agent-git-flow"},
      {"id": "C10", "statement": "This is a Tier-2 durable-format convergence because restore recovery and doctor consume immutable artifacts. Validation must follow each writer through all readers and failure transitions, prove exact canonical publication/readback, unsupported prior/unknown format refusal without mutation, restart/recovery closure and absence of parallel schema owners.", "source": "harness-exec-plan persistence lens"}
    ],
    "authorization": {
      "allowed": [
        "Create/update this schema-v3 plan and evidence; edit only declared paths; reset the three current backup/restore JSON format identities to 1; remove the synthetic package-root scaffold status API; add the four-entry doc-gardener exclusion list and exact two-pattern historical-evidence role classification; update current contracts, package smoke and tests.",
        "Run impact-selected persistence, restore-recovery, doctor, package, export, configuration, documentation, doc-gardener, SQLite and complete offline validation using only validation-owned disposable .task-artifacts and existing task-local dependencies/caches.",
        "Use fresh independent read-only A0/A1/required A2; create one task-owned result commit; invoke standing-authorized pathless prune; record fourteen exact-head gates; mark ready; FF-only integrate; and use standing-authorized ordinary origin/master push."
      ],
      "requires_reapproval": [
        "Any change to artifact field membership or security semantics beyond current format numbers, any database schema/migration/state change, compatibility reader or converter, backup/restore authority/topology/recovery change, public major/CLI behavior change, replacement capability registry, new dependency/module, or out-of-scope file.",
        "Any doc-gardener exclusion beyond the four named generated/worktree trees, any document-role rule beyond the two exact completed-plan/evidence historical patterns, any weakening of live-document authority/coverage, or any new dependency of public repository commands on a private skill.",
        "Any network/secret action beyond standing push, PR, non-FF integration, release, deployment, destructive cleanup or user/runtime-data mutation."
      ],
      "prohibited": [
        "Delete, clean, adopt or impersonate any existing branch, worktree, generated store, external Codex worktree, runtime, backup or user data.",
        "Rewrite completed plans, evidence, prior changelog history or Git history to hide the former artifact versions or scaffold API.",
        "Implement Phase 3 or any explicitly unimplemented product/integration capability."
      ],
      "persistence": {
        "required": true,
        "action": "one terminal RC08 result commit followed by coordinator pathless prune, fourteen exact-head gates, ready, FF-only integration and standing-authorized ordinary origin/master push",
        "source": "current user directive; AGENTS.md; local-agent-git-flow"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".doc-gardener.json", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC08-backup-scaffold-baseline.md", "kind": "file"},
        {"path": "docs/plans/active/RC08-backup-scaffold-baseline.md", "kind": "file"},
        {"path": "docs/plans/completed/RC08-backup-scaffold-baseline.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC08", "kind": "directory"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {"id": "M1", "outcome": "Freeze the clean-slate artifact identities, scaffold removal, documentation-policy boundary, predecessor, scope, authorization and Tier-2 binary evidence before implementation.", "validation_ids": ["V1"]},
      {"id": "M2", "outcome": "The sole persistence owner writes and reads only exact canonical schema-version-1 backup manifests, restore intents and restore receipts and refuses every noncurrent or malformed artifact before mutation.", "validation_ids": ["V2", "V3"]},
      {"id": "M3", "outcome": "The package root contains only real operational exports, package consumers no longer depend on scaffold status, and the narrow maintainer documentation policy plus current docs are exact and truthful.", "validation_ids": ["V4", "V5"]},
      {"id": "M4", "outcome": "The stable candidate passes complete regression, documentation and persistence audits, fresh independent implementation review, exact inventory and the authorized terminal workflow.", "validation_ids": ["V6", "V7"]}
    ],
    "validations": [
      {"id": "V1", "type": "manual", "target": "RC07 continuity and activation readiness", "criterion": "RC07 terminal-resolve and scope pass at 4777a7dd51256c45cc2478c11ef6835330785d2c; RC07-to-RC08 chain-check passes; current proposal trace has errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]; fresh independent A0 reproduces the approval digest/base, applies the complete Tier-2 lens and returns ready_for_activation with no unresolved finding."},
      {"id": "V2", "type": "automated", "target": "Single exact current backup/restore artifact format", "criterion": "Source/declaration/static and focused tests prove BackupManifest, RestoreIntent and RestoreReceipt writers/parsers/types use only current version 1, RestoreIntent binds backupManifestSchemaVersion 1, exact field inventories and canonical JSON are unchanged, and live source/current contracts/active tests contain no schema-2 current reader/writer, V1/V2 union, legacy type or format dispatch."},
      {"id": "V3", "type": "automated", "target": "Pre-mutation refusal and lifecycle recovery closure", "criterion": "Table-driven focused backup/restore/doctor tests accept current artifacts and reject prior version 2, unknown versions, missing/extra fields, noncanonical bytes and substituted lineage/topology with the expected typed error; backup bytes, primary identity and restore evidence remain unchanged on refusal; authorized backup, interrupted restore recovery, receipt validation, restart and read-only doctor paths pass with all existing authorization, checksum, inventory and topology guarantees."},
      {"id": "V4", "type": "automated", "target": "Operational package-root surface", "criterion": "Exact source and packed runtime export inventories, generated declarations, isolated consumer typecheck/import and package smoke contain no ScaffoldStatus, getScaffoldStatus, STATUS value or synthetic capability-status assertions; operational Domain/application/execution/dispatcher/persistence/product/CLI exports, schemaVersion 1 backup flow and console parity all pass unchanged."},
      {"id": "V5", "type": "manual", "target": "Documentation policy and current documentation freshness", "criterion": "The strict repository-local policy has exactly the four authorized ignore_globs_add entries and the two authorized historical_evidence role globs, leaves every other document live_derived, and rejects unknown keys, wrong types, duplicate keys, overlapping roles and escaping paths in isolated fixtures. Targeted and full doc-gardener JSON runs with the policy exit zero with issues=[] and report exact policy identity/effective roles, requested/policy_added/context/gated/scanned/excluded coverage plus review_candidates/unverified; a comparison full run without the policy reproduces only the intended generated/worktree selection and immutable-history role differences. pnpm docs:check and manual source/config/test review find zero broken link, stale current artifact/scaffold claim, owner conflict, capability overclaim or immutable-history edit."},
      {"id": "V6", "type": "automated", "target": "Complete repository regression and artifact hygiene", "criterion": "Pinned lint, typecheck, build, complete Node tests, test:persistence, docs check, dependency policy, package smoke, Windows SQLite feasibility and pnpm verify:offline exit zero with no dependency drift, support expansion, omitted applicable route or successful-wrapper artifact-baseline change. Before the result commit, any registered .task-artifacts diagnostics are safe, ignored, untracked, zero-overlap and zero-reparse; root absence and its exact-head security receipt are exclusively post-result-commit pathless-prune evidence."},
      {"id": "V7", "type": "manual", "target": "Stable review, inventory and terminal workflow", "criterion": "Fresh independent A1 completes against the stable material state; every confirmed in-scope HIGH/MEDIUM repair receives fresh independent A2 and every LOW delta follows the schema-v3 closure rule. Final trace is completion-ready; staged inventory contains only declared regular non-reparse paths with no unstaged change or tracked artifact overlap; one result commit is followed by a current-head pathless-prune receipt, all fourteen frozen gates, ready, FF-only integration, ordinary push, exact master/origin/task-head equality and retained RC08 branch/worktree."}
    ],
    "risks": [
      {"id": "R1", "risk": "A leftover schema-2 literal, parser or test helper could create split writer/reader behavior or silently retain compatibility."},
      {"id": "R2", "risk": "Changing durable restore artifacts could accidentally weaken authorization-lineage, topology, failpoint or no-mutation guarantees even though the intended change is only format identity."},
      {"id": "R3", "risk": "Removing the synthetic scaffold API could leave packed declarations, consumer code, export inventories or current docs stale and make package smoke assert a fictitious surface."},
      {"id": "R4", "risk": "A broad, overlapping or malformed doc-gardener exclusion/role policy could hide or de-gate live authoritative documentation, misclassify mutable plans, or turn a private maintainer aid into a public repository dependency."},
      {"id": "R5", "risk": "Validation may retain task-artifact diagnostics on Windows; manual cleanup would violate the workflow and could destroy evidence."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Define current artifact-format constants in src/persistence/backup.ts and reuse them in the public/internal types, exact parsers and all writers; keep the existing field sets and error taxonomy.", "rationale": "One implementation owner prevents version drift without adding an exported compatibility surface."},
      {"id": "D2", "statement": "Use generic negative matrices named unsupported-version, unknown-version, missing-field, extra-field and noncanonical, with version 2 represented only as unsupported input rather than a historical success shape.", "rationale": "The tests should express the permanent current-only contract rather than preserve retired format semantics in live names and branches."},
      {"id": "D3", "statement": "Delete the scaffold interface/value/function and remove every consumer; do not replace it. Keep src/index.ts as the explicit re-export facade for implemented operational owners.", "rationale": "A manually synchronized capability registry is redundant state and the user authorized clean removal before release."},
      {"id": "D4", "statement": "Use ignore_globs_add with the four explicit repository-local entries and document_role_globs.historical_evidence with only the completed-plan/evidence patterns; validate the exact JSON shape in public repository tests without invoking or importing the private doc-gardener skill.", "rationale": "The repository records generated-tree exclusions and its existing immutable-history boundary while the supported toolchain stays self-contained and all live docs remain gated."},
      {"id": "D5", "statement": "Update only live current contracts and add a new top changelog fact; retain completed plans/evidence and earlier changelog bullets as immutable historical statements.", "rationale": "Current truth converges without rewriting provenance."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan proposal-only if predecessor, scope, trace, digest or independent A0 is not exact; revise the approval contract and obtain a fresh A0 before implementation."},
      {"id": "M2", "recovery": "On writer/reader mismatch or failed refusal evidence, stop with the task active, preserve all artifact fixtures/diagnostics, repair only the declared persistence/test paths and rerun the complete affected lifecycle route."},
      {"id": "M3", "recovery": "On export, package or documentation-policy drift, preserve the stable persistence result, repair only declared package/config/doc/test paths and rerun affected package/doc gates plus the full candidate route."},
      {"id": "M4", "recovery": "Keep the task branch/worktree active if A1/A2, inventory, result commit, prune, a gate, ready, integration or push is not exact; recover only through fresh trace and the coordinator-owned command for the pending transition."
      }
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "approval"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Scan live source/current docs/active tests for every schema-2 current-format literal and version-dispatch identifier, assert exact declarations, and exercise both prior 2 and unknown versions.", "recovery": "Do not activate completion; repair the sole owner/caller and rerun focused plus full persistence validation."},
      {"id": "R2", "mitigation": "Keep field inventories and protocol code structurally unchanged, compare the full diff, and run backup, restore failpoint/recovery, lifecycle authorization and doctor no-mutation suites.", "recovery": "Preserve generated evidence and stop at the failing transition; revert the semantic drift by scoped patch rather than adding compatibility or repair behavior."},
      {"id": "R3", "mitigation": "Use exact export/declaration inventories, isolated package consumer typecheck/import and source/build/packed console parity with explicit absence checks for removed symbols.", "recovery": "Repair declared facade/smoke/test/doc consumers and rerun package validation from the start."},
      {"id": "R4", "mitigation": "Keep the policy to the four-entry additive list and two nonoverlapping historical globs, test its exact shape, run strict invalid-policy fixtures, inspect effective coverage/roles, compare policy and default scans, and keep pnpm docs:check authoritative for public validation.", "recovery": "Remove or narrow only the faulty exclusion/role entry, revise the approval contract if scope would broaden, and rerun targeted/full documentation validation."},
      {"id": "R5", "mitigation": "Treat retained .task-artifacts as untracked diagnostics, inventory them without traversal or deletion, require successful wrappers to preserve the baseline, and reserve deletion for post-result-commit pathless prune.", "recovery": "Leave diagnostics and task state intact; use only coordinator prune retry after its predicates are re-established."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "4777a7dd51256c45cc2478c11ef6835330785d2c",
      "current_material_base": "4777a7dd51256c45cc2478c11ef6835330785d2c",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 13:24:13+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 14:00:18+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 14:00:18+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 14:19:25+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Resolve RC07 terminal/scope, run RC07-to-RC08 chain-check, inspect current schema-v3 trace, preserve attempt-1 finding history, and accept fresh independent read-only A0 attempt 2 on the revised approval contract.",
        "evidence": "RC07 resolves uniquely and completion-ready at 4777a7dd51256c45cc2478c11ef6835330785d2c; master, origin/master and RC08 HEAD match it, and chain-check passes. Current trace returns errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true and base_transition_count=0. Fresh independent /root/rc08_a0_reapproval reproduced 17428 canonical approval bytes and SHA-256 12E72951F30CFBEEAFD71AE7967372A16170EF1A8E5AA35614C2882D3494639D, verified the complete Tier-2 and documentation-policy boundary, confirmed F-RC08-A0-001 is narrowly closed, and returned ready_for_activation with findings=[]. Parent disposition is complete.",
        "state_id": "approval-sha256:12E72951F30CFBEEAFD71AE7967372A16170EF1A8E5AA35614C2882D3494639D"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Review the complete persistence-owner diff, scan all live source/current contracts/active tests, assert packed declarations, and run the focused backup/restore matrix plus the complete persistence and repository routes.",
        "evidence": "BackupManifest, RestoreIntent and RestoreReceipt types, exact parsers and writers share only current constants equal to 1; RestoreIntent binds backupManifestSchemaVersion=1. Existing field inventories and canonical JSON are unchanged. The focused backup/restore group passed 19/19, test:persistence passed 104/104, and the complete suite passed 432/432. Live scans found version 2 only in generic unsupported-input fixtures/current refusal prose and found no V1/V2 type, compatibility dispatch or parallel current writer.",
        "state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Exercise exact current publication, version-2/unknown/missing/extra/noncanonical/substituted refusal, restore interruption and recovery, receipt validation, restart, doctor and no-mutation assertions.",
        "evidence": "Focused backup/restore passed 19/19 and focused doctor/export/configuration passed 24/24. Complete persistence and full tests passed. Unsupported manifest/intent/receipt input remained invalid or ambiguous untouched evidence; doctor remained read-only; authorization lineage, manifest digest, expected-current CAS, stage/retained identity, checksum/inventory/topology, restart and failpoint closure all passed. Database schema/migration identity remained 1 and unchanged.",
        "state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Compare exact source/runtime export inventories, build emitted declarations, run focused facade/configuration tests, and execute isolated packed-consumer package smoke plus source/build/install console parity.",
        "evidence": "ScaffoldStatus, STATUS and getScaffoldStatus are absent from live source and exact exports; only the intentional packed-declaration negative regex and historical changelog facts name removed symbols. Focused groups passed, generated declarations expose current schema-1 backup/receipt types without legacy surfaces, and package smoke passed with pnpm 11.19.0, TypeScript 5.9.3, 172 packed files, consumerTypes/export/persistence/console/uninstall all passed.",
        "state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Assert the exact repository policy in public tests; run isolated invalid-policy fixtures; run targeted and full doc-gardener JSON after the evidence stabilized; run pnpm docs:check; and manually compare every current source/config/test fact with its authoritative contract and navigation owner.",
        "evidence": "Policy SHA-256 28a29061e4504276850bc69e4ae5bd83cd88b2a09e0544178fa5684f56496d54 has exactly four exclusions and two historical globs. Unknown-key, wrong-type, duplicate-key, overlap and escaping fixtures all failed closed. Targeted scan exited 0 with 12 scanned/10 gated, 10 live-derived/2 historical; full scan exited 0 with 113 scanned/gated, 43 live-derived/70 historical and present generated trees excluded. Both reported issues=[], review_candidates=[], unverified=[] and complete static coverage. pnpm docs:check passed 113/254/22/0. Manual semantic review closed the tool's expected pending marker with no stale current claim, owner conflict, broken navigation or overclaim.",
        "state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run the pinned pnpm verify:offline route from the beginning after terminal evidence stabilization, then rerun targeted/full doc-gardener, diff check and artifact/store inventory.",
        "evidence": "The authoritative rerun exited 0: lint 226/43; typecheck/build passed; 432/432 tests with zero fail/cancel/skip/todo and artifact baseline 0-to-0/root reclaimed; docs 113/254/22/0; production dependencies 0 and TypeScript 5.9.3; package smoke 172 files and all consumer/export/persistence/console/uninstall checks passed; Windows 10.0.22631 x64, Node 24.19.0, SQLite 3.53.3 feasibility passed with zero surviving generation members; Codex boundary passed only in blocked mode with externalE2E not_run and supportClaim=false. Final doc-gardener results remained exact and empty, git diff --check passed, .task-artifacts was absent, and the task store remained 133 regular files with zero reparse/project member.",
        "state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Accept fresh independent A1, close its sole LOW finding through the approved parent-delta path, validate the common closure state, verify the exact staged regular-file inventory, and perform the terminal schema-v3 lifecycle transition.",
        "evidence": "Fresh independent /root/rc08_a1 reviewed git-sha1:e5a1668058a3bb916f3f56acc6b04010cc72da31, independently reproduced the 17428-byte approval digest, audited the complete candidate and returned only F-RC08-A1-001 LOW. The parent confirmed it, changed exactly the two evidence-status locations, reran V5/V6 completely, and closed it by parent_delta_review at git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42; closure_required=false and A2 is not required. Before lifecycle migration, the index contained exactly 20 declared paths, every entry was mode 100644 and a contained regular non-reparse file, unstaged=0, tracked artifact overlap=0, and cached diff check passed. The lifecycle move replaces only the declared active plan with its declared completed path. The final pre-commit trace is run immediately after staging that move and must return errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false, completion_ready=true and no blocker at the same closure state. The authorized post-result-commit pathless prune, fourteen exact-head gates, ready, FF-only integration and ordinary push remain coordinator-owned terminal transitions.",
        "state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc08_a0_reapproval",
        "independence": "Fresh independent read-only schema-v3 A0 attempt 2. The reviewer did not author or disposition the proposal or its revision, implement RC08, edit files, mutate Git/index/ref/worktree/coordinator/runtime/network/permission/external state, run tests/build/package commands, or grant authority.",
        "scope": "Complete revised RC08 proposal and attempt/revision history; AGENTS.md; ARCHITECTURE.md; ExecPlan schema/A0/Tier-2 persistence lens; doc-gardener skill/policy contract; persistence, toolchain, versioning, validation, authorization, plan-lifecycle and local Git-flow contracts; current backup/restore/doctor owners/tests; package-root scaffold consumers; documentation-policy boundary; scope, authorization and all binary validations.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 13:23:15+08:00",
        "approval_sha256": "12E72951F30CFBEEAFD71AE7967372A16170EF1A8E5AA35614C2882D3494639D",
        "reviewed_material_base": "4777a7dd51256c45cc2478c11ef6835330785d2c",
        "evidence": "Exactly one current read-only trace exited 0 with errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true, exact base/HEAD 4777a7dd51256c45cc2478c11ef6835330785d2c and state git-sha1:17e38b531cd7b47e531a401e540c6bc685694f38. Independent canonicalization reproduced 17428 bytes and the stored digest. The exact four generated/worktree exclusions plus two nonoverlapping completed-plan/evidence historical globs close F-RC08-A0-001 without ignoring Markdown or de-gating unmatched live docs; pnpm docs:check remains public and independent. The single backup/restore type-parser-writer owner, exact field inventories, canonical ingress, verification/restore/recovery/doctor readers, prior/unknown/malformed refusal, lineage/checksum/topology guarantees and closed scaffold-removal consumer set are feasible within declared scope with no compatibility, database-schema, public-major or external-authority change. Findings=[].",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc08_a1",
        "independence": "Fresh independent read-only schema-v3 A1. The reviewer did not participate in RC08 planning, A0, implementation, validation execution, repair, authorization, or parent disposition; made no filesystem, Git/index/ref/worktree, coordinator, runtime, network, permission, or external-state mutation; and ran no test, build, package, or doc-gardener command.",
        "scope": "Complete 20-path RC08 material candidate, active ExecPlan, validation evidence, full diff from 4777a7dd51256c45cc2478c11ef6835330785d2c, AGENTS.md, ARCHITECTURE.md, schema-v3 and A1/Tier-2 audit rules, persistence/toolchain/versioning/validation/local-Git-flow contracts, backup/restore/doctor writers and readers, refusal/recovery tests, package exports/declarations/consumer smoke, documentation policy and history boundary, and artifact/cache evidence.",
        "reviewed_at": "2026-09-01 14:11:38+08:00",
        "evidence": "Exactly one read-only trace exited 0 with errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true, exact base/HEAD 4777a7dd51256c45cc2478c11ef6835330785d2c and reviewed state git-sha1:e5a1668058a3bb916f3f56acc6b04010cc72da31. Independent canonicalization reproduced 17428 approval bytes and SHA-256 12E72951F30CFBEEAFD71AE7967372A16170EF1A8E5AA35614C2882D3494639D. The reviewer confirmed one exact version-1 type/parser/writer owner, unchanged field and safety protocol, no compatibility branch, complete synthetic-scaffold removal, exact narrow documentation policy, no public private-skill dependency, unchanged historical material, no Phase-3/support overclaim, absent .task-artifacts and the safe 133-file zero-reparse task store. It found only F-RC08-A1-001, a LOW contradiction in the evidence file's pending-status wording.",
        "reviewed_state_id": "git-sha1:e5a1668058a3bb916f3f56acc6b04010cc72da31",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-RC08-A1-001",
            "severity": "LOW",
            "summary": "The live RC08 evidence still said the authoritative post-evidence full route and final doc-gardener confirmation were pending while V5 and V6 recorded them passed at the reviewed state.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "parent_delta_review",
            "resolution": "Change only the evidence status to implementation-complete and complete-route-passed awaiting A1, and remove only the completed verify/doc-gardener pending item; make no implementation, contract, scope, policy or authorization change.",
            "closure_evidence": "The parent applied exactly the two-location wording delta and no other material delta, producing git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42. At that common closure state the complete pinned pnpm verify:offline route passed from the beginning with lint 226/43, typecheck/build, 432/432 tests and artifact baseline 0-to-0, docs 113/254/22/0, zero production dependencies, 172-file package smoke, Windows SQLite 3.53.3 with zero surviving generation and blocked-only Codex evidence. Targeted doc-gardener passed with 12 scanned/10 gated and full passed with 113 scanned/gated; both used policy SHA-256 28a29061e4504276850bc69e4ae5bd83cd88b2a09e0544178fa5684f56496d54 and reported issues=[], review_candidates=[], unverified=[]. Manual semantic review confirmed the exact delta removed the contradiction and changed no other claim. git diff --check passed, .task-artifacts remained absent, the store remained 133 regular files with zero reparse/project member, and V2-V6 are rebound to this same state. No A2 is required.",
            "closure_state_id": "git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42"
          }
        ]
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-RC08-A0-001"],
        "disposition": "reopened",
        "reason": "Fresh independent read-only A0 at 2026-09-01 13:11:38+08:00 reproduced 16662 approval bytes and digest 30F379C1D6188E80C0962B90C4FCD215330F32645514DE8F69A88AFA92525330, confirmed predecessor/scope/Tier-2 feasibility, and found one MEDIUM contract gap: the four approved ignore globs could not make the required full doc-gardener run clean because immutable completed-plan/evidence material remained classified live. Parent reproduction confirmed 21 MEDIUM path mentions and 7 unverified inline paths, all in plan evidence. The approval contract now adds only the repository's existing completed-plan/evidence historical role boundary and requires fresh A0."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V6",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 14:00:18+08:00",
        "evidence": "The first post-evidence full-route invocation passed lint and typecheck, then the sandbox denied TypeScript writes to the existing generated dist tree with EPERM. No product assertion failed and no source or artifact diagnostic changed. The identical pinned command was rerun from the beginning with task-worktree write access and passed every V6 route.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-01 13:13:02+08:00",
        "summary": "Classified only completed plans and plan evidence as historical_evidence so the requested four generated/worktree exclusions remain narrow while full maintainer documentation validation can distinguish immutable history from live documentation.",
        "previous_approval_sha256": "30F379C1D6188E80C0962B90C4FCD215330F32645514DE8F69A88AFA92525330"
      }
    ],
    "final_summary": "RC08 establishes one independent current schema-version-1 format for each backup manifest, restore intent and restore receipt while preserving their exact field sets, authorization lineage, canonical bytes, identities, checksums, topology, recovery and doctor behavior; every version 2, unknown version or malformed artifact remains fail-closed untouched evidence. It removes ScaffoldStatus, STATUS and getScaffoldStatus without replacement so the package root is only the operational export facade. The exact repository doc-gardener policy excludes only four generated/worktree trees, classifies only completed plans/evidence as historical, leaves every other document live-derived, and creates no public dependency on a private skill. Exact material state git-sha1:f4b5ca7883f433cd18539f002d4a032c604aae42 passes focused and complete persistence/product validation plus the pinned full route with lint 226/43, tests 432/432, docs 113/254/22/0, 172-file package smoke, SQLite 3.53.3 and truthful blocked Codex evidence. Fresh independent A0 is clean after one preserved revision attempt; fresh independent A1 found one LOW evidence-status contradiction, which the parent closed through the schema-v3 parent-delta route with complete post-repair validation and no A2 required. Database schema 1, public majors, CLI behavior, execution/Manual/dispatcher semantics, immutable history and all Phase-3/support non-claims remain unchanged. The exact staged regular inventory is ready for one result commit followed by the authorized pathless prune, fourteen exact-head gates, readiness, FF-only integration and ordinary push; branch/worktree cleanup remains prohibited."
  }
}
```

## Context

RC07 is the unique pushed predecessor and closed the authorization-state baseline. RC08 is the last requested clean-slate convergence plan; it deliberately invalidates the unreleased artifact-format-2 JSON and removes the synthetic package status registry because no deployed data or supported package consumer must survive. Final full-repository debt and documentation audits occur only after RC08 is integrated and pushed.
