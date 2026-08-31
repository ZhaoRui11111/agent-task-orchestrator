# ExecPlan：分解 Application 与 CLI 并启用 unused 强制

RC05 是 Phase 3 前兼容与结构债收敛序列的第五项，也是本序列终项。它只把当前 1,896 行 application owner 与 967 行 CLI API owner 拆成内聚、无环、可静态约束的实现模块，保留两个既有聚合入口，并关闭既定 unused 声明债；全部本地 explicit-Manual Phase 2 行为、sole `ato.api/v1`、`ato.execution/v1`、schema-version-1 与公开输出保持不变。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 04:32:00+08:00",
    "updated_at": "2026-09-01 06:57:54+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive requiring strict serial implementation of RC01 through RC05",
        "at": "2026-09-01 04:32:00+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive requiring one result commit, FF-only integration and ordinary push for every RC plan",
        "at": "2026-09-01 04:32:00+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Decompose src/application.ts into exactly application-model, application-input, application-policy, application-domain and application-service implementation modules behind one explicit re-export-only application.ts facade; decompose src/cli-api.ts into exactly cli-api-model, cli-api-parser, cli-api-presentation and cli-api-runtime implementation modules behind one explicit re-export-only cli-api.ts facade; preserve src/cli.ts and src/index.ts behavior and bytes; close the twelve-item RC03 unused-declaration inventory plus the RC04 extraction-only import debt; enable noUnusedLocals and noUnusedParameters; and preserve every current application, authorization, product, persistence and sole ato.api/v1 observable result.",
    "non_goals": [
      "Do not change the 33-command ato.api/v1 grammar, 37-error table, output key order, messages, exit codes, confirmation phrases, redaction, default/explicit version equivalence or unsupported-major refusal ordering.",
      "Do not change Application commands/results, trusted ingress, Domain command selection, authorization vocabulary or 19/23/29/30 checkpoints, transaction ordering, ProjectRegistry identity, persistence schema/SQL/digests, backup/restore/doctor, execution, Manual or dispatcher semantics.",
      "Do not introduce a compatibility shim, second implementation, dynamic registry, public export, product API major, dependency, migration, persistent field or release/platform-support claim.",
      "Do not add scheduler, scheduled trigger, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend/gates, daemon/service, release, deployment, telemetry or external Project/workspace effect.",
      "Do not delete or rewrite completed plans, audit evidence, Git history, .local content, runtime/backup data, ignored dependency/build stores, existing worktrees or task branches."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "RC04 terminal result commit ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6 is pushed; local master, origin/master and task/rc04-persistence-decomposition matched it before RC05 start, and the RC04 coordinator has status pushed with no reservation or pending operation.",
        "source": "current user directive; completed RC04 plan; fresh Git and coordinator trace"
      },
      {
        "id": "C2",
        "statement": "The application target modules are exactly application-model.ts for the existing public records, command/result/service types and shared internal structural types; application-input.ts for exact envelope/text parsing, trusted ingress identity/confirmation and ProjectRegistry identity checks; application-policy.ts for capability lineage, target binding, authorization evaluation and request/decision/audit construction; application-domain.ts for Domain mutation selection and terminal projection; and application-service.ts for the sole PersistenceStore plus withApplicationTransaction orchestration and the three service factories. application.ts becomes explicit re-exports only.",
        "source": "current 1,896-line declaration and dependency inventory; ARCHITECTURE.md"
      },
      {
        "id": "C3",
        "statement": "The exact required and allowed internal Application adjacency is: application-model imports no Application module; application-input imports only application-model; application-policy imports exactly application-model and application-input; application-domain imports exactly application-model and application-policy; application-service imports exactly application-model, application-input, application-policy and application-domain. Every other directed edge among the five implementation modules is forbidden, the graph must be acyclic, and no implementation module imports application.ts. External owner imports remain responsibility-scoped. Only application-service.ts imports PersistenceStore or withApplicationTransaction or defines createApplicationServiceInternal.",
        "source": "RC05 static architecture target and current application ownership"
      },
      {
        "id": "C4",
        "statement": "The CLI target modules are exactly cli-api-model.ts for CLI_API_VERSION, PUBLIC_ERROR_TABLE, command/parse/run records and the exact frozen 33-command registry; cli-api-parser.ts for bounded grammar, option validation, Application command translation and confirmation projection; cli-api-presentation.ts for public JSON/human encoding, projections and Application/product/persistence/doctor error mapping; and cli-api-runtime.ts for trusted runtime selection, ingress setup, service/facade invocation, lifecycle handoff and store closure. cli-api.ts becomes explicit re-exports only and cli.ts remains the unchanged twelve-line source entrypoint.",
        "source": "CLI contract; current 967-line declaration and dependency inventory"
      },
      {
        "id": "C5",
        "statement": "The exact required and allowed internal CLI adjacency is: cli-api-model imports no CLI API module; cli-api-parser imports only cli-api-model; cli-api-presentation imports only cli-api-model; cli-api-runtime imports exactly cli-api-model, cli-api-parser and cli-api-presentation. Every other directed edge among the four implementation modules is forbidden, parser and presentation cannot import one another, the graph must be acyclic, and no implementation module imports cli-api.ts. External owner imports remain responsibility-scoped. Only cli-api-runtime selects or opens a runtime, creates services/backends, invokes lifecycle effects, closes the store or defines runCli; parser completes unsupported-version and invalid-input refusal before runtime selection.",
        "source": "ARCHITECTURE.md; CLI/API and security contracts"
      },
      {
        "id": "C6",
        "statement": "The application facade preserves exactly four runtime exports and sixteen exported types/interfaces; the CLI facade preserves exactly five runtime exports and four exported types/interfaces. Existing callers continue importing the facades. src/index.ts and src/cli.ts remain byte-identical, and package-root plus source/build/installed console surfaces remain exact.",
        "source": "current TypeScript AST/export inventory; package and CLI contracts"
      },
      {
        "id": "C7",
        "statement": "The frozen RC03 noUnused baseline contains exactly twelve diagnostics: AuthorizationGrant; DispatcherReconciliationItemRecord; DispatcherApplicationService; DispatcherRunRecord; turn; TaskExecutionSequence; AuthorizationAction; ExecutionPortResult; readDomainInitialized; sqliteInteger; compareStrings; and ExecutionLoopInspectCommand. RC04 already removed only the unused readDomainInitialized import while decomposing the persistence repository. RC05 must preserve that historical fact, remove the remaining eleven items mechanically, and neither restore nor pretend to remove the already absent item.",
        "source": "pinned TypeScript 5.9.3 noEmit comparison at RC03 commit 58aac50d3bed8d831c24b0169872384f54ae47d0 and RC05 base"
      },
      {
        "id": "C8",
        "statement": "At RC05 base, TypeScript 5.9.3 with noUnusedLocals and noUnusedParameters reports exactly 75 diagnostics: eleven surviving RC03 items plus 64 extraction-only unused imports in application-repository-readers/state/transaction. RC05 removes all 75 root causes, sets both compiler options true, and permits no dummy read, void expression, underscore rename, suppression directive, broad export or disabled check as a substitute.",
        "source": "fresh pinned noEmit diagnostic inventory on ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6"
      },
      {
        "id": "C9",
        "statement": "The production source inventory becomes exactly 43 files and the packed inventory becomes exactly 172 files: nine new implementation sources add 36 generated artifacts while the two stable facade names remain. Node built-in imports equal this exact per-file mapping: byte-identical src/cli.ts may import only node:path and node:url; src/cli-api-parser.ts may import only node:path; src/cli-api-runtime.ts may import only node:crypto; src/cli-api-model.ts, src/cli-api-presentation.ts and facade src/cli-api.ts import none. No other production-source mapping changes and no wildcard or shared CLI-family exception is permitted.",
        "source": "scripts/repo-utils.mjs and scripts/package-smoke.mjs exact inventory owners"
      },
      {
        "id": "C10",
        "statement": "Fresh independent A0 precedes activation; fresh independent read-only A1 follows one stable complete diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. Scope-enumeration or implementation participants cannot review their own work and parent disposition is separate.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C11",
        "statement": "Use only task/rc05-application-cli-decomposition and D:/agent-task-orchestrator/.worktrees/rc05-application-cli-decomposition. After one result commit, invoke pathless current-head artifact prune, all thirteen frozen exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, PR, release, deployment, reset, rebase, stash and force are prohibited.",
        "source": "current user directive; AGENTS.md; local-agent-git-flow contract"
      },
      {
        "id": "C12",
        "statement": "Current capability remains the closed local explicit-Manual Phase 2 product under sole ato.api/v1 and independently frozen ato.execution/v1. Structural decomposition and unused enforcement are development hygiene, not a runtime capability, compatibility window or support claim.",
        "source": "AGENTS.md; ARCHITECTURE.md; current reference contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Create and update this RC05 schema-v3 plan/evidence; edit only declared paths; mechanically move current application and CLI API declarations into exactly the approved nine modules; reduce both existing aggregate files to explicit re-exports; remove the frozen unused roots and extraction-only import noise; enable and freeze the two compiler checks; add static architecture validation and update exact current documentation/inventories.",
        "Run local impact-selected and complete offline validation, create only validation-owned disposable .task-artifacts, make one task-owned result commit, invoke the standing-authorized pathless prune, record thirteen exact-head gates, mark ready, FF-only integrate and use the standing-authorized ordinary non-force origin/master push.",
        "Use fresh independent read-only reviewers for A0, A1 and any required A2; reviewers may inspect code and evidence but may not edit or grant authority."
      ],
      "requires_reapproval": [
        "Any public command, output, error, type/export meaning, authorization, Domain, transaction, SQL/schema/digest, persistence lifecycle, execution/dispatcher or product behavior change.",
        "Any module beyond the exact five application and four CLI implementation modules, any cycle, duplicate runtime/service owner, compatibility branch, new dependency or change outside declared task paths.",
        "Any external path, network/secret access, PR, merge other than coordinator FF-only integration, release, deployment, destructive operational cleanup or user-data mutation."
      ],
      "prohibited": [
        "Adopt, delete, clean up or impersonate the Codex application worktree or any pre-existing branch, worktree or coordinator task.",
        "Delete completed plans, evidence, Git history, .local, runtime/backup data, node_modules, pnpm store, dist, ignored content or any existing worktree/task branch.",
        "Implement scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or unsupported integration/platform claims."
      ],
      "persistence": {
        "required": true,
        "action": "one task-owned terminal result commit containing the completed RC05 plan, followed by coordinator pathless artifact prune, thirteen exact-head gates, ready, FF-only local integration and the standing-authorized ordinary origin/master push",
        "source": "current user directive plus AGENTS.md/local-agent-git-flow narrow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC05-application-cli-decomposition.md", "kind": "file"},
        {"path": "docs/plans/active/RC05-application-cli-decomposition.md", "kind": "file"},
        {"path": "docs/plans/completed/RC05-application-cli-decomposition.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC05", "kind": "directory"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "scripts/lint.mjs", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "scripts/repo-utils.mjs", "kind": "file"},
        {"path": "src/application-domain.ts", "kind": "file"},
        {"path": "src/application-input.ts", "kind": "file"},
        {"path": "src/application-model.ts", "kind": "file"},
        {"path": "src/application-policy.ts", "kind": "file"},
        {"path": "src/application-service.ts", "kind": "file"},
        {"path": "src/application.ts", "kind": "file"},
        {"path": "src/cli-api-model.ts", "kind": "file"},
        {"path": "src/cli-api-parser.ts", "kind": "file"},
        {"path": "src/cli-api-presentation.ts", "kind": "file"},
        {"path": "src/cli-api-runtime.ts", "kind": "file"},
        {"path": "src/cli-api.ts", "kind": "file"},
        {"path": "src/dispatcher-application.ts", "kind": "file"},
        {"path": "src/dispatcher.ts", "kind": "file"},
        {"path": "src/execution-application.ts", "kind": "file"},
        {"path": "src/execution-loop.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-readers.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-state.ts", "kind": "file"},
        {"path": "src/persistence/application-repository-transaction.ts", "kind": "file"},
        {"path": "src/persistence/backup.ts", "kind": "file"},
        {"path": "src/persistence/migrations.ts", "kind": "file"},
        {"path": "src/product-runtime.ts", "kind": "file"},
        {"path": "test/application-cli-module-architecture.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "tsconfig.json", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {"id": "M1", "outcome": "Freeze exact public facade exports, top-level declaration ownership, current 33/37 CLI tables, src/index.ts and src/cli.ts blobs, twelve-item historical unused ledger, 75 current diagnostics, source/package inventories and the two target DAGs.", "validation_ids": ["V1", "V2", "V3", "V4"]},
      {"id": "M2", "outcome": "Application model/input/policy/domain/service modules form the approved acyclic graph; application.ts is explicit re-exports only; one service/transaction orchestration owner preserves every result, authorization decision, Domain mutation and terminal readback.", "validation_ids": ["V2", "V5"]},
      {"id": "M3", "outcome": "CLI model/parser/presentation/runtime modules form the approved acyclic graph; cli-api.ts is explicit re-exports only; parse refusal remains pre-runtime and all source/build/installed outputs remain exact.", "validation_ids": ["V3", "V6"]},
      {"id": "M4", "outcome": "The unused ledger and all extraction-only imports are closed without suppression, both compiler options are true, exact 43/172 inventories and built-in boundaries pass, and current docs describe physical modules without changing business ownership.", "validation_ids": ["V4", "V7", "V8", "V9"]},
      {"id": "M5", "outcome": "One stable complete material state passes focused and full offline validation, fresh independent A1 and any required A2, exact scope/inventory checks and completion-ready trace before the one result commit.", "validation_ids": ["V10", "V11"]}
    ],
    "validations": [
      {"id": "V1", "type": "manual", "target": "RC04 predecessor, approval digest, scope and authorization", "criterion": "check/preflight/trace and RC04-to-RC05 chain-check pass with errors=[], warnings=[], outside_scope=[]; base equals pushed ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6; fresh independent A0 reproduces the approval digest and returns ready_for_activation with no finding."},
      {"id": "V2", "type": "automated", "target": "Application module DAG, facade and sole orchestration owner", "criterion": "A static architecture test scans exactly five implementation modules plus facade and compares the complete internal adjacency set for equality with C3: input-to-model; policy-to-model/input; domain-to-model/policy; service-to-model/input/policy/domain; no other edge. It rejects any cycle and internal facade import, proves an explicit re-export-only facade with four runtime and sixteen type exports, and proves exactly one PersistenceStore/withApplicationTransaction/createApplicationServiceInternal owner in application-service.ts; focused application/atomicity tests pass."},
      {"id": "V3", "type": "automated", "target": "CLI module DAG, exact grammar/public surface and unchanged entrypoints", "criterion": "Static and contract tests scan exactly four implementation modules plus facade and compare the complete internal adjacency set for equality with C5: parser-to-model; presentation-to-model; runtime-to-model/parser/presentation; no other edge. They reject any cycle, parser/presentation cross-import and internal facade import; prove an explicit facade with five runtime and four type exports, exact 33 commands/37 errors, parser refusal before the sole runtime/runCli owner, and byte-identical src/cli.ts plus src/index.ts."},
      {"id": "V4", "type": "automated", "target": "Unused declaration ledger and compiler enforcement", "criterion": "Pinned TypeScript evidence reproduces RC03's exact twelve-name baseline and RC05 base's exact 75 diagnostics; current sources contain none of the eleven surviving roots or 64 extraction-only imports; readDomainInitialized remains truthfully already absent from the old application repository import; tsconfig sets noUnusedLocals=true and noUnusedParameters=true; strict noEmit exits zero without suppression/dummy-use patterns."},
      {"id": "V5", "type": "automated", "target": "Application, authorization, Domain and transaction equivalence", "criterion": "Application service, atomicity, authorization, ProjectRegistry, persistence and concurrency suites preserve exact command parsing, cancellation bounds, capability 19/23/29/30 progression, grant lineage, one request/decision/audit transaction, Domain command/result selection, root revalidation, rollback and CAS behavior."},
      {"id": "V6", "type": "automated", "target": "Sole ato.api/v1 product and console equivalence", "criterion": "CLI contract/security/E2E/Phase2 suites preserve all grammar, confirmation, error, redaction, doctor, lifecycle and product routes; source, build and installed console outputs remain identical for omitted/explicit v1, invalid input and retired-major refusal."},
      {"id": "V7", "type": "automated", "target": "Adjacent persistence, execution, Manual and dispatcher regression", "criterion": "Current schema-version-1 persistence, backup/restore/doctor, claim, reliable-loop, Manual backend, dispatcher and product suites pass with unchanged SQL/digests/records/fences/recovery; the import-only cleanup changes no executable owner or stored byte."},
      {"id": "V8", "type": "automated", "target": "Exact source, built-in and packed inventories", "criterion": "Lint and architecture tests report exactly 43 production sources and compare the CLI entrypoint/API Node built-in mapping for equality with C9: src/cli.ts exactly node:path/node:url; cli-api-parser exactly node:path; cli-api-runtime exactly node:crypto; cli-api-model, cli-api-presentation and cli-api facade none. scripts/repo-utils.mjs contains no wildcard or shared CLI-family exception. Package smoke reports exactly 172 files and includes four generated artifacts for each of nine new modules with no missing or extra export."},
      {"id": "V9", "type": "manual", "target": "Architecture, CLI and toolchain documentation truth", "criterion": "Docs check passes; current documents name the two physical module families, two stable facades, compiler enforcement and exact source list without splitting business ownership, claiming a new capability, changing compatibility or editing historical evidence."},
      {"id": "V10", "type": "automated", "target": "Focused and complete offline regression", "criterion": "Pinned Node 24.19.0 and pnpm 11.19.0 architecture/application/CLI/authorization/persistence/execution/dispatcher tests pass, followed by package smoke and pnpm verify:offline with zero failure, unused diagnostic, dependency drift, artifact survivor or support-claim expansion."},
      {"id": "V11", "type": "manual", "target": "Stable review, inventory and exact-head workflow", "criterion": "Fresh independent A1 and required A2 are complete; diff checks pass; only declared regular paths are staged; .task-artifacts has zero tracked overlap and successful baseline equality; final trace has errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false and no completion blocker before the single result commit."}
    ],
    "risks": [
      {"id": "R1", "risk": "Splitting shared Application structural types can create runtime cycles or leak new public exports."},
      {"id": "R2", "risk": "Moving the 805-line service body can reorder preflight, confirmation, authorization, transaction stages or terminal readback."},
      {"id": "R3", "risk": "Moving CLI grammar/presentation/runtime code can shift invalid-version refusal after runtime selection or alter output bytes."},
      {"id": "R4", "risk": "Unused cleanup can accidentally remove a required type/runtime import or hide diagnostics through suppression instead of closure."},
      {"id": "R5", "risk": "Current noUnused enforcement can expose a generated declaration or test-consumer problem after module extraction."},
      {"id": "R6", "risk": "Source/built-in/packed inventories can omit one of 36 generated artifacts or grant a broad Node built-in exception."},
      {"id": "R7", "risk": "Facade or documentation wording can become a compatibility layer or duplicate application/CLI business ownership."},
      {"id": "R8", "risk": "Full validation can retain ignored diagnostics or expose an adjacent regression after stable review."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Use exactly five Application implementation modules and four CLI implementation modules behind the two existing explicit re-export facades.", "rationale": "This follows current contiguous responsibilities while retaining all caller paths and one owner per effect boundary."},
      {"id": "D2", "statement": "Move existing code mechanically before import-only repairs; keep src/index.ts and src/cli.ts byte-identical.", "rationale": "RC05 is structural and compiler-hygiene convergence, not public or behavioral refactoring."},
      {"id": "D3", "statement": "Keep service transaction sequencing only in application-service.ts and runtime/effect sequencing only in cli-api-runtime.ts; parser and presentation stay effect-free.", "rationale": "This preserves the application/CLI authority boundary and pre-effect rejection ordering."},
      {"id": "D4", "statement": "Close the historical twelve-item ledger truthfully as one already-absent item plus eleven current removals, then remove the 64 RC04 extraction-only imports and require native compiler success.", "rationale": "Historical evidence must not be rewritten, and noUnused enforcement must reflect real dependency closure rather than suppression."},
      {"id": "D5", "statement": "Add one static module-architecture test, update the existing current-major architecture assertion, exact source/package inventories, compiler policy and current architecture/CLI/toolchain docs.", "rationale": "The new physical boundaries and enforcement need durable repository-native guards."},
      {"id": "D6", "statement": "Complete one independently reviewed result commit followed by coordinator prune, thirteen exact-head gates, ready, FF-only integration and ordinary push; do not clean the worktree.", "rationale": "This is the user-authorized strict serial chain and repository Git-flow contract."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "If the frozen declaration/diagnostic inventory is wrong, stop before activation, revise only the exact evidence/scope and obtain fresh independent A0."},
      {"id": "M2", "recovery": "If Application extraction creates a cycle, duplicate owner or behavior drift, restore the exact baseline block to its approved lower module and repair imports; never add a second service or fallback facade."},
      {"id": "M3", "recovery": "If CLI extraction alters parse/effect/output order, restore the exact baseline statement order in parser/presentation/runtime and rerun byte-level console parity; never add a compatibility route."},
      {"id": "M4", "recovery": "If noUnused fails, remove only proven unused roots/imports or repair the approved dependency edge; do not add dummy reads, suppressions or broad exports."},
      {"id": "M5", "recovery": "A failed gate leaves the reserved task editable. Repair in scope, create a new result commit only when required, rerun affected/full validation and fresh review, then replace stale receipts; never reset, rebase, stash or force."}
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
      {"id": "R1", "mitigation": "Use type-only imports and statically assert exact DAGs, zero internal facade imports and exact facade export sets.", "recovery": "Move shared structure down to model or the one designated owner; never introduce a cycle-breaking global or duplicate public declaration."},
      {"id": "R2", "mitigation": "Inventory and mechanically compare service branches, transaction stage labels and readbacks before/after extraction, then run atomicity/concurrency suites.", "recovery": "Restore exact baseline ordering and reject any intended semantic cleanup as out of scope."},
      {"id": "R3", "mitigation": "Keep registry/parse, presentation and runtime contiguous blocks, assert one runtime owner and run source/build/installed output parity including negative pre-effect cases.", "recovery": "Restore the baseline parse/effect/output block and rerun CLI security/E2E from the beginning."},
      {"id": "R4", "mitigation": "Freeze exact RC03/current diagnostic lists and statically reject ts-ignore/expect-error or dummy-use workarounds in changed production paths.", "recovery": "Restore any required import; remove only compiler-proven unused roots and rerun strict noEmit."},
      {"id": "R5", "mitigation": "Set both compiler options in the sole tsconfig and assert them in lint before strict typecheck/build/package consumption.", "recovery": "Repair the real declaration/import edge; never disable or locally override the compiler options."},
      {"id": "R6", "mitigation": "Update exact sorted source and packed inventories and narrow built-in checks to named CLI implementation files.", "recovery": "Add the missing exact member or remove the extra grant; do not use wildcard inventory/built-in exceptions."},
      {"id": "R7", "mitigation": "Keep facade tests declarative and update only current physical-module wording while retaining the sole semantic owners and unimplemented boundaries.", "recovery": "Move logic back to the approved implementation owner or remove the overclaim, then rerun docs/architecture checks."},
      {"id": "R8", "mitigation": "Run focused validation before stable A1, then full pinned offline validation and invoke only coordinator pathless prune after the result commit.", "recovery": "Keep failed diagnostics while reserved, repair and rerun; prune only the frozen registered root at the exact result head."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6",
      "current_material_base": "ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 05:43:00+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 06:32:08+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 06:32:08+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 06:32:08+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-01 06:56:04+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "exec_plan.py check, preflight and trace plus RC04-to-RC05 chain evidence followed by fresh independent schema-v3 A0 attempt 3 and separate parent disposition",
        "evidence": "After two preserved superseded findings and narrow contract revisions, check, preflight and trace passed with errors=[], warnings=[] and outside_scope=[]; RC04 terminal, RC05 base and all local refs equal ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6. Fresh independent A0 attempt 3 invoked trace exactly once, observed clean scope at state git-sha1:893e34841685041af61b2443f87732997ff405a6, and independently reproduced 21,505 canonical bytes plus SHA-256 23053C89F365549D79C23E9D1FB49A02B0C15231A678000DF64CD4AD4D85BCC2. It confirmed F-RC05-A0-001/002 closed, all 35 task paths, exact Application/CLI DAGs and Node built-in mapping, facade 4+16/5+4, 33/37 public tables, 12 historical and 75 current unused inventories, exact 34/136 current and 43/172 target inventories, and every authorization/non-goal boundary; findings=[] and readiness=ready_for_activation. Parent disposition independently accepts the report without further contract revision.",
        "state_id": "approval-sha256:23053C89F365549D79C23E9D1FB49A02B0C15231A678000DF64CD4AD4D85BCC2"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Run the dedicated static Application/CLI module architecture suite, strict compile and focused Application/atomicity regression against the complete material tree.",
        "evidence": "The architecture suite proves exact Application set equality: input-to-model, policy-to-model/input, domain-to-model/policy and service-to-model/input/policy/domain, with no other edge, cycle or facade import. application.ts contains explicit re-exports only with exact 4 runtime/16 type exports; PersistenceStore, withApplicationTransaction and createApplicationServiceInternal occur only in service. Strict TypeScript passes, the focused Application/Domain/authorization/transaction group passes 157/157 and full regression passes 421/421.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Run static CLI architecture, CLI contract/security/E2E tests, source/build/installed console parity and byte-identity checks for the stable entrypoints.",
        "evidence": "The architecture suite proves exact CLI set equality: parser-to-model, presentation-to-model and runtime-to-model/parser/presentation, with no other edge, cycle, parser/presentation cross-import or facade import. cli-api.ts is explicit re-exports only with exact 5 runtime/4 type exports, 33 commands and 37 errors; parsing precedes trusted runtime selection/open and runtime alone owns effects/close. src/cli.ts and src/index.ts have no diff. The focused CLI/product group passes 35/35 and package smoke proves source/build/installed parity.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Compare the frozen RC03/current unused inventories, inspect the changed roots/imports and run pinned TypeScript 5.9.3 strict noEmit with native unused enforcement.",
        "evidence": "Independent A0 reproduced RC03's exact twelve diagnostics and RC05 base's exact 75 as eleven historical survivors plus 64 RC04 extraction-only imports. RC05 removes all eleven current roots and all 64 imports while readDomainInitialized remains truthfully absent since RC04. tsconfig and lint require noUnusedLocals=true and noUnusedParameters=true; pinned strict noEmit exits 0 without dummy read, void, underscore, suppression or broad-export workaround.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Run focused Domain, ProjectRegistry, authorization, Application service, atomicity, repository and concurrency suites through the stable facade.",
        "evidence": "The focused group passes 157/157 with zero fail/cancel/skip/todo. It preserves exact command parsing and cancellation bounds, contiguous 19/23/29/30 capability progression, grant provenance, high-risk confirmation and Project-root revalidation order, one request/decision/audit transaction, Domain selection/result projection, rollback, CAS and competing-writer behavior. Artifact baseline returns 0-to-0.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run focused CLI contract, security, Phase 1/2 E2E and product runtime suites, then packed console parity.",
        "evidence": "The focused group passes 35/35 and preserves the exact 33-command/37-error sole ato.api/v1 grammar, confirmations, redaction, public mapping, doctor/lifecycle/product routes and pre-runtime unsupported-major refusal. Package smoke passes 172 files and reports source-built-installed console parity, consumer types, exports, persistence and uninstall all passed.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run focused current persistence, backup/restore/doctor, claim, reliable-loop, execution-port, Manual backend and dispatcher regression.",
        "evidence": "The focused group passes 173/173 with zero fail/cancel/skip/todo. Current schema-version-1 bytes, migration identity, SQL/digests, backup/restore/doctor precedence, claims, leases, fences, intents, observations, receipts, finalizations, Manual journal, dispatcher reconciliation/sealed membership/member outcomes/summary completeness and recovery remain exact. Import-only cleanup changes no executable owner or stored record. Artifact baseline returns 0-to-0.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Run lint, the exact architecture/built-in checks and fully offline package smoke against the built tree.",
        "evidence": "Lint passes 220 repository files and exactly 43 production sources. Static tests require src/cli.ts=node:path/node:url, parser=node:path, runtime=node:crypto and model/presentation/facade=none, reject wildcard/shared-family allowance, and pass 10/10 with Domain architecture. Package smoke reports exactly 172 entries, four artifacts for each of nine new modules, TypeScript 5.9.3 frozen install and complete consumer/export/persistence/console/uninstall parity.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Run documentation validation and manually compare current architecture, CLI, toolchain and changelog wording against implemented ownership and non-goals.",
        "evidence": "Docs check passes 108 Markdown files, 252 repository-local links, 22 fragments and forbidden=0. Current docs name both physical module families, stable facades, exact 43-file list and compiler enforcement while retaining one Application and one CLI business owner, sole ato.api/v1 and ato.execution/v1, schema-version-1 and every unimplemented scheduler/MCP/adapter/policy/completion/service/release/deployment boundary.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Run three focused groups followed by the complete pnpm verify:offline route under absolute Node 24.19.0 and pnpm 11.19.0.",
        "evidence": "Focused validation passes 157+35+173=365 tests. The exact frozen full route then passes lint 220/43, strict typecheck, build, 421/421 tests with zero fail/cancel/skip/todo and artifact baseline 0-to-0, docs 108/252/22/0, dependency shape with zero production dependencies and TypeScript 5.9.3, package smoke 172 files, and SQLite 3.53.3 schemaVersion 1 with zero surviving generation members. Codex remains passed/blocked/not_run/supportClaim=false. .task-artifacts is absent; dist, node_modules and the local pnpm store are retained.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Obtain fresh independent schema-v3 A1, record the parent disposition, verify the complete regular-file inventory and run cached diff plus completion trace against the unchanged stable material state.",
        "evidence": "Fresh independent read-only A1 reviewed the complete 34-path staged diff and returned findings=[] at git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334; the parent accepts it and no A2 is required. The reviewer independently reproduced 21,505 approval bytes, SHA-256 23053C89F365549D79C23E9D1FB49A02B0C15231A678000DF64CD4AD4D85BCC2, 33 material paths and the same material state, and confirmed all Application/CLI DAG, facade, owner, 33/37, unused, 43/172, documentation and non-goal boundaries. git diff --cached --check passes; every staged path is declared, regular and non-reparse; .task-artifacts is absent; unstaged, untracked, outside_scope, overlap and pre_existing_dirty are empty. Final trace after recording M5, V11 and this audit returns errors=[], warnings=[], state_bound=true, closure_required=false and completion_ready=true.",
        "state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc05_a0_final",
        "independence": "Fresh independent read-only schema-v3 A0 attempt 3. The reviewer did not draft or revise the proposal, enumerate its scope, participate in either prior repair, implement RC05, delegate review, run tests, edit repository content, mutate Git/index/ref/coordinator/runtime/external state or grant authority. Attempts 1 and 2 were read only as preserved history and their conclusions were not inherited.",
        "scope": "Complete current RC05 proposal and preserved A0 history; harness-exec-plan schema/A0/implementation instructions; repository guidance and applicable governance, architecture, Git-flow, CLI, Domain, authorization, persistence, reliability, toolchain, validation, versioning and security contracts; RC04 terminal/coordinator chain; all 35 paths, Application/CLI sources and callers, unused ledger, facade/command/error tables, inventories, scripts, tests, documentation and future-capability exclusions.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 05:43:00+08:00",
        "approval_sha256": "23053C89F365549D79C23E9D1FB49A02B0C15231A678000DF64CD4AD4D85BCC2",
        "evidence": "The exactly-once read-only trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true, base/HEAD ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6 and state git-sha1:893e34841685041af61b2443f87732997ff405a6. Independent canonicalization reproduced 21,505 bytes and the same digest. Git and coordinator evidence confirmed the pushed RC04 terminal, aligned refs, exact RC05 task worktree with 13 pending gates and no reservation/pending operation. The reviewer independently confirmed all 35 task paths; complete exact Application and CLI adjacency with sole service/runtime owners; the exact per-file Node built-in mapping compatible with byte-identical src/cli.ts/src/index.ts; facade exports 4+16 and 5+4; 33 commands and 37 errors; RC03's exact 12 unused diagnostics, current 75 as eleven survivors plus 64 RC04 extraction imports and truthful prior removal of readDomainInitialized; current 34/136 and target 43/172 inventories; compiler/script/test/document ownership; V1-V11, M1-M5 and R1-R8; unchanged schema-version-1, ato.api/v1, ato.execution/v1, authorization/persistence/execution semantics and all unimplemented boundaries. No test or mutation-capable command ran and findings=[].",
        "parent_disposition": "complete",
        "findings": [],
        "reviewed_material_base": "ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6"
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc05_a1_review",
        "independence": "Fresh independent read-only schema-v3 A1. The reviewer did not participate in RC05 A0, planning, scope enumeration, implementation, repair, validation, Git-flow or authorization; did not edit files, run tests, or modify Git/index/ref/coordinator/runtime/external state.",
        "scope": "Complete RC05 stable staged diff across all 34 paths; current plan and preserved A0 evidence; AGENTS.md, ARCHITECTURE.md and applicable governance, CLI, toolchain, Domain, authorization, persistence, reliability, validation, compatibility, security and Git-flow contracts; all Application/CLI implementation modules and facades; unused-declaration cleanup; scripts, inventories, tests and documentation.",
        "reviewed_at": "2026-09-01 06:55:01+08:00",
        "evidence": "The exactly-once exec_plan.py trace returned ok=true, errors=[], warnings=[], outside_scope=[], overlap=[], pre_existing_dirty=[], state_bound=true and closure_required=false. Independent canonicalization reproduced 21,505 approval bytes and SHA-256 23053C89F365549D79C23E9D1FB49A02B0C15231A678000DF64CD4AD4D85BCC2; independent Git-manifest construction reproduced 33 material paths and git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334. The inventory contains exactly 34 staged regular non-reparse paths with no unstaged/untracked path or .task-artifacts root, and cached diff check passes. Static review confirmed exact Application and CLI DAGs, facades and sole effect owners; 84/85 Application declarations text-identical after export normalization with the remaining service declaration differing only by two reviewed pure helper extractions; all 48 CLI declarations identical except export/type-only changes to three declarations; exact 33 commands, 37 errors, built-in mapping and unchanged src/cli.ts/src/index.ts blobs; truthful closure of eleven surviving historical roots plus 64 extraction-only imports while readDomainInitialized remains live only in its migration owner; native noUnused enforcement without workarounds; exact 43 source and 172 packed inventories; unchanged authorization, persistence, compatibility and future-capability boundaries; and coherent V1-V10 evidence. No implementation, contract, authorization, recovery or validation-scope defect was found.",
        "reviewed_state_id": "git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334",
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
        "finding_ids": ["F-RC05-A0-001"],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced 20,033 approval bytes and SHA-256 5F29F9AE827D7D16822B1E15FAA5CDDF581C714697B174337E3C8778561DEBD7 at base/HEAD ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6 with clean scope, then found one MEDIUM contract gap: C3/C5 described layers without a complete required/allowed adjacency predicate, so V2/V3 could not binary-distinguish the intended DAG from unintended coupling. The parent confirmed the finding, preserved the full report at docs/plans/evidence/RC05/a0-attempt-1.md and revised only the exact edge sets and their validation equality checks."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-RC05-A0-002"],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 reproduced 20,981 approval bytes and SHA-256 470974E49964064BAE2B445FBFF06ACBCBB47DA71682D36FCC1B03CC71ED3BB9 at base/HEAD ad67d059a3fc21d94fa775669a7d0efaa7d8b4c6 with clean scope and confirmed F-RC05-A0-001 closed, then found one MEDIUM contract gap: V8's physical parser/runtime-only wording conflicted with the required byte-identical src/cli.ts node:path/node:url imports while C9 did not freeze an exact per-file mapping. The parent independently confirmed the source and allowlist facts, preserved the full report at docs/plans/evidence/RC05/a0-attempt-2.md and revised only C9/V8 to exact mapping equality."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V4",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 06:00:00+08:00",
        "evidence": "The first bare tsc invocation did not start TypeScript because ambient PATH had no node. Direct execution through the frozen Node 24.19.0 and TypeScript 5.9.3 entry passed with zero diagnostics.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 06:05:00+08:00",
        "evidence": "The first fallback pnpm docs invocation stopped before docs-check when the sandbox denied a worktree-root temporary file with EPERM. The identical offline command with task-worktree write authorization passed.",
        "state_id": null
      },
      {
        "validation_id": "V8",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 06:15:00+08:00",
        "evidence": "Early package-smoke attempts first met sandbox EPERM, then correctly refused an absent dist tree and an absent worktree-local pnpm store. After build and a validated regular-file-only offline store seed that excluded every projects/reparse entry, the same gate passed 172 files and left .task-artifacts absent. No existing dist, node_modules or store content was deleted.",
        "state_id": null
      },
      {
        "validation_id": "V10",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 06:27:00+08:00",
        "evidence": "The fallback pnpm wrapper completed the full route successfully but its SQLite evidence identified ambient Node 22.22.1 rather than the frozen toolchain, so that pass was not accepted for V10. Prepending the exact Node bin and invoking pnpm.mjs through absolute Node 24.19.0 produced Node 24.19.0/SQLite 3.53.3 and the complete accepted pass.",
        "state_id": null
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-01 04:58:00+08:00",
        "summary": "Closed F-RC05-A0-001 by freezing the complete required/allowed internal adjacency for all five Application and four CLI implementation modules, explicitly forbidding every other internal edge, cycle and facade import, and binding V2/V3 to exact set equality plus the existing sole service/runtime effect-owner rules.",
        "previous_approval_sha256": "5F29F9AE827D7D16822B1E15FAA5CDDF581C714697B174337E3C8778561DEBD7"
      },
      {
        "at": "2026-09-01 05:19:31+08:00",
        "summary": "Closed F-RC05-A0-002 by freezing the exact per-file CLI entrypoint/API Node built-in mapping, retaining byte-identical src/cli.ts ownership of node:path/node:url, assigning node:path only to the parser and node:crypto only to the runtime, forbidding built-ins in the other CLI API modules, and binding V8 plus repo-utils to exact equality without a wildcard exception.",
        "previous_approval_sha256": "470974E49964064BAE2B445FBFF06ACBCBB47DA71682D36FCC1B03CC71ED3BB9"
      }
    ],
    "final_summary": "RC05 decomposes Application into exactly five implementation modules for model, input, policy, Domain selection/projection and service transaction orchestration, and CLI into exactly four implementation modules for model, parsing, presentation and runtime effects, while retaining application.ts and cli-api.ts as explicit zero-logic facades with exact 4 runtime plus 16 type and 5 runtime plus 4 type exports. The complete approved DAGs, sole service/transaction and CLI runtime/effect/close owners, byte-identical src/index.ts and src/cli.ts, exact 33-command/37-error ato.api/v1 surface, ato.execution/v1, schema-version-1, authorization, persistence, recovery and product behavior remain unchanged. Eleven surviving historical unused roots and 64 RC04 extraction-only imports are removed, readDomainInitialized remains truthfully owned and used only by migration code, noUnusedLocals/noUnusedParameters are both enforced natively, and no suppression, dummy use, underscore avoidance or broad export was added. Exact material state git-sha1:2f656d80c6c65d3fba6b200b5b650798eea56334 passes focused groups 157/157, 35/35 and 173/173, pinned Node 24.19.0 full 421/421, lint/typecheck/build, docs 108/252/22/0, package smoke across 172 files, SQLite 3.53.3/schema-version-1 and Codex support-claim boundaries, plus fresh independent A0/A1 closure with findings=[] and no A2 required. Scheduler, scheduled triggers, MCP, Codex/Git/workspace adapters, ProjectPolicy, CompletionBackend, daemon/service, release, deployment and platform-support claims remain unimplemented. The one result commit is followed only by the authorized pathless current-head artifact prune, thirteen exact-head gates, readiness, FF-only local integration and ordinary push, with no worktree cleanup."
  }
}
```

## Context

RC04 推送后，持久化物理边界已经收敛；剩余最大的结构债集中在 Application 与 CLI 两个组合文件。RC05 同时把 TypeScript unused 检查从临时诊断提升为仓库强制，以阻止结构拆分重新累积不可见依赖。

## Plan of work

1. 冻结 facade、调用者、模块声明、CLI 表、unused 诊断、源码/包清单与行为基线。
2. 机械提取 Application model/input/policy/domain/service，并把原文件收敛为显式 facade。
3. 机械提取 CLI model/parser/presentation/runtime，并把原文件收敛为显式 facade。
4. 关闭 unused 账本与 RC04 import 噪声，启用编译器强制，补齐静态测试、清单与当前文档。
5. 完成聚焦/全量验证、独立 A1/必要 A2、唯一结果提交和协调器终态流程。

## Acceptance summary

完成态具有两个零逻辑 facade、九个内聚实现模块、原样的 package/console/API 行为，以及原生通过的 `noUnusedLocals`/`noUnusedParameters`。它不添加任何产品能力、兼容层或外部效果。
