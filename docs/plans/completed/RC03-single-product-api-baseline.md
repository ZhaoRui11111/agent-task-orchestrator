# ExecPlan：收敛为单一 current 产品 API

RC03 是 Phase 3 前兼容与结构债收敛序列的第三项。它删除旧的受限 `ato.api/v1` 命令树与显式 `ato.api/v2` 兼容面，把完整的本地 explicit-Manual Phase 2 产品重新定义为唯一的 current `ato.api/v1`；`ato.execution/v1` 保持不变，RC04–RC05 仍须各自独立规划、审查、集成与推送。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-08-31 23:59:23+08:00",
    "updated_at": "2026-09-01 01:31:55+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "current user directive requiring strict serial implementation of RC01 through RC05",
        "at": "2026-08-31 23:59:23+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "current user directive requiring one result commit, FF-only integration and ordinary push for every RC plan",
        "at": "2026-08-31 23:59:23+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Delete the retired limited ato.api/v1 command tree and explicit ato.api/v2 compatibility surface, redefine the complete existing local explicit-Manual Phase 2 product as the sole current ato.api/v1 with one exact 33-command registry and one exact 37-code public error table, make omitted and explicit ato.api/v1 selection identical, reject retired ato.api/v2 before runtime construction or protected mutation, consolidate the package implementation status to localProductCliImplemented=true, and preserve all current Domain, authorization, persistence, Manual execution, dispatcher and ato.execution/v1 semantics.",
    "non_goals": [
      "Do not perform RC04 persistence module decomposition or RC05 application/CLI module decomposition, unused-declaration removal or noUnusedLocals/noUnusedParameters enablement in this plan.",
      "Do not preserve an operational old limited-v1 or explicit-v2 compatibility branch, alias, redirect, translation layer, dual declaration surface, dual public error table or default fallback. This unreleased pre-1.0 reset has no compatibility window.",
      "Do not change ato.execution/v1, the runtime database schema or artifact formats, authorization vocabulary, lifecycle state digest, Domain semantics, Manual adapter protocol, dispatcher membership/outcome semantics, execution fencing, public command payload fields, confirmation requirements or exit-code meanings.",
      "Do not add a scheduler, scheduled trigger, MCP component, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon/service, release, deployment, telemetry or platform-support claim.",
      "Do not delete or rewrite completed ExecPlans, audit evidence, Git history, .local content, runtime data, backups, ignored dependency/build stores, existing worktrees or task branches."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "RC02 has terminal result commit 96ef7860938a9a9c6003d55ed65ec841dbe26a76, its coordinator task is pushed, and local master plus origin/master matched that commit before RC03 task creation. RC03 is the next plan in the strict chain and RC04 cannot begin until RC03 is completed, integrated and pushed.",
        "source": "current user directive; docs/plans/README.md; completed RC02 plan; fresh Git and coordinator trace"
      },
      {
        "id": "C2",
        "statement": "The sole public product API major is exactly ato.api/v1. CLI_API_V2_VERSION, every v2-only registry/table/type/default branch and every root package export that exposes the retired product major are absent. Historical completed plans and changelog entries remain historical evidence rather than executable compatibility owners.",
        "source": "current user RC03 boundary; src/cli-api.ts; src/index.ts; docs/reference/cli-contract.md"
      },
      {
        "id": "C3",
        "statement": "Omitting --api-version and passing --api-version ato.api/v1 select the same complete current product tree. Passing retired ato.api/v2 or any other unsupported major for a recognized command returns CLI_UNSUPPORTED_VERSION through the sole v1 failure envelope before runtime construction, filesystem/database creation, authorization evaluation or protected mutation; there is no fallback to the old tree.",
        "source": "current user directive; docs/reference/cli-contract.md; src/cli-api.ts"
      },
      {
        "id": "C4",
        "statement": "One authoritative command registry contains exactly the existing 33 public command IDs: the former 24 base IDs plus the former 9 product IDs. It has no version-selected duplicate. The 19-action bootstrap remains finite, and current upgrades retain the established 23-, 29- and 30-action vocabulary checkpoints without broadening authorization.",
        "source": "src/cli-api.ts command registries and bootstrap; docs/reference/authorization-contract.md; current contract tests"
      },
      {
        "id": "C5",
        "statement": "One authoritative PUBLIC_ERROR_TABLE contains exactly the existing 37 fixed public error codes, including the seven former v2-only product errors. PublicErrorCode is the sole exported error-code type; mapping, message, exit-code and redaction behavior are unchanged for the complete current product.",
        "source": "src/cli-api.ts public error tables and mapper; docs/reference/cli-contract.md; security contracts"
      },
      {
        "id": "C6",
        "statement": "The CLI remains typed ingress and presentation only. Complete current product commands use the trusted application product facade and its derived non-public execution tuples; a semantic product-command ID set may remain solely for owner routing, but it is not a version registry and must not recreate public v1/v2 selection.",
        "source": "AGENTS.md; ARCHITECTURE.md; src/cli-api.ts; application and product-runtime ownership"
      },
      {
        "id": "C7",
        "statement": "ato.execution/v1 is a separate implemented adapter-port contract and remains byte-, type- and behavior-identical. Removing product API v2 cannot rename, renumber or weaken execution intent, observation, verified receipt, finalization, fencing or Manual outcome protocols.",
        "source": "current user directive; docs/reference/adapter-contracts.md; docs/reference/reliability-protocol.md"
      },
      {
        "id": "C8",
        "statement": "The root package and implementation-status surface expose one truthful localProductCliImplemented: true field. localPhase1ProductCliImplemented, localPhase2ProductCliImplemented, CLI_API_V2_VERSION, PUBLIC_ERROR_TABLE_V2 and PublicErrorCodeV2 are absent from source declarations and packed consumers; unrelated truthful capability fields remain unchanged.",
        "source": "src/index.ts; test/scaffold.test.mjs; test/domain-architecture.test.mjs; scripts/package-smoke.mjs"
      },
      {
        "id": "C9",
        "statement": "The versioning contract explicitly records an intentionally breaking same-name ato.api/v1 reset for an unreleased 0.0.0-development pre-1.0 product. No supported release or durable resume artifact depends on the retired product majors, so old limited-v1 and explicit-v2 callers receive no compatibility or migration window.",
        "source": "package.json; current user compatibility authorization; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C10",
        "statement": "Fresh independent A0 precedes activation; fresh independent read-only A1 follows a stable complete diff; every confirmed in-scope HIGH/MEDIUM or non-mechanical repair receives fresh independent A2. The implementer cannot act as reviewer and parent disposition remains separate.",
        "source": "current user directive; harness-exec-plan schema v3"
      },
      {
        "id": "C11",
        "statement": "Use only task/rc03-single-product-api and D:/agent-task-orchestrator/.worktrees/rc03-single-product-api. After one terminal task-owned result commit, invoke the pathless current-head artifact prune, all twelve frozen exact-head gates, ready, FF-only integration and ordinary non-force push. Cleanup, PR, release, deployment, reset, rebase, stash and force are prohibited.",
        "source": "current user directive; AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C12",
        "statement": "Current documentation describes only the closed local explicit-Manual Phase 2 product under one current ato.api/v1 and preserves every unimplemented boundary. It must not imply scheduler, MCP, Codex/Git/workspace effects, daemon, release, deployment or validated platform support.",
        "source": "AGENTS.md; ARCHITECTURE.md; repository governance and current reference contracts"
      }
    ],
    "authorization": {
      "allowed": [
        "Create and update this RC03 schema-v3 ExecPlan and task-owned evidence; edit only declared task paths; remove the obsolete limited-v1 and explicit-v2 public product branches, merge the current command/error surfaces under ato.api/v1, consolidate the implementation-status field and update exact current contracts/tests.",
        "Run local impact-selected and full repository validation, create only validation-owned disposable .task-artifacts, make one task-owned result commit, invoke standing-authorized pathless artifact prune, record twelve exact-head gates, mark ready, FF-only integrate locally and use the standing-authorized ordinary non-force origin/master push.",
        "Use fresh independent read-only reviewers for A0, A1 and any required A2; reviewers may inspect repository content and validation evidence but may not edit or grant authority."
      ],
      "requires_reapproval": [
        "Any need to preserve or introduce an old limited-v1/explicit-v2 compatibility path, change the sole current public payload/result/error semantics beyond the approved major reset, or create a durable migration artifact.",
        "Any change to ato.execution/v1, database or backup/restore formats, authorization vocabulary/checkpoints, Domain semantics, Manual protocol, dispatcher behavior, fencing, persistence lifecycle or user runtime data.",
        "Any scope expansion into RC04-RC05 outcomes, an external path, network/secret access, PR, merge other than coordinator FF-only local integration, release, deployment, destructive operational cleanup or user data."
      ],
      "prohibited": [
        "Adopt, delete, clean up or impersonate the Codex application worktree or any pre-existing branch, worktree or coordinator task.",
        "Delete completed plans, immutable audit evidence, Git history, .local, runtime/backup data, node_modules, pnpm store, dist, ignored content or any existing worktree/task branch.",
        "Implement scheduler, MCP, Codex/Git/workspace adapter, ProjectPolicy, CompletionBackend, daemon, release, deployment or unsupported platform/integration claims."
      ],
      "persistence": {
        "required": true,
        "action": "one task-owned terminal result commit containing the completed RC03 plan, followed by coordinator pathless artifact prune, twelve exact-head gates, ready, FF-only local integration and the standing-authorized ordinary origin/master push",
        "source": "current user directive plus AGENTS.md/local-agent-git-flow narrow standing grants"
      }
    },
    "scope": {
      "task_paths": [
        {"path": "AGENTS.md", "kind": "file"},
        {"path": "ARCHITECTURE.md", "kind": "file"},
        {"path": "CHANGELOG.md", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/compatibility/v0.1.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC03-single-product-api-baseline.md", "kind": "file"},
        {"path": "docs/plans/active/RC03-single-product-api-baseline.md", "kind": "file"},
        {"path": "docs/plans/completed/RC03-single-product-api-baseline.md", "kind": "file"},
        {"path": "docs/plans/evidence/RC03", "kind": "directory"},
        {"path": "docs/reference/adapter-contracts.md", "kind": "file"},
        {"path": "docs/reference/authorization-contract.md", "kind": "file"},
        {"path": "docs/reference/cli-contract.md", "kind": "file"},
        {"path": "docs/reference/contract-ownership.md", "kind": "file"},
        {"path": "docs/reference/observability-contract.md", "kind": "file"},
        {"path": "docs/reference/reliability-protocol.md", "kind": "file"},
        {"path": "docs/reference/scheduler-contract.md", "kind": "file"},
        {"path": "docs/reference/toolchain-contract.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/reference/versioning-compatibility-contract.md", "kind": "file"},
        {"path": "docs/security/privacy-and-logging.md", "kind": "file"},
        {"path": "docs/security/threat-model.md", "kind": "file"},
        {"path": "scripts/package-smoke.mjs", "kind": "file"},
        {"path": "src/cli-api.ts", "kind": "file"},
        {"path": "src/index.ts", "kind": "file"},
        {"path": "test/cli-contract.test.mjs", "kind": "file"},
        {"path": "test/cli-phase2-e2e.test.mjs", "kind": "file"},
        {"path": "test/domain-architecture.test.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"}
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "Production CLI/API ownership exposes one exact 33-command ato.api/v1 registry, one exact 37-code public error table and one PublicErrorCode type, with no executable limited-v1/v2 compatibility branch.",
        "validation_ids": ["V2", "V3", "V5"]
      },
      {
        "id": "M2",
        "outcome": "The complete existing local explicit-Manual Phase 2 product remains reachable through omitted or explicit ato.api/v1, retired/unsupported majors fail before runtime mutation, authorization checkpoints and trusted product-facade routing remain exact, and ato.execution/v1 is unchanged.",
        "validation_ids": ["V3", "V4", "V6"]
      },
      {
        "id": "M3",
        "outcome": "Root exports, implementation status, packed declarations, tests and current documentation describe one local product CLI with localProductCliImplemented=true and no current product-v2 claim while preserving all unimplemented boundaries.",
        "validation_ids": ["V7", "V8", "V9"]
      },
      {
        "id": "M4",
        "outcome": "RC03 has a stable independently reviewed completion-ready diff, complete exact-state validation and an exact task-owned staged inventory. Failed diagnostics remain outside the result commit until the authorized post-commit coordinator prune and exact-head integration sequence.",
        "validation_ids": ["V1", "V10"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "RC02 predecessor lineage, RC03 approval contract, exact scope and authorization",
        "criterion": "Before activation, exec_plan.py check/preflight/trace and chain-check plus fresh independent A0 report schema v3, exact predecessor commit 96ef7860938a9a9c6003d55ed65ec841dbe26a76, approval base equal to that commit, errors=[], warnings=[], outside_scope=[], no unresolved HIGH/MEDIUM finding, and an approval digest independently reproduced by the reviewer."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Single current command registry and retired major removal",
        "criterion": "Source/static/type tests prove CLI_API_VERSION is exactly ato.api/v1, one authoritative registry contains exactly 33 unique command IDs, CLI_API_V2_VERSION, V2_ONLY_COMMAND_SPECS, public dual-registry selection and any operational ato.api/v2 symbol are absent from current source/declarations, and no old limited-v1 registry remains."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Default/current selection and unsupported-major no-mutation boundary",
        "criterion": "For representative read-only and mutating base/product commands, omitted and explicit ato.api/v1 produce identical success/failure envelopes. Explicit ato.api/v2 and other unsupported majors for a recognized command return CLI_UNSUPPORTED_VERSION in the sole ato.api/v1 envelope before runtime construction and leave a fresh target directory/database absent or byte/inventory unchanged. Unknown commands retain their fixed public classification without fallback."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Finite authorization vocabulary and trusted owner routing",
        "criterion": "Static and lifecycle tests prove the 19-action bootstrap and established 23/29/30 upgrades remain exact, the complete current parser validates actions against the full current vocabulary, product command IDs route only through the trusted product facade, base commands preserve their existing owner, and no CLI branch selects or forges Domain/execution mutations."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Single fixed public error table and redaction",
        "criterion": "Source/type/runtime tests prove one PUBLIC_ERROR_TABLE with exactly 37 unique entries and one PublicErrorCode export, with PUBLIC_ERROR_TABLE_V2, PublicErrorCodeV2, AnyPublicErrorCode and version-selected mapping absent. Every command maps the same failure to the established code/message/exit status, and security tests preserve redaction and JSON-only stdout."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Complete local explicit-Manual Phase 2 behavior and execution-port stability",
        "criterion": "CLI contract/E2E, product runtime, authorization, persistence, Manual execution/dispatcher and ato.execution/v1 tests pass for all 33 commands. Claims, attempts, leases, fencing, inspect/resume/retry/cancel, trusted Manual outcome reporting, confirmed completion, dispatcher run ownership and summary semantics remain unchanged; source and declarations retain ato.execution/v1 exactly and contain no product-major coupling."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Root package exports, implementation status and packed consumer surface",
        "criterion": "Scaffold, architecture, build and packed-install tests prove localProductCliImplemented is the sole product-CLI implementation-status field and equals true. The two old phase-specific fields and all public v2 constants/tables/types are absent from source, generated declarations and packed consumer checks, while every unrelated capability status remains truthful and unchanged."
      },
      {
        "id": "V8",
        "type": "manual",
        "target": "Current contract and compatibility truth",
        "criterion": "Exact-case documentation/link checks pass; authority review finds one current product API owner and separately frozen ato.execution/v1. Current docs explicitly describe the unreleased pre-1.0 breaking v1 reset, contain no operational old limited-v1/v2 compatibility promise, preserve changelog/history truth, and do not claim any unimplemented Phase 3 capability or platform support."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Impact-selected and full repository regression",
        "criterion": "Pinned Node 24.19.0 focused cli-contract, cli-phase2-e2e, scaffold, architecture, CLI security, product runtime, authorization lifecycle, persistence and execution/Manual suites pass, followed by build, package smoke and pnpm verify:offline with zero failed tests, production dependency drift or support-claim expansion."
      },
      {
        "id": "V10",
        "type": "manual",
        "target": "Stable review closure, task inventory and exact-head workflow",
        "criterion": "At one stable material state, fresh independent A1 and every required A2 are complete with parent disposition, git diff --check and cached diff check pass, the staged inventory contains only declared regular non-reparse task paths, ignored .task-artifacts has zero tracked overlap and successful-run baseline equality, and final trace returns errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false and no completion blocker before the single result commit."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Merging registries could omit a command, duplicate an ID or accidentally retain the old limited-v1 selection path."},
      {"id": "R2", "risk": "Rejecting explicit ato.api/v2 too late could construct a runtime, create a database or mutate protected state before the public failure."},
      {"id": "R3", "risk": "Merging public error tables could change an established code, exit status, message or redaction boundary."},
      {"id": "R4", "risk": "Removing version-selected authorization actions could broaden bootstrap authority or break the finite 19/23/29/30 upgrade sequence."},
      {"id": "R5", "risk": "Product API renumbering could leak into the independent ato.execution/v1 adapter port or weaken trusted application-facade ownership."},
      {"id": "R6", "risk": "Root export/status cleanup or broad documentation edits could create a false current-capability claim or silently alter package consumers."},
      {"id": "R7", "risk": "Full validation can create ignored task artifacts or expose an adjacent regression after the stable review state."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Keep the public name ato.api/v1 and assign it the complete existing 33-command Phase 2 product; delete rather than alias the old limited-v1 and explicit-v2 branches.",
        "rationale": "The user explicitly authorizes a pre-1.0 compatibility reset and requires one current product surface rather than a third major or a migration layer."
      },
      {
        "id": "D2",
        "statement": "Represent all current commands in one authoritative registry and retain only a semantic product-command ID set where application-facade routing requires it.",
        "rationale": "Routing ownership is a real architectural distinction, while a second public version registry is compatibility debt."
      },
      {
        "id": "D3",
        "statement": "Perform supported-major validation before runtime creation and always encode parse/version failures with the sole current ato.api/v1 envelope.",
        "rationale": "This makes retired callers fail closed without filesystem, database, authorization or Domain effects."
      },
      {
        "id": "D4",
        "statement": "Merge the seven product error entries into the existing table, expose one PublicErrorCode type and preserve every entry's current message and exit status.",
        "rationale": "The product is unified, but its externally observable fixed failure meanings must not drift."
      },
      {
        "id": "D5",
        "statement": "Expose localProductCliImplemented=true as the sole package status for the one current CLI and leave ato.execution/v1 plus every unrelated capability field unchanged.",
        "rationale": "Phase-specific CLI status fields encode the retired public split and are no longer truthful after convergence."
      },
      {
        "id": "D6",
        "statement": "Complete one independently reviewed result commit followed by coordinator-only artifact prune, exact-head gates, ready, FF-only local integration and ordinary push; do not clean the task worktree.",
        "rationale": "This is the user-authorized strict chain and repository Git-flow contract."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "If the sole registry/table cannot exactly preserve all 33 commands and 37 errors, stop before activation or stable review, restore exact membership from current owners and remove duplicates; never retain a compatibility fallback."
      },
      {
        "id": "M2",
        "recovery": "If unsupported-major rejection constructs a runtime or any product behavior/authorization/execution invariant drifts, preserve evidence, repair the pre-runtime boundary or owner routing in scope and rerun affected lifecycle/regression tests; do not change ato.execution/v1."
      },
      {
        "id": "M3",
        "recovery": "If declarations, status fields or docs expose dual/currently unimplemented behavior, restore the single truthful package/contract surface within declared paths or seek reapproval; do not pull RC04/RC05 work forward."
      },
      {
        "id": "M4",
        "recovery": "A failed gate leaves the reserved task editable. Repair in scope, create a new result commit only when required, rerun affected/full validation and fresh review, then replace stale exact-head receipts; never reset, rebase, stash or force."
      }
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
      {"id": "R1", "mitigation": "Freeze exact sorted command membership/count and default/explicit-v1 parity before deleting dual selection; add static absence assertions for retired registry symbols.", "recovery": "Repair the one registry from current command specs and rerun all command-table cases; never add a second selector."},
      {"id": "R2", "mitigation": "Add fresh-path and existing-path inventory/byte snapshots around explicit v2 and unsupported-major calls for representative mutating commands.", "recovery": "Move version validation earlier, preserve any observed runtime evidence and block completion until zero mutation is proven."},
      {"id": "R3", "mitigation": "Assert the exact 37-entry table and exercise every public mapping plus CLI security/redaction in source and built package.", "recovery": "Restore the established entry literals and mapper ordering; do not introduce version-selected mapping."},
      {"id": "R4", "mitigation": "Assert exact bootstrap and upgrade vocabulary counts/membership and run authorization lifecycle tests across current command parsing.", "recovery": "Restore finite checkpoints and fail closed on absent capability; never infer a broader grant."},
      {"id": "R5", "mitigation": "Run static ownership tests and full execution/Manual regressions while asserting ato.execution/v1 literals and declarations are unchanged.", "recovery": "Revert any execution-port coupling within task scope and keep product versioning confined to CLI ingress/presentation."},
      {"id": "R6", "mitigation": "Use exact negative declaration/status assertions and authoritative documentation review, preserving historical entries and current unimplemented boundaries.", "recovery": "Restore truthful unrelated fields/history and remove only current compatibility claims authorized by RC03."},
      {"id": "R7", "mitigation": "Run focused validation before stable A1, then full pinned offline validation, preserve failed diagnostics and invoke only coordinator pathless artifact prune after the result commit.", "recovery": "Keep failed diagnostics while reserved, repair and rerun; prune only the registered task-artifact root when the exact-head result is ready for gates."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "96ef7860938a9a9c6003d55ed65ec841dbe26a76",
      "current_material_base": "96ef7860938a9a9c6003d55ed65ec841dbe26a76",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 01:05:01+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 01:05:01+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 01:05:01+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 01:26:51+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "exec_plan.py check, preflight, trace and chain-check followed by fresh independent schema-v3 A0 review and separate parent disposition",
        "evidence": "Plan check, preflight and chain-check passed with errors=[] and warnings=[]; RC02 terminal commit and RC03 material base both equal 96ef7860938a9a9c6003d55ed65ec841dbe26a76. The reviewer's exactly-once trace returned ok=true with errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[] at base/HEAD/evaluated commit 96ef7860938a9a9c6003d55ed65ec841dbe26a76 and state git-sha1:50e2287ae8caccb0648d22f91c64eeccc49de3bb; only the scoped proposal was untracked. The independent reviewer reproduced 18,662 canonical approval-contract bytes and SHA-256 3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC, verified the exact 29-path boundary and returned findings=[] with readiness=ready_for_activation. Parent disposition accepts the report without contract revision.",
        "state_id": "approval-sha256:3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Inspect the production registry and generated declarations, assert exact membership and absence of retired symbols, and run focused plus complete tests.",
        "evidence": "src/cli-api.ts contains one COMMAND_SPECS registry. The contract suite proves 24 base/lifecycle plus 9 product IDs, 33 unique total, under CLI_API_VERSION=ato.api/v1. CLI_API_V2_VERSION, V2_ONLY_COMMAND_SPECS, V2_COMMAND_SPECS and executable dual selection are absent; negative source/declaration assertions pass in the complete 414-test route and 112-file package smoke.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Exercise every command with omitted and explicit current version; run retired/unsupported-major parse, no-runtime-creation and source/build/installed package cases.",
        "evidence": "All 33 command cases produce identical parsed commands for omitted and explicit ato.api/v1. Retired ato.api/v2 recognizes both base and product IDs but returns CLI_UNSUPPORTED_VERSION in the ato.api/v1 envelope before option/runtime work. The mutating init negative leaves its fresh runtime root absent; source, build and installed doctor parity returns the same refusal and creates no root.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Run exact parser vocabulary cases, authorization lifecycle tests and the package Manual boundary through every upgrade.",
        "evidence": "The current parser accepts only AUTHORIZATION_ACTIONS. Fresh bootstrap still emits 19 capabilities; separately confirmed contiguous upgrades emit exactly 23, 29 and 30. The full authorization, dispatcher, product and package routes pass with no inferred grant or CLI-selected business mutation; product IDs route through createLocalProductIngress and the typed product facade.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Assert the exact public table and every typed owner mapping; inspect declarations and run CLI security/redaction regressions.",
        "evidence": "PUBLIC_ERROR_TABLE is the sole table and has 37 exact entries; PublicErrorCode is the sole exported public code type. The complete application/reliable/dispatcher mapping test passes, generated declarations reject the retired table/types, and source/build/installed plus security tests preserve fixed messages, exit codes, one-line JSON stdout, empty stderr and input/error redaction.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Run current-v1 CLI restart E2E and the complete authorization, persistence, execution, Manual-loop, dispatcher and product-runtime regression suite.",
        "evidence": "Focused CLI E2E/security passed 11/11. The pinned complete route passed 414/414 with zero fail/cancel/skip/todo, including claims, attempts, leases, fences, inspect/resume/retry/cancel, Manual outcome, confirmed completion, dispatcher ownership/reconciliation/membership/summary and every durable recovery checkpoint. Static ownership asserts ato.execution/v1 remains independent and unchanged.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Run scaffold/architecture tests, build declarations and packed offline consumer/export checks.",
        "evidence": "Root runtime exports contain CLI_API_VERSION and PUBLIC_ERROR_TABLE only. ScaffoldStatus and getScaffoldStatus expose localProductCliImplemented=true with both phase-specific fields absent. Generated cli-api/index declarations contain one current API/error type and no retired product symbol; package smoke passed consumer types, export, persistence, console parity and uninstall across 112 packed files.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Review current authority wording and run exact-case repository documentation checks.",
        "evidence": "Current contracts name one ato.api/v1 owner, independently frozen ato.execution/v1 and the one authorized private 0.0.0-development same-name reset with no old-major window. Historical changelog/plan facts remain intact; scheduler, MCP, Codex/Git/workspace, policy/gate, daemon, release, deployment and platform support remain absent. Docs check passed 102 Markdown files, 252 links, 22 fragments and forbidden=0.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Run pinned Node 24.19.0 focused routes followed by the complete pnpm verify:offline gate at one material state.",
        "evidence": "verify:offline exited 0: lint passed 197 files/28 sources; typecheck and build passed; tests passed 414/414 with artifact baseline 0-to-0 and reclaimed root; docs passed 102/252/22/0; production dependencies remained zero; package smoke passed pnpm 11.19.0, TypeScript 5.9.3 and 112 files; SQLite 3.53.3/schema 1 passed with zero surviving members; Codex boundary remained passed/blocked/not_run/supportClaim=false.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Bind the complete focused and pinned offline validation, fresh independent stable-diff A1 and completion-ready trace to one exact material state.",
        "evidence": "The complete material state passed focused current-v1 CLI E2E/security 11/11 and pinned verify:offline with lint 197 files/28 sources, typecheck/build, tests 414/414, docs 102/252/22/0, production dependencies zero, package smoke 112 files, SQLite 3.53.3/schema 1 with zero surviving members and Codex passed/blocked/not_run/supportClaim=false. Fresh independent A1 invoked trace exactly once, independently reproduced 18,662 approval bytes and SHA-256 3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC, observed exactly 27 clean staged task-owned paths and material state git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0, and returned findings=[]; no A2 is required. The completion-ready parent trace then returned ok=true, errors=[], warnings=[], outside_scope=[], state_bound=true, closure_required=false, completion_ready=true and completion_blockers=[] at that same material state.",
        "state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_final",
        "independence": "Fresh independent read-only schema-v3 A0. The reviewer did not draft or materially decide the RC03 proposal, enumerate its scope, implement RC03, edit repository or Git/coordinator/runtime/external state, run tests, or grant authority. Exactly one required read-only trace was invoked.",
        "scope": "Complete RC03 proposal and execution contract; harness schema and A0/implementation audit rules; repository architecture and lifecycle; terminal RC02 chain; CLI/API, authorization, versioning, toolchain, validation, security, observability, scheduler, adapter, reliability, ownership and Git-flow contracts; src/cli-api.ts, src/index.ts, unchanged product-facade/runtime-selection boundaries, and adjacent CLI, architecture, scaffold, Phase-2 E2E and package-smoke consumers. The review covered exact 33-command and 37-error convergence, default/explicit-v1 equivalence, pre-runtime unsupported-major refusal, 19/23/29/30 capability checkpoints, facade owner routing, one implementation-status field, unchanged ato.execution/v1, the authorized pre-1.0 reset, all 29 task paths, RC04/RC05 boundaries and binary validation sufficiency.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 00:19:35+08:00",
        "approval_sha256": "3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC",
        "evidence": "The reviewer invoked exec_plan.py trace exactly once and observed ok=true, errors=[], warnings=[], outside_scope=[], overlap=[] and pre_existing_dirty=[]; approval/current material base, HEAD and evaluated revision all equal 96ef7860938a9a9c6003d55ed65ec841dbe26a76; state_id=git-sha1:50e2287ae8caccb0648d22f91c64eeccc49de3bb; the only untracked path was the scoped proposal. Independent canonicalization reproduced 18,662 bytes and SHA-256 3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC. Static enumeration confirmed exactly 24+9 commands, 30+7 errors, all operational v2/status callers inside the declared 29 paths, no product-major persistence, an independently closed ato.execution/v1, and exact 19/23/29/30 authorization checkpoints. C3/V3 place unsupported-major refusal before trusted runtime selection, doctor, preparation/loading, database open and authorization evaluation. Package metadata is private 0.0.0-development; current contracts carry no release/platform promise and explicitly authorize the same-name breaking v1 reset. No tests or mutation-capable commands were run and findings=[].",
        "parent_disposition": "complete",
        "findings": [],
        "reviewed_material_base": "96ef7860938a9a9c6003d55ed65ec841dbe26a76"
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/rc01_a0_repeat",
        "independence": "Fresh independent read-only schema-v3 A1. The reviewer did not draft or approve the RC03 plan, enumerate its scope, implement or repair RC03, edit repository content, modify Git/index/ref/coordinator/runtime/external state, run tests, or grant authority. Exactly one required read-only exec_plan.py trace was invoked.",
        "scope": "The complete active RC03 plan and execution contract; schema-v3 and implementation-audit rules; all 27 staged paths and validation evidence; AGENTS.md, ARCHITECTURE.md, Git-flow, CLI/API, authorization, versioning, toolchain, validation, security/privacy, ownership, adapter, reliability, scheduler, observability, Domain and persistence contracts; current CLI/product-ingress/facade sources and adjacent contract, E2E, architecture, scaffold and package-smoke consumers. The review covered the sole ato.api/v1 registry and envelope, command/error inventories, unsupported-major ordering, authorization checkpoints, owner routing, ato.execution/v1 independence, package declarations/status, unreleased compatibility reset, scope cleanliness, unimplemented boundaries and recorded validation claims.",
        "reviewed_at": "2026-09-01 01:18:00+08:00",
        "evidence": "The exactly-once trace returned ok=true with errors=[] and warnings=[]; approval/current material base, HEAD and evaluated revision were all 96ef7860938a9a9c6003d55ed65ec841dbe26a76. It reported exactly 27 staged task-owned paths, unstaged=[], untracked=[], outside_scope=[], overlap=[], pre_existing_dirty=[] and reviewed state git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0. Independent canonicalization reproduced 18,662 bytes and SHA-256 3ED3DAC7DDCD9342EF5E9172DC7AD52EC6B1A562176B36B50E2C47059B417EFC. Static inspection confirmed exactly 33 unique command specifications, exactly 37 public error definitions equal to the established 30+7 union, identical omitted/explicit ato.api/v1 parsing and fixed v1 output. Unsupported recognized majors fail during parsing before trusted runtime selection, doctor, prepare/load, persistence open, authorization or Domain execution. All nine product IDs route through trusted LocalProductIngress and the typed product facade; bootstrap remains 19 and authorization owners retain 23/29/30 upgrade checkpoints. src/execution-port.ts has identical HEAD/index/worktree content and no ato.api coupling. Source/export/declaration assertions retain only localProductCliImplemented and remove operational v2/phase-specific surfaces. The staged inventory excludes ignored dependency/build material and cached diff check passed. Recorded focused 11/11, complete 414/414, 112-file package, SQLite and Codex boundary evidence is coherent. The reviewer ran no tests or mutation-capable command and found no blocking defect.",
        "reviewed_state_id": "git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0",
        "parent_disposition": "complete",
        "closes": [],
        "findings": []
      }
    },
    "audit_attempts": [],
    "validation_attempts": [
      {
        "validation_id": "V9",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 00:32:00+08:00",
        "evidence": "The first sandboxed pnpm typecheck stopped before TypeScript because pnpm could not create a worktree-local temporary state file (EPERM). The authorized local offline rerun passed without a material change.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 2,
        "classification": "environment_failure",
        "at": "2026-09-01 00:48:00+08:00",
        "evidence": "Package smoke first stopped before assertions because the new task worktree lacked a local pnpm-store, then because the integration-root seed lacked the TypeScript 5.9.3 offline content. The already validated RC02 store was copied/merged without network or deletion and the route advanced.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-01 00:51:00+08:00",
        "evidence": "The new declaration assertion expected a source equals sign although TypeScript declarations emit CLI_API_VERSION with a colon type annotation. The one-token mechanical test repair was rerun and package smoke passed; production behavior and contract were unchanged.",
        "state_id": null
      },
      {
        "validation_id": "V9",
        "attempt": 3,
        "classification": "deterministic_failure",
        "at": "2026-09-01 00:59:00+08:00",
        "evidence": "The first complete verify:offline stopped at lint because the new evidence Markdown had two trailing hard-break spaces. Removing those evidence-only spaces was mechanical; the complete route reran from the beginning and passed.",
        "state_id": null
      }
    ],
    "contract_revisions": [],
    "final_summary": "RC03 removes the retired limited ato.api/v1 command tree and explicit ato.api/v2 compatibility surface, then defines the complete existing local explicit-Manual Phase 2 product as the sole current ato.api/v1. One authoritative registry now contains exactly 33 commands, one public table contains exactly 37 errors, omitted and explicit v1 parsing are identical, and retired or unknown recognized majors fail through the fixed v1 envelope before trusted runtime selection, filesystem/database creation, authorization evaluation or Domain mutation. All nine product commands still route through LocalProductIngress and the typed product facade; finite authorization checkpoints remain 19/23/29/30; ato.execution/v1 is unchanged and independently owned. The package exposes only localProductCliImplemented=true for this CLI, while the private 0.0.0-development compatibility contract records the authorized same-name reset without a migration window. Exact material state git-sha1:faefd9f3e409f86b4421fba423f91cbca829dbc0 passed focused current-v1 E2E/security 11/11, pinned full 414/414, docs 102/252/22/0, package smoke across 112 files, SQLite and Codex boundary checks, plus fresh independent A0/A1 closure with findings=[] and no A2 required. Scheduler, MCP, Codex/Git/workspace adapters, ProjectPolicy, CompletionBackend, daemon/service, release, deployment and platform-support claims remain unimplemented; RC04 and RC05 remain separate. The single result commit is followed only by the authorized pathless current-head artifact prune, twelve exact-head gates, readiness, FF-only local integration and ordinary push, with no worktree cleanup."
  }
}
```

## Context

RC02 完成后，生产代码仍同时暴露受限 `ato.api/v1` 与完整 `ato.api/v2`。二者共享大量命令、错误映射和入口逻辑，但默认版本仍选择旧树，包根也同时导出两套版本符号与两个阶段化 CLI 状态字段。仓库版本仍是 `0.0.0-development`，没有已发布兼容承诺或依赖产品 API major 的持久恢复工件，因此 RC03 按用户授权直接删除双轨并把完整现有产品收敛为唯一 current `ato.api/v1`。

## Plan of work

1. 冻结 33 条命令、37 个错误码、19/23/29/30 授权词汇检查点以及 `ato.execution/v1` 的当前事实，并以负向测试固定退休 major 的无运行时副作用行为。
2. 在 `src/cli-api.ts` 合并命令表、错误表和解析入口，删除产品 v2 常量/类型/兼容选择，同时保留必要的语义 owner routing 与可信产品 facade。
3. 在 `src/index.ts`、契约、包 smoke 与架构/脚手架测试中收敛导出和 `localProductCliImplemented` 状态；更新 CLI 合同与 E2E 以覆盖完整 current v1。
4. 完成聚焦与全量验证、独立 A1/必要 A2、任务库存和 schema-v3 终态记录，然后执行单一结果提交后的协调器收敛流程。

## Acceptance summary

完成态只有一个 33 命令、37 错误码的 `ato.api/v1` 产品面；省略版本与显式 v1 完全等价，显式 v2/未知 major 在运行时创建前失败且无副作用。包根不再暴露产品 v2 或阶段化 CLI 状态，`ato.execution/v1` 与所有既有本地 explicit-Manual Phase 2 语义保持不变。
