# ExecPlan: repair Codex terminal integrity and current contract drift

This plan implements the two findings confirmed by the 2026-09-08 full inspection. A complete valid SDK stream must precede publication of its terminal journal result.

```execplan
{
  "schema_version": 4,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-08 09:42:45+08:00",
    "updated_at": "2026-09-08 10:47:32+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "User: 走execplan执行修复 (repair inspection F1 and F2)",
        "at": "2026-09-08 09:42:45+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "User repair instruction plus AGENTS.md coordinator result-commit, FF integration and standing ordinary-push lifecycle",
        "at": "2026-09-08 09:42:45+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Repair the inspected Codex false-terminal-success defect for new executions and align current contracts with the implemented Codex product boundary, with cross-layer regression and full offline evidence.",
    "non_goals": [
      "No schema migration/reset or retroactive rewriting of indistinguishable historical terminal rows.",
      "No new SDK/network/credential access, dependency update, public operation, scheduler adapter, Phase 3 CLI wiring or support claim.",
      "No PR, release, deployment, force Git operation or coordinator worktree cleanup."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "Only a complete, valid single-terminal SDK driver run may produce a new durable Codex terminal operation and be consumed as turn success; stream conflict or failure before this publication remains ambiguous across inspect and restart.",
        "source": "docs/reference/reliability-protocol.md: Authorized Codex product and turn protocol; confirmed inspection F1"
      },
      {
        "id": "C2",
        "statement": "Preserve intent-before-effect, pre-SDK backend-turn journal, T1/T6 authorization, fences, no blind replay, bounded redaction, and separate Task completion ownership.",
        "source": "AGENTS.md; docs/reference/authorization-contract.md; docs/security/privacy-and-logging.md"
      },
      {
        "id": "C3",
        "statement": "Keep schema version 1, application digest version 4, authorization vocabulary 8, current port/API versions, package exports, pinned dependencies and Manual/scheduler/Phase 3 product boundaries unchanged.",
        "source": "AGENTS.md; docs/reference/toolchain-contract.md; docs/reference/versioning-compatibility-contract.md"
      },
      {
        "id": "C4",
        "statement": "Resolve current documentation conflicts using current user authorization plus AGENTS/ARCHITECTURE and verified code: explain both existing input-reference variants, Codex-specific Windows workspace construction, and the existing node:path import; do not rewrite historical evidence.",
        "source": "User: 走execplan执行修复; AGENTS.md authority order; confirmed inspection F2"
      },
      {
        "id": "C5",
        "statement": "Implementation belongs only in the coordinator-owned task worktree; preserve all pre-existing and other-task content.",
        "source": "AGENTS.md; docs/reference/local-agent-git-flow.md"
      },
      {
        "id": "C6",
        "statement": "Shorten only persistence and Windows Git test fixture prefixes inside the existing creator-owned .task-artifacts root so the task-worktree test environment fits current bounded root keys and physical path limits. Do not relax production identifiers, schema, canonical paths, artifact ownership or cleanup requirements.",
        "source": "Observed fixture-only environment failures: SQLite CHECK length(project_root_key) BETWEEN 1 AND 128 and Windows Git unsafe_tree_path at the existing 240-character limit; validation-policy.md requires candidate gates in the governed task worktree."
      }
    ],
    "authorization": {
      "allowed": [
        "Implement and test the two confirmed inspection findings in the owned worktree; prepare dependencies only from existing local cache.",
        "Persist the reviewed result commit and completed plan; perform coordinator frozen-root prune, exact-head gates, FF-only integration and standing-authorized ordinary origin/master push."
      ],
      "requires_reapproval": [
        "Any schema/API/grant/credential/network destination change, historical data repair, new behavior beyond these findings or modification to another repository."
      ],
      "prohibited": [
        "No real account/credential/SDK network run, online dependency audit, PR, release/deployment, force/reset/clean, or coordinator cleanup."
      ],
      "persistence": {
        "required": true,
        "action": "reviewed local result commit with completed plan, then repository-governed FF integration and ordinary origin/master push",
        "source": "User repair authorization; AGENTS.md and docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {
          "path": "src/codex-execution-backend.ts",
          "kind": "file"
        },
        {
          "path": "test/codex-execution-backend.test.mjs",
          "kind": "file"
        },
        {
          "path": "test/codex-execution-loop.test.mjs",
          "kind": "file"
        },
        {
          "path": "test/codex-product-application.test.mjs",
          "kind": "file"
        },
        {
          "path": "test/persistence-test-helpers.mjs",
          "kind": "file"
        },
        {
          "path": "test/fixtures/workspace-git-fixture.mjs",
          "kind": "file"
        },
        {
          "path": "AGENTS.md",
          "kind": "file"
        },
        {
          "path": "ARCHITECTURE.md",
          "kind": "file"
        },
        {
          "path": "README.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/adapter-contracts.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/reliability-protocol.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/persistence-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/contract-ownership.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/toolchain-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/security/privacy-and-logging.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/proposal/repair-codex-terminal-integrity.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/active/repair-codex-terminal-integrity.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/completed/repair-codex-terminal-integrity.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/evidence/repair-codex-terminal-integrity/validation-evidence.md",
          "kind": "file"
        }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "Regression demonstrates that incomplete/conflicting terminal streams cannot become durable success.",
        "validation_ids": [
          "V1"
        ]
      },
      {
        "id": "M2",
        "outcome": "One backend terminal publication boundary closes F1 without schema changes and retains valid recovery.",
        "validation_ids": [
          "V1",
          "V3"
        ]
      },
      {
        "id": "M3",
        "outcome": "Current contracts accurately reflect the repaired terminal protocol and already implemented Codex composition.",
        "validation_ids": [
          "V2",
          "V3"
        ]
      },
      {
        "id": "M4",
        "outcome": "Task material, review closure and validation evidence satisfy repository completion readiness.",
        "validation_ids": [
          "V3",
          "V4"
        ]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "Codex terminal publication and recovery",
        "criterion": "Regression matrix passes for withheld stream completion, contradictory/duplicate terminal, changed thread or late stream failure after a terminal, valid success/failure, safe restart without SDK replay, and legitimate post-terminal-publication response loss; SQLite and product composition are included."
      },
      {
        "id": "V2",
        "type": "manual",
        "target": "Current contract agreement",
        "criterion": "Current documentation in scope correctly states stream-completion-before-terminal-publication, both existing input reference semantics, Codex-only concrete workspace construction, and actual Node imports; no historical rewrites, new runtime/support claims, or conflicting copies remain in the changed scope."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Complete existing offline package and behavioral boundary",
        "criterion": "pnpm verify:offline exits 0, including all tests, lint, strict types/build, documentation, dependency shape, package smoke and SQLite/Codex/scheduler probes; external E2E and support claims remain not_run/false."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Scope and evidence integrity",
        "criterion": "ExecPlan trace has no schema/scope errors; git diff --check and staged diff check pass; only declared paths are staged; validation scratch is absent or inventoried as task-owned retained diagnostics under the frozen artifact manifest, with coordinator prune still required after the result commit and before Git readiness."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "Publishing before stream validation can leave a false durable terminal; withholding until completion enlarges the pre-publication ambiguity window."
      },
      {
        "id": "R2",
        "risk": "Moving terminal publication can accidentally remove legitimate committed-terminal recovery, continuation semantics or authorization revalidation."
      },
      {
        "id": "R3",
        "risk": "Documentation synchronization can overstate general product wiring or turn an identity commitment into a content-digest claim."
      },
      {
        "id": "R4",
        "risk": "Long task-worktree paths plus diagnostic fixture prefixes exceed existing root-key or physical-path limits before tests reach the behavior under review."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Buffer only the bounded terminal signal/code/evidence commitment in CodexExecutionBackend; invoke its existing atomic journal.recordTerminal only after await driver.run resolves successfully with exactly one terminal. Keep thread activation durable during streaming.",
        "rationale": "The backend is the current journal consumer. Deferring its publication closes driver rejection/late-failure cases without a second store, new schema or changing the reliable-loop recovery algorithm."
      },
      {
        "id": "D2",
        "statement": "Treat persistence review as Tier 2 for terminal consumption and restart, scoped to the driver/backend/journal/reliable-loop chain.",
        "rationale": "No schema change is needed, but publication timing changes whether durable success can be consumed after a crash."
      },
      {
        "id": "D3",
        "statement": "Extend existing backend, real-SQLite reliable-loop and product tests; preserve existing valid terminal and failpoint recovery evidence.",
        "rationale": "Standalone driver rejection tests missed the callback-to-journal interaction."
      },
      {
        "id": "D4",
        "statement": "Use fresh independent A0 before activation and A1 after stable diff/primary gates, plus required A2 only when triggered. Reserve integration for final review; commit completed plan after completion-ready, explicitly prune then gate/ready/integrate/push.",
        "rationale": "ExecPlan and Git-flow lifecycle contracts require these independent boundaries; no cleanup grant exists."
      },
      {
        "id": "D5",
        "statement": "Shorten the common persistence-test and Windows Git fixture generation prefixes to at most 12 characters; retain existing random suffixes, generation creator/cleanup receipts, descriptive labels used for semantic evidence and the fixed artifact root. Preserve failed-run diagnostics for the standing-authorized post-commit coordinator prune.",
        "rationale": "The original checkout passes but longer governed worktree roots fail before Codex or workspace behavior. This is test-environment preparation, not a production path-limit or artifact-policy change."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "Keep failing regression evidence and own fixture cleanup; do not mutate integration checkout."
      },
      {
        "id": "M2",
        "recovery": "Before terminal publication, an active/unknown journal remains ambiguous; after atomic terminal publication use the unchanged authoritative inspect/replay path. Preserve old historical rows."
      },
      {
        "id": "M3",
        "recovery": "Resolve scope/contract conflict before mutation; restore only task-owned draft text if a correction overstates current behavior."
      },
      {
        "id": "M4",
        "recovery": "Failed validation or review keeps the task active/reserved. Commit failure retains/restores active plan; integration/push ambiguity uses coordinator trace/recovery without reset or force."
      }
    ],
    "validation_bindings": [
      {
        "id": "V1",
        "state_binding": "material"
      },
      {
        "id": "V2",
        "state_binding": "material"
      },
      {
        "id": "V3",
        "state_binding": "material"
      },
      {
        "id": "V4",
        "state_binding": "material"
      }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Prove no terminal row/operation while stream remains open or rejects, including valid-terminal-then-conflict sequences and restart.",
        "recovery": "No persisted terminal means unknown/ambiguous; never replay the effect automatically."
      },
      {
        "id": "R2",
        "mitigation": "Retain journal transaction authorization/fence checks and unchanged stored-terminal replay; test valid failed/completed runs, continuation and response loss after terminal commit.",
        "recovery": "Inspect committed terminal only; refuse stale authority or incomplete lineage."
      },
      {
        "id": "R3",
        "mitigation": "Cross-check changed prose against port parser, product start/continuation input owner, workspace factory and lint built-in allowlist.",
        "recovery": "Keep unsupported routes explicitly absent and historical evidence untouched."
      },
      {
        "id": "R4",
        "mitigation": "Keep fixture creation and cleanup owners unchanged; run the complete unmodified offline entry point from the task worktree and retain all root/fence/path negative suites.",
        "recovery": "Keep environment failures distinct from behavioral failures; do not waive the production limit or remove retained diagnostics outside the frozen-root prune lifecycle."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "6a4dfa041e24520af54c0b822f0a1e84364c27e3",
      "current_material_base": "6a4dfa041e24520af54c0b822f0a1e84364c27e3",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-09-08 10:34:31+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-09-08 10:34:31+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-09-08 10:34:31+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-09-08 10:43:52+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "pnpm test test/codex-execution-backend.test.mjs test/codex-execution-loop.test.mjs test/codex-product-application.test.mjs; then the same cases within pnpm verify:offline on the final candidate.",
        "evidence": "Observed 2026-09-08 10:34:31+08:00: target command exit 0, 68/68 passed, zero skip; complete final candidate also passes all 741 tests. Ten added regressions cover withheld successful/failed resume completion, duplicate callbacks, six pinned-driver invalid tails with SQLite close/reopen, and product conflict/restart without additional SDK or credential resolution. Existing valid terminal, continuation, every durable failpoint, redaction and completion separation remain passing. See validation-evidence.md and repair-targeted-final.log / repair-verify-offline.log.",
        "state_id": "git-sha1:e0f6ca3badc740bef8961690633c0e3746817bc7"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Manual authority/capability review of AGENTS.md, ARCHITECTURE.md, README.md, adapter-contracts, reliability-protocol, persistence-contract, contract-ownership, toolchain-contract and privacy-and-logging; full-route docs:check.",
        "evidence": "Observed 2026-09-08 10:34:31+08:00: both exact input-reference variants and identity-vs-content semantics match execution-port and codex-product-digest plus backend current-body/lineage verification. Shared Windows workspace construction matches the Codex product factory; node:path matches the actual import and lint allowlist. New terminal publication ordering has one protocol owner; no old-only reference or blanket unwired claim remains in changed current scope. No historical evidence, production schema, port/export or support boundary changed. Docs gate exit 0: 172 Markdown files, 271 local links, 26 fragments, zero forbidden artifacts.",
        "state_id": "git-sha1:e0f6ca3badc740bef8961690633c0e3746817bc7"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "pnpm verify:offline from the owned task worktree, with locally cached pinned dependencies and unmodified package entry point.",
        "evidence": "Observed 2026-09-08 10:34:31+08:00: exit 0. Lint 332 files/63 source files; strict types and build passed; Node tests 741 passed, 0 failed/cancelled/skipped/todo (256135 ms); documentation and dependency shape passed; packed consumer 252 files and source/built/installed CLI parity passed; Windows x64 Node24.19.0 SQLite3.53.3 feasibility passed. Codex probe package_validated/productComposition=true with administratorPolicyAttestation=not_run, externalE2E=not_run, supportClaim=false; scheduler adapterImplemented=false, externalE2E=not_run, supportClaim=false. Online dependency audit, real account E2E, effective-config attestation and hosted CI/support validation were not run and support no claim. Full output: calling-thread full-inspection/repair-verify-offline.log.",
        "state_id": "git-sha1:e0f6ca3badc740bef8961690633c0e3746817bc7"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Current ExecPlan trace; git diff --check; git diff --cached --check; candidate and index path set comparison with declared task_paths; read-only retained-artifact inventory.",
        "evidence": "Observed 2026-09-08 10:47:32+08:00: completed plan archived as the unique lifecycle file; all 17 intended files are actually staged, with exact inventory matching the declared task scope, no unstaged file change, and both git diff --check and git diff --cached --check exit 0. Current schema/scope trace is clean and material remains bound to the reviewed state. Retained task-owned .task-artifacts contains 52 top-level fixtures/1407 entries, recorded in repair-retained-artifact-inventory.json; the full and targeted test runners report identical baseline/terminal 1407 entries. Post-result-commit coordinator prune and exact-head absence receipt remain required before Git gates/readiness; no cleanup is inferred.",
        "state_id": "git-sha1:e0f6ca3badc740bef8961690633c0e3746817bc7"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/a0_workspace_fixture",
        "independence": "Fresh independent reviewer；未参与本计划起草、实质方案决策或实现。仅只读检查计划、源码、契约、Git 状态和既有日志；未编辑文件、运行测试、修改 Git、调用 SDK、访问凭据或网络。",
        "scope": "当前唯一 schema 4 proposal 的全部 approval_contract、execution_contract 和恢复状态，覆盖 C1-C6、M1-M4、V1-V4、R1-R4；重点审查新增 test/fixtures/workspace-git-fixture.mjs 范围，并按 Tier 2 核对 Codex driver/backend/journal/reliable-loop/product 的终态发布、消费及重启边界。",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-08 10:24:20+08:00",
        "approval_sha256": "4B85BEC4FFCEA0D9911D5FCE5849F484542A24BED4EFF327D6230D0DF23FE763",
        "reviewed_material_base": "6a4dfa041e24520af54c0b822f0a1e84364c27e3",
        "evidence": "独立解析唯一 execplan JSON 并检查重复 key，按 UTF-8、sorted keys、compact separators、无换行复算 approval_contract：7846 bytes，SHA256 与 current repair-plan-trace.json 及父 Agent 提供值一致；审查结束复算仍一致。git rev-parse HEAD、git cat-file -t 和当前分支确认 reviewed base 为该 commit，工作位于 task/repair-codex-terminal-integrity；approval/current material base 相同，无 base transition。提供的 current ExecPlan trace 无 schema/scope errors、warnings、outside_scope 或 pre-existing overlap。\n已阅读 harness-exec-plan SKILL、PLAN-SCHEMA、A0-AUDIT、PERSISTENCE-AUDIT，以及 AGENTS、ARCHITECTURE、docs 索引、计划生命周期、validation-policy、local-agent-git-flow 和相关 reliability、persistence、authorization、adapter、toolchain、versioning、privacy 契约。当前 goal/non-goals、授权、scope、二元标准与 recovery 一致；不存在依靠 reviewer 建议扩展 owner、协议、schema 或产品能力的要求。\nTier 2 适用，因为 F1 改变 durable terminal publication 与 restart consumption。src/codex-sdk-worker.ts 的 run 在完整迭代及末尾终态检查通过后才 resolve；src/codex-execution-backend.ts:535 起仅暂存 bounded signal/code/evidenceReference，保留 thread activation，await driver.run 成功后才调用既有 recordTerminal。src/persistence/codex-backend-repository.ts:454 起保持唯一 semantic writer、当前 Act/grant、Task/execution/workspace tuple、revision/fence 检查，并在同一事务更新 turn 和插入 immutable operation。inspect/markUnproved 及 src/execution-loop.ts 的 authoritativeCodexObservationMatches、effectReflected、backendEffectAbsent、processCodexIntent 继续区分未发布终态的 ambiguity/no-blind-replay 与已提交终态的 inspection/recovery。没有新增 schema、平行 journal、validator 或 Task completion owner；历史终态不回写的限制明确。\nF2 的两种现存 input reference 可由 src/execution-port.ts:379、src/persistence/codex-product-digest.ts:63 起及 backend 当前 Task body/lineage 检查证明；Codex product workspace construction 位于 src/codex-product-application.ts:743，node:path 导入及 scripts/repo-utils.mjs:169 的 allowlist 也有直接源码依据。计划将当前描述同步到这些实现，不增加 Manual、scheduler、Phase 3 CLI、外部 E2E 或平台支持能力。\n新增共享 Git fixture 尚未修改：审查结束 git diff -- test/fixtures/workspace-git-fixture.mjs 为空。该文件第 90 行当前把完整 label 交给 createOwnedGeneration，第 109 行另以完整 label 和 baseObjectId 构造 ownershipBindingSha256。只将生成前缀改为 label.slice(0,12)，不改变完整 label 的语义用途。scripts/repo-utils.mjs:567-663 的固定 .task-artifacts 根、mkdtemp 随机后缀、立即 identity binding 和 creator receipt，以及第 713 行起 removeOwnedGeneration 的 ownership/inventory 回收保持原样；fixture 的 Project Space café、Workspace Space café、内容和 cleanup 调用均保持不变。\n独立静态计算当前任务工作树下 12 字符前缀的路径长度：generation 105、Project root 124、workspace target 211、nested/data.bin 227、ownership manifest 240。src/workspace-git-adapter.ts:185、601-615、769-776 保有 MAX_PATH_LENGTH=240 和对应拒绝条件；D5 的 at most 12 允许在同一结果边界内进一步缩短前缀。精确长度负向测试仍由 exactLengthChildPath 构造，不因普通 fixture 前缀缩短而撤销边界覆盖。该增量解决已观察到的环境预算问题，不放宽生产 root-key、path、schema、ownership 或 cleanup 规则。\n只读日志确认：原检查测试 731/731 通过；新增十项回归的修复前证据为 0/10；repair-verify-offline-before-workspace-prefix.log 为 741 项中 696 通过、45 失败，失败集中于六个使用共享 fixture 的 Codex workspace、Windows Phase 3 和 workspace Git 文件，并有 unsafe_tree_path 直接诊断。最新 repair-targeted-final.log 为 68/68、零 skip。目标套件通过不替代 V3；完整原样 pnpm verify:offline 仍须在新增 fixture 调整后实际通过，未执行的链式后续路由不能算通过。\nV4 允许提交前记录 task-owned retained diagnostics，符合失败测试保留诊断与 schema 归档前验收要求；D4/D5 仍要求 result commit 后执行常设授权的 frozen-root prune，取得当前 head/manifest receipt 和 root absence 后才进入 gates/ready/integration/push。未授予 coordinator cleanup。附加读取的 repair-git-trace.json 属于 本次 reserve 前快照，不作为当前 reservation 证明；后续 Git 决策须使用新的 coordinator trace。完整 material-bound V1-V4、fresh independent A1 及必要 A2 仍由后续执行闭合。本次未发现 contract_gap、fact_drift 或需要增加的可选保证；结论仅为当前修订可激活，不表示实现验收或终态持久化已完成。",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/a1_terminal_repair",
        "independence": "Fresh、独立、非实现者 A1 reviewer；未参与本修复的计划设计、实现或 A0。只读审查材料，并运行不创建 fixture 的现有内存测试；未修改文件、Git 状态或保留诊断，未访问真实 SDK、凭据或网络。",
        "scope": "唯一 active ExecPlan repair-codex-terminal-integrity 的完整 approval/execution、审查与验证记录；相对 current material base 的全部 17 条 candidate，包括生产 backend、三个测试文件、两个 fixture helper、九份当前文档、validation-evidence 和计划。按 Tier 2 检查 driver→backend→SQLite journal/decoder→reliable-loop→product 的终态发布、消费、失败与重启边界，以及授权、scope、回归和文档一致性。",
        "reviewed_at": "2026-09-08 10:40:39+08:00",
        "evidence": "已读取 harness-exec-plan SKILL、PLAN-SCHEMA、IMPLEMENTATION-AUDIT、PERSISTENCE-AUDIT，当前计划和提供的完整 trace、全部 task diff/新增文件，以及相关 AGENTS、架构、文档索引、validation、local Git-flow、adapter、reliability、persistence、authorization、versioning、toolchain 和 privacy 契约。独立 fresh trace exit 0，errors/warnings/outside_scope/overlap 均为空；HEAD/current base 为 6a4dfa041e24520af54c0b822f0a1e84364c27e3，分支为 task/repair-codex-terminal-integrity，approval SHA256 为 4B85BEC4FFCEA0D9911D5FCE5849F484542A24BED4EFF327D6230D0DF23FE763，material state 与本报告一致。全部 17 条 candidate 在声明 scope 内；index 为空，git diff --check 和 git diff --cached --check 均 exit 0。\n生产修复在 src/codex-execution-backend.ts:#run 中仅暂存 terminal signal、closed code 和 evidence digest；thread.started 仍通过原 journal 持久化 active。await driver.run 完整成功之前没有 recordTerminal 调用。PinnedCodexSdkDriver.run 的完整异步迭代、事件校验及末尾终态检查有任何拒绝都会绕过 publication；重复 direct callback 也会拒绝。缺失终态或流异常返回 bounded ambiguity，原始 payload/error 不进入暂存或 durable evidence。\nTier 2 writer/reader closure 保持完整：src/persistence/codex-backend-repository.ts:recordTerminal 仍是唯一 semantic publisher，在现有 ApplicationTransaction 内校验当前 intent-bound Act/grant、Project/Task/execution/workspace revision/fence 和 active lifecycle，再共同更新 turn、插入 immutable terminal operation；事务末尾 combined readback 和原 rollback 边界未改变。application-repository-readers/state 继续检查 terminal signal/lifecycle、operation cardinality、完整 lineage 和重构 receipt digest，没有平行 schema、journal 或 validator。\nbackend inspect/markUnproved 与 execution-loop.ts:authoritativeCodexObservationMatches、effectReflected、backendEffectAbsent、processCodexIntent 明确区分无 terminal operation 的 unknown/ambiguity 与已提交终态；存在 pre-SDK turn 时不取得盲目重放权。产品 start/continuation 的 effect_possible reconciliation 和 terminal-result replay 保持原 owner；finalized product lifecycle 不等于 turn success，Task completion 仍属于原 completion owner。原 committed-terminal receipt/replay 路径未移动或删除，提交后响应丢失仍能通过独立持久化检查恢复。\n新增十项回归直接覆盖成功/失败 resume 流延迟完成、duplicate callback、六种 terminal 后无效尾部及真实 SQLite close/reopen，以及产品层矛盾终态和重启时不再次解析凭据、不再次调用 SDK。已检查原有效成功/失败、同线程 continuation、每个 durable failpoint、拒绝旧 inspection、corruption/redaction 和 completion separation 的邻接测试。独立运行 pnpm test test/codex-execution-backend.test.mjs test/codex-sdk-worker.test.mjs：exit 0，10/10 passed，0 failed/cancelled/skipped；artifactHygiene passed，baselineEntries=terminalEntries=1407，rootReclaimStatus=not_applicable。\n审查现有 repair-targeted-final.log 和 repair-verify-offline.log：目标套件 68/68，完整离线路由 741/741、零 fail/skip，并完成 lint、types/build、docs 172 files/271 links/26 fragments、dependency shape、252-file packed consumer、SQLite 和 Codex/scheduler probes；这些是父 Agent 的原始执行证据，本 reviewer 未重复整轮 gate。externalE2E 和 administratorPolicyAttestation 保持 not_run，supportClaim=false，scheduler adapterImplemented=false。\n两个 helper 仅把 generation prefix 截短到 12：固定 .task-artifacts 根、mkdtemp 随机 suffix、立即 identity binding、creator receipt、owned cleanup 均仍由 scripts/repo-utils.mjs 原 owner 执行；workspace fixture 的完整 label 仍参与 ownershipBindingSha256，显式长度负向测试和生产 root-key/path 限制未改变。保留诊断盘点为 52 个顶层 fixture、1407 entries；本次独立测试没有改变该 baseline。\nF2 文档改动与 execution-port.ts 的两种 exact reference、codexProductTaskInputReference 的 canonical operation/Task/revision commitment、backend 当前 body/lineage 检查、Codex product 的 defaultWorkspaceBackend 及实际 node:path import/allowlist 一致。没有新增 schema/API/export/授权或产品支持声明，没有修改历史证据。历史 terminal rows 不回写是批准的明确限制。最终完整 staged inventory、result commit、frozen-root prune、exact-head gates、FF integration 和 standing-authorized push 仍须由父 Agent 按回执完成；本 A1 不替代这些后续动作，也不授予 cleanup。未发现需记录的实现缺陷、恢复缺口、scope/授权越界或契约违反。",
        "reviewed_state_id": "git-sha1:e0f6ca3badc740bef8961690633c0e3746817bc7",
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
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Original F1/F2 plan passed independent A0 at digest CDF270870C64BBF5B25B99F566CDE5FFE2A1E9ED66A6A187275C366C5EA37C40. Ancillary fixture-prefix scope and pre-commit scratch accounting now require a fresh A0; prior readiness is not reused."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Persistence fixture adjustment and pre-commit diagnostic inventory passed independent revised A0 at 044BB5B81753626856855D9892E9C7F2FC2070926168AC480741C22036185085. The same path-budget failure now requires adding only the shared Windows Git fixture prefix to scope; fresh A0 will review this current contract."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V1",
        "attempt": 1,
        "classification": "deterministic_failure",
        "at": "2026-09-08 09:54:52+08:00",
        "evidence": "The ten new regression cases all failed on unchanged base production code (0 passed/10 failed, exit 1): terminal publication before full stream validation was observed directly and through real SQLite/reliable-loop/product. Preserved repair-regression-confirmed-before.log. No separate material manifest was captured for this transient red-test state.",
        "state_id": null
      },
      {
        "validation_id": "V3",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-08 10:17:12+08:00",
        "evidence": "pnpm verify:offline exited 1: lint/types/build passed; tests 741, pass 696, fail 45. Windows Git fixture creation hit existing 240-character unsafe_tree_path guards; full log repair-verify-offline-before-workspace-prefix.log. Remaining chained routes did not run.",
        "state_id": "git-sha1:95a9a468cddbae29634886ecccd36c6c53e6551c"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-08 10:05:00+08:00",
        "summary": "Add only persistence-test fixture prefix shortening needed for full verification in the governed worktree; clarify that retained failure diagnostics are inventoried before completion and pruned by the coordinator after the result commit, avoiding a self-referential pre-commit absence criterion.",
        "previous_approval_sha256": "CDF270870C64BBF5B25B99F566CDE5FFE2A1E9ED66A6A187275C366C5EA37C40"
      },
      {
        "at": "2026-09-08 10:17:12+08:00",
        "summary": "Add the shared Windows Git test fixture prefix to the same bounded environment preparation: full test route reached 741 cases, 696 passed and 45 failed in long-path fixture setup at unchanged unsafe_tree_path guards. No production path limit or Git behavior changes.",
        "previous_approval_sha256": "044BB5B81753626856855D9892E9C7F2FC2070926168AC480741C22036185085"
      }
    ],
    "final_summary": "Codex terminal publication now requires a complete valid driver stream; invalid tails remain ambiguous across SQLite and product restart. Current reference/composition/import contracts are aligned, fixture prefixes fit existing path limits, and all 741 offline tests plus independent A0/A1 pass. No historical terminal migration or external support claim is introduced."
  }
}
```

The existing regression setup composes the pinned driver, backend, SQLite journal and reliable loop. On the base commit, completed-then-failed events incorrectly finalize as turn_succeeded and replay after restart. Current contracts also lag the product input binding and concrete workspace composition. The repair preserves the established owners and public boundary.
