# ExecPlan：分解组合持久化仓库

RC04 是 Phase 3 前兼容与结构债收敛序列的第四项。它只把当前 240 KB 的组合 application repository 按记录族、组合状态与事务边界拆成内聚模块，同时保持一个事务 owner、一个聚合出口以及全部 schema-version-1、授权、执行、dispatcher、备份恢复和产品行为不变；RC05 的 application/CLI 拆分与 unused/noUnused 工作仍须独立完成。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 01:58:06+08:00",
    "updated_at": "2026-09-01 04:16:00+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive requiring strict serial implementation of RC01 through RC05",
        "at": "2026-09-01 01:58:06+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive requiring one result commit, FF-only integration and ordinary push for every RC plan",
        "at": "2026-09-01 01:58:06+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Decompose src/persistence/application-repository.ts into cohesive application-repository-model, application-repository-readers, application-repository-digest, application-repository-state, application-repository-lifecycle and application-repository-transaction modules; reduce application-repository.ts to the single re-export aggregation boundary; retain exactly one public ApplicationTransaction and its sole application-repository-family runWriteTransaction owner; preserve every current type/export, SQL statement, schema-version-1 row meaning, canonical state/lifecycle digest, transaction/CAS/fence ordering, error, backup/restore/doctor result, package surface and sole ato.api/v1 behavior.",
    "non_goals": [
      "Do not perform RC05 application.ts, cli-api.ts or cli.ts decomposition, remove the twelve separately identified unused declarations, or enable noUnusedLocals/noUnusedParameters.",
      "Do not change migration SQL or registry identity, schemaVersion, table/index/trigger inventory, runtime paths, backup manifest, restore intent/receipt, lifecycle digest version, stored bytes, row ordering, public API or ato.execution/v1.",
      "Do not change Domain, ProjectRegistry, authorization vocabulary or 19/23/29/30 checkpoints, application decisions, Manual adapter protocol, reliable-loop semantics, dispatcher membership/outcome semantics, fencing, confirmations or error mapping.",
      "Do not add scheduler, scheduled trigger, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon/service, release, deployment, telemetry or platform-support claims.",
      "Do not delete or rewrite completed plans, audit evidence, Git history, .local content, runtime/backup data, ignored dependency/build stores, existing worktrees or task branches."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "RC03 has terminal result commit 58aac50d3bed8d831c24b0169872384f54ae47d0, its coordinator task is pushed, and local master plus origin/master matched that commit before RC04 task creation. RC05 cannot begin until RC04 is completed, integrated and pushed.",
        "source": "current user directive; completed RC03 plan; fresh Git and coordinator trace"
      },
      {
        "id": "C2",
        "statement": "The baseline src/persistence/application-repository.ts is the 240241-byte combined owner for exported record types, SQL readers, cross-record validation, state/lifecycle hashing, owner binding and the ApplicationTransaction write API. RC04 changes structure only and must not change an observable value or database effect.",
        "source": "current source inventory; docs/reference/persistence-contract.md"
      },
      {
        "id": "C3",
        "statement": "The target modules are exactly application-repository-model.ts for all current record/state types and closed constants, application-repository-readers.ts for per-table SELECT and typed row decoding, application-repository-digest.ts for pure state/lifecycle projections and hashes, application-repository-state.ts for the sole combined cross-table decoder, application-repository-lifecycle.ts for snapshot and untransactional handoff validation, and application-repository-transaction.ts for owner binding, the one ApplicationTransaction class, all SQL writes/CAS and owner-scoped helpers.",
        "source": "current contiguous line/dependency inventory; ARCHITECTURE.md dependency direction"
      },
      {
        "id": "C4",
        "statement": "application-repository.ts becomes a declarative re-export-only aggregation boundary. It contains no SQL, mutable state, node:sqlite import, validation fallback, class or second implementation and recreates no compatibility branch.",
        "source": "RC04 structural target; current internal import boundary"
      },
      {
        "id": "C5",
        "statement": "Within the six application-repository implementation modules and their facade, src/persistence/application-repository-transaction.ts is the sole product application transaction owner: it alone defines and exports ApplicationTransaction, owns the application-state store binding and invokes runWriteTransaction. The other five implementation modules and the facade cannot begin or commit transactions, bind stores, authorize, select Domain commands or perform external effects. The separate backup binding and terminal lifecycle-authorization writer barrier in src/persistence/backup.ts and the Domain transaction owners in src/persistence/repository.ts remain legitimate, unchanged and out of scope.",
        "source": "ARCHITECTURE.md; persistence and application ownership contracts"
      },
      {
        "id": "C6",
        "statement": "Module dependencies are acyclic: model has no database dependency; readers and digest depend only on lower-level model/value/database inputs and never on state/lifecycle/transaction; state composes model/readers/digest; lifecycle composes state/digest/model; transaction composes model/readers/digest/state, delegates every per-table SELECT and typed readback decoder to readers, delegates state hashing to digest, and exclusively owns the application-family binding, ApplicationTransaction, writes/CAS and runWriteTransaction; no internal module imports application-repository.ts.",
        "source": "RC04 target architecture and static dependency validation"
      },
      {
        "id": "C7",
        "statement": "The facade exports the exact existing names and declaration meanings. Current production/tests may retain their application-repository.ts imports; src/persistence/index.ts and the package-root export surface remain unchanged.",
        "source": "current TypeScript imports, declarations and package contract"
      },
      {
        "id": "C8",
        "statement": "The committed baseline SQL and every database reader/writer statement, column order, sort order, canonical JSON projection, SHA-256 value, authorization relation check, CAS predicate, lease/fence check and post-callback full-state validation remain semantically and textually equivalent.",
        "source": "persistence, authorization and reliability contracts"
      },
      {
        "id": "C9",
        "statement": "Writer-reader closure documentation names the new physical readers/state/digest/lifecycle/transaction modules without creating multiple business owners; manual-backend-repository.ts remains the Manual journal semantic writer while its physical writes still use the exported ApplicationTransaction application-family boundary.",
        "source": "docs/reference/persistence-contract.md; docs/reference/contract-ownership.md"
      },
      {
        "id": "C10",
        "statement": "Fresh independent A0 precedes activation; fresh independent read-only A1 follows one stable complete diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. The implementer cannot review its own work and parent disposition is separate.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C11",
        "statement": "Use only task/rc04-persistence-decomposition and D:/agent-task-orchestrator/.worktrees/rc04-persistence-decomposition. After one result commit, invoke pathless current-head artifact prune, all twelve frozen exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, PR, release, deployment, reset, rebase, stash and force are prohibited.",
        "source": "current user directive; AGENTS.md; local-agent-git-flow contract"
      },
      {
        "id": "C12",
        "statement": "Current capability claims remain the closed local explicit-Manual Phase 2 product under sole ato.api/v1 and independently frozen ato.execution/v1. Structural decomposition cannot be described as a new runtime capability or support claim.",
        "source": "AGENTS.md; ARCHITECTURE.md; current reference contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Create and update this RC04 schema-v3 plan and task evidence; edit only declared paths; mechanically move existing persistence types/readers/validation/transaction code into exactly the six approved modules application-repository-model.ts, application-repository-readers.ts, application-repository-digest.ts, application-repository-state.ts, application-repository-lifecycle.ts and application-repository-transaction.ts; reduce the existing aggregate file to re-exports; add architecture tests and update exact ownership documentation.",
        "Run local impact-selected and full offline validation, create only validation-owned disposable .task-artifacts, make one task-owned result commit, invoke the standing-authorized pathless prune, record twelve exact-head gates, mark ready, FF-only integrate and use the standing-authorized ordinary non-force origin/master push.",
        "Use fresh independent read-only reviewers for A0, A1 and any required A2; reviewers may inspect code and evidence but may not edit or grant authority."
      ],
      "requires_reapproval": [
        "Any behavior, public type/export, SQL, schema, row ordering, canonical bytes/digest, transaction, CAS/fence, authorization, backup/restore/doctor or product result change.",
        "Any need for an import compatibility shim other than the approved re-export-only aggregate, any cycle, duplicate transaction owner, new dependency or change outside the declared task paths.",
        "Any RC05 outcome, external path, network/secret access, PR, merge other than coordinator FF-only integration, release, deployment, destructive operational cleanup or user-data mutation."
      ],
      "prohibited": [
        "Adopt, delete, clean up or impersonate the Codex application worktree or any pre-existing branch, worktree or coordinator task.",
        "Delete completed plans, evidence, Git history, .local, runtime/backup data, node_modules, pnpm store, dist, ignored content or any existing worktree/task branch.",
        "Implement scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or unsupported integration/platform claims."
      ],
      "persistence": {
        "required": true,
        "action": "one task-owned terminal result commit containing the completed RC04 plan, followed by coordinator pathless artifact prune, twelve exact-head gates, ready, FF-only local integration and the standing-authorized ordinary origin/master push",
        "source": "current user directive plus AGENTS.md/local-agent-git-flow narrow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC04-persistence-module-decomposition.md", "kind": "file"},
        {"path": "docs/plans/active/RC04-persistence-module-decomposition.md", "kind": "file"},
        {"path": "docs/plans/completed/RC04-persistence-module-decomposition.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC04", "kind": "directory"},
        {"path": "docs/reference/persistence-contract.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/persistence/application-repository.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-digest.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-lifecycle.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-model.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-readers.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-state.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-transaction.ts", "kind": "file"},
        {"path": "test/persistence-module-architecture.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "All existing exported records/constants move to the database-free model and every per-table SELECT/typed row decoder, including ApplicationTransaction readback queries, moves to the one readers module and is called from its owning state/transaction flow with no cycle, omitted field or duplicate decoder.",
        "validation_ids": ["V2", "V3"]
      },
      {
        "id": "M2",
        "outcome": "Digest projection, combined state proof, lifecycle handoff verification and the single transaction/binding owner are physically separate in the declared dependency order, while the aggregate facade preserves the exact existing internal contract.",
        "validation_ids": ["V2", "V4", "V5", "V6", "V7"]
      },
      {
        "id": "M3",
        "outcome": "Architecture tests and current contracts freeze the acyclic module graph, one transaction owner, exact writer-reader closure and unchanged capability boundaries.",
        "validation_ids": ["V2", "V8"]
      },
      {
        "id": "M4",
        "outcome": "RC04 has a stable independently reviewed completion-ready diff, complete exact-state validation and exact task-owned inventory before the one result commit and coordinator sequence.",
        "validation_ids": ["V1", "V9", "V10"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "RC03 predecessor, approval digest, scope and authorization",
        "criterion": "check/preflight/trace and RC03-to-RC04 chain-check pass with errors=[], warnings=[], outside_scope=[]; base equals pushed 58aac50d3bed8d831c24b0169872384f54ae47d0; fresh independent A0 reproduces the approval digest and returns ready_for_activation with no finding."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Application-repository module graph and application-family transaction owner",
        "criterion": "A static architecture test scans exactly the six application-repository implementation modules plus their facade and proves this exact acyclic graph: readers and digest depend only on lower-level model/value/database inputs; state composes model/readers/digest; lifecycle composes model/state/digest; transaction composes model/readers/digest/state; no internal module imports the facade. It proves model has no database dependency, all per-table SELECT/typed readback decoding resides in readers, state hashing resides in digest, and within the application-repository family exactly one ApplicationTransaction declaration, one runWriteTransaction reference and one application-state store binding exist, all in src/persistence/application-repository-transaction.ts. It does not prohibit or modify the separate out-of-scope backup binding and terminal writer barrier in src/persistence/backup.ts or the Domain transaction owners in src/persistence/repository.ts."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Exact facade types, source/package inventory and row decoder closure",
        "criterion": "Strict typecheck/build, exact source inventory, package smoke and persistence tests prove every prior facade export remains available with the same type meaning, all six new source modules and generated artifacts are inventoried, every table family decodes through the sole readers module, and malformed/extra/storage-class rows retain typed failures."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Schema, migration and canonical state identity stability",
        "criterion": "Baseline registry/SQL blobs remain unchanged; fresh initialization and reopen produce the exact schema-version-1 identity; canonical application state and lifecycle digest fixtures remain byte-identical; noncurrent or corrupt stores remain fail-closed without repair."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Application and authorization transaction behavior",
        "criterion": "Application, authorization, atomicity and concurrency suites preserve one request/decision/audit transaction, exact 19/23/29/30 capability progression, grant lineage, owner binding, Domain command selection and rollback/CAS semantics."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Execution, Manual and dispatcher persistence behavior",
        "criterion": "Claim, reliable-loop, Manual backend, dispatcher and product suites preserve all ordered attempts, leases, fences, intents, observations, receipts, finalizations, completion decisions, run ownership, sealed membership, outcomes and summaries."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Backup, restore, doctor and path-security behavior",
        "criterion": "Targeted persistence routes preserve current schema-2 backup/restore artifact bytes, lifecycle handoff verification, crash recovery, doctor precedence, connection/lifecycle identity and zero-mutation rejection of retired or malformed evidence."
      },
      {
        "id": "V8",
        "type": "manual",
        "target": "Writer-reader closure and documentation truth",
        "criterion": "Docs check passes; ownership review maps every current table family to one physical record/state/transaction module, preserves the public business owners and unimplemented boundaries, and makes no capability or platform-support expansion."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Focused and complete offline regression",
        "criterion": "Pinned Node 24.19.0 architecture, persistence, application, authorization, execution/Manual, dispatcher, product and CLI tests pass, followed by build, package smoke and pnpm verify:offline with zero failure, dependency drift, artifact survivor or support-claim expansion."
      },
      {
        "id": "V10",
        "type": "manual",
        "target": "Stable review, inventory and exact-head workflow",
        "criterion": "Fresh independent A1 and required A2 are complete; diff checks pass; only declared regular paths are staged; .task-artifacts has zero tracked overlap and successful baseline equality; final trace has errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false and no completion blocker before the single result commit."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Moving structural types can create a TypeScript runtime cycle or change declaration/value import emission."},
      {"id": "R2", "risk": "A reader or cross-record invariant can be omitted, duplicated or reordered during extraction."},
      {"id": "R3", "risk": "A second transaction owner or write path can emerge while separating the class from the state decoder."},
      {"id": "R4", "risk": "Mechanical SQL movement can alter whitespace, bind order, CAS predicates, errors or digest projections."},
      {"id": "R5", "risk": "The aggregate facade can become a compatibility implementation rather than a declarative boundary."},
      {"id": "R6", "risk": "Documentation can split business ownership or imply a new persistence capability."},
      {"id": "R7", "risk": "Full validation can retain ignored diagnostics or expose an adjacent regression after stable review."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Use exactly model, readers, digest, state, lifecycle and transaction implementation modules plus one re-export-only aggregate facade.",
        "rationale": "This follows the current contiguous responsibility boundaries, prevents digest/state/lifecycle cycles and retains a single persistence transaction owner."
      },
      {
        "id": "D2",
        "statement": "Keep current external source imports pointed at application-repository.ts and make that file declarative only.",
        "rationale": "The aggregate remains the intentional internal contract surface, while implementation ownership becomes explicit and acyclic."
      },
      {
        "id": "D3",
        "statement": "Keep every write method on the one ApplicationTransaction class and keep post-callback complete-state validation in the same runWriteTransaction callback.",
        "rationale": "Physical decomposition cannot weaken atomic commit, rollback or combined invariant checking."
      },
      {
        "id": "D4",
        "statement": "Move existing code mechanically before making import-only repairs; do not simplify predicates, SQL, hashes, errors or ordering.",
        "rationale": "RC04 is structural convergence, not semantic refactoring."
      },
      {
        "id": "D5",
        "statement": "Add a static architecture test, update exact source and packed inventories, and update the normative persistence writer-reader table while relying on existing behavioral suites for byte and protocol equivalence.",
        "rationale": "The new debt boundary and generated artifacts need executable guards without duplicating behavioral tests."
      },
      {
        "id": "D6",
        "statement": "Complete one independently reviewed result commit followed by coordinator prune, twelve exact-head gates, ready, FF-only integration and ordinary push; do not clean the worktree.",
        "rationale": "This is the user-authorized strict serial chain and repository Git-flow contract."
      }
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "If extraction creates a cycle, duplicate decoder or missing export, restore the exact baseline block in model/readers/digest/state/lifecycle order and repair imports; never add a second facade or fallback reader."},
      {"id": "M2", "recovery": "If any digest, SQL result, transaction, CAS, fence or error drifts, stop, preserve evidence and restore the exact baseline statement/projection/order before continuing; do not authorize a semantic change."},
      {"id": "M3", "recovery": "If tests/docs cannot identify one physical owner without splitting business authority, revise the module boundary within declared paths and obtain fresh review; do not broaden capability claims."},
      {"id": "M4", "recovery": "A failed gate leaves the reserved task editable. Repair in scope, create a new result commit only when required, rerun affected/full validation and fresh review, then replace stale receipts; never reset, rebase, stash or force."}
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
      {"id": "R1", "mitigation": "Use type-only imports where applicable and statically assert model/readers/digest/state/lifecycle/transaction direction plus zero internal facade imports.", "recovery": "Move the shared type or pure projection to the lower-level approved module and rerun strict build; never introduce a cycle-breaking global or duplicate type."},
      {"id": "R2", "mitigation": "Inventory every exported declaration, table reader, aggregate field and new source/packed artifact before extraction and assert exact membership after it.", "recovery": "Restore the missing baseline block or inventory member verbatim and rerun decoder/package checks."},
      {"id": "R3", "mitigation": "Within the six application-repository implementation modules and facade, assert exactly one ApplicationTransaction class, runWriteTransaction reference and application-state store binding, all in application-repository-transaction.ts; preserve backup.ts and repository.ts transaction owners unchanged outside this scan boundary.", "recovery": "Collapse any duplicate application-family writer back into ApplicationTransaction and rerun atomicity/concurrency tests without editing the separate backup or Domain transaction owners."},
      {"id": "R4", "mitigation": "Treat SQL and projections as move-only material and run schema, repository, digest, backup/restore and exact corruption regressions.", "recovery": "Restore exact baseline text/bind order and reject any intended semantic cleanup as out of scope."},
      {"id": "R5", "mitigation": "Restrict the facade to explicit exports and a static no-logic/no-SQL/no-class test.", "recovery": "Move all executable code to its designated owner and leave only declarations of exports."},
      {"id": "R6", "mitigation": "Update only current architecture/ownership wording and preserve all historical evidence and unimplemented boundaries.", "recovery": "Remove the overclaim or conflicting owner and rerun docs checks."},
      {"id": "R7", "mitigation": "Run focused validation before stable A1, then full pinned offline validation and invoke only coordinator pathless prune after the result commit.", "recovery": "Keep failed diagnostics while reserved, repair and rerun; prune only the frozen registered root at the exact result head."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "58aac50d3bed8d831c24b0169872384f54ae47d0",
      "current_material_base": "58aac50d3bed8d831c24b0169872384f54ae47d0",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 03:38:17+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 03:38:17+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 03:38:17+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 04:16:00+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "exec_plan.py check, preflight, trace and RC03-to-RC04 chain-check followed by fresh independent schema-v3 A0 attempt 3 and separate parent disposition",
        "evidence": "After two preserved superseded blocked attempts and their narrow contract revisions, check, preflight, trace and chain-check passed with errors=[] and warnings=[]; RC03 terminal commit and RC04 material base both equal 58aac50d3bed8d831c24b0169872384f54ae47d0. Fresh independent A0 attempt 3 invoked trace exactly once, observed outside_scope=[], overlap=[] and pre_existing_dirty=[] at base/HEAD 58aac50d3bed8d831c24b0169872384f54ae47d0 and state git-sha1:4ea6d27da314de96925702419b5ad18a74a182cd, and independently reproduced 17,586 canonical bytes plus SHA-256 E810486918E2EA525B8BEA2D51F26DF680C5590C2B1931A9C433156CF1CA18A5. It confirmed F-RC04-A0-001/002/003 closed, the exact 16-path scope and complete acyclic application-repository dependency graph, then returned findings=[] and readiness=ready_for_activation. Parent disposition independently accepts the report without further contract revision.",
        "state_id": "approval-sha256:E810486918E2EA525B8BEA2D51F26DF680C5590C2B1931A9C433156CF1CA18A5"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the dedicated persistence module architecture test and strict typecheck/build against the exact staged module family.",
        "evidence": "The four-case architecture suite proves the exact six-module acyclic graph, zero internal facade imports, a database-free model, all application-family SELECTs in readers, all hashing in digest, and exactly one application-family WeakMap, ApplicationTransaction declaration and runWriteTransaction call in transaction. The facade contains explicit re-exports only. Typecheck and the elevated same-toolchain build pass.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Compare runtime/type facade inventory, run strict compile and decoder regressions, and execute exact source plus packed-package inventory checks.",
        "evidence": "The facade exposes the exact 19 prior runtime values and every model type. Lint sees 207 repository files and 34 exact production sources. Persistence/architecture regressions pass, and fully offline package smoke passes pnpm 11.19.0, TypeScript 5.9.3, all 136 packed files, consumer types, exports, persistence, source/build/installed console parity and uninstall.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Byte-compare every prepared SQL statement and run current schema, state-digest, corruption, backup and restore regressions.",
        "evidence": "An independent TypeScript-AST extraction compares all 86 application repository prepare() SQL literals as a byte-exact multiset against RC03. The migration tree is untouched at schema version 1; focused persistence, backup/restore, package and product routes preserve canonical state and lifecycle digest version 4 and reject noncurrent/corrupt state without repair.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run application service, atomicity, authorization and persistence concurrency suites through the stable facade.",
        "evidence": "The first focused group passes 141/141, including bootstrap, renewal/upgrade, grants, Project/Task mutations, lifecycle authorization, rollback failpoints, competing writers, async-callback refusal and exact 19/23/29/30 vocabulary progression. Test artifacts return from zero to zero.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run execution claim, reliable-loop, Manual backend, dispatcher, product runtime and CLI recovery/security suites.",
        "evidence": "The second focused group passes 161/161 with no fail/cancel/skip/todo. Claims, attempts, leases, fences, staged intents, authorization bindings, observations, receipts, finalizations, completion decisions, dispatcher ownership/reconciliation/sealed membership/member outcomes/summaries, response-loss recovery and source CLI restart paths remain exact. Artifacts return from zero to zero.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run backup/restore, doctor, lifecycle, product and package parity suites with the untransactional backup validation path unchanged.",
        "evidence": "Focused backup/restore and doctor cases pass inside the 161-case group, including publication failpoints, exact current artifact/refusal boundaries, lifecycle handoff verification, interrupted restore recovery, read-only doctor precedence and zero-mutation rejection. Package smoke then passes the installed product and persistence route across 136 files.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Run lint, scaffold/domain/module architecture and documentation checks against the exact staged inventory.",
        "evidence": "Lint passes 207 files/34 production sources. Scaffold/domain/module architecture passes 14/14 and confirms unchanged package/API/status boundaries. Documentation check passes 105 Markdown files, 252 local links, 22 fragments and forbidden=0; the persistence contract names readers/state/digest/lifecycle/transaction physical owners while preserving the Manual semantic writer and separate backup/Domain transaction owners.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Run the complete pinned Node 24.19.0 and pnpm 11.19.0 verify:offline route at the exact staged material state.",
        "evidence": "The complete route exits 0: lint passes 207 files/34 production sources; strict typecheck and build pass; tests pass 418/418 with zero fail/cancel/skip/todo and task-artifact baseline 0-to-0/reclaimed; docs pass 105 Markdown files, 252 links, 22 fragments and forbidden=0; production dependencies remain zero; package smoke passes TypeScript 5.9.3 and 136 packed files with consumer/export/persistence/console/uninstall parity; SQLite 3.53.3 reports schemaVersion 1 with zero surviving generation members; Codex remains passed/blocked/not_run/supportClaim=false.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Bind the complete focused and pinned offline validation, fresh independent stable-diff A1 and completion-ready parent trace to one exact material state.",
        "evidence": "Fresh independent read-only A1 invoked exec_plan.py trace exactly once, independently reproduced 17,586 approval bytes and SHA-256 E810486918E2EA525B8BEA2D51F26DF680C5590C2B1931A9C433156CF1CA18A5, observed exactly 15 clean staged task-owned paths and material state git-sha1:211dfb137d9374229720db3e02517966dd28a568, and returned findings=[]. It independently confirmed exact 19-runtime/51-type facade parity, the six-module DAG and unique owner boundaries, all 86 SQL literals byte-for-byte as a multiset, 53 transaction methods with only two equivalent reader-helper extractions, unchanged backup/repository blobs, exact 34/136 inventories and coherent V2-V9 evidence. Parent disposition accepts the clean report; no A2 is required. The completed plan is then checked, preflighted and traced at the same state with the exact task-owned inventory.",
        "state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_final",
        "independence": "Fresh independent read-only schema-v3 A0 attempt 3. The reviewer did not draft or edit the current contract revision, enumerate its revised scope, implement RC04, run tests, edit repository content, mutate Git/index/coordinator/runtime/external state or grant authority. Attempts 1 and 2 were read only as preserved history and their conclusions were not inherited.",
        "scope": "Complete current RC04 proposal, preserved A0 attempts and contract-revision history; PLAN-SCHEMA, A0-AUDIT, IMPLEMENTATION-AUDIT and Tier-2 PERSISTENCE-AUDIT; repository guidance, architecture and RC03 terminal chain; adjacent persistence, ownership, authorization, reliability, validation, toolchain, security and Git-flow boundaries; current application-repository source, facade callers, backup and Domain transaction owners, exact inventories, all 16 paths, six-module graph and RC05 exclusions.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 02:45:28+08:00",
        "approval_sha256": "E810486918E2EA525B8BEA2D51F26DF680C5590C2B1931A9C433156CF1CA18A5",
        "evidence": "The exactly-once read-only trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], base/HEAD 58aac50d3bed8d831c24b0169872384f54ae47d0 and state git-sha1:4ea6d27da314de96925702419b5ad18a74a182cd. Independent canonicalization reproduced 17,586 bytes and the same digest. The reviewer confirmed exact six-module authorization and path; the application-repository-family transaction boundary with unchanged out-of-scope backup/Domain owners; the complete acyclic readers/digest/state/lifecycle/transaction graph and delegation; exact 16-path inventory/Tier-2 closure; and RC05/future-capability exclusions. No test or mutation-capable command ran and findings=[].",
        "parent_disposition": "complete",
        "findings": [],
        "reviewed_material_base": "58aac50d3bed8d831c24b0169872384f54ae47d0"
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_repeat",
        "independence": "Fresh independent read-only schema-v3 A1. The reviewer did not participate in RC04 proposal drafting, scope enumeration, A0, implementation, repair or validation; did not edit files, run tests, modify Git/index/ref/coordinator/runtime/external state or grant authority.",
        "scope": "Complete active RC04 plan and preserved A0 history; applicable schema-v3, implementation and Tier-2 persistence audit instructions; AGENTS.md, ARCHITECTURE.md, persistence and ownership contracts; the complete 15-path staged diff and adjacent application-repository, backup, repository, inventory, package and architecture-test sources.",
        "reviewed_at": "2026-09-01 04:15:00+08:00",
        "evidence": "The exactly-once read-only trace returned ok=true, errors=[], warnings=[], base/HEAD 58aac50d3bed8d831c24b0169872384f54ae47d0, reviewed state git-sha1:211dfb137d9374229720db3e02517966dd28a568, exactly 15 staged regular files and empty unstaged/untracked/outside_scope/overlap/pre_existing_dirty sets. Independent canonicalization reproduced 17,586 approval bytes and SHA-256 E810486918E2EA525B8BEA2D51F26DF680C5590C2B1931A9C433156CF1CA18A5. Static review confirmed facade parity at exactly 19 runtime exports and 51 unchanged type declarations, explicit re-export-only behavior, the exact acyclic six-module graph, 38 SELECT statements exclusively in readers, 48 INSERT/UPDATE statements exclusively in transaction, one WeakMap/ApplicationTransaction/runWriteTransaction owner and unchanged backup.ts/repository.ts blobs. All 86 prepare() SQL literals match RC03 byte-for-byte as a multiset; all 53 ApplicationTransaction methods remain structurally equivalent, including the two intended reader-helper extractions. Combined-state grant-relation decoding, digest-version-4 projection, lifecycle paths and post-callback terminal decode remain unchanged. Source/package inventories are exact at 34/136; schema 1, ato.api/v1, ato.execution/v1, 19/23/29/30 authorization vocabulary and all future-capability exclusions remain unchanged. V2-V9 evidence is coherent; cached diff check passed and .task-artifacts is absent.",
        "reviewed_state_id": "git-sha1:211dfb137d9374229720db3e02517966dd28a568",
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
        "finding_ids": ["F-RC04-A0-001", "F-RC04-A0-002"],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced 15,892 canonical approval bytes, SHA-256 931A48EFF9F4528C38C5B77A9703303297D819ED947CBAB4E772E7D62B5B2392 and material base 58aac50d3bed8d831c24b0169872384f54ae47d0, then found two MEDIUM approval-contract conflicts: authorization mistakenly named five rather than six approved implementation modules, and the transaction-owner/static-scan wording named a nonexistent file and was unqualified against the legitimate out-of-scope backup and Domain transaction owners. The parent confirmed both findings, preserved the full report at docs/plans/evidence/RC04/a0-attempt-1.md, revised only those normative boundaries and requires fresh independent A0 before activation."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-RC04-A0-003"],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 attempt 2 reproduced 16,959 canonical approval bytes, SHA-256 3AF44EE366BC0BB9C786D00F19C82429C9B947A194437A3ACE83B76371AA1F45 and material base 58aac50d3bed8d831c24b0169872384f54ae47d0, confirmed F-RC04-A0-001 and F-RC04-A0-002 closed, then found one MEDIUM dependency-contract gap: C6/V2 omitted the required transaction-to-readers and transaction-to-digest edges even though ApplicationTransaction retains readback queries and stateSha256. The parent confirmed the finding, preserved the full report at docs/plans/evidence/RC04/a0-attempt-2.md, revised only the exact acyclic graph and requires fresh independent A0 before activation."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 03:00:00+08:00",
        "evidence": "The first shared tsc.cmd invocation stopped before TypeScript because node was absent from ambient PATH. Direct execution through the frozen Node 24.19.0 and TypeScript 5.9.3 entry reached the compiler.",
        "state_id": null
      },
      {
        "validation_id": "V3",
        "attempt": 2,
        "classification": "deterministic_failure",
        "at": "2026-09-01 03:01:00+08:00",
        "evidence": "The first real typecheck exposed that mechanical extraction omitted five existing read-only maps/sets adjacent to the moved grant-relation query. The exact baseline initializers were restored and the raw-row length comparison was redirected to the equivalent decoded relation count; the immediate rerun passed.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 03:03:00+08:00",
        "evidence": "The first build passed compilation but the default sandbox denied creation of the task-worktree dist directory with EPERM. The identical frozen-toolchain build was rerun with task-worktree write authorization and passed.",
        "state_id": null
      },
      {
        "validation_id": "V2",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-01 03:12:00+08:00",
        "evidence": "The first architecture-test run passed three of four cases; the graph helper counted readers' value and type imports from model as two edges. Converting the helper to a mathematical edge set was a test-only repair, and the immediate rerun passed 4/4.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-01 02:22:36+08:00",
        "summary": "Closed F-RC04-A0-001 by authorizing exactly the six named application-repository implementation modules. Closed F-RC04-A0-002 by naming src/persistence/application-repository-transaction.ts exactly, limiting uniqueness/static validation to the application-repository module family and explicitly preserving backup.ts's separate binding and terminal lifecycle-authorization writer barrier plus repository.ts's Domain transaction owners unchanged and out of scope.",
        "previous_approval_sha256": "931A48EFF9F4528C38C5B77A9703303297D819ED947CBAB4E772E7D62B5B2392"
      },
      {
        "at": "2026-09-01 02:40:26+08:00",
        "summary": "Closed F-RC04-A0-003 by authorizing and validating the complete acyclic transaction-to-model/readers/digest/state dependency set, requiring ApplicationTransaction readback SELECT/decoders to reside in readers and state hashing to reside in digest while preserving transaction's exclusive application-family binding/write/CAS ownership.",
        "previous_approval_sha256": "3AF44EE366BC0BB9C786D00F19C82429C9B947A194437A3ACE83B76371AA1F45"
      }
    ],
    "final_summary": "RC04 decomposes the former 240241-byte application repository into exactly six cohesive implementation modules for model, readers, digest, combined state, lifecycle and transaction responsibilities, while reducing application-repository.ts to an explicit re-export-only facade. The facade retains exactly 19 runtime exports and 51 type declarations; all 86 prepared SQL literals, 53 ApplicationTransaction methods, schema-version-1 storage meaning, digest-version-4 projections, authorization/CAS/fence ordering, backup/restore/doctor behavior and public ato.api/v1 plus ato.execution/v1 results remain unchanged. The application-repository family has one WeakMap binding, one ApplicationTransaction and one runWriteTransaction owner in transaction; readers owns every SELECT and typed readback, digest owns hashing, state owns the combined proof, and lifecycle preserves transactional versus untransactional handoff paths. Exact material state git-sha1:211dfb137d9374229720db3e02517966dd28a568 passed focused groups 141/141, 14/14 and 161/161, pinned full 418/418, docs 105/252/22/0, package smoke across 136 files, SQLite/schema and Codex boundary checks, plus fresh independent A0/A1 closure with findings=[] and no A2 required. Scheduler, MCP, Codex/Git/workspace adapters, ProjectPolicy, CompletionBackend, daemon/service, release, deployment and platform-support claims remain unimplemented; RC05 remains separate. The one result commit is followed only by the authorized pathless current-head artifact prune, twelve exact-head gates, readiness, FF-only local integration and ordinary push, with no worktree cleanup."
  }
}
```

## Context

RC03 推送后，产品与持久化行为已稳定在 sole ato.api/v1、schema-version-1 和 explicit-Manual Phase 2 基线上。当前 application-repository.ts 同时容纳三类记录、完整组合解码、生命周期摘要与一个巨型事务类，职责边界虽在合同中存在，却没有物理模块边界。RC04 只收敛这一结构债。

## Plan of work

1. 冻结 facade 导出、源码/包清单、SQL readers、组合状态、digest、lifecycle 与事务方法库存。
2. 按连续职责机械迁移 model、readers、digest、state、lifecycle 与 transaction。
3. 把 application-repository.ts 收敛为显式 re-export，并添加无环、清单完整与唯一事务 owner 的静态测试。
4. 更新 writer-reader closure，完成聚焦/全量验证、独立 A1/必要 A2 和协调器终态流程。

## Acceptance summary

完成态具有六个内聚实现模块、一个零逻辑聚合 facade，以及 application-repository 模块族内唯一的 ApplicationTransaction 和 runWriteTransaction 边界；既有 backup 与 Domain transaction owners 保持原样。所有 schema、SQL、类型、摘要、事务、错误、恢复和产品可观察行为与 RC03 终态完全一致。
