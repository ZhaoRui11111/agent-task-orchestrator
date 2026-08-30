# ExecPlan：收敛 persistence schema 与运行时路径所有权

本计划只修复当前 schema 状态、运行时目录拓扑和 live SQLite 文件路径的
实现/契约分裂，并删除已经证明没有保留义务的内部 helper。它不改变任何
迁移、磁盘格式、备份/恢复协议版本、公开输出形状或 Phase 1 能力边界。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-30 16:21:37+08:00",
    "updated_at": "2026-08-30 17:03:51+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive to execute the confirmed full-inspection repairs serially through one Goal",
        "at": "2026-08-30 16:21:37+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user execution directive plus repository standing task-commit, manifest-prune, FF-only integration, and ordinary origin/master push grants",
        "at": "2026-08-30 16:21:37+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Converge Phase 1 persistence ownership without changing durable or public compatibility: runtime.status reports the exact schema version carried by its open PersistenceStore instead of a duplicated literal; doctor returns observed schema evidence and consumes the Runtime owner's one required-directory topology; the Runtime owner alone derives the live state.sqlite3/WAL/SHM names and paths used by store and backup/restore; backup retains ownership only of generation, manifest, staging, retained, intent, and receipt protocol members; and the five proven orphan internal helpers readTextFileForDiagnostics, readApplicationStateSha256ForOwner, scopeColumns, isSafePositiveInteger, and isSafeNonnegativeInteger are removed with the package-root surface unchanged.",
    "non_goals": [
      "Do not add, edit, reorder, or reinterpret a migration, schema table, row, registry identity, checksum, on-disk payload, backup manifest, restore intent, restore receipt, connection receipt, or lifecycle-lock format.",
      "Do not replace historical schema gates or wire-format schema identifiers with the current migration target; explicit v1/v2/v3/v4 compatibility decisions remain explicit and independently reviewed.",
      "Do not change runtime root selection, trust, overlap, permission, no-follow, identity, locking, connection, transaction, backup publication, restore recovery, doctor precedence, error mapping, or public result shape.",
      "Do not make backup own Runtime descendant names or make Runtime own backup-generation/manifest/restore protocol inventories; only live primary SQLite member paths move to the Runtime owner.",
      "Do not create a generic unused-code purge, change package exports or dependencies, edit historical completed plans/evidence, implement EP-02, or add dispatcher, execution, completion, adapter, scheduler, MCP, network, secret, PR, release, deployment, or cleanup behavior."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The lazily loaded migration registry remains the sole current SQLite schema-version owner. runtime.status consumes the already-open store migration result, and doctor reports its inspected SchemaEvidence; neither Application nor Doctor may encode a second current-version literal.",
        "source": "AGENTS.md; docs/reference/persistence-contract.md Migration identity and atomicity; src/persistence/migrations.ts; src/persistence/store.ts"
      },
      {
        "id": "C2",
        "statement": "Historical compatibility thresholds and independent persisted JSON schema versions are different namespaces. Literals identifying released schema-v2/v3/v4 readers or manifest/intent/receipt/lock/connection formats remain unchanged unless this plan explicitly proves they represented the mutable current target, which it does not authorize.",
        "source": "docs/reference/versioning-compatibility-contract.md Version namespaces; docs/reference/persistence-contract.md; current migration/backup/runtime implementation"
      },
      {
        "id": "C3",
        "statement": "src/persistence/runtime.ts remains the one owner of every fixed Runtime descendant name. One internal topology derivation supplies prepare, read-only existing-layout inspection, and Doctor preclassification while preserving Doctor's absent/partial/unsafe no-create and no-write behavior.",
        "source": "docs/reference/persistence-contract.md Runtime root and path ownership; src/persistence/runtime.ts; src/persistence/doctor.ts"
      },
      {
        "id": "C4",
        "statement": "The live primary SQLite member set is exactly state.sqlite3, state.sqlite3-wal, and state.sqlite3-shm. Runtime exposes one closed internal name/path owner consumed by store and backup/restore; unknown member names fail closed and no caller-selected descendant path is introduced.",
        "source": "docs/reference/persistence-contract.md Runtime root and path ownership; src/persistence/runtime.ts; src/persistence/store.ts; src/persistence/backup.ts"
      },
      {
        "id": "C5",
        "statement": "Backup continues to own generation IDs and the contents and inventories of backup stages/generations, restore stages/retained directories, intents, manifests, and receipts. Their protocol-specific paths are not generalized into Runtime merely because they use path.join.",
        "source": "docs/reference/persistence-contract.md writer/reader closure, Backup generations, and Confirmed restore; src/persistence/backup.ts"
      },
      {
        "id": "C6",
        "statement": "A helper is retirement-ready only because repository-wide symbol/string searches, root export inventory, package export policy, tests, contracts, serialization/configuration boundaries, and Git history establish no supported caller or retained compatibility obligation. The exact retirement set is frozen to five named helpers.",
        "source": "harness-debt-scan lifecycle-debt reference; package.json exports; scripts/package-smoke.mjs; repository-wide evidence at base 22b26376f375ab2653ebef5fb4f78158cd8a7d68"
      },
      {
        "id": "C7",
        "statement": "Fresh independent A0 is required before activation, fresh independent A1 after the stable material diff, and every confirmed in-scope HIGH or MEDIUM repair requires fresh independent A2. The implementer cannot act as reviewer.",
        "source": "docs/plans/README.md; harness-exec-plan audit contract"
      },
      {
        "id": "C8",
        "statement": "The task uses only its coordinator-owned branch/worktree, declared paths, terminal completed-plan commit, explicit manifest prune, exact-head gates, FF-only local integration, and standing-authorized ordinary origin/master push. Cleanup remains unauthorized.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md; current user serial Goal directive"
      }
    ],
    "authorization": {
      "allowed": [
        "Read repository material and modify only declared task-owned paths in the coordinator-owned repair-persistence-ownership worktree.",
        "Replace duplicated current-schema projection with store/SchemaEvidence facts; centralize fixed Runtime directory and live-primary-member derivation; route Doctor, store, and backup/restore through those owners without changing external or persisted behavior.",
        "Remove exactly the five named retirement-ready internal helper exports and now-unused imports, while keeping the package-root export inventory unchanged.",
        "Add focused schema-status, topology, live-path, no-write Doctor, backup/restore, invalid-member, and compatibility regressions; run local restricted-network validation and package smoke routes.",
        "Create and move this task-owned ExecPlan through proposal, active, and completed states; use fresh sequential read-only independent A0/A1 and any required A2 reviewer without repository or external mutation by reviewers.",
        "Create task-owned commits, invoke pathless manifest-bound prune after the terminal result commit, record exact-head gates, perform coordinator FF-only local integration, and invoke the repository standing-authorized ordinary origin/master push after all prerequisites remain exact."
      ],
      "requires_reapproval": [
        "Any schema or migration change, persisted/wire format change, public output/export change, historical compatibility change, topology/security relaxation, backup/restore semantic change, additional helper retirement, dependency change, external path, or expansion of the declared task-path envelope.",
        "Any external write other than the standing ordinary origin/master push, or any secret/account use, PR, release, deployment, cleanup, force, reset, rebase, stash, another repository, or EP-02 implementation."
      ],
      "prohibited": [
        "Rewrite or repair runtime/user data, migration files/history, backup/restore evidence, completed plans, external Projects, dependencies, secrets, accounts, or coordinator state outside harness-git-flow commands.",
        "Use caller-supplied descendant paths, a permissive path resolver, broad cleanup, reset, rebase, stash, force push, PR creation, release, deployment, compatibility fallback, or schema normalization.",
        "Treat a plan, review, valid state, successful test, commit, grant, or local integration as authorization for any adjacent filesystem, product, Git, network, or account action."
      ],
      "persistence": {
        "required": true,
        "action": "task-owned proposal/active/completed plan, evidence, implementation, test, and contract commits culminating in one terminal result commit, followed by manifest-bound prune, exact-head gate receipts, coordinator FF-only local integration, and the standing-authorized ordinary origin/master push",
        "source": "Current user serial Goal directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "docs/plans/proposal/repair-persistence-ownership.md", "kind": "file"},
        {"path": "docs/plans/active/repair-persistence-ownership.md", "kind": "file"},
        {"path": "docs/plans/completed/repair-persistence-ownership.md", "kind": "file"},
        {"path": "docs/plans/evidence/repair-persistence-ownership", "kind": "directory"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/doctor.ts", "kind": "file"},
        {"path": "src/persistence/runtime.ts", "kind": "file"},
        {"path": "src/persistence/store.ts", "kind": "file"},
        {"path": "src/persistence/values.ts", "kind": "file"},
        {"path": "test/application-service.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/persistence-backup-restore.test.mjs", "kind": "file"},
        {"path": "test/persistence-doctor.test.mjs", "kind": "file"},
        {"path": "test/persistence-path-security.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "One independently reviewed approval/execution contract freezes current-versus-historical schema ownership, Runtime-versus-backup path ownership, the exact helper retirement set, security invariants, authorization, and binary validation surface.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "Application status and Doctor report schema facts from the migration/store/evidence owner, and prepare, inspect, and Doctor consume one Runtime-owned fixed-directory topology without changing read-only classification.",
        "validation_ids": ["V2", "V3", "V6"]
      },
      {
        "id": "M3",
        "outcome": "Runtime owns the closed live SQLite main/WAL/SHM name-to-path mapping consumed by store and backup/restore, backup protocol-member ownership remains bounded, and exactly five retirement-ready helpers are absent.",
        "validation_ids": ["V4", "V5", "V6", "V7"]
      },
      {
        "id": "M4",
        "outcome": "Focused and complete regression, documentation, package, fresh independent implementation review, any required closure review, terminal plan state, manifest prune, and exact-head gates accept one clean material state ready for FF-only integration and ordinary push.",
        "validation_ids": ["V6", "V7", "V8", "V9", "V10", "V11"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "Approval, scope, ownership classification, authorization, persistence/path guarantees, recovery, and activation readiness",
        "criterion": "Fresh independent A0 reports complete and ready_for_activation against the exact approval digest and reviewed material base, parent disposition is complete, and there are zero unresolved findings, schema errors, scope errors, ownership ambiguities, or unapproved guarantees."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Current schema-version projection and historical namespace separation",
        "criterion": "Focused Application and Doctor tests exit 0 and prove runtime.status.schemaVersion equals its open store migration evidence, healthy/not-initialized/upgrade/newer Doctor results return the actually inspected version, and source review finds no Application/Doctor current-version literal while all explicit released reader and persisted-format gates remain unchanged."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Single Runtime fixed-directory topology and Doctor no-write behavior",
        "criterion": "Focused Runtime path-security and Doctor tests exit 0 and prove one derived topology exactly matches every issued required directory; prepare and existing-layout inspection materialize that topology; Doctor classifies absent, partial, unsafe, active, restore, backup, and healthy cases without creating, deleting, renaming, opening writable, or changing any byte/timestamp/inventory."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Runtime-owned live SQLite main/WAL/SHM names and paths",
        "criterion": "Focused path-security, store, backup/restore, concurrency, and Doctor tests exit 0 and prove the closed Runtime member set maps exactly to layout.databasePath and its WAL/SHM siblings, rejects every unknown name, and is consumed for every store/backup live-primary operation with all existing identity, CAS, rename, permission, and recovery checks intact."
      },
      {
        "id": "V5",
        "type": "manual",
        "target": "Backup-versus-Runtime path ownership boundary",
        "criterion": "Source and contract review find no backup reconstruction of a live primary path from layout.root and no duplicate live member-name set, while backup remains the only owner of generation/stage/manifest/retained/intent/receipt protocol-member paths and no caller-selected descendant input or public export is added."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Persistence, lifecycle, restore, and path-security regression closure",
        "criterion": "All persistence-schema, persistence-path-security, persistence-doctor, persistence-backup-restore, persistence-concurrency, persistence-repository, application-service, and application-atomicity routes exit 0 with zero failure, skip, or todo and no surviving task artifact."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Exact internal helper retirement and stable package-root surface",
        "criterion": "Inventory of executable source, tests, scripts, package/configuration inputs, and authoritative reference contracts returns zero definition, import, call, dynamic lookup, serialization/configuration key, or supported-consumer reference for exactly readTextFileForDiagnostics, readApplicationStateSha256ForOwner, scopeColumns, isSafePositiveInteger, and isSafeNonnegativeInteger; lifecycle plan/audit/evidence prose that records the retirement is explicitly excluded from that zero-occurrence assertion. Strict typecheck/build and the exact package-root export test pass, and no additional export or helper is removed."
      },
      {
        "id": "V8",
        "type": "manual",
        "target": "Authoritative persistence documentation and capability truthfulness",
        "criterion": "The persistence contract states the single topology/live-path owner and current-versus-historical schema distinction, accurately preserves backup ownership and Doctor no-write behavior, introduces no EP-02/platform/release claim, and all repository Markdown links/fragments resolve."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Static type, source-boundary, repository hygiene, package, and complete restricted-network regression",
        "criterion": "Strict typecheck, build, lint, git diff --check, task-scope inventory, package smoke, and pnpm verify:offline all exit 0 at one material state with no download, repair, generated, forbidden, reparse, secret, out-of-scope, whitespace, unsupported claim, or surviving .task-artifacts member."
      },
      {
        "id": "V10",
        "type": "manual",
        "target": "Fresh independent stable-diff implementation and closure review",
        "criterion": "Fresh independent A1 reports complete against the exact current material state and parent disposition is complete; every confirmed in-scope HIGH/MEDIUM finding is repaired, revalidated, and closed by a fresh independent A2, while eligible LOW handling satisfies the schema and no unresolved review blocker remains."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Terminal ExecPlan, artifact, commit, and coordinator readiness",
        "criterion": "At the terminal candidate, the plan is at its declared completed lifecycle path with every milestone, validation, audit, state binding, and final-summary field coherent/current; exact staged inventory contains only declared task-owned regular files, diff checks pass, one clean task-owned commit is eligible for manifest prune and exact-head coordinator gates, and .task-artifacts is absent."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Replacing a released compatibility threshold with the mutable current schema target can silently reject historical databases or backups after the next migration."},
      {"id": "R2", "risk": "A pure Doctor topology helper can accidentally validate, resolve, or create paths and break absent/partial read-only classification."},
      {"id": "R3", "risk": "A generalized live-member resolver can accept caller-selected filenames or weaken issued-layout identity checks."},
      {"id": "R4", "risk": "Moving backup generation or restore-protocol member ownership into Runtime would create a new oversized owner instead of closing the identified split."},
      {"id": "R5", "risk": "Deleting an apparently unused exported helper can break a supported internal or package consumer if root exports, dynamic references, serialization, tests, contracts, or historical obligations were missed."},
      {"id": "R6", "risk": "Mechanical ownership refactoring around live WAL/SHM renames can change path, object-identity, CAS, or recovery behavior despite unchanged types."},
      {"id": "R7", "risk": "ExecPlan movement, base change, or review repair can stale approval/material evidence or move a path outside the frozen task envelope."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "runtime.status receives schemaVersion from store.migration.schemaVersion, and Doctor returns evidence.schemaVersion after comparing it with currentSchemaVersion().",
        "rationale": "Migration registry evidence already exists at both call sites, so no new dependency or version constant is required and the reported value remains tied to the database actually opened/inspected."
      },
      {
        "id": "D2",
        "statement": "Explicit schema 2/3/4 reader and backup-protocol checks remain literal historical compatibility decisions; only values currently pretending to project the mutable target are replaced.",
        "rationale": "Version namespaces and released compatibility gates must not be conflated with the registry's current target counter."
      },
      {
        "id": "D3",
        "statement": "Runtime implements one internal directory-topology materializer whose identity mapping is used by prepareRuntimeLayout, inspectExistingRuntimeLayout, and a no-I/O required-directory projection used by Doctor.",
        "rationale": "One ordered name graph removes three copies while allowing Doctor to classify an absent or incomplete root before an issued RuntimeLayout can exist."
      },
      {
        "id": "D4",
        "statement": "Runtime exports an internal frozen primary-member name set/type and an issued-layout-checked name-to-path function; store and backup/restore consume it for live primary members only.",
        "rationale": "A closed resolver preserves the Runtime descendant-name owner and prevents arbitrary filenames, while backup-specific stage/generation/restore protocol paths remain local to backup.ts."
      },
      {
        "id": "D5",
        "statement": "Remove exactly five retirement-ready helpers and their now-unused imports without adding aliases or replacement wrappers.",
        "rationale": "Each has only its definition as a repository occurrence, is absent from the package-root export and all durable/configured boundaries, and has no documented compatibility obligation; an alias would preserve the same debt."
      },
      {
        "id": "D6",
        "statement": "Implementation, audit, plan-state movement, terminal commit, manifest prune, gate, integration, and push steps remain serial within the current Goal.",
        "rationale": "The user explicitly requested Goal-based serial execution and predecessor terminal publication before the final rescan."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal and make no implementation edit until trace is coherent and fresh independent A0 is ready with complete parent disposition."},
      {"id": "M2", "recovery": "If schema projection or topology consolidation changes a historical compatibility gate, public shape, or Doctor side effect, stop in active state, preserve the failing evidence, and revise the approval contract before continuing."},
      {"id": "M3", "recovery": "On any invalid-name, identity, backup, restore, concurrency, or helper-consumer failure, keep the task worktree, restore the exact owner boundary within declared scope, and rerun every affected focused route before broader validation."},
      {"id": "M4", "recovery": "Do not complete, commit terminal state, prune, integrate, or push while trace, independent review, current-state validation, artifact receipt, staged inventory, or reservation freshness is incomplete; retain the task worktree for correction."}
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
      {"id": "V10", "state_binding": "material"},
      {"id": "V11", "state_binding": "material"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Classify every version comparison as current-target projection, observed evidence, historical database threshold, or independent persisted-format schema before editing; change only the first category and test historical prefixes/backups unchanged.", "recovery": "If any released v2/v3/v4 fixture or historical backup changes classification, revert that comparison within the task diff and keep the explicit compatibility gate."},
      {"id": "R2", "mitigation": "Keep the Doctor-facing topology projection pure and lexical, with filesystem validation/materialization remaining in existing Runtime routines; snapshot absent and complete roots before/after focused Doctor tests.", "recovery": "Any created path, byte, timestamp, inventory, receipt, or lock change rejects the candidate and the plan remains active."},
      {"id": "R3", "mitigation": "Use a frozen closed name tuple, runtime membership check, issued-layout assertion, and exact main/WAL/SHM mapping; add unknown-name and forged-layout negatives.", "recovery": "Fail closed with INVALID_INPUT/PATH_IDENTITY_CHANGED and do not widen the accepted type or expose the resolver at the package root."},
      {"id": "R4", "mitigation": "Move only the duplicate live primary member names/path function; leave all generation/stage/manifest/retained/intent/receipt builders and inventories in backup.ts and review each remaining path.join by ownership category.", "recovery": "Return any protocol-specific path to backup.ts before A1 and update the contract/evidence rather than expanding Runtime."},
      {"id": "R5", "mitigation": "Record repository-wide occurrence, package exports, package smoke, contract/test/config/serialization, and Git-history evidence for the exact five helpers; run strict build and package consumer tests after removal.", "recovery": "If a supported obligation is found, classify that symbol required, restore only it, revise the fixed retirement set and obtain fresh A0 because approval changed."},
      {"id": "R6", "mitigation": "Keep rename, no-follow inspection, identity receipts, checksums, lock tokens, and recovery order byte-for-byte except for calling the Runtime path owner; run all path, concurrency, backup/restore, and Doctor suites.", "recovery": "Preserve the failing fixture, make no runtime/user-data repair, correct only the routing at the active task state, and rerun the complete persistence matrix."},
      {"id": "R7", "mitigation": "Trace the unique plan, use coordinator CAS tokens, accept base transitions only through the ExecPlan policy, reserve before final review, and bind validation/reviews to exact current material state.", "recovery": "On stale state or changed base, stop mutation, trace/recover coordinator intent, run base-diff, reassess approval impact, and refresh review/validation as required."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "22b26376f375ab2653ebef5fb4f78158cd8a7d68",
      "current_material_base": "22b26376f375ab2653ebef5fb4f78158cd8a7d68",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-08-30 16:37:50+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-08-30 16:53:17+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-08-30 16:53:17+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-08-30 17:03:51+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Obtain fresh independent A0 after repairing F-A0-01, independently trace and canonicalize the revised approval contract, and bind activation readiness to the exact revised digest and material base.",
        "evidence": "Fresh independent A0 attempt 2 at 2026-08-30 16:35:57+08:00 independently reproduced 17171 canonical approval bytes and SHA-256 C79539393C7FA26E8DE741384504C1C4993FD50336E11806233EB61CCA47B20D at reviewed base 22b26376f375ab2653ebef5fb4f78158cd8a7d68. Trace had empty errors, warnings, outside_scope, overlap, baseline_diff, staged, unstaged, and pre_existing_dirty. F-A0-01 was closed by the executable/supported-consumer inventory boundary, findings were empty, and readiness was ready_for_activation.",
        "state_id": "approval-sha256:C79539393C7FA26E8DE741384504C1C4993FD50336E11806233EB61CCA47B20D"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run focused Application/Doctor tests and inspect every current-schema projection separately from released database and persisted-protocol version gates.",
        "evidence": "The 197-test focused route passed with zero failure, skip, todo, or surviving artifact. runtime.status now receives store.migration.schemaVersion; Doctor final results return SchemaEvidence.schemaVersion after comparing against currentSchemaVersion(); targeted source search found no schemaVersion: 4 current-target literal in Application or Doctor, while historical migration and protocol gates were unchanged.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run focused Runtime path-security and Doctor suites and review the shared topology materializer and pure required-directory projection.",
        "evidence": "The focused route passed all absent, partial, unsafe, active, restore, backup, healthy, identity, and no-write cases. requiredRuntimeDirectoryPaths is a lexical no-I/O projection of the same RuntimeDirectoryTopology used by prepareRuntimeLayoutInternal and inspectExistingRuntimeLayout; Doctor consumes it without creating or mutating the runtime tree.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run focused path-security, store, backup/restore, concurrency, Doctor, and repository tests and inspect all live-primary member routing.",
        "evidence": "The 197-test focused route passed. PRIMARY_RUNTIME_MEMBER_NAMES is the frozen exact state.sqlite3/state.sqlite3-wal/state.sqlite3-shm tuple; primaryRuntimeMemberPath checks an issued layout, maps the exact three members, rejects unknown names, and is consumed by store and every backup/restore live-primary access without changing identity, CAS, rename, or recovery ordering.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Review Runtime and backup path construction by ownership category and run negative static searches for the retired backup live-path owner.",
        "evidence": "Static searches returned no PRIMARY_MEMBER_NAMES duplicate and no path.join(layout.root...) reconstruction in backup.ts. Runtime alone owns live main/WAL/SHM names and paths; backup.ts still owns backup-generation, stage, manifest, retained, intent, and receipt protocol members, including its distinct generation database filename, and no package-root export or caller-selected descendant was added.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run the exact impact-selected Application and Persistence route through the repository test runner.",
        "evidence": "pnpm test over application-service, application-atomicity, persistence-schema-migrations, persistence-path-security, persistence-doctor, persistence-backup-restore, persistence-concurrency, and persistence-repository exited 0: 197 passed, 0 failed, 0 skipped, 0 todo; artifact hygiene passed with baselineEntries 0, terminalEntries 0, and rootReclaimStatus reclaimed.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Search executable/supported-consumer boundaries for the exact five retired names, then run strict typecheck, build, full export-policy tests, and package smoke.",
        "evidence": "rg over src, test, scripts, package.json, and docs/reference returned zero occurrence for all five names. pnpm typecheck and pnpm build exited 0; the full 283-test route passed the exact package-root export policy; package smoke passed with 83 packed files, consumer types, export, persistence, source-built-installed console parity, and uninstall all accepted. Only the five approved helpers and now-unused imports were removed.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Review the authoritative persistence-contract delta and run the repository Markdown/link/fragment checker.",
        "evidence": "The contract now distinguishes registry-owned current schema from historical/protocol namespaces, records the one Runtime topology and closed live-primary mapping, preserves backup protocol ownership and Doctor no-write behavior, and makes no EP-02 or unsupported capability claim. pnpm docs:check exited 0 with 73 Markdown files, 241 local links, 21 local fragments, and 0 forbidden findings.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Run strict typecheck, build, lint, diff hygiene, scope trace, complete tests, package smoke, and the frozen restricted-network offline verification route at one material state.",
        "evidence": "typecheck, build, lint (149 files/20 source files), git diff --check, docs:check, 283/283 full tests, package smoke, and pnpm verify:offline all exited 0. Offline verification also passed dependency security (0 production dependencies; TypeScript 5.9.3 only), SQLite feasibility with zero surviving generation members, and the Codex blocked boundary. ExecPlan trace bound exactly 11 material paths to git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120 with empty errors, warnings, outside_scope, overlap, baseline_diff, staged, and pre_existing_dirty; .task-artifacts ended absent.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Obtain a fresh independent read-only A1 over the complete stable task diff, direct Persistence/Application owner adjacency, authoritative contracts, and all material-bound validation evidence.",
        "evidence": "Fresh independent A1 at 2026-08-30 17:01:05+08:00 reported findings=[] at exact state git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120. It independently confirmed the sole current-schema projections, pure one-owner Runtime topology, Doctor no-write ordering, closed issued-layout live SQLite family, backup protocol-path ownership, exact five-helper retirement, unchanged package surface, historical/protocol version gates, identity/no-follow/CAS/rename/concurrency/recovery behavior, and V2-V9 evidence. End-of-review trace and diff checks remained exact; A2 is not required.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Stage only the complete declared terminal candidate, inspect cached and worktree inventories, run cached diff checking, move the sole lifecycle plan from active to completed, and require an exact completion-ready trace before the terminal commit.",
        "evidence": "The pre-terminal staged inventory contained exactly 12 declared task-owned regular files: one lifecycle plan addition and 11 contract, source, and test material paths. git diff --cached --check exited 0; unstaged and untracked inventories were empty; ignored node_modules, .pnpm-store, dist, and generated material were excluded; .task-artifacts was absent. After the sole plan path moved from active to completed and was restaged, the exact trace must retain errors=[], warnings=[], outside_scope=[], overlap=[], completion_ready=true at git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120 before commit, manifest prune, exact-head gates, FF-only integration, and ordinary push.",
        "state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/a0_artifact_concurrency, A0 attempt 2",
        "independence": "Fresh read-only review from current repository and skill authority; the reviewer did not author the revision, make substantive decisions, edit repository/Git/coordinator/external state, or grant authority, and did not reuse the prior A0 conclusion.",
        "scope": "Activation-readiness audit of the complete revised persistence-ownership proposal, repository and harness authority, current implementation/tests, schema namespaces, Runtime/Doctor topology, Runtime-versus-backup paths, five helper retirements, Tier-2 persistence transitions, scope, authorization, validation, failure, and recovery contracts.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-08-30 16:35:57+08:00",
        "approval_sha256": "C79539393C7FA26E8DE741384504C1C4993FD50336E11806233EB61CCA47B20D",
        "evidence": "Fresh trace and independent canonicalization exactly matched the revised digest and reviewed base with no scope/dirty/schema warning. The reviewer confirmed F-A0-01 closed; current-versus-historical version namespaces distinct; one pure Runtime topology feasible without Doctor writes; live main/WAL/SHM routing can move to Runtime while backup protocol paths remain backup-owned; exact five-helper retirement has no supported caller/compatibility obligation; and Tier-2 identity, no-follow, lock, CAS, inventory, failure, recovery, authorization, and validation contracts are complete.",
        "parent_disposition": "complete",
        "reviewed_material_base": "22b26376f375ab2653ebef5fb4f78158cd8a7d68",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/a1_artifact_concurrency",
        "independence": "Fresh independent read-only A1 from current repository and complete harness authority; reviewer did not implement or repair the change, reuse an old A1 conclusion, edit repository material, modify Git/index/refs/coordinator/external state, or grant authority.",
        "scope": "The active ExecPlan, all 11 material paths, complete task diff, direct Runtime/Doctor/store/backup/Application/package-export adjacency, repository authority, persistence/versioning/toolchain/validation contracts, and V2-V9 evidence, including Tier-2 identity, no-follow, CAS, rename, concurrency, failure, and recovery behavior.",
        "reviewed_at": "2026-08-30 17:01:05+08:00",
        "evidence": "Independent trace matched approval SHA-256 C79539393C7FA26E8DE741384504C1C4993FD50336E11806233EB61CCA47B20D, base and HEAD 22b26376f375ab2653ebef5fb4f78158cd8a7d68, and material state git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120 with empty errors, warnings, outside_scope, overlap, baseline_diff, staged, and pre_existing_dirty. The reviewer inspected every material diff and direct reader/owner closure, confirmed current versus historical/protocol version separation, pure shared Runtime topology and Doctor no-write order, the exact issued-layout main/WAL/SHM closure, backup-owned protocol members, the five-helper zero supported-consumer inventory, unchanged package surface and compatibility behavior, and all recorded focused/full/offline evidence. End-of-review HEAD, diff check, material paths, and lifecycle-excluded plan remained exact.",
        "reviewed_state_id": "git-sha1:6a1421d0a6be02b839aca0bc1cb0fc918797d120",
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
        "finding_ids": ["F-A0-01"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-08-30 16:32:03+08:00 bound approval digest F99A7E519299272A35A22EF86D222BCD536CA2D20331C65FF1CD97B514953EE4 and confirmed one MEDIUM contract gap: V7 required repository-wide zero references for five helper names even though the lifecycle plan must retain those names as retirement evidence. The parent accepted F-A0-01 and narrowed the binary inventory to executable/supported-consumer boundaries while explicitly excluding lifecycle plan/audit/evidence prose; fresh A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "activated",
        "reason": "Fresh independent A0 at 2026-08-30 16:35:57+08:00 bound canonical approval digest C79539393C7FA26E8DE741384504C1C4993FD50336E11806233EB61CCA47B20D and reviewed base 22b26376f375ab2653ebef5fb4f78158cd8a7d68, confirmed F-A0-01 materially closed, reported no finding, and found the revised repair contract ready_for_activation. The parent accepted the report and activated implementation."
      }
    ],
    "validation_attempts": [],
    "contract_revisions": [
      {
        "at": "2026-08-30 16:32:58+08:00",
        "summary": "After A0 finding F-A0-01, made helper-retirement validation attainable by requiring zero executable/supported-consumer definitions or references while explicitly excluding the lifecycle plan, audit, and evidence prose that must name the retired helpers; retained the exact five-helper set, package-root assertion, and no-additional-removal boundary.",
        "previous_approval_sha256": "F99A7E519299272A35A22EF86D222BCD536CA2D20331C65FF1CD97B514953EE4"
      }
    ],
    "final_summary": "Phase 1 persistence ownership is converged without durable or public compatibility change: runtime.status projects its open store migration version; Doctor projects inspected SchemaEvidence and consumes the Runtime owner's one pure fixed-directory topology; Runtime owns the closed issued-layout state.sqlite3/WAL/SHM mapping consumed by store and backup/restore; backup retains every generation, staging, manifest, retained, intent, and receipt protocol path; and exactly five unsupported internal helpers are retired with the package-root surface unchanged. Focused, full, package, restricted-network, documentation, path-security, backup/restore, and fresh independent A1 evidence all pass with no artifact survivor or EP-02 capability expansion."
  }
}
```

## Context

The full read-only debt scan found four coupled ownership splits: Application
status duplicates the current migration target, Doctor duplicates Runtime's
fixed directory graph and current result version, backup reconstructs the live
primary SQLite family from `layout.root`, and five exported internal helpers
have no remaining caller or compatibility duty. The repository is otherwise a
closed schema-v4 local Phase 1 foundation; this plan deliberately preserves
all explicit released schema and backup/restore protocol gates.
