# ExecPlan：以唯一 current execution contract 接入 Codex SDK backend

本计划从 EP-03C 的唯一终态开始，只交付 fresh、注入式的 Codex ExecutionBackend；默认产品与 CLI 路由留给 EP-03F。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-04 10:42:43+08:00",
    "updated_at": "2026-09-04 17:19:41+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "user request authorizing fresh-only in-repository EP-03D implementation",
        "at": "2026-09-04 10:42:43+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "user request requiring terminal commit, FF-only integration, and applicable ordinary origin/master push",
        "at": "2026-09-04 10:42:43+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "From the unique completed EP-03C terminal, deliver one fresh-only package-private, non-composed Codex SDK ExecutionBackend implementation behind the sole current execution contract, with exact workspace/cwd and Task-input binding, durable thread/turn linkage, same-thread continuation/resume, existing intent-observation-verified-receipt-finalization reconciliation, truthful cancellation/error mapping, stale-fence refusal, and no automatic Task completion on Codex turn success; the current product, public package root, dispatcher, ato.api/v1, and CLI remain Manual-only and cannot select or invoke Codex.",
    "non_goals": [
      "Do not export a Codex backend factory/configuration/driver from the supported package root or wire Codex into the current product runtime, reliable-service factory selection, dispatcher, ato.api/v1, or CLI; authorized product composition belongs to EP-03F.",
      "Do not implement SchedulerBackend, scheduled triggers, MCP, Skills, plugins, daemon/service behavior, D:\\quant dogfood, release, deployment, pull requests, or cross-platform support.",
      "Do not add workspace v3, authorization vocabulary v7, cross-worker custody, a credential broker, dispatcher backend profiles, a new reliability owner, or unrelated CLI restructuring.",
      "Do not retain ato.execution/v1 as a reader, alias, translator, fallback, dual-write path, migration path, or compatibility layer after the necessary fresh-only contract replacement.",
      "Do not use, modify, abandon, clean up, delete, reset, or derive design/evidence from the superseded coordinator task ep-03d or its worktree.",
      "Do not perform a real Codex account execution or make a Windows/Codex support claim in this plan."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The predecessor is docs/plans/completed/EP-03C-policy-gated-completion-and-safe-integration.md at its unique terminal commit 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33, which is also this plan's initial material base.",
        "source": "docs/plans/README.md plus exec_plan.py terminal-resolve evidence"
      },
      {
        "id": "C2",
        "statement": "Use the current stable Codex SDK surface first. Direct App Server integration is not an implicit fallback; if the pinned stable SDK cannot satisfy the approved result, stop with the exact missing capability and request a goal or authorization decision.",
        "source": "user request and official OpenAI Codex SDK/App Server documentation"
      },
      {
        "id": "C3",
        "statement": "The implemented ato.execution/v1 is closed and fixes workspace_mode=none plus local-manual/v1 receipts, so the Codex result may replace it only with one sole current ato.execution/v2; all retained backends implement v2 and no v1 compatibility surface survives.",
        "source": "docs/reference/adapter-contracts.md, docs/reference/versioning-compatibility-contract.md, and src/execution-port.ts"
      },
      {
        "id": "C4",
        "statement": "Reuse current claim/lease/fence, ato.workspace/v2 ownership, and the existing application/persistence/reliability owners without broadening authorization vocabulary 6: current v6 grants and supported runtime composition remain Manual-only, the Codex implementation is package-private and non-composed, and its adapter/SDK calls cannot select Domain transitions or authorization and remain outside writer transactions in internal integration tests.",
        "source": "ARCHITECTURE.md, docs/reference/authorization-contract.md, docs/reference/persistence-contract.md, and docs/reference/reliability-protocol.md"
      },
      {
        "id": "C5",
        "statement": "Codex turn success is only verified execution evidence. Task completion remains exclusively owned by the existing gate, ProjectPolicy, completion, and Domain owners.",
        "source": "docs/reference/reliability-protocol.md and docs/reference/completion-workspace-contract.md"
      },
      {
        "id": "C6",
        "statement": "Prompt/Task content, cwd/path, environment, credentials, raw SDK output/errors, and external thread identities are sensitive; only the minimum ephemeral adapter input may cross the call boundary, while durable/audit/display records retain bounded identities, digests, closed codes, and redacted references.",
        "source": "docs/security/privacy-and-logging.md and docs/security/threat-model.md"
      },
      {
        "id": "C7",
        "statement": "No SDK package download, dependency audit network query, secret or credential access, real Codex account call, real external Project mutation, or real platform-support evidence is authorized by the repository-edit grant.",
        "source": "user authorization boundary"
      },
      {
        "id": "C8",
        "statement": "Unknown SDK effect state, lost response without a trustworthy durable thread/turn identity, or unavailable stable cancellation/inspection must remain explicit ambiguous, waiting, refused, or not-run evidence and must never authorize blind replay.",
        "source": "user request and docs/reference/reliability-protocol.md"
      },
      {
        "id": "C9",
        "statement": "EP-03D creates no current authority to name a Codex destination, credential reference, or Project-filesystem effect: the supported package root must not expose the Codex constructor, and no production product/application factory may receive it. Any operational Codex composition requires a later explicitly approved authorization result rather than reinterpretation of existing vocabulary-v6 grants.",
        "source": "docs/reference/authorization-contract.md, src/authorization.ts, src/application-policy.ts, docs/security/privacy-and-logging.md, and fresh independent A0 attempt 1"
      }
    ],
    "authorization": {
      "allowed": [
        "Modify only the declared repository paths in the fresh ep-03d-restart worktree and use disposable local fixtures that do not contact a real Codex account or external Project.",
        "Use already-installed local tools and cached dependencies for read-only capability checks and offline validation.",
        "Move this same plan through proposal, active, and completed after its independent audits; create the task result commit; invoke the pathless manifest-bound artifact prune; record exact-head gates; perform FF-only local integration; and use the repository standing grant for ordinary origin/master push.",
        "Use official OpenAI documentation at learn.chatgpt.com, developers.openai.com, or platform.openai.com for the user-requested SDK/App Server contract verification without performing account-backed execution."
      ],
      "requires_reapproval": [
        "Any network download or installation of @openai/codex-sdk, any registry metadata lookup, and the network-backed pnpm dependency:audit command.",
        "Any real Codex account/authentication/credential use, SDK turn execution, or external Windows/Codex compatibility observation.",
        "Any direct App Server implementation or switch away from the SDK-first result.",
        "Any change outside the declared task paths or any new owner, port, schema, authorization vocabulary, public command, external Project, scheduler, MCP, release, or deployment scope."
      ],
      "prohibited": [
        "Read or disclose secrets/credentials, call a real Codex account, mutate D:\\quant or another external Project, or register/remove a real Windows scheduled task.",
        "Modify or clean up the superseded ep-03d coordinator task, branch, worktree, plan, or evidence.",
        "Create a v1 compatibility shim, dual execution-contract major, hidden fallback, credential broker, supported package-root Codex export, current-runtime Codex composition, public CLI route, PR, release, deployment, force/reset/rebase/stash operation, or coordinator cleanup."
      ],
      "persistence": {
        "required": true,
        "action": "Persist one terminal task-result commit containing the completed plan and task-owned implementation, then use the repository Git-flow contract for exact-head gates, FF-only local integration, and the standing-authorized ordinary origin/master push.",
        "source": "user request, AGENTS.md, docs/plans/README.md, and docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {
          "path": "AGENTS.md",
          "kind": "file"
        },
        {
          "path": "ARCHITECTURE.md",
          "kind": "file"
        },
        {
          "path": "CHANGELOG.md",
          "kind": "file"
        },
        {
          "path": "README.md",
          "kind": "file"
        },
        {
          "path": "package.json",
          "kind": "file"
        },
        {
          "path": "pnpm-lock.yaml",
          "kind": "file"
        },
        {
          "path": "migrations/0001-current-baseline.sql",
          "kind": "file"
        },
        {
          "path": "src/execution-port.ts",
          "kind": "file"
        },
        {
          "path": "src/execution-loop.ts",
          "kind": "file"
        },
        {
          "path": "src/execution-application.ts",
          "kind": "file"
        },
        {
          "path": "src/manual-execution-backend.ts",
          "kind": "file"
        },
        {
          "path": "src/codex-execution-backend.ts",
          "kind": "file"
        },
        {
          "path": "src/codex-sdk-worker.ts",
          "kind": "file"
        },
        {
          "path": "src/dispatcher-application.ts",
          "kind": "file"
        },
        {
          "path": "src/dispatcher.ts",
          "kind": "file"
        },
        {
          "path": "src/product-runtime.ts",
          "kind": "file"
        },
        {
          "path": "src/index.ts",
          "kind": "file"
        },
        {
          "path": "src/node-builtins.d.ts",
          "kind": "file"
        },
        {
          "path": "src/persistence",
          "kind": "directory"
        },
        {
          "path": "scripts/codex-contract-lib.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/codex-contract.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/dependency-security.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/lint.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/package-smoke.mjs",
          "kind": "file"
        },
        {
          "path": "scripts/repo-utils.mjs",
          "kind": "file"
        },
        {
          "path": "test",
          "kind": "directory"
        },
        {
          "path": "docs/README.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/adapter-contracts.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/authorization-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/completion-workspace-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/contract-ownership.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/persistence-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/reliability-protocol.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/toolchain-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/validation-policy.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/versioning-compatibility-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/reference/observability-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/security/threat-model.md",
          "kind": "file"
        },
        {
          "path": "docs/security/privacy-and-logging.md",
          "kind": "file"
        },
        {
          "path": "docs/feasibility/codex-stable-public-contract.md",
          "kind": "file"
        },
        {
          "path": "docs/feasibility/codex-stable-public-contract.json",
          "kind": "file"
        },
        {
          "path": "docs/compatibility/v0.1.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/proposals/EP-03D-codex-execution-backend.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/proposal/EP-03D-codex-execution-backend.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/active/EP-03D-codex-execution-backend.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/completed/EP-03D-codex-execution-backend.md",
          "kind": "file"
        },
        {
          "path": "docs/plans/evidence/EP-03D-restart",
          "kind": "directory"
        }
      ],
      "external_paths": [],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "The unique predecessor/base and official SDK direction are recorded, an authorized exact stable SDK version is pinned, and local type/runtime probes either prove the minimum SDK surface or stop without App Server substitution.",
        "validation_ids": [
          "V1",
          "V2"
        ]
      },
      {
        "id": "M2",
        "outcome": "One sole current ato.execution/v2 port and fresh schema baseline bind ephemeral input plus exact ato.workspace/v2 execution context while all retained Manual behavior uses v2 with no v1 reader or shim.",
        "validation_ids": [
          "V3",
          "V4",
          "V5"
        ]
      },
      {
        "id": "M3",
        "outcome": "The package-private injected Codex SDK backend implements new-thread execution, same-thread continuation/resume, durable local observation, truthful cancellation/error mapping, and exact configured cwd checks without any supported package-root or product/application/CLI composition route.",
        "validation_ids": [
          "V6",
          "V7",
          "V8"
        ]
      },
      {
        "id": "M4",
        "outcome": "Existing application/persistence/reliable-loop owners close fence, response-loss, crash/restart, redaction, and no-auto-completion mechanics under internal injected-driver tests, while current authorization and supported runtime composition remain explicitly Manual-only and cannot invoke the Codex implementation.",
        "validation_ids": [
          "V9",
          "V10"
        ]
      },
      {
        "id": "M5",
        "outcome": "Package, source/build/installed surface, current contracts, capability truth, and all impact-selected/full repository gates agree on the implemented library boundary and explicit not-run support evidence.",
        "validation_ids": [
          "V11",
          "V12",
          "V13"
        ]
      },
      {
        "id": "M6",
        "outcome": "Fresh independent implementation audit and any required closure review accept the stable exact-state candidate, and every pre-terminal validation needed to establish completion readiness is closed before the separate authorized terminal persistence lifecycle begins.",
        "validation_ids": [
          "V14"
        ]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "automated",
        "target": "Predecessor and material-base identity",
        "criterion": "terminal-resolve uniquely returns 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33 for EP-03C, current task base equals that commit, and chain-check accepts the final predecessor/successor pair."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "Pinned stable SDK capability preflight",
        "criterion": "After separate download authorization, one exact stable @openai/codex-sdk version is lockfile-pinned and a local no-account inspection/probe of its shipped public declarations and implementation proves server-side local thread start, same-thread continuation, resume-by-thread-ID, an exact working-directory option, when a readable durable new-thread identity becomes available relative to the first effect, and the exact non-model-text signal that binds terminal success/failure to the awaited turn; otherwise no adapter effect implementation proceeds and no App Server fallback is selected."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Sole current execution contract",
        "criterion": "Contract and hostile-shape tests accept exactly ato.execution/v2 with the approved input/workspace/thread/receipt/error semantics, reject v1 and cross-class fields, and package/source/docs contain no v1 reader, alias, translator, fallback, or dual negotiation."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Fresh persistence and retained Manual convergence",
        "criterion": "Fresh schema-1 migration, combined decode/digest/backup/restart tests store and verify the v2 execution tuple and backend evidence once; Manual remains only as the current explicit offline/operator-controlled v2 backend and all noncurrent baseline identities refuse before mutation."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Exact workspace/cwd and ephemeral input binding",
        "criterion": "Disposable tests prove the Codex request binds the exact current ato.workspace/v2 Project/Task/execution/fence/workspace/generation/revision/ownership/HEAD tuple and configured cwd identity, verifies Task-input bytes against the durable input digest, and refuses stale, dirty, substituted, alias/reparse, wrong-HEAD, wrong-generation, or mismatched-input state before SDK invocation."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Codex new-thread and same-thread behavior",
        "criterion": "Pinned-package capability evidence plus the shared adapter suite and internal injected SDK-driver tests prove one start records the exact SDK-supported thread identity at its proven timing and durably binds one local turn to the SDK's non-model-text terminal evidence, continuation uses that exact thread, restart resumes only by that persisted thread ID, and any changed thread is a conflict rather than replacement."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Observation, cancellation, and error truthfulness",
        "criterion": "Tests cover every mapped stable SDK outcome/error, cancellation request and terminal inspection path; unavailable or unproved cancellation/inspection is rejected or ambiguous, and timeouts/disconnects never become transient retry or success without authoritative no-effect evidence."
      },
      {
        "id": "V8",
        "type": "automated",
        "target": "Codex adapter packaging boundary",
        "criterion": "Source/build/packed-installed checks prove the Codex implementation and production SDK driver are package-private: the supported package root exports no Codex factory, configuration, driver, or selection token; no current product/application/dispatcher/CLI factory can construct or receive it; imports, construction, and tests invoke no account/network; and App Server, scheduler, MCP, and public routing remain absent."
      },
      {
        "id": "V9",
        "type": "automated",
        "target": "Authorization, transaction, fence, and crash recovery",
        "criterion": "Current authorization tests prove vocabulary-v6 grants and every supported product/package route remain Manual-only and cannot select the package-private Codex implementation; internal reliable-loop tests plus new failpoints prove intent precedes injected driver access, every adapter call is outside writer transactions, stage authorization and exact CAS/fence are rechecked, stale workers cannot write, every crash boundary restarts from durable evidence, and unprovable response loss becomes waiting/ambiguity without blind replay."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "Completion separation and security/redaction",
        "criterion": "A verified Codex turn success leaves the Task non-completed until existing policy/gate/completion owners accept it, while sentinel prompt/path/environment/credential/raw-output/error values are absent from audit/events/default results/package evidence and malformed or injection-bearing content cannot create authority."
      },
      {
        "id": "V11",
        "type": "automated",
        "target": "Impact-selected regression suite",
        "criterion": "All focused execution-port, Manual/Codex adapter, reliable-loop, dispatcher, persistence, workspace-binding, authorization, concurrency, crash/restart, security, product-facade, package-boundary, and Codex-contract tests pass with zero fail/skip/todo and no surviving task artifact."
      },
      {
        "id": "V12",
        "type": "automated",
        "target": "Full toolchain, dependency, and package parity",
        "criterion": "At the exact candidate material state, every constituent gate of pnpm verify:offline exits zero: lint, strict typecheck, build, the complete Node suite, docs:check, dependency:check, package:smoke, spike:sqlite, and spike:codex. Only while the manifest-frozen pre-existing .task-artifacts baseline makes the success-only test wrapper refuse observation before its authorized post-result prune, the complete Node suite may instead use the explicit lexical-sorted test/*.test.mjs inventory with node --test --test-concurrency=1; the wrapper refusal and any rejected diagnostic-fixture attempts must remain recorded. The separately authorized pnpm dependency:audit also exits zero, with exact pinned dependency inventory and source/build/packed-installed parity. The post-result-prune unmodified pnpm verify:offline run remains a separate exact-head Git-flow coordinator gate required before ready, integration, and push; it is not a pre-terminal ExecPlan V12 prerequisite or completion claim."
      },
      {
        "id": "V13",
        "type": "manual",
        "target": "Documentation and support truthfulness",
        "criterion": "docs:check, git diff --check, and manual authority/capability review find one owner per rule, no old-plan adoption or historical rewrite, no product/CLI/scheduler/MCP/App Server/platform overclaim, and real Codex Windows/account E2E remains explicitly not_run with supportClaim=false. The authoritative exact staged-inventory check remains a separate post-readiness, pre-result-commit persistence gate required before the terminal commit; it is not a pre-terminal ExecPlan V13 prerequisite or completion claim."
      },
      {
        "id": "V14",
        "type": "manual",
        "target": "ExecPlan audit and terminal persistence",
        "criterion": "Fresh independent A1 has no unresolved finding, every confirmed in-scope HIGH/MEDIUM repair has fresh closure-safe A2, all other validations are terminal for the same exact material state, and exec_plan.py trace reports no error, warning, outside-scope path, overlap, pre-existing-dirty mismatch, or blocker other than the still-pending V14/M6/final-summary lifecycle fields that this validation closes before terminal persistence."
      }
    ],
    "risks": [
      {
        "id": "R1",
        "risk": "The stable SDK is absent from the local install/store, and its exact current package version/type surface is unknown without a separately authorized registry download."
      },
      {
        "id": "R2",
        "risk": "Official overview documentation proves start/continue/resume but does not itself establish the exact TypeScript cwd, cancellation, inspection, or thread-ID timing surface required by the adapter."
      },
      {
        "id": "R3",
        "risk": "Replacing closed execution/v1 with v2 affects current Manual, dispatcher, persistence, package, and default product internals even though Codex product routing remains excluded."
      },
      {
        "id": "R4",
        "risk": "SDK response loss or process death may leave an external thread/turn whose identity or terminal state cannot be authoritatively recovered."
      },
      {
        "id": "R5",
        "risk": "Task/prompt bytes, cwd/path, SDK thread IDs, account state, environment, and raw SDK errors can leak through durable evidence or diagnostics."
      },
      {
        "id": "R6",
        "risk": "A dependency/package-boundary change can make offline installs, package smoke, or current zero-side-effect imports nondeterministic."
      },
      {
        "id": "R7",
        "risk": "Exporting or composing the new Codex implementation would silently turn Manual-only authorization vocabulary 6 into authority for a destination, credentials, network, and Project-filesystem effects that it does not name."
      }
    ]
  },
  "execution_contract": {
    "decisions": [
      {
        "id": "D1",
        "statement": "Treat EP-03C commit 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33 as the only predecessor and material base; never inspect the superseded EP-03D proposal as a design source.",
        "rationale": "The user explicitly replaced the old task, and terminal-resolve found exactly one completed EP-03C terminal."
      },
      {
        "id": "D2",
        "statement": "Replace ato.execution/v1 with sole current ato.execution/v2 and migrate every retained execution backend/consumer directly; do not coexist, translate, or backfill v1.",
        "rationale": "Current v1 is closed, hard-codes workspace_mode=none and local-manual/v1 receipts, and cannot truthfully express Codex cwd/input/endpoint identity."
      },
      {
        "id": "D3",
        "statement": "Add only a discriminated v2 execution context: retained Manual requests use workspaceMode=none, while Codex requests require workspaceMode=owned with the exact current ato.workspace/v2 Project/Task/execution/workspace/generation/revision/root/ownership/HEAD/cwd-binding tuple; both use a durable Task-input digest/reference, Codex alone receives verified ephemeral bounded input bytes on the effect call, and no prompt or raw path enters core evidence.",
        "rationale": "Manual must not fabricate Phase-3 workspace evidence, while Codex reliability requires the actually consumed owned workspace in semantic identity and privacy permits minimum content only at the selected adapter boundary."
      },
      {
        "id": "D4",
        "statement": "Implement Codex through a package-private injected SDK-driver boundary whose production implementation uses the pinned @openai/codex-sdk and whose tests use an unexported deterministic fake; neither the backend nor its factory/configuration/driver is exported or accepted by a current production factory. SDK waiting occurs outside SQLite writer transactions in the internal composition harness and does not create a second application or authorization owner.",
        "rationale": "The official TypeScript SDK is asynchronous and must be tested without account calls, but vocabulary-v6 grants currently authorize only Manual; hiding all supported construction/composition routes preserves that boundary until EP-03F."
      },
      {
        "id": "D5",
        "statement": "Generalize the existing core intent/observation/verification/finalization records and one bounded backend journal only enough for internal Codex integration tests to link the SDK's proven thread identity/timing and non-model-text turn-terminal evidence. A lost response without authoritative linkage finalizes only to ambiguity/waiting; no new exactly-once subsystem is introduced and no current production authorization route is added.",
        "rationale": "The current reliability owner already defines the required protocol and explicitly permits honest ambiguity when the external system cannot prove state."
      },
      {
        "id": "D6",
        "statement": "Map SDK cancellation only to the stable public capability actually present in the pinned package; otherwise return a closed refused or ambiguous result and require inspection, never infer cancellation from a request or process exit.",
        "rationale": "Cancellation evidence must remain truthful and cannot be invented to satisfy an ideal contract."
      },
      {
        "id": "D7",
        "statement": "Retain Manual only as the explicit offline/operator-controlled current backend and move it to v2; it remains the default closed Phase 2 product until EP-03F and is not a v1 compatibility layer or Codex fallback.",
        "rationale": "Removing the current product before EP-03F would conflate adapter delivery with product closure, while keeping v1 would create forbidden debt."
      },
      {
        "id": "D8",
        "statement": "Record official documentation and pinned-package capability evidence separately from real account/platform evidence; keep externalE2E=not_run and supportClaim=false unless the user later grants a real observation.",
        "rationale": "Documentation, types, fakes, and disposable fixtures cannot establish a supported account/platform combination."
      },
      {
        "id": "D9",
        "statement": "Do not modify authorization vocabulary 6 or reinterpret its execution grants for Codex. Prove the Codex implementation is unreachable through the supported package root and all current production factories; EP-03F must obtain an explicit result that binds destination, credential reference, and workspace effect before any operational composition.",
        "rationale": "Current authorization and privacy owners expressly limit execution effects to the local no-workspace Manual surface and require named authority before credentialed external effects."
      }
    ],
    "milestone_recovery": [
      {
        "id": "M1",
        "recovery": "If dependency authorization is absent or the stable SDK lacks a required public surface, leave the plan proposal/active with the exact missing capability and do not install, switch protocols, or edit implementation claims."
      },
      {
        "id": "M2",
        "recovery": "Keep the fresh baseline and sole-contract replacement uncommitted until focused port/persistence/Manual tests pass; a failed seam is repaired in place without a v1 fallback or historical migration."
      },
      {
        "id": "M3",
        "recovery": "A driver/SDK failure before durable authoritative linkage is recorded as no-effect when proven or ambiguity otherwise; retain journal/core evidence and never replay the turn blindly."
      },
      {
        "id": "M4",
        "recovery": "Each internal injected failpoint restarts from the last committed owner boundary; stale-fence or identity drift stops further adapter/finalization work and preserves observed state. Any discovered supported Codex construction/composition route is removed rather than treated as authorized."
      },
      {
        "id": "M5",
        "recovery": "A failed gate leaves the reserved task editable; fix the task-owned source, commit a new candidate head, rerun affected evidence, and never describe blocked real-account evidence as passed."
      },
      {
        "id": "M6",
        "recovery": "Any A1 HIGH/MEDIUM finding is repaired and independently re-reviewed with A2 before completion; if the approval boundary changes, return to a fresh A0 instead of extending the contract silently."
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
      },
      {
        "id": "V5",
        "state_binding": "material"
      },
      {
        "id": "V6",
        "state_binding": "material"
      },
      {
        "id": "V7",
        "state_binding": "material"
      },
      {
        "id": "V8",
        "state_binding": "material"
      },
      {
        "id": "V9",
        "state_binding": "material"
      },
      {
        "id": "V10",
        "state_binding": "material"
      },
      {
        "id": "V11",
        "state_binding": "material"
      },
      {
        "id": "V12",
        "state_binding": "material"
      },
      {
        "id": "V13",
        "state_binding": "material"
      },
      {
        "id": "V14",
        "state_binding": "material"
      }
    ],
    "risk_controls": [
      {
        "id": "R1",
        "mitigation": "Finish proposal/A0 first, then request one explicit narrowly scoped package download/audit authorization; pin the resolved stable version exactly and never use latest at runtime.",
        "recovery": "Without authorization or a resolvable stable package, stop before activation/effect code and report the unmet binary gate."
      },
      {
        "id": "R2",
        "mitigation": "Inspect the pinned package's public declarations and shipped implementation and run a no-account local constructor/type probe before choosing fields or claiming capability; freeze the exact readable thread-identity timing and the awaited non-model-text terminal signal.",
        "recovery": "If cwd, durable thread identity/timing, turn-terminal, cancel, or inspect evidence is missing, narrow the approved result or request explicit App Server adoption; do not infer private behavior or substitute model text."
      },
      {
        "id": "R3",
        "mitigation": "Use one direct fresh-only v2 replacement, update Manual and all current consumers in the same stable diff, and enforce v1 absence in tests/docs/package checks.",
        "recovery": "If a current consumer cannot move without an adjacent public product redesign, keep the plan active and revise scope through fresh A0 rather than adding a shim."
      },
      {
        "id": "R4",
        "mitigation": "Persist core intent and bounded backend journal stages before/around the SDK call, independently inspect durable local evidence, and classify unknown external state as ambiguous/waiting.",
        "recovery": "Require new authoritative evidence or an explicitly authorized user decision; never replay the old effect based on lease expiry."
      },
      {
        "id": "R5",
        "mitigation": "Keep prompt/cwd/raw SDK data ephemeral, store only digests/closed codes/opaque references, and run sentinel plus hostile-shape redaction tests across persistence, errors, events, and package evidence.",
        "recovery": "Fail closed and omit the unclassifiable payload; no raw fallback logging or diagnostic bundle is produced."
      },
      {
        "id": "R6",
        "mitigation": "Pin one exact production dependency, preserve ignore-scripts and registry policy, update exact package/source inventories, and validate offline install/package consumption after the authorized acquisition.",
        "recovery": "A missing offline tarball or audit permission is an environment/authorization failure, not a reason to repair dependencies silently or claim the gate passed."
      },
      {
        "id": "R7",
        "mitigation": "Keep every Codex-specific constructor, configuration, driver, and selector out of src/index.ts and every current production factory; add source/build/packed-package negative assertions and authorization documentation that current v6 execution remains Manual-only.",
        "recovery": "If a supported route can construct, receive, or select Codex, remove that route and rerun package/architecture/authorization gates; an operational route requires a new explicitly approved authorization result and fresh A0."
      }
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33",
      "current_material_base": "9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33",
      "base_transitions": []
    },
    "milestone_progress": [
      {
        "id": "M1",
        "status": "complete",
        "updated_at": "2026-09-04 17:18:10+08:00"
      },
      {
        "id": "M2",
        "status": "complete",
        "updated_at": "2026-09-04 17:18:10+08:00"
      },
      {
        "id": "M3",
        "status": "complete",
        "updated_at": "2026-09-04 17:18:10+08:00"
      },
      {
        "id": "M4",
        "status": "complete",
        "updated_at": "2026-09-04 17:18:10+08:00"
      },
      {
        "id": "M5",
        "status": "complete",
        "updated_at": "2026-09-04 17:18:10+08:00"
      },
      {
        "id": "M6",
        "status": "complete",
        "updated_at": "2026-09-04 17:19:41+08:00"
      }
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "exec_plan.py terminal-resolve for EP-03C, successor chain-check, and current trace",
        "evidence": "terminal-resolve returned the unique EP-03C terminal commit 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33 with no rejection; chain-check accepted that same commit as EP-03D's material base. Current active trace reports approval/current base and HEAD/evaluated revision all equal to that commit, with empty baseline diff, outside-scope, overlap, and pre-existing-dirty inventories.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "authorized exact-package metadata acquisition, shipped declaration/implementation inspection, and no-account local constructor probe",
        "evidence": "The repository and lockfile pin @openai/codex-sdk 0.153.2 with exact runtime dependency @openai/codex 0.153.2. Shipped public declarations and implementation prove startThread, resumeThread(id), workingDirectory, streamed thread.started identity, turn.completed/turn.failed terminal signals, and AbortSignal forwarding. The no-account probe constructed Codex, observed newThread.id=null and resumedThread.id=preflight-thread-id, and spawned no process. The SDK exposes no inspect or external turn ID, so the implementation retains the approved ambiguity and single-local-turn bounds; App Server was not substituted and no account/support claim was made.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "execution-port, hostile-shape, architecture, source inventory, build, and package-boundary tests",
        "evidence": "The exact ato.execution/v2 grammar passed for Manual manual-local/none and Codex codex-sdk/owned workspace tuples, bounded ephemeral input, thread lineage, receipts, cancellation, and closed errors. Tests and source/package scans reject v1, cross-family fields, aliases, translators, dual negotiation, and retained local-manual/v1 identities; build and installed consumers agree with source.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "fresh schema, migration identity, combined decoder/digest, backup/restart, Manual regression, and corruption tests",
        "evidence": "Fresh schema-version-1 stores the v2 intent tuple and Codex turn/operation evidence once, with canonical migration SHA-256 E17C6ACFF0891C3B8FD6F1DADBF3616DDFCF4391F7F5D7427FE0F2F8CCFFED0D. Combined read, digest, backup, restart, immutable-trigger, cross-family ownership, and receipt-reconstruction tests passed. Retained Manual behavior uses only the v2 Manual backend; noncurrent baseline and corrupt identity cases refuse before mutation.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Codex workspace verifier, workspace Git adapter inspection, and input/fence binding regressions",
        "evidence": "Disposable tests bind Project/Task/execution/attempt/fence plus exact ato.workspace/v2 workspace, generation, revision, rootKey, ownership binding, repository identity, registration inventory, target/admin physical identity, and HEAD. They verify input bytes against the durable task-sha256 reference and reject dirty, substituted, alias/reparse, wrong-root, wrong-HEAD, wrong-generation, wrong-revision, and mismatched-input state before driver invocation. Final workspace closure selection passed 5/5.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "pinned SDK worker event tests, shared backend suite, injected-driver start/resume tests, and durable restart tests",
        "evidence": "One new-thread start accepts only the first streamed thread.started identity and durably records it before later events; success and failure bind only turn.completed/turn.failed. Continuation uses the exact predecessor thread and resumeThread identity, restart reopens the persisted thread/turn tuple, and any changed or missing thread is conflict or ambiguity rather than replacement. No model text or invented external turn identifier establishes terminal truth.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Codex worker/backend outcome matrix plus reliable-loop inspect, cancellation, terminal no-effect, and response-loss tests",
        "evidence": "Mapped SDK process/stream/turn failures, disconnects, timeouts, aborts, unavailable inspection, cancellation requests, terminal inspection, and durable succeeded/failed no-effect cancellation all passed. Fresh observations and verified receipts are required; failed inspection cannot be presented as fresh success, proven terminal truth is preserved, and unproved effect state becomes waiting/ambiguity without transient retry or blind replay. The final A2 closure selection passed 8/8 including both terminal cancellation lifecycles.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "source/build/packed-installed export and construction reachability checks",
        "evidence": "The supported package root exports no Codex factory, driver, configuration, or selection token. Current product, application, dispatcher, CLI, and ordinary reliable-service factories remain Manual-only and cannot construct or receive the package-private injected Codex service. Source/build/package scans retain no App Server, scheduler, MCP, public Codex route, account call, or network invocation; the 228-file package smoke passed consumer type/export/persistence/source-built-installed parity and uninstall checks.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "authorization/product non-reachability, SQLite reliable-loop failpoint, fencing, restart, and corruption tests",
        "evidence": "Vocabulary 6 and every supported product/package route remain Manual-only. Internal Codex tests persist intent before injected driver access, keep every adapter call outside writer transactions, recheck authorization/current tuple/CAS/fence/workspace at each stage, reject stale workers and cross-family ownership, reopen all durable boundaries, and classify unprovable response loss as waiting/ambiguity. SQL guards immutably protect backend/workspace identity and the combined decoder recomputes canonical terminal receipt evidence.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "completion-separation, security, hostile-input, redaction, persistence, and package-evidence tests",
        "evidence": "Verified Codex turn success leaves Task completion to the existing ProjectPolicy/gate/completion/Domain owners and creates no automatic completion path. Sentinel prompt, path, environment, credential, raw SDK output/error, SQL, and stack-shaped values remain absent from durable audit/event/default result/package evidence; malformed, accessor, proxy, oversized, injection-bearing, substituted, and stale inputs fail without creating authority.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "complete explicit serial Node inventory plus focused independent closure and workspace selections",
        "evidence": "The lexical-sorted inventory of all 57 direct test/*.test.mjs files ran with node --test --test-concurrency=1 and passed 599/599 with fail=0, cancelled=0, skipped=0, and todo=0. This includes the execution port, Manual/Codex adapters, reliable loop, dispatcher, persistence, workspace, authorization, concurrency, crash/restart, security, product, package, and Codex contract routes. Independent final closure selections additionally passed 8/8 and 5/5. Passing runs left no new, removed, or replaced survivor relative to their input artifact baseline; the separately recorded frozen diagnostic baseline remains for post-result coordinator prune and is not claimed absent.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V12",
        "status": "passed",
        "method": "exact-state offline constituents, explicit serial complete suite, package/install parity probes, and authorized production dependency audit",
        "evidence": "At the exact candidate state, lint passed 297 files/57 source files; strict typecheck and build exited zero; the permitted complete serial suite passed 599/599; docs passed 152 Markdown files/263 links/22 fragments/zero forbidden; dependency shape pinned @openai/codex-sdk 0.153.2 and TypeScript 5.9.3; package smoke passed 228 files and all consumer parity/uninstall checks; SQLite 3.53.3/schema 1 passed with zero surviving generation members; and the Codex probe passed with externalE2E=not_run/supportClaim=false. The separately authorized pnpm dependency:audit exited zero with no known vulnerabilities. The unmodified umbrella attempt's wrapper refusal and rejected diagnostic clones remain recorded as non-passing attempt evidence; unmodified pnpm verify:offline is reserved for the separate post-prune exact-head Git-flow gate and is not claimed here.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V13",
        "status": "passed",
        "method": "docs:check, git diff --check, active trace, manual authority/capability review, and feasibility evidence inspection",
        "evidence": "The final pre-terminal docs:check rerun passed 152/263/22/0 and git diff --check exited zero with only informational line-ending warnings. Trace reports the exact task-owned material inventory with empty outside-scope, overlap, and pre-existing-dirty results. Manual review finds one authoritative owner per changed rule, no adopted superseded plan or rewritten history, and no product/CLI/scheduler/MCP/App Server/platform overclaim. Real Windows/account Codex E2E remains externalE2E=not_run and supportClaim=false. The authoritative staged inventory remains deliberately unclaimed until the separate post-readiness, pre-result-commit persistence gate.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      },
      {
        "id": "V14",
        "status": "passed",
        "method": "fresh current A0, independent A1/A2 closure review, exact-state validation convergence, and final active exec_plan.py trace",
        "evidence": "Fresh A0 attempt 6 independently approved the exact 20882-byte contract at SHA-256 2E5308EE86A502180B9D11557EA7C3439BD95AC73AAB8D9530E70E42DFE7DF59 with findings=[]. A1's six confirmed HIGH/MEDIUM findings were repaired and closed by fresh closure-safe A2 attempt 2 with findings=[] at this exact state; F-A1-EP03D-002 is explicitly unconfirmed/not_applicable because successor allocation belongs to the excluded EP-03F composition boundary. V1-V13 are passed at the same material state. The final active trace exited zero with no error or warning, empty outside-scope/overlap/pre-existing-dirty results, current A0/A1/A2 records, and only the expected generic blockers for the still-pending V14, M6, and final summary that this terminal plan edit closes before staging and the result commit.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "/root/ep03d_a0_3, fresh A0 attempt 6",
        "independence": "Fresh independent, strictly read-only, non-fail-fast A0. The reviewer did not draft, revise, implement, repair, or make parent disposition for EP-03D. Earlier A0 conclusions were not reused: attempt 6 restarted from the current trace, current approval bytes, complete current proposal, and authoritative sources. The superseded ep-03d worktree was never accessed. No file, Git/index, coordinator, dependency, network, credential, account, external-Project, authorization, or other external-state mutation was performed.",
        "scope": "Complete current EP-03D proposal and approval/execution contracts; AGENTS.md, ARCHITECTURE.md, repository documentation and plan lifecycle guidance; harness-exec-plan SKILL.md, PLAN-SCHEMA.md, and A0-AUDIT.md; current trace and canonical approval serialization; goal, non-goals, C1-C9, authorization/persistence/scope, M1-M6, V1-V14, R1-R7, D1-D9, recovery and state bindings; package-private Codex/vocabulary-6 boundary, pinned SDK hard gate, execution-v2 workspace discrimination, persistence/reliability/security/support boundaries; V11 artifact semantics; V12 and V13 lifecycle separation; V14/A0 convergence behavior; and the sole attempt-5-to-attempt-6 approval delta.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-04 17:15:16+08:00",
        "approval_sha256": "2E5308EE86A502180B9D11557EA7C3439BD95AC73AAB8D9530E70E42DFE7DF59",
        "reviewed_material_base": "9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33",
        "evidence": "Fresh trace exited zero with approval_contract_bytes=20882, approval/current material base and HEAD/evaluated revision all 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33, material state git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc, and empty errors, outside_scope, overlap, and pre_existing_dirty. Independent canonical JSON reproduction matched SHA-256 2E5308EE86A502180B9D11557EA7C3439BD95AC73AAB8D9530E70E42DFE7DF59 and proved V13 was the sole delta from attempt 5. Full review found a linear lifecycle: current A0; activation and exact-material V1-V13 plus A1/A2; V14/M6/final summary; completion readiness; completed-plan staging and authoritative inventory; result commit; authorized prune; exact-head gates; ready; FF integration; ordinary push. V11 means no new survivor relative to the frozen baseline, while root absence remains post-result prune; V12 and V13 correctly separate their pre-terminal evidence from post-result coordinator/persistence gates. The historical A0-convergence warning is suppressed after current ready parent-complete A0. Package-private Codex, Manual-only vocabulary 6, pinned SDK hard gate, sole execution v2, no real account E2E, supportClaim=false, and all external/non-goal exclusions remain exact. Attempts 1-6 converged through source-backed corrections without scope or authority growth.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "/root/ep03d_a0, A1 attempt 1",
        "independence": "Fresh independent read-only implementation reviewer who did not implement or repair EP-03D, did not reuse an A0 conclusion as the A1 conclusion, did not access the superseded ep-03d task/worktree, and made no file, Git/index, coordinator, artifact, dependency, cache, network, credential, real-account, external-Project, or authorization mutation.",
        "scope": "Complete active EP-03D plan and authoritative contracts; exact 53 tracked modified plus 12 untracked task-path material inventory; ato.execution/v2 and Manual convergence; package-private Codex boundary; vocabulary 6; workspace/cwd/HEAD/input/fence, thread/resume/predecessor, intent/effect/inspection/reconciliation/cancellation, SDK grammar, fresh decoder/digest/backup/migration, package/dependency, and support-claim boundaries.",
        "reviewed_at": "2026-09-04 14:32:47+08:00",
        "evidence": "Trace exited zero with ok=true, approval bytes 19964 and SHA-256 F97C483DA2434F96F242254EB3EBBE27DF53E11B9DBE6E77B1885F62B3E884A0, approval/current material base and HEAD 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33, exact reviewed state git-sha1:1ece0a6e4ccca28d9cc29fe6bea77a5031533f1e, and empty errors/warnings/outside_scope/overlap/pre_existing_dirty. The reviewer read the full diff and applicable repository/skill authorities. Supplied evidence showed serial tests 593/593 plus lint, typecheck, build, docs, dependency check, package smoke, SQLite/Codex probes, and diff check passing, with externalE2E=not_run and supportClaim=false. Both authorized dependency-audit attempts ended in registry timeout code 23/exit 1 and were not treated as passed. Full report: docs/plans/evidence/EP-03D-restart/a1-attempt-1.md.",
        "reviewed_state_id": "git-sha1:1ece0a6e4ccca28d9cc29fe6bea77a5031533f1e",
        "parent_disposition": "complete",
        "closes": [],
        "findings": [
          {
            "id": "F-A1-EP03D-001",
            "severity": "HIGH",
            "summary": "One execution could acquire both Manual and Codex durable turn ownership.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Reject either-family ownership from both start paths, reject cross-family overlap in the combined decoder, and prepare the Codex fixture through proven Manual no-effect reconciliation rather than a prior Manual backend effect.",
            "closure_evidence": "Parent repair is present: both start directions now return IDEMPOTENCY_CONFLICT before adapter access, the decoder returns CORRUPT_ROW for a valid shadow cross-family turn, and the focused serial Codex loop regression passed. Fresh independent A2 attempt 2 re-read the exact current state and closed this finding with no residual.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03D-002",
            "severity": "HIGH",
            "summary": "The injected Codex reliable service does not allocate resume/retry successor executions.",
            "confirmed": false,
            "in_scope": false,
            "changes_task_diff": false,
            "disposition": "not_applicable",
            "resolution": "The approved EP-03D D4/M3/V6 boundary requires backend-level same-thread continuation and explicitly leaves allocation of a new fenced execution plus ready successor workspace to EP-03F product composition; adding that allocator here would broaden the approved execution and authorization scope.",
            "closure_evidence": null,
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03D-003",
            "severity": "HIGH",
            "summary": "Codex workspace verification did not prove the complete ownership manifest and authoritative physical identity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Delegate physical proof to the sole windows-git-local workspace inspection owner, bind configured Project rootKey to ProjectRegistry, compare the durable ready receipt repository identity around inspection, and add manifest/registration corruption tests.",
            "closure_evidence": "Parent repair now consumes the authoritative workspace inspection result rather than duplicating a subset of Git checks. Exact manifest-field and unlocked-registration regressions plus the focused workspace suite passed. Fresh independent A2 attempt 2 re-read the exact current state and closed this finding with no residual.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03D-004",
            "severity": "MEDIUM",
            "summary": "Historical Codex inspection was rejected by the origin mutation tuple and could be presented as stale success.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Validate immutable turn identity separately from the current inspect semantic tuple and require fresh observation, receipt, and finalization evidence or an explicit ambiguous failure.",
            "closure_evidence": "Parent repair permits current-authorized historical inspection without weakening mutation guards. Failed-turn inspection now proves one new full evidence chain, while injected verifier refusal finalizes ambiguity with no reused observation/receipt; focused tests passed. Fresh independent A2 attempt 2 re-read the exact current state and closed this finding with no residual.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03D-005",
            "severity": "MEDIUM",
            "summary": "Cancellation of a proven terminal Codex turn degraded known truth into ambiguity.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Return the existing already_terminal no-effect receipt for durable succeeded/failed turns, leave the turn unchanged, and recognize that verified no-effect in the reliable reflection rule.",
            "closure_evidence": "Parent repair leaves terminal turn revision and Task state unchanged and records a fresh cancellation observation/receipt/finalization without a Codex terminal-operation row. After A2 attempt 1 exposed the failed-terminal revision-advance residual, the repair permits historical lower-bound matching only for exact succeeded/failed terminal no-effect cancellation and keeps every nonterminal mutation exact. Fresh independent A2 attempt 2 closed the original finding and residual at the exact current state.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03D-006",
            "severity": "MEDIUM",
            "summary": "The intent transition trigger omitted immutable backend and workspace identity columns.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Add backend_kind and the complete workspace tuple to the existing transition guard using null-safe comparison for nullable fields, update the sole baseline checksum, and exercise legal-transition-plus-substitution statements.",
            "closure_evidence": "Parent repair protects the discriminant and all workspace fields; live-schema structural assertions and runtime substitutions for backend, ID, generation, revision, root, ownership digest, and HEAD all passed while the control transition remained legal. Fresh independent A2 attempt 2 independently reproduced the migration checksum and closed this finding with no residual.",
            "closure_state_id": null
          },
          {
            "id": "F-A1-EP03D-007",
            "severity": "MEDIUM",
            "summary": "The combined decoder did not reconstruct the canonical Codex terminal receipt digest.",
            "confirmed": true,
            "in_scope": true,
            "changes_task_diff": true,
            "disposition": "a2_required",
            "resolution": "Centralize the canonical terminal start/resume receipt projection and recompute its SHA-256 from the durable Act request, intent, turn, operation, and stored receipt ID during combined decode.",
            "closure_evidence": "Parent repair shares one canonical projection between backend and decoder and direct-read corruption regressions independently substitute receipt ID and digest, each producing CORRUPT_ROW. Focused tests and strict typecheck passed. Fresh independent A2 attempt 2 re-read the reconstruction path and closed this finding with no residual.",
            "closure_state_id": null
          }
        ]
      },
      "a2": {
        "report_status": "complete",
        "reviewer": "/root/ep03d_a0_2, A2 attempt 2",
        "independence": "Fresh, independent, strictly read-only post-repair A2. The reviewer performed attempt 1 but did not implement or repair EP-03D; attempt 2 independently re-read the exact current plan, A1 dispositions, implementation, contracts, and tests instead of reusing the prior conclusion. No file, Git/index, coordinator-state, dependency, network, credential, external-Project, or superseded ep-03d access or mutation occurred.",
        "scope": "All parent-confirmed A1 a2_required findings F-A1-EP03D-001, -003, -004, -005, -006, and -007, plus direct closure of attempt-1 residual F-A2-EP03D-001. Review covered cross-family ownership, delegated physical workspace/rootKey/repository identity proof, historical inspection truthfulness, succeeded/failed terminal cancellation after revision advance, exact-match nonterminal mutation, SQL tuple immutability, canonical terminal-receipt reconstruction, and focused regressions. F-A1-EP03D-002 remained not_applicable/out of scope and is not in closes.",
        "reviewed_at": "2026-09-04 15:51:26+08:00",
        "evidence": "Fresh trace exited zero with ok=true at exact state git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc, approval bytes 19964 and SHA-256 F97C483DA2434F96F242254EB3EBBE27DF53E11B9DBE6E77B1885F62B3E884A0, base/HEAD 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33, and empty errors, warnings, outside_scope, overlap, and pre_existing_dirty. The reviewer independently confirmed both-family start refusal and decoder exclusion; authoritative windows-git-local workspace inspection with Project rootKey and durable repository identity; fresh historical inspection evidence; succeeded/failed terminal cancellation as durable no-effect after revision advance while nonterminal mutations remain exact; null-safe SQL guards for backend/workspace fields with migration SHA-256 E17C6ACFF0891C3B8FD6F1DADBF3616DDFCF4391F7F5D7427FE0F2F8CCFFED0D; and shared canonical terminal receipt reconstruction. Focused closure tests passed 8/8, workspace verifier tests passed 5/5, and typecheck, Codex contract probe, dependency shape, and diff check exited zero. externalE2E remained not_run and supportClaim=false; no long full suite was run by the reviewer.",
        "reviewed_state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc",
        "parent_disposition": "complete",
        "closes": [
          "F-A1-EP03D-001",
          "F-A1-EP03D-003",
          "F-A1-EP03D-004",
          "F-A1-EP03D-005",
          "F-A1-EP03D-006",
          "F-A1-EP03D-007"
        ],
        "findings": []
      }
    },
    "audit_attempts": [
      {
        "audit": "A0",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03D-001",
          "F-A0-EP03D-002",
          "F-A0-EP03D-003"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at approval SHA-256 12E8440C8DF91AC09759EF1361CE0C59E16537F284B3615F2FA98DD9FC0F08C6 and reviewed base 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33 found three approval-level gaps. The parent confirmed all three: current vocabulary-v6 authority is Manual-only and cannot authorize operational Codex composition; the pinned-package gate omitted durable new-thread identity timing and non-model-text turn-terminal evidence; and V14/M6 circularly required completion readiness plus the terminal commit before their own closure. Revision 1 narrows Codex to a package-private non-composed implementation, strengthens the SDK hard gate, and moves terminal persistence after pre-terminal completion readiness. The full report is preserved in docs/plans/evidence/EP-03D-restart/a0-attempt-1.md; a different fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at 2026-09-04 11:10:02+08:00 bound approval digest FCB976AA3A6083438555B55C9A70CD2131BF2D8B6852B104B965C9BE473009B2 and reviewed base 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33. It independently reproduced 19885 canonical bytes, confirmed attempt-1's three roots are closed without new authority or adjacent scope, found no new finding, and declared the proposal ready_for_activation. The first active trace then exposed W_PREFLIGHT_LIFECYCLE_SCOPE because the helper-required singular docs/plans/proposal lifecycle ownership sentinel was absent. The parent returned the plan to proposal, added only that non-created, non-authorizing sentinel, and requires fresh A0 over the new approval bytes. The full attempt-2 report is preserved in docs/plans/evidence/EP-03D-restart/a0-attempt-2.md."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": [],
        "disposition": "stale",
        "reason": "Fresh independent read-only A0 at 2026-09-04 11:24:58+08:00 bound approval digest F97C483DA2434F96F242254EB3EBBE27DF53E11B9DBE6E77B1885F62B3E884A0 and reviewed base 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33. It independently reproduced 19964 canonical bytes, proved the only revision-2 approval delta is the 79-byte absent/non-authorizing lifecycle sentinel, rechecked the full contract without reusing prior conclusions, found no finding, and declared ready_for_activation. It became stale only when V12 was narrowly revised after the manifest-frozen pre-existing artifact tree made the success-only wrapper refuse pre-result observation; the revision preserves every constituent exact-state gate, requires the already-passing explicit serial complete suite, records the refusals, and adds a mandatory post-prune unmodified umbrella gate. The full attempt-3 report is preserved in docs/plans/evidence/EP-03D-restart/a0-attempt-3.md."
      },
      {
        "audit": "A0",
        "attempt": 4,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03D-004"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at 2026-09-04 16:53:24+08:00 bound approval digest 961969AE1CC7CF1AEC3AADA64090FAE8DCCD1A45C33078D57BFBD8BF6CA3B6E3 and reviewed base 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33. It independently reproduced 20541 canonical bytes, confirmed V12 remained binary, complete, evidence-honest, and non-authorizing, and found one MEDIUM contract gap: V12 made the post-result-prune unmodified umbrella gate a pre-terminal prerequisite even though prune is authorized only after the terminal result commit. The parent confirmed the sequencing cycle and revised only V12 to keep exact-material constituent validation pre-terminal while returning the post-prune umbrella run to the separate Git-flow exact-head gate lifecycle. A fresh independent A0 is required."
      },
      {
        "audit": "A0",
        "attempt": 5,
        "report_status": "complete",
        "finding_ids": [
          "F-A0-EP03D-005"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A0 at 2026-09-04 17:03:50+08:00 bound approval digest D5E4ED3AB34836BCB142C7A47B968B696E328A6DF89FE2C218E920C386B6212F and reviewed base 9790dc3d21eea7c2c0257ababc1d70fd1bcd6c33. It independently reproduced 20680 canonical bytes, confirmed F-A0-EP03D-004 is closed and the historical convergence warning becomes nonblocking once a current ready A0 is parent-complete, but found one MEDIUM sequencing gap: V13 required the authoritative staged inventory before completion readiness although repository policy permits staging only after readiness and rejects an unstaged inventory as a substitute. The parent confirmed the cycle and revised only V13 to keep documentation/diff/authority validation pre-terminal while returning exact staged inventory to the separate post-readiness, pre-result-commit persistence lifecycle. A fresh independent A0 is required."
      },
      {
        "audit": "A2",
        "attempt": 1,
        "report_status": "complete",
        "finding_ids": [
          "F-A2-EP03D-001"
        ],
        "disposition": "superseded",
        "reason": "Fresh independent read-only A2 attempt 1 at 2026-09-04 15:37:55+08:00 bound exact state git-sha1:106c00065d1734b839b69bd3152996bcee8c5e44. It closed F-A1-EP03D-001, -003, -004, -006, and -007, but found one local residual under F-A1-EP03D-005: failed terminal cancellation still conflicted after finalization advanced Task/execution revisions. The parent kept the approved owner and strategy, restricted historical lower-bound matching to exact succeeded/failed terminal no-effect cancellation, retained exact matching for nonterminal mutations, added the failed-terminal regression, and required a fresh same-A2 rerun."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V12",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-04 16:45:36+08:00",
        "evidence": "The original worktree's unmodified pnpm verify:offline passed lint, typecheck, and build, then its success-only test wrapper refused before spawning tests because the manifest-frozen pre-existing .task-artifacts baseline contains a package-install reparse node. Manual deletion is prohibited and coordinator prune is authorized only after the result commit. Two disposable exact-state local-clone diagnostics reproduced git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc with empty trace findings but were rejected as current evidence after native default discovery produced shared-fixture/subprocess failures absent from the original worktree's explicit serial 599/599 run. No diagnostic result was treated as a product failure or passed gate; every owned external fixture was identity-checked and removed.",
        "state_id": "git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-04 11:00:23+08:00",
        "summary": "After fresh independent A0 attempt 1, narrowed EP-03D to a package-private non-composed Codex implementation that does not broaden Manual-only authorization vocabulary 6, added exact pinned-SDK thread-identity timing and non-model-text terminal-evidence gates, distinguished Manual none from Codex owned workspace context, and removed circular terminal-commit/completion-ready prerequisites from V14/M6.",
        "previous_approval_sha256": "12E8440C8DF91AC09759EF1361CE0C59E16537F284B3615F2FA98DD9FC0F08C6"
      },
      {
        "at": "2026-09-04 11:16:09+08:00",
        "summary": "After the first active trace, added only the helper-required singular docs/plans/proposal lifecycle ownership sentinel alongside the actual proposals/active/completed paths; the sentinel is not created, grants no new authority, and changes no implementation or external scope.",
        "previous_approval_sha256": "FCB976AA3A6083438555B55C9A70CD2131BF2D8B6852B104B965C9BE473009B2"
      },
      {
        "at": "2026-09-04 16:45:36+08:00",
        "summary": "Narrowed V12 to preserve the exact complete offline gate set while allowing the already-passing explicit serial test inventory only when the manifest-frozen pre-existing .task-artifacts baseline makes the success-only wrapper refuse before the authorized post-result prune; every refusal remains recorded and the unmodified umbrella command becomes a mandatory post-prune exact-head coordinator gate. No implementation, material state, scope, authorization, product behavior, support claim, or other validation changed.",
        "previous_approval_sha256": "F97C483DA2434F96F242254EB3EBBE27DF53E11B9DBE6E77B1885F62B3E884A0"
      },
      {
        "at": "2026-09-04 16:54:41+08:00",
        "summary": "After fresh A0 attempt 4 identified a persistence/prune ordering cycle, kept V12 as the pre-terminal exact-material constituent validation and returned the mandatory post-result-prune unmodified pnpm verify:offline run to the separate Git-flow exact-head gate lifecycle before ready, integration, and push. No implementation, material state, scope, authority, support claim, or other validation changed.",
        "previous_approval_sha256": "961969AE1CC7CF1AEC3AADA64090FAE8DCCD1A45C33078D57BFBD8BF6CA3B6E3"
      },
      {
        "at": "2026-09-04 17:04:32+08:00",
        "summary": "After fresh A0 attempt 5 identified a completion-readiness/staging ordering cycle, kept V13's documentation, diff, authority, capability, and support-truth review pre-terminal and returned the authoritative exact staged-inventory check to the separate post-readiness, pre-result-commit persistence lifecycle before the terminal commit. No implementation, material state, scope, authority, support claim, or other validation changed.",
        "previous_approval_sha256": "D5E4ED3AB34836BCB142C7A47B968B696E328A6DF89FE2C218E920C386B6212F"
      }
    ],
    "final_summary": "EP-03D completes only the approved fresh library boundary: one sole current ato.execution/v2 contract converges retained Manual behavior and a package-private, non-composed Codex SDK backend on exact ato.workspace/v2 ownership, durable local thread/turn linkage, streamed non-model terminal evidence, same-thread backend continuation, truthful inspect/cancellation/error outcomes, intent-before-effect recovery, stale-fence refusal, redaction, and strict separation from Task completion. The supported package root, current product, dispatcher, ato.api/v1, CLI, and vocabulary-6 authorization remain Manual-only and cannot construct or select Codex; successor execution/workspace allocation remains for EP-03F. Exact material state git-sha1:8ebbacbfbfca0dab0105e4608b6c7f107d79bfcc passes 599/599 complete serial tests, focused independent closure 8/8 plus workspace 5/5, lint 297/57, strict typecheck/build, docs 152/263/22/0, exact dependency shape, 228-file package smoke, SQLite 3.53.3/schema 1 with zero generation survivors, the truthful Codex probe, git diff hygiene, and the separately authorized production dependency audit. The unmodified pre-prune umbrella refusal remains truthful non-passing attempt evidence; its exact-head rerun follows only after the result commit and standing-authorized coordinator prune. Fresh A0 approved the final contract, and fresh A2 closes every confirmed A1 repair with no current finding; the one unconfirmed A1 successor-allocation proposal remains out of scope. Real Codex account/Windows E2E remains externalE2E=not_run with supportClaim=false, and no App Server, public Codex route, scheduler, MCP, external Project, PR, release, deployment, or cleanup is claimed or performed. The authoritative staged inventory, terminal result commit, pathless artifact prune, exact-head gates, Git-flow readiness, FF-only local integration, and ordinary origin/master push remain the separately ordered coordinator consumers of this completed plan."
  }
}
```

## Context

Official OpenAI documentation checked on 2026-09-04 states that the Codex SDK is for automation/CI and can start, continue, and resume local threads, while App Server is for deep clients needing authentication, history, approvals, and streamed events. The current host has `codex-cli 0.153.0`, but neither `@openai/codex-sdk` nor Python `openai_codex` is installed or present in the repository pnpm store. The official overview does not expose the exact TypeScript cwd, cancellation, inspection, or thread-ID timing details, so the pinned package preflight is a hard gate rather than an inferred guarantee.

The source baseline has one synchronous `ato.execution/v1` whose semantic identity requires `workspaceMode: "none"`, whose receipt endpoint is fixed to `local-manual/v1`, and whose reliable observation is bound directly to the Manual journal. Those source facts make a Codex adapter dishonest without the one direct current-contract replacement described above. They do not justify workspace v3, authorization v7, a second reliability protocol, or a product/CLI route.
