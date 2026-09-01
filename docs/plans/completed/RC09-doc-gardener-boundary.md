# ExecPlan：收敛文档巡检忽略边界与包边界测试命名

本计划修复 `harness-doc-gardener` 在角色冲突预检中绕过有效策略的问题，并把本仓库的 `.local`、文档说明与包边界测试命名收敛到同一当前契约。

```execplan
{
  "schema_version": 3,
  "lifecycle": {
    "status": "completed",
    "created_at": "2026-09-01 18:22:39+08:00",
    "updated_at": "2026-09-01 19:35:20+08:00",
    "authorization": {
      "implementation": {
        "authorized": true,
        "by": "Current user authorization in the current coordinator-owner conversation",
        "at": "2026-09-01 18:31:26+08:00"
      },
      "persistence": {
        "authorized": true,
        "by": "Current user authorization in the current coordinator-owner conversation covers the result commit, FF-only local integration, and ordinary origin/master push",
        "at": "2026-09-01 18:31:26+08:00"
      }
    }
  },
  "approval_contract": {
    "repository": ".",
    "goal": "Make document-role conflict validation use the same effective ignore and traversal policy as document discovery, exclude this repository's private .local tree from all ordinary full scans, truth-sync the authoritative documentation, and rename the generic scaffold test to the package-boundary test it actually owns without retaining a compatibility forwarder.",
    "non_goals": [
      "Do not enumerate, read, modify, delete, or validate the contents of .local, integration-root caches, any Codex-managed worktree outside the declared task worktree, user files, or another skill or plugin except read/execute-only use of the exact skill validator named below. Do not modify or rewrite existing historical completed/evidence documents; required repository and full-scan gates may read tracked historical Markdown only for their configured structural checks.",
      "Do not change document-role semantics for nonignored Markdown, widen ignored content into scan scope, add a scheduler/product capability, or alter product runtime behavior.",
      "Do not retain test/scaffold.test.mjs as a compatibility shim or rewrite historical evidence merely to replace the old filename.",
      "Do not perform coordinator cleanup inside RC09 or before its verified push; the separately authorized post-push cleanup phase remains outside this ExecPlan. Do not perform force operations, rebase, reset, stash, pull request creation, release, deployment, or unrelated network access."
    ],
    "constraints": [
      {
        "id": "C1",
        "statement": "The effective loaded document-gardener policy is the single policy used for ordinary traversal, ignore pruning, and document-role conflict validation; an ignored overlap is excluded while a nonignored overlap still fails closed.",
        "source": "harness-doc-gardener SKILL.md and references/policy-config.md"
      },
      {
        "id": "C2",
        "statement": "The repository adds only .local/** to ignore_globs_add and keeps .worktrees/**, node_modules/**, dist/**, and .pnpm-store/** unchanged; an explicit target remains governed by the skill's existing explicit-target semantics.",
        "source": ".doc-gardener.json and docs/reference/validation-policy.md"
      },
      {
        "id": "C3",
        "statement": "Current package-boundary coverage is renamed directly to test/package-boundary.test.mjs, package discovery continues to find it, and no live authority or configuration references the retired generic filename.",
        "source": "package.json, docs/reference/toolchain-contract.md, and current test inventory"
      },
      {
        "id": "C4",
        "statement": "External skill changes are limited to the two declared files, preserve all unrelated behavior, and are accepted only with exact pre/post hashes, focused and full skill validation, and matching hash rechecks immediately before A1 and immediately before the result commit; C:/Users/Administrator/.codex/skills/.system/skill-creator/scripts/quick_validate.py may only be read and executed as the required validator.",
        "source": "Current user authorization and skill-creator validation requirements"
      },
      {
        "id": "C5",
        "statement": "Repository changes remain on task/rc09-doc-gardener-boundary until exact-head gates pass; persistence uses a task-owned commit, post-commit terminal resolution, current-head artifact-prune receipt, FF-only local integration, an actual-root read-only scan under the newly integrated policy, and ordinary push under the repository Git-flow contract.",
        "source": "AGENTS.md and docs/reference/local-agent-git-flow.md"
      }
    ],
    "authorization": {
      "allowed": [
        "Edit the declared repository files in the RC09 task worktree and the two declared harness-doc-gardener files outside the repository.",
        "Read and execute only C:/Users/Administrator/.codex/skills/.system/skill-creator/scripts/quick_validate.py as the required skill validator; do not modify it or inspect unrelated skill-creator content.",
        "Run read-only inspection plus focused and impact-selected validation without entering ignored .local content; validation may create only route-owned generated or test-artifact roots and must leave no unauthorized or residual root at final inventory.",
        "Create one task-owned commit, resolve the terminal plan at that commit, invoke the pathless task-frozen prune-artifacts transition, register exact-head gates, mark ready, FF-only integrate into local master, run one configured actual-root read-only smoke scan that prunes .local without entering its contents, and ordinarily push origin/master."
      ],
      "requires_reapproval": [
        "Any repository or external mutation path outside the declared scope, any read/execute dependency outside the exact validator helper, any change to the goal or current document-role/explicit-target semantics, or any need to inspect ignored .local content.",
        "Any persistence action other than the authorized result commit, artifact prune, exact-head gate/ready transitions, FF-only integration, and ordinary origin/master push.",
        "Any material base transition assessed as approval_changed or uncertain."
      ],
      "prohibited": [
        "Enumerating, reading, or mutating .local contents; reading or mutating integration-root caches, Codex-managed worktrees other than the declared task worktree, other skills/plugins apart from the exact read/execute-only validator helper, or user files. Existing historical completed/evidence documents may be read only by the required structural validation routes and must not be modified or rewritten.",
        "Coordinator cleanup, destructive broad deletion, force push, rebase, reset, stash, pull request, merge commit, release, deployment, secret access, or unrelated network access.",
        "A compatibility forwarding test at test/scaffold.test.mjs or a broad rewrite of historical references."
      ],
      "persistence": {
        "required": true,
        "action": "Persist the validated external skill repair, commit the repository-owned result, resolve the terminal plan at that commit, prune registered task artifacts, record exact-head gates and readiness, FF-only integrate into local master, run the configured actual-root read-only smoke scan without entering .local, and ordinarily push the exact integrated master to origin/master.",
        "source": "Current user authorization relayed by the parent task and docs/reference/local-agent-git-flow.md"
      }
    },
    "scope": {
      "task_paths": [
        {"path": ".doc-gardener.json", "kind": "file"},
        {"path": "README.md", "kind": "file"},
        {"path": "docs/README.md", "kind": "file"},
        {"path": "docs/reference/validation-policy.md", "kind": "file"},
        {"path": "docs/plans/proposal/RC09-doc-gardener-boundary.md", "kind": "file"},
        {"path": "docs/plans/active/RC09-doc-gardener-boundary.md", "kind": "file"},
        {"path": "docs/plans/completed/RC09-doc-gardener-boundary.md", "kind": "file"},
        {"path": "test/configuration.test.mjs", "kind": "file"},
        {"path": "test/scaffold.test.mjs", "kind": "file"},
        {"path": "test/package-boundary.test.mjs", "kind": "file"}
      ],
      "external_paths": [
        "C:/Users/Administrator/.codex/skills/harness-doc-gardener/scripts/doc_gardener.py",
        "C:/Users/Administrator/.codex/skills/harness-doc-gardener/tests/test_doc_gardener.py"
      ],
      "pre_existing_dirty": []
    },
    "milestones": [
      {
        "id": "M1",
        "outcome": "A fresh schema-v3 proposal has a current independent A0 that accepts the exact goal, authorization, scope, risks, and material base.",
        "validation_ids": ["V1"]
      },
      {
        "id": "M2",
        "outcome": "The external skill uses the effective policy during role-conflict discovery and its regression proves ignored overlap is excluded while nonignored overlap still fails closed.",
        "validation_ids": ["V2"]
      },
      {
        "id": "M3",
        "outcome": "The repository policy, authoritative wording, configuration test, and direct package-boundary test rename agree with the current boundary and retain no live compatibility path.",
        "validation_ids": ["V3", "V4"]
      },
      {
        "id": "M4",
        "outcome": "Focused skill fixtures, the configured task-worktree scan, documentation checks, package-boundary checks, and the full impact-selected offline repository gate pass at one current material state without entering .local; the actual-root scan remains a separately sequenced post-integration observation.",
        "validation_ids": ["V5", "V6", "V7", "V8"]
      },
      {
        "id": "M5",
        "outcome": "A fresh independent A1 accepts the final repository and external skill state, any required A2 is closed, V10 proves only its enumerated self-caused pending blockers remain, and a separate parent trace reports no remaining completion blocker before the result commit.",
        "validation_ids": ["V9", "V10", "V11"]
      }
    ],
    "validations": [
      {
        "id": "V1",
        "type": "manual",
        "target": "Approval completeness and activation safety",
        "criterion": "A fresh independent A0 is complete, ready_for_activation, finding-free, parent-disposed, and binds the current approval digest and material base."
      },
      {
        "id": "V2",
        "type": "automated",
        "target": "External skill policy reuse and regression safety",
        "criterion": "The focused role-policy regression, complete harness-doc-gardener test suite, and read/execute-only exact skill quick validator all exit 0, with exact approved-path pre/post hashes recorded and no other skill file changed."
      },
      {
        "id": "V3",
        "type": "automated",
        "target": "Repository policy ownership and configuration",
        "criterion": "The configuration test exits 0 and asserts exactly the five intended repository ignore additions including .local/**."
      },
      {
        "id": "V4",
        "type": "automated",
        "target": "Package-boundary test rename and compatibility removal",
        "criterion": "The renamed package-boundary test and normal test discovery exit 0, test/scaffold.test.mjs is absent, and no nonhistorical tracked file references that retired path."
      },
      {
        "id": "V5",
        "type": "automated",
        "target": "Documentation integrity and capability truth",
        "criterion": "The repository documentation checker, exact-case link checks, git diff --check, and manual authority review all pass with no current/proposed capability conflation."
      },
      {
        "id": "V6",
        "type": "automated",
        "target": "Pre-integration document-gardener traversal boundary",
        "criterion": "The configured full scan from the task worktree and a contained regression fixture both exit 0, exclude .local and the other configured generated/worktree trees, and report no role-policy conflict from ignored content; neither route enters the actual integration-root .local tree."
      },
      {
        "id": "V7",
        "type": "automated",
        "target": "Complete repository regression safety",
        "criterion": "Every impact-selected executable route required by the toolchain and validation policy, including the full offline verification route, exits 0 at the final material state."
      },
      {
        "id": "V8",
        "type": "manual",
        "target": "Final repository scope and generated-output inventory",
        "criterion": "Git inventory contains only declared task paths; no runtime, user, evidence, or unapproved ignored content is introduced; .task-artifacts is absent before the result commit and later receives the required current-head prune receipt; and route-owned .pnpm-store, node_modules, and dist outputs from required validation are explicitly inventoried and may remain only through the pushed RC09 state for the separately authorized Phase B cleanup. No validation route enumerates or reads .local contents."
      },
      {
        "id": "V9",
        "type": "manual",
        "target": "Independent implementation review",
        "criterion": "A fresh independent A1 is complete and parent-disposed at the final material state, records the exact external skill post-edit hashes it reviewed, and has no unresolved finding; every a2_required finding, if any, is closed by a fresh independent A2 at the repaired state."
      },
      {
        "id": "V10",
        "type": "automated",
        "target": "ExecPlan pre-completion lifecycle coherence",
        "criterion": "With lifecycle active and only M5, V10, and final_summary not yet recorded, fresh trace exits 0 with errors=[], warnings=[], outside_scope=[], all other milestones and validations terminal/current, current A0/A1/A2 closure, and completion_blockers containing only milestones_incomplete, validation_not_terminal, and final_summary_missing. After V10, M5, and final_summary are truthfully recorded, a separate parent trace must report an empty completion_blockers array before the plan moves to completed and the result commit is created; terminal resolution is obtained separately at that commit before coordinator readiness."
      },
      {
        "id": "V11",
        "type": "manual",
        "target": "External skill final hash freshness",
        "criterion": "The two approved external files are rehashed immediately before A1 and again immediately before the repository result commit; both observations match the exact post-edit hashes and reviewed bytes, no other skill path changed, and any drift invalidates V2, V9, and V11 and blocks persistence until the external validation and implementation review are refreshed."
      }
    ],
    "risks": [
      {"id": "R1", "risk": "Role-conflict validation may bypass the effective policy and enter an ignored or sensitive tree."},
      {"id": "R2", "risk": "A global skill repair may regress nonignored overlap refusal, explicit-target behavior, or unrelated document-gardener commands."},
      {"id": "R3", "risk": "The direct test rename may leave stale live references or silently remove package-boundary coverage from ordinary discovery."},
      {"id": "R4", "risk": "The external skill files may drift concurrently because they are outside the repository material-state identity."},
      {"id": "R5", "risk": "Offline dependencies or ignored caches may be unavailable, causing an environment gap or accidental out-of-scope artifact creation."},
      {"id": "R6", "risk": "The integration checkout may be left on an incidental Codex task branch instead of the coordinator-configured master, blocking safe reservation or integration."}
    ]
  },
  "execution_contract": {
    "decisions": [
      {"id": "D1", "statement": "Pass the already loaded effective Policy directly into markdown_files during role-conflict validation.", "rationale": "The discovery helper already owns ignore pruning, containment, reparse, and explicit-target behavior; reusing it removes the split without duplicating semantics."},
      {"id": "D2", "statement": "Adjust the existing role-policy regression so ignored overlapping role globs are excluded and retain a separate nonignored overlap failure assertion.", "rationale": "This closes the bug while preserving the fail-closed live-document contract."},
      {"id": "D3", "statement": "Add only .local/** to the existing repository ignore additions and truth-sync the three current documentation owners.", "rationale": "The user scoped private local state for exclusion; adjacent ignore behavior remains unchanged."},
      {"id": "D4", "statement": "Rename test/scaffold.test.mjs directly to test/package-boundary.test.mjs with no forwarding file and no historical evidence rewrite.", "rationale": "The test owns package/export/source inventory boundaries, and the repository will not use the pre-Phase-3 compatibility name."},
      {"id": "D5", "statement": "Capture exact external hashes before mutation, recheck them immediately before A1, and recheck them again immediately before the result commit; treat unexpected drift as invalidating V2, V9, and V11 and as a stop condition.", "rationale": "External files are outside Git material identity and require an explicit concurrency guard rather than a false material-state binding."},
      {"id": "D6", "statement": "Continue the already active coordinator task without rebinding or starting a second task, and restore the clean integration checkout to master before coordinator transitions.", "rationale": "The immutable coordinator owner is this current conversation, the task worktree is clean apart from this proposal, and the integration checkout points at the same commit as master."}
    ],
    "milestone_recovery": [
      {"id": "M1", "recovery": "Keep the plan in proposal and make no implementation edit until a fresh independent A0 is accepted."},
      {"id": "M2", "recovery": "If focused skill validation fails or external hashes drift, stop external writes, preserve the exact diff as evidence, and do not begin repository implementation."},
      {"id": "M3", "recovery": "Keep all repository edits on the task branch; repair only within the approved envelope or return to the last validated task state without destructive Git operations."},
      {"id": "M4", "recovery": "Classify deterministic versus environment failures, retain only recovery-relevant evidence, and do not claim any gate that did not pass at the current state."},
      {"id": "M5", "recovery": "Resolve confirmed in-scope findings under the audit protocol, refresh affected evidence, run V10 while only its three enumerated self-caused blockers remain, then record M5/final_summary and require a separate completion_ready parent trace before moving the plan to completed or creating the result commit."}
    ],
    "validation_bindings": [
      {"id": "V1", "state_binding": "approval"},
      {"id": "V2", "state_binding": "none"},
      {"id": "V3", "state_binding": "material"},
      {"id": "V4", "state_binding": "material"},
      {"id": "V5", "state_binding": "material"},
      {"id": "V6", "state_binding": "material"},
      {"id": "V7", "state_binding": "material"},
      {"id": "V8", "state_binding": "material"},
      {"id": "V9", "state_binding": "material"},
      {"id": "V10", "state_binding": "material"},
      {"id": "V11", "state_binding": "none"}
    ],
    "risk_controls": [
      {"id": "R1", "mitigation": "Use the effective policy in the existing traversal owner, validate the task worktree plus a contained fixture before integration, and validate the actual root only after the fix and .local ignore are integrated.", "recovery": "A pre-integration task/fixture scan failure keeps the active plan editable. A post-integration actual-root failure stops before push, preserves the truthful merged_local coordinator state and reservation, and requires an explicitly scoped recovery or follow-up; never reopen the completed plan, reset master, or disguise the failed observation."},
      {"id": "R2", "mitigation": "Keep the code delta to one policy argument and run focused plus complete skill tests and quick validation.", "recovery": "Revert only the task-owned external delta by a reviewed patch or narrow the change inside the same approved semantics, then rerun all skill checks."},
      {"id": "R3", "mitigation": "Use a direct tracked rename, run the file explicitly and via normal discovery, and search only current nonhistorical tracked sources for the retired name.", "recovery": "Repair live routing inside declared paths; do not add a compatibility file or edit historical evidence."},
      {"id": "R4", "mitigation": "Record exact SHA256 pre/post hashes and perform explicit freshness rechecks immediately before A1 and immediately before the result commit; do not pretend Git material identity covers the external files.", "recovery": "On unexpected hash drift, invalidate V2, V9, and V11, stop persistence, and request renewed ownership rather than overwriting concurrent changes."},
      {"id": "R5", "mitigation": "Use repository-owned offline routes, distinguish route-owned generated/test roots from pre-existing caches, and inspect only root-level ignored inventory without reading .local contents.", "recovery": "Remove only task-owned validation outputs through their owning commands or the registered artifact-prune transition; record a truthful environment failure and stop before persistence if dependencies require integration-cache reads, unauthorized mutation, or network access."},
      {"id": "R6", "mitigation": "Verify the integration checkout is clean and at the same commit as master, switch only that checkout back to master, then use trace and fresh CAS tokens from the existing task.", "recovery": "If integration identity, branch, dirty inventory, or coordinator task ownership becomes ambiguous, stop all coordinator mutations and request direction; never rewrite coordinator state directly."}
    ]
  },
  "execution": {
    "repository_state": {
      "approval_material_base": "091c217355917fef910c70507a08ead1119f598e",
      "current_material_base": "091c217355917fef910c70507a08ead1119f598e",
      "base_transitions": []
    },
    "milestone_progress": [
      {"id": "M1", "status": "complete", "updated_at": "2026-09-01 19:05:42+08:00"},
      {"id": "M2", "status": "complete", "updated_at": "2026-09-01 19:22:00+08:00"},
      {"id": "M3", "status": "complete", "updated_at": "2026-09-01 19:22:00+08:00"},
      {"id": "M4", "status": "complete", "updated_at": "2026-09-01 19:22:00+08:00"},
      {"id": "M5", "status": "complete", "updated_at": "2026-09-01 19:34:44+08:00"}
    ],
    "validation_results": [
      {
        "id": "V1",
        "status": "passed",
        "method": "Fresh independent schema-v3 A0 followed by parent digest/base/source/authorization disposition.",
        "evidence": "Independent reviewer /root/rc09_a0_accept reproduced 13315 canonical approval bytes and SHA256 23382FA3974DC3C1E14A4B17A2258E462599CCA13ACC5A71EA8733EF0038E9AD at material base 091c217355917fef910c70507a08ead1119f598e; trace exited 0 with errors=[], warnings=[], outside_scope=[], and the parent confirmed the unchanged external pre-edit hashes and accepted no_findings.",
        "state_id": "approval-sha256:23382FA3974DC3C1E14A4B17A2258E462599CCA13ACC5A71EA8733EF0038E9AD"
      },
      {
        "id": "V2",
        "status": "passed",
        "method": "Ran the focused effective-policy regression, the complete harness-doc-gardener unittest suite, the exact skill quick validator under explicit UTF-8 mode, and an independent contained positive fixture.",
        "evidence": "The focused role-policy test passed 1/1; unittest discovery passed 143/143; python -X utf8 quick_validate.py on the harness-doc-gardener skill exited 0 with 'Skill is valid!'; and the contained fixture exited 0 with status no_blocking_findings, issues/review_candidates/unverified_gaps all zero, and its ignored conflicting Markdown absent from scanned scope. The only approved external edits were Policy() removal in validate_document_role_conflicts and the paired regression update. Pre-edit hashes were 360D28AF1A0616610A3BAD671CFD921507C3196EB13FFCC6FAE6743061858C84 and EAC160F1F45B33A4EAEBAEC818D33AE309363EEC4762C194D42C2FF5126F6217; post-edit hashes were 864BB34E2169F612F19429070F8D89D9B56FF27084D63D4AFC1FB58102A52895 and 6582BA5CDEA33777A43E9FF409BD46893077FA7B863C2F20BACDDC5938130A40.",
        "state_id": null
      },
      {
        "id": "V3",
        "status": "passed",
        "method": "Ran the exact configuration and package-boundary Node tests under Node 24.19.0 and manually compared the policy JSON with its exact-value assertion.",
        "evidence": "node --test over test/configuration.test.mjs and test/package-boundary.test.mjs exited 0 with 7/7 tests. The asserted additive ignore list is exactly .local/**, .worktrees/**, node_modules/**, dist/**, and .pnpm-store/**.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V4",
        "status": "passed",
        "method": "Ran the renamed test explicitly and through the complete discovered suite, inspected the staged rename, and searched current nonhistorical authority/configuration paths for the retired filename.",
        "evidence": "The targeted route passed within 7/7; the complete discovered suite passed 432/432 with zero fail/skip/todo; staged inventory records an R095 direct rename to test/package-boundary.test.mjs; test/scaffold.test.mjs has no compatibility survivor; and no live authority, configuration, package script, or test router references the retired path. Historical plans and this task's explicit retirement evidence were not rewritten.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V5",
        "status": "passed",
        "method": "Ran the repository documentation route and git diff checks, then reviewed the changed README, docs index, validation policy, and current authority hierarchy for capability truth.",
        "evidence": "The final full offline route's docs phase passed with markdownFiles=114, localLinks=254, localFragments=22, forbidden=0; git diff --check exited 0; repository-relative wording consistently describes the optional private maintainer policy and does not promote it into the public toolchain or claim a Phase 3 capability.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V6",
        "status": "passed",
        "method": "Ran a configured full harness-doc-gardener scan at the RC09 task worktree and the contained ignored-overlap fixture.",
        "evidence": "The task-worktree scan exited 0 with effective policy SHA256 DED78C74E14A9DBD7E4321DDF01E788FCA5B17C96EA39DBDDDC2D14B36F37AB7, status no_blocking_findings, requested=0, policy_added=4, context=0, gated=scanned=114, live_derived=43, historical_evidence=71, and issues/review_candidates/unverified_gaps all zero. The contained fixture independently proved ignored conflict exclusion. Neither route targeted or entered integration-root .local.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V7",
        "status": "passed",
        "method": "Ran pnpm verify:offline end to end with bundled Node 24.19.0, pnpm 11.19.0, and task-local TypeScript 5.9.3 after the explicitly authorized exact dependency setup; reran the sole transient test directly five times before the clean complete rerun.",
        "evidence": "The final full route exited 0: lint passed for 227 files/43 source files; strict typecheck and build passed; all 432/432 tests passed with artifact hygiene baseline=terminal=0 and .task-artifacts reclaimed; docs passed 114/254/22/0; production dependencies=0 and TypeScript=5.9.3; package smoke passed with packedFiles=172 plus consumer types/export/persistence/source-built-installed parity/uninstall; SQLite 3.53.3 full Windows matrix passed with survivingGenerationMembers=0; and Codex boundary remained externalE2E=not_run, supportClaim=false. Standalone sqlite feasibility also passed and reclaimed its fixed artifact root.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V8",
        "status": "passed",
        "method": "Inspected staged, unstaged, ignored, reparse, whitespace, and generated-output inventory after the final full route.",
        "evidence": "Staged inventory contains exactly the eight declared path identities represented by six modifications, one active plan addition, and the direct old/new test rename; unstaged and untracked inventories are empty; git diff --check exits 0; .task-artifacts is absent; and the only ignored validation outputs are regular non-reparse .pnpm-store, node_modules, and dist directories reserved for the separately authorized post-push Phase B cleanup. No .local content was enumerated or read.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V9",
        "status": "passed",
        "method": "Obtained a fresh independent read-only A1 at the stable repository and external-file state, then reproduced its inventory, hash, scope, and adjacent-semantic evidence before parent disposition.",
        "evidence": "Independent reviewer /root/rc09_a0_accept completed A1 with no findings at reviewed_state_id git-sha1:eb3da513288042594d07095801f1dc17db8198da. The parent reproduced the exact eight-path staged inventory, R095 direct rename with no compatibility survivor, empty unstaged/untracked scope, effective-policy call path, preserved explicit-target and nonignored-overlap behavior, and exact external post-edit hashes 864BB34E2169F612F19429070F8D89D9B56FF27084D63D4AFC1FB58102A52895 and 6582BA5CDEA33777A43E9FF409BD46893077FA7B863C2F20BACDDC5938130A40. No A2 is required.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V10",
        "status": "passed",
        "method": "Ran fresh schema-v3 trace while lifecycle remained active after all other validations and A1 disposition were terminal.",
        "evidence": "Trace exited 0 at git-sha1:eb3da513288042594d07095801f1dc17db8198da with errors=[], warnings=[], outside_scope=[], a0_ready=true, A1 report and parent disposition complete, A2 not required, only V10 pending and only M5 pending, final_summary null, and completion_blockers exactly [milestones_incomplete, validation_not_terminal, final_summary_missing]. This is the exact enumerated pre-completion shape required by V10.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "id": "V11",
        "status": "passed",
        "method": "Rehashed both approved external files immediately before A1 and again at the start of the uninterrupted result-commit completion sequence, with no external write permitted between the final observation and persistence.",
        "evidence": "The pre-A1 observation and the 2026-09-01 19:34:05+08:00 final pre-commit observation both matched doc_gardener.py SHA256 864BB34E2169F612F19429070F8D89D9B56FF27084D63D4AFC1FB58102A52895 and test_doc_gardener.py SHA256 6582BA5CDEA33777A43E9FF409BD46893077FA7B863C2F20BACDDC5938130A40. These are the exact bytes independently reviewed in A1; in-memory reversal of only the declared edits reproduced both pre-edit hashes. No other skill path was authored by RC09, and any later mismatch remains a hard abort before commit.",
        "state_id": null
      }
    ],
    "ownership_receipts": [],
    "audits": {
      "a0": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/rc09_a0_accept",
        "independence": "Fresh read-only reviewer; did not author the current proposal revision, make its material decisions, or participate in implementation.",
        "scope": "Activation-readiness review of the exact RC09 proposal at material base 091c217355917fef910c70507a08ead1119f598e, including the complete approval and execution contracts, repository authorities, relevant repository and harness-doc-gardener source/config/tests, exact quick validator, current trace, and applicable persistence lens.",
        "readiness": "ready_for_activation",
        "reviewed_at": "2026-09-01 19:04:55+08:00",
        "approval_sha256": "23382FA3974DC3C1E14A4B17A2258E462599CCA13ACC5A71EA8733EF0038E9AD",
        "reviewed_material_base": "091c217355917fef910c70507a08ead1119f598e",
        "evidence": "Fresh trace exited 0 with errors=[], warnings=[], outside_scope=[], approval_contract_bytes=13315, matching approval digest, and task/head/material base 091c217355917fef910c70507a08ead1119f598e. Independent canonical UTF-8 JSON computation reproduced the same byte count and digest. Source review confirmed role-conflict discovery alone substitutes Policy() for the already loaded effective policy while ordinary traversal and inventory paths use that effective policy; the proposed one-argument repair reuses existing ignore, containment, reparse, and explicit-target semantics. Historical structural-read limits, exact quick-validator authorization, V10 blocker sequencing, R1 pre/post-integration recovery, V11 external freshness, generated-output Phase B ownership, and post-integration actual-root scan ordering were reviewed non-fail-fast with no material gap. External pre-edit hashes remained 360D28AF1A0616610A3BAD671CFD921507C3196EB13FFCC6FAE6743061858C84 and EAC160F1F45B33A4EAEBAEC818D33AE309363EEC4762C194D42C2FF5126F6217.",
        "parent_disposition": "complete",
        "findings": []
      },
      "a1": {
        "report_status": "complete",
        "reviewer": "Codex independent reviewer /root/rc09_a0_accept",
        "independence": "Fresh read-only implementation reviewer; did not implement or repair RC09 and made no repository, Git, coordinator, or external-state mutation during this audit.",
        "scope": "Complete staged RC09 repository diff and exact external harness-doc-gardener delta at Git material state git-sha1:eb3da513288042594d07095801f1dc17db8198da, including approval/execution boundaries, current trace and validation evidence, repository authority/config/docs/package tests, validate_document_role_conflicts, markdown_files ignore and explicit-target traversal, document-role assignment, the directly adjacent role-policy regressions, generated-output ownership, and external-file freshness.",
        "reviewed_at": "2026-09-01 19:30:38+08:00",
        "evidence": "Fresh trace exited 0 with errors=[], warnings=[], outside_scope=[], a0_ready=true, state_id=git-sha1:eb3da513288042594d07095801f1dc17db8198da, M1-M4 complete, V1-V8 passed, and only V9-V11/M5/final_summary pending. The complete staged inventory contains only the eight declared path identities: six modifications, one active lifecycle plan addition, and an R095 direct rename from test/scaffold.test.mjs to test/package-boundary.test.mjs; unstaged and untracked inventories are empty and both staged and unstaged diff checks exit 0. Repository changes add exactly .local/**, truth-sync the three current documentation owners, update the exact configuration assertion, and rename the package-boundary test without a compatibility survivor or non-plan live reference. External current hashes are 864BB34E2169F612F19429070F8D89D9B56FF27084D63D4AFC1FB58102A52895 and 6582BA5CDEA33777A43E9FF409BD46893077FA7B863C2F20BACDDC5938130A40. In-memory reversal of only the Policy() removal/policy argument replacement and paired regression edits reproduces the exact pre-edit hashes 360D28AF1A0616610A3BAD671CFD921507C3196EB13FFCC6FAE6743061858C84 and EAC160F1F45B33A4EAEBAEC818D33AE309363EEC4762C194D42C2FF5126F6217, proving the declared external delta is exact. Source review confirms effective-policy pruning occurs before containment/reparse descent, .local/** matches the directory and descendants, nonignored overlaps still fail closed, and explicitly targeted ignored content retains existing override behavior and final role-conflict validation. Reviewed evidence records focused 1/1, external unittest 143/143, quick validation, contained ignored-overlap proof, repository targeted 7/7, final discovered suite 432/432, full offline/document/package/SQLite/Codex gates, and truthful prior environment/invocation attempts. .task-artifacts is absent; the only ignored outputs are task-local regular non-reparse .pnpm-store, node_modules, and dist roots reserved for authorized Phase B cleanup. No validation was rerun during A1.",
        "reviewed_state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da",
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
        "finding_ids": ["F-A0-001", "F-A0-002", "F-A0-003", "F-A0-004"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-09-01 18:33:20+08:00 bound approval digest 5CC90442DCE5B4696B5539C1F4697B514BC810DB02D660D674E7513A87573BEF and found four contract gaps: actual-root scanning was circular before integration, terminal resolution was circular before the result commit, the exact required quick validator lacked read/execute authorization, and final artifact wording conflicted with generated outputs from required validation. The approval contract now uses task-root plus contained pre-integration proof, sequences actual-root smoke after FF integration and before push, moves terminal resolution after the result commit, authorizes only the exact validator helper read/execute, and requires zero unauthorized or residual artifact tree."
      },
      {
        "audit": "A0",
        "attempt": 2,
        "report_status": "complete",
        "finding_ids": ["F-A0-R2-HISTORICAL-SCOPE", "F-A0-R2-TERMINAL-CYCLE", "F-A0-R2-EXTERNAL-FRESHNESS", "F-A0-R2-VALIDATION-RESIDUE"],
        "disposition": "superseded",
        "reason": "Fresh independent A0 at 2026-09-01 18:41:25+08:00 reviewed the concurrently superseded approval digest BB400656CEC30BEC6B7134BFE7A9D2095524341DE46048A1F4487AA824DC437A and found four contract gaps. The later B69B1217C39D373F55EB5033CEBA709263262C12C755AF605E8DFE84F16E11F8 proposal had already closed the terminal cycle, but parent review confirmed the historical structural-read boundary, external freshness binding, and generated-output terminal wording still required revision. This attempt is preserved as stale review evidence and is not the current A0."
      },
      {
        "audit": "A0",
        "attempt": 3,
        "report_status": "complete",
        "finding_ids": ["F-A0-R3-TRACE-SELF-CYCLE", "F-A0-R3-POST-INTEGRATION-RECOVERY"],
        "disposition": "reopened",
        "reason": "Fresh independent A0 at 2026-09-01 18:52:25+08:00 bound approval digest A49CDF6D8F870B097327848736A12DA91B909B921060DCECB550D755DFD2BF8E and found two MEDIUM contract gaps: V10 required the final blocker-free trace that it could not truthfully produce while pending, and R1 incorrectly routed a post-integration actual-root failure back to an active plan. The revised contract makes V10 prove only its enumerated self-caused pending blockers, requires a separate parent completion_ready trace after recording V10/M5/final_summary, and preserves merged_local truth while stopping push on a post-integration scan failure."
      }
    ],
    "validation_attempts": [
      {
        "validation_id": "V2",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 19:07:00+08:00",
        "evidence": "The exact quick validator's initial default Windows Python invocation decoded UTF-8 skill content with the active GBK locale and raised UnicodeDecodeError. Reinvocation with Python's explicit -X utf8 mode passed without changing any file.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 1,
        "classification": "environment_failure",
        "at": "2026-09-01 19:10:00+08:00",
        "evidence": "The first task-local pnpm install attempt used offline mode before the exact TypeScript 5.9.3 tarball existed in the task-local store and failed closed with ERR_PNPM_NO_OFFLINE_TARBALL before tests. The user-authorized exact registry setup then populated only the task-local ignored dependency roots.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 2,
        "classification": "invalid_invocation",
        "at": "2026-09-01 19:12:00+08:00",
        "evidence": "The first verify command supplied pnpm's path without placing the bundled Node directory on child PATH, so the route stopped before tests. The corrected invocation exported the bundled Node directory for child processes.",
        "state_id": null
      },
      {
        "validation_id": "V7",
        "attempt": 3,
        "classification": "invalid_invocation",
        "at": "2026-09-01 19:13:00+08:00",
        "evidence": "The next corrected-PATH invocation reached lint while the direct test rename had not yet been staged; the repository lint correctly rejected that index/worktree mismatch. Exact declared paths were staged, after which lint passed.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      },
      {
        "validation_id": "V7",
        "attempt": 4,
        "classification": "environment_failure",
        "at": "2026-09-01 19:17:00+08:00",
        "evidence": "The first true full route passed 431/432 and observed one backup identity test's one-time missing expected exception. The exact failing test then passed five consecutive isolated reruns without mutation, and the second complete route passed all 432/432 plus every later phase, supporting transient classification rather than a retained deterministic defect.",
        "state_id": "git-sha1:eb3da513288042594d07095801f1dc17db8198da"
      }
    ],
    "contract_revisions": [
      {
        "at": "2026-09-01 18:34:51+08:00",
        "summary": "Closed A0 F-A0-001 through F-A0-004 by removing circular scan/terminal gates, authorizing the exact read-only validator dependency, and making artifact acceptance terminal-state based.",
        "previous_approval_sha256": "5CC90442DCE5B4696B5539C1F4697B514BC810DB02D660D674E7513A87573BEF"
      },
      {
        "at": "2026-09-01 18:45:23+08:00",
        "summary": "Allowed only required structural reads of tracked historical Markdown, separated external skill freshness from Git material identity with two final hash rechecks, and made expected validation outputs explicit residue for the separately authorized post-push cleanup phase.",
        "previous_approval_sha256": "B69B1217C39D373F55EB5033CEBA709263262C12C755AF605E8DFE84F16E11F8"
      },
      {
        "at": "2026-09-01 18:55:17+08:00",
        "summary": "Removed V10's self-referential completion criterion and split pre-integration scan recovery from the truthful stop-before-push recovery required after FF integration.",
        "previous_approval_sha256": "A49CDF6D8F870B097327848736A12DA91B909B921060DCECB550D755DFD2BF8E"
      }
    ],
    "final_summary": "RC09 makes document-role conflict validation reuse the effective traversal policy, excludes private .local state from ordinary repository scans, truth-syncs current documentation, and directly renames the package-boundary test with no compatibility shim; full skill and repository validation plus fresh independent A0/A1 completed without unresolved findings."
  }
}
```

## Context

RC09 已由 coordinator 在提交 `091c217355917fef910c70507a08ead1119f598e` 上创建任务分支与 linked worktree。此前两个错误对话均已被中断并归档；当前 plan 保留其 proposal 与 A0 attempt 作为同一 ExecPlan 的生命周期证据，但不继承任何实现、测试或通过结论。当前任务的 coordinator owner 就是本对话，且集成根已经从同提交的临时 `codex/rc09` 分支恢复为 `master`。本 ExecPlan 只治理 RC09 阶段；RC09 验证、集成和推送成功后，才按 Git-flow 独立执行用户已授权的 Phase B 清理。
