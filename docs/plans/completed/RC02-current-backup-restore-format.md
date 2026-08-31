# ExecPlan：收敛 current backup/restore 格式

RC02 是 Phase 3 前兼容与结构债收敛序列的第二项。它只把当前备份 manifest、restore intent 与 restore receipt 从 V1/V2 兼容分支收敛为一个 current-only 格式，并删除已无生产写入者的 pre-upgrade 形状；RC03–RC05 仍须各自独立规划、审查、集成与推送。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-31 21:44:45+08:00",
    "updated_at": "2026-08-31 23:20:30+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive requiring strict serial implementation of RC01 through RC05",
        "at": "2026-08-31 21:44:45+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive requiring one result commit, FF-only integration and ordinary push for every RC plan",
        "at": "2026-08-31 21:44:45+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Replace the BackupManifestV1/V2, RestoreIntentV1/V2 and RestoreReceiptV1/V2 compatibility unions with one exact unversioned TypeScript owner for each existing schema-version-2 current JSON artifact, retain only application-authorized manual backup provenance, reject schema-version-1 or pre-upgrade artifacts before protected mutation, and prove that current schema-version-2 backup verification, separately confirmed restore, read-only doctor classification and explicit crash recovery preserve their byte semantics, authorization, no-follow identity, immutable inventory, CAS and interruption behavior without changing the public ato.api/v1 or ato.api/v2 product behavior.",
    "non_goals": [
      "Do not perform RC03 product API renumbering, RC04 persistence module decomposition, or RC05 application/CLI decomposition and unused-code enforcement in this plan.",
      "Do not preserve, migrate, rewrite, adopt, delete or repair a schema-version-1 or pre-upgrade backup generation, restore intent, retained generation or restore receipt. Unsupported artifacts remain untouched evidence; existing schema-version-2 application/manual artifacts retain their exact current byte semantics and recovery behavior.",
      "Do not change the schema-version-1 runtime database baseline, authorization vocabulary or actions, lifecycle state-digest version, ato.execution/v1, Domain semantics, Manual execution protocol, dispatcher behavior, public CLI command tree, public result fields or fixed error mapping.",
      "Do not add backup retention, cleanup, downgrade, reverse migration, automatic restore recovery, scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment, telemetry or a platform-support claim.",
      "Do not delete or rewrite completed ExecPlans, audit evidence, Git history, .local content, runtime data, backups, ignored dependency/build stores, existing worktrees or task branches."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "RC01 has one terminal result commit 7b950488dd1fbc5cc6ee78e904d22dc067dfe00e, its coordinator task is pushed, and local master plus origin/master matched that commit before RC02 task creation. RC02 is the next plan in the strict chain and RC03 cannot begin until RC02 is completed, integrated and pushed.",
        "source": "current user directive; docs/plans/README.md; completed RC01 plan; fresh Git and coordinator trace"
      },
      {
        "id": "C2",
        "statement": "Backup manifest, restore intent and restore receipt each retain their independent current JSON schema marker equal to 2 and one exact field set. The marker is distinct from the database schema version stored in sourceSchemaVersion or targetSchemaVersion. No parser branches on old format markers or optional legacy fields.",
        "source": "current user RC02 boundary; docs/reference/persistence-contract.md; src/persistence/backup.ts"
      },
      {
        "id": "C3",
        "statement": "The sole current backup manifest is an application-authorized manual generation. It retains kind=manual and provenanceKind=application for unchanged public result and explicit persisted provenance, requires non-null lifecycle authorization ID/digest and source application-state digest, and binds the exact current schema-version-1 database identity/history. BackupKind has no pre_upgrade member and no pre_upgrade_internal provenance exists.",
        "source": "current user directive removing old kinds; current public CLI result; authorization and persistence contracts"
      },
      {
        "id": "C4",
        "statement": "The only production backup writer requires a runtime.backup lifecycle authorization and writes the sole current schema-version-2 manifest with unchanged bytes. There is no nullable authorization writer, internal pre-upgrade writer, schema-version-1 compatibility verifier or historical-generation success path. V1, pre-upgrade, missing-field, extra-field and substituted-provenance manifests fail as BACKUP_INVALID without changing generation or primary bytes.",
        "source": "src/persistence/backup.ts; src/persistence/store.ts; docs/reference/authorization-contract.md"
      },
      {
        "id": "C5",
        "statement": "The sole current restore intent and receipt retain schemaVersion 2 and every authorization and identity binding currently present in V2. backupManifestSchemaVersion remains 2. Recovery validates backup provenance, retained restore authorization and published backup authorization unconditionally rather than behind a version branch, and a current receipt must exactly match its intent.",
        "source": "docs/reference/persistence-contract.md restore protocol; src/persistence/backup.ts"
      },
      {
        "id": "C6",
        "statement": "Restore remains separately application-authorized and requires the exact data-loss acknowledgement, zero connection receipts, exact expected-current primary identity, verified current backup, private staging, durable intent before primary moves, retained prior bytes, terminal readback, immutable receipt and removal of only the exact owned intent. Persistence neither infers nor broadens authority.",
        "source": "AGENTS.md; docs/reference/authorization-contract.md; docs/reference/persistence-contract.md"
      },
      {
        "id": "C7",
        "statement": "Doctor remains read-only. Current schema-version-2 backup/restore artifacts classify exactly as today; a retired schema-version-1, pre-upgrade or malformed backup makes backup inventory invalid, and a retired or malformed pending/completed restore topology is ambiguous or blocked without deletion, repair, recovery write or data adoption.",
        "source": "docs/reference/persistence-contract.md; src/persistence/doctor.ts"
      },
      {
        "id": "C8",
        "statement": "Public ato.api/v1 and ato.api/v2 command grammar, default selection, backup result fields including kind=manual, restore result fields, confirmations, error codes and exit codes remain unchanged. Package consumers receive only the current persistence types; removal of V1/V2 type names is limited to the obsolete format surface.",
        "source": "docs/reference/cli-contract.md; docs/reference/versioning-compatibility-contract.md; src/cli-api.ts"
      },
      {
        "id": "C9",
        "statement": "Fresh independent A0 precedes activation; fresh independent read-only A1 follows a stable complete diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. The implementer cannot act as reviewer and parent disposition remains separate.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C10",
        "statement": "Use only task/rc02-backup-format-baseline and D:/agent-task-orchestrator/.worktrees/rc02-backup-format-baseline. After one terminal task-owned result commit, invoke the pathless current-head artifact prune, all eleven frozen exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, PR, release, deployment, reset, rebase, stash and force are prohibited.",
        "source": "current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C11",
        "statement": "The final repository and current documentation describe only the current local explicit-Manual Phase 2 product with one current backup/restore artifact format. Completed plans and evidence remain historical truth and are not compatibility readers.",
        "source": "current user directive; AGENTS.md; docs/reference/repository-governance.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Create and update this RC02 schema-v3 ExecPlan and task-owned evidence; edit only declared task paths; remove obsolete backup/restore format types, parser branches and pre-upgrade kinds; implement and test the approved current-only format.",
        "Run local impact-selected and full repository validation, create only validation-owned disposable .task-artifacts, make one task-owned result commit, invoke standing-authorized pathless artifact prune, record exact-head gates, mark ready, FF-only integrate locally and use the standing-authorized ordinary non-force origin/master push.",
        "Use fresh independent read-only reviewers for A0, A1 and any required A2; reviewers may inspect repository content and validation evidence but may not edit or grant authority."
      ],
      "requires_reapproval": [
        "Any need to translate, rewrite, delete or automatically recover a schema-version-1/pre-upgrade artifact, or to invalidate or rewrite a current schema-version-2 application/manual artifact or other user runtime data.",
        "Any change to the runtime database schema, authorization vocabulary, lifecycle state digest, public CLI/API grammar or result/error contract, ato.execution/v1, Domain semantics, Manual protocol or dispatcher behavior.",
        "Any scope expansion into RC03-RC05 outcomes, an external path, network/secret access, PR, merge other than coordinator FF-only local integration, release, deployment, destructive operational cleanup or user data."
      ],
      "prohibited": [
        "Adopt, delete, clean up or impersonate the Codex application worktree or any pre-existing branch, worktree or coordinator task.",
        "Delete completed plans, immutable audit evidence, Git history, .local, runtime/backup data, node_modules, pnpm store, dist, ignored content or any existing worktree/task branch.",
        "Implement scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or unsupported platform/integration claims."
      ],
      "persistence": {
        "required": true,
        "action": "one task-owned terminal result commit containing the completed RC02 plan, followed by coordinator pathless artifact prune, eleven exact-head gates, ready, FF-only local integration and the standing-authorized ordinary origin/master push",
        "source": "current user directive plus AGENTS.md/local-agent-git-flow narrow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC02-current-backup-restore-format.md", "kind": "file"},
        {"path": "docs/plans/active/RC02-current-backup-restore-format.md", "kind": "file"},
        {"path": "docs/plans/completed/RC02-current-backup-restore-format.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC02", "kind": "directory"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/index.ts", "kind": "file"},
        {"path": "src/persistence/store.ts", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "Production backup types, parser, verifier and writer expose one exact current schema-version-2 manual/application format and contain no V1/V2 union, pre-upgrade kind/provenance or nullable-authorization writer while preserving current manifest bytes.",
        "validation_ids": ["V2", "V3", "V4"]
      },
      {
        "id": "M2",
        "outcome": "Restore intent, receipt, inspection and explicit recovery use one exact current schema-version-2 format with unconditional authorization and identity validation across every durable checkpoint and unchanged current artifact bytes.",
        "validation_ids": ["V5", "V6", "V7"]
      },
      {
        "id": "M3",
        "outcome": "Current contracts, package types and tests describe only the current format while public CLI behavior and all unrelated Phase 2 capability boundaries remain unchanged.",
        "validation_ids": ["V8", "V9"]
      },
      {
        "id": "M4",
        "outcome": "RC02 has a stable independently reviewed completion-ready diff, complete exact-state validation and an exact task-owned staged inventory. Failed diagnostics remain outside the result commit until the authorized post-commit coordinator prune and exact-head integration sequence.",
        "validation_ids": ["V1", "V10"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "RC01 predecessor lineage, RC02 approval contract, exact scope and authorization",
        "criterion": "Before activation, exec_plan.py check/preflight/trace and fresh independent A0 report schema v3, exact predecessor commit 7b950488dd1fbc5cc6ee78e904d22dc067dfe00e, approval base equal to that commit, errors=[], warnings=[], outside_scope=[], no unresolved HIGH/MEDIUM finding, and an approval digest reproduced by the reviewer."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Single current backup manifest type and exact parser",
        "criterion": "Source/type/static and runtime tests prove there is one unversioned BackupManifest TypeScript shape retaining schemaVersion 2 with kind=manual, provenanceKind=application and all non-null authorization/state bindings; BackupManifestV1/V2 unions, pre_upgrade, pre_upgrade_internal, version-selected fields and schema-version-1 success branches are absent."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Current backup writer and immutable verification",
        "criterion": "A current runtime.backup handoff creates the byte-compatible current schema-version-2 manifest and a two-member generation whose bytes, schema/history, application state and lifecycle authorization reverify; missing, extra, noncanonical, schema-version-1, pre-upgrade, substituted, corrupt or newer material returns BACKUP_INVALID and preserves all source/generation evidence."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Backup authorization, publication, concurrency and failure boundaries",
        "criterion": "Focused tests preserve sole-connection, lifecycle-lock, writer-barrier authorization recheck, source/stage/directory/file identity, exact inventory, same-parent publication, caught failure and real process-interruption behavior; there is no unauthenticated or pre-upgrade writer path."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Single current restore intent and receipt formats",
        "criterion": "Source/type/static and runtime tests prove one unversioned RestoreIntent and one unversioned RestoreReceipt retaining schemaVersion 2, the complete current authorization and identity fields and backupManifestSchemaVersion=2, with no V1/V2 union or conditional authorization branch, and exact rejection of schema-version-1, missing, extra, accessor, noncanonical or substituted fields before protected mutation."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Separately confirmed restore and every durable recovery checkpoint",
        "criterion": "Current backup/restore round trip, acknowledgement, expected-primary CAS, zero-receipt requirement, stage/retain/publish/readback/receipt/intent-removal ordering and explicit recovery pass before intent, after intent, retention, publication and receipt; response loss resumes exactly once and schema-version-1, mixed or substituted topology stays RESTORE_BLOCKED without rollback or deletion."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Read-only doctor and path/security classification",
        "criterion": "Doctor verifies current schema-version-2 generations and pending/completed restore topology without any byte, timestamp, inventory or receipt change; schema-version-1/pre-upgrade/malformed backup is invalid and schema-version-1/malformed restore topology is ambiguous, while reparse, identity replacement, active-use and corruption precedence remain fail closed."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Public product and package boundary stability",
        "criterion": "Source, build and packed-install tests preserve ato.api/v1 and ato.api/v2 grammar, backup output including kind=manual, restore output, confirmations, fixed errors and restart behavior; package types expose only current BackupManifest/RestoreReceipt and no V1/V2 or pre-upgrade type surface."
      },
      {
        "id": "V9",
        "type": "manual",
        "target": "Current documentation truth and task-owned inventory",
        "criterion": "Repository docs check resolves every exact-case link/fragment and finds no planned capability claim; authority review finds one format owner; current docs contain no operational V1/V2/pre-upgrade compatibility wording; git diff --check passes and the staged inventory contains only declared task paths and no runtime, backup, secret or ignored artifact."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Stable review closure, full pinned repository validation and artifact workflow",
        "criterion": "At one stable material state, focused backup/restore/doctor/path tests, complete persistence tests and the pinned Node 24.19.0 pnpm verify:offline route pass with zero failed tests, package and Windows SQLite checks pass, Codex remains blocked/not_run without support claim, fresh independent A1 and any required A2 are complete, the final trace has no error, warning, outside-scope path or completion blocker and contains terminal milestones, validations and final summary, and ignored .task-artifacts has zero tracked overlap and successful-run baseline equality before the single result commit."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Removing the format union could accidentally change the bytes or accepted field inventory of the current schema-version-2 application/manual artifacts."},
      {"id": "R2", "risk": "Deleting version branches could also delete the V2 authorization lineage checks that make restore recovery trustworthy."},
      {"id": "R3", "risk": "A schema-version-1 completed receipt or pending intent could be silently ignored, repaired or deleted instead of remaining explicit incompatible evidence."},
      {"id": "R4", "risk": "Removing pre-upgrade kinds could weaken backup identity, publication or process-interruption tests that currently use the internal path as a fixture."},
      {"id": "R5", "risk": "Narrowing exported persistence types could unintentionally change public CLI fields or package consumption beyond RC02."},
      {"id": "R6", "risk": "High-volume crash tests may retain diagnostics or stale validation evidence and create an unsafe commit/gate claim."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "The current manifest, intent and receipt retain schemaVersion 2 and their exact existing full field sets; the implementation renames their TypeScript owners to unversioned current names and rejects schemaVersion 1 without rewriting current artifacts.",
        "rationale": "This removes the compatibility union while preserving every byte-semantic current artifact and avoiding an unauthorized format renumbering."
      },
      {
        "id": "D2",
        "statement": "Keep manifest kind=manual and provenanceKind=application as required literals, but remove every alternative kind/provenance and nullable authorization branch.",
        "rationale": "The constants preserve public backup output and make authorization provenance explicit without retaining compatibility behavior."
      },
      {
        "id": "D3",
        "statement": "Treat schema-version-1 and pre-upgrade manifest/intent/receipt shapes as unsupported immutable input, never transform them in place, and keep current schema-version-2 application/manual artifacts operational.",
        "rationale": "The user ordered old compatibility removal, while no authorization exists to invalidate or rewrite the current format or other runtime data."
      },
      {
        "id": "D4",
        "statement": "Make current restore authorization/provenance verification unconditional at initial restore, continuation and receipt replay.",
        "rationale": "The sole current format always carries those bindings, so conditional version checks would be dead compatibility branches and a security risk."
      },
      {
        "id": "D5",
        "statement": "Preserve public ato.api/v1 and ato.api/v2 result/error semantics and defer their version convergence to RC03.",
        "rationale": "RC02 owns persisted backup/restore formats, not the product API major."
      },
      {
        "id": "D6",
        "statement": "Complete one independently reviewed result commit followed by coordinator-only artifact prune, exact-head gates, ready, FF-only local integration and ordinary push; do not clean the task worktree.",
        "rationale": "This is the user-authorized strict chain and repository Git-flow contract."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "If current schema-version-2 bytes drift, a schema-version-1/pre-upgrade artifact can satisfy the current exact shape, or a writer still accepts nullable/no authorization, stop before mutation, restore the current byte contract and tighten the one parser/writer; never add a legacy fallback."},
      {"id": "M2", "recovery": "If a crash checkpoint cannot be unambiguously continued under the current shape, preserve intent/stage/retained/receipt bytes and return RESTORE_BLOCKED or RESTORE_RECOVERY_REQUIRED; never fabricate rollback or delete evidence."},
      {"id": "M3", "recovery": "If a public result or unrelated capability changes, restore the current product contract within scope or seek reapproval; do not pull RC03 work forward."},
      {"id": "M4", "recovery": "A failed gate leaves the reserved task editable. Repair in scope, create a new result commit only when required, rerun affected/full validation and fresh review, then replace stale exact-head receipts; never reset, rebase, stash or force."}
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
      {"id": "V9", "state_binding": "material"},
      {"id": "V10", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Freeze the exact current schema-version-2 field inventory and canonical JSON bytes in tests before deleting union branches; add explicit schema-version-1 and pre-upgrade rejection fixtures.", "recovery": "Treat any current byte drift or retired-format acceptance as blocking and repair the current parser without translation."},
      {"id": "R2", "mitigation": "Convert every former intent.schemaVersion===2 check into an unconditional current check and test authorization substitution before and after publication.", "recovery": "Preserve durable evidence and block recovery until every current lineage check is restored."},
      {"id": "R3", "mitigation": "Add doctor and recovery tests that snapshot schema-version-1/malformed topology and prove zero mutation, deletion or adoption.", "recovery": "Leave the topology explicit and return the existing invalid/ambiguous/blocked classification."},
      {"id": "R4", "mitigation": "Rewrite internal backup-boundary fixtures to use an authorized manual generation while preserving every stage/source/sidecar/inventory/publication seam.", "recovery": "If a seam cannot be exercised through the production writer, add only a test hook on that same writer, never a pre-upgrade production branch."},
      {"id": "R5", "mitigation": "Run source/build/packed package and CLI E2E parity, assert the unchanged public backup/restore projections, and statically reject obsolete exported type names.", "recovery": "Keep the public product contract unchanged and defer any API major change to RC03."},
      {"id": "R6", "mitigation": "Run impact-targeted tests before stable A1, then full pinned offline validation, preserve failed diagnostics, and invoke only coordinator pathless artifact prune after the result commit.", "recovery": "Keep failed diagnostics while reserved, repair and rerun; prune only the registered task-artifact root when the exact-head result is ready for gates."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "7b950488dd1fbc5cc6ee78e904d22dc067dfe00e",
      "current_material_base": "7b950488dd1fbc5cc6ee78e904d22dc067dfe00e",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-08-31 22:57:45+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-08-31 22:57:45+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-08-31 22:57:45+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-08-31 23:18:12+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "exec_plan.py check, preflight, trace and chain-check followed by fresh independent schema-v3 A0 review",
        "evidence": "Plan check and preflight passed; the exactly-once reviewer trace returned ok=true with errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[], base/head/evaluated commit 7b950488dd1fbc5cc6ee78e904d22dc067dfe00e and state git-sha1:68db88b0d5b47e44f734fdd83293bb9993a22608. Only the scoped proposal was untracked. The independent reviewer reproduced 17,490 canonical approval-contract bytes and SHA-256 4D22A5E0165E369C8D290635C83A2B3190D071B068110BBF4462A886BAB79597, confirmed completed RC01 as the unique terminal predecessor, and returned findings=[] with readiness=ready_for_activation.",
        "state_id": "approval-sha256:4D22A5E0165E369C8D290635C83A2B3190D071B068110BBF4462A886BAB79597"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Inspect the current persistence owners and packed declarations, scan live source for obsolete format symbols, and run strict typecheck plus focused and complete tests at the exact material state.",
        "evidence": "BackupManifest is one unversioned schemaVersion-2 shape with kind=manual, provenanceKind=application and non-null authorization/state digests. BackupManifestV1/V2, RestoreIntentV1/V2, RestoreReceiptV1/V2, version-selected fields and production pre_upgrade/pre_upgrade_internal symbols are absent; only negative package assertions retain those names. Typecheck, focused 29/29, persistence 90/90 and full 414/414 passed.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run exact current-manifest byte/field assertions, immutable generation verification negatives, package declaration checks and the full pinned offline route.",
        "evidence": "The production writer emitted the exact canonical 16-field schema-2 manual/application manifest and the verified two-member generation. Schema-1, pre-upgrade, missing, extra, noncanonical, substituted-authorization, changed database, incompatible schema and corrupt material all returned BACKUP_INVALID while generation and primary evidence stayed unchanged; full and package routes passed.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run backup authorization, writer-barrier, caught failure, process interruption, connection, identity, sidecar, inventory and publication-boundary tests in focused, persistence and complete routes.",
        "evidence": "The sole writer requires a runtime.backup handoff, validates before staging and inside the writer barrier, proves the clone carries the same authorized state, and preserves sole-connection, lock, no-follow identity, exact inventory, same-parent publication and retained invalid-publication evidence. Every focused and full boundary test passed with no unauthenticated writer path.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Assert exact current intent/receipt canonical bytes and field inventories, statically inspect the single types/parsers, and exercise schema-1, missing, extra, noncanonical and substituted fixtures.",
        "evidence": "RestoreIntent and RestoreReceipt each have one exact 16-field schema-2 owner carrying all current authorization and identity links; backupManifestSchemaVersion remains 2. Retired and malformed forms returned RESTORE_BLOCKED, remained present byte-for-byte, and no conditional schema-version authorization branch or V1/V2 type surface remains.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run acknowledgement, expected-primary CAS, zero-receipt, handoff-substitution, every durable restore failpoint, response-loss, restart and mixed-topology tests in focused, persistence and complete routes.",
        "evidence": "Current restore preserves stage, durable intent, exact prior-member retention, publish, verified readback, immutable receipt and exact intent removal ordering. Recovery completed recognized intent/retention/publication/receipt states exactly once; retired, malformed or substituted intent/receipt/topology stayed RESTORE_BLOCKED without rollback, deletion or adoption. Both authorization lineages are validated unconditionally at every continuation checkpoint.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run complete doctor and path-security tests, including current pending/completed topology and retired manifest/intent/receipt fixtures, while snapshotting bytes, timestamps and inventory.",
        "evidence": "Doctor kept current schema-2 backup and restore classifications operational, reported retired schema-1 manifest as backup_invalid and retired/malformed restore topology as restore_ambiguous, and left every observed tree unchanged. Reparse, identity replacement, active-use, newer-schema and corruption precedence tests also passed.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Run the pinned complete CLI/API suite, build and package smoke; inspect the generated declarations and packed consumer types.",
        "evidence": "The full route passed 414/414 including source ato.api/v1 backup/restore/doctor and explicit ato.api/v2 behavior. Package smoke passed with pnpm 11.19.0, TypeScript 5.9.3, 112 files, current BackupManifest/RestoreReceipt consumers, source/build/installed parity and uninstall; obsolete V1/V2/pre-upgrade declarations are absent and public backup still returns kind=manual.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Run repository documentation and cached-diff checks; inspect current authority wording, exact staged inventory, file classes, ignored artifact state and trace scope facts.",
        "evidence": "Documentation passed with 100 Markdown files, 252 exact-case local links, 21 local fragments and forbidden=0. Current contracts and compatibility guidance describe one current schema-2 manual/application backup, intent and receipt format without operational legacy success claims. Both worktree and cached diff checks passed. Trace and direct inventory inspection found exactly 12 declared staged regular non-reparse task paths with unstaged=[], untracked=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]; runtime, backup, secret and ignored dependency/build material are absent from the index, and the registered .task-artifacts root is absent with zero tracked overlap.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Run focused backup/restore/doctor tests, the complete persistence route and the full pinned Node 24.19.0 offline route; bind fresh independent A1 and completion-ready trace to the exact material state.",
        "evidence": "Focused backup/restore/doctor passed 29/29 with artifact baseline 0-to-0 and root reclamation; complete persistence passed 90/90; build passed; package smoke passed with pnpm 11.19.0, TypeScript 5.9.3 and 112 files. With the installed Node 24.19.0 bin first in command-local PATH, verify:offline exited 0: lint passed 195 files/28 sources, typecheck/build passed, all tests passed 414/414 with zero fail/cancel/skip/todo and artifact 0-to-0, docs passed 100/252/21/0, production dependencies remained zero, package smoke passed 112 files, SQLite reported schemaVersion 1 with Node 24.19.0 and SQLite 3.53.3 and zero surviving generation members, and Codex remained boundaryStatus=passed, evidenceMode=blocked, externalE2E=not_run and supportClaim=false. Fresh independent A1 reproduced the approval digest and exact material state, observed the same 12-path clean staged boundary and returned findings=[]; no A2 is required. The completion-ready trace then returned ok=true, errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false, completion_ready=true and completion_blockers=[] at the same material state.",
        "state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_final",
        "independence": "Fresh independent read-only schema-v3 A0. The reviewer did not draft or materially decide the RC02 proposal, implement RC02, edit repository, Git, coordinator, runtime or external state, run mutation-capable tests, or grant authority. Prior participation was limited to independent RC01 reviews.",
        "scope": "Complete RC02 proposal and execution contract; harness PLAN-SCHEMA, A0-AUDIT and Tier-2 persistence lens; AGENTS.md, ARCHITECTURE.md and plan lifecycle; completed RC01 predecessor evidence; persistence, authorization, CLI, compatibility, validation, toolchain, ownership, threat-model and local Git-flow contracts; current manifest, intent and receipt types, parsers, writers, verifiers, restore/recovery and doctor readers; public/package consumers and directly adjacent tests. The review covered predecessor lineage, exact task scope, schema-2 byte compatibility, V1/pre_upgrade retirement, writer-reader closure, authorization ordering, CAS/no-follow/publication invariants, crash recovery, RC03-RC05 boundaries and binary validation sufficiency.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-31 22:17:02+08:00",
        "approval_sha256": "4D22A5E0165E369C8D290635C83A2B3190D071B068110BBF4462A886BAB79597",
        "evidence": "The reviewer ran trace exactly once and observed ok=true, errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[] at base/head/evaluated commit 7b950488dd1fbc5cc6ee78e904d22dc067dfe00e with state git-sha1:68db88b0d5b47e44f734fdd83293bb9993a22608; the only untracked path was the scoped proposal. Independent canonicalization reproduced 17,490 bytes and SHA-256 4D22A5E0165E369C8D290635C83A2B3190D071B068110BBF4462A886BAB79597. Completed RC01 is the unique terminal predecessor. Adjacent implementation and consumer enumeration found obsolete version/pre_upgrade branches only in the declared owners. The contract preserves exact current schema-2 bytes, makes current authorization lineage unconditional, leaves retired artifacts invalid or ambiguous without rewrite, deletion or adoption, preserves authorization and acknowledgement checks before generation inspection, and preserves CAS, receipt, stage, intent, retained-generation, publish, readback, receipt-write and exact intent-removal ordering. No tests were run by the read-only reviewer and findings=[].",
        "parent_disposition": "complete",
        "findings": [],
        "reviewed_material_base": "7b950488dd1fbc5cc6ee78e904d22dc067dfe00e"
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_repeat",
        "independence": "Fresh independent read-only schema-v3 A1. The reviewer did not draft or materially decide the RC02 proposal, perform its A0, implement or repair RC02, edit repository, Git, index, refs, coordinator, runtime or external state, run tests, or grant authority. Prior participation was limited to independent RC01 reviews.",
        "scope": "Complete stable 12-path RC02 staged diff and active ExecPlan; RC02 validation evidence; AGENTS.md, ARCHITECTURE.md and the authoritative persistence, authorization, CLI, versioning/compatibility, validation, toolchain and local Git-flow contracts; Tier-2 manifest, intent and receipt writers, parsers, verifiers, backup publication, restore/recovery topology, doctor readers, store/export/package consumers and adjacent tests. The review covered exact current schema-2 bytes and fields, retirement of V1/pre_upgrade success paths, authorization and clone-state binding, lock/stage/CAS/no-follow/inventory/publication guarantees, every durable restore checkpoint, public ato.api/v1/v2 stability, kind=manual, package declaration closure, RC03-RC05 boundaries, validation claims and failed-attempt classification.",
        "reviewed_at": "2026-08-31 23:15:25+08:00",
        "evidence": "The required exec_plan.py trace was invoked exactly once and returned ok=true, errors=[], warnings=[], state_bound=true and a0_ready=true at base, HEAD and evaluated commit 7b950488dd1fbc5cc6ee78e904d22dc067dfe00e with material state git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe. It reported exactly the 12 declared staged paths and unstaged=[], untracked=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]. Independent canonicalization reproduced 17,490 approval-contract bytes and SHA-256 4D22A5E0165E369C8D290635C83A2B3190D071B068110BBF4462A886BAB79597. The complete diff has one exact 16-field schema-2 BackupManifest, RestoreIntent and RestoreReceipt; only manual/application/non-null authorization provenance is writable and accepted. Retired or malformed artifacts are rejected without rewrite, deletion or adoption. Backup authorization, cloned-state binding, exact inventory, no-follow identity and terminal publication verification remain ordered. Restore acknowledgement, CAS, zero-receipt, durable intent, retention, publication, readback, immutable receipt, unconditional authorization lineage and exact owned-intent removal remain ordered. Doctor parses a pending receipt against its intent and classifies retired or malformed topology as ambiguous without mutation. Public CLI/API owners are unchanged, package declarations expose only current types, and no RC03-RC05 outcome is present. The recorded 29/29, 90/90, 414/414 and 112-file results and the initial sandbox EPERM classification are coherent. The reviewer ran no tests and found no substantive defect, contract violation, recovery gap or validation overclaim.",
        "reviewed_state_id": "git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe",
        "parent_disposition": "complete",
        "closes": [],
        "findings": []
      }
    },
    "audit_attempts": [],
    "validation_attempts": [
      {
        "validation_id": "V10",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-08-31 22:36:00+08:00",
        "evidence": "The first focused backup/restore/doctor invocation ran inside a filesystem sandbox that refused creation of the registered worktree-local .task-artifacts directory with EPERM. Three CLI-process cases passed and the remaining 26 cases did not reach assertions. The exact command was rerun in the authorized local test environment and passed 29/29 with artifact baseline 0-to-0 and successful root reclamation; no material change was made for the sandbox-only failure.",
        "state_id": null
      }
    ],
    "contract_revisions": [],
    "final_summary": "RC02 replaces the operational BackupManifestV1/V2, RestoreIntentV1/V2 and RestoreReceiptV1/V2 compatibility unions with one exact current schema-version-2 TypeScript owner per artifact while preserving the established canonical bytes, kind=manual, provenanceKind=application and all non-null authorization, state and identity bindings. The sole production backup writer is application-authorized; restore recovery validates both authorization lineages unconditionally; retired schema-1, pre-upgrade or malformed artifacts remain untouched invalid or ambiguous evidence. Exact material state git-sha1:0a9bfbef6e61fdd54c9d483ecc57ad4ab61ffefe passed focused 29/29, persistence 90/90 and pinned Node 24.19.0 full 414/414 validation, the 112-file package smoke, exact documentation/inventory checks and fresh independent A0/A1 closure with no A2 required. Public ato.api/v1 and ato.api/v2 behavior remains unchanged; RC03-RC05 and every Phase 3 capability remain unimplemented. The single result commit is followed only by the authorized pathless artifact prune, eleven exact-head gates, readiness, FF-only local integration and ordinary push."
  }
}
```

## Context

RC01 deliberately left the operational V1/V2 backup/restore readers intact while removing every historical database migration reader. At the RC02 base, production writes only application-authorized schema-2 manual backups and schema-2 intents/receipts, but `backup.ts` still exports unions, accepts sparse schema-1 artifacts, retains pre-upgrade kinds, and guards current authorization checks behind version branches. RC02 removes that dead lineage without changing the bytes of current schema-2 artifacts, the persistence lifecycle protocol or the product API.
