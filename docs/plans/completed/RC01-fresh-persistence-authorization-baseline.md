# ExecPlan：建立 fresh persistence 与 authorization 基线

RC01 是 Phase 3 前兼容与结构债收敛序列的第一项。它只删除已经被用户明确放弃的 pre-Phase-3 数据库 prefix 与授权持久化兼容分支，把当前 Phase 2 行为放入一个 fresh-only schema；后续 RC02–RC05 仍须各自独立规划、审查、集成与推送。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-31 16:31:27+08:00",
    "updated_at": "2026-08-31 21:20:00+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive relayed from source thread 01a050d4-f616-73d3-8ff5-44178a095887",
        "at": "2026-08-31 16:31:27+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive requiring result commit, FF-only integration and ordinary push for every RC plan",
        "at": "2026-08-31 16:31:27+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Replace the shipped schema-1-through-7 migration-prefix compatibility chain with one fresh current schema-version-1 baseline that directly stores the complete local explicit-Manual Phase 2 model, remove all pre-Phase-3 schema-shape readers, prefix-upgrade paths, lifecycle digest versions 1 through 3, partitioned vocabulary-6/vocabulary-7 epoch and grant tables and legacy link tables, preserve one current digest-version-4 lineage and one current authorization epoch/grant model, and prove that fresh bootstrap plus separately confirmed contiguous capability upgrades retain all current authorization, atomic transaction, append-only audit, lease/fence, dispatcher and Manual product behavior while every old database prefix is refused before mutation.",
    "non_goals": [
      "Do not perform RC02 backup/restore format consolidation, RC03 product API renumbering, RC04 persistence module decomposition, or RC05 application/CLI decomposition and unused-code enforcement in this plan.",
      "Do not preserve or migrate any pre-Phase-3 runtime data, schema prefix, old migration checksum, old schema-shape projection, old lifecycle digest version, or old authorization grant partition/link layout.",
      "Do not delete or rewrite completed ExecPlans, immutable audit evidence, Git history, user .local content, runtime data, backups, ignored dependency/build stores, existing worktrees or task branches.",
      "Do not change the public ato.execution/v1 port, Domain Task semantics, explicit Manual effect protocol, dispatcher completeness semantics, backup/restore crash protocol beyond adapting its current database-schema expectation, or any current CLI command/API behavior.",
      "Do not implement scheduler, scheduled trigger, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend/gates, daemon/service, release, deployment, telemetry, diagnostic bundle, retention or product cleanup."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "EP-02D has one verified terminal result at c95de33b104282292a0cd9203e66e5a1112cb3bd, and local master plus local origin/master matched that commit before RC01 task creation. RC01 is the next plan in the strict chain and RC02 cannot begin until RC01 is completed, integrated and pushed.",
        "source": "current user directive; docs/plans/README.md; completed EP-02D plan; fresh Git and coordinator trace"
      },
      {
        "id": "C2",
        "statement": "The only supported runtime database after RC01 is a schema-version-1 database whose single migration contains the complete current Phase 2 storage shape. Only an absent primary newly reserved and created by the current runtime owner may receive that fresh baseline. A pre-existing empty or zero-length primary and any nonempty database not carrying the exact current migration identity, checksum, fingerprint and one-entry history are incompatible and must be refused before writable open or any other mutation. There is no prefix upgrade, pre-upgrade backup hook or historical database reader.",
        "source": "current user directive removing all pre-Phase-3 database compatibility; docs/reference/persistence-contract.md fail-closed ownership"
      },
      {
        "id": "C3",
        "statement": "Persistence schema version and authorization vocabulary version are distinct. Fresh bootstrap establishes the current local identity and only vocabulary 4 Phase 1 grants. The existing confirmation-bound capability operation advances exactly one contiguous vocabulary step 4-to-5, 5-to-6 or 6-to-7 per accepted request, and migration or baseline reset never grants later actions.",
        "source": "current user directive preserving staged explicit capability semantics; docs/reference/authorization-contract.md"
      },
      {
        "id": "C4",
        "statement": "All vocabulary-4-through-7 epochs use one authorization_capability_epochs table and all current actions use one authorization_grants table with direct capability_epoch_id provenance. authorization_capability_epochs_v6, authorization_capability_epochs_v7, authorization_grants_v6, authorization_grants_v7 and every grant-epoch legacy/v6/v7 link table, union reader, fallback writer and global cross-partition guard are absent.",
        "source": "current user directive; current migrations 0004/0006/0007 and src/persistence/application-repository.ts"
      },
      {
        "id": "C5",
        "statement": "Every new lifecycle authorization stores and verifies only current state digest version 4 in its sole authoritative row/table. Digest versions 1, 2 and 3, application_lifecycle_digest_v6, application_lifecycle_digest_v7, COALESCE fallback decoding and conditional digest writers are absent; mismatched or corrupt current digest evidence still fails closed.",
        "source": "current user directive; docs/reference/persistence-contract.md; current application lifecycle owner"
      },
      {
        "id": "C6",
        "statement": "The application owner remains the only Domain-command and authorization-selection owner. One SQLite transaction facade remains the only accepted state writer; persistence does not grant authority or select Domain commands. Append-only/revoke-only audit and authorization invariants, atomic claims, ordered attempts, leases, per-Task fencing, Manual intent/observation/verified-receipt/finalization and dispatcher completeness constraints remain enforced by current readers, writers, foreign keys, indexes and triggers.",
        "source": "AGENTS.md; ARCHITECTURE.md; docs/reference/persistence-contract.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C7",
        "statement": "RC01 may adapt the currently application-authorized backup, restore/recovery and doctor code only where the database schema number or removed historical reader is referenced. BackupManifestV1/V2 and RestoreIntent/Receipt V1/V2 parser consolidation belongs exclusively to RC02 and must remain truthful and operational at the RC01 terminal state.",
        "source": "current user ordered RC01/RC02 boundary; docs/reference/persistence-contract.md"
      },
      {
        "id": "C8",
        "statement": "Migration registry, .gitattributes, package inventory, source/build/packed-install consumption and tests contain exactly one reviewed immutable current-baseline SQL file and one released checksum. Old migration files and exact prefix fixtures are deleted, not retained as dormant compatibility assets. A bounded synthetic incompatible-database negative may prove pre-mutation refusal without recreating the historical prefix suite.",
        "source": "current user directive; docs/reference/toolchain-contract.md; docs/reference/validation-policy.md"
      },
      {
        "id": "C9",
        "statement": "Current public ato.api/v1 and ato.api/v2 command trees, fixed errors, output shapes and default version selection remain unchanged during RC01. Current ato.execution/v1 remains unchanged. CLI status and doctor truthfully report schemaVersion 1 for an initialized current runtime.",
        "source": "current user directive; docs/reference/cli-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C10",
        "statement": "Fresh independent A0 precedes activation; fresh independent read-only A1 follows a stable complete diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. The implementer cannot act as reviewer and parent disposition remains separate.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C11",
        "statement": "Use only task/rc01-fresh-baseline and D:/agent-task-orchestrator/.worktrees/rc01-fresh-baseline. After one terminal task-owned result commit, invoke the pathless current-head artifact prune, exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, PR, release, deployment, reset, rebase, stash and force are prohibited.",
        "source": "current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C12",
        "statement": "The final repository and documentation describe only the current local explicit-Manual Phase 2 product. Historical completed plans and evidence remain byte-preserved historical truth and are not runtime compatibility code.",
        "source": "current user directive; AGENTS.md; docs/reference/repository-governance.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Create and update this RC01 schema-v3 ExecPlan and task-owned evidence, edit only declared task paths, delete the seven obsolete migration files, add the one current-baseline migration, and implement/test/document the approved fresh-only persistence and authorization convergence.",
        "Run local repository validation, create only validation-owned disposable .task-artifacts, make one task-owned result commit, invoke standing-authorized pathless artifact prune, record exact-head gates, mark ready, FF-only integrate locally and use the standing-authorized ordinary non-force origin/master push.",
        "Use fresh independent read-only reviewers for A0, A1 and any required A2; reviewers may inspect repository content and validation evidence but may not edit or grant authority."
      ],
      "requires_reapproval": [
        "Any need to preserve or transform old runtime databases, old migration prefixes/checksums, pre-Phase-3 user data, old lifecycle digest formats, or old partition/link storage.",
        "Any change to public CLI/API behavior, ato.execution/v1, Domain semantics, authorization action vocabulary or confirmation policy beyond retaining the existing staged 4-to-7 lifecycle on the new storage model.",
        "Any scope expansion into RC02-RC05 outcomes, external path, network/secret access, PR, merge other than coordinator FF-only local integration, release, deployment, destructive operational cleanup or user data."
      ],
      "prohibited": [
        "Adopt, delete, clean up or impersonate the Codex application worktree or any pre-existing branch/worktree/coordinator task.",
        "Delete completed plans, immutable audit evidence, Git history, .local, runtime/backup data, node_modules, pnpm store, dist, ignored content or any existing worktree/task branch.",
        "Implement scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or unsupported platform/integration claim."
      ],
      "persistence": {
        "required": true,
        "action": "one task-owned terminal result commit containing the completed RC01 plan, followed by coordinator pathless artifact prune, exact-head gates, ready, FF-only local integration and the standing-authorized ordinary origin/master push",
        "source": "current user directive plus AGENTS.md/local-agent-git-flow narrow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".gitattributes", "kind": "file"},
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC01-fresh-persistence-authorization-baseline.md", "kind": "file"},
        {"path": "docs/plans/active/RC01-fresh-persistence-authorization-baseline.md", "kind": "file"},
        {"path": "docs/plans/completed/RC01-fresh-persistence-authorization-baseline.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC01", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/observability-contract.md", "kind": "file"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "migrations", "kind": "directory"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/persistence", "kind": "directory"},
        {"path": "test/application-atomicity.test.mjs", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/cli-contract.test.mjs", "kind": "file"},
        {"path": "test/cli-e2e.test.mjs", "kind": "file"},
        {"path": "test/cli-phase2-e2e.test.mjs", "kind": "file"},
        {"path": "test/cli-security.test.mjs", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/dispatcher-security.test.mjs", "kind": "file"},
        {"path": "test/execution-claim-foundation.test.mjs", "kind": "file"},
        {"path": "test/execution-loop-authorization.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-concurrency.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"},
        {"path": "test/persistence-path-security.test.mjs", "kind": "file"},
        {"path": "test/persistence-repository.test.mjs", "kind": "file"},
        {"path": "test/persistence-schema-migrations.test.mjs", "kind": "file"},
        {"path": "test/persistence-smoke.test.mjs", "kind": "file"},
        {"path": "test/persistence-test-helpers.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The migration registry, SQL inventory and database opener expose one immutable schema-version-1 current baseline and reject every noncurrent nonempty database before mutation, with no prefix-upgrade hook or historical schema reader.",
        "validation_ids": ["V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "The application repository reads and writes one current state shape with one epoch/grant lineage and digest version 4, while preserving staged explicit capability upgrades, atomic writer/audit behavior and all execution/Manual/dispatcher invariants.",
        "validation_ids": ["V4", "V5", "V6"]
      },
      {
        "id": "M3",
        "outcome": "Old prefix fixtures and package inventories are replaced by fresh-current and fail-closed incompatibility evidence; all contracts and current-status documents truthfully distinguish schema version 1 from capability vocabulary 4 through 7.",
        "validation_ids": ["V7", "V8"]
      },
      {
        "id": "M4",
        "outcome": "RC01 has a stable independently reviewed completion-ready diff, complete exact-state validation and an exact task-owned staged inventory. Any failed-run .task-artifacts scratch remains ignored, untracked, inventoried and outside the result commit until the separately authorized post-commit coordinator sequence records the current-head pathless prune, gates, ready, FF-only integration and push outside material-bound plan validation.",
        "validation_ids": ["V1", "V9", "V10"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "ExecPlan lifecycle, EP-02D predecessor lineage, exact task scope and review closure",
        "criterion": "Before the result commit, exec_plan.py trace reports schema v3, errors=[], warnings=[], outside_scope=[], current A0/A1/required-A2 records complete, all milestones and validations terminal, final summary present and no completion blocker; read-only predecessor evidence uniquely resolves EP-02D at c95de33b104282292a0cd9203e66e5a1112cb3bd. Post-commit terminal-resolve and chain-check are coordinator evidence, not material-bound in-plan results."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Single fresh current persistence baseline and exact migration identity",
        "criterion": "Targeted migration tests prove exactly one registry entry/file/history row at schemaVersion 1, identical canonical checksum under declared LF/CRLF transport, exact live fingerprint, complete current tables/indexes/triggers, no old migration file/table, and no mutation on malformed source, wrong checksum/history/fingerprint, old-prefix-shaped, newer, or pre-existing empty/zero-length primary; only an absent owner-created primary may initialize."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Current-only startup, doctor and backup schema adaptation",
        "criterion": "Fresh open/bootstrap, restart, current backup/restore and read-only doctor pass at schemaVersion 1; old nonempty databases never enter an upgrade or backup-before-upgrade path and are refused before bytes/metadata/history change."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Authorization persistence convergence and explicit capability lifecycle",
        "criterion": "Tests prove a fresh runtime has no grants before bootstrap, bootstrap creates only vocabulary-4 actions, each separately confirmed request advances exactly 4-to-5, 5-to-6 and 6-to-7, denied/unconfirmed/skipped/replayed/conflicting requests grant nothing extra, all records use the single current epoch/grant tables and removed partition/link names are absent from SQL/source/current database."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Current state/digest decoder and single-writer integrity",
        "criterion": "Repository/atomicity/concurrency/security tests prove only digest version 4 is accepted and written, legacy schema readers and digest fallback branches are absent, append-only/revoke-only audit and grant rules remain enforced, one writer transaction owns accepted mutations, stale CAS/corrupt rows fail closed and no duplicate persistence path appears."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Execution, Manual backend, dispatcher and product regressions",
        "criterion": "Impact-selected claim, reliable-loop, Manual backend, dispatcher, product facade and CLI tests pass for atomic claims, ordered attempts, leases, fencing, intent/observation/verified-receipt/finalization, separate completion acceptance, reconciliation and completeness; ato.execution/v1 source and behavior remain unchanged."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Toolchain, package and installed-consumer migration inventory",
        "criterion": "Strict typecheck/build and package smoke pass with exactly one packaged current-baseline migration, source/build/packed-installed fresh runtime parity, sequential vocabulary upgrades and no old migration filename, prefix fixture, runtime database or generated artifact in the package/commit."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Authoritative contract and current-capability truth",
        "criterion": "docs:check and manual authority/capability review find zero broken exact-case links, conflicting current owner, schema-v7/prefix-compatibility overclaim, historical-plan rewrite, later-RC preclaim or unsupported Phase-3 capability; git diff --check passes."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Complete current repository regression",
        "criterion": "The pinned offline full route passes lint, strict typecheck, build, all Node tests, documentation, dependency shape, package smoke, Windows SQLite feasibility and truthful Codex boundary with no omitted applicable route."
      },
      {
        "id": "V10",
        "type": "manual",
        "target": "Ownership, staged inventory and artifact hygiene",
        "criterion": "Before the result commit, the exact staged inventory contains only declared regular no-follow task paths, excludes runtime/local/secret/generated material, preserves historical plans/evidence and .local, and git diff --check passes. Any present registered .task-artifacts root is safe, ignored, untracked, free of tracked overlap and explicitly inventoried as retained failed-run diagnostics; the final successful test wrapper preserves its observed baseline exactly, and no manual or pre-commit deletion is performed. Root absence, clean-after-commit and the exact-head coordinator prune receipt are post-commit coordinator evidence, not material-bound in-plan results."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "A mechanically combined baseline may omit a current table, foreign key, index, trigger or CHECK and silently weaken a durable invariant."
      },
      {
        "id": "R2",
        "risk": "Resetting database schema to version 1 may be confused with authorization vocabulary version 1 and accidentally auto-grant or block later Phase 2 actions."
      },
      {
        "id": "R3",
        "risk": "Deleting partition/link and historical reader branches may leave a hidden current reader/writer path or digest calculation pointed at removed shapes."
      },
      {
        "id": "R4",
        "risk": "Backup, restore or doctor may misclassify the new schema 1 as the old schema-1 prefix or retain a mutation-capable upgrade path."
      },
      {
        "id": "R5",
        "risk": "Broad compatibility wording cleanup may rewrite historical evidence or preclaim RC02-RC05 outcomes."
      },
      {
        "id": "R6",
        "risk": "Long persistence/security validation can fail after producing ignored task artifacts or expose a current-state regression only after the stable review."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Create one 0001-current-baseline.sql whose fresh schema is the direct current Phase 2 shape; only an absent owner-created primary may receive it. Retain pre-existing-empty refusal and migration metadata/history/checksum/fingerprint validation for this sole identity, but remove migration-prefix application and pre-upgrade backup behavior.",
        "rationale": "The user explicitly removed every pre-Phase-3 data/prefix compatibility obligation while current corruption and source-identity checks remain valuable."
      },
      {
        "id": "D2",
        "statement": "Use schemaVersion 1 for persistence and retain authorization vocabulary versions 4, 5, 6 and 7 as the existing contiguous capability lifecycle.",
        "rationale": "The schema is a fresh baseline, while staged authority is a security semantic rather than historical database compatibility."
      },
      {
        "id": "D3",
        "statement": "Collapse epochs/grants into their unsuffixed current tables with direct provenance and store digest version 4 directly in the sole lifecycle authorization owner; current reader/writer code uses only these shapes.",
        "rationale": "This removes compatibility partitions and link joins without creating a second writer or losing current lineage."
      },
      {
        "id": "D4",
        "statement": "Keep RC01 adaptations to backup/restore/doctor minimal and current-truthful; do not remove their format-v1/v2 protocols until RC02.",
        "rationale": "The ordered plan boundary requires a usable intermediate master and assigns format consolidation to the next independently reviewed plan."
      },
      {
        "id": "D5",
        "statement": "Derive the baseline from the authoritative final schema and validate an exact object inventory plus behavioral invariants rather than concatenating historical ALTER/copy/drop migrations.",
        "rationale": "Direct creation avoids historical staging tables and makes omissions mechanically observable."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Before any commit, keep the task worktree editable; if exact schema inventory or source identity fails, correct the single baseline and registry, recreate only test-owned disposable runtimes, and rerun targeted migration checks."
      },
      {
        "id": "M2",
        "recovery": "If current authorization or execution behavior drifts, stop at the failing owner, preserve the failure evidence, restore the approved current semantic using the same single transaction facade and rerun all adjacent tests before stable review."
      },
      {
        "id": "M3",
        "recovery": "If scope or contract truth is incomplete, revise the approval contract and obtain fresh A0 before further implementation; never repair by editing completed historical plans."
      },
      {
        "id": "M4",
        "recovery": "A failed gate leaves the reserved task editable. Fix in scope, commit a new exact head, rerun affected/full validation and fresh review as required, then replace stale prune/gate receipts; never reset, rebase, stash or force."
      }
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "material"},
      {"id": "V2", "state_binding": "material"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"},
      {"id": "V8", "state_binding": "material"},
      {"id": "V9", "state_binding": "material"},
      {"id": "V10", "state_binding": "material"}
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Generate and compare exact sqlite_schema inventories, retain all current foreign-key/trigger negatives, and run fresh plus full repository tests.",
        "recovery": "Treat any missing or extra object/invariant as blocking; repair the sole baseline rather than adding a compatibility migration."
      },
      {
        "id": "R2",
        "mitigation": "Name schema and vocabulary separately in types, contracts and tests; assert zero grants pre-bootstrap and exact action sets after each confirmed phase.",
        "recovery": "Refuse activation/completion until staged authority and denial/replay tests prove no automatic grant."
      },
      {
        "id": "R3",
        "mitigation": "Search removed table/function/digest symbols across source, SQL, tests and current docs, then trace every current writer and reader from application transaction to readback.",
        "recovery": "Remove or redirect each residual only within approved scope and rerun targeted plus full validation."
      },
      {
        "id": "R4",
        "mitigation": "Bind current schema identity to the sole migration ID/checksum/fingerprint/history and use a minimal incompatible nonempty database negative; doctor remains read-only and backup/restore use only current application readback.",
        "recovery": "On ambiguity, fail before mutation and retain the currently documented RC02 format boundary rather than inventing compatibility."
      },
      {
        "id": "R5",
        "mitigation": "Edit only current authority/status documents and explicitly leave completed plans/evidence byte-unchanged; run link and capability-claim review.",
        "recovery": "Revert only the task-owned inaccurate current wording via a new patch; do not rewrite history."
      },
      {
        "id": "R6",
        "mitigation": "Run impact-targeted tests before stable A1, then full pinned offline validation, preserve failure evidence, and invoke only coordinator pathless artifact prune after the result commit.",
        "recovery": "Keep failed diagnostics while reserved, repair and rerun; prune only the registered task-artifact root when the exact-head result is ready for gates."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "c95de33b104282292a0cd9203e66e5a1112cb3bd",
      "current_material_base": "c95de33b104282292a0cd9203e66e5a1112cb3bd",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-08-31 20:48:00+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-08-31 20:48:00+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-08-31 20:48:00+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-08-31 21:18:00+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Run exec_plan.py trace after fresh A2, inspect the exact EP-02D predecessor commit and completed plan, then record V1/M4/final_summary and rerun the active-plan trace.",
        "evidence": "The post-A2 trace exited 0 with schema_version=3, approval digest 0ED11FFDAE5105792F8677E04E4F1D78497B8C9BFA57986570D5FCDE50C9A9DE, base/HEAD c95de33b104282292a0cd9203e66e5a1112cb3bd, state git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c, errors=[], warnings=[], outside_scope=[], all A0/A1/A2 reports parent-complete and only V1, M4 and final_summary pending. Git object inspection uniquely resolves c95de33b104282292a0cd9203e66e5a1112cb3bd as feat: close Phase 2 manual product with the completed EP-02D plan. After recording these three terminal facts, the final active-plan trace exited 0 with every milestone/validation terminal, completion_ready=true and no blocker.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the migration-targeted suite, complete persistence route and final complete offline test route; inspect the exact staged migration inventory and canonical SQL checksum.",
        "evidence": "The targeted migration route passed 14/14 and the final 412-test route passed. The registry, package and index contain exactly migrations/0001-current-baseline.sql at schemaVersion 1 with canonical LF SHA-256 EF756403D6D03EF73208326B0234991CBC4189372121474E6AD97C11BA70F6BD; exact table/index/trigger inventory, current reopen, malformed-source rollback, wrong identity/history/fingerprint/live schema, old-shaped nonempty, newer and pre-existing zero-length refusal all passed without mutation.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run pnpm test:persistence after the current-only concurrency correction and rerun the complete offline route at the final material state.",
        "evidence": "The complete persistence route passed 88/88 and the final full route passed all backup, restore, recovery, doctor, startup and restart cases at schemaVersion 1. Incompatible and zero-length existing primaries were refused before writable open, no pre-upgrade hook ran, current backup/restore remained operational, doctor remained read-only and the test wrapper preserved artifact baselineEntries=terminalEntries=42.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run affected application atomicity/service/CLI-security tests and the final complete offline route; inspect the fresh authorization database and removed-relation absence assertions.",
        "evidence": "Affected application tests passed 107/107 and the final full route passed. Fresh bootstrap grants exactly vocabulary 4, each separately confirmed upgrade advances only 4-to-5, 5-to-6 and 6-to-7, denied/replayed/conflicting transitions add no authority, all epochs/grants use the unsuffixed current tables and removed partition/link relations are absent.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run repository, application atomicity, concurrency, dispatcher-security and complete persistence/full routes; scan live source for historical readers and lifecycle digest fallbacks.",
        "evidence": "Final tests passed every append-only, revoke-only, CAS, corruption, concurrent writer and rollback case. The current repository accepts and writes only lifecycle digest version 4, has no table-existence probe, historical schema decoder, partition union or fallback writer, and keeps accepted Domain/snapshot/registry/grant/decision/audit/lifecycle changes in one application-owned transaction.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run the final complete 412-test offline route covering execution claim, reliable Manual loop, dispatcher, product facade and CLI behavior; inspect ato.execution/v1 diff ownership.",
        "evidence": "All claim/attempt/lease/fence, intent/observation/verified-receipt/finalization, separate completion acceptance, recovery/reconciliation, dispatcher takeover/membership/completeness and source/build CLI cases passed. The ato.execution/v1 public owner has no staged behavior or shape change and turn success still never completes a Task by itself.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run strict typecheck, build and package smoke inside pnpm verify:offline with the task-local copied offline store; inspect source, build, tarball and installed-consumer migration inventory.",
        "evidence": "Typecheck and build exited 0. Package smoke used pnpm 11.19.0 and frozen TypeScript 5.9.3, packed exactly 112 files and passed consumer types, export, fresh persistence, source-built-installed console parity and uninstall; every consumer observed schemaVersion 1, sequential vocabulary upgrades and the sole current migration.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Run docs:check and git diff --cached --check, then manually scan current authority/status documents and preserved historical evidence for stale or expanded capability claims.",
        "evidence": "Documentation passed with 98 Markdown files, 252 exact-case local links, 21 local fragments and forbidden=0; diff check exited 0. Current contracts consistently describe fresh schemaVersion 1 and vocabulary 4-to-7, the adapter status no longer names schema 6, completed plans/evidence remain preserved, and no RC02-RC05 or unsupported Phase 3 capability is claimed as implemented.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Prepend the installed pinned Node 24.19.0 bin directory to the command-local PATH, verify its bundled SQLite version and pnpm version, then run pnpm verify:offline end to end after fresh A0 activation at the exact staged material state.",
        "evidence": "The pinned route first reported Node v24.19.0, bundled SQLite 3.53.3 and pnpm 11.19.0, then exited 0: lint passed 193 files/28 sources; strict typecheck and build passed; Node passed 412/412 with zero fail/cancel/skip/todo and artifact 42-to-42; docs passed 98/252/21/0; production dependencies remained zero; package smoke passed 112 files; Windows SQLite reported schemaVersion 1, Node 24.19.0, SQLite 3.53.3 and survivingGenerationMembers=0; Codex reported boundaryStatus=passed, evidenceMode=blocked, externalE2E=not_run and supportClaim=false.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Inspect the exact staged and ignored inventories, node classes, ignore/tracked-overlap facts and final successful test-wrapper baseline; run git diff --cached --check and ExecPlan trace.",
        "evidence": "Exactly 57 staged paths are declared task-owned regular-file changes/deletions with no unstaged or nonignored untracked path. .local, dependencies, build/runtime/secret material and .task-artifacts are outside the index. The registered artifact root is a non-reparse ignored ordinary directory with no tracked overlap; its three documented failed-run generations contain 42 entries, six regular files and 2,302,425 bytes, no reparse member, and the final wrapper preserved 42-to-42. No pre-commit deletion occurred; the exact-head pathless coordinator prune remains post-result-commit evidence.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_final",
        "independence": "Fresh independent read-only schema-v3 A0. The reviewer did not draft or revise the current approval contract, implement RC01, participate in resolving F-RC01-A1-001, edit repository/Git/coordinator/runtime/external state, run mutation-capable tests, or grant authority. Earlier stale RC01 A0 revisions were reviewed only as preserved history.",
        "scope": "Complete current active RC01 ExecPlan and approval contract; all preserved A0/contract-revision history and A1 attempt evidence; harness schema-v3 A0 and Tier-2 persistence requirements; AGENTS.md, ARCHITECTURE.md, repository governance, validation policy and local Git-flow contract; adjacent persistence, authorization, reliability, toolchain, CLI, adapter, compatibility and ownership contracts; current migration/database lifecycle, authorization reader/writer, backup/restore/doctor, artifact test-runner and directly affected test surfaces. The review rechecked RC01 versus RC02-RC05 boundaries, exact task scope, fresh-only/pre-existing-empty refusal, vocabulary 4-to-7 staging, digest-version-4 and physical-owner convergence, transaction and commit ordering, writer-reader/restart/recovery closure, binary validations, and result-commit/artifact-prune sequencing.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-31 20:40:53+08:00",
        "approval_sha256": "0ED11FFDAE5105792F8677E04E4F1D78497B8C9BFA57986570D5FCDE50C9A9DE",
        "reviewed_material_base": "c95de33b104282292a0cd9203e66e5a1112cb3bd",
        "evidence": "The required trace was invoked exactly once and returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], actual HEAD/material base/evaluated revision c95de33b104282292a0cd9203e66e5a1112cb3bd and state git-sha1:5e28736369c4730ee6b34d1757bc7ac6b0af3d7c. Independent canonicalization of the current approval_contract produced 20,175 bytes and SHA-256 0ED11FFDAE5105792F8677E04E4F1D78497B8C9BFA57986570D5FCDE50C9A9DE. In-memory restoration of only the superseded M4 and V10 wording reproduced the prior 19,850-byte digest 4C7EB0416F6FF8BDB0FCA17418D3ECE2D46EA915F884D78B7C6B45E89EB04285, confirming the current approval change is exactly the F-RC01-A1-001 artifact-timing repair. Revised M4/V10 now make the pre-commit material gate satisfiable through exact staged exclusion, safe ignored/untracked retained-diagnostic inventory, tracked-overlap refusal and successful-wrapper baseline equality, while explicitly reserving root absence and the head/manifest-bound security receipt for the standing-authorized pathless coordinator prune after the single result commit. The local Git-flow contract independently requires that same order and permits passed gates/ready only after the exact-head prune receipt; because the pruned root is ignored and excluded from the result commit, this requires no second repository commit and does not invalidate the material-bound V10 result. The test runner is observation-only for a pre-existing nonempty baseline, preserves failed diagnostics, compares the terminal snapshot only after child success and publishes no prune/security receipt. Historical validation evidence is correctly stale after the approval change and the trace leaves A1 and validations pending, so it is not being reused as current acceptance. The fresh-only database refusal matrix, single current schema baseline, unified authorization tables, digest-version-4 lineage, contiguous confirmed capability upgrades, atomic application-owned transaction boundary, backup/doctor intermediate-state handling, recovery obligations, exact scoped callers/tests and RC02-RC05 exclusions remain coherent and complete. No unsupported hardening or new approval gap was found.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/rc01_a0_path_fix",
        "independence": "Fresh independent read-only schema-v3 A1 attempt 2. The reviewer did not implement or repair RC01, participate in the parent repair of F-RC01-A1-001, or mutate repository, Git, coordinator, runtime, network, or external state.",
        "scope": "Exact stable RC01 material state; all 57 staged task paths; active ExecPlan; current and preserved audit/validation evidence; authoritative persistence, authorization, reliability, CLI, versioning, adapter, ownership, validation and Git-flow contracts; baseline SQL; migration/store/application-repository/backup/doctor/application boundaries; directly affected tests and packed consumers; retained task-artifact root; RC02-RC05, ato.execution/v1 and public API boundaries.",
        "reviewed_at": "2026-08-31 20:57:10+08:00",
        "evidence": "The exactly-once read-only trace exited 0 with ok=true; digest 0ED11FFDAE5105792F8677E04E4F1D78497B8C9BFA57986570D5FCDE50C9A9DE, base/HEAD c95de33b104282292a0cd9203e66e5a1112cb3bd and state git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c matched exactly; errors, warnings, outside_scope, overlap, pre_existing_dirty, unstaged and untracked were empty. The index contains exactly 57 scoped paths and git diff --cached --check passed. The sole migration hash independently matched EF756403D6D03EF73208326B0234991CBC4189372121474E6AD97C11BA70F6BD. Historical prefix readers/upgrades, partition/link tables, digest fallbacks and identity adoption are absent from live implementation while schemaVersion 1, vocabulary upgrades 4-to-5-to-6-to-7, authorization/atomicity/audit/lease/fence/Manual/dispatcher semantics remain represented. ato.execution/v1 and public API owners have no staged diff; backup/restore v1/v2 remain reserved within the RC02 boundary. F-RC01-A1-001 is closed: M4/V10 now align retained pre-commit diagnostics with post-result-commit pruning. The registered ignored .task-artifacts root has zero tracked overlap, 42 entries, 36 directories, six regular files, 2,302,425 bytes, zero reparse members and zero nonregular members, matching the retained 42-to-42 wrapper evidence and result-commit -> prune-artifacts -> gates contract. One validation/documentation finding remained and was parent-confirmed.",
        "reviewed_state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-RC01-A1-002",
            "severity": "MEDIUM",
            "summary": "V9 called the first final verify:offline execution the pinned full route although its sqlite-feasibility JSON reported Node 22.22.1 and SQLite 3.51.2, while the frozen toolchain requires Node 24.19.0 and the current compatibility row names its bundled SQLite 3.53.3.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": false,
            "disposition": "a2_required",
            "resolution": "Run the complete route with the installed Node 24.19.0 bin explicitly first in the command-local PATH, require its emitted runtime/SQLite versions and every offline gate to pass, refresh V9 evidence without changing material content, and obtain fresh independent A2 closure.",
            "closure_evidence": "The parent independently confirmed the first invocation used the wrong lifecycle PATH, located the installed pinned node.exe, and directly observed v24.19.0 with process.versions.sqlite=3.53.3. With that bin prepended only for the validation process, pnpm 11.19.0 verify:offline exited 0: lint 193/28, typecheck/build, 412/412 tests with artifact 42-to-42, docs 98/252/21/0, zero production dependencies, 112-file package smoke, SQLite schemaVersion 1 with node=24.19.0, sqlite=3.53.3 and zero surviving generation members, and Codex blocked/not_run/supportClaim=false. No file changed, git diff --cached --check remains clean and the material state remains git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_repeat",
        "independence": "Fresh independent read-only schema-v3 A2. The reviewer did not author the current A1, discover, confirm or repair F-RC01-A1-002, run the remediation verify:offline route, edit repository files or mutate Git, index, refs, coordinator, runtime or external state, and granted no authority. Earlier RC01 participation was limited to independent read-only A0 and adjacent audits before this finding.",
        "scope": "Exact current A1 finding F-RC01-A1-002 and its parent disposition, resolution and closure evidence; current V9 result and V9 attempt 3; unchanged 57-path RC01 material diff and state; active ExecPlan; pinned toolchain, validation, versioning and compatibility contracts; package and lockfile version pins; direct read-only inspection of the installed pinned Node executable; and the direct adjacency of runtime/SQLite version binding, complete offline-route coverage, material-state freshness and non-support-claim boundaries.",
        "reviewed_at": "2026-08-31 21:14:47+08:00",
        "evidence": "The required read-only trace was invoked exactly once and exited 0 with ok=true, schema_version=3, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], unstaged=[], untracked=[], state_bound=true, a0_ready=true, a1_report_complete=true and closure_required=true. It independently reproduced approval digest 0ED11FFDAE5105792F8677E04E4F1D78497B8C9BFA57986570D5FCDE50C9A9DE and current material state git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c; the current A1 has exactly one a2_required finding, F-RC01-A1-002. The A1 reviewed that same state, records changes_task_diff=false, and its parent-confirmed closure evidence states that the complete command-local pinned rerun used pnpm 11.19.0 and exited 0 with lint 193/28, typecheck/build, 412/412 tests, artifact 42-to-42, docs 98/252/21/0, zero production dependencies, 112-file package smoke, SQLite schemaVersion 1 with node=24.19.0, sqlite=3.53.3 and zero surviving generation members, plus the truthful Codex blocked/not_run/supportClaim=false boundary. Current V9 records that corrected route at the unchanged state, while validation attempt 3 correctly classifies the otherwise-passing ambient Node 22.22.1/SQLite 3.51.2 run as an invalid invocation rather than acceptance evidence. Independently, the configured executable C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe is a regular file; direct read-only invocations exited 0 and returned v24.19.0 and process.versions.sqlite=3.53.3. These values exactly match docs/reference/toolchain-contract.md, package.json engines/packageManager, the frozen TypeScript 5.9.3 lock, and the still-unverified Node and SQLite rows in docs/compatibility/v0.1.md. No material file changed, the reviewed state remains identical to A1, and the rerun neither broadens RC01 scope nor turns local development evidence into a runtime, SQLite, Windows or platform support claim. The wrong-lifecycle root cause and its direct version-binding adjacency are closed with no residual finding.",
        "reviewed_state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c",
        "parent_disposition": "complete",
        "closes": ["F-RC01-A1-002"],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-RC01-A0-001", "F-RC01-A0-002", "F-RC01-A0-003"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 reproduced approval digest 44845FF57D53A0DA70D7AABC2CED1EAE397F5F0EF58BD044A62A0990D9032AEE and base c95de33b104282292a0cd9203e66e5a1112cb3bd, then found three MEDIUM contract gaps: one directly affected authorization test was outside scope, owner-created fresh initialization was not distinguished from the existing pre-existing-empty refusal, and material-bound V1/V10 required post-result-commit coordinator facts. The parent independently confirmed all three, preserved the full report at docs/plans/evidence/RC01/a0-attempt-1.md, revised only those boundaries and requires fresh independent A0 before activation."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-RC01-A0-004"],
        "disposition": "superseded",
        "reason": "Fresh independent repeat A0 reproduced approval digest 35A9F659B4FC2DE0BCF6DB8B44D07482BB80087B9D8C7BB0D88510128E49F554, confirmed F-RC01-A0-001 through 003 closed and found that three complete-test callers of the old prefix/adoption fixtures remained outside scope. The parent enumerated every createVersion*Database caller, confirmed these were the only omitted callers, preserved the report at docs/plans/evidence/RC01/a0-attempt-2.md, added exactly those files and requires fresh independent A0."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent A0 at 2026-08-31 17:26:10+08:00 accepted digest E39E42565DC994147E3B8D3D759A3204427D053CEDB702D064E1B502AFDE85B4 with no finding and activated RC01. The first active trace then emitted W_PREFLIGHT_LIFECYCLE_SCOPE because the approval scope used plural docs/plans/proposals while schema-v3 lifecycle routing requires singular docs/plans/proposal. The parent changed only that historical lifecycle path, archived the otherwise-ready A0 as stale and requires fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent A0 at 2026-08-31 17:42:34+08:00 accepted digest 33803D9D06453006078C89C1D7A9A1D1D239A44532987808F27E3E59AA131674 with no finding and activated RC01. Implementation inspection then found dispatcher-security.test.mjs directly importing digest-version-3 code and asserting the partition physical-owner layout RC01 must delete. The parent changed only exact task scope, recorded the prior digest and required fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent A0 at 2026-08-31 18:10:54+08:00 accepted digest 32C8084030FF12B0C94312FEF21A20E5AA3D78EF49FD9CED401E3901CA3D2FFE with no finding and activated RC01. Later current-document inspection found docs/reference/adapter-contracts.md still naming the removed schema-v6 Manual journal, but that file was outside scope. The parent changed only exact documentation scope, preserved the report at docs/plans/evidence/RC01/a0-attempt-5.md and requires fresh A0."
      },
      {
        "audit": "A0",
        "attempt": 6,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent A0 at 2026-08-31 19:45:55+08:00 accepted digest 4C7EB0416F6FF8BDB0FCA17418D3ECE2D46EA915F884D78B7C6B45E89EB04285 with no finding and activated RC01. Stable-diff A1 later confirmed that M4/V10 required .task-artifacts absence before the sole result commit while R6, validation evidence and the authorized Git-flow require retained failed-run diagnostics to be pruned only after that commit. The parent confirmed the contradiction, reopened the contract and requires fresh A0."
      },
      {
        "audit": "A1",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": ["F-RC01-A1-001"],
        "disposition": "reopened",
        "reason": "Fresh independent A1 bound git-sha1:4ff5e58c1a2ad7df1c97468413826d8582044982 and found one MEDIUM lifecycle contradiction: material-bound V10 could not truthfully pass while three ignored failed-run diagnostic generations remained and only the post-result-commit pathless coordinator prune was authorized. The parent independently confirmed the inventory and contract conflict, preserved the full report at docs/plans/evidence/RC01/a1-attempt-1.md, aligned M4/V10 with the existing post-commit prune boundary and reopened the proposal for fresh A0/A1."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V5",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-31 19:01:00+08:00",
        "evidence": "The first complete persistence run passed 87/88 and exposed that a former migration-upgrade receipt test had been converted to open a current database, so its rejected-promise assertion leaked the successful second store and Windows fixture quarantine then failed with EPERM. The test was corrected to the current crash-stale connection-receipt invariant; focused concurrency passed 14/14 and complete persistence passed 88/88.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 1,
        "classification": "invalid_invocation",
        "at": "2026-08-31 19:12:00+08:00",
        "evidence": "The first complete test invocation passed 411/412 but the scaffold package-inventory assertion intentionally read an index that did not yet contain the exact one-add/seven-delete migration set. After staging only those authorized migration changes, the focused scaffold route passed 3/3 and every final route used the exact staged inventory.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 2,
        "classification": "environment_failure",
        "at": "2026-08-31 19:26:00+08:00",
        "evidence": "The first verify:offline attempt passed lint, typecheck, build, 412/412 tests, docs and dependency checks, then package smoke could not perform frozen offline install because this new worktree had no local .pnpm-store. A read-only source store was copied into an ignored task-local store without reparse members; the package and final full routes then ran fully offline.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-08-31 19:32:00+08:00",
        "evidence": "The first package-smoke run reached the installed consumer and exposed one missed historical schema===7 assertion in scripts/package-smoke.mjs. The consumer expectation was corrected to current schemaVersion 1; focused package smoke and the final complete offline route both passed with 112 packed files.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 3,
        "classification": "invalid_invocation",
        "at": "2026-08-31 20:46:00+08:00",
        "evidence": "The first otherwise-passing final verify:offline invocation let lifecycle scripts resolve ambient Node 22.22.1 and SQLite 3.51.2 instead of the frozen Node 24.19.0 toolchain, so it could not satisfy the pinned-runtime criterion. The installed Node 24.19.0 bin was then placed first in the command-local PATH; that exact rerun reported SQLite 3.53.3 and passed the full route without a material-state change.",
        "state_id": "git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-08-31 16:53:01+08:00",
        "summary": "Closed F-RC01-A0-001 by adding only the directly affected execution-loop authorization test; closed F-RC01-A0-002 by preserving pre-existing empty-primary refusal and allowing initialization only for an absent owner-created primary; closed F-RC01-A0-003 by separating pre-commit material validation from post-commit coordinator prune/gate/integration/push receipts.",
        "previous_approval_sha256": "44845FF57D53A0DA70D7AABC2CED1EAE397F5F0EF58BD044A62A0990D9032AEE"
      },
      {
        "at": "2026-08-31 17:08:14+08:00",
        "summary": "Closed F-RC01-A0-004 by adding only application atomicity, application service and CLI security tests that directly consume the old prefix/adoption fixtures; their approved change remains limited to equivalent fresh-current refusal, atomicity and authorization-oracle evidence.",
        "previous_approval_sha256": "35A9F659B4FC2DE0BCF6DB8B44D07482BB80087B9D8C7BB0D88510128E49F554"
      },
      {
        "at": "2026-08-31 17:29:09+08:00",
        "summary": "Corrected only the schema-v3 lifecycle scope spelling from docs/plans/proposals to docs/plans/proposal after the first active trace exposed W_PREFLIGHT_LIFECYCLE_SCOPE; no implementation, authorization, validation criterion or runtime boundary changed.",
        "previous_approval_sha256": "E39E42565DC994147E3B8D3D759A3204427D053CEDB702D064E1B502AFDE85B4"
      },
      {
        "at": "2026-08-31 18:02:30+08:00",
        "summary": "Added only dispatcher-security.test.mjs after implementation inspection proved that its digest-version-3 and partition physical-owner assertions directly exercise compatibility structures RC01 must delete; runtime authorization behavior and every other boundary remain unchanged.",
        "previous_approval_sha256": "33803D9D06453006078C89C1D7A9A1D1D239A44532987808F27E3E59AA131674"
      },
      {
        "at": "2026-08-31 19:37:52+08:00",
        "summary": "Added only docs/reference/adapter-contracts.md because its current implemented-status sentence still named the removed schema-v6 Manual journal; this revision changes no port, API, adapter behavior, authorization rule or RC02-RC05 boundary.",
        "previous_approval_sha256": "32C8084030FF12B0C94312FEF21A20E5AA3D78EF49FD9CED401E3901CA3D2FFE"
      },
      {
        "at": "2026-08-31 20:35:00+08:00",
        "summary": "Closed F-RC01-A1-001 by making the pre-commit material gate require exact staged exclusion plus safe ignored retained-diagnostic inventory and baseline equality, while reserving registered-root absence and its security receipt exclusively for the already authorized post-result-commit coordinator prune; implementation, task scope and runtime behavior are unchanged.",
        "previous_approval_sha256": "4C7EB0416F6FF8BDB0FCA17418D3ECE2D46EA915F884D78B7C6B45E89EB04285"
      }
    ],
    "final_summary": "RC01 replaces the unreleased schema-1-through-7 compatibility prefix with one immutable fresh schema-version-1 baseline, one current authorization epoch/grant model and lifecycle digest version 4 while preserving explicit separately confirmed vocabulary upgrades 4-to-5-to-6-to-7 and the complete local explicit-Manual Phase 2 behavior. Historical schema readers, prefix upgrades, adoption, partition/link storage and digest fallbacks are absent; every pre-existing empty or noncurrent database is refused before writable open. Exact material state git-sha1:d9ddd58cbc78dfc6d43d360b8014579b4c6e021c passed the pinned Node 24.19.0/pnpm 11.19.0 complete offline route, exact migration/package/inventory checks and fresh independent A0/A1/A2 closure. RC02-RC05 and every Phase 3 capability remain unimplemented; the single result commit is followed only by the separately authorized pathless artifact prune, exact-head gates, readiness, FF-only local integration and ordinary push."
  }
}
```

## Context

RC01 开始时 integration root、local master 与 local origin/master 都在 EP-02D 终态 `c95de33b104282292a0cd9203e66e5a1112cb3bd`；协调器没有 pending operation、reservation 或 nonterminal task。当前实现以七个 SQL migration、schema-shape/prefix readers、三代历史 digest fallback 以及 vocabulary-6/vocabulary-7 分表和 link 表来承接已明确放弃的数据兼容。RC01 只收敛这些 runtime compatibility 结构，同时保持当前本地 explicit-Manual Phase 2 产品的安全语义与可运行中间态。
